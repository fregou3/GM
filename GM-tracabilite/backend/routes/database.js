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

// Route pour mettre à jour une ligne dans une table
router.put('/tables/:tableName/row', async (req, res) => {
  const { tableName } = req.params;
  const { primaryKey, primaryKeyValue, data } = req.body;
  
  console.log('==== MISE À JOUR DE LIGNE ====');
  console.log('Table:', tableName);
  console.log('Clé primaire:', primaryKey);
  console.log('Valeur de la clé primaire:', primaryKeyValue);
  console.log('Données à mettre à jour:', data);
  
  // Vérifier que le nom de la table ne contient que des caractères alphanumériques et des underscores
  if (!/^[a-zA-Z0-9_]+$/.test(tableName)) {
    console.log('Erreur: Nom de table invalide');
    return res.status(400).json({ error: 'Nom de table invalide' });
  }
  
  // Vérifier que les données requises sont présentes
  if (!primaryKey || primaryKeyValue === undefined || !data) {
    console.log('Erreur: Données manquantes');
    return res.status(400).json({ error: 'Données manquantes: primaryKey, primaryKeyValue et data sont requis' });
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
      console.log(`Erreur: La table "${tableName}" n'existe pas`);
      return res.status(404).json({ error: `La table "${tableName}" n'existe pas` });
    }
    
    // Construire la requête de mise à jour dynamiquement
    const columns = Object.keys(data);
    const values = Object.values(data);
    
    console.log('Colonnes à mettre à jour:', columns);
    console.log('Valeurs à mettre à jour:', values);
    
    // Créer les parties SET de la requête
    const setParts = columns.map((col, index) => `"${col}" = $${index + 1}`);
    
    // Construire la requête complète
    const updateQuery = `
      UPDATE ${tableName}
      SET ${setParts.join(', ')}
      WHERE "${primaryKey}" = $${columns.length + 1}
      RETURNING *;
    `;
    
    console.log('Requête SQL:', updateQuery);
    console.log('Paramètres:', [...values, primaryKeyValue]);
    
    // Exécuter la requête avec les valeurs et la valeur de la clé primaire
    const result = await pool.query(updateQuery, [...values, primaryKeyValue]);
    
    console.log('Résultat de la mise à jour:', result.rows);
    
    if (result.rows.length === 0) {
      console.log(`Erreur: Aucune ligne trouvée avec ${primaryKey} = ${primaryKeyValue}`);
      return res.status(404).json({ error: `Aucune ligne trouvée avec ${primaryKey} = ${primaryKeyValue}` });
    }
    
    console.log('Mise à jour réussie!');
    res.json({ 
      message: 'Ligne mise à jour avec succès',
      row: result.rows[0]
    });
  } catch (error) {
    console.error(`[/api/database/tables/${tableName}/row] Erreur lors de la mise à jour de la ligne:`, error);
    res.status(500).json({ error: 'Erreur lors de la mise à jour de la ligne: ' + error.message });
  }
});

// Route pour ajouter une nouvelle ligne dans une table
router.post('/tables/:tableName/row', async (req, res) => {
  const { tableName } = req.params;
  const { data } = req.body;
  
  // Vérifier que le nom de la table ne contient que des caractères alphanumériques et des underscores
  if (!/^[a-zA-Z0-9_]+$/.test(tableName)) {
    return res.status(400).json({ error: 'Nom de table invalide' });
  }
  
  // Vérifier que les données sont présentes
  if (!data || Object.keys(data).length === 0) {
    return res.status(400).json({ error: 'Aucune donnée fournie pour l\'insertion' });
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
    
    // Construire la requête d'insertion dynamiquement
    const columns = Object.keys(data);
    const values = Object.values(data);
    const placeholders = columns.map((_, index) => `$${index + 1}`).join(', ');
    
    // Construire la requête complète
    const insertQuery = `
      INSERT INTO ${tableName} ("${columns.join('", "')}")
      VALUES (${placeholders})
      RETURNING *;
    `;
    
    // Exécuter la requête avec les valeurs
    const result = await pool.query(insertQuery, values);
    
    res.status(201).json({ 
      message: 'Ligne ajoutée avec succès',
      row: result.rows[0]
    });
  } catch (error) {
    console.error(`[/api/database/tables/${tableName}/row] Erreur lors de l'ajout d'une ligne:`, error);
    res.status(500).json({ error: 'Erreur lors de l\'ajout d\'une ligne: ' + error.message });
  }
});

// Route pour supprimer une ligne dans une table
router.delete('/tables/:tableName/row', async (req, res) => {
  const { tableName } = req.params;
  const { primaryKey, primaryKeyValue } = req.body;
  
  // Vérifier que le nom de la table ne contient que des caractères alphanumériques et des underscores
  if (!/^[a-zA-Z0-9_]+$/.test(tableName)) {
    return res.status(400).json({ error: 'Nom de table invalide' });
  }
  
  // Vérifier que les données requises sont présentes
  if (!primaryKey || primaryKeyValue === undefined) {
    return res.status(400).json({ error: 'Données manquantes: primaryKey et primaryKeyValue sont requis' });
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
    
    // Construire la requête de suppression
    const deleteQuery = `
      DELETE FROM ${tableName}
      WHERE "${primaryKey}" = $1
      RETURNING *;
    `;
    
    // Exécuter la requête avec la valeur de la clé primaire
    const result = await pool.query(deleteQuery, [primaryKeyValue]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: `Aucune ligne trouvée avec ${primaryKey} = ${primaryKeyValue}` });
    }
    
    res.json({ 
      message: 'Ligne supprimée avec succès',
      row: result.rows[0]
    });
  } catch (error) {
    console.error(`[/api/database/tables/${tableName}/row] Erreur lors de la suppression d'une ligne:`, error);
    res.status(500).json({ error: 'Erreur lors de la suppression d\'une ligne: ' + error.message });
  }
});

module.exports = router;
