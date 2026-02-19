import React, { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import "./styles/CVExtractor.css";
import { API_URL } from "./config";

const WelcomePage = ({ showForm = true }) => {
  const navigate = useNavigate();
  const [nom, setNom] = useState("");
  const [prenom, setPrenom] = useState("");
  const [dateNaissance, setDateNaissance] = useState("");
  const [statusMessage, setStatusMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const pollRef = useRef(null);

  const stopPolling = () => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  };

  useEffect(() => () => stopPolling(), []);

  const checkActivation = async () => {
    try {
      const res = await fetch(`${API_URL}/candidates/eval/lookup`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nom,
          prenom,
          dateNaissance,
        }),
      });
      const data = await res.json();

      if (!data.success || !data.data) {
        stopPolling();
        setStatusMessage(data.error || "Candidat introuvable.");
        return;
      }

      if (data.data.evalStatus === "active" && data.data.evalToken) {
        stopPolling();
        navigate(`/evaluation/${data.data.evalToken}`);
        return;
      }

      if (data.data.evalStatus === "submitted") {
        stopPolling();
        setStatusMessage("Evaluation deja soumise.");
        return;
      }

      if (data.data.evalStatus === "corrected") {
        stopPolling();
        setStatusMessage("Evaluation deja corrigee.");
        return;
      }

      setStatusMessage(
        "Votre evaluation n'est pas encore activee. Merci d'attendre...",
      );
    } catch (err) {
      setStatusMessage(
        "Connexion en cours... la page se mettra a jour apres activation.",
      );
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setStatusMessage("");

    if (!nom || !prenom || !dateNaissance) {
      setStatusMessage("Veuillez remplir tous les champs.");
      return;
    }

    setIsSubmitting(true);
    await checkActivation();
    setIsSubmitting(false);

    if (!pollRef.current) {
      pollRef.current = setInterval(checkActivation, 3000);
    }
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        margin: 0,
        padding: 0,
        fontFamily: "system-ui, -apple-system, sans-serif",
      }}
    >
      <div
        style={{
          textAlign: "center",
          color: "white",
          animation: "fadeIn 2s ease-in-out",
        }}
      >
        <div
          style={{
            fontSize: "3rem",
            fontWeight: "300",
            marginBottom: "1rem",
            letterSpacing: "2px",
            textShadow: "0 4px 6px rgba(0,0,0,0.1)",
          }}
        >
          Bienvenue
        </div>
        <div
          style={{
            fontSize: "1.2rem",
            fontWeight: "200",
            opacity: 0.9,
            letterSpacing: "1px",
          }}
        >
          Systeme de Gestion des Candidats
        </div>

        {showForm && (
          <form
            onSubmit={handleSubmit}
            style={{
              marginTop: "2rem",
              background: "rgba(255,255,255,0.1)",
              padding: "20px",
              borderRadius: "12px",
              maxWidth: "420px",
              marginLeft: "auto",
              marginRight: "auto",
            }}
          >
            <div style={{ display: "flex", gap: "10px", marginBottom: "10px" }}>
              <input
                type="text"
                placeholder="Nom"
                value={nom}
                onChange={(e) => setNom(e.target.value)}
                style={{
                  flex: 1,
                  padding: "10px",
                  borderRadius: "8px",
                  border: "none",
                }}
              />
              <input
                type="text"
                placeholder="Prenom"
                value={prenom}
                onChange={(e) => setPrenom(e.target.value)}
                style={{
                  flex: 1,
                  padding: "10px",
                  borderRadius: "8px",
                  border: "none",
                }}
              />
            </div>
            <input
              type="date"
              value={dateNaissance}
              onChange={(e) => setDateNaissance(e.target.value)}
              style={{
                width: "100%",
                padding: "10px",
                borderRadius: "8px",
                border: "none",
                marginBottom: "12px",
              }}
            />
            <button
              type="submit"
              disabled={isSubmitting}
              style={{
                width: "100%",
                padding: "10px",
                borderRadius: "8px",
                border: "none",
                cursor: "pointer",
                background: "#ffffff",
                color: "#4a5568",
                fontWeight: 600,
              }}
            >
              {isSubmitting ? "Verification..." : "Acceder a l'evaluation"}
            </button>
            {statusMessage && (
              <div style={{ marginTop: "12px", fontSize: "0.95rem" }}>
                {statusMessage}
              </div>
            )}
          </form>
        )}
      </div>
    </div>
  );
};

export default WelcomePage;
