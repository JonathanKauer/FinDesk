// src/TicketList.jsx
import React, { useState, useEffect } from 'react';
import {
  collection,
  query,
  where,
  orderBy,
  onSnapshot,
  doc,
  updateDoc
} from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { db, storage } from './firebase-config.js';

const TicketList = ({ currentUser, activeTab, onSendEmail, calculateSLA }) => {
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);

  // Estados para edição do usuário comum
  const [editTicketId, setEditTicketId] = useState(null);
  const [editDescricao, setEditDescricao] = useState("");
  const [editPrioridade, setEditPrioridade] = useState("");
  const [editComentario, setEditComentario] = useState("");
  const [editFiles, setEditFiles] = useState([]);

  useEffect(() => {
    if (!currentUser) return;
    // Busca os tickets do usuário
    const q = query(
      collection(db, 'tickets'),
      where('userId', '==', currentUser.uid),
      orderBy('dataDeAberturaISO', 'desc')
    );
    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const all = snapshot.docs.map((docSnap) => ({
          id: docSnap.id,
          ...docSnap.data()
        }));
        // Filtra pela aba (aberto/concluído)
        const filtered =
          activeTab === 'open'
            ? all.filter((ticket) => ticket.status !== 'Concluído')
            : all.filter((ticket) => ticket.status === 'Concluído');
        setTickets(filtered);
        setLoading(false);
      },
      (err) => {
        console.error('Erro ao buscar tickets (usuário):', err);
        setLoading(false);
      }
    );
    return () => unsubscribe();
  }, [currentUser, activeTab]);

  // Reabrir ticket (exemplo já existente)
  const handleReopenTicket = async (ticket) => {
    try {
      const ticketRef = doc(db, 'tickets', ticket.id);
      await updateDoc(ticketRef, {
        status: 'Aberto',
        dataResolucao: '',
        sla: ''
      });
      if (onSendEmail) onSendEmail(ticket, 'Chamado reaberto');
    } catch (error) {
      console.error('Erro ao reabrir ticket:', error);
      alert('Falha ao reabrir o ticket.');
    }
  };

  // Avaliar ticket (exemplo já existente)
  const handleEvaluateTicket = (ticket) => {
    const rating = prompt('Avalie o chamado (de 1 a 5):');
    if (rating) {
      alert(`Você avaliou o ticket ${ticket.id} com nota ${rating}.`);
      // Aqui, você pode implementar a atualização do ticket com a avaliação, se desejar.
    }
  };

  // Iniciar edição (carrega dados no formulário)
  const startEditTicket = (ticket) => {
    setEditTicketId(ticket.id);
    setEditDescricao(ticket.descricaoProblema || "");
    setEditPrioridade(ticket.prioridade || "");
    setEditComentario("");
    setEditFiles([]);
  };

  // Cancelar edição
  const cancelEditTicket = () => {
    setEditTicketId(null);
    setEditDescricao("");
    setEditPrioridade("");
    setEditComentario("");
    setEditFiles([]);
  };

  // Salvar edição do ticket
  const saveEditTicket = async (ticket) => {
    // Upload de novos anexos
    let newAttachments = ticket.attachments || [];
    if (editFiles.length > 0) {
      for (const file of editFiles) {
        try {
          const storageRef = ref(storage, `tickets/${ticket.id}/${file.name}`);
          await uploadBytes(storageRef, file);
          const downloadURL = await getDownloadURL(storageRef);
          newAttachments.push({ url: downloadURL, name: file.name });
        } catch (error) {
          console.error('Erro ao fazer upload de arquivo:', error);
        }
      }
    }

    // Comentários
    let newComentarios = ticket.comentarios || [];
    if (editComentario.trim()) {
      newComentarios.push(editComentario);
    }

    const updateData = {
      descricaoProblema: editDescricao,
      prioridade: editPrioridade,
      attachments: newAttachments,
      comentarios: newComentarios
    };

    try {
      await updateDoc(doc(db, 'tickets', ticket.id), updateData);
      if (onSendEmail) onSendEmail({ ...ticket, ...updateData }, 'Chamado editado pelo usuário');
      cancelEditTicket();
    } catch (error) {
      console.error('Erro ao atualizar ticket:', error);
      alert('Falha ao atualizar o ticket.');
    }
  };

  if (loading) return <p>Carregando seus chamados...</p>;
  if (tickets.length === 0) return <p>Nenhum chamado encontrado.</p>;

  return (
    <div>
      <h2 className="text-xl font-bold mb-4">Meus Chamados</h2>
      {tickets.map((ticket) => (
        <div key={ticket.id} className="border rounded p-2 mb-2 bg-white">
          {editTicketId === ticket.id ? (
            // Form de edição do usuário
            <div>
              <p><strong>Status:</strong> {ticket.status}</p>
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

              <label className="block font-semibold mt-2">Adicionar Comentário:</label>
              <textarea
                className="border px-2 py-1 rounded w-full"
                rows={2}
                value={editComentario}
                onChange={(e) => setEditComentario(e.target.value)}
              />

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
            // Visualização comum
            <div>
              <p><strong>Status:</strong> {ticket.status}</p>
              <p><strong>Prioridade:</strong> {ticket.prioridade}</p>
              <p><strong>Data de Abertura:</strong> {ticket.dataDeAbertura}</p>
              {ticket.status === 'Concluído' &&
                ticket.dataDeAberturaISO &&
                ticket.dataResolucaoISO && (
                  <p>
                    <strong>SLA:</strong>{' '}
                    {calculateSLA(ticket.dataDeAberturaISO, ticket.dataResolucaoISO)}
                  </p>
              )}
              <p><strong>Descrição:</strong> {ticket.descricaoProblema}</p>

              {/* Anexos */}
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

              {/* Comentários */}
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

              {ticket.status === 'Concluído' && (
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

              {/* Se o ticket NÃO estiver concluído, pode editar */}
              {ticket.status !== 'Concluído' && (
                <div className="mt-2">
                  <button
                    onClick={() => startEditTicket(ticket)}
                    className="px-2 py-1 bg-green-500 text-white rounded"
                  >
                    Editar Chamado
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      ))}
    </div>
  );
};

export default TicketList;
