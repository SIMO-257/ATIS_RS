const express = require("express");
const router = express.Router();
const { getDB } = require("../db");
const { ObjectId } = require("mongodb");
const Minio = require("minio");

const minioClient = new Minio.Client({
  endPoint: process.env.MINIO_ENDPOINT || "minio",
  port: parseInt(process.env.MINIO_PORT || "9000", 10),
  useSSL: process.env.MINIO_USE_SSL === "true",
  accessKey: process.env.MINIO_ACCESS_KEY || "minioadmin",
  secretKey: process.env.MINIO_SECRET_KEY || "minioadmin",
});

const toAbsoluteCvUrl = (rawUrl = "") => {
  const value = String(rawUrl || "").trim();
  if (!value) return "";
  if (/^https?:\/\//i.test(value)) return value;

  const minioBase = String(process.env.MINIO_PUBLIC_URL || "").replace(/\/+$/, "");
  const normalizedPath = value.startsWith("/") ? value : `/${value}`;

  if (minioBase) {
    return `${minioBase}${normalizedPath}`;
  }

  return normalizedPath;
};

// GET /api/archive - List archived candidates
router.get("/", async (req, res) => {
  try {
    const db = getDB();
    const items = await db
      .collection("archive")
      .find({})
      .sort({ createdAt: -1 })
      .toArray();
    const normalizedItems = items.map((item) => ({
      ...item,
      cvUrl: toAbsoluteCvUrl(item.cvUrl),
    }));
    res.json({ success: true, data: normalizedItems });
  } catch (error) {
    console.error("Archive list error:", error);
    res.status(500).json({ success: false, error: "Failed to fetch archive" });
  }
});

// GET /api/archive/cv-view?cvUrl=... - Stream archived CV from MinIO
router.get("/cv-view", async (req, res) => {
  try {
    const raw = String(req.query.cvUrl || "").trim();
    if (!raw) {
      return res.status(400).json({ success: false, error: "cvUrl is required" });
    }

    let pathValue = raw;
    if (/^https?:\/\//i.test(raw)) {
      pathValue = new URL(raw).pathname;
    }

    const normalized = pathValue.replace(/^\/+/, "");
    const slashIndex = normalized.indexOf("/");
    if (slashIndex <= 0 || slashIndex >= normalized.length - 1) {
      return res.status(400).json({ success: false, error: "Invalid cvUrl path" });
    }

    const bucket = normalized.slice(0, slashIndex);
    const objectNameRaw = normalized.slice(slashIndex + 1);
    const objectCandidates = Array.from(
      new Set([objectNameRaw, decodeURIComponent(objectNameRaw)]),
    );
    const fileName = decodeURIComponent(objectNameRaw.split("/").pop() || "cv.pdf");

    let stream = null;
    let lastError = null;
    for (const objectName of objectCandidates) {
      try {
        stream = await minioClient.getObject(bucket, objectName);
        break;
      } catch (err) {
        lastError = err;
      }
    }

    if (!stream) {
      if (lastError?.code === "NoSuchKey") {
        return res
          .status(404)
          .json({ success: false, error: "CV not found in storage" });
      }
      throw lastError || new Error("Failed to open CV object");
    }

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `inline; filename="${fileName}"`);
    stream.on("error", (err) => {
      if (!res.headersSent) {
        res.status(404).json({ success: false, error: "CV not found in storage" });
      } else {
        res.end();
      }
      console.error("Archive cv-view stream error:", err);
    });
    stream.pipe(res);
  } catch (error) {
    console.error("Archive cv-view error:", error);
    res.status(500).json({ success: false, error: "Failed to load CV" });
  }
});

// POST /api/archive - Create archive record
router.post("/", async (req, res) => {
  try {
    const db = getDB();
    const { Nom, Prenom, Email, service, cvUrl } = req.body || {};
    const doc = {
      Nom: Nom || "",
      Prenom: Prenom || "",
      Email: Email || "",
      service: service || "",
      cvUrl: toAbsoluteCvUrl(cvUrl),
      createdAt: new Date(),
    };
    const result = await db.collection("archive").insertOne(doc);
    res.json({ success: true, data: { _id: result.insertedId, ...doc } });
  } catch (error) {
    console.error("Archive create error:", error);
    res.status(500).json({ success: false, error: "Failed to create archive" });
  }
});

// PUT /api/archive/:id - Update archive record
router.put("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    if (!ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, error: "Invalid ID" });
    }
    const db = getDB();
    const updates = req.body || {};
    delete updates._id;
    if (Object.prototype.hasOwnProperty.call(updates, "cvUrl")) {
      updates.cvUrl = toAbsoluteCvUrl(updates.cvUrl);
    }
    await db
      .collection("archive")
      .updateOne({ _id: new ObjectId(id) }, { $set: updates });
    const updated = await db
      .collection("archive")
      .findOne({ _id: new ObjectId(id) });
    res.json({ success: true, data: updated });
  } catch (error) {
    console.error("Archive update error:", error);
    res.status(500).json({ success: false, error: "Failed to update archive" });
  }
});

// DELETE /api/archive/:id - Delete archive record
router.delete("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    if (!ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, error: "Invalid ID" });
    }
    const db = getDB();
    const result = await db
      .collection("archive")
      .deleteOne({ _id: new ObjectId(id) });
    if (result.deletedCount === 0) {
      return res
        .status(404)
        .json({ success: false, error: "Archive record not found" });
    }
    res.json({ success: true });
  } catch (error) {
    console.error("Archive delete error:", error);
    res.status(500).json({ success: false, error: "Failed to delete archive" });
  }
});

module.exports = router;
