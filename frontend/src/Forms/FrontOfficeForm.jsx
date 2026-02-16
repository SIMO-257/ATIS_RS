import React, { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import "../styles/Etape_1_Form.css";

import { API_URL } from "../config";

const Etape_2_Form = () => {
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
    // New fields from PDF
    situationFamiliale: "",
    nbEnfants: "",
    pourquoiChanger: "",
    dureePreavis: "",
    fonctionsMissions: "",
    ecole: "",
    anneeDiplome: "",
    posteSedentaire: "",
    missionsMaitrisees: "",
    travailSeulEquipe: "",
    zoneSapino: "",
    motorise: "",
    pretentionsSalariales: "",
    questionsRemarques: "",
  });
  const [cvFile, setCvFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [candidateId, setCandidateId] = useState(null);
  const [isFormSubmitted, setIsFormSubmitted] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [touched, setTouched] = useState({});

  // Fetch candidate data if token exists
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
        const newData = {
          ...prevData,
          [name]: value,
        };

        // If situationFamiliale becomes 'célibataire', clear nbEnfants
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

  // Validation function to check all fields are filled
  const validateForm = () => {
    const errors = [];

    if (!formData.Nom.trim()) errors.push("Nom");
    if (!formData.Prénom.trim()) errors.push("Prénom");
    if (!formData["Date de naissance"]) errors.push("Date de naissance");
    if (!formData["Adress Actuel"].trim()) errors.push("Adresse Actuelle");
    if (!formData["Post Actuel"].trim()) errors.push("Poste Actuel");
    if (!formData.Société.trim()) errors.push("Société");
    if (!formData["Date d'embauche"]) errors.push("Date d'embauche");
    if (!formData["Salaire net Actuel"].trim())
      errors.push("Salaire net Actuel");
    if (!formData["Votre dernier diplome"].trim())
      errors.push("Dernier Diplôme");

    // Check English levels
    if (!formData["Votre niveau de l'anglais technique"].Lu)
      errors.push("Niveau d'anglais - Lu");
    if (!formData["Votre niveau de l'anglais technique"].Ecrit)
      errors.push("Niveau d'anglais - Écrit");
    if (!formData["Votre niveau de l'anglais technique"].Parlé)
      errors.push("Niveau d'anglais - Parlé");

    // New fields validation
    if (!formData.situationFamiliale) errors.push("Situation familiale");
    if (
      formData.situationFamiliale !== "célibataire" &&
      !formData.nbEnfants.trim()
    )
      errors.push("Nombre d'enfants");
    if (!formData.pourquoiChanger.trim())
      errors.push("Pourquoi voulez-vous changer?");
    if (!formData.dureePreavis.trim()) errors.push("Durée du préavis");
    if (!formData.fonctionsMissions.trim())
      errors.push("Fonctions et Missions");
    if (!formData.ecole.trim()) errors.push("École");
    if (!formData.anneeDiplome.trim())
      errors.push("Année d'obtention du diplôme");
    if (!formData.posteSedentaire) errors.push("Poste sédentaire");
    if (!formData.missionsMaitrisees.trim()) errors.push("Missions maîtrisées");
    if (!formData.travailSeulEquipe.trim())
      errors.push("Travail seul ou en équipe");
    if (!formData.zoneSapino) errors.push("Zone Sapino");
    if (!formData.motorise) errors.push("Motorisé");
    if (!formData.pretentionsSalariales.trim())
      errors.push("Prétentions salariales");

    // Check CV
    if (!cvFile && !formData.originalCvMinioPath) {
      errors.push("CV (fichier PDF)");
    }

    return errors;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    // Validate all fields
    const missingFields = validateForm();
    if (missingFields.length > 0) {
      setError(
        `Veuillez remplir tous les champs obligatoires: ${missingFields.join(", ")}`,
      );
      // Mark all fields as touched to show validation errors
      const allTouched = {};
      Object.keys(formData).forEach((key) => {
        if (key !== "Votre niveau de l'anglais technique") {
          allTouched[key] = true;
        }
      });
      allTouched["english_Lu"] = true;
      allTouched["english_Ecrit"] = true;
      allTouched["english_Parlé"] = true;
      setTouched(allTouched);
      return;
    }

    if (!token || !candidateId) {
      setError(
        "Erreur: Impossible de soumettre le formulaire sans un identifiant candidat valide.",
      );
      return;
    }

    setLoading(true);
    setError(null);

    let originalCvMinioPath = null;

    try {
      // 1. If CV file is provided, upload it first
      if (cvFile) {
        const fileFormData = new FormData();
        fileFormData.append("cv", cvFile);

        const uploadResponse = await fetch(`${API_URL}/candidates/upload-only-cv`, {
          method: "POST",
          body: fileFormData,
        });

        const uploadResult = await uploadResponse.json();

        if (!uploadResult.success) {
          console.error("CV Upload Failed:", uploadResult);
          throw new Error(uploadResult.error || "Failed to upload CV file.");
        }
        originalCvMinioPath = uploadResult.cvUrl || uploadResult.fileName;
        console.log("CV Upload Successful. Path:", originalCvMinioPath);
      }

      // 2. Prepare data for updating
      const dataToUpdate = {
        ...formData,
        originalCvMinioPath: originalCvMinioPath,
        formStatus: "submitted",
        formSubmittedAt: new Date(),
        hiringStatus: "Attente validation Candidat",
      };

      // 3. Send data to /api/cv/:id (PUT request)
      const updateResponse = await fetch(`${API_URL}/candidates/${candidateId}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(dataToUpdate),
      });

      const updateResult = await updateResponse.json();

      if (updateResult.success) {
        setSubmitted(true);
      } else {
        throw new Error(
          updateResult.error ||
            "Erreur lors de la mise à jour de votre profil.",
        );
      }
    } catch (err) {
      console.error("Submission error:", err);
      setError(err.message || "Erreur lors de la soumission de votre profil.");
    } finally {
      setLoading(false);
    }
  };

  // Helper to check if field is empty and touched
  const isFieldError = (fieldName, value) => {
    return touched[fieldName] && !value;
  };

  // Thank you page after submission
  if (submitted || isFormSubmitted) {
    return (
      <div className="candidate-form-container">
        <div className="candidate-form-card thank-you-card">
          <div className="form-header">
            <span className="thank-you-icon">🎉</span>
            <h1>Merci !</h1>
            <p>Votre candidature a été soumise avec succès.</p>
            <p>
              Notre équipe va étudier vos informations et reviendra vers vous
              prochainement.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="candidate-form-container">
      <div className="candidate-form-card">
        <div className="form-header-section">
          <h1>📝 Remplir votre Profil Candidat</h1>
          <p>
            Veuillez remplir toutes les informations ci-dessous pour compléter
            votre profil.
          </p>
        </div>

        {error && <div className="error-banner">❌ {error}</div>}

        <form onSubmit={handleSubmit} className="candidate-form">
          <div className="form-sections">
            {/* Personal Information Section */}
            <div className="form-section">
              <h3 className="section-title">👤 Informations Personnelles</h3>
              <div className="form-row">
                <div
                  className={`form-field ${isFieldError("Nom", formData.Nom) ? "error" : ""}`}
                >
                  <label htmlFor="Nom" className="field-label">
                    Nom <span className="required">*</span>
                  </label>
                  <input
                    type="text"
                    id="Nom"
                    name="Nom"
                    value={formData.Nom}
                    onChange={handleChange}
                    onBlur={handleBlur}
                    className="field-input"
                    placeholder="Votre nom de famille"
                  />
                  {isFieldError("Nom", formData.Nom) && (
                    <span className="error-text">Ce champ est obligatoire</span>
                  )}
                </div>

                <div
                  className={`form-field ${isFieldError("Prénom", formData.Prénom) ? "error" : ""}`}
                >
                  <label htmlFor="Prénom" className="field-label">
                    Prénom <span className="required">*</span>
                  </label>
                  <input
                    type="text"
                    id="Prénom"
                    name="Prénom"
                    value={formData.Prénom}
                    onChange={handleChange}
                    onBlur={handleBlur}
                    className="field-input"
                    placeholder="Votre prénom"
                  />
                  {isFieldError("Prénom", formData.Prénom) && (
                    <span className="error-text">Ce champ est obligatoire</span>
                  )}
                </div>
              </div>

              <div className="form-row">
                <div
                  className={`form-field ${isFieldError("Date de naissance", formData["Date de naissance"]) ? "error" : ""}`}
                >
                  <label htmlFor="Date de naissance" className="field-label">
                    Date de naissance <span className="required">*</span>
                  </label>
                  <input
                    type="date"
                    id="Date de naissance"
                    name="Date de naissance"
                    value={formData["Date de naissance"]}
                    onChange={handleChange}
                    onBlur={handleBlur}
                    className="field-input"
                  />
                  {isFieldError(
                    "Date de naissance",
                    formData["Date de naissance"],
                  ) && (
                    <span className="error-text">Ce champ est obligatoire</span>
                  )}
                </div>

                <div
                  className={`form-field ${isFieldError("Adress Actuel", formData["Adress Actuel"]) ? "error" : ""}`}
                >
                  <label htmlFor="Adress Actuel" className="field-label">
                    Adresse Actuelle <span className="required">*</span>
                  </label>
                  <input
                    type="text"
                    id="Adress Actuel"
                    name="Adress Actuel"
                    value={formData["Adress Actuel"]}
                    onChange={handleChange}
                    onBlur={handleBlur}
                    className="field-input"
                    placeholder="Votre adresse complète"
                  />
                  {isFieldError("Adress Actuel", formData["Adress Actuel"]) && (
                    <span className="error-text">Ce champ est obligatoire</span>
                  )}
                </div>
              </div>

              <div className="form-row">
                <div
                  className={`form-field ${isFieldError("situationFamiliale", formData.situationFamiliale) ? "error" : ""}`}
                >
                  <label htmlFor="situationFamiliale" className="field-label">
                    Situation Familiale <span className="required">*</span>
                  </label>
                  <div className="custom-select-wrapper">
                    <select
                      id="situationFamiliale"
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
                  {isFieldError(
                    "situationFamiliale",
                    formData.situationFamiliale,
                  ) && (
                    <span className="error-text">Ce champ est obligatoire</span>
                  )}
                </div>

                {formData.situationFamiliale &&
                  formData.situationFamiliale !== "célibataire" && (
                    <div
                      className={`form-field ${isFieldError("nbEnfants", formData.nbEnfants) ? "error" : ""}`}
                    >
                      <label htmlFor="nbEnfants" className="field-label">
                        Nombre d'enfants <span className="required">*</span>
                      </label>
                      <input
                        type="text"
                        id="nbEnfants"
                        name="nbEnfants"
                        value={formData.nbEnfants}
                        onChange={handleChange}
                        onBlur={handleBlur}
                        className="field-input"
                        placeholder="Nombre d'enfants"
                      />
                      {isFieldError("nbEnfants", formData.nbEnfants) && (
                        <span className="error-text">
                          Ce champ est obligatoire
                        </span>
                      )}
                    </div>
                  )}
              </div>
            </div>

            {/* Professional Information Section */}
            <div className="form-section">
              <h3 className="section-title">
                💼 Informations Professionnelles
              </h3>
              <div className="form-row">
                <div
                  className={`form-field ${isFieldError("Post Actuel", formData["Post Actuel"]) ? "error" : ""}`}
                >
                  <label htmlFor="Post Actuel" className="field-label">
                    Poste Actuel <span className="required">*</span>
                  </label>
                  <input
                    type="text"
                    id="Post Actuel"
                    name="Post Actuel"
                    value={formData["Post Actuel"]}
                    onChange={handleChange}
                    onBlur={handleBlur}
                    className="field-input"
                    placeholder="Votre poste actuel"
                  />
                  {isFieldError("Post Actuel", formData["Post Actuel"]) && (
                    <span className="error-text">Ce champ est obligatoire</span>
                  )}
                </div>

                <div
                  className={`form-field ${isFieldError("Société", formData.Société) ? "error" : ""}`}
                >
                  <label htmlFor="Société" className="field-label">
                    Société <span className="required">*</span>
                  </label>
                  <input
                    type="text"
                    id="Société"
                    name="Société"
                    value={formData.Société}
                    onChange={handleChange}
                    onBlur={handleBlur}
                    className="field-input"
                    placeholder="Nom de votre société"
                  />
                  {isFieldError("Société", formData.Société) && (
                    <span className="error-text">Ce champ est obligatoire</span>
                  )}
                </div>
              </div>

              <div className="form-row">
                <div
                  className={`form-field ${isFieldError("Date d'embauche", formData["Date d'embauche"]) ? "error" : ""}`}
                >
                  <label htmlFor="Date d'embauche" className="field-label">
                    Date d'embauche <span className="required">*</span>
                  </label>
                  <input
                    type="date"
                    id="Date d'embauche"
                    name="Date d'embauche"
                    value={formData["Date d'embauche"]}
                    onChange={handleChange}
                    onBlur={handleBlur}
                    className="field-input"
                  />
                  {isFieldError(
                    "Date d'embauche",
                    formData["Date d'embauche"],
                  ) && (
                    <span className="error-text">Ce champ est obligatoire</span>
                  )}
                </div>

                <div
                  className={`form-field ${isFieldError("Salaire net Actuel", formData["Salaire net Actuel"]) ? "error" : ""}`}
                >
                  <label htmlFor="Salaire net Actuel" className="field-label">
                    Salaire net Actuel <span className="required">*</span>
                  </label>
                  <input
                    type="text"
                    id="Salaire net Actuel"
                    name="Salaire net Actuel"
                    value={formData["Salaire net Actuel"]}
                    onChange={handleChange}
                    onBlur={handleBlur}
                    className="field-input"
                    placeholder="Ex: 5000 DH"
                  />
                  {isFieldError(
                    "Salaire net Actuel",
                    formData["Salaire net Actuel"],
                  ) && (
                    <span className="error-text">Ce champ est obligatoire</span>
                  )}
                </div>
              </div>

              <div className="form-row">
                <div
                  className={`form-field ${isFieldError("pourquoiChanger", formData.pourquoiChanger) ? "error" : ""}`}
                >
                  <label htmlFor="pourquoiChanger" className="field-label">
                    Pourquoi voulez-vous changer votre poste actuel?{" "}
                    <span className="required">*</span>
                  </label>
                  <textarea
                    id="pourquoiChanger"
                    name="pourquoiChanger"
                    value={formData.pourquoiChanger}
                    onChange={handleChange}
                    onBlur={handleBlur}
                    className="field-input field-textarea"
                    placeholder="Vos motivations pour ce changement"
                    rows="3"
                    style={{
                      width: "100%",
                      borderRadius: "8px",
                      border: "1px solid #e2e8f0",
                      padding: "10px 15px",
                    }}
                  ></textarea>
                  {isFieldError(
                    "pourquoiChanger",
                    formData.pourquoiChanger,
                  ) && (
                    <span className="error-text">Ce champ est obligatoire</span>
                  )}
                </div>
              </div>

              <div className="form-row">
                <div
                  className={`form-field ${isFieldError("dureePreavis", formData.dureePreavis) ? "error" : ""}`}
                >
                  <label htmlFor="dureePreavis" className="field-label">
                    Durée du Préavis <span className="required">*</span>
                  </label>
                  <input
                    type="text"
                    id="dureePreavis"
                    name="dureePreavis"
                    value={formData.dureePreavis}
                    onChange={handleChange}
                    onBlur={handleBlur}
                    className="field-input"
                    placeholder="Ex: 1 mois, 3 mois..."
                  />
                  {isFieldError("dureePreavis", formData.dureePreavis) && (
                    <span className="error-text">Ce champ est obligatoire</span>
                  )}
                </div>

                <div
                  className={`form-field ${isFieldError("fonctionsMissions", formData.fonctionsMissions) ? "error" : ""}`}
                >
                  <label htmlFor="fonctionsMissions" className="field-label">
                    Fonctions et Missions <span className="required">*</span>
                  </label>
                  <textarea
                    id="fonctionsMissions"
                    name="fonctionsMissions"
                    value={formData.fonctionsMissions}
                    onChange={handleChange}
                    onBlur={handleBlur}
                    className="field-input field-textarea"
                    placeholder="Description de vos missions actuelles"
                    rows="3"
                    style={{
                      width: "100%",
                      borderRadius: "8px",
                      border: "1px solid #e2e8f0",
                      padding: "10px 15px",
                    }}
                  ></textarea>
                  {isFieldError(
                    "fonctionsMissions",
                    formData.fonctionsMissions,
                  ) && (
                    <span className="error-text">Ce champ est obligatoire</span>
                  )}
                </div>
              </div>
            </div>

            <div className="form-section">
              <h3 className="section-title">🎓 Études</h3>
              <div className="form-row">
                <div
                  className={`form-field ${isFieldError("Votre dernier diplome", formData["Votre dernier diplome"]) ? "error" : ""}`}
                >
                  <label
                    htmlFor="Votre dernier diplome"
                    className="field-label"
                  >
                    Votre dernier diplôme <span className="required">*</span>
                  </label>
                  <input
                    type="text"
                    id="Votre dernier diplome"
                    name="Votre dernier diplome"
                    value={formData["Votre dernier diplome"]}
                    onChange={handleChange}
                    onBlur={handleBlur}
                    className="field-input"
                    placeholder="Ex: Licence, Master..."
                  />
                  {isFieldError(
                    "Votre dernier diplome",
                    formData["Votre dernier diplome"],
                  ) && (
                    <span className="error-text">Ce champ est obligatoire</span>
                  )}
                </div>

                <div
                  className={`form-field ${isFieldError("ecole", formData.ecole) ? "error" : ""}`}
                >
                  <label htmlFor="ecole" className="field-label">
                    École / Université <span className="required">*</span>
                  </label>
                  <input
                    type="text"
                    id="ecole"
                    name="ecole"
                    value={formData.ecole}
                    onChange={handleChange}
                    onBlur={handleBlur}
                    className="field-input"
                    placeholder="Nom de l'établissement"
                  />
                  {isFieldError("ecole", formData.ecole) && (
                    <span className="error-text">Ce champ est obligatoire</span>
                  )}
                </div>
              </div>

              <div className="form-row">
                <div
                  className={`form-field ${isFieldError("anneeDiplome", formData.anneeDiplome) ? "error" : ""}`}
                >
                  <label htmlFor="anneeDiplome" className="field-label">
                    Année d'obtention <span className="required">*</span>
                  </label>
                  <input
                    type="text"
                    id="anneeDiplome"
                    name="anneeDiplome"
                    value={formData.anneeDiplome}
                    onChange={handleChange}
                    onBlur={handleBlur}
                    className="field-input"
                    placeholder="Ex: 2020"
                  />
                  {isFieldError("anneeDiplome", formData.anneeDiplome) && (
                    <span className="error-text">Ce champ est obligatoire</span>
                  )}
                </div>
              </div>
            </div>

            {/* Motivation Section */}
            <div className="form-section">
              <h3 className="section-title">
                💡 Motivation & Infos Complémentaires
              </h3>
              <div className="form-row">
                <div
                  className={`form-field ${isFieldError("posteSedentaire", formData.posteSedentaire) ? "error" : ""}`}
                >
                  <label htmlFor="posteSedentaire" className="field-label">
                    Vous pouvez travailler dans un poste sédentaire en plein
                    temps? <span className="required">*</span>
                  </label>
                  <div className="custom-select-wrapper">
                    <select
                      id="posteSedentaire"
                      name="posteSedentaire"
                      value={formData.posteSedentaire}
                      onChange={handleChange}
                      onBlur={handleBlur}
                      className="field-select"
                    >
                      <option value="">Sélectionner</option>
                      <option value="Oui">Oui</option>
                      <option value="Non">Non</option>
                    </select>
                  </div>
                  {isFieldError(
                    "posteSedentaire",
                    formData.posteSedentaire,
                  ) && (
                    <span className="error-text">Ce champ est obligatoire</span>
                  )}
                </div>
              </div>

              <div className="form-row">
                <div
                  className={`form-field ${isFieldError("missionsMaitrisees", formData.missionsMaitrisees) ? "error" : ""}`}
                  style={{ flex: "1 1 100%" }}
                >
                  <label htmlFor="missionsMaitrisees" className="field-label">
                    Quelles sont les missions que vous maitrisez pour votre
                    intégration immédiate? <span className="required">*</span>
                  </label>
                  <textarea
                    id="missionsMaitrisees"
                    name="missionsMaitrisees"
                    value={formData.missionsMaitrisees}
                    onChange={handleChange}
                    onBlur={handleBlur}
                    className="field-input field-textarea"
                    placeholder="Vos points forts techniques"
                    rows="3"
                    style={{
                      width: "100%",
                      borderRadius: "8px",
                      border: "1px solid #e2e8f0",
                      padding: "10px 15px",
                    }}
                  ></textarea>
                  {isFieldError(
                    "missionsMaitrisees",
                    formData.missionsMaitrisees,
                  ) && (
                    <span className="error-text">Ce champ est obligatoire</span>
                  )}
                </div>
              </div>

              <div className="form-row">
                <div
                  className={`form-field ${isFieldError("travailSeulEquipe", formData.travailSeulEquipe) ? "error" : ""}`}
                  style={{ flex: "1 1 100%" }}
                >
                  <label htmlFor="travailSeulEquipe" className="field-label">
                    Préférez-vous travailler seul ou en équipe? Pourquoi?{" "}
                    <span className="required">*</span>
                  </label>
                  <textarea
                    id="travailSeulEquipe"
                    name="travailSeulEquipe"
                    value={formData.travailSeulEquipe}
                    onChange={handleChange}
                    onBlur={handleBlur}
                    className="field-input field-textarea"
                    placeholder="Votre préférence de travail"
                    rows="3"
                    style={{
                      width: "100%",
                      borderRadius: "8px",
                      border: "1px solid #e2e8f0",
                      padding: "10px 15px",
                    }}
                  ></textarea>
                  {isFieldError(
                    "travailSeulEquipe",
                    formData.travailSeulEquipe,
                  ) && (
                    <span className="error-text">Ce champ est obligatoire</span>
                  )}
                </div>
              </div>

              <div className="form-row">
                <div
                  className={`form-field ${isFieldError("zoneSapino", formData.zoneSapino) ? "error" : ""}`}
                >
                  <label htmlFor="zoneSapino" className="field-label">
                    Acceptez-vous de travailler à la zone Sapino (Nouaceur)?{" "}
                    <span className="required">*</span>
                  </label>
                  <div className="custom-select-wrapper">
                    <select
                      id="zoneSapino"
                      name="zoneSapino"
                      value={formData.zoneSapino}
                      onChange={handleChange}
                      onBlur={handleBlur}
                      className="field-select"
                    >
                      <option value="">Sélectionner</option>
                      <option value="Oui">Oui</option>
                      <option value="Non">Non</option>
                    </select>
                  </div>
                  {isFieldError("zoneSapino", formData.zoneSapino) && (
                    <span className="error-text">Ce champ est obligatoire</span>
                  )}
                </div>

                <div
                  className={`form-field ${isFieldError("motorise", formData.motorise) ? "error" : ""}`}
                >
                  <label htmlFor="motorise" className="field-label">
                    Êtes-vous motorisé(e)? <span className="required">*</span>
                  </label>
                  <div className="custom-select-wrapper">
                    <select
                      id="motorise"
                      name="motorise"
                      value={formData.motorise}
                      onChange={handleChange}
                      onBlur={handleBlur}
                      className="field-select"
                    >
                      <option value="">Sélectionner</option>
                      <option value="Oui">Oui</option>
                      <option value="Non">Non</option>
                    </select>
                  </div>
                  {isFieldError("motorise", formData.motorise) && (
                    <span className="error-text">Ce champ est obligatoire</span>
                  )}
                </div>
              </div>

              <div className="form-row">
                <div
                  className={`form-field ${isFieldError("pretentionsSalariales", formData.pretentionsSalariales) ? "error" : ""}`}
                >
                  <label
                    htmlFor="pretentionsSalariales"
                    className="field-label"
                  >
                    Vos prétentions salariales{" "}
                    <span className="required">*</span>
                  </label>
                  <input
                    type="text"
                    id="pretentionsSalariales"
                    name="pretentionsSalariales"
                    value={formData.pretentionsSalariales}
                    onChange={handleChange}
                    onBlur={handleBlur}
                    className="field-input"
                    placeholder="Ex: 8000 DH"
                  />
                  {isFieldError(
                    "pretentionsSalariales",
                    formData.pretentionsSalariales,
                  ) && (
                    <span className="error-text">Ce champ est obligatoire</span>
                  )}
                </div>
              </div>

              <div className="form-row">
                <div className="form-field" style={{ flex: "1 1 100%" }}>
                  <label htmlFor="questionsRemarques" className="field-label">
                    Vos questions et remarques
                  </label>
                  <textarea
                    id="questionsRemarques"
                    name="questionsRemarques"
                    value={formData.questionsRemarques}
                    onChange={handleChange}
                    onBlur={handleBlur}
                    className="field-input field-textarea"
                    placeholder="Tout autre information utile"
                    rows="3"
                    style={{
                      width: "100%",
                      borderRadius: "8px",
                      border: "1px solid #e2e8f0",
                      padding: "10px 15px",
                    }}
                  ></textarea>
                </div>
              </div>
            </div>

            {/* English Level Section */}
            <div className="form-section">
              <h3 className="section-title">🌐 Niveau d'Anglais Technique</h3>
              <div className="english-level-grid">
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

            {/* CV Upload Section */}
            <div className="form-section">
              <h3 className="section-title">📄 Télécharger votre CV</h3>
              <div
                className={`cv-upload-field ${!cvFile && !formData.originalCvMinioPath ? "required-empty" : ""}`}
              >
                <label className="cv-label">
                  CV (format PDF) <span className="required">*</span>
                </label>
                <div className="cv-upload-wrapper">
                  <input
                    type="file"
                    id="cvFile"
                    name="cvFile"
                    accept=".pdf"
                    onChange={handleFileChange}
                    className="hidden-file-input"
                  />
                  <button
                    type="button"
                    className="cv-upload-btn"
                    onClick={() => document.getElementById("cvFile").click()}
                  >
                    📎 {cvFile ? "Changer le CV" : "Choisir un fichier"}
                  </button>
                  <span className="cv-file-name">
                    {cvFile
                      ? cvFile.name
                      : formData.originalCvMinioPath
                        ? "CV déjà uploadé"
                        : "Aucun fichier sélectionné"}
                  </span>
                </div>
                {!cvFile && !formData.originalCvMinioPath && (
                  <span className="error-text">
                    Veuillez télécharger votre CV
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="form-submit-section">
            <button
              type="submit"
              className="submit-form-btn"
              disabled={loading}
            >
              {loading ? (
                <>
                  <span className="btn-spinner"></span>
                  Soumission en cours...
                </>
              ) : (
                <>✅ Soumettre mon Profil</>
              )}
            </button>
            <p className="required-note">
              <span className="required">*</span> Tous les champs sont
              obligatoires
            </p>
          </div>
        </form>
      </div>
    </div>
  );
};

export default Etape_2_Form;
