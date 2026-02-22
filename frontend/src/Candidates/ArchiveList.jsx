import React, { useEffect, useState } from "react";
import "../styles/CVExtractor.css";
import { API_URL, FRONTEND_URL } from "../config";

const SERVICES = [
  "Marketing",
  "RespTechnique",
  "Charg\u00e9Etudes",
  "FrontOffice",
  "Anglais",
  "Logistique",
  "DevLaravel",
];

const ArchiveList = () => {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchArchive();
    const intervalId = setInterval(fetchArchive, 3000);
    return () => clearInterval(intervalId);
  }, []);

  const fetchArchive = async () => {
    try {
      const response = await fetch(`${API_URL}/archive`);
      const data = await response.json();
      if (data.success) {
        setItems(data.data || []);
      } else {
        setError(data.error || "Failed to load archive");
      }
    } catch (err) {
      setError("Error fetching archive");
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleServiceChange = async (id, service) => {
    try {
      await fetch(`${API_URL}/archive/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ service }),
      });
      setItems((prev) =>
        prev.map((item) => (item._id === id ? { ...item, service } : item)),
      );
    } catch (err) {
      console.error("Failed to update service", err);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Supprimer cet archivage ?")) return;
    try {
      await fetch(`${API_URL}/archive/${id}`, { method: "DELETE" });
      setItems((prev) => prev.filter((i) => i._id !== id));
    } catch (err) {
      console.error("Failed to delete archive", err);
    }
  };

  const buildEmailTemplate = (service, link) => {
    const emailService = service || "{{service_choisi}}";
    const emailLink = link || "https://...?poste={{service_choisi}}";
    return {
      subject: `Premi\u00e8re \u00c9tape de Votre Candidature Poste de ${emailService}`,
      body: `Bonjour,

Nous vous remercions de l'interet que vous portez au poste de ${emailService} au sein de ATIS (APPROVISIONNEUR TECHNIQUE INTERNATIONAL SA). Votre profil a retenu notre attention et nous souhaitons donner suite a votre candidature.

Dans le cadre de notre processus de recrutement, nous vous invitons \u00e0 compl\u00e9ter un court formulaire en ligne. Celui-ci nous permettra de mieux cerner votre parcours et de pr\u00e9parer au mieux notre \u00e9change \u00e0 venir.

Veuillez remplir le formulaire ici : ${emailLink}

Nous nous r\u00e9jouissons d'en apprendre davantage sur vous !

Cordialement,
Service RH
ATIS
na.loulida@approvisionneur.com`,
    };
  };

  const openGmailCompose = (subject, body, to) => {
    const params = new URLSearchParams({
      view: "cm",
      fs: "1",
      su: subject,
      body,
      ...(to ? { to } : {}),
    });
    window.open(`https://mail.google.com/mail/?${params.toString()}`, "_blank");
  };

  const handleTransfer = async (item) => {
    if (!item.service) {
      alert("Veuillez selectionner un service avant de transferer.");
      return;
    }
    try {
      const response = await fetch(`${API_URL}/forms/generate-form-link`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          service: item.service,
          questionnaire: item.service,
        }),
      });
      const data = await response.json();
      if (!data.success || !data.formLink) {
        alert(data.error || "Echec de la generation du lien.");
        return;
      }
      const fullLink = `${FRONTEND_URL}${data.formLink}`;
      const { subject, body } = buildEmailTemplate(item.service, fullLink);
      openGmailCompose(subject, body, item.Email);
    } catch (err) {
      console.error("Transfer error:", err);
      alert("Erreur lors du transfert.");
    }
  };

  if (loading) return <div className="loading-spinner">Loading...</div>;

  return (
    <div className="cv-extractor-container">
      <div
        className="cv-extractor-card"
        style={{ maxWidth: "1400px", display: "block" }}
      >
        <div className="header" style={{ marginBottom: "2rem" }}>
          <h1>Archive</h1>
        </div>

        {error && <div className="error-message">{error}</div>}

        <div className="table-responsive">
          <table className="candidates-table">
            <thead>
              <tr>
                <th>Nom</th>
                <th>Prenom</th>
                <th>Email</th>
                <th>Service</th>
                <th>CV</th>
                <th>Transferer</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {items.length === 0 ? (
                <tr>
                  <td
                    colSpan="7"
                    style={{ textAlign: "center", padding: "2rem" }}
                  >
                    Aucun archivage
                  </td>
                </tr>
              ) : (
                items.map((item) => (
                  <tr key={item._id}>
                    <td style={{ fontWeight: 600 }}>{item.Nom || "-"}</td>
                    <td style={{ fontWeight: 600 }}>
                      {item.Prenom || item["Pr\u00e9nom"] || "-"}
                    </td>
                    <td>{item.Email || "-"}</td>
                    <td>
                      <select
                        value={item.service || ""}
                        onChange={(e) =>
                          handleServiceChange(item._id, e.target.value)
                        }
                        className="status-select"
                      >
                        <option value="">Selectionner...</option>
                        {SERVICES.map((s) => (
                          <option key={s} value={s}>
                            {s}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td>
                      {item.cvUrl ? (
                        <a
                          href={item.cvUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="download-link"
                        >
                          Voir CV
                        </a>
                      ) : (
                        <span className="no-file">-</span>
                      )}
                    </td>
                    <td>
                      <button
                        onClick={() => handleTransfer(item)}
                        className="extract-button"
                        style={{ padding: "6px 10px", fontSize: "0.85rem" }}
                      >
                        Transferer
                      </button>
                    </td>
                    <td>
                      <button
                        onClick={() => handleDelete(item._id)}
                        className="delete-btn"
                        title="Supprimer"
                      >
                        {"\uD83D\uDDD1\uFE0F"}
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

export default ArchiveList;
