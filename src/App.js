// src/App.js
import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Helmet } from "react-helmet";
import { fetchTickets, addTicket } from "./services/ticketService"; // Importa o serviço do Firestore

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

// Opções de prioridade, status e atendente
const priorityOptions = [
  "Baixa (7 dias úteis)",
  "Média (5 dias úteis)",
  "Alta (2 dias úteis)",
  "Urgente (1 dia útil)"
];
const statusOptions = ["Aberto", "Em andamento", "Concluído"];
const atendenteOptions = ["Jonathan Kauer", "Nayla Martins"];

// Mapeamento para cálculo do prazo com base na prioridade
const priorityDaysMapping = {
  "Baixa (7 dias úteis)": 7,
  "Média (5 dias úteis)": 5,
  "Alta (2 dias úteis)": 2,
  "Urgente (1 dia útil)": 1,
};

// Função para adicionar dias úteis a uma data (desconsidera sábado e domingo)
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

// Função para gerar um ID aleatório de 13 caracteres
function generateTicketId() {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let result = "";
  for (let i = 0; i < 13; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

// Função auxiliar para renderizar anexos como links para download/visualização
const renderAttachments = (files) => (
  <ul className="list-disc list-inside">
    {files.map((file, idx) => {
      const fileURL = URL.createObjectURL(file);
      return (
        <li key={idx}>
          <a
            href={fileURL}
            download
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-600 underline"
          >
            {file.name}
          </a>
        </li>
      );
    })}
  </ul>
);

// Função para calcular o SLA (diferença entre duas datas) de forma adequada
const computeSLA = (start, end) => {
  const diffMs = end - start;
  const diffMinutes = Math.floor(diffMs / 60000);
  if (diffMinutes < 60) {
    return `${diffMinutes} minutos`;
  }
  const hours = Math.floor(diffMinutes / 60);
  const minutes = diffMinutes % 60;
  return minutes === 0 ? `${hours} horas` : `${hours} horas e ${minutes} minutos`;
};

// Função que envia e-mails (modo "no-cors")
const sendTicketUpdateEmail = async (ticket, updateDescription) => {
  const subject = `Findesk: Atualização em chamado`;
  const body =
    `Resumo da atualização: ${updateDescription}\n` +
    `Ticket ID: ${ticket.id}\n` +
    `Solicitante: ${ticket.nomeSolicitante}\n` +
    `Status: ${ticket.status}\n` +
    `Descrição: ${ticket.descricaoProblema}\n` +
    `Link de acesso: https://fin-desk.vercel.app/`;
  console.log(`Enviando email para ${ticket.emailSolicitante} e para jonathan.kauer@guiainvest.com.br`);
  const url =
    "https://script.google.com/macros/s/AKfycbz2xFbYeeP4sp8JdNeT2JxkeHk5SEDYrYOF37NizSPlAaG7J6KjekAWECVr6NPTJkUN/exec";
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
          .then(response => console.log(`Requisição enviada com sucesso para ${email}!`))
          .catch(error => console.error(`Erro na requisição para ${email}:`, error));
      })
    );
  } catch (error) {
    console.error("Erro ao enviar e-mails:", error);
  }
};

function App() {
  // currentUser: { email, isAdmin }
  const [currentUser, setCurrentUser] = useState(null);
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");

  const [tickets, setTickets] = useState([]);
  const [showNewTicketForm, setShowNewTicketForm] = useState(false);

  // Armazenamento de data de abertura em dois formatos: ISO e display
  const [newTicketNome, setNewTicketNome] = useState("");
  const [cargoDepartamento, setCargoDepartamento] = useState("");
  const [descricaoProblema, setDescricaoProblema] = useState("");
  const [categoria, setCategoria] = useState("");
  const [prioridade, setPrioridade] = useState("");
  const [newTicketFiles, setNewTicketFiles] = useState([]);

  const [newComments, setNewComments] = useState({});
  const [newCommentFilesByTicket, setNewCommentFilesByTicket] = useState({});

  const [cargoOptions, setCargoOptions] = useState(initialCargoOptions);
  const [categoryOptions, setCategoryOptions] = useState([
    "Clientes",
    "Comissões e/ou SplitC",
    "Basement",
    "+Novo"
  ]);

  // Filtros (apenas para admins)
  const [adminFilterPriority, setAdminFilterPriority] = useState("");
  const [adminFilterCategory, setAdminFilterCategory] = useState("");
  const [adminFilterAtendente, setAdminFilterAtendente] = useState("");

  const [expandedTickets, setExpandedTickets] = useState({});
  const [activeTab, setActiveTab] = useState("open");
  const [adminEdits, setAdminEdits] = useState({});

  // Novo estado para avisos de comentário
  const [commentWarnings, setCommentWarnings] = useState({});

  // Estado para controlar a reabertura de ticket para usuários não-admin
  const [reopenTicket, setReopenTicket] = useState({});

  // Carregar os tickets do Firestore ao montar o componente
  useEffect(() => {
    const loadTickets = async () => {
      try {
        const fetchedTickets = await fetchTickets();
        setTickets(fetchedTickets);
      } catch (error) {
        console.error("Erro ao carregar tickets:", error);
      }
    };
    loadTickets();
  }, []);

  const validateFullName = (name) => {
    const parts = name.trim().split(" ");
    return parts.length >= 2 && parts.every(part => part[0] === part[0].toUpperCase());
  };

  const toggleTicketExpansion = (ticketId) => {
    setExpandedTickets(prev => ({ ...prev, [ticketId]: !prev[ticketId] }));
  };

  const handleCargoChange = (e) => {
    const value = e.target.value;
    if (value === "+Novo") {
      const novoCargo = prompt("Digite o novo cargo/departamento:");
      if (novoCargo) {
        setCargoOptions([...cargoOptions.slice(0, cargoOptions.length - 1), novoCargo, "+Novo"]);
        setCargoDepartamento(novoCargo);
      } else {
        setCargoDepartamento("");
      }
    } else {
      setCargoDepartamento(value);
    }
  };

  const handleCategoryChange = (e) => {
    const value = e.target.value;
    if (value === "+Novo") {
      const novaCategoria = prompt("Digite a nova categoria:");
      if (novaCategoria) {
        const optionsWithoutNovo = categoryOptions.filter(opt => opt !== "+Novo");
        setCategoryOptions([...optionsWithoutNovo, novaCategoria, "+Novo"]);
        setCategoria(novaCategoria);
      } else {
        setCategoria("");
      }
    } else {
      setCategoria(value);
    }
  };

  const handleTicketFileChange = (e) => {
    setNewTicketFiles(Array.from(e.target.files));
  };

  const handleCommentFileChange = (ticketId, e) => {
    setNewCommentFilesByTicket(prev => ({
      ...prev,
      [ticketId]: Array.from(e.target.files)
    }));
  };

  // Função ajustada para criação de ticket usando Firestore
  const handleCreateTicket = async (e) => {
    e.preventDefault();
    if (!newTicketNome.trim() || !validateFullName(newTicketNome)) {
      alert("Insira o Nome Completo do solicitante (nome e sobrenome com iniciais maiúsculas).");
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
      attachments: newTicketFiles
    };

    try {
      // Adiciona o ticket no Firestore
      const ticketId = await addTicket(newTicket);
      setTickets(prev => [...prev, { id: ticketId, ...newTicket }]);
      // Limpa os campos do formulário
      setNewTicketNome("");
      setCargoDepartamento("");
      setDescricaoProblema("");
      setCategoria("");
      setPrioridade("");
      setNewTicketFiles([]);
      setShowNewTicketForm(false);
      sendTicketUpdateEmail(newTicket, "Abertura de novo chamado");
    } catch (error) {
      alert("Erro ao criar ticket");
    }
  };

  const handleReopenTicket = (ticketId) => {
    const commentText = newComments[ticketId];
    if (!commentText || !commentText.trim()) {
      alert("Para reabrir o chamado, insira um comentário explicativo.");
      return;
    }
    setTickets(prev =>
      prev.map(ticket => {
        if (ticket.id === ticketId) {
          const reopenComment = {
            text: "Reabertura: " + commentText,
            user: ticket.nomeSolicitante,
            timestamp: new Date().toLocaleString(),
            attachments: newCommentFilesByTicket[ticketId] || [],
          };
          const updatedTicket = {
            ...ticket,
            status: "Aberto",
            dataResolucao: "",
            sla: "",
            comentarios: [...ticket.comentarios, reopenComment],
          };
          sendTicketUpdateEmail(updatedTicket, `Chamado reaberto. Comentário: ${reopenComment.text}`);
          return updatedTicket;
        }
        return ticket;
      })
    );
    setNewComments(prev => ({ ...prev, [ticketId]: "" }));
    setNewCommentFilesByTicket(prev => ({ ...prev, [ticketId]: [] }));
    setReopenTicket(prev => ({ ...prev, [ticketId]: false }));
  };

  // Refatoração da função handleAddComment com aviso visual para admin
  const handleAddComment = (ticketId) => {
    console.log("handleAddComment called for ticket:", ticketId);
    const commentText = newComments[ticketId];
    if (!commentText || commentText.trim() === "") {
      console.log("Comentário vazio, abortando.");
      return;
    }
    const ticket = tickets.find(t => t.id === ticketId);
    if (!ticket) {
      console.log("Chamado não encontrado.");
      return;
    }
    // Se o usuário for admin e estiver concluindo o ticket, exige comentário
    if (currentUser.isAdmin && adminEdits[ticketId]?.status === "Concluído" && (!commentText || commentText.trim() === "")) {
      setCommentWarnings(prev => ({ ...prev, [ticketId]: "É necessário adicionar um comentário antes de concluir o chamado." }));
      return;
    } else {
      // Remove aviso se existir
      setCommentWarnings(prev => {
        const newWarnings = { ...prev };
        delete newWarnings[ticketId];
        return newWarnings;
      });
    }
    // Se o usuário for admin e houver edições, atualiza ticket
    let updatedTicket = { ...ticket };
    if (currentUser.isAdmin && adminEdits[ticketId]) {
      if (adminEdits[ticketId].status) {
        updatedTicket.status = adminEdits[ticketId].status;
        if (adminEdits[ticketId].status === "Concluído") {
          updatedTicket.dataResolucao = new Date().toLocaleString();
          updatedTicket.sla = computeSLA(new Date(ticket.dataDeAberturaISO), new Date());
        }
      }
      if (adminEdits[ticketId].responsavel) {
        updatedTicket.responsavel = adminEdits[ticketId].responsavel;
      }
    }
    // Cria o comentário (para admin, prefixa "Admin:"; para usuários, usa o nome do solicitante)
    const comment = {
      text: commentText,
      user: currentUser.isAdmin ? ("Admin: " + (ticket.responsavel || "")) : ticket.nomeSolicitante,
      timestamp: new Date().toLocaleString(),
      attachments: newCommentFilesByTicket[ticketId] || []
    };
    updatedTicket.comentarios = [...ticket.comentarios, comment];
    console.log("Updated ticket:", updatedTicket);
    sendTicketUpdateEmail(updatedTicket, `Novo comentário adicionado: ${comment.text}`);
    setTickets(prev => prev.map(t => t.id === ticketId ? updatedTicket : t));
    setNewComments(prev => ({ ...prev, [ticketId]: "" }));
    setNewCommentFilesByTicket(prev => ({ ...prev, [ticketId]: [] }));
    if (currentUser.isAdmin && adminEdits[ticketId]) {
      setAdminEdits(prev => {
        const newEdits = { ...prev };
        delete newEdits[ticketId];
        return newEdits;
      });
    }
  };

  const handleAdminEdit = (ticketId, field, value) => {
    if (field === "status") {
      setAdminEdits(prev => ({
        ...prev,
        [ticketId]: {
          ...prev[ticketId],
          status: value,
          ...(value !== "Concluído" && { dataResolucao: "" })
        }
      }));
    } else {
      setAdminEdits(prev => ({
        ...prev,
        [ticketId]: {
          ...prev[ticketId],
          [field]: value
        }
      }));
    }
  };

  const handleDeleteTicket = async (ticketId, ticket) => {
    if (window.confirm("Tem certeza que deseja excluir este chamado?")) {
      await sendTicketUpdateEmail(ticket, "Chamado excluído pelo admin");
      setTickets(prev => prev.filter(t => t.id !== ticketId));
    }
  };

  // Filtragem de tickets: para admins, aplica os filtros; para usuários, filtra pelo e-mail
  let filteredTickets = tickets;
  if (currentUser && currentUser.isAdmin) {
    if (adminFilterPriority) {
      filteredTickets = filteredTickets.filter(ticket => ticket.prioridade === adminFilterPriority);
    }
    if (adminFilterCategory) {
      filteredTickets = filteredTickets.filter(ticket => ticket.categoria === adminFilterCategory);
    }
    if (adminFilterAtendente) {
      filteredTickets = filteredTickets.filter(ticket => ticket.responsavel === adminFilterAtendente);
    }
  } else if (currentUser) {
    filteredTickets = tickets.filter(ticket => ticket.emailSolicitante === currentUser.email);
  }

  const tabFilteredTickets = filteredTickets.filter(ticket => {
    return activeTab === "open" ? ticket.status !== "Concluído" : ticket.status === "Concluído";
  });

  const handleLoginSubmit = (e) => {
    e.preventDefault();
    if (!loginEmail.trim() || !loginPassword.trim()) {
      alert("Por favor, preencha todos os campos de login.");
      return;
    }
    const adminEmails = ["jonathan.kauer@guiainvest.com.br", "nayla.martins@guiainvest.com.br"];
    if (adminEmails.includes(loginEmail.toLowerCase())) {
      if (loginPassword === "admin123@guiainvestgpt") {
        setCurrentUser({ email: loginEmail, isAdmin: true });
        setLoginEmail("");
        setLoginPassword("");
        return;
      } else {
        const users = JSON.parse(localStorage.getItem("users") || "{}");
        if (users[loginEmail]) {
          if (users[loginEmail] !== loginPassword) {
            alert("Senha incorreta!");
            return;
          }
        } else {
          users[loginEmail] = loginPassword;
          localStorage.setItem("users", JSON.stringify(users));
          alert("Senha cadastrada com sucesso!");
        }
        // Admin logado como usuário
        setCurrentUser({ email: loginEmail, isAdmin: false });
        setLoginEmail("");
        setLoginPassword("");
        return;
      }
    } else {
      const users = JSON.parse(localStorage.getItem("users") || "{}");
      if (users[loginEmail]) {
        if (users[loginEmail] !== loginPassword) {
          alert("Senha incorreta!");
          return;
        }
      } else {
        users[loginEmail] = loginPassword;
        localStorage.setItem("users", JSON.stringify(users));
        alert("Senha cadastrada com sucesso!");
      }
      setCurrentUser({ email: loginEmail, isAdmin: false });
      setLoginEmail("");
      setLoginPassword("");
    }
  };

  const handleLogout = () => {
    setCurrentUser(null);
  };

  const handleResetPassword = () => {
    if (!loginEmail.trim()) {
      alert("Por favor, insira seu e-mail para redefinir a senha.");
      return;
    }
    const newPass = prompt("Digite sua nova senha:");
    if (!newPass || !newPass.trim()) {
      alert("Nova senha inválida!");
      return;
    }
    const confirmPass = prompt("Confirme sua nova senha:");
    if (newPass !== confirmPass) {
      alert("As senhas não coincidem!");
      return;
    }
    const users = JSON.parse(localStorage.getItem("users") || "{}");
    users[loginEmail] = newPass;
    localStorage.setItem("users", JSON.stringify(users));
    alert("Senha redefinida com sucesso! Agora use a nova senha para fazer login.");
  };

  return (
    <div className="min-h-screen bg-gray-100 relative p-4" style={{ color: "#0E1428" }}>
      <Helmet>
        <title>FinDesk</title>
        <link rel="icon" href="/guiainvest-logo.png" />
      </Helmet>

      {/* Botão Sair */}
      {currentUser && (
        <div className="absolute top-4 right-4">
          <button onClick={handleLogout} className="px-3 py-1 rounded shadow" style={{ backgroundColor: "#FF5E00", color: "white" }}>
            Sair
          </button>
        </div>
      )}

      {/* Cabeçalho Centralizado */}
      <div className="flex flex-col items-center mb-4">
        <img src="/logo.png" alt="FinDesk Logo" className="h-12 mb-2" />
        <motion.h1 className="text-3xl font-bold" initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }}>
          FinDesk
        </motion.h1>
      </div>

      {/* Tela de Login Centralizada */}
      {!currentUser && (
        <div className="flex items-center justify-center">
          <form onSubmit={handleLoginSubmit} className="bg-white shadow p-4 rounded-2xl w-full max-w-md">
            <h2 className="text-xl font-bold mb-4 text-center">Faça seu login</h2>
            <div className="mb-2">
              <label className="block font-semibold">E-mail:</label>
              <input type="email" value={loginEmail} onChange={(e) => setLoginEmail(e.target.value)} required className="border rounded px-2 py-1 w-full" placeholder="Digite seu e-mail" />
            </div>
            <div className="mb-2">
              <label className="block font-semibold">Senha:</label>
              <input type="password" value={loginPassword} onChange={(e) => setLoginPassword(e.target.value)} required className="border rounded px-2 py-1 w-full" />
              <small className="text-gray-500" style={{ fontSize: "0.75rem" }}>
                No primeiro acesso, sua senha será cadastrada automaticamente.
              </small>
            </div>
            <div className="flex justify-between mt-4">
              <button type="submit" className="px-3 py-1 rounded shadow" style={{ backgroundColor: "#0E1428", color: "white" }}>
                Entrar
              </button>
              <button type="button" onClick={handleResetPassword} className="px-3 py-1 rounded shadow" style={{ backgroundColor: "#FF5E00", color: "white" }}>
                Redefinir senha
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Ambiente Logado */}
      {currentUser && (
        <>
          {/* Menus de Chamados Centralizados */}
          <div className="flex flex-col items-center mb-4">
            <div className="flex gap-4 mb-4">
              <button onClick={() => setActiveTab("open")} className="px-3 py-1 rounded" style={ activeTab === "open" ? { backgroundColor: "#0E1428", color: "white" } : { backgroundColor: "#f2f2f2", color: "#0E1428", border: "1px solid #0E1428" } }>
                Abertos e em andamento
              </button>
              <button onClick={() => setActiveTab("closed")} className="px-3 py-1 rounded" style={ activeTab === "closed" ? { backgroundColor: "#0E1428", color: "white" } : { backgroundColor: "#f2f2f2", color: "#0E1428", border: "1px solid #0E1428" } }>
                Concluídos
              </button>
            </div>
            {currentUser.isAdmin && (
              <div className="flex flex-col sm:flex-row items-center gap-2">
                <select value={adminFilterPriority} onChange={(e) => setAdminFilterPriority(e.target.value)} className="border rounded px-2 py-1">
                  <option value="">Prioridade: Todas</option>
                  {priorityOptions.map((p, idx) => (
                    <option key={idx} value={p}>{p}</option>
                  ))}
                </select>
                <select value={adminFilterCategory} onChange={(e) => setAdminFilterCategory(e.target.value)} className="border rounded px-2 py-1">
                  <option value="">Categoria: Todas</option>
                  {categoryOptions.filter(cat => cat !== "+Novo").map((cat, idx) => (
                    <option key={idx} value={cat}>{cat}</option>
                  ))}
                </select>
                <select value={adminFilterAtendente} onChange={(e) => setAdminFilterAtendente(e.target.value)} className="border rounded px-2 py-1">
                  <option value="">Atendente: Todos</option>
                  {atendenteOptions.map((opt, idx) => (
                    <option key={idx} value={opt}>{opt}</option>
                  ))}
                </select>
              </div>
            )}
          </div>

          {/* Botão "Criar Novo Chamado" para usuários (não admin) */}
          {!currentUser.isAdmin && (
            <div className="mb-4 flex justify-center">
              <button onClick={() => setShowNewTicketForm(true)} className="px-3 py-1 rounded shadow" style={{ backgroundColor: "#FF5E00", color: "white" }}>
                Criar Novo Chamado
              </button>
            </div>
          )}

          {showNewTicketForm && (
            <motion.form className="bg-white shadow p-4 rounded-2xl w-full max-w-lg mx-auto mb-4" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }} onSubmit={handleCreateTicket}>
              <h2 className="text-xl font-bold mb-4">Novo Chamado FinDesk</h2>
              <div className="mb-2">
                <label className="block font-semibold">Nome Completo do Solicitante:</label>
                <input type="text" value={newTicketNome} onChange={(e) => setNewTicketNome(e.target.value)} required className="border rounded px-2 py-1 w-full" placeholder="Ex.: Jonathan Kauer" />
              </div>
              <div className="mb-2">
                <label className="block font-semibold">Cargo/Departamento:</label>
                <select value={cargoDepartamento} onChange={handleCargoChange} required className="border rounded px-2 py-1 w-full">
                  <option value="">Selecione</option>
                  {cargoOptions.map((option, idx) => (
                    <option key={idx} value={option}>{option}</option>
                  ))}
                </select>
              </div>
              <div className="mb-2">
                <label className="block font-semibold">Descrição do Problema:</label>
                <textarea value={descricaoProblema} onChange={(e) => setDescricaoProblema(e.target.value)} required className="border rounded px-2 py-1 w-full" rows="4" />
              </div>
              <div className="mb-2">
                <label className="block font-semibold">Categoria:</label>
                <select value={categoria} onChange={handleCategoryChange} required className="border rounded px-2 py-1 w-full">
                  <option value="">Selecione</option>
                  {categoryOptions.map((option, idx) => (
                    <option key={idx} value={option}>{option}</option>
                  ))}
                </select>
              </div>
              <div className="mb-2">
                <label className="block font-semibold">Prioridade:</label>
                <select value={prioridade} onChange={(e) => setPrioridade(e.target.value)} required className="border rounded px-2 py-1 w-full">
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

          <div className="grid gap-4 w-full max-w-5xl mx-auto">
            {tabFilteredTickets.map((ticket) => {
              const isExpired = ticket.status !== "Concluído" && new Date() > new Date(ticket.prazoFinalizacao);
              return (
                <motion.div key={ticket.id} className="relative shadow p-4 rounded-2xl" style={{ backgroundColor: isExpired ? "#ffe6e6" : "white" }} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
                  <div className="flex justify-between items-center">
                    <div>
                      <h2 className="text-xl font-bold">
                        {currentUser.isAdmin ? `Solicitante: ${ticket.nomeSolicitante}` : `ID: ${ticket.id}`}
                      </h2>
                      <p className="text-gray-700">
                        <span className="font-semibold">Categoria:</span> {ticket.categoria} |{" "}
                        <span className="font-semibold">Prioridade:</span> {ticket.prioridade}
                      </p>
                      <p className="text-gray-700">
                        <span className="font-semibold">Data de Abertura:</span> {ticket.dataDeAbertura}
                      </p>
                      <p className="text-gray-700">
                        <span className="font-semibold">Prazo Final:</span> {new Date(ticket.prazoFinalizacao).toLocaleDateString()}
                      </p>
                      {ticket.status === "Concluído" && (
                        <>
                          <p className="text-gray-700">
                            <span className="font-semibold">Data de Resolução:</span> {ticket.dataResolucao}
                          </p>
                          <p className="text-gray-700">
                            <span className="font-semibold">SLA:</span> {ticket.sla}
                          </p>
                        </>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <button onClick={(e) => { e.stopPropagation(); toggleTicketExpansion(ticket.id); }} className="px-2 py-1 bg-gray-300 rounded">
                        {expandedTickets[ticket.id] ? "Ocultar" : "Ver Detalhes"}
                      </button>
                      {currentUser.isAdmin && (
                        <button onClick={(e) => { e.stopPropagation(); handleDeleteTicket(ticket.id, ticket); }} className="p-1" title="Excluir chamado">
                          <img src="/trash-icon.png" alt="Excluir chamado" className="w-6 h-6" />
                        </button>
                      )}
                    </div>
                  </div>
                  {expandedTickets[ticket.id] && (
                    <div className="mt-4">
                      {!currentUser.isAdmin && (
                        <p className="text-gray-700 mb-1">
                          <span className="font-semibold">Nome do Solicitante:</span> {ticket.nomeSolicitante}
                        </p>
                      )}
                      <p className="text-gray-700 mb-1">
                        <span className="font-semibold">Cargo/Departamento:</span> {ticket.cargoDepartamento}
                      </p>
                      <p className="text-gray-700 mb-1 whitespace-pre-wrap">
                        <span className="font-semibold">Descrição:</span> {ticket.descricaoProblema}
                      </p>
                      {currentUser.isAdmin && (
                        <div className="mb-2">
                          <label className="font-semibold">Status:</label>{" "}
                          {ticket.status === "Concluído" ? (
                            <span className="ml-1">{ticket.status}</span>
                          ) : (
                            <select value={adminEdits[ticket.id]?.status ?? ticket.status} onChange={(e) => handleAdminEdit(ticket.id, "status", e.target.value)} className="border rounded px-2 py-1 ml-1">
                              {statusOptions.map((option, idx) => (
                                <option key={idx} value={option}>{option}</option>
                              ))}
                            </select>
                          )}
                        </div>
                      )}
                      {currentUser.isAdmin && (
                        <div className="mb-2">
                          <label className="font-semibold">Atendente:</label>{" "}
                          {ticket.status === "Concluído" ? (
                            <span className="ml-1">{ticket.responsavel || "Não definido"}</span>
                          ) : (
                            <select value={adminEdits[ticket.id]?.responsavel ?? ticket.responsavel} onChange={(e) => handleAdminEdit(ticket.id, "responsavel", e.target.value)} className="border rounded px-2 py-1 ml-1">
                              <option value="">Selecione</option>
                              {atendenteOptions.map((opt, idx) => (
                                <option key={idx} value={opt}>{opt}</option>
                              ))}
                            </select>
                          )}
                        </div>
                      )}
                      {ticket.attachments && ticket.attachments.length > 0 && (
                        <div className="mb-2">
                          <label className="font-semibold">Anexos:</label>
                          {renderAttachments(ticket.attachments)}
                        </div>
                      )}
                      <hr />
                      <div className="mb-2">
                        <p className="text-gray-700 font-semibold">Comentários/Atualizações:</p>
                        {ticket.comentarios.map((cmt, idx) => (
                          <div key={idx} className="bg-gray-100 p-2 rounded-lg mb-2">
                            <p className="text-sm whitespace-pre-wrap">
                              <span className="font-semibold">{cmt.user}:</span> {cmt.text}
                            </p>
                            {cmt.attachments && cmt.attachments.length > 0 && (
                              <ul className="list-disc list-inside">
                                {cmt.attachments.map((file, i) => {
                                  const fileURL = URL.createObjectURL(file);
                                  return (
                                    <li key={i}>
                                      <a href={fileURL} download target="_blank" rel="noopener noreferrer" className="text-blue-600 underline">
                                        {file.name}
                                      </a>
                                    </li>
                                  );
                                })}
                              </ul>
                            )}
                            <p className="text-xs text-gray-500">{cmt.timestamp}</p>
                          </div>
                        ))}
                      </div>
                      {ticket.status !== "Concluído" ? (
                        <div className="mb-4">
                          <textarea value={newComments[ticket.id] || ""} onChange={(e) => setNewComments((prev) => ({ ...prev, [ticket.id]: e.target.value }))} placeholder="Digite um comentário ou atualização..." className="w-full border rounded-lg p-2 mb-2 whitespace-pre-wrap" rows="3" />
                          {commentWarnings[ticket.id] && (
                            <div className="text-red-600 text-sm mb-2">
                              {commentWarnings[ticket.id]}
                            </div>
                          )}
                          <input type="file" multiple onChange={(e) => handleCommentFileChange(ticket.id, e)} className="w-full mb-2" />
                          <div className="flex gap-2">
                            <button onClick={() => handleAddComment(ticket.id)} className="px-3 py-1 rounded-lg shadow" style={{ backgroundColor: "#0E1428", color: "white" }}>
                              Salvar
                            </button>
                          </div>
                        </div>
                      ) : (
                        !currentUser.isAdmin && (
                          <div className="mb-4">
                            {reopenTicket[ticket.id] ? (
                              <div>
                                <textarea value={newComments[ticket.id] || ""} onChange={(e) => setNewComments((prev) => ({ ...prev, [ticket.id]: e.target.value }))} placeholder="Informe o motivo para reabrir o chamado" className="w-full border rounded-lg p-2 mb-2" rows="3" />
                                <div className="flex gap-2 justify-center">
                                  <button onClick={() => handleReopenTicket(ticket.id)} className="px-3 py-1 rounded shadow" style={{ backgroundColor: "#0E1428", color: "white" }}>
                                    Salvar
                                  </button>
                                </div>
                              </div>
                            ) : (
                              <div className="flex justify-center">
                                <button onClick={() => setReopenTicket(prev => ({ ...prev, [ticket.id]: true }))} className="px-3 py-1 rounded shadow" style={{ backgroundColor: "#FF5E00", color: "white" }}>
                                  Reabrir Chamado
                                </button>
                              </div>
                            )}
                          </div>
                        )
                      )}
                    </div>
                  )}
                </motion.div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}

export default App;
