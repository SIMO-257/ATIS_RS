const express = require("express");
const router = express.Router();
const { getDB } = require("../db");
const { ObjectId } = require("mongodb");
const crypto = require("crypto");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const { Client } = require("minio");


// MinIO Client
const minioClient = new Client({
  endPoint: "minio",
  port: 9000,
  useSSL: false,
  accessKey: process.env.MINIO_ACCESS_KEY || "minioadmin",
  secretKey: process.env.MINIO_SECRET_KEY || "minioadmin",
});

// Ensure buckets exist and have public read policy
const BUCKETS = ["cv-bucket", "form2-bucket", "form3-bucket", "rapport-bucket"];
const RAPPORT_BUCKET = "rapport-bucket";

BUCKETS.forEach((bucket) => {
  minioClient.bucketExists(bucket, (err, exists) => {
    if (err) {
      console.error(`Error checking bucket "${bucket}":`, err);
    } else {
      const policy = {
        Version: "2012-10-17",
        Statement: [
          {
            Effect: "Allow",
            Principal: { AWS: ["*"] },
            Action: ["s3:GetObject"],
            Resource: [`arn:aws:s3:::${bucket}/*`],
          },
        ],
      };

      if (!exists) {
        minioClient.makeBucket(bucket, "us-east-1", (err) => {
          if (err) console.error(`Error creating bucket "${bucket}":`, err);
          else {
            console.log(`✅ Bucket "${bucket}" created successfully`);
            minioClient.setBucketPolicy(
              bucket,
              JSON.stringify(policy),
              (err) => {
                if (err)
                  console.error(`Error setting policy for "${bucket}":`, err);
                else console.log(`✅ Policy set for "${bucket}"`);
              },
            );
          }
        });
      } else {
        console.log(`✅ Bucket "${bucket}" already exists`);
        minioClient.setBucketPolicy(bucket, JSON.stringify(policy), (err) => {
          if (err) console.error(`Error setting policy for "${bucket}":`, err);
          else console.log(`✅ Policy ensured for "${bucket}"`);
        });
      }
    }
  });
});

// Configure multer for Rapport de Stage file upload (disk storage for saving)
const rapportStorage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadDir = path.join(__dirname, "..", "temp_uploads"); // Temporary local storage
    fs.mkdirSync(uploadDir, { recursive: true });
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    cb(
      null,
      file.fieldname + "-" + Date.now() + path.extname(file.originalname),
    );
  },
});
const uploadRapport = multer({
  storage: rapportStorage,
  limits: { fileSize: 20 * 1024 * 1024 }, // 20MB limit for reports
  fileFilter: (req, file, cb) => {
    const allowedMimes = [
      "application/pdf",
      "application/msword",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ];
    if (allowedMimes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(
        new Error("Only PDF or Word documents are allowed for reports!"),
        false,
      );
    }
  },
});


// PUT /eval/activate/:id - Activate evaluation for a hired candidate
router.put("/eval/activate/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const db = getDB();

    const token = crypto.randomBytes(16).toString("hex");

    let filter;
    if (ObjectId.isValid(id)) {
      console.log("⚙️ eval/activate id:", id, "ObjectId.isValid:", true);
      filter = { $or: [{ _id: new ObjectId(id) }, { _id: id }] };
    } else {
      console.log("⚙️ eval/activate id:", id, "ObjectId.isValid:", false);
      filter = { _id: id };
    }

    const existing = await db.collection("candidats").findOne(filter);
    console.log("🔎 existing by filter:", !!existing);
    if (!existing) {
      const fallback = await db
        .collection("candidats")
        .findOne({ _id: String(id) });
      console.log("🔎 fallback by string:", !!fallback);
      if (!fallback) {
        return res
          .status(404)
          .json({ success: false, error: "Candidate not found" });
      }
      filter = { _id: fallback._id };
    }

    await db.collection("candidats").updateOne(filter, {
      $set: { evalToken: token, evalStatus: "active" },
    });

    const updated = await db.collection("candidats").findOne(filter);
    res.json({ success: true, data: updated });
  } catch (error) {
    console.error("Eval activation error:", error);
    res
      .status(500)
      .json({ success: false, error: "Failed to activate evaluation" });
  }
});

// NEW ROUTE for uploading rapport de stage
router.post(
  "/:id/upload-rapport-stage",
  uploadRapport.single("rapportStage"),
  async (req, res) => {
    try {
      const { id } = req.params;
      if (!req.file) {
        return res
          .status(400)
          .json({ success: false, error: "No file uploaded." });
      }

      const db = getDB();
      const { ObjectId } = require("mongodb");

      if (!ObjectId.isValid(id)) {
        // Clean up the uploaded file if ID is invalid
        fs.unlinkSync(req.file.path);
        return res.status(400).json({ success: false, error: "Invalid ID" });
      }

      const candidate = await db
        .collection("candidats")
        .findOne({ _id: new ObjectId(id) });
      if (!candidate) {
        // Clean up the uploaded file if candidate not found
        fs.unlinkSync(req.file.path);
        return res
          .status(404)
          .json({ success: false, error: "Candidat not found." });
      }

      // Read the file buffer from the temporary location
      const fileBuffer = fs.readFileSync(req.file.path);
      const minioFileName = `rapport-${id}-${Date.now()}${path.extname(req.file.originalname)}`;

      // Upload to MinIO
      await minioClient.putObject(
        RAPPORT_BUCKET,
        minioFileName,
        fileBuffer,
        fileBuffer.length,
        { "Content-Type": req.file.mimetype },
      );

      const rapportMinioPath = `${process.env.MINIO_PUBLIC_URL}/${RAPPORT_BUCKET}/${minioFileName}`;
      await db
        .collection("candidats")
        .updateOne(
          { _id: new ObjectId(id) },
          { $set: { rapportStagePath: rapportMinioPath } },
        );

      res.json({
        success: true,
        message: "Rapport de stage uploaded successfully.",
        filePath: rapportMinioPath,
      });
    } catch (error) {
      console.error("Error uploading rapport de stage:", error);
      // Ensure temporary file is cleaned up even on error
      if (req.file && fs.existsSync(req.file.path)) {
        fs.unlinkSync(req.file.path);
      }
      res
        .status(500)
        .json({ success: false, error: "Server error during upload." });
    }
  },
);

// NEW ROUTES for 'emabauchés' collection
// GET /api/hiring/embauches - Get all hired candidates
router.get('/embauches', async (req, res) => {
    try {
        const db = getDB();
        const embauches = await db.collection('emabauchés').find({}).toArray();
        res.json({ success: true, count: embauches.length, data: embauches });
    } catch (error) {
        console.error('Error fetching hired candidates:', error);
        res.status(500).json({ success: false, error: 'Failed to fetch hired candidates' });
    }
});

// POST /api/hiring/embauches - Add a new hired candidate
router.post('/embauches', async (req, res) => {
    try {
        const db = getDB();
        const newEmbauche = req.body;
        // Optionally add a timestamp or other fields
        newEmbauche.hiredAt = new Date();
        const result = await db.collection('emabauchés').insertOne(newEmbauche);
        res.status(201).json({ success: true, message: 'Hired candidate added successfully', data: { id: result.insertedId, ...newEmbauche } });
    } catch (error) {
        console.error('Error adding hired candidate:', error);
        res.status(500).json({ success: false, error: 'Failed to add hired candidate' });
    }
});

module.exports = router;