import React from "react";
import Form3Question from "./Form3Question";

const Form3Page6 = ({ answers, onAnswer }) => {
  const questions = [
    {
      id: "q24",
      text: "1. Il faut prévenir le référent RH en cas de :",
      options: [
        "A. Absence",
        "B. Retard important",
        "C. Problème médical",
        "D. Toutes les réponses",
      ],
    },
    {
      id: "q25",
      text: "2. En cas d'absence urgente :",
      options: [
        "A. Ne rien dire",
        "B. Informer immédiatement le responsable",
        "C. Envoyer un message après",
        "D. Attendre le lendemain",
      ],
    },
    {
      id: "q26",
      text: "3. Si un certificat médical n'est pas validé :",
      options: [
        "A. L'absence devient injustifiée",
        "B. Rien ne change",
        "C. Il est automatiquement accepté",
        "D. Il est supprimé",
      ],
    },
    {
      id: "q27",
      text: "4. Un retard répété entraîne :",
      options: [
        "A. Aucune conséquence",
        "B. Avertissement possible",
        "C. Augmentation salariale",
        "D. Prime",
      ],
    },
    {
      id: "q28",
      text: "5. Une absence sans justificatif entraîne :",
      options: [
        "A. Sanction disciplinaire",
        "B. Acceptation automatique",
        "C. Congé payé",
        "D. Rien",
      ],
    },
  ];

  return (
    <section className="form3-page">
      <h2>Règles internes RH (Transformation en QCM)</h2>
      {questions.map((question) => (
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

export default Form3Page6;
