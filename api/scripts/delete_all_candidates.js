const { connectDB, getDB, closeDB } = require("../db");

async function deleteAllCandidates() {
  try {
    await connectDB();
    const db = getDB();
    const result = await db.collection("candidats").deleteMany({});
    console.log(`${result.deletedCount} candidates deleted.`);
  } catch (error) {
    console.error("Error deleting all candidates:", error);
  } finally {
    await closeDB();
  }
}

deleteAllCandidates();
