function printRows(rows, title, options = {}) {
  if (!rows.length) return toast("Ingen rækker til print.");
  const area = document.getElementById("printArea");
  const repairs = rows.filter(r => r.request_type === "reparation");
  const sends = rows.filter(r => r.request_type === "send_til");

  const section = (heading, sectionRows, mode) => {
    if (!sectionRows.length) return "";
    if (mode === "send") {
      return `<h3>${escapeHtml(heading)}</h3>
      <table class="print-table">
        <thead><tr><th>Prøve</th><th>Kasse</th><th>Send til</th><th>Gram</th><th>Initialer</th><th>1. vejedato</th></tr></thead>
        <tbody>${sectionRows.map(r => `<tr><td><b>${escapeHtml(r.sample || "")}</b></td><td>${escapeHtml(r.box || "")}</td><td>${escapeHtml(r.destination || "")}</td><td>${r.grams ? escapeHtml(r.grams) + " g" : ""}</td><td>${escapeHtml(r.initials || "")}</td><td>${escapeHtml(r.first_weighing || "")}</td></tr>`).join("")}</tbody>
      </table>`;
    }
    return `<h3>${escapeHtml(heading)}</h3>
    <table class="print-table">
      <thead><tr><th>Prøve</th><th>Kasse</th><th>Analyse</th><th>Bestems</th><th>Årsag</th><th>Kommentar</th><th>Initialer</th><th>1. vejedato</th><th>Haster</th></tr></thead>
      <tbody>${sectionRows.map(r => `<tr><td><b>${escapeHtml(r.sample || "")}</b></td><td>${escapeHtml(r.box || "")}</td><td>${escapeHtml(r.analysis || "")}</td><td>${escapeHtml(r.determinations || "")}</td><td>${escapeHtml(r.reason || "")}</td><td>${escapeHtml(r.comment || "")}</td><td>${escapeHtml(r.initials || "")}</td><td>${escapeHtml(r.first_weighing || "")}</td><td>${r.urgent ? "JA" : ""}</td></tr>`).join("")}</tbody>
    </table>`;
  };

  area.innerHTML = `<div class="print-page"><h2>${escapeHtml(title)}</h2><p>Antal: ${rows.length} · Udskrevet: ${new Date().toLocaleString("da-DK")}</p>${section("Reparationer", repairs, "repair")}${section("Send til", sends, "send")}</div>`;
  area.style.display = "block";
  setTimeout(() => { window.print(); setTimeout(() => area.style.display = "none", 500); }, 100);
}

function parseDeterminations(value) {
  const raw = String(value || "").trim();
  if (!raw) return [""];
  return raw.split(/[+,; ]+/).map(x => x.trim()).filter(Boolean);
}

function buildLabels(rows) {
  const labels = [];
  rows.filter(r => r.request_type === "reparation").forEach(r => {
    parseDeterminations(r.determinations).forEach(det => {
      labels.push({ line1: det ? `${r.sample}-${det}` : `${r.sample}`, line2: r.analysis || "" });
    });
  });
  return labels;
}

function printLabels(rows, title = "Etiketter") {
  const labels = buildLabels(rows);
  if (!labels.length) return toast("Ingen etiketter til print.");
  const area = document.getElementById("printArea");
  area.innerHTML = `<div class="label-page"><h2>${escapeHtml(title)}</h2><div class="labels">${labels.map(l => `<div class="label"><div class="label-sample">${escapeHtml(l.line1)}</div><div class="label-analysis">${escapeHtml(l.line2)}</div></div>`).join("")}</div></div>`;
  area.style.display = "block";
  setTimeout(() => { window.print(); setTimeout(() => area.style.display = "none", 500); }, 100);
}
