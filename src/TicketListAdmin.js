// src/TicketListAdmin.js
import React, { useState, useEffect } from 'react';
import { collection, query, onSnapshot, orderBy, doc, updateDoc, deleteDoc } from 'firebase/firestore';
import { db } from './firebase-config.js'; 
// Se precisar manipular array de comentários, também importe: import { arrayUnion } from 'firebase/firestore';

const TicketListAdmin = ({ onSendEmail }) => {
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [expandedTickets, setExpandedTickets] = useState({});
  
  // Exemplo de opções de status
  const statusOptions = ["Aberto", "Em andamento", "Concluído"];

  useEffect(() => {
    // Lê todos os tickets em ordem decrescente de data
    const q = query(
      collection(db, 'tickets'),
      orderBy('dataDeAberturaISO', 'desc')
    );
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const list = snapshot.docs.map(docSnap => ({
        id: docSnap.id,
        ...docSnap.data()
      }));
      setTickets(list);
      setLoading(false);
    }, (err) => {
      console.error("Erro ao buscar tickets:", err);
      setError("Erro ao buscar tickets");
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  // Função para alternar exibição de detalhes
  const toggleExpand = (ticketId) => {
    setExpandedTickets(prev => ({ ...prev, [ticketId]: !prev[ticketId] }));
  };

  // Função para atualizar status no Firestore
  const handleChangeStatus = async (ticket, newStatus) => {
    try {
      const ticketRef = doc(db, 'tickets', ticket.id);
      const updateData = { status: newStatus };

      // Se concluir, pode salvar dataResolucao e SLA
      if (newStatus === "Concluído") {
        updateData.dataResolucao = new Date().toLocaleString();
        // Se quiser calcular SLA:
        // updateData.sla = "xx horas"; 
        // ou algo baseado em dataDeAberturaISO
      }

      await updateDoc(ticketRef, updateData);
      console.log(`Status do ticket ${ticket.id} atualizado para ${newStatus}`);

      // Opcional: enviar e-mail avisando
      if (onSendEmail) {
        onSendEmail({ ...ticket, status: newStatus }, `Status atualizado para ${newStatus}`);
      }
    } catch (error) {
      console.error("Erro ao atualizar status:", error);
      alert("Não foi possível atualizar o status. Tente novamente.");
    }
  };

  // Função para excluir ticket
  const handleDelete = async (ticketId) => {
    if (!window.confirm("Tem certeza que deseja excluir este chamado?")) return;
    try {
      await deleteDoc(doc(db, 'tickets', ticketId));
      console.log(`Ticket ${ticketId} excluído com sucesso!`);
      // Se quiser enviar e-mail de exclusão, chame onSendEmail aqui também
    } catch (error) {
      console.error("Erro ao excluir ticket:", error);
      alert("Não foi possível excluir o ticket. Tente novamente.");
    }
  };

  // Função para adicionar comentário (exemplo simples)
  // Requer arrayUnion se quiser inserir sem sobrescrever o array
  // import { arrayUnion } from 'firebase/firestore';
  const handleAddComment = async (ticket, commentText) => {
    if (!commentText.trim()) return;
    try {
      const ticketRef = doc(db, 'tickets', ticket.id);
      const newComment = {
        text: commentText,
        user: "Admin",
        timestamp: new Date().toLocaleString()
      };
      // Supondo que 'comentarios' seja um array no documento
      // e queremos inserir sem sobrescrever
      await updateDoc(ticketRef, {
        comentarios: arrayUnion(newComment)
      });
      console.log(`Comentário adicionado ao ticket ${ticket.id}`);
      if (onSendEmail) {
        onSendEmail(ticket, `Novo comentário: ${commentText}`);
      }
    } catch (error) {
      console.error("Erro ao adicionar comentário:", error);
      alert("Não foi possível adicionar o comentário. Tente novamente.");
    }
  };

  if (loading) return <p>Carregando tickets (Firestore/Admin)...</p>;
  if (error) return <p>{error}</p>;
  if (tickets.length === 0) return <p>Nenhum ticket encontrado.</p>;

  return (
    <div>
      <h2 className="text-2xl font-bold mb-4">Tickets (Firestore/Admin)</h2>
      {tickets.map(ticket => {
        const expanded = !!expandedTickets[ticket.id];
        return (
          <div key={ticket.id} className="border rounded p-4 mb-2 bg-white">
            <div className="flex justify-between items-center">
              <div>
                <p><strong>ID:</strong> {ticket.id}</p>
                <p><strong>Solicitante:</strong> {ticket.nomeSolicitante}</p>
                <p><strong>Status:</strong> {ticket.status}</p>
                <p><strong>Data de Abertura:</strong> {ticket.dataDeAbertura}</p>
              </div>
              <div>
                <button
                  onClick={() => toggleExpand(ticket.id)}
                  className="px-2 py-1 bg-gray-300 rounded"
                >
                  {expanded ? "Ocultar" : "Ver Detalhes"}
                </button>
                <button
                  onClick={() => handleDelete(ticket.id)}
                  className="px-2 py-1 bg-red-300 rounded ml-2"
                >
                  Excluir
                </button>
              </div>
            </div>

            {expanded && (
              <div className="mt-2">
                <p><strong>Descrição:</strong> {ticket.descricaoProblema}</p>
                <p><strong>Cargo/Departamento:</strong> {ticket.cargoDepartamento}</p>
                {/* Se quiser trocar status */}
                {ticket.status !== "Concluído" && (
                  <div className="mt-2">
                    <label>Status:</label>{" "}
                    <select
                      value={ticket.status}
                      onChange={(e) => handleChangeStatus(ticket, e.target.value)}
                    >
                      {statusOptions.map(s => (
                        <option key={s} value={s}>{s}</option>
                      ))}
                    </select>
                  </div>
                )}

                {/* Comentários */}
                <div className="mt-2">
                  <p><strong>Comentários:</strong></p>
                  {Array.isArray(ticket.comentarios) && ticket.comentarios.length > 0 ? (
                    ticket.comentarios.map((cmt, idx) => (
                      <div key={idx} className="bg-gray-100 p-2 my-1 rounded">
                        <p><strong>{cmt.user}:</strong> {cmt.text}</p>
                        <p className="text-xs text-gray-500">{cmt.timestamp}</p>
                      </div>
                    ))
                  ) : (
                    <p className="text-gray-500">Nenhum comentário.</p>
                  )}
                  {/* Exemplo de formulário simples para adicionar comentário */}
                  <div className="mt-2">
                    <input
                      type="text"
                      placeholder="Novo comentário"
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          handleAddComment(ticket, e.target.value);
                          e.target.value = "";
                        }
                      }}
                      className="border rounded px-2 py-1 w-full"
                    />
                    <small className="text-gray-500">Pressione Enter para salvar</small>
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
