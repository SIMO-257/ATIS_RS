const express = require("express");
const router = express.Router();
const multer = require("multer");
const pdf = require("pdf-parse");
const axios = require("axios");
const path = require("path");
const { Client } = require("minio");
const { getDB } = require("../db");

const extractionJobs = new Map();

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
const CV_BUCKET = "cv-bucket";

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

// Configure multer for CV file upload (memory storage for parsing)
const uploadCv = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
  fileFilter: (req, file, cb) => {
    if (file.mimetype === "application/pdf") {
      cb(null, true);
    } else {
      cb(new Error("Only PDF files are allowed!"), false);
    }
  },
});

// Ollama client - uses Docker service name
const ollama = axios.create({
  baseURL: process.env.OLLAMA_HOST || "http://ollama:11434",
  timeout: 300000, // 5 minutes
});

// Extract candidate name using Ollama
async function extractNameWithOllama(pdfText) {
  try {
    const prompt = `You are a STRICT data extraction engine.

ABSOLUTE RULES:
- Extract ONLY the candidate's name.
- DO NOT infer, guess, normalize, or harmonize values.
- If a field is empty, unclear, or ambiguous, return "-".
- Output VALID JSON ONLY.
- NO explanations. NO comments. NO extra text.

JSON FORMAT (must match EXACTLY):
{
  "Nom": "string",
  "Prenom": "string"
}

DOCUMENT TEXT:
${pdfText}

JSON:`;

    const response = await ollama.post("/api/generate", {
      model: "qwen2.5:latest",
      prompt,
      stream: false,
      options: {
        temperature: 0,
        top_p: 0.1,
        repeat_penalty: 1.1,
        num_ctx: 2048,
        num_predict: 120,
      },
    });

    let raw = response.data.response.replace(/```json|```/g, "").trim();
    const firstBrace = raw.indexOf("{");
    const lastBrace = raw.lastIndexOf("}");

    if (firstBrace == -1 || lastBrace == -1) {
      throw new Error("No JSON object returned by model");
    }

    const extracted = JSON.parse(raw.slice(firstBrace, lastBrace + 1));
    return {
      Nom: extracted["Nom"] || "-",
      Prenom: extracted["Prenom"] || extracted["Prénom"] || "-",
    };
  } catch (err) {
    console.error("Ollama name extraction failed:", err.message);
    throw err;
  }
}

// POST / - Upload and extract CV (async)
router.post("/", uploadCv.single("cv"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: "No PDF file uploaded",
      });
    }

    console.log(" Processing CV:", req.file.originalname);
    const encodedOriginalname = encodeURIComponent(req.file.originalname);

    // Upload to MinIO
    const fileName = `${Date.now()}-${encodedOriginalname}`;
    await minioClient.putObject(
      CV_BUCKET,
      fileName,
      req.file.buffer,
      req.file.size,
      { "Content-Type": "application/pdf" },
    );

    console.log(" CV uploaded to MinIO:", fileName);

    const jobId = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
    extractionJobs.set(jobId, {
      status: "processing",
      error: null,
      data: null,
      fileName,
      createdAt: Date.now(),
    });

    setImmediate(async () => {
      try {
        const pdfData = await pdf(req.file.buffer);
        const pdfText = pdfData.text || "";
        const headText = pdfText.slice(0, 2000);
        const extractedData = await extractNameWithOllama(headText);
        const cvUrl = `${process.env.MINIO_PUBLIC_URL}/${CV_BUCKET}/${fileName}`;

        const db = getDB();
        const archiveDoc = {
          Nom: extractedData.Nom || "",
          Prenom: extractedData.Prenom || "",
          service: "",
          cvUrl,
          createdAt: new Date(),
        };
        const result = await db.collection("archive").insertOne(archiveDoc);

        extractionJobs.set(jobId, {
          status: "done",
          error: null,
          data: { _id: result.insertedId, ...archiveDoc },
          fileName,
          cvUrl,
          createdAt: Date.now(),
        });
      } catch (err) {
        extractionJobs.set(jobId, {
          status: "error",
          error: err.code || err.message || "Extraction failed",
          data: null,
          fileName,
          createdAt: Date.now(),
        });
      }
    });

    res.json({
      success: true,
      jobId,
      message: "Extraction started",
    });
  } catch (error) {
    console.error("Error processing CV:", error);

    if (error.code === "ECONNREFUSED") {
      return res.status(503).json({
        success: false,
        error: "Ollama service is not running. Please check Docker Compose.",
      });
    }

    if (error.code === "FORM_NOT_FOUND") {
      return res.status(400).json({
        success: false,
        error:
          "Formulaire de recrutement introuvable. Le PDF doit contenir le questionnaire.",
      });
    }

    res.status(500).json({
      success: false,
      error: "Erreur lors de l'extraction des données: " + error.message,
    });
  }
});

// GET /status/:id - Check extraction status
router.get("/status/:id", async (req, res) => {
  const { id } = req.params;
  const job = extractionJobs.get(id);
  if (!job) {
    return res.status(404).json({ success: false, error: "Job not found" });
  }
  res.json({ success: true, ...job });
});

// POST /upload-only-cv - Uploads a CV file to MinIO without extraction
router.post("/upload-only-cv", uploadCv.single("cv"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: "No PDF file uploaded",
      });
    }

    console.log("📄 Uploading CV only:", req.file.originalname);

    // Upload to MinIO
    const fileName = `${Date.now()}-${req.file.originalname}`;
    await minioClient.putObject(
      CV_BUCKET,
      fileName,
      req.file.buffer,
      req.file.size,
      { "Content-Type": "application/pdf" },
    );

    const cvUrl = `${process.env.MINIO_PUBLIC_URL}/${CV_BUCKET}/${fileName}`;

    res.json({
      success: true,
      message: "CV file uploaded successfully",
      fileName: fileName,
      cvUrl: cvUrl,
    });
  } catch (error) {
    console.error("Error uploading CV only:", error);
    res.status(500).json({
      success: false,
      error: "Failed to upload CV file: " + error.message,
    });
  }
});

// GET /health - Check if Ollama is running
router.get("/health", async (req, res) => {
  try {
    // Try to reach Ollama - use a simple tags check
    const response = await ollama.get("/api/tags");
    res.json({
      success: true,
      ollamaRunning: true,
      modelCount: response.data.models ? response.data.models.length : 0,
    });
  } catch (error) {
    console.error("Ollama health check failed:", error.message);
    res.json({
      success: true,
      ollamaRunning: false,
      error: error.message,
    });
  }
});


module.exports = router;
