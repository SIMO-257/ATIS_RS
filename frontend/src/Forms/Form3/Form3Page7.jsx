import React from "react";
import Form3Question from "./Form3Question";

const Form3Page7 = ({ answers, onAnswer }) => {
  const generalRules = [
    {
      id: "q29",
      text:
        "1. Dans quelles situations devez-vous obligatoirement prévenir votre référent RH ?",
      options: [
        "A. En cas d'absence ou de retard",
        "B. En cas de problème médical",
        "C. En cas de changement de situation administrative",
        "D. Toutes les réponses",
      ],
    },
    {
      id: "q30",
      text: "2. Les horaires officiels de travail doivent être :",
      options: [
        "A. Respectés strictement (heure d'entrée, pause et sortie)",
        "B. Adaptés librement selon convenance personnelle",
        "C. Respectés uniquement si le responsable est présent",
        "D. Modifiés sans information préalable",
      ],
    },
    {
      id: "q31",
      text:
        "3. En cas d'absence pour un motif personnel urgent, vous devez :",
      options: [
        "A. Informer immédiatement votre responsable et/ou RH",
        "B. Prévenir après votre retour",
        "C. Ne rien dire",
        "D. Envoyer un message à un collègue uniquement",
      ],
    },
    {
      id: "q32",
      text:
        "4. Si votre certificat médical n'est pas validé par le médecin du travail :",
      options: [
        "A. L'absence peut être considérée comme injustifiée",
        "B. Il est automatiquement accepté",
        "C. Cela n'a aucune conséquence",
        "D. Il est reporté automatiquement",
      ],
    },
  ];

  const delays = [
    {
      id: "q33",
      text:
        "5. Quelles peuvent être les conséquences d'un retard répété le matin ?",
      options: [
        "A. Aucune conséquence",
        "B. Un rappel à l'ordre",
        "C. Un avertissement disciplinaire",
        "D. B et C",
      ],
    },
    {
      id: "q34",
      text:
        "6. Que se passe-t-il si un salarié s'absente sans justificatif valable ?",
      options: [
        "A. L'absence est considérée comme injustifiée",
        "B. Une sanction disciplinaire peut être appliquée",
        "C. Une retenue sur salaire peut être effectuée",
        "D. Toutes les réponses",
      ],
    },
  ];

  return (
    <section className="form3-page">
      <h2>Connaissances générales des règles internes</h2>
      {generalRules.map((question) => (
        <Form3Question
          key={question.id}
          {...question}
          value={answers[question.id]}
          onChange={onAnswer}
        />
      ))}

      <h2>Retards et sanctions</h2>
      {delays.map((question) => (
        <Form3Question
          key={question.id}
          {...question}
          value={answers[question.id]}
          onChange={onAnswer}
        />
      ))}
    </section>
  );
};

export default Form3Page7;
