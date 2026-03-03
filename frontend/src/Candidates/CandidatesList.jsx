import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import "../styles/CVExtractor.css"; // Reusing existing styles for consistency

import { API_URL } from "../config";
import {
  loadServicesFromStorage,
} from "../constants/services";

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

const CandidatesList = () => {
  const navigate = useNavigate();
  const [candidates, setCandidates] = useState([]);
  const [services, setServices] = useState(() => loadServicesFromStorage());
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
        setCandidates(data.data);
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

  const handleDelete = async (id) => {
    if (!window.confirm("Are you sure you want to delete this candidate?"))
      return;

    try {
      const response = await fetch(`${API_URL}/candidates/${id}`, {
        method: "DELETE",
      });
      const data = await response.json();

      if (data.success) {
        setCandidates(candidates.filter((c) => c._id !== id));
      } else {
        alert("Failed to delete candidate");
      }
    } catch (err) {
      console.error("Delete error:", err);
      alert("Error deleting candidate");
    }
  };

  const handleCommentChange = async (id, newComment) => {
    try {
      const _id = normalizeId(id);
      await fetch(`${API_URL}/candidates/${_id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ recruiterComment: newComment }),
      });
      // Optimistically update local state
      setCandidates((prev) =>
        prev.map((c) =>
          normalizeId(c._id) === _id
            ? { ...c, recruiterComment: newComment }
            : c,
        ),
      );
    } catch (err) {
      console.error("Failed to save comment", err);
    }
  };

  const handleForm2Upload = async (event, id) => {
    const file = event.target.files[0];
    if (!file) return;

    const formData = new FormData();
    formData.append("form2File", file);

    try {
      const _id = normalizeId(id);
      const response = await fetch(
        `${API_URL}/candidates/${_id}/upload-form2`,
        {
          method: "POST",
          body: formData,
        },
      );
      const data = await response.json();
      if (data.success) {
        setCandidates((prev) =>
          prev.map((c) =>
            normalizeId(c._id) === _id
              ? { ...c, qualifiedFormPath: data.filePath }
              : c,
          ),
        );
      } else {
        alert(data.error || "Failed to upload Form 2.");
      }
    } catch (err) {
      console.error("Error uploading Form 2", err);
      alert("Error uploading Form 2.");
    }
  };

  const handleStatusChange = async (id, newStatus) => {
    try {
      const _id = normalizeId(id);
      await fetch(`${API_URL}/candidates/${_id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      // Update local state
      setCandidates((prev) =>
        prev.map((c) =>
          normalizeId(c._id) === _id ? { ...c, status: newStatus } : c,
        ),
      );
    } catch (err) {
      console.error("Failed to update status", err);
    }
  };
  const handleHiringStatusChange = async (id, newHiringStatus) => {
    try {
      const _id = normalizeId(id);
      await fetch(`${API_URL}/candidates/${_id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ hiringStatus: newHiringStatus }),
      });
      // Update local state
      setCandidates((prev) =>
        prev.map((c) =>
          normalizeId(c._id) === _id
            ? { ...c, hiringStatus: newHiringStatus }
            : c,
        ),
      );
    } catch (err) {
      console.error("Failed to update hiring status", err);
    }
  };

  const handleServiceChange = async (id, newService) => {
    try {
      const _id = normalizeId(id);
      await fetch(`${API_URL}/candidates/${_id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ service: newService }),
      });
      setCandidates((prev) =>
        prev.map((c) =>
          normalizeId(c._id) === _id ? { ...c, service: newService } : c,
        ),
      );
    } catch (err) {
      console.error("Failed to update service", err);
    }
  };

  const buildCandidateFileViewUrl = (fileUrl, bucket) => {
    if (!fileUrl) return "";
    const params = new URLSearchParams({ fileUrl });
    if (bucket) params.set("bucket", bucket);
    return `${API_URL}/candidates/file-view?${params.toString()}`;
  };

  if (loading) return <div className="loading-spinner">Loading...</div>;

  // Filter candidates: Show only those NOT RefusÃƒÂ© and NOT EmbaucÃƒÂ©
  const activeCandidates = candidates.filter((c) => {
    const status = String(c.status || "").toLowerCase();
    const hiringStatus = String(c.hiringStatus || "").toLowerCase();
    return !status.includes("refus") && !hiringStatus.includes("embauch");
  });
  const normalizedNameFilter = nameFilter.trim().toLowerCase();
  const normalizedServiceFilter = serviceFilter.trim().toLowerCase();
  const filteredCandidates = activeCandidates.filter((candidate) => {
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
            flexWrap: "wrap",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <h1>Liste des Candidats</h1>
          <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
            <button
              onClick={() => navigate("/choisir-besoin")}
              className="extract-button action-green"
              style={{
                background: "#38a169",
                fontSize: "1rem",
                padding: "10px 20px",
              }}
            >
              Ajouter Candidat (Lien Candidat)
            </button>
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
                style={{ minWidth: "190px", padding: "8px" }}
              />
              <select
                className="status-select"
                value={serviceFilter}
                onChange={(e) => setServiceFilter(e.target.value)}
                style={{ minWidth: "160px" }}
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
        </div>

        {error && <div className="error-message">{error}</div>}

        <div className="table-responsive">
          <table className="candidates-table">
            <thead>
              <tr>
                <th>Nom</th>
                <th>Prenom</th>
                <th>Service</th>
                <th>Date de naissance</th>
                <th>Adresse</th>
                <th>Poste Actuel</th>
                <th>Societe</th>
                <th>Date d'embauche</th>
                <th>Salaire Actuel</th>
                <th>Diplome</th>
                <th>Anglais</th>
                <th>Form_1</th>
                <th>Commentaire</th>
                <th>Statut</th>
                <th>Etat d'embauche</th>
                <th>CV Original</th>
                <th>Form_2</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredCandidates.length === 0 ? (
                <tr>
                  <td
                    colSpan="18"
                    style={{ textAlign: "center", padding: "2rem" }}
                  >
                    Aucun candidat ne correspond au filtre
                  </td>
                </tr>
              ) : (
                filteredCandidates.map((candidate) => {
                  // Parse English skills
                  let englishDisplay;
                  const form1PdfPath =
                    candidate.form1PdfPath ||
                    candidate.form1Path ||
                    candidate.questionnairePdfPath ||
                    null;
                  if (
                    candidate["Votre niveau de l'anglais technique"] &&
                    typeof candidate["Votre niveau de l'anglais technique"] ===
                      "object"
                  ) {
                    const englishTech =
                      candidate["Votre niveau de l'anglais technique"] || {};
                    const Lu = englishTech.Lu;
                    const Ecrit = englishTech.Ecrit;
                    const Parle = englishTech.Parlé || englishTech["Parle"] || englishTech["parle"];
                    englishDisplay = (
                      <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
                        <li>Lu: {Lu || "-"}</li>
                        <li>Ecrit: {Ecrit || "-"}</li>
                        <li>Parle: {Parle || "-"}</li>
                      </ul>
                    );
                  } else {
                    // Fallback for legacy string data or when it's not an object
                    const englishValue =
                      candidate["Votre niveau de l'anglais technique"];
                    if (
                      typeof englishValue === "object" &&
                      englishValue !== null
                    ) {
                      // If it's an object but we didn't catch it above, display as JSON string
                      englishDisplay = (
                        <span className="badge">
                          {JSON.stringify(englishValue)}
                        </span>
                      );
                    } else {
                      // Normal string fallback
                      englishDisplay = (
                        <span className="badge">{englishValue || "-"}</span>
                      );
                    }
                  }

                  return (
                    <tr key={candidate._id}>
                      <td style={{ fontWeight: 600 }}>
                        {candidate.Nom ||
                          (candidate.hiringStatus === "Attente formulaire"
                            ? "En attente"
                            : "-")}
                      </td>
                      <td style={{ fontWeight: 600 }}>
                        {getCandidateFirstName(candidate) ||
                          (candidate.hiringStatus === "Attente formulaire"
                            ? "En attente"
                            : "-")}
                      </td>
                      <td>
                        <select
                          value={candidate.service || ""}
                          onChange={(e) =>
                            handleServiceChange(candidate._id, e.target.value)
                          }
                          className="status-select"
                          style={{ minWidth: "150px" }}
                        >
                          <option value="">Selectionner...</option>
                          {candidate.service &&
                            !services.some(
                              (s) =>
                                s.toLowerCase() ===
                                String(candidate.service).toLowerCase(),
                            ) && (
                              <option value={candidate.service}>
                                {candidate.service}
                              </option>
                            )}
                          {services.map((service) => (
                            <option key={service} value={service}>
                              {service}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td>
                        {candidate["Date de naissance"] ||
                          (candidate.hiringStatus === "Attente formulaire"
                            ? "En attente"
                            : "-")}
                      </td>
                      <td>
                        {candidate["Adress Actuel"] ||
                          (candidate.hiringStatus === "Attente formulaire"
                            ? "En attente"
                            : "-")}
                      </td>
                      <td>
                        {candidate["Post Actuel"] ||
                          (candidate.hiringStatus === "Attente formulaire"
                            ? "En attente"
                            : "-")}
                      </td>
                      <td>
                        {candidate["Société"] ||
                          candidate["SociÃƒÂ©tÃƒÂ©"] ||
                          (candidate.hiringStatus === "Attente formulaire"
                            ? "En attente"
                            : "-")}
                      </td>
                      <td>
                        {candidate["Date d'embauche"] ||
                          (candidate.hiringStatus === "Attente formulaire"
                            ? "En attente"
                            : "-")}
                      </td>
                      <td>
                        {candidate["Salaire net Actuel"] ||
                          (candidate.hiringStatus === "Attente formulaire"
                            ? "En attente"
                            : "-")}
                      </td>
                      <td>
                        {candidate["Votre dernier diplome"] ||
                          (candidate.hiringStatus === "Attente formulaire"
                            ? "En attente"
                            : "-")}
                      </td>
                      <td style={{ minWidth: "150px" }}>{englishDisplay}</td>
                      <td>
                        {form1PdfPath ? (
                          <a
                            href={buildCandidateFileViewUrl(
                              form1PdfPath,
                              "form1-bucket",
                            )}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="download-link"
                          >
                            Voir
                          </a>
                        ) : (
                          <span className="no-file">-</span>
                        )}
                      </td>
                      <td style={{ minWidth: "200px" }}>
                        <textarea
                          className="comment-input"
                          rows="2"
                          defaultValue={candidate.recruiterComment || ""}
                          onBlur={(e) =>
                            handleCommentChange(candidate._id, e.target.value)
                          }
                          placeholder="Commentaire..."
                        />
                      </td>
                      <td>
                        <select
                          value={candidate.status || "en Attente"}
                          onChange={(e) =>
                            handleStatusChange(candidate._id, e.target.value)
                          }
                          className={`status-select ${candidate.status?.toLowerCase().replace(" ", "-")}`}
                        >
                          <option value="en Attente">en Attente</option>
                          <option value="Accepté">Accepté</option>
                          <option value="Refusé">Refusé</option>
                        </select>
                      </td>
                      <td>
                        <select
                          value={
                            candidate.hiringStatus ||
                            "Attente validation Candidat"
                          }
                          onChange={(e) =>
                            handleHiringStatusChange(
                              candidate._id,
                              e.target.value,
                            )
                          }
                          className={`status-select ${candidate.hiringStatus?.toLowerCase().replaceAll(" ", "-")}`}
                        >
                          <option value="Attente validation Candidat">
                            Attente validation Candidat
                          </option>
                          <option value="Embauché">Embauché</option>
                          <option value="Non Embauché">Non Embauché</option>
                        </select>
                      </td>
                      <td>
                        {candidate.originalCvMinioPath ? (
                          <a
                            href={buildCandidateFileViewUrl(
                              candidate.originalCvMinioPath,
                              "cv-bucket",
                            )}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="download-link"
                          >
                            Voir
                          </a>
                        ) : (
                          <span className="no-file">Aucun</span>
                        )}
                      </td>
                      <td>
                        <input
                          type="file"
                          accept=".pdf,.doc,.docx"
                          onChange={(e) => handleForm2Upload(e, candidate._id)}
                        />
                        {candidate.qualifiedFormPath ? (
                          <a
                            href={buildCandidateFileViewUrl(
                              candidate.qualifiedFormPath,
                              "form2-bucket",
                            )}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="download-link"
                          >
                            Form PDF
                          </a>
                        ) : (
                          <span className="no-file">-</span>
                        )}
                      </td>
                      <td>
                        <button
                          onClick={() => handleDelete(candidate._id)}
                          className="delete-btn"
                          title="Supprimer"
                          style={{ marginLeft: "10px" }}
                        >
                          🗑️
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default CandidatesList;


