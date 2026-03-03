const SERVICES_STORAGE_KEY = "questionnaire_services_list";

const DEFAULT_SERVICES = [
  "Commercial",
  "RH",
  "Facturation",
  "Relance",
  "En Voie",
  "Harmonisation",
  "Commande",
  "Logistique",
  "Front clOffice",
  "Emailing",
  "AO",
  "Sourcing",
  "Info",
  "Marketing",
  "RespTechnique",
  "ChargeEtudes",
  "Anglais",
  "DevLaravel",
  "Infographiste",
  "Aide Comptable",
  "C.T",
  "Eléctricien",
];

function normalizeServiceName(value) {
  return String(value || "").trim();
}

function dedupeServices(values) {
  const seen = new Set();
  return values.filter((item) => {
    const normalized = normalizeServiceName(item);
    if (!normalized) return false;
    const key = normalized.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function getDefaultServices() {
  return [...DEFAULT_SERVICES];
}

export function loadServicesFromStorage() {
  if (typeof window === "undefined") return getDefaultServices();
  try {
    const raw = window.localStorage.getItem(SERVICES_STORAGE_KEY);
    if (!raw) return getDefaultServices();
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return getDefaultServices();
    const merged = dedupeServices([...DEFAULT_SERVICES, ...parsed]);
    return merged.length ? merged : getDefaultServices();
  } catch {
    return getDefaultServices();
  }
}

export function saveServicesToStorage(services) {
  const cleaned = dedupeServices(Array.isArray(services) ? services : []);
  if (typeof window !== "undefined") {
    window.localStorage.setItem(SERVICES_STORAGE_KEY, JSON.stringify(cleaned));
  }
  return cleaned;
}
