const express = require('express');
const router = express.Router();
const { getDB } = require('../db');
const { ObjectId } = require('mongodb');

// GET /api/refused - Get all refused candidates
router.get('/', async (req, res) => {
    try {
        const db = getDB();
        const refusedCandidates = await db.collection('refus\u00e9s').find({}).toArray();
        res.json({ success: true, count: refusedCandidates.length, data: refusedCandidates });
    } catch (error) {
        console.error('Error fetching refused candidates:', error);
        res.status(500).json({ success: false, error: 'Failed to fetch refused candidates' });
    }
});

// POST /api/refused - Add a new refused candidate
router.post('/', async (req, res) => {
    try {
        const db = getDB();
        const newRefusedCandidate = req.body;
        // Optionally add a timestamp or other fields
        newRefusedCandidate.refusedAt = new Date();
        const result = await db.collection('refus\u00e9s').insertOne(newRefusedCandidate);
        res.status(201).json({ success: true, message: 'Refused candidate added successfully', data: { id: result.insertedId, ...newRefusedCandidate } });
    } catch (error) {
        console.error('Error adding refused candidate:', error);
        res.status(500).json({ success: false, error: 'Failed to add refused candidate' });
    }
});

module.exports = router;
