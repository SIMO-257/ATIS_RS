const express = require("express");
const router = express.Router();
const { getDB } = require("../db");
const { ObjectId } = require("mongodb");

// GET /api/archive - List archived candidates
router.get("/", async (req, res) => {
  try {
    const db = getDB();
    const items = await db
      .collection("archive")
      .find({})
      .sort({ createdAt: -1 })
      .toArray();
    res.json({ success: true, data: items });
  } catch (error) {
    console.error("Archive list error:", error);
    res.status(500).json({ success: false, error: "Failed to fetch archive" });
  }
});

// POST /api/archive - Create archive record
router.post("/", async (req, res) => {
  try {
    const db = getDB();
    const { Nom, Prenom, service, cvUrl } = req.body || {};
    const doc = {
      Nom: Nom || "",
      Prenom: Prenom || "",
      service: service || "",
      cvUrl: cvUrl || "",
      createdAt: new Date(),
    };
    const result = await db.collection("archive").insertOne(doc);
    res.json({ success: true, data: { _id: result.insertedId, ...doc } });
  } catch (error) {
    console.error("Archive create error:", error);
    res.status(500).json({ success: false, error: "Failed to create archive" });
  }
});

// PUT /api/archive/:id - Update archive record
router.put("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    if (!ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, error: "Invalid ID" });
    }
    const db = getDB();
    const updates = req.body || {};
    delete updates._id;
    await db
      .collection("archive")
      .updateOne({ _id: new ObjectId(id) }, { $set: updates });
    const updated = await db
      .collection("archive")
      .findOne({ _id: new ObjectId(id) });
    res.json({ success: true, data: updated });
  } catch (error) {
    console.error("Archive update error:", error);
    res.status(500).json({ success: false, error: "Failed to update archive" });
  }
});

// DELETE /api/archive/:id - Delete archive record
router.delete("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    if (!ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, error: "Invalid ID" });
    }
    const db = getDB();
    const result = await db
      .collection("archive")
      .deleteOne({ _id: new ObjectId(id) });
    if (result.deletedCount === 0) {
      return res
        .status(404)
        .json({ success: false, error: "Archive record not found" });
    }
    res.json({ success: true });
  } catch (error) {
    console.error("Archive delete error:", error);
    res.status(500).json({ success: false, error: "Failed to delete archive" });
  }
});

module.exports = router;
