const express = require('express');
const router = express.Router();
const Joi = require('joi');
const db = require('../db');

// Validation schema for article code
const articleSchema = Joi.object({
  code: Joi.string().required() // Assuming code is a string, adjust if necessary
});

/**
 * @swagger
 * /article/{code}:
 *   get:
 *     summary: Récupère les détails d'un article.
 *     description: Récupère les détails d'un article en fonction de son code.
 *     parameters:
 *       - in: path
 *         name: code
 *         required: true
 *         description: Code de l'article.
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Détails de l'article.
 *         content:
 *           application/json:
 *             schema:
 *               type: object # Define the expected response structure here
 *       400:
 *         description: Invalid input.
 *       404:
 *         description: Article not found.
 *       500:
 *         description: Internal server error.
 */
router.get('/:code', async (req, res) => {
  const { error } = articleSchema.validate(req.params);
  if (error) {
    return res.status(400).json({ error: error.details[0].message });
  }

  const { code } = req.params;

  try {
    // Query uses actual column names from martip00
    const { rows } = await db.query(
      'SELECT maarti, madesi, maname, maqtpk, maqtpa, maacti FROM martip00 WHERE maarti = $1 LIMIT 1',
      [code]
    );

    if (rows.length === 0) {
      return res.status(404).json({ error: 'Article not found' });
    }
    
    // Map database row to the desired JSON response structure
    const articleData = rows[0];
    const response = {
      code: articleData.maarti.trim(), // Trim whitespace like in Python version
      designation: articleData.madesi.trim(),
      designation_en: articleData.maname.trim(),
      quantite_pk: parseInt(articleData.maqtpk, 10), // Ensure correct type
      quantite_pa: parseInt(articleData.maqtpa, 10), // Ensure correct type
      actif: Boolean(articleData.maacti) // Ensure correct type
    };
    res.json(response);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
