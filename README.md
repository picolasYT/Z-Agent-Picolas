# ⚡ Z Agent by Picolas — v4.0

Agente de terminal para desarrollo de software. Similar a Claude Code / Codex.
**Solo necesitás una API key: OpenRouter (gratis).**

## Modelos — selección automática según la pregunta

| Modelo | Cuándo se usa |
|--------|--------------|
├─────────────────────────────────────────────────────────────
│ 🌬️ Principal     → GLM 4.5 Air Free                        │
│ 💻 Fallback      → Qwen3 Coder Free                        │
│ ⚡ Opcional      → DeepSeek V4 Flash                       │
│ 🔀 Último        → OpenRouter Auto                         │
╰────────────────────────────────────────────────────────────╯

## Setup

```bash
# 1. Extraer el zip
# 2. Copiar y editar .env
cp .env.example .env
# Pegar tu OPENROUTER_API_KEY en .env

# 3. Ejecutar
node index.js
```

## Conseguir API key gratis

1. Ir a https://openrouter.ai/keys
2. Crear cuenta (email o GitHub)
3. Crear una API key
4. Pegarla en `.env` o cuando el agente la pida

Límites gratis: ~50 requests/día por modelo. Para más, agregás $10 de crédito.

## Comandos

| Comando | Qué hace |
|---------|----------|
| `/help` | Ayuda y ejemplos |
| `/models` | Ver todos los modelos y cuándo se activan |
| `/tree` | Árbol del proyecto |
| `/status` | API key, workspace, auto-mode |
| `/auto` | Toggle auto-aprobación (sin confirmar cada archivo) |
| `/history` | Últimas conversaciones |
| `/clear` | Limpiar pantalla |
| `/exit` | Salir |

## Ejemplos

```
creame una API REST con Express y rutas CRUD para usuarios
analizá el proyecto y explicame cómo funciona
hay un bug en src/auth.js, encontralo y arreglalo
refactorizá index.js a TypeScript con tipos correctos
ejecutá npm test y arreglá lo que falle
buscá cómo usar Prisma con SQLite
```
