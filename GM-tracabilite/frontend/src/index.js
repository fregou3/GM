import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css'; // Vous pouvez créer ce fichier pour les styles globaux
import App from './App';

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
