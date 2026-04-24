import { useState, useEffect } from "react"
import { useTranslation } from "react-i18next"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card"
import { Button } from "@/components/ui/Button"
import { Badge } from "@/components/ui/Badge"
import { Checkbox } from "@/components/ui/Checkbox"
import { Plus, Pencil, Trash2, Bell, BellOff, Check, Send } from "lucide-react"
import { cn } from "@/lib/utils"
import { motion, AnimatePresence } from "framer-motion"
import {
  fetchNotifications,
  createNotification,
  updateNotification,
  deleteNotification,
  sendNodeCommand,
  fetchDatabaseNodes
} from "@/lib/api"
import type { Notification, NodeInfo } from "@/types"

interface InstanceTestDialog {
  nodeId: string
  nodeName: string
  userId: string
  channel: string
}

interface NotificationFormData {
  channel: 'telegram'
  userId: string
  messageTemplate: string
  instanceIds: string[]
}

export function NotificationSettings() {
  const { t } = useTranslation()
  const [loading, setLoading] = useState(true)
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [nodes, setNodes] = useState<NodeInfo[]>([])
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null)
  const [showDeleteDialog, setShowDeleteDialog] = useState<string | null>(null)
  const [instanceTestDialog, setInstanceTestDialog] = useState<InstanceTestDialog | null>(null)
  const [testMessage, setTestMessage] = useState('')
  const [sendingTest, setSendingTest] = useState(false)

  const [formData, setFormData] = useState<NotificationFormData>({
    channel: 'telegram',
    userId: '',
    messageTemplate: 'OpenClaw 实例 ${name} 已下线',
    instanceIds: []
  })

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    try {
      setLoading(true)
      const [notificationsData, nodesData] = await Promise.all([
        fetchNotifications(),
        fetchDatabaseNodes()
      ])
      setNotifications(notificationsData)
      setNodes(nodesData)
    } catch (error) {
      console.error('Failed to load data:', error)
      setMessage({ type: 'error', text: t('settings.loadError') })
    } finally {
      setLoading(false)
    }
  }

  const handleOpenCreate = () => {
    setEditingId(null)
    setFormData({
      channel: 'telegram',
      userId: '',
      messageTemplate: 'OpenClaw 实例 ${name} 已下线',
      instanceIds: []
    })
    setShowForm(true)
    setMessage(null)
  }

  const handleOpenEdit = (notification: Notification) => {
    setEditingId(notification.id)
    setFormData({
      channel: notification.channel,
      userId: notification.userId,
      messageTemplate: notification.messageTemplate,
      instanceIds: notification.instanceIds
    })
    setShowForm(true)
    setMessage(null)
  }

  const handleSave = async () => {
    // Validation
    if (!formData.userId.trim()) {
      setMessage({ type: 'error', text: t('settings.notifications.userIdInvalid') })
      return
    }

    const userIdNumeric = formData.userId.trim()
    if (!/^\d{10}$/.test(userIdNumeric)) {
      setMessage({ type: 'error', text: t('settings.notifications.userIdInvalid') })
      return
    }

    if (!formData.messageTemplate.trim()) {
      setMessage({ type: 'error', text: t('settings.notifications.messageTemplate') + ' is required' })
      return
    }

    if (formData.instanceIds.length === 0) {
      setMessage({ type: 'error', text: t('settings.notifications.selectInstances') })
      return
    }

    try {
      setSaving(true)
      setMessage(null)

      const data = {
        ...formData,
        userId: userIdNumeric
      }

      if (editingId) {
        const updated = await updateNotification(editingId, data)
        setNotifications(prev => prev.map(n => n.id === editingId ? updated : n))
      } else {
        const created = await createNotification(data)
        setNotifications(prev => [created, ...prev])
      }

      setMessage({ type: 'success', text: t('settings.notifications.saveSuccess') })
      setTimeout(() => {
        setShowForm(false)
        setMessage(null)
      }, 1500)
    } catch (error: any) {
      console.error('Failed to save notification:', error)
      setMessage({ type: 'error', text: error.response?.data?.error || t('settings.saveError') })
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id: string) => {
    try {
      await deleteNotification(id)
      setNotifications(prev => prev.filter(n => n.id !== id))
      setShowDeleteDialog(null)
      setMessage({ type: 'success', text: 'Notification deleted' })
      setTimeout(() => setMessage(null), 2000)
    } catch (error: any) {
      console.error('Failed to delete notification:', error)
      setMessage({ type: 'error', text: error.response?.data?.error || 'Failed to delete' })
    }
  }

  const handleOpenInstanceTest = (nodeId: string, nodeName: string, userId: string, channel: string) => {
    setInstanceTestDialog({ nodeId, nodeName, userId, channel })
    setTestMessage('')
  }

  const handleSendTestMessage = async () => {
    if (!instanceTestDialog || !testMessage.trim()) return

    try {
      setSendingTest(true)
      const action = 'message'
      const params = {
        channel: instanceTestDialog.channel,
        target: instanceTestDialog.userId,
        message: testMessage.trim()
      }

      await sendNodeCommand(instanceTestDialog.nodeId, action, params)

      setMessage({ type: 'success', text: t('settings.notifications.testSuccess') })
      setInstanceTestDialog(null)
      setTimeout(() => setMessage(null), 5000)
    } catch (error: any) {
      console.error('Failed to send test message:', error)
      setMessage({ type: 'error', text: error.response?.data?.error || t('settings.notifications.testFailed') })
    } finally {
      setSendingTest(false)
    }
  }

  const toggleInstance = (nodeId: string) => {
    setFormData(prev => ({
      ...prev,
      instanceIds: prev.instanceIds.includes(nodeId)
        ? prev.instanceIds.filter(id => id !== nodeId)
        : [...prev.instanceIds, nodeId]
    }))
  }

  const toggleAllInstances = () => {
    const allSelected = formData.instanceIds.length === nodes.length
    setFormData(prev => ({
      ...prev,
      instanceIds: allSelected ? [] : nodes.map(n => n.id)
    }))
  }

  if (loading) {
    return (
      <div className="text-center text-muted-foreground py-12">
        {t('settings.loading')}
      </div>
    )
  }

  if (showForm) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>
            {editingId ? t('settings.notifications.edit') : t('settings.notifications.add')}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {message && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className={cn(
                "p-4 rounded-lg",
                message.type === 'success'
                  ? "bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 text-green-800 dark:text-green-200"
                  : "bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-800 dark:text-red-200"
              )}
            >
              <div className="flex items-center gap-2">
                {message.type === 'success' && <Check className="h-4 w-4" />}
                <span>{message.text}</span>
              </div>
            </motion.div>
          )}

          {/* Channel Selection */}
          <div>
            <label className="block text-sm font-medium mb-2">{t('settings.notifications.channel')}</label>
            <select
              value={formData.channel}
              onChange={(e) => setFormData(prev => ({ ...prev, channel: e.target.value as 'telegram' }))}
              className="w-full px-3 py-2 border rounded-md bg-background"
              disabled
            >
              <option value="telegram">Telegram</option>
            </select>
            <p className="text-sm text-muted-foreground mt-1">目前仅支持 Telegram</p>
          </div>

          {/* User ID */}
          <div>
            <label className="block text-sm font-medium mb-2">{t('settings.notifications.userId')}</label>
            <input
              type="text"
              value={formData.userId}
              onChange={(e) => setFormData(prev => ({ ...prev, userId: e.target.value }))}
              className="w-full px-3 py-2 border rounded-md bg-background"
              placeholder={t('settings.notifications.userIdHint')}
            />
            <p className="text-sm text-muted-foreground mt-1">{t('settings.notifications.userIdHint')}</p>
          </div>

          {/* Message Template */}
          <div>
            <label className="block text-sm font-medium mb-2">{t('settings.notifications.messageTemplate')}</label>
            <textarea
              value={formData.messageTemplate}
              onChange={(e) => setFormData(prev => ({ ...prev, messageTemplate: e.target.value }))}
              className="w-full px-3 py-2 border rounded-md bg-background min-h-[80px]"
              placeholder={t('settings.notifications.messageTemplateHint')}
            />
            <p className="text-sm text-muted-foreground mt-1">{t('settings.notifications.messageTemplateHint')}</p>
          </div>

          {/* Instance Selection */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-sm font-medium">{t('settings.notifications.instances')}</label>
              <Button
                variant="ghost"
                size="sm"
                onClick={toggleAllInstances}
                disabled={nodes.length === 0}
              >
                {formData.instanceIds.length === nodes.length ? '全不选' : '全选'}
              </Button>
            </div>
            <div className="border rounded-md p-3 max-h-48 overflow-y-auto space-y-2 bg-muted/30">
              {nodes.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">暂无可用实例</p>
              ) : (
                nodes.map(node => (
                  <div key={node.id} className="flex items-center gap-2">
                    <Checkbox
                      id={`instance-${node.id}`}
                      checked={formData.instanceIds.includes(node.id)}
                      onCheckedChange={() => toggleInstance(node.id)}
                    />
                    <label
                      htmlFor={`instance-${node.id}`}
                      className="text-sm cursor-pointer flex-1 flex items-center gap-2"
                    >
                      <span className="font-medium">{node.name}</span>
                      <Badge variant={node.connected ? 'blue' : 'destructive'} className="text-xs">
                        {node.connected ? '在线' : '离线'}
                      </Badge>
                    </label>
                  </div>
                ))
              )}
            </div>
            <p className="text-sm text-muted-foreground mt-1">
              已选择 {formData.instanceIds.length} 个实例
            </p>
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-2">
            <Button onClick={handleSave} disabled={saving}>
              {saving ? t('settings.saving') : t('settings.save')}
            </Button>
            <Button
              variant="outline"
              onClick={() => setShowForm(false)}
              disabled={saving}
            >
              {t('batchActions.cancel')}
            </Button>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-4">
      {message && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className={cn(
            "p-4 rounded-lg",
            message.type === 'success'
              ? "bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 text-green-800 dark:text-green-200"
              : "bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-800 dark:text-red-200"
          )}
        >
          <div className="flex items-center gap-2">
            {message.type === 'success' && <Check className="h-4 w-4" />}
            <span>{message.text}</span>
          </div>
        </motion.div>
      )}

      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">{t('settings.notifications.title')}</h2>
        <Button onClick={handleOpenCreate}>
          <Plus className="h-4 w-4 mr-2" />
          {t('settings.notifications.add')}
        </Button>
      </div>

      {notifications.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <BellOff className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-muted-foreground mb-2">{t('settings.notifications.empty')}</p>
            <p className="text-sm text-muted-foreground">点击上方按钮添加通知配置</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {notifications.map(notification => {
            const notificationNodes = notification.instanceIds.map(id =>
              nodes.find(n => n.id === id)
            ).filter(Boolean) as NodeInfo[]

            return (
              <Card key={notification.id}>
                <CardContent className="p-4">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <Bell className="h-4 w-4 text-primary" />
                        <span className="font-medium">Notification ID: {notification.id}</span>
                        <Badge variant="secondary">{notification.channel}</Badge>
                      </div>
                      <div className="space-y-1 text-sm text-muted-foreground">
                        <p>用户 ID: {notification.userId}</p>
                        <p>消息模板: {notification.messageTemplate}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleOpenEdit(notification)}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setShowDeleteDialog(notification.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>

                  <div className="border-t pt-3">
                    <p className="text-sm font-medium mb-2">{t('settings.notifications.instancesLabel')}</p>
                    {notificationNodes.length === 0 ? (
                      <p className="text-sm text-muted-foreground">{t('settings.notifications.noInstances')}</p>
                    ) : (
                      <div className="space-y-2">
                        {notificationNodes.map(node => (
                          <div
                            key={node.id}
                            className="flex items-center justify-between p-2 rounded-md bg-muted/30"
                          >
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-medium">{node.name}</span>
                              <Badge variant={node.connected ? 'blue' : 'destructive'} className="text-xs">
                                {node.connected ? '在线' : '离线'}
                              </Badge>
                            </div>
                            {node.connected && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleOpenInstanceTest(node.id, node.name, notification.userId, notification.channel)}
                                className="h-7 text-xs"
                              >
                                <Send className="h-3 w-3 mr-1" />
                                测试
                              </Button>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}

      <AnimatePresence>
        {showDeleteDialog && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
            onClick={() => setShowDeleteDialog(null)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-background rounded-lg p-6 max-w-md w-full mx-4"
              onClick={(e) => e.stopPropagation()}
            >
              <h3 className="text-lg font-semibold mb-2">{t('settings.notifications.deleteConfirm')}</h3>
              <p className="text-muted-foreground mb-6">此操作无法撤销。</p>
              <div className="flex gap-3 justify-end">
                <Button variant="outline" onClick={() => setShowDeleteDialog(null)}>
                  取消
                </Button>
                <Button
                  variant="destructive"
                  onClick={() => handleDelete(showDeleteDialog)}
                >
                  删除
                </Button>
              </div>
            </motion.div>
          </motion.div>
        )}

        {instanceTestDialog && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
            onClick={() => setInstanceTestDialog(null)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-background rounded-lg p-6 max-w-md w-full mx-4"
              onClick={(e) => e.stopPropagation()}
            >
              <h3 className="text-lg font-semibold mb-2">{t('settings.notifications.testDialog')}</h3>
              <p className="text-sm text-muted-foreground mb-4">
                {t('settings.notifications.testDialogHint', {
                  name: instanceTestDialog.nodeName,
                  userId: instanceTestDialog.userId
                })}
              </p>
              <div className="mb-4">
                <label className="block text-sm font-medium mb-2">{t('settings.notifications.testMessageLabel')}</label>
                <textarea
                  value={testMessage}
                  onChange={(e) => setTestMessage(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                      e.preventDefault()
                      if (testMessage.trim() && !sendingTest) {
                        handleSendTestMessage()
                      }
                    }
                  }}
                  className="w-full px-3 py-2 border rounded-md bg-background min-h-[80px]"
                  placeholder={t('settings.notifications.testMessagePlaceholder')}
                />
                <p className="text-xs text-muted-foreground mt-1">Ctrl+Enter 或 Cmd+Enter 快速发送</p>
              </div>
              <div className="flex gap-3 justify-end">
                <Button variant="outline" onClick={() => setInstanceTestDialog(null)} disabled={sendingTest}>
                  {t('batchActions.cancel')}
                </Button>
                <Button
                  onClick={handleSendTestMessage}
                  disabled={sendingTest || !testMessage.trim()}
                >
                  {sendingTest ? t('settings.notifications.sending') : t('settings.notifications.send')}
                </Button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
