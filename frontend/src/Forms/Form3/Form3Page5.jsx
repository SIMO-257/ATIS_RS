import React from "react";
import Form3Question from "./Form3Question";

const Form3Page5 = ({ answers, onAnswer }) => {
  const questions = [
    {
      id: "q21",
      text: "5. Origine UK, fournisseur UE, consultation via Eurodistech.",
      options: [
        "A. Exonération automatique",
        "B. Demande de taux à Mohcine",
        "C. ATIS obligatoire",
        "D. Refus de la commande",
      ],
    },
    {
      id: "q22",
      text:
        "6. Origine USA, fournisseur UE, quelle que soit la plateforme. Que fais-tu ?",
      options: [
        "A. Exonération",
        "B. Demande de taux à Mohcine",
        "C. Validation sans contrôle",
        "D. Attente du client",
      ],
    },
    {
      id: "q23",
      text:
        "7. Si le fournisseur est différent du pays d'origine, quelle est la règle à appliquer ?",
      options: [
        "A. Valider si le prix est correct",
        "B. Toujours demander le taux à Mohcine",
        "C. Appliquer une remise",
        "D. Changer d'origine",
      ],
    },
  ];

  return (
    <section className="form3-page">
      <h2>Cas pratiques (suite)</h2>
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

export default Form3Page5;
