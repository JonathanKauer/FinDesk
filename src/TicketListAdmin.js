// src/TicketListAdmin.jsx
import React, { useState, useEffect } from 'react';
import { collection, query, orderBy, onSnapshot, doc, updateDoc, deleteDoc } from 'firebase/firestore';
import { db } from './firebase-config.js';

const TicketListAdmin = ({ activeTab, filterPriority, filterCategory, filterAtendente, onSendEmail, calculateSLA }) => {
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const q = query(collection(db, 'tickets'), orderBy('dataDeAberturaISO', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      let list = snapshot.docs.map(docSnap => ({ id: docSnap.id, ...docSnap.data() }));
      if (filterPriority) list = list.filter(ticket => ticket.prioridade === filterPriority);
      if (filterCategory) list = list.filter(ticket => ticket.categoria === filterCategory);
      if (filterAtendente) list = list.filter(ticket => ticket.responsavel === filterAtendente);
      list = activeTab === "open" ? list.filter(ticket => ticket.status !== "Concluído") : list.filter(ticket => ticket.status === "Concluído");
      setTickets(list);
      setLoading(false);
    }, (err) => {
      console.error("Erro ao buscar tickets (admin):", err);
      setLoading(false);
    });
    return () => unsubscribe();
  }, [activeTab, filterPriority, filterCategory, filterAtendente]);

  const handleDeleteTicket = async (ticketId) => {
    try {
      await deleteDoc(doc(db, 'tickets', ticketId));
      console.log("Ticket deletado:", ticketId);
    } catch (error) {
      console.error("Erro ao deletar ticket:", error);
      alert("Falha ao deletar ticket.");
    }
  };

  // Exemplo de atualização administrativa – você pode expandir conforme necessário
  const handleUpdateTicket = async (ticket, updateData) => {
    try {
      await updateDoc(doc(db, 'tickets', ticket.id), updateData);
      if (onSendEmail) onSendEmail(ticket, "Ticket atualizado pelo admin");
    } catch (error) {
      console.error("Erro ao atualizar ticket:", error);
      alert("Falha ao atualizar ticket.");
    }
  };

  if (loading) return <p>Carregando tickets...</p>;
  if (tickets.length === 0) return <p>Nenhum ticket encontrado.</p>;

  return (
    <div>
      <h2 className="text-xl font-bold mb-4">Tickets Administrativos</h2>
      {tickets.map(ticket => (
        <div key={ticket.id} className="border rounded p-2 mb-2 bg-white">
          <p><strong>ID:</strong> {ticket.id}</p>
          <p><strong>Solicitante:</strong> {ticket.nomeSolicitante}</p>
          <p><strong>Status:</strong> {ticket.status}</p>
          <p><strong>Prioridade:</strong> {ticket.prioridade}</p>
          <p><strong>Data de Abertura:</strong> {ticket.dataDeAbertura}</p>
          {ticket.status === "Concluído" && ticket.dataDeAberturaISO && ticket.dataResolucaoISO && (
            <p><strong>SLA:</strong> {calculateSLA(ticket.dataDeAberturaISO, ticket.dataResolucaoISO)}</p>
          )}
          <p><strong>Descrição:</strong> {ticket.descricaoProblema}</p>
          <p><strong>Categoria:</strong> {ticket.categoria}</p>
          <p><strong>Cargo/Departamento:</strong> {ticket.cargoDepartamento}</p>
          {ticket.attachments && ticket.attachments.length > 0 && (
            <div>
              <strong>Anexos:</strong>
              <ul>
                {ticket.attachments.map((att, idx) => (
                  <li key={idx}>
                    <a href={att.url} target="_blank" rel="noopener noreferrer">{att.name}</a>
                  </li>
                ))}
              </ul>
            </div>
          )}
          <div className="flex gap-2 mt-2">
            <button onClick={() => handleDeleteTicket(ticket.id)} className="px-2 py-1 rounded bg-red-500 text-white">
              Excluir
            </button>
            {/* Você pode adicionar mais ações administrativas conforme necessário */}
          </div>
        </div>
      ))}
    </div>
  );
};

export default TicketListAdmin;
