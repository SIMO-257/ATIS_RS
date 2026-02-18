import React from "react";
import Form3Question from "./Form3Question";

const Form3Page8 = ({ answers, onAnswer }) => {
  const engagement = [
    {
      id: "q35",
      text:
        "7. Avez-vous compris l'importance du respect des règles RH ?",
      options: ["A. Oui", "B. Partiellement", "C. Non"],
    },
    {
      id: "q36",
      text:
        "8. Si un point du règlement interne n'est pas clair, vous devez :",
      options: [
        "A. Demander clarification auprès du RH ou responsable",
        "B. L'ignorer",
        "C. Faire comme les autres",
        "D. Décider vous-même",
      ],
    },
    {
      id: "q37",
      text:
        "9. Pour éviter tout malentendu lié aux absences ou retards, il faut :",
      options: [
        "A. Communiquer rapidement et précis",
        "B. Anticiper et informer à l'avance si possible",
        "C. Respecter strictement la procédure interne",
        "D. Toutes les réponses",
      ],
    },
  ];

  const behavior = [
    {
      id: "q38",
      text:
        "1. Comment réagissez-vous si un collègue commet une erreur dans son travail ?",
      options: [
        "a) Je l'informe devant tout le monde.",
        "b) Je l'informe en privé et propose mon aide.",
        "c) Je ne dis rien, ce n'est pas mon problème.",
      ],
    },
    {
      id: "q39",
      text:
        "2. Un supérieur hiérarchique vous demande une tâche que vous jugez secondaire. Que faites-vous ?",
      options: [
        "a) J'explique calmement mon point de vue et j'exécute la tâche demandée.",
        "b) Je refuse car ce n'est pas prioritaire.",
        "c) J'attends qu'il me le redemande pour le faire.",
      ],
    },
    {
      id: "q40",
      text:
        "3. Comment gérez-vous un désaccord avec votre chef de service ?",
      options: [
        "a) Je reste respectueux et expose mes arguments de manière constructive.",
        "b) Je conteste de manière ferme devant l'équipe.",
        "c) J'ignore ses directives si je ne suis pas d'accord.",
      ],
    },
    {
      id: "q41",
      text:
        "4. Un collègue vous parle de façon inappropriée. Quelle est votre réaction ?",
      options: [
        "a) Je réponds sur le même ton.",
        "b) Je garde mon calme et j'essaie de régler la situation avec respect.",
        "c) J'en parle à mon responsable si cela persiste.",
      ],
    },
    {
      id: "q42",
      text:
        "5. Quelle importance accordez-vous au respect de la hiérarchie dans le cadre professionnel ?",
      options: [
        "a) Essentiel pour la discipline et l'efficacité.",
        "b) Important mais pas prioritaire.",
        "c) Peu important si je connais bien mon travail.",
      ],
    },
  ];

  const openSpace = [
    {
      id: "q43",
      text:
        "1. Si un collègue parle trop fort et cela perturbe votre concentration, que faites-vous ?",
      options: [
        "a) Je lui demande poliment de baisser le ton.",
        "b) Je me plains directement au responsable.",
        "c) J'ignore la situation même si cela me gêne.",
      ],
    },
    {
      id: "q44",
      text:
        "2. Comment gérez-vous une situation où deux collègues discutent bruyamment à proximité pendant que vous travaillez sur une tâche urgente ?",
      options: [
        "a) Je leur demande gentiment de continuer ailleurs ou de réduire le volume.",
        "b) J'essaie de me concentrer malgré le bruit.",
        "c) Je quitte mon poste pour trouver un endroit plus calme.",
      ],
    },
    {
      id: "q45",
      text:
        "3. En cas de conflit entre collègues dans l'open space, quelle serait votre réaction ?",
      options: [
        "a) J'interviens de manière constructive pour calmer la situation.",
        "b) Je laisse faire, ce n'est pas mon problème.",
        "c) J'informe rapidement mon supérieur hiérarchique.",
      ],
    },
    {
      id: "q46",
      text: "4. Que signifie pour vous le respect en open space ?",
      options: [
        "a) Respecter le silence de travail (téléphone, discussions, musique).",
        "b) Respecter l'espace personnel de chacun.",
        "c) Les deux à la fois.",
      ],
    },
    {
      id: "q47",
      text:
        "5. Si vous devez passer un appel professionnel important, quelle est la meilleure attitude en open space ?",
      options: [
        "a) Prévenir vos collègues et parler à voix basse.",
        "b) Parler normalement sans vous soucier des autres.",
        "c) Sortir de l'open space si possible.",
      ],
    },
  ];

  return (
    <section className="form3-page">
      <h2>Engagement personnel</h2>
      {engagement.map((question) => (
        <Form3Question
          key={question.id}
          {...question}
          value={answers[question.id]}
          onChange={onAnswer}
        />
      ))}

      <h2>Questions comportementales (respect et collaboration)</h2>
      {behavior.map((question) => (
        <Form3Question
          key={question.id}
          {...question}
          value={answers[question.id]}
          onChange={onAnswer}
        />
      ))}

      <h2>Questions liées au travail en open space (bruit & conflits)</h2>
      {openSpace.map((question) => (
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

export default Form3Page8;
