import React, { useRef, useState } from "react";
import "../styles/CVExtractor.css";
import { API_URL } from "../config";

const ACTIVE_EXTRACTION_STORAGE_KEY = "cvExtractorActiveTracking";

const CVExtractor = () => {
  const [file, setFile] = useState(null);
  const [folderFiles, setFolderFiles] = useState([]);
  const [loading, setLoading] = useState(false);
  const [cvData, setCvData] = useState({
    Nom: "",
    Prenom: "",
    Email: "",
    cvUrl: "",
  });
  const [batchData, setBatchData] = useState(null);
  const [extractionDone, setExtractionDone] = useState(false);
  const [error, setError] = useState(null);
  const [ollamaStatus, setOllamaStatus] = useState(true);
  const [supportsDirectoryUpload, setSupportsDirectoryUpload] = useState(true);
  const [jobId, setJobId] = useState(null);
  const [batchId, setBatchId] = useState(null);
  const folderInputRef = useRef(null);

  const ensureNotificationPermission = async () => {
    if (typeof window === "undefined" || !("Notification" in window)) {
      return false;
    }

    if (Notification.permission === "granted") {
      return true;
    }

    if (Notification.permission === "default") {
      try {
        const permission = await Notification.requestPermission();
        return permission === "granted";
      } catch (err) {
        console.error("Notification permission request failed:", err);
        return false;
      }
    }

    return false;
  };

  const sendDesktopNotification = (title, body) => {
    if (typeof window === "undefined" || !("Notification" in window)) {
      return;
    }

    if (Notification.permission !== "granted") {
      return;
    }

    try {
      new Notification(title, { body });
    } catch (err) {
      console.error("Failed to send desktop notification:", err);
    }
  };

  const saveActiveTracking = (payload) => {
    try {
      if (!payload) {
        localStorage.removeItem(ACTIVE_EXTRACTION_STORAGE_KEY);
        return;
      }
      localStorage.setItem(ACTIVE_EXTRACTION_STORAGE_KEY, JSON.stringify(payload));
    } catch (err) {
      console.error("Failed to persist extraction tracking:", err);
    }
  };

  const loadActiveTracking = () => {
    try {
      const raw = localStorage.getItem(ACTIVE_EXTRACTION_STORAGE_KEY);
      if (!raw) return null;
      return JSON.parse(raw);
    } catch (err) {
      console.error("Failed to load extraction tracking:", err);
      return null;
    }
  };

  React.useEffect(() => {
    checkOllamaHealth();
  }, []);

  React.useEffect(() => {
    const activeTracking = loadActiveTracking();
    if (!activeTracking) return;

    if (activeTracking.type === "single" && activeTracking.jobId) {
      setJobId(activeTracking.jobId);
      setBatchId(null);
      setLoading(true);
      return;
    }

    if (activeTracking.type === "batch" && activeTracking.batchId) {
      setBatchId(activeTracking.batchId);
      setJobId(null);
      setLoading(true);
      return;
    }

    saveActiveTracking(null);
  }, []);

  React.useEffect(() => {
    // Folder selection is not standard across browsers; detect support and provide fallback UX.
    const probeInput = document.createElement("input");
    probeInput.type = "file";
    const canSelectDirectory =
      "webkitdirectory" in probeInput || "directory" in probeInput || "mozdirectory" in probeInput;
    setSupportsDirectoryUpload(canSelectDirectory);

    if (canSelectDirectory && folderInputRef.current) {
      folderInputRef.current.setAttribute("webkitdirectory", "");
      folderInputRef.current.setAttribute("directory", "");
      folderInputRef.current.setAttribute("mozdirectory", "");
    }
  }, []);

  const checkOllamaHealth = async () => {
    try {
      const response = await fetch(`${API_URL}/extract/health`);
      const data = await response.json();
      setOllamaStatus(Boolean(data.ollamaRunning) && Boolean(data.queueRunning));
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
      return;
    }
    setError("Veuillez selectionner un fichier PDF");
    setFile(null);
  };

  const handleFolderChange = (e) => {
    const allFiles = Array.from(e.target.files || []);
    const pdfFiles = allFiles.filter(
      (f) => f.type === "application/pdf" || f.name.toLowerCase().endsWith(".pdf"),
    );

    if (!pdfFiles.length) {
      setError("Aucun PDF detecte dans la selection");
      setFolderFiles([]);
      return;
    }

    setFolderFiles(pdfFiles);
    setError(null);
  };

  const handleExtract = async () => {
    if (!file) {
      setError("Veuillez selectionner un fichier PDF");
      return;
    }

    setLoading(true);
    setError(null);
    setJobId(null);
    setBatchId(null);
    setBatchData(null);
    ensureNotificationPermission();

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
        saveActiveTracking({ type: "single", jobId: result.jobId });
        return;
      }

      setError(result.error || "Erreur lors de l'extraction");
      setLoading(false);
      saveActiveTracking(null);
    } catch (err) {
      setError("Erreur de connexion au serveur.");
      console.error("Extraction error:", err);
      setLoading(false);
      saveActiveTracking(null);
    }
  };

  const handleBatchExtract = async () => {
    if (!folderFiles.length) {
      setError(
        supportsDirectoryUpload
          ? "Veuillez selectionner un dossier contenant des PDF"
          : "Veuillez selectionner plusieurs PDF",
      );
      return;
    }

    setLoading(true);
    setError(null);
    setJobId(null);
    setBatchId(null);
    setExtractionDone(false);
    setCvData({ Nom: "", Prenom: "", Email: "", cvUrl: "" });
    ensureNotificationPermission();

    const formData = new FormData();
    folderFiles.forEach((pdfFile) => formData.append("cvs", pdfFile));

    try {
      const response = await fetch(`${API_URL}/extract/batch`, {
        method: "POST",
        body: formData,
      });
      const result = await response.json();

      if (result.success && result.batchId) {
        setBatchId(result.batchId);
        saveActiveTracking({ type: "batch", batchId: result.batchId });
        return;
      }

      setError(result.error || "Erreur lors de l'extraction du dossier");
      setLoading(false);
      saveActiveTracking(null);
    } catch (err) {
      setError("Erreur de connexion au serveur.");
      console.error("Batch extraction error:", err);
      setLoading(false);
      saveActiveTracking(null);
    }
  };

  React.useEffect(() => {
    if (!jobId) return undefined;

    let cancelled = false;
    const intervalId = setInterval(async () => {
      try {
        const response = await fetch(`${API_URL}/extract/status/${jobId}`);
        const result = await response.json();
        if (!result.success) {
          setError(result.error || "Erreur lors de l'extraction");
          setLoading(false);
          setJobId(null);
          saveActiveTracking(null);
          clearInterval(intervalId);
          return;
        }

        if (result.status === "done" && !cancelled) {
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
          sendDesktopNotification(
            "Extraction terminee",
            `CV traite: ${result.data?.Prenom || "-"} ${result.data?.Nom || "-"}`,
          );
          saveActiveTracking(null);
          clearInterval(intervalId);
        } else if (result.status === "error" && !cancelled) {
          setError(result.error || "Erreur lors de l'extraction");
          setLoading(false);
          setJobId(null);
          saveActiveTracking(null);
          clearInterval(intervalId);
        }
      } catch (err) {
        if (!cancelled) {
          setError("Erreur de connexion au serveur.");
          setLoading(false);
          setJobId(null);
          saveActiveTracking(null);
          clearInterval(intervalId);
        }
      }
    }, 3000);

    return () => {
      cancelled = true;
      clearInterval(intervalId);
    };
  }, [jobId]);

  React.useEffect(() => {
    if (!batchId) return undefined;

    let cancelled = false;
    const intervalId = setInterval(async () => {
      try {
        const response = await fetch(`${API_URL}/extract/batch-status/${batchId}`);
        const result = await response.json();
        if (!result.success) {
          setError(result.error || "Erreur lors du suivi du dossier");
          setLoading(false);
          setBatchId(null);
          saveActiveTracking(null);
          clearInterval(intervalId);
          return;
        }

        if (!cancelled) {
          setBatchData(result);
        }

        if (["done", "partial", "error"].includes(result.status) && !cancelled) {
          setLoading(false);
          setBatchId(null);
          if (result.status === "done") {
            sendDesktopNotification(
              "Extraction dossier terminee",
              `${result.completed || 0} CV traites avec succes.`,
            );
          } else if (result.status === "partial") {
            sendDesktopNotification(
              "Extraction dossier terminee (partielle)",
              `Succes: ${result.completed || 0}, erreurs: ${result.failed || 0}.`,
            );
          } else if (result.status === "error") {
            sendDesktopNotification(
              "Extraction dossier echouee",
              `Aucun CV extrait. Erreurs: ${result.failed || 0}.`,
            );
          }
          saveActiveTracking(null);
          clearInterval(intervalId);
        }
      } catch (err) {
        if (!cancelled) {
          setError("Erreur de connexion au serveur.");
          setLoading(false);
          setBatchId(null);
          saveActiveTracking(null);
          clearInterval(intervalId);
        }
      }
    }, 3000);

    return () => {
      cancelled = true;
      clearInterval(intervalId);
    };
  }, [batchId]);

  const handleReset = () => {
    setFile(null);
    setFolderFiles([]);
    setExtractionDone(false);
    setBatchData(null);
    setError(null);
    setCvData({ Nom: "", Prenom: "", Email: "", cvUrl: "" });
    saveActiveTracking(null);
  };

  return (
    <div className="cv-extractor-container cv-extractor-page">
      <div className={`cv-extractor-card ${!extractionDone ? "single-panel" : ""}`}>
        {!extractionDone && (
          <div className="upload-panel">
            <div className="header">
              <h1>Extracteur de CV Intelligent</h1>
              <p className="extractor-subtitle">
                Extraction automatisee d'informations a partir de CV PDF
              </p>
              {!ollamaStatus && (
                <div className="warning-banner">
                  Service de traitement indisponible (Ollama ou Redis)
                </div>
              )}
            </div>

            {error && <div className="error-message">{error}</div>}

            <div className="upload-section">
              <div
                style={{
                  fontSize: "0.95rem",
                  color: "#e2e8f0",
                  fontWeight: 600,
                  marginBottom: "12px",
                }}
              >
                Le scan peut prendre 20 a 60 secondes par CV.
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
                  {file ? file.name : "Selectionner un fichier PDF"}
                </label>
              </div>

              <button
                onClick={handleExtract}
                disabled={!file || loading}
                className={`extract-button ${file ? "ready-to-run" : ""}`.trim()}
              >
                {loading && jobId ? "Extraction en cours..." : "Extraire un CV"}
              </button>

              <div className="file-upload-wrapper" style={{ marginTop: "16px" }}>
                <input
                  type="file"
                  id="cv-folder"
                  ref={folderInputRef}
                  onChange={handleFolderChange}
                  className="file-input"
                  multiple
                  accept=".pdf,application/pdf"
                />
                <label htmlFor="cv-folder" className="file-label">
                  {folderFiles.length
                    ? `${folderFiles.length} PDF detectes`
                    : supportsDirectoryUpload
                      ? "Selectionner un dossier de CV"
                      : "Selectionner plusieurs PDF"}
                </label>
                {!supportsDirectoryUpload && (
                  <div style={{ fontSize: "0.85rem", color: "#e2e8f0" }}>
                    Ce navigateur ne supporte pas la selection de dossier. Selectionnez plusieurs fichiers PDF.
                  </div>
                )}
              </div>

              <button
                onClick={handleBatchExtract}
                disabled={!folderFiles.length || loading}
                className={`extract-button ${folderFiles.length ? "ready-to-run" : ""}`.trim()}
                style={{ marginTop: "12px" }}
              >
                {loading && batchId ? "Traitement du dossier..." : "Extraire un dossier"}
              </button>
            </div>

            {batchData && (
              <div
                style={{
                  marginTop: "16px",
                  padding: "14px",
                  borderRadius: "12px",
                  background: "rgba(255,255,255,0.08)",
                  color: "#fff",
                }}
              >
                <div style={{ fontWeight: 700, marginBottom: "8px" }}>
                  Batch: {batchData.status}
                </div>
                <div>Total: {batchData.total}</div>
                <div>En attente: {batchData.queued}</div>
                <div>En cours: {batchData.processing}</div>
                <div>Succes: {batchData.completed}</div>
                <div>Erreurs: {batchData.failed}</div>
              </div>
            )}
          </div>
        )}

        {extractionDone && (
          <div className="form-panel">
            <div className="form-header">
              <h2>Extraction terminee</h2>
              <p className="form-subtitle">Le candidat a ete ajoute a l'archive.</p>
            </div>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
                gap: "16px",
                marginTop: "10px",
                overflow: "hidden",
              }}
            >
              <div
                style={{
                  background: "#f8fafc",
                  border: "1px solid #e2e8f0",
                  borderRadius: "12px",
                  padding: "16px",
                  minWidth: 0,
                }}
              >
                <div style={{ fontSize: "0.85rem", color: "#64748b" }}>Nom</div>
                <div style={{ fontSize: "1.2rem", fontWeight: 700, color: "#1f2937", wordBreak: "break-all" }}>
                  {cvData.Nom || "-"}
                </div>
              </div>
              <div
                style={{
                  background: "#f8fafc",
                  border: "1px solid #e2e8f0",
                  borderRadius: "12px",
                  padding: "16px",
                  minWidth: 0,
                }}
              >
                <div style={{ fontSize: "0.85rem", color: "#64748b" }}>Prenom</div>
                <div style={{ fontSize: "1.2rem", fontWeight: 700, color: "#1f2937", wordBreak: "break-all" }}>
                  {cvData.Prenom || "-"}
                </div>
              </div>
              <div
                style={{
                  background: "#f8fafc",
                  border: "1px solid #e2e8f0",
                  borderRadius: "12px",
                  padding: "16px",
                  minWidth: 0,
                }}
              >
                <div style={{ fontSize: "0.85rem", color: "#64748b" }}>Email</div>
                <div
                  style={{
                    fontSize: "1.1rem",
                    fontWeight: 700,
                    color: "#1f2937",
                    wordBreak: "break-all",
                    overflowWrap: "break-word",
                  }}
                >
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
