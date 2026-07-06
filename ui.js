/* OMW LabRepair v2.0 — UI helpers: toast, lyd, autocomplete, notifikation, print-statistik */

function escapeHtml(v) {
  return String(v ?? "").replace(/[&<>"']/g, c =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

function toast(m) {
  document.querySelectorAll(".toast").forEach(t => t.remove()); // én ad gangen — ingen stabling
  const d = document.createElement("div");
  d.className = "toast";
  d.textContent = m;
  document.body.appendChild(d);
  setTimeout(() => d.remove(), 3000);
}

/* ---------- Lyd (WebAudio, ingen eksterne filer) ---------- */
let _audioCtx = null;

function initAudio() {
  try {
    if (!_audioCtx) _audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    if (_audioCtx.state === "suspended") _audioCtx.resume();
  } catch {}
}

function playNotifySound() {
  try {
    if (!_audioCtx) initAudio();
    if (!_audioCtx || _audioCtx.state !== "running") return;
    const t = _audioCtx.currentTime;
    [[880, 0], [1174.66, 0.14]].forEach(([freq, off]) => {
      const o = _audioCtx.createOscillator();
      const g = _audioCtx.createGain();
      o.type = "sine";
      o.frequency.value = freq;
      g.gain.setValueAtTime(0.0001, t + off);
      g.gain.exponentialRampToValueAtTime(0.22, t + off + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, t + off + 0.32);
      o.connect(g).connect(_audioCtx.destination);
      o.start(t + off);
      o.stop(t + off + 0.36);
    });
  } catch {}
}

/* ---------- Autocomplete (ægte, ikke datalist) ----------
   Brug: <input data-ac="analyses"> — filtrerer mens man skriver.
   Én flydende liste genbruges; overlever re-render, da alt kører via delegering. */
const AC_LISTS = { analyses: () => ANALYSES, reasons: () => REASONS };
let _acEl = null, _acInput = null, _acIndex = -1, _acItems = [];

function _acBox() {
  if (_acEl) return _acEl;
  _acEl = document.createElement("div");
  _acEl.className = "ac-list";
  _acEl.hidden = true;
  document.body.appendChild(_acEl);
  _acEl.addEventListener("mousedown", e => {
    const item = e.target.closest(".ac-item");
    if (!item || !_acInput) return;
    e.preventDefault();
    _acPick(item.dataset.value);
  });
  return _acEl;
}

function _acPick(value) {
  if (!_acInput) return;
  _acInput.value = value;
  _acInput.dispatchEvent(new Event("input", { bubbles: true }));
  _acHide();
  _acInput.focus();
}

function _acHide() {
  if (_acEl) _acEl.hidden = true;
  _acIndex = -1;
  _acItems = [];
  _acInput = null;
}

function _acShow(input) {
  const source = AC_LISTS[input.dataset.ac];
  if (!source) return;
  const q = input.value.trim().toLowerCase();
  const all = source();
  const starts = all.filter(a => a.toLowerCase().startsWith(q));
  const contains = q ? all.filter(a => !a.toLowerCase().startsWith(q) && a.toLowerCase().includes(q)) : [];
  _acItems = starts.concat(contains).slice(0, 12);
  const box = _acBox();
  if (!_acItems.length) { _acHide(); return; }
  _acInput = input;
  _acIndex = -1;
  box.innerHTML = _acItems.map((a, i) =>
    `<div class="ac-item" data-i="${i}" data-value="${escapeHtml(a)}">${escapeHtml(a)}</div>`).join("");
  const r = input.getBoundingClientRect();
  box.style.left = (r.left + window.scrollX) + "px";
  box.style.top = (r.bottom + window.scrollY + 4) + "px";
  box.style.minWidth = r.width + "px";
  box.hidden = false;
}

function _acHighlight() {
  if (!_acEl) return;
  [..._acEl.children].forEach((el, i) => el.classList.toggle("active", i === _acIndex));
  const el = _acEl.children[_acIndex];
  if (el) el.scrollIntoView({ block: "nearest" });
}

function acHasHighlight(input) {
  return !!(_acEl && !_acEl.hidden && _acInput === input && _acIndex >= 0);
}

document.addEventListener("input", e => {
  if (e.target.matches("input[data-ac]")) _acShow(e.target);
});
document.addEventListener("focusin", e => {
  if (e.target.matches("input[data-ac]")) _acShow(e.target);
  else _acHide();
});
document.addEventListener("keydown", e => {
  if (!_acInput || !_acEl || _acEl.hidden) return;
  if (e.key === "ArrowDown") { e.preventDefault(); _acIndex = Math.min(_acIndex + 1, _acItems.length - 1); _acHighlight(); }
  else if (e.key === "ArrowUp") { e.preventDefault(); _acIndex = Math.max(_acIndex - 1, 0); _acHighlight(); }
  else if (e.key === "Enter" && _acIndex >= 0) { e.preventDefault(); e.stopPropagation(); _acPick(_acItems[_acIndex]); }
  else if (e.key === "Escape" || e.key === "Tab") _acHide();
}, true);
document.addEventListener("click", e => {
  if (!e.target.closest(".ac-list") && !e.target.matches("input[data-ac]")) _acHide();
});
window.addEventListener("scroll", () => _acHide(), true);

/* ---------- Notifikations-popup ----------
   Regler:
   - Ét popup. Åbnes aldrig dobbelt — indholdet opdateres.
   - Lukker brugeren det, forbliver det skjult ved almindelige opdateringer.
   - Kommer en NY opgave (forceShow=true), vises det igen + lyd.
   - Er alt arkiveret (0 aktive), forsvinder det automatisk. */
let _notifyDismissed = false;

function updateNotifyPopup(rows, forceShow = false) {
  const el = document.getElementById("notifyPopup");
  if (!el) return;
  const active = rows.filter(r => (r.status || "ny") === "ny");
  const count = (type, urgent) =>
    active.filter(r => r.sample_type === type && !!r.urgent === urgent).length;
  const jh = count("jord", true), ji = count("jord", false);
  const mh = count("materialer", true), mi = count("materialer", false);
  const total = jh + ji + mh + mi;
  if (!total) { el.hidden = true; el.innerHTML = ""; _notifyDismissed = false; return; }
  if (forceShow) _notifyDismissed = false;
  el.innerHTML = `
    <div class="notify-head">
      <span class="notify-dot"></span> Aktive opgaver
      <button class="notify-close" onclick="dismissNotify()" title="Skjul">×</button>
    </div>
    <div class="notify-body">
      <button class="notify-group" onclick="go('afvjord');dismissNotify()">
        <b>JORD</b>
        <span class="notify-line ${jh ? "urgent" : ""}">Haster <b>${jh}</b></span>
        <span class="notify-line">Ikke haster <b>${ji}</b></span>
      </button>
      <button class="notify-group" onclick="go('afvmat');dismissNotify()">
        <b>MATERIALE</b>
        <span class="notify-line ${mh ? "urgent" : ""}">Haster <b>${mh}</b></span>
        <span class="notify-line">Ikke haster <b>${mi}</b></span>
      </button>
    </div>`;
  el.hidden = _notifyDismissed;
}

function dismissNotify() {
  _notifyDismissed = true;
  const el = document.getElementById("notifyPopup");
  if (el) el.hidden = true;
}

/* ---------- Print-statistik (denne station) ---------- */
const PRINT_STATS_KEY = "omw_print_stats_v1";

function getPrintStats() {
  try { return Object.assign({ labels: 0, a4: 0 }, JSON.parse(localStorage.getItem(PRINT_STATS_KEY) || "{}")); }
  catch { return { labels: 0, a4: 0 }; }
}

function bumpPrintStats(field, amount) {
  const s = getPrintStats();
  s[field] = (s[field] || 0) + amount;
  localStorage.setItem(PRINT_STATS_KEY, JSON.stringify(s));
}
