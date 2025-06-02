require('dotenv').config();

const express = require('express');
const app = express();
const port = process.env.PORT || 3000;

// Middleware for API key authentication
const apiKeyAuth = (req, res, next) => {
  const apiKey = req.headers['authorization'];
  if (apiKey && apiKey === process.env.API_KEY) {
    next();
  } else {
    res.status(401).json({ error: 'Unauthorized' });
  }
};

app.use(express.json());

// Apply API key authentication to all routes
app.use(apiKeyAuth);

app.get('/', (req, res) => {
  res.send('API Clarins Lot 2 Backend is running!');
});

// Import routes
const articleRoutes = require('./routes/article');
const tracabiliteRoutes = require('./routes/tracabilite');
const conditionnementRoutes = require('./routes/conditionnement');
const batchnumberRoutes = require('./routes/batchnumber'); // Nouvelle route pour le numéro de lot

// Use routes
app.use('/article', articleRoutes);
app.use('/tracabilite', tracabiliteRoutes);
app.use('/conditionnement', conditionnementRoutes);
app.use('/batchnumber', batchnumberRoutes); // Ajout de la nouvelle route

app.listen(port, () => {
  console.log(`Server listening on port ${port}`);
});
