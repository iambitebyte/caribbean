import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/Dialog"
import { Button } from "@/components/ui/Button"
import { RefreshCw, X, Activity } from "lucide-react"

interface StatusHistoryEntry {
  id: number
  nodeId: string
  status: {
    cpu?: { percent: number }
    memory?: { percent: number; used: number; total: number }
    uptime?: number
    openclawVersion?: string
    openclawGateway?: { status: string } | string
    agents?: string[]
    timestamp?: string
  }
  openclawStatus: string
  timestamp: Date
}

interface AgentDialogProps {
  isOpen: boolean
  onClose: () => void
  node: any
  history: StatusHistoryEntry[]
  loading: boolean
  error: string | null
  onRefresh: () => void
}

function formatUptime(seconds: number): string {
  const hours = Math.floor(seconds / 3600)
  const days = Math.floor(hours / 24)
  const remainingHours = hours % 24
  if (days > 0) return `${days}d ${remainingHours}h`
  return `${hours}h`
}

function formatTimestamp(date: Date): string {
  const now = new Date()
  const diff = now.getTime() - new Date(date).getTime()
  const minutes = Math.floor(diff / 60000)
  const hours = Math.floor(diff / 3600000)
  const days = Math.floor(diff / 86400000)

  if (minutes < 1) return 'Just now'
  if (minutes < 60) return `${minutes}m ago`
  if (hours < 24) return `${hours}h ago`
  return `${days}d ago`
}

export function AgentDialog({ isOpen, onClose, node, history, loading, error, onRefresh }: AgentDialogProps) {
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[80vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <DialogTitle className="flex items-center gap-2">
              <Activity className="h-5 w-5" />
              Agent Status - {node?.name || 'unknown'}
            </DialogTitle>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                className="h-8 px-2"
                onClick={onRefresh}
                disabled={loading}
              >
                <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="h-8 w-8 p-0"
                onClick={onClose}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-auto mt-4">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : error ? (
            <div className="p-6 bg-destructive/10 border border-destructive/30 rounded-lg">
              <p className="text-destructive">{error}</p>
            </div>
          ) : history && history.length > 0 ? (
            <div className="space-y-3">
              {history.map((entry, index) => (
                <div
                  key={entry.id}
                  className="bg-muted/30 rounded-lg p-4 border border-border/50"
                >
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-sm font-medium text-muted-foreground">
                      #{history.length - index} - {formatTimestamp(entry.timestamp)}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {new Date(entry.timestamp).toLocaleString()}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    {entry.status.cpu && (
                      <div>
                        <p className="text-xs text-muted-foreground mb-1">CPU</p>
                        <p className="text-sm font-medium">{entry.status.cpu.percent}%</p>
                      </div>
                    )}
                    {entry.status.memory && (
                      <div>
                        <p className="text-xs text-muted-foreground mb-1">Memory</p>
                        <p className="text-sm font-medium">{entry.status.memory.percent}%</p>
                      </div>
                    )}
                    {entry.status.uptime && (
                      <div>
                        <p className="text-xs text-muted-foreground mb-1">Uptime</p>
                        <p className="text-sm font-medium">{formatUptime(entry.status.uptime)}</p>
                      </div>
                    )}
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">Gateway</p>
                      <p className={`text-sm font-medium ${
                        entry.openclawStatus === 'running' ? 'text-green-600 dark:text-green-400' : 'text-destructive'
                      }`}>
                        {entry.openclawStatus}
                      </p>
                    </div>
                  </div>

                  {entry.status.agents && entry.status.agents.length > 0 && (
                    <div className="mt-3 pt-3 border-t border-border/50">
                      <p className="text-xs text-muted-foreground mb-2">Active Agents</p>
                      <div className="flex flex-wrap gap-1">
                        {entry.status.agents.map((agent, i) => (
                          <span
                            key={i}
                            className="px-2 py-0.5 bg-primary/10 text-primary rounded text-xs"
                          >
                            {agent}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {entry.status.openclawVersion && (
                    <div className="mt-2">
                      <span className="text-xs text-muted-foreground">
                        OpenClaw: {entry.status.openclawVersion}
                      </span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-12 text-muted-foreground">
              No status history available
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
