const express = require("express");
const router = express.Router();
const multer = require("multer");
const pdf = require("pdf-parse");
const axios = require("axios");
const path = require("path");
const { Client } = require("minio");
const { getDB } = require("../db");

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

//Exract Form from Page3:
function extractRecruitmentForm(pdfText) {
  const pages = pdfText.split("\f");

  // 1️⃣ Fast path: page 3 exists
  if (pages[2] && pages[2].includes("QUESTIONNAIRE DE RECRUTEMENT")) {
    return pages[2];
  }

  // 2️⃣ Fallback: search globally (robust)
  const marker = "QUESTIONNAIRE DE RECRUTEMENT";
  const idx = pdfText.indexOf(marker);

  if (idx !== -1) {
    // Take a safe slice after the marker
    return pdfText.slice(idx, idx + 6000);
  }

  // 3️⃣ Hard failure (true invalid PDF)
  const err = new Error("FORM_NOT_FOUND");
  err.code = "FORM_NOT_FOUND";
    console.error("❌ Form not found in PDF:", err.message); // Added console.error
    throw err;
}
function extractEnglishManually(formText) {
  const lines = formText
    .replace(/\r/g, "")
    .split("\n")
    .map((l) => l.trimEnd());

  // 1️⃣ Find header line
  const headerIndex = lines.findIndex((l) => /faible\s+moyen\s+bien/i.test(l));

  if (headerIndex === -1) {
    return { Lu: "-", Ecrit: "-", Parlé: "-" };
  }

  const header = lines[headerIndex];

  // 2️⃣ Get column positions
  const col = {
    faible: header.toLowerCase().indexOf("faible"),
    moyen: header.toLowerCase().indexOf("moyen"),
    bien: header.toLowerCase().indexOf("bien"),
  };

  function resolveRow(label) {
    const row = lines.find((l) => new RegExp(`^${label}\\b`, "i").test(l));

    if (!row) return "-";

    const picks = [];

    if (row[col.faible] === "X") picks.push("Faible");
    if (row[col.moyen] === "X") picks.push("Moyen");
    if (row[col.bien] === "X") picks.push("Bien");

    return picks.length === 1 ? picks[0] : "-";
  }
  console.log("📊 ENGLISH TABLE LINES:");
  lines.slice(headerIndex - 2, headerIndex + 6).forEach((l) => console.log(l));

  return {
    Lu: resolveRow("Lu"),
    Ecrit: resolveRow("Ecrit"),
    Parlé: resolveRow("Parl[eé]"),
  };
}

// Extract CV information using Ollama
async function extractWithOllama(pdfText) {
  try {
    // 1️⃣ Strict extraction: ONLY Page 3
    const formText = await extractRecruitmentForm(pdfText);
    const englishLevel = extractEnglishManually(formText);

    console.log("🇬🇧 English extracted manually:", englishLevel);
    console.log("=== FORM TEXT DEBUG ===");
    console.log("Full formText length:", formText.length);
    console.log("formText:", formText);
    console.log("=== END FORM TEXT DEBUG ===");

    // 2️⃣ Strict, minimal, deterministic prompt
    const prompt = `You are a STRICT data extraction engine.

ABSOLUTE RULES:
- Extract ONLY information explicitly written in the form.
- DO NOT infer, guess, normalize, or harmonize values.
- DO NOT make values consistent across fields.
- If a field is empty, unclear, or ambiguous, return "-".
- Output VALID JSON ONLY.
- NO explanations. NO comments. NO extra text.

JSON FORMAT (must match EXACTLY):
{
  "Nom": "string",
  "Prénom": "string",
  "Date de naissance": "string",
  "Adress Actuel": "string",
  "Post Actuel": "string",
  "Société": "string",
  "Date d'embauche": "string",
  "Salaire net Actuel": "string",
  "Votre dernier diplome": "string",
  "situationFamiliale": "string",
  "nbEnfants": "string",
  "pourquoiChanger": "string",
  "dureePreavis": "string",
  "fonctionsMissions": "string",
  "ecole": "string",
  "anneeDiplome": "string",
  "posteSedentaire": "string",
  "missionsMaitrisees": "string",
  "travailSeulEquipe": "string",
  "zoneSapino": "string",
  "motorise": "string",
  "pretentionsSalariales": "string",
  "questionsRemarques": "string"
}

FORM TEXT:
${formText}

JSON:`;

    // 3️⃣ Locked Ollama call (NO creativity)
    const response = await ollama.post("/api/generate", {
      model: "qwen2.5:latest",
      prompt,
      stream: false,
      options: {
        temperature: 0,
        top_p: 0.1,
        repeat_penalty: 1.1,
        num_ctx: 4096,
        num_predict: 500,
      },
    });

    // 4️⃣ Clean & parse response
    console.log("RAW ENGLISH BLOCK:");
    console.log(formText.match(/anglais(.|\n){0,300}/i));

    let raw = response.data.response.replace(/```json|```/g, "").trim();
    const firstBrace = raw.indexOf("{");
    const lastBrace = raw.lastIndexOf("}");

    if (firstBrace === -1 || lastBrace === -1) {
      throw new Error("No JSON object returned by model");
    }

    const extracted = JSON.parse(raw.slice(firstBrace, lastBrace + 1));

    // 5️⃣ Enforce schema & defaults (ANTI-HALLUCINATION)
    const result = {
      Nom: extracted["Nom"] || "-",
      Prénom: extracted["Prénom"] || "-",
      "Date de naissance": extracted["Date de naissance"] || "-",
      "Adress Actuel": extracted["Adress Actuel"] || "-",
      "Post Actuel": extracted["Post Actuel"] || "-",
      Société: extracted["Société"] || "-",
      "Date d'embauche": extracted["Date d'embauche"] || "-",
      "Salaire net Actuel": extracted["Salaire net Actuel"] || "-",
      "Votre dernier diplome": extracted["Votre dernier diplome"] || "-",
      situationFamiliale: extracted["situationFamiliale"] || "-",
      nbEnfants: extracted["nbEnfants"] || "-",
      pourquoiChanger: extracted["pourquoiChanger"] || "-",
      dureePreavis: extracted["dureePreavis"] || "-",
      fonctionsMissions: extracted["fonctionsMissions"] || "-",
      ecole: extracted["ecole"] || "-",
      anneeDiplome: extracted["anneeDiplome"] || "-",
      posteSedentaire: extracted["posteSedentaire"] || "-",
      missionsMaitrisees: extracted["missionsMaitrisees"] || "-",
      travailSeulEquipe: extracted["travailSeulEquipe"] || "-",
      zoneSapino: extracted["zoneSapino"] || "-",
      motorise: extracted["motorise"] || "-",
      pretentionsSalariales: extracted["pretentionsSalariales"] || "-",
      questionsRemarques: extracted["questionsRemarques"] || "-",
      "Votre niveau de l'anglais technique": englishLevel, // ✅ JS wins
    };

    return result;
  } catch (err) {
    console.error("❌ Ollama extraction failed:", err.message);
    throw err;
  }
}

// POST /extract - Upload and extract CV (note: no /api prefix here, it's added in app.js)
router.post("/extract", uploadCv.single("cv"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: "No PDF file uploaded",
      });
    }

    console.log("📄 Processing CV:", req.file.originalname);
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

    console.log("✅ CV uploaded to MinIO:", fileName);

    // Parse PDF
    const pdfData = await pdf(req.file.buffer);
    const pdfText = pdfData.text;

    console.log("✅ PDF parsed, text length:", pdfText.length);

    // Extract with Ollama
    console.log("🤖 Calling Ollama...");
    const extractedData = await extractWithOllama(pdfText);

    console.log("🔗 MINIO_PUBLIC_URL:", process.env.MINIO_PUBLIC_URL);
    const cvUrl = `${process.env.MINIO_PUBLIC_URL}/${CV_BUCKET}/${fileName}`;
    res.json({
      success: true,
      data: extractedData,
      fileName: fileName,
      cvUrl: cvUrl,
      pdfText: pdfText.substring(0, 500), // First 500 chars for preview
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
