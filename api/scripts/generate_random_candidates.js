const axios = require("axios");

const API_URL = "http://localhost:3000/api/cv/generate-form-link";
const NUM_CANDIDATES = 15;

async function generateCandidates() {
  console.log(`Generating ${NUM_CANDIDATES} random candidates...`);
  for (let i = 0; i < NUM_CANDIDATES; i++) {
    try {
      const response = await axios.post(API_URL);
      console.log(
        `Candidate ${
          i + 1
        } generated: ID - ${response.data.candidateId}, Token - ${
          response.data.formToken
        }`,
      );
    } catch (error) {
      console.error(
        `Error generating candidate ${i + 1}: ${error.message}`,
        error.response ? error.response.data : "",
      );
    }
  }
  console.log("Finished generating candidates.");
}

generateCandidates();
