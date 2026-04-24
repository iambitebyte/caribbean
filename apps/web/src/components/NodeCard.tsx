import { NodeInfo } from "@/types"
import { Card, CardContent } from "@/components/ui/Card"
import { Badge } from "@/components/ui/Badge"
import { Checkbox } from "@/components/ui/Checkbox"
import { Button } from "@/components/ui/Button"
import { Cpu, MemoryStick, Clock, Settings, FileText, Monitor, Package, Activity } from "lucide-react"
import { cn } from "@/lib/utils"
import { useTranslation } from "react-i18next"

interface NodeCardProps {
  node: NodeInfo
  selected: boolean
  onToggle: (nodeId: string) => void
  onViewConfig: (node: NodeInfo) => void
  onViewLogs: (node: NodeInfo) => void
  onViewAgent: (node: NodeInfo) => void
  getGatewayStatus: (node: NodeInfo) => string
  formatUptime: (seconds: number) => string
  formatLastSeen: (date: Date) => string
}

function OpenClawGatewayStatusBadge({ status }: { status: string }) {
  return (
    <Badge variant={status === 'running' ? "blue" : "destructive"} className="whitespace-nowrap">
      {status}
    </Badge>
  )
}

export function NodeCard({ node, selected, onToggle, onViewConfig, onViewLogs, onViewAgent, getGatewayStatus, formatUptime, formatLastSeen }: NodeCardProps) {
  const { t } = useTranslation()

  return (
    <Card
      className={cn(
        "transition-all duration-300 hover:shadow-lg hover:-translate-y-1",
        !node.connected && "opacity-60 grayscale-[0.5]",
        selected && "border-2 border-[hsl(var(--primary))] shadow-lg"
      )}
    >
      <CardContent className="p-5">
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-3">
            <Checkbox
              checked={selected}
              onCheckedChange={() => onToggle(node.id)}
            />
            <div className="flex items-center gap-2">
              {node.connected ? (
                <img
                  src="/img/openclaw-logo.svg"
                  alt="OpenClaw Logo"
                  className="h-6 w-6"
                />
              ) : (
                <img
                  src="/img/openclaw-logo.svg"
                  alt="OpenClaw Logo"
                  className="h-6 w-6 opacity-40"
                  style={{ filter: 'grayscale(100%)' }}
                />
              )}
              <div>
                <h3 className="font-semibold text-base">{node.name || 'unknown'}</h3>
                <p className="text-xs text-muted-foreground font-mono">{node.id}</p>
              </div>
            </div>
          </div>
          <Badge variant={node.connected ? "success" : "destructive"} className="whitespace-nowrap">
            {node.connected ? t('nodes.connected') : t('nodes.disconnected')}
          </Badge>
        </div>

        <div className="grid grid-cols-2 gap-3 mb-4">
          <div className="bg-muted/30 rounded-lg p-2">
            <p className="text-xs text-muted-foreground mb-1">{t('nodes.clientIp')}</p>
            <p className="text-sm font-medium">{node.clientIp || '-'}</p>
          </div>
          <div className="bg-muted/30 rounded-lg p-2">
            <p className="text-xs text-muted-foreground mb-1">{t('nodes.system')}</p>
            {node.system ? (
              <div className="flex items-center gap-1">
                <Monitor className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="text-sm font-medium capitalize">{node.system}</span>
              </div>
            ) : (
              <span className="text-sm text-muted-foreground">-</span>
            )}
          </div>
          <div className="bg-muted/30 rounded-lg p-2">
            <p className="text-xs text-muted-foreground mb-1">OpenClaw</p>
            {node.openclawVersion || node.status?.openclawVersion ? (
              <div className="flex items-center gap-1">
                <Package className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="text-sm font-medium">{node.openclawVersion || node.status?.openclawVersion}</span>
              </div>
            ) : (
              <span className="text-sm text-muted-foreground">-</span>
            )}
          </div>
          <div className="bg-muted/30 rounded-lg p-2">
            <p className="text-xs text-muted-foreground mb-1">Gateway</p>
            {node.connected ? (
              node.status?.openclawGateway ? (
                <OpenClawGatewayStatusBadge status={getGatewayStatus(node)} />
              ) : (
                <span className="text-sm text-muted-foreground">-</span>
              )
            ) : (
              <Badge variant="secondary" className="whitespace-nowrap">
                unknown
              </Badge>
            )}
          </div>
          <div className="bg-muted/30 rounded-lg p-2">
            <p className="text-xs text-muted-foreground mb-1">{t('nodes.cpu')}</p>
            {node.connected && node.status?.cpu ? (
              <div className="flex items-center gap-1">
                <Cpu className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="text-sm font-medium">{node.status.cpu.percent}%</span>
              </div>
            ) : (
              <span className="text-sm text-muted-foreground">-</span>
            )}
          </div>
          <div className="bg-muted/30 rounded-lg p-2">
            <p className="text-xs text-muted-foreground mb-1">{t('nodes.memory')}</p>
            {node.connected && node.status?.memory ? (
              <div className="flex items-center gap-1">
                <MemoryStick className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="text-sm font-medium">{node.status.memory.percent}%</span>
              </div>
            ) : (
              <span className="text-sm text-muted-foreground">-</span>
            )}
          </div>
          <div className="bg-muted/30 rounded-lg p-2 col-span-2">
            <p className="text-xs text-muted-foreground mb-1">{t('nodes.uptime')}</p>
            {node.connected && node.status?.uptime ? (
              <div className="flex items-center gap-1">
                <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="text-sm font-medium">{formatUptime(node.status.uptime)}</span>
              </div>
            ) : (
              <span className="text-sm text-muted-foreground">-</span>
            )}
          </div>
          <div className="bg-muted/30 rounded-lg p-2 col-span-2">
            <p className="text-xs text-muted-foreground mb-1">{t('nodes.lastSeen')}</p>
            <p className="text-sm font-medium">{formatLastSeen(node.lastSeen)}</p>
          </div>
        </div>

        <div className="flex gap-2 pt-3 border-t">
          <Button
            variant="outline"
            size="sm"
            className="flex-1"
            onClick={() => onViewConfig(node)}
            disabled={!node.connected}
          >
            <Settings className="h-4 w-4 mr-1" />
            {t('nodes.configuration')}
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="flex-1"
            onClick={() => onViewLogs(node)}
            disabled={!node.connected}
          >
            <FileText className="h-4 w-4 mr-1" />
            {t('nodes.logs')}
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="flex-1"
            onClick={() => onViewAgent(node)}
            disabled={!node.connected}
          >
            <Activity className="h-4 w-4 mr-1" />
            Agent
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
