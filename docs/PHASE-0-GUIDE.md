# ФАЗА 0: Пошаговая настройка инфраструктуры Hive

> Все действия выполняются в трёх средах:
> - 🖥 **Терминал macOS** — для OpenClaw
> - 🌐 **GitHub (браузер)** — для репозитория
> - 🌐 **Supabase (браузер)** — для базы данных

---

## Шаг 1: Полный сброс OpenClaw

Открой **Terminal** на Mac и выполни последовательно:

```bash
# 1. Остановить gateway (если запущен)
openclaw gateway stop

# 2. Удалить ВСЕ данные OpenClaw
rm -rf ~/.openclaw

# 3. Удалить глобальный пакет
npm uninstall -g openclaw

# 4. Очистить npm-кэш (на всякий случай)
npm cache clean --force

# 5. Установить OpenClaw заново
npm install -g openclaw@latest

# 6. Проверить версию
openclaw --version

# 7. Инициализировать с нуля (следуй инструкциям в интерактивном режиме)
openclaw onboard --install-daemon
```

**Важно:** На этапе onboard НЕ создавай агентов и НЕ привязывай каналы.
Просто пройди минимальную инициализацию. Агенты будут созданы программно позже.

После завершения проверь, что daemon запущен:

```bash
openclaw daemon status
```

---

## Шаг 2: Создание репозитория на GitHub

### 2.1. Создание репозитория

1. Открой https://github.com/new
2. Repository name: `hive-core`
3. Description: `Multi-agent orchestration platform — OpenClaw + Supabase`
4. Visibility: **Private**
5. ✅ Add a README file
6. .gitignore: **Node**
7. License: MIT (или на твой выбор)
8. Нажми **Create repository**

### 2.2. Включение GitHub Pages

1. В репозитории: **Settings** → **Pages**
2. Source: **GitHub Actions**
3. Это пока всё — деплой настроим через workflow-файл

### 2.3. Создание Personal Access Token (PAT)

Этот токен нужен Секретарю для коммитов в репозиторий.

1. Открой https://github.com/settings/tokens?type=beta
2. Нажми **Generate new token**
3. Token name: `hive-secretary`
4. Expiration: 90 days (потом можно обновить)
5. Repository access: **Only select repositories** → выбери `hive-core`
6. Permissions → Repository permissions:
   - **Contents**: Read and write
   - **Metadata**: Read-only (автоматически)
7. Нажми **Generate token**
8. **СКОПИРУЙ ТОКЕН** — он показывается один раз!

Сохрани его — он понадобится в Шаге 3 и Шаге 4.

### 2.4. Добавление секретов для GitHub Actions

1. В репозитории: **Settings** → **Secrets and variables** → **Actions**
2. Нажми **New repository secret** и добавь:

| Name | Value |
|---|---|
| `SUPABASE_URL` | (получишь в Шаге 3) |
| `SUPABASE_ANON_KEY` | (получишь в Шаге 3) |

(Вернёшься сюда после создания Supabase-проекта)

---

## Шаг 3: Создание проекта в Supabase

### 3.1. Создание проекта

1. Открой https://supabase.com/dashboard
2. Нажми **New project**
3. Organization: выбери свою (или создай)
4. Project name: `hive`
5. Database password: придумай и **СОХРАНИ**
6. Region: **Central EU (Frankfurt)** (ближайший к Хельсинки)
7. Plan: Free (достаточно для разработки)
8. Нажми **Create new project**
9. Подожди ~2 минуты пока проект инициализируется

### 3.2. Сохранение ключей

После создания проекта:

1. Перейди в **Settings** → **API**
2. Скопируй и сохрани:

| Что | Где найти | Для чего |
|---|---|---|
| `Project URL` | В секции URL | Это `SUPABASE_URL` |
| `anon` public | В секции Project API keys | Это `SUPABASE_ANON_KEY` |
| `service_role` secret | В секции Project API keys (нажми reveal) | Это `SUPABASE_SERVICE_ROLE_KEY` |

**Теперь вернись в GitHub** (Шаг 2.4) и добавь `SUPABASE_URL` и `SUPABASE_ANON_KEY` как секреты репозитория.

### 3.3. Включение расширений

1. В Supabase: перейди в **Database** → **Extensions**
2. Найди и включи:
   - `vector` (pgvector) — для семантического поиска по памяти
3. Расширение `pg_cron` обычно включено по умолчанию. Если нет — включи.

### 3.4. Создание схемы БД

1. Перейди в **SQL Editor** (иконка в левом меню)
2. Нажми **New query**
3. Вставь содержимое файла `supabase/migrations/001_initial_schema.sql` (файл приложен к проекту, см. ниже)
4. Нажми **Run**
5. Убедись, что вывод без ошибок

### 3.5. Вставка начальных данных (Seed)

1. В **SQL Editor** создай ещё один запрос
2. Вставь содержимое файла `supabase/seed.sql`
3. Нажми **Run**

### 3.6. Включение Realtime

1. Перейди в **Database** → **Replication**
2. В секции **supabase_realtime** нажми на таблицы и включи:
   - `agents` — INSERT, UPDATE
   - `tasks` — INSERT, UPDATE
   - `task_attempts` — INSERT
   - `agent_mutations` — INSERT

Альтернативно, выполни в SQL Editor:

```sql
alter publication supabase_realtime add table agents;
alter publication supabase_realtime add table tasks;
alter publication supabase_realtime add table task_attempts;
alter publication supabase_realtime add table agent_mutations;
```

### 3.7. Сохранение секретов для Edge Functions

1. Перейди в **Settings** → **Edge Functions** (или **Vault**)
2. Добавь секреты:

| Name | Value |
|---|---|
| `ANTHROPIC_API_KEY` | Твой ключ от console.anthropic.com |
| `GITHUB_PAT` | Токен из Шага 2.3 |
| `GITHUB_REPO` | `твой-username/hive-core` |

---

## Шаг 4: Настройка OpenClaw — привязка API-ключа

Вернись в **Terminal** на Mac:

```bash
# 1. Привязать Anthropic API-ключ
openclaw models add anthropic

# Когда попросит API key — вставь свой ANTHROPIC_API_KEY
# Когда попросит выбрать модель по умолчанию — выбери claude-sonnet-4-6

# 2. Проверить, что модель привязана
openclaw models list

# 3. Создать директорию для Секретаря
mkdir -p ~/.openclaw/workspace-secretary

# 4. Скопировать SOUL.md для Секретаря
# (содержимое файла agents/secretary/SOUL.md из репозитория)
cat > ~/.openclaw/workspace-secretary/SOUL.md << 'SOUL_EOF'
# Secretary — Master Orchestrator of Hive

You are the Secretary, the central intelligence of the Hive multi-agent system.

## Identity
- You are the ONLY agent with permission to create, modify, and manage other agents
- You operate on behalf of the human operator
- You are methodical, precise, and always log your reasoning

## Core capabilities
- Create new specialized agents (Drones) when a task requires skills no existing agent has
- Modify existing agents: refine their prompts, adjust tools, switch models
- Decompose complex tasks into sub-tasks and assign them to appropriate Drones
- Evaluate work quality and provide actionable feedback
- Commit changes to the GitHub repository (hive-core)

## Decision framework
When you receive a task:
1. Can an existing Drone handle this? → assign directly
2. Does an existing Drone need adjustment? → modify, then assign
3. Is a new specialization needed? → create agent, then assign
4. Is the task too complex for one agent? → decompose into sub-tasks

## When creating agents
- Write focused, specific system prompts (not generic)
- Choose the minimal set of tools needed
- Default model: claude-sonnet-4-6
- Set max_iterations based on expected difficulty (2-5)
- Always commit agent files to GitHub before activating

## When evaluating work
- Score from 0.0 to 1.0
- Provide specific, actionable feedback (not vague)
- If score < 0.7 and agent has attempts left → return with feedback
- If agent consistently fails → analyze: wrong prompt? wrong tools? task too vague?
- Modify the agent if the problem is systemic

## Constraints
- Never delete agents permanently — only archive
- Always log mutation reasons
- Prefer Sonnet for routine tasks, note when Opus would help
- Monitor token costs — avoid unnecessary iterations
SOUL_EOF

# 5. Создать базовую конфигурацию OpenClaw
# Пока с одним агентом (Secretary), без каналов
cat > ~/.openclaw/openclaw.json << 'CONFIG_EOF'
{
  "agents": {
    "defaults": {
      "model": "anthropic/claude-sonnet-4-6"
    },
    "list": [
      {
        "id": "secretary",
        "name": "Secretary",
        "workspace": "~/.openclaw/workspace-secretary",
        "model": "anthropic/claude-sonnet-4-6",
        "default": true
      }
    ]
  }
}
CONFIG_EOF

# 6. Запустить gateway (без каналов — пока просто проверяем)
openclaw gateway
```

Если gateway запустился без ошибок — OpenClaw готов. Останови его Ctrl+C и двигаемся к загрузке файлов в GitHub.

---

## Шаг 5: Загрузка файлов в GitHub

Теперь загрузим все файлы проекта в репозиторий. Действуем через браузер.

### Порядок создания файлов

В GitHub перейди в свой репозиторий `hive-core` и для каждого файла:
1. Нажми **Add file** → **Create new file**
2. В поле имени файла введи полный путь (например: `agents/secretary/SOUL.md`)
   — GitHub автоматически создаст папки
3. Вставь содержимое файла
4. Внизу в Commit changes: напиши сообщение коммита
5. Убедись что выбрано **Commit directly to the `main` branch**
6. Нажми **Commit changes**

### Список файлов для загрузки (в порядке создания)

Все файлы перечислены ниже в этом документе и доступны как отдельные файлы в проекте.

```
1. agents/secretary/SOUL.md
2. agents/secretary/tools.json
3. supabase/migrations/001_initial_schema.sql
4. supabase/seed.sql
5. .github/workflows/deploy-ui.yml
6. scripts/sync-agents.sh
7. ui/package.json
8. ui/vite.config.ts
9. ui/tsconfig.json
10. ui/index.html
11. ui/src/main.tsx
12. ui/src/App.tsx
13. ui/src/types/index.ts
14. ui/src/lib/supabase.ts
15. ui/src/lib/github.ts
16. ui/src/hooks/useRealtime.ts
17. ui/src/components/Dashboard.tsx
```

**Совет:** Можно загрузить несколько файлов за один коммит. Для этого:
1. Создай первый файл
2. Перед коммитом нажми **Add file** → **Create new file** ещё раз
   (или используй drag-and-drop загрузку)

Или, если тебе удобнее — клонируй репо локально:

```bash
git clone https://github.com/ТВОЙ-USERNAME/hive-core.git
cd hive-core
# ... создай файлы ...
git add .
git commit -m "Phase 0: Initial project structure"
git push origin main
```

---

## Шаг 6: Проверка

После выполнения всех шагов проверь:

```
✅ OpenClaw
   □ openclaw --version выводит актуальную версию
   □ openclaw models list показывает anthropic с привязанным ключом
   □ ~/.openclaw/workspace-secretary/SOUL.md существует
   □ ~/.openclaw/openclaw.json содержит secretary

✅ GitHub
   □ Репозиторий hive-core создан (private)
   □ PAT создан с правами Contents: Read and write
   □ Secrets добавлены (SUPABASE_URL, SUPABASE_ANON_KEY)
   □ GitHub Pages включены (source: GitHub Actions)
   □ Все файлы проекта загружены

✅ Supabase
   □ Проект hive создан (Frankfurt)
   □ pgvector расширение включено
   □ Схема БД создана (8 таблиц)
   □ Secretary добавлен в agents (seed.sql)
   □ Realtime включён для agents, tasks, task_attempts, agent_mutations
   □ Secrets добавлены (ANTHROPIC_API_KEY, GITHUB_PAT, GITHUB_REPO)

✅ Ключи сохранены
   □ SUPABASE_URL
   □ SUPABASE_ANON_KEY
   □ SUPABASE_SERVICE_ROLE_KEY
   □ ANTHROPIC_API_KEY
   □ GITHUB_PAT
```

Когда всё отмечено — Фаза 0 завершена. Переходим к Фазе 1.
