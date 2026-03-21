import { NodeInfo } from "@/types"

const API_BASE_URL = "/api"

export async function fetchNodes(): Promise<NodeInfo[]> {
  const response = await fetch(`${API_BASE_URL}/nodes`)
  if (!response.ok) {
    throw new Error("Failed to fetch nodes")
  }
  const data = await response.json()
  return data.nodes || []
}

export async function fetchDatabaseNodes(): Promise<NodeInfo[]> {
  const response = await fetch(`${API_BASE_URL}/nodes/database`)
  if (!response.ok) {
    throw new Error("Failed to fetch nodes from database")
  }
  const data = await response.json()
  return data.nodes || []
}

export async function updateNodeName(nodeId: string, name: string): Promise<void> {
  const response = await fetch(`${API_BASE_URL}/nodes/${nodeId}/name`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ name })
  })
  
  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.error || 'Failed to update node name')
  }
}

export async function fetchNode(id: string): Promise<NodeInfo | null> {
  const response = await fetch(`${API_BASE_URL}/nodes/${id}`)
  if (!response.ok) {
    return null
  }
  return await response.json()
}

export async function fetchStats() {
  const response = await fetch(`${API_BASE_URL}/stats`)
  if (!response.ok) {
    throw new Error("Failed to fetch stats")
  }
  return await response.json()
}
