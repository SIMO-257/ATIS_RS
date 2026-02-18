import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import "../styles/Etape_3_Form.css";

import { API_URL } from "../config";

const AdminEvaluationCorrection = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [candidate, setCandidate] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [corrections, setCorrections] = useState({});

  const QUESTIONS = [
    { id: "q1", text: "1. Rôle principal d'un chargé d'étude ?" },
    { id: "q2", text: "2. Erreur critique lors d'une offre ?" },
    { id: "q3", text: "3. Comparaison fiche technique / offre fournisseur ?" },
    { id: "q4", text: "4. Inclusion des accessoires ?" },
    { id: "q5", text: "5. Vérifications avant envoi d'offre ?" },
    { id: "q6", text: "6. Non-conformité possible ?" },
    { id: "q7", text: "7. Risque WhatsApp ?" },
    { id: "q8", text: "8. Frais supplémentaires à anticiper ?" },
    { id: "q9", text: "9. Conformité aux normes ?" },
    { id: "q10", text: "10. Demande client incomplète ?" },
    { id: "q11", text: "11. Doute technique ?" },
    { id: "q12", text: "12. Difficulté en début de poste ?" },
    { id: "q13", text: "13. Compétence renforcée ?" },
    { id: "q14", text: "14. Produit complexe ?" },
    { id: "q15", text: "15. Bonne pratique à garder ?" },
    { id: "q16", text: "16. Pour progresser il faut ?" },
    { id: "q17", text: "17. Première info à identifier ?" },
    { id: "q18", text: "18. Étape après l'origine ?" },
    { id: "q19", text: "19. Cas UK/UK/ATIS ?" },
    { id: "q20", text: "20. Cas UK/UE/ATIS ?" },
    { id: "q21", text: "21. Cas UK/UE/Eurodistech ?" },
    { id: "q22", text: "22. Cas USA/UE ?" },
    { id: "q23", text: "23. Fournisseur différent du pays d'origine ?" },
    { id: "q24", text: "24. Prévenir RH en cas de ?" },
    { id: "q25", text: "25. Absence urgente ?" },
    { id: "q26", text: "26. Certificat médical non validé ?" },
    { id: "q27", text: "27. Retard répété ?" },
    { id: "q28", text: "28. Absence sans justificatif ?" },
    { id: "q29", text: "29. Situations prévenir RH ?" },
    { id: "q30", text: "30. Horaires officiels ?" },
    { id: "q31", text: "31. Absence motif urgent ?" },
    { id: "q32", text: "32. Certificat médical non validé médecin ?" },
    { id: "q33", text: "33. Conséquences retard répété ?" },
    { id: "q34", text: "34. Absence sans justificatif valable ?" },
    { id: "q35", text: "35. Importance règles RH ?" },
    { id: "q36", text: "36. Point règlement pas clair ?" },
    { id: "q37", text: "37. Éviter malentendus absences/retards ?" },
    { id: "q38", text: "38. Erreur collègue ?" },
    { id: "q39", text: "39. Tâche jugée secondaire ?" },
    { id: "q40", text: "40. Désaccord chef de service ?" },
    { id: "q41", text: "41. Collègue parle de façon inappropriée ?" },
    { id: "q42", text: "42. Respect hiérarchie ?" },
    { id: "q43", text: "43. Collègue parle trop fort ?" },
    { id: "q44", text: "44. Deux collègues bruyants ?" },
    { id: "q45", text: "45. Conflit entre collègues en open space ?" },
    { id: "q46", text: "46. Respect en open space ?" },
    { id: "q47", text: "47. Appel professionnel important ?" },
  ];

  useEffect(() => {
    fetchCandidate();
  }, [id]);

  const fetchCandidate = async () => {
    try {
      const res = await fetch(`${API_URL}/candidates/${id}`);
      const data = await res.json();
      if (data.success) {
        setCandidate(data.data);
        const initial = {};
        QUESTIONS.forEach((q) => {
          if (data.data.evalCorrection && q.id in data.data.evalCorrection) {
            initial[q.id] = data.data.evalCorrection[q.id];
          } else {
            initial[q.id] = null;
          }
        });
        setCorrections(initial);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleToggle = (qId, val) => {
    setCorrections((prev) => ({ ...prev, [qId]: val }));
  };

  const handleSubmitCorrection = async () => {
    const answeredCount = Object.values(corrections).filter(
      (v) => v !== null,
    ).length;
    if (answeredCount < QUESTIONS.length) {
      alert("Veuillez corriger toutes les questions.");
      return;
    }

    setSaving(true);
    try {
      const trueCount = Object.values(corrections).filter(
        (v) => v === true,
      ).length;
      const score = trueCount;

      const res = await fetch(`${API_URL}/candidates/eval/correct/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          evalCorrection: corrections,
          evalScore: score.toFixed(2),
          evalStatus: "corrected",
        }),
      });
      const data = await res.json();
      if (data.success) {
        alert(`Évaluation validée ! Note : ${score}/${QUESTIONS.length}`);
        navigate("/hired");
      }
    } catch (err) {
      alert("Erreur lors de la validation");
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div>Chargement...</div>;
  if (!candidate || !candidate.evalAnswers)
    return <div>Aucune évaluation soumise pour ce candidat.</div>;

  return (
    <div className="form-container">
      <header className="correction-header">
        <h1>
          ✍️ Correction Évaluation : {candidate.Prenom} {candidate.Nom}
        </h1>
        <p>
          Note actuelle calculée :{" "}
          {Object.values(corrections).filter((v) => v === true).length}/
          {QUESTIONS.length}
        </p>
      </header>

      <div className="correction-list">
        {QUESTIONS.map((q) => (
          <div key={q.id} className="correction-item">
            <div className="q-text">
              <strong>{q.text}</strong>
            </div>
            <div className="ans-text">
              Réponse : {candidate.evalAnswers[q.id] || "N/A"}
            </div>
            <div className="correction-actions">
              <button
                className={`btn-true ${corrections[q.id] === true ? "active" : ""}`}
                onClick={() => handleToggle(q.id, true)}
              >
                ✅ Vrai
              </button>
              <button
                className={`btn-false ${corrections[q.id] === false ? "active" : ""}`}
                onClick={() => handleToggle(q.id, false)}
              >
                ❌ Faux
              </button>
            </div>
          </div>
        ))}
      </div>

      <div className="footer-actions">
        <button
          className="validate-btn"
          onClick={handleSubmitCorrection}
          disabled={saving}
        >
          {saving
            ? "Validation..."
            : "Valider la correction et générer la note"}
        </button>
      </div>
    </div>
  );
};

export default AdminEvaluationCorrection;
