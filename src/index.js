import './index.css';
import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';  // Importa as diretivas do Tailwind e quaisquer outros estilos globais
import App from './App.js';

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

