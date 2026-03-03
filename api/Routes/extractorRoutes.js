const express = require("express");
const router = express.Router();
const multer = require("multer");
const pdf = require("pdf-parse");
const axios = require("axios");
const { Queue, Worker } = require("bullmq");
const { Client } = require("minio");
const { getDB } = require("../db");

const extractionJobs = new Map();
const extractionBatches = new Map();

const REDIS_HOST = process.env.REDIS_HOST || "redis";
const REDIS_PORT = Number(process.env.REDIS_PORT || 6379);
const redisConnection = {
  host: REDIS_HOST,
  port: REDIS_PORT,
};

// MinIO Client
const minioClient = new Client({
  endPoint: "minio",
  port: 9000,
  useSSL: false,
  accessKey: process.env.MINIO_ACCESS_KEY || "minioadmin",
  secretKey: process.env.MINIO_SECRET_KEY || "minioadmin",
});

// Ensure buckets exist and have public read policy
const BUCKETS = [
  "cv-bucket",
  "form1-bucket",
  "form2-bucket",
  "form3-bucket",
  "rapport-bucket",
];
const CV_BUCKET = "cv-bucket";

BUCKETS.forEach((bucket) => {
  minioClient.bucketExists(bucket, (err, exists) => {
    if (err) {
      console.error(`Error checking bucket "${bucket}":`, err);
      return;
    }

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
      minioClient.makeBucket(bucket, "us-east-1", (makeErr) => {
        if (makeErr) {
          console.error(`Error creating bucket "${bucket}":`, makeErr);
          return;
        }
        minioClient.setBucketPolicy(bucket, JSON.stringify(policy), (policyErr) => {
          if (policyErr) {
            console.error(`Error setting policy for "${bucket}":`, policyErr);
          }
        });
      });
      return;
    }

    minioClient.setBucketPolicy(bucket, JSON.stringify(policy), (policyErr) => {
      if (policyErr) {
        console.error(`Error setting policy for "${bucket}":`, policyErr);
      }
    });
  });
});

// Configure multer for CV file upload (memory storage for parsing)
const uploadCv = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB per file
  fileFilter: (req, file, cb) => {
    if (file.mimetype === "application/pdf") {
      cb(null, true);
      return;
    }
    cb(new Error("Only PDF files are allowed!"), false);
  },
});

// Ollama client - uses Docker service name
const ollama = axios.create({
  baseURL: process.env.OLLAMA_HOST || "http://ollama:11434",
  timeout: 300000, // 5 minutes
});

const EMAIL_REGEX = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i;

const extractEmailFromText = (text) => {
  if (!text) return "-";
  const match = text.match(EMAIL_REGEX);
  return match ? match[0] : "-";
};

const createJobId = () => `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
const createBatchId = () => `batch-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

function updateBatchOnJobStart(batchId) {
  const batch = extractionBatches.get(batchId);
  if (!batch) return;

  batch.status = "processing";
  batch.queued = Math.max(0, batch.queued - 1);
  batch.processing += 1;
  extractionBatches.set(batchId, batch);
}

function updateBatchOnJobEnd(batchId, jobId, payload, failed = false) {
  const batch = extractionBatches.get(batchId);
  if (!batch) return;

  batch.processing = Math.max(0, batch.processing - 1);
  if (failed) {
    batch.failed += 1;
    batch.errors.push({ jobId, ...payload });
  } else {
    batch.completed += 1;
    batch.results.push({ jobId, ...payload });
  }

  if (batch.completed + batch.failed >= batch.total) {
    if (batch.failed === 0) {
      batch.status = "done";
    } else if (batch.completed === 0) {
      batch.status = "error";
    } else {
      batch.status = "partial";
    }
    batch.finishedAt = Date.now();
  }

  extractionBatches.set(batchId, batch);
}

function getObjectBuffer(bucket, objectName) {
  return new Promise((resolve, reject) => {
    minioClient.getObject(bucket, objectName, (err, stream) => {
      if (err) {
        reject(err);
        return;
      }

      const chunks = [];
      stream.on("data", (chunk) => chunks.push(chunk));
      stream.on("error", reject);
      stream.on("end", () => resolve(Buffer.concat(chunks)));
    });
  });
}

// Extract candidate name + email using Ollama
async function extractNameWithOllama(pdfText) {
  const prompt = `You are a STRICT data extraction engine.

ABSOLUTE RULES:
- Extract ONLY the candidate's name and email.
- DO NOT infer, guess, normalize, or harmonize values.
- If a field is empty, unclear, or ambiguous, return "-".
- Output VALID JSON ONLY.
- NO explanations. NO comments. NO extra text.
- Preserve multi-word surnames exactly as written.
- Common surname particles that belong to "Nom" include: El, Al, Ait, Ben, Bin, Ibn, De, Del, Della, Van, Von, Di, Da, Le, La.
- If a full name has 3+ tokens and there is no explicit split in the document, prefer:
  "Prenom" = first token(s) used as given name,
  "Nom" = remaining token(s), keeping surname particles attached.
- Never drop surname tokens. If you are not sure, keep more tokens in "Nom" rather than losing them.
- Examples:
  "Basma El Makoul" => Prenom: "Basma", Nom: "El Makoul"
  "Ayman Ait Hado" => Prenom: "Ayman", Nom: "Ait Hado"

JSON FORMAT (must match EXACTLY):
{
  "Nom": "string",
  "Prenom": "string",
  "Email": "string"
}

DOCUMENT TEXT:
${pdfText}

JSON:`;

  const response = await ollama.post("/api/generate", {
    model: process.env.OLLAMA_MODEL || "qwen2.5:latest",
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

  const raw = String(response.data?.response || "")
    .replace(/```json|```/g, "")
    .trim();
  const firstBrace = raw.indexOf("{");
  const lastBrace = raw.lastIndexOf("}");

  if (firstBrace === -1 || lastBrace === -1 || lastBrace <= firstBrace) {
    throw new Error("No JSON object returned by model");
  }

  const extracted = JSON.parse(raw.slice(firstBrace, lastBrace + 1));
  return {
    Nom: extracted.Nom || "-",
    Prenom: extracted.Prenom || extracted["Prénom"] || "-",
    Email: extracted.Email || extracted.email || "-",
  };
}

async function processCvExtractionJob(jobData) {
  const { jobId, batchId, fileName } = jobData;
  const current = extractionJobs.get(jobId) || {};

  extractionJobs.set(jobId, {
    ...current,
    status: "processing",
    error: null,
    startedAt: Date.now(),
  });

  if (batchId) {
    updateBatchOnJobStart(batchId);
  }

  const pdfBuffer = await getObjectBuffer(CV_BUCKET, fileName);
  const pdfData = await pdf(pdfBuffer);
  const pdfText = pdfData.text || "";
  const headText = pdfText.slice(0, 2000);
  const extractedData = await extractNameWithOllama(headText);
  const fallbackEmail = extractEmailFromText(pdfText);
  const email =
    extractedData.Email && extractedData.Email !== "-"
      ? extractedData.Email
      : fallbackEmail;
  const cvUrl = `${process.env.MINIO_PUBLIC_URL}/${CV_BUCKET}/${fileName}`;

  const db = getDB();
  const archiveDoc = {
    Nom: extractedData.Nom || "",
    Prenom: extractedData.Prenom || "",
    Email: email || "",
    service: "",
    cvUrl,
    createdAt: new Date(),
  };
  const result = await db.collection("archive").insertOne(archiveDoc);
  const finalData = { _id: result.insertedId, ...archiveDoc };

  extractionJobs.set(jobId, {
    ...current,
    status: "done",
    error: null,
    data: finalData,
    cvUrl,
    fileName,
    completedAt: Date.now(),
  });

  if (batchId) {
    updateBatchOnJobEnd(batchId, jobId, {
      fileName,
      cvUrl,
      Nom: finalData.Nom,
      Prenom: finalData.Prenom,
      Email: finalData.Email,
    });
  }

  return finalData;
}

const cvExtractionQueue = new Queue("cv-extraction", {
  connection: redisConnection,
  defaultJobOptions: {
    removeOnComplete: 1000,
    removeOnFail: 1000,
  },
});

const cvExtractionWorker = new Worker(
  "cv-extraction",
  async (job) => processCvExtractionJob(job.data),
  {
    connection: redisConnection,
    concurrency: 1, // process CVs strictly one-by-one
  },
);

cvExtractionWorker.on("failed", (job, err) => {
  if (!job) return;
  const { jobId, batchId, fileName } = job.data || {};
  const current = extractionJobs.get(jobId) || {};
  const errorMessage = err?.message || "Extraction failed";

  extractionJobs.set(jobId, {
    ...current,
    status: "error",
    error: errorMessage,
    data: null,
    fileName: fileName || current.fileName,
    completedAt: Date.now(),
  });

  if (batchId) {
    updateBatchOnJobEnd(
      batchId,
      jobId,
      { fileName: fileName || current.fileName, error: errorMessage },
      true,
    );
  }
});

cvExtractionWorker.on("error", (err) => {
  console.error("BullMQ worker error:", err);
});

// POST / - Upload and extract one CV (queued)
router.post("/", uploadCv.single("cv"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: "No PDF file uploaded",
      });
    }

    const encodedOriginalname = encodeURIComponent(req.file.originalname);
    const fileName = `${Date.now()}-${encodedOriginalname}`;

    await minioClient.putObject(
      CV_BUCKET,
      fileName,
      req.file.buffer,
      req.file.size,
      { "Content-Type": "application/pdf" },
    );

    const jobId = createJobId();
    extractionJobs.set(jobId, {
      status: "queued",
      error: null,
      data: null,
      fileName,
      createdAt: Date.now(),
    });

    await cvExtractionQueue.add(
      "extract-cv",
      { jobId, fileName },
      { jobId, attempts: 2, backoff: { type: "exponential", delay: 2000 } },
    );

    return res.json({
      success: true,
      jobId,
      message: "Extraction queued",
    });
  } catch (error) {
    console.error("Error queueing CV extraction:", error);
    return res.status(500).json({
      success: false,
      error: "Erreur lors de la mise en file: " + error.message,
    });
  }
});

// POST /batch - Upload many CVs and process sequentially via queue
router.post("/batch", uploadCv.array("cvs", 200), async (req, res) => {
  try {
    const files = Array.isArray(req.files) ? req.files : [];
    if (!files.length) {
      return res.status(400).json({
        success: false,
        error: "No PDF files uploaded",
      });
    }

    const batchId = createBatchId();
    const jobsToAdd = [];
    const jobIds = [];

    for (let i = 0; i < files.length; i += 1) {
      const file = files[i];
      const encodedOriginalname = encodeURIComponent(file.originalname);
      const fileName = `${Date.now()}-${i + 1}-${encodedOriginalname}`;
      const jobId = `${batchId}-${i + 1}`;

      await minioClient.putObject(
        CV_BUCKET,
        fileName,
        file.buffer,
        file.size,
        { "Content-Type": "application/pdf" },
      );

      extractionJobs.set(jobId, {
        status: "queued",
        error: null,
        data: null,
        fileName,
        batchId,
        position: i + 1,
        createdAt: Date.now(),
      });

      jobsToAdd.push({
        name: "extract-cv",
        data: { jobId, batchId, fileName },
        opts: {
          jobId,
          attempts: 2,
          backoff: { type: "exponential", delay: 2000 },
        },
      });
      jobIds.push(jobId);
    }

    extractionBatches.set(batchId, {
      status: "queued",
      total: files.length,
      queued: files.length,
      processing: 0,
      completed: 0,
      failed: 0,
      jobIds,
      results: [],
      errors: [],
      createdAt: Date.now(),
    });

    await cvExtractionQueue.addBulk(jobsToAdd);

    return res.json({
      success: true,
      batchId,
      total: files.length,
      message: "Batch extraction queued",
    });
  } catch (error) {
    console.error("Error queueing batch extraction:", error);
    return res.status(500).json({
      success: false,
      error: "Batch queue failed: " + error.message,
    });
  }
});

// GET /status/:id - Check one extraction status
router.get("/status/:id", async (req, res) => {
  const { id } = req.params;
  const job = extractionJobs.get(id);
  if (!job) {
    return res.status(404).json({ success: false, error: "Job not found" });
  }
  return res.json({ success: true, ...job });
});

// GET /batch-status/:id - Check folder extraction status
router.get("/batch-status/:id", async (req, res) => {
  const { id } = req.params;
  const batch = extractionBatches.get(id);
  if (!batch) {
    return res.status(404).json({ success: false, error: "Batch not found" });
  }

  const jobs = batch.jobIds.map((jobId) => {
    const job = extractionJobs.get(jobId) || {};
    return {
      jobId,
      status: job.status || "unknown",
      error: job.error || null,
      fileName: job.fileName || null,
    };
  });

  return res.json({ success: true, ...batch, jobs });
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

    const fileName = `${Date.now()}-${req.file.originalname}`;
    await minioClient.putObject(
      CV_BUCKET,
      fileName,
      req.file.buffer,
      req.file.size,
      { "Content-Type": "application/pdf" },
    );

    const cvUrl = `${process.env.MINIO_PUBLIC_URL}/${CV_BUCKET}/${fileName}`;

    return res.json({
      success: true,
      message: "CV file uploaded successfully",
      fileName,
      cvUrl,
    });
  } catch (error) {
    console.error("Error uploading CV only:", error);
    return res.status(500).json({
      success: false,
      error: "Failed to upload CV file: " + error.message,
    });
  }
});

// GET /health - Check Ollama + Redis queue connectivity
router.get("/health", async (req, res) => {
  try {
    const [ollamaResponse, queueCounts] = await Promise.all([
      ollama.get("/api/tags"),
      cvExtractionQueue.getJobCounts("waiting", "active", "completed", "failed"),
    ]);

    return res.json({
      success: true,
      ollamaRunning: true,
      modelCount: ollamaResponse.data.models ? ollamaResponse.data.models.length : 0,
      queueRunning: true,
      queueCounts,
    });
  } catch (error) {
    console.error("Extractor health check failed:", error.message);
    return res.json({
      success: true,
      ollamaRunning: false,
      queueRunning: false,
      error: error.message,
    });
  }
});

module.exports = router;
