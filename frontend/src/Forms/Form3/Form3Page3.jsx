import React from "react";
import Form3Question from "./Form3Question";

const Form3Page3 = ({ answers, onAnswer }) => {
  const reflexes = [
    {
      id: "q10",
      text: "10. Si une demande client est incomplète :",
      options: [
        "A. Envoyer un devis approximatif",
        "B. Demander des clarifications au client",
        "C. Refuser la demande",
        "D. Deviner le besoin",
      ],
    },
    {
      id: "q11",
      text: "11. En cas de doute technique :",
      options: [
        "A. Valider quand même",
        "B. Demander confirmation au fournisseur ou responsable",
        "C. Ignorer le doute",
        "D. Attendre sans rien faire",
      ],
    },
  ];

  const progression = [
    {
      id: "q12",
      text: "12. La plus grande difficulté en début de poste concerne souvent :",
      options: [
        "A. Compréhension technique des produits",
        "B. Pause déjeuner",
        "C. Signature email",
        "D. Horaires",
      ],
    },
    {
      id: "q13",
      text: "13. Une compétence renforcée peut être :",
      options: [
        "A. Analyse technique",
        "B. Organisation",
        "C. Communication fournisseur",
        "D. Toutes les réponses",
      ],
    },
    {
      id: "q14",
      text: "14. Un produit complexe est généralement :",
      options: [
        "A. Celui avec normes spécifiques",
        "B. Celui avec simple référence",
        "C. Produit standard",
        "D. Produit déjà vendu",
      ],
    },
  ];

  const engagement = [
    {
      id: "q15",
      text: "15. Une bonne pratique à garder :",
      options: [
        "A. Vérification systématique",
        "B. Envoyer rapidement",
        "C. Se fier à la mémoire",
        "D. Éviter les contrôles",
      ],
    },
    {
      id: "q16",
      text: "16. Pour progresser il faut :",
      options: [
        "A. Ignorer ses erreurs",
        "B. Demander du feedback",
        "C. Refuser les remarques",
        "D. Éviter les responsabilités",
      ],
    },
  ];

  return (
    <section className="form3-page">
      <h2>3. Réflexes et autonomie</h2>
      {reflexes.map((question) => (
        <Form3Question
          key={question.id}
          {...question}
          value={answers[question.id]}
          onChange={onAnswer}
        />
      ))}

      <h2>4. Progression personnelle</h2>
      {progression.map((question) => (
        <Form3Question
          key={question.id}
          {...question}
          value={answers[question.id]}
          onChange={onAnswer}
        />
      ))}

      <h2>5. Engagement professionnel</h2>
      {engagement.map((question) => (
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

export default Form3Page3;
