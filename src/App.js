// src/App.js
import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Helmet } from "react-helmet";
import { collection, addDoc } from 'firebase/firestore';
import { db } from './firebase-config.js';

// Componentes de listagem
import TicketList from './TicketList.js';         // Usuário comum
import TicketListAdmin from './TicketListAdmin.js'; // Admin

// Opções para Cargo/Departamento
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

// Opções de prioridade
const priorityOptions = [
  "Baixa (7 dias úteis)",
  "Média (5 dias úteis)",
  "Alta (2 dias úteis)",
  "Urgente (1 dia útil)"
];

// Opções de atendentes (apenas para admin)
const atendenteOptions = ["Jonathan Kauer", "Nayla Martins"];

// Mapeamento prioridade -> dias úteis
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

// Exemplo de envio de e-mail
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

function App() {
  // currentUser: { email, isAdmin }
  const [currentUser, setCurrentUser] = useState(null);
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");

  // Controle de abas (Abertos/Concluídos)
  const [activeTab, setActiveTab] = useState("open");

  // Filtros de admin
  const [adminFilterPriority, setAdminFilterPriority] = useState("");
  const [adminFilterCategory, setAdminFilterCategory] = useState("");
  const [adminFilterAtendente, setAdminFilterAtendente] = useState("");

  // Formulário de novo chamado
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

  // Lógica de login
  const handleLoginSubmit = (e) => {
    e.preventDefault();
    if (!loginEmail.trim() || !loginPassword.trim()) {
      alert("Por favor, preencha todos os campos de login.");
      return;
    }
    // E-mails admin
    const adminEmails = ["jonathan.kauer@guiainvest.com.br", "nayla.martins@guiainvest.com.br"];
    let isAdmin = false;
    if (adminEmails.includes(loginEmail.toLowerCase())) {
      if (loginPassword === "admin123@guiainvestgpt") {
        isAdmin = true;
      } else {
        alert("Senha de admin incorreta. Você será logado como usuário comum.");
      }
    }
    setCurrentUser({ email: loginEmail, isAdmin });
    setLoginEmail("");
    setLoginPassword("");
  };

  // Criação de ticket
  const handleCreateTicket = async (e) => {
    e.preventDefault();
    if (!newTicketNome.trim()) {
      alert("Insira o nome completo do solicitante.");
      return;
    }
    const dataDeAbertura = new Date();
    const dataDeAberturaISO = dataDeAbertura.toISOString();
    const dataDeAberturaDisplay = dataDeAbertura.toLocaleString();

    const daysToAdd = priorityDaysMapping[prioridade] || 0;
    const prazoFinalizacaoDate = addBusinessDays(dataDeAbertura, daysToAdd);
    const prazoFinalizacao = prazoFinalizacaoDate.toISOString();

    const newTicket = {
      id: generateTicketId(),
      nomeSolicitante: newTicketNome,
      emailSolicitante: currentUser.email,
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
      attachments: newTicketFiles,
    };

    try {
      await addDoc(collection(db, 'tickets'), newTicket);
      console.log("Ticket salvo no Firestore com sucesso!");
      sendTicketUpdateEmail(newTicket, "Abertura de novo chamado");
    } catch (error) {
      console.error("Erro ao salvar ticket no Firestore:", error);
    }

    // Limpa o formulário e fecha
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

  // Logout
  const handleLogout = () => {
    setCurrentUser(null);
  };

  // Redefinir senha
  const handleResetPassword = () => {
    if (!loginEmail.trim()) {
      alert("Por favor, insira seu e-mail para redefinir a senha.");
      return;
    }
    const newPass = prompt("Digite sua nova senha:");
    if (!newPass?.trim()) {
      alert("Nova senha inválida!");
      return;
    }
    const confirmPass = prompt("Confirme sua nova senha:");
    if (newPass !== confirmPass) {
      alert("As senhas não coincidem!");
      return;
    }
    alert("No primeiro acesso, sua senha será cadastrada automaticamente.");
  };

  return (
    <div className="min-h-screen bg-gray-100 relative p-4" style={{ color: "#0E1428" }}>
      <Helmet>
        <title>FinDesk</title>
        <link rel="icon" href="/guiainvest-logo.png" />
      </Helmet>

      {/* Cabeçalho (logo + título) - aparece sempre */}
      <div className="flex flex-col items-center mb-4">
        {/* Ajuste o caminho da imagem do logo conforme sua estrutura */}
        <img src="/logo.png" alt="FinDesk Logo" className="h-12 mb-2" />
        <motion.h1
          className="text-3xl font-bold"
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          FinDesk
        </motion.h1>
      </div>

      {/* Se não logado, tela de login */}
      {!currentUser && (
        <div className="flex items-center justify-center">
          <form
            onSubmit={handleLoginSubmit}
            className="bg-white shadow p-4 rounded-2xl w-full max-w-md"
          >
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
              <small className="text-gray-500" style={{ fontSize: "0.75rem" }}>
                No primeiro acesso, sua senha será cadastrada automaticamente.
              </small>
            </div>
            <div className="flex justify-between mt-4">
              {/* Botão Entrar à esquerda */}
              <button
                type="submit"
                className="px-3 py-1 rounded shadow"
                style={{ backgroundColor: "#0E1428", color: "white" }}
              >
                Entrar
              </button>
              {/* Botão Redefinir senha à direita */}
              <button
                type="button"
                onClick={handleResetPassword}
                className="px-3 py-1 rounded shadow"
                style={{ backgroundColor: "#FF5E00", color: "white" }}
              >
                Redefinir senha
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Se logado, mostra o resto */}
      {currentUser && (
        <>
          {/* Botão logout no topo direito */}
          <div className="absolute top-4 right-4">
            <button
              onClick={handleLogout}
              className="px-3 py-1 rounded shadow"
              style={{ backgroundColor: "#FF5E00", color: "white" }}
            >
              Sair
            </button>
          </div>

          {/* Menus de Chamados (Abertos e Concluídos) */}
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

            {/* Filtros adicionais (somente admin) */}
            {currentUser.isAdmin && (
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
                  {categoryOptions
                    .filter(cat => cat !== "+Novo")
                    .map((cat, idx) => (
                      <option key={idx} value={cat}>{cat}</option>
                    ))
                  }
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

          {/* Se for usuário comum, exibe botão "Criar Novo Chamado" */}
          {!currentUser.isAdmin && (
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

          {/* Formulário de criação de chamado */}
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
                  <option value="">Selecione</option>
                  {categoryOptions.map((option, idx) => (
                    <option key={idx} value={option}>{option}</option>
                  ))}
                </select>
              </div>
              <div className="mb-2">
                <label className="block font-semibold">Prioridade:</label>
                <select
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
                <button
                  type="button"
                  onClick={() => setShowNewTicketForm(false)}
                  className="px-3 py-1 bg-gray-300 rounded"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-3 py-1 rounded"
                  style={{ backgroundColor: "#0E1428", color: "white" }}
                >
                  Criar Chamado
                </button>
              </div>
            </motion.form>
          )}

          {/* Se for admin, exibe TicketListAdmin; se for usuário, TicketList */}
          <div className="mt-8 w-full max-w-5xl mx-auto">
            {currentUser.isAdmin ? (
              <TicketListAdmin
                activeTab={activeTab}
                filterPriority={adminFilterPriority}
                filterCategory={adminFilterCategory}
                filterAtendente={adminFilterAtendente}
                onSendEmail={sendTicketUpdateEmail}
              />
            ) : (
              <TicketList
                activeTab={activeTab}
                currentUser={currentUser}
                onSendEmail={sendTicketUpdateEmail}
              />
            )}
          </div>
        </>
      )}
    </div>
  );
}

export default App;
