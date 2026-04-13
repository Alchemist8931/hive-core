import { useEffect, useState, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import type {
  AgentSummary,
  Task,
  TaskAttempt,
  AgentMutation,
} from '../types'

// ─── Agents (using the summary view) ───────────────────────

export function useAgents() {
  const [agents, setAgents] = useState<AgentSummary[]>([])
  const [loading, setLoading] = useState(true)

  const fetch = useCallback(async () => {
    const { data } = await supabase
      .from('agent_summary')
      .select('*')
      .order('role', { ascending: true })
    if (data) setAgents(data)
    setLoading(false)
  }, [])

  useEffect(() => {
    fetch()

    const channel = supabase
      .channel('agents-realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'agents' },
        () => fetch() // refetch summary on any change
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [fetch])

  return { agents, loading, refetch: fetch }
}

// ─── Tasks ──────────────────────────────────────────────────

export function useTasks(status?: string) {
  const [tasks, setTasks] = useState<Task[]>([])
  const [loading, setLoading] = useState(true)

  const fetch = useCallback(async () => {
    let query = supabase
      .from('tasks')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(50)

    if (status) {
      query = query.eq('status', status)
    }

    const { data } = await query
    if (data) setTasks(data)
    setLoading(false)
  }, [status])

  useEffect(() => {
    fetch()

    const channel = supabase
      .channel('tasks-realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'tasks' },
        () => fetch()
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [fetch])

  return { tasks, loading, refetch: fetch }
}

// ─── Task Attempts (for a specific task) ────────────────────

export function useTaskAttempts(taskId: string | null) {
  const [attempts, setAttempts] = useState<TaskAttempt[]>([])

  useEffect(() => {
    if (!taskId) return

    const fetch = async () => {
      const { data } = await supabase
        .from('task_attempts')
        .select('*')
        .eq('task_id', taskId)
        .order('attempt_num', { ascending: true })
      if (data) setAttempts(data)
    }

    fetch()

    const channel = supabase
      .channel(`attempts-${taskId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'task_attempts',
          filter: `task_id=eq.${taskId}`,
        },
        () => fetch()
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [taskId])

  return attempts
}

// ─── Mutations Log ──────────────────────────────────────────

export function useMutations(limit = 20) {
  const [mutations, setMutations] = useState<AgentMutation[]>([])

  useEffect(() => {
    const fetch = async () => {
      const { data } = await supabase
        .from('agent_mutations')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(limit)
      if (data) setMutations(data)
    }

    fetch()

    const channel = supabase
      .channel('mutations-realtime')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'agent_mutations' },
        () => fetch()
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [limit])

  return mutations
}
