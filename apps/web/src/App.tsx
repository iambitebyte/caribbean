import { useState, useEffect } from "react"
import { useTranslation } from "react-i18next"
import { NodeInfo } from "@/types"
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/Card"
import { Button } from "@/components/ui/Button"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/Table"
import { Badge } from "@/components/ui/Badge"
import { LanguageSwitcher } from "@/components/LanguageSwitcher"
import { EditNameDialog } from "@/components/EditNameDialog"
import { Activity, Cpu, RefreshCw, Server, Plug, Clock, Pencil } from "lucide-react"
import { ShrimpIcon } from "@/components/icons/ShrimpIcon"
import { fetchDatabaseNodes, fetchStats, updateNodeName } from "@/lib/api"
import { motion } from "framer-motion"
import type { OpenClawGatewayStatus as OpenClawGatewayStatusType } from "@/types"

function OpenClawGatewayStatusBadge({ status }: { status: string | OpenClawGatewayStatusType }) {
  if (typeof status === 'string') {
    return (
      <Badge variant={status === 'running' ? "blue" : "destructive"} className="whitespace-nowrap">
        {status}
      </Badge>
    )
  }

  return (
    <Badge
      variant={status.status === 'running' ? "blue" : "destructive"}
      className="whitespace-nowrap"
    >
      {status.status}
    </Badge>
  )
}

function App() {
  const { t } = useTranslation();
  const [nodes, setNodes] = useState<NodeInfo[]>([])
  const [stats, setStats] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [hasLoadedOnce, setHasLoadedOnce] = useState(false)
  const [editingNode, setEditingNode] = useState<{ id: string; name: string } | null>(null)

  const loadData = async () => {
    try {
      setLoading(true)
      setError(null)

      // Try to fetch data from database, but don't clear existing data on failure
      let nodesData = nodes
      let statsData = stats

      try {
        nodesData = await fetchDatabaseNodes()
        setNodes(nodesData)
      } catch (nodesErr) {
        console.error("Failed to fetch nodes from database:", nodesErr)
        if (!hasLoadedOnce) {
          setError("无法连接到服务器")
        }
      }

      try {
        statsData = await fetchStats()
        setStats(statsData)
      } catch (statsErr) {
        console.error("Failed to fetch stats:", statsErr)
        // Don't show error for stats, just log it
      }

      setHasLoadedOnce(true)
    } catch (err) {
      console.error("Error loading data:", err)
      if (!hasLoadedOnce) {
        setError(err instanceof Error ? err.message : "Failed to load data")
      }
    } finally {
      setLoading(false)
    }
  }

  const handleEditName = (nodeId: string, name: string) => {
    setEditingNode({ id: nodeId, name: name })
  }

  const handleSaveName = async (nodeId: string, newName: string) => {
    try {
      await updateNodeName(nodeId, newName)
      // Reload nodes after successful update
      const nodesData = await fetchDatabaseNodes()
      setNodes(nodesData)
    } catch (err) {
      console.error("Failed to update node name:", err)
      throw err
    }
  }

  useEffect(() => {
    loadData()
    const interval = setInterval(loadData, 10000) // Refresh every 10 seconds
    return () => clearInterval(interval)
  }, [])

  const formatUptime = (seconds: number) => {
    const hours = Math.floor(seconds / 3600)
    const days = Math.floor(hours / 24)
    const remainingHours = hours % 24
    if (days > 0) return `${days}d ${remainingHours}h`
    return `${hours}h`
  }

  const formatLastSeen = (date: Date) => {
    const now = new Date()
    const diff = now.getTime() - (date instanceof Date ? date.getTime() : new Date(date).getTime())
    const minutes = Math.floor(diff / 60000)
    const hours = Math.floor(diff / 3600000)
    const days = Math.floor(diff / 86400000)

    if (minutes < 1) return t('nodes.justNow')
    if (minutes < 60) return `${minutes} ${t('nodes.minutesAgo')}`
    if (hours < 24) return `${hours} ${t('nodes.hoursAgo')}`
    return `${days} ${t('nodes.daysAgo')}`
  }

  if (error && !hasLoadedOnce) {
    return (
      <div className="min-h-screen bg-background p-8">
        <div className="max-w-7xl mx-auto">
          <div className="text-center py-12">
            <h1 className="text-2xl font-bold text-destructive mb-4">{t('errors.title')}</h1>
            <p className="text-muted-foreground mb-4">{error}</p>
            <p className="text-sm text-muted-foreground mb-4">{t('errors.retryMessage')}</p>
            <Button onClick={loadData}>{t('errors.retry')}</Button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div>
                <h1 className="text-2xl font-bold">{t('header.title')}</h1>
                <p className="text-sm text-muted-foreground">{t('header.subtitle')}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <LanguageSwitcher />
              <motion.div
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >
                <Button onClick={loadData} variant="outline" size="sm">
                  <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
                  {t('header.refresh')}
                </Button>
              </motion.div>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Show connection warning if refresh failed after initial load */}
        {error && hasLoadedOnce && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-4 p-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg"
          >
            <div className="flex items-center gap-2 text-yellow-800 dark:text-yellow-200">
              <span className="text-sm">⚠️ {error} - {t('errors.dataError')}</span>
            </div>
          </motion.div>
        )}

        {(stats || hasLoadedOnce) && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: 0.1 }}
            >
              <Card className="hover:shadow-lg transition-shadow duration-300">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                    <Server className="h-4 w-4" />
                    {t('stats.registeredAgents')}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <motion.div
                    className="text-3xl font-bold"
                    initial={{ scale: 0.5, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ type: "spring", stiffness: 200, damping: 10 }}
                  >
                    {stats ? stats.total : nodes.length}
                  </motion.div>
                  <div className="flex items-center gap-2 mt-1">
                    <div className="flex items-center gap-1 text-green-500">
                      <Plug className="h-3 w-3" />
                      <span className="text-xs text-green-500">
                        {stats ? stats.connected : nodes.filter(n => n.connected).length} {t('stats.online')}
                      </span>
                    </div>
                    {(stats ? stats.disconnected : nodes.length - nodes.filter(n => n.connected).length) > 0 && (
                      <div className="flex items-center gap-1 text-red-500">
                        <span className="text-xs text-red-500">
                          {stats ? stats.disconnected : nodes.length - nodes.filter(n => n.connected).length} {t('stats.offline')}
                        </span>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: 0.2 }}
            >
              <Card className="hover:shadow-lg transition-shadow duration-300">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                    <Activity className="h-4 w-4" />
                    {t('stats.running')}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <motion.div
                    className="text-3xl font-bold text-green-500"
                    initial={{ scale: 0.5, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ type: "spring", stiffness: 200, damping: 10 }}
                  >
                    {nodes.filter(n => n.connected).length}
                  </motion.div>
                  <p className="text-xs text-muted-foreground mt-1">
                    {nodes.filter(n => n.connected).length} / {nodes.length} {t('stats.instancesOnline')}
                  </p>
                </CardContent>
              </Card>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: 0.3 }}
            >
              <Card className="hover:shadow-lg transition-shadow duration-300">
                 <CardHeader className="pb-2">
                   <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                     <ShrimpIcon size={16} />
                     OpenClaw {t('stats.totalInstances')}
                   </CardTitle>
                 </CardHeader>
                <CardContent>
                  <motion.div
                    className="text-3xl font-bold text-blue-500"
                    initial={{ scale: 0.5, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ type: "spring", stiffness: 200, damping: 10 }}
                  >
                    {nodes.length}
                  </motion.div>
                  <p className="text-xs text-muted-foreground mt-1">
                    {t('stats.totalInstances')}
                  </p>
                </CardContent>
              </Card>
            </motion.div>
          </div>
        )}

        <div className="mb-4">
          <h2 className="text-xl font-semibold mb-2">{t('nodes.title')}</h2>

          {/* First time loading */}
          {loading && !hasLoadedOnce && (
            <motion.div
              className="text-center py-8 text-muted-foreground"
              animate={{ opacity: 0.5 }}
              transition={{ duration: 1, repeat: Infinity, ease: "easeInOut" }}
            >
              {t('nodes.loading')}
            </motion.div>
          )}

          {/* Refreshing with existing data */}
          {loading && hasLoadedOnce && nodes.length > 0 && (
            <motion.div
              className="text-sm text-muted-foreground"
              animate={{ opacity: 0.6 }}
            >
              <RefreshCw className="h-4 w-4 inline mr-2 animate-spin" />
              {t('nodes.refreshing')}
            </motion.div>
          )}
        </div>

        {/* No nodes loaded yet */}
        {nodes.length === 0 && !loading && !hasLoadedOnce ? (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
          >
            <Card>
              <CardContent className="py-12">
                <div className="text-center">
                  <motion.div
                    initial={{ scale: 0.8, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ type: "spring", stiffness: 200, damping: 10 }}
                    className="mb-4"
                  >
                    <Server className="h-16 w-16 text-muted-foreground mx-auto" />
                  </motion.div>
                  <p className="text-muted-foreground mb-4">{t('nodes.noInstances')}</p>
                  <p className="text-sm text-muted-foreground">
                    {t('nodes.startAgent')}
                  </p>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        ) : nodes.length === 0 ? (
          /* Loaded but no nodes */
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
          >
            <Card>
              <CardContent className="py-12">
                <div className="text-center">
                  <p className="text-muted-foreground mb-2">{t('nodes.noInstancesDb')}</p>
                  <p className="text-sm text-muted-foreground">
                    {t('nodes.noInstancesServer')}
                  </p>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        ) : (
          <>
            {/* Show offline warning if all nodes are offline */}
            {nodes.filter(n => n.connected).length === 0 && hasLoadedOnce && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="mb-4 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg"
              >
                <div className="flex items-center gap-2 text-red-800 dark:text-red-200">
                  <span>⚠️ {t('nodes.allOffline')}</span>
                </div>
              </motion.div>
            )}

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3 }}
            >
              <Card>
                <CardContent className="p-0">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-16">{t('nodes.status')}</TableHead>
                        <TableHead>{t('nodes.instanceName')}</TableHead>
                        <TableHead>{t('nodes.id')}</TableHead>
                        <TableHead>{t('nodes.tags')}</TableHead>
                        <TableHead>{t('nodes.connectionStatus')}</TableHead>
                        <TableHead>Gateway</TableHead>
                        <TableHead>{t('nodes.lastSeen')}</TableHead>
                        <TableHead>{t('nodes.cpu')}</TableHead>
                        <TableHead>{t('nodes.uptime')}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {nodes.map((node) => (
                        <TableRow
                          key={node.id}
                          className={node.connected ? "" : "bg-muted/30"}
                        >
                          <TableCell>
                            <div className="flex items-center justify-center">
                              {node.connected ? (
                                <motion.div
                                  animate={{
                                    scale: [1, 1.1, 1],
                                    rotate: [0, 10, -10, 0]
                                  }}
                                  transition={{
                                    duration: 2,
                                    repeat: Infinity,
                                    ease: "easeInOut"
                                  }}
                                >
                                  <img 
                                    src="/img/openclaw-logo.svg" 
                                    alt="OpenClaw Logo" 
                                    className="h-4 w-4"
                                  />
                                </motion.div>
                              ) : (
                                <img 
                                  src="/img/openclaw-logo.svg" 
                                  alt="OpenClaw Logo" 
                                  className="h-4 w-4 opacity-50"
                                  style={{ filter: 'grayscale(100%)' }}
                                />
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <span className="font-medium">{node.name || 'unknown'}</span>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-6 w-6 p-0 hover:bg-muted/50"
                                onClick={() => handleEditName(node.id, node.name || 'unknown')}
                              >
                                <Pencil className="h-3 w-3" />
                              </Button>
                            </div>
                          </TableCell>
                          <TableCell className="text-muted-foreground text-sm">{node.id}</TableCell>
                          <TableCell>
                            <div className="flex flex-wrap gap-1">
                              {node.tags && node.tags.length > 0 ? (
                                node.tags.map((tag: string, i: number) => (
                                  <Badge key={i} variant="secondary" className="text-xs">
                                    {tag}
                                  </Badge>
                                ))
                              ) : (
                                <span className="text-muted-foreground text-sm">-</span>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge variant={node.connected ? "success" : "destructive"} className="whitespace-nowrap">
                              {node.connected ? t('nodes.connected') : t('nodes.disconnected')}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            {node.connected ? (
                              node.status?.openclawGateway ? (
                                <OpenClawGatewayStatusBadge status={node.status.openclawGateway} />
                              ) : (
                                <span className="text-muted-foreground text-sm">-</span>
                              )
                            ) : (
                              <Badge variant="secondary" className="whitespace-nowrap">
                                unknown
                              </Badge>
                            )}
                          </TableCell>
                          <TableCell className="text-muted-foreground text-sm">
                            {formatLastSeen(node.lastSeen)}
                          </TableCell>
                          <TableCell>
                            {node.connected && node.status?.cpu ? (
                              <div className="flex items-center gap-2">
                                <Cpu className="h-4 w-4 text-muted-foreground" />
                                <span>{node.status.cpu.percent}%</span>
                              </div>
                            ) : (
                              <span className="text-muted-foreground">-</span>
                            )}
                          </TableCell>
                          <TableCell>
                            {node.connected && node.status?.uptime ? (
                              <div className="flex items-center gap-2">
                                <Clock className="h-4 w-4 text-muted-foreground" />
                                <span>{formatUptime(node.status.uptime)}</span>
                              </div>
                            ) : (
                              <span className="text-muted-foreground">-</span>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </motion.div>
           </>
         )}
         
         <EditNameDialog
           isOpen={editingNode !== null}
           onClose={() => setEditingNode(null)}
           nodeId={editingNode?.id || ''}
           currentName={editingNode?.name || ''}
           onSave={handleSaveName}
         />
       </main>
     </div>
   )
}

export default App
