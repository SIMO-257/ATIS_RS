const { MongoClient } = require("mongodb");

const uri = "mongodb://localhost:27017";
const client = new MongoClient(uri);

const firstNames = [
  "Ahmed",
  "Sara",
  "Youssef",
  "Lina",
  "Mehdi",
  "Ines",
  "Omar",
  "Hiba",
  "Anas",
  "Fatima",
  "Rayan",
  "Zineb",
  "Hamza",
  "Amal",
  "Amine",
];
const lastNames = [
  "Alami",
  "Berrada",
  "Chraibi",
  "Drissi",
  "El Amrani",
  "Fassi",
  "Ghazali",
  "Haddad",
  "Idrissi",
  "Jebli",
  "Kabbaj",
  "Lahlou",
  "Mansouri",
  "Naji",
  "Ouazzani",
];
const positions = [
  "Développeur Fullstack",
  "Ingénieur Cloud",
  "Data Scientist",
  "Product Manager",
  "Designer UI/UX",
  "Analyste Cyber",
  "DevOps Engineer",
];
const companies = [
  "Tech Solutions",
  "Innova Maroc",
  "Global Systems",
  "Future Soft",
  "Digital Minds",
];
const diplomas = [
  "Master en Informatique",
  "Diplôme d'Ingénieur",
  "Licence Pro",
  "Doctorat",
  "BTS",
];
const cities = ["Casablanca", "Rabat", "Marrakech", "Tanger", "Agadir"];

async function seed() {
  try {
    await client.connect();
    // Try to detect the database name from context, or use common ones
    const dbName = "cv_analysi"; // Based on api/db.js
    const db = client.db(dbName);
    const collection = db.collection("candidats");

    console.log(
      `Connected to MongoDB. Seeding 15 candidates into ${dbName}.candidats...`,
    );

    const candidates = [];
    for (let i = 0; i < 15; i++) {
      const firstName =
        firstNames[Math.floor(Math.random() * firstNames.length)];
      const lastName = lastNames[Math.floor(Math.random() * lastNames.length)];

      candidates.push({
        Nom: lastName,
        Prénom: firstName,
        "Date de naissance": `199${Math.floor(Math.random() * 9)}-0${Math.floor(Math.random() * 9) + 1}-1${Math.floor(Math.random() * 9)}`,
        "Adress Actuel": `${Math.floor(Math.random() * 100)} Rue ${cities[Math.floor(Math.random() * cities.length)]}`,
        "Post Actuel": positions[Math.floor(Math.random() * positions.length)],
        Société: companies[Math.floor(Math.random() * companies.length)],
        "Date d'embauche": `202${Math.floor(Math.random() * 4)}-01-01`,
        "Salaire net Actuel": `${Math.floor(Math.random() * 20000) + 5000} DH`,
        "Votre dernier diplome":
          diplomas[Math.floor(Math.random() * diplomas.length)],
        "Votre niveau de l'anglais technique": {
          Lu: ["Faible", "Moyen", "Bien"][Math.floor(Math.random() * 3)],
          Ecrit: ["Faible", "Moyen", "Bien"][Math.floor(Math.random() * 3)],
          Parlé: ["Faible", "Moyen", "Bien"][Math.floor(Math.random() * 3)],
        },
        status: "en Attente",
        hiringStatus: "Attente validation Candidat",
        formStatus: "pending", // Not activated
        originalCvMinioPath: "http://localhost:9000/cvs/dummy-cv.pdf",
        createdAt: new Date(),
      });
    }

    const result = await collection.insertMany(candidates);
    console.log(`Successfully inserted ${result.insertedCount} candidates.`);
  } catch (error) {
    console.error("Error seeding candidates:", error);
  } finally {
    await client.close();
  }
}

seed();
