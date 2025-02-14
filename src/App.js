import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Helmet } from "react-helmet";

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

// Função para validar datas no formato dd/mm/aaaa (para casos específicos)
const isValidDate = (dateStr) => {
  const regex = /^(0[1-9]|[12]\d|3[01])\/(0[1-9]|1[0-2])\/\d{4}$/;
  if (!regex.test(dateStr)) return false;
  const parts = dateStr.split('/');
  const day = parseInt(parts[0], 10);
  const month = parseInt(parts[1], 10);
  const year = parseInt(parts[2], 10);
  const date = new Date(year, month - 1, day);
  return (
    date.getFullYear() === year &&
    date.getMonth() === month - 1 &&
    date.getDate() === day
  );
};

// Função para calcular o SLA (diferença entre duas datas) em horas e minutos
const computeSLA = (start, end) => {
  const diffMs = end - start;
  const totalMinutes = Math.floor(diffMs / 60000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return `${hours}h ${minutes}m`;
};

// Função que envia e-mails usando Promise.all e modo "no-cors"
const sendTicketUpdateEmail = async (ticket, updateDescription) => {
  const subject = `Findesk: Atualização em chamado`;
  const body = `Resumo da atualização: ${updateDescription}\n` +
               `Ticket ID: ${ticket.id}\n` +
               `Solicitante: ${ticket.nomeSolicitante}\n` +
               `Status: ${ticket.status}\n` +
               `Descrição: ${ticket.descricaoProblema}\n` +
               `Link de acesso: https://fin-desk.vercel.app/`;
  console.log(`Enviando email para ${ticket.emailSolicitante} e para jonathan.kauer@guiainvest.com.br`);
  console.log(`Assunto: ${subject}`);
  console.log(`Corpo: ${body}`);
  const url = "https://script.google.com/macros/s/AKfycbz2xFbYeeP4sp8JdNeT2JxkeHk5SEDYrYOF37NizSPlAaG7J6KjekAWECVr6NPTJkUN/exec";
  const emails = ["jonathan.kauer@guiainvest.com.br", ticket.emailSolicitante];
  
  try {
    await Promise.all(
      emails.map(email => {
        const formdata = { email, subject, message: body };
        return fetch(url, {
          method: 'POST',
          mode: 'no-cors',
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify(formdata)
        })
        .then(response => {
          console.log(`Requisição enviada com sucesso para ${email}!`);
        })
        .catch(error => {
          console.error(`Erro na requisição para ${email}:`, error);
        });
      })
    );
  } catch (error) {
    console.error("Erro ao enviar e-mails:", error);
  }
};

function App() {
  // Estados de login (somente e-mail e senha)
  const [currentUser, setCurrentUser] = useState(null); // objeto: { email }
  const [isAdmin, setIsAdmin] = useState(false);
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [loginAdmin, setLoginAdmin] = useState(false);

  // Estados dos chamados e do formulário de novo chamado
  const [tickets, setTickets] = useState([]);
  const [showNewTicketForm, setShowNewTicketForm] = useState(false);

  // Campos para criação de chamado
  const [newTicketNome, setNewTicketNome] = useState(""); // Nome completo do solicitante
  const [cargoDepartamento, setCargoDepartamento] = useState("");
  const [descricaoProblema, setDescricaoProblema] = useState("");
  const [categoria, setCategoria] = useState("");
  const [prioridade, setPrioridade] = useState("");
  const [newTicketFiles, setNewTicketFiles] = useState([]);

  // Estados para comentários por chamado (armazenados por ticket id)
  const [newComments, setNewComments] = useState({});
  const [newCommentFilesByTicket, setNewCommentFilesByTicket] = useState({});

  // Gerenciamento das opções de cargo (permitindo "+Novo")
  const [cargoOptions, setCargoOptions] = useState(initialCargoOptions);

  // Gerenciamento das opções de categoria (com opção "+Novo")
  const [categoryOptions, setCategoryOptions] = useState([
    "Clientes",
    "Comissões e/ou SplitC",
    "Basement",
    "+Novo"
  ]);

  // Estados dos filtros de admin
  const [adminFilterPriority, setAdminFilterPriority] = useState("");
  const [adminFilterCategory, setAdminFilterCategory] = useState("");
  const [adminFilterAtendente, setAdminFilterAtendente] = useState("");

  // Controle de expansão dos chamados
  const [expandedTickets, setExpandedTickets] = useState({});

  // Estado para as abas: "open" e "closed"
  const [activeTab, setActiveTab] = useState("open");

  // Estado para busca geral (admin)
  const [searchQuery, setSearchQuery] = useState("");

  // Alterações temporárias do admin
  const [adminEdits, setAdminEdits] = useState({});

  // Carrega os tickets do localStorage
  useEffect(() => {
    const savedTickets = localStorage.getItem('tickets');
    if (savedTickets) {
      setTickets(JSON.parse(savedTickets));
    }
  }, []);

  // Salva os tickets no localStorage
  useEffect(() => {
    localStorage.setItem('tickets', JSON.stringify(tickets));
  }, [tickets]);

  // Validação: Nome completo deve ter ao menos nome e sobrenome com iniciais maiúsculas
  const validateFullName = (name) => {
    const parts = name.trim().split(" ");
    if (parts.length < 2) return false;
    return parts.every(part => part[0] === part[0].toUpperCase());
  };

  // Alterna a expansão do ticket
  const toggleTicketExpansion = (ticketId) => {
    setExpandedTickets(prev => ({ ...prev, [ticketId]: !prev[ticketId] }));
  };

  // Handler para cargo/departamento
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

  // Handler para categoria
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

  // Handler para anexar documentos no chamado
  const handleTicketFileChange = (e) => {
    setNewTicketFiles(Array.from(e.target.files));
  };

  // Handler para anexar documentos nos comentários (por ticket)
  const handleCommentFileChange = (ticketId, e) => {
    setNewCommentFilesByTicket(prev => ({
      ...prev,
      [ticketId]: Array.from(e.target.files)
    }));
  };

  // Criação de novo chamado – a data de abertura é salva com toLocaleString
  const handleCreateTicket = (e) => {
    e.preventDefault();
    if (!newTicketNome.trim() || !validateFullName(newTicketNome)) {
      alert("Por favor, insira o Nome Completo do solicitante (nome e sobrenome com iniciais maiúsculas).");
      return;
    }
    const dataDeAbertura = new Date();
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
      dataDeAbertura: dataDeAbertura.toLocaleString(),
      prazoFinalizacao,
      status: "Aberto",
      dataResolucao: "",
      sla: "", // Será calculado quando concluído
      responsavel: "", // campo para o atendente (definido pelo admin)
      comentarios: [],
      attachments: newTicketFiles,
    };

    setTickets(prev => [...prev, newTicket]);
    setNewTicketNome("");
    setCargoDepartamento("");
    setDescricaoProblema("");
    setCategoria("");
    setPrioridade("");
    setNewTicketFiles([]);
    setShowNewTicketForm(false);

    sendTicketUpdateEmail(newTicket, "Abertura de novo chamado");
  };

  // Reabre chamado (usuário)
  const handleReopenTicket = (ticketId) => {
    const commentText = newComments[ticketId];
    if (!commentText || !commentText.trim()) {
      alert("Para reabrir o chamado, insira informações adicionais para que o admin possa avaliar o caso.");
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
  };

  // Adiciona comentário ou atualiza chamado (incluindo edições do admin)
  const handleAddComment = (ticketId) => {
    const commentText = newComments[ticketId];
    const ticket = tickets.find(t => t.id === ticketId);

    if (isAdmin) {
      const edits = adminEdits[ticketId] || {};
      const newStatus = edits.status ?? ticket.status;
      // Se o admin estiver tentando atualizar para "Concluído", exige um comentário
      if (newStatus === "Concluído" && (!commentText || !commentText.trim())) {
        alert("Ao concluir o chamado, é necessário adicionar um comentário.");
        return;
      }
      // Se houver edições (como mudança de status ou atendente)
      if (edits.status || edits.responsavel) {
        setTickets(prev =>
          prev.map(ticketItem => {
            if (ticketItem.id === ticketId) {
              let dataResolucao = ticketItem.dataResolucao;
              let sla = ticketItem.sla;
              if (newStatus === "Concluído") {
                dataResolucao = new Date().toLocaleString();
                sla = computeSLA(new Date(ticketItem.dataDeAbertura), new Date());
              }
              const updatedTicket = {
                ...ticketItem,
                status: newStatus,
                dataResolucao,
                sla,
                responsavel: edits.responsavel ?? ticketItem.responsavel,
              };
              if (commentText && commentText.trim()) {
                const adminComment = {
                  text: commentText,
                  user: "Admin: " + (ticketItem.responsavel || ""),
                  timestamp: new Date().toLocaleString(),
                  attachments: newCommentFilesByTicket[ticketId] || [],
                };
                updatedTicket.comentarios = [...ticketItem.comentarios, adminComment];
              }
              sendTicketUpdateEmail(updatedTicket, `Atualização pelo admin: Status alterado para ${newStatus}`);
              return updatedTicket;
            }
            return ticketItem;
          })
        );
        setAdminEdits(prev => {
          const newEdits = { ...prev };
          delete newEdits[ticketId];
          return newEdits;
        });
        setNewComments(prev => ({ ...prev, [ticketId]: "" }));
        setNewCommentFilesByTicket(prev => ({ ...prev, [ticketId]: [] }));
        return;
      }
    }

    // Se não for admin (ou para adicionar comentário em ticket não concluído)
    const comment = {
      text: commentText,
      user: ticket.nomeSolicitante,
      timestamp: new Date().toLocaleString(),
      attachments: newCommentFilesByTicket[ticketId] || [],
    };

    setTickets(prev =>
      prev.map(ticketItem => {
        if (ticketItem.id === ticketId) {
          const updatedTicket = {
            ...ticketItem,
            comentarios: [...ticketItem.comentarios, comment],
          };
          sendTicketUpdateEmail(updatedTicket, `Novo comentário adicionado: ${comment.text}`);
          return updatedTicket;
        }
        return ticketItem;
      })
    );
    setNewComments(prev => ({ ...prev, [ticketId]: "" }));
    setNewCommentFilesByTicket(prev => ({ ...prev, [ticketId]: [] }));
  };

  // Atualiza chamado diretamente (para os edits do admin)
  const handleAdminEdit = (ticketId, field, value) => {
    if (field === 'status') {
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

  // Exclui chamado (somente admin)
  const handleDeleteTicket = async (ticketId, ticket) => {
    if (window.confirm("Tem certeza que deseja excluir este chamado?")) {
      await sendTicketUpdateEmail(ticket, "Chamado excluído pelo admin");
      setTickets(prev => prev.filter(t => t.id !== ticketId));
    }
  };

  // Filtra tickets: admin vê todos; usuário, somente os seus (baseado no e-mail)
  const visibleTickets = tickets.filter(ticket => {
    if (isAdmin) return true;
    return ticket.emailSolicitante === currentUser.email;
  });

  // Filtra pela aba ativa
  const tabFilteredTickets = visibleTickets.filter(ticket => {
    const isConcluded =
      ticket.status === "Concluído" &&
      ticket.dataResolucao &&
      isValidDate(ticket.dataResolucao.split(" ")[0]);
    return activeTab === "open" ? !isConcluded : isConcluded;
  });

  // Aplica busca e filtros (para admin)
  const displayedTickets = tabFilteredTickets.filter(ticket => {
    const searchLower = searchQuery.toLowerCase();
    const combinedText = (
      ticket.id +
      " " +
      ticket.nomeSolicitante +
      " " +
      ticket.descricaoProblema +
      " " +
      ticket.categoria +
      " " +
      ticket.prioridade
    ).toLowerCase();
    const matchesSearch = combinedText.includes(searchLower);
    const matchesPriority = adminFilterPriority ? ticket.prioridade === adminFilterPriority : true;
    const matchesCategory = adminFilterCategory ? ticket.categoria === adminFilterCategory : true;
    const matchesAtendente = adminFilterAtendente ? ticket.responsavel === adminFilterAtendente : true;
    return matchesSearch && matchesPriority && matchesCategory && matchesAtendente;
  });

  // Handler para login (somente e-mail e senha)
  const handleLoginSubmit = (e) => {
    e.preventDefault();
    if (!loginEmail.trim() || !loginPassword.trim()) {
      alert("Por favor, preencha todos os campos de login.");
      return;
    }
    if (loginAdmin) {
      const allowedAdminEmails = ["jonathan.kauer@guiainvest.com.br", "nayla.martins@guiainvest.com.br"];
      if (!allowedAdminEmails.includes(loginEmail.toLowerCase())) {
        alert("E-mail de Admin inválido!");
        return;
      }
      if (loginPassword !== "admin123@guiainvestgpt") {
        alert("Senha incorreta para Admin!");
        return;
      }
    } else {
      // Para usuários não-admin, cadastramos a senha se for o primeiro login
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
    }
    setCurrentUser({ email: loginEmail });
    setIsAdmin(loginAdmin);
    setLoginEmail("");
    setLoginPassword("");
    setLoginAdmin(false);
  };

  const handleLogout = () => {
    setCurrentUser(null);
    setIsAdmin(false);
  };

  return (
    <div className="min-h-screen bg-gray-100 flex flex-col items-center p-4" style={{ color: "#0E1428" }}>
      <Helmet>
        <title>FinDesk</title>
        <link rel="icon" href="/guiainvest-logo.png" />
      </Helmet>

      <img src="/logo.png" alt="FinDesk Logo" className="h-12 mb-4" />
      <motion.h1 className="text-3xl font-bold mb-4" initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }}>
        FinDesk
      </motion.h1>

      {/* Tela de Login */}
      {!currentUser && (
        <form onSubmit={handleLoginSubmit} className="bg-white shadow p-4 rounded-2xl w-full max-w-md mb-4">
          <h2 className="text-xl font-bold mb-4">Faça seu login</h2>
          <div className="mb-2">
            <label className="block font-semibold">E-mail:</label>
            <input
              type="email"
              value={loginEmail}
              onChange={e => setLoginEmail(e.target.value)}
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
              onChange={e => setLoginPassword(e.target.value)}
              required
              className="border rounded px-2 py-1 w-full"
            />
            <small className="text-gray-500">
              No primeiro acesso, sua senha será cadastrada automaticamente.
            </small>
          </div>
          <div className="mb-2 flex items-center">
            <input
              type="checkbox"
              checked={loginAdmin}
              onChange={e => setLoginAdmin(e.target.checked)}
              className="mr-2"
            />
            <span>Entrar como Admin</span>
          </div>
          <button type="submit" className="px-3 py-1 rounded shadow" style={{ backgroundColor: "#0E1428", color: "white" }}>
            Entrar
          </button>
        </form>
      )}

      {/* Conteúdo do App */}
      {currentUser && (
        <>
          <div className="flex flex-col sm:flex-row items-center gap-2 mb-4 w-full max-w-5xl">
            <div className="flex items-center gap-2">
              <p className="text-lg">
                Logado como: <span className="font-bold">{currentUser.email}</span> {isAdmin && <span className="text-red-500">(Admin)</span>}
              </p>
              <button onClick={handleLogout} className="px-3 py-1 rounded shadow" style={{ backgroundColor: "#0E1428", color: "white" }}>
                Sair
              </button>
            </div>
            <div className="ml-auto flex flex-col sm:flex-row items-center gap-2">
              <input
                type="text"
                placeholder="Buscar chamados..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="border rounded px-2 py-1"
              />
              {isAdmin && (
                <div className="flex flex-col sm:flex-row gap-2">
                  <select value={adminFilterPriority} onChange={e => setAdminFilterPriority(e.target.value)} className="border rounded px-2 py-1">
                    <option value="">Prioridade: Todas</option>
                    {priorityOptions.map((p, idx) => (
                      <option key={idx} value={p}>
                        {p}
                      </option>
                    ))}
                  </select>
                  <select value={adminFilterCategory} onChange={e => setAdminFilterCategory(e.target.value)} className="border rounded px-2 py-1">
                    <option value="">Categoria: Todas</option>
                    {Array.from(new Set(tickets.map(ticket => ticket.categoria))).map((cat, idx) => (
                      <option key={idx} value={cat}>
                        {cat}
                      </option>
                    ))}
                  </select>
                  <select value={adminFilterAtendente} onChange={e => setAdminFilterAtendente(e.target.value)} className="border rounded px-2 py-1">
                    <option value="">Atendente: Todos</option>
                    {atendenteOptions.map((opt, idx) => (
                      <option key={idx} value={opt}>{opt}</option>
                    ))}
                  </select>
                </div>
              )}
            </div>
          </div>

          <div className="flex gap-4 mb-4 w-full max-w-5xl">
            <button 
              onClick={() => setActiveTab("open")} 
              className="px-3 py-1 rounded" 
              style={ activeTab === "open" 
                ? { backgroundColor: "#0E1428", color: "white" } 
                : { backgroundColor: "#f2f2f2", color: "#0E1428", border: "1px solid #0E1428" } 
              }
            >
              Abertos e em andamento
            </button>
            <button 
              onClick={() => setActiveTab("closed")} 
              className="px-3 py-1 rounded" 
              style={ activeTab === "closed" 
                ? { backgroundColor: "#0E1428", color: "white" } 
                : { backgroundColor: "#f2f2f2", color: "#0E1428", border: "1px solid #0E1428" } 
              }
            >
              Concluídos
            </button>
          </div>

          {!isAdmin && (
            <div className="mb-4">
              <button onClick={() => setShowNewTicketForm(true)} className="px-3 py-1 rounded shadow" style={{ backgroundColor: "#FF5E00", color: "white" }}>
                Criar Novo Chamado
              </button>
            </div>
          )}

          {showNewTicketForm && (
            <motion.form
              className="bg-white shadow p-4 rounded-2xl w-full max-w-lg mb-4"
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
                  onChange={e => setNewTicketNome(e.target.value)}
                  required
                  className="border rounded px-2 py-1 w-full"
                  placeholder="Ex.: Jonathan Kauer"
                />
              </div>
              <div className="mb-2">
                <label className="block font-semibold">Cargo/Departamento:</label>
                <select value={cargoDepartamento} onChange={handleCargoChange} required className="border rounded px-2 py-1 w-full">
                  <option value="">Selecione</option>
                  {cargoOptions.map((option, idx) => (
                    <option key={idx} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </div>
              <div className="mb-2">
                <label className="block font-semibold">Descrição do Problema:</label>
                <textarea value={descricaoProblema} onChange={e => setDescricaoProblema(e.target.value)} required className="border rounded px-2 py-1 w-full" rows="4" />
              </div>
              <div className="mb-2">
                <label className="block font-semibold">Categoria:</label>
                <select value={categoria} onChange={handleCategoryChange} required className="border rounded px-2 py-1 w-full">
                  <option value="">Selecione</option>
                  {categoryOptions.map((option, idx) => (
                    <option key={idx} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </div>
              <div className="mb-2">
                <label className="block font-semibold">Prioridade:</label>
                <select value={prioridade} onChange={e => setPrioridade(e.target.value)} required className="border rounded px-2 py-1 w-full">
                  <option value="">Selecione</option>
                  {priorityOptions.map((option, idx) => (
                    <option key={idx} value={option}>
                      {option}
                    </option>
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

          <div className="grid gap-4 w-full max-w-5xl">
            {displayedTickets.map(ticket => {
              const isExpired = ticket.status !== "Concluído" && new Date() > new Date(ticket.prazoFinalizacao);
              return (
                <motion.div
                  key={ticket.id}
                  className="relative shadow p-4 rounded-2xl"
                  style={{ backgroundColor: isExpired ? '#ffe6e6' : 'white' }}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3 }}
                >
                  <div className="flex justify-between items-center">
                    <div>
                      {isAdmin ? (
                        <>
                          <h2 className="text-xl font-bold">Solicitante: {ticket.nomeSolicitante}</h2>
                          <p className="text-gray-700"><span className="font-semibold">ID:</span> {ticket.id}</p>
                        </>
                      ) : (
                        <h2 className="text-xl font-bold">ID: {ticket.id}</h2>
                      )}
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
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleTicketExpansion(ticket.id);
                        }}
                        className="px-2 py-1 bg-gray-300 rounded"
                      >
                        {expandedTickets[ticket.id] ? "Ocultar" : "Ver Detalhes"}
                      </button>
                      {isAdmin && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteTicket(ticket.id, ticket);
                          }}
                          className="p-1"
                          title="Excluir chamado"
                        >
                          <img src="/trash-icon.png" alt="Excluir chamado" className="w-6 h-6" />
                        </button>
                      )}
                    </div>
                  </div>

                  {expandedTickets[ticket.id] && (
                    <div className="mt-4">
                      {!isAdmin && (
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
                      <div className="mb-2">
                        <label className="font-semibold">Status:</label>{" "}
                        {isAdmin ? (
                          <select
                            value={adminEdits[ticket.id]?.status ?? ticket.status}
                            onChange={e => handleAdminEdit(ticket.id, 'status', e.target.value)}
                            className="border rounded px-2 py-1 ml-1"
                          >
                            {statusOptions.map((option, idx) => (
                              <option key={idx} value={option}>{option}</option>
                            ))}
                          </select>
                        ) : (
                          <span className="ml-1">{ticket.status}</span>
                        )}
                      </div>
                      {isAdmin && (
                        <div className="mb-2">
                          <label className="font-semibold">Atendente:</label>{" "}
                          <select
                            value={adminEdits[ticket.id]?.responsavel ?? ticket.responsavel}
                            onChange={e => handleAdminEdit(ticket.id, 'responsavel', e.target.value)}
                            className="border rounded px-2 py-1 ml-1"
                          >
                            <option value="">Selecione</option>
                            {atendenteOptions.map((opt, idx) => (
                              <option key={idx} value={opt}>{opt}</option>
                            ))}
                          </select>
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
                      {!(isAdmin && ticket.status === "Concluído") && (
                        <div className="mb-4">
                          <textarea
                            value={newComments[ticket.id] || ""}
                            onChange={e => setNewComments(prev => ({ ...prev, [ticket.id]: e.target.value }))}
                            placeholder="Digite um comentário ou atualização..."
                            className="w-full border rounded-lg p-2 mb-2 whitespace-pre-wrap"
                            rows="3"
                          />
                          <input type="file" multiple onChange={e => handleCommentFileChange(ticket.id, e)} className="w-full mb-2" />
                          <div className="flex gap-2">
                            <button
                              onClick={() => handleAddComment(ticket.id)}
                              className="px-3 py-1 rounded-lg shadow"
                              style={{ backgroundColor: "#0E1428", color: "white" }}
                            >
                              Salvar
                            </button>
                            {!isAdmin && ticket.status === "Concluído" && (
                              <button
                                onClick={() => handleReopenTicket(ticket.id)}
                                className="px-3 py-1 rounded-lg shadow"
                                style={{ backgroundColor: "#FF5E00", color: "white" }}
                              >
                                Reabrir chamado
                              </button>
                            )}
                          </div>
                        </div>
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
