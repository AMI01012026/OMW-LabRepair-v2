/* OMW LabRepair v2.0 — print: Zebra-etiketter (52×25 mm, Code128), A4, ZPL */

function parseDeterminations(value) {
  const raw = String(value || "").trim();
  if (!raw) return [""];
  return raw.split(/[+,; ]+/).map(x => x.trim()).filter(Boolean);
}

/* Én etiket pr. bestemmelse for reparationer; én etiket pr. Send til med "→ destination". */
function labelItemsFromRows(rows) {
  const labels = [];
  rows.forEach(r => {
    if (r.request_type === "reparation") {
      parseDeterminations(r.determinations).forEach(det => {
        labels.push({
          code: det ? `${r.sample}-${det}` : `${r.sample}`,
          line2: r.analysis || "",
          urgent: !!r.urgent
        });
      });
    } else if (r.request_type === "send_til") {
      labels.push({
        code: `${r.sample}`,
        line2: r.destination ? `→ ${r.destination}` : "",
        urgent: !!r.urgent
      });
    }
  });
  return labels;
}

/* @page kan ikke styres pr. CSS-klasse, så vi injicerer den rigtige størrelse
   lige før print. Det fjerner v1.x-fejlen hvor A4 blev printet på 52×25 mm. */
function setPrintPage(mode) {
  let style = document.getElementById("printPageStyle");
  if (!style) {
    style = document.createElement("style");
    style.id = "printPageStyle";
    document.head.appendChild(style);
  }
  style.textContent = mode === "labels"
    ? "@media print{@page{size:52mm 25mm;margin:0}}"
    : "@media print{@page{size:A4 landscape;margin:8mm}}";
}

/* ---------- Etiketter ----------
   Primær vej: ZPL direkte til Zebra ZD421 over netværk (printerens IP, HTTP POST
   til /pstprnt — indbygget i Zebras printserver). Hver ^XA…^XZ-blok er sit eget job.
   Fallback: browser-print (rettet: SVG'en får viewBox, så stregkoden skaleres
   i stedet for at blive klippet — årsagen til at kun en del af teksten blev printet). */

async function sendZplToZebra(zpl, ip) {
  const res = await fetch(`http://${ip}/pstprnt`, {
    method: "POST",
    mode: "no-cors", // printeren sender ikke CORS-headers; jobbet afleveres alligevel
    headers: { "Content-Type": "text/plain" },
    body: zpl
  });
  return res;
}

async function printLabels(rows, title = "Etiketter") {
  const labels = labelItemsFromRows(rows);
  if (!labels.length) return toast("Ingen etiketter til print.");

  const ip = (getConfig().zebraIp || "").trim();
  if (ip) {
    try {
      await sendZplToZebra(buildZplForLabels(rows), ip);
      bumpPrintStats("labels", labels.length);
      toast(`${labels.length} etiketter sendt til Zebra (${ip}).`);
      return;
    } catch (e) {
      console.warn("Zebra netværksprint fejlede, bruger browserprint.", e);
      toast("Zebra-printeren kunne ikke nås — bruger browserprint i stedet.");
    }
  }
  printLabelsViaBrowser(labels);
}

function printLabelsViaBrowser(labels) {
  if (!window.JsBarcode) return toast("Barcode-bibliotek kunne ikke indlæses. Opdater siden.");
  const area = document.getElementById("printArea");
  area.className = "mode-labels";
  area.innerHTML = `<div class="zebra-labels">${labels.map((l, i) => `<section class="zebra-label">
      <div class="urgent-flag">${l.urgent ? "HASTER" : ""}</div>
      <svg class="barcode-js" id="barcode_${i}"></svg>
      <div class="label-code">${escapeHtml(l.code)}</div>
      <div class="label-analysis">${escapeHtml(l.line2)}</div>
    </section>`).join("")}</div>`;

  let ok = true;
  labels.forEach((l, i) => {
    try {
      const sel = `#barcode_${i}`;
      JsBarcode(sel, l.code, {
        format: "CODE128",
        displayValue: false,
        margin: 0,
        width: 2,
        height: 44,
        flat: true
      });
      /* JsBarcode sætter kun width/height i px. Uden viewBox klipper CSS'ens
         mm-størrelse indholdet af. Med viewBox skaleres hele stregkoden til 48×8.8 mm. */
      const svg = document.querySelector(sel);
      const w = parseFloat(svg.getAttribute("width")) || 0;
      const h = parseFloat(svg.getAttribute("height")) || 0;
      if (w && h) svg.setAttribute("viewBox", `0 0 ${w} ${h}`);
      svg.removeAttribute("width");
      svg.removeAttribute("height");
      svg.setAttribute("preserveAspectRatio", "none");
    } catch (e) { ok = false; }
  });
  if (!ok) toast("En eller flere stregkoder kunne ikke genereres. Kontrollér prøvenumre.");

  setPrintPage("labels");
  area.style.display = "block";
  /* Vent på layout/rendering af SVG før printdialogen åbnes */
  requestAnimationFrame(() => requestAnimationFrame(() => setTimeout(() => {
    window.print();
    bumpPrintStats("labels", labels.length);
    setTimeout(() => { area.style.display = "none"; area.innerHTML = ""; }, 500);
  }, 250)));
}

function printRows(rows, title) {
  if (!rows.length) { toast("Ingen rækker til print."); return Promise.resolve(false); }
  const area = document.getElementById("printArea");
  area.className = "mode-a4";
  const repairs = rows.filter(r => r.request_type === "reparation");
  const sends = rows.filter(r => r.request_type === "send_til");

  const repairHtml = repairs.length ? `<h3>Reparationer</h3><table class="print-table"><thead><tr>
      <th>Prøve</th><th>Kasse</th><th>Analyse</th><th>Bestems</th><th>Årsag</th><th>Kommentar</th><th>Initialer</th><th>1. vejedato</th><th>Haster</th>
    </tr></thead><tbody>${repairs.map(r => `<tr>
      <td><b>${escapeHtml(r.sample || "")}</b></td><td>${escapeHtml(r.box || "")}</td><td>${escapeHtml(r.analysis || "")}</td><td>${escapeHtml(r.determinations || "")}</td><td>${escapeHtml(r.reason || "")}</td><td>${escapeHtml(r.comment || "")}</td><td>${escapeHtml(r.initials || "")}</td><td>${escapeHtml(r.first_weighing || "")}</td><td>${r.urgent ? "HASTER" : ""}</td>
    </tr>`).join("")}</tbody></table>` : "";

  const sendHtml = sends.length ? `<h3>Send til</h3><table class="print-table"><thead><tr>
      <th>Prøve</th><th>Kasse</th><th>Destination</th><th>Gram</th><th>Initialer</th><th>1. vejedato</th>
    </tr></thead><tbody>${sends.map(r => `<tr>
      <td><b>${escapeHtml(r.sample || "")}</b></td><td>${escapeHtml(r.box || "")}</td><td>${escapeHtml(r.destination || "")}</td><td>${r.grams ? escapeHtml(r.grams) + " g" : ""}</td><td>${escapeHtml(r.initials || "")}</td><td>${escapeHtml(r.first_weighing || "")}</td>
    </tr>`).join("")}</tbody></table>` : "";

  area.innerHTML = `<div class="print-page"><h2>${escapeHtml(title)}</h2>
    <p>Antal: ${rows.length} · Udskrevet: ${new Date().toLocaleString("da-DK")} · Af: ${escapeHtml(cfgInitials())}</p>
    ${repairHtml}${sendHtml}</div>`;

  setPrintPage("a4");
  area.style.display = "block";
  /* Returnerer et Promise der først opfyldes EFTER printdialogen er lukket,
     så arkivering sker efter print — ikke før. */
  return new Promise(resolve => {
    setTimeout(() => {
      window.print();
      bumpPrintStats("a4", 1);
      setTimeout(() => { area.style.display = "none"; area.innerHTML = ""; resolve(true); }, 500);
    }, 100);
  });
}

/* ---------- ZPL (Zebra ZD421, 203 dpi, 52×25 mm ≈ 416×200 dots) ----------
   Hver ^XA…^XZ-blok er sit eget printjob på printeren. */
function zplSanitize(v) {
  return String(v || "").replace(/[\^~\\]/g, " ").trim();
}

function buildZplForLabels(rows) {
  return labelItemsFromRows(rows).map(l => {
    const code = zplSanitize(l.code);
    const line2 = zplSanitize(l.line2);
    return `^XA
^PW416
^LL200
^CI28
${l.urgent ? "^FO0,8^A0N,26,26^FB416,1,0,C^FDHASTER^FS" : ""}
^FO24,40^BY2,2,58^BCN,58,N,N,N^FD${code}^FS
^FO0,104^A0N,34,34^FB416,1,0,C^FD${code}^FS
^FO0,148^A0N,25,25^FB416,1,0,C^FD${line2}^FS
^XZ`;
  }).join("\n");
}

function downloadZpl(rows, filename = "etiketter.zpl") {
  const labels = labelItemsFromRows(rows);
  if (!labels.length) return toast("Ingen etiketter.");
  const zpl = buildZplForLabels(rows);
  const blob = new Blob([zpl], { type: "text/plain;charset=utf-8" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 300);
  toast(`${labels.length} etiketter eksporteret som ZPL.`);
}
