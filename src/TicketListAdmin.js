// src/TicketListAdmin.jsx
import React, { useState, useEffect } from 'react';
import {
  collection,
  query,
  onSnapshot,
  orderBy,
  doc,
  updateDoc,
  deleteDoc,
  arrayUnion
} from 'firebase/firestore';
import { db } from './firebase-config.js';

const TicketListAdmin = ({
  activeTab,
  filterPriority,
  filterCategory,
  filterAtendente,
  onSendEmail
}) => {
  const [tickets, setTickets] = useState([]);
  const [expanded, setExpanded] = useState({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const q = query(
      collection(db, 'tickets'),
      orderBy('dataDeAberturaISO', 'desc')
    );
    const unsubscribe = onSnapshot(q, (snapshot) => {
      let list = snapshot.docs.map(docSnap => ({
        id: docSnap.id,
        ...docSnap.data()
      }));
      // Filtra Abertos/Concluídos
      if (activeTab === "open") {
        list = list.filter(t => t.status !== "Concluído");
      } else {
        list = list.filter(t => t.status === "Concluído");
      }
      // Filtros extras
      if (filterPriority) {
        list = list.filter(t => t.prioridade === filterPriority);
      }
      if (filterCategory) {
        list = list.filter(t => t.categoria === filterCategory);
      }
      if (filterAtendente) {
        list = list.filter(t => t.responsavel === filterAtendente);
      }
      setTickets(list);
      setLoading(false);
    }, (err) => {
      console.log("Erro ao buscar tickets (admin):", err);
      setLoading(false);
    });
    return () => unsubscribe();
  }, [activeTab, filterPriority, filterCategory, filterAtendente]);

  const toggleExpand = (ticketId) => {
    setExpanded(prev => ({ ...prev, [ticketId]: !prev[ticketId] }));
  };

  // Atualiza status
  const handleChangeStatus = async (ticket, newStatus) => {
    try {
      const ticketRef = doc(db, 'tickets', ticket.id);
      const updateData = { status: newStatus };
      if (newStatus === "Concluído") {
        updateData.dataResolucao = new Date().toLocaleString();
        // Exemplo de cálculo de SLA
        // if (ticket.dataDeAberturaISO) {
        //   const start = new Date(ticket.dataDeAberturaISO);
        //   const end = new Date();
        //   // Calcular dif...
        //   updateData.sla = "...";
        // }
      }
      await updateDoc(ticketRef, updateData);
      console.log(`Ticket ${ticket.id} status -> ${newStatus}`);
      if (onSendEmail) {
        onSendEmail({ ...ticket, status: newStatus }, `Status atualizado para ${newStatus}`);
      }
    } catch (error) {
      console.error("Erro ao atualizar status:", error);
      alert("Não foi possível atualizar o status. Tente novamente.");
    }
  };

  // Excluir ticket
  const handleDelete = async (ticket) => {
    if (!window.confirm("Tem certeza que deseja excluir este chamado?")) return;
    try {
      await deleteDoc(doc(db, 'tickets', ticket.id));
      console.log(`Ticket ${ticket.id} excluído com sucesso!`);
      if (onSendEmail) {
        onSendEmail(ticket, "Chamado excluído pelo admin");
      }
    } catch (error) {
      console.error("Erro ao excluir ticket:", error);
      alert("Não foi possível excluir o chamado. Tente novamente.");
    }
  };

  // Exemplo de adicionar comentário
  const [commentTexts, setCommentTexts] = useState({});
  const handleAddComment = async (ticket) => {
    const text = commentTexts[ticket.id];
    if (!text?.trim()) return;
    try {
      const ticketRef = doc(db, 'tickets', ticket.id);
      const newComment = {
        text,
        user: "Admin",
        timestamp: new Date().toLocaleString()
      };
      await updateDoc(ticketRef, {
        comentarios: arrayUnion(newComment)
      });
      console.log("Comentário adicionado!");
      if (onSendEmail) {
        onSendEmail(ticket, `Novo comentário: ${text}`);
      }
      setCommentTexts(prev => ({ ...prev, [ticket.id]: "" }));
    } catch (error) {
      console.error("Erro ao adicionar comentário:", error);
      alert("Não foi possível adicionar o comentário. Tente novamente.");
    }
  };

  if (loading) return <p>Carregando tickets (Admin)...</p>;
  if (tickets.length === 0) return <p>Nenhum ticket encontrado.</p>;

  return (
    <div>
      <h2 className="text-xl font-bold mb-4">Tickets (Firestore/Admin)</h2>
      {tickets.map(ticket => {
        const isExpanded = !!expanded[ticket.id];
        return (
          <div key={ticket.id} className="border rounded p-3 mb-2 bg-white">
            <div className="flex justify-between items-center">
              <div>
                <p><strong>ID:</strong> {ticket.id}</p>
                <p><strong>Solicitante:</strong> {ticket.nomeSolicitante}</p>
                <p><strong>Status:</strong> {ticket.status}</p>
              </div>
              <div>
                <button
                  onClick={() => toggleExpand(ticket.id)}
                  className="px-2 py-1 bg-gray-300 rounded"
                >
                  {isExpanded ? "Ocultar" : "Ver Detalhes"}
                </button>
                <button
                  onClick={() => handleDelete(ticket)}
                  className="px-2 py-1 bg-red-300 rounded ml-2"
                >
                  Excluir
                </button>
              </div>
            </div>
            {isExpanded && (
              <div className="mt-2">
                <p><strong>Descrição:</strong> {ticket.descricaoProblema}</p>
                <p><strong>Cargo/Departamento:</strong> {ticket.cargoDepartamento}</p>
                <p><strong>Categoria:</strong> {ticket.categoria}</p>
                <p><strong>Prioridade:</strong> {ticket.prioridade}</p>
                <p><strong>Data de Abertura:</strong> {ticket.dataDeAbertura}</p>

                {/* Alterar status se não concluído */}
                {ticket.status !== "Concluído" && (
                  <div className="mt-2">
                    <label>Status:</label>{" "}
                    <select
                      value={ticket.status}
                      onChange={(e) => handleChangeStatus(ticket, e.target.value)}
                    >
                      {["Aberto", "Em andamento", "Concluído"].map(st => (
                        <option key={st} value={st}>{st}</option>
                      ))}
                    </select>
                  </div>
                )}

                {/* Comentários */}
                <div className="mt-2">
                  <p><strong>Comentários:</strong></p>
                  {Array.isArray(ticket.comentarios) && ticket.comentarios.length > 0 ? (
                    ticket.comentarios.map((c, idx) => (
                      <div key={idx} className="bg-gray-100 p-2 my-1 rounded">
                        <p><strong>{c.user}:</strong> {c.text}</p>
                        <p className="text-xs text-gray-500">{c.timestamp}</p>
                      </div>
                    ))
                  ) : (
                    <p className="text-gray-500">Nenhum comentário.</p>
                  )}

                  {/* Campo para novo comentário */}
                  <div className="mt-2">
                    <input
                      type="text"
                      placeholder="Novo comentário..."
                      className="border rounded px-2 py-1 w-full"
                      value={commentTexts[ticket.id] || ""}
                      onChange={(e) =>
                        setCommentTexts(prev => ({ ...prev, [ticket.id]: e.target.value }))
                      }
                    />
                    <button
                      onClick={() => handleAddComment(ticket)}
                      className="mt-1 px-2 py-1 bg-blue-500 text-white rounded"
                    >
                      Adicionar
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};

export default TicketListAdmin;
