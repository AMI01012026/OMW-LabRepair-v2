function printRows(rows, title) {
  if (!rows.length) return toast("Ingen rækker til print.");
  const area = document.getElementById("printArea");
  area.innerHTML = `<h2>${escapeHtml(title)}</h2><p>Antal: ${rows.length} · Udskrevet: ${new Date().toLocaleString("da-DK")}</p>
  <table class="print-table"><thead><tr><th>Type</th><th>Afsender</th><th>Destination</th><th>Prøve</th><th>Kasse</th><th>Analyse</th><th>Bestems</th><th>Gram</th><th>Årsag</th><th>Initialer</th><th>1. vejedato</th></tr></thead>
  <tbody>${rows.map(r=>`<tr><td>${escapeHtml(labelType(r.sample_type))}</td><td>${escapeHtml(r.lab||"")}</td><td>${escapeHtml(r.destination||"")}</td><td>${escapeHtml(r.sample||"")}</td><td>${escapeHtml(r.box||"")}</td><td>${escapeHtml(r.analysis||"")}</td><td>${escapeHtml(r.determinations||"")}</td><td>${r.grams?escapeHtml(r.grams)+" g":""}</td><td>${escapeHtml(r.reason||"")}</td><td>${escapeHtml(r.initials||"")}</td><td>${escapeHtml(r.first_weighing||"")}</td></tr>`).join("")}</tbody></table>`;
  area.style.display = "block";
  setTimeout(()=>{window.print(); setTimeout(()=>area.style.display="none",500)},100);
}
