import MarketingForm1 from "./MarketingForm1";
import RespTechniqueForm1 from "./RespTechniqueForm1";
import ChargeEtudesForm1 from "./ChargeEtudesForm1";
import FrontOfficeForm1 from "./FrontOfficeForm1";
import AnglaisForm1 from "./AnglaisForm1";
import LogistiqueForm1 from "./LogistiqueForm1";
import DevLaravelForm1 from "./DevLaravelForm1";
import RHForm1 from "./RHForm1";
import CTForm1 from "./CTForm1";
import InfographisteForm1 from "./InfographisteForm1";
import AideComptableForm1 from "./AideComptableForm1";
import ChargeFacturationForm1 from "./ChargeFacturationForm1";
import ElectricienForm1 from "./ElectricienForm1";

export const FORM1_QUESTIONNAIRE_SERVICES = [
  "Marketing",
  "RespTechnique",
  "ChargeEtudes",
  "FrontOffice",
  "Anglais",
  "Logistique",
  "DevLaravel",
  "RH",
  "C.T",
  "Infographiste",
  "Aide Comptable",
  "Charge Facturation",
  "Electricien",
];

const FORM1_CONFIG_BY_SERVICE = {
  Marketing: MarketingForm1,
  RespTechnique: RespTechniqueForm1,
  ChargeEtudes: ChargeEtudesForm1,
  FrontOffice: FrontOfficeForm1,
  Anglais: AnglaisForm1,
  Logistique: LogistiqueForm1,
  DevLaravel: DevLaravelForm1,
  RH: RHForm1,
  "C.T": CTForm1,
  Infographiste: InfographisteForm1,
  "Aide Comptable": AideComptableForm1,
  "Charge Facturation": ChargeFacturationForm1,
  Electricien: ElectricienForm1,
};

function normalizeServiceLookupKey(service) {
  return String(service || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "");
}

const SERVICE_ALIASES = {
  marketing: "Marketing",
  resptechnique: "RespTechnique",
  chargeetudes: "ChargeEtudes",
  chargesetudes: "ChargeEtudes",
  commercial: "ChargeEtudes",
  relance: "ChargeEtudes",
  envoie: "ChargeEtudes",
  harmonosation: "ChargeEtudes",
  harmonisation: "ChargeEtudes",
  commande: "ChargeEtudes",
  ao: "ChargeEtudes",
  sourcing: "ChargeEtudes",
  emailing: "ChargeEtudes",
  frontoffice: "FrontOffice",
  anglais: "Anglais",
  logistique: "Logistique",
  devlaravel: "DevLaravel",
  info: "DevLaravel",
  rh: "RH",
  ct: "C.T",
  ctservice: "C.T",
  infographiste: "Infographiste",
  aidecomptable: "Aide Comptable",
  chargefacturation: "Charge Facturation",
  facturation: "Charge Facturation",
  electricien: "Electricien",
};

export function normalizeForm1ServiceName(service) {
  const raw = String(service || "").trim();
  if (FORM1_CONFIG_BY_SERVICE[raw]) return raw;
  const normalized = normalizeServiceLookupKey(raw);
  return SERVICE_ALIASES[normalized] || raw;
}

export function getForm1QuestionnaireConfig(service) {
  const normalized = normalizeForm1ServiceName(service);
  return FORM1_CONFIG_BY_SERVICE[normalized] || FrontOfficeForm1;
}
