import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import "../styles/CVExtractor.css";

import { API_URL } from "../config";
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

const ListeDepart = () => {
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
        setCandidates(
          data.data.filter(
            (c) =>
              String(c.hiringStatus || "").toLowerCase().includes("embauch") &&
              c.dateDepart,
          ),
        );
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
      fetchCandidates();
    } catch (err) {
      console.error(`Failed to update ${field}`, err);
    }
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
          <h1>Candidats Partis</h1>
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
                <th>Cause</th>
                <th>Date d'embauche</th>
                <th>Date de depart</th>
              </tr>
            </thead>
            <tbody>
              {filteredCandidates.length === 0 ? (
                <tr>
                  <td
                    colSpan="5"
                    style={{ textAlign: "center", padding: "2rem" }}
                  >
                    Aucun candidat ne correspond au filtre.
                  </td>
                </tr>
              ) : (
                filteredCandidates.map((candidate) => (
                  <tr key={candidate._id}>
                    <td style={{ fontWeight: 600 }}>{candidate.Nom || "-"}</td>
                    <td style={{ fontWeight: 600 }}>
                      {getCandidateFirstName(candidate) || "-"}
                    </td>
                    <td>{candidate.causeDepart || "-"}</td>
                    <td>{candidate["Date d'embauche"] || "-"}</td>
                    <td>{candidate.dateDepart || "-"}</td>
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

export default ListeDepart;


