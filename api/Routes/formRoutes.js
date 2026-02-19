const express = require("express");
const router = express.Router();
const { getDB } = require("../db");
const { ObjectId } = require("mongodb");
const crypto = require("crypto"); // Needed for generating tokens

// GET /token/:token - Get candidate by form token (Hashed Access)
router.get("/token/:token", async (req, res) => {
  try {
    const { token } = req.params;
    console.log("???? Checking access for token:", token);

    const db = getDB();
    const candidate = await db
      .collection("candidats")
      .findOne({ formToken: token });

    if (!candidate) {
      console.warn("?????? No candidate found for token:", token);
      return res
        .status(404)
        .json({ success: false, error: "Invalid or expired link" });
    }

    console.log(
      "??? Candidate found:",
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
    console.log("???? Checking evaluation access for token:", token);
    const db = getDB();

    const candidate = await db
      .collection("candidats")
      .findOne({ evalToken: token });

    if (!candidate) {
      console.warn("?????? No candidate found for evaluation token:", token);
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
    const { service, questionnaire } = req.body || {};

    const formToken = crypto.randomBytes(16).toString("hex"); // Generate a unique token

    const newCandidat = {
      service: service || "",
      questionnaire: questionnaire || "",
      Nom: "",
      Pr\u00e9nom: "",
      "Date de naissance": "",
      "Adress Actuel": "",
      "Post Actuel": "",
      Soci\u00e9t\u00e9: "",
      "Date d'embauche": "",
      "Salaire net Actuel": "",
      "Votre dernier diplome": "",
      "Votre niveau de l'anglais technique": { Lu: "", Ecrit: "", Parl\u00e9: "" },
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

    if (!ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, error: "Invalid ID" });
    }

    await db.collection("candidats").updateOne(
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
