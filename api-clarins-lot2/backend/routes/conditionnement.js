const express = require('express');
const router = express.Router();
const Joi = require('joi');
const db = require('../db');

// Validation schema for code_para
const codeParaSchema = Joi.object({
  code_para: Joi.string().required() // Assuming code_para is a string
});

// GET /palette/{code_para}
router.get('/palette/:code_para', async (req, res) => {
  const { error } = codeParaSchema.validate(req.params);
  if (error) {
    return res.status(400).json({ error: error.details[0].message });
  }
  const { code_para } = req.params;
  try {
    const { rows } = await db.query('SELECT * FROM cpalep00 WHERE code_palette = $1', [code_para]); // Adjust column name if needed
    if (rows.length === 0) {
      return res.status(404).json({ error: 'Palette not found' });
    }
    res.json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /prepack/{code_para}
router.get('/prepack/:code_para', async (req, res) => {
  const { error } = codeParaSchema.validate(req.params);
  if (error) {
    return res.status(400).json({ error: error.details[0].message });
  }
  const { code_para } = req.params;
  try {
    // This query might be more complex, involving joins across cparap00, cpapkp00, cpalep00
    // For simplicity, here's a placeholder. You'll need to adjust based on actual table structures and relationships.
    const { rows } = await db.query(
      'SELECT * FROM cparap00 pa ' +
      'LEFT JOIN cpapkp00 pk ON pa.id_prepack = pk.id_prepack ' + // Example join condition
      'LEFT JOIN cpalep00 pl ON pk.id_palette = pl.id_palette ' + // Example join condition
      'WHERE pa.code_prepack = $1', // Adjust column name if needed
      [code_para]
    );
    if (rows.length === 0) {
      return res.status(404).json({ error: 'Prepack not found' });
    }
    res.json(rows); // May return multiple rows or a structured object
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /unite/{code_para}
router.get('/unite/:code_para', async (req, res) => {
  const { error } = codeParaSchema.validate(req.params);
  if (error) {
    return res.status(400).json({ error: error.details[0].message });
  }
  const { code_para } = req.params;
  try {
    // This query will likely involve joins across cpkunp00, cparap00, cpapkp00, cpalep00
    // Placeholder query - adjust based on your database schema.
    const { rows } = await db.query(
      'SELECT * FROM cpkunp00 ku ' +
      'LEFT JOIN cparap00 pa ON ku.id_prepack = pa.id_prepack ' + // Example join
      'LEFT JOIN cpapkp00 pk ON pa.id_prepack = pk.id_prepack ' +
      'LEFT JOIN cpalep00 pl ON pk.id_palette = pl.id_palette ' +
      'WHERE ku.code_unite = $1', // Adjust column name if needed
      [code_para]
    );
    if (rows.length === 0) {
      return res.status(404).json({ error: 'Unite not found' });
    }
    res.json(rows); // May return multiple rows or a structured object
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
