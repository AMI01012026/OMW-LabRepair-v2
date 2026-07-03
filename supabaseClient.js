const CONFIG_KEY = "omw_labrepair_config_v13";

function getConfig() {
  try {
    const saved = localStorage.getItem(CONFIG_KEY);
    if (saved) return JSON.parse(saved);
  } catch {}
  return {
    supabaseUrl: window.OMW_DEFAULT_CONFIG.supabaseUrl || "",
    supabaseKey: window.OMW_DEFAULT_CONFIG.supabaseKey || "",
    initials: ""
  };
}

function saveConfig(config) {
  localStorage.setItem(CONFIG_KEY, JSON.stringify(config));
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