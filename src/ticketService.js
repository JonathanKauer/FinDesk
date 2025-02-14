// ticketService.js
import { collection, addDoc, getDocs, query, orderBy, serverTimestamp } from "firebase/firestore";
import { db } from "./firebase"; // Certifique-se de que o caminho esteja correto

// Função para adicionar um novo ticket
export const addTicket = async (ticketData) => {
  try {
    // Adiciona um timestamp para controle
    ticketData.createdAt = serverTimestamp();
    
    // Converte campos que são arrays em strings, se necessário
    if (ticketData.comentarios && Array.isArray(ticketData.comentarios)) {
      ticketData.comentarios = JSON.stringify(ticketData.comentarios);
    }
    if (ticketData.attachments && Array.isArray(ticketData.attachments)) {
      ticketData.attachments = JSON.stringify(ticketData.attachments);
    }

    const docRef = await addDoc(collection(db, "tickets"), ticketData);
    console.log("Ticket adicionado com ID:", docRef.id);
    return docRef.id;
  } catch (error) {
    console.error("Erro ao adicionar ticket:", error);
    throw error;
  }
};

// Função para buscar tickets (ex.: para a área admin)
export const fetchTickets = async () => {
  try {
    const q = query(collection(db, "tickets"), orderBy("createdAt", "desc"));
    const querySnapshot = await getDocs(q);
    const tickets = [];
    querySnapshot.forEach((doc) => {
      let data = doc.data();

      // Se os campos de comentários e attachments estiverem em string, converta de volta para array
      if (data.comentarios) {
        try {
          data.comentarios = JSON.parse(data.comentarios);
        } catch (e) {
          data.comentarios = [];
        }
      }
      if (data.attachments) {
        try {
          data.attachments = JSON.parse(data.attachments);
        } catch (e) {
          data.attachments = [];
        }
      }

      tickets.push({ id: doc.id, ...data });
    });
    return tickets;
  } catch (error) {
    console.error("Erro ao buscar tickets:", error);
    throw error;
  }
};
