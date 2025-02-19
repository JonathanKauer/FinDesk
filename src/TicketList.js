// src/TicketList.js
import React, { useState, useEffect } from 'react';
import { collection, query, where, orderBy, onSnapshot, doc, updateDoc } from 'firebase/firestore';
import { db } from './firebase-config.js';

// Função auxiliar para formatar datas (opcional)
const formatDate = (isoString) => {
  if (!isoString) return "";
  return new Date(isoString).toLocaleString();
};

const TicketList = ({ currentUser, onSendEmail }) => {
  const [tickets, setTickets] = useState([]);
  const [expanded, setExpanded] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Opções de status para admin
  const statusOptions = ["Aberto", "Em andamento", "Concluído"];

  useEffect(() => {
    if (!currentUser) return;

    // Referência base para a coleção "tickets"
    let baseQuery = collection(db, 'tickets');

    // Se for admin, busca todos; se não, filtra pelo emailSolicitante
    if (!currentUser.isAdmin) {
      // Filtra apenas os tickets do usuário logado
      baseQuery = query(
        baseQuery,
        where('emailSolicitante', '==', currentUser.email),
        orderBy('dataDeAberturaISO', 'desc')
      );
    } else {
      // Admin vê todos, ordenados
      baseQuery = query(
        baseQuery,
        orderBy('dataDeAberturaISO', 'desc')
      );
    }

    const unsubscribe = onSnapshot(baseQuery, (snapshot) => {
      const lista = snapshot.docs.map(docSnap => ({
        id: docSnap.id,
        ...docSnap.data()
      }));
      setTickets(lista);
      setLoading(false);
    }, (err) => {
      console.error("Erro ao buscar tickets:", err);
      setError("Erro ao buscar tickets");
      setLoading(false);
    });

    return () => unsubscribe();
  }, [currentUser]);

  // Alterna expansão
  const toggleExpand = (ticketId) => {
    setExpanded(prev => ({
      ...prev,
      [ticketId]: !prev[ticketId]
    }));
  };

  // Se admin trocar status, atualiza no Firestore
  const handleChangeStatus = async (ticket, newStatus) => {
    try {
      const ticketRef = doc(db, 'tickets', ticket.id);
      await updateDoc(ticketRef, { status: newStatus });
      console.log(`Status do ticket ${ticket.id} atualizado para ${newStatus}`);
      // Opcional: enviar e-mail avisando mudança de status
      if (onSendEmail) {
        onSendEmail(
          { ...ticket, status: newStatus },
          `Status do chamado atualizado para ${newStatus}`
        );
      }
    } catch (error) {
      console.error("Erro ao atualizar status:", error);
      alert("Não foi possível atualizar o status. Tente novamente.");
    }
  };

  if (loading) return <p>Carregando tickets...</p>;
  if (error) return <p>{error}</p>;
  if (tickets.length === 0) return <p>Nenhum ticket encontrado.</p>;

  return (
    <div>
      {/* Se for admin, mostra título de admin, senão, algo como "Meus Chamados" */}
      <h2 className="text-2xl font-bold mb-4">
        {currentUser.isAdmin ? "Todos os Chamados (Admin)" : "Meus Chamados"}
      </h2>

      <div className="grid gap-4 w-full max-w-5xl mx-auto">
        {tickets.map((ticket) => {
          const isExpanded = !!expanded[ticket.id];
          const isConcluido = ticket.status === "Concluído";
          return (
            <div key={ticket.id} className="relative shadow p-4 rounded-2xl bg-white">
              <div className="flex justify-between items-center">
                <div>
                  <h3 className="text-xl font-bold">ID: {ticket.id}</h3>
                  <p><strong>Solicitante:</strong> {ticket.nomeSolicitante}</p>
                  <p><strong>Prioridade:</strong> {ticket.prioridade}</p>
                  <p><strong>Data de Abertura:</strong> {ticket.dataDeAbertura}</p>
                  <p><strong>Prazo Final:</strong> {formatDate(ticket.prazoFinalizacao)}</p>
                  {isConcluido && (
                    <>
                      <p><strong>Data de Resolução:</strong> {ticket.dataResolucao}</p>
                      <p><strong>SLA:</strong> {ticket.sla}</p>
                    </>
                  )}
                </div>
                <button
                  onClick={() => toggleExpand(ticket.id)}
                  className="px-2 py-1 bg-gray-300 rounded"
                >
                  {isExpanded ? "Ocultar" : "Ver Detalhes"}
                </button>
              </div>

              {isExpanded && (
                <div className="mt-4">
                  <p><strong>Descrição:</strong> {ticket.descricaoProblema}</p>
                  <p><strong>Cargo/Departamento:</strong> {ticket.cargoDepartamento}</p>

                  {/* Se for admin, permitir alterar status */}
                  {currentUser.isAdmin && (
                    <div className="mb-2">
                      <label className="font-semibold">Status:</label>{" "}
                      {isConcluido ? (
                        <span className="ml-1">{ticket.status}</span>
                      ) : (
                        <select
                          value={ticket.status}
                          onChange={(e) => handleChangeStatus(ticket, e.target.value)}
                          className="border rounded px-2 py-1 ml-1"
                        >
                          {statusOptions.map((option, idx) => (
                            <option key={idx} value={option}>{option}</option>
                          ))}
                        </select>
                      )}
                    </div>
                  )}

                  {/* Anexos, se existirem */}
                  {ticket.attachments && ticket.attachments.length > 0 && (
                    <div className="mb-2">
                      <strong>Anexos:</strong>
                      <ul>
                        {ticket.attachments.map((file, i) => (
                          <li key={i}>{file.name}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  <hr className="my-2" />
                  <p className="font-semibold">Comentários/Atualizações:</p>
                  {Array.isArray(ticket.comentarios) && ticket.comentarios.length > 0 ? (
                    ticket.comentarios.map((cmt, idx) => (
                      <div key={idx} className="bg-gray-100 p-2 rounded-lg mb-2">
                        <p className="text-sm whitespace-pre-wrap">
                          <strong>{cmt.user}:</strong> {cmt.text}
                        </p>
                        <p className="text-xs text-gray-500">{cmt.timestamp}</p>
                      </div>
                    ))
                  ) : (
                    <p className="text-gray-500">Nenhum comentário.</p>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default TicketList;
