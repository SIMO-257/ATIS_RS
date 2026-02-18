import React, { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import "../../styles/Form3.css";
import Form3Page1 from "./Form3Page1";
import Form3Page2 from "./Form3Page2";
import Form3Page3 from "./Form3Page3";
import Form3Page4 from "./Form3Page4";
import Form3Page5 from "./Form3Page5";
import Form3Page6 from "./Form3Page6";
import Form3Page7 from "./Form3Page7";
import Form3Page8 from "./Form3Page8";
import { API_URL } from "../../config";

const Form3 = () => {
  const { token } = useParams();
  const navigate = useNavigate();
  const [candidate, setCandidate] = useState(null);
  const [checking, setChecking] = useState(true);
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [statusMessage, setStatusMessage] = useState("");
  const [manualToken, setManualToken] = useState("");
  const [formError, setFormError] = useState("");
  const [pageIndex, setPageIndex] = useState(0);
  const [answers, setAnswers] = useState({});

  const pages = useMemo(
    () => [
      Form3Page1,
      Form3Page2,
      Form3Page3,
      Form3Page4,
      Form3Page5,
      Form3Page6,
      Form3Page7,
      Form3Page8,
    ],
    [],
  );
  const pageQuestionIds = useMemo(
    () => [
      ["q1", "q2", "q3", "q4", "q5"],
      ["q6", "q7", "q8", "q9"],
      ["q10", "q11", "q12", "q13", "q14", "q15", "q16"],
      ["q17", "q18", "q19", "q20"],
      ["q21", "q22", "q23"],
      ["q24", "q25", "q26", "q27", "q28"],
      ["q29", "q30", "q31", "q32", "q33", "q34"],
      [
        "q35",
        "q36",
        "q37",
        "q38",
        "q39",
        "q40",
        "q41",
        "q42",
        "q43",
        "q44",
        "q45",
        "q46",
        "q47",
      ],
    ],
    [],
  );
  const allQuestionIds = useMemo(
    () => pageQuestionIds.flat(),
    [pageQuestionIds],
  );

  const CurrentPage = pages[pageIndex];
  const totalPages = pages.length;

  useEffect(() => {
    if (token) {
      checkAccess(token);
    } else {
      setChecking(false);
    }
  }, [token]);

  const checkAccess = async (evalToken) => {
    try {
      const res = await fetch(`${API_URL}/candidates/eval/token/${evalToken}`);
      const data = await res.json();
      if (data.success && data.data) {
        if (data.data.evalStatus === "active") {
          setCandidate(data.data);
        } else if (data.data.evalStatus === "submitted") {
          setStatusMessage(
            "Cette évaluation a déjà été soumise. Aucun nouveau remplissage n'est possible.",
          );
        } else if (data.data.evalStatus === "corrected") {
          setStatusMessage(
            "Cette évaluation a déjà été corrigée. Le lien n'est plus actif.",
          );
        } else {
          setStatusMessage(
            "L'évaluation n'est pas encore activée pour ce candidat.",
          );
        }
      } else {
        setStatusMessage("Lien invalide ou expiré.");
      }
    } catch (err) {
      console.error("Access error:", err);
      setStatusMessage("Erreur de serveur lors de la vérification du lien.");
    } finally {
      setChecking(false);
    }
  };

  const handleAnswer = (id, value) => {
    setAnswers((prev) => ({ ...prev, [id]: value }));
    setFormError("");
  };

  const handleNext = () => {
    const currentIds = pageQuestionIds[pageIndex];
    const isComplete = currentIds.every((id) => answers[id]);
    if (!isComplete) {
      setFormError("Veuillez répondre à toutes les questions de cette page.");
      return;
    }
    setPageIndex((prev) => Math.min(prev + 1, totalPages - 1));
  };

  const handlePrevious = () => {
    setPageIndex((prev) => Math.max(prev - 1, 0));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    const isComplete = allQuestionIds.every((id) => answers[id]);
    if (!isComplete) {
      setFormError("Veuillez répondre à toutes les questions.");
      return;
    }
    if (!candidate) {
      setFormError("Lien invalide ou expiré.");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(
        `${API_URL}/candidates/eval/submit/${candidate._id}`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(answers),
        },
      );
      const data = await res.json();
      if (data.success) {
        setSubmitted(true);
      } else {
        setFormError("Erreur lors de la soumission.");
      }
    } catch (err) {
      setFormError("Erreur lors de la soumission.");
    } finally {
      setLoading(false);
    }
  };

  if (checking) return <div className="form3-loading">Chargement...</div>;
  if (!candidate && !token && !statusMessage)
    return (
      <div className="form3-restricted">
        <h1>Accès à l'évaluation</h1>
        <p>Veuillez saisir le token reçu pour ouvrir votre évaluation.</p>
        <div className="form3-token">
          <input
            type="text"
            value={manualToken}
            onChange={(event) => setManualToken(event.target.value)}
            placeholder="Token d'évaluation"
          />
          <button
            onClick={() => manualToken && navigate(`/evaluation/${manualToken}`)}
            className="form3-nav-btn primary"
            disabled={!manualToken}
            type="button"
          >
            Ouvrir
          </button>
        </div>
      </div>
    );
  if (!candidate && statusMessage)
    return <div className="form3-restricted">{statusMessage}</div>;

  if (submitted) {
    return (
      <div className="form3-success">
        <h1>Merci !</h1>
        <p>Votre questionnaire a bien été envoyé.</p>
      </div>
    );
  }

  return (
    <div className="form3-wrapper">
      <header className="form3-header">
        <h1>Test de qualification Chargé d'étude</h1>
        <p>
          Candidat: {candidate?.["Prénom"] || candidate?.Prenom || ""}{" "}
          {candidate?.Nom || ""}
        </p>
      </header>

      <form className="form3-form" onSubmit={handleSubmit}>
        <div className="form3-progress">
          Page {pageIndex + 1} sur {totalPages}
        </div>
        {formError && <div className="form3-error">{formError}</div>}

        <CurrentPage answers={answers} onAnswer={handleAnswer} />

        <div className="form3-navigation">
          <button
            type="button"
            onClick={handlePrevious}
            disabled={pageIndex === 0}
            className="form3-nav-btn"
          >
            Précédent
          </button>
          {pageIndex < totalPages - 1 ? (
            <button
              type="button"
              onClick={handleNext}
              className="form3-nav-btn primary"
            >
              Suivant
            </button>
          ) : (
            <button
              type="submit"
              className="form3-nav-btn primary"
              disabled={loading}
            >
              {loading ? "Envoi..." : "Soumettre"}
            </button>
          )}
        </div>
      </form>
    </div>
  );
};

export default Form3;
