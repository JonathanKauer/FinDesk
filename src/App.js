// src/App.js
import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Helmet } from "react-helmet";
import { collection, doc, setDoc } from 'firebase/firestore';
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  sendPasswordResetEmail
} from "firebase/auth";
import { db, auth, storage } from './firebase-config.js';
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";

// Componentes de listagem
import TicketList from './TicketList.js';         // Visualização resumida para usuários comuns
import TicketListAdmin from './TicketListAdmin.js'; // Visualização completa para admin

// Constantes e configurações
const ADMIN_DEFAULT_PASSWORD = "admin123@guiainvestgpt";
const adminEmails = ["jonathan.kauer@guiainvest.com.br", "nayla.martins@guiainvest.com.br"];

const initialCargoOptions = [
  "Aquisição",
  "Backoffice",
  "Consultoria",
  "Diretoria",
  "Finanças & Compliance",
  "Pessoas & Cultura",
  "Securitário",
  "Sucesso do Cliente",
  "Tecnologia",
  "+Novo"
];

const priorityOptions = [
  "Baixa (7 dias úteis)",
  "Média (5 dias úteis)",
  "Alta (2 dias úteis)",
  "Urgente (1 dia útil)"
];

const atendenteOptions = ["jonathan.kauer@guiainvest.com.br", "nayla.martins@guiainvest.com.br"];

const priorityDaysMapping = {
  "Baixa (7 dias úteis)": 7,
  "Média (5 dias úteis)": 5,
  "Alta (2 dias úteis)": 2,
  "Urgente (1 dia útil)": 1,
};

function addBusinessDays(date, days) {
  let result = new Date(date);
  while (days > 0) {
    result.setDate(result.getDate() + 1);
    const dayOfWeek = result.getDay();
    if (dayOfWeek !== 0 && dayOfWeek !== 6) {
      days--;
    }
  }
  return result;
}

function generateTicketId() {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let id = "";
  for (let i = 0; i < 13; i++) {
    id += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return id;
}

// Calcula a SLA com base na diferença entre data de abertura e de resolução
function calculateSLA(dataDeAberturaISO, dataResolucaoISO) {
  const start = new Date(dataDeAberturaISO);
  const end = new Date(dataResolucaoISO);
  const diffMs = end - start;
  const diffMinutes = Math.floor(diffMs / 60000);
  if (diffMinutes < 60) return diffMinutes + " minuto(s)";
  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return diffHours + " hora(s)";
  const diffDays = Math.floor(diffHours / 24);
  return diffDays + " dia(s)";
}

async function sendTicketUpdateEmail(ticket, updateDescription) {
  const subject = "Findesk: Atualização em chamado";
  const body =
    `Resumo da atualização: ${updateDescription}\n` +
    `Ticket ID: ${ticket.id}\n` +
    `Solicitante: ${ticket.nomeSolicitante}\n` +
    `Status: ${ticket.status}\n` +
    `Descrição: ${ticket.descricaoProblema}\n` +
    `Link de acesso: https://fin-desk.vercel.app/`;
  console.log(`Enviando email para ${ticket.emailSolicitante} e para jonathan.kauer@guiainvest.com.br`);
  const url = "https://script.google.com/macros/s/AKfycbz2xFbYeeP4sp8JdNeT2JxkeHk5SEDYrYOF37NizSPlAaG7J6KjekAWECVr6NPTJkUN/exec";
  const emails = ["jonathan.kauer@guiainvest.com.br", ticket.emailSolicitante];
  try {
    await Promise.all(
      emails.map(email => {
        const formdata = { email, subject, message: body };
        return fetch(url, {
          method: "POST",
          mode: "no-cors",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(formdata)
        })
          .then(() => console.log(`Email enviado para ${email}!`))
          .catch(error => console.error(`Erro no envio para ${email}:`, error));
      })
    );
  } catch (error) {
    console.error("Erro ao enviar e-mails:", error);
  }
}

// Valida se o nome do solicitante é composto com iniciais em maiúsculas
function isValidSolicitanteName(name) {
  const parts = name.trim().split(/\s+/);
  if (parts.length < 2) return false;
  for (const part of parts) {
    if (part[0] !== part[0].toUpperCase()) return false;
  }
  return true;
}

function App() {
  const [currentUser, setCurrentUser] = useState(null);
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [signupEmail, setSignupEmail] = useState("");
  const [signupPassword, setSignupPassword] = useState("");
  const [isLoginScreen, setIsLoginScreen] = useState(true);
  const [activeTab, setActiveTab] = useState("open");
  const [modoAdmin, setModoAdmin] = useState(true); // Toggle para admins

  // Filtros de admin
  const [adminFilterPriority, setAdminFilterPriority] = useState("");
  const [adminFilterCategory, setAdminFilterCategory] = useState("");
  const [adminFilterAtendente, setAdminFilterAtendente] = useState("");

  // Estados do formulário de criação de ticket
  const [showNewTicketForm, setShowNewTicketForm] = useState(false);
  const [newTicketNome, setNewTicketNome] = useState("");
  const [cargoDepartamento, setCargoDepartamento] = useState("");
  const [descricaoProblema, setDescricaoProblema] = useState("");
  const [categoria, setCategoria] = useState("");
  const [prioridade, setPrioridade] = useState("");
  const [newTicketFiles, setNewTicketFiles] = useState([]);

  const [cargoOptions, setCargoOptions] = useState(initialCargoOptions);
  const [categoryOptions, setCategoryOptions] = useState([
    "Clientes",
    "Comissões e/ou SplitC",
    "Basement",
    "+Novo"
  ]);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        user.getIdTokenResult().then(idTokenResult => {
          const isAdminClaim = !!idTokenResult.claims.admin;
          setCurrentUser({ ...user, isAdmin: isAdminClaim });
        });
      } else {
        setCurrentUser(null);
      }
    });
    return () => unsubscribe();
  }, []);

  const handleLoginSubmit = (e) => {
    e.preventDefault();
    if (!loginEmail.trim() || !loginPassword.trim()) {
      alert("Por favor, preencha todos os campos de login.");
      return;
    }
    signInWithEmailAndPassword(auth, loginEmail, loginPassword)
      .then((userCredential) => {
        const user = userCredential.user;
        user.getIdTokenResult().then(idTokenResult => {
          const isAdminClaim = !!idTokenResult.claims.admin;
          console.log("Usuário logado com sucesso:", user.uid, "isAdmin:", isAdminClaim);
          setCurrentUser({ ...user, isAdmin: isAdminClaim });
        });
        setLoginEmail("");
        setLoginPassword("");
      })
      .catch((error) => {
        console.error("Erro ao fazer login:", error);
        alert("Falha ao autenticar. Verifique suas credenciais.");
      });
  };

  const handleSignUp = (e) => {
    e.preventDefault();
    if (!signupEmail.trim() || !signupPassword.trim()) {
      alert("Por favor, preencha todos os campos de cadastro.");
      return;
    }
    if (!signupEmail.toLowerCase().endsWith("@guiainvest.com.br")) {
      alert("Somente emails do domínio @guiainvest.com.br são permitidos.");
      return;
    }
    createUserWithEmailAndPassword(auth, signupEmail, signupPassword)
      .then((userCredential) => {
        console.log("Usuário criado com sucesso:", userCredential.user.uid);
        alert("Conta criada com sucesso! Faça login para continuar.");
        setIsLoginScreen(true);
        setSignupEmail("");
        setSignupPassword("");
      })
      .catch((error) => {
        console.error("Erro ao criar conta:", error);
        alert("Falha ao criar conta. Verifique os dados e tente novamente.");
      });
  };

  const handleLogout = () => {
    signOut(auth)
      .then(() => {
        setCurrentUser(null);
      })
      .catch((error) => {
        console.error("Erro ao deslogar:", error);
      });
  };

  const handleResetPassword = () => {
    if (!loginEmail.trim()) {
      alert("Por favor, insira seu e-mail para redefinir a senha.");
      return;
    }
    sendPasswordResetEmail(auth, loginEmail)
      .then(() => {
        alert("Um e-mail de redefinição de senha foi enviado para " + loginEmail);
      })
      .catch((error) => {
        console.error("Erro ao redefinir senha:", error);
        alert("Falha ao enviar e-mail de redefinição. Verifique se o e-mail está correto.");
      });
  };

  const handleCreateTicket = async (e) => {
    e.preventDefault();
    console.log("Iniciando criação do chamado...");

    if (!newTicketNome.trim()) {
      alert("Insira o nome completo do solicitante.");
      console.log("Criação abortada: campo de nome vazio.");
      return;
    }
    if (!isValidSolicitanteName(newTicketNome)) {
      alert("Por favor, insira um nome composto com as iniciais em maiúsculas.");
      console.log("Criação abortada: nome inválido.");
      return;
    }

    const user = auth.currentUser;
    if (!user) {
      alert("Você precisa estar logado para criar um ticket.");
      console.log("Criação abortada: usuário não logado.");
      return;
    }

    const ticketId = generateTicketId();
    const dataDeAbertura = new Date();
    const dataDeAberturaISO = dataDeAbertura.toISOString();
    const dataDeAberturaDisplay = dataDeAbertura.toLocaleString();
    const daysToAdd = priorityDaysMapping[prioridade] || 0;
    const prazoFinalizacaoDate = addBusinessDays(dataDeAbertura, daysToAdd);
    const prazoFinalizacao = prazoFinalizacaoDate.toISOString();

    // Upload dos anexos para o Storage
    let attachmentURLs = [];
    if (newTicketFiles.length > 0) {
      for (const file of newTicketFiles) {
        try {
          const storageRef = ref(storage, `tickets/${ticketId}/${file.name}`);
          await uploadBytes(storageRef, file);
          const downloadURL = await getDownloadURL(storageRef);
          attachmentURLs.push({ url: downloadURL, name: file.name });
        } catch (error) {
          console.error("Erro ao fazer upload do arquivo:", error);
        }
      }
    }

    const newTicket = {
      id: ticketId,
      nomeSolicitante: newTicketNome,
      emailSolicitante: user.email,
      userId: user.uid,
      cargoDepartamento,
      descricaoProblema,
      categoria,
      prioridade,
      dataDeAbertura: dataDeAberturaDisplay,
      dataDeAberturaISO,
      prazoFinalizacao,
      status: "Aberto",
      dataResolucao: "",
      sla: "",
      responsavel: "",
      comentarios: [],
      attachments: attachmentURLs,
    };

    try {
      console.log("Chamando setDoc...");
      await setDoc(doc(db, 'tickets', ticketId), newTicket);
      console.log("Ticket salvo no Firestore com sucesso!");
      sendTicketUpdateEmail(newTicket, "Abertura de novo chamado");
    } catch (error) {
      console.error("Erro ao criar ticket no Firestore:", error);
      alert("Falha ao criar o ticket. Verifique o console para detalhes.");
    }

    setNewTicketNome("");
    setCargoDepartamento("");
    setDescricaoProblema("");
    setCategoria("");
    setPrioridade("");
    setNewTicketFiles([]);
    setShowNewTicketForm(false);
  };

  const handleTicketFileChange = (e) => {
    setNewTicketFiles(Array.from(e.target.files));
  };

  return (
    <div className="min-h-screen bg-gray-100 relative p-4" style={{ color: "#0E1428" }}>
      <Helmet>
        <title>FinDesk</title>
        <link rel="icon" href="/guiainvest-logo.png" />
      </Helmet>

      <div className="flex flex-col items-center mb-4">
        <img src="/logo.png" alt="FinDesk Logo" className="h-12 mb-2" />
        <motion.h1
          className="text-3xl font-bold"
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          FinDesk
        </motion.h1>
      </div>

      {!currentUser && (
        <div className="flex items-center justify-center">
          {isLoginScreen ? (
            <form onSubmit={handleLoginSubmit} className="bg-white shadow p-4 rounded-2xl w-full max-w-md">
              <h2 className="text-xl font-bold mb-4 text-center">Faça seu login</h2>
              <div className="mb-2">
                <label className="block font-semibold">E-mail:</label>
                <input
                  type="email"
                  value={loginEmail}
                  onChange={(e) => setLoginEmail(e.target.value)}
                  required
                  className="border rounded px-2 py-1 w-full"
                  placeholder="Digite seu e-mail"
                />
              </div>
              <div className="mb-2">
                <label className="block font-semibold">Senha:</label>
                <input
                  type="password"
                  value={loginPassword}
                  onChange={(e) => setLoginPassword(e.target.value)}
                  required
                  className="border rounded px-2 py-1 w-full"
                />
              </div>
              <div className="flex justify-between mt-4">
                <button type="submit" className="px-3 py-1 rounded shadow" style={{ backgroundColor: "#0E1428", color: "white" }}>
                  Entrar
                </button>
                <button
                  type="button"
                  onClick={handleResetPassword}
                  className="px-3 py-1 rounded shadow"
                  style={{ backgroundColor: "#FF5E00", color: "white" }}
                >
                  Redefinir senha
                </button>
              </div>
              <p className="mt-4 text-center">
                Não tem conta?{" "}
                <button type="button" onClick={() => setIsLoginScreen(false)} className="text-blue-500">
                  Cadastre-se
                </button>
              </p>
            </form>
          ) : (
            <form onSubmit={handleSignUp} className="bg-white shadow p-4 rounded-2xl w-full max-w-md">
              <h2 className="text-xl font-bold mb-4 text-center">Crie sua conta</h2>
              <div className="mb-2">
                <label className="block font-semibold">E-mail:</label>
                <input
                  type="email"
                  value={signupEmail}
                  onChange={(e) => setSignupEmail(e.target.value)}
                  required
                  className="border rounded px-2 py-1 w-full"
                  placeholder="Digite seu e-mail (@guiainvest.com.br)"
                />
              </div>
              <div className="mb-2">
                <label className="block font-semibold">Senha:</label>
                <input
                  type="password"
                  value={signupPassword}
                  onChange={(e) => setSignupPassword(e.target.value)}
                  required
                  className="border rounded px-2 py-1 w-full"
                />
              </div>
              <button type="submit" className="w-full px-3 py-1 rounded shadow" style={{ backgroundColor: "#0E1428", color: "white" }}>
                Criar Conta
              </button>
              <p className="mt-4 text-center">
                Já tem conta?{" "}
                <button type="button" onClick={() => setIsLoginScreen(true)} className="text-blue-500">
                  Faça login
                </button>
              </p>
            </form>
          )}
        </div>
      )}

      {currentUser && (
        <>
          <div className="absolute top-4 right-4">
            <button onClick={handleLogout} className="px-3 py-1 rounded shadow" style={{ backgroundColor: "#FF5E00", color: "white" }}>
              Sair
            </button>
          </div>

          {currentUser.isAdmin && (
            <div className="flex justify-end mb-4">
              <button
                onClick={() => setModoAdmin(!modoAdmin)}
                className="px-3 py-1 rounded shadow"
                style={{ backgroundColor: modoAdmin ? "#0E1428" : "#FF5E00", color: "white" }}
              >
                {modoAdmin ? "Atuando como Admin" : "Atuando como Usuário Comum"}
              </button>
            </div>
          )}

          <div className="flex flex-col items-center mb-4">
            <div className="flex gap-4 mb-4">
              <button
                onClick={() => setActiveTab("open")}
                className="px-3 py-1 rounded"
                style={
                  activeTab === "open"
                    ? { backgroundColor: "#0E1428", color: "white" }
                    : { backgroundColor: "#f2f2f2", color: "#0E1428", border: "1px solid #0E1428" }
                }
              >
                Abertos e em andamento
              </button>
              <button
                onClick={() => setActiveTab("closed")}
                className="px-3 py-1 rounded"
                style={
                  activeTab === "closed"
                    ? { backgroundColor: "#0E1428", color: "white" }
                    : { backgroundColor: "#f2f2f2", color: "#0E1428", border: "1px solid #0E1428" }
                }
              >
                Concluídos
              </button>
            </div>
            {currentUser.isAdmin && modoAdmin && (
              <div className="flex flex-col sm:flex-row items-center gap-2">
                <select
                  value={adminFilterPriority}
                  onChange={(e) => setAdminFilterPriority(e.target.value)}
                  className="border rounded px-2 py-1"
                >
                  <option value="">Prioridade: Todas</option>
                  {priorityOptions.map((p, idx) => (
                    <option key={idx} value={p}>{p}</option>
                  ))}
                </select>
                <select
                  value={adminFilterCategory}
                  onChange={(e) => setAdminFilterCategory(e.target.value)}
                  className="border rounded px-2 py-1"
                >
                  <option value="">Categoria: Todas</option>
                  {categoryOptions.filter(cat => cat !== "+Novo").map((cat, idx) => (
                    <option key={idx} value={cat}>{cat}</option>
                  ))}
                </select>
                <select
                  value={adminFilterAtendente}
                  onChange={(e) => setAdminFilterAtendente(e.target.value)}
                  className="border rounded px-2 py-1"
                >
                  <option value="">Atendente: Todos</option>
                  {atendenteOptions.map((opt, idx) => (
                    <option key={idx} value={opt}>{opt}</option>
                  ))}
                </select>
              </div>
            )}
          </div>

          {(!currentUser.isAdmin || (currentUser.isAdmin && !modoAdmin)) && (
            <div className="mb-4 flex justify-center">
              <button
                onClick={() => setShowNewTicketForm(true)}
                className="px-3 py-1 rounded shadow"
                style={{ backgroundColor: "#FF5E00", color: "white" }}
              >
                Criar Novo Chamado
              </button>
            </div>
          )}

          {showNewTicketForm && (
            <motion.form
              className="bg-white shadow p-4 rounded-2xl w-full max-w-lg mx-auto mb-4"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3 }}
              onSubmit={handleCreateTicket}
            >
              <h2 className="text-xl font-bold mb-4">Novo Chamado FinDesk</h2>
              <div className="mb-2">
                <label className="block font-semibold">Nome Completo do Solicitante:</label>
                <input
                  type="text"
                  value={newTicketNome}
                  onChange={(e) => setNewTicketNome(e.target.value)}
                  required
                  className="border rounded px-2 py-1 w-full"
                  placeholder="Ex.: Jonathan Kauer"
                />
              </div>
              <div className="mb-2">
                <label className="block font-semibold">Cargo/Departamento:</label>
                <select
                  value={cargoDepartamento}
                  onChange={(e) => {
                    if (e.target.value === "+Novo") {
                      const novoCargo = prompt("Digite o novo cargo/departamento:");
                      if (novoCargo) {
                        setCargoOptions([...cargoOptions.slice(0, -1), novoCargo, "+Novo"]);
                        setCargoDepartamento(novoCargo);
                      }
                    } else {
                      setCargoDepartamento(e.target.value);
                    }
                  }}
                  required
                  className="border rounded px-2 py-1 w-full"
                >
                  <option value="">Selecione</option>
                  {cargoOptions.map((option, idx) => (
                    <option key={idx} value={option}>{option}</option>
                  ))}
                </select>
              </div>
              <div className="mb-2">
                <label className="block font-semibold">Descrição do Problema:</label>
                <textarea
                  value={descricaoProblema}
                  onChange={(e) => setDescricaoProblema(e.target.value)}
                  required
                  className="border rounded px-2 py-1 w-full"
                  rows="4"
                />
              </div>
              <div className="mb-2">
                <label className="block font-semibold">Categoria:</label>
                <select
                  value={categoria}
                  onChange={(e) => {
                    if (e.target.value === "+Novo") {
                      const novaCategoria = prompt("Digite a nova categoria:");
                      if (novaCategoria) {
                        const filtered = categoryOptions.filter(opt => opt !== "+Novo");
                        setCategoryOptions([...filtered, novaCategoria, "+Novo"]);
                        setCategoria(novaCategoria);
                      }
                    } else {
                      setCategoria(e.target.value);
                    }
                  }}
                  required
                  className="border rounded px-2 py-1 w-full"
                >
                  <option value="" disabled>Selecione</option>
                  {categoryOptions.map((option, idx) => (
                    <option key={idx} value={option}>{option}</option>
                  ))}
                </select>
              </div>
              <div className="mb-2">
                <label className="block font-semibold">Prioridade:</label>
                <select
                  name="prioridade"
                  value={prioridade}
                  onChange={(e) => setPrioridade(e.target.value)}
                  required
                  className="border rounded px-2 py-1 w-full"
                >
                  <option value="">Selecione</option>
                  {priorityOptions.map((option, idx) => (
                    <option key={idx} value={option}>{option}</option>
                  ))}
                </select>
              </div>
              <div className="mb-2">
                <label className="block font-semibold">Anexar documentos/evidências:</label>
                <input type="file" multiple onChange={handleTicketFileChange} className="w-full" />
              </div>
              <div className="flex justify-end gap-2 mt-4">
                <button type="button" onClick={() => setShowNewTicketForm(false)} className="px-3 py-1 bg-gray-300 rounded">
                  Cancelar
                </button>
                <button type="submit" className="px-3 py-1 rounded" style={{ backgroundColor: "#0E1428", color: "white" }}>
                  Criar Chamado
                </button>
              </div>
            </motion.form>
          )}

          <div className="mt-8 w-full max-w-5xl mx-auto">
            {currentUser.isAdmin && modoAdmin ? (
              <TicketListAdmin
                activeTab={activeTab}
                filterPriority={adminFilterPriority}
                filterCategory={adminFilterCategory}
                filterAtendente={adminFilterAtendente}
                onSendEmail={sendTicketUpdateEmail}
                calculateSLA={calculateSLA}
              />
            ) : (
              <TicketList
                activeTab={activeTab}
                currentUser={currentUser}
                onSendEmail={sendTicketUpdateEmail}
                calculateSLA={calculateSLA}
              />
            )}
          </div>
        </>
      )}
    </div>
  );
}

export default App;
