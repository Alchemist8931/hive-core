-- ============================================================
-- Hive: Initial Schema
-- Run this in Supabase SQL Editor (Database → SQL Editor → New query)
-- ============================================================

-- Расширения (pgvector должен быть уже включён через UI)
create extension if not exists vector;

-- ============================================================
-- 1. AGENTS — Registry всех агентов
-- ============================================================

create type agent_status as enum ('active', 'paused', 'draft', 'archived');
create type agent_role as enum ('secretary', 'drone');

create table agents (
  id              uuid primary key default gen_random_uuid(),
  name            text not null unique,
  role            agent_role not null default 'drone',
  status          agent_status not null default 'draft',

  -- Определение агента
  system_prompt   text not null,
  model           text not null default 'claude-sonnet-4-6',
  tools           jsonb not null default '[]'::jsonb,
  max_iterations  int not null default 3,
  temperature     float not null default 0.7,

  -- Связь с GitHub
  github_path     text,

  -- Связь с OpenClaw
  openclaw_id     text,

  -- Метаданные
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  created_by      uuid references agents(id)
);

-- Индекс для быстрого поиска активных агентов
create index idx_agents_status on agents(status);

-- ============================================================
-- 2. AGENT_MUTATIONS — аудит всех изменений агентов
-- ============================================================

create type mutation_type as enum (
  'create',
  'update_prompt',
  'update_tools',
  'update_model',
  'update_status',
  'update_config',
  'archive'
);

create table agent_mutations (
  id              uuid primary key default gen_random_uuid(),
  agent_id        uuid not null references agents(id) on delete cascade,
  mutated_by      uuid not null references agents(id),
  mutation_type   mutation_type not null,
  field_changed   text,
  old_value       text,
  new_value       text,
  reason          text,
  github_commit   text,
  created_at      timestamptz not null default now()
);

create index idx_mutations_agent on agent_mutations(agent_id);
create index idx_mutations_time on agent_mutations(created_at desc);

-- ============================================================
-- 3. TASKS — очередь задач
-- ============================================================

create type task_status as enum (
  'pending',
  'assigned',
  'in_progress',
  'review',
  'done',
  'failed',
  'escalated'
);

create table tasks (
  id                  uuid primary key default gen_random_uuid(),
  title               text not null,
  description         text not null,
  assigned_to         uuid references agents(id),
  created_by          uuid references agents(id),

  status              task_status not null default 'pending',
  priority            int not null default 5 check (priority between 1 and 10),
  max_attempts        int not null default 3,
  current_attempt     int not null default 0,

  -- Reinforcement
  pass_threshold      float not null default 0.7,
  evaluation_criteria jsonb,

  -- Зависимости
  parent_task_id      uuid references tasks(id),
  depends_on          uuid[] default '{}',

  -- Результат
  final_result        text,
  final_score         float,

  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  completed_at        timestamptz
);

create index idx_tasks_status on tasks(status);
create index idx_tasks_assigned on tasks(assigned_to);
create index idx_tasks_parent on tasks(parent_task_id);

-- ============================================================
-- 4. TASK_ATTEMPTS — история попыток (reinforcement loop)
-- ============================================================

create table task_attempts (
  id              uuid primary key default gen_random_uuid(),
  task_id         uuid not null references tasks(id) on delete cascade,
  attempt_num     int not null,
  agent_id        uuid not null references agents(id),

  -- Вход/выход
  input_context   text not null,
  output          text,

  -- Оценка
  score           float,
  feedback        text,
  evaluated_by    uuid references agents(id),

  -- Метрики
  tokens_input    int,
  tokens_output   int,
  cost_usd        float,
  duration_ms     int,

  created_at      timestamptz not null default now(),

  unique(task_id, attempt_num)
);

create index idx_attempts_task on task_attempts(task_id);

-- ============================================================
-- 5. SESSIONS — диалоги через каналы
-- ============================================================

create table sessions (
  id              uuid primary key default gen_random_uuid(),
  agent_id        uuid not null references agents(id),
  channel         text not null,
  peer_id         text,
  messages        jsonb not null default '[]'::jsonb,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index idx_sessions_agent on sessions(agent_id);

-- ============================================================
-- 6. AGENT_MEMORY — долгосрочная память с семантическим поиском
-- ============================================================

create table agent_memory (
  id              uuid primary key default gen_random_uuid(),
  agent_id        uuid not null references agents(id) on delete cascade,
  content         text not null,
  embedding       vector(1536),
  source          text,
  metadata        jsonb default '{}'::jsonb,
  created_at      timestamptz not null default now()
);

-- IVFFlat-индекс для быстрого поиска по эмбеддингам
-- Примечание: нужно хотя бы ~100 записей для эффективной работы
-- На старте можно использовать точный поиск (без индекса)
-- create index on agent_memory using ivfflat (embedding vector_cosine_ops) with (lists = 100);

create index idx_memory_agent on agent_memory(agent_id);

-- ============================================================
-- 7. BINDINGS — маршрутизация каналов на агентов
-- ============================================================

create table bindings (
  id              uuid primary key default gen_random_uuid(),
  channel         text not null,
  peer_id         text,
  agent_id        uuid not null references agents(id),
  priority        int not null default 0,
  created_at      timestamptz not null default now(),
  unique(channel, peer_id)
);

-- ============================================================
-- 8. COST_LOG — трекинг расходов на API
-- ============================================================

create table cost_log (
  id              uuid primary key default gen_random_uuid(),
  agent_id        uuid references agents(id),
  task_id         uuid references tasks(id),
  model           text not null,
  tokens_input    int not null default 0,
  tokens_output   int not null default 0,
  cost_usd        float not null default 0,
  created_at      timestamptz not null default now()
);

create index idx_cost_agent on cost_log(agent_id);
create index idx_cost_date on cost_log(created_at desc);

-- ============================================================
-- Триггер: автоматическое обновление updated_at
-- ============================================================

create or replace function fn_update_timestamp()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger trg_agents_timestamp
  before update on agents
  for each row execute function fn_update_timestamp();

create trigger trg_tasks_timestamp
  before update on tasks
  for each row execute function fn_update_timestamp();

create trigger trg_sessions_timestamp
  before update on sessions
  for each row execute function fn_update_timestamp();

-- ============================================================
-- Realtime (включить публикацию для ключевых таблиц)
-- ============================================================

alter publication supabase_realtime add table agents;
alter publication supabase_realtime add table tasks;
alter publication supabase_realtime add table task_attempts;
alter publication supabase_realtime add table agent_mutations;

-- ============================================================
-- Views: удобные представления для UI
-- ============================================================

-- Сводка по агентам с количеством задач
create or replace view agent_summary as
select
  a.id,
  a.name,
  a.role,
  a.status,
  a.model,
  a.updated_at,
  count(t.id) filter (where t.status = 'done') as tasks_done,
  count(t.id) filter (where t.status in ('pending','assigned','in_progress','review')) as tasks_active,
  count(t.id) filter (where t.status = 'failed') as tasks_failed,
  round(avg(ta.score)::numeric, 2) as avg_score,
  round(coalesce(sum(cl.cost_usd), 0)::numeric, 4) as total_cost_usd
from agents a
left join tasks t on t.assigned_to = a.id
left join task_attempts ta on ta.agent_id = a.id
left join cost_log cl on cl.agent_id = a.id
group by a.id, a.name, a.role, a.status, a.model, a.updated_at;

-- Сводка расходов за день
create or replace view daily_costs as
select
  date_trunc('day', created_at) as day,
  model,
  count(*) as calls,
  sum(tokens_input) as total_tokens_in,
  sum(tokens_output) as total_tokens_out,
  round(sum(cost_usd)::numeric, 4) as total_cost_usd
from cost_log
group by date_trunc('day', created_at), model
order by day desc;
