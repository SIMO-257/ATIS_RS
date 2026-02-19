import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import "../styles/CVExtractor.css"; // Reusing existing styles for consistency

import { API_URL } from "../config";

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

const CandidatesList = () => {
  const navigate = useNavigate();
  const [candidates, setCandidates] = useState([]);
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

  if (loading) return <div className="loading-spinner">Loading...</div>;

  // Filter candidates: Show only those NOT Refusé and NOT Embaucé
  const activeCandidates = candidates.filter(
    (c) => c.status !== "Refusé" && c.hiringStatus !== "Embaucé",
  );

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
          <h1>👥 Liste des Candidats</h1>
          <button
            onClick={() => navigate("/choisir-besoin")}
            className="extract-button"
            style={{ fontSize: "1rem", padding: "10px 20px" }}
          >
            ➕ Ajouter Candidat (Lien Candidat)
          </button>
        </div>

        {error && <div className="error-message">{error}</div>}

        <div className="table-responsive">
          <table className="candidates-table">
            <thead>
              <tr>
                <th>Nom</th>
                <th>Prénom</th>
                <th>Service</th>
                <th>Date de naissance</th>
                <th>Adresse</th>
                <th>Poste Actuel</th>
                <th>Société</th>
                <th>Date d'embauche</th>
                <th>Salaire Actuel</th>
                <th>Diplôme</th>
                <th>Anglais</th>
                <th>Commentaire</th>
                <th>Statut</th>
                <th>État d'embauche</th>
                <th>CV Original</th>
                <th>Form_2</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {activeCandidates.length === 0 ? (
                <tr>
                  <td
                    colSpan="17"
                    style={{ textAlign: "center", padding: "2rem" }}
                  >
                    Aucun candidat en attente ou accepté
                  </td>
                </tr>
              ) : (
                activeCandidates.map((candidate) => {
                  // Parse English skills
                  let englishDisplay;
                  if (
                    candidate["Votre niveau de l'anglais technique"] &&
                    typeof candidate["Votre niveau de l'anglais technique"] ===
                      "object"
                  ) {
                    const { Lu, Ecrit, Parlé } =
                      candidate["Votre niveau de l'anglais technique"];
                    englishDisplay = (
                      <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
                        <li>Lu: {Lu || "-"}</li>
                        <li>Ecrit: {Ecrit || "-"}</li>
                        <li>Parlé: {Parlé || "-"}</li>
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
                        {candidate["Prénom"] ||
                          (candidate.hiringStatus === "Attente formulaire"
                            ? "En attente"
                            : "-")}
                      </td>
                      <td>{candidate.service || "-"}</td>
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
                          <option value="Embaucé">Embaucé</option>
                          <option value="Non Embauché">Non Embauché</option>
                        </select>
                      </td>
                      <td>
                        {candidate.originalCvMinioPath ? (
                          <a
                            href={candidate.originalCvMinioPath}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="download-link"
                          >
                            📄 Voir
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
                            href={candidate.qualifiedFormPath}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="download-link"
                          >
                            📝 Form PDF
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
