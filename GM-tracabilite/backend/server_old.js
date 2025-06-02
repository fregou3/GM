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

// Stockage des tâches en mémoire (pour la démo)
// En production, utiliser une base de données (Redis, MongoDB, etc.)
const tasks = {};
/*
Structure d'une tâche:
{
  id: string,
  status: 'pending' | 'processing' | 'completed' | 'error' | 'cancelled',
  progress: number (0-100),
  data: object[] | null, // Données JSON traitées
  csvData: string | null, // Données CSV traitées
  s3Link: string | null,
  error: string | null,
  fileName: string,
  startTime: number,
  endTime: number | null,
  cancellable: boolean // Si la tâche peut être annulée
}
*/

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
        console.error("Erreur de parsing CSV:", parseError);
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

    const numberOfScansToProcess = inputScans.length; 
    console.log(`[TASK:${taskId}] Début du traitement de ${numberOfScansToProcess} scans.`);
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
    // const totalScans = inputScans.length; // Ancienne position, maintenant numberOfScansToProcess

    for (const scan of inputScans) {
        if (tasks[taskId].status === 'cancelling') {
            tasks[taskId].status = 'cancelled';
            tasks[taskId].error = 'Traitement annulé par l\'utilisateur.';
            tasks[taskId].endTime = Date.now();
            console.log(`[TASK:${taskId}] Traitement annulé.`);
            return;
        }

        // console.log(`[TASK:${taskId}] Traitement de la ligne ${processedCount + 1}/${numberOfScansToProcess}:`, scan);
        const id10n = scan['ID 10 N'];
        const originalId = scan['id'];

        if (!id10n) {
            console.warn(`[TASK:${taskId}] Ligne ${processedCount + 1} ignorée car 'ID 10 N' est manquant:`, scan);
            allProcessedData.push({ ...scan, error_processing: 'ID 10 N manquant' });
        } else {
            // console.log(`[TASK:${taskId}] Appel API Clarins pour ID 10 N: ${id10n}`);
            try {
                const response = await axios.get(`${clarinsApiEndpoint}/tracabilite/unite/${id10n}`,
                    { headers: { 'Authorization': clarinsApiToken } }
                );
                // console.log(`[TASK:${taskId}] Réponse API Clarins pour ${id10n} (status ${response.status}):`, response.data);
                if (response.status === 200 && response.data) {
                    const tracabiliteDataArray = Array.isArray(response.data) ? response.data : [response.data];
                    if (tracabiliteDataArray.length === 0) {
                         allProcessedData.push({ 'ID 10 N': id10n, 'id': originalId, 'info_traca': 'Aucune donnée de traçabilité trouvée' });
                    } else {
                        tracabiliteDataArray.forEach(traca => {
                            allProcessedData.push({
                                'ID 10 N': id10n,
                                'id': originalId,
                                'type_envoi': traca.type_envoi || null,
                                'code_parallele': traca.code_parallele || null,
                                'emballage': traca.emballage || null,
                                'date_envoi': traca.date_envoi || null,
                                'adresse_envoi': traca.adresse_envoi || null,
                                'pays_envoi': traca.country_name || traca.pays_envoi || null,
                            });
                        });
                    }
                } else {
                    console.warn(`[TASK:${taskId}] Erreur API Clarins pour ${id10n}: Statut ${response.status}, Data:`, response.data);
                    allProcessedData.push({ ...scan, error_processing: `Erreur API Clarins: ${response.status}` });
                }
            } catch (apiError) {
                console.error(`[TASK:${taskId}] Exception lors de l'appel API pour ${id10n}:`, apiError.message);
                let errorMessage = 'Erreur interne du serveur lors de l appel à l API de traçabilité.';
                if (apiError.response) {
                    console.error(`[TASK:${taskId}] Erreur API Clarins (détail) pour ${id10n} (status ${apiError.response.status}):`, apiError.response.data);
                    errorMessage = `Erreur API Clarins (${apiError.response.status}): ${(apiError.response.data && apiError.response.data.error) ? apiError.response.data.error : apiError.message}`;
                }
                allProcessedData.push({ ...scan, error_processing: errorMessage });
            }
        }
        processedCount++;
        tasks[taskId].progress = Math.round((processedCount / numberOfScansToProcess) * 100);
        // console.log(`[TASK:${taskId}] Progression: ${tasks[taskId].progress}%`);
    }

    if (tasks[taskId].status === 'cancelling') { // Vérification finale si annulé pendant la dernière itération
        tasks[taskId].status = 'cancelled';
        tasks[taskId].error = 'Traitement annulé par l\'utilisateur.';
        tasks[taskId].endTime = Date.now();
        console.log(`[TASK:${taskId}] Traitement annulé (vérification finale).`);
        return;
    }

    console.log(`[TASK:${taskId}] Fin du traitement des lignes. Données collectées: ${allProcessedData.length} entrées.`);
    tasks[taskId].data = allProcessedData; // Stocker les données JSON

    if (allProcessedData.length > 0) {
        try {
            console.log(`[TASK:${taskId}] Génération du CSV de sortie...`);
            const outputCsv = Papa.unparse(allProcessedData);
            tasks[taskId].csvData = outputCsv;
            // console.log(`[TASK:${taskId}] CSV généré (premiers 200 chars):`, outputCsv.substring(0,200));

            // Tentative d'upload S3
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
    tasks[taskId].cancellable = false; // La tâche est terminée
    console.log(`[TASK:${taskId}] Tâche marquée comme terminée.`);
}

// Endpoint pour uploader et démarrer le traitement du fichier CSV
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

    // Lancer le traitement en arrière-plan (ne pas await ici pour une réponse immédiate)
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

// Endpoint pour vérifier le statut d'une tâche
app.get('/api/task-status/:taskId', (req, res) => {
    const { taskId } = req.params;
    // console.log(`[/api/task-status/${taskId}] Requête de statut reçue.`);
    const task = tasks[taskId];

    if (!task) {
        console.warn(`[/api/task-status/${taskId}] Tâche non trouvée.`);
        return res.status(404).json({ error: 'Tâche non trouvée.' });
    }

    // Pour ne pas renvoyer toutes les données brutes à chaque statut
    const { data, csvData, ...taskStatusInfo } = task; // Renommer pour éviter la confusion
    // console.log(`[/api/task-status/${taskId}] Statut renvoyé:`, taskStatusInfo);
    if (task.status === 'completed') {
        return res.json({ ...taskStatusInfo, hasJsonData: !!task.data, hasCsvData: !!task.csvData });
    } else {
        return res.json(taskStatusInfo);
    }
});

// Endpoint pour télécharger le CSV d'une tâche terminée
app.get('/api/download-csv/:taskId', (req, res) => {
    const { taskId } = req.params;
    const task = tasks[taskId];

    if (!task || task.status !== 'completed' || !task.csvData) {
        return res.status(404).json({ error: 'Fichier CSV non trouvé ou la tâche n est pas terminée.' });
    }

    res.header('Content-Type', 'text/csv');
    res.attachment(`${path.parse(task.fileName).name}_enrichi.csv`);
    res.send(task.csvData);
});

// Endpoint pour récupérer les données JSON d'une tâche terminée
app.get('/api/get-json-data/:taskId', (req, res) => {
    const { taskId } = req.params;
    const task = tasks[taskId];

    if (!task || task.status !== 'completed' || !task.data) {
        return res.status(404).json({ error: 'Données JSON non trouvées ou la tâche n est pas terminée.' });
    }
    res.json(task.data);
});

// Endpoint pour annuler une tâche
app.post('/api/cancel-task/:taskId', (req, res) => {
    const { taskId } = req.params;
    const task = tasks[taskId];

    if (!task) {
        return res.status(404).json({ error: 'Tâche non trouvée.' });
    }

    if (!task.cancellable || task.status === 'completed' || task.status === 'error' || task.status === 'cancelled' || task.status === 'cancelling') {
        return res.status(400).json({ error: 'La tâche ne peut pas être annulée ou est déjà en cours d annulation/terminée.' });
    }

    task.status = 'cancelling'; // Marquer pour annulation, la boucle de traitement vérifiera cet état
    task.cancellable = false;
    res.json({ message: 'Demande d annulation reçue.' });
});

app.get('/', (req, res) => {
    res.send('Backend GM-Tracabilite en cours d execution!');
});

app.listen(port, () => {
    console.log(`Backend GM-Tracabilite écoutant sur le port ${port}`);
});
