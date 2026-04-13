#!/bin/bash
# ============================================================
# setup.sh — Первоначальная настройка Hive на macOS
#
# Использование:
#   chmod +x scripts/setup.sh
#   ./scripts/setup.sh
# ============================================================

set -euo pipefail

echo ""
echo "🐝 ═══════════════════════════════════════"
echo "   HIVE — Initial Setup"
echo "   ═══════════════════════════════════════"
echo ""

# ─── 1. Проверка зависимостей ─────────────────────────────

echo "📋 Checking dependencies..."

check_cmd() {
  if command -v "$1" &> /dev/null; then
    echo "   ✅ $1 $(command $1 --version 2>/dev/null | head -1)"
  else
    echo "   ❌ $1 — NOT FOUND"
    echo "      Install: $2"
    MISSING=true
  fi
}

MISSING=false
check_cmd "node" "brew install node"
check_cmd "npm" "comes with node"
check_cmd "jq" "brew install jq"
check_cmd "curl" "should be preinstalled on macOS"
check_cmd "openclaw" "npm install -g openclaw@latest"

if [ "$MISSING" = true ]; then
  echo ""
  echo "❌ Missing dependencies. Install them and re-run this script."
  exit 1
fi

echo ""

# ─── 2. Проверка ~/.hive-env ──────────────────────────────

echo "🔑 Checking environment..."

if [ ! -f "$HOME/.hive-env" ]; then
  echo "   ⚠️  ~/.hive-env not found."
  echo ""
  echo "   Create it now? (y/n)"
  read -r response
  if [ "$response" = "y" ]; then
    echo ""
    read -rp "   SUPABASE_URL: " SUPA_URL
    read -rp "   SUPABASE_ANON_KEY: " SUPA_ANON
    read -rp "   SUPABASE_SERVICE_ROLE_KEY: " SUPA_SERVICE
    read -rp "   ANTHROPIC_API_KEY: " ANTHROPIC
    read -rp "   GITHUB_PAT: " GH_PAT
    read -rp "   GITHUB_REPO (user/repo): " GH_REPO

    cat > "$HOME/.hive-env" << EOF
export SUPABASE_URL="${SUPA_URL}"
export SUPABASE_ANON_KEY="${SUPA_ANON}"
export SUPABASE_SERVICE_ROLE_KEY="${SUPA_SERVICE}"
export ANTHROPIC_API_KEY="${ANTHROPIC}"
export GITHUB_PAT="${GH_PAT}"
export GITHUB_REPO="${GH_REPO}"
EOF
    chmod 600 "$HOME/.hive-env"
    echo "   ✅ Created ~/.hive-env (permissions: 600)"
  else
    echo "   Copy .hive-env.example to ~/.hive-env and fill in values."
    exit 1
  fi
fi

source "$HOME/.hive-env"
echo "   ✅ Environment loaded"
echo ""

# ─── 3. Настройка OpenClaw ────────────────────────────────

echo "⚙️  Setting up OpenClaw..."

# Проверить, привязан ли Anthropic
if openclaw models list 2>/dev/null | grep -q "anthropic"; then
  echo "   ✅ Anthropic model already configured"
else
  echo "   Adding Anthropic API key to OpenClaw..."
  openclaw models add anthropic --api-key "$ANTHROPIC_API_KEY" 2>/dev/null || {
    echo "   ⚠️  Could not add model automatically."
    echo "   Run manually: openclaw models add anthropic"
  }
fi

# Создать workspace Секретаря
SECRETARY_WS="$HOME/.openclaw/workspace-secretary"
mkdir -p "$SECRETARY_WS"

if [ -f "agents/secretary/SOUL.md" ]; then
  cp agents/secretary/SOUL.md "$SECRETARY_WS/SOUL.md"
  echo "   ✅ Secretary workspace created"
else
  echo "   ⚠️  agents/secretary/SOUL.md not found — run from repo root"
fi

echo ""

# ─── 4. Установка UI зависимостей ─────────────────────────

echo "📦 Installing UI dependencies..."

if [ -d "ui" ]; then
  cd ui

  # Создать .env.local для локальной разработки
  cat > .env.local << EOF
VITE_SUPABASE_URL=${SUPABASE_URL}
VITE_SUPABASE_ANON_KEY=${SUPABASE_ANON_KEY}
EOF

  npm install
  echo "   ✅ UI dependencies installed"
  echo "   ✅ .env.local created"
  cd ..
else
  echo "   ⚠️  ui/ directory not found — run from repo root"
fi

echo ""

# ─── 5. Синхронизация агентов ──────────────────────────────

echo "🔄 Running initial agent sync..."
if [ -f "scripts/sync-agents.sh" ]; then
  chmod +x scripts/sync-agents.sh
  bash scripts/sync-agents.sh
else
  echo "   ⚠️  scripts/sync-agents.sh not found"
fi

echo ""

# ─── 6. Итоги ─────────────────────────────────────────────

echo "🐝 ═══════════════════════════════════════"
echo "   Setup complete!"
echo "   ═══════════════════════════════════════"
echo ""
echo "   Next steps:"
echo "   1. Run Supabase migrations (SQL Editor → paste 001_initial_schema.sql)"
echo "   2. Run Supabase seed (SQL Editor → paste seed.sql)"
echo "   3. Start UI locally:  cd ui && npm run dev"
echo "   4. Start OpenClaw:    openclaw gateway"
echo ""
echo "   Dashboard will be at: http://localhost:5173/hive-core/"
echo ""
