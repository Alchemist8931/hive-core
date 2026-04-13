// ============================================================
// GitHub API — read-only access for UI
// Used to display commit history and file diffs
// (Secretary writes via Edge Functions, not from the browser)
// ============================================================

const GITHUB_API = 'https://api.github.com'

interface GitHubCommit {
  sha: string
  commit: {
    message: string
    author: {
      name: string
      date: string
    }
  }
  html_url: string
}

/**
 * Get recent commits for a file path
 * Works without auth for public repos; for private repos
 * the user would need to provide a read-only token
 */
export async function getFileCommits(
  repo: string,
  filePath: string,
  token?: string
): Promise<GitHubCommit[]> {
  const headers: Record<string, string> = {
    Accept: 'application/vnd.github.v3+json',
  }
  if (token) {
    headers.Authorization = `token ${token}`
  }

  const res = await fetch(
    `${GITHUB_API}/repos/${repo}/commits?path=${encodeURIComponent(filePath)}&per_page=10`,
    { headers }
  )

  if (!res.ok) return []
  return res.json()
}

/**
 * Get the content of a file from the repo
 */
export async function getFileContent(
  repo: string,
  filePath: string,
  token?: string
): Promise<string | null> {
  const headers: Record<string, string> = {
    Accept: 'application/vnd.github.v3+json',
  }
  if (token) {
    headers.Authorization = `token ${token}`
  }

  const res = await fetch(
    `${GITHUB_API}/repos/${repo}/contents/${encodeURIComponent(filePath)}`,
    { headers }
  )

  if (!res.ok) return null
  const data = await res.json()
  return atob(data.content)
}
