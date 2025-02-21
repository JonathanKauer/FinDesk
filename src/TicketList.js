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

// ReactQuill
import ReactQuill from 'react-quill';
import 'react-quill/dist/quill.snow.css';

import { StarRating } from './utils.js';

const priorityOptions = [
  "Baixa (7 dias úteis)",
  "Média (5 dias úteis)",
  "Alta (2 dias úteis)",
  "Urgente (1 dia útil)"
];

const TicketList = ({ currentUser, activeTab, onSendEmail, calculateSLA }) => {
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);

  // Edição do ticket
  const [editTicketId, setEditTicketId] = useState(null);

  // Rich text para descrição
  const [editDescricaoHTML, setEditDescricaoHTML] = useState("");
  // Rich text para comentário
  const [editComentarioHTML, setEditComentarioHTML] = useState("");

  const [editPrioridade, setEditPrioridade] = useState("");
  const [editFiles, setEditFiles] = useState([]);

  // Avaliação
  const [showEvaluation, setShowEvaluation] = useState(false);
  const [ratingValue, setRatingValue] = useState(0);
  const [ticketToEvaluate, setTicketToEvaluate] = useState(null);

  useEffect(() => {
    if (!currentUser) return;
    const q = query(
      collection(db, 'tickets'),
      where('userId', '==', currentUser.uid),
      orderBy('dataDeAberturaISO', 'desc')
    );
    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const all = snapshot.docs.map(docSnap => ({
          id: docSnap.id,
          ...docSnap.data()
        }));
        // Filtro de status (open vs closed)
        const filtered = (activeTab === 'open')
          ? all.filter(tk => tk.status !== 'Concluído')
          : all.filter(tk => tk.status === 'Concluído');
        setTickets(filtered);
        setLoading(false);
      },
      (err) => {
        console.error("Erro ao buscar tickets (usuário):", err);
        setLoading(false);
      }
    );
    return () => unsubscribe();
  }, [currentUser, activeTab]);

  // Reabrir Chamado (bloqueado se já foi avaliado)
  const handleReopenTicket = async (ticket) => {
    if (ticket.avaliacao) {
      alert("Este chamado já foi avaliado e não pode mais ser reaberto.");
      return;
    }
    const reason = prompt("Descreva o motivo da reabertura:");
    if (!reason || !reason.trim()) {
      alert("É necessário informar o motivo para reabrir o chamado.");
      return;
    }
    let newComentarios = ticket.comentarios || [];
    newComentarios.push({
      autor: ticket.nomeSolicitante || "Usuário",
      // Se quiser formatar esse “reason” também, precisaria de um Quill só pra reabertura.
      texto: `**Reabertura**: ${reason}`,
      createdAt: new Date().toISOString()
    });
    const updateData = {
      status: "Aberto",
      dataResolucao: "",
      dataResolucaoISO: "",
      sla: "",
      comentarios: newComentarios
    };
    try {
      await updateDoc(doc(db, 'tickets', ticket.id), updateData);
      if (onSendEmail) onSendEmail({ ...ticket, ...updateData }, "Chamado reaberto");
    } catch (error) {
      console.error("Erro ao reabrir ticket:", error);
      alert("Falha ao reabrir o ticket.");
    }
  };

  // Avaliar Chamado (Estrelas)
  const handleEvaluateTicket = (ticket) => {
    setTicketToEvaluate(ticket);
    setRatingValue(ticket.avaliacao || 0);
    setShowEvaluation(true);
  };

  const saveEvaluation = async () => {
    if (!ticketToEvaluate) return;
    const updateData = {
      avaliacao: ratingValue
    };
    try {
      await updateDoc(doc(db, 'tickets', ticketToEvaluate.id), updateData);
      if (onSendEmail) {
        onSendEmail({ ...ticketToEvaluate, ...updateData }, "Chamado avaliado pelo usuário");
      }
    } catch (error) {
      console.error("Erro ao avaliar ticket:", error);
      alert("Falha ao avaliar o ticket.");
    }
    setShowEvaluation(false);
    setTicketToEvaluate(null);
    setRatingValue(0);
  };

  // Iniciar Edição
  const startEditTicket = (ticket) => {
    setEditTicketId(ticket.id);
    setEditDescricaoHTML(ticket.descricaoProblema || "");
    setEditPrioridade(ticket.prioridade || "");
    setEditComentarioHTML("");
    setEditFiles([]);
  };

  // Cancelar Edição
  const cancelEditTicket = () => {
    setEditTicketId(null);
    setEditDescricaoHTML("");
    setEditPrioridade("");
    setEditComentarioHTML("");
    setEditFiles([]);
  };

  // Salvar Edição
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
    if (editComentarioHTML.trim()) {
      // Armazenamos o comentário como HTML
      newComentarios.push({
        autor: ticket.nomeSolicitante || "Usuário",
        texto: editComentarioHTML,   // HTML do Quill
        createdAt: new Date().toISOString()
      });
    }

    const updateData = {
      descricaoProblema: editDescricaoHTML, // HTML do Quill
      prioridade: editPrioridade,
      attachments: newAttachments,
      comentarios: newComentarios
    };

    try {
      await updateDoc(doc(db, 'tickets', ticket.id), updateData);
      if (onSendEmail) {
        onSendEmail({ ...ticket, ...updateData }, "Chamado editado pelo usuário");
      }
      cancelEditTicket();
    } catch (error) {
      console.error("Erro ao atualizar ticket:", error);
      alert("Falha ao atualizar o ticket.");
    }
  };

  if (loading) return <p>Carregando seus chamados...</p>;
  if (tickets.length === 0) return <p>Nenhum chamado encontrado.</p>;

  return (
    <div>
      <h2 className="text-xl font-bold mb-4">Meus Chamados</h2>

      {/* Modal de Avaliação */}
      {showEvaluation && ticketToEvaluate && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center">
          <div className="bg-white p-4 rounded">
            <h3 className="font-bold text-lg mb-2">Avaliar Chamado</h3>
            <StarRating rating={ratingValue} setRating={setRatingValue} readOnly={false} />
            <div className="mt-4 flex gap-2 justify-end">
              <button
                onClick={() => {
                  setShowEvaluation(false);
                  setTicketToEvaluate(null);
                  setRatingValue(0);
                }}
                className="px-3 py-1 bg-gray-300 rounded"
              >
                Cancelar
              </button>
              <button
                onClick={saveEvaluation}
                className="px-3 py-1 bg-blue-500 text-white rounded"
              >
                Salvar Avaliação
              </button>
            </div>
          </div>
        </div>
      )}

      {tickets.map(ticket => {
        const isConcluido = (ticket.status === "Concluído");
        const isAvaliado = !!ticket.avaliacao;

        if (editTicketId === ticket.id) {
          // ---------- EDIÇÃO ----------
          return (
            <div key={ticket.id} className="border rounded p-2 mb-2 bg-white">
              <p><strong>Status:</strong> {ticket.status}</p>

              <label className="block font-semibold mt-2">Prioridade:</label>
              <select
                className="border px-2 py-1 rounded w-full"
                value={editPrioridade}
                onChange={(e) => setEditPrioridade(e.target.value)}
              >
                <option value="">Selecione</option>
                {priorityOptions.map((opt, i) => (
                  <option key={i} value={opt}>{opt}</option>
                ))}
              </select>

              <label className="block font-semibold mt-2">Descrição do Problema (Rich Text):</label>
              <ReactQuill
                value={editDescricaoHTML}
                onChange={setEditDescricaoHTML}
                theme="snow"
                style={{ minHeight: "120px", backgroundColor: "#fff" }}
              />

              <label className="block font-semibold mt-2">Adicionar Comentário (Rich Text):</label>
              <ReactQuill
                value={editComentarioHTML}
                onChange={setEditComentarioHTML}
                theme="snow"
                style={{ minHeight: "80px", backgroundColor: "#fff" }}
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
          );
        } else {
          // ---------- VISUALIZAÇÃO ----------
          return (
            <div key={ticket.id} className="border rounded p-2 mb-2 bg-white">
              {/* Ordem de exibição: Descrição, Data de Abertura, Prioridade, Status, Comentários, Anexos */}

              {/* Descrição (HTML) */}
              <div>
                <strong>Descrição:</strong>
                <div
                  style={{ fontSize: "0.95rem" }}
                  dangerouslySetInnerHTML={{ __html: ticket.descricaoProblema }}
                />
              </div>

              <p><strong>Data de Abertura:</strong> {ticket.dataDeAbertura}</p>
              <p><strong>Prioridade:</strong> {ticket.prioridade}</p>
              <p><strong>Status:</strong> {ticket.status}</p>

              {/* Comentários (HTML) */}
              {ticket.comentarios && ticket.comentarios.length > 0 && (
                <div>
                  <strong>Comentários:</strong>
                  <ul style={{ fontSize: '0.9rem' }}>
                    {ticket.comentarios.map((com, idx) => (
                      <li key={idx} className="ml-4 list-disc">
                        <strong>{com.autor}:</strong>{" "}
                        <div
                          style={{ display: "inline-block" }}
                          dangerouslySetInnerHTML={{ __html: com.texto }}
                        />
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Anexos */}
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

              {/* Botões */}
              {isConcluido ? (
                <div className="mt-2 flex gap-2">
                  {/* Se avaliado, não mostra Reabrir */}
                  {!isAvaliado && (
                    <button
                      onClick={() => handleReopenTicket(ticket)}
                      className="px-2 py-1 rounded bg-blue-500 text-white"
                    >
                      Reabrir Chamado
                    </button>
                  )}
                  {ticket.avaliacao ? (
                    <div>
                      <p className="inline-block mr-2">Chamado Avaliado:</p>
                      <StarRating rating={ticket.avaliacao} setRating={()=>{}} readOnly={true} />
                    </div>
                  ) : (
                    <button
                      onClick={() => handleEvaluateTicket(ticket)}
                      className="px-2 py-1 rounded bg-green-500 text-white"
                    >
                      Avaliar Chamado
                    </button>
                  )}
                </div>
              ) : (
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
          );
        }
      })}
    </div>
  );
};

export default TicketList;
