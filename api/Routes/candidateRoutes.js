const express = require("express");
const router = express.Router();
const { getDB } = require("../db");
const { ObjectId } = require("mongodb");
const path = require("path");
const { Client } = require("minio");
const fs = require("fs");
const archiver = require("archiver");
const { pipeline } = require("stream/promises"); // For efficient streaming
const fsPromises = require("fs/promises"); // For async file operations
const crypto = require("crypto"); // Needed for candidate update (generating tokens)


// Helper function to download file from MinIO
async function downloadFileFromMinio(bucketName, objectName, outputPath) {
  try {
    // Check if the object exists before trying to get it
    await minioClient.statObject(bucketName, objectName);
    const stream = await minioClient.getObject(bucketName, objectName);
    const fileStream = fs.createWriteStream(outputPath);
    await pipeline(stream, fileStream);
    console.log(`Downloaded ${objectName} from ${bucketName} to ${outputPath}`);
    return true;
  } catch (err) {
    if (err.code === "NotFound") {
      console.warn(`MinIO object not found: ${bucketName}/${objectName}`);
    } else {
      console.error(
        `Error downloading ${bucketName}/${objectName} from MinIO:`,
        err,
      );
    }
    return false;
  }
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
    const cvPath = candidate.originalCvMinioPath || candidate.cvPath || candidate.cvUrl || candidate.cvFileName;
    if (cvPath) {
      console.log(`[Download Debug] Selected cvPath for download: ${cvPath}`);
      try {
        let bucketFromUrl, objectName;
        
        if (cvPath.startsWith("http")) {
          const url = new URL(cvPath);
          const pathParts = url.pathname.split("/").filter(p => p);
          bucketFromUrl = pathParts[0];
          objectName = pathParts.slice(1).join("/");
        } else {
          objectName = cvPath;
          bucketFromUrl = CV_BUCKET;
        }
        
        console.log(`[Download Debug] CV: extracted bucket: ${bucketFromUrl}, objectName: ${objectName}`);
        documentsToDownload.push({
          bucket: bucketFromUrl || CV_BUCKET,
          objectName: objectName,
          fileName: `${candidateName}_CV_Original${path.extname(objectName) || ".pdf"}`,
        });
      } catch (err) {
        console.error(`[Download] Error parsing CV path: ${err.message}`);
      }
    }

    if (candidate.qualifiedFormPath) {
      console.log(`[Download Debug] qualifiedFormPath from DB: ${candidate.qualifiedFormPath}`);
      try {
        const url = new URL(candidate.qualifiedFormPath);
        const objectName = url.pathname.split("/").slice(2).join("/");
        const bucketName = FORM2_BUCKET; // Explicitly set
        console.log(`[Download Debug] Constructed Bucket: ${bucketName}, Object Name: ${objectName}`);
        documentsToDownload.push({
          bucket: FORM2_BUCKET,
          objectName: objectName,
          fileName: `${candidateName}_Questionnaire_Recrutement.pdf`,
        });
      } catch (e) {
        console.error(`[Download Debug] Error parsing qualifiedFormPath URL: ${e.message}`);
      }
    }

    if (candidate.evalPdfPath) {
      const url = new URL(candidate.evalPdfPath);
      const objectName = url.pathname.split("/").slice(2).join("/");
      documentsToDownload.push({
        bucket: FORM3_BUCKET,
        objectName: objectName,
        fileName: `${candidateName}_Evaluation_Corrigee.pdf`,
      });
    }

    if (candidate.rapportStagePath) {
      const url = new URL(candidate.rapportStagePath);
      const objectName = url.pathname.split("/").slice(2).join("/");
      const ext = path.extname(objectName) || ".pdf";
      documentsToDownload.push({
        bucket: RAPPORT_BUCKET,
        objectName: objectName,
        fileName: `${candidateName}_Rapport_Stage${ext}`,
      });
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