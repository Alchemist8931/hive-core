#!/bin/bash
# ============================================================
# sync-agents.sh — Синхронизация агентов: Supabase → OpenClaw
#
# Использование:
#   chmod +x scripts/sync-agents.sh
#   ./scripts/sync-agents.sh
#
# Требования:
#   - curl, jq установлены (brew install jq)
#   - Переменные окружения SUPABASE_URL и SUPABASE_SERVICE_ROLE_KEY
#     (можно задать в ~/.hive-env)
# ============================================================

set -euo pipefail

# Загрузить переменные окружения
if [ -f "$HOME/.hive-env" ]; then
  source "$HOME/.hive-env"
fi

# Проверка переменных
if [ -z "${SUPABASE_URL:-}" ] || [ -z "${SUPABASE_SERVICE_ROLE_KEY:-}" ]; then
  echo "❌ Ошибка: установите SUPABASE_URL и SUPABASE_SERVICE_ROLE_KEY"
  echo ""
  echo "Создайте файл ~/.hive-env:"
  echo "  export SUPABASE_URL=\"https://xxxx.supabase.co\""
  echo "  export SUPABASE_SERVICE_ROLE_KEY=\"eyJhbG...\""
  exit 1
fi

OPENCLAW_DIR="$HOME/.openclaw"
echo "🐝 Hive Agent Sync"
echo "   Supabase → OpenClaw"
echo "   ────────────────────"

# 1. Получить список активных агентов из Supabase
echo ""
echo "📡 Fetching agents from Supabase..."

AGENTS=$(curl -s \
  "${SUPABASE_URL}/rest/v1/agents?status=eq.active&select=*" \
  -H "apikey: ${SUPABASE_SERVICE_ROLE_KEY}" \
  -H "Authorization: Bearer ${SUPABASE_SERVICE_ROLE_KEY}")

AGENT_COUNT=$(echo "$AGENTS" | jq '. | length')
echo "   Found ${AGENT_COUNT} active agent(s)"

if [ "$AGENT_COUNT" -eq 0 ]; then
  echo "⚠️  No active agents found. Nothing to sync."
  exit 0
fi

# 2. Создать/обновить workspace для каждого агента
echo ""
echo "📁 Syncing workspaces..."

echo "$AGENTS" | jq -c '.[]' | while IFS= read -r agent; do
  NAME=$(echo "$agent" | jq -r '.name')
  PROMPT=$(echo "$agent" | jq -r '.system_prompt')
  MODEL=$(echo "$agent" | jq -r '.model')
  ROLE=$(echo "$agent" | jq -r '.role')

  WORKSPACE="${OPENCLAW_DIR}/workspace-${NAME}"
  mkdir -p "$WORKSPACE"

  # Записать SOUL.md
  echo "$PROMPT" > "$WORKSPACE/SOUL.md"

  # Записать базовый AGENTS.md
  cat > "$WORKSPACE/AGENTS.md" << EOF
# ${NAME}
Role: ${ROLE}
Model: ${MODEL}
Managed by Hive Secretary
EOF

  echo "   ✅ ${NAME} → ${WORKSPACE}"
done

# 3. Генерировать openclaw.json
echo ""
echo "⚙️  Generating openclaw.json..."

# Начало JSON
AGENTS_LIST="["
FIRST=true

echo "$AGENTS" | jq -c '.[]' | while IFS= read -r agent; do
  NAME=$(echo "$agent" | jq -r '.name')
  MODEL=$(echo "$agent" | jq -r '.model')
  IS_DEFAULT=$(echo "$agent" | jq -r '.role == "secretary"')

  if [ "$FIRST" = true ]; then
    FIRST=false
  fi
done

# Генерируем полный openclaw.json через jq
echo "$AGENTS" | jq '{
  agents: {
    defaults: {
      model: "anthropic/claude-sonnet-4-6"
    },
    list: [.[] | {
      id: .name,
      name: (.name | gsub("-"; " ") | ascii_upcase[:1] + .[1:]),
      workspace: ("~/.openclaw/workspace-" + .name),
      model: ("anthropic/" + .model),
      default: (.role == "secretary")
    }]
  }
}' > "${OPENCLAW_DIR}/openclaw.json"

echo "   ✅ Written to ${OPENCLAW_DIR}/openclaw.json"

# 4. Перезапустить gateway
echo ""
echo "🔄 Restarting OpenClaw gateway..."
openclaw gateway restart 2>/dev/null || echo "   ⚠️  Gateway not running — start manually with: openclaw gateway"

echo ""
echo "🐝 Sync complete!"
echo "   Run 'openclaw agents list --bindings' to verify"
