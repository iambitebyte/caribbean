import { useState, useEffect, useCallback } from "react"
import { useTranslation } from "react-i18next"
import { BrowserRouter as Router, Routes, Route, useNavigate, useLocation } from "react-router-dom"
import { NodeInfo, OpenClawGatewayStatus } from "@/types"
import { Card, CardContent } from "@/components/ui/Card"
import { Button } from "@/components/ui/Button"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/Table"
import { Badge } from "@/components/ui/Badge"
import { Checkbox } from "@/components/ui/Checkbox"
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from "@/components/ui/DropdownMenu"
import { LanguageSwitcher } from "@/components/LanguageSwitcher"
import { EditNameDialog } from "@/components/EditNameDialog"
import { NodeCard } from "@/components/NodeCard"
import { ConfigDialog } from "@/components/ConfigDialog"
import { LogsDialog } from "@/components/LogsDialog"
import { Cpu, MemoryStick, RefreshCw, Server, Clock, Pencil, LogOut, AlertCircle, ChevronDown, Play, Square, LayoutList, LayoutGrid } from "lucide-react"
import { fetchAuthStatus, fetchDatabaseNodes, fetchStats, updateNodeName, sendNodeCommand, deleteNode, getNodeConfig, getNodeLogs } from "@/lib/api"
import { tokenManager } from "@/lib/auth"
import { cn } from "@/lib/utils"
import { motion, AnimatePresence } from "framer-motion"
import Login from "@/components/Login"

function OpenClawGatewayStatusBadge({ status }: { status: string | OpenClawGatewayStatus }) {
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

function ProtectedRoute({ children, authEnabled }: { children: React.ReactNode; authEnabled: boolean }) {
  const isAuthenticated = tokenManager.isAuthenticated();
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    if (authEnabled && !isAuthenticated) {
      navigate('/login', { state: { from: location } });
    }
  }, [authEnabled, isAuthenticated, navigate, location]);

  if (authEnabled && !isAuthenticated) {
    return null;
  }

  return <>{children}</>;
}

function AppContent({ authEnabled }: { authEnabled: boolean }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [nodes, setNodes] = useState<NodeInfo[]>([])
  const [, setStats] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [hasLoadedOnce, setHasLoadedOnce] = useState(false)
  const [editingNode, setEditingNode] = useState<{ id: string; name: string } | null>(null)
  const [showAuthErrorDialog, setShowAuthErrorDialog] = useState(false)
  const [selectedNodes, setSelectedNodes] = useState<Set<string>>(new Set())
  const [executing, setExecuting] = useState(false)
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [viewMode, setViewMode] = useState<'list' | 'card'>('list')
  const [showConfigDialog, setShowConfigDialog] = useState(false)
  const [configNode, setConfigNode] = useState<NodeInfo | null>(null)
  const [configData, setConfigData] = useState<unknown>(null)
  const [configLoading, setConfigLoading] = useState(false)
  const [configError, setConfigError] = useState<string | null>(null)
  const [showLogsDialog, setShowLogsDialog] = useState(false)
  const [logsNode, setLogsNode] = useState<NodeInfo | null>(null)
  const [logsData, setLogsData] = useState<string>('')
  const [logsLoading, setLogsLoading] = useState(false)
  const [logsError, setLogsError] = useState<string | null>(null)

  const getGatewayStatus = useCallback((node: NodeInfo): string => {
    if (!node.connected || !node.status?.openclawGateway) return 'unknown'
    const gw = node.status.openclawGateway
    return typeof gw === 'string' ? gw : gw.status
  }, [])

  const toggleNode = useCallback((nodeId: string) => {
    setSelectedNodes(prev => {
      const next = new Set(prev)
      if (next.has(nodeId)) next.delete(nodeId)
      else next.add(nodeId)
      return next
    })
  }, [])

  const toggleAll = useCallback(() => {
    if (selectedNodes.size === nodes.length) {
      setSelectedNodes(new Set())
    } else {
      setSelectedNodes(new Set(nodes.map(n => n.id)))
    }
  }, [selectedNodes.size, nodes])

  const selectedGatewayStatuses = nodes
    .filter(n => selectedNodes.has(n.id))
    .map(n => getGatewayStatus(n))

  const canStart = selectedGatewayStatuses.length > 0 &&
    selectedGatewayStatuses.every(s => s === 'stopped')
  const canStop = selectedGatewayStatuses.length > 0 &&
    selectedGatewayStatuses.every(s => s === 'running')

  const handleLogout = () => {
    tokenManager.removeToken();
    navigate('/login');
  };

  const handleAuthErrorConfirm = () => {
    setShowAuthErrorDialog(false);
    navigate('/login');
  };

  const loadData = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)

      try {
        const nodesData = await fetchDatabaseNodes()
        setNodes(nodesData)
      } catch (nodesErr: any) {
        console.error("Failed to fetch nodes from database:", nodesErr)
        if (nodesErr.response?.status === 401) {
          setShowAuthErrorDialog(true);
          return;
        }
        if (!hasLoadedOnce) {
          setError("无法连接到服务器")
        }
      }

      try {
        const statsData = await fetchStats()
        setStats(statsData)
      } catch (statsErr: any) {
        console.error("Failed to fetch stats:", statsErr)
        if (statsErr.response?.status === 401) {
          setShowAuthErrorDialog(true);
          return;
        }
      }

      setHasLoadedOnce(true)
    } catch (err: any) {
      console.error("Error loading data:", err)
      if (err.response?.status === 401) {
        setShowAuthErrorDialog(true);
        return;
      }
      if (!hasLoadedOnce) {
        setError(err instanceof Error ? err.message : "Failed to load data")
      }
    } finally {
      setLoading(false)
    }
  }, [hasLoadedOnce])

  const handleBatchAction = useCallback(async (action: 'openclaw_gateway_start' | 'openclaw_gateway_stop') => {
    const targets = nodes.filter(n => {
      if (!n.connected) return false
      const gwStatus = getGatewayStatus(n)
      if (action === 'openclaw_gateway_start') return gwStatus !== 'running'
      return gwStatus === 'running'
    }).filter(n => selectedNodes.has(n.id))

    if (targets.length === 0) return

    setExecuting(true)
    let successCount = 0
    let failCount = 0

    await Promise.allSettled(
      targets.map(async (node) => {
        try {
          await sendNodeCommand(node.id, action)
          successCount++
        } catch {
          failCount++
        }
      })
    )

    setExecuting(false)
    setSelectedNodes(new Set())

    setTimeout(() => loadData(), 2000)
  }, [nodes, selectedNodes, getGatewayStatus, loadData])

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

  const handleDeleteNodes = async () => {
    if (selectedNodes.size === 0) return

    setExecuting(true)
    let successCount = 0
    let failCount = 0

    await Promise.allSettled(
      Array.from(selectedNodes).map(async (nodeId) => {
        try {
          await deleteNode(nodeId)
          successCount++
        } catch {
          failCount++
        }
      })
    )

    setExecuting(false)
    setSelectedNodes(new Set())
    setShowDeleteDialog(false)

    setTimeout(() => loadData(), 500)
  }

  const handleViewConfig = async (node: NodeInfo) => {
    setConfigNode(node)
    setShowConfigDialog(true)
    setConfigLoading(true)
    setConfigError(null)
    setConfigData(null)

    try {
      const config = await getNodeConfig(node.id)
      setConfigData(config)
    } catch (error) {
      setConfigError(error instanceof Error ? error.message : 'Failed to load config')
    } finally {
      setConfigLoading(false)
    }
  }

  const handleViewLogs = async (node: NodeInfo) => {
    setLogsNode(node)
    setShowLogsDialog(true)
    setLogsLoading(true)
    setLogsError(null)
    setLogsData('')

    try {
      const logs = await getNodeLogs(node.id)
      setLogsData(logs)
    } catch (error) {
      setLogsError(error instanceof Error ? error.message : 'Failed to load logs')
    } finally {
      setLogsLoading(false)
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
              <h1 className="text-2xl font-bold">{t('header.title')}</h1>
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
              {authEnabled && (
                <motion.div
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                >
                  <Button onClick={handleLogout} variant="outline" size="sm">
                    <LogOut className="h-4 w-4 mr-2" />
                    Logout
                  </Button>
                </motion.div>
              )}
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
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

        <div>
          <div className="flex items-center justify-between mb-8">
            <h2 className="text-xl font-semibold">{t('nodes.title')}</h2>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1 bg-muted rounded-md p-1">
                <Button
                  variant={viewMode === 'list' ? 'default' : 'ghost'}
                  size="sm"
                  className="h-7 px-2"
                  onClick={() => setViewMode('list')}
                >
                  <LayoutList className="h-4 w-4" />
                </Button>
                <Button
                  variant={viewMode === 'card' ? 'default' : 'ghost'}
                  size="sm"
                  className="h-7 px-2"
                  onClick={() => setViewMode('card')}
                >
                  <LayoutGrid className="h-4 w-4" />
                </Button>
              </div>
              {selectedNodes.size > 0 && (
                <span className="text-sm text-muted-foreground">
                  {t('batchActions.selected', { count: selectedNodes.size })}
                </span>
              )}
              <DropdownMenu>
                <DropdownMenuTrigger
                  className={cn(
                    "inline-flex items-center justify-center gap-2 rounded-md text-sm font-medium",
                    "h-9 px-4 py-2 bg-primary text-primary-foreground hover:bg-primary/90",
                    "disabled:pointer-events-none disabled:opacity-50",
                    executing && "opacity-50 pointer-events-none"
                  )}
                >
                  {executing ? t('batchActions.executing') : t('batchActions.executeAction')}
                  {!executing && <ChevronDown className="h-4 w-4" />}
                </DropdownMenuTrigger>
                <DropdownMenuContent>
                  <DropdownMenuItem
                    disabled={!canStart}
                    onSelect={() => handleBatchAction('openclaw_gateway_start')}
                  >
                    <Play className="h-4 w-4 mr-2 text-green-500" />
                    {t('batchActions.start')}
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    disabled={!canStop}
                    onSelect={() => handleBatchAction('openclaw_gateway_stop')}
                  >
                    <Square className="h-4 w-4 mr-2 text-red-500" />
                    {t('batchActions.stop')}
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    disabled={selectedNodes.size === 0}
                    onSelect={() => setShowDeleteDialog(true)}
                  >
                    <AlertCircle className="h-4 w-4 mr-2 text-destructive" />
                    {t('batchActions.delete')}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>

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
        </div>

        {/* No nodes loaded yet */}
        {nodes.length === 0 && !loading && !hasLoadedOnce ? (
          <motion.div
            className="rounded-lg overflow-hidden"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
          >
            <Card className="rounded-none">
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
            className="rounded-lg overflow-hidden"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
          >
            <Card className="rounded-none">
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
              className="rounded-lg overflow-hidden"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3 }}
            >
              {viewMode === 'list' ? (
                <Card className="rounded-none">
                  <CardContent className="p-0">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-10">
                            <Checkbox
                              checked={nodes.length > 0 && selectedNodes.size === nodes.length}
                              onCheckedChange={toggleAll}
                            />
                          </TableHead>
                          <TableHead className="w-16">{t('nodes.status')}</TableHead>
                          <TableHead>{t('nodes.instanceName')}</TableHead>
                          <TableHead>{t('nodes.id')}</TableHead>
                          <TableHead>{t('nodes.clientIp')}</TableHead>
                          <TableHead>{t('nodes.connectionStatus')}</TableHead>
                          <TableHead>Gateway</TableHead>
                          <TableHead>{t('nodes.lastSeen')}</TableHead>
                          <TableHead>{t('nodes.cpu')}</TableHead>
                          <TableHead>{t('nodes.memory')}</TableHead>
                          <TableHead>{t('nodes.uptime')}</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {nodes.map((node) => (
                          <TableRow
                            key={node.id}
                            className={cn(
                              node.connected ? "" : "bg-muted/30",
                              selectedNodes.has(node.id) && "bg-blue-50/50 dark:bg-blue-900/10"
                            )}
                          >
                            <TableCell>
                              <Checkbox
                                checked={selectedNodes.has(node.id)}
                                onCheckedChange={() => toggleNode(node.id)}
                              />
                            </TableCell>
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
                            <TableCell className="text-muted-foreground text-sm">
                              {node.clientIp || '-'}
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
                              {node.connected && node.status?.memory ? (
                                <div className="flex items-center gap-2" title={`${node.status.memory.used}GB / ${node.status.memory.total}GB`}>
                                  <MemoryStick className="h-4 w-4 text-muted-foreground" />
                                  <span>{node.status.memory.percent}%</span>
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
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {nodes.map((node) => (
                    <NodeCard
                      key={node.id}
                      node={node}
                      selected={selectedNodes.has(node.id)}
                      onToggle={toggleNode}
                      onViewConfig={handleViewConfig}
                      onViewLogs={handleViewLogs}
                      getGatewayStatus={getGatewayStatus}
                      formatUptime={formatUptime}
                      formatLastSeen={formatLastSeen}
                    />
                  ))}
                </div>
              )}
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

            <ConfigDialog
              isOpen={showConfigDialog}
              onClose={() => setShowConfigDialog(false)}
              node={configNode}
              config={configData}
              loading={configLoading}
              error={configError}
            />

            <LogsDialog
              isOpen={showLogsDialog}
              onClose={() => setShowLogsDialog(false)}
              node={logsNode}
              logs={logsData}
              loading={logsLoading}
              error={logsError}
            />

           <AnimatePresence>
             {showDeleteDialog && (
               <motion.div
                 initial={{ opacity: 0 }}
                 animate={{ opacity: 1 }}
                 exit={{ opacity: 0 }}
                 className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
                 onClick={() => setShowDeleteDialog(false)}
               >
                 <motion.div
                   initial={{ opacity: 0, scale: 0.95 }}
                   animate={{ opacity: 1, scale: 1 }}
                   exit={{ opacity: 0, scale: 0.95 }}
                   onClick={(e) => e.stopPropagation()}
                   className="bg-card rounded-lg shadow-xl p-6 max-w-md w-full mx-4"
                 >
                   <div className="flex items-center gap-3 mb-4">
                     <AlertCircle className="h-6 w-6 text-destructive" />
                     <h3 className="text-lg font-semibold">{t('batchActions.deleteConfirmTitle')}</h3>
                   </div>
                   <p className="text-muted-foreground mb-6">
                     {t('batchActions.deleteConfirmMessage', { count: selectedNodes.size })}
                   </p>
                   <div className="flex gap-3 justify-end">
                     <Button variant="outline" onClick={() => setShowDeleteDialog(false)}>
                       {t('batchActions.cancel')}
                     </Button>
                     <Button variant="destructive" onClick={handleDeleteNodes} disabled={executing}>
                       {executing ? t('batchActions.executing') : t('batchActions.delete')}
                     </Button>
                   </div>
                 </motion.div>
               </motion.div>
             )}
           </AnimatePresence>

           <AnimatePresence>
            {showAuthErrorDialog && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
                onClick={() => setShowAuthErrorDialog(false)}
              >
                <motion.div
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  onClick={(e) => e.stopPropagation()}
                  className="bg-card rounded-lg shadow-xl p-6 max-w-md w-full mx-4"
                >
                  <div className="flex items-center gap-3 mb-4">
                    <AlertCircle className="h-6 w-6 text-destructive" />
                    <h3 className="text-lg font-semibold">需要登录</h3>
                  </div>
                  <p className="text-muted-foreground mb-6">
                    您的会话已过期，请重新登录以继续访问。
                  </p>
                  <div className="flex gap-3 justify-end">
                    <Button variant="outline" onClick={() => setShowAuthErrorDialog(false)}>
                      取消
                    </Button>
                    <Button onClick={handleAuthErrorConfirm}>
                      前往登录
                    </Button>
                  </div>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>
        </main>
      </div>
    );
  }

export default function App() {
  const [authEnabled, setAuthEnabled] = useState(true)
  const [authLoaded, setAuthLoaded] = useState(false)

  useEffect(() => {
    fetchAuthStatus()
      .then((data) => setAuthEnabled(data.enabled))
      .catch(() => setAuthEnabled(true))
      .finally(() => setAuthLoaded(true))
  }, [])

  if (!authLoaded) return null

  return (
    <Router>
      <Routes>
        {authEnabled && <Route path="/login" element={<Login />} />}
        <Route
          path="/*"
          element={
            <ProtectedRoute authEnabled={authEnabled}>
              <AppContent authEnabled={authEnabled} />
            </ProtectedRoute>
          }
        />
      </Routes>
    </Router>
  );
}
