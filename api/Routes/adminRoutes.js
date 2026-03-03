const express = require('express');
const router = express.Router();
const { getDB } = require('../db');
const { ObjectId } = require('mongodb'); // Needed for ObjectId
const PDFDocument = require("pdfkit"); // Needed for PDF generation
const { PassThrough } = require("stream"); // Needed for PDF generation
const { Client } = require("minio"); // Needed for minioClient
const fsPromises = require("fs/promises"); // for file operations in case of error
const fs = require("fs"); // for fs.existsSync, fs.unlinkSync - though maybe not directly by this route
const path = require("path"); // for path.join

// MinIO Client - Copied from cvRoutes.js
const minioClient = new Client({
  endPoint: "minio",
  port: 9000,
  useSSL: false,
  accessKey: process.env.MINIO_ACCESS_KEY || "minioadmin",
  secretKey: process.env.MINIO_SECRET_KEY || "minioadmin",
});

// Ensure buckets exist and have public read policy - Copied from cvRoutes.js
const BUCKETS = [
  "cv-bucket",
  "form1-bucket",
  "form2-bucket",
  "form3-bucket",
  "rapport-bucket",
];
const FORM3_BUCKET = "form3-bucket";
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


// GET /list (existing)
router.get('/list', async (req, res) => {
    try {
        const db = getDB();
        const admins = await db.collection('admins').find({}).project({ password: 0 }).toArray(); // Exclude password from results

        res.json({ 
            success: true, 
            admins: admins 
        });

    } catch (error) {
        console.error('Error fetching admins:', error);
        res.status(500).json({
            success: false,
            error: 'Erreur serveur lors de la récupération des administrateurs'
        });
    }
});

// GET /auth/admins - Get all admins (alias for /list)
router.get('/auth/admins', async (req, res) => {
    try {
        const db = getDB();
        const admins = await db.collection('admins').find({}).project({ password: 0 }).toArray();

        res.json({
            success: true,
            admins: admins
        });

    } catch (error) {
        console.error('Error fetching admins:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch admins'
        });
    }
});


// GET /auth/admins - Get all admins (alias for /list)
router.get('/auth/admins', async (req, res) => {
    try {
        const db = getDB();
        const admins = await db.collection('admins').find({}).project({ password: 0 }).toArray();

        res.json({
            success: true,
            admins: admins
        });

    } catch (error) {
        console.error('Error fetching admins:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch admins'
        });
    }
});


// PATCH /eval/correct/:id - Admin corrects the evaluation and generates PDF (from cvRoutes.js)
router.patch("/eval/correct/:id", async (req, res) => {
  console.log("⚙️ PATCH /eval/correct/:id route called");
  try {
    const { id } = req.params;
    const { evalCorrection, evalScore } = req.body;
    const db = getDB();

    console.log("Received ID:", id);
    console.log(
      "Received evalCorrection:",
      JSON.stringify(evalCorrection, null, 2),
    );
    console.log("Received evalScore:", evalScore);

    if (!ObjectId.isValid(id)) {
      console.log("Invalid ID:", id);
      return res.status(400).json({ success: false, error: "Invalid ID" });
    }

    console.log("Fetching candidate data...");
    const candidate = await db
      .collection("candidats")
      .findOne({ _id: new ObjectId(id) });
    if (!candidate) {
      console.log("Candidate not found for ID:", id);
      return res
        .status(404)
        .json({ success: false, error: "Candidat non trouvé" });
    }
    console.log("Candidate found:", candidate.Nom, candidate.Prenom);

    // 1. Generate PDF with Correction
    console.log("Starting PDF generation...");
    const doc = new PDFDocument({ margin: 50 });
    const stream = new PassThrough();

    // Pipe BEFORE writing content so the stream receives data
    doc.pipe(stream);

    doc
      .fontSize(20)
      .text(`Évaluation Corrigée - Chargé d'Étude`, { align: "center" });
    doc.moveDown();
    doc
      .fontSize(14)
      .text(`Candidat : ${candidate["Prénom"] || ""} ${candidate.Nom || ""}`);
    doc.text(`Note Finale : ${parseInt(evalScore)}/38`);
    doc.moveDown();

    // Note: The 'questions' array here must match the one in AdminEvaluationCorrection.jsx
    const questions = [
      { id: "q1", text: "1. Rôle principal d'un chargé d'étude ?" },
      { id: "q2", text: "2. Erreurs critiques à éviter ?" },
      {
        id: "q3",
        text: "3. Comparaison fiche technique / offre fournisseur ?",
      },
      { id: "q4", text: "4. Inclusion des accessoires ?" },
      { id: "q5", text: "5. Vérifications avant envoi ?" },
      { id: "q6", text: "6. Exemple de non-conformité ?" },
      { id: "q7", text: "7. Risque WhatsApp ?" },
      { id: "q8", text: "8. Frais supplémentaires ?" },
      { id: "q9", text: "9. Conformité normes (ATEX, UL, etc.) ?" },
      { id: "q10", text: "10. Demande incomplète ?" },
      { id: "q11", text: "11. Doute technique ?" },
      { id: "q12", text: "12. Première info à identifier ?" },
      { id: "q13", text: "13. Étape après l'origine ?" },
      { id: "q14", text: "14. Cas UK/UK/ATIS ?" },
      { id: "q15", text: "15. Cas UK/UE/ATIS ?" },
      { id: "q16", text: "16. Cas UK/UE/Eurodistech ?" },
      { id: "q17", text: "17. Cas USA/UE ?" },
      { id: "q18", text: "18. Fournisseur différent du pays d'origine ?" },
      { id: "q19", text: "19. Prévenir RH ?" },
      { id: "q20", text: "20. Horaires officiels ?" },
      { id: "q21", text: "21. Absence urgente ?" },
      { id: "q22", text: "22. Certificat médical refusé ?" },
      { id: "q23", text: "23. Conséquences retard ?" },
      { id: "q24", text: "24. Absence non justifiée ?" },
      { id: "q25", text: "25. Compréhension règles RH ?" },
      { id: "q26", text: "26. Points flous internes ?" },
      { id: "q27", text: "27. Plan anti-malentendu ?" },
      { id: "q28", text: "28. Erreur collègue ?" },
      { id: "q29", text: "29. Tâche secondaire ?" },
      { id: "q30", text: "30. Désaccord chef ?" },
      { id: "q31", text: "31. Perturbation concentration ?" },
      { id: "q32", text: "32. Respect Open Space ?" },
      { id: "q33", text: "33. Difficulté 2 premières semaines ?" },
      { id: "q34", text: "34. Compétences renforcées ?" },
      { id: "q35", text: "35. Produits/Demandes complexes ?" },
      { id: "q36", text: "36. Bonnes pratiques ?" },
      { id: "q37", text: "37. Conseil futur recrue ?" },
      { id: "q38", text: "38. Points d'amélioration ?" },
    ];

    questions.forEach((q) => {
      doc.fontSize(10).fillColor("#2d3748").text(q.text, { bold: true });
      doc
        .fillColor("#4a5568")
        .text(
          `Réponse : ${
            (candidate.evalAnswers && candidate.evalAnswers[q.id]) || "N/A"
          }`,
        );
      const isTrue = evalCorrection[q.id];
      doc
        .fillColor(isTrue ? "#38a169" : "#e53e3e")
        .text(`Correction : ${isTrue ? "VRAI" : "FAUX"}`);
      doc.moveDown(0.5);
    });

    doc.end();
    console.log("PDF generation finished.");

    const FORM3_BUCKET = "form3-bucket";
    const fileName = `eval-${candidate.Nom}-${Date.now()}.pdf`;
    const chunks = [];
    stream.on("data", (c) => chunks.push(c));
    stream.on("end", async () => {
      console.log("PDF stream ended, preparing for MinIO upload...");
      const buffer = Buffer.concat(chunks);
      try {
        console.log("Starting MinIO upload for PDF...");
        await minioClient.putObject(
          FORM3_BUCKET,
          fileName,
          buffer,
          buffer.length,
          { "Content-Type": "application/pdf" },
        );
        const pdfUrl = `${process.env.MINIO_PUBLIC_URL}/${FORM3_BUCKET}/${fileName}`;

        console.log("Starting MongoDB update...");
        await db.collection("candidats").updateOne(
          { _id: new ObjectId(id) },
          {
            $set: {
              evalCorrection,
              evalScore, // This is sent from the frontend, should be the count
              evalStatus: "corrected",
              evalPdfPath: pdfUrl,
            },
          },
        );
        console.log("MongoDB update successful.");
        res.json({ success: true, pdfUrl });
      } catch (error) {
        console.error("Error during MinIO upload or MongoDB update:", error);
        res.status(500).json({
          success: false,
          error: "Failed to save corrected evaluation",
        });
      }
    });
    stream.on("error", (err) => {
      console.error("PDF stream error during evaluation correction:", err);
      res
        .status(500)
        .json({ success: false, error: "Error processing PDF stream" });
    });
  } catch (error) {
    console.error("Eval correction error (caught by handler):", error);
    res
      .status(500)
      .json({ success: false, error: "Failed to correct evaluation" });
  }
});


// POST /login (from authRoutes.js)
router.post('/login', async (req, res) => {
    try {
        const usernameInput = String(req.body?.username || "").trim();
        const passwordInput = String(req.body?.password || "");
        const db = getDB();
        
        console.log('🔐 Login attempt for:', usernameInput);

        if (!usernameInput || !passwordInput) {
            return res.status(400).json({
                success: false,
                error: 'Nom utilisateur et mot de passe requis'
            });
        }

        // Accept historical collection names: "admins" and "admin"
        const byExact = { username: usernameInput };
        const byInsensitive = {
            username: { $regex: `^${usernameInput.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, $options: "i" },
        };

        let admin = await db.collection('admins').findOne(byExact);
        if (!admin) admin = await db.collection('admins').findOne(byInsensitive);
        if (!admin) admin = await db.collection('admin').findOne(byExact);
        if (!admin) admin = await db.collection('admin').findOne(byInsensitive);

        if (!admin) {
            return res.status(401).json({ 
                success: false, 
                error: 'Identifiants invalides' 
            });
        }

        // Basic password check (in a real app, use bcrypt)
        if (String(admin.password || "") !== passwordInput) {
            return res.status(401).json({ 
                success: false, 
                error: 'Identifiants invalides' 
            });
        }

        // Success
        res.json({ 
            success: true, 
            message: 'Connexion réussie',
            user: { username: admin.username }
        });

    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ 
            success: false, 
            error: 'Erreur serveur lors de la connexion' 
        });
    }
});

module.exports = router;
