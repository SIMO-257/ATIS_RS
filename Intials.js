const { connectDB, closeDB } = require("./api/db");
const { Client } = require("minio");

const BUCKETS = ["cv-bucket", "form2-bucket", "form3-bucket", "rapport-bucket"];
const COLLECTIONS = [
  "admins",
  "candidats",
  "archive",
  "departs",
  "refus\u00e9s",
  "emabauch\u00e9s",
];

const ADMIN = { username: "Hajar", password: "20262026" };

const minioClient = new Client({
  endPoint: process.env.MINIO_ENDPOINT || "minio",
  port: Number(process.env.MINIO_PORT) || 9000,
  useSSL: false,
  accessKey: process.env.MINIO_ACCESS_KEY || "minioadmin",
  secretKey: process.env.MINIO_SECRET_KEY || "minioadmin",
});

async function ensureBuckets() {
  const policy = (bucket) => ({
    Version: "2012-10-17",
    Statement: [
      {
        Effect: "Allow",
        Principal: { AWS: ["*"] },
        Action: ["s3:GetObject"],
        Resource: [`arn:aws:s3:::${bucket}/*`],
      },
    ],
  });

  for (const bucket of BUCKETS) {
    const exists = await minioClient.bucketExists(bucket);
    if (!exists) {
      await minioClient.makeBucket(bucket, "us-east-1");
      console.log(`Bucket "${bucket}" created`);
    } else {
      console.log(`Bucket "${bucket}" already exists`);
    }

    await minioClient.setBucketPolicy(bucket, JSON.stringify(policy(bucket)));
    console.log(`Policy ensured for "${bucket}"`);
  }
}

async function ensureCollections(db) {
  const existing = await db.listCollections({}, { nameOnly: true }).toArray();
  const existingNames = new Set(existing.map((c) => c.name));

  for (const name of COLLECTIONS) {
    if (!existingNames.has(name)) {
      await db.createCollection(name);
      console.log(`Collection "${name}" created`);
    } else {
      console.log(`Collection "${name}" already exists`);
    }
  }
}

async function ensureAdmin(db) {
  const admins = db.collection("admins");
  const existing = await admins.findOne({ username: ADMIN.username });
  if (!existing) {
    await admins.insertOne({ ...ADMIN, createdAt: new Date() });
    console.log("Admin user created");
  } else {
    console.log("Admin user already exists");
  }
}

async function main() {
  try {
    await ensureBuckets();

    const db = await connectDB();
    await ensureCollections(db);
    await ensureAdmin(db);

    console.log("Initialization complete");
  } catch (error) {
    console.error("Initialization failed:", error);
    process.exitCode = 1;
  } finally {
    await closeDB();
  }
}

main();
