const chai = require("chai");
const expect = chai.expect;
const request = require("supertest");
const { MongoClient } = require("mongodb");

// Assuming app.js exports the Express app instance
const { connectDB } = require("./api/db");
const app = require("./api/app"); // Adjust path if app.js is not directly exporting the app

let client;
let testDb;
const mongoUri = process.env.MONGODB_URI || "mongodb://localhost:27017";
const testDbName = "ATIS_SR_test"; // Using a separate test database

before(async () => {
  try {
    // Set MONGODB_URI and DB_NAME for the API to use the test database
    process.env.MONGODB_URI = mongoUri;
    process.env.DB_NAME = testDbName;
    await connectDB();

    client = new MongoClient(mongoUri);
    await client.connect();
    testDb = client.db(testDbName);
    console.log(`Connected to test MongoDB: ${testDbName}`);
  } catch (error) {
    console.error("Failed to connect to test MongoDB:", error);
    process.exit(1);
  }
});

after(async () => {
  try {
    await testDb.dropDatabase();
    console.log(`Dropped test database: ${testDbName}`);
    await client.close();
    console.log("Closed test MongoDB connection.");
  } catch (error) {
    console.error("Error during test teardown:", error);
  }
});

describe("API and Database Integration Tests", () => {
  beforeEach(async () => {
    // Clear collections before each test to ensure a clean state
    const collections = await testDb.listCollections().toArray();
    for (const collection of collections) {
      await testDb.collection(collection.name).deleteMany({});
    }
  });

  // Test for DB connection (basic check)
  it("should connect to the test database successfully", () => {
    expect(testDb).to.exist;
    expect(testDb.databaseName).to.equal(testDbName);
  });

  // --- Admin Routes Tests ---
  describe("Admin Routes", () => {
    const adminData = {
      username: "testadmin",
      password: "testpassword",
    };

    it("should create an admin (setup for login test)", async () => {
      await testDb.collection("admins").insertOne(adminData);
      const admin = await testDb
        .collection("admins")
        .findOne({ username: "testadmin" });
      expect(admin).to.exist;
      expect(admin.username).to.equal("testadmin");
    });

    it("should allow an admin to log in with correct credentials", async () => {
      // Admin must exist for login to work, relies on previous test or setup
      const res = await request(app).post("/api/admin/login").send(adminData);

      expect(res.statusCode).to.equal(200);
      expect(res.body.success).to.be.true;
      expect(res.body.message).to.equal("Connexion réussie");
      expect(res.body.user.username).to.equal("testadmin");
    });

    it("should not allow an admin to log in with incorrect password", async () => {
      const res = await request(app)
        .post("/api/admin/login")
        .send({ username: "testadmin", password: "wrongpassword" });

      expect(res.statusCode).to.equal(401);
      expect(res.body.success).to.be.false;
      expect(res.body.error).to.equal("Identifiants invalides");
    });

    it("should get a list of admins", async () => {
      await testDb.collection("admins").insertOne(adminData); // Ensure there's an admin
      const res = await request(app).get("/api/admin/list");

      expect(res.statusCode).to.equal(200);
      expect(res.body.success).to.be.true;
      expect(res.body.admins).to.be.an("array");
      expect(res.body.admins).to.have.lengthOf(1);
      expect(res.body.admins[0]).to.have.property("username", "testadmin");
      expect(res.body.admins[0]).to.not.have.property("password"); // Password should be excluded
    });
  });

  // --- Candidat Routes Tests (assuming /api/cv is the base) ---
  describe("Candidat Routes", () => {
    const candidateData = {
      Nom: "Doe",
      Prénom: "John",
      status: "en Attente",
      hiringStatus: "Attente validation client",
      formStatus: "submitted",
    };
    let insertedCandidateId;

    it("should save new CV data (create a candidate)", async () => {
      const res = await request(app)
        .post("/api/cv/save") // Assuming this is the endpoint to create
        .send(candidateData);

      expect(res.statusCode).to.equal(200);
      expect(res.body.success).to.be.true;
      expect(res.body.data).to.have.property("id");
      expect(res.body.data.Nom).to.equal("Doe");
      insertedCandidateId = res.body.data.id;

      const dbCandidate = await testDb
        .collection("candidats")
        .findOne({ _id: new MongoClient.ObjectId(insertedCandidateId) });
      expect(dbCandidate).to.exist;
      expect(dbCandidate.Nom).to.equal("Doe");
    });

    it("should get all candidates", async () => {
      await testDb.collection("candidats").insertOne(candidateData);
      const res = await request(app).get("/api/cv");

      expect(res.statusCode).to.equal(200);
      expect(res.body.success).to.be.true;
      expect(res.body.count).to.be.at.least(1);
      expect(res.body.data[0].Nom).to.equal("Doe");
    });

    it("should get a single candidate by ID", async () => {
      const result = await testDb
        .collection("candidats")
        .insertOne(candidateData);
      const id = result.insertedId.toString();

      const res = await request(app).get(`/api/cv/${id}`);

      expect(res.statusCode).to.equal(200);
      expect(res.body.success).to.be.true;
      expect(res.body.data.Nom).to.equal("Doe");
    });

    it("should update a candidate by ID", async () => {
      const result = await testDb
        .collection("candidats")
        .insertOne(candidateData);
      const id = result.insertedId.toString();
      const updatedComment = { recruiterComment: "Great candidate!" };

      const res = await request(app).put(`/api/cv/${id}`).send(updatedComment);

      expect(res.statusCode).to.equal(200);
      expect(res.body.success).to.be.true;
      expect(res.body.message).to.equal("Updated successfully");

      const dbCandidate = await testDb
        .collection("candidats")
        .findOne({ _id: new MongoClient.ObjectId(id) });
      expect(dbCandidate.recruiterComment).to.equal("Great candidate!");
    });

    it("should delete a candidate by ID", async () => {
      const result = await testDb
        .collection("candidats")
        .insertOne(candidateData);
      const id = result.insertedId.toString();

      const res = await request(app).delete(`/api/cv/${id}`);

      expect(res.statusCode).to.equal(200);
      expect(res.body.success).to.be.true;
      expect(res.body.message).to.equal("Candidate deleted successfully");

      const dbCandidate = await testDb
        .collection("candidats")
        .findOne({ _id: new MongoClient.ObjectId(id) });
      expect(dbCandidate).to.not.exist;
    });
  });

  // --- Refusés Routes Tests ---
  describe("Refusés Routes", () => {
    const refusedCandidateData = {
      Nom: "Smith",
      Prénom: "Jane",
      reason: "Not a good fit",
    };

    it("should add a new refused candidate", async () => {
      const res = await request(app)
        .post("/api/refused")
        .send(refusedCandidateData);

      expect(res.statusCode).to.equal(201);
      expect(res.body.success).to.be.true;
      expect(res.body.data.Nom).to.equal("Smith");

      const dbRefused = await testDb
        .collection("refusés")
        .findOne({ Nom: "Smith" });
      expect(dbRefused).to.exist;
    });

    it("should get all refused candidates", async () => {
      await testDb.collection("refusés").insertOne(refusedCandidateData);
      const res = await request(app).get("/api/refused");

      expect(res.statusCode).to.equal(200);
      expect(res.body.success).to.be.true;
      expect(res.body.count).to.be.at.least(1);
      expect(res.body.data[0].Nom).to.equal("Smith");
    });
  });

  // --- Embauchés Routes Tests ---
  describe("Embauchés Routes", () => {
    const embaucheCandidateData = {
      Nom: "Brown",
      Prénom: "Charlie",
      dateEmbauche: new Date().toISOString(),
    };

    it("should add a new embauché candidate", async () => {
      const res = await request(app)
        .post("/api/hiring/embauches")
        .send(embaucheCandidateData);

      expect(res.statusCode).to.equal(201);
      expect(res.body.success).to.be.true;
      expect(res.body.data.Nom).to.equal("Brown");

      const dbEmbauche = await testDb
        .collection("emabauchés")
        .findOne({ Nom: "Brown" });
      expect(dbEmbauche).to.exist;
    });

    it("should get all embauché candidates", async () => {
      await testDb.collection("emabauchés").insertOne(embaucheCandidateData);
      const res = await request(app).get("/api/hiring/embauches");

      expect(res.statusCode).to.equal(200);
      expect(res.body.success).to.be.true;
      expect(res.body.count).to.be.at.least(1);
      expect(res.body.data[0].Nom).to.equal("Brown");
    });
  });

  // --- Departs Routes Tests ---
  describe("Departs Routes", () => {
    const departData = {
      Nom: "White",
      Prénom: "Sarah",
      reason: "Resignation",
      dateDepart: new Date().toISOString(),
    };

    it("should add a new departed individual", async () => {
      const res = await request(app).post("/api/depart").send(departData);

      expect(res.statusCode).to.equal(201);
      expect(res.body.success).to.be.true;
      expect(res.body.data.Nom).to.equal("White");

      const dbDepart = await testDb
        .collection("departs")
        .findOne({ Nom: "White" });
      expect(dbDepart).to.exist;
    });

    it("should get all departed individuals", async () => {
      await testDb.collection("departs").insertOne(departData);
      const res = await request(app).get("/api/depart");

      expect(res.statusCode).to.equal(200);
      expect(res.body.success).to.be.true;
      expect(res.body.count).to.be.at.least(1);
      expect(res.body.data[0].Nom).to.equal("White");
    });
  });
});
