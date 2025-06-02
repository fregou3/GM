import React, { useState, useEffect } from 'react';
import axios from 'axios';

const Analyse = () => {
  const [selectedTable, setSelectedTable] = useState('');
  const [tables, setTables] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [analysisResult, setAnalysisResult] = useState(null);
  const [analysisType, setAnalysisType] = useState('basic');

  // Charger la liste des tables au chargement de la page
  useEffect(() => {
    fetchTables();
  }, []);

  // Fonction pour récupérer la liste des tables
  const fetchTables = async () => {
    setLoading(true);
    setError('');
    
    try {
      const response = await axios.get('http://localhost:3001/api/database/tables');
      setTables(response.data.tables || []);
      setLoading(false);
    } catch (err) {
      console.error('Erreur lors de la récupération des tables:', err);
      setError('Erreur lors de la récupération des tables: ' + (err.response?.data?.error || err.message));
      setLoading(false);
    }
  };

  // Fonction pour lancer une analyse
  const runAnalysis = async () => {
    if (!selectedTable) {
      setError('Veuillez sélectionner une table à analyser');
      return;
    }

    setLoading(true);
    setError('');
    setAnalysisResult(null);
    
    try {
      // Déterminer le type d'API à appeler en fonction du type d'analyse sélectionné
      const analysisEndpoint = `http://localhost:3001/api/analyse/tables/${selectedTable}/${analysisType}`;
      
      // Afficher un message spécial pour l'analyse complète avec OpenAI
      if (analysisType === 'complete') {
        console.log('Lancement de l\'analyse complète avec OpenAI...');
      }
      
      const response = await axios.get(analysisEndpoint);
      console.log('Réponse de l\'API d\'analyse:', response.data);
      
      // S'assurer que la réponse a une structure valide pour éviter les erreurs
      let formattedResult = {
        tableName: response.data.tableName || selectedTable,
        statistics: response.data.statistics || {
          rowCount: 0,
          columnCount: 0,
          duplicateIdCount: 0,
          nullValues: { id_10_n: 0, ville_scan: 0 }
        },
        anomalies: {
          multiCityScans: [],
          rapidScans: []
        },
        recommendations: response.data.recommendations || [],
        aiAnalysis: response.data.aiAnalysis || null
      };
      
      // Fusionner avec les données réelles de la réponse
      if (response.data.statistics) {
        formattedResult.statistics = {
          ...formattedResult.statistics,
          ...response.data.statistics
        };
      }
      
      if (response.data.anomalies) {
        formattedResult.anomalies = {
          multiCityScans: response.data.anomalies.multiCityScans || [],
          rapidScans: response.data.anomalies.rapidScans || []
        };
      }
      
      // Ajouter les résultats des requêtes avancées pour les tables de scan
      if (response.data.advancedQueryResults) {
        formattedResult.advancedQueryResults = response.data.advancedQueryResults;
        formattedResult.isScanTable = response.data.isScanTable || false;
      }
      
      console.log('Résultat formaté:', formattedResult);
      setAnalysisResult(formattedResult);
      setLoading(false);
    } catch (err) {
      console.error(`Erreur lors de l'analyse de la table ${selectedTable}:`, err);
      setError(`Erreur lors de l'analyse de la table ${selectedTable}: ` + 
        (err.response?.data?.error || err.message));
      setLoading(false);
    }
  };

  return (
    <div style={{ padding: '20px' }}>
      <h2>Analyse des données</h2>
      
      {/* Sélection de la table */}
      <div style={{ marginBottom: '20px' }}>
        <label htmlFor="tableSelect" style={{ display: 'block', marginBottom: '5px' }}>
          Sélectionner une table à analyser:
        </label>
        <select 
          id="tableSelect"
          value={selectedTable}
          onChange={(e) => setSelectedTable(e.target.value)}
          style={{ 
            padding: '8px', 
            borderRadius: '4px', 
            border: '1px solid #ddd',
            width: '100%',
            maxWidth: '400px'
          }}
        >
          <option value="">-- Sélectionner une table --</option>
          {tables.map((table, index) => (
            <option key={index} value={table}>{table}</option>
          ))}
        </select>
      </div>
      
      {/* Options d'analyse */}
      <div style={{ marginBottom: '20px' }}>
        <label style={{ display: 'block', marginBottom: '5px' }}>
          Type d'analyse:
        </label>
        <div>
          <label style={{ marginRight: '15px' }}>
            <input 
              type="radio" 
              name="analysisType" 
              value="basic" 
              checked={analysisType === 'basic'} 
              onChange={() => setAnalysisType('basic')}
            /> Analyse basique
          </label>
          <label style={{ marginRight: '15px' }}>
            <input 
              type="radio" 
              name="analysisType" 
              value="advanced" 
              checked={analysisType === 'advanced'} 
              onChange={() => setAnalysisType('advanced')}
            /> Analyse avancée
          </label>
          <label>
            <input 
              type="radio" 
              name="analysisType" 
              value="complete" 
              checked={analysisType === 'complete'} 
              onChange={() => setAnalysisType('complete')}
            /> Analyse complète (OpenAI)
          </label>
        </div>
      </div>
      
      {/* Bouton d'analyse */}
      <button 
        onClick={runAnalysis}
        disabled={loading || !selectedTable}
        style={{ 
          padding: '10px 15px', 
          backgroundColor: '#007bff', 
          color: 'white', 
          border: 'none', 
          borderRadius: '4px',
          cursor: loading || !selectedTable ? 'not-allowed' : 'pointer',
          opacity: loading || !selectedTable ? 0.7 : 1
        }}
      >
        {loading ? 'Analyse en cours...' : 'Lancer l\'analyse'}
      </button>
      
      {/* Affichage des erreurs */}
      {error && (
        <div style={{ 
          marginTop: '20px', 
          padding: '10px', 
          backgroundColor: '#f8d7da', 
          color: '#721c24',
          borderRadius: '4px'
        }}>
          {error}
        </div>
      )}
      
      {/* Affichage des résultats d'analyse */}
      {analysisResult && !loading && !error && (
        <div style={{ marginTop: '30px' }}>
          <h3>Résultats de l'analyse pour la table {analysisResult.tableName}</h3>
          
          {/* Statistiques et qualité des données */}
          <div style={{ 
            display: 'flex', 
            flexWrap: 'wrap', 
            gap: '20px',
            marginBottom: '20px'
          }}>
            <div style={{ 
              flex: '1 1 200px', 
              padding: '15px', 
              backgroundColor: 'white', 
              borderRadius: '8px',
              boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
            }}>
              <h4 style={{ margin: '0 0 10px 0', color: '#333' }}>Statistiques générales</h4>
              <p><strong>Nombre de lignes:</strong> {analysisResult.statistics?.rowCount}</p>
              <p><strong>Nombre de colonnes:</strong> {analysisResult.statistics?.columnCount}</p>
            </div>
            
            <div style={{ 
              flex: '1 1 200px', 
              padding: '15px', 
              backgroundColor: 'white', 
              borderRadius: '8px',
              boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
            }}>
              <h4 style={{ margin: '0 0 10px 0', color: '#333' }}>Qualité des données</h4>
              <p><strong>Doublons d'identifiants:</strong> {analysisResult.statistics?.duplicateIdCount || 0}</p>
              <p><strong>Valeurs nulles (id_10_n):</strong> {analysisResult.statistics?.nullValues?.id_10_n || 0}</p>
              <p><strong>Valeurs nulles (ville_scan):</strong> {analysisResult.statistics?.nullValues?.ville_scan || 0}</p>
            </div>
          </div>
          
          {/* Affichage des anomalies détectées (pour l'analyse avancée et complète) */}
          <div style={{ marginBottom: '20px' }}>
            <h4 style={{ margin: '0 0 10px 0', color: '#333' }}>Anomalies détectées</h4>
            
            {/* Anomalies multi-villes - vérification sécurisée */}
            {(() => {
              try {
                const multiCityScans = analysisResult?.anomalies?.multiCityScans || [];
                if (multiCityScans.length > 0) {
                  return (
                    <div style={{ 
                      padding: '15px', 
                      backgroundColor: '#fff3cd', 
                      borderRadius: '8px',
                      boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
                      marginBottom: '15px'
                    }}>
                      <h5 style={{ margin: '0 0 10px 0', color: '#856404' }}>Identifiants scannés dans plusieurs villes</h5>
                      <p>{multiCityScans.length} identifiants ont été scannés dans plusieurs villes différentes.</p>
                      <div style={{ maxHeight: '150px', overflowY: 'auto', border: '1px solid #ddd', padding: '10px', borderRadius: '4px' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                          <thead>
                            <tr>
                              <th style={{ textAlign: 'left', padding: '8px', borderBottom: '1px solid #ddd' }}>ID</th>
                              <th style={{ textAlign: 'left', padding: '8px', borderBottom: '1px solid #ddd' }}>Nombre de villes</th>
                              <th style={{ textAlign: 'left', padding: '8px', borderBottom: '1px solid #ddd' }}>Villes</th>
                            </tr>
                          </thead>
                          <tbody>
                            {multiCityScans.slice(0, 5).map((item, index) => (
                              <tr key={index}>
                                <td style={{ padding: '8px', borderBottom: '1px solid #ddd' }}>{item.id_10_n}</td>
                                <td style={{ padding: '8px', borderBottom: '1px solid #ddd' }}>{item.cityCount}</td>
                                <td style={{ padding: '8px', borderBottom: '1px solid #ddd' }}>{Array.isArray(item.cities) ? item.cities.join(', ') : 'N/A'}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                        {multiCityScans.length > 5 && (
                          <p style={{ textAlign: 'center', marginTop: '10px' }}>
                            + {multiCityScans.length - 5} autres anomalies similaires
                          </p>
                        )}
                      </div>
                    </div>
                  );
                }
                return null;
              } catch (error) {
                console.error('Erreur lors du rendu des anomalies multi-villes:', error);
                return null;
              }
            })()}
            
            {/* Anomalies scans rapides - vérification sécurisée */}
            {(() => {
              try {
                const rapidScans = analysisResult?.anomalies?.rapidScans || [];
                if (rapidScans.length > 0) {
                  return (
                    <div style={{ 
                      padding: '15px', 
                      backgroundColor: '#fff3cd', 
                      borderRadius: '8px',
                      boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
                    }}>
                      <h5 style={{ margin: '0 0 10px 0', color: '#856404' }}>Scans trop rapprochés dans le temps</h5>
                      <p>{rapidScans.length} identifiants ont des scans trop rapprochés dans le temps (moins d'une heure).</p>
                      <div style={{ maxHeight: '150px', overflowY: 'auto', border: '1px solid #ddd', padding: '10px', borderRadius: '4px' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                          <thead>
                            <tr>
                              <th style={{ textAlign: 'left', padding: '8px', borderBottom: '1px solid #ddd' }}>ID</th>
                              <th style={{ textAlign: 'left', padding: '8px', borderBottom: '1px solid #ddd' }}>Premier scan</th>
                              <th style={{ textAlign: 'left', padding: '8px', borderBottom: '1px solid #ddd' }}>Dernier scan</th>
                              <th style={{ textAlign: 'left', padding: '8px', borderBottom: '1px solid #ddd' }}>Heures entre</th>
                            </tr>
                          </thead>
                          <tbody>
                            {rapidScans.slice(0, 5).map((item, index) => (
                              <tr key={index}>
                                <td style={{ padding: '8px', borderBottom: '1px solid #ddd' }}>{item.id_10_n}</td>
                                <td style={{ padding: '8px', borderBottom: '1px solid #ddd' }}>{new Date(item.firstScan).toLocaleString()}</td>
                                <td style={{ padding: '8px', borderBottom: '1px solid #ddd' }}>{new Date(item.lastScan).toLocaleString()}</td>
                                <td style={{ padding: '8px', borderBottom: '1px solid #ddd' }}>{typeof item.hoursBetween === 'number' ? item.hoursBetween.toFixed(2) : 'N/A'}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                        {rapidScans.length > 5 && (
                          <p style={{ textAlign: 'center', marginTop: '10px' }}>
                            + {rapidScans.length - 5} autres anomalies similaires
                          </p>
                        )}
                      </div>
                    </div>
                  );
                }
                return null;
              } catch (error) {
                console.error('Erreur lors du rendu des anomalies de scans rapides:', error);
                return null;
              }
            })()}
            
            {/* Message si aucune anomalie n'est détectée */}
            {(!analysisResult?.anomalies?.multiCityScans?.length && !analysisResult?.anomalies?.rapidScans?.length) && (
              <div style={{ padding: '15px', backgroundColor: '#d4edda', borderRadius: '8px', color: '#155724' }}>
                Aucune anomalie détectée dans les données.
              </div>
            )}
          </div>
          
          {/* Affichage des résultats des requêtes avancées pour les tables de scan */}
          {analysisResult.isScanTable && analysisResult.advancedQueryResults && analysisType === 'advanced' && (
            <div style={{ marginBottom: '30px' }}>
              <h4 style={{ margin: '20px 0 15px 0', color: '#333', borderBottom: '2px solid #007bff', paddingBottom: '5px' }}>
                Analyses avancées pour les tables de scan
              </h4>
              
              {/* Tableau des identifiants dupliqués */}
              {analysisResult.advancedQueryResults.duplicatedIdentifiers && 
               analysisResult.advancedQueryResults.duplicatedIdentifiers.data && 
               analysisResult.advancedQueryResults.duplicatedIdentifiers.data.length > 0 && (
                <div style={{ 
                  marginBottom: '20px',
                  padding: '15px', 
                  backgroundColor: 'white', 
                  borderRadius: '8px',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
                }}>
                  <h5 style={{ margin: '0 0 10px 0', color: '#333' }}>
                    {analysisResult.advancedQueryResults.duplicatedIdentifiers.title}
                  </h5>
                  <p>{analysisResult.advancedQueryResults.duplicatedIdentifiers.description}</p>
                  
                  <div style={{ maxHeight: '300px', overflowY: 'auto', border: '1px solid #ddd', padding: '10px', borderRadius: '4px' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                      <thead>
                        <tr>
                          <th style={{ textAlign: 'left', padding: '8px', borderBottom: '1px solid #ddd', backgroundColor: '#f8f9fa' }}>Identifiant</th>
                          <th style={{ textAlign: 'left', padding: '8px', borderBottom: '1px solid #ddd', backgroundColor: '#f8f9fa' }}>Nombre d'occurrences</th>
                        </tr>
                      </thead>
                      <tbody>
                        {analysisResult.advancedQueryResults.duplicatedIdentifiers.data.map((item, index) => (
                          <tr key={index} style={{ backgroundColor: index % 2 === 0 ? '#ffffff' : '#f8f9fa' }}>
                            <td style={{ padding: '8px', borderBottom: '1px solid #ddd' }}>{item.identifier}</td>
                            <td style={{ padding: '8px', borderBottom: '1px solid #ddd' }}>{item.nombre_occurrences}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
              
              {/* Tableau des ID 10N dupliqués */}
              {analysisResult.advancedQueryResults.duplicatedId10n && 
               analysisResult.advancedQueryResults.duplicatedId10n.data && 
               analysisResult.advancedQueryResults.duplicatedId10n.data.length > 0 && (
                <div style={{ 
                  marginBottom: '20px',
                  padding: '15px', 
                  backgroundColor: 'white', 
                  borderRadius: '8px',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
                }}>
                  <h5 style={{ margin: '0 0 10px 0', color: '#333' }}>
                    {analysisResult.advancedQueryResults.duplicatedId10n.title}
                  </h5>
                  <p>{analysisResult.advancedQueryResults.duplicatedId10n.description}</p>
                  
                  <div style={{ maxHeight: '300px', overflowY: 'auto', border: '1px solid #ddd', padding: '10px', borderRadius: '4px' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                      <thead>
                        <tr>
                          <th style={{ textAlign: 'left', padding: '8px', borderBottom: '1px solid #ddd', backgroundColor: '#f8f9fa' }}>ID 10N</th>
                          <th style={{ textAlign: 'left', padding: '8px', borderBottom: '1px solid #ddd', backgroundColor: '#f8f9fa' }}>Nombre d'occurrences</th>
                        </tr>
                      </thead>
                      <tbody>
                        {analysisResult.advancedQueryResults.duplicatedId10n.data.map((item, index) => (
                          <tr key={index} style={{ backgroundColor: index % 2 === 0 ? '#ffffff' : '#f8f9fa' }}>
                            <td style={{ padding: '8px', borderBottom: '1px solid #ddd' }}>{item.id_10_n}</td>
                            <td style={{ padding: '8px', borderBottom: '1px solid #ddd' }}>{item.nombre_occurrences}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
              
              {/* Tableau des scans multi-pays */}
              {analysisResult.advancedQueryResults.multiCountryScans && 
               analysisResult.advancedQueryResults.multiCountryScans.data && 
               analysisResult.advancedQueryResults.multiCountryScans.data.length > 0 && (
                <div style={{ 
                  marginBottom: '20px',
                  padding: '15px', 
                  backgroundColor: 'white', 
                  borderRadius: '8px',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
                }}>
                  <h5 style={{ margin: '0 0 10px 0', color: '#333' }}>
                    {analysisResult.advancedQueryResults.multiCountryScans.title}
                  </h5>
                  <p>{analysisResult.advancedQueryResults.multiCountryScans.description}</p>
                  
                  <div style={{ maxHeight: '300px', overflowY: 'auto', border: '1px solid #ddd', padding: '10px', borderRadius: '4px' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                      <thead>
                        <tr>
                          <th style={{ textAlign: 'left', padding: '8px', borderBottom: '1px solid #ddd', backgroundColor: '#f8f9fa' }}>Identifiant</th>
                          <th style={{ textAlign: 'left', padding: '8px', borderBottom: '1px solid #ddd', backgroundColor: '#f8f9fa' }}>Nombre de pays</th>
                          <th style={{ textAlign: 'left', padding: '8px', borderBottom: '1px solid #ddd', backgroundColor: '#f8f9fa' }}>Liste des pays</th>
                          <th style={{ textAlign: 'left', padding: '8px', borderBottom: '1px solid #ddd', backgroundColor: '#f8f9fa' }}>Nombre de scans</th>
                        </tr>
                      </thead>
                      <tbody>
                        {analysisResult.advancedQueryResults.multiCountryScans.data.map((item, index) => (
                          <tr key={index} style={{ backgroundColor: index % 2 === 0 ? '#ffffff' : '#f8f9fa' }}>
                            <td style={{ padding: '8px', borderBottom: '1px solid #ddd' }}>{item.identifier}</td>
                            <td style={{ padding: '8px', borderBottom: '1px solid #ddd' }}>{item.nombre_pays}</td>
                            <td style={{ padding: '8px', borderBottom: '1px solid #ddd' }}>{Array.isArray(item.liste_pays) ? item.liste_pays.join(', ') : 'N/A'}</td>
                            <td style={{ padding: '8px', borderBottom: '1px solid #ddd' }}>{item.nombre_scans}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
              
              {/* Tableau des informations manquantes */}
              {analysisResult.advancedQueryResults.missingInfo && 
               analysisResult.advancedQueryResults.missingInfo.data && 
               analysisResult.advancedQueryResults.missingInfo.data.length > 0 && (
                <div style={{ 
                  marginBottom: '20px',
                  padding: '15px', 
                  backgroundColor: 'white', 
                  borderRadius: '8px',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
                }}>
                  <h5 style={{ margin: '0 0 10px 0', color: '#333' }}>
                    {analysisResult.advancedQueryResults.missingInfo.title}
                  </h5>
                  <p>{analysisResult.advancedQueryResults.missingInfo.description}</p>
                  
                  <div style={{ maxHeight: '300px', overflowY: 'auto', border: '1px solid #ddd', padding: '10px', borderRadius: '4px' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                      <thead>
                        <tr>
                          <th style={{ textAlign: 'left', padding: '8px', borderBottom: '1px solid #ddd', backgroundColor: '#f8f9fa' }}>Identifiant</th>
                          <th style={{ textAlign: 'left', padding: '8px', borderBottom: '1px solid #ddd', backgroundColor: '#f8f9fa' }}>ID 10N</th>
                          <th style={{ textAlign: 'left', padding: '8px', borderBottom: '1px solid #ddd', backgroundColor: '#f8f9fa' }}>Ref M3</th>
                          <th style={{ textAlign: 'left', padding: '8px', borderBottom: '1px solid #ddd', backgroundColor: '#f8f9fa' }}>Date scan</th>
                        </tr>
                      </thead>
                      <tbody>
                        {analysisResult.advancedQueryResults.missingInfo.data.map((item, index) => (
                          <tr key={index} style={{ backgroundColor: index % 2 === 0 ? '#ffffff' : '#f8f9fa' }}>
                            <td style={{ padding: '8px', borderBottom: '1px solid #ddd' }}>{item.identifier}</td>
                            <td style={{ padding: '8px', borderBottom: '1px solid #ddd' }}>{item.id_10_n}</td>
                            <td style={{ padding: '8px', borderBottom: '1px solid #ddd' }}>{item.ref_m3}</td>
                            <td style={{ padding: '8px', borderBottom: '1px solid #ddd' }}>{item.date_scan}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
              
              {/* Tableau des multi-types d'envoi */}
              {analysisResult.advancedQueryResults.multiTypeScans && 
               analysisResult.advancedQueryResults.multiTypeScans.data && 
               analysisResult.advancedQueryResults.multiTypeScans.data.length > 0 && (
                <div style={{ 
                  marginBottom: '20px',
                  padding: '15px', 
                  backgroundColor: 'white', 
                  borderRadius: '8px',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
                }}>
                  <h5 style={{ margin: '0 0 10px 0', color: '#333' }}>
                    {analysisResult.advancedQueryResults.multiTypeScans.title}
                  </h5>
                  <p>{analysisResult.advancedQueryResults.multiTypeScans.description}</p>
                  
                  <div style={{ maxHeight: '300px', overflowY: 'auto', border: '1px solid #ddd', padding: '10px', borderRadius: '4px' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                      <thead>
                        <tr>
                          <th style={{ textAlign: 'left', padding: '8px', borderBottom: '1px solid #ddd', backgroundColor: '#f8f9fa' }}>Identifiant</th>
                          <th style={{ textAlign: 'left', padding: '8px', borderBottom: '1px solid #ddd', backgroundColor: '#f8f9fa' }}>Nombre de types</th>
                          <th style={{ textAlign: 'left', padding: '8px', borderBottom: '1px solid #ddd', backgroundColor: '#f8f9fa' }}>Types d'envoi</th>
                          <th style={{ textAlign: 'left', padding: '8px', borderBottom: '1px solid #ddd', backgroundColor: '#f8f9fa' }}>Nombre de scans</th>
                        </tr>
                      </thead>
                      <tbody>
                        {analysisResult.advancedQueryResults.multiTypeScans.data.map((item, index) => (
                          <tr key={index} style={{ backgroundColor: index % 2 === 0 ? '#ffffff' : '#f8f9fa' }}>
                            <td style={{ padding: '8px', borderBottom: '1px solid #ddd' }}>{item.identifier}</td>
                            <td style={{ padding: '8px', borderBottom: '1px solid #ddd' }}>{item.nombre_types_envoi}</td>
                            <td style={{ padding: '8px', borderBottom: '1px solid #ddd' }}>{Array.isArray(item.types_envoi) ? item.types_envoi.join(', ') : 'N/A'}</td>
                            <td style={{ padding: '8px', borderBottom: '1px solid #ddd' }}>{item.nombre_scans}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
              
              {/* Message si aucune anomalie avancée n'est détectée */}
              {(!analysisResult.advancedQueryResults.duplicatedIdentifiers?.data?.length && 
                !analysisResult.advancedQueryResults.duplicatedId10n?.data?.length && 
                !analysisResult.advancedQueryResults.multiCountryScans?.data?.length && 
                !analysisResult.advancedQueryResults.missingInfo?.data?.length && 
                !analysisResult.advancedQueryResults.multiTypeScans?.data?.length) && (
                <div style={{ padding: '15px', backgroundColor: '#d4edda', borderRadius: '8px', color: '#155724' }}>
                  Aucune anomalie avancée détectée dans cette table de scan.
                </div>
              )}
            </div>
          )}
          
          {/* Recommandations */}
          {analysisResult.recommendations && analysisResult.recommendations.length > 0 && (
            <div style={{ 
              marginBottom: '20px',
              padding: '15px', 
              backgroundColor: 'white', 
              borderRadius: '8px',
              boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
            }}>
              <h4 style={{ margin: '0 0 10px 0', color: '#333' }}>Recommandations</h4>
              <ul style={{ paddingLeft: '20px' }}>
                {analysisResult.recommendations.map((rec, index) => (
                  <li key={index} style={{ marginBottom: '5px' }}>{rec}</li>
                ))}
              </ul>
            </div>
          )}
          
          {/* Résultats de l'analyse OpenAI (pour l'analyse complète) */}
          {analysisResult.aiAnalysis && (
            <div style={{ 
              marginBottom: '20px',
              padding: '15px', 
              backgroundColor: '#f0f8ff', 
              borderRadius: '8px',
              boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
              border: '1px solid #b8daff'
            }}>
              <h4 style={{ margin: '0 0 10px 0', color: '#004085' }}>
                <span role="img" aria-label="IA">🤖</span> Analyse d'OpenAI
              </h4>
              
              {/* Anomalies détectées par l'IA */}
              {analysisResult.aiAnalysis.anomalies && (
                <div style={{ marginBottom: '15px' }}>
                  <h5 style={{ margin: '0 0 5px 0', color: '#004085' }}>Anomalies détectées</h5>
                  <ul style={{ paddingLeft: '20px' }}>
                    {analysisResult.aiAnalysis.anomalies.map((anomaly, index) => (
                      <li key={`ai-anomaly-${index}`} style={{ marginBottom: '5px' }}>{anomaly}</li>
                    ))}
                  </ul>
                </div>
              )}
              
              {/* Évaluation des risques */}
              {analysisResult.aiAnalysis.riskLevel && (
                <div style={{ marginBottom: '15px' }}>
                  <h5 style={{ margin: '0 0 5px 0', color: '#004085' }}>Évaluation des risques</h5>
                  <div style={{ 
                    padding: '10px', 
                    backgroundColor: 
                      analysisResult.aiAnalysis.riskLevel === 'Élevé' ? '#f8d7da' : 
                      analysisResult.aiAnalysis.riskLevel === 'Moyen' ? '#fff3cd' : '#d4edda',
                    color: 
                      analysisResult.aiAnalysis.riskLevel === 'Élevé' ? '#721c24' : 
                      analysisResult.aiAnalysis.riskLevel === 'Moyen' ? '#856404' : '#155724',
                    borderRadius: '4px'
                  }}>
                    <strong>Niveau de risque: {analysisResult.aiAnalysis.riskLevel}</strong>
                    {analysisResult.aiAnalysis.riskDescription && (
                      <p style={{ margin: '5px 0 0 0' }}>{analysisResult.aiAnalysis.riskDescription}</p>
                    )}
                  </div>
                </div>
              )}
              
              {/* Insights supplémentaires */}
              {analysisResult.aiAnalysis.insights && (
                <div style={{ marginBottom: '15px' }}>
                  <h5 style={{ margin: '0 0 5px 0', color: '#004085' }}>Insights</h5>
                  <p style={{ margin: '0', lineHeight: '1.5' }}>{analysisResult.aiAnalysis.insights}</p>
                </div>
              )}
              
              {/* Recommandations de l'IA */}
              {analysisResult.aiAnalysis.recommendations && analysisResult.aiAnalysis.recommendations.length > 0 && (
                <div>
                  <h5 style={{ margin: '0 0 5px 0', color: '#004085' }}>Recommandations</h5>
                  <ul style={{ paddingLeft: '20px' }}>
                    {analysisResult.aiAnalysis.recommendations.map((rec, index) => (
                      <li key={`ai-${index}`} style={{ marginBottom: '5px', color: '#0c5460' }}>
                        <span role="img" aria-label="IA">🤖</span> {rec}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default Analyse;
