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
          initials: parsed.initials || ""
        };
      }
    } catch {}
  }
  return {
    supabaseUrl: normalizeSupabaseUrl(window.OMW_DEFAULT_CONFIG.supabaseUrl || ""),
    supabaseKey: window.OMW_DEFAULT_CONFIG.supabaseKey || "",
    initials: ""
  };
}

function saveConfig(config) {
  const clean = {
    supabaseUrl: normalizeSupabaseUrl(config.supabaseUrl || ""),
    supabaseKey: config.supabaseKey || "",
    initials: config.initials || ""
  };
  localStorage.setItem(CONFIG_KEY, JSON.stringify(clean));
}

let supabaseClient = null;

function initSupabase() {
  const cfg = getConfig();
  if (!cfg.supabaseUrl || !cfg.supabaseKey || !window.supabase) {
    supabaseClient = null;
    return false;
  }
  supabaseClient = window.supabase.createClient(cfg.supabaseUrl, cfg.supabaseKey);
  return true;
}

async function testConnection() {
  if (!supabaseClient) throw new Error("Supabase er ikke sat op.");
  const { error } = await supabaseClient.from("repairs").select("id").limit(1);
  if (error) throw error;
  return true;
}

async function fetchRepairs() {
  if (!supabaseClient) throw new Error("Supabase er ikke sat op.");
  const { data, error } = await supabaseClient
    .from("repairs")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data || [];
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
