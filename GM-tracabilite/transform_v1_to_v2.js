const fs = require('fs');
const path = require('path');
const Papa = require('papaparse');

// Chemins des fichiers
const inputFilePath = path.join(__dirname, 'scans_202505301449_enrichi_v1.csv');
const outputFilePath = path.join(__dirname, 'scans_202505301449_enrichi_v2.csv');
const rulesFilePath = path.join(__dirname, 'regles_v1_v2.csv');

// Fonction pour lire un fichier CSV
function readCSV(filePath, delimiter = '\t') {
    const fileContent = fs.readFileSync(filePath, 'utf8');
    return Papa.parse(fileContent, {
        header: true,
        delimiter: delimiter,
        skipEmptyLines: true
    }).data;
}

// Fonction pour écrire un fichier CSV
function writeCSV(filePath, data, delimiter = '\t') {
    const csv = Papa.unparse(data, {
        delimiter: delimiter
    });
    fs.writeFileSync(filePath, csv);
    console.log(`Fichier créé avec succès: ${filePath}`);
}

// Fonction principale
async function transformCSV() {
    try {
        console.log('Lecture du fichier source...');
        const inputData = readCSV(inputFilePath);
        console.log(`Nombre de lignes dans le fichier source: ${inputData.length}`);

        console.log('Lecture du fichier de règles...');
        const rulesData = readCSV(rulesFilePath, ';');
        console.log(`Nombre de règles: ${rulesData.length}`);

        // Transformation des données selon les règles
        const outputData = inputData.map(row => {
            const newRow = { ...row };

            // Règle 1: ID 10 N - Extraire les 10 derniers caractères de identifier
            if (row.identifier && row.identifier.length > 10) {
                newRow['ID 10 N'] = row.identifier.slice(-10);
            }

            // Règle 3: BATCH NUMBER - Déjà présent dans le fichier enrichi v1

            // Règle 6-8: Formatage de la date et heure
            if (row.updatedAt) {
                const date = new Date(row.updatedAt);
                // Format AAAAMMJJ
                const dateFormatted = date.getFullYear().toString() +
                    (date.getMonth() + 1).toString().padStart(2, '0') +
                    date.getDate().toString().padStart(2, '0');
                
                // Format HHMMSS
                const timeFormatted = date.getHours().toString().padStart(2, '0') +
                    date.getMinutes().toString().padStart(2, '0') +
                    date.getSeconds().toString().padStart(2, '0');
                
                newRow['DATE SCAN'] = dateFormatted;
                newRow['HEURE SCAN (GMT)'] = timeFormatted;
                
                // Format AAAAMMJJHHMMSS
                newRow['DATE HEURE SCAN'] = dateFormatted + timeFormatted;
            }

            // Règle 9: Pays complet et code ISO
            if (row.country) {
                newRow['PAYS CODE'] = row.country;
                // Conversion du code ISO en nom complet (à implémenter avec une table de correspondance)
                const countryMap = {
                    'CN': 'Chine',
                    'FR': 'France',
                    'US': 'États-Unis',
                    // Ajouter d'autres pays selon les besoins
                };
                newRow['PAYS NOM'] = countryMap[row.country] || row.country;
            }

            // Règle 15-20: Informations sur le téléphone
            if (row.userAgent) {
                // Extraction du système d'exploitation
                let os = 'Inconnu';
                if (row.userAgent.includes('iPhone') || row.userAgent.includes('iOS')) {
                    os = 'iOS';
                } else if (row.userAgent.includes('Android')) {
                    os = 'Android';
                } else if (row.userAgent.includes('Windows')) {
                    os = 'Windows';
                } else if (row.userAgent.includes('Mac OS')) {
                    os = 'Mac OS';
                }
                newRow['OS'] = os;

                // Extraction du navigateur
                let browser = 'Inconnu';
                if (row.userAgent.includes('Chrome')) {
                    browser = 'Chrome';
                } else if (row.userAgent.includes('Safari')) {
                    browser = 'Safari';
                } else if (row.userAgent.includes('Firefox')) {
                    browser = 'Firefox';
                } else if (row.userAgent.includes('Edge')) {
                    browser = 'Edge';
                } else if (row.userAgent.includes('MicroMessenger')) {
                    browser = 'WeChat';
                }
                newRow['NAVIGATEUR'] = browser;
            }

            // Règle 21-22: Unité logistique scannée
            // Ces données sont déjà présentes dans le fichier enrichi v1 (emballage, code_parallele)

            return newRow;
        });

        // Écriture du fichier de sortie
        console.log('Écriture du fichier de sortie...');
        writeCSV(outputFilePath, outputData);
        console.log('Transformation terminée avec succès!');

    } catch (error) {
        console.error('Erreur lors de la transformation:', error);
    }
}

// Exécution de la fonction principale
transformCSV();
