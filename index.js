/**
 * Z Agent by Picolas - v4.4 FIX ESTABLE
 * OpenRouter con fallback múltiple + filtro de actions inválidas.
 *
 * Orden recomendado:
 * 1. GLM 4.5 Air Free       -> principal, porque funciona estable
 * 2. Qwen3 Coder Free       -> bueno para código, pero puede tirar 429
 * 3. DeepSeek V4 Flash      -> sin :free, puede requerir créditos
 * 4. OpenRouter Auto        -> último fallback
 */

const fs   = require("fs");
const path = require("path");
const os   = require("os");
const rl_  = require("readline");
const cp   = require("child_process");

const ROOT         = process.cwd();
const ZDIR         = path.join(ROOT, ".zagent");
const HISTORY_FILE = path.join(ZDIR, "history.json");
const ENV_FILE     = path.join(ROOT, ".env");

// ─── PALETA ───────────────────────────────────────────────────────────────────
const C = {
  reset:"\x1b[0m", bold:"\x1b[1m", dim:"\x1b[2m",
  red:"\x1b[31m", green:"\x1b[32m", yellow:"\x1b[33m",
  blue:"\x1b[34m", cyan:"\x1b[36m", orange:"\x1b[38;5;208m",
  gray:"\x1b[90m", white:"\x1b[97m", purple:"\x1b[35m",
};

const col = (k, t) => `${C[k] || ""}${t}${C.reset}`;

// ─── MODELOS ──────────────────────────────────────────────────────────────────
const MODELS = {
  code_hard: {
    id:    "z-ai/glm-4.5-air:free",
    label: "GLM 4.5 Air Free",
    icon:  "🌬️",
    desc:  "Principal estable para código y análisis",
  },

  code_med: {
    id:    "z-ai/glm-4.5-air:free",
    label: "GLM 4.5 Air Free",
    icon:  "🌬️",
    desc:  "Principal estable para desarrollo",
  },

  code_easy: {
    id:    "z-ai/glm-4.5-air:free",
    label: "GLM 4.5 Air Free",
    icon:  "🌬️",
    desc:  "Chat rápido gratis",
  },

  fallback: {
    id:    "openrouter/auto",
    label: "OpenRouter Auto",
    icon:  "🔀",
    desc:  "Fallback automático",
  },
};

const FALLBACK_MODELS = [
  {
    id: "z-ai/glm-4.5-air:free",
    label: "GLM 4.5 Air Free",
    icon: "🌬️",
  },
  {
    id: "qwen/qwen3-coder:free",
    label: "Qwen3 Coder Free",
    icon: "💻",
  },
  {
    id: "deepseek/deepseek-v4-flash",
    label: "DeepSeek V4 Flash",
    icon: "⚡",
  },
  {
    id: "openrouter/auto",
    label: "OpenRouter Auto",
    icon: "🔀",
  },
];

// ─── TOOLS VÁLIDAS ────────────────────────────────────────────────────────────
const VALID_TOOLS = new Set([
  "list_files",
  "read_file",
  "write_file",
  "patch_file",
  "append_file",
  "mkdir",
  "delete_path",
  "move_path",
  "search_files",
  "run_command",
  "git_status",
  "git_diff",
  "git_log",
  "web_search",
]);

// ─── CLASIFICADOR DE PROMPT ───────────────────────────────────────────────────
const SIGNALS = {
  code: [
    "código","codigo","función","funcion","script","bug","error","fix","arreglá","arregla",
    "implementá","implementa","creame","crea","archivo","component","api","endpoint","clase",
    "variable","array","loop","promise","async","await","node","react","python","javascript",
    "typescript","html","css","sql","json","express","database","query","import",
    "export","instala","package","npm","pip","git","docker","test","testing","debug",
    "refactor","optimize","optimizá","rendimiento","performance","módulo","modulo",
  ],
  hard: [
    "arquitectura","refactor","optimizá","optimiza","benchmark","concurrenc","design pattern",
    "security","autenticaci","deploy","microservic","websocket","oauth","jwt","encryption",
    "algoritmo","algorithm","complejidad","complexity","debug profundo","stack trace",
    "memory leak","race condition","deadlock","distribuido","escalab","kubernetes",
    "analizá","analiza el","revisá","revisa","cómo funciona","explica el",
  ],
  easy: [
    "simple","básico","basico","ejemplo","hola mundo","template","boilerplate","snippet",
    "función simple","print","console.log","suma","resta","lista de","array de",
    "hola","qué","cómo estás","que es","que hace","explicame","definí","definicion",
  ],
};

function classifyPrompt(input) {
  const low = input.toLowerCase();
  const codeHits = SIGNALS.code.filter(s => low.includes(s)).length;
  const hardHits = SIGNALS.hard.filter(s => low.includes(s)).length;
  const easyHits = SIGNALS.easy.filter(s => low.includes(s)).length;
  const lenBonus = input.length > 300 ? 2 : input.length > 150 ? 1 : 0;

  if (codeHits === 0 && hardHits === 0) return "code_easy";

  const score = hardHits * 3 + codeHits + lenBonus - easyHits * 2;

  if (score >= 5) return "code_hard";
  if (score >= 2) return "code_med";

  return "code_easy";
}

function pickModel(input) {
  const cls = classifyPrompt(input);
  return { model: MODELS[cls], cls };
}

// ─── ENV ──────────────────────────────────────────────────────────────────────
function loadEnv() {
  if (!fs.existsSync(ENV_FILE)) return;

  for (const line of fs.readFileSync(ENV_FILE, "utf8").split(/\r?\n/)) {
    const t = line.trim();

    if (!t || t.startsWith("#")) continue;

    const idx = t.indexOf("=");
    if (idx < 0) continue;

    const key = t.slice(0, idx).trim();
    const val = t.slice(idx + 1).trim().replace(/^["']|["']$/g, "");

    if (!process.env[key]) process.env[key] = val;
  }
}

function saveEnv(updates) {
  let lines = fs.existsSync(ENV_FILE)
    ? fs.readFileSync(ENV_FILE, "utf8")
        .split(/\r?\n/)
        .filter(l => !updates.hasOwnProperty(l.split("=")[0]?.trim()))
    : [];

  for (const [k, v] of Object.entries(updates)) {
    lines.push(`${k}=${v}`);
  }

  fs.writeFileSync(ENV_FILE, lines.filter(Boolean).join(os.EOL) + os.EOL, "utf8");
}

// ─── READLINE ─────────────────────────────────────────────────────────────────
function createRl() {
  return rl_.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
}

function ask(rl, q) {
  return new Promise(resolve => rl.question(q, resolve));
}

// ─── SPLASH ───────────────────────────────────────────────────────────────────
function splash() {
  console.clear();

  const logo = [
    "███████╗     █████╗  ██████╗ ███████╗███╗   ██╗████████╗",
    "╚══███╔╝    ██╔══██╗██╔════╝ ██╔════╝████╗  ██║╚══██╔══╝",
    "  ███╔╝     ███████║██║  ███╗█████╗  ██╔██╗ ██║   ██║   ",
    " ███╔╝      ██╔══██║██║   ██║██╔══╝  ██║╚██╗██║   ██║   ",
    "███████╗    ██║  ██║╚██████╔╝███████╗██║ ╚████║   ██║   ",
    "╚══════╝    ╚═╝  ╚═╝ ╚═════╝ ╚══════╝╚═╝  ╚═══╝   ╚═╝   ",
  ];

  console.log(col("orange","╭────────────────────────────────────────────────────────────╮"));
  console.log(
    col("orange","│") +
    col("gray","  Z Agent by Picolas") +
    col("cyan","  v4.4 FIX") +
    col("gray","  · OpenRouter fallback") +
    " ".repeat(9) +
    col("orange","│")
  );
  console.log(col("orange","├────────────────────────────────────────────────────────────┤"));

  for (const line of logo) {
    console.log(col("orange","│ ") + col("orange", line.padEnd(58)) + col("orange"," │"));
  }

  console.log(col("orange","├────────────────────────────────────────────────────────────┤"));

  const modelLines = [
    ` 🌬️ Principal     → GLM 4.5 Air Free`,
    ` 💻 Fallback      → Qwen3 Coder Free`,
    ` ⚡ Opcional      → DeepSeek V4 Flash`,
    ` 🔀 Último        → OpenRouter Auto`,
  ];

  for (const l of modelLines) {
    console.log(col("orange","│") + col("dim", l.padEnd(60)) + col("orange","│"));
  }

  console.log(col("orange","╰────────────────────────────────────────────────────────────╯"));
  console.log("");
}

// ─── API ──────────────────────────────────────────────────────────────────────
async function callOpenRouter(messages, modelId) {
  const key = process.env.OPENROUTER_API_KEY;

  if (!key) {
    throw new Error("Falta OPENROUTER_API_KEY en .env");
  }

  const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      authorization:  `Bearer ${key}`,
      "content-type": "application/json",
      "http-referer": "https://github.com/picolasYT/Z-Agent-Picolas",
      "x-title":      "Z Agent by Picolas",
    },
    body: JSON.stringify({
      model: modelId,
      temperature: 0.15,
      messages,
    }),
  });

  const text = await res.text();

  if (!res.ok) {
    let msg = `OpenRouter ${res.status}`;

    try {
      const parsed = JSON.parse(text);
      const apiMsg = parsed?.error?.message || parsed?.message;
      if (apiMsg) msg += `: ${apiMsg}`;
    } catch {
      if (text) msg += `: ${text.slice(0, 200)}`;
    }

    const retryAfter = res.headers.get("retry-after");
    if (retryAfter) msg += ` | Retry-After: ${retryAfter}s`;

    throw new Error(msg);
  }

  let data;

  try {
    data = JSON.parse(text);
  } catch {
    throw new Error("OpenRouter devolvió una respuesta inválida/no JSON.");
  }

  if (data.error) {
    throw new Error(`OpenRouter: ${data.error.message}`);
  }

  return data.choices?.[0]?.message?.content || "";
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function uniqueModels(primaryModel) {
  const customModel = process.env.Z_AGENT_MODEL?.trim();

  const list = [
    customModel
      ? {
          id: customModel,
          label: `Custom: ${customModel}`,
          icon: "⭐",
        }
      : null,
    primaryModel,
    ...FALLBACK_MODELS,
  ].filter(Boolean);

  const seen = new Set();

  return list.filter(m => {
    if (!m?.id || seen.has(m.id)) return false;
    seen.add(m.id);
    return true;
  });
}

function shouldTryNextModel(err) {
  const msg = String(err?.message || "").toLowerCase();

  return (
    msg.includes("429") ||
    msg.includes("404") ||
    msg.includes("402") ||
    msg.includes("400") ||
    msg.includes("rate") ||
    msg.includes("limit") ||
    msg.includes("provider returned error") ||
    msg.includes("no endpoints") ||
    msg.includes("not found") ||
    msg.includes("insufficient credits") ||
    msg.includes("temporarily") ||
    msg.includes("overloaded")
  );
}

async function callAI(messages, userInput) {
  const { model: primaryModel } = pickModel(userInput);
  const candidates = uniqueModels(primaryModel);

  let lastError = null;

  for (const model of candidates) {
    process.stdout.write(`  ${col("dim", `${model.icon || "🤖"} ${model.label}`)} `);

    const frames = ["⠋","⠙","⠹","⠸","⠼","⠴","⠦","⠧","⠇","⠏"];
    let fi = 0;

    const spin = setInterval(() => {
      process.stdout.write(
        `\r  ${col("dim", `${model.icon || "🤖"} ${model.label}`)} ${col("gray", frames[fi++ % frames.length])}  `
      );
    }, 80);

    try {
      const result = await callOpenRouter(messages, model.id);

      clearInterval(spin);

      process.stdout.write(
        `\r  ${col("dim", `${model.icon || "🤖"} ${model.label}`)} ${col("green","✓")}   \n`
      );

      return { result, model };

    } catch (err) {
      clearInterval(spin);

      lastError = err;

      const msg = err.message || "Error desconocido";

      process.stdout.write(
        `\r  ${col("red", `✗ ${model.label} falló`)}: ${msg.slice(0, 120)}\n`
      );

      if (shouldTryNextModel(err)) {
        process.stdout.write(`  ${col("yellow","→ Probando otro modelo...")}\n`);
        await sleep(1000);
        continue;
      }

      process.stdout.write(`  ${col("yellow","→ Error inesperado. Probando otro modelo igual...")}\n`);
      await sleep(1000);
    }
  }

  throw new Error(`Todos los modelos fallaron. Último error: ${lastError?.message || "desconocido"}`);
}

// ─── FILESYSTEM ───────────────────────────────────────────────────────────────
function safe(p = ".") {
  const abs = path.resolve(ROOT, p);
  const rel = path.relative(ROOT, abs);

  if (rel.startsWith("..") || path.isAbsolute(rel)) {
    throw new Error("Ruta fuera del proyecto.");
  }

  return abs;
}

const IGNORED = new Set([
  "node_modules",
  ".git",
  ".zagent",
  "dist",
  "build",
  ".next",
  ".cache",
  "__pycache__",
  ".venv",
  "coverage",
]);

function listTree(dir, maxD = 3, d = 0, pfx = "") {
  const abs = safe(dir);

  if (!fs.existsSync(abs)) return "(no existe)";

  const entries = fs.readdirSync(abs, { withFileTypes: true })
    .filter(e => !IGNORED.has(e.name))
    .sort((a, b) => {
      return Number(b.isDirectory()) - Number(a.isDirectory()) || a.name.localeCompare(b.name);
    })
    .slice(0, 80);

  let out = "";

  for (const e of entries) {
    out += `${pfx}${e.isDirectory() ? "📁" : "📄"} ${e.name}\n`;

    if (e.isDirectory() && d < maxD) {
      out += listTree(
        path.relative(ROOT, path.join(abs, e.name)),
        maxD,
        d + 1,
        pfx + "  "
      );
    }
  }

  return out || "(vacío)";
}

function walk(dir, acc = []) {
  if (!fs.existsSync(safe(dir))) return acc;

  for (const e of fs.readdirSync(safe(dir), { withFileTypes: true })) {
    if (IGNORED.has(e.name)) continue;

    const rel = path.relative(ROOT, path.join(safe(dir), e.name));

    if (e.isDirectory()) {
      walk(rel, acc);
    } else {
      acc.push(rel);
    }
  }

  return acc;
}

function readFile(p) {
  const abs = safe(p);

  if (!fs.existsSync(abs)) {
    throw new Error(`No existe: ${p}`);
  }

  if (fs.statSync(abs).size > 300_000) {
    throw new Error("Archivo muy grande.");
  }

  return fs.readFileSync(abs, "utf8");
}

function writeFile(p, content) {
  const abs = safe(p);
  let diffInfo = "";

  if (fs.existsSync(abs)) {
    const old = fs.readFileSync(abs, "utf8").split("\n");
    const nw  = content.split("\n");

    const added   = nw.filter(l => !old.includes(l)).length;
    const removed = old.filter(l => !nw.includes(l)).length;

    diffInfo = `  ${col("green","+" + added)} ${col("red","-" + removed)}`;
  } else {
    diffInfo = `  ${col("green","nuevo")}`;
  }

  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, content, "utf8");

  return `Escrito: ${p}${diffInfo}`;
}

function patchFile(p, oldStr, newStr) {
  const abs = safe(p);

  if (!fs.existsSync(abs)) {
    throw new Error(`No existe: ${p}`);
  }

  if (typeof oldStr !== "string" || typeof newStr !== "string") {
    throw new Error("patch_file necesita args.old y args.new como texto.");
  }

  const src = fs.readFileSync(abs, "utf8");

  if (!src.includes(oldStr)) {
    throw new Error("Bloque 'old' no encontrado en el archivo.");
  }

  fs.writeFileSync(abs, src.replace(oldStr, newStr), "utf8");

  return `Parchado: ${p}`;
}

function run(cmd) {
  if (!cmd || typeof cmd !== "string") {
    throw new Error("run_command necesita args.cmd");
  }

  return cp.execSync(cmd, {
    cwd: ROOT,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    timeout: 120_000,
    windowsHide: true,
  });
}

async function webSearch(q) {
  if (!q) return "Consulta vacía.";

  const res = await fetch(`https://duckduckgo.com/html/?q=${encodeURIComponent(q)}`, {
    headers: {
      "user-agent": "Mozilla/5.0 Z-Agent",
    },
  });

  const html = await res.text();
  const out = [];

  const re = /<a rel="nofollow" class="result__a" href="([^"]+)">([\s\S]*?)<\/a>/g;

  let m;

  while ((m = re.exec(html)) && out.length < 5) {
    out.push({
      title: m[2].replace(/<[^>]+>/g, "").trim(),
      href: m[1].replace(/&amp;/g, "&"),
    });
  }

  return JSON.stringify(out, null, 2);
}

async function executeAction(action) {
  if (!action || typeof action.tool !== "string") {
    throw new Error("Action inválida: falta tool.");
  }

  if (!VALID_TOOLS.has(action.tool)) {
    throw new Error(`Tool desconocida: ${action.tool}`);
  }

  const a = action.args || {};

  switch (action.tool) {
    case "list_files":
      return listTree(a.path || ".", 3);

    case "read_file":
      return readFile(a.path);

    case "write_file":
      return writeFile(a.path, a.content || "");

    case "patch_file":
      return patchFile(a.path, a.old, a.new);

    case "append_file": {
      const abs = safe(a.path);

      fs.mkdirSync(path.dirname(abs), { recursive: true });
      fs.appendFileSync(abs, a.content || "", "utf8");

      return `Append en: ${a.path}`;
    }

    case "mkdir": {
      fs.mkdirSync(safe(a.path), { recursive: true });
      return `Carpeta: ${a.path}`;
    }

    case "delete_path": {
      if (!fs.existsSync(safe(a.path))) return "No existe.";

      fs.rmSync(safe(a.path), {
        recursive: true,
        force: true,
      });

      return `Eliminado: ${a.path}`;
    }

    case "move_path": {
      const from = safe(a.from);
      const to   = safe(a.to);

      fs.mkdirSync(path.dirname(to), { recursive: true });
      fs.renameSync(from, to);

      return `Movido: ${a.from} → ${a.to}`;
    }

    case "search_files": {
      const q = String(a.query || "").toLowerCase();
      const hits = [];

      for (const f of walk(".")) {
        if (f.toLowerCase().includes(q)) {
          hits.push(f);
          continue;
        }

        try {
          const st = fs.statSync(safe(f));

          if (
            st.size < 200_000 &&
            fs.readFileSync(safe(f), "utf8").toLowerCase().includes(q)
          ) {
            hits.push(f);
          }
        } catch {}

        if (hits.length >= 40) break;
      }

      return hits.join("\n") || "Sin resultados.";
    }

    case "run_command":
      return run(a.cmd);

    case "git_status":
      return run("git status --short 2>&1 || echo 'no git'");

    case "git_diff":
      return run("git diff --stat HEAD 2>&1 || git diff -- . 2>&1");

    case "git_log":
      return run("git log --oneline -10 2>&1 || echo 'no git'");

    case "web_search":
      return await webSearch(a.query);

    default:
      throw new Error(`Tool desconocida: ${action.tool}`);
  }
}

// ─── SYSTEM PROMPT ────────────────────────────────────────────────────────────
function systemPrompt() {
  return `Sos Z Agent by Picolas, un agente de terminal para desarrollo de software similar a Claude Code, Codex u OpenCode.
Workspace: ${ROOT}

RESPUESTA:
SIEMPRE devolvé JSON estricto, sin markdown, sin texto afuera del JSON.

FORMATO OBLIGATORIO SI VAS A USAR TOOLS:
{
  "actions": [
    {
      "tool": "write_file",
      "args": {
        "path": "index.html",
        "content": "contenido completo del archivo"
      }
    }
  ],
  "final": null
}

FORMATO OBLIGATORIO SI NO VAS A USAR TOOLS:
{
  "actions": [],
  "final": "respuesta en español"
}

REGLAS IMPORTANTES:
- Cada action DEBE tener "tool" y "args".
- Nunca devuelvas actions vacías como {}, null o sin tool.
- Nunca devuelvas "tool": null.
- Nunca devuelvas "tool": undefined.
- Nunca inventes nombres de tools.
- Si querés crear archivos, usá write_file.
- Si querés crear carpetas, usá mkdir.
- Si querés leer archivos, usá read_file.
- Si querés listar archivos, usá list_files.
- Si no necesitás herramientas, actions debe ser [].
- Para proyectos nuevos: creá TODOS los archivos necesarios en una sola respuesta cuando sea posible.
- Para bugs: primero leé el archivo, luego parcheá o reescribí.
- Código siempre completo y funcional.
- Respondé siempre en español.
- No expliques que sos una IA a menos que te pregunten.
- No inventes archivos si podés listarlos o leerlos primero.
- No borres archivos salvo que el usuario lo pida claramente.

TOOLS DISPONIBLES:
1.  list_files    { "path": "." }
2.  read_file     { "path": "src/index.js" }
3.  write_file    { "path": "src/app.js", "content": "código" }
4.  patch_file    { "path": "src/app.js", "old": "texto exacto", "new": "reemplazo" }
5.  append_file   { "path": "log.txt", "content": "línea" }
6.  mkdir         { "path": "src/components" }
7.  delete_path   { "path": "viejo.js" }
8.  move_path     { "from": "old.js", "to": "new.js" }
9.  search_files  { "query": "useState" }
10. run_command   { "cmd": "npm install" }
11. git_status    {}
12. git_diff      {}
13. git_log       {}
14. web_search    { "query": "express cors docs" }`;
}

// ─── CONFIRMACIÓN ─────────────────────────────────────────────────────────────
const SAFE_TOOLS = new Set([
  "list_files",
  "read_file",
  "search_files",
  "git_status",
  "git_diff",
  "git_log",
  "web_search",
]);

const RISKY_TOOLS = new Set([
  "delete_path",
  "run_command",
]);

async function confirmAction(rl, action, autoMode) {
  if (!action || typeof action.tool !== "string") return false;

  if (SAFE_TOOLS.has(action.tool)) return true;

  if (autoMode && !RISKY_TOOLS.has(action.tool)) return true;

  if (RISKY_TOOLS.has(action.tool)) {
    const icon = action.tool === "delete_path"
      ? col("red","🗑")
      : col("yellow","⚡");

    const detail = action.tool === "run_command"
      ? action.args?.cmd
      : action.args?.path;

    console.log(`\n  ${icon} ${col("bold", action.tool)}: ${col("white", detail || "")}`);

    const ans = (await ask(
      rl,
      `  ${col("orange","¿Continuar? (s/n) > ")}`
    )).trim().toLowerCase();

    return ["s", "si", "sí", "y", "yes", ""].includes(ans);
  }

  return true;
}

// ─── JSON PARSER ──────────────────────────────────────────────────────────────
function parseJson(text) {
  const raw = String(text || "").trim();

  const clean = raw
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/```\s*$/i, "")
    .trim();

  try {
    return JSON.parse(clean);
  } catch {}

  const s = clean.indexOf("{");
  const e = clean.lastIndexOf("}");

  if (s !== -1 && e !== -1 && e > s) {
    try {
      return JSON.parse(clean.slice(s, e + 1));
    } catch {}
  }

  return {
    actions: [],
    final: clean || "Listo.",
  };
}

function normalizeActions(parsed) {
  if (!parsed || !Array.isArray(parsed.actions)) return [];

  return parsed.actions.filter(action => {
    if (!action) return false;
    if (typeof action !== "object") return false;
    if (typeof action.tool !== "string") return false;
    if (!VALID_TOOLS.has(action.tool)) return false;
    if (!action.args || typeof action.args !== "object") {
      action.args = {};
    }
    return true;
  });
}

// ─── HISTORIAL ────────────────────────────────────────────────────────────────
function ensureZDir() {
  if (!fs.existsSync(ZDIR)) {
    fs.mkdirSync(ZDIR, { recursive: true });
  }
}

function loadHistory() {
  try {
    ensureZDir();
    return JSON.parse(fs.readFileSync(HISTORY_FILE, "utf8"));
  } catch {
    return [];
  }
}

function saveHistory(h) {
  ensureZDir();
  fs.writeFileSync(
    HISTORY_FILE,
    JSON.stringify(h.slice(-40), null, 2),
    "utf8"
  );
}

// ─── AYUDA ────────────────────────────────────────────────────────────────────
function printHelp() {
  console.log(`
${col("orange","─── Comandos ─────────────────────────────────────────────")}
  ${col("cyan","/help")}        Esta ayuda
  ${col("cyan","/tree")}        Árbol del proyecto actual
  ${col("cyan","/models")}      Ver modelos y fallbacks
  ${col("cyan","/status")}      API key, workspace, modo auto
  ${col("cyan","/auto")}        Toggle: auto-aprobar crear/editar archivos
  ${col("cyan","/history")}     Últimas conversaciones
  ${col("cyan","/clear")}       Limpiar pantalla
  ${col("cyan","/exit")}        Salir

${col("orange","─── Modelos ──────────────────────────────────────────────")}
  🌬️ ${col("bold","GLM 4.5 Air Free")}      → principal estable
  💻 ${col("bold","Qwen3 Coder Free")}      → fallback si no tira 429
  ⚡ ${col("bold","DeepSeek V4 Flash")}     → fallback sin :free
  🔀 ${col("bold","OpenRouter Auto")}       → último recurso

${col("orange","─── Ejemplos ─────────────────────────────────────────────")}
  ${col("gray","creame una API REST con Express y rutas CRUD para usuarios")}
  ${col("gray","analizá el proyecto y decime cómo funciona")}
  ${col("gray","hay un bug en src/auth.js, encontralo y arreglalo")}
  ${col("gray","refactorizá este código a TypeScript con tipos correctos")}
  ${col("gray","ejecutá los tests y arreglá lo que falle")}
  ${col("gray","buscá cómo usar Prisma con SQLite")}

${col("orange","─── Modelo custom opcional ───────────────────────────────")}
  ${col("gray","Podés forzar un modelo poniendo esto en .env:")}
  ${col("cyan","Z_AGENT_MODEL=z-ai/glm-4.5-air:free")}
`);
}

function printModels() {
  console.log(`\n${col("orange","─── Modelos principales ──────────────────────────────────")}`);

  for (const [k, m] of Object.entries(MODELS)) {
    console.log(`  ${m.icon} ${col("bold", m.label.padEnd(24))} ${col("gray", m.desc)}`);
    console.log(`     ${col("dim", m.id)}`);
  }

  console.log(`\n${col("orange","─── Fallbacks ────────────────────────────────────────────")}`);

  FALLBACK_MODELS.forEach((m, i) => {
    console.log(`  ${String(i + 1).padStart(2, "0")}. ${m.icon} ${col("bold", m.label)}`);
    console.log(`      ${col("dim", m.id)}`);
  });

  if (process.env.Z_AGENT_MODEL) {
    console.log(`\n  ${col("yellow","Modelo forzado por .env:")} ${process.env.Z_AGENT_MODEL}`);
  }

  console.log("");
}

// ─── SETUP ────────────────────────────────────────────────────────────────────
async function ensureKey(rl) {
  loadEnv();

  if (
    process.env.OPENROUTER_API_KEY &&
    process.env.OPENROUTER_API_KEY !== "tu_openrouter_api_key_aqui"
  ) {
    return;
  }

  console.log(col("yellow","\n⚠  No encontré OPENROUTER_API_KEY"));
  console.log(col("gray","  Conseguila gratis en https://openrouter.ai/keys\n"));

  const k = (await ask(
    rl,
    col("orange","  Pegá tu API key > ")
  )).trim();

  if (!k) {
    console.log(col("red","  Sin API key no puedo funcionar."));
    process.exit(1);
  }

  process.env.OPENROUTER_API_KEY = k;

  const save = (await ask(
    rl,
    col("orange","  ¿Guardar en .env? (s/n) > ")
  )).trim().toLowerCase();

  if (["s", "si", "sí", "y"].includes(save)) {
    saveEnv({ OPENROUTER_API_KEY: k });
    console.log(col("green","  ✓ Guardado en .env\n"));
  }
}

// ─── MAIN ─────────────────────────────────────────────────────────────────────
async function main() {
  loadEnv();
  splash();

  const rl = createRl();

  await ensureKey(rl);

  let history  = loadHistory();
  let autoMode = false;

  printHelp();

  while (true) {
    const raw = await ask(
      rl,
      `\n${col("orange","╭─")} ${col("dim","z-agent")} ${col("orange","▶")} `
    );

    const input = raw.trim();

    if (!input) continue;

    if (["/exit", "exit", "salir", "quit"].includes(input)) break;

    if (input === "/help") {
      printHelp();
      continue;
    }

    if (input === "/clear") {
      splash();
      continue;
    }

    if (input === "/models") {
      printModels();
      continue;
    }

    if (input === "/tree") {
      console.log("\n" + col("cyan", listTree(".", 3)));
      continue;
    }

    if (input === "/history") {
      history.slice(-10).forEach(m => {
        console.log(
          col(m.role === "user" ? "orange" : "gray", `[${m.role}] `) +
          m.content.slice(0, 120)
        );
      });
      continue;
    }

    if (input === "/status") {
      const keyOk = (process.env.OPENROUTER_API_KEY?.length ?? 0) > 10;

      console.log(`\n  API:       ${keyOk ? col("green","✓ OPENROUTER_API_KEY configurada") : col("red","✗ Sin API key")}`);
      console.log(`  Auto:      ${autoMode ? col("green","ON") : col("yellow","OFF")}`);
      console.log(`  Workspace: ${ROOT}`);
      console.log(`  Historia:  ${history.length} mensajes`);

      if (process.env.Z_AGENT_MODEL) {
        console.log(`  Modelo .env: ${process.env.Z_AGENT_MODEL}`);
      }

      const { model } = pickModel("creame una función en javascript");
      console.log(`  Ej código: → ${model.icon} ${model.label}\n`);

      continue;
    }

    if (input === "/auto") {
      autoMode = !autoMode;
      console.log(
        `  Auto-aprobación: ${
          autoMode ? col("green","ON ✓") : col("yellow","OFF")
        }`
      );
      continue;
    }

    const working = [
      {
        role: "system",
        content: systemPrompt(),
      },
      ...history.slice(-16),
      {
        role: "user",
        content: input,
      },
    ];

    let finalAnswer = null;
    let loopCount   = 0;
    let lastModel   = null;

    console.log("");

    while (loopCount < 10) {
      loopCount++;

      let rawResponse;
      let model;

      try {
        const response = await callAI(working, input);
        rawResponse = response.result;
        model = response.model;
        lastModel = model;
      } catch (err) {
        console.log(col("red", `\n✗ ${err.message}`));
        finalAnswer = "Tuve un error al contactar la API. Revisá tu conexión, la API key o los límites de OpenRouter.";
        break;
      }

      const parsed = parseJson(rawResponse);
      const actions = normalizeActions(parsed);

      if (actions.length === 0) {
        if (parsed.final) {
          finalAnswer = parsed.final;
        } else {
          finalAnswer = "No recibí una acción válida del modelo. Probá pedírselo más directo, por ejemplo: creá los archivos index.html, style.css y script.js usando write_file.";
        }
        break;
      }

      const toolResults = [];

      for (const action of actions) {
        const allowed = await confirmAction(rl, action, autoMode);

        if (!allowed) {
          toolResults.push({
            action,
            ok: false,
            result: "Rechazado por usuario.",
          });
          continue;
        }

        process.stdout.write(
          `  ${col("cyan","▶")} ${col("bold", action.tool)} ${col("gray", JSON.stringify(action.args || {}).slice(0, 80))}  `
        );

        try {
          const result = await executeAction(action);
          const short  = String(result).slice(0, 8000);

          toolResults.push({
            action,
            ok: true,
            result: short,
          });

          process.stdout.write(col("green","✓\n"));

          if (["write_file", "patch_file"].includes(action.tool)) {
            console.log(col("gray", "  " + short.split("\n")[0]));
          }

        } catch (err) {
          toolResults.push({
            action,
            ok: false,
            error: err.message,
          });

          process.stdout.write(col("red", `✗ ${err.message}\n`));
        }
      }

      working.push({
        role: "assistant",
        content: rawResponse,
      });

      working.push({
        role: "user",
        content: `Resultados:\n${JSON.stringify(toolResults, null, 2)}\n\nSi terminaste devolvé final. Si necesitás seguir, devolvé más actions válidas con tool y args.`,
      });
    }

    if (!finalAnswer && loopCount >= 10) {
      finalAnswer = "Llegué al límite de pasos. Pedime que continúe si hace falta.";
    }

    if (finalAnswer) {
      const modelTag = lastModel
        ? col("dim", ` · ${lastModel.icon || "🤖"} ${lastModel.label}`)
        : "";

      console.log(
        `\n${col("orange","╭─ Z Agent")}${modelTag}${col("orange"," ─────────────────────────────────────────")}`
      );

      for (const line of String(finalAnswer).split("\n")) {
        console.log(col("orange","│ ") + line);
      }

      console.log(col("orange","╰──────────────────────────────────────────────────────────"));

      history.push({
        role: "user",
        content: input,
      });

      history.push({
        role: "assistant",
        content: finalAnswer,
      });

      saveHistory(history);
    }
  }

  rl.close();
  console.log(col("gray","\nZ Agent apagado. ¡Hasta luego! 👋\n"));
}

main().catch(err => {
  console.error(col("red", err.stack || err.message));
  process.exit(1);
});