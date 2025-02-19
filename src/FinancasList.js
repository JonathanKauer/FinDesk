// FinancasList.jsx
import React, { useState, useEffect } from 'react';
import { collection, onSnapshot } from 'firebase/firestore';
import { db } from './firebase-config.js';

// FinancasList.jsx
import React, { useState, useEffect } from 'react';
import { collection, onSnapshot } from 'firebase/firestore';
import { db } from './firebase-config.js';

const FinancasList = () => {
  const [financas, setFinancas] = useState([]); // Guarda os dados do Firestore

  useEffect(() => {
    // Referência para a coleção "financas"
    const financasRef = collection(db, 'financas');
    
    // Escuta as mudanças na coleção
    const unsubscribe = onSnapshot(financasRef, (snapshot) => {
      // Para cada documento, cria um objeto com o id e os dados
      const lista = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      // Atualiza o estado com os dados buscados
      setFinancas(lista);
    });

    // Quando o componente for desmontado, para de escutar
    return () => unsubscribe();
  }, []); // Executa uma única vez ao montar o componente

  // Renderiza os dados na tela
  return (
    <div>
      <h2>Lista de Finanças</h2>
      {financas.length === 0 ? (
        <p>Nenhuma informação encontrada.</p>
      ) : (
        <ul>
          {financas.map(item => (
            <li key={item.id}>
              {item.nome} - Saldo: {item.saldo}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

export default FinancasList;
