// src/utils.js
import React from 'react';

/**
 * Retorna o nome correto do admin com base no e-mail.
 * Se for user comum, retorna o nomeSolicitante do ticket.
 */
export function getDisplayName(ticket, currentUser) {
  if (!currentUser) return "Desconhecido";

  if (currentUser.isAdmin) {
    // Admin
    const email = (currentUser.email || "").toLowerCase();
    if (email === "jonathan.kauer@guiainvest.com.br") {
      return "Jonathan Kauer";
    } else if (email === "nayla.martins@guiainvest.com.br") {
      return "Nayla Martins";
    }
    return "Admin";
  } else {
    // Usuário comum
    return ticket.nomeSolicitante || "Usuário";
  }
}

/**
 * Componente de Rating com até 5 estrelas.
 * - rating: valor atual (1 a 5)
 * - setRating: função para atualizar
 * - readOnly: se true, não permite clicar
 */
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
