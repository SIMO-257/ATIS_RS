import React, { useState } from "react";
import "../styles/CVExtractor.css";

// Use environment variable for API URL (works in Docker)
import { API_URL } from "../config";

const CVExtractor = () => {
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [cvData, setCvData] = useState({
    Nom: "",
    Prenom: "",
    Email: "",
    cvUrl: "",
  });
  const [extractionDone, setExtractionDone] = useState(false);
  const [error, setError] = useState(null);
  const [ollamaStatus, setOllamaStatus] = useState(true);
  const [jobId, setJobId] = useState(null);

  // Check Ollama status on mount
  React.useEffect(() => {
    checkOllamaHealth();
  }, []);

  const checkOllamaHealth = async () => {
    try {
      const response = await fetch(`${API_URL}/extract/health`);
      const data = await response.json();
      setOllamaStatus(data.ollamaRunning);
    } catch (err) {
      console.error("Health check failed:", err);
      setOllamaStatus(false);
    }
  };

  const handleFileChange = (e) => {
    const selectedFile = e.target.files[0];
    if (selectedFile && selectedFile.type === "application/pdf") {
      setFile(selectedFile);
      setError(null);
    } else {
      setError("Veuillez sélectionner un fichier PDF");
      setFile(null);
    }
  };

  const handleExtract = async () => {
    if (!file) {
      setError("Veuillez sélectionner un fichier PDF");
      return;
    }

    setLoading(true);
    setError(null);
    setJobId(null);

    const formData = new FormData();
    formData.append("cv", file);

    try {
      const response = await fetch(`${API_URL}/extract`, {
        method: "POST",
        body: formData,
      });

      const result = await response.json();

      if (result.success && result.jobId) {
        setJobId(result.jobId);
      } else {
        setError(result.error || "Erreur lors de l'extraction");
        setLoading(false);
      }
    } catch (err) {
      setError(
        "Erreur de connexion au serveur. Assurez-vous que l'API est en cours d'exécution.",
      );
      console.error("Extraction error:", err);
      setLoading(false);
    }
  };

  React.useEffect(() => {
    if (!jobId) return;

    let cancelled = false;
    const intervalId = setInterval(async () => {
      try {
        const response = await fetch(`${API_URL}/extract/status/${jobId}`);
        const result = await response.json();
        if (!result.success) {
          setError(result.error || "Erreur lors de l'extraction");
          setLoading(false);
          setJobId(null);
          clearInterval(intervalId);
          return;
        }

        if (result.status === "done") {
          if (!cancelled) {
            setCvData({
              Nom: result.data?.Nom || "",
              Prenom: result.data?.Prenom || "",
              Email: result.data?.Email || "",
              cvUrl: result.cvUrl || result.data?.cvUrl || "",
            });
            setExtractionDone(true);
            setError(null);
            setLoading(false);
            setJobId(null);
            clearInterval(intervalId);
          }
        } else if (result.status === "error") {
          if (!cancelled) {
            setError(result.error || "Erreur lors de l'extraction");
            setLoading(false);
            setJobId(null);
            clearInterval(intervalId);
          }
        }
      } catch (err) {
        if (!cancelled) {
          setError("Erreur de connexion au serveur.");
          setLoading(false);
          setJobId(null);
          clearInterval(intervalId);
        }
      }
    }, 3000);

    return () => {
      cancelled = true;
      clearInterval(intervalId);
    };
  }, [jobId]);


  const handleReset = () => {
    setFile(null);
    setExtractionDone(false);
    setError(null);
    setCvData({ Nom: "", Prenom: "", Email: "", cvUrl: "" });
  };


  /* Form Actions - Add View Candidates button */
  return (
    <div className="cv-extractor-container">
      {/* Add conditional class based on extraction state */}
      <div
        className={`cv-extractor-card ${!extractionDone ? "single-panel" : ""}`}
      >
        {/* Upload Panel - Always shown, but centered when alone */}
        <div className="upload-panel">
          <div className="header">
            <h1>📄 Extracteur de CV Intelligent</h1>
            <p>Extraction automatisée d'informations à partir de CV PDF</p>
            {!ollamaStatus && (
              <div className="warning-banner">
                ⚠️ Ollama n'est pas en cours d'exécution
              </div>
            )}
          </div>

          {error && <div className="error-message">❌ {error}</div>}

          {!extractionDone ? (
            <div className="upload-section">
              <div
                style={{
                  fontSize: "0.95rem",
                  color: "#e2e8f0",
                  fontWeight: 600,
                  marginBottom: "12px",
                }}
              >
                Le scan peut prendre 20 a 60 secondes selon la taille du CV.
              </div>
              <div className="file-upload-wrapper">
                <input
                  type="file"
                  id="cv-file"
                  accept=".pdf"
                  onChange={handleFileChange}
                  className="file-input"
                />
                <label htmlFor="cv-file" className="file-label">
                  📄 {file ? file.name : "Sélectionner un fichier PDF"}
                </label>
              </div>

              <button
                onClick={handleExtract}
                disabled={!file || loading}
                className="extract-button"
              >
                {loading ? (
                  <>
                    <span className="spinner"></span>
                    Extraction en cours...
                  </>
                ) : (
                  <>🔍 Extraire les données</>
                )}
              </button>
            </div>
          ) : null}
        </div>

        {/* Form Panel - Only shown when extraction is done */}
        {extractionDone && (
          <div className="form-panel">
            <div className="form-header">
              <h2>Extraction terminee</h2>
              <p className="form-subtitle">Le candidat a ete ajoute a l'archive.</p>
            </div>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(3, 1fr)",
                gap: "16px",
                marginTop: "10px",
              }}
            >
              <div
                style={{
                  background: "#f8fafc",
                  border: "1px solid #e2e8f0",
                  borderRadius: "12px",
                  padding: "16px",
                }}
              >
                <div style={{ fontSize: "0.85rem", color: "#64748b" }}>Nom</div>
                <div style={{ fontSize: "1.2rem", fontWeight: 700, color: "#1f2937" }}>
                  {cvData.Nom || "-"}
                </div>
              </div>
              <div
                style={{
                  background: "#f8fafc",
                  border: "1px solid #e2e8f0",
                  borderRadius: "12px",
                  padding: "16px",
                }}
              >
                <div style={{ fontSize: "0.85rem", color: "#64748b" }}>Prenom</div>
                <div style={{ fontSize: "1.2rem", fontWeight: 700, color: "#1f2937" }}>
                  {cvData.Prenom || "-"}
                </div>
              </div>
              <div
                style={{
                  background: "#f8fafc",
                  border: "1px solid #e2e8f0",
                  borderRadius: "12px",
                  padding: "16px",
                }}
              >
                <div style={{ fontSize: "0.85rem", color: "#64748b" }}>Email</div>
                <div style={{ fontSize: "1.2rem", fontWeight: 700, color: "#1f2937" }}>
                  {cvData.Email || "-"}
                </div>
              </div>
              <div
                style={{
                  gridColumn: "1 / -1",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  background: "#ffffff",
                  border: "1px solid #e2e8f0",
                  borderRadius: "12px",
                  padding: "12px 16px",
                }}
              >
                <div style={{ fontWeight: 600, color: "#1f2937" }}>CV</div>
                {cvData.cvUrl ? (
                  <a
                    href={cvData.cvUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="download-link"
                  >
                    Voir le CV
                  </a>
                ) : (
                  <span className="no-file">-</span>
                )}
              </div>
            </div>
            <div className="form-actions" style={{ marginTop: "16px" }}>
              <button type="button" onClick={handleReset} className="reset-button">
                Nouveau scan
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default CVExtractor;
