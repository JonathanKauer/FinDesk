// src/utils.js
import React from 'react';

// (1) Função para retornar o nome do autor do comentário
export function getDisplayNameForComment(ticket, currentUser) {
  if (!currentUser) return "Desconhecido";

  if (currentUser.isAdmin) {
    // Mapeamento do e-mail do admin para o nome
    const emailLower = (currentUser.email || "").toLowerCase();
    if (emailLower === "jonathan.kauer@guiainvest.com.br") {
      return "Jonathan Kauer";
    } else if (emailLower === "nayla.martins@guiainvest.com.br") {
      return "Nayla Martins";
    } else {
      return "Admin";
    }
  } else {
    // Usuário comum -> utiliza nomeSolicitante do ticket
    return ticket.nomeSolicitante || "Usuário";
  }
}

// (2) Componente simples de Rating (5 estrelas)
export function StarRating({ rating, setRating, readOnly }) {
  const handleStarClick = (value) => {
    if (!readOnly && setRating) {
      setRating(value);
    }
  };

  return (
    <div style={{ display: "inline-block" }}>
      {[1,2,3,4,5].map((star) => (
        <span
          key={star}
          onClick={() => handleStarClick(star)}
          style={{
            cursor: readOnly ? "default" : "pointer",
            color: star <= rating ? "#ffc107" : "#ccc",
            fontSize: "1.5rem",
            marginRight: "4px"
          }}
        >
          ★
        </span>
      ))}
    </div>
  );
}
