// FinancasList.js
import React, { useState, useEffect } from 'react';
import { collection, onSnapshot } from 'firebase/firestore';
import { db } from './firebase-config.js';

const FinancasList = () => {
  const [financas, setFinancas] = useState([]);

  useEffect(() => {
    // Referência para a coleção "financas"
    const financasRef = collection(db, 'financas');
    
    // Escuta as mudanças na coleção
    const unsubscribe = onSnapshot(financasRef, (snapshot) => {
      const lista = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setFinancas(lista);
    });

    // Cleanup: remove o listener ao desmontar
    return () => unsubscribe();
  }, []);

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
