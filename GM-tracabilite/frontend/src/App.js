import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import './App.css';
import './clarins-theme.css';

// Composants
import NavBar from './components/NavBar';
import Home from './pages/Home';
import Data from './pages/Data';
import Analyse from './pages/Analyse';

function App() {
  return (
    <Router>
      <div className="App">
        <NavBar />
        <header className="App-header">
          <h1>Application de Traçabilité GM</h1>
        </header>
        
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/data" element={<Data />} />
          <Route path="/analyse" element={<Analyse />} />
        </Routes>
      </div>
    </Router>
  );
}

export default App;
