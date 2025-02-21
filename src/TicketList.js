// src/TicketList.jsx
import React, { useState, useEffect } from 'react';
import { collection, query, where, orderBy, onSnapshot, doc, updateDoc } from 'firebase/firestore';
import { db } from './firebase-config.js';

const TicketList = ({ currentUser, activeTab, onSendEmail }) => {
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editingTicketId, setEditingTicketId] = useState(null);
  const [editedTicket, setEditedTicket] = useState({});
  const [newAttachments, setNewAttachments] = useState([]);

  // Supondo que as opções de prioridade sejam as mesmas
  const priorityOptions = [
    "Baixa (7 dias úteis)",
    "Média (5 dias úteis)",
    "Alta (2 dias úteis)",
    "Urgente (1 dia útil)"
  ];

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

  const handleEditClick = (ticket) => {
    setEditingTicketId(ticket.id);
    setEditedTicket({
      descricaoProblema: ticket.descricaoProblema,
      prioridade: ticket.prioridade,
      attachments: ticket.attachments || []
    });
    setNewAttachments([]);
  };

  const handleEditChange = (e) => {
    const { name, value } = e.target;
    setEditedTicket(prev => ({ ...prev, [name]: value }));
  };

  const handleNewAttachmentsChange = (e) => {
    setNewAttachments(Array.from(e.target.files));
  };

  const handleCancelEdit = () => {
    setEditingTicketId(null);
    setEditedTicket({});
    setNewAttachments([]);
  };

  const handleSaveEdit = async (ticket) => {
    try {
      const ticketRef = doc(db, 'tickets', ticket.id);
      // Combine anexos originais com novos anexos
      const updatedAttachments = ticket.attachments
        ? [...ticket.attachments, ...newAttachments.map(file => ({ name: file.name, url: file.url || "URL_placeholder" }))]
        : newAttachments.map(file => ({ name: file.name, url: file.url || "URL_placeholder" }));
      // Atualiza apenas os campos editáveis para usuário comum: descrição, prioridade e anexos.
      const updateData = {
        descricaoProblema: editedTicket.descricaoProblema,
        prioridade: editedTicket.prioridade,
        attachments: updatedAttachments
      };
      await updateDoc(ticketRef, updateData);
      setEditingTicketId(null);
      setEditedTicket({});
      setNewAttachments([]);
      if (onSendEmail) {
        onSendEmail({ ...ticket, ...updateData }, "Chamado atualizado");
      }
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
          {/* Visualização resumida: omitindo ID, Categoria e Cargo/Departamento */}
          <p><strong>Status:</strong> {ticket.status}</p>
          <p><strong>Prioridade:</strong> {ticket.prioridade}</p>
          <p><strong>Data de Abertura:</strong> {ticket.dataDeAbertura}</p>
          {editingTicketId === ticket.id ? (
            <div className="mt-2">
              <label className="block font-semibold">Descrição do Problema:</label>
              <textarea
                name="descricaoProblema"
                value={editedTicket.descricaoProblema || ""}
                onChange={handleEditChange}
                className="border rounded px-2 py-1 w-full"
                rows="3"
              />
              <label className="block font-semibold mt-2">Prioridade:</label>
              <select
                name="prioridade"
                value={editedTicket.prioridade || ""}
                onChange={handleEditChange}
                className="border rounded px-2 py-1 w-full"
              >
                {priorityOptions.map((option, idx) => (
                  <option key={idx} value={option}>{option}</option>
                ))}
              </select>
              <label className="block font-semibold mt-2">Adicionar Novos Anexos:</label>
              <input
                type="file"
                multiple
                onChange={handleNewAttachmentsChange}
                className="w-full"
              />
              <div className="flex gap-2 mt-2">
                <button
                  onClick={() => handleSaveEdit(ticket)}
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
              {ticket.attachments && ticket.attachments.length > 0 && (
                <div>
                  <strong>Anexos:</strong>
                  <ul>
                    {ticket.attachments.map((att, idx) => (
                      <li key={idx}>{att.name}</li>
                    ))}
                  </ul>
                </div>
              )}
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
