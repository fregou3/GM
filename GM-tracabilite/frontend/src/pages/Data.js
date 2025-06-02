import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';

const Data = () => {
  const [tables, setTables] = useState([]);
  const [selectedTable, setSelectedTable] = useState('');
  const [tableData, setTableData] = useState({ columns: [], rows: [] });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [editMode, setEditMode] = useState(false);
  const [editingRow, setEditingRow] = useState(null);
  const [editedData, setEditedData] = useState({});
  const [newRow, setNewRow] = useState({});
  const tableContainerRef = useRef(null);
  const scrollbarRef = useRef(null);

  // Charger la liste des tables au chargement de la page
  useEffect(() => {
    fetchTables();
  }, []);
  
  // Effet pour synchroniser le défilement horizontal entre le tableau et la barre de défilement
  useEffect(() => {
    const tableContainer = tableContainerRef.current;
    const scrollbar = scrollbarRef.current;
    
    if (!tableContainer || !scrollbar) return;
    
    const handleTableScroll = () => {
      scrollbar.scrollLeft = tableContainer.scrollLeft;
    };
    
    const handleScrollbarScroll = () => {
      tableContainer.scrollLeft = scrollbar.scrollLeft;
    };
    
    tableContainer?.addEventListener('scroll', handleTableScroll);
    scrollbar?.addEventListener('scroll', handleScrollbarScroll);
    
    return () => {
      tableContainer?.removeEventListener('scroll', handleTableScroll);
      scrollbar?.removeEventListener('scroll', handleScrollbarScroll);
    };
  }, [selectedTable, tableData]);

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

  // Fonction pour récupérer les données d'une table
  const fetchTableData = async (tableName) => {
    if (!tableName) return;
    
    setLoading(true);
    setError('');
    setSelectedTable(tableName);
    setEditMode(false);
    setEditingRow(null);
    setEditedData({});
    
    try {
      const response = await axios.get(`http://localhost:3001/api/database/tables/${tableName}/data`);
      
      if (response.data && response.data.rows) {
        // Extraire les noms de colonnes à partir du premier objet
        const columns = response.data.rows.length > 0 
          ? Object.keys(response.data.rows[0]) 
          : [];
        
        setTableData({
          columns,
          rows: response.data.rows
        });
        
        // Initialiser newRow avec des valeurs vides pour chaque colonne
        const emptyRow = {};
        columns.forEach(col => emptyRow[col] = '');
        setNewRow(emptyRow);
      } else {
        setTableData({ columns: [], rows: [] });
      }
      
      setLoading(false);
    } catch (err) {
      console.error(`Erreur lors de la récupération des données de la table ${tableName}:`, err);
      setError(`Erreur lors de la récupération des données: ${err.response?.data?.error || err.message}`);
      setLoading(false);
    }
  };

  // Fonction pour activer le mode édition
  const handleEditMode = (e) => {
    e.stopPropagation(); // Empêche le déclenchement du onClick du li parent
    setEditMode(true);
  };

  // Fonction pour commencer l'édition d'une ligne
  const startEditing = (rowIndex) => {
    console.log('Début de l\'édition de la ligne:', rowIndex);
    console.log('Données originales:', tableData.rows[rowIndex]);
    setEditingRow(rowIndex);
    // Copier toutes les données de la ligne pour l'édition
    setEditedData({...tableData.rows[rowIndex]});
  };

  // Fonction pour annuler l'édition
  const cancelEditing = () => {
    setEditingRow(null);
    setEditedData({});
  };

  // Fonction pour gérer les changements dans les champs d'édition
  const handleEditChange = (column, value) => {
    console.log(`Modification de la colonne "${column}" avec la valeur:`, value);
    setEditedData(prev => {
      const updated = {
        ...prev,
        [column]: value
      };
      console.log('Données mises à jour:', updated);
      return updated;
    });
  };

  // Fonction pour gérer les changements dans les champs de nouvelle ligne
  const handleNewRowChange = (column, value) => {
    setNewRow(prev => ({
      ...prev,
      [column]: value
    }));
  };

  // Fonction pour sauvegarder une ligne modifiée
  const saveEditedRow = async (rowIndex) => {
    try {
      setLoading(true);
      
      // Identifier la clé primaire (supposons que c'est la première colonne ou 'id')
      const primaryKey = tableData.columns[0];
      const primaryKeyValue = tableData.rows[rowIndex][primaryKey];
      
      console.log('Sauvegarde de la ligne:', rowIndex);
      console.log('Clé primaire:', primaryKey, 'Valeur:', primaryKeyValue);
      console.log('Données originales:', tableData.rows[rowIndex]);
      console.log('Données éditées:', editedData);
      
      // S'assurer que la clé primaire est préservée dans les données éditées
      const dataToSend = { 
        ...editedData,
        [primaryKey]: primaryKeyValue // Garantir que la clé primaire est préservée
      };
      
      console.log('Données envoyées au serveur:', dataToSend);
      
      const response = await axios.put(`http://localhost:3001/api/database/tables/${selectedTable}/row`, {
        primaryKey,
        primaryKeyValue,
        data: dataToSend
      });
      
      console.log('Réponse du serveur:', response.data);
      
      // Mettre à jour les données localement avec les données retournées par le serveur
      const updatedRows = [...tableData.rows];
      updatedRows[rowIndex] = response.data.row || dataToSend;
      
      console.log('Données mises à jour localement:', updatedRows[rowIndex]);
      
      setTableData({
        columns: tableData.columns,
        rows: updatedRows
      });
      
      setEditingRow(null);
      setEditedData({});
      setLoading(false);
    } catch (err) {
      console.error('Erreur lors de la mise à jour de la ligne:', err);
      setError(`Erreur lors de la mise à jour: ${err.response?.data?.error || err.message}`);
      setLoading(false);
    }
  };

  // Fonction pour ajouter une nouvelle ligne
  const addNewRow = async () => {
    try {
      setLoading(true);
      
      const response = await axios.post(`http://localhost:3001/api/database/tables/${selectedTable}/row`, {
        data: newRow
      });
      
      // Ajouter la nouvelle ligne aux données locales
      setTableData({
        columns: tableData.columns,
        rows: [...tableData.rows, newRow]
      });
      
      // Réinitialiser le formulaire de nouvelle ligne
      const emptyRow = {};
      tableData.columns.forEach(col => emptyRow[col] = '');
      setNewRow(emptyRow);
      
      setLoading(false);
    } catch (err) {
      console.error('Erreur lors de l\'ajout d\'une nouvelle ligne:', err);
      setError(`Erreur lors de l'ajout: ${err.response?.data?.error || err.message}`);
      setLoading(false);
    }
  };

  // Fonction pour supprimer une ligne
  const deleteRow = async (rowIndex) => {
    if (!window.confirm('Êtes-vous sûr de vouloir supprimer cette ligne ?')) return;
    
    try {
      setLoading(true);
      
      // Identifier la clé primaire (supposons que c'est la première colonne ou 'id')
      const primaryKey = tableData.columns[0];
      const primaryKeyValue = tableData.rows[rowIndex][primaryKey];
      
      await axios.delete(`http://localhost:3001/api/database/tables/${selectedTable}/row`, {
        data: {
          primaryKey,
          primaryKeyValue
        }
      });
      
      // Mettre à jour les données localement
      const updatedRows = tableData.rows.filter((_, index) => index !== rowIndex);
      setTableData({
        columns: tableData.columns,
        rows: updatedRows
      });
      
      setLoading(false);
    } catch (err) {
      console.error('Erreur lors de la suppression de la ligne:', err);
      setError(`Erreur lors de la suppression: ${err.response?.data?.error || err.message}`);
      setLoading(false);
    }
  };

  return (
    <div className="container-fluid" style={{ padding: '20px', height: 'calc(100vh - 40px)', display: 'flex', flexDirection: 'column' }}>
      <h2>Gestion des Données</h2>
      
      {error && <div className="alert alert-danger">{error}</div>}
      
      <div style={{ display: 'flex', gap: '20px', flexWrap: 'nowrap', flex: '1 1 auto', overflow: 'hidden' }}>
        <div style={{ width: '220px', minWidth: '220px', maxWidth: '250px', overflowY: 'auto' }}>
          <h3>Tables disponibles</h3>
          {loading && <p>Chargement...</p>}
          {error && <p style={{ color: 'red' }}>{error}</p>}
          
          {tables.length === 0 && !loading && !error ? (
            <p>Aucune table disponible. Importez des données depuis la page d'accueil.</p>
          ) : (
            <ul style={{ 
              listStyle: 'none', 
              padding: 0, 
              margin: 0, 
              maxHeight: '500px', 
              overflowY: 'auto',
              border: '1px solid #ddd',
              borderRadius: '4px'
            }}>
              {tables.map(table => (
                <li 
                  key={table} 
                  onClick={() => fetchTableData(table)}
                  style={{ 
                    padding: '10px', 
                    borderBottom: '1px solid #eee',
                    backgroundColor: selectedTable === table ? '#f0f0f0' : 'transparent',
                    cursor: 'pointer',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center'
                  }}
                >
                  <span>{table}</span>
                  <button 
                    className="clarins-button-secondary"
                    onClick={(e) => {
                      e.stopPropagation();
                      fetchTableData(table);
                      setEditMode(true);
                    }}
                    style={{
                      padding: '4px 8px',
                      fontSize: '12px',
                      marginLeft: '10px'
                    }}
                  >
                    Modifier
                  </button>
                </li>
              ))}
            </ul>
          )}
          
          <button 
            onClick={fetchTables} 
            style={{ 
              marginTop: '10px',
              padding: '8px 15px',
              backgroundColor: '#17a2b8',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer'
            }}
          >
            Rafraîchir
          </button>
        </div>
                <div style={{ flex: '1 1 auto', minWidth: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          {selectedTable ? (
            <>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
                <h3 style={{ margin: 0 }}>Données de la table: {selectedTable}</h3>
                {!editMode ? (
                  <button 
                    className="clarins-button-primary"
                    onClick={handleEditMode}
                  >
                    Mode Édition
                  </button>
                ) : (
                  <button 
                    className="clarins-button-secondary"
                    onClick={() => setEditMode(false)}
                  >
                    Quitter Mode Édition
                  </button>
                )}
              </div>
              {loading ? (
                <p>Chargement des données...</p>
              ) : (
                <div style={{ 
                    display: 'flex', 
                    flexDirection: 'column', 
                    position: 'relative',
                    height: 'calc(100vh - 150px)',
                    overflow: 'hidden'
                  }}
                >
                  {/* Conteneur principal des données */}
                  <div 
                    ref={tableContainerRef}
                    style={{ 
                      flex: '1 1 auto',
                      overflowX: 'hidden',
                      overflowY: 'auto'
                    }}
                  >
                    {tableData.rows.length > 0 || editMode ? (
                      <table style={{ 
                        width: 'max-content', 
                        minWidth: '100%',
                        borderCollapse: 'collapse', 
                        border: '1px solid #ddd',
                        tableLayout: 'fixed'
                      }}>
                      <thead>
                        <tr style={{ backgroundColor: '#f2f2f2' }}>
                        {tableData.columns.map(column => (
                          <th 
                            key={column} 
                            style={{ 
                              padding: '10px', 
                              borderBottom: '2px solid #ddd',
                              textAlign: 'left',
                              whiteSpace: 'nowrap',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              minWidth: column === 'useragent' ? '300px' : '150px'
                            }}
                          >
                            {column}
                          </th>
                        ))}
                        {editMode && <th style={{ padding: '10px', borderBottom: '2px solid #ddd', width: '150px', position: 'sticky', right: 0, backgroundColor: '#f2f2f2', zIndex: 1 }}>Actions</th>}
                      </tr>
                    </thead>
                    <tbody>
                      {tableData.rows.map((row, rowIndex) => (
                        <tr 
                          key={rowIndex}
                          style={{ 
                            backgroundColor: rowIndex % 2 === 0 ? 'white' : '#f9f9f9'
                          }}
                        >
                          {editingRow === rowIndex ? (
                              // Mode édition pour cette ligne
                              <>
                                {tableData.columns.map(column => (
                                  <td key={column} style={{ padding: '5px' }}>
                                    <input
                                      type="text"
                                      value={editedData[column] || ''}
                                      onChange={(e) => handleEditChange(column, e.target.value)}
                                      style={{ width: '100%', padding: '5px' }}
                                    />
                                  </td>
                                ))}
                                <td style={{ padding: '5px', whiteSpace: 'nowrap', position: 'sticky', right: 0, backgroundColor: '#f9f9f9', zIndex: 1 }}>
                                  <button 
                                    onClick={() => saveEditedRow(rowIndex)}
                                    style={{ marginRight: '5px', padding: '3px 8px', backgroundColor: '#4CAF50', color: 'white', border: 'none', borderRadius: '3px' }}
                                  >
                                    Enregistrer
                                  </button>
                                  <button 
                                    onClick={cancelEditing}
                                    style={{ padding: '3px 8px', backgroundColor: '#f44336', color: 'white', border: 'none', borderRadius: '3px' }}
                                  >
                                    Annuler
                                  </button>
                                </td>
                              </>
                            ) : (
                              // Mode affichage normal
                              <>
                                {tableData.columns.map(column => (
                                  <td 
                                    key={column} 
                                    style={{ 
                                      padding: '10px', 
                                      borderBottom: '1px solid #ddd',
                                      maxWidth: column === 'useragent' ? '300px' : 'auto',
                                      overflow: 'hidden',
                                      textOverflow: 'ellipsis',
                                      whiteSpace: column === 'useragent' ? 'normal' : 'nowrap'
                                    }}
                                    title={row[column]} // Ajouter un tooltip pour les valeurs longues
                                  >
                                    {row[column]}
                                  </td>
                                ))}
                                {editMode && (
                                  <td style={{ padding: '5px', borderBottom: '1px solid #ddd', whiteSpace: 'nowrap', position: 'sticky', right: 0, backgroundColor: rowIndex % 2 === 0 ? 'white' : '#f9f9f9', zIndex: 1 }}>
                                    <button 
                                      onClick={() => startEditing(rowIndex)}
                                      style={{ marginRight: '5px', padding: '3px 8px', backgroundColor: '#2196F3', color: 'white', border: 'none', borderRadius: '3px' }}
                                    >
                                      Éditer
                                    </button>
                                    <button 
                                      onClick={() => deleteRow(rowIndex)}
                                      style={{ padding: '3px 8px', backgroundColor: '#f44336', color: 'white', border: 'none', borderRadius: '3px' }}
                                    >
                                      Supprimer
                                    </button>
                                  </td>
                                )}
                              </>
                            )}
                          </tr>
                        ))}
                        {/* Formulaire pour ajouter une nouvelle ligne */}
                        {editMode && (
                          <tr style={{ borderBottom: '1px solid #ddd', backgroundColor: '#f0f8ff' }}>
                            {tableData.columns.map(column => (
                              <td key={`new-${column}`} style={{ padding: '8px' }}>
                                <input
                                  type="text"
                                  value={newRow[column] || ''}
                                  onChange={(e) => handleNewRowChange(column, e.target.value)}
                                  placeholder={`Nouveau ${column}`}
                                  style={{ width: '100%', padding: '6px' }}
                                />
                              </td>
                            ))}
                            <td style={{ padding: '8px' }}>
                              <button 
                                className="clarins-button-success"
                                onClick={addNewRow}
                              >
                                Ajouter
                              </button>
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                    ) : (
                      <div style={{ padding: '20px', textAlign: 'center' }}>
                        <p>Aucune donnée disponible pour cette table.</p>
                      </div>
                    )}
                  </div>
                  
                  {/* Barre de défilement horizontale en bas de la fenêtre */}
                  <div 
                    ref={scrollbarRef}
                    style={{
                      height: '15px',
                      overflowX: 'auto',
                      overflowY: 'hidden',
                      marginTop: '5px',
                      borderTop: '1px solid #ddd'
                    }}
                  >
                    <div style={{
                      width: tableContainerRef.current ? tableContainerRef.current.scrollWidth + 'px' : '100%',
                      height: '1px'
                    }}></div>
                  </div>
                </div>
              )}
            </>
          ) : (
            <div style={{ 
              display: 'flex', 
              justifyContent: 'center', 
              alignItems: 'center', 
              height: '300px',
              backgroundColor: '#f8f9fa',
              borderRadius: '8px'
            }}>
              <p>Sélectionnez une table pour afficher ses données</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Data;
