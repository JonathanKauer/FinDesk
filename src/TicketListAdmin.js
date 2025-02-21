// src/TicketListAdmin.jsx
import React, { useState, useEffect } from 'react';
import {
  collection,
  query,
  orderBy,
  onSnapshot,
  doc,
  updateDoc,
  deleteDoc
} from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, storage } from './firebase-config.js';
import { StarRating } from './utils.js';

const priorityOptions = [
  "Baixa (7 dias úteis)",
  "Média (5 dias úteis)",
  "Alta (2 dias úteis)",
  "Urgente (1 dia útil)"
];

const TicketListAdmin = ({
  activeTab,
  filterPriority,
  filterCategory,
  filterAtendente,
  onSendEmail,
  calculateSLA,
  currentUser
}) => {
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);

  // Estados para edição do Admin
  const [editTicketId, setEditTicketId] = useState(null);
  const [editDescricao, setEditDescricao] = useState("");
  const [editComentario, setEditComentario] = useState("");
  const [editStatus, setEditStatus] = useState("");
  const [editResponsavel, setEditResponsavel] = useState("");
  const [editPrioridade, setEditPrioridade] = useState("");
  const [editFiles, setEditFiles] = useState([]);

  useEffect(() => {
    const q = query(
      collection(db, 'tickets'),
      orderBy('dataDeAberturaISO', 'desc')
    );
    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        let list = snapshot.docs.map(docSnap => ({
          id: docSnap.id,
          ...docSnap.data()
        }));

        if (filterPriority) {
          list = list.filter(ticket => ticket.prioridade === filterPriority);
        }
        if (filterCategory) {
          list = list.filter(ticket => ticket.categoria === filterCategory);
        }
        if (filterAtendente) {
          list = list.filter(ticket => ticket.responsavel === filterAtendente);
        }
        if (activeTab === 'open') {
          list = list.filter(ticket => ticket.status !== 'Concluído');
        } else {
          list = list.filter(ticket => ticket.status === 'Concluído');
        }
        setTickets(list);
        setLoading(false);
      },
      (err) => {
        console.error("Erro ao buscar tickets (admin):", err);
        setLoading(false);
      }
    );
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

  // Iniciar Edição (Admin)
  const startEditTicket = (ticket) => {
    setEditTicketId(ticket.id);
    setEditDescricao(ticket.descricaoProblema || "");
    setEditPrioridade(ticket.prioridade || "");
    setEditStatus(ticket.status || "");
    setEditResponsavel(ticket.responsavel || "");
    setEditComentario("");
    setEditFiles([]);
  };

  const cancelEditTicket = () => {
    setEditTicketId(null);
    setEditDescricao("");
    setEditPrioridade("");
    setEditStatus("");
    setEditResponsavel("");
    setEditComentario("");
    setEditFiles([]);
  };

  const saveEditTicket = async (ticket) => {
    let newAttachments = ticket.attachments || [];
    if (editFiles.length > 0) {
      for (const file of editFiles) {
        try {
          const storageRef = ref(storage, `tickets/${ticket.id}/${file.name}`);
          await uploadBytes(storageRef, file);
          const downloadURL = await getDownloadURL(storageRef);
          newAttachments.push({ url: downloadURL, name: file.name });
        } catch (error) {
          console.error("Erro ao fazer upload de arquivo:", error);
        }
      }
    }
    let newComentarios = ticket.comentarios || [];
    if (editComentario.trim()) {
      const autor = (currentUser && currentUser.email) || "Admin";
      newComentarios.push({
        autor,
        texto: editComentario,
        createdAt: new Date().toISOString()
      });
    }
    const updateData = {
      descricaoProblema: editDescricao,
      prioridade: editPrioridade,
      status: editStatus,
      responsavel: editResponsavel,
      attachments: newAttachments,
      comentarios: newComentarios
    };
    if (editStatus === "Concluído") {
      const now = new Date();
      updateData.dataResolucaoISO = now.toISOString();
      updateData.dataResolucao = now.toLocaleString();
      if (ticket.dataDeAberturaISO) {
        updateData.sla = calculateSLA(ticket.dataDeAberturaISO, updateData.dataResolucaoISO);
      }
    } else {
      updateData.dataResolucaoISO = "";
      updateData.dataResolucao = "";
      updateData.sla = "";
    }
    try {
      await updateDoc(doc(db, 'tickets', ticket.id), updateData);
      if (onSendEmail) {
        onSendEmail({ ...ticket, ...updateData }, "Ticket atualizado pelo admin");
      }
      cancelEditTicket();
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
      {tickets.map(ticket => {
        const isConcluido = (ticket.status === "Concluído");
        const isEditMode = (editTicketId === ticket.id);

        if (isEditMode) {
          return (
            <div key={ticket.id} className="border rounded p-2 mb-2 bg-white">
              {/* ID não é exibido para o Admin */}
              <label className="block mt-2 font-semibold">Descrição:</label>
              <textarea
                className="border rounded px-2 py-1 w-full"
                rows={3}
                value={editDescricao}
                onChange={(e) => setEditDescricao(e.target.value)}
              />

              <label className="block mt-2 font-semibold">Prioridade:</label>
              <select
                value={editPrioridade}
                onChange={(e) => setEditPrioridade(e.target.value)}
                className="border px-2 py-1 rounded w-full"
              >
                <option value="">Selecione</option>
                {priorityOptions.map((opt, i) => (
                  <option key={i} value={opt}>{opt}</option>
                ))}
              </select>

              <label className="block mt-2 font-semibold">Status:</label>
              <select
                value={editStatus}
                onChange={(e) => setEditStatus(e.target.value)}
                className="border px-2 py-1 rounded w-full"
              >
                <option value="Aberto">Aberto</option>
                <option value="Em Andamento">Em Andamento</option>
                <option value="Concluído">Concluído</option>
              </select>

              <label className="block mt-2 font-semibold">Responsável (Atendente):</label>
              <select
                value={editResponsavel}
                onChange={(e) => setEditResponsavel(e.target.value)}
                className="border px-2 py-1 rounded w-full"
              >
                <option value="">Não definido</option>
                <option value="Jonathan Kauer">Jonathan Kauer</option>
                <option value="Nayla Martins">Nayla Martins</option>
              </select>

              <label className="block mt-2 font-semibold">Adicionar Comentário:</label>
              <textarea
                className="border rounded px-2 py-1 w-full"
                rows={2}
                value={editComentario}
                onChange={(e) => setEditComentario(e.target.value)}
              />

              <label className="block mt-2 font-semibold">Anexar novos arquivos:</label>
              <input
                type="file"
                multiple
                onChange={(e) => setEditFiles(Array.from(e.target.files))}
              />

              <div className="flex gap-2 mt-4">
                <button
                  onClick={() => saveEditTicket(ticket)}
                  className="px-2 py-1 bg-blue-500 text-white rounded"
                >
                  Salvar
                </button>
                <button
                  onClick={cancelEditTicket}
                  className="px-2 py-1 bg-gray-300 rounded"
                >
                  Cancelar
                </button>
              </div>
            </div>
          );
        } else {
          return (
            <div key={ticket.id} className="border rounded p-2 mb-2 bg-white">
              {/* Ordem de exibição para Admin */}
              <p><strong>Solicitante:</strong> {ticket.nomeSolicitante}</p>
              <p><strong>Cargo/Departamento:</strong> {ticket.cargoDepartamento}</p>
              <p><strong>Categoria:</strong> {ticket.categoria}</p>

              <div>
                <strong>Descrição:</strong>
                <div style={{ fontSize: '0.95rem' }}>
                  {ticket.descricaoProblema}
                </div>
              </div>

              <p><strong>Data de Abertura:</strong> {ticket.dataDeAbertura}</p>
              <p><strong>Prioridade:</strong> {ticket.prioridade}</p>
              <p><strong>Responsável (Atendente):</strong> {ticket.responsavel || "Não definido"}</p>
              <p><strong>Status:</strong> {ticket.status}</p>

              {ticket.comentarios && ticket.comentarios.length > 0 && (
                <div>
                  <strong>Comentários:</strong>
                  <ul style={{ fontSize: '0.9rem' }}>
                    {ticket.comentarios.map((com, idx) => (
                      <li key={idx} className="ml-4 list-disc">
                        <strong>{com.autor}:</strong> {com.texto}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {ticket.attachments && ticket.attachments.length > 0 && (
                <div>
                  <strong>Anexos:</strong>
                  <ul>
                    {ticket.attachments.map((att, i) => (
                      <li key={i}>
                        <a
                          href={att.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          style={{
                            color: 'blue',
                            textDecoration: 'underline',
                            fontSize: '0.85rem'
                          }}
                        >
                          {att.name}
                        </a>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {ticket.dataResolucao && (
                <p><strong>Data de Encerramento:</strong> {ticket.dataResolucao}</p>
              )}
              {ticket.sla && (
                <p><strong>SLA:</strong> {ticket.sla}</p>
              )}
              {ticket.avaliacao && (
                <div>
                  <strong>Avaliação do Usuário:</strong>
                  <StarRating rating={ticket.avaliacao} setRating={() => {}} readOnly={true} />
                </div>
              )}

              <div className="flex gap-2 mt-2">
                {!ticket.status.includes("Concluído") ? (
                  <button
                    onClick={() => startEditTicket(ticket)}
                    className="px-2 py-1 bg-green-500 text-white rounded"
                  >
                    Editar
                  </button>
                ) : null}
                <button
                  onClick={() => handleDeleteTicket(ticket.id)}
                  className="px-2 py-1 bg-red-500 text-white rounded"
                >
                  Excluir
                </button>
              </div>
            </div>
          );
        }
      })}
    </div>
  );
};

export default TicketListAdmin;
