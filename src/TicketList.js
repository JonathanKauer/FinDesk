// src/TicketList.jsx
import React, { useState, useEffect } from 'react';
import { collection, query, where, orderBy, onSnapshot, doc, updateDoc } from 'firebase/firestore';
import { db } from './firebase-config.js';

const TicketList = ({ currentUser, activeTab, onSendEmail }) => {
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editingTicketId, setEditingTicketId] = useState(null);
  const [editedTicket, setEditedTicket] = useState({});
  const [newAttachments, setNewAttachments] = useState([]); // novos anexos

  // Supondo que as opções de prioridade estejam fixas e sejam as mesmas do App.js
  const priorityOptions = [
    "Baixa (7 dias úteis)",
    "Média (5 dias úteis)",
    "Alta (2 dias úteis)",
    "Urgente (1 dia útil)"
  ];

  useEffect(() => {
    if (!currentUser) return;
    // Consulta para exibir somente os tickets do usuário
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
      console.error("Erro ao buscar tickets (usuário):", err);
      setLoading(false);
    });
    return () => unsubscribe();
  }, [currentUser, activeTab]);

  // Inicia o modo de edição e preenche os dados editáveis
  const handleEditClick = (ticket) => {
    setEditingTicketId(ticket.id);
    setEditedTicket({
      descricaoProblema: ticket.descricaoProblema,
      prioridade: ticket.prioridade,
      // Armazenamos os anexos atuais para referência (somente para exibição)
      attachments: ticket.attachments || [],
      // Categoria e Cargo/Departamento serão exibidos como info, não editáveis
      categoria: ticket.categoria,
      cargoDepartamento: ticket.cargoDepartamento
    });
    setNewAttachments([]); // limpa novos anexos
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

  // Salva as alterações: atualiza descrição, prioridade e anexa os novos arquivos
  const handleSaveEdit = async (ticket) => {
    try {
      const ticketRef = doc(db, 'tickets', ticket.id);
      // Combine os anexos originais com os novos (se houver)
      const updatedAttachments = ticket.attachments
        ? [...ticket.attachments, ...newAttachments]
        : newAttachments;
      // Monta o objeto de atualização (Categoria e Cargo/Departamento não podem ser alterados)
      const updateData = {
        descricaoProblema: editedTicket.descricaoProblema,
        prioridade: editedTicket.prioridade,
        attachments: updatedAttachments
      };
      await updateDoc(ticketRef, updateData);
      setEditingTicketId(null);
      setEditedTicket({});
      setNewAttachments([]);
      // Opcional: Enviar notificação de atualização via e-mail
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
          <p><strong>ID:</strong> {ticket.id}</p>
          <p><strong>Categoria:</strong> {ticket.categoria}</p>
          <p><strong>Cargo/Departamento:</strong> {ticket.cargoDepartamento}</p>
          <p><strong>Prioridade:</strong> {ticket.prioridade}</p>
          <p><strong>Status:</strong> {ticket.status}</p>
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
              <p className="mt-2"><strong>Categoria:</strong> {editedTicket.categoria}</p>
              <p className="mt-1"><strong>Cargo/Departamento:</strong> {editedTicket.cargoDepartamento}</p>
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
              {/* Exibir anexos originais se houver */}
              {ticket.attachments && ticket.attachments.length > 0 && (
                <div>
                  <strong>Anexos:</strong>
                  <ul>
                    {ticket.attachments.map((file, idx) => (
                      <li key={idx}>{file.name || `Anexo ${idx + 1}`}</li>
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
