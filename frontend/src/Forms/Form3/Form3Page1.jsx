import React from "react";
import Form3Question from "./Form3Question";

const Form3Page1 = ({ answers, onAnswer }) => {
  const questions = [
    {
      id: "q1",
      text: "1. Le rôle principal d'un chargé d'étude est :",
      options: [
        "A. Envoyer des devis rapidement",
        "B. Analyser les demandes clients et proposer une offre conforme techniquement et commercialement",
        "C. Négocier uniquement les prix",
        "D. Gérer la facturation",
      ],
    },
    {
      id: "q2",
      text:
        "2. Quelle est l'erreur la plus critique lors de la préparation d'une offre ?",
      options: [
        "A. Oublier le logo",
        "B. Mauvaise interprétation du besoin client",
        "C. Envoyer trop tôt",
        "D. Faire une remise trop faible",
      ],
    },
    {
      id: "q3",
      text:
        "3. Lors de la comparaison entre une fiche technique client et une offre fournisseur, il faut :",
      options: [
        "A. Vérifier uniquement le prix",
        "B. Comparer toutes les caractéristiques techniques",
        "C. Se baser sur la description générale",
        "D. Valider sans vérification",
      ],
    },
    {
      id: "q4",
      text:
        "4. Pour s'assurer que les accessoires demandés sont inclus :",
      options: [
        "A. Se fier au devis fournisseur",
        "B. Vérifier ligne par ligne la fiche technique",
        "C. Supposer qu'ils sont inclus",
        "D. Attendre la livraison",
      ],
    },
    {
      id: "q5",
      text: "5. Avant d'envoyer une offre au client, il faut :",
      options: [
        "A. Vérifier conformité technique, prix, délais et documents",
        "B. Vérifier uniquement la marge",
        "C. Envoyer rapidement sans contrôle",
        "D. Attendre validation du client",
      ],
    },
  ];

  return (
    <section className="form3-page">
      <h2>1. Rôle et préparation d'offre</h2>
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

export default Form3Page1;
