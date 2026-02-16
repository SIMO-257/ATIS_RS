const { connectDB, getDB, closeDB } = require("../db");

async function addAdmin() {
  try {
    await connectDB();
    const db = getDB();

    const username = "admin";
    const password = "adminpassword"; // Change this as needed

    console.log(`Checking if admin '${username}' already exists...`);
    const existingAdmin = await db.collection("admins").findOne({ username });

    if (existingAdmin) {
      console.log(`Admin user '${username}' already exists.`);
    } else {
      console.log(`Adding admin user '${username}'...`);
      await db.collection("admins").insertOne({ username, password });
      console.log(`Admin user '${username}' added successfully!`);
    }
  } catch (error) {
    console.error("Error adding admin:", error);
    process.exit(1);
  } finally {
    await closeDB();
    process.exit(0);
  }
}

addAdmin();
