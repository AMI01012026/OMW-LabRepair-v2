/* OMW LabRepair v2.0 — reference data (šifrarnici) */
const APP_VERSION = "2.3.0";

const LABS = ["Lab A", "Lab C", "Lab D", "Lab LC"];

const TYPES = [["jord", "Jord"], ["materialer", "Materialer"]];

const DESTINATIONS = ["Prag", "Luleå", "GBA", "Andet"];

const WORKSTATIONS = [
  ["lab", "Lab"],
  ["afvjord", "Afvejning Jord"],
  ["afvmat", "Afvejning Materialer"]
];

/* Deduped list. "TK" removed on purpose — keep "TotalKulB". */
const ANALYSES = (() => {
  const raw = ["TS","TOC","PAH","PFAS","PCB","ICP","Kulbrinter","Phtalater","Florisil",
    "HydrocarbonerNorge","Styren","Alifater","Btex","Chlorbenzener","Pah materiele",
    "Pah sediment","Pah 17","Polære","DCM","MTBE","Pesticider","Phenol og Creosoter",
    "PCB i jord","Freon","Glyphosat/AMPA","Flygtige syrer","Chlorparaffiner fuge",
    "PCB fuge","Acrylamid og Glycoler","Grindstedpakken","N-methyl-2pyrrolidon",
    "Aldehyd (Formaldehyd)","PFAS i Jord og materiale (DK)","Tørstof",
    "Glødetab (se tørstof)","HG","ICP slam","Metaller","ICP + HG","Antimon",
    "Total N i løv","Total N i jord og slam","Chrom VI jord til tørring 40°C",
    "Chrom ISO","TOC – vådt (Norge)","TOC – tørt (Dk)","Cyanid",
    "Chlorid, vandopløselig","Sulfat, vandopløselig","Fluorid, vandopløselig",
    "Fosfortal","Ledningsevne","pH/reaktionstal","pH i Jord","Udvaskningstest",
    "Baumann Gully","Basemætning","BD-ekstraktion","Pyrit","Citrat opløselig fosfor",
    "TotalKulB","TPH"];
  const seen = new Set(), out = [];
  raw.forEach(a => {
    if (a === "TK") return;
    const k = a.toLowerCase();
    if (!seen.has(k)) { seen.add(k); out.push(a); }
  });
  return out;
})();

const DETERMINATIONS = ["2", "3", "2+3", "3+4", "4+5", "5+6"];

const REASONS = ["High resultat","Low resultat","Høj Terbium","Afvigelse QC",
  "Mistanke om pipettering","Mistanke om homogenisering","Instrument check",
  "Matrix/interferens","Efterbestilling","Ukendt"];

const ADMIN_PASSWORD = "Andreja2026!OMW";
