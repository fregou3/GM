import React from 'react';
import { Link, useLocation } from 'react-router-dom';

const NavBar = () => {
  const location = useLocation();
  
  return (
    <nav>
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        maxWidth: '1200px',
        margin: '0 auto',
        padding: '0 20px'
      }}>
        <div className="brand-name" style={{ fontSize: '1.5rem' }}>
          <img 
            src="/images/clarins-gm-logo.svg" 
            alt="GM-Tracabilité Logo" 
            style={{ height: '40px', marginRight: '10px', verticalAlign: 'middle' }}
          />
          GM-Tracabilité
        </div>
        <div>
          <Link 
            to="/" 
            className={location.pathname === '/' ? 'active' : ''}
            style={{
              marginRight: '30px',
              textDecoration: 'none'
            }}
          >
            ACCUEIL
          </Link>
          <Link 
            to="/data" 
            className={location.pathname === '/data' ? 'active' : ''}
            style={{
              marginRight: '30px',
              textDecoration: 'none'
            }}
          >
            DONNÉES
          </Link>
          <Link 
            to="/analyse" 
            className={location.pathname === '/analyse' ? 'active' : ''}
            style={{
              textDecoration: 'none'
            }}
          >
            ANALYSE
          </Link>
        </div>
      </div>
    </nav>
  );
};

export default NavBar;
