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
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { db, storage } from './firebase-config.js';

const TicketListAdmin = ({
  activeTab,
  filterPriority,
  filterCategory,
  filterAtendente,
  onSendEmail,
  calculateSLA
}) => {
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);

  // Estado para controle de edição
  const [editTicketId, setEditTicketId] = useState(null);
  const [editStatus, setEditStatus] = useState("");
  const [editResponsavel, setEditResponsavel] = useState("");
  const [editDescricao, setEditDescricao] = useState("");
  const [editPrioridade, setEditPrioridade] = useState("");
  const [editComentario, setEditComentario] = useState("");
  const [editFiles, setEditFiles] = useState([]);

  useEffect(() => {
    // Carrega todos os tickets em ordem descendente de data
    const q = query(
      collection(db, 'tickets'),
      orderBy('dataDeAberturaISO', 'desc')
    );
    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        let list = snapshot.docs.map((docSnap) => ({
          id: docSnap.id,
          ...docSnap.data()
        }));

        // Filtros
        if (filterPriority) {
          list = list.filter((ticket) => ticket.prioridade === filterPriority);
        }
        if (filterCategory) {
          list = list.filter((ticket) => ticket.categoria === filterCategory);
        }
        if (filterAtendente) {
          list = list.filter((ticket) => ticket.responsavel === filterAtendente);
        }

        // Filtro por status (aba "open" vs "closed")
        if (activeTab === 'open') {
          list = list.filter((ticket) => ticket.status !== 'Concluído');
        } else {
          list = list.filter((ticket) => ticket.status === 'Concluído');
        }

        setTickets(list);
        setLoading(false);
      },
      (err) => {
        console.error('Erro ao buscar tickets (admin):', err);
        setLoading(false);
      }
    );
    return () => unsubscribe();
  }, [activeTab, filterPriority, filterCategory, filterAtendente]);

  // Excluir ticket
  const handleDeleteTicket = async (ticketId) => {
    try {
      await deleteDoc(doc(db, 'tickets', ticketId));
      console.log('Ticket deletado:', ticketId);
    } catch (error) {
      console.error('Erro ao deletar ticket:', error);
      alert('Falha ao deletar ticket.');
    }
  };

  // Preparar edição (carrega dados do ticket no form)
  const startEditTicket = (ticket) => {
    setEditTicketId(ticket.id);
    setEditStatus(ticket.status || "");
    setEditResponsavel(ticket.responsavel || "");
    setEditDescricao(ticket.descricaoProblema || "");
    setEditPrioridade(ticket.prioridade || "");
    setEditComentario("");
    setEditFiles([]);
  };

  // Cancelar edição
  const cancelEditTicket = () => {
    setEditTicketId(null);
    setEditStatus("");
    setEditResponsavel("");
    setEditDescricao("");
    setEditPrioridade("");
    setEditComentario("");
    setEditFiles([]);
  };

  // Salvar edição
  const saveEditTicket = async (ticket) => {
    // Subir arquivos novos, caso haja
    let newAttachments = ticket.attachments || [];
    if (editFiles.length > 0) {
      for (const file of editFiles) {
        try {
          // Sobe no Storage, usando a pasta: tickets/<ticketId>/<fileName>
          const storageRef = ref(storage, `tickets/${ticket.id}/${file.name}`);
          await uploadBytes(storageRef, file);
          const downloadURL = await getDownloadURL(storageRef);
          newAttachments.push({ url: downloadURL, name: file.name });
        } catch (error) {
          console.error('Erro ao fazer upload de arquivo:', error);
        }
      }
    }

    // Adicionar comentário, se houver
    let newComentarios = ticket.comentarios || [];
    if (editComentario.trim()) {
      newComentarios.push(editComentario);
    }

    // Monta objeto de atualização
    const updateData = {
      status: editStatus,
      responsavel: editResponsavel,
      descricaoProblema: editDescricao,
      prioridade: editPrioridade,
      attachments: newAttachments,
      comentarios: newComentarios
    };

    try {
      await updateDoc(doc(db, 'tickets', ticket.id), updateData);
      console.log('Ticket atualizado:', ticket.id);

      // Dispara e-mail de notificação
      if (onSendEmail) onSendEmail({ ...ticket, ...updateData }, 'Ticket atualizado pelo admin');

      // Fecha a edição
      cancelEditTicket();
    } catch (error) {
      console.error('Erro ao atualizar ticket:', error);
      alert('Falha ao atualizar ticket.');
    }
  };

  if (loading) return <p>Carregando tickets...</p>;
  if (tickets.length === 0) return <p>Nenhum ticket encontrado.</p>;

  return (
    <div>
      <h2 className="text-xl font-bold mb-4">Tickets Administrativos</h2>
      {tickets.map((ticket) => (
        <div key={ticket.id} className="border rounded p-2 mb-2 bg-white">
          {editTicketId === ticket.id ? (
            // Formulário de edição
            <div>
              <p><strong>ID:</strong> {ticket.id}</p>

              <label className="block font-semibold mt-2">Status:</label>
              <select
                value={editStatus}
                onChange={(e) => setEditStatus(e.target.value)}
                className="border px-2 py-1 rounded w-full"
              >
                <option value="Aberto">Aberto</option>
                <option value="Em Andamento">Em Andamento</option>
                <option value="Concluído">Concluído</option>
              </select>

              <label className="block font-semibold mt-2">Nome do Atendente:</label>
              <select
                value={editResponsavel}
                onChange={(e) => setEditResponsavel(e.target.value)}
                className="border px-2 py-1 rounded w-full"
              >
                <option value="">Selecione</option>
                <option value="Jonathan Kauer">Jonathan Kauer</option>
                <option value="Nayla Martins">Nayla Martins</option>
              </select>

              <label className="block font-semibold mt-2">Prioridade:</label>
              <input
                type="text"
                className="border px-2 py-1 rounded w-full"
                value={editPrioridade}
                onChange={(e) => setEditPrioridade(e.target.value)}
              />

              <label className="block font-semibold mt-2">Descrição do Problema:</label>
              <textarea
                className="border px-2 py-1 rounded w-full"
                rows={3}
                value={editDescricao}
                onChange={(e) => setEditDescricao(e.target.value)}
              />

              {/* Comentário adicional */}
              <label className="block font-semibold mt-2">Adicionar Comentário:</label>
              <textarea
                className="border px-2 py-1 rounded w-full"
                rows={2}
                value={editComentario}
                onChange={(e) => setEditComentario(e.target.value)}
              />

              {/* Adicionar anexos */}
              <label className="block font-semibold mt-2">Anexar novos arquivos:</label>
              <input
                type="file"
                multiple
                onChange={(e) => setEditFiles(Array.from(e.target.files))}
                className="mt-1"
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
          ) : (
            // Visualização normal
            <div>
              <p><strong>ID:</strong> {ticket.id}</p>
              <p><strong>Solicitante:</strong> {ticket.nomeSolicitante}</p>
              <p><strong>Status:</strong> {ticket.status}</p>
              <p><strong>Responsável (Atendente):</strong> {ticket.responsavel || "Não definido"}</p>
              <p><strong>Prioridade:</strong> {ticket.prioridade}</p>
              <p><strong>Data de Abertura:</strong> {ticket.dataDeAbertura}</p>
              {ticket.status === "Concluído" && ticket.dataDeAberturaISO && ticket.dataResolucaoISO && (
                <p><strong>SLA:</strong> {calculateSLA(ticket.dataDeAberturaISO, ticket.dataResolucaoISO)}</p>
              )}
              <p><strong>Descrição:</strong> {ticket.descricaoProblema}</p>
              <p><strong>Categoria:</strong> {ticket.categoria}</p>
              <p><strong>Cargo/Departamento:</strong> {ticket.cargoDepartamento}</p>

              {/* Exibição dos anexos */}
              {ticket.attachments && ticket.attachments.length > 0 && (
                <div>
                  <strong>Anexos:</strong>
                  <ul>
                    {ticket.attachments.map((att, idx) => (
                      <li key={idx}>
                        <a href={att.url} target="_blank" rel="noopener noreferrer">
                          {att.name}
                        </a>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Exibição de comentários */}
              {ticket.comentarios && ticket.comentarios.length > 0 && (
                <div>
                  <strong>Comentários:</strong>
                  <ul>
                    {ticket.comentarios.map((com, i) => (
                      <li key={i} className="ml-4 list-disc">{com}</li>
                    ))}
                  </ul>
                </div>
              )}

              <div className="flex gap-2 mt-2">
                <button
                  onClick={() => startEditTicket(ticket)}
                  className="px-2 py-1 bg-green-500 text-white rounded"
                >
                  Editar
                </button>
                <button
                  onClick={() => handleDeleteTicket(ticket.id)}
                  className="px-2 py-1 bg-red-500 text-white rounded"
                >
                  Excluir
                </button>
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  );
};

export default TicketListAdmin;
