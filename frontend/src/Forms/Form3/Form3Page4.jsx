import React from "react";
import Form3Question from "./Form3Question";

const Form3Page4 = ({ answers, onAnswer }) => {
  const questions = [
    {
      id: "q17",
      text: "1. Quelle est la première information à identifier ?",
      options: [
        "A. Le prix du produit",
        "B. La plateforme de consultation",
        "C. L'origine du produit",
        "D. Le client final",
      ],
    },
    {
      id: "q18",
      text:
        "2. Après l'origine du produit, quelle est l'étape suivante ?",
      options: [
        "A. Vérifier la marge",
        "B. Identifier le pays du fournisseur",
        "C. Envoyer le devis",
        "D. Contacter Mohcine",
      ],
    },
    {
      id: "q19",
      text:
        "3. Origine UK, fournisseur UK, consultation via ATIS. Quelle est la décision ?",
      options: [
        "A. Demander le taux à Mohcine",
        "B. Opération exonérée de dédouanement",
        "C. Annuler la commande",
        "D. Changer de plateforme",
      ],
    },
    {
      id: "q20",
      text:
        "4. Origine UK, fournisseur UE, consultation via ATIS. Que faut-il faire ?",
      options: [
        "A. Rien, l'opération est exonérée",
        "B. Demander le taux à Mohcine",
        "C. Valider directement le devis",
        "D. Contacter le fournisseur",
      ],
    },
  ];

  return (
    <section className="form3-page">
      <h2>Cas pratiques (Règles Origine / Fournisseur / Plateforme)</h2>
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

export default Form3Page4;
