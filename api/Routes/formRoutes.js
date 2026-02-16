const express = require("express");
const router = express.Router();
const { getDB } = require("../db");
const { ObjectId } = require("mongodb");
const PDFDocument = require("pdfkit"); // Needed for PDF generation
const { PassThrough } = require("stream"); // Needed for PDF generation
const { Client } = require("minio"); // Needed for minioClient
const fsPromises = require("fs/promises"); // for file operations in case of error
const path = require("path"); // for path.join
const crypto = require("crypto"); // Needed for generating tokens


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
const FORM2_BUCKET = "form2-bucket";

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


// PATCH /qualified/:id - Submit recruitment form for a candidate
router.patch("/qualified/:id", async (req, res) => {
  console.log("⚙️ PATCH /qualified/:id route called");
  try {
    const { id } = req.params;
    const formData = req.body;
    const db = getDB();

    console.log("Received ID:", id);
    console.log("Received formData:", JSON.stringify(formData, null, 2));

    if (!ObjectId.isValid(id)) {
      console.log("Invalid ID:", id);
      return res.status(400).json({ success: false, error: "Invalid ID" });
    }

    // Fetch candidate details to get full name
    const candidate = await db.collection("candidats").findOne({ _id: new ObjectId(id) });
    if (!candidate) {
        console.log("Candidate not found for ID:", id);
        return res.status(404).json({ success: false, error: "Candidate not found" });
    }
    const fullName = `${candidate.Nom || "Unknown"}_${candidate["Prénom"] || "Candidate"}`;

    console.log("Starting PDF generation...");
    // 1. Generate PDF
    const doc = new PDFDocument({ margin: 50 });
    const stream = new PassThrough();

    doc.pipe(stream);

    // PDF Styling & Content
    doc
      .fontSize(24)
      .font("Helvetica-Bold")
      .text("Questionnaire de Recrutement", { align: "center" });
    doc.moveDown(1.5);
    doc
      .fontSize(12)
      .font("Helvetica")
      .text(`Candidat: ${fullName}`, { align: "right" });
    doc.text(`Date de soumission: ${new Date().toLocaleDateString()}`, {
      align: "right",
    });
    doc.moveDown(2);

    const questions = [
      { key: "presentezVous", label: "1. Présentez-vous ?" },
      { key: "apporteEtudes", label: "2. Que vous ont apporté vos études ?" },
      {
        key: "tempsRechercheEmploi",
        label: "3. Depuis combien de temps cherchez-vous un emploi ?",
      },
      {
        key: "qualitesDefauts",
        label: "4. Quelles sont vos qualités ? Quels sont vos défauts ?",
      },
      {
        key: "seulOuEquipe",
        label: "5. Préférez-vous travailler seul ou en équipe ? Pourquoi ?",
      },
      {
        key: "professionParents",
        label: "6. Quelle est la profession de vos parents ?",
      },
      {
        key: "pretentionsSalariales",
        label: "7. Quelles sont vos prétentions salariales ?",
      },
      {
        key: "lastExperience",
        label: "8. Tasks and responsibilities of last internship/job:",
      },
    ];

    questions.forEach((q) => {
      doc
        .fontSize(14)
        .font("Helvetica-Bold")
        .fillColor("#2d3748")
        .text(q.label);
      doc.moveDown(0.5);
      // Ensure formData[q.key] is a string or handle potential non-string values
      const answer = String(formData[q.key] || "-");
      doc
        .fontSize(12)
        .font("Helvetica")
        .fillColor("#1a202c")
        .text(answer, { indent: 20 });
      doc.moveDown(1.5);
      doc
        .moveTo(50, doc.y)
        .lineTo(550, doc.y)
        .strokeColor("#cbd5e0")
        .lineWidth(0.5)
        .stroke();
      doc.moveDown(1.5);
    });

    doc.end();
    console.log("PDF generation finished.");

    console.log("Starting MinIO upload...");
    // 2. Upload to MinIO (bucket: qualified-candidats)
    const fileName = `form-${fullName}-${Date.now()}.pdf`;

    // Collect buffer from stream
    const buffers = [];
    stream.on("data", (b) => buffers.push(b));

    await new Promise((resolve, reject) => {
      stream.on("end", async () => {
        const buffer = Buffer.concat(buffers);
        try {
          await minioClient.putObject(
            FORM2_BUCKET,
            fileName,
            buffer,
            buffer.length,
            { "Content-Type": "application/pdf" },
          );
          console.log("MinIO upload successful:", fileName);
          resolve();
        } catch (err) {
          console.error("MinIO upload failed:", err);
          reject(err);
        }
      });
      stream.on("error", (err) => {
        console.error("PDF stream error during MinIO upload:", err);
        reject(err);
      });
    });

    const pdfUrl = `${process.env.MINIO_PUBLIC_URL}/${FORM2_BUCKET}/${fileName}`;
    // 3. Update MongoDB
    const result = await db.collection("candidats").updateOne(
      { _id: new ObjectId(id) },
      {
        $set: {
          qualifiedFormPath: pdfUrl,
          formSubmittedAt: new Date(),
          formStatus: "submitted",
        },
      },
    );

    if (result.matchedCount === 0) {
      console.log("Candidate not found for ID:", id);
      return res
        .status(404)
        .json({ success: false, error: "Candidate not found" });
    }
    console.log("MongoDB update successful.");

    res.json({
      success: true,
      message: "Formulaire enregistré et PDF généré avec succès",
      pdfUrl: pdfUrl,
    });
  } catch (error) {
    console.error("Qualified submission error (caught by handler):", error);
    res
      .status(500)
      .json({ success: false, error: "Failed to process recruitment form" });
  }
});


// GET /token/:token - Get candidate by form token (Hashed Access)
router.get("/token/:token", async (req, res) => {
  try {
    const { token } = req.params;
    console.log("🔍 Checking access for token:", token);

    const db = getDB();
    const candidate = await db
      .collection("candidats")
      .findOne({ formToken: token });

    if (!candidate) {
      console.warn("⚠️ No candidate found for token:", token);
      return res
        .status(404)
        .json({ success: false, error: "Invalid or expired link" });
    }

    console.log(
      "✅ Candidate found:",
      candidate.Nom,
      "| Status:",
      candidate.formStatus,
    );
    res.json({ success: true, data: candidate });
  } catch (error) {
    console.error("Fetch by token error:", error);
    res
      .status(500)
      .json({ success: false, error: "Failed to fetch candidate" });
  }
});

// GET /eval/token/:token - Get candidate by evaluation token
router.get("/eval/token/:token", async (req, res) => {
  try {
    const { token } = req.params;
    console.log("🔍 Checking evaluation access for token:", token);
    const db = getDB();

    const candidate = await db
      .collection("candidats")
      .findOne({ evalToken: token });

    if (!candidate) {
      console.warn("⚠️ No candidate found for evaluation token:", token);
      return res
        .status(404)
        .json({ success: false, error: "Evaluation link invalid or expired" });
    }

    res.json({ success: true, data: candidate });
  } catch (error) {
    console.error("Eval token fetch error:", error);
    res.status(500).json({ success: false, error: "Server error" });
  }
});

// POST /generate-form-link - Generate a unique form link for a new candidate
router.post("/generate-form-link", async (req, res) => {
  try {
    const db = getDB();
    const { service, questionnaire } = req.body;

    const formToken = crypto.randomBytes(16).toString("hex"); // Generate a unique token

    const newCandidat = {
      service: service || "",
      questionnaire: questionnaire || "",
      Nom: "",
      Prénom: "",
      "Date de naissance": "",
      "Adress Actuel": "",
      "Post Actuel": "",
      Société: "",
      "Date d'embauche": "",
      "Salaire net Actuel": "",
      "Votre dernier diplome": "",
      "Votre niveau de l'anglais technique": { Lu: "", Ecrit: "", Parlé: "" },
      // New fields from PDF
      situationFamiliale: "",
      nbEnfants: "",
      pourquoiChanger: "",
      dureePreavis: "",
      fonctionsMissions: "",
      ecole: "",
      anneeDiplome: "",
      posteSedentaire: "",
      missionsMaitrisees: "",
      travailSeulEquipe: "",
      zoneSapino: "",
      motorise: "",
      pretentionsSalariales: "",
      questionsRemarques: "",
      status: "en Attente", // Default status
      hiringStatus: "Attente formulaire", // Candidate needs to fill out the form
      formStatus: "active", // Form is active and ready to be filled
      formToken: formToken, // Store the unique token
      originalCvMinioPath: null, // No CV uploaded yet
      evalStatus: "inactive",
      evalAnswers: null,
      evalCorrection: null,
      evalScore: null,
      evalPdfPath: null,
      createdAt: new Date(),
    };

    const result = await db.collection("candidats").insertOne(newCandidat);

    if (result.acknowledged) {
      res.json({
        success: true,
        message: "Form link generated successfully",
        formToken: formToken,
        formLink: `/create-candidate/${formToken}`,
        candidateId: result.insertedId,
      });
    } else {
      throw new Error("Failed to insert new candidate.");
    }
  } catch (error) {
    console.error("Error generating form link:", error);
    res
      .status(500)
      .json({ success: false, error: "Failed to generate form link" });
  }
});

// PATCH /eval/submit/:id - Submit evaluation answers
router.patch("/eval/submit/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const answers = req.body;
    const db = getDB();
    const { ObjectId } = require("mongodb");

    if (!ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, error: "Invalid ID" });
    }

    const result = await db.collection("candidats").updateOne(
      { _id: new ObjectId(id) },
      {
        $set: {
          evalAnswers: answers,
          evalStatus: "submitted",
          evalSubmittedAt: new Date(),
        },
      },
    );

    res.json({ success: true, message: "Evaluation submitted" });
  } catch (error) {
    console.error("Eval submission error:", error);
    res
      .status(500)
      .json({ success: false, error: "Failed to submit evaluation" });
  }
});

module.exports = router;