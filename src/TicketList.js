// src/TicketList.jsx
import React, { useState, useEffect } from 'react';
import { collection, query, where, orderBy, onSnapshot, doc, updateDoc } from 'firebase/firestore';
import { db } from './firebase-config.js';

const TicketList = ({ currentUser, activeTab, onSendEmail, calculateSLA }) => {
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!currentUser) return;
    // Busca os tickets do usuário
    const q = query(
      collection(db, 'tickets'),
      where('userId', '==', currentUser.uid),
      orderBy('dataDeAberturaISO', 'desc')
    );
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const all = snapshot.docs.map(docSnap => ({ id: docSnap.id, ...docSnap.data() }));
      const filtered = activeTab === "open"
        ? all.filter(ticket => ticket.status !== "Concluído")
        : all.filter(ticket => ticket.status === "Concluído");
      setTickets(filtered);
      setLoading(false);
    }, (err) => {
      console.error("Erro ao buscar tickets (usuário):", err);
      setLoading(false);
    });
    return () => unsubscribe();
  }, [currentUser, activeTab]);

  // Reabre um ticket concluído: atualiza o status para "Aberto" e limpa as datas de resolução e SLA
  const handleReopenTicket = async (ticket) => {
    try {
      const ticketRef = doc(db, 'tickets', ticket.id);
      await updateDoc(ticketRef, { status: "Aberto", dataResolucao: "", sla: "" });
      if (onSendEmail) onSendEmail(ticket, "Chamado reaberto");
    } catch (error) {
      console.error("Erro ao reabrir ticket:", error);
      alert("Falha ao reabrir o ticket.");
    }
  };

  // Avalia um ticket: exemplo simples solicitando uma nota via prompt
  const handleEvaluateTicket = (ticket) => {
    const rating = prompt("Avalie o chamado (de 1 a 5):");
    if (rating) {
      alert(`Você avaliou o ticket ${ticket.id} com nota ${rating}.`);
      // Aqui, você pode implementar a atualização do ticket com a avaliação, se desejar.
    }
  };

  if (loading) return <p>Carregando seus chamados...</p>;
  if (tickets.length === 0) return <p>Nenhum chamado encontrado.</p>;

  return (
    <div>
      <h2 className="text-xl font-bold mb-4">Meus Chamados</h2>
      {tickets.map(ticket => (
        <div key={ticket.id} className="border rounded p-2 mb-2 bg-white">
          <p><strong>Status:</strong> {ticket.status}</p>
          <p><strong>Prioridade:</strong> {ticket.prioridade}</p>
          <p><strong>Data de Abertura:</strong> {ticket.dataDeAbertura}</p>
          {ticket.status === "Concluído" && ticket.dataDeAberturaISO && ticket.dataResolucaoISO && (
            <p><strong>SLA:</strong> {calculateSLA(ticket.dataDeAberturaISO, ticket.dataResolucaoISO)}</p>
          )}
          <p><strong>Descrição:</strong> {ticket.descricaoProblema}</p>
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
          {ticket.status === "Concluído" && (
            <div className="mt-2 flex gap-2">
              <button
                onClick={() => handleReopenTicket(ticket)}
                className="px-2 py-1 rounded bg-blue-500 text-white"
              >
                Reabrir Chamado
              </button>
              <button
                onClick={() => handleEvaluateTicket(ticket)}
                className="px-2 py-1 rounded bg-green-500 text-white"
              >
                Avaliar Chamado
              </button>
            </div>
          )}
        </div>
      ))}
    </div>
  );
};

export default TicketList;
