import React, { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import "../styles/CVExtractor.css";
import "../styles/Etape_3_Form.css";

import { API_URL, FRONTEND_URL } from "../config";
import { loadServicesFromStorage } from "../constants/services";

function getCandidateFirstName(candidate) {
  return (
    candidate["Prénom"] ||
    candidate["PrÃ©nom"] ||
    candidate["PrÃƒÂ©nom"] ||
    candidate["PrÃƒÆ’Ã‚Â©nom"] ||
    candidate.Prenom ||
    ""
  );
}

function normalizeId(id) {
  if (typeof id === "string") return id;
  if (id && typeof id === "object") {
    if (id.$oid) return id.$oid;
    try {
      const s = id.toString();
      if (s && s !== "[object Object]") return s;
    } catch {}
  }
  return String(id);
}

const EVAL_TOTAL = 47;
const isValidEvalToken = (value) =>
  typeof value === "string" && /^[a-f0-9]{32}$/i.test(value.trim());

const CandidatsEmbauches = () => {
  const navigate = useNavigate();
  const [candidates, setCandidates] = useState([]);
  const [services] = useState(() => loadServicesFromStorage());
  const [nameFilter, setNameFilter] = useState("");
  const [serviceFilter, setServiceFilter] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchCandidates();
    const intervalId = setInterval(fetchCandidates, 3000);
    return () => clearInterval(intervalId);
  }, []);

  const fetchCandidates = async () => {
    try {
      const response = await fetch(`${API_URL}/candidates`);
      const data = await response.json();
      if (data.success) {
        const allEmbaucheCandidates = data.data.filter((c) =>
          String(c.hiringStatus || "").toLowerCase().includes("embauch"),
        );
        const candidatesForDepart = allEmbaucheCandidates.filter(
          (c) => c.dateDepart,
        );
        const candidatesForEmbauches = allEmbaucheCandidates.filter(
          (c) => !c.dateDepart,
        );
        setCandidates(candidatesForEmbauches);
        // Potentially store candidatesForDepart in a global state or local storage if ListeDÃƒÂ©part needs to fetch them
      } else {
        setError("Failed to load candidates");
      }
    } catch (err) {
      setError("Error fetching data");
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleUpdate = async (id, field, value) => {
    try {
      const _id = normalizeId(id);
      await fetch(`${API_URL}/candidates/${_id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ [field]: value }),
      });
      // Update local state
      setCandidates((prev) =>
        prev.map((c) =>
          normalizeId(c._id) === _id ? { ...c, [field]: value } : c,
        ),
      );
    } catch (err) {
      console.error(`Failed to update ${field}`, err);
    }
  };

  const handleActivateEval = async (id) => {
    const candidate = id && typeof id === "object" ? id : null;
    const rawId = candidate && candidate._id ? candidate._id : id;
    if (
      candidate?.evalStatus === "active" &&
      isValidEvalToken(candidate?.evalToken)
    ) {
      const link = `${FRONTEND_URL}/evaluation/${candidate.evalToken.trim()}`;
      try {
        await navigator.clipboard.writeText(link);
        alert(`Evaluation activee ! Lien copie dans le presse-papier:\n\n${link}`);
      } catch {
        alert(`Evaluation activee !\n\nLien : ${link}`);
      }
      return;
    }
    try {
      const _id = normalizeId(rawId);
      const res = await fetch(`${API_URL}/hiring/eval/activate/${_id}`, {
        method: "PUT",
      });
      const data = await res.json();
      if (data.success && data.data) {
        const updated = data.data;
        if (!isValidEvalToken(updated.evalToken)) {
          alert(
            "Evaluation activee mais token invalide. Merci de reessayer ou contacter l'administration.",
          );
          return;
        }
        setCandidates((prev) =>
          prev.map((c) => (normalizeId(c._id) === _id ? updated : c)),
        );
        const link = `${FRONTEND_URL}/evaluation/${updated.evalToken.trim()}`;

        // Copier le lien dans le presse-papier uniquement
        try {
          await navigator.clipboard.writeText(link);
          alert(`Evaluation activee ! Lien copie dans le presse-papier:\n\n${link}`);
          } catch {
          alert(`Evaluation activee !\n\nLien : ${link}`);
        }
      } else {
        alert(
          `Impossible d'activer l'evaluation pour ce candidat.\n\n${
            data.error || "Verifiez l'identifiant en base ou les logs serveur."
          }`,
        );
      }
    } catch (err) {
      alert("Erreur activation");
    }
  };

  const handleFileUpload = async (event, id) => {
    const file = event.target.files[0];
    if (!file) return;

    const formData = new FormData();
    formData.append("rapportStage", file); // 'rapportStage' should match the field name on the backend

    try {
      const _id = normalizeId(id);
      const response = await fetch(
        `${API_URL}/hiring/${_id}/upload-rapport-stage`,
        {
          method: "POST",
          body: formData,
        },
      );
      const data = await response.json();
      if (data.success) {
        alert("Rapport de stage uploaded successfully!");
        fetchCandidates(); // Refresh data to show the new link
      } else {
        alert(
          "Failed to upload rapport de stage: " +
            (data.error || "Unknown error"),
        );
      }
    } catch (err) {
      console.error("Error uploading rapport de stage", err);
      alert("Error uploading rapport de stage.");
    }
  };

  const handleDownloadSingleCandidateDocs = (candidateId) => {
    alert(
      "Preparation des documents pour le telechargement. Cela peut prendre un moment...",
    );
    const _id = normalizeId(candidateId);
    window.location.href = `${API_URL}/candidates/${_id}/download-docs`;
  };

  const buildCandidateFileViewUrl = (fileUrl, bucket) => {
    if (!fileUrl) return "";
    const params = new URLSearchParams({ fileUrl });
    if (bucket) params.set("bucket", bucket);
    return `${API_URL}/candidates/file-view?${params.toString()}`;
  };

  if (loading) return <div className="loading-spinner">Loading...</div>;

  const normalizedNameFilter = nameFilter.trim().toLowerCase();
  const normalizedServiceFilter = serviceFilter.trim().toLowerCase();
  const filteredCandidates = candidates.filter((candidate) => {
    const nom = String(candidate.Nom || "").toLowerCase();
    const prenom = String(getCandidateFirstName(candidate)).toLowerCase();
    const fullName = `${nom} ${prenom}`.trim();
    const reverseFullName = `${prenom} ${nom}`.trim();
    const service = String(candidate.service || "").toLowerCase();

    const matchesName =
      !normalizedNameFilter ||
      nom.includes(normalizedNameFilter) ||
      prenom.includes(normalizedNameFilter) ||
      fullName.includes(normalizedNameFilter) ||
      reverseFullName.includes(normalizedNameFilter);
    const matchesService =
      !normalizedServiceFilter || service === normalizedServiceFilter;

    return matchesName && matchesService;
  });

  return (
    <div className="cv-extractor-container">
      <div
        className="cv-extractor-card"
        style={{ maxWidth: "1400px", display: "block" }}
      >
        <div
          className="header"
          style={{
            marginBottom: "2rem",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            flexWrap: "wrap",
            gap: "10px",
          }}
        >
          <h1>Candidats Embauches</h1>
          <div
            style={{
              display: "flex",
              gap: "8px",
              alignItems: "center",
              background: "rgba(255,255,255,0.08)",
              padding: "8px",
              borderRadius: "8px",
            }}
          >
            <input
              type="text"
              className="comment-input"
              value={nameFilter}
              onChange={(e) => setNameFilter(e.target.value)}
              placeholder="Filtrer Nom/Prenom"
              style={{ minWidth: "200px", padding: "8px" }}
            />
            <select
              className="status-select"
              value={serviceFilter}
              onChange={(e) => setServiceFilter(e.target.value)}
              style={{ minWidth: "170px" }}
            >
              <option value="">Tous les services</option>
              {services.map((service) => (
                <option key={service} value={service}>
                  {service}
                </option>
              ))}
            </select>
          </div>
        </div>

        {error && <div className="error-message">{error}</div>}

        <div className="table-responsive">
          <table className="candidates-table">
            <thead>
              <tr>
                <th>Nom</th>
                <th>Prenom</th>
                <th>Date d'embauche</th>
                <th>Salaire</th>
                <th>Service</th>
                <th>Date de formation</th>
                <th>Date d'evaluation</th>
                <th>Evaluation</th>
                <th>Statut final</th>
                <th>Score</th>
                <th>Form_3</th>
                <th>Rapport Stage</th>
                <th>Date de depart</th>
                <th>Cause</th>
                <th>Documents</th>
              </tr>
            </thead>
            <tbody>
              {filteredCandidates.length === 0 ? (
                <tr>
                  <td
                    colSpan="15"
                    style={{ textAlign: "center", padding: "2rem" }}
                  >
                    Aucun candidat ne correspond au filtre
                  </td>
                </tr>
              ) : (
                filteredCandidates.map((candidate) => (
                  <tr key={candidate._id}>
                    <td style={{ fontWeight: 600 }}>{candidate.Nom || "-"}</td>
                    <td style={{ fontWeight: 600 }}>
                      {getCandidateFirstName(candidate) || "-"}
                    </td>
                    <td>
                      <input
                        type="date"
                        className="comment-input"
                        style={{
                          padding: "5px",
                          fontSize: "0.85rem",
                          minWidth: "130px",
                        }}
                        defaultValue={candidate["Date d'embauche"] || ""}
                        onBlur={(e) =>
                          handleUpdate(
                            candidate._id,
                            "Date d'embauche",
                            e.target.value,
                          )
                        }
                      />
                    </td>
                    <td>
                      <input
                        type="text"
                        className="comment-input"
                        style={{
                          padding: "5px",
                          fontSize: "0.85rem",
                          minWidth: "80px",
                        }}
                        defaultValue={candidate.salaire || ""}
                        onBlur={(e) =>
                          handleUpdate(candidate._id, "salaire", e.target.value)
                        }
                      />
                    </td>
                    <td>
                      <select
                        className={`status-select service-select ${candidate.service?.toLowerCase().replaceAll(" ", "-")}`}
                        style={{
                          padding: "5px",
                          fontSize: "0.85rem",
                          width: "100%",
                          minWidth: "150px",
                        }}
                        value={candidate.service || ""}
                        onChange={(e) =>
                          handleUpdate(candidate._id, "service", e.target.value)
                        }
                      >
                        <option value="">Selectionner...</option>
                        {services.map((s) => (
                          <option key={s} value={s}>
                            {s}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td>
                      <input
                        type="date"
                        className="comment-input"
                        style={{
                          padding: "5px",
                          fontSize: "0.85rem",
                          minWidth: "130px",
                        }}
                        defaultValue={candidate.dateFormation || ""}
                        onBlur={(e) =>
                          handleUpdate(
                            candidate._id,
                            "dateFormation",
                            e.target.value,
                          )
                        }
                      />
                    </td>
                    <td>
                      <input
                        type="date"
                        className="comment-input"
                        style={{
                          padding: "5px",
                          fontSize: "0.85rem",
                          minWidth: "130px",
                        }}
                        defaultValue={candidate.dateEvaluation || ""}
                        onBlur={(e) =>
                          handleUpdate(
                            candidate._id,
                            "dateEvaluation",
                            e.target.value,
                          )
                        }
                      />
                    </td>
                    {/* Evaluation column */}
                    <td>
                      {candidate.evalStatus === "submitted" ? (
                        <button
                          className="extract-button"
                          style={{
                            padding: "6px 10px",
                            fontSize: "0.8rem",
                            background: "#3182ce",
                          }}
                          onClick={() =>
                            navigate(
                              `/evaluation/admin/${normalizeId(candidate._id)}`,
                            )
                          }
                        >
                          Corriger
                        </button>
                      ) : (
                        <button
                          onClick={() => handleActivateEval(candidate)}
                          className="extract-button action-green"
                          style={{
                            background: "#38a169",
                            padding: "6px 10px",
                            fontSize: "0.8rem",
                          }}
                          disabled={candidate.evalStatus === "active"}
                        >
                          {candidate.evalStatus === "active"
                            ? "Lien actif"
                            : "Activer"}
                        </button>
                      )}
                    </td>
                    <td>
                      <select
                        className={`status-select final-status-select ${candidate.hiringFinalStatus?.toLowerCase().replaceAll(" ", "-")}`}
                        style={{
                          padding: "5px",
                          fontSize: "0.85rem",
                          width: "100%",
                          minWidth: "180px",
                        }}
                        value={candidate.hiringFinalStatus || ""}
                        onChange={(e) =>
                          handleUpdate(
                            candidate._id,
                            "hiringFinalStatus",
                            e.target.value,
                          )
                        }
                      >
                        <option value="">Selectionner...</option>
                        <option value="Accepté">Accepté</option>
                        <option value="Prolongé la formation">
                          Prolongé la formation
                        </option>
                      </select>
                    </td>
                    {/* Score column */}
                    <td style={{ fontWeight: 600, textAlign: "center" }}>
                      {candidate.evalScore != null
                        ? `${candidate.evalScore}/${EVAL_TOTAL}`
                        : "-"}
                    </td>
                    {/* PDF column */}
                    <td>
                      {candidate.evalPdfPath ? (
                        <a
                          href={buildCandidateFileViewUrl(
                            candidate.evalPdfPath,
                            "form3-bucket",
                          )}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="download-link"
                        >Documents</a>
                      ) : (
                        <span className="no-file">-</span>
                      )}
                    </td>
                    {/* Rapport Stage column */}
                    <td>
                      <input
                        type="file"
                        onChange={(e) => handleFileUpload(e, candidate._id)}
                      />
                      {candidate.rapportStagePath && (
                        <a
                          href={buildCandidateFileViewUrl(
                            candidate.rapportStagePath,
                            "rapport-bucket",
                          )}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          Voir Rapport
                        </a>
                      )}
                    </td>
                    <td>
                      <input
                        type="date"
                        className="comment-input"
                        style={{
                          padding: "5px",
                          fontSize: "0.85rem",
                          minWidth: "130px",
                        }}
                        defaultValue={candidate.dateDepart || ""}
                        onBlur={(e) =>
                          handleUpdate(
                            candidate._id,
                            "dateDepart",
                            e.target.value,
                          )
                        }
                      />
                    </td>
                    <td>
                      <textarea
                        className="comment-input"
                        rows="2"
                        defaultValue={candidate.causeDepart || ""}
                        onBlur={(e) =>
                          handleUpdate(
                            candidate._id,
                            "causeDepart",
                            e.target.value,
                          )
                        }
                        placeholder="Cause..."
                      />
                    </td>
                    <td>
                      <button
                        onClick={() =>
                          handleDownloadSingleCandidateDocs(candidate._id)
                        }
                        className="extract-button"
                        style={{
                          background: "#38a169",
                          padding: "8px 12px",
                          fontSize: "0.85rem",
                        }}
                        title="Documents"
                        aria-label="Documents"
                      >
                        {"\uD83D\uDCBE"}
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default CandidatsEmbauches;






