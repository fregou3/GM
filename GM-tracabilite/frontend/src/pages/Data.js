import React, { useState, useEffect } from 'react';
import axios from 'axios';

const Data = () => {
  const [tables, setTables] = useState([]);
  const [selectedTable, setSelectedTable] = useState('');
  const [tableData, setTableData] = useState({ columns: [], rows: [] });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

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

  // Fonction pour récupérer les données d'une table
  const fetchTableData = async (tableName) => {
    if (!tableName) return;
    
    setLoading(true);
    setError('');
    setSelectedTable(tableName);
    
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
      } else {
        setTableData({ columns: [], rows: [] });
      }
      
      setLoading(false);
    } catch (err) {
      console.error(`Erreur lors de la récupération des données de la table ${tableName}:`, err);
      setError(`Erreur lors de la récupération des données de la table ${tableName}: ` + 
        (err.response?.data?.error || err.message));
      setLoading(false);
    }
  };

  // Fonction de suppression des tables retirée pour des raisons de sécurité

  return (
    <div className="data-container" style={{ padding: '20px' }}>
      <h2>Gestion des Données</h2>
      
      <div style={{ display: 'flex', marginBottom: '20px' }}>
        <div style={{ width: '250px', marginRight: '20px' }}>
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
                    cursor: 'pointer'
                  }}
                >
                  {table}
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
        
        <div style={{ flex: 1 }}>
          {selectedTable ? (
            <>
              <h3>Données de la table: {selectedTable}</h3>
              {loading ? (
                <p>Chargement des données...</p>
              ) : (
                tableData.rows.length > 0 ? (
                  <div style={{ overflowX: 'auto' }}>
                    <table style={{ 
                      width: '100%', 
                      borderCollapse: 'collapse', 
                      border: '1px solid #ddd'
                    }}>
                      <thead>
                        <tr style={{ backgroundColor: '#f2f2f2' }}>
                          {tableData.columns.map(column => (
                            <th 
                              key={column} 
                              style={{ 
                                padding: '10px', 
                                borderBottom: '2px solid #ddd',
                                textAlign: 'left'
                              }}
                            >
                              {column}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {tableData.rows.map((row, index) => (
                          <tr 
                            key={index}
                            style={{ 
                              backgroundColor: index % 2 === 0 ? 'white' : '#f9f9f9'
                            }}
                          >
                            {tableData.columns.map(column => (
                              <td 
                                key={`${index}-${column}`}
                                style={{ 
                                  padding: '8px', 
                                  borderBottom: '1px solid #ddd'
                                }}
                              >
                                {row[column] !== null && row[column] !== undefined ? row[column].toString() : ''}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <p>Aucune donnée dans cette table.</p>
                )
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
