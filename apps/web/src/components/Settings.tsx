import { useState, useEffect } from "react"
import { useTranslation } from "react-i18next"
import { useNavigate } from "react-router-dom"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card"
import { Button } from "@/components/ui/Button"
import { LanguageSwitcher } from "@/components/LanguageSwitcher"
import { ArrowLeft, Settings as SettingsIcon, Save, Check, Eye, EyeOff } from "lucide-react"
import { fetchSettings, updateAuthSettings } from "@/lib/api"
import { tokenManager } from "@/lib/auth"
import { cn } from "@/lib/utils"
import { motion } from "framer-motion"

export default function Settings() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null)
  const [settings, setSettings] = useState({
    auth: {
      enabled: false,
      username: '',
      password: '',
      confirmPassword: '',
      agentToken: ''
    }
  })
  const [currentSettings, setCurrentSettings] = useState<{
    auth: {
      enabled: boolean;
      username?: string;
      agentTokenSet: boolean;
    };
  }>({
    auth: {
      enabled: false,
      username: '',
      agentTokenSet: false
    }
  })
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [showAgentToken, setShowAgentToken] = useState(false)

  useEffect(() => {
    loadSettings()
  }, [])

  const loadSettings = async () => {
    try {
      setLoading(true)
      const data = await fetchSettings()
      setCurrentSettings(data)
      setSettings({
        auth: {
          enabled: data.auth.enabled,
          username: data.auth.username || '',
          password: '',
          confirmPassword: '',
          agentToken: ''
        }
      })
    } catch (error) {
      console.error('Failed to load settings:', error)
      setMessage({ type: 'error', text: t('settings.loadError') })
    } finally {
      setLoading(false)
    }
  }

  const handleSave = async () => {
    if (settings.auth.enabled) {
      if (!settings.auth.username || settings.auth.username.trim() === '') {
        setMessage({ type: 'error', text: t('settings.usernameRequired') })
        return
      }
      if (!settings.auth.password || settings.auth.password.trim() === '') {
        setMessage({ type: 'error', text: t('settings.passwordRequired') })
        return
      }
      if (settings.auth.password !== settings.auth.confirmPassword) {
        setMessage({ type: 'error', text: t('settings.passwordMismatch') })
        return
      }
    }

    try {
      setSaving(true)
      setMessage(null)
      const result = await updateAuthSettings({
        enabled: settings.auth.enabled,
        username: settings.auth.enabled ? settings.auth.username : undefined,
        password: settings.auth.enabled ? settings.auth.password : undefined,
        agentToken: settings.auth.agentToken || undefined
      })

      if (result.token) {
        tokenManager.setToken(result.token)
      }

      setMessage({ type: 'success', text: t('settings.saveSuccess') })

      setCurrentSettings({
        auth: {
          enabled: settings.auth.enabled,
          username: settings.auth.username,
          agentTokenSet: !!(settings.auth.agentToken && settings.auth.agentToken.trim() !== '')
        }
      })

      setSettings(prev => ({
        auth: {
          ...prev.auth,
          password: '',
          confirmPassword: ''
        }
      }))

      setTimeout(() => {
        setMessage(null)
      }, 3000)
    } catch (error: any) {
      console.error('Failed to save settings:', error)
      setMessage({ type: 'error', text: error.response?.data?.error || t('settings.saveError') })
    } finally {
      setSaving(false)
    }
  }

  const handleBack = () => {
    navigate('/')
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <header className="border-b bg-card shadow-sm">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Button variant="ghost" size="sm" onClick={handleBack}>
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  {t('settings.back')}
                </Button>
                <SettingsIcon className="h-5 w-5" />
                <h1 className="text-xl font-semibold">{t('settings.title')}</h1>
              </div>
              <LanguageSwitcher />
            </div>
          </div>
        </header>
        <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="text-center text-muted-foreground">{t('settings.loading')}</div>
        </main>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Button variant="ghost" size="sm" onClick={handleBack}>
                <ArrowLeft className="h-4 w-4 mr-2" />
                {t('settings.back')}
              </Button>
              <SettingsIcon className="h-5 w-5" />
              <h1 className="text-xl font-semibold">{t('settings.title')}</h1>
            </div>
            <div className="flex items-center gap-3">
              <LanguageSwitcher />
              <Button onClick={handleSave} disabled={saving}>
                <Save className="h-4 w-4 mr-2" />
                {saving ? t('settings.saving') : t('settings.save')}
              </Button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
        >
          {message && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className={cn(
                "mb-6 p-4 rounded-lg",
                message.type === 'success' ? "bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800" : "bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800"
              )}
            >
              <div className={cn(
                "flex items-center gap-2",
                message.type === 'success' ? "text-green-800 dark:text-green-200" : "text-red-800 dark:text-red-200"
              )}>
                {message.type === 'success' && <Check className="h-4 w-4" />}
                <span>{message.text}</span>
              </div>
            </motion.div>
          )}

          <Card>
            <CardHeader>
              <CardTitle>{t('settings.authSection')}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-medium">{t('settings.webAuthEnabled')}</h3>
                  <p className="text-sm text-muted-foreground mt-1">{t('settings.webAuthDescription')}</p>
                </div>
                <button
                  onClick={() => setSettings(prev => ({ ...prev, auth: { ...prev.auth, enabled: !prev.auth.enabled } }))}
                  className={cn(
                    "relative inline-flex h-6 w-11 items-center rounded-full transition-colors",
                    settings.auth.enabled ? "bg-primary" : "bg-muted"
                  )}
                >
                  <span
                    className={cn(
                      "inline-block h-4 w-4 transform rounded-full bg-white transition-transform",
                      settings.auth.enabled ? "translate-x-6" : "translate-x-1"
                    )}
                  />
                </button>
              </div>

              {settings.auth.enabled && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="space-y-4 pt-4 border-t"
                >
                  <div>
                    <label className="block text-sm font-medium mb-2">{t('settings.username')}</label>
                    <input
                      type="text"
                      value={settings.auth.username}
                      onChange={(e) => setSettings(prev => ({ ...prev, auth: { ...prev.auth, username: e.target.value } }))}
                      className="w-full px-3 py-2 border rounded-md bg-background"
                      placeholder={t('settings.usernamePlaceholder')}
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-2">{t('settings.password')}</label>
                    <div className="relative">
                      <input
                        type={showPassword ? 'text' : 'password'}
                        value={settings.auth.password}
                        onChange={(e) => setSettings(prev => ({ ...prev, auth: { ...prev.auth, password: e.target.value } }))}
                        className="w-full px-3 py-2 border rounded-md bg-background pr-10"
                        placeholder={t('settings.passwordPlaceholder')}
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                      >
                        {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-2">{t('settings.confirmPassword')}</label>
                    <div className="relative">
                      <input
                        type={showConfirmPassword ? 'text' : 'password'}
                        value={settings.auth.confirmPassword}
                        onChange={(e) => setSettings(prev => ({ ...prev, auth: { ...prev.auth, confirmPassword: e.target.value } }))}
                        className="w-full px-3 py-2 border rounded-md bg-background pr-10"
                        placeholder={t('settings.confirmPasswordPlaceholder')}
                      />
                      <button
                        type="button"
                        onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                        className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                      >
                        {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                  </div>
                </motion.div>
              )}
            </CardContent>
          </Card>

          <Card className="mt-6">
            <CardHeader>
              <CardTitle>{t('settings.agentAuthSection')}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2">{t('settings.agentToken')}</label>
                <div className="relative">
                  <input
                    type={showAgentToken ? 'text' : 'password'}
                    value={settings.auth.agentToken}
                    onChange={(e) => setSettings(prev => ({ ...prev, auth: { ...prev.auth, agentToken: e.target.value } }))}
                    className="w-full px-3 py-2 border rounded-md bg-background pr-10"
                    placeholder={currentSettings.auth.agentTokenSet ? t('settings.tokenAlreadySet') : t('settings.agentTokenPlaceholder')}
                  />
                  <button
                    type="button"
                    onClick={() => setShowAgentToken(!showAgentToken)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    {showAgentToken ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                <p className="text-sm text-muted-foreground mt-2">{t('settings.agentTokenDescription')}</p>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </main>
    </div>
  )
}
