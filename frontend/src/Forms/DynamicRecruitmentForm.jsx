import React, { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import "../styles/Etape_1_Form.css";

import { API_URL } from "../config";

const SERVICE_QUESTIONS = {
  Marketing: {
    context:
      "Quelles sont les missions que vous maitrisez pour votre intégration immédiate dans notre société ?",
    questions: [
      { label: "Prospection par Email (Emailing)", key: "marketing_emailing" },
      {
        label: "Prospection sur LinkedIn et d'autres réseaux sociaux",
        key: "marketing_linkedin",
      },
      { label: "Prospection téléphonique", key: "marketing_tel" },
      { label: "Etude du Marché", key: "marketing_etude" },
      { label: "Diagnostic stratégique", key: "marketing_diagnostic" },
    ],
  },
  DevLaravel: {
    context: "",
    questions: [],
  },
  FrontOffice: {
    context: "",
    questions: [],
  },
  RespTechnique: {
    context: "",
    questions: [],
  },
  ChargéEtudes: {
    context: "",
    questions: [],
  },

  Logistique: {
    context:
      "Quelles sont les options que vous maitrisez pour votre intégration immédiate dans notre société ?",
    questions: [
      { label: "Importation", key: "log_importation" },
      { label: "Export", key: "log_export" },
      { label: "Négoce", key: "log_negoce" },
      { label: "Transport Local", key: "log_transportLocal" },
    ],
  },
};

const DynamicRecruitmentForm = () => {
  const { token } = useParams();
  const [formData, setFormData] = useState({
    Nom: "",
    Prénom: "",
    "Date de naissance": "",
    "Adress Actuel": "",
    "Post Actuel": "",
    Société: "",
    "Date d'embauche": "",
    "Salaire net Actuel": "",
    "Votre dernier diplome": "",
    "Votre niveau de l'anglais technique": {
      Lu: "",
      Ecrit: "",
      Parlé: "",
    },
    situationFamiliale: "",
    nbEnfants: "",
    pourquoiChanger: "",
    dureePreavis: "",
    fonctionsMissions: "",
    ecole: "",
    anneeDiplome: "",
    posteSedentaire: "",
    missionsMaitrisees: "", // This will be the service-specific answer
    dev_erp: "",
    travailSeulEquipe: "",
    zoneSapino: "",
    motorise: "",
    pretentionsSalariales: "",
    questionsRemarques: "",
    experienceGestionEquipe: "",
    nombreProfilsEquipe: "",
    log_importation: "",
    log_export: "",
    log_negoce: "",
    log_transportLocal: "",
    missionsIntegration: "",
    travailSeulOuEquipe: "",
  });
  const [cvFile, setCvFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [candidateId, setCandidateId] = useState(null);
  const [service, setService] = useState("");
  const [isFormSubmitted, setIsFormSubmitted] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [touched, setTouched] = useState({});

  useEffect(() => {
    const fetchCandidateData = async () => {
      if (!token) return;

      setLoading(true);
      setError(null);
      try {
        const response = await fetch(`${API_URL}/candidates/token/${token}`);
        const result = await response.json();

        if (result.success && result.data) {
          const candidate = result.data;
          setCandidateId(candidate._id);
          setService(candidate.service || "FrontOffice");
          if (candidate.formStatus === "submitted") {
            setIsFormSubmitted(true);
            setSubmitted(true);
          }
          setFormData({
            Nom: candidate.Nom || "",
            Prénom: candidate.Prénom || "",
            "Date de naissance": candidate["Date de naissance"] || "",
            "Adress Actuel": candidate["Adress Actuel"] || "",
            "Post Actuel": candidate["Post Actuel"] || "",
            Société: candidate.Société || "",
            "Date d'embauche": candidate["Date d'embauche"] || "",
            "Salaire net Actuel": candidate["Salaire net Actuel"] || "",
            "Votre dernier diplome": candidate["Votre dernier diplome"] || "",
            "Votre niveau de l'anglais technique": {
              Lu: candidate["Votre niveau de l'anglais technique"]?.Lu || "",
              Ecrit:
                candidate["Votre niveau de l'anglais technique"]?.Ecrit || "",
              Parlé:
                candidate["Votre niveau de l'anglais technique"]?.Parlé || "",
            },
            situationFamiliale: candidate.situationFamiliale || "",
            nbEnfants: candidate.nbEnfants || "",
            pourquoiChanger: candidate.pourquoiChanger || "",
            dureePreavis: candidate.dureePreavis || "",
            fonctionsMissions: candidate.fonctionsMissions || "",
            ecole: candidate.ecole || "",
            anneeDiplome: candidate.anneeDiplome || "",
            posteSedentaire: candidate.posteSedentaire || "",
            missionsMaitrisees: candidate.missionsMaitrisees || "",
            travailSeulEquipe: candidate.travailSeulEquipe || "",
            zoneSapino: candidate.zoneSapino || "",
            motorise: candidate.motorise || "",
            pretentionsSalariales: candidate.pretentionsSalariales || "",
            questionsRemarques: candidate.questionsRemarques || "",
            experienceGestionEquipe: candidate.experienceGestionEquipe || "",
            nombreProfilsEquipe: candidate.nombreProfilsEquipe || "",
            missionsIntegration: candidate.missionsIntegration || "",
          });
        } else {
          setError(result.error || "Failed to load candidate data.");
        }
      } catch (err) {
        console.error("Error fetching candidate data:", err);
        setError("Error connecting to server to load data.");
      } finally {
        setLoading(false);
      }
    };

    fetchCandidateData();
  }, [token]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    if (name.startsWith("english_")) {
      const englishLevelType = name.split("_")[1];
      setFormData((prevData) => ({
        ...prevData,
        "Votre niveau de l'anglais technique": {
          ...prevData["Votre niveau de l'anglais technique"],
          [englishLevelType]: value,
        },
      }));
    } else {
      setFormData((prevData) => {
        const newData = { ...prevData, [name]: value };
        if (name === "situationFamiliale" && value === "célibataire") {
          newData.nbEnfants = "";
        }
        return newData;
      });
    }
  };

  const handleBlur = (e) => {
    const { name } = e.target;
    setTouched((prev) => ({ ...prev, [name]: true }));
  };

  const handleFileChange = (e) => {
    const selectedFile = e.target.files[0];
    if (selectedFile && selectedFile.type === "application/pdf") {
      setCvFile(selectedFile);
      setError(null);
    } else {
      setError("Veuillez sélectionner un fichier PDF valide.");
      setCvFile(null);
    }
  };

  const validateForm = () => {
    const errors = [];
    const required = [
      "Nom",
      "Prénom",
      "Date de naissance",
      "Adress Actuel",
      "Post Actuel",
      "Société",
      "Date d'embauche",
      "Salaire net Actuel",
      "Votre dernier diplome",
      "situationFamiliale",
      "fonctionsMissions",
      "ecole",
      "anneeDiplome",
      "zoneSapino",
      "motorise",
      "pretentionsSalariales",
      "dureePreavis", // dureePreavis is now unconditionally required
      "travailSeulOuEquipe",
    ];

    if (service === "DevLaravel") {
      required.push("pourquoiChanger");
      required.push("dev_erp");
    } else {
      required.push("pourquoiChanger"); // pourquoiChanger is required for all other services
    }

    // Remove fonctionsMissions for RespTechnique
    if (service === "RespTechnique") {
      const index = required.indexOf("fonctionsMissions");
      if (index > -1) required.splice(index, 1);

      required.push("experienceGestionEquipe");
      required.push("nombreProfilsEquipe"); // Always required for RespTechnique
    }

    // Add dynamic questions to required list
    const serviceConfig =
      SERVICE_QUESTIONS[service] || SERVICE_QUESTIONS["FrontOffice"];
    serviceConfig.questions.forEach((q) => {
      // Only push if the question is part of the current service and not an empty key
      if (q.key && service === "Logistique") {
        required.push(q.key);
      } else if (q.key) {
        // For other services, push all dynamic questions
        required.push(q.key);
      }
    });

    // Remove ce_methods for ChargéEtudes if it was present
    if (service === "ChargéEtudes") {
      const index = required.indexOf("ce_methods");
      if (index > -1) required.splice(index, 1);
    }

    required.forEach((field) => {
      if (!formData[field]) errors.push(field);
    });

    if (formData.situationFamiliale !== "célibataire" && !formData.nbEnfants)
      errors.push("Nombre d'enfants");
    if (service !== "DevLaravel") { // Conditionally require English levels
      if (!formData["Votre niveau de l'anglais technique"].Lu)
        errors.push("Anglais Lu");
      if (!formData["Votre niveau de l'anglais technique"].Ecrit)
        errors.push("Anglais Ecrit");
      if (!formData["Votre niveau de l'anglais technique"].Parlé)
        errors.push("Anglais Parlé");
    }

    if (!cvFile && !formData.originalCvMinioPath) errors.push("CV");

    return errors;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const missingFields = validateForm();
    if (missingFields.length > 0) {
      setError(
        `Veuillez remplir tous les champs obligatoires: ${missingFields.join(", ")}`,
      );
      return;
    }

    setLoading(true);
    setError(null);

    let originalCvMinioPath = formData.originalCvMinioPath;

    try {
      if (cvFile) {
        const fileFormData = new FormData();
        fileFormData.append("cv", cvFile);
        const uploadResponse = await fetch(`${API_URL}/candidates/upload-only-cv`, {
          method: "POST",
          body: fileFormData,
        });
        const uploadResult = await uploadResponse.json();
        if (!uploadResult.success)
          throw new Error(uploadResult.error || "Failed to upload CV");
        originalCvMinioPath = uploadResult.cvUrl || uploadResult.fileName;
      }

      const response = await fetch(`${API_URL}/candidates/${candidateId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...formData,
          originalCvMinioPath,
          formStatus: "submitted",
          formSubmittedAt: new Date(),
        }),
      });

      const result = await response.json();
      if (result.success) setSubmitted(true);
      else throw new Error(result.error || "Failed to submit form");
    } catch (err) {
      console.error("Submission error:", err);
      setError(err.message || "Error submitting form.");
    } finally {
      setLoading(false);
    }
  };

  const isFieldError = (fieldName) =>
    touched[fieldName] && !formData[fieldName];

  if (submitted || isFormSubmitted) {
    return (
      <div className="candidate-form-container">
        <div className="candidate-form-card thank-you-card">
          <h1>🎉 Merci !</h1>
          <p>
            Votre candidature pour le service <strong>{service}</strong> a été
            soumise avec succès.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="candidate-form-container">
      <div className="candidate-form-card">
        <div className="form-header-section">
          <h1>📝 Questionnaire de Recrutement : {service}</h1>
          <p>Veuillez compléter votre profil ci-dessous.</p>
        </div>

        {error && <div className="error-banner">❌ {error}</div>}

        <form onSubmit={handleSubmit} className="candidate-form">
          <div className="form-sections">
            <div className="form-section">
              <h3 className="section-title">👤 Informations Personnelles</h3>
              <div className="form-row">
                <div
                  className={`form-field ${isFieldError("Nom") ? "error" : ""}`}
                >
                  <label>Nom *</label>
                  <input
                    type="text"
                    name="Nom"
                    value={formData.Nom}
                    onChange={handleChange}
                    onBlur={handleBlur}
                    className="field-input"
                  />
                </div>
                <div
                  className={`form-field ${isFieldError("Prénom") ? "error" : ""}`}
                >
                  <label>Prénom *</label>
                  <input
                    type="text"
                    name="Prénom"
                    value={formData.Prénom}
                    onChange={handleChange}
                    onBlur={handleBlur}
                    className="field-input"
                  />
                </div>
              </div>
              <div className="form-row">
                <div
                  className={`form-field ${isFieldError("Date de naissance") ? "error" : ""}`}
                >
                  <label>Date de naissance *</label>
                  <input
                    type="date"
                    name="Date de naissance"
                    value={formData["Date de naissance"]}
                    onChange={handleChange}
                    onBlur={handleBlur}
                    className="field-input"
                  />
                </div>
                <div
                  className={`form-field ${isFieldError("Adress Actuel") ? "error" : ""}`}
                >
                  <label>Adresse Actuelle *</label>
                  <input
                    type="text"
                    name="Adress Actuel"
                    value={formData["Adress Actuel"]}
                    onChange={handleChange}
                    onBlur={handleBlur}
                    className="field-input"
                  />
                </div>
              </div>
              <div className="form-row">
                <div
                  className={`form-field ${isFieldError("situationFamiliale") ? "error" : ""}`}
                >
                  <label>Situation Familiale *</label>
                  <select
                    name="situationFamiliale"
                    value={formData.situationFamiliale}
                    onChange={handleChange}
                    onBlur={handleBlur}
                    className="field-select"
                  >
                    <option value="">Sélectionner</option>
                    <option value="célibataire">Célibataire</option>
                    <option value="marié(e)">Marié(e)</option>
                    <option value="divorcé(e)">Divorcé(e)</option>
                    <option value="veuf/veuve">Veuf/Veuve</option>
                  </select>
                </div>
                {formData.situationFamiliale &&
                  formData.situationFamiliale !== "célibataire" && (
                    <div
                      className={`form-field ${isFieldError("nbEnfants") ? "error" : ""}`}
                    >
                      <label>Nombre d'enfants *</label>
                      <input
                        type="text"
                        name="nbEnfants"
                        value={formData.nbEnfants}
                        onChange={handleChange}
                        onBlur={handleBlur}
                        className="field-input"
                      />
                    </div>
                  )}
              </div>
            </div>

            <div className="form-section">
              <h3 className="section-title">💼 Expérience & Études</h3>
              <div className="form-row">
                <div
                  className={`form-field ${isFieldError("Post Actuel") ? "error" : ""}`}
                >
                  <label>Poste Actuel *</label>
                  <input
                    type="text"
                    name="Post Actuel"
                    value={formData["Post Actuel"]}
                    onChange={handleChange}
                  />
                </div>
                <div
                  className={`form-field ${isFieldError("Société") ? "error" : ""}`}
                >
                  <label>Société *</label>
                  <input
                    type="text"
                    name="Société"
                    value={formData.Société}
                    onChange={handleChange}
                  />
                </div>
              </div>
              <div className="form-row">
                <div
                  className={`form-field ${isFieldError("Date d'embauche") ? "error" : ""}`}
                >
                  <label>Date d'embauche *</label>
                  <input
                    type="date"
                    name="Date d'embauche"
                    value={formData["Date d'embauche"]}
                    onChange={handleChange}
                  />
                </div>
                <div
                  className={`form-field ${isFieldError("Salaire net Actuel") ? "error" : ""}`}
                >
                  <label>Salaire net Actuel *</label>
                  <input
                    type="text"
                    name="Salaire net Actuel"
                    value={formData["Salaire net Actuel"]}
                    onChange={handleChange}
                  />
                </div>
              </div>
              <div className="form-row">
                <div
                  className={`form-field ${isFieldError("Votre dernier diplome") ? "error" : ""}`}
                >
                  <label>Dernier diplôme *</label>
                  <input
                    type="text"
                    name="Votre dernier diplome"
                    value={formData["Votre dernier diplome"]}
                    onChange={handleChange}
                  />
                </div>
                <div
                  className={`form-field ${isFieldError("ecole") ? "error" : ""}`}
                >
                  <label>École *</label>
                  <input
                    type="text"
                    name="ecole"
                    value={formData.ecole}
                    onChange={handleChange}
                  />
                </div>
              </div>
              <div className="form-row">
                <div
                  className={`form-field ${isFieldError("anneeDiplome") ? "error" : ""}`}
                >
                  <label>Année *</label>
                  <input
                    type="text"
                    name="anneeDiplome"
                    value={formData.anneeDiplome}
                    onChange={handleChange}
                  />
                </div>
              </div>

              {service !== "RespTechnique" && (
                <div className="form-row">
                  <div
                    className={`form-field ${isFieldError("fonctionsMissions") ? "error" : ""}`}
                    style={{ flex: "1 1 100%" }}
                  >
                    <label>Fonctions et Missions *</label>
                    <textarea
                      name="fonctionsMissions"
                      value={formData.fonctionsMissions}
                      onChange={handleChange}
                      onBlur={handleBlur}
                      rows="4"
                      style={{
                        width: "100%",
                        borderRadius: "8px",
                        border: "1px solid #e2e8f0",
                        padding: "10px 15px",
                      }}
                    />
                  </div>
                </div>
              )}

              {service === "RespTechnique" && (
                <>
                  <div className="form-row">
                    <div
                      className={`form-field ${isFieldError("experienceGestionEquipe") ? "error" : ""}`}
                      style={{ flex: "1 1 100%" }}
                    >
                      <label>
                        Avez-vous une expérience en gestion d’équipe ? *
                      </label>
                      <select
                        name="experienceGestionEquipe"
                        value={formData.experienceGestionEquipe}
                        onChange={handleChange}
                        className="field-select"
                      >
                        <option value="">Sélectionner</option>
                        <option value="Oui">Oui</option>
                        <option value="Non">Non</option>
                      </select>
                    </div>
                  </div>
                  <div className="form-row">
                    <div
                      className={`form-field ${isFieldError("nombreProfilsEquipe") ? "error" : ""}`}
                      style={{ flex: "1 1 100%" }}
                    >
                      <label>Le nombre et profils de cette équipe ? *</label>
                      <textarea
                        name="nombreProfilsEquipe"
                        value={formData.nombreProfilsEquipe}
                        onChange={handleChange}
                        rows="3"
                        style={{
                          width: "100%",
                          borderRadius: "8px",
                          border: "1px solid #e2e8f0",
                          padding: "10px 15px",
                        }}
                      />
                    </div>
                  </div>
                </>
              )}

              {service !== "DevLaravel" && (
                <div className="form-row">
                  <div
                    className={`form-field ${isFieldError("pourquoiChanger") ? "error" : ""}`}
                    style={{ flex: "1 1 100%" }}
                  >
                    <label>
                      Pourquoi voulez-vous changer votre poste actuel? *
                    </label>
                    <textarea
                      name="pourquoiChanger"
                      value={formData.pourquoiChanger}
                      onChange={handleChange}
                      rows="3"
                      style={{
                        width: "100%",
                        borderRadius: "8px",
                        border: "1px solid #e2e8f0",
                        padding: "10px 15px",
                      }}
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Service-specific "Missions et Compétences" section - NO TITLE */}
            {(() => {
              const serviceConfig =
                SERVICE_QUESTIONS[service] || SERVICE_QUESTIONS["FrontOffice"];
              // Render this section only if there's context or questions
              if (serviceConfig.context || serviceConfig.questions.length > 0) {
                return (
                  <div className="form-section">
                    <div className="form-row">
                      <div className="form-field" style={{ flex: "1 1 100%" }}>
                        <h4 style={{ marginBottom: "15px", color: "#2d3748" }}>
                          {serviceConfig.context}
                        </h4>
                      </div>
                    </div>
                    {serviceConfig.questions.map((q) => (
                      <div className="form-row" key={q.key}>
                        <div
                          className={`form-field ${isFieldError(q.key) ? "error" : ""}`}
                          style={{ flex: "1 1 100%" }}
                        >
                          <label>{q.label} *</label>
                          <textarea
                            name={q.key}
                            value={formData[q.key] || ""}
                            onChange={handleChange}
                            onBlur={handleBlur}
                            rows="3"
                            style={{
                              width: "100%",
                              borderRadius: "8px",
                              border: "1px solid #e2e8f0",
                              padding: "10px 15px",
                            }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                );
              }
              return null; // Don't render anything if no context or questions
            })()}

            {/* Motivation section with conditions */}
            <div className="form-section">
              <h3 className="section-title">💡 Motivation</h3>
              <div className="form-row">
                <div
                  className={`form-field ${isFieldError("zoneSapino") ? "error" : ""}`}
                >
                  <label>
                    Vous acceptez de travailler en présentiel et en plein temps
                    du lundi au vendredi à la zone industrielle Sapino à
                    Nouaceur ? *
                  </label>
                  <select
                    name="zoneSapino"
                    value={formData.zoneSapino}
                    onChange={handleChange}
                    className="field-select"
                  >
                    <option value="">Sélectionner</option>
                    <option value="Oui">Oui</option>
                    <option value="Non">Non</option>
                  </select>
                </div>
                <div
                  className={`form-field ${isFieldError("motorise") ? "error" : ""}`}
                >
                  <label>Êtes-vous motorisé(e)? *</label>
                  <select
                    name="motorise"
                    value={formData.motorise}
                    onChange={handleChange}
                    className="field-select"
                  >
                    <option value="">Sélectionner</option>
                    <option value="Oui">Oui</option>
                    <option value="Non">Non</option>
                  </select>
                </div>
              </div>

              {service === "DevLaravel" && (
                <>
                  <div className="form-row">
                    <div
                      className={`form-field ${isFieldError("pourquoiChanger") ? "error" : ""}`}
                      style={{ flex: "1 1 100%" }}
                    >
                      <label>
                        Pourquoi voulez-vous changer votre poste actuel? *
                      </label>
                      <textarea
                        name="pourquoiChanger"
                        value={formData.pourquoiChanger}
                        onChange={handleChange}
                        rows="3"
                        style={{
                          width: "100%",
                          borderRadius: "8px",
                          border: "1px solid #e2e8f0",
                          padding: "10px 15px",
                        }}
                      />
                    </div>
                  </div>
                  <div className="form-row">
                    <div
                      className={`form-field ${isFieldError("dev_erp") ? "error" : ""}`}
                      style={{ flex: "1 1 100%" }}
                    >
                      <label>
                        Vous pouvez ajouter des modules ou améliorations dans
                        une application ERP réalisée via LARAVEL / REACT? *
                      </label>
                      <textarea
                        name="dev_erp"
                        value={formData.dev_erp || ""}
                        onChange={handleChange}
                        onBlur={handleBlur}
                        rows="3"
                        style={{
                          width: "100%",
                          borderRadius: "8px",
                          border: "1px solid #e2e8f0",
                          padding: "10px 15px",
                        }}
                      />
                    </div>
                  </div>
                </>
              )}
              <div className="form-row">
                <div
                  className={`form-field ${isFieldError("travailSeulOuEquipe") ? "error" : ""}`}
                  style={{ flex: "1 1 100%" }}
                >
                  <label>
                    Préférez-vous travailler seul ou en équipe ?Pourquoi ? *
                  </label>
                  <textarea
                    name="travailSeulOuEquipe"
                    value={formData.travailSeulOuEquipe}
                    onChange={handleChange}
                    onBlur={handleBlur}
                    rows="3"
                    style={{
                      width: "100%",
                      borderRadius: "8px",
                      border: "1px solid #e2e8f0",
                      padding: "10px 15px",
                    }}
                  />
                </div>
              </div>
              <div className="form-row">
                <div
                  className={`form-field ${isFieldError("dureePreavis") ? "error" : ""}`}
                >
                  <label>Durée du Préavis *</label>
                  <textarea
                    name="dureePreavis"
                    value={formData.dureePreavis}
                    onChange={handleChange}
                    rows="2"
                    style={{
                      width: "100%",
                      borderRadius: "8px",
                      border: "1px solid #e2e8f0",
                      padding: "10px 15px",
                    }}
                  />
                </div>
              </div>

              <div className="form-row">
                <div
                  className={`form-field ${isFieldError("pretentionsSalariales") ? "error" : ""}`}
                >
                  <label>Vos prétentions salariales *</label>
                  <textarea
                    name="pretentionsSalariales"
                    value={formData.pretentionsSalariales}
                    onChange={handleChange}
                    rows="2"
                    style={{
                      width: "100%",
                      borderRadius: "8px",
                      border: "1px solid #e2e8f0",
                      padding: "10px 15px",
                    }}
                  />
                </div>
              </div>
              <div className="form-row">
                <div className="form-field" style={{ flex: "1 1 100%" }}>
                  <label>Vos questions et remarques</label>
                  <textarea
                    name="questionsRemarques"
                    value={formData.questionsRemarques}
                    onChange={handleChange}
                    rows="3"
                    style={{
                      width: "100%",
                      borderRadius: "8px",
                      border: "1px solid #e2e8f0",
                      padding: "10px 15px",
                    }}
                  />
                </div>
              </div>
            </div>

            {/* English Level Section */}
            {service !== "DevLaravel" && (
                <div className="form-section">
                    <h3 className="section-title">🌐 Niveau d'Anglais Technique</h3>
                    <div className="form-row">
                        <div
                            className={`form-field english-select ${!formData["Votre niveau de l'anglais technique"].Lu && touched["english_Lu"] ? "error" : ""}`}
                        >
                            <label htmlFor="english_Lu" className="field-label">
                                Lu <span className="required">*</span>
                            </label>
                            <div className="custom-select-wrapper">
                                <select
                                    id="english_Lu"
                                    name="english_Lu"
                                    value={formData["Votre niveau de l'anglais technique"].Lu}
                                    onChange={handleChange}
                                    onBlur={handleBlur}
                                    className="field-select"
                                >
                                    <option value="">Sélectionner</option>
                                    <option value="Faible">Faible</option>
                                    <option value="Moyen">Moyen</option>
                                    <option value="Bien">Bien</option>
                                </select>
                            </div>
                        </div>

                        <div
                            className={`form-field english-select ${!formData["Votre niveau de l'anglais technique"].Ecrit && touched["english_Ecrit"] ? "error" : ""}`}
                        >
                            <label htmlFor="english_Ecrit" className="field-label">
                                Écrit <span className="required">*</span>
                            </label>
                            <div className="custom-select-wrapper">
                                <select
                                    id="english_Ecrit"
                                    name="english_Ecrit"
                                    value={
                                        formData["Votre niveau de l'anglais technique"].Ecrit
                                    }
                                    onChange={handleChange}
                                    onBlur={handleBlur}
                                    className="field-select"
                                >
                                    <option value="">Sélectionner</option>
                                    <option value="Faible">Faible</option>
                                    <option value="Moyen">Moyen</option>
                                    <option value="Bien">Bien</option>
                                </select>
                            </div>
                        </div>

                        <div
                            className={`form-field english-select ${!formData["Votre niveau de l'anglais technique"].Parlé && touched["english_Parlé"] ? "error" : ""}`}
                        >
                            <label htmlFor="english_Parlé" className="field-label">
                                Parlé <span className="required">*</span>
                            </label>
                            <div className="custom-select-wrapper">
                                <select
                                    id="english_Parlé"
                                    name="english_Parlé"
                                    value={
                                        formData["Votre niveau de l'anglais technique"].Parlé
                                    }
                                    onChange={handleChange}
                                    onBlur={handleBlur}
                                    className="field-select"
                                >
                                    <option value="">Sélectionner</option>
                                    <option value="Faible">Faible</option>
                                    <option value="Moyen">Moyen</option>
                                    <option value="Bien">Bien</option>
                                </select>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* CV Upload section */}
            <div className="form-section">
              <label>CV (format PDF) *</label>
              <input type="file" accept=".pdf" onChange={handleFileChange} />
              {formData.originalCvMinioPath && <p>✅ CV déjà uploadé</p>}
            </div>
          </div>

          <button
            type="submit"
            className="submit-form-btn"
            disabled={loading}
            style={{
              width: "100%",
              marginTop: "20px",
              padding: "15px",
              background: "#3182ce",
              color: "white",
              borderRadius: "8px",
              border: "none",
              cursor: "pointer",
            }}
          >
            {loading ? "Chargement..." : "✅ Soumettre mon Profil"}
          </button>
        </form>
      </div>
    </div>
  );
};

export default DynamicRecruitmentForm;
