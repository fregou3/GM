const { Pool } = require('pg');
require('dotenv').config();

// Configuration de la connexion PostgreSQL
const pool = new Pool({
  user: process.env.PGUSER || 'postgres',
  host: process.env.PGHOST || 'localhost',
  database: process.env.PGDATABASE || 'gm_tracabilite',
  password: process.env.PGPASSWORD || 'postgres',
  port: process.env.PGPORT || 5432,
  // Paramètres avancés pour améliorer la stabilité
  connectionTimeoutMillis: 30000, // 30 secondes de timeout pour la connexion
  idleTimeoutMillis: 30000, // 30 secondes de timeout pour les connexions inactives
  max: 20, // Nombre maximum de clients dans le pool
  statement_timeout: 60000, // 60 secondes de timeout pour les requêtes
});

// Afficher les paramètres de connexion (sans le mot de passe)
console.log('Tentative de connexion à PostgreSQL avec les paramètres suivants:');
console.log('- Host:', process.env.PGHOST || 'localhost');
console.log('- Database:', process.env.PGDATABASE || 'gm_tracabilite');
console.log('- User:', process.env.PGUSER || 'postgres');
console.log('- Port:', process.env.PGPORT || 5432);

// Test de connexion
pool.query('SELECT NOW()', (err, res) => {
  if (err) {
    console.error('Erreur de connexion à PostgreSQL:', err);
    if (err.code === '3D000') {
      console.error("La base de données spécifiée n'existe pas.");
    } else if (err.code === '28P01') {
      console.error("Échec d'authentification. Vérifiez vos identifiants.");
    } else if (err.code === 'ECONNREFUSED') {
      console.error("Connexion refusée. Vérifiez que le serveur PostgreSQL est en cours d'exécution et accessible.");
    }
  } else {
    console.log('Connexion à PostgreSQL établie avec succès:', res.rows[0]);
  }
});

module.exports = { pool };
