const express = require("express");
const router = express.Router();
const { getDB } = require("../db");
const { ObjectId } = require("mongodb");
const path = require("path");
const { Client } = require("minio");
const multer = require("multer");
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

async function getObjectStreamWithFallback(bucketName, objectName) {
  const candidates = [];
  if (objectName) candidates.push(objectName);
  if (objectName && objectName.includes("%")) {
    try {
      candidates.push(decodeURIComponent(objectName));
    } catch {
      // ignore decode errors
    }
  }
  if (objectName && objectName.includes(" ")) {
    candidates.push(encodeURIComponent(objectName));
  }

  const tried = new Set();
  let lastError = null;
  for (const name of candidates) {
    if (!name || tried.has(name)) continue;
    tried.add(name);
    try {
      const stream = await minioClient.getObject(bucketName, name);
      return { stream, resolvedName: name };
    } catch (err) {
      lastError = err;
    }
  }

  throw lastError || new Error("Unable to load object from MinIO");
}

function escapeRegex(text) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
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
const BUCKETS = [
  "cv-bucket",
  "form1-bucket",
  "form2-bucket",
  "form3-bucket",
  "rapport-bucket",
];
const CV_BUCKET = "cv-bucket";
const FORM1_BUCKET = "form1-bucket"; // For first-form PDFs
const FORM2_BUCKET = "form2-bucket"; // For recruitment form PDFs
const FORM3_BUCKET = "form3-bucket"; // For evaluation PDFs
const RAPPORT_BUCKET = "rapport-bucket";

function normalizeServiceLookupKey(service) {
  return String(service || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "");
}

const FORM1_SERVICE_ALIASES = {
  marketing: "Marketing",
  resptechnique: "RespTechnique",
  chargeetudes: "ChargeEtudes",
  chargesetudes: "ChargeEtudes",
  commercial: "ChargeEtudes",
  relance: "ChargeEtudes",
  envoie: "ChargeEtudes",
  harmonosation: "ChargeEtudes",
  harmonisation: "ChargeEtudes",
  commande: "ChargeEtudes",
  ao: "ChargeEtudes",
  sourcing: "ChargeEtudes",
  emailing: "ChargeEtudes",
  frontoffice: "FrontOffice",
  anglais: "Anglais",
  logistique: "Logistique",
  devlaravel: "DevLaravel",
  info: "DevLaravel",
  rh: "RH",
  ct: "C.T",
  ctservice: "C.T",
  infographiste: "Infographiste",
  aidecomptable: "Aide Comptable",
  chargefacturation: "Charge Facturation",
  facturation: "Charge Facturation",
  electricien: "Electricien",
};

const FORM1_SERVICE_CONFIG = {
  Marketing: {
    questions: [
      { label: "Prospection par Email (Emailing)", key: "marketing_emailing" },
      {
        label: "Prospection sur LinkedIn et d'autres reseaux sociaux",
        key: "marketing_linkedin",
      },
      { label: "Prospection telephonique", key: "marketing_tel" },
      { label: "Etude du Marche", key: "marketing_etude" },
      { label: "Diagnostic strategique", key: "marketing_diagnostic" },
    ],
    motivations: [],
  },
  RespTechnique: { questions: [], motivations: [] },
  ChargeEtudes: { questions: [], motivations: [] },
  FrontOffice: { questions: [], motivations: [] },
  Anglais: { questions: [], motivations: [] },
  Logistique: {
    questions: [
      { label: "Importation", key: "log_importation" },
      { label: "Export", key: "log_export" },
      { label: "Negoce", key: "log_negoce" },
      { label: "Transport Local", key: "log_transportLocal" },
    ],
    motivations: [],
  },
  DevLaravel: { questions: [], motivations: [] },
  RH: {
    questions: [
      {
        label: "Detaillez votre experience en gestion administrative RH",
        key: "rh_gestion_administrative",
      },
      {
        label: "Detaillez votre experience en recrutement et integration",
        key: "rh_recrutement_integration",
      },
      {
        label: "Detaillez votre experience en suivi social et disciplinaire",
        key: "rh_suivi_social_disciplinaire",
      },
    ],
    motivations: [],
  },
  "C.T": {
    questions: [
      { label: "Prospection", key: "ct_prospection" },
      { label: "Prise de contact", key: "ct_prise_contact" },
      { label: "Visites clients", key: "ct_visites_clients" },
      { label: "Presentation des produits", key: "ct_presentation_produits" },
      {
        label: "Elaboration de propositions commerciales",
        key: "ct_propositions_commerciales",
      },
      { label: "Elaboration des rapports", key: "ct_elaboration_rapports" },
      { label: "Atteindre les objectifs de vente", key: "ct_objectifs_vente" },
      { label: "Suivi des ventes", key: "ct_suivi_ventes" },
      { label: "Reporting journalier et hebdomadaire", key: "ct_reporting" },
    ],
    motivations: [
      {
        label: "Comment preparez-vous pour un rendez-vous client ?",
        key: "ct_motivation_rdv_client",
      },
      {
        label:
          "Quelles sont les missions que vous maitrisez pour votre integration immediate dans notre societe ?",
        key: "ct_motivation_missions_integration",
      },
      {
        label:
          "Veuillez definir les indicateurs cles qui permettent de chiffrer votre performance ?",
        key: "ct_motivation_indicateurs_performance",
      },
      {
        label: "Preferez-vous travailler seul ou en equipe ? Pourquoi ?",
        key: "ct_motivation_pref_travail",
      },
      {
        label: "Quel produit vendiez-vous lors de votre emploi precedent ?",
        key: "ct_motivation_produit_precedent",
      },
      {
        label: "Quelle etait la taille de votre portefeuille client ?",
        key: "ct_motivation_taille_portefeuille",
      },
      {
        label: "Quel chiffre d'affaires avez-vous realise ?",
        key: "ct_motivation_chiffre_affaires",
      },
      {
        label:
          "Donnez une situation difficile de vente et expliquez votre reaction.",
        key: "ct_motivation_situation_difficile",
      },
    ],
  },
  Infographiste: {
    questions: [
      {
        label: "Experience en creation de visuels pour reseaux sociaux",
        key: "infographiste_visuels_reseaux",
      },
      {
        label: "Maitrise des outils de conception",
        key: "infographiste_outils_conception",
      },
      {
        label: "Experience en supports imprimes",
        key: "infographiste_supports_imprimes",
      },
      {
        label: "Maitrise du motion design",
        key: "infographiste_motion_design",
      },
    ],
    motivations: [
      {
        label: "Preferez-vous travailler seul ou en equipe ? Pourquoi ?",
        key: "infographiste_motivation_travail_equipe",
      },
      {
        label: "Acceptez-vous de travailler a la zone industrielle Sapino ?",
        key: "infographiste_motivation_zone_sapino",
      },
      {
        label: "Etes-vous motorise ?",
        key: "infographiste_motivation_motorise",
      },
      {
        label: "Vos pretentions salariales",
        key: "infographiste_motivation_pretentions_salariales",
      },
    ],
  },
  "Aide Comptable": {
    questions: [
      {
        label: "Preparation des declarations fiscales et sociales",
        key: "aide_comptable_preparation_declarations_fiscales_sociales",
      },
      {
        label: "Saisie des factures achat / ventes sur logiciel",
        key: "aide_comptable_saisie_factures",
      },
      {
        label: "Effectuer les rapprochements bancaires",
        key: "aide_comptable_rapprochements_bancaires",
      },
      {
        label: "Lettrage de compte clients et fournisseurs",
        key: "aide_comptable_lettrage_compte_clients_fournisseurs",
      },
      {
        label: "Preparation de la cloture des comptes",
        key: "aide_comptable_preparation_cloture_comptes",
      },
      {
        label: "Analyses des comptes",
        key: "aide_comptable_analyses_comptes",
      },
    ],
    motivations: [],
  },
  "Charge Facturation": {
    questions: [
      {
        label: "Etablir les factures pour les produits/services vendus",
        key: "facturation_etablir_factures_uniforme",
      },
      {
        label: "Gestion des factures clients (envoi, suivi, relance)",
        key: "facturation_gestion_factures_clients",
      },
      {
        label: "Identifier et resoudre les problemes de facturation",
        key: "facturation_identifier_resoudre_problemes",
      },
      {
        label: "Gerer les litiges clients lies a la facturation",
        key: "facturation_gerer_litiges_clients",
      },
      {
        label: "Procedures de recouvrement des impayes",
        key: "facturation_procedures_recouvrement",
      },
      {
        label: "Suivi des paiements et echeances",
        key: "facturation_suivi_paiements_echeances",
      },
      {
        label: "Recouvrement des creances en retard",
        key: "facturation_recouvrement_creances_retard",
      },
      {
        label: "Suivi des indicateurs de facturation/recouvrement",
        key: "facturation_suivi_indicateurs",
      },
      {
        label: "Collaboration interservices pour la facturation",
        key: "facturation_collaboration_interservices",
      },
      {
        label: "Reporting creances/risques pour la direction",
        key: "facturation_reporting_creances_risques",
      },
    ],
    motivations: [
      {
        label:
          "Quelles sont les missions que vous maitrisez pour votre integration immediate dans notre societe ?",
        key: "facturation_motivation_missions_integration",
      },
      {
        label: "Preferez-vous travailler seul ou en equipe ? Pourquoi ?",
        key: "facturation_motivation_travail_equipe",
      },
      {
        label: "Acceptez-vous de travailler a la zone industrielle Sapino ?",
        key: "facturation_motivation_zone_sapino",
      },
      {
        label: "Vos pretentions salariales",
        key: "facturation_motivation_pretentions_salariales",
      },
    ],
  },
  Electricien: {
    questions: [
      {
        label: "Cablage/tirage de cables sur machines",
        key: "electricien_cablage_tirage_machines",
      },
      {
        label: "Diagnostic des dysfonctionnements",
        key: "electricien_diagnostic_dysfonctionnements",
      },
      {
        label: "Branchement secteur moyen tension",
        key: "electricien_branchement_moyenne_tension",
      },
      {
        label: "Confection et cablage des armoires electriques",
        key: "electricien_armoires_schema_puissance_commande",
      },
      {
        label: "Installer et raccorder des armoires electriques",
        key: "electricien_installer_raccorder_armoires",
      },
    ],
    motivations: [
      {
        label: "Permis de conduire categorie",
        key: "electricien_permis_conduire",
      },
    ],
  },
};

function normalizeForm1ServiceName(service) {
  const raw = String(service || "").trim();
  if (FORM1_SERVICE_CONFIG[raw]) return raw;
  const normalized = normalizeServiceLookupKey(raw);
  return FORM1_SERVICE_ALIASES[normalized] || raw;
}

function getFirstFilledValue(...values) {
  for (const value of values) {
    if (value === undefined || value === null) continue;
    if (typeof value === "string") {
      if (value.trim()) return value.trim();
      continue;
    }
    return value;
  }
  return "";
}

function normalizeLooseKey(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "");
}

function pickCandidateValue(candidateData, ...candidateKeys) {
  const direct = getFirstFilledValue(
    ...candidateKeys.map((k) => candidateData?.[k]),
  );
  if (hasRenderableValue(direct)) return direct;

  const normalizedCandidates = candidateKeys.map((k) => normalizeLooseKey(k));
  for (const [key, value] of Object.entries(candidateData || {})) {
    if (!hasRenderableValue(value)) continue;
    if (normalizedCandidates.includes(normalizeLooseKey(key))) return value;
  }
  return "";
}

function hasRenderableValue(value) {
  if (value === undefined || value === null) return false;
  if (typeof value === "string") return value.trim().length > 0;
  if (typeof value === "number") return Number.isFinite(value);
  if (typeof value === "boolean") return true;
  if (Array.isArray(value)) return value.length > 0;
  return false;
}

function toHumanLabelFromKey(key) {
  return String(key || "")
    .replace(/_/g, " ")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/\s+/g, " ")
    .trim();
}

function pickEnglishFieldValue(englishObj, canonicalField) {
  if (!englishObj || typeof englishObj !== "object") return "";
  const target = String(canonicalField || "").toLowerCase();

  const normalizedEntries = Object.entries(englishObj).map(([k, v]) => {
    const normalizedKey = String(k || "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase();
    return { key: normalizedKey, value: v };
  });

  const byExact = normalizedEntries.find(({ key }) => key === target);
  if (hasRenderableValue(byExact?.value)) return byExact.value;

  if (target === "parle") {
    const byStem = normalizedEntries.find(({ key }) => key.startsWith("parl"));
    if (hasRenderableValue(byStem?.value)) return byStem.value;
  }

  return "";
}

async function generateForm1PdfBuffer(candidateData) {
  const doc = new PDFDocument({ margin: 50 });
  const stream = new PassThrough();
  doc.pipe(stream);

  const fullName =
    `${pickCandidateValue(candidateData, "Prénom", "PrÃ©nom", "PrÃƒÂ©nom", "Prenom") || ""} ${pickCandidateValue(candidateData, "Nom") || ""}`.trim();

  doc.fontSize(20).text("Questionnaire Recrutement - Form_1", {
    align: "center",
  });
  doc.moveDown();
  doc.fontSize(12).text(`Candidat : ${fullName || "-"}`);
  doc.text(`Service : ${candidateData.service || "-"}`);
  doc.text(
    `Date de soumission : ${candidateData.formSubmittedAt ? new Date(candidateData.formSubmittedAt).toLocaleString("fr-FR") : new Date().toLocaleString("fr-FR")}`,
  );
  doc.moveDown();

  const serviceName = normalizeForm1ServiceName(candidateData.service);
  const serviceConfig = FORM1_SERVICE_CONFIG[serviceName] || {
    questions: [],
    motivations: [],
  };

  const fields = [
    ["Nom", pickCandidateValue(candidateData, "Nom")],
    [
      "Prénom",
      pickCandidateValue(candidateData, "Prénom", "PrÃ©nom", "PrÃƒÂ©nom", "Prenom"),
    ],
    ["Date de naissance", pickCandidateValue(candidateData, "Date de naissance")],
    ["Adresse Actuel", pickCandidateValue(candidateData, "Adress Actuel", "Adresse Actuel", "Adresse Actuelle")],
    ["Poste Actuel", pickCandidateValue(candidateData, "Post Actuel", "Poste Actuel")],
    [
      "Société",
      pickCandidateValue(
        candidateData,
        "Société",
        "SociÃ©tÃ©",
        "SociÃƒÂ©tÃƒÂ©",
        "Societe",
      ),
    ],
    ["Date d'embauche", pickCandidateValue(candidateData, "Date d'embauche")],
    ["Salaire net Actuel", pickCandidateValue(candidateData, "Salaire net Actuel")],
    ["Dernier diplome", pickCandidateValue(candidateData, "Votre dernier diplome")],
    ["Situation familiale", pickCandidateValue(candidateData, "situationFamiliale")],
    ["Nombre d'enfants", pickCandidateValue(candidateData, "nbEnfants")],
    ["Pourquoi changer", pickCandidateValue(candidateData, "pourquoiChanger")],
    ["Duree de preavis", pickCandidateValue(candidateData, "dureePreavis")],
    ["Fonctions/Missions", pickCandidateValue(candidateData, "fonctionsMissions")],
    ["Ecole", pickCandidateValue(candidateData, "ecole")],
    ["Annee diplome", pickCandidateValue(candidateData, "anneeDiplome")],
    ["Poste sedentaire", pickCandidateValue(candidateData, "posteSedentaire")],
    [
      "Missions maitrisees",
      getFirstFilledValue(
        pickCandidateValue(candidateData, "missionsMaitrisees"),
        pickCandidateValue(candidateData, "missionsIntegration"),
      ),
    ],
    [
      "Travail seul/equipe",
      getFirstFilledValue(
        pickCandidateValue(candidateData, "travailSeulEquipe"),
        pickCandidateValue(candidateData, "travailSeulOuEquipe"),
      ),
    ],
    [
      "Zone Sapino",
      pickCandidateValue(candidateData, "zoneSapino"),
    ],
    [
      "Motorise",
      pickCandidateValue(candidateData, "motorise"),
    ],
    [
      "Pretentions salariales",
      pickCandidateValue(candidateData, "pretentionsSalariales"),
    ],
    ["Questions/Remarques", pickCandidateValue(candidateData, "questionsRemarques")],
  ];

  const english = getFirstFilledValue(
    candidateData["Votre niveau de l'anglais technique"],
    candidateData["Votre niveau de l’anglais technique"],
  ) || {};
  fields.push(["Anglais Lu", pickEnglishFieldValue(english, "lu")]);
  fields.push(["Anglais Ecrit", pickEnglishFieldValue(english, "ecrit")]);
  fields.push(["Anglais Parle", pickEnglishFieldValue(english, "parle")]);

  const serviceSpecificFields = [];
  serviceConfig.questions.forEach((item) => {
    serviceSpecificFields.push([item.label, candidateData[item.key], item.key]);
  });
  serviceConfig.motivations.forEach((item) => {
    serviceSpecificFields.push([item.label, candidateData[item.key], item.key]);
  });

  if (serviceName === "RespTechnique") {
    serviceSpecificFields.push([
      "Experience en gestion d'equipe",
      candidateData.experienceGestionEquipe,
      "experienceGestionEquipe",
    ]);
    serviceSpecificFields.push([
      "Nombre de profils dans l'equipe",
      candidateData.nombreProfilsEquipe,
      "nombreProfilsEquipe",
    ]);
  }
  if (serviceName === "DevLaravel") {
    serviceSpecificFields.push(["Experience ERP", candidateData.dev_erp, "dev_erp"]);
  }

  const writeQuestionAnswerLine = (label, value) => {
    doc
      .fillColor("#1f2937")
      .fontSize(10)
      .font("Helvetica-Bold")
      .text(`${label} : `, { continued: true });
    doc.font("Helvetica").text(`${value || "-"}`);
    doc.moveDown(0.2);
  };

  fields.forEach(([label, value]) => {
    writeQuestionAnswerLine(label, value);
  });

  if (serviceSpecificFields.length > 0) {
    doc.moveDown();
    doc.fillColor("#111827").fontSize(12).text("Questions du service");
    doc.moveDown(0.4);
    serviceSpecificFields.forEach(([label, value]) => {
      writeQuestionAnswerLine(label, value);
    });
  }

  doc.end();

  const chunks = [];
  stream.on("data", (c) => chunks.push(c));

  await new Promise((resolve, reject) => {
    stream.on("end", resolve);
    stream.on("error", reject);
  });

  return Buffer.concat(chunks);
}

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
            console.log(`âœ… Bucket "${bucket}" created successfully`);
            minioClient.setBucketPolicy(
              bucket,
              JSON.stringify(policy),
              (err) => {
                if (err)
                  console.error(`Error setting policy for "${bucket}":`, err);
                else console.log(`âœ… Policy set for "${bucket}"`);
              },
            );
          }
        });
      } else {
        console.log(`âœ… Bucket "${bucket}" already exists`);
        minioClient.setBucketPolicy(bucket, JSON.stringify(policy), (err) => {
          if (err) console.error(`Error setting policy for "${bucket}":`, err);
          else console.log(`âœ… Policy ensured for "${bucket}"`);
        });
      }
    }
  });
});

const form2Storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadDir = path.join(__dirname, "..", "temp_uploads");
    fs.mkdirSync(uploadDir, { recursive: true });
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    cb(null, `form2-${Date.now()}${path.extname(file.originalname)}`);
  },
});

const uploadForm2 = multer({
  storage: form2Storage,
  limits: { fileSize: 20 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowedMimes = [
      "application/pdf",
      "application/msword",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ];
    if (allowedMimes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error("Only PDF or Word documents are allowed for Form 2!"), false);
    }
  },
});

// POST /:id/upload-form2 - Upload Form 2 file
router.post(
  "/:id/upload-form2",
  uploadForm2.single("form2File"),
  async (req, res) => {
    try {
      const { id } = req.params;
      if (!req.file) {
        return res
          .status(400)
          .json({ success: false, error: "No file uploaded." });
      }

      const db = getDB();
      if (!ObjectId.isValid(id)) {
        fs.unlinkSync(req.file.path);
        return res.status(400).json({ success: false, error: "Invalid ID" });
      }

      const candidate = await db
        .collection("candidats")
        .findOne({ _id: new ObjectId(id) });
      if (!candidate) {
        fs.unlinkSync(req.file.path);
        return res
          .status(404)
          .json({ success: false, error: "Candidate not found." });
      }

      const fileBuffer = fs.readFileSync(req.file.path);
      const minioFileName = `form2-${id}-${Date.now()}${path.extname(
        req.file.originalname,
      )}`;

      await minioClient.putObject(
        FORM2_BUCKET,
        minioFileName,
        fileBuffer,
        fileBuffer.length,
        { "Content-Type": req.file.mimetype },
      );

      const form2MinioPath = `${process.env.MINIO_PUBLIC_URL}/${FORM2_BUCKET}/${minioFileName}`;
      await db.collection("candidats").updateOne(
        { _id: new ObjectId(id) },
        {
          $set: {
            qualifiedFormPath: form2MinioPath,
            formStatus: "submitted",
            formSubmittedAt: new Date(),
          },
        },
      );

      if (fs.existsSync(req.file.path)) {
        fs.unlinkSync(req.file.path);
      }

      res.json({
        success: true,
        message: "Form 2 uploaded successfully.",
        filePath: form2MinioPath,
      });
    } catch (error) {
      console.error("Error uploading Form 2:", error);
      if (req.file && fs.existsSync(req.file.path)) {
        fs.unlinkSync(req.file.path);
      }
      res
        .status(500)
        .json({ success: false, error: "Server error during upload." });
    }
  },
);

// GET /file-view?fileUrl=...&bucket=...
// Streams CV/Form2 directly from MinIO for stable viewing links.
router.get("/file-view", async (req, res) => {
  try {
    const fileUrl = String(req.query.fileUrl || "").trim();
    const bucketFallback = String(req.query.bucket || CV_BUCKET).trim();
    if (!fileUrl) {
      return res
        .status(400)
        .json({ success: false, error: "fileUrl is required" });
    }

    const parsed = parseMinioLocation(fileUrl, bucketFallback);
    if (!parsed || !parsed.bucket || !parsed.objectName) {
      return res
        .status(400)
        .json({ success: false, error: "Invalid fileUrl format" });
    }

    const { stream, resolvedName } = await getObjectStreamWithFallback(
      parsed.bucket,
      parsed.objectName,
    );
    const fileName = resolvedName.split("/").pop() || "document";
    const ext = path.extname(fileName).toLowerCase();
    const contentType =
      ext === ".pdf"
        ? "application/pdf"
        : ext === ".doc"
          ? "application/msword"
          : ext === ".docx"
            ? "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
            : "application/octet-stream";

    res.setHeader("Content-Type", contentType);
    res.setHeader(
      "Content-Disposition",
      `inline; filename="${decodeURIComponent(fileName)}"`,
    );
    stream.on("error", (err) => {
      console.error("File-view stream error:", err);
      if (!res.headersSent) {
        res.status(404).json({ success: false, error: "File not found" });
      } else {
        res.end();
      }
    });
    stream.pipe(res);
  } catch (error) {
    console.error("File-view error:", error);
    if (error?.code === "NoSuchKey" || error?.code === "NotFound") {
      return res.status(404).json({ success: false, error: "File not found" });
    }
    res.status(500).json({ success: false, error: "Failed to load file" });
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
    console.log("ðŸ’¾ Saving CV data:", cvData);

    // TODO: Add MongoDB save logic here
    // const candidate = new Candidate(cvData);
    // await candidate.save();

    const db = getDB();

    console.log("ðŸ“¦ Using DB:", db.databaseName);

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

// GET /stats - Monthly dashboard stats (current year or ?year=YYYY)
router.get("/stats", async (req, res) => {
  try {
    const db = getDB();
    const yearParam = Number.parseInt(req.query.year, 10);
    const year = Number.isFinite(yearParam) ? yearParam : new Date().getFullYear();

    const candidates = await db
      .collection("candidats")
      .find(
        {},
        {
          projection: {
            createdAt: 1,
            status: 1,
            statusUpdatedAt: 1,
            hiringStatus: 1,
            hiringStatusUpdatedAt: 1,
            dateDepart: 1,
            dateDepartUpdatedAt: 1,
          },
        },
      )
      .toArray();

    const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const data = months.map((name) => ({
      name,
      candidats: 0,
      embauches: 0,
      refuses: 0,
      depart: 0,
      acceptes: 0,
    }));

    const inYear = (date) => {
      if (!date || Number.isNaN(date.getTime())) return false;
      return date.getFullYear() === year;
    };

    const getDate = (value) => {
      if (!value) return null;
      if (value instanceof Date) return value;
      const parsed = new Date(value);
      return Number.isNaN(parsed.getTime()) ? null : parsed;
    };

    const acceptedValues = new Set(["AcceptÃ©", "AcceptÃƒÂ©"]);
    const refusedValues = new Set(["RefusÃ©", "RefusÃƒÂ©"]);
    const hiredValues = new Set(["EmbaucÃ©", "EmbaucÃƒÂ©"]);

    candidates.forEach((candidate) => {
      const createdAt = getDate(candidate.createdAt);
      if (inYear(createdAt)) {
        const month = createdAt.getMonth();
        data[month].candidats += 1;
      }

      if (acceptedValues.has(candidate.status)) {
        const statusDate = getDate(candidate.statusUpdatedAt) || createdAt;
        if (inYear(statusDate)) {
          const month = statusDate.getMonth();
          data[month].acceptes += 1;
        }
      }

      if (refusedValues.has(candidate.status)) {
        const statusDate = getDate(candidate.statusUpdatedAt) || createdAt;
        if (inYear(statusDate)) {
          const month = statusDate.getMonth();
          data[month].refuses += 1;
        }
      }

      if (hiredValues.has(candidate.hiringStatus)) {
        const hireDate = getDate(candidate.hiringStatusUpdatedAt) || createdAt;
        if (inYear(hireDate)) {
          const month = hireDate.getMonth();
          data[month].embauches += 1;
        }
      }

      if (candidate.dateDepart) {
        const departDate =
          getDate(candidate.dateDepartUpdatedAt) ||
          getDate(candidate.dateDepart);
        if (inYear(departDate)) {
          const month = departDate.getMonth();
          data[month].depart += 1;
        }
      }
    });

    res.json({ success: true, year, data });
  } catch (error) {
    console.error("Error fetching stats:", error);
    res.status(500).json({ success: false, error: "Failed to fetch stats" });
  }
});

// GET /eval/token/:token - Get candidate by evaluation token
router.get("/eval/token/:token", async (req, res) => {
  try {
    const token = String(req.params.token || "").trim();
    if (!token) {
      return res
        .status(400)
        .json({ success: false, error: "Evaluation token is required" });
    }
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

// POST /eval/lookup - Find candidate by name + date of birth for evaluation access
router.post("/eval/lookup", async (req, res) => {
  try {
    const { nom, prenom, dateNaissance } = req.body || {};
    if (!nom || !prenom || !dateNaissance) {
      return res.status(400).json({
        success: false,
        error: "nom, prenom, and dateNaissance are required",
      });
    }

    const db = getDB();
    const nomRegex = new RegExp(`^${escapeRegex(nom.trim())}$`, "i");
    const prenomRegex = new RegExp(`^${escapeRegex(prenom.trim())}$`, "i");

    const nameMatch = {
      Nom: { $regex: nomRegex },
      $or: [
        { "Pr\u00e9nom": { $regex: prenomRegex } },
        { Prenom: { $regex: prenomRegex } },
      ],
    };

    let candidates = await db
      .collection("candidats")
      .find(
        {
          ...nameMatch,
          $and: [
            {
              $or: [
                { "Date de naissance": dateNaissance },
                { dateNaissance },
                { DateNaissance: dateNaissance },
              ],
            },
          ],
        },
        { sort: { createdAt: -1 } },
      )
      .toArray();

    // Fallback: if no exact DOB match, keep flow usable for records with inconsistent date field formatting.
    if (!candidates || candidates.length === 0) {
      candidates = await db
        .collection("candidats")
        .find(nameMatch, { sort: { createdAt: -1 } })
        .toArray();
    }

    if (!candidates || candidates.length === 0) {
      return res
        .status(404)
        .json({ success: false, error: "Candidate not found" });
    }

    const normalizeStatus = (value) =>
      String(value || "").trim().toLowerCase();
    const normalizeHiringStatus = (value) =>
      String(value || "")
        .trim()
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "");
    const isValidToken = (value) =>
      typeof value === "string" && /^[a-f0-9]{32}$/i.test(value.trim());

    // If duplicate profiles exist, prefer records that are already active or finalized.
    const scoreCandidate = (c) => {
      const status = normalizeStatus(c.evalStatus);
      if (status === "active" && isValidToken(c.evalToken)) return 4;
      if (status === "submitted") return 3;
      if (status === "corrected") return 2;
      if (status === "active") return 1;
      return 0;
    };

    const candidate = candidates
      .slice()
      .sort((a, b) => scoreCandidate(b) - scoreCandidate(a))[0];

    let resolvedStatus = candidate.evalStatus || "inactive";
    let token =
      typeof candidate.evalToken === "string" &&
      /^[a-f0-9]{32}$/i.test(candidate.evalToken.trim())
        ? candidate.evalToken.trim()
        : null;

    // Permanent auto-fix:
    // If a hired candidate is inactive or has an invalid token, activate evaluation automatically.
    const isHired = normalizeHiringStatus(candidate.hiringStatus) === "embauche";
    if (
      isHired &&
      (normalizeStatus(resolvedStatus) === "inactive" || !token)
    ) {
      const newToken = crypto.randomBytes(16).toString("hex");
      await db.collection("candidats").updateOne(
        { _id: candidate._id },
        {
          $set: {
            evalStatus: "active",
            evalToken: newToken,
          },
        },
      );
      resolvedStatus = "active";
      token = newToken;
    }

    res.json({
      success: true,
      data: {
        _id: candidate._id,
        evalStatus: resolvedStatus,
        evalToken: token,
      },
    });
  } catch (error) {
    console.error("Eval lookup error:", error);
    res
      .status(500)
      .json({ success: false, error: "Failed to lookup candidate" });
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
      .text("Ã‰valuation CorrigÃ©e - Form3", { align: "center" });
    doc.moveDown();
    doc
      .fontSize(12)
      .text(
        `Candidat : ${(candidate["PrÃ©nom"] || candidate["Pr\u00E9nom"] || "").toString()} ${candidate.Nom || ""}`,
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
        .text(`RÃ©ponse : ${given || "N/A"} (${givenRaw || "N/A"})`);
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

    const candidate = await db
      .collection("candidats")
      .findOne({ _id: new ObjectId(id) });
    if (!candidate) {
      return res
        .status(404)
        .json({ success: false, error: "Candidate not found" });
    }

    const now = new Date();

    // If enabling the form, generate a secure token if it doesn't exist
    if (updates.formStatus === "active") {
      console.log("???? Activating form for candidate ID:", id);
      if (!candidate.formToken) {
        updates.formToken = crypto.randomBytes(16).toString("hex");
        console.log("???? Generated new token:", updates.formToken);
      } else {
        console.log("?????? Using existing token:", candidate.formToken);
      }
    }

    // If enabling evaluation, generate an eval token if missing
    if (updates.evalStatus === "active") {
      console.log("???? Activating evaluation for candidate ID:", id);
      if (!candidate.evalToken) {
        updates.evalToken = crypto.randomBytes(16).toString("hex");
        console.log("???? Generated eval token:", updates.evalToken);
      } else {
        console.log("?????? Existing eval token:", candidate.evalToken);
      }
    }

    if (
      Object.prototype.hasOwnProperty.call(updates, "status") &&
      updates.status !== candidate.status
    ) {
      updates.statusUpdatedAt = now;
    }

    if (
      Object.prototype.hasOwnProperty.call(updates, "hiringStatus") &&
      updates.hiringStatus !== candidate.hiringStatus
    ) {
      updates.hiringStatusUpdatedAt = now;
    }

    if (
      Object.prototype.hasOwnProperty.call(updates, "dateDepart") &&
      updates.dateDepart !== candidate.dateDepart
    ) {
      updates.dateDepartUpdatedAt = now;
    }

    if (updates.formStatus === "submitted") {
      const mergedCandidateData = {
        ...candidate,
        ...updates,
        formSubmittedAt: updates.formSubmittedAt || now,
      };
      const pdfBuffer = await generateForm1PdfBuffer(mergedCandidateData);
      const candidateName = `${mergedCandidateData.Nom || "candidat"}-${mergedCandidateData["PrÃ©nom"] || mergedCandidateData["PrÃƒÂ©nom"] || mergedCandidateData.Prenom || "inconnu"}`
        .replace(/\s+/g, "-")
        .replace(/[^a-zA-Z0-9-_]/g, "")
        .toLowerCase();
      const fileName = `form1-${candidateName}-${Date.now()}.pdf`;

      await minioClient.putObject(
        FORM1_BUCKET,
        fileName,
        pdfBuffer,
        pdfBuffer.length,
        { "Content-Type": "application/pdf" },
      );

      updates.form1PdfPath = `${process.env.MINIO_PUBLIC_URL}/${FORM1_BUCKET}/${fileName}`;
    }

    // Remove _id from updates if present
    delete updates._id;

    await db
      .collection("candidats")
      .updateOne({ _id: new ObjectId(id) }, { $set: updates });

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
    const candidateName = `${candidate.Nom || "Unknown"}_${candidate["PrÃ©nom"] || "Candidate"}`;

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


