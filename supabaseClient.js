/* OMW LabRepair v2.0 — Supabase client, config, realtime */

const CONFIG_KEYS = [
  "omw_labrepair_config_v15",
  "omw_labrepair_config_v14",
  "omw_labrepair_config_v13",
  "omw_labrepair_config_v12",
  "omw_labrepair_config_v11",
  "omw_labrepair_config_v1"
];
const CONFIG_KEY = "omw_labrepair_config_v15";

function normalizeSupabaseUrl(url) {
  return String(url || "").trim().replace(/\/rest\/v1\/?$/i, "").replace(/\/+$/, "");
}

function getConfig() {
  for (const key of CONFIG_KEYS) {
    try {
      const saved = localStorage.getItem(key);
      if (saved) {
        const parsed = JSON.parse(saved);
        return {
          supabaseUrl: normalizeSupabaseUrl(parsed.supabaseUrl || window.OMW_DEFAULT_CONFIG.supabaseUrl || ""),
          supabaseKey: parsed.supabaseKey || window.OMW_DEFAULT_CONFIG.supabaseKey || "",
          initials: parsed.initials || "",
          workstation: parsed.workstation || "",
          zebraIp: parsed.zebraIp || ""
        };
      }
    } catch {}
  }
  return {
    supabaseUrl: normalizeSupabaseUrl(window.OMW_DEFAULT_CONFIG.supabaseUrl || ""),
    supabaseKey: window.OMW_DEFAULT_CONFIG.supabaseKey || "",
    initials: "",
    workstation: "",
    zebraIp: ""
  };
}

function saveConfig(config) {
  const clean = {
    supabaseUrl: normalizeSupabaseUrl(config.supabaseUrl || ""),
    supabaseKey: config.supabaseKey || "",
    initials: config.initials || "",
    workstation: config.workstation || "",
    zebraIp: (config.zebraIp || "").trim()
  };
  localStorage.setItem(CONFIG_KEY, JSON.stringify(clean));
}

let supabaseClient = null;
let realtimeChannel = null;

function initSupabase() {
  const cfg = getConfig();
  if (!cfg.supabaseUrl || !cfg.supabaseKey || !window.supabase) {
    supabaseClient = null;
    return false;
  }
  supabaseClient = window.supabase.createClient(cfg.supabaseUrl, cfg.supabaseKey);
  return true;
}

/* Realtime: one subscription for the whole app.
   Requires "repairs" to be added to the supabase_realtime publication
   (Supabase → Database → Replication). Falls back silently to polling if not. */
function subscribeRealtime(onEvent) {
  if (!supabaseClient) return;
  try {
    if (realtimeChannel) {
      supabaseClient.removeChannel(realtimeChannel);
      realtimeChannel = null;
    }
    realtimeChannel = supabaseClient
      .channel("omw-repairs")
      .on("postgres_changes", { event: "*", schema: "public", table: "repairs" },
        payload => { try { onEvent(payload); } catch (e) { console.error(e); } })
      .subscribe();
  } catch (e) {
    console.warn("Realtime ikke tilgængelig, bruger polling.", e);
  }
}

async function testConnection() {
  if (!supabaseClient) throw new Error("Supabase er ikke sat op.");
  const { error } = await supabaseClient.from("repairs").select("id").limit(1);
  if (error) throw error;
  return true;
}

/* Henter alle AKTIVE rækker + arkiv fra de seneste ~13 måneder.
   Dashboardets 12-måneders graf forbliver komplet, men forespørgslen
   vokser ikke ubegrænset med årene (performance i produktion). */
async function fetchRepairs() {
  if (!supabaseClient) throw new Error("Supabase er ikke sat op.");

  const cutoff = new Date(Date.now() - 396 * 24 * 3600 * 1000).toISOString();

  const { data, error } = await supabaseClient
    .from("repairs")
    .select("*")
    .gte("created_at", cutoff)
    .order("created_at", { ascending: false });

  if (error) throw error;

  return data || [];
}

/* Sikkerhedsvagt: en service_role-nøgle må ALDRIG bruges i browseren
   (den omgår al RLS). Afvis den ved opsætning. */
function looksLikeServiceRoleKey(key) {
  try {
    const payload = JSON.parse(atob(String(key).split(".")[1].replace(/-/g, "+").replace(/_/g, "/")));
    return payload.role === "service_role";
  } catch { return false; }
}

async function insertRows(rows) {
  if (!supabaseClient) throw new Error("Supabase er ikke sat op.");
  const { error } = await supabaseClient.from("repairs").insert(rows);
  if (error) throw error;
}

async function updateRows(ids, values) {
  if (!supabaseClient) throw new Error("Supabase er ikke sat op.");
  if (!ids.length) return;
  const { error } = await supabaseClient.from("repairs").update(values).in("id", ids);
  if (error) throw error;
}
