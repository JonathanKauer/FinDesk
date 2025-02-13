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

// Opções de prioridade e status
const priorityOptions = [
  "Baixa (7 dias úteis)",
  "Média (5 dias úteis)",
  "Alta (2 dias úteis)",
  "Urgente (1 dia útil)"
];
const statusOptions = ["Aberto", "Em andamento", "Concluído"];
const responsibleOptions = ["Nayla Martins", "Jonathan Kauer"];

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

// Função para validar datas no formato dd/mm/aaaa
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

// Função que envia e-mails usando Promise.all
const sendTicketUpdateEmail = async (ticket, updateDescription) => {
  const subject = `Findesk: Atualização em chamado`;
  const body = `Resumo da atualização: ${updateDescription}\n` +
               `Ticket ID: ${ticket.id}\n` +
               `Solicitante: ${ticket.nomeSolicitante}\n` +
               `Status: ${ticket.status}\n` +
               `Descrição: ${ticket.descricaoProblema}\n` +
               `Link de acesso: https://fin-desk.vercel.app/`;
  console.log(`Enviando email para ${ticket.emailSolicitante} e para findesk@guiainvest.com.br`);
  console.log(`Assunto: ${subject}`);
  console.log(`Corpo: ${body}`);
  const url = "https://script.google.com/macros/s/AKfycbxS1OA9AZEypzbyPGX5ypOhR8drk0o0IQpu_8iZe_QIAy8pfTGKZ_GCUduTdi3Xvur0/exec";
  const emails = ["findesk@guiainvest.com.br", ticket.emailSolicitante];
  try {
    await Promise.all(emails.map(email => {
      const formdata = {
        email,
        subject,
        message: body
      };
      return fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formdata)
      });
    }));
  } catch (error) {
    console.log("Erro ao enviar e-mails:", error);
  }
};

function App() {
  // Estados de login
  const [currentUser, setCurrentUser] = useState(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loginUser, setLoginUser] = useState("");
  const [loginAdmin, setLoginAdmin] = useState(false);
  const [loginPassword, setLoginPassword] = useState("");

  // Estados dos chamados e do formulário de novo chamado
  const [tickets, setTickets] = useState([]);
  const [showNewTicketForm, setShowNewTicketForm] = useState(false);

  // Campos para criação de chamado (o solicitante será currentUser)
  const [cargoDepartamento, setCargoDepartamento] = useState("");
  const [emailSolicitante, setEmailSolicitante] = useState("");
  const [descricaoProblema, setDescricaoProblema] = useState("");
  const [categoria, setCategoria] = useState("");
  const [prioridade, setPrioridade] = useState("");
  const [newTicketFiles, setNewTicketFiles] = useState([]);

  // Campos para comentários
  const [newComment, setNewComment] = useState("");
  const [newCommentFiles, setNewCommentFiles] = useState([]);

  // Gerenciamento das opções de cargo (permitindo "+Novo")
  const [cargoOptions, setCargoOptions] = useState(initialCargoOptions);

  // Gerenciamento das opções de categoria (a opção "+Novo" será utilizada para adicionar nova categoria)
  const [categoryOptions, setCategoryOptions] = useState([
    "Clientes",
    "Comissões e/ou SplitC",
    "Basement",
    "+Novo"
  ]);

  // Estados dos filtros de admin
  const [adminFilterPriority, setAdminFilterPriority] = useState("");
  const [adminFilterCategory, setAdminFilterCategory] = useState("");
  const [adminFilterRequester, setAdminFilterRequester] = useState("");

  // Controle de expansão dos chamados (modo resumo/detalhado)
  const [expandedTickets, setExpandedTickets] = useState({});

  // Estado para as abas: "open" (chamados abertos/em andamento) e "closed" (chamados concluídos)
  const [activeTab, setActiveTab] = useState("open");

  // Estado para busca geral
  const [searchQuery, setSearchQuery] = useState("");

  // Estado para armazenar alterações temporárias feitas pelo admin
  const [adminEdits, setAdminEdits] = useState({});

  // Carrega os tickets salvos do localStorage ao iniciar o App
  useEffect(() => {
    const savedTickets = localStorage.getItem('tickets');
    if (savedTickets) {
      setTickets(JSON.parse(savedTickets));
    }
  }, []);

  // Salva os tickets no localStorage sempre que houver alteração
  useEffect(() => {
    localStorage.setItem('tickets', JSON.stringify(tickets));
  }, [tickets]);

  // Atualiza o estado temporário dos edits do admin
  const handleAdminEdit = (ticketId, field, value) => {
    setAdminEdits(prev => ({
      ...prev,
      [ticketId]: {
        ...prev[ticketId],
        [field]: value
      }
    }));
  };

  // Validação do login: nome e sobrenome mínimos
  const validateLoginName = (name) => {
    return name.trim().split(" ").length >= 2;
  };

  // Altera a expansão do ticket
  const toggleTicketExpansion = (ticketId) => {
    setExpandedTickets(prev => ({ ...prev, [ticketId]: !prev[ticketId] }));
  };

  // Handler para seleção de cargo/departamento
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

  // Handler para seleção de categoria
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

  // Handler para anexar documentos no novo chamado
  const handleTicketFileChange = (e) => {
    setNewTicketFiles(Array.from(e.target.files));
  };

  // Handler para anexar documentos nos comentários
  const handleCommentFileChange = (e) => {
    setNewCommentFiles(Array.from(e.target.files));
  };

  // Criação de um novo chamado
  const handleCreateTicket = (e) => {
    e.preventDefault();
    const dataDeAbertura = new Date();
    const daysToAdd = priorityDaysMapping[prioridade] || 0;
    const prazoFinalizacao = addBusinessDays(dataDeAbertura, daysToAdd);

    const newTicket = {
      id: generateTicketId(),
      nomeSolicitante: currentUser,
      cargoDepartamento,
      emailSolicitante,
      descricaoProblema,
      categoria,
      prioridade,
      dataDeAbertura: dataDeAbertura.toLocaleString(),
      prazoFinalizacao,
      status: "Aberto",
      dataResolucao: "",
      responsavel: "",
      comentarios: [],
      attachments: newTicketFiles,
    };

    setTickets(prev => [...prev, newTicket]);
    setCargoDepartamento("");
    setEmailSolicitante("");
    setDescricaoProblema("");
    setCategoria("");
    setPrioridade("");
    setNewTicketFiles([]);
    setShowNewTicketForm(false);

    sendTicketUpdateEmail(newTicket, "Abertura de novo chamado");
  };

  // Reabre um chamado (para usuários)
  const handleReopenTicket = (ticketId) => {
    if (!newComment.trim()) {
      alert("Para reabrir o chamado, insira informações adicionais para que o admin possa avaliar o caso.");
      return;
    }
    setTickets(prev =>
      prev.map(ticket => {
        if (ticket.id === ticketId) {
          const reopenComment = {
            text: "Reabertura: " + newComment,
            user: currentUser,
            timestamp: new Date().toLocaleString(),
            attachments: newCommentFiles,
          };
          const updatedTicket = {
            ...ticket,
            status: "Aberto",
            dataResolucao: "",
            comentarios: [...ticket.comentarios, reopenComment],
          };
          sendTicketUpdateEmail(updatedTicket, `Chamado reaberto. Comentário: ${reopenComment.text}`);
          return updatedTicket;
        }
        return ticket;
      })
    );
    setNewComment("");
    setNewCommentFiles([]);
  };

  // Adiciona um comentário ou atualiza o chamado (incluindo edições do admin)
  const handleAddComment = (ticketId) => {
    if (!newComment.trim()) return;

    const ticket = tickets.find(t => t.id === ticketId);

    if (isAdmin) {
      const edits = adminEdits[ticketId] || {};
      const newStatus = edits.status ?? ticket.status;
      const newDataResolucao = edits.dataResolucao ?? ticket.dataResolucao;
      if (newStatus === "Concluído" && (!newDataResolucao || !isValidDate(newDataResolucao.trim()))) {
        alert("Para chamados com status Concluído, é necessário preencher a Data de Resolução com um valor válido (dd/mm/aaaa) antes de salvar.");
        return;
      }
      if (edits.status || edits.dataResolucao) {
        setTickets(prev =>
          prev.map(ticketItem => {
            if (ticketItem.id === ticketId) {
              const updatedTicket = {
                ...ticketItem,
                status: newStatus,
                dataResolucao: newDataResolucao,
              };
              sendTicketUpdateEmail(updatedTicket, `Atualização pelo admin: Status alterado para ${newStatus}, Data de Resolução: ${newDataResolucao}`);
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
      }
    }

    const comment = {
      text: newComment,
      user: currentUser,
      timestamp: new Date().toLocaleString(),
      attachments: newCommentFiles,
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
    setNewComment("");
    setNewCommentFiles([]);
  };

  // Atualiza diretamente o ticket (para os edits do admin)
  const handleAdminUpdate = (ticketId, field, value) => {
    setTickets(prev =>
      prev.map(ticket =>
        ticket.id === ticketId ? { ...ticket, [field]: value } : ticket
      )
    );
  };

  // Exclui um chamado (somente admin)
  const handleDeleteTicket = async (ticketId, ticket) => {
    if (window.confirm("Tem certeza que deseja excluir este chamado?")) {
      await sendTicketUpdateEmail(ticket, "Chamado excluído pelo admin");
      setTickets(prev => prev.filter(t => t.id !== ticketId));
    }
  };

  // Filtra os tickets: admin vê todos; usuário, apenas os seus
  const visibleTickets = tickets.filter(ticket => {
    if (isAdmin) return true;
    return ticket.nomeSolicitante === currentUser;
  });

  // Filtra os tickets pela aba ativa (aberto/em andamento vs concluído)
  const tabFilteredTickets = visibleTickets.filter(ticket => {
    const isConcluded =
      ticket.status === "Concluído" &&
      ticket.dataResolucao &&
      isValidDate(ticket.dataResolucao.trim());
    return activeTab === "open" ? !isConcluded : isConcluded;
  });

  // Busca e filtros adicionais (para admin)
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
    const matchesRequester = adminFilterRequester
      ? ticket.nomeSolicitante.toLowerCase().includes(adminFilterRequester.toLowerCase())
      : true;
    return matchesSearch && matchesPriority && matchesCategory && matchesRequester;
  });

  // Handler para o login
  const handleLoginSubmit = (e) => {
    e.preventDefault();
    if (!validateLoginName(loginUser)) {
      alert("Por favor, insira nome e sobrenome (ex.: Jonathan Kauer).");
      return;
    }
    if (loginAdmin && loginPassword !== "admin123@guiainvestgpt") {
      alert("Senha incorreta para Admin!");
      return;
    }
    setCurrentUser(loginUser);
    setIsAdmin(loginAdmin);
    setLoginUser("");
    setLoginAdmin(false);
    setLoginPassword("");
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
            <label className="block font-semibold">Nome de Usuário:</label>
            <input
              type="text"
              value={loginUser}
              onChange={e => setLoginUser(e.target.value)}
              required
              className="border rounded px-2 py-1 w-full"
              placeholder="Digite seu nome completo"
            />
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
          {loginAdmin && (
            <div className="mb-2">
              <label className="block font-semibold">Senha de Admin:</label>
              <input
                type="password"
                value={loginPassword}
                onChange={e => setLoginPassword(e.target.value)}
                required={loginAdmin}
                className="border rounded px-2 py-1 w-full"
              />
            </div>
          )}
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
                Logado como: <span className="font-bold">{currentUser}</span> {isAdmin && <span className="text-red-500">(Admin)</span>}
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
                  <input
                    type="text"
                    placeholder="Solicitante..."
                    value={adminFilterRequester}
                    onChange={e => setAdminFilterRequester(e.target.value)}
                    className="border rounded px-2 py-1"
                  />
                </div>
              )}
            </div>
          </div>

          <div className="flex gap-4 mb-4 w-full max-w-5xl">
            <button onClick={() => setActiveTab("open")} className="px-3 py-1 rounded" style={activeTab === "open" ? { backgroundColor: "#0E1428", color: "white" } : { backgroundColor: "gray", color: "black" }}>
              Abertos e em andamento
            </button>
            <button onClick={() => setActiveTab("closed")} className="px-3 py-1 rounded" style={activeTab === "closed" ? { backgroundColor: "#0E1428", color: "white" } : { backgroundColor: "gray", color: "black" }}>
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
                <label className="block font-semibold">E-mail do Solicitante:</label>
                <input
                  type="email"
                  value={emailSolicitante}
                  onChange={e => setEmailSolicitante(e.target.value)}
                  required
                  className="border rounded px-2 py-1 w-full"
                  placeholder="Digite o e-mail"
                />
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
                      <p className="text-gray-700 mb-1">
                        <span className="font-semibold">E-mail:</span> {ticket.emailSolicitante}
                        {isAdmin && (
                          <img
                            src="/email-icon.png"
                            alt="Enviar email"
                            className="inline-block ml-2 cursor-pointer"
                            style={{ width: "20px", height: "20px" }}
                            onClick={() => window.location.href = `mailto:${ticket.emailSolicitante}`}
                          />
                        )}
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
                      {((adminEdits[ticket.id]?.status ?? ticket.status) === "Concluído") && (
                        <div className="mb-2">
                          <label className="font-semibold">Data de Resolução:</label>{" "}
                          {isAdmin ? (
                            <input
                              type="text"
                              placeholder="dd/mm/aaaa"
                              value={adminEdits[ticket.id]?.dataResolucao ?? ticket.dataResolucao}
                              onChange={e => handleAdminEdit(ticket.id, 'dataResolucao', e.target.value)}
                              className="border rounded px-2 py-1 ml-1"
                            />
                          ) : (
                            <span className="ml-1">{ticket.dataResolucao}</span>
                          )}
                        </div>
                      )}
                      <div className="mb-2">
                        {ticket.attachments && ticket.attachments.length > 0 && (
                          <>
                            <label className="font-semibold">Anexos:</label>
                            {renderAttachments(ticket.attachments)}
                          </>
                        )}
                      </div>
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
                      <div className="mb-4">
                        <textarea
                          value={newComment}
                          onChange={e => setNewComment(e.target.value)}
                          placeholder="Digite um comentário ou atualização..."
                          className="w-full border rounded-lg p-2 mb-2 whitespace-pre-wrap"
                          rows="3"
                        />
                        <input type="file" multiple onChange={handleCommentFileChange} className="w-full mb-2" />
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
