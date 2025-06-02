const express = require('express');
const router = express.Router();
const { pool } = require('../db');
const OpenAI = require('openai');
const axios = require('axios');

// Vérifier si la clé API OpenAI est définie
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
if (!OPENAI_API_KEY || OPENAI_API_KEY === 'your-api-key') {
  console.warn('ATTENTION: La clé API OpenAI n\'est pas configurée correctement dans le fichier .env');
  console.warn('L\'analyse complète avec OpenAI ne fonctionnera pas sans une clé API valide.');
}

// Initialiser le client OpenAI
const openai = new OpenAI({
  apiKey: OPENAI_API_KEY
});

// Route pour l'analyse basique des données d'une table
router.get('/tables/:tableName/basic', async (req, res) => {
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
        AND table_name = '${tableName}'
      );
    `;
    
    const tableExists = await pool.query(tableExistsQuery);
    
    if (!tableExists.rows[0].exists) {
      return res.status(404).json({ error: `La table "${tableName}" n'existe pas` });
    }
    
    // Vérifier quelles colonnes existent dans la table
    const columnsQuery = `
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = '${tableName}'
    `;
    
    const columnsResult = await pool.query(columnsQuery);
    const columns = columnsResult.rows.map(row => row.column_name);
    
    console.log(`Colonnes disponibles dans la table ${tableName}:`, columns);
    
    // Vérifier si les colonnes nécessaires existent
    const hasIdColumn = columns.includes('id_10_n');
    const hasVilleColumn = columns.includes('ville_scan');
    
    // Récupérer des statistiques de base sur la table
    const statsQuery = `
      SELECT 
        COUNT(*) as row_count,
        ${columns.length} as column_count
      FROM ${tableName}
    `;
    
    // Construire la requête de doublons en fonction des colonnes disponibles
    let duplicatesQuery;
    if (hasIdColumn) {
      duplicatesQuery = `
        SELECT COUNT(*) as count
        FROM (
          SELECT COUNT(*) 
          FROM ${tableName}
          GROUP BY id_10_n
          HAVING COUNT(*) > 1
        ) as duplicates
      `;
    } else {
      duplicatesQuery = `SELECT 0 as count`; // Valeur par défaut si la colonne n'existe pas
    }
    
    // Construire la requête de valeurs nulles en fonction des colonnes disponibles
    let nullValuesQuery = `SELECT `;
    
    if (hasIdColumn) {
      nullValuesQuery += `SUM(CASE WHEN id_10_n IS NULL THEN 1 ELSE 0 END) as null_id_10_n`;
    } else {
      nullValuesQuery += `0 as null_id_10_n`;
    }
    
    if (hasVilleColumn) {
      nullValuesQuery += `, SUM(CASE WHEN ville_scan IS NULL THEN 1 ELSE 0 END) as null_ville_scan`;
    } else {
      nullValuesQuery += `, 0 as null_ville_scan`;
    }
    
    nullValuesQuery += ` FROM ${tableName}`;
    
    
    // Exécuter les requêtes sans paramètres supplémentaires car ils sont déjà inclus dans les requêtes
    const [statsResult, duplicatesResult, nullValuesResult] = await Promise.all([
      pool.query(statsQuery),
      pool.query(duplicatesQuery),
      pool.query(nullValuesQuery)
    ]);
    
    res.json({
      tableName,
      statistics: {
        rowCount: parseInt(statsResult.rows[0].row_count),
        columnCount: parseInt(statsResult.rows[0].column_count),
        duplicateIdCount: parseInt(duplicatesResult.rows[0].count),
        nullValues: {
          id_10_n: parseInt(nullValuesResult.rows[0].null_id_10_n || 0),
          ville_scan: parseInt(nullValuesResult.rows[0].null_ville_scan || 0)
        }
      },
      recommendations: [
        duplicatesResult.rows[0].count > 0 ? "Vérifier les doublons d'identifiants (id_10_n)" : null,
        nullValuesResult.rows[0].null_id_10_n > 0 ? "Compléter les identifiants manquants" : null,
        nullValuesResult.rows[0].null_ville_scan > 0 ? "Compléter les villes de scan manquantes" : null
      ].filter(Boolean)
    });
  } catch (error) {
    console.error(`[/api/analyse/tables/${tableName}/basic] Erreur:`, error);
    res.status(500).json({ error: 'Erreur lors de l\'analyse: ' + error.message });
  }
});

// Route pour l'analyse avancée des données d'une table
router.get('/tables/:tableName/advanced', async (req, res) => {
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
        AND table_name = '${tableName}'
      );
    `;
    
    const tableExists = await pool.query(tableExistsQuery);
    
    if (!tableExists.rows[0].exists) {
      return res.status(404).json({ error: `La table "${tableName}" n'existe pas` });
    }
    
    // Récupérer les statistiques de base
    const basicAnalysisResponse = await axios.get(`http://localhost:3001/api/analyse/tables/${tableName}/basic`);
    const basicAnalysis = basicAnalysisResponse.data;
    
    // Vérifier quelles colonnes existent dans la table
    const columnsQuery = `
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = '${tableName}'
    `;
    
    const columnsResult = await pool.query(columnsQuery);
    const columns = columnsResult.rows.map(row => row.column_name);
    
    console.log(`Colonnes disponibles dans la table ${tableName} (analyse avancée):`, columns);
    
    // Vérifier si les colonnes nécessaires existent
    const hasIdColumn = columns.includes('id_10_n');
    const hasVilleColumn = columns.includes('ville_scan');
    const hasDateColumn = columns.includes('date_scan');
    
    // Initialiser les résultats par défaut
    let multiCityScansResult = { rows: [] };
    let timeAnomaliesResult = { rows: [] };
    
    // Détecter les anomalies de scans dans différentes villes (seulement si les colonnes nécessaires existent)
    if (hasIdColumn && hasVilleColumn) {
      const multiCityScansQuery = `
        SELECT id_10_n, COUNT(DISTINCT ville_scan) as city_count, array_agg(DISTINCT ville_scan) as cities
        FROM ${tableName}
        GROUP BY id_10_n
        HAVING COUNT(DISTINCT ville_scan) > 1
        LIMIT 100
      `;
      
      multiCityScansResult = await pool.query(multiCityScansQuery);
    } else {
      console.log(`Impossible de détecter les anomalies multi-villes: colonnes manquantes (id_10_n: ${hasIdColumn}, ville_scan: ${hasVilleColumn})`);
    }
    
    // Détecter les anomalies de temps entre les scans (seulement si les colonnes nécessaires existent)
    if (hasIdColumn && hasDateColumn) {
      const timeAnomaliesQuery = `
        SELECT id_10_n, 
               MIN(date_scan) as first_scan, 
               MAX(date_scan) as last_scan,
               EXTRACT(EPOCH FROM (MAX(TO_TIMESTAMP(date_scan, 'DD/MM/YYYY HH24:MI:SS')) - MIN(TO_TIMESTAMP(date_scan, 'DD/MM/YYYY HH24:MI:SS'))))/3600 as hours_between
        FROM ${tableName}
        GROUP BY id_10_n
        HAVING COUNT(*) > 1 AND EXTRACT(EPOCH FROM (MAX(TO_TIMESTAMP(date_scan, 'DD/MM/YYYY HH24:MI:SS')) - MIN(TO_TIMESTAMP(date_scan, 'DD/MM/YYYY HH24:MI:SS'))))/3600 < 1
        LIMIT 100
      `;
      
      timeAnomaliesResult = await pool.query(timeAnomaliesQuery);
    } else {
      console.log(`Impossible de détecter les anomalies de temps: colonnes manquantes (id_10_n: ${hasIdColumn}, date_scan: ${hasDateColumn})`);
    }
    
    // Vérifier si la table est une table de scan (contient 'scan' dans son nom)
    const isScanTable = tableName.toLowerCase().includes('scan');
    
    // Initialiser les résultats des requêtes avancées
    let advancedQueryResults = {};
    
    // Si c'est une table de scan, exécuter les requêtes avancées
    if (isScanTable) {
      try {
        console.log(`Exécution des requêtes avancées pour la table de scan: ${tableName}`);
        
        // 1. Identifier les identifiants dupliqués et leur nombre d'occurrences
        const duplicatedIdentifiersQuery = `
          SELECT identifier, COUNT(*) as nombre_occurrences
          FROM ${tableName}
          GROUP BY identifier
          HAVING COUNT(*) > 1
          ORDER BY nombre_occurrences DESC
          LIMIT 20
        `;
        
        // 2. Identifier les id_10_n dupliqués et leur nombre d'occurrences
        const duplicatedId10nQuery = `
          SELECT id_10_n, COUNT(*) as nombre_occurrences
          FROM ${tableName}
          GROUP BY id_10_n
          HAVING COUNT(*) > 1
          ORDER BY nombre_occurrences DESC
          LIMIT 20
        `;
        
        // 8. Vérifier si un même identifiant est scanné depuis plusieurs pays différents
        const multiCountryScansQuery = `
          SELECT 
              identifier,
              COUNT(DISTINCT country) as nombre_pays,
              array_agg(DISTINCT country) as liste_pays,
              COUNT(*) as nombre_scans
          FROM ${tableName}
          GROUP BY identifier
          HAVING COUNT(DISTINCT country) > 1
          ORDER BY nombre_pays DESC, nombre_scans DESC
          LIMIT 50
        `;
        
        // 6. Identifier les scans avec des informations manquantes importantes
        const missingInfoQuery = `
          SELECT 
              identifier,
              id_10_n,
              ref_m3,
              date_scan
          FROM ${tableName}
          WHERE 
              site_scan_log IS NULL OR
              city IS NULL OR
              country IS NULL OR
              nom_envoi IS NULL
          LIMIT 100
        `;
        
        // 10. Analyser les scans multiples par type d'envoi pour un même identifiant
        const multiTypeScansQuery = `
          SELECT 
              identifier,
              COUNT(DISTINCT type_envoi) as nombre_types_envoi,
              array_agg(DISTINCT type_envoi) as types_envoi,
              COUNT(*) as nombre_scans
          FROM ${tableName}
          GROUP BY identifier
          HAVING COUNT(DISTINCT type_envoi) > 1
          ORDER BY nombre_scans DESC
          LIMIT 50
        `;
        
        // Exécuter les requêtes en parallèle
        const [duplicatedIdentifiersResult, duplicatedId10nResult, multiCountryScansResult, missingInfoResult, multiTypeScansResult] = 
          await Promise.all([
            pool.query(duplicatedIdentifiersQuery).catch(err => ({ rows: [], error: err.message })),
            pool.query(duplicatedId10nQuery).catch(err => ({ rows: [], error: err.message })),
            pool.query(multiCountryScansQuery).catch(err => ({ rows: [], error: err.message })),
            pool.query(missingInfoQuery).catch(err => ({ rows: [], error: err.message })),
            pool.query(multiTypeScansQuery).catch(err => ({ rows: [], error: err.message }))
          ]);
        
        // Stocker les résultats
        advancedQueryResults = {
          duplicatedIdentifiers: {
            title: "Identifiants dupliqués",
            description: "Liste des identifiants qui apparaissent plusieurs fois dans la table",
            data: duplicatedIdentifiersResult.rows || [],
            error: duplicatedIdentifiersResult.error
          },
          duplicatedId10n: {
            title: "ID 10N dupliqués",
            description: "Liste des ID 10N qui apparaissent plusieurs fois dans la table",
            data: duplicatedId10nResult.rows || [],
            error: duplicatedId10nResult.error
          },
          multiCountryScans: {
            title: "Scans multi-pays",
            description: "Identifiants scannés dans plusieurs pays différents",
            data: multiCountryScansResult.rows || [],
            error: multiCountryScansResult.error
          },
          missingInfo: {
            title: "Informations manquantes",
            description: "Scans avec des informations importantes manquantes",
            data: missingInfoResult.rows || [],
            error: missingInfoResult.error
          },
          multiTypeScans: {
            title: "Multi-types d'envoi",
            description: "Identifiants avec plusieurs types d'envoi différents",
            data: multiTypeScansResult.rows || [],
            error: multiTypeScansResult.error
          }
        };
        
        console.log(`Requêtes avancées exécutées avec succès pour ${tableName}`);
      } catch (error) {
        console.error(`Erreur lors de l'exécution des requêtes avancées pour ${tableName}:`, error);
        advancedQueryResults.error = error.message;
      }
    }
    
    // Enrichir l'analyse avec les anomalies détectées
    const anomalies = {
      multiCityScans: multiCityScansResult.rows.map(row => ({
        id: row.id_10_n,
        cityCount: parseInt(row.city_count),
        cities: row.cities
      })),
      rapidScans: timeAnomaliesResult.rows.map(row => ({
        id: row.id_10_n,
        firstScan: row.first_scan,
        lastScan: row.last_scan,
        hoursBetween: parseFloat(row.hours_between)
      }))
    };
    
    // Calculer un score de qualité basé sur les anomalies détectées
    const totalRows = basicAnalysis.statistics.rowCount;
    const anomalyCount = anomalies.multiCityScans.length + anomalies.rapidScans.length;
    const qualityScore = Math.max(0, 100 - (anomalyCount / totalRows * 100));
    
    res.json({
      ...basicAnalysis,
      anomalies,
      advancedQueryResults,
      isScanTable,
      qualityScore: parseFloat(qualityScore.toFixed(2)),
      recommendations: [
        ...basicAnalysis.recommendations,
        anomalies.multiCityScans.length > 0 ? "Vérifier les identifiants scannés dans plusieurs villes différentes" : null,
        anomalies.rapidScans.length > 0 ? "Vérifier les identifiants avec des scans trop rapprochés dans le temps" : null,
        isScanTable && advancedQueryResults.duplicatedIdentifiers?.data?.length > 0 ? "Examiner les identifiants dupliqués dans la table" : null,
        isScanTable && advancedQueryResults.multiCountryScans?.data?.length > 0 ? "Vérifier les identifiants scannés dans plusieurs pays différents" : null,
        isScanTable && advancedQueryResults.missingInfo?.data?.length > 0 ? "Compléter les informations manquantes dans certains scans" : null
      ].filter(Boolean)
    });
  } catch (error) {
    console.error(`[/api/analyse/tables/${tableName}/advanced] Erreur:`, error);
    
    // Vérifier si c'est une erreur de base de données
    if (error.code && (error.code.startsWith('42') || error.code.startsWith('22'))) {
      return res.status(400).json({ 
        error: 'Erreur de requête SQL', 
        message: error.message,
        hint: 'Vérifiez la structure de la table et les colonnes disponibles'
      });
    }
    
    // Si c'est une erreur lors de l'appel à l'API d'analyse basique
    if (error.response && error.response.data) {
      return res.status(error.response.status || 500).json({ 
        error: 'Erreur lors de la récupération de l\'analyse basique', 
        message: error.response.data.error || error.message
      });
    }
    
    res.status(500).json({ error: 'Erreur lors de l\'analyse avancée', message: error.message });
  }
});

// Route pour l'analyse complète avec OpenAI
router.get('/tables/:tableName/complete', async (req, res) => {
  const { tableName } = req.params;
  
  // Vérifier que le nom de la table ne contient que des caractères alphanumériques et des underscores
  if (!/^[a-zA-Z0-9_]+$/.test(tableName)) {
    return res.status(400).json({ error: 'Nom de table invalide' });
  }
  
  // Vérifier si la clé API OpenAI est configurée
  if (!OPENAI_API_KEY || OPENAI_API_KEY === 'your-api-key') {
    return res.status(500).json({ 
      error: 'Configuration OpenAI manquante', 
      message: 'La clé API OpenAI n\'est pas configurée. Veuillez configurer OPENAI_API_KEY dans le fichier .env'
    });
  }
  
  try {
    // Vérifier si la table existe
    const tableExistsQuery = `
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = '${tableName}'
      );
    `;
    
    const tableExists = await pool.query(tableExistsQuery);
    
    if (!tableExists.rows[0].exists) {
      return res.status(404).json({ error: `La table "${tableName}" n'existe pas` });
    }
    
    // Récupérer l'analyse avancée
    const advancedAnalysisResponse = await axios.get(`http://localhost:3001/api/analyse/tables/${tableName}/advanced`);
    const advancedAnalysis = advancedAnalysisResponse.data;
    
    // Récupérer un échantillon des données pour l'analyse OpenAI
    const sampleDataQuery = `
      SELECT * FROM ${tableName} 
      ORDER BY RANDOM() 
      LIMIT 10
    `;
    
    const sampleDataResult = await pool.query(sampleDataQuery);
    
    // Préparer les données pour l'analyse OpenAI
    const analysisData = {
      tableName,
      statistics: advancedAnalysis.statistics,
      anomalies: advancedAnalysis.anomalies,
      sampleData: sampleDataResult.rows
    };
    
    // Appeler l'API OpenAI pour l'analyse
    const completion = await openai.chat.completions.create({
      model: "gpt-4",
      messages: [
        {
          role: "system",
          content: "Vous êtes un expert en analyse de données de traçabilité et détection de fraude. Votre mission est d'analyser en profondeur les données fournies pour identifier des anomalies, des schémas suspects et des risques potentiels. Utilisez votre expertise en traçabilité pour proposer des analyses pertinentes et des recommandations concrètes."
        },
        {
          role: "user",
          content: `Analysez en profondeur cette table de traçabilité "${tableName}" pour détecter des anomalies et proposer des méthodes d'analyse avancées.
          
          STATISTIQUES GÉNÉRALES: 
          - Nombre de lignes: ${analysisData.statistics.rowCount}
          - Nombre de colonnes: ${analysisData.statistics.columnCount}
          - Identifiants en double: ${analysisData.statistics.duplicateIdCount}
          - Valeurs nulles pour id_10_n: ${analysisData.statistics.nullValues.id_10_n}
          - Valeurs nulles pour ville_scan: ${analysisData.statistics.nullValues.ville_scan}
          
          ANOMALIES DÉJÀ DÉTECTÉES:
          - ${analysisData.anomalies.multiCityScans.length} identifiants scannés dans plusieurs villes différentes
          - ${analysisData.anomalies.rapidScans.length} identifiants avec des scans trop rapprochés dans le temps (moins d'1 heure)
          
          ÉCHANTILLON DE DONNÉES:
          ${JSON.stringify(analysisData.sampleData, null, 2)}
          
          VOTRE MISSION:
          
          1. ANALYSE DES ANOMALIES EXISTANTES
             - Analysez les anomalies déjà détectées et expliquez leur signification
             - Évaluez la gravité de ces anomalies et leur impact potentiel
          
          2. PROPOSEZ DE NOUVELLES MÉTHODES DE DÉTECTION D'ANOMALIES
             - Suggérez 3-5 nouvelles requêtes SQL ou analyses statistiques pour détecter d'autres types d'anomalies
             - Expliquez comment ces analyses pourraient être implémentées et ce qu'elles permettraient de détecter
          
          3. ÉVALUATION DES RISQUES
             - Identifiez les risques potentiels de fraude ou d'erreur dans ces données
             - Proposez une méthode de scoring pour évaluer la fiabilité de chaque identifiant
          
          4. RECOMMANDATIONS CONCRÈTES
             - Proposez des actions précises pour améliorer la qualité des données
             - Suggérez des contrôles automatisés à mettre en place
          
          Répondez en français avec un format structuré et des explications détaillées. Soyez précis et concret dans vos recommandations.`
        }
      ],
      max_tokens: 1500,
    });
    
    const aiAnalysis = completion.choices[0].message.content;
    
    // Renvoyer l'analyse complète
    res.json({
      ...advancedAnalysis,
      aiAnalysis
    });
    
  } catch (error) {
    console.error(`[/api/analyse/tables/${tableName}/complete] Erreur:`, error);
    
    // Vérifier si c'est une erreur OpenAI
    if (error.name === 'OpenAIError' || error.message?.includes('OpenAI')) {
      return res.status(500).json({ 
        error: 'Erreur OpenAI', 
        message: error.message,
        hint: 'Vérifiez votre clé API OpenAI et votre connexion internet'
      });
    }
    
    // Vérifier si c'est une erreur de base de données
    if (error.code && (error.code.startsWith('42') || error.code.startsWith('22'))) {
      return res.status(400).json({ 
        error: 'Erreur de requête SQL', 
        message: error.message,
        hint: 'Vérifiez la structure de la table et les colonnes disponibles'
      });
    }
    
    // Si c'est une erreur lors de l'appel à l'API d'analyse avancée
    if (error.response && error.response.data) {
      return res.status(error.response.status || 500).json({ 
        error: 'Erreur lors de la récupération de l\'analyse avancée', 
        message: error.response.data.error || error.message
      });
    }
    
    res.status(500).json({ error: 'Erreur lors de l\'analyse complète', message: error.message });
  }
});

module.exports = router;
