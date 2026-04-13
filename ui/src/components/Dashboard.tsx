import { useState } from 'react'
import { useAgents, useTasks, useMutations } from '../hooks/useRealtime'
import type { AgentSummary, Task, AgentMutation } from '../types'

// ─── Styles (inline for Phase 0 — will migrate to Tailwind in Phase 4) ─────

const styles = {
  app: {
    minHeight: '100vh',
    background: '#0a0a0f',
    color: '#e0e0e8',
    fontFamily: "'SF Mono', 'Fira Code', 'JetBrains Mono', monospace",
    fontSize: '13px',
  } as React.CSSProperties,
  header: {
    padding: '20px 32px',
    borderBottom: '1px solid #1a1a2e',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  } as React.CSSProperties,
  logo: {
    fontSize: '20px',
    fontWeight: 700,
    letterSpacing: '0.1em',
    color: '#f0c040',
  } as React.CSSProperties,
  grid: {
    display: 'grid',
    gridTemplateColumns: '280px 1fr 320px',
    minHeight: 'calc(100vh - 65px)',
  } as React.CSSProperties,
  panel: {
    borderRight: '1px solid #1a1a2e',
    padding: '16px',
    overflowY: 'auto' as const,
  } as React.CSSProperties,
  panelTitle: {
    fontSize: '11px',
    fontWeight: 600,
    textTransform: 'uppercase' as const,
    letterSpacing: '0.15em',
    color: '#666680',
    marginBottom: '12px',
  } as React.CSSProperties,
  card: {
    background: '#12121f',
    border: '1px solid #1a1a2e',
    borderRadius: '6px',
    padding: '12px',
    marginBottom: '8px',
    cursor: 'pointer',
    transition: 'border-color 0.15s',
  } as React.CSSProperties,
  badge: (color: string) => ({
    display: 'inline-block',
    padding: '2px 8px',
    borderRadius: '3px',
    fontSize: '10px',
    fontWeight: 600,
    background: color + '20',
    color: color,
    textTransform: 'uppercase' as const,
    letterSpacing: '0.05em',
  }),
  statusDot: (active: boolean) => ({
    display: 'inline-block',
    width: '6px',
    height: '6px',
    borderRadius: '50%',
    background: active ? '#40f060' : '#606080',
    marginRight: '8px',
    boxShadow: active ? '0 0 6px #40f060' : 'none',
  }),
  taskRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '10px 12px',
    background: '#12121f',
    border: '1px solid #1a1a2e',
    borderRadius: '6px',
    marginBottom: '6px',
  } as React.CSSProperties,
  mutationItem: {
    padding: '8px 0',
    borderBottom: '1px solid #1a1a2e',
    fontSize: '12px',
  } as React.CSSProperties,
  emptyState: {
    color: '#444460',
    textAlign: 'center' as const,
    padding: '40px 20px',
    fontSize: '12px',
  } as React.CSSProperties,
  footer: {
    padding: '12px 32px',
    borderTop: '1px solid #1a1a2e',
    display: 'flex',
    gap: '24px',
    fontSize: '11px',
    color: '#444460',
  } as React.CSSProperties,
}

// ─── Status colors ──────────────────────────────────────────

const STATUS_COLORS: Record<string, string> = {
  active: '#40f060',
  paused: '#f0a030',
  draft: '#606080',
  archived: '#404050',
  pending: '#606080',
  assigned: '#40a0f0',
  in_progress: '#f0c040',
  review: '#c060f0',
  done: '#40f060',
  failed: '#f04060',
  escalated: '#f06040',
}

// ─── Helper: time ago ───────────────────────────────────────

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  return `${days}d ago`
}

// ─── Mutation type labels ───────────────────────────────────

const MUTATION_LABELS: Record<string, string> = {
  create: 'created',
  update_prompt: 'updated prompt of',
  update_tools: 'updated tools of',
  update_model: 'changed model of',
  update_status: 'changed status of',
  update_config: 'reconfigured',
  archive: 'archived',
}

// ─── Components ─────────────────────────────────────────────

function AgentCard({ agent }: { agent: AgentSummary }) {
  const isActive = agent.status === 'active'
  return (
    <div style={styles.card}>
      <div style={{ display: 'flex', alignItems: 'center', marginBottom: '8px' }}>
        <span style={styles.statusDot(isActive)} />
        <span style={{ fontWeight: 600, flex: 1 }}>{agent.name}</span>
        <span style={styles.badge(agent.role === 'secretary' ? '#f0c040' : '#40a0f0')}>
          {agent.role}
        </span>
      </div>
      <div style={{ display: 'flex', gap: '12px', color: '#666680', fontSize: '11px' }}>
        <span>✓ {agent.tasks_done ?? 0}</span>
        <span>⟳ {agent.tasks_active ?? 0}</span>
        <span>✗ {agent.tasks_failed ?? 0}</span>
        {agent.avg_score != null && (
          <span>⊘ {agent.avg_score}</span>
        )}
      </div>
      <div style={{ marginTop: '6px', fontSize: '10px', color: '#444460' }}>
        {agent.model} · ${agent.total_cost_usd ?? '0.00'}
      </div>
    </div>
  )
}

function TaskRow({ task, agents }: { task: Task; agents: AgentSummary[] }) {
  const agentName = agents.find(a => a.id === task.assigned_to)?.name ?? '—'
  const color = STATUS_COLORS[task.status] ?? '#606080'

  return (
    <div style={styles.taskRow}>
      <div style={{ flex: 1 }}>
        <div style={{ fontWeight: 500, marginBottom: '4px' }}>{task.title}</div>
        <div style={{ fontSize: '11px', color: '#666680' }}>
          → {agentName} · attempt {task.current_attempt}/{task.max_attempts}
          {task.final_score != null && ` · score: ${task.final_score}`}
        </div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <span style={styles.badge(color)}>{task.status}</span>
        <span style={{ fontSize: '10px', color: '#444460' }}>{timeAgo(task.updated_at)}</span>
      </div>
    </div>
  )
}

function MutationItem({ mutation, agents }: { mutation: AgentMutation; agents: AgentSummary[] }) {
  const mutator = agents.find(a => a.id === mutation.mutated_by)?.name ?? '?'
  const target = agents.find(a => a.id === mutation.agent_id)?.name ?? '?'
  const label = MUTATION_LABELS[mutation.mutation_type] ?? mutation.mutation_type

  return (
    <div style={styles.mutationItem}>
      <div>
        <strong>{mutator}</strong> {label} <strong>{target}</strong>
      </div>
      {mutation.reason && (
        <div style={{ color: '#666680', marginTop: '2px' }}>{mutation.reason}</div>
      )}
      <div style={{ color: '#444460', fontSize: '10px', marginTop: '2px' }}>
        {timeAgo(mutation.created_at)}
        {mutation.github_commit && (
          <span> · commit {mutation.github_commit.substring(0, 7)}</span>
        )}
      </div>
    </div>
  )
}

// ─── Dashboard ──────────────────────────────────────────────

export default function Dashboard() {
  const { agents, loading: agentsLoading } = useAgents()
  const { tasks, loading: tasksLoading } = useTasks()
  const mutations = useMutations()

  const totalCost = agents.reduce((sum, a) => sum + (a.total_cost_usd ?? 0), 0)
  const activeTasks = tasks.filter(t => !['done', 'failed'].includes(t.status))
  const doneTasks = tasks.filter(t => t.status === 'done')

  return (
    <div style={styles.app}>
      {/* Header */}
      <header style={styles.header}>
        <div style={styles.logo}>🐝 HIVE</div>
        <div style={{ display: 'flex', gap: '16px', fontSize: '11px', color: '#666680' }}>
          <span>{agents.length} agents</span>
          <span>{activeTasks.length} active tasks</span>
          <span>${totalCost.toFixed(4)} spent</span>
        </div>
      </header>

      {/* Main Grid */}
      <div style={styles.grid}>
        {/* Left Panel: Agents */}
        <div style={styles.panel}>
          <div style={styles.panelTitle}>Agents</div>
          {agentsLoading ? (
            <div style={styles.emptyState}>Loading...</div>
          ) : agents.length === 0 ? (
            <div style={styles.emptyState}>
              No agents yet.<br />
              Run seed.sql in Supabase to create Secretary.
            </div>
          ) : (
            agents.map(agent => <AgentCard key={agent.id} agent={agent} />)
          )}
        </div>

        {/* Center: Tasks */}
        <div style={{ ...styles.panel, borderRight: '1px solid #1a1a2e' }}>
          <div style={styles.panelTitle}>Task Pipeline</div>
          {tasksLoading ? (
            <div style={styles.emptyState}>Loading...</div>
          ) : tasks.length === 0 ? (
            <div style={styles.emptyState}>
              No tasks yet.<br />
              Tasks will appear here when Secretary starts working.
            </div>
          ) : (
            <>
              {activeTasks.length > 0 && (
                <>
                  <div style={{ ...styles.panelTitle, marginTop: '8px' }}>Active</div>
                  {activeTasks.map(task => (
                    <TaskRow key={task.id} task={task} agents={agents} />
                  ))}
                </>
              )}
              {doneTasks.length > 0 && (
                <>
                  <div style={{ ...styles.panelTitle, marginTop: '16px' }}>Completed</div>
                  {doneTasks.slice(0, 10).map(task => (
                    <TaskRow key={task.id} task={task} agents={agents} />
                  ))}
                </>
              )}
            </>
          )}
        </div>

        {/* Right Panel: Mutations */}
        <div style={styles.panel}>
          <div style={styles.panelTitle}>Mutation Log</div>
          {mutations.length === 0 ? (
            <div style={styles.emptyState}>
              No mutations yet.<br />
              Agent changes will appear here in real time.
            </div>
          ) : (
            mutations.map(m => (
              <MutationItem key={m.id} mutation={m} agents={agents} />
            ))
          )}
        </div>
      </div>

      {/* Footer */}
      <footer style={styles.footer}>
        <span>Hive v0.1.0</span>
        <span>Sonnet 4.6</span>
        <span>Supabase + OpenClaw + GitHub</span>
      </footer>
    </div>
  )
}
