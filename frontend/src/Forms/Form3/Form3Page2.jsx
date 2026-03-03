import React from "react";
import Form3Question from "./Form3Question";

const Form3Page2 = ({ answers, onAnswer }) => {
  const questions = [
    {
      id: "q6",
      text: "6. Une non-conformité peut être causée par :",
      options: [
        "A. Une erreur de typographie",
        "B. Une mauvaise interprétation de la tension demandée (ex : 12V au lieu de 24V)",
        "C. Un retard de livraison",
        "D. Un logo incorrect",
      ],
    },
    {
      id: "q7",
      text:
        "7. Il est risqué de baser une offre uniquement sur WhatsApp car :",
      options: [
        "A. Les messages peuvent être incomplets ou non officiels",
        "B. C'est plus rapide",
        "C. C'est gratuit",
        "D. Ce n'est pas autorisé",
      ],
    },
    {
      id: "q8",
      text: "8. Quels frais supplémentaires doivent être anticipés ?",
      options: [
        "A. Formation",
        "B. Douane",
        "C. Transport spécifique",
        "D. Toutes les réponses",
      ],
    },
    {
      id: "q9",
      text:
        "9. Pour garantir la conformité aux normes (FM, ATEX, UL...), il faut :",
      options: [
        "A. Se fier au fournisseur",
        "B. Vérifier les certificats officiels",
        "C. Supposer la conformité",
        "D. Ignorer si non mentionné",
      ],
    },
  ];

  return (
    <section className="form3-page">
      <h2>2. Non-conformités et analyse technique</h2>
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

export default Form3Page2;
