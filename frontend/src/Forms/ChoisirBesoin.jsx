import React, { useState } from "react";
import "../styles/CVExtractor.css";
import { useNavigate } from "react-router-dom";

import { API_URL, FRONTEND_URL } from "../config";

const SERVICES = [
  "Marketing",
  "RespTechnique",
  "ChargéEtudes",
  "FrontOffice",
  "Anglais",
  "Logistique",
  "DevLaravel",
];

const ChoisirBesoin = () => {
  const navigate = useNavigate();
  const [service, setService] = useState("");
  const [questionnaire, setQuestionnaire] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [generatedLink, setGeneratedLink] = useState(null);
  const [copySuccess, setCopySuccess] = useState("");

  const handleCopy = () => {
    if (generatedLink) {
      navigator.clipboard
        .writeText(generatedLink)
        .then(() => {
          setCopySuccess("Lien copié !");
          setTimeout(() => setCopySuccess(""), 2000);
        })
        .catch((err) => {
          console.error("Failed to copy link:", err);
          setCopySuccess("Échec de la copie.");
        });
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setGeneratedLink(null); // Clear previous link

    try {
      const response = await fetch(`${API_URL}/forms/generate-form-link`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ service, questionnaire }),
      });

      const data = await response.json();

      if (data.success && data.formLink) {
        setGeneratedLink(`${FRONTEND_URL}${data.formLink}`);
      } else {
        setError(data.error || "Échec de la génération du lien de formulaire.");
      }
    } catch (err) {
      console.error("Error generating form link:", err);
      setError("Erreur de connexion au serveur pour générer le lien.");
    } finally {
      setLoading(false);
    }
  };

  const handleGoToForm = () => {
    if (generatedLink) {
      // Extract the relative path from the full generatedLink
      const relativePath = new URL(generatedLink).pathname;
      navigate(relativePath);
    }
  };

  return (
    <div className="cv-extractor-container">
      <div className="cv-extractor-card single-panel">
        <div className="form-panel">
          <div className="form-header">
            <h2>Choisir un Besoin et un Questionnaire</h2>
          </div>
          {!generatedLink ? (
            <form onSubmit={handleSubmit} className="cv-form">
              <h1>Besoin</h1>

              <div className="form-group">
                <label htmlFor="service">Service:</label>
                <select
                  id="service"
                  className="form-input status-select"
                  value={service}
                  onChange={(e) => setService(e.target.value)}
                  required
                >
                  <option value="">Sélectionner un service...</option>
                  {SERVICES.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label htmlFor="questionnaire">Questionnaire:</label>
                <select
                  id="questionnaire"
                  className="form-input status-select"
                  value={questionnaire}
                  onChange={(e) => setQuestionnaire(e.target.value)}
                  required
                >
                  <option value="">Sélectionner un questionnaire...</option>
                  {SERVICES.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </div>

              {error && <div className="error-message">{error}</div>}
              <div className="form-actions">
                <button
                  type="submit"
                  className="submit-button"
                  disabled={loading}
                >
                  {loading ? "Chargement..." : "Générer le lien"}
                </button>
              </div>
            </form>
          ) : (
            <div className="generated-link-container">
              <h3>Lien de formulaire généré :</h3>
              <p className="generated-link-display">
                <a
                  href={generatedLink}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {generatedLink}
                </a>
              </p>
              <div className="form-actions">
                <button onClick={handleCopy} className="copy-button">
                  {copySuccess || "Copier le lien"}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ChoisirBesoin;
