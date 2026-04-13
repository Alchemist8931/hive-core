// ============================================================
// Hive Type Definitions
// ============================================================

export type AgentStatus = 'active' | 'paused' | 'draft' | 'archived'
export type AgentRole = 'secretary' | 'drone'
export type TaskStatus = 'pending' | 'assigned' | 'in_progress' | 'review' | 'done' | 'failed' | 'escalated'
export type MutationType = 'create' | 'update_prompt' | 'update_tools' | 'update_model' | 'update_status' | 'update_config' | 'archive'

export interface Agent {
  id: string
  name: string
  role: AgentRole
  status: AgentStatus
  system_prompt: string
  model: string
  tools: string[]
  max_iterations: number
  temperature: number
  github_path: string | null
  openclaw_id: string | null
  created_at: string
  updated_at: string
  created_by: string | null
}

export interface AgentSummary {
  id: string
  name: string
  role: AgentRole
  status: AgentStatus
  model: string
  updated_at: string
  tasks_done: number
  tasks_active: number
  tasks_failed: number
  avg_score: number | null
  total_cost_usd: number
}

export interface Task {
  id: string
  title: string
  description: string
  assigned_to: string | null
  created_by: string | null
  status: TaskStatus
  priority: number
  max_attempts: number
  current_attempt: number
  pass_threshold: number
  evaluation_criteria: Record<string, unknown> | null
  parent_task_id: string | null
  depends_on: string[]
  final_result: string | null
  final_score: number | null
  created_at: string
  updated_at: string
  completed_at: string | null
}

export interface TaskAttempt {
  id: string
  task_id: string
  attempt_num: number
  agent_id: string
  input_context: string
  output: string | null
  score: number | null
  feedback: string | null
  evaluated_by: string | null
  tokens_input: number | null
  tokens_output: number | null
  cost_usd: number | null
  duration_ms: number | null
  created_at: string
}

export interface AgentMutation {
  id: string
  agent_id: string
  mutated_by: string
  mutation_type: MutationType
  field_changed: string | null
  old_value: string | null
  new_value: string | null
  reason: string | null
  github_commit: string | null
  created_at: string
}

export interface Session {
  id: string
  agent_id: string
  channel: string
  peer_id: string | null
  messages: Array<{ role: string; content: string }>
  created_at: string
  updated_at: string
}
