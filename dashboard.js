/* OMW LabRepair v2.0 — Dashboard (Fluent / Power BI stil, ALS-blå) */

function dateKey(v) {
  if (!v) return "";
  const d = new Date(v);
  return isNaN(d) ? String(v).slice(0, 10) : d.toISOString().slice(0, 10);
}
function monthOf(v) {
  if (!v) return "Ukendt";
  const d = new Date(v);
  return isNaN(d) ? String(v).slice(0, 7) : d.toISOString().slice(0, 7);
}
function monthLabel(key) {
  if (!key || key === "Ukendt") return "Ukendt";
  const [y, m] = key.split("-");
  const names = ["Jan", "Feb", "Mar", "Apr", "Maj", "Jun", "Jul", "Aug", "Sep", "Okt", "Nov", "Dec"];
  return `${names[Number(m) - 1] || m} ${y}`;
}
function monthlyCounts(rows) {
  const map = {};
  rows.forEach(r => { const k = monthOf(r.created_at); map[k] = (map[k] || 0) + 1; });
  return Object.keys(map).sort().slice(-12).map(k => ({ key: k, label: monthLabel(k), total: map[k] }));
}
function countTop(rows, key, limit = 5) {
  const counts = {};
  rows.forEach(r => { const v = r[key] || "Ukendt"; counts[v] = (counts[v] || 0) + 1; });
  return Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, limit);
}
function fmtDuration(ms) {
  if (!isFinite(ms) || ms <= 0) return "—";
  const mins = Math.round(ms / 60000);
  if (mins < 60) return `${mins} min`;
  const h = Math.floor(mins / 60);
  if (h < 48) return `${h} t ${mins % 60} min`;
  return `${Math.round(h / 24)} dage`;
}
function avgHandlingTime(rows) {
  const done = rows.filter(r => r.created_at && r.archive_date);
  if (!done.length) return "—";
  const total = done.reduce((s, r) => s + (new Date(r.archive_date) - new Date(r.created_at)), 0);
  return fmtDuration(total / done.length);
}
function estimatedLabelCount(rows) {
  return labelItemsFromRows(rows.filter(r => r.printed)).length;
}

function kpiCard(title, value, sub, accent = "") {
  return `<div class="fl-card kpi ${accent}"><div class="kpi-title">${title}</div><div class="kpi-value">${value}</div><div class="kpi-sub">${sub}</div></div>`;
}
function barList(arr, cls = "") {
  if (!arr.length) return "<p class='subtitle'>Ingen data</p>";
  const max = Math.max(1, ...arr.map(x => x[1]));
  return `<div class="bar-list ${cls}">${arr.map(([k, v]) => `
    <div class="bar-row">
      <div class="bar-label" title="${escapeHtml(k)}">${escapeHtml(k)}</div>
      <div class="bar-track"><span style="width:${Math.max(3, Math.round(v / max * 100))}%"></span></div>
      <div class="bar-num">${v}</div>
    </div>`).join("")}</div>`;
}

function dashboardView() {
  const rows = state.rows || [];
  const active = activeRows();
  const archived = rows.filter(r => (r.status || "ny") === "arkiv");
  const todayKey = today();
  const archivedToday = archived.filter(r => dateKey(r.archive_date) === todayKey);
  const urgentActive = active.filter(r => r.urgent);
  const notUrgentActive = active.filter(r => !r.urgent);

  const months = monthlyCounts(rows);
  const topAnalyses = countTop(rows.filter(r => r.analysis), "analysis", 8);
  const topReasons = countTop(rows.filter(r => r.reason), "reason", 6);
  const byLab = countTop(rows.filter(r => r.lab && r.lab !== "Send til"), "lab", 8);
  const stats = getPrintStats();

  const monthChart = months.length ? barList(months.map(m => [m.label, m.total])) : "<p class='subtitle'>Ingen data</p>";

  return `${header("Dashboard", "Overblik over reparationer og Send til · opdateres i realtid.")}
  <div class="kpi-grid">
    ${kpiCard("Aktive opgaver", active.length, "afventer afvejning", "accent")}
    ${kpiCard("Arkiveret i dag", archivedToday.length, todayKey)}
    ${kpiCard("Haster", urgentActive.length, "aktive prioriteter", urgentActive.length ? "warn" : "")}
    ${kpiCard("Ikke haster", notUrgentActive.length, "aktive opgaver")}
    ${kpiCard("Gns. behandlingstid", avgHandlingTime(archived), "oprettet → arkiveret")}
    ${kpiCard("Etiketter printet", stats.labels, "denne station")}
    ${kpiCard("A4-udskrifter", stats.a4, "denne station")}
    ${kpiCard("Etiketter i alt", estimatedLabelCount(rows), "beregnet ud fra data")}
  </div>
  <div class="dash-grid">
    <div class="fl-card span2"><h3>Opgaver pr. måned</h3>${monthChart}</div>
    <div class="fl-card"><h3>Pr. laboratorium</h3>${barList(byLab)}</div>
    <div class="fl-card"><h3>Top analyser</h3>${barList(topAnalyses)}</div>
    <div class="fl-card"><h3>Top årsager</h3>${barList(topReasons)}</div>
    <div class="fl-card"><h3>Fordeling</h3>${barList([
      ["Reparationer", rows.filter(r => r.request_type === "reparation").length],
      ["Send til", rows.filter(r => r.request_type === "send_til").length],
      ["Jord", rows.filter(r => r.sample_type === "jord").length],
      ["Materialer", rows.filter(r => r.sample_type === "materialer").length],
      ["Arkiveret", archived.length]
    ])}</div>
  </div>`;
}
