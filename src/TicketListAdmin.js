// src/TicketListAdmin.js
import React, { useState, useEffect } from 'react';
import { collection, onSnapshot, query, orderBy, doc, updateDoc } from 'firebase/firestore';
import { db } from './firebase-config.js';

// Função auxiliar para formatar datas, se quiser
const formatDate = (isoString) => {
  if (!isoString) return "";
  const date = new Date(isoString);
  return date.toLocaleString();
};

const TicketListAdmin = () => {
  const [tickets, setTickets] = useState([]);
  const [expandedTickets, setExpandedTickets] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Exemplo de opções de status e prioridade
  const statusOptions = ["Aberto", "Em andamento", "Concluído"];

  useEffect(() => {
    // Buscar os tickets do Firestore em ordem decrescente de dataDeAberturaISO
    const q = query(
      collection(db, 'tickets'),
      orderBy('dataDeAberturaISO', 'desc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
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
  }, []);

  // Função para alternar a expansão de um ticket
  const toggleTicketExpansion = (ticketId) => {
    setExpandedTickets(prev => ({
      ...prev,
      [ticketId]: !prev[ticketId]
    }));
  };

  // Função para atualizar o status no Firestore
  const handleStatusChange = async (ticketId, newStatus) => {
    try {
      const ticketRef = doc(db, 'tickets', ticketId);
      await updateDoc(ticketRef, { status: newStatus });
      console.log(`Ticket ${ticketId} atualizado para status: ${newStatus}`);
    } catch (error) {
      console.error("Erro ao atualizar status:", error);
      alert("Não foi possível atualizar o status. Tente novamente.");
    }
  };

  if (loading) return <p>Carregando tickets do Firestore...</p>;
  if (error) return <p>{error}</p>;
  if (tickets.length === 0) return <p>Nenhum ticket encontrado no Firestore.</p>;

  return (
    <div>
      <h2 className="text-2xl font-bold mb-4">Tickets (Firestore/Admin)</h2>
      <div className="grid gap-4 w-full max-w-5xl mx-auto">
        {tickets.map((ticket) => {
          const isExpanded = !!expandedTickets[ticket.id];
          return (
            <div
              key={ticket.id}
              className="relative shadow p-4 rounded-2xl bg-white"
            >
              <div className="flex justify-between items-center">
                <div>
                  <h3 className="text-xl font-bold">
                    ID: {ticket.id}
                  </h3>
                  <p className="text-gray-700">
                    <strong>Solicitante:</strong> {ticket.nomeSolicitante}
                  </p>
                  <p className="text-gray-700">
                    <strong>Categoria:</strong> {ticket.categoria} |{" "}
                    <strong>Prioridade:</strong> {ticket.prioridade}
                  </p>
                  <p className="text-gray-700">
                    <strong>Data de Abertura:</strong> {ticket.dataDeAbertura}
                  </p>
                  <p className="text-gray-700">
                    <strong>Prazo Final:</strong> {formatDate(ticket.prazoFinalizacao)}
                  </p>
                  {ticket.status === "Concluído" && (
                    <>
                      <p className="text-gray-700">
                        <strong>Data de Resolução:</strong> {ticket.dataResolucao}
                      </p>
                      <p className="text-gray-700">
                        <strong>SLA:</strong> {ticket.sla}
                      </p>
                    </>
                  )}
                </div>
                <button
                  onClick={() => toggleTicketExpansion(ticket.id)}
                  className="px-2 py-1 bg-gray-300 rounded"
                >
                  {isExpanded ? "Ocultar" : "Ver Detalhes"}
                </button>
              </div>
              {isExpanded && (
                <div className="mt-4">
                  <p className="text-gray-700 mb-1">
                    <strong>Descrição:</strong> {ticket.descricaoProblema}
                  </p>
                  <p className="text-gray-700 mb-1">
                    <strong>Cargo/Departamento:</strong> {ticket.cargoDepartamento}
                  </p>

                  {/* Se o ticket ainda não estiver concluído, permitir trocar o status */}
                  <div className="mb-2">
                    <label className="font-semibold">Status:</label>{" "}
                    {ticket.status === "Concluído" ? (
                      <span className="ml-1">{ticket.status}</span>
                    ) : (
                      <select
                        value={ticket.status}
                        onChange={(e) => handleStatusChange(ticket.id, e.target.value)}
                        className="border rounded px-2 py-1 ml-1"
                      >
                        {statusOptions.map((option, idx) => (
                          <option key={idx} value={option}>
                            {option}
                          </option>
                        ))}
                      </select>
                    )}
                  </div>

                  {/* Se houver anexos */}
                  {ticket.attachments && ticket.attachments.length > 0 && (
                    <div className="mb-2">
                      <strong>Anexos:</strong>
                      <ul>
                        {ticket.attachments.map((file, i) => {
                          // Se fosse só URL, bastaria <a href={file}>file</a>
                          // Mas como é localStorage, depende de como foi salvo
                          return <li key={i}>{file.name}</li>;
                        })}
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

export default TicketListAdmin;
