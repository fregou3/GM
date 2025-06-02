import React, { useState, useEffect } from 'react';
import Papa from 'papaparse';
import axios from 'axios';

const Home = () => {
  const [selectedFile, setSelectedFile] = useState(null);
  const [transformedCsvString, setTransformedCsvString] = useState('');
  const [csvPreviewData, setCsvPreviewData] = useState({ headers: [], rows: [] });
  const [isLoading, setIsLoading] = useState(false);
  const [status, setStatus] = useState('idle'); // 'idle', 'processing', 'completed'
  const [message, setMessage] = useState('');
  const [taskId, setTaskId] = useState(null);
  const [progress, setProgress] = useState(0);
  const [isTaskActive, setIsTaskActive] = useState(false);
  const [downloadCsvLink, setDownloadCsvLink] = useState('');
  const [s3Link, setS3Link] = useState('');
  const [processedJsonData, setProcessedJsonData] = useState(null);
  const [dbUploadStatus, setDbUploadStatus] = useState({ success: false, message: '', tableName: '' });
  const [replaceExisting, setReplaceExisting] = useState(false);

  // Fonction pour gérer le changement de fichier
  const handleFileChange = (event) => {
    const file = event.target.files[0];
    if (file) {
      setSelectedFile(file);
      parseCSV(file);
    }
  };

  // Fonction pour analyser le fichier CSV
  const parseCSV = (file) => {
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: function(results) {
        const csvData = results.data;
        
        // Prévisualisation des données
        const headers = results.meta.fields;
        const rows = csvData.slice(0, 5); // Prendre les 5 premières lignes pour la prévisualisation
        setCsvPreviewData({ headers, rows });
        
        // Transformer en chaîne CSV pour le téléchargement
        const csv = Papa.unparse(csvData);
        setTransformedCsvString(csv);
      },
      error: function(error) {
        console.error('Erreur lors de l\'analyse du CSV:', error);
        setMessage('Erreur lors de l\'analyse du CSV: ' + error.message);
      }
    });
  };

  // Fonction pour télécharger le CSV transformé
  const handleDownloadTransformedCsv = () => {
    if (!transformedCsvString) return;
    
    const blob = new Blob([transformedCsvString], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', 'transformed_data.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Fonction pour uploader le fichier au serveur
  const handleUpload = async () => {
    if (!selectedFile) return;
    
    setIsLoading(true);
    setStatus('processing');
    setMessage('');
    setProgress(0);
    setIsTaskActive(true);
    setDownloadCsvLink('');
    setS3Link('');
    setProcessedJsonData(null);
    
    const formData = new FormData();
    formData.append('csvfile', selectedFile);
    
    try {
      const response = await axios.post('http://localhost:3001/api/upload-csv', formData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      });
      
      if (response.data && response.data.taskId) {
        setTaskId(response.data.taskId);
        checkTaskStatus(response.data.taskId);
      } else {
        setIsLoading(false);
        setStatus('idle');
        setMessage('Erreur: Réponse du serveur invalide');
        setIsTaskActive(false);
      }
    } catch (error) {
      console.error('Erreur lors de l\'upload:', error);
      setIsLoading(false);
      setStatus('idle');
      setMessage('Erreur lors de l\'upload: ' + (error.response?.data?.error || error.message));
      setIsTaskActive(false);
    }
  };

  // Fonction pour vérifier le statut de la tâche
  const checkTaskStatus = async (id) => {
    try {
      const response = await axios.get(`http://localhost:3001/api/task-status/${id}`);
      const { status, progress, s3Link } = response.data;
      
      setProgress(progress || 0);
      
      if (status === 'completed') {
        setIsLoading(false);
        setStatus('completed');
        setMessage('Traitement terminé avec succès!');
        setIsTaskActive(false);
        // Définir l'URL de téléchargement CSV basée sur l'ID de la tâche
        setDownloadCsvLink(`http://localhost:3001/api/download-csv/${id}`);
        if (s3Link) setS3Link(s3Link);
      } else if (status === 'failed') {
        setIsLoading(false);
        setStatus('idle');
        setMessage('Échec du traitement: ' + (response.data.error || 'Erreur inconnue'));
        setIsTaskActive(false);
      } else {
        // Continuer à vérifier le statut toutes les 2 secondes
        setTimeout(() => checkTaskStatus(id), 2000);
      }
    } catch (error) {
      console.error('Erreur lors de la vérification du statut:', error);
      setIsLoading(false);
      setStatus('idle');
      setMessage('Erreur lors de la vérification du statut: ' + error.message);
      setIsTaskActive(false);
    }
  };

  // Fonction pour annuler une tâche
  const handleCancelTask = async () => {
    if (!taskId) return;
    
    try {
      await axios.post(`http://localhost:3001/api/tasks/${taskId}/cancel`);
      setIsLoading(false);
      setStatus('idle');
      setMessage('Tâche annulée');
      setIsTaskActive(false);
    } catch (error) {
      console.error('Erreur lors de l\'annulation de la tâche:', error);
      setMessage('Erreur lors de l\'annulation: ' + error.message);
    }
  };

  // Fonction pour récupérer les données JSON traitées
  const fetchJsonData = async (id) => {
    try {
      const response = await axios.get(`http://localhost:3001/api/tasks/${id}/data`);
      setProcessedJsonData(response.data);
    } catch (error) {
      console.error('Erreur lors de la récupération des données JSON:', error);
      setMessage('Erreur lors de la récupération des données JSON: ' + error.message);
    }
  };

  // Fonction pour uploader le fichier CSV à la base de données
  const handleUploadToDatabase = async () => {
    if (!selectedFile) return;
    
    setIsLoading(true);
    setDbUploadStatus({ success: false, message: '', tableName: '' });
    
    const formData = new FormData();
    formData.append('csvfile', selectedFile);
    formData.append('replaceExisting', replaceExisting);
    
    try {
      const response = await axios.post('http://localhost:3001/api/upload/csv-to-table', formData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      });
      
      setIsLoading(false);
      setDbUploadStatus({ 
        success: true, 
        message: response.data.message, 
        tableName: response.data.tableName 
      });
    } catch (error) {
      console.error('Erreur lors de l\'upload vers la base de données:', error);
      setIsLoading(false);
      setDbUploadStatus({ 
        success: false, 
        message: error.response?.data?.error || error.message, 
        tableName: '' 
      });
      setMessage('Erreur lors de l\'upload vers la base de données: ' + (error.response?.data?.error || error.message));
    }
  };

  return (
    <div className="clarins-container">
      <main>
        <div className="controls-container">
          <input type="file" accept=".csv" onChange={handleFileChange} disabled={isTaskActive} />
          <button 
            onClick={handleUpload} 
            disabled={isLoading || !transformedCsvString || isTaskActive} 
          >
            {isLoading && status !== 'completed' ? 'Traitement Serveur...' : 'Analyser via Serveur'}
          </button>
          {status === 'completed' && downloadCsvLink && (
            <a 
              href={downloadCsvLink} 
              download 
              target="_blank" 
              rel="noopener noreferrer" 
              className="download-button" 
              style={{ marginLeft: '10px' }}
            >
              Télécharger CSV Enrichi
            </a>
          )}
          <div style={{ 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'center', 
            margin: '20px auto',
            padding: '15px',
            backgroundColor: '#f8f9fa',
            borderRadius: '8px',
            boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
            maxWidth: '500px'
          }}>
            <button 
              onClick={handleUploadToDatabase} 
              disabled={isLoading || !selectedFile} 
              style={{ 
                backgroundColor: '#28a745',
                padding: '10px 15px',
                borderRadius: '4px',
                border: 'none',
                color: 'white',
                fontWeight: 'bold',
                cursor: 'pointer'
              }}
            >
              Upload Scans
            </button>
            <div className="checkbox-container">
              <input 
                type="checkbox" 
                id="replaceExisting" 
                checked={replaceExisting} 
                onChange={(e) => setReplaceExisting(e.target.checked)} 
              />
              <label htmlFor="replaceExisting">Remplacer si la table existe</label>
            </div>
          </div>
          {isTaskActive && taskId && (
            <button onClick={handleCancelTask} className="cancel-button">
              Annuler Tâche Serveur
            </button>
          )}
        </div>

        {isTaskActive && (
            <div className="progress-container analysis-section">
                <h3>Progression du traitement</h3>
                {progress !== undefined && (
                    <div className="progress-bar-container">
                        <div className="progress-bar" style={{ width: `${progress}%`, backgroundColor: 'var(--clarins-red)', color: 'white', textAlign: 'center', padding: '5px 0' }}>
                            {progress}%
                        </div>
                    </div>
                )}
            </div>
        )}

        {message && <div className="message analysis-section">{message}</div>}
        
        {dbUploadStatus.success && (
          <div className="success-message analysis-section">
            <h3>Import réussi dans la base de données</h3>
            <p>{dbUploadStatus.message}</p>
            <p>Table créée : <strong>{dbUploadStatus.tableName}</strong></p>
          </div>
        )}
        
        {csvPreviewData.rows.length > 0 && ( // Toujours afficher la preview si des données sont là
          <div className="preview-container analysis-section">
            <h3>Prévisualisation du fichier CSV transformé</h3>
            <p className="analysis-description">Les 5 premières lignes du fichier sont affichées ci-dessous</p>
            <div className="analysis-table-container">
              <table className="preview-table">
              <thead>
                <tr>
                  {csvPreviewData.headers.map((header, index) => (
                    <th key={index}>{header}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {csvPreviewData.rows.map((row, rowIndex) => (
                  <tr key={rowIndex}>
                    {csvPreviewData.headers.map((header, colIndex) => (
                      <td key={colIndex}>{row[header]}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
            </div>
          </div>
        )}

        {status === 'completed' && ( // Concerne le statut de la tâche serveur
            <div className="results-container analysis-section">
                <h3>Résultats du Traitement</h3>
                {/* Le bouton de téléchargement CSV est maintenant en haut de la page */}
                {s3Link && <p>Fichier disponible sur S3: <a href={s3Link} target="_blank" rel="noopener noreferrer" className="clarins-link">{s3Link}</a></p>}
                {!downloadCsvLink && !s3Link && !processedJsonData && <p>Aucun résultat à afficher ou télécharger.</p>}
                {taskId && !processedJsonData && <button onClick={() => fetchJsonData(taskId)} className="secondary-button">Afficher Données JSON</button>}
            </div>
        )}

        {processedJsonData && (
            <div className="json-data-container analysis-section">
                <h3>Données JSON Traitées</h3>
                <p className="analysis-description">Aperçu des 10 premières lignes</p>
                <pre style={{ textAlign: 'left', backgroundColor: 'var(--clarins-beige)', padding: '15px', maxHeight: '400px', overflowY: 'auto', border: '1px solid var(--clarins-border)' }}>
                    {JSON.stringify(processedJsonData.slice(0, 10), null, 2)} 
                    {/* Afficher les 10 premières lignes pour l'aperçu */}
                    {processedJsonData.length > 10 && <p>... et {processedJsonData.length - 10} autres lignes.</p>}
                </pre>
            </div>
        )}
      </main>
    </div>
  );
};

export default Home;
