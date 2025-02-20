// src/TicketList.jsx
import React, { useState, useEffect } from 'react';
import { collection, query, where, orderBy, onSnapshot, doc, updateDoc } from 'firebase/firestore';
import { db } from './firebase-config.js';

const TicketList = ({ currentUser, activeTab, onSendEmail }) => {
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editingTicketId, setEditingTicketId] = useState(null);
  const [editedTicket, setEditedTicket] = useState({});

  useEffect(() => {
    if (!currentUser) return;
    // Consulta para mostrar somente os tickets do usuário
    const q = query(
      collection(db, 'tickets'),
      where('userId', '==', currentUser.uid),
      orderBy('dataDeAberturaISO', 'desc')
    );
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const all = snapshot.docs.map(docSnap => ({
        id: docSnap.id,
        ...docSnap.data()
      }));
      // Filtra tickets abertos ou concluídos
      const filtered = activeTab === "open"
        ? all.filter(ticket => ticket.status !== "Concluído")
        : all.filter(ticket => ticket.status === "Concluído");
      setTickets(filtered);
      setLoading(false);
    }, (err) => {
      console.log("Erro ao buscar tickets (usuário):", err);
      setLoading(false);
    });
    return () => unsubscribe();
  }, [currentUser, activeTab]);

  const handleEditClick = (ticket) => {
    setEditingTicketId(ticket.id);
    // Preenche o formulário com os dados atuais do ticket
    setEditedTicket({
      descricaoProblema: ticket.descricaoProblema,
      categoria: ticket.categoria,
      prioridade: ticket.prioridade,
      cargoDepartamento: ticket.cargoDepartamento
      // Você pode adicionar outros campos editáveis aqui
    });
  };

  const handleEditChange = (e) => {
    const { name, value } = e.target;
    setEditedTicket(prev => ({ ...prev, [name]: value }));
  };

  const handleCancelEdit = () => {
    setEditingTicketId(null);
    setEditedTicket({});
  };

  const handleSaveEdit = async (ticketId) => {
    try {
      const ticketRef = doc(db, 'tickets', ticketId);
      // Atualiza os campos editáveis; assegure-se que as regras permitem essa atualização
      await updateDoc(ticketRef, editedTicket);
      setEditingTicketId(null);
      setEditedTicket({});
      // Opcional: notifique via e-mail a atualização
      // onSendEmail(ticket, "Chamado atualizado");
    } catch (error) {
      console.error("Erro ao atualizar ticket:", error);
      alert("Falha ao atualizar o ticket. Verifique o console para detalhes.");
    }
  };

  if (loading) return <p>Carregando seus chamados...</p>;
  if (tickets.length === 0) return <p>Nenhum chamado encontrado.</p>;

  return (
    <div>
      <h2 className="text-xl font-bold mb-4">Meus Chamados</h2>
      {tickets.map(ticket => (
        <div key={ticket.id} className="border rounded p-2 mb-2 bg-white">
          <p><strong>ID:</strong> {ticket.id}</p>
          <p><strong>Cargo/Departamento:</strong> {ticket.cargoDepartamento}</p>
          <p><strong>Categoria:</strong> {ticket.categoria}</p>
          <p><strong>Prioridade:</strong> {ticket.prioridade}</p>
          <p><strong>Status:</strong> {ticket.status}</p>
          <p><strong>Data de Abertura:</strong> {ticket.dataDeAbertura}</p>
          {editingTicketId === ticket.id ? (
            // Formulário de edição
            <div className="mt-2">
              <label className="block font-semibold">Descrição do Problema:</label>
              <textarea
                name="descricaoProblema"
                value={editedTicket.descricaoProblema || ""}
                onChange={handleEditChange}
                className="border rounded px-2 py-1 w-full"
                rows="3"
              />
              <label className="block font-semibold mt-2">Categoria:</label>
              <input
                type="text"
                name="categoria"
                value={editedTicket.categoria || ""}
                onChange={handleEditChange}
                className="border rounded px-2 py-1 w-full"
              />
              <label className="block font-semibold mt-2">Prioridade:</label>
              <input
                type="text"
                name="prioridade"
                value={editedTicket.prioridade || ""}
                onChange={handleEditChange}
                className="border rounded px-2 py-1 w-full"
              />
              <label className="block font-semibold mt-2">Cargo/Departamento:</label>
              <input
                type="text"
                name="cargoDepartamento"
                value={editedTicket.cargoDepartamento || ""}
                onChange={handleEditChange}
                className="border rounded px-2 py-1 w-full"
              />
              <div className="flex gap-2 mt-2">
                <button
                  onClick={() => handleSaveEdit(ticket.id)}
                  className="px-3 py-1 rounded shadow"
                  style={{ backgroundColor: "#0E1428", color: "white" }}
                >
                  Salvar
                </button>
                <button
                  onClick={handleCancelEdit}
                  className="px-3 py-1 rounded shadow"
                  style={{ backgroundColor: "#FF5E00", color: "white" }}
                >
                  Cancelar
                </button>
              </div>
            </div>
          ) : (
            <div className="mt-2">
              <p><strong>Descrição do Problema:</strong> {ticket.descricaoProblema}</p>
              {/* Botão para iniciar a edição se o chamado estiver aberto */}
              {ticket.status !== "Concluído" && (
                <button
                  onClick={() => handleEditClick(ticket)}
                  className="mt-2 px-3 py-1 rounded shadow"
                  style={{ backgroundColor: "#0E1428", color: "white" }}
                >
                  Editar
                </button>
              )}
            </div>
          )}
        </div>
      ))}
    </div>
  );
};

export default TicketList;
