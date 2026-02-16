const express = require('express');
const router = express.Router();
const { getDB } = require('../db');
const { ObjectId } = require('mongodb');

// GET /api/depart - Get all departed individuals
router.get('/', async (req, res) => {
    try {
        const db = getDB();
        const departed = await db.collection('departs').find({}).toArray();
        res.json({ success: true, count: departed.length, data: departed });
    } catch (error) {
        console.error('Error fetching departed individuals:', error);
        res.status(500).json({ success: false, error: 'Failed to fetch departed individuals' });
    }
});

// POST /api/depart - Add a new departed individual
router.post('/', async (req, res) => {
    try {
        const db = getDB();
        const newDepart = req.body;
        // Optionally add a timestamp or other fields
        newDepart.departedAt = new Date();
        const result = await db.collection('departs').insertOne(newDepart);
        res.status(201).json({ success: true, message: 'Departed individual added successfully', data: { id: result.insertedId, ...newDepart } });
    } catch (error) {
        console.error('Error adding departed individual:', error);
        res.status(500).json({ success: false, error: 'Failed to add departed individual' });
    }
});

module.exports = router;
