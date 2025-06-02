const fs = require('fs');
const Papa = require('papaparse');
const path = require('path');

// Chemins des fichiers
const inputFilePath = path.join(__dirname, 'scans_202505281312_SML_10_enrichi_v1.csv');
const outputFilePath = path.join(__dirname, 'scans_202505281312_SML_10_enrichi_v2.csv');

// Fonction principale
async function transformCSV() {
  console.log('Début de la transformation du CSV...');
  
  try {
    // Lire le fichier CSV source
    const fileContent = fs.readFileSync(inputFilePath, 'utf8');
    
    // Parser le CSV
    const parseResult = Papa.parse(fileContent, {
      header: true,
      skipEmptyLines: true
    });
    
    if (!parseResult.data || parseResult.data.length === 0) {
      console.error('Le fichier CSV source est vide ou mal formaté.');
      return;
    }
    
    console.log(`Nombre de lignes dans le fichier source: ${parseResult.data.length}`);
    
    // Définir la structure des colonnes pour le fichier de sortie
    // Basé sur les règles du fichier regles_v1_v2.csv
    const outputColumns = [
      'id', 'code', 'REF M3', 'REF CLAIR', 'identifier', 'ID 10 N', 'BATCH NUMBER',
      'userAgent', 'deviceLanguage', 'city', 'region', 'country', 'latitude', 'longitude',
      'tagId', 'createdAt', 'updatedAt', 'col_17', 'col_18', 'Code', 'Nom :', 'Ville', 'Pays :',
      'col_23', 'col_24', 'col_25', 'type_envoi', 'code_parallele', 'article', 'emballage',
      'date_envoi', 'nom_envoi', 'addresse_envoi', 'cp_envoi', 'ville_envoi', 'pays_envoi'
    ];
    
    // Appliquer les règles de transformation
    const transformedData = parseResult.data.map(row => {
      // Créer un nouvel objet pour la ligne transformée avec la structure des colonnes de sortie
      const newRow = {};
      
      // Initialiser toutes les colonnes avec des valeurs vides
      outputColumns.forEach(col => {
        newRow[col] = '';
      });
      
      // Copier les valeurs existantes
      Object.keys(row).forEach(key => {
        if (outputColumns.includes(key)) {
          newRow[key] = row[key] || '';
        }
      });
      
      // Règle 1: Extraire ID 10 N à partir de identifier
      if (row.identifier) {
        // Prendre les 10 derniers caractères de l'identifiant
        newRow['ID 10 N'] = row.identifier.slice(-10);
      }
      
      // Règle 2: Conserver le code EAN tel quel
      newRow['code'] = row.code || '';
      
      // Règle 3: Ajouter BATCH NUMBER (si disponible)
      // Dans cet exemple, nous n'avons pas de table d'appairage, donc nous laissons vide
      newRow['BATCH NUMBER'] = '';
      
      // Ajouter REF M3 et REF CLAIR basés sur le code produit
      // Dans un cas réel, ces informations proviendraient d'une table de référence
      if (row.code === '3666057202476') {
        newRow['REF M3'] = '80103084';
        newRow['REF CLAIR'] = 'DOUBLE SERUM 9 RETAIL 50ML';
      } else if (row.code === '3666057202520') {
        newRow['REF M3'] = '80103089';
        newRow['REF CLAIR'] = 'DOUBLE SERUM 9 RETAIL 100ML';
      }
      
      // Conserver les données de traçabilité
      newRow['type_envoi'] = row.type_envoi || '';
      newRow['code_parallele'] = row.code_parallele || '';
      newRow['article'] = row.article || '';
      newRow['emballage'] = row.emballage || '';
      newRow['date_envoi'] = row.date_envoi || '';
      newRow['nom_envoi'] = row.nom_envoi || '';
      newRow['addresse_envoi'] = row.addresse_envoi || '';
      newRow['cp_envoi'] = row.cp_envoi || '';
      newRow['ville_envoi'] = row.ville_envoi || '';
      newRow['pays_envoi'] = row.pays_envoi || '';
      
      return newRow;
    });
    
    // Générer le CSV de sortie
    const outputCSV = Papa.unparse(transformedData, {
      delimiter: '\t', // Utiliser la tabulation comme séparateur
      columns: outputColumns // Assurer l'ordre des colonnes
    });
    
    // Écrire le fichier de sortie
    fs.writeFileSync(outputFilePath, outputCSV, 'utf8');
    
    console.log(`Transformation terminée. Fichier de sortie: ${outputFilePath}`);
    console.log(`Nombre de lignes dans le fichier de sortie: ${transformedData.length}`);
    
  } catch (error) {
    console.error('Erreur lors de la transformation du CSV:', error);
  }
}

// Exécuter la fonction principale
transformCSV();
