const express = require("express");
const router = express.Router();
const { getDB } = require("../db");
const { ObjectId } = require("mongodb");
const path = require("path");
const { Client } = require("minio");
const PDFDocument = require("pdfkit");
const { PassThrough } = require("stream");
const fs = require("fs");
const archiver = require("archiver");
const { pipeline } = require("stream/promises"); // For efficient streaming
const fsPromises = require("fs/promises"); // For async file operations
const crypto = require("crypto"); // Needed for candidate update (generating tokens)


// Helper function to download file from MinIO
async function downloadFileFromMinio(bucketName, objectName, outputPath) {
  const candidates = [];
  if (objectName) candidates.push(objectName);
  if (objectName && objectName.includes(" ")) {
    candidates.push(encodeURIComponent(objectName));
  }
  if (objectName && objectName.includes("%")) {
    try {
      candidates.push(decodeURIComponent(objectName));
    } catch {
      // ignore decode errors
    }
  }

  const tried = new Set();
  for (const name of candidates) {
    if (!name || tried.has(name)) continue;
    tried.add(name);
    try {
      await minioClient.statObject(bucketName, name);
      const stream = await minioClient.getObject(bucketName, name);
      const fileStream = fs.createWriteStream(outputPath);
      await pipeline(stream, fileStream);
      console.log(`Downloaded ${name} from ${bucketName} to ${outputPath}`);
      return true;
    } catch (err) {
      if (err.code === "NotFound") {
        console.warn(`MinIO object not found: ${bucketName}/${name}`);
        continue;
      }
      console.error(
        `Error downloading ${bucketName}/${name} from MinIO:`,
        err,
      );
      return false;
    }
  }
  return false;
}

function parseMinioLocation(value, defaultBucket) {
  if (!value) return null;
  try {
    if (typeof value === "string" && value.startsWith("http")) {
      const url = new URL(value);
      const parts = url.pathname.split("/").filter((p) => p);
      if (parts.length >= 2) {
        return { bucket: parts[0], objectName: parts.slice(1).join("/") };
      }
      if (parts.length === 1) {
        return { bucket: defaultBucket, objectName: parts[0] };
      }
    }
  } catch {
    // fall through to treat as objectName
  }
  return { bucket: defaultBucket, objectName: value };
}

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
const FORM2_BUCKET = "form2-bucket"; // For recruitment form PDFs
const FORM3_BUCKET = "form3-bucket"; // For evaluation PDFs
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

// POST /:id/upload-rapport-stage - Upload stage rapport
router.post("/:id/upload-rapport-stage", async (req, res) => {
  try {
    const { id } = req.params;
    const db = getDB();

    if (!ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, error: "Invalid ID" });
    }

    res.json({ success: true, message: "Stage rapport upload endpoint - implement as needed" });
  } catch (error) {
    res.status(500).json({ success: false, error: "Failed to upload rapport" });
  }
});

// PUT /eval/correct/:id - Correct evaluation
router.put("/eval/correct/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { correction, score } = req.body;
    const db = getDB();

    if (!ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, error: "Invalid ID" });
    }

    const result = await db.collection("candidats").updateOne(
      { _id: new ObjectId(id) },
      { $set: { evalCorrection: correction, evalScore: score, evalCorrectionDate: new Date() } }
    );

    if (result.matchedCount === 0) {
      return res.status(404).json({ success: false, error: "Candidate not found" });
    }

    res.json({ success: true, message: "Evaluation corrected successfully" });
  } catch (error) {
    res.status(500).json({ success: false, error: "Failed to correct evaluation" });
  }
});


// POST /:id/upload-rapport-stage - Upload stage rapport
router.post("/:id/upload-rapport-stage", async (req, res) => {
  try {
    const { id } = req.params;
    const db = getDB();

    if (!ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, error: "Invalid ID" });
    }

    // This is a placeholder - implement actual file upload logic
    res.json({ success: true, message: "Stage rapport upload endpoint - implement as needed" });
  } catch (error) {
    res.status(500).json({ success: false, error: "Failed to upload rapport" });
  }
});

// PUT /eval/correct/:id - Correct evaluation
router.put("/eval/correct/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { correction, score } = req.body;
    const db = getDB();

    if (!ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, error: "Invalid ID" });
    }

    const result = await db.collection("candidats").updateOne(
      { _id: new ObjectId(id) },
      {
        $set: {
          evalCorrection: correction,
          evalScore: score,
          evalCorrectionDate: new Date(),
        },
      }
    );

    if (result.matchedCount === 0) {
      return res
        .status(404)
        .json({ success: false, error: "Candidate not found" });
    }

    res.json({ success: true, message: "Evaluation corrected successfully" });
  } catch (error) {
    console.error("Evaluation correction error:", error);
    res
      .status(500)
      .json({ success: false, error: "Failed to correct evaluation" });
  }
});


// POST /save - Save the final CV data (manual + auto)
router.post("/save", async (req, res) => {
  try {
    const cvData = req.body;

    // Here you can save to MongoDB
    console.log("💾 Saving CV data:", cvData);

    // TODO: Add MongoDB save logic here
    // const candidate = new Candidate(cvData);
    // await candidate.save();

    const db = getDB();

    console.log("📦 Using DB:", db.databaseName);

    const newCandidat = {
      ...cvData,
      status: "en Attente",
      hiringStatus: "Attente validation client",
      formStatus: "submitted",
      originalCvMinioPath: cvData.originalCvMinioPath || null, // Use originalCvMinioPath from client if available
      // Evaluation lifecycle defaults
      evalStatus: "inactive",
      evalAnswers: null,
      evalCorrection: null,
      evalScore: null,
      evalPdfPath: null,
      createdAt: new Date(),
    };

    const result = await db.collection("candidats").insertOne(newCandidat);

    res.json({
      success: true,
      message: "CV data saved successfully",
      data: {
        id: result.insertedId,
        ...newCandidat,
      },
    });
  } catch (error) {
    console.error("Error saving CV:", error);
    res.status(500).json({
      success: false,
      error: "Failed to save CV data",
    });
  }
});

// GET / - Get all candidates
router.get("/", async (req, res) => {
  try {
    const db = getDB();
    const candidates = await db
      .collection("candidats")
      .find({})
      .sort({ createdAt: -1 })
      .toArray();

    res.json({
      success: true,
      count: candidates.length,
      data: candidates,
    });
  } catch (error) {
    console.error("Error fetching candidates:", error);
    res.status(500).json({
      success: false,
      error: "Failed to fetch candidates",
    });
  }
});

// GET /eval/token/:token - Get candidate by evaluation token
router.get("/eval/token/:token", async (req, res) => {
  try {
    const { token } = req.params;
    const db = getDB();

    const candidate = await db
      .collection("candidats")
      .findOne({ evalToken: token });

    if (!candidate) {
      return res
        .status(404)
        .json({ success: false, error: "Candidate not found with this evaluation token" });
    }

    res.json({ success: true, data: candidate });
  } catch (error) {
    console.error("Fetch error by eval token:", error);
    res
      .status(500)
      .json({ success: false, error: "Failed to fetch candidate by evaluation token" });
  }
});

// GET /token/:token - Get candidate by form token
router.get("/token/:token", async (req, res) => {
  try {
    const { token } = req.params;
    const db = getDB();

    const candidate = await db
      .collection("candidats")
      .findOne({ formToken: token });

    if (!candidate) {
      return res
        .status(404)
        .json({ success: false, error: "Candidate not found with this token" });
    }

    res.json({ success: true, data: candidate });
  } catch (error) {
    console.error("Fetch error by token:", error);
    res
      .status(500)
      .json({ success: false, error: "Failed to fetch candidate by token" });
  }
});

// GET /:id - Get a single candidate
router.get("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const db = getDB();

    if (!ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, error: "Invalid ID" });
    }

    const candidate = await db
      .collection("candidats")
      .findOne({ _id: new ObjectId(id) });

    if (!candidate) {
      return res
        .status(404)
        .json({ success: false, error: "Candidate not found" });
    }

    res.json({ success: true, data: candidate });
  } catch (error) {
    console.error("Fetch error:", error);
    res
      .status(500)
      .json({ success: false, error: "Failed to fetch candidate" });
  }
});

const EVAL_ANSWER_KEY = {
  q1: "B",
  q2: "B",
  q3: "B",
  q4: "B",
  q5: "A",
  q6: "B",
  q7: "A",
  q8: "D",
  q9: "B",
  q10: "B",
  q11: "B",
  q12: "A",
  q13: "D",
  q14: "A",
  q15: "A",
  q16: "B",
  q17: "C",
  q18: "B",
  q19: "B",
  q20: "B",
  q21: "B",
  q22: "B",
  q23: "B",
  q24: "D",
  q25: "B",
  q26: "A",
  q27: "B",
  q28: "A",
  q29: "D",
  q30: "A",
  q31: "A",
  q32: "A",
  q33: "D",
  q34: "D",
  q35: "A",
  q36: "A",
  q37: "D",
  q38: "B",
  q39: "A",
  q40: "A",
  q41: "B",
  q42: "A",
  q43: "A",
  q44: "A",
  q45: "A",
  q46: "C",
  q47: "C",
};

const EVAL_QUESTION_ORDER = Object.keys(EVAL_ANSWER_KEY);

const normalizeAnswer = (value) => {
  if (!value) return null;
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  const match = trimmed.match(/^([A-Da-d])/);
  if (match) return match[1].toUpperCase();
  const parenMatch = trimmed.match(/^([a-d])\)/i);
  if (parenMatch) return parenMatch[1].toUpperCase();
  return null;
};

// PUT /eval/submit/:id - Submit evaluation for a candidate (auto-corrected)
router.put("/eval/submit/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const answers = req.body || {};
    const db = getDB();

    if (!ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, error: "Invalid ID" });
    }

    const candidate = await db
      .collection("candidats")
      .findOne({ _id: new ObjectId(id) });
    if (!candidate) {
      return res
        .status(404)
        .json({ success: false, error: "Candidate not found" });
    }

    const evalCorrection = {};
    let correctCount = 0;
    EVAL_QUESTION_ORDER.forEach((qId) => {
      const expected = EVAL_ANSWER_KEY[qId];
      const given = normalizeAnswer(answers[qId]);
      const isCorrect = given === expected;
      evalCorrection[qId] = isCorrect;
      if (isCorrect) correctCount += 1;
    });

    const doc = new PDFDocument({ margin: 50 });
    const stream = new PassThrough();
    doc.pipe(stream);

    doc
      .fontSize(20)
      .text("Évaluation Corrigée - Form3", { align: "center" });
    doc.moveDown();
    doc
      .fontSize(12)
      .text(
        `Candidat : ${(candidate["Prénom"] || candidate["Pr\u00E9nom"] || "").toString()} ${candidate.Nom || ""}`,
      );
    doc.text(`Note Finale : ${correctCount}/${EVAL_QUESTION_ORDER.length}`);
    doc.moveDown();

    EVAL_QUESTION_ORDER.forEach((qId) => {
      const expected = EVAL_ANSWER_KEY[qId];
      const givenRaw = answers[qId];
      const given = normalizeAnswer(givenRaw);
      const isCorrect = evalCorrection[qId];

      doc.fontSize(10).fillColor("#2d3748").text(`${qId.toUpperCase()}`);
      doc
        .fillColor("#4a5568")
        .text(`Réponse : ${given || "N/A"} (${givenRaw || "N/A"})`);
      doc
        .fillColor(isCorrect ? "#38a169" : "#e53e3e")
        .text(`Correction : ${isCorrect ? "VRAI" : "FAUX"} | Attendu : ${expected}`);
      doc.moveDown(0.4);
    });

    doc.end();

    const fileName = `eval-${candidate.Nom || "candidat"}-${Date.now()}.pdf`;
    const chunks = [];
    stream.on("data", (c) => chunks.push(c));

    await new Promise((resolve, reject) => {
      stream.on("end", async () => {
        try {
          const buffer = Buffer.concat(chunks);
          await minioClient.putObject(
            FORM3_BUCKET,
            fileName,
            buffer,
            buffer.length,
            { "Content-Type": "application/pdf" },
          );
          resolve();
        } catch (err) {
          reject(err);
        }
      });
      stream.on("error", reject);
    });

    const pdfUrl = `${process.env.MINIO_PUBLIC_URL}/${FORM3_BUCKET}/${fileName}`;

    const result = await db.collection("candidats").updateOne(
      { _id: new ObjectId(id) },
      {
        $set: {
          evalAnswers: answers,
          evalCorrection,
          evalScore: correctCount,
          evalStatus: "corrected",
          evalPdfPath: pdfUrl,
          evalSubmittedAt: new Date(),
        },
      },
    );

    if (result.matchedCount === 0) {
      return res
        .status(404)
        .json({ success: false, error: "Candidate not found" });
    }

    res.json({
      success: true,
      message: "Evaluation submitted and corrected successfully",
      evalScore: correctCount,
      evalPdfPath: pdfUrl,
    });
  } catch (error) {
    console.error("Evaluation submit error:", error);
    res
      .status(500)
      .json({ success: false, error: "Failed to submit evaluation" });
  }
});

// PUT /qualified/:id - Mark candidate as qualified
router.put("/qualified/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const db = getDB();

    if (!ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, error: "Invalid ID" });
    }

    const result = await db.collection("candidats").updateOne(
      { _id: new ObjectId(id) },
      {
        $set: {
          qualified: true,
          qualifiedDate: new Date(),
        },
      }
    );

    if (result.matchedCount === 0) {
      return res
        .status(404)
        .json({ success: false, error: "Candidate not found" });
    }

    res.json({ success: true, message: "Candidate marked as qualified" });
  } catch (error) {
    console.error("Qualified error:", error);
    res
      .status(500)
      .json({ success: false, error: "Failed to mark candidate as qualified" });
  }
});

// PUT /:id - Update a candidate (e.g. for comments or enabling form)
router.put("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;
    const db = getDB();

    if (!ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, error: "Invalid ID" });
    }

    // If enabling the form, generate a secure token if it doesn't exist
    if (updates.formStatus === "active") {
      console.log("🔑 Activating form for candidate ID:", id);
      const candidate = await db
        .collection("candidats")
        .findOne({ _id: new ObjectId(id) });
      if (candidate && !candidate.formToken) {
        updates.formToken = crypto.randomBytes(16).toString("hex");
        console.log("🆕 Generated new token:", updates.formToken);
      } else if (candidate) {
        console.log("ℹ️ Using existing token:", candidate.formToken);
      }
    }

    // If enabling evaluation, generate an eval token if missing
    if (updates.evalStatus === "active") {
      console.log("🧪 Activating evaluation for candidate ID:", id);
      const candidate = await db
        .collection("candidats")
        .findOne({ _id: new ObjectId(id) });
      if (candidate && !candidate.evalToken) {
        updates.evalToken = crypto.randomBytes(16).toString("hex");
        console.log("🆕 Generated eval token:", updates.evalToken);
      } else if (candidate) {
        console.log("ℹ️ Existing eval token:", candidate.evalToken);
      }
    }

    // Remove _id from updates if present
    delete updates._id;

    const result = await db
      .collection("candidats")
      .updateOne({ _id: new ObjectId(id) }, { $set: updates });

    if (result.matchedCount === 0) {
      return res
        .status(404)
        .json({ success: false, error: "Candidate not found" });
    }

    // Return the updated data so frontend can get the token
    const updatedCandidate = await db
      .collection("candidats")
      .findOne({ _id: new ObjectId(id) });

    res.json({
      success: true,
      message: "Updated successfully",
      data: updatedCandidate,
    });
  } catch (error) {
    console.error("Update error:", error);
    res
      .status(500)
      .json({ success: false, error: "Failed to update candidate" });
  }
});


// DELETE /:id - Delete a candidate
router.delete("/:id", async (req, res) => {
  try {
    const db = getDB();
    const { id } = req.params;

    if (!ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        error: "Invalid ID format",
      });
    }

    const result = await db.collection("candidats").deleteOne({
      _id: new ObjectId(id),
    });

    if (result.deletedCount === 0) {
      return res.status(404).json({
        success: false,
        error: "Candidate not found",
      });
    }

    res.json({
      success: true,
      message: "Candidate deleted successfully",
    });
  } catch (error) {
    console.error("Error deleting candidate:", error);
    res.status(500).json({
      success: false,
      error: "Failed to delete candidate",
    });
  }
});

// NEW ROUTE: Download all documents for a single candidate by ID
router.get("/:id/download-docs", async (req, res) => {
  const db = getDB();
  const { id } = req.params;
  console.log(
    `[${new Date().toISOString()}] Received download request for candidate ID: ${id}`,
  );

  if (!ObjectId.isValid(id)) {
    console.error(
      `[${new Date().toISOString()}] Invalid candidate ID received: ${id}`,
    );
    return res
      .status(400)
      .json({ success: false, error: "Invalid candidate ID" });
  }

  const tempDownloadDir = path.join(
    __dirname,
    "..",
    "temp_downloads_single",
    `candidate_${id}_${Date.now()}`,
  );
  const outputZipPath = path.join(
    __dirname,
    "..",
    "temp_downloads_single",
    `candidate_${id}_documents.zip`,
  );

  try {
    await fsPromises.mkdir(tempDownloadDir, { recursive: true });
    console.log(
      `[${new Date().toISOString()}] Created temp directory: ${tempDownloadDir}`,
    );

    const candidate = await db
      .collection("candidats")
      .findOne({ _id: new ObjectId(id) });

    if (!candidate) {
      console.error(
        `[${new Date().toISOString()}] Candidate not found for ID: ${id}`,
      );
      return res
        .status(404)
        .json({ success: false, error: "Candidate not found." });
    }
    console.log(
      `[${new Date().toISOString()}] Found candidate: ${candidate.Nom}`,
    );

    const documentsToDownload = [];
    const candidateName = `${candidate.Nom || "Unknown"}_${candidate["Prénom"] || "Candidate"}`;

    console.log(`[Download] Candidate data keys:`, Object.keys(candidate));
    console.log(`[Download] originalCvMinioPath:`, candidate.originalCvMinioPath);
    console.log(`[Download] cvPath:`, candidate.cvPath);
    console.log(`[Download] cvUrl:`, candidate.cvUrl);

    console.log(`[Download Debug] Raw CV paths from candidate: originalCvMinioPath=${candidate.originalCvMinioPath}, cvPath=${candidate.cvPath}, cvUrl=${candidate.cvUrl}, cvFileName=${candidate.cvFileName}`);
    const cvPath =
      candidate.originalCvMinioPath ||
      candidate.cvPath ||
      candidate.cvUrl ||
      candidate.cvFileName;
    if (cvPath) {
      console.log(`[Download Debug] Selected cvPath for download: ${cvPath}`);
      try {
        const parsed = parseMinioLocation(cvPath, CV_BUCKET);
        if (parsed && parsed.objectName) {
          console.log(
            `[Download Debug] CV: extracted bucket: ${parsed.bucket}, objectName: ${parsed.objectName}`,
          );
          documentsToDownload.push({
            bucket: parsed.bucket || CV_BUCKET,
            objectName: parsed.objectName,
            fileName: `${candidateName}_CV_Original${path.extname(parsed.objectName) || ".pdf"}`,
          });
        }
      } catch (err) {
        console.error(`[Download] Error parsing CV path: ${err.message}`);
      }
    }

    if (candidate.qualifiedFormPath) {
      console.log(`[Download Debug] qualifiedFormPath from DB: ${candidate.qualifiedFormPath}`);
      try {
        const parsed = parseMinioLocation(candidate.qualifiedFormPath, FORM2_BUCKET);
        if (parsed && parsed.objectName) {
          console.log(
            `[Download Debug] Form2: bucket: ${parsed.bucket}, objectName: ${parsed.objectName}`,
          );
          documentsToDownload.push({
            bucket: parsed.bucket || FORM2_BUCKET,
            objectName: parsed.objectName,
            fileName: `${candidateName}_Questionnaire_Recrutement.pdf`,
          });
        }
      } catch (e) {
        console.error(`[Download Debug] Error parsing qualifiedFormPath URL: ${e.message}`);
      }
    }

    if (candidate.evalPdfPath) {
      const parsed = parseMinioLocation(candidate.evalPdfPath, FORM3_BUCKET);
      if (parsed && parsed.objectName) {
        documentsToDownload.push({
          bucket: parsed.bucket || FORM3_BUCKET,
          objectName: parsed.objectName,
          fileName: `${candidateName}_Evaluation_Corrigee.pdf`,
        });
      }
    }

    if (candidate.rapportStagePath) {
      const parsed = parseMinioLocation(candidate.rapportStagePath, RAPPORT_BUCKET);
      if (parsed && parsed.objectName) {
        const ext = path.extname(parsed.objectName) || ".pdf";
        documentsToDownload.push({
          bucket: parsed.bucket || RAPPORT_BUCKET,
          objectName: parsed.objectName,
          fileName: `${candidateName}_Rapport_Stage${ext}`,
        });
      }
    }

    console.log(
      `[${new Date().toISOString()}] Documents to download:`,
      JSON.stringify(documentsToDownload, null, 2),
    );

    if (documentsToDownload.length === 0) {
      console.warn(
        `[${new Date().toISOString()}] No documents found for candidate ID: ${id}`,
      );
      return res.status(404).json({
        success: false,
        error: "No documents found for this candidate.",
      });
    }

    for (const docInfo of documentsToDownload) {
      const fullPath = path.join(tempDownloadDir, docInfo.fileName);
      const downloaded = await downloadFileFromMinio(
        docInfo.bucket,
        docInfo.objectName,
        fullPath,
      );
      if (!downloaded) {
        console.warn(
          `[${new Date().toISOString()}] Skipping missing file: ${docInfo.objectName} in bucket ${docInfo.bucket}`,
        );
      }
    }

    console.log(
      `[${new Date().toISOString()}] All available documents downloaded locally. Starting zip process...`,
    );
    const archive = archiver("zip", { zlib: { level: 9 } });
    const output = fs.createWriteStream(outputZipPath);

    output.on("close", () => {
      console.log(
        `[${new Date().toISOString()}] Zip archive created: ${outputZipPath}. Size: ${archive.pointer()} bytes.`,
      );
      res.download(outputZipPath, `${candidateName}_documents.zip`, (err) => {
        if (err) {
          console.error(
            `[${new Date().toISOString()}] Error sending zip file to client:`,
            err,
          );
        } else {
          console.log(
            `[${new Date().toISOString()}] Zip file sent successfully to client.`,
          );
        }
        // Cleanup temp files
        fsPromises
          .rm(tempDownloadDir, { recursive: true, force: true })
          .catch((err) =>
            console.error(`Error removing temp dir: ${err.message}`),
          );
        fsPromises
          .rm(outputZipPath, { force: true })
          .catch((err) =>
            console.error(`Error removing zip file: ${err.message}`),
          );
      });
    });

    archive.on("error", (err) => {
      console.error(`[${new Date().toISOString()}] Archiver error:`, err);
      throw err;
    });

    archive.pipe(output);
    archive.directory(tempDownloadDir, false);
    await archive.finalize();
    console.log(`[${new Date().toISOString()}] Finalizing archive.`);
  } catch (error) {
    console.error(
      `[${new Date().toISOString()}] Error in /:id/download-docs for ID ${id}:`,
      error,
    );
    res.status(500).json({
      success: false,
      error: "Failed to generate and download documents archive.",
    });
    // Ensure cleanup on error
    fsPromises
      .rm(tempDownloadDir, { recursive: true, force: true })
      .catch((err) =>
        console.error(`Error removing temp dir on error: ${err.message}`),
      );
    fsPromises
      .rm(outputZipPath, { force: true })
      .catch((err) =>
        console.error(`Error removing zip file on error: ${err.message}`),
      );
  }
});


module.exports = router;
