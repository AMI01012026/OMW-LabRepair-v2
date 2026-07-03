const LABS=["Lab A","Lab C","Lab D","Lab LC"];
const TYPES=[["jord","Jord"],["materialer","Materialer"]];
const DESTINATIONS=["Prag","Luleå","GBA","Andet"];
const ANALYSES=["Kulbrinter","Phtalater","Florisil","HydrocarbonerNorge","Styren","Alifater","Btex","Chlorbenzener","Pah materiele","Pah sediment","Pah 17","PAH","Polære","DCM","MTBE","Pesticider","Phenol og Creosoter","PCB i jord","Freon","Glyphosat/AMPA","Flygtige syrer","Chlorparaffiner fuge","PCB fuge","Acrylamid og Glycoler","Grindstedpakken","N-methyl-2pyrrolidon","Aldehyd (Formaldehyd)","PFAS i Jord og materiale (DK)","Tørstof","Glødetab (se tørstof)","HG","ICP slam","ICP","Metaller","ICP + HG","Antimon","Total N i løv","Total N i jord og slam","Chrom VI jord til tørring 40°C","Chrom ISO","TOC – vådt (Norge)","TOC – tørt (Dk)","Cyanid","Chlorid, vandopløselig","Sulfat, vandopløselig","Fluorid, vandopløselig","Fosfortal","Ledningsevne","pH/reaktionstal","pH i Jord","Udvaskningstest","Baumann Gully","Basemætning","BD-ekstraktion","Pyrit","Citrat opløselig fosfor"];
const REASONS=["High resultat","Low resultat","Høj Terbium","Afvigelse QC","Mistanke om pipettering","Mistanke om homogenisering","Instrument check","Matrix/interferens","Efterbestilling","Ukendt"];
const ADMIN_PASSWORD="admin123";

let state={
  view:"welcome",
  lab:"Lab A",
  sampleType:"jord",
  destination:"Prag",
  rows:[],
  error:"",
  connected:false,
  labRowCount:5,
  sendRowCount:5,
  setupUnlocked:false,
  labDraft:[],
  sendDraft:[]
};

document.addEventListener("DOMContentLoaded", async () => {
  ensureDrafts();
  state.connected = initSupabase();
  const cfg = getConfig();
  state.view = cfg.initials ? "labselect" : "welcome";
  render();
  if (state.connected) await refresh(false, false);
  setInterval(() => {
    if (state.connected && !isFormView()) refresh(false, false);
  }, 30000);
});

function ensureDrafts(){
  while(state.labDraft.length < state.labRowCount) state.labDraft.push(emptyLabRow());
  while(state.sendDraft.length < state.sendRowCount) state.sendDraft.push(emptySendRow());
}
function emptyLabRow(){return {sample:"",box:"",analysis:"",determinations:"",reason:"",comment:"",first_weighing:today(),urgent:false,warning:""}}
function emptySendRow(){return {sample:"",box:"",grams:"",first_weighing:today()}}
function isFormView(){return state.view==="labform"||state.view==="sendform"}
function escapeHtml(v){return String(v??"").replace(/[&<>\"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]))}
function labelType(t){return t==="materialer"?"Materialer":"Jord"}
function today(){return new Date().toISOString().slice(0,10)}
function isToday(dateStr){return String(dateStr||"").slice(0,10)===today()}
function toast(m){const d=document.createElement("div");d.className="toast";d.textContent=m;document.body.appendChild(d);setTimeout(()=>d.remove(),3000)}
async function refresh(showError=true, shouldRender=true){
  try{state.rows=await fetchRepairs();state.error=""}
  catch(e){if(showError)state.error=e.message}
  if(shouldRender) render();
}
function activeRows(){return state.rows.filter(r=>(r.status||"ny")==="ny")}
function activeBtn(v,c){return v===c?"active":""}
function go(v){
  state.view=v;
  if(v==="afvjord"||v==="afvmat"||v==="archive"||v==="dashboard"){
    refresh(false, true);
  } else render();
}
function header(t,s){return `<div class="topbar"><div><h1>${t}</h1><div class="subtitle">${s}</div></div><div class="status"><span class="dot ${state.connected?'ok':''}"></span>${state.connected?'Forbundet':'Ikke forbundet'}</div></div>`}
function logoBlock(){return `<img src="als-logo.png" alt="ALS" class="als-logo" onerror="this.style.display='none'">`}
function layout(content){
 if(state.view==="welcome") return content;
 return `<div class="app"><aside class="sidebar">${logoBlock()}<div class="logo">OMW LabRepair<small>Version 1.5</small></div>
<div><div class="side-section">Indsendelse</div>
<button class="side-btn ${(state.view==='labselect'||state.view==='labform')?'active':''}" onclick="go('labselect')"><span class="icon">L</span> Lab reparationer</button>
<button class="side-btn ${(state.view==='sendselect'||state.view==='sendform')?'active':''}" onclick="go('sendselect')"><span class="icon">S</span> Send til</button></div>
<div><div class="side-section">Afvejning</div>
<button class="side-btn ${state.view==='afvjord'?'active':''}" onclick="go('afvjord')"><span class="icon">J</span> Afvejning Jord</button>
<button class="side-btn ${state.view==='afvmat'?'active':''}" onclick="go('afvmat')"><span class="icon">M</span> Afvejning Materialer</button></div>
<div><div class="side-section">Overblik</div>
<button class="side-btn ${state.view==='archive'?'active':''}" onclick="go('archive')"><span class="icon">R</span> Arkiv</button>
<button class="side-btn ${state.view==='dashboard'?'active':''}" onclick="go('dashboard')"><span class="icon">D</span> Dashboard</button>
<button class="side-btn ${state.view==='setup'?'active':''}" onclick="go('setup')"><span class="icon">⚙</span> Opsætning</button></div>
</aside><main class="main">${state.error?`<div class="error">${escapeHtml(state.error)}</div>`:""}${content}</main></div>`;
}
function render(){
  ensureDrafts();
  let html="";
  if(state.view==="welcome")html=welcomeView();
  if(state.view==="setup")html=setupView();
  if(state.view==="labselect")html=labSelect();
  if(state.view==="labform")html=labForm();
  if(state.view==="sendselect")html=sendSelect();
  if(state.view==="sendform")html=sendForm();
  if(state.view==="afvjord")html=afv("jord");
  if(state.view==="afvmat")html=afv("materialer");
  if(state.view==="archive")html=archiveView();
  if(state.view==="dashboard")html=dashboardView();
  document.getElementById("app").innerHTML=layout(html);
}

function welcomeView(){
 return `<div class="welcome"><div class="welcome-card">${logoBlock()}<h1>Velkommen til OMW LabRepair</h1><p>ALS Environmental<br>Digital platform til OMW-reparationer og Send til.</p><label>Indtast dine initialer<input id="welcomeInitials" placeholder="fx AM" maxlength="8" onkeydown="if(event.key==='Enter')saveWelcome()"></label><button class="primary" onclick="saveWelcome()">Start</button><div class="version">Version 1.5</div></div></div>`;
}
function saveWelcome(){
 const val=document.getElementById("welcomeInitials").value.trim();
 if(!val)return toast("Indtast initialer.");
 const cfg=getConfig(); cfg.initials=val; saveConfig(cfg); go("labselect");
}

function setupView(){
 const c=getConfig();
 return `${header("Opsætning","Kun initialer er synlige. Teknisk opsætning kræver adgangskode.")}
 <div class="card">
   <label>Mine initialer<input id="initials" value="${escapeHtml(c.initials||"")}" placeholder="fx AM"></label>
   <div class="actions"><button class="primary" onclick="saveInitialsOnly()">Gem initialer</button></div>
   <hr style="border:0;border-top:1px solid var(--line);margin:18px 0">
   <div id="techLocked">
     <label>Admin adgangskode<input id="setupPass" type="password" onkeydown="if(event.key==='Enter')unlockTech()"></label>
     <div class="actions"><button onclick="unlockTech()">Åbn teknisk opsætning</button></div>
   </div>
   <div id="setupTechnical">
     <label>Supabase URL<input id="url" value="${escapeHtml(c.supabaseUrl||"")}"></label><br><br>
     <label>Publishable key<input id="key" value="${escapeHtml(c.supabaseKey||"")}"></label>
     <div class="actions"><button class="primary" onclick="saveTechnicalSetup()">Gem og test</button></div>
   </div>
 </div>`;
}
function saveInitialsOnly(){
 const cfg=getConfig(); cfg.initials=document.getElementById("initials").value.trim(); saveConfig(cfg); toast("Initialer gemt.");
}
function unlockTech(){
 if(document.getElementById("setupPass").value!==ADMIN_PASSWORD) return toast("Forkert adgangskode.");
 document.getElementById("setupTechnical").classList.add("open");
 document.getElementById("techLocked").style.display="none";
}
async function saveTechnicalSetup(){
 const cfg=getConfig();
 cfg.initials=document.getElementById("initials").value.trim();
 cfg.supabaseUrl=document.getElementById("url").value.trim();
 cfg.supabaseKey=document.getElementById("key").value.trim();
 saveConfig(cfg);
 state.connected=initSupabase();
 try{await testConnection(); toast("Forbindelse OK"); await refresh(false, false); go("labselect")}
 catch(e){state.error=e.message;render()}
}

function labSelect(){
 return `${header("Lab reparationer","Vælg lab og type én gang for hele sendingen.")}
 <div class="card"><h3>1. Vælg laboratorium</h3><div class="option-grid">${LABS.map(l=>`<button class="option ${activeBtn(l,state.lab)}" onclick="state.lab='${l}';render()">${l}</button>`).join("")}</div>
 <h3>2. Vælg type</h3><div class="option-grid" style="grid-template-columns:repeat(2,1fr)">${TYPES.map(([v,l])=>`<button class="option ${activeBtn(v,state.sampleType)}" onclick="state.sampleType='${v}';render()">${l}</button>`).join("")}</div>
 <div class="actions"><button class="primary" onclick="go('labform')">Fortsæt</button></div></div>`;
}
function dataLists(){return `<datalist id="analyses">${ANALYSES.map(a=>`<option value="${escapeHtml(a)}"></option>`).join("")}</datalist><datalist id="reasons">${REASONS.map(r=>`<option value="${escapeHtml(r)}"></option>`).join("")}</datalist>`}
function topSendButton(fn){return `<div class="top-actions"><button class="primary" onclick="${fn}">Send udfyldte</button></div>`}
function labForm(){
 return `${header("Lab reparationer",`${state.lab} · ${labelType(state.sampleType)}`)}${dataLists()}
 <div class="card"><div class="toolbar"><div><b>Afsender:</b> ${state.lab} · <span class="pill ${state.sampleType}">${labelType(state.sampleType)}</span> · <b>Initialer:</b> ${escapeHtml(getConfig().initials||"")}</div>${topSendButton("submitLab()")}<button onclick="go('labselect')">Skift lab/type</button></div>
 <div id="warnings">${warningHtml()}</div>
 <div class="table-wrap"><table class="form-table"><thead><tr><th>#</th><th>Prøve</th><th>Kasse</th><th>Analyse</th><th>Bestems</th><th>Årsag</th><th>Kommentar</th><th>1. vejedato</th><th>Haster</th></tr></thead><tbody>${state.labDraft.slice(0,state.labRowCount).map((r,i)=>labRow(i,r)).join("")}</tbody></table></div>
 <div class="actions"><button onclick="addLabRows()">+ Tilføj 5 rækker</button><button class="primary" onclick="submitLab()">Send udfyldte</button></div></div>`;
}
function labRow(i,r){
 return `<tr><td>${i+1}</td>
 <td><input value="${escapeHtml(r.sample)}" data-row="${i}" data-f="sample" oninput="updateDraft('lab',this)" onkeydown="nextField(event)" onblur="checkDuplicate(${i})"></td>
 <td><input value="${escapeHtml(r.box)}" data-row="${i}" data-f="box" oninput="updateDraft('lab',this)" onkeydown="nextField(event)"></td>
 <td><input value="${escapeHtml(r.analysis)}" list="analyses" data-row="${i}" data-f="analysis" oninput="updateDraft('lab',this)" onkeydown="nextField(event)" onblur="checkDuplicate(${i})"></td>
 <td><input value="${escapeHtml(r.determinations)}" data-row="${i}" data-f="determinations" oninput="updateDraft('lab',this)" onkeydown="nextField(event)"></td>
 <td><input value="${escapeHtml(r.reason)}" list="reasons" data-row="${i}" data-f="reason" oninput="updateDraft('lab',this)" onkeydown="nextField(event)"></td>
 <td><textarea data-row="${i}" data-f="comment" oninput="updateDraft('lab',this)" onkeydown="nextField(event)">${escapeHtml(r.comment)}</textarea></td>
 <td><input type="date" value="${escapeHtml(r.first_weighing)}" data-row="${i}" data-f="first_weighing" oninput="updateDraft('lab',this)" onkeydown="nextField(event)"></td>
 <td><input type="checkbox" ${r.urgent?"checked":""} data-row="${i}" data-f="urgent" onchange="updateDraft('lab',this)" onkeydown="nextField(event)"></td></tr>`;
}
function updateDraft(kind,el){
 const arr=kind==="lab"?state.labDraft:state.sendDraft;
 const row=Number(el.dataset.row), f=el.dataset.f;
 arr[row][f]=el.type==="checkbox"?el.checked:el.value;
}
function addLabRows(){state.labRowCount+=5;ensureDrafts();render()}
function nextField(e){
 if(e.key!=="Enter")return;
 e.preventDefault();
 const fields=[...document.querySelectorAll("[data-row]")].filter(x=>x.offsetParent!==null);
 const idx=fields.indexOf(e.target);
 if(idx>=0&&idx<fields.length-1)fields[idx+1].focus();
}
function checkDuplicate(rowIndex){
 const r=state.labDraft[rowIndex];
 if(!r||!r.sample||!r.analysis)return;
 const dup=activeRows().find(x=>x.request_type==="reparation"&&x.sample===r.sample&&x.analysis===r.analysis&&isToday(x.created_at));
 r.warning = dup ? `Mulig dublet: ${dup.sample} / ${dup.analysis}. Sendt i dag af ${dup.initials||"ukendt"} fra ${dup.lab||"ukendt"} kl. ${new Date(dup.created_at).toLocaleTimeString("da-DK",{hour:"2-digit",minute:"2-digit"})}.` : "";
 const w=document.getElementById("warnings");
 if(w) w.innerHTML=warningHtml();
}
function warningHtml(){
 return state.labDraft.map(r=>r.warning).filter(Boolean).map(w=>`<div class="warn">${escapeHtml(w)}</div>`).join("");
}
function cfgInitials(){return getConfig().initials||""}
function completeLabRows(){
 return state.labDraft.slice(0,state.labRowCount).filter(r=>r.sample&&r.box&&r.analysis&&r.reason&&r.first_weighing);
}
async function submitLab(){
 const items=completeLabRows().map(r=>({request_type:"reparation",sample_type:state.sampleType,lab:state.lab,destination:null,grams:null,sample:r.sample,box:r.box,analysis:r.analysis,determinations:r.determinations||null,reason:r.reason,comment:r.comment||null,first_weighing:r.first_weighing,urgent:!!r.urgent,status:"ny",printed:false,initials:cfgInitials()}));
 if(!items.length)return toast("Ingen komplette rækker.");
 try{
   await insertRows(items);
   toast(`${items.length} sendt`);
   state.labDraft=[]; state.labRowCount=5; ensureDrafts();
   await refresh(false, false);
   go(state.sampleType==="jord"?"afvjord":"afvmat");
 }catch(e){state.error=e.message;render()}
}

function sendSelect(){
 return `${header("Send til","Vælg type og destination én gang for hele sendingen.")}
 <div class="card"><h3>1. Vælg type</h3><div class="option-grid" style="grid-template-columns:repeat(2,1fr)">${TYPES.map(([v,l])=>`<button class="option ${activeBtn(v,state.sampleType)}" onclick="state.sampleType='${v}';render()">${l}</button>`).join("")}</div>
 <h3>2. Vælg destination</h3><div class="option-grid">${DESTINATIONS.map(d=>`<button class="option ${activeBtn(d,state.destination)}" onclick="state.destination='${d}';render()">${d}</button>`).join("")}</div>
 <div class="actions"><button class="primary" onclick="go('sendform')">Fortsæt</button></div></div>`;
}
function sendForm(){
 return `${header("Send til",`${labelType(state.sampleType)} · ${state.destination}`)}
 <div class="card"><div class="toolbar"><div><b>Destination:</b> ${state.destination} · <span class="pill ${state.sampleType}">${labelType(state.sampleType)}</span> · <b>Initialer:</b> ${escapeHtml(getConfig().initials||"")}</div>${topSendButton("submitSendTil()")}<button onclick="go('sendselect')">Skift type/destination</button></div>
 <table><thead><tr><th>#</th><th>Prøve</th><th>Kasse</th><th>Gram</th><th>1. vejedato</th></tr></thead><tbody>${state.sendDraft.slice(0,state.sendRowCount).map((r,i)=>sendRow(i,r)).join("")}</tbody></table>
 <div class="actions"><button onclick="addSendRows()">+ Tilføj 5 rækker</button><button class="primary" onclick="submitSendTil()">Send udfyldte</button></div></div>`;
}
function sendRow(i,r){
 return `<tr><td>${i+1}</td>
 <td><input value="${escapeHtml(r.sample)}" data-row="${i}" data-f="sample" oninput="updateDraft('send',this)" onkeydown="nextField(event)"></td>
 <td><input value="${escapeHtml(r.box)}" data-row="${i}" data-f="box" oninput="updateDraft('send',this)" onkeydown="nextField(event)"></td>
 <td><input value="${escapeHtml(r.grams)}" data-row="${i}" data-f="grams" type="number" step="0.01" oninput="updateDraft('send',this)" onkeydown="nextField(event)"></td>
 <td><input type="date" value="${escapeHtml(r.first_weighing)}" data-row="${i}" data-f="first_weighing" oninput="updateDraft('send',this)" onkeydown="nextField(event)"></td></tr>`;
}
function addSendRows(){state.sendRowCount+=5;ensureDrafts();render()}
function completeSendRows(){
 return state.sendDraft.slice(0,state.sendRowCount).filter(r=>r.sample&&r.box&&r.grams&&r.first_weighing);
}
async function submitSendTil(){
 const items=completeSendRows().map(r=>({request_type:"send_til",sample_type:state.sampleType,lab:"Send til",destination:state.destination,grams:Number(r.grams),sample:r.sample,box:r.box,analysis:null,determinations:null,reason:null,comment:null,first_weighing:r.first_weighing,urgent:false,status:"ny",printed:false,initials:cfgInitials()}));
 if(!items.length)return toast("Ingen komplette rækker.");
 try{
   await insertRows(items);
   toast(`${items.length} sendt`);
   state.sendDraft=[]; state.sendRowCount=5; ensureDrafts();
   await refresh(false, false);
   go(state.sampleType==="jord"?"afvjord":"afvmat");
 }catch(e){state.error=e.message;render()}
}

function afv(type){
 const rep=activeRows().filter(r=>r.sample_type===type&&r.request_type==="reparation");
 const send=activeRows().filter(r=>r.sample_type===type&&r.request_type==="send_til");
 const all=[...rep,...send];
 return `${header("Afvejning "+labelType(type),`Alle ${labelType(type).toLowerCase()} opgaver. Reparationer og Send til vises i hver sin liste.`)}
 <div class="card"><div class="toolbar"><b>Alle opgaver (${all.length})</b><div>
   <button class="primary" onclick='printAllAndArchive("${type}")'>Print A4 samlet</button>
   <button class="amber" onclick='printLabelsForType("${type}")'>Print etiketter</button>
   <button class="green" onclick='archive(${JSON.stringify(all.map(x=>x.id))})'>Arkivér</button>
 </div></div><p class="subtitle">A4-print samler Reparationer og Send til på samme papir for ${labelType(type)}.</p></div>
 <div class="card"><div class="toolbar"><b>Reparationer (${rep.length})</b><div>
   <button class="primary" onclick='printAndArchive(${JSON.stringify(rep.map(x=>x.id))},"Reparationer ${labelType(type)}")'>Print A4</button>
   <button class="amber" onclick='printLabelsForIds(${JSON.stringify(rep.map(x=>x.id))},"Etiketter ${labelType(type)}")'>Print etiketter</button>
 </div></div>${tableRep(rep)}</div>
 <div class="card"><div class="toolbar"><b>Send til (${send.length})</b><div>
   <button class="primary" onclick='printAndArchive(${JSON.stringify(send.map(x=>x.id))},"Send til ${labelType(type)}")'>Print A4</button>
 </div></div>${tableSend(send)}</div>`;
}
function tableRep(rows){
 if(!rows.length)return "<p class='subtitle'>Ingen data</p>";
 return `<table><thead><tr><th>Lab</th><th>Prøve</th><th>Kasse</th><th>Analyse</th><th>Bestems</th><th>Årsag</th><th>Initialer</th><th>Sendt</th><th>Haster</th></tr></thead><tbody>${rows.map(r=>`<tr><td>${r.lab}</td><td><b>${r.sample}</b></td><td>${r.box||""}</td><td>${r.analysis||""}</td><td>${r.determinations||""}</td><td>${r.reason||""}</td><td>${r.initials||""}</td><td>${r.created_at?new Date(r.created_at).toLocaleString("da-DK"):""}</td><td>${r.urgent?"<span class='pill red'>Haster</span>":""}</td></tr>`).join("")}</tbody></table>`;
}
function tableSend(rows){
 if(!rows.length)return "<p class='subtitle'>Ingen data</p>";
 return `<table><thead><tr><th>Destination</th><th>Prøve</th><th>Kasse</th><th>Gram</th><th>Initialer</th><th>1. vejedato</th></tr></thead><tbody>${rows.map(r=>`<tr><td>${r.destination||""}</td><td><b>${r.sample}</b></td><td>${r.box||""}</td><td>${r.grams||""} g</td><td>${r.initials||""}</td><td>${r.first_weighing||""}</td></tr>`).join("")}</tbody></table>`;
}
async function printAndArchive(ids,title){
 const rows=state.rows.filter(r=>ids.includes(r.id));
 if(!rows.length)return toast("Ingen rækker til print.");
 printRows(rows,title);
 try{
   await updateRows(ids,{printed:true,printed_at:new Date().toISOString(),printed_by:"Afvejning",status:"arkiv",archive_date:new Date().toISOString(),archive_by:"Print"});
   toast("Printet og flyttet til arkiv");
   await refresh(false,true);
 }catch(e){state.error=e.message;render()}
}

async function printAllAndArchive(type){
 const rows=activeRows().filter(r=>r.sample_type===type);
 const ids=rows.map(r=>r.id);
 if(!rows.length)return toast("Ingen rækker til print.");
 printRows(rows,`Afvejning ${labelType(type)} - samlet`);
 try{
   await updateRows(ids,{printed:true,printed_at:new Date().toISOString(),printed_by:"Afvejning",status:"arkiv",archive_date:new Date().toISOString(),archive_by:"Print"});
   toast("Printet samlet og flyttet til arkiv");
   await refresh(false,true);
 }catch(e){state.error=e.message;render()}
}

function printLabelsForType(type){
 const rows=activeRows().filter(r=>r.sample_type===type && r.request_type==="reparation");
 printLabels(rows,`Etiketter ${labelType(type)}`);
}

function printLabelsForIds(ids,title){
 const rows=state.rows.filter(r=>ids.includes(r.id));
 printLabels(rows,title);
}

async function archive(ids){
 if(!ids.length)return toast("Ingen rækker.");
 try{await updateRows(ids,{status:"arkiv",archive_date:new Date().toISOString(),archive_by:"Afvejning"});toast("Flyttet til arkiv");await refresh(false,true)}
 catch(e){state.error=e.message;render()}
}
function archiveView(){
 const rows=state.rows.filter(r=>(r.status||"ny")==="arkiv");
 return `${header("Arkiv","Ét fælles arkiv.")}<div class="card">${tableArchive(rows)}</div>`;
}
function tableArchive(rows){
 if(!rows.length)return "<p class='subtitle'>Ingen arkivdata</p>";
 return `<table><thead><tr><th>Type</th><th>Request</th><th>Afsender</th><th>Prøve</th><th>Analyse/Destination</th><th>Initialer</th><th>Arkiveret</th></tr></thead><tbody>${rows.map(r=>`<tr><td>${labelType(r.sample_type)}</td><td>${r.request_type}</td><td>${r.lab}</td><td>${r.sample}</td><td>${r.analysis||r.destination||""}</td><td>${r.initials||""}</td><td>${r.archive_date?new Date(r.archive_date).toLocaleString("da-DK"):""}</td></tr>`).join("")}</tbody></table>`;
}
function dashboardView(){
 const active=activeRows();
 const archive=state.rows.filter(r=>(r.status||"ny")==="arkiv");
 return `${header("Dashboard","Overblik.")}
 <div class="cards"><div class="card"><div class="metric">${active.length}</div><div class="label">Nye total</div></div><div class="card"><div class="metric">${active.filter(r=>r.sample_type==="jord").length}</div><div class="label">Jord</div></div><div class="card"><div class="metric">${active.filter(r=>r.sample_type==="materialer").length}</div><div class="label">Materialer</div></div><div class="card"><div class="metric">${archive.length}</div><div class="label">Arkiv</div></div></div>
 <div class="card"><h3>Top analyser</h3>${topList(active.filter(r=>r.analysis), "analysis")}</div>
 <div class="card"><h3>Top årsager</h3>${topList(active.filter(r=>r.reason), "reason")}</div>`;
}
function topList(rows,key){
 const counts={}; rows.forEach(r=>counts[r[key]]=(counts[r[key]]||0)+1);
 const arr=Object.entries(counts).sort((a,b)=>b[1]-a[1]).slice(0,8);
 if(!arr.length)return "<p class='subtitle'>Ingen data</p>";
 return `<table><tbody>${arr.map(([k,v])=>`<tr><td>${escapeHtml(k)}</td><td><b>${v}</b></td></tr>`).join("")}</tbody></table>`;
}
