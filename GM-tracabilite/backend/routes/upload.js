const express = require('express');
const router = express.Router();
const multer = require('multer');
const Papa = require('papaparse');
const pool = require('../db');
const path = require('path');
const fs = require('fs');

// Configuration de Multer pour le stockage des fichiers uploadés en mémoire
const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

/**
 * Route pour uploader un fichier CSV et l'importer dans une nouvelle table PostgreSQL
 * Le nom de la table sera basé sur le nom du fichier
 */
router.post('/csv-to-table', upload.single('csvfile'), async (req, res) => {
  console.log("[/api/upload/csv-to-table] Requête reçue.");
  
  if (!req.file) {
    console.warn("[/api/upload/csv-to-table] Aucun fichier reçu.");
    return res.status(400).json({ error: 'Aucun fichier n\'a été uploadé.' });
  }

  try {
    // Récupérer le contenu du fichier
    const fileContent = req.file.buffer.toString('utf-8');
    
    // Parser le CSV
    const parsedCsv = Papa.parse(fileContent, {
      header: true,
      skipEmptyLines: true
    });
    
    if (parsedCsv.errors.length > 0) {
      return res.status(400).json({ 
        error: `Erreur lors du parsing du CSV: ${parsedCsv.errors.map(e => e.message).join(", ")}` 
      });
    }
    
    // Vérifier que le CSV contient des données
    if (!parsedCsv.data || parsedCsv.data.length === 0) {
      return res.status(400).json({ error: 'Le fichier CSV ne contient aucune donnée.' });
    }
    
    // Récupérer les en-têtes (noms des colonnes)
    const headers = parsedCsv.meta.fields;
    
    // Créer un nom de table valide à partir du nom du fichier
    let tableName = path.basename(req.file.originalname, path.extname(req.file.originalname))
      .toLowerCase()
      .replace(/[^a-z0-9_]/g, '_') // Remplacer les caractères non alphanumériques par des underscores
      .replace(/^[0-9]/, '_$&'); // Ajouter un underscore si le nom commence par un chiffre
    
    // Récupérer l'option de remplacement
    const replaceExisting = req.body.replaceExisting === 'true';
    console.log(`[/api/upload/csv-to-table] Option de remplacement: ${replaceExisting}`);
    
    // Vérifier si la table existe déjà
    const tableExistsQuery = `
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = $1
      );
    `;
    
    const tableExists = await pool.query(tableExistsQuery, [tableName]);
    
    if (tableExists.rows[0].exists) {
      if (!replaceExisting) {
        return res.status(409).json({ 
          error: `La table "${tableName}" existe déjà. Cochez l'option "Remplacer si la table existe" pour écraser la table existante.` 
        });
      }
      
      // Supprimer la table existante si l'option de remplacement est activée
      console.log(`[/api/upload/csv-to-table] Suppression de la table existante: ${tableName}`);
      await pool.query(`DROP TABLE IF EXISTS ${tableName};`);
    }
    
    // Vérifier si une colonne 'id' existe déjà dans les en-têtes
    const hasIdColumn = headers.some(header => 
      header.toLowerCase().replace(/[^a-z0-9_]/g, '_') === 'id'
    );
    
    // Créer la requête SQL pour créer la table
    let createTableQuery = `CREATE TABLE ${tableName} (`;
    
    // Ajouter un ID auto-incrémenté comme clé primaire uniquement s'il n'existe pas déjà
    if (!hasIdColumn) {
      createTableQuery += 'record_id SERIAL PRIMARY KEY, ';
    }
    
    // Dédoublonner les noms de colonnes
    const uniqueColumns = new Map();
    const columnNames = [];
    
    headers.forEach(header => {
      // Nettoyer le nom de la colonne
      let columnName = header.toLowerCase().replace(/[^a-z0-9_]/g, '_');
      
      // Gérer les colonnes dupliquées en ajoutant un suffixe numérique
      if (uniqueColumns.has(columnName)) {
        const count = uniqueColumns.get(columnName) + 1;
        uniqueColumns.set(columnName, count);
        columnName = `${columnName}_${count}`;
      } else {
        uniqueColumns.set(columnName, 1);
      }
      
      columnNames.push({
        original: header,
        clean: columnName,
        isId: columnName === 'id'
      });
    });
    
    // Ajouter les colonnes à la requête SQL
    columnNames.forEach((column, index) => {
      // Si c'est la colonne id et qu'elle existe déjà, la définir comme clé primaire
      if (column.isId && hasIdColumn) {
        createTableQuery += `${column.clean} SERIAL PRIMARY KEY`;
      } else {
        createTableQuery += `${column.clean} TEXT`;
      }
      
      if (index < columnNames.length - 1) {
        createTableQuery += ', ';
      }
    });
    
    createTableQuery += ');';
    
    // Créer la table
    console.log(`[/api/upload/csv-to-table] Création de la table avec la requête: ${createTableQuery}`);
    try {
      await pool.query(createTableQuery);
      console.log(`[/api/upload/csv-to-table] Table ${tableName} créée avec succès`);
    } catch (error) {
      console.error(`[/api/upload/csv-to-table] Erreur lors de la création de la table:`, error);
      throw new Error(`Erreur lors de la création de la table: ${error.message}`);
    }
    
    // Préparer l'insertion des données
    const data = parsedCsv.data;
    
    // Créer la requête d'insertion avec une transaction pour assurer l'intégrité des données
    console.log(`[/api/upload/csv-to-table] Début de l'insertion des données dans la table ${tableName}`);
    console.log(`[/api/upload/csv-to-table] Nombre de lignes à insérer: ${data.length}`);
    
    // Insérer les données par lots pour éviter les timeouts avec de grands fichiers
    const batchSize = 100; // Nombre de lignes à insérer par lot
    const client = await pool.connect();
    
    try {
      await client.query('BEGIN');
      
      // Utiliser les noms de colonnes dédoublonnés
      const columns = columnNames.map(col => col.clean);
      console.log(`[/api/upload/csv-to-table] Colonnes pour insertion: ${columns.join(', ')}`);
      
      // Insérer les données par lots
      for (let i = 0; i < data.length; i += batchSize) {
        const batch = data.slice(i, i + batchSize);
        console.log(`[/api/upload/csv-to-table] Traitement du lot ${Math.floor(i/batchSize) + 1}/${Math.ceil(data.length/batchSize)} (${batch.length} lignes)`);
        
        // Insérer chaque ligne du lot
        for (const row of batch) {
          try {
            const values = headers.map(header => {
              // Gérer les valeurs nulles, undefined ou vides
              const value = row[header];
              return value === undefined || value === '' ? null : value;
            });
            
            const insertQuery = {
              text: `INSERT INTO ${tableName} (${columns.join(', ')}) VALUES (${columns.map((_, i) => `$${i + 1}`).join(', ')})`,
              values: values
            };
            
            await client.query(insertQuery);
          } catch (rowError) {
            console.error(`[/api/upload/csv-to-table] Erreur lors de l'insertion d'une ligne:`, rowError);
            // Continuer avec la ligne suivante plutôt que d'arrêter tout le processus
          }
        }
      }
      
      await client.query('COMMIT');
      console.log(`[/api/upload/csv-to-table] Import réussi: ${data.length} lignes insérées dans la table ${tableName}`);
    } catch (error) {
      console.error(`[/api/upload/csv-to-table] Erreur lors de l'insertion des données, exécution du ROLLBACK:`, error);
      try {
        await client.query('ROLLBACK');
        console.log(`[/api/upload/csv-to-table] ROLLBACK exécuté avec succès`);
      } catch (rollbackError) {
        console.error(`[/api/upload/csv-to-table] Erreur lors du ROLLBACK:`, rollbackError);
      }
      throw error; // Propager l'erreur pour la gestion globale
    } finally {
      client.release();
      console.log(`[/api/upload/csv-to-table] Connexion client libérée`);
    }
    
    // Répondre avec succès
    res.status(201).json({ 
      success: true, 
      message: `Le fichier CSV a été importé avec succès dans la table "${tableName}".`,
      tableName: tableName,
      rowCount: data.length
    });
    
  } catch (error) {
    console.error("[/api/upload/csv-to-table] Erreur détaillée:", error);
    
    // Journaliser des informations supplémentaires pour le débogage
    if (error.code === '3D000') {
      console.error("Erreur: La base de données n'existe pas");
      return res.status(500).json({ error: `La base de données spécifiée n'existe pas. Vérifiez vos paramètres de connexion.` });
    } else if (error.code === '28P01') {
      console.error("Erreur: Authentification échouée");
      return res.status(500).json({ error: `Échec d'authentification à la base de données. Vérifiez vos identifiants.` });
    } else if (error.code === 'ECONNREFUSED') {
      console.error("Erreur: Connexion refusée");
      return res.status(500).json({ error: `Impossible de se connecter au serveur de base de données. Vérifiez que le serveur est en cours d'exécution et accessible.` });
    }
    
    res.status(500).json({ 
      error: `Une erreur est survenue lors de l'importation: ${error.message}`,
      details: error.stack,
      code: error.code || 'UNKNOWN'
    });
  }
});

module.exports = router;
