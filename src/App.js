// src/App.js
import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Helmet } from "react-helmet";
import { collection, addDoc } from 'firebase/firestore';
import { db } from './firebase-config.js';
import TicketList from './TicketList.js';
import TicketListAdmin from './TicketListAdmin.js';

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
    const day = result.getDay();
    if (day !== 0 && day !== 6) days--;
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
    await Promise.all(emails.map(email => {
      const formdata = { email, subject, message: body };
      return fetch(url, {
        method: "POST",
        mode: "no-cors",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formdata)
      })
        .then(() => console.log(`Email enviado para ${email}!`))
        .catch(err => console.error(`Erro no envio para ${email}:`, err));
    }));
  } catch (error) {
    console.error("Erro ao enviar e-mails:", error);
  }
}

function App() {
  // Estado do usuário: { email, isAdmin }
  const [currentUser, setCurrentUser] = useState(null);
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");

  // Estado do formulário de novo chamado
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
      alert("Preencha todos os campos de login.");
      return;
    }
    // Lista de emails admin
    const adminEmails = ["jonathan.kauer@guiainvest.com.br", "nayla.martins@guiainvest.com.br"];
    // Se o email é admin, verificamos a senha; se não for, trata como usuário comum.
    let isAdmin = false;
    if (adminEmails.includes(loginEmail.toLowerCase())) {
      // Se o usuário digitar a senha de admin, ele é admin; caso contrário, será usuário comum.
      if (loginPassword === "admin123@guiainvestgpt") {
        isAdmin = true;
      }
    }
    setCurrentUser({ email: loginEmail, isAdmin });
    setLoginEmail("");
    setLoginPassword("");
  };

  // Função para criar ticket e salvar no Firestore
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
      console.log("Ticket salvo no Firestore!");
      sendTicketUpdateEmail(newTicket, "Abertura de novo chamado");
    } catch (error) {
      console.error("Erro ao salvar ticket:", error);
    }
    // Limpa o formulário e fecha a janela
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

  const handleLogout = () => {
    setCurrentUser(null);
  };

  const handleResetPassword = () => {
    if (!loginEmail.trim()) {
      alert("Insira seu e-mail para redefinir a senha.");
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
    alert("Senha redefinida com sucesso!");
  };

  if (!currentUser) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <Helmet>
          <title>FinDesk - Login</title>
        </Helmet>
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
            <small className="text-gray-500" style={{ fontSize: "0.75rem" }}>
              Se usar um e-mail de admin e a senha correta, você loga como admin.
            </small>
          </div>
          <div className="flex justify-end mt-4">
            <button type="submit" className="px-3 py-1 rounded shadow" style={{ backgroundColor: "#0E1428", color: "white" }}>
              Entrar
            </button>
          </div>
        </form>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100 relative p-4" style={{ color: "#0E1428" }}>
      <Helmet>
        <title>FinDesk</title>
        <link rel="icon" href="/guiainvest-logo.png" />
      </Helmet>

      {/* Cabeçalho com Logo e Título */}
      <div className="flex flex-col items-center mb-4">
        <img src="/logo.png" alt="FinDesk Logo" className="h-12 mb-2" />
        <motion.h1 className="text-3xl font-bold" initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }}>
          FinDesk
        </motion.h1>
      </div>

      {/* Botão de Logout */}
      <div className="absolute top-4 right-4">
        <button onClick={handleLogout} className="px-3 py-1 rounded shadow" style={{ backgroundColor: "#FF5E00", color: "white" }}>
          Sair
        </button>
      </div>

      {/* Botão para criar novo chamado */}
      <div className="flex justify-center mb-4">
        <button onClick={() => setShowNewTicketForm(true)} className="px-3 py-1 rounded shadow" style={{ backgroundColor: "#FF5E00", color: "white" }}>
          Criar Novo Chamado
        </button>
      </div>

      {/* Formulário de criação de ticket */}
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
            <button type="button" onClick={() => setShowNewTicketForm(false)} className="px-3 py-1 bg-gray-300 rounded">
              Cancelar
            </button>
            <button type="submit" className="px-3 py-1 rounded" style={{ backgroundColor: "#0E1428", color: "white" }}>
              Criar Chamado
            </button>
          </div>
        </motion.form>
      )}

      {/* Exibição dos Tickets Centralizados no Firestore */}
      <div className="mt-8 w-full max-w-5xl mx-auto">
        {currentUser.isAdmin ? (
          <TicketListAdmin currentUser={currentUser} onSendEmail={sendTicketUpdateEmail} />
        ) : (
          <TicketList currentUser={currentUser} onSendEmail={sendTicketUpdateEmail} />
        )}
      </div>
    </div>
  );
}

export default App;
