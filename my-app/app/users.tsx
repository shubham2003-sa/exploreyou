import React, { useEffect, useState } from "react"

interface User {
  name: string
  email: string
  preferences: Record<string, unknown>
}

const UsersPage: React.FC = () => {
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    const loadUsers = async () => {
      try {
        const res = await fetch("/api/users")
        if (!res.ok) {
          throw new Error("Failed to fetch users")
        }
        const data = (await res.json()) as User[]
        if (!cancelled) {
          setUsers(data)
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to fetch users")
        }
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    }

    void loadUsers()

    return () => {
      cancelled = true
    }
  }, [])

  if (loading) return <div>Loading users...</div>
  if (error) return <div>Error: {error}</div>

  return (
    <div>
      <h1>Users</h1>
      <ul>
        {users.map((user) => (
          <li key={user.email}>
            <strong>{user.name}</strong> ({user.email})<br />
            Preferences: {JSON.stringify(user.preferences)}
          </li>
        ))}
      </ul>
    </div>
  )
}

export default UsersPage
