/* OMW LabRepair v2.0 — hovedapplikation (views, state, realtime) */

let state = {
  view: "welcome",
  lab: "Lab A",
  sampleType: "jord",
  destination: DESTINATIONS[0],
  rows: [],
  error: "",
  connected: false,
  labRowCount: 5,
  sendRowCount: 5,
  labDraft: [],
  sendDraft: [],
  archiveSearch: "",
  loggedIn: false
};

let _knownIds = null;   // til polling-fallback: opdag nye rækker uden realtime
let _muteUntil = 0;     // undertryk notifikationslyd for egne netop indsendte rækker
let _writing = false;   // dobbeltklik-vagt: forhindrer dobbelt-insert/-arkivering

async function guardedWrite(fn) {
  if (_writing) return;
  _writing = true;
  document.body.classList.add("busy");
  try { await fn(); }
  finally { _writing = false; document.body.classList.remove("busy"); }
}

/* Kladder gemmes løbende i localStorage, så et uheldigt refresh/luk
   ikke sletter det, brugeren har tastet (data-tab beskyttelse). */
const DRAFTS_KEY = "omw_drafts_v1";
function saveDrafts() {
  try {
    localStorage.setItem(DRAFTS_KEY, JSON.stringify({
      lab: state.labDraft.slice(0, state.labRowCount),
      send: state.sendDraft.slice(0, state.sendRowCount)
    }));
  } catch {}
}
function loadDrafts() {
  try {
    const d = JSON.parse(localStorage.getItem(DRAFTS_KEY) || "null");
    if (!d) return;
    if (Array.isArray(d.lab) && d.lab.length) { state.labDraft = d.lab; state.labRowCount = Math.max(5, d.lab.length); }
    if (Array.isArray(d.send) && d.send.length) { state.sendDraft = d.send; state.sendRowCount = Math.max(5, d.send.length); }
  } catch {}
}
function clearDrafts(kind) {
  if (kind === "lab") { state.labDraft = []; state.labRowCount = 5; }
  else { state.sendDraft = []; state.sendRowCount = 5; }
  ensureDrafts();
  saveDrafts();
}

document.addEventListener("DOMContentLoaded", async () => {
  loadDrafts();
  ensureDrafts();
  state.connected = initSupabase();
  state.view = "welcome"; // initialer bekræftes ved hver opstart
  render();
  if (state.connected) {
    await refresh(false, false);
    _knownIds = new Set(state.rows.map(r => r.id));
    subscribeRealtime(onRealtimeEvent);
  }
  // Polling som fallback (realtime kan være slået fra på tabellen)
  setInterval(async () => {
    if (!state.connected || isFormView()) return;
    const before = _knownIds;
    await refresh(false, !isFormView());
    detectNewRows(before);
  }, 30000);
});

function detectNewRows(beforeSet) {
  const now = new Set(state.rows.map(r => r.id));
  let fresh = 0;
  if (beforeSet) now.forEach(id => { if (!beforeSet.has(id)) fresh++; });
  _knownIds = now;
  if (!state.loggedIn) return;
  const external = fresh > 0 && Date.now() > _muteUntil;  // ikke egne netop indsendte
  if (external) playNotifySound();
  updateNotifyPopup(state.rows, external);
}

async function onRealtimeEvent(payload) {
  const before = _knownIds;
  await refresh(false, !isFormView());
  detectNewRows(before);
}

/* ---------- Basis ---------- */
function ensureDrafts() {
  while (state.labDraft.length < state.labRowCount) state.labDraft.push(emptyLabRow());
  while (state.sendDraft.length < state.sendRowCount) state.sendDraft.push(emptySendRow());
}
function emptyLabRow() { return { sample: "", box: "", analysis: "", determinations: "", detManual: false, reason: "", comment: "", first_weighing: today(), urgent: false, warning: "" }; }
function emptySendRow() { return { sample: "", box: "", grams: "", first_weighing: today() }; }
function isFormView() { return state.view === "labform" || state.view === "sendform"; }
function labelType(t) { return t === "materialer" ? "Materialer" : "Jord"; }
function today() { return new Date().toISOString().slice(0, 10); }
function isToday(dateStr) { return String(dateStr || "").slice(0, 10) === today(); }
function cfgInitials() { return getConfig().initials || ""; }
function activeRows() { return state.rows.filter(r => (r.status || "ny") === "ny"); }
function activeBtn(v, c) { return v === c ? "active" : ""; }

async function refresh(showError = true, shouldRender = true) {
  const dot = document.querySelector(".status .dot");
  if (dot) dot.classList.add("busy");
  try { state.rows = await fetchRepairs(); state.error = ""; }
  catch (e) { if (showError) state.error = e.message; }
  finally { const d2 = document.querySelector(".status .dot"); if (d2) d2.classList.remove("busy"); }
  if (shouldRender) render();
  if (state.loggedIn) updateNotifyPopup(state.rows, false);
}

function go(v) {
  state.view = v;
  if (v === "afvjord" || v === "afvmat" || v === "archive" || v === "dashboard") refresh(false, true);
  else render();
}

/* ---------- Layout ---------- */
function header(t, s) {
  return `<div class="topbar"><div><h1>${escapeHtml(t)}</h1><div class="subtitle">${escapeHtml(s)}</div></div>
  <div class="status"><span class="dot ${state.connected ? "ok" : ""}"></span>${state.connected ? "Forbundet" : "Ikke forbundet"}</div></div>`;
}
function logoBlock() { return `<img src="als-logo.svg?v=2.3.0" alt="ALS" class="als-logo" onerror="this.onerror=null;this.src='als-logo.png'">`; }

function layout(content) {
  if (state.view === "welcome") return content;
  const c = getConfig();
  return `<div class="app"><aside class="sidebar">
  <div class="brand">${logoBlock()}<div class="logo">OMW LabRepair<small>Version ${APP_VERSION} · ${escapeHtml(c.initials || "")}</small></div></div>
  <div><div class="side-section">Indsendelse</div>
  <button class="side-btn ${(state.view === "labselect" || state.view === "labform") ? "active" : ""}" onclick="go('labselect')"><span class="icon">L</span> Lab reparationer</button>
  <button class="side-btn ${(state.view === "sendselect" || state.view === "sendform") ? "active" : ""}" onclick="go('sendselect')"><span class="icon">S</span> Send til</button></div>
  <div><div class="side-section">Afvejning</div>
  <button class="side-btn ${state.view === "afvjord" ? "active" : ""}" onclick="go('afvjord')"><span class="icon">J</span> Afvejning Jord</button>
  <button class="side-btn ${state.view === "afvmat" ? "active" : ""}" onclick="go('afvmat')"><span class="icon">M</span> Afvejning Materialer</button></div>
  <div><div class="side-section">Overblik</div>
  <button class="side-btn ${state.view === "archive" ? "active" : ""}" onclick="go('archive')"><span class="icon">R</span> Arkiv</button>
  <button class="side-btn ${state.view === "dashboard" ? "active" : ""}" onclick="go('dashboard')"><span class="icon">D</span> Dashboard</button>
  <button class="side-btn ${state.view === "setup" ? "active" : ""}" onclick="go('setup')"><span class="icon">⚙</span> Opsætning</button></div>
  </aside><main class="main">${state.error ? `<div class="error">${escapeHtml(state.error)}</div>` : ""}${content}</main></div>`;
}

function render() {
  ensureDrafts();
  let html = "";
  if (state.view === "welcome") html = welcomeView();
  if (state.view === "setup") html = setupView();
  if (state.view === "labselect") html = labSelect();
  if (state.view === "labform") html = labForm();
  if (state.view === "sendselect") html = sendSelect();
  if (state.view === "sendform") html = sendForm();
  if (state.view === "afvjord") html = afv("jord");
  if (state.view === "afvmat") html = afv("materialer");
  if (state.view === "archive") html = archiveView();
  if (state.view === "dashboard") html = dashboardView();
  document.getElementById("app").innerHTML = layout(html);
}

/* ---------- Welcome / login ---------- */
function welcomeView() {
  const c = getConfig();
  const hasStation = !!c.workstation;
  const stationHtml = hasStation
    ? `<div class="station-badge">Arbejdsstation: <b>${escapeHtml(stationLabel(c.workstation))}</b>
       <button class="linklike" onclick="clearStation()">Skift</button></div>`
    : `<label>Vælg din arbejdsstation (gemmes på denne computer)</label>
       <div class="station-grid">${WORKSTATIONS.map(([v, l]) =>
        `<button class="option ${activeBtn(v, state._pickedStation || "")}" onclick="pickStation('${v}')">${l}</button>`).join("")}</div>`;
  return `<div class="welcome"><div class="welcome-card">${logoBlock()}
    <h1>OMW LabRepair</h1>
    <p>ALS Environmental · Digital platform til OMW-reparationer og Send til.</p>
    <label>Indtast dine initialer<input id="welcomeInitials" value="${escapeHtml(c.initials || "")}" placeholder="fx AMI" maxlength="8" autocomplete="off" onkeydown="if(event.key==='Enter')saveWelcome()"></label>
    ${stationHtml}
    <button class="primary" onclick="saveWelcome()">Start</button>
    <div class="version">Version ${APP_VERSION}</div></div></div>`;
}
function stationLabel(v) { const f = WORKSTATIONS.find(w => w[0] === v); return f ? f[1] : v; }
function pickStation(v) { state._pickedStation = v; render(); setTimeout(() => { const i = document.getElementById("welcomeInitials"); if (i) i.focus(); }, 0); }
function clearStation() { const c = getConfig(); c.workstation = ""; saveConfig(c); state._pickedStation = ""; render(); }

function saveWelcome() {
  const val = document.getElementById("welcomeInitials").value.trim().toUpperCase();
  if (!val) return toast("Indtast initialer.");
  const cfg = getConfig();
  if (!cfg.workstation) {
    if (!state._pickedStation) return toast("Vælg arbejdsstation.");
    cfg.workstation = state._pickedStation;
  }
  cfg.initials = val;
  saveConfig(cfg);
  initAudio(); // brugerklik: lyd er nu tilladt af browseren
  state.loggedIn = true;
  updateNotifyPopup(state.rows, false);
  if (!state.connected) {
    toast("Databasen er ikke sat op endnu — åbn teknisk opsætning.");
    go("setup");
    return;
  }
  go(cfg.workstation === "afvjord" ? "afvjord" : cfg.workstation === "afvmat" ? "afvmat" : "labselect");
}

/* ---------- Opsætning ---------- */
function setupView() {
  const c = getConfig();
  return `${header("Opsætning", "Initialer og arbejdsstation. Teknisk opsætning kræver adgangskode.")}
  <div class="card">
    <div class="setup-grid">
      <label>Mine initialer<input id="initials" value="${escapeHtml(c.initials || "")}" placeholder="fx AMI"></label>
      <label>Arbejdsstation<select id="stationSel">${WORKSTATIONS.map(([v, l]) =>
        `<option value="${v}" ${c.workstation === v ? "selected" : ""}>${l}</option>`).join("")}</select></label>
    </div>
    <div class="actions"><button class="primary" onclick="saveUserSetup()">Gem</button></div>
    <hr>
    <div id="techLocked">
      <label>Admin adgangskode<input id="setupPass" type="password" onkeydown="if(event.key==='Enter')unlockTech()"></label>
      <div class="actions"><button onclick="unlockTech()">Åbn teknisk opsætning</button></div>
    </div>
    <div id="setupTechnical">
      <label>Supabase URL<input id="url" value="${escapeHtml(c.supabaseUrl || "")}"></label><br>
      <label>Publishable key<input id="key" value="${escapeHtml(c.supabaseKey || "")}"></label><br>
      <label>Zebra ZD421 IP-adresse (netværksprinter, fx 192.168.1.50)<input id="zebraIp" value="${escapeHtml(c.zebraIp || "")}" placeholder="tom = brug browserens printdialog"></label>
      <div class="actions"><button class="primary" onclick="saveTechnicalSetup()">Gem og test</button></div>
    </div>
  </div>`;
}
function saveUserSetup() {
  const cfg = getConfig();
  cfg.initials = document.getElementById("initials").value.trim().toUpperCase();
  cfg.workstation = document.getElementById("stationSel").value;
  saveConfig(cfg);
  toast("Gemt.");
  render();
}
function unlockTech() {
  if (document.getElementById("setupPass").value !== ADMIN_PASSWORD) return toast("Forkert adgangskode.");
  document.getElementById("setupTechnical").classList.add("open");
  document.getElementById("techLocked").style.display = "none";
}
async function saveTechnicalSetup() {
  const cfg = getConfig();
  const key = document.getElementById("key").value.trim();
  if (looksLikeServiceRoleKey(key)) {
    state.error = "Denne nøgle er en service_role-nøgle og må ALDRIG bruges i browseren (den omgår al sikkerhed). Brug projektets publishable/anon-nøgle.";
    render();
    return;
  }
  cfg.supabaseUrl = document.getElementById("url").value.trim();
  cfg.supabaseKey = key;
  cfg.zebraIp = document.getElementById("zebraIp").value.trim();
  saveConfig(cfg);
  state.connected = initSupabase();
  try {
    await testConnection();
    toast("Forbindelse OK");
    await refresh(false, false);
    _knownIds = new Set(state.rows.map(r => r.id));
    subscribeRealtime(onRealtimeEvent);
    go("labselect");
  } catch (e) { state.error = e.message; render(); }
}

/* ---------- Lab reparationer ---------- */
function labSelect() {
  return `${header("Lab reparationer", "Vælg lab og type én gang for hele sendingen.")}
  <div class="card"><h3>1. Vælg laboratorium</h3>
  <div class="option-grid">${LABS.map(l => `<button class="option ${activeBtn(l, state.lab)}" onclick="state.lab='${l}';render()">${l}</button>`).join("")}</div>
  <h3>2. Vælg type</h3>
  <div class="option-grid cols2">${TYPES.map(([v, l]) => `<button class="option ${activeBtn(v, state.sampleType)}" onclick="state.sampleType='${v}';render()">${l}</button>`).join("")}</div>
  <div class="actions"><button class="primary" onclick="go('labform')">Fortsæt</button></div></div>`;
}

function topSendButton(fn) { return `<div class="top-actions"><button class="primary" onclick="${fn}">Send udfyldte</button></div>`; }

function labForm() {
  return `${header("Lab reparationer", `${state.lab} · ${labelType(state.sampleType)}`)}
  <div class="card"><div class="toolbar"><div><b>Afsender:</b> ${escapeHtml(state.lab)} · <span class="pill ${state.sampleType}">${labelType(state.sampleType)}</span> · <b>Initialer:</b> ${escapeHtml(cfgInitials())}</div>
  <div class="top-actions">${topSendButton("submitLab()")}<button onclick="go('labselect')">Skift lab/type</button></div></div>
  <div id="warnings">${warningHtml()}</div>
  <div class="table-wrap"><table class="form-table"><thead><tr><th>#</th><th>Prøve</th><th>Kasse</th><th>Analyse</th><th>Bestems</th><th>Årsag</th><th>Kommentar</th><th>1. vejedato</th><th>Haster</th></tr></thead>
  <tbody>${state.labDraft.slice(0, state.labRowCount).map((r, i) => labRow(i, r)).join("")}</tbody></table></div>
  <div class="actions"><button onclick="addLabRows()">+ Tilføj 5 rækker</button><button class="primary" onclick="submitLab()">Send udfyldte</button></div></div>`;
}

/* Bestems: rigtig dropdown + "Manuel indtastning" */
function determinationsField(i, r) {
  if (r.detManual) {
    return `<div class="det-wrap">
      <input value="${escapeHtml(r.determinations)}" data-row="${i}" data-f="determinations" placeholder="fx 2+7" oninput="updateDraft('lab',this)" onkeydown="nextField(event)">
      <button class="mini" title="Tilbage til liste" onclick="setDetManual(${i},false)">↩</button></div>`;
  }
  const isPreset = !r.determinations || DETERMINATIONS.includes(r.determinations);
  return `<select data-row="${i}" data-f="determinations" onchange="onDetSelect(this,${i})" onkeydown="nextField(event)">
    <option value="">–</option>
    ${DETERMINATIONS.map(d => `<option value="${d}" ${r.determinations === d ? "selected" : ""}>${d}</option>`).join("")}
    ${!isPreset ? `<option value="${escapeHtml(r.determinations)}" selected>${escapeHtml(r.determinations)}</option>` : ""}
    <option value="__manual">Manuel indtastning…</option>
  </select>`;
}
function onDetSelect(el, i) {
  if (el.value === "__manual") { setDetManual(i, true); return; }
  state.labDraft[i].determinations = el.value;
  saveDrafts();
}
function setDetManual(i, manual) {
  state.labDraft[i].detManual = manual;
  if (!manual && !DETERMINATIONS.includes(state.labDraft[i].determinations)) state.labDraft[i].determinations = "";
  render();
  const el = document.querySelector(`[data-row="${i}"][data-f="determinations"]`);
  if (el) el.focus();
}

function labRow(i, r) {
  return `<tr><td>${i + 1}</td>
  <td><input value="${escapeHtml(r.sample)}" data-row="${i}" data-f="sample" autocomplete="off" oninput="updateDraft('lab',this)" onkeydown="nextField(event)" onblur="checkDuplicate(${i})"></td>
  <td><input value="${escapeHtml(r.box)}" data-row="${i}" data-f="box" autocomplete="off" oninput="updateDraft('lab',this)" onkeydown="nextField(event)"></td>
  <td><input value="${escapeHtml(r.analysis)}" data-ac="analyses" data-row="${i}" data-f="analysis" autocomplete="off" oninput="updateDraft('lab',this)" onkeydown="nextField(event)" onblur="checkDuplicate(${i})"></td>
  <td>${determinationsField(i, r)}</td>
  <td><input value="${escapeHtml(r.reason)}" data-ac="reasons" data-row="${i}" data-f="reason" autocomplete="off" oninput="updateDraft('lab',this)" onkeydown="nextField(event)"></td>
  <td><textarea data-row="${i}" data-f="comment" oninput="updateDraft('lab',this)" onkeydown="nextField(event)">${escapeHtml(r.comment)}</textarea></td>
  <td><input type="date" value="${escapeHtml(r.first_weighing)}" data-row="${i}" data-f="first_weighing" oninput="updateDraft('lab',this)" onkeydown="nextField(event)"></td>
  <td><input type="checkbox" ${r.urgent ? "checked" : ""} data-row="${i}" data-f="urgent" onchange="updateDraft('lab',this)" onkeydown="nextField(event)"></td></tr>`;
}

function updateDraft(kind, el) {
  const arr = kind === "lab" ? state.labDraft : state.sendDraft;
  const row = Number(el.dataset.row), f = el.dataset.f;
  arr[row][f] = el.type === "checkbox" ? el.checked : el.value;
  saveDrafts();
}
function addLabRows() { state.labRowCount += 5; ensureDrafts(); render(); }

function nextField(e) {
  if (e.key !== "Enter") return;
  if (e.target.matches("input[data-ac]") && acHasHighlight(e.target)) return; // Enter vælger i autocomplete
  e.preventDefault();
  const fields = [...document.querySelectorAll("[data-row]")].filter(x => x.offsetParent !== null);
  const idx = fields.indexOf(e.target);
  if (idx >= 0 && idx < fields.length - 1) fields[idx + 1].focus();
}

function checkDuplicate(rowIndex) {
  const r = state.labDraft[rowIndex];
  if (!r || !r.sample || !r.analysis) return;
  const dup = activeRows().find(x => x.request_type === "reparation" && x.sample === r.sample && x.analysis === r.analysis && isToday(x.created_at));
  r.warning = dup
    ? `Mulig dublet: ${dup.sample} / ${dup.analysis}. Sendt i dag af ${dup.initials || "ukendt"} fra ${dup.lab || "ukendt"} kl. ${new Date(dup.created_at).toLocaleTimeString("da-DK", { hour: "2-digit", minute: "2-digit" })}.`
    : "";
  const w = document.getElementById("warnings");
  if (w) w.innerHTML = warningHtml();
}
function warningHtml() {
  return state.labDraft.map(r => r.warning).filter(Boolean).map(w => `<div class="warn">${escapeHtml(w)}</div>`).join("");
}

function completeLabRows() {
  return state.labDraft.slice(0, state.labRowCount).filter(r => r.sample && r.box && r.analysis && r.reason && r.first_weighing);
}
async function submitLab() { return guardedWrite(() => _submitLab()); }
async function _submitLab() {
  const items = completeLabRows().map(r => ({
    request_type: "reparation", sample_type: state.sampleType, lab: state.lab,
    destination: null, grams: null, sample: r.sample, box: r.box, analysis: r.analysis,
    determinations: r.determinations || null, reason: r.reason, comment: r.comment || null,
    first_weighing: r.first_weighing, urgent: !!r.urgent, status: "ny", printed: false,
    initials: cfgInitials()
  }));
  if (!items.length) return toast("Ingen komplette rækker.");
  try {
    _muteUntil = Date.now() + 6000;
    await insertRows(items);
    toast(`${items.length} sendt`);
    clearDrafts("lab");
    await refresh(false, false);
    _knownIds = new Set(state.rows.map(r => r.id));
    go(state.sampleType === "jord" ? "afvjord" : "afvmat");
  } catch (e) { state.error = e.message; render(); }
}

/* ---------- Send til ---------- */
function sendSelect() {
  return `${header("Send til", "Vælg type og destination én gang for hele sendingen.")}
  <div class="card"><h3>1. Vælg type</h3>
  <div class="option-grid cols2">${TYPES.map(([v, l]) => `<button class="option ${activeBtn(v, state.sampleType)}" onclick="state.sampleType='${v}';render()">${l}</button>`).join("")}</div>
  <h3>2. Vælg destination</h3>
  <div class="option-grid">${DESTINATIONS.map(d => `<button class="option ${activeBtn(d, state.destination)}" onclick="state.destination='${d}';render()">${d}</button>`).join("")}</div>
  <div class="actions"><button class="primary" onclick="go('sendform')">Fortsæt</button></div></div>`;
}
function sendForm() {
  return `${header("Send til", `${labelType(state.sampleType)} · ${state.destination}`)}
  <div class="card"><div class="toolbar"><div><b>Destination:</b> ${escapeHtml(state.destination)} · <span class="pill ${state.sampleType}">${labelType(state.sampleType)}</span> · <b>Initialer:</b> ${escapeHtml(cfgInitials())}</div>
  <div class="top-actions">${topSendButton("submitSendTil()")}<button onclick="go('sendselect')">Skift type/destination</button></div></div>
  <table><thead><tr><th>#</th><th>Prøve</th><th>Kasse</th><th>Gram</th><th>1. vejedato</th></tr></thead>
  <tbody>${state.sendDraft.slice(0, state.sendRowCount).map((r, i) => sendRow(i, r)).join("")}</tbody></table>
  <div class="actions"><button onclick="addSendRows()">+ Tilføj 5 rækker</button><button class="primary" onclick="submitSendTil()">Send udfyldte</button></div></div>`;
}
function sendRow(i, r) {
  return `<tr><td>${i + 1}</td>
  <td><input value="${escapeHtml(r.sample)}" data-row="${i}" data-f="sample" autocomplete="off" oninput="updateDraft('send',this)" onkeydown="nextField(event)"></td>
  <td><input value="${escapeHtml(r.box)}" data-row="${i}" data-f="box" autocomplete="off" oninput="updateDraft('send',this)" onkeydown="nextField(event)"></td>
  <td><input value="${escapeHtml(r.grams)}" data-row="${i}" data-f="grams" type="number" step="0.01" oninput="updateDraft('send',this)" onkeydown="nextField(event)"></td>
  <td><input type="date" value="${escapeHtml(r.first_weighing)}" data-row="${i}" data-f="first_weighing" oninput="updateDraft('send',this)" onkeydown="nextField(event)"></td></tr>`;
}
function addSendRows() { state.sendRowCount += 5; ensureDrafts(); render(); }
function completeSendRows() {
  return state.sendDraft.slice(0, state.sendRowCount)
    .filter(r => r.sample && r.box && r.first_weighing && isFinite(Number(r.grams)) && Number(r.grams) > 0);
}
async function submitSendTil() { return guardedWrite(() => _submitSendTil()); }
async function _submitSendTil() {
  const items = completeSendRows().map(r => ({
    request_type: "send_til", sample_type: state.sampleType, lab: "Send til",
    destination: state.destination, grams: Number(r.grams), sample: r.sample, box: r.box,
    analysis: null, determinations: null, reason: null, comment: null,
    first_weighing: r.first_weighing, urgent: false, status: "ny", printed: false,
    initials: cfgInitials()
  }));
  if (!items.length) return toast("Ingen komplette rækker.");
  try {
    _muteUntil = Date.now() + 6000;
    await insertRows(items);
    toast(`${items.length} sendt`);
    clearDrafts("send");
    await refresh(false, false);
    _knownIds = new Set(state.rows.map(r => r.id));
    go(state.sampleType === "jord" ? "afvjord" : "afvmat");
  } catch (e) { state.error = e.message; render(); }
}

/* ---------- Afvejning (arbejdsliste) ---------- */
function afv(type) {
  const all = activeRows().filter(r => r.sample_type === type);
  const urgentCount = all.filter(r => r.urgent).length;
  const ids = escapeHtml(JSON.stringify(all.map(x => x.id)));
  const zebraIp = (getConfig().zebraIp || "").trim();
  return `${header("Afvejning " + labelType(type), `Alle ${labelType(type).toLowerCase()}-opgaver samlet i én arbejdsliste.`)}
  <div class="card">
    <div class="print-actions">
      <button class="print-btn primary" onclick='printLabelsForType("${type}")'>
        <span>Print etiketter</span>
        <small>${zebraIp ? "Zebra ZD421 · " + escapeHtml(zebraIp) : "Zebra ZD421"} · uden arkivering</small>
      </button>
      <button class="print-btn green" onclick='printA4AndArchive("${type}")'>
        <span>Print A4 + Arkivér</span>
        <small>A4-printer · arkiveres automatisk efter print</small>
      </button>
    </div>
    ${zebraIp ? "" : `<div class="warn">Zebra-printerens IP er ikke sat op — etiketter printes via browserens printdialog. Sæt IP under Opsætning → teknisk opsætning for direkte ZPL-print.</div>`}
    <div class="toolbar"><b>Alle opgaver (${all.length}) · Haster: ${urgentCount}</b>
    <div class="top-actions">
      <button onclick='downloadZplForType("${type}")'>Download ZPL</button>
      <button class="ghost" onclick='archiveIds(${ids})'>Arkivér uden print</button>
    </div></div>
    ${tableWorklist(all)}</div>`;
}

function tableWorklist(rows) {
  if (!rows.length) return "<p class='subtitle'>Ingen aktive opgaver</p>";
  return `<div class="table-wrap"><table><thead><tr>
  <th>Opgave</th><th>Lab/Destination</th><th>Prøve</th><th>Kasse</th><th>Analyse</th><th>Bestems</th><th>Gram</th><th>Årsag</th><th>Kommentar</th><th>Initialer</th><th>1. vejedato</th><th>Haster</th>
  </tr></thead><tbody>${rows.map(r => `<tr class="${r.urgent ? "row-urgent" : ""}">
  <td>${r.request_type === "send_til" ? "Send til" : "Reparation"}</td>
  <td>${escapeHtml(r.request_type === "send_til" ? (r.destination || "") : (r.lab || ""))}</td>
  <td><b>${escapeHtml(r.sample || "")}</b></td>
  <td>${escapeHtml(r.box || "")}</td>
  <td>${escapeHtml(r.analysis || "")}</td>
  <td>${escapeHtml(r.determinations || "")}</td>
  <td>${r.grams ? escapeHtml(r.grams) + " g" : ""}</td>
  <td>${escapeHtml(r.reason || "")}</td>
  <td>${escapeHtml(r.comment || "")}</td>
  <td>${escapeHtml(r.initials || "")}</td>
  <td>${escapeHtml(r.first_weighing || "")}</td>
  <td>${r.urgent ? "<span class='pill red'>HASTER</span>" : ""}</td>
  </tr>`).join("")}</tbody></table></div>`;
}

/* Knap 1: kun etiketter — ingen arkivering. */
function printLabelsForType(type) {
  const rows = activeRows().filter(r => r.sample_type === type);
  if (!rows.length) return toast("Ingen rækker til print.");
  printLabels(rows, `Etiketter ${labelType(type)}`);
}

/* Knap 2: A4 (Reparationer + Send til) og automatisk arkivering efter print. */
async function printA4AndArchive(type) { return guardedWrite(() => _printA4AndArchive(type)); }
async function _printA4AndArchive(type) {
  const rows = activeRows().filter(r => r.sample_type === type);
  if (!rows.length) return toast("Ingen rækker til print.");
  const ids = rows.map(r => r.id);
  const printed = await printRows(rows, `Afvejning ${labelType(type)} — samlet`);
  if (!printed) return;
  try {
    const now = new Date().toISOString();
    await updateRows(ids, { printed: true, printed_at: now, status: "arkiv", archive_date: now, archive_by: cfgInitials() });
    toast("Printet og flyttet til arkiv");
    setTimeout(() => refresh(false, !isFormView()), 300);
  } catch (e) { state.error = e.message; render(); }
}

function downloadZplForType(type) {
  const rows = activeRows().filter(r => r.sample_type === type);
  if (!rows.length) return toast("Ingen rækker.");
  downloadZpl(rows, `etiketter_${type}_${today()}.zpl`);
}

async function archiveIds(ids) { return guardedWrite(() => _archiveIds(ids)); }
async function _archiveIds(ids) {
  if (!ids.length) return toast("Ingen rækker.");
  try {
    await updateRows(ids, { status: "arkiv", archive_date: new Date().toISOString(), archive_by: cfgInitials() });
    toast("Flyttet til arkiv");
    await refresh(false, true);
  } catch (e) { state.error = e.message; render(); }
}

/* ---------- Arkiv (alle kolonner) ---------- */
function archiveView() {
  const q = state.archiveSearch.trim().toLowerCase();
  let rows = state.rows.filter(r => (r.status || "ny") === "arkiv");
  if (q) rows = rows.filter(r =>
    [r.sample, r.box, r.analysis, r.reason, r.comment, r.lab, r.destination, r.initials, r.archive_by, r.determinations]
      .some(v => String(v || "").toLowerCase().includes(q)));
  return `${header("Arkiv", "Ét fælles arkiv med alle data.")}
  <div class="card"><div class="toolbar">
    <input class="search" placeholder="Søg i arkiv (prøve, analyse, initialer …)" value="${escapeHtml(state.archiveSearch)}" oninput="state.archiveSearch=this.value;debounceArchive()">
    <span class="subtitle">${rows.length} rækker</span>
  </div>${tableArchive(rows)}</div>`;
}
let _archTimer = null;
function debounceArchive() {
  clearTimeout(_archTimer);
  _archTimer = setTimeout(() => {
    const el = document.querySelector(".search");
    const pos = el ? el.selectionStart : 0;
    render();
    const el2 = document.querySelector(".search");
    if (el2) { el2.focus(); el2.setSelectionRange(pos, pos); }
  }, 250);
}

function fmtDT(v) { return v ? new Date(v).toLocaleString("da-DK") : ""; }

/* Gendan fra arkiv — sikkerhedsnet mod fejlarkivering (fx annulleret print).
   Kræver admin-adgangskode én gang pr. session. */
function ensureAdmin() {
  if (state._adminOk) return true;
  const p = prompt("Admin adgangskode:");
  if (p === ADMIN_PASSWORD) { state._adminOk = true; return true; }
  if (p !== null) toast("Forkert adgangskode.");
  return false;
}
async function restoreRow(id) {
  if (!ensureAdmin()) return;
  try {
    await updateRows([id], { status: "ny", archive_date: null, archive_by: null });
    toast("Gendannet som aktiv opgave.");
    await refresh(false, true);
  } catch (e) { state.error = e.message; render(); }
}

function tableArchive(rows) {
  if (!rows.length) return "<p class='subtitle'>Ingen arkivdata</p>";
  return `<div class="table-wrap"><table><thead><tr>
  <th>Type</th><th>Request</th><th>Lab/Destination</th><th>Prøve</th><th>Kasse</th><th>Analyse</th><th>Bestems</th><th>Gram</th><th>Årsag</th><th>Kommentar</th><th>Initialer</th><th>1. vejedato</th><th>Haster</th><th>Status</th><th>Oprettet</th><th>Printet</th><th>Printet kl.</th><th>Arkiveret af</th><th>Arkiveret kl.</th><th></th>
  </tr></thead><tbody>${rows.map(r => `<tr>
  <td>${labelType(r.sample_type)}</td>
  <td>${r.request_type === "send_til" ? "Send til" : "Reparation"}</td>
  <td>${escapeHtml(r.request_type === "send_til" ? (r.destination || "") : (r.lab || ""))}</td>
  <td><b>${escapeHtml(r.sample || "")}</b></td>
  <td>${escapeHtml(r.box || "")}</td>
  <td>${escapeHtml(r.analysis || "")}</td>
  <td>${escapeHtml(r.determinations || "")}</td>
  <td>${r.grams ? escapeHtml(r.grams) + " g" : ""}</td>
  <td>${escapeHtml(r.reason || "")}</td>
  <td>${escapeHtml(r.comment || "")}</td>
  <td>${escapeHtml(r.initials || "")}</td>
  <td>${escapeHtml(r.first_weighing || "")}</td>
  <td>${r.urgent ? "HASTER" : ""}</td>
  <td>${escapeHtml(r.status || "")}</td>
  <td>${fmtDT(r.created_at)}</td>
  <td>${r.printed ? "Ja" : "Nej"}</td>
  <td>${fmtDT(r.printed_at)}</td>
  <td>${escapeHtml(r.archive_by || "")}</td>
  <td>${fmtDT(r.archive_date)}</td>
  <td><button class="mini" title="Gendan som aktiv (admin)" onclick="restoreRow('${escapeHtml(String(r.id))}')">Gendan</button></td>
  </tr>`).join("")}</tbody></table></div>`;
}
