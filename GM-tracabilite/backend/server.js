require('dotenv').config();
const express = require('express');
const cors = require('cors');
const multer = require('multer');
const Papa = require('papaparse');
const fs = require('fs');
const path = require('path');
const axios = require('axios');
const crypto = require('crypto'); // Pour générer des ID de tâche uniques
const AWS = require('aws-sdk'); // Pour S3

// Importer les routes
const uploadRoutes = require('./routes/upload');
const databaseRoutes = require('./routes/database');
const analyseRoutes = require('./routes/analyse');

const app = express();
const port = process.env.PORT || 3001;

// Configuration AWS S3 (si les variables d'env sont définies)
if (process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY && process.env.AWS_S3_BUCKET_NAME && process.env.AWS_S3_REGION) {
    AWS.config.update({
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
        region: process.env.AWS_S3_REGION
    });
} else {
    console.warn("Variables d'environnement AWS S3 non configurées. L'upload vers S3 sera désactivé.");
}
const s3 = new AWS.S3();

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Utilisation des routes
app.use('/api/upload', uploadRoutes);
app.use('/api/database', databaseRoutes);
app.use('/api/analyse', analyseRoutes);

// Stockage des tâches en mémoire (pour la démo)
const tasks = {};

// Configuration de Multer pour le stockage des fichiers uploadés en mémoire
const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

async function processFileInBackground(taskId, fileBuffer, originalFileName) {
    console.log(`[TASK:${taskId}] Début de processFileInBackground pour ${originalFileName}`);
    tasks[taskId].status = 'processing';
    tasks[taskId].progress = 0;

    const fileContent = fileBuffer.toString('utf-8');
    let inputScans = [];
    console.log(`[TASK:${taskId}] Contenu du fichier (premiers 200 chars):`, fileContent.substring(0,200));

    try {
        console.log(`[TASK:${taskId}] Parsing du CSV en mémoire...`);
        const parsed = Papa.parse(fileContent, {
            header: true,
            skipEmptyLines: true,
        });
        inputScans = parsed.data;

        if (!parsed.meta.fields || !parsed.meta.fields.includes('ID 10 N') || !parsed.meta.fields.includes('id')) {
            tasks[taskId].status = 'error';
            tasks[taskId].error = 'Le fichier CSV doit contenir les colonnes \'ID 10 N\' et \'id\'.';
            tasks[taskId].endTime = Date.now();
            console.error(`[TASK:${taskId}] Erreur: colonnes 'ID 10 N' ou 'id' manquantes.`);
            return;
        }
        console.log(`[TASK:${taskId}] CSV parsé. ${inputScans.length} lignes trouvées. En-têtes:`, parsed.meta.fields);
    } catch (parseError) {
        tasks[taskId].status = 'error';
        tasks[taskId].error = 'Erreur lors du parsing du fichier CSV.';
        tasks[taskId].endTime = Date.now();
        console.error(`[TASK:${taskId}] Exception de parsing CSV:`, parseError.message);
        return;
    }

    if (inputScans.length === 0) {
        tasks[taskId].status = 'error';
        tasks[taskId].error = 'Le fichier CSV est vide ou mal formaté.';
        tasks[taskId].endTime = Date.now();
        console.warn(`[TASK:${taskId}] Fichier CSV vide ou mal formaté après parsing.`);
        return;
    }

    const numberOfScansToProcess = inputScans.length; // DÉCLARATION CORRIGÉE ET RENOMMÉE
    console.log(`[TASK:${taskId}] Début du traitement de ${numberOfScansToProcess} scans.`); // UTILISATION CORRIGÉE

    const clarinsApiEndpoint = process.env.API_CLARINS_LOT2_ENDPOINT;
    const clarinsApiToken = process.env.API_CLARINS_LOT2_TOKEN;

    if (!clarinsApiEndpoint || !clarinsApiToken) {
        tasks[taskId].status = 'error';
        tasks[taskId].error = 'Configuration de l API Clarins Lot 2 manquante côté serveur.';
        tasks[taskId].endTime = Date.now();
        console.error(`[TASK:${taskId}] Erreur: Variables d'environnement API Clarins manquantes.`);
        return;
    }
    console.log(`[TASK:${taskId}] API Clarins endpoint: ${clarinsApiEndpoint}`);

    const allProcessedData = [];
    let processedCount = 0;

    for (const scan of inputScans) {
        if (tasks[taskId].status === 'cancelling') {
            tasks[taskId].status = 'cancelled';
            tasks[taskId].error = 'Traitement annulé par l\'utilisateur.';
            tasks[taskId].endTime = Date.now();
            console.log(`[TASK:${taskId}] Traitement annulé.`);
            return;
        }

        const id10n = scan['ID 10 N'];
        const originalId = scan['id'];

        if (!id10n) {
            console.warn(`[TASK:${taskId}] Ligne ${processedCount + 1} ignorée car 'ID 10 N' est manquant:`, scan);
            allProcessedData.push({ ...scan, error_processing: 'ID 10 N manquant' });
        } else {
            // Initialiser les variables pour éviter les erreurs de référence
            let batchNumber = '';
            let refM3 = '';
            let refClair = '';

            try {
                // 1. Récupérer le batchnumber via l'API batchnumber
                console.log(`[TASK:${taskId}] Appel de l'API batchnumber pour ${id10n}: ${clarinsApiEndpoint}/batchnumber/${id10n}`);
                try {
                    const batchResponse = await axios.get(`${clarinsApiEndpoint}/batchnumber/${id10n}`,
                        { headers: { 'Authorization': clarinsApiToken } }
                    );
                    if (batchResponse.data && batchResponse.data.batchnumber) {
                        batchNumber = batchResponse.data.batchnumber;
                        console.log(`[TASK:${taskId}] Batchnumber récupéré pour ${id10n}: ${batchNumber}`);
                    }
                } catch (batchError) {
                    console.warn(`[TASK:${taskId}] Erreur lors de la récupération du batchnumber pour ${id10n}:`, batchError.message);
                    // Continuer le traitement même si la récupération du batchnumber a échoué
                }
                
                // 2. Récupérer les données de traçabilité en utilisant la nouvelle route /tracabilite/analyse/
                console.log(`[TASK:${taskId}] Appel de l'API analyse pour ${id10n}: ${clarinsApiEndpoint}/tracabilite/analyse/${id10n}`);
                const tracabiliteResponse = await axios.get(`${clarinsApiEndpoint}/tracabilite/analyse/${id10n}`,
                    { headers: { 'Authorization': clarinsApiToken } }
                );
                
                // 2.1 Récupérer les détails de l'article si un code article est disponible
                if (tracabiliteResponse.status === 200 && tracabiliteResponse.data && tracabiliteResponse.data.article) {
                    try {
                        const articleCode = tracabiliteResponse.data.article;
                        console.log(`[TASK:${taskId}] Appel de l'API article pour ${articleCode}: ${clarinsApiEndpoint}/article/${articleCode}`);
                        const articleResponse = await axios.get(`${clarinsApiEndpoint}/article/${articleCode}`,
                            { headers: { 'Authorization': clarinsApiToken } }
                        );
                        
                        if (articleResponse.status === 200 && articleResponse.data) {
                            refM3 = articleResponse.data.code || '';
                            refClair = articleResponse.data.designation || '';
                            console.log(`[TASK:${taskId}] Détails article récupérés pour ${articleCode}: REF M3=${refM3}, REF CLAIR=${refClair}`);
                        }
                    } catch (articleError) {
                        console.warn(`[TASK:${taskId}] Erreur lors de la récupération des détails de l'article:`, articleError.message);
                        // Continuer le traitement même si la récupération des détails de l'article a échoué
                    }
                }
                
                // 3. Traiter les données de traçabilité
                if (tracabiliteResponse.status === 200 && tracabiliteResponse.data) {
                    console.log(`[TASK:${taskId}] Réponse API analyse pour ${id10n}:`, JSON.stringify(tracabiliteResponse.data));
                    
                    // Récupérer directement les données d'analyse (format déjà adapté)
                    const analyseData = tracabiliteResponse.data;
                    
                    if (!analyseData || Object.keys(analyseData).length === 0) {
                        allProcessedData.push({ 
                            'id': originalId, // Mettre id en premier
                            'identifier': originalId,
                            'ID 10 N': id10n, 
                            'BATCH NUMBER': batchNumber, // Ajouter le numéro de lot même s'il n'y a pas de données de traçabilité
                            'REF M3': refM3, // Ajouter le code article (REF M3)
                            'REF CLAIR': refClair, // Ajouter la désignation de l'article (REF CLAIR)
                            'info_traca': 'Aucune donnée de traçabilité trouvée' 
                        });
                    } else {
                        // Créer l'objet de données enrichies selon le format souhaité
                        const enrichedData = {
                            ...scan, // Conserver toutes les données originales du scan
                            'BATCH NUMBER': batchNumber, // Utiliser le numéro de lot récupéré via l'API batchnumber
                            'REF M3': refM3, // Ajouter le code article (REF M3)
                            'REF CLAIR': refClair, // Ajouter la désignation de l'article (REF CLAIR)
                            'type_envoi': analyseData.type_envoi || null,
                            'code_parallele': analyseData.code_parallele || null,
                            'article': analyseData.article || null,
                            'emballage': analyseData.emballage || null,
                            'date_envoi': analyseData.date_envoi || null,
                            'nom_envoi': analyseData.nom_envoi || null,
                            'addresse_envoi': analyseData.addresse_envoi || null,
                            'cp_envoi': analyseData.cp_envoi || null,
                            'ville_envoi': analyseData.ville_envoi || null,
                            'pays_envoi': analyseData.pays_envoi || null
                        };
                        
                        console.log(`[TASK:${taskId}] Données enrichies:`, JSON.stringify(enrichedData));
                        allProcessedData.push(enrichedData);
                    }
                } else {
                    console.warn(`[TASK:${taskId}] Erreur API Clarins pour ${id10n}: Statut ${tracabiliteResponse.status}, Data:`, tracabiliteResponse.data);
                    allProcessedData.push({ 
                        ...scan, 
                        'BATCH NUMBER': batchNumber, // Ajouter le numéro de lot même en cas d'erreur
                        error_processing: `Erreur API Clarins: ${tracabiliteResponse.status}` 
                    });
                }
            } catch (apiError) {
                console.error(`[TASK:${taskId}] Exception lors de l'appel API pour ${id10n}:`, apiError.message);
                let errorMessage = 'Erreur interne du serveur lors de l appel à l API de traçabilité.';
                if (apiError.response) {
                    console.error(`[TASK:${taskId}] Erreur API Clarins (détail) pour ${id10n} (status ${apiError.response.status}):`, apiError.response.data);
                    errorMessage = `Erreur API Clarins (${apiError.response.status}): ${(apiError.response.data && apiError.response.data.error) ? apiError.response.data.error : apiError.message}`;
                }
                // S'assurer que le batchNumber, REF M3 et REF CLAIR sont inclus même en cas d'erreur
                allProcessedData.push({ ...scan, 'BATCH NUMBER': batchNumber || '', 'REF M3': refM3 || '', 'REF CLAIR': refClair || '', error_processing: errorMessage });
            }
        }
        processedCount++;
        tasks[taskId].progress = Math.round((processedCount / numberOfScansToProcess) * 100); 
    }

    if (tasks[taskId].status === 'cancelling') { 
        tasks[taskId].status = 'cancelled';
        tasks[taskId].error = 'Traitement annulé par l\'utilisateur.';
        tasks[taskId].endTime = Date.now();
        console.log(`[TASK:${taskId}] Traitement annulé (vérification finale).`);
        return;
    }

    console.log(`[TASK:${taskId}] Fin du traitement des lignes. Données collectées: ${allProcessedData.length} entrées.`);
    tasks[taskId].data = allProcessedData; 

    if (allProcessedData.length > 0) {
        try {
            console.log(`[TASK:${taskId}] Génération du CSV de sortie avec tabulation comme séparateur...`);
            
            // Réorganiser les colonnes pour mettre id en premier, puis ID 10 N, Batchnumber, REF M3 et REF CLAIR
            // Supprimer UpdatedAt et reformater createdAt en DATE SCAN et HEURE SCAN (GMT)
            const reorganizedData = allProcessedData.map(row => {
                // Extraire les valeurs des colonnes spécifiques
                const id = row['id'] || '';
                const id10n = row['ID 10 N'] || '';
                const batchNumber = row['BATCH NUMBER'] || '';
                const identifier = row['identifier'] || '';
                const refM3 = row['REF M3'] || '';
                const refClair = row['REF CLAIR'] || '';
                
                // Traiter la date createdAt
                let dateScan = '';
                let heureScan = '';
                if (row['createdAt']) {
                    try {
                        const createdDate = new Date(row['createdAt']);
                        // Format de date: DD/MM/YYYY
                        dateScan = `${String(createdDate.getDate()).padStart(2, '0')}/${String(createdDate.getMonth() + 1).padStart(2, '0')}/${createdDate.getFullYear()}`;
                        
                        // Format d'heure: HH:MM:SS.mmm +ZZZZ
                        const timeZoneOffset = createdDate.getTimezoneOffset();
                        const timeZoneSign = timeZoneOffset <= 0 ? '+' : '-';
                        const timeZoneHours = String(Math.floor(Math.abs(timeZoneOffset) / 60)).padStart(2, '0');
                        const timeZoneMinutes = String(Math.abs(timeZoneOffset) % 60).padStart(2, '0');
                        
                        heureScan = `${String(createdDate.getHours()).padStart(2, '0')}:${String(createdDate.getMinutes()).padStart(2, '0')}:${String(createdDate.getSeconds()).padStart(2, '0')}.${String(createdDate.getMilliseconds()).padStart(3, '0')} ${timeZoneSign}${timeZoneHours}${timeZoneMinutes}`;
                    } catch (error) {
                        console.error(`[TASK:${taskId}] Erreur lors du formatage de la date:`, error.message);
                    }
                }
                
                // Supprimer ces colonnes de l'objet original pour les réinsérer dans l'ordre souhaité
                const { 'id': _id, 'ID 10 N': _, 'BATCH NUMBER': __, identifier: ___, 'REF M3': ____, 'REF CLAIR': _____, 'createdAt': ______, 'updatedAt': _______, ...restData } = row;
                
                // Extraire et réorganiser les autres colonnes importantes
                const code = row['code'] || '';
                const typeEnvoi = row['type_envoi'] || '';
                
                // Déterminer le SITE SCAN LOG (nom d'entrepôt)
                let siteScanLog = '';
                if (row['nom_envoi']) {
                    siteScanLog = row['nom_envoi']; // Utiliser le nom d'envoi comme nom d'entrepôt
                }
                
                // Supprimer ces colonnes supplémentaires pour les réinsérer dans l'ordre souhaité
                const { 'code': ________, 'type_envoi': _________, ...remainingData } = restData;
                
                // Reconstruire l'objet avec l'ordre des colonnes souhaité
                return {
                    'id': id,
                    'identifier': identifier,
                    'ID 10 N': id10n,
                    'Batchnumber': batchNumber,  // Renommer en "Batchnumber" au lieu de "BATCH NUMBER"
                    'REF M3': refM3,
                    'REF CLAIR': refClair,
                    'code': code,
                    'DATE SCAN': dateScan,
                    'HEURE SCAN (GMT)': heureScan,
                    'type_envoi': typeEnvoi,
                    'SITE SCAN LOG': siteScanLog,
                    ...remainingData
                };
            });
            
            const outputCsv = Papa.unparse(reorganizedData, {
                delimiter: '\t' // Utiliser la tabulation comme séparateur
            });
            tasks[taskId].csvData = outputCsv;

            if (process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY && process.env.AWS_S3_BUCKET_NAME && process.env.AWS_S3_REGION) {
                console.log(`[TASK:${taskId}] Tentative d'upload S3...`);
                const s3FileName = `tracabilite/${tasks[taskId].fileName.replace(/\.[^/.]+$/, "")}_${Date.now()}.csv`;
                const s3Params = {
                    Bucket: process.env.AWS_S3_BUCKET_NAME,
                    Key: s3FileName,
                    Body: outputCsv,
                    ContentType: 'text/csv'
                };
                try {
                    const s3Upload = await s3.upload(s3Params).promise();
                    tasks[taskId].s3Link = s3Upload.Location;
                    console.log(`[TASK:${taskId}] Fichier uploadé sur S3: ${s3Upload.Location}`);
                } catch (s3Error) {
                    console.error(`[TASK:${taskId}] Erreur d'upload S3:`, s3Error);
                    tasks[taskId].error = tasks[taskId].error ? tasks[taskId].error + "; Erreur S3" : "Erreur S3"; 
                }
            }
        } catch (unparseError) {
            console.error(`[TASK:${taskId}] Erreur de génération CSV:`, unparseError);
            tasks[taskId].status = 'error';
            tasks[taskId].error = 'Erreur lors de la génération du fichier CSV de sortie.';
            tasks[taskId].endTime = Date.now();
            return;
        }
    } else {
        console.warn(`[TASK:${taskId}] Aucune donnée n'a été traitée avec succès.`);
        tasks[taskId].error = 'Aucune donnée n a été traitée avec succès.';
    }

    tasks[taskId].status = 'completed';
    tasks[taskId].progress = 100;
    tasks[taskId].endTime = Date.now();
    tasks[taskId].cancellable = false; 
    console.log(`[TASK:${taskId}] Tâche marquée comme terminée.`);
}

app.post('/api/upload-csv', upload.single('csvfile'), (req, res) => {
    console.log("[/api/upload-csv] Requête reçue.");
    if (!req.file) {
        console.warn("[/api/upload-csv] Aucun fichier reçu.");
        return res.status(400).json({ error: 'Aucun fichier na été téléchargé.' });
    }
    console.log("[/api/upload-csv] Fichier reçu:", req.file.originalname, ", Taille:", req.file.size);

    const taskId = crypto.randomBytes(16).toString('hex');
    tasks[taskId] = {
        id: taskId,
        status: 'pending',
        progress: 0,
        data: null,
        csvData: null,
        s3Link: null,
        error: null,
        fileName: req.file.originalname,
        startTime: Date.now(),
        endTime: null,
        cancellable: true
    };

    processFileInBackground(taskId, req.file.buffer, req.file.originalname)
        .catch(err => {
            console.error(`Erreur non interceptée dans processFileInBackground pour la tâche ${taskId}:`, err);
            if (tasks[taskId]) {
                tasks[taskId].status = 'error';
                tasks[taskId].error = 'Erreur système majeure durant le traitement.';
                tasks[taskId].endTime = Date.now();
            }
        });

    console.log(`[/api/upload-csv] Tâche créée avec ID: ${taskId}`);
    res.status(202).json({ taskId: taskId, message: 'Le traitement du fichier a commencé.' });
});

app.get('/api/task-status/:taskId', (req, res) => {
    const { taskId } = req.params;
    const task = tasks[taskId];

    if (!task) {
        console.warn(`[/api/task-status/${taskId}] Tâche non trouvée.`);
        return res.status(404).json({ error: 'Tâche non trouvée.' });
    }

    const { data, csvData, ...taskStatusInfo } = task; 
    if (task.status === 'completed') {
        return res.json({ ...taskStatusInfo, hasJsonData: !!task.data, hasCsvData: !!task.csvData });
    } else {
        return res.json(taskStatusInfo);
    }
});

app.get('/api/download-csv/:taskId', (req, res) => {
    const { taskId } = req.params;
    const task = tasks[taskId];

    if (!task || task.status !== 'completed' || !task.csvData) {
        return res.status(404).json({ error: 'Fichier CSV non trouvé ou la tâche n est pas terminée.' });
    }

    // Ajout d'en-têtes CORS pour permettre le téléchargement depuis un autre domaine
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
    res.header('Content-Type', 'text/csv');
    res.header('Content-Disposition', `attachment; filename="${path.parse(task.fileName).name}_enrichi.csv"`);
    res.send(task.csvData);
});

app.get('/api/get-json-data/:taskId', (req, res) => {
    const { taskId } = req.params;
    const task = tasks[taskId];

    if (!task || task.status !== 'completed' || !task.data) {
        return res.status(404).json({ error: 'Données JSON non trouvées ou la tâche n est pas terminée.' });
    }
    res.json(task.data);
});

app.post('/api/cancel-task/:taskId', (req, res) => {
    const { taskId } = req.params;
    const task = tasks[taskId];

    if (!task) {
        return res.status(404).json({ error: 'Tâche non trouvée.' });
    }

    if (!task.cancellable || task.status === 'completed' || task.status === 'error' || task.status === 'cancelled' || task.status === 'cancelling') {
        return res.status(400).json({ error: 'La tâche ne peut pas être annulée ou est déjà en cours d annulation/terminée.' });
    }

    task.status = 'cancelling'; 
    task.cancellable = false;
    res.json({ message: 'Demande d annulation reçue.' });
});

app.get('/', (req, res) => {
    res.send('Backend GM-Tracabilite en cours d execution!');
});

app.listen(port, () => {
    console.log(`Backend GM-Tracabilite écoutant sur le port ${port}`);
});
