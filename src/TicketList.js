// src/TicketList.js
import React, { useState, useEffect } from 'react';
import { collection, onSnapshot, query, orderBy } from 'firebase/firestore';
import { db } from './firebase-config.js';

const TicketList = () => {
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    // Referência para a coleção "tickets" e ordena por dataDeAberturaISO (descendente)
    const ticketsRef = collection(db, 'tickets');
    const q = query(ticketsRef, orderBy('dataDeAberturaISO', 'desc'));
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const ticketList = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setTickets(ticketList);
      setLoading(false);
    }, (err) => {
      console.error("Erro ao buscar tickets:", err);
      setError("Erro ao buscar tickets");
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  if (loading) {
    return <p>Carregando tickets...</p>;
  }

  if (error) {
    return <p>{error}</p>;
  }

  if (tickets.length === 0) {
    return <p>Nenhum ticket encontrado.</p>;
  }

  return (
    <div>
      <h2>Tickets Centralizados</h2>
      <ul>
        {tickets.map(ticket => (
          <li key={ticket.id} style={{ marginBottom: '1rem', padding: '0.5rem', border: '1px solid #ccc', borderRadius: '4px' }}>
            <p><strong>ID:</strong> {ticket.id}</p>
            <p><strong>Solicitante:</strong> {ticket.nomeSolicitante}</p>
            <p><strong>Status:</strong> {ticket.status}</p>
            <p><strong>Data de Abertura:</strong> {ticket.dataDeAbertura}</p>
            {/* Adicione outros campos conforme necessário */}
          </li>
        ))}
      </ul>
    </div>
  );
};

export default TicketList;
