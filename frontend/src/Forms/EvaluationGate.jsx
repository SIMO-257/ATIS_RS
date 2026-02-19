import React, { useEffect, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import { API_URL } from "../config";
import WelcomePage from "../WelcomePage";
import Form3 from "./Form3/Form3";

const POLL_INTERVAL_MS = 3000;

const EvaluationGate = () => {
  const { token } = useParams();
  const [status, setStatus] = useState("checking");
  const [statusMessage, setStatusMessage] = useState("");
  const intervalRef = useRef(null);

  useEffect(() => {
    if (!token) {
      setStatus("missing");
      setStatusMessage("Lien d'evaluation manquant.");
      return;
    }

    let cancelled = false;

    const stopPolling = () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };

    const checkAccess = async () => {
      try {
        const res = await fetch(`${API_URL}/candidates/eval/token/${token}`);
        const data = await res.json();
        if (cancelled) return;

        if (!data.success || !data.data) {
          setStatus("invalid");
          setStatusMessage("Lien invalide ou expire.");
          stopPolling();
          return;
        }

        const evalStatus = data.data.evalStatus;
        if (evalStatus === "active") {
          setStatus("active");
          setStatusMessage("");
          stopPolling();
          return;
        }

        if (evalStatus === "submitted") {
          setStatus("closed");
          setStatusMessage(
            "Cette evaluation a deja ete soumise. Aucun nouveau remplissage n'est possible.",
          );
          stopPolling();
          return;
        }

        if (evalStatus === "corrected") {
          setStatus("closed");
          setStatusMessage(
            "Cette evaluation a deja ete corrigee. Le lien n'est plus actif.",
          );
          stopPolling();
          return;
        }

        setStatus("pending");
        setStatusMessage("En attente d'activation par l'administration...");
      } catch (err) {
        if (cancelled) return;
        setStatus("pending");
        setStatusMessage(
          "Connexion en cours... la page se mettra a jour apres activation.",
        );
      }
    };

    checkAccess();
    intervalRef.current = setInterval(checkAccess, POLL_INTERVAL_MS);

    return () => {
      cancelled = true;
      stopPolling();
    };
  }, [token]);

  if (status === "active") return <Form3 />;

  return (
    <div style={{ position: "relative" }}>
      <WelcomePage showForm={false} />
      {(statusMessage || status === "missing") && (
        <div
          style={{
            position: "absolute",
            left: "50%",
            bottom: "8%",
            transform: "translateX(-50%)",
            background: "rgba(0,0,0,0.35)",
            color: "#fff",
            padding: "10px 16px",
            borderRadius: "999px",
            fontSize: "0.95rem",
            letterSpacing: "0.5px",
            maxWidth: "90%",
            textAlign: "center",
          }}
        >
          {statusMessage}
        </div>
      )}
    </div>
  );
};

export default EvaluationGate;
