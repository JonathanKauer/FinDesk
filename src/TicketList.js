// src/TicketList.jsx
import React, { useState, useEffect } from 'react';
import { collection, query, where, orderBy, onSnapshot } from 'firebase/firestore';
import { db } from './firebase-config.js';

const TicketList = ({ currentUser, activeTab, onSendEmail }) => {
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!currentUser) return;
    // Filtra pelos tickets criados pelo usuário usando o UID
    let q = query(
      collection(db, 'tickets'),
      where('userId', '==', currentUser.uid),
      orderBy('dataDeAberturaISO', 'desc')
    );
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const all = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      // Filtra aberto/concluído
      let filtered = [];
      if (activeTab === "open") {
        filtered = all.filter(t => t.status !== "Concluído");
      } else {
        filtered = all.filter(t => t.status === "Concluído");
      }
      setTickets(filtered);
      setLoading(false);
    }, (err) => {
      console.log("Erro ao buscar tickets (usuário):", err);
      setLoading(false);
    });
    return () => unsubscribe();
  }, [currentUser, activeTab]);

  if (loading) return <p>Carregando seus chamados...</p>;
  if (tickets.length === 0) return <p>Nenhum chamado encontrado.</p>;

  return (
    <div>
      <h2 className="text-xl font-bold mb-4">Meus Chamados</h2>
      {tickets.map(ticket => (
        <div key={ticket.id} className="border rounded p-2 mb-2 bg-white">
          <p><strong>ID:</strong> {ticket.id}</p>
          <p><strong>Categoria:</strong> {ticket.categoria}</p>
          <p><strong>Prioridade:</strong> {ticket.prioridade}</p>
          <p><strong>Status:</strong> {ticket.status}</p>
          <p><strong>Data de Abertura:</strong> {ticket.dataDeAbertura}</p>
          {/* Você pode expandir detalhes se quiser */}
        </div>
      ))}
    </div>
  );
};

export default TicketList;
