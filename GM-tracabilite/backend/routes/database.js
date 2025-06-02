const express = require('express');
const router = express.Router();
const { pool } = require('../db');

// Route pour récupérer la liste des tables
router.get('/tables', async (req, res) => {
  try {
    // Requête pour obtenir toutes les tables dans le schéma public
    const query = `
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_type = 'BASE TABLE'
      ORDER BY table_name;
    `;
    
    const result = await pool.query(query);
    
    // Extraire les noms de tables
    const tables = result.rows.map(row => row.table_name);
    
    res.json({ tables });
  } catch (error) {
    console.error('[/api/database/tables] Erreur lors de la récupération des tables:', error);
    res.status(500).json({ error: 'Erreur lors de la récupération des tables: ' + error.message });
  }
});

// Route pour récupérer les données d'une table spécifique
router.get('/tables/:tableName/data', async (req, res) => {
  const { tableName } = req.params;
  
  // Vérifier que le nom de la table ne contient que des caractères alphanumériques et des underscores
  if (!/^[a-zA-Z0-9_]+$/.test(tableName)) {
    return res.status(400).json({ error: 'Nom de table invalide' });
  }
  
  try {
    // Vérifier si la table existe
    const tableExistsQuery = `
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = $1
      );
    `;
    
    const tableExists = await pool.query(tableExistsQuery, [tableName]);
    
    if (!tableExists.rows[0].exists) {
      return res.status(404).json({ error: `La table "${tableName}" n'existe pas` });
    }
    
    // Récupérer les données de la table (limité à 1000 lignes pour éviter les problèmes de performance)
    const dataQuery = `SELECT * FROM ${tableName} LIMIT 1000`;
    const result = await pool.query(dataQuery);
    
    res.json({ rows: result.rows });
  } catch (error) {
    console.error(`[/api/database/tables/${tableName}/data] Erreur lors de la récupération des données:`, error);
    res.status(500).json({ error: 'Erreur lors de la récupération des données: ' + error.message });
  }
});

// Route pour supprimer une table
router.delete('/tables/:tableName', async (req, res) => {
  const { tableName } = req.params;
  
  // Vérifier que le nom de la table ne contient que des caractères alphanumériques et des underscores
  if (!/^[a-zA-Z0-9_]+$/.test(tableName)) {
    return res.status(400).json({ error: 'Nom de table invalide' });
  }
  
  try {
    // Vérifier si la table existe
    const tableExistsQuery = `
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = $1
      );
    `;
    
    const tableExists = await pool.query(tableExistsQuery, [tableName]);
    
    if (!tableExists.rows[0].exists) {
      return res.status(404).json({ error: `La table "${tableName}" n'existe pas` });
    }
    
    // Supprimer la table
    const dropQuery = `DROP TABLE ${tableName}`;
    await pool.query(dropQuery);
    
    res.json({ message: `Table "${tableName}" supprimée avec succès` });
  } catch (error) {
    console.error(`[/api/database/tables/${tableName}] Erreur lors de la suppression de la table:`, error);
    res.status(500).json({ error: 'Erreur lors de la suppression de la table: ' + error.message });
  }
});

module.exports = router;
