// frontend/src/displayAdmins.js

import { API_URL } from "./config";

async function displayAdmins() {
  console.log("Fetching admin users...");
  try {
    const response = await fetch(`${API_URL}/api/auth/admins`);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    const data = await response.json();
    if (data.success) {
      console.log("Admin Users:", data.admins);
    } else {
      console.error("Failed to fetch admin users:", data.error);
    }
  } catch (error) {
    console.error("Error fetching admin users:", error);
  }
}

// To run this function, you can call displayAdmins() in your browser's console
// or include this script in your HTML and call it.
// Example: displayAdmins();
