const express = require('express');
const router = express.Router();
const Joi = require('joi');
const db = require('../db');

// Validation schema for code_unique
const codeUniqueSchema = Joi.object({
  code_unique: Joi.string().required()
});

/**
 * @swagger
 * /batchnumber/{code_unique}:
 *   get:
 *     summary: Récupère le numéro de lot d'une unité.
 *     description: Récupère le numéro de lot (BATCH NUMBER) d'une unité à partir de son code unique.
 *     parameters:
 *       - in: path
 *         name: code_unique
 *         required: true
 *         description: Code unique de l'unité.
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Numéro de lot de l'unité.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 batchnumber:
 *                   type: string
 *       400:
 *         description: Invalid input.
 *       500:
 *         description: Internal server error.
 */
router.get('/:code_unique', async (req, res) => {
  const { error } = codeUniqueSchema.validate(req.params);
  if (error) {
    return res.status(400).json({ error: error.details[0].message });
  }

  const { code_unique } = req.params;

  try {
    // Exécuter la requête SQL pour récupérer le numéro de lot
    const { rows } = await db.query(
      'SELECT CPARAP00.CPBANO FROM CPKUNP00 INNER JOIN CPARAP00 ON CPKUNP00.CPPARA = CPARAP00.CPPARA WHERE CPKUNP00.CPUNIT = $1',
      [code_unique]
    );

    if (rows.length === 0) {
      // Si aucun résultat n'est trouvé, retourner une valeur vide
      console.log(`[API Clarins Batch] Aucun numéro de lot trouvé pour ${code_unique}, retour d'une valeur vide`);
      return res.json({ batchnumber: '' });
    }

    // Retourner le numéro de lot trouvé
    console.log(`[API Clarins Batch] Numéro de lot trouvé pour ${code_unique}: ${rows[0].cpbano}`);
    res.json({ batchnumber: rows[0].cpbano });
  } catch (err) {
    console.error(`[API Clarins Batch] Erreur lors de la récupération du numéro de lot pour ${code_unique}:`, err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
