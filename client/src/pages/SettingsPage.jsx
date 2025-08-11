import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Settings, User, Shield, ArrowLeft, Bell, Eye, Monitor, Smartphone, Database, Info, HelpCircle, Moon, Sun } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import api from '../services/api'
import { toast } from 'react-hot-toast'

const SettingsPage = () => {
  const navigate = useNavigate()
  const { logout, user } = useAuth()

  // Local UI state (placeholders for now; wire to backend later)
  const [notifications, setNotifications] = useState(() => ({
    desktop: true,
    sound: true,
    messagePreview: true,
  }))
  const [privacy, setPrivacy] = useState(() => ({
    lastSeen: 'everyone', // everyone | contacts | nobody
    readReceipts: true,
  }))
  const [theme, setTheme] = useState(() => 'system') // light | dark | system

  // Change password form state
  const [pwdForm, setPwdForm] = useState({ currentPassword: '', newPassword: '', confirmNewPassword: '' })
  const pwdValid = useMemo(() => pwdForm.newPassword.length >= 6 && pwdForm.newPassword === pwdForm.confirmNewPassword && pwdForm.currentPassword.length > 0, [pwdForm])

  // Load saved settings
  useEffect(() => {
    try {
      const raw = localStorage.getItem('mgz_settings')
      if (raw) {
        const saved = JSON.parse(raw)
        if (saved.notifications) setNotifications((n) => ({ ...n, ...saved.notifications }))
        if (saved.privacy) setPrivacy((p) => ({ ...p, ...saved.privacy }))
        if (saved.theme) setTheme(saved.theme)
      }
    } catch {}
  }, [])

  // Persist settings
  useEffect(() => {
    const toSave = { notifications, privacy, theme }
    localStorage.setItem('mgz_settings', JSON.stringify(toSave))
  }, [notifications, privacy, theme])

  // Apply theme
  useEffect(() => {
    const root = document.documentElement
    if (theme === 'dark') {
      root.classList.add('dark')
    } else if (theme === 'light') {
      root.classList.remove('dark')
    } else {
      // system
      const mq = window.matchMedia('(prefers-color-scheme: dark)')
      if (mq.matches) root.classList.add('dark')
      else root.classList.remove('dark')
      const handler = (e) => {
        if (theme !== 'system') return
        if (e.matches) root.classList.add('dark')
        else root.classList.remove('dark')
      }
      mq.addEventListener?.('change', handler)
      return () => mq.removeEventListener?.('change', handler)
    }
  }, [theme])

  const requestDesktopPermission = async (checked) => {
    if (!checked) return
    try {
      if ('Notification' in window) {
        const perm = await Notification.requestPermission()
        if (perm !== 'granted') {
          toast.error('Desktop notifications blocked')
          setNotifications((n) => ({ ...n, desktop: false }))
        }
      }
    } catch {}
  }

  const onClearCache = async () => {
    try {
      if ('caches' in window) {
        const keys = await caches.keys()
        await Promise.all(keys.map((k) => caches.delete(k)))
      }
      toast.success('Cache cleared')
    } catch (e) {
      toast.error('Failed to clear cache')
    }
  }

  const submitPasswordChange = async (e) => {
    e.preventDefault()
    if (!pwdValid) return
    try {
      await api.put('/auth/change-password', {
        currentPassword: pwdForm.currentPassword,
        newPassword: pwdForm.newPassword,
      })
      toast.success('Password changed')
      setPwdForm({ currentPassword: '', newPassword: '', confirmNewPassword: '' })
    } catch (err) {
      const msg = err.response?.data?.message || 'Failed to change password'
      toast.error(msg)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center">
            <button
              onClick={() => navigate('/dashboard')}
              className="p-2 mr-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
              aria-label="Back to dashboard"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <Settings className="w-6 h-6 text-primary-600 mr-2" />
            <h1 className="text-xl font-semibold text-gray-900">Settings</h1>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-6xl mx-auto px-4 py-6 grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Profile settings */}
        <div className="bg-white border border-gray-200 rounded-xl p-5">
          <div className="flex items-center mb-3">
            <div className="w-10 h-10 rounded-lg bg-primary-50 flex items-center justify-center mr-3">
              <User className="w-5 h-5 text-primary-600" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-gray-900">Profile</h2>
              <p className="text-sm text-gray-500">Update your name, avatar, and bio</p>
            </div>
          </div>
          <button
            onClick={() => navigate('/settings/profile')}
            className="btn-primary"
          >
            Manage Profile
          </button>
        </div>

        {/* Account */}
        <div className="bg-white border border-gray-200 rounded-xl p-5">
          <div className="flex items-center mb-3">
            <div className="w-10 h-10 rounded-lg bg-primary-50 flex items-center justify-center mr-3">
              <Info className="w-5 h-5 text-primary-600" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-gray-900">Account</h2>
              <p className="text-sm text-gray-500">Your basic account information</p>
            </div>
          </div>
          <div className="space-y-3 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-gray-600">Name</span>
              <span className="text-gray-900 font-medium">{user?.name || '—'}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-gray-600">Email</span>
              <span className="text-gray-900 font-medium">{user?.email || '—'}</span>
            </div>
          </div>
        </div>

        {/* Security */}
        <div className="bg-white border border-gray-200 rounded-xl p-5">
          <div className="flex items-center mb-3">
            <div className="w-10 h-10 rounded-lg bg-primary-50 flex items-center justify-center mr-3">
              <Shield className="w-5 h-5 text-primary-600" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-gray-900">Security</h2>
              <p className="text-sm text-gray-500">Change password and manage sessions</p>
            </div>
          </div>
          <form onSubmit={submitPasswordChange} className="space-y-3">
            <div>
              <label className="block text-sm text-gray-700">Current password</label>
              <input
                type="password"
                className="mt-1 block w-full rounded-lg border-gray-300 text-sm focus:border-primary-500 focus:ring-primary-500"
                value={pwdForm.currentPassword}
                onChange={(e) => setPwdForm({ ...pwdForm, currentPassword: e.target.value })}
                required
              />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="block text-sm text-gray-700">New password</label>
                <input
                  type="password"
                  className="mt-1 block w-full rounded-lg border-gray-300 text-sm focus:border-primary-500 focus:ring-primary-500"
                  minLength={6}
                  value={pwdForm.newPassword}
                  onChange={(e) => setPwdForm({ ...pwdForm, newPassword: e.target.value })}
                  required
                />
              </div>
              <div>
                <label className="block text-sm text-gray-700">Confirm new password</label>
                <input
                  type="password"
                  className="mt-1 block w-full rounded-lg border-gray-300 text-sm focus:border-primary-500 focus:ring-primary-500"
                  minLength={6}
                  value={pwdForm.confirmNewPassword}
                  onChange={(e) => setPwdForm({ ...pwdForm, confirmNewPassword: e.target.value })}
                  required
                />
              </div>
            </div>
            <div className="flex items-center justify-between">
              <div className={`text-xs ${pwdValid ? 'text-green-600' : 'text-gray-500'}`}>Password must be at least 6 characters and match</div>
              <button
                type="submit"
                disabled={!pwdValid}
                className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${pwdValid ? 'text-white bg-primary-600 hover:bg-primary-700' : 'text-gray-400 bg-gray-100 cursor-not-allowed'}`}
              >
                Update Password
              </button>
            </div>
            <div className="text-xs text-gray-500">Two-factor authentication and session management coming soon.</div>
          </form>
        </div>

        {/* Notifications */}
        <div className="bg-white border border-gray-200 rounded-xl p-5">
          <div className="flex items-center mb-3">
            <div className="w-10 h-10 rounded-lg bg-primary-50 flex items-center justify-center mr-3">
              <Bell className="w-5 h-5 text-primary-600" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-gray-900">Notifications</h2>
              <p className="text-sm text-gray-500">Choose when you’re notified</p>
            </div>
          </div>
          <div className="space-y-4">
            <label className="flex items-center justify-between cursor-pointer">
              <span className="text-sm text-gray-700">Desktop notifications</span>
              <input
                type="checkbox"
                className="toggle"
                checked={notifications.desktop}
                onChange={async (e) => { setNotifications(n => ({ ...n, desktop: e.target.checked })); await requestDesktopPermission(e.target.checked) }}
              />
            </label>
            <label className="flex items-center justify-between cursor-pointer">
              <span className="text-sm text-gray-700">Sound</span>
              <input
                type="checkbox"
                className="toggle"
                checked={notifications.sound}
                onChange={(e) => setNotifications(n => ({ ...n, sound: e.target.checked }))}
              />
            </label>
            <label className="flex items-center justify-between cursor-pointer">
              <span className="text-sm text-gray-700">Show message preview</span>
              <input
                type="checkbox"
                className="toggle"
                checked={notifications.messagePreview}
                onChange={(e) => setNotifications(n => ({ ...n, messagePreview: e.target.checked }))}
              />
            </label>
          </div>
        </div>

        {/* Privacy */}
        <div className="bg-white border border-gray-200 rounded-xl p-5">
          <div className="flex items-center mb-3">
            <div className="w-10 h-10 rounded-lg bg-primary-50 flex items-center justify-center mr-3">
              <Eye className="w-5 h-5 text-primary-600" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-gray-900">Privacy</h2>
              <p className="text-sm text-gray-500">Control what others can see</p>
            </div>
          </div>
          <div className="space-y-4">
            <div>
              <label className="text-sm text-gray-700">Last seen</label>
              <select
                value={privacy.lastSeen}
                onChange={(e) => setPrivacy(p => ({ ...p, lastSeen: e.target.value }))}
                className="mt-1 block w-full rounded-lg border-gray-300 text-sm focus:border-primary-500 focus:ring-primary-500"
              >
                <option value="everyone">Everyone</option>
                <option value="contacts">My contacts</option>
                <option value="nobody">Nobody</option>
              </select>
            </div>
            <label className="flex items-center justify-between cursor-pointer">
              <span className="text-sm text-gray-700">Read receipts</span>
              <input
                type="checkbox"
                className="toggle"
                checked={privacy.readReceipts}
                onChange={(e) => setPrivacy(p => ({ ...p, readReceipts: e.target.checked }))}
              />
            </label>
          </div>
        </div>

        {/* Appearance */}
        <div className="bg-white border border-gray-200 rounded-xl p-5">
          <div className="flex items-center mb-3">
            <div className="w-10 h-10 rounded-lg bg-primary-50 flex items-center justify-center mr-3">
              <Monitor className="w-5 h-5 text-primary-600" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-gray-900">Appearance</h2>
              <p className="text-sm text-gray-500">Theme and display</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setTheme('light')}
              className={`px-3 py-2 rounded-lg text-sm border ${theme === 'light' ? 'border-primary-500 text-primary-700 bg-primary-50' : 'border-gray-200 text-gray-700 hover:bg-gray-50'}`}
            >
              <Sun className="w-4 h-4 inline mr-1" /> Light
            </button>
            <button
              onClick={() => setTheme('dark')}
              className={`px-3 py-2 rounded-lg text-sm border ${theme === 'dark' ? 'border-primary-500 text-primary-700 bg-primary-50' : 'border-gray-200 text-gray-700 hover:bg-gray-50'}`}
            >
              <Moon className="w-4 h-4 inline mr-1" /> Dark
            </button>
            <button
              onClick={() => setTheme('system')}
              className={`px-3 py-2 rounded-lg text-sm border ${theme === 'system' ? 'border-primary-500 text-primary-700 bg-primary-50' : 'border-gray-200 text-gray-700 hover:bg-gray-50'}`}
            >
              System
            </button>
          </div>
        </div>

        {/* Devices & Sessions */}
        <div className="bg-white border border-gray-200 rounded-xl p-5">
          <div className="flex items-center mb-3">
            <div className="w-10 h-10 rounded-lg bg-primary-50 flex items-center justify-center mr-3">
              <Smartphone className="w-5 h-5 text-primary-600" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-gray-900">Devices & Sessions</h2>
              <p className="text-sm text-gray-500">Manage active sessions</p>
            </div>
          </div>
          <div className="text-sm text-gray-600">This feature will list your active sessions. For now, use “Log out” below to end this session.</div>
        </div>

        {/* Storage & Data */}
        <div className="bg-white border border-gray-200 rounded-xl p-5">
          <div className="flex items-center mb-3">
            <div className="w-10 h-10 rounded-lg bg-primary-50 flex items-center justify-center mr-3">
              <Database className="w-5 h-5 text-primary-600" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-gray-900">Storage & Data</h2>
              <p className="text-sm text-gray-500">Manage cache and downloads</p>
            </div>
          </div>
          <div className="space-y-3 text-sm">
            <button onClick={onClearCache} className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors">Clear media cache</button>
            <div className="text-xs text-gray-500">Auto-download controls coming soon.</div>
          </div>
        </div>

        {/* About */}
        <div className="bg-white border border-gray-200 rounded-xl p-5">
          <div className="flex items-center mb-3">
            <div className="w-10 h-10 rounded-lg bg-primary-50 flex items-center justify-center mr-3">
              <Info className="w-5 h-5 text-primary-600" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-gray-900">About</h2>
              <p className="text-sm text-gray-500">App information</p>
            </div>
          </div>
          <div className="text-sm text-gray-700 space-y-1">
            <div>MGZ Secure</div>
            <div className="text-gray-500">Version 1.0.0</div>
          </div>
        </div>

        {/* Help Center */}
        <div className="bg-white border border-gray-200 rounded-xl p-5 lg:col-span-2">
          <div className="flex items-center mb-3">
            <div className="w-10 h-10 rounded-lg bg-primary-50 flex items-center justify-center mr-3">
              <HelpCircle className="w-5 h-5 text-primary-600" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-gray-900">Help Center</h2>
              <p className="text-sm text-gray-500">Find answers and get support</p>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="border border-gray-200 rounded-lg p-4">
              <h3 className="text-sm font-semibold text-gray-900 mb-2">FAQs</h3>
              <ul className="list-disc pl-4 text-sm text-gray-700 space-y-1">
                <li>How to start a chat</li>
                <li>Voice and video call tips</li>
                <li>Managing media and storage</li>
              </ul>
            </div>
            <div className="border border-gray-200 rounded-lg p-4">
              <h3 className="text-sm font-semibold text-gray-900 mb-2">Troubleshooting</h3>
              <ul className="list-disc pl-4 text-sm text-gray-700 space-y-1">
                <li>Can’t connect to calls</li>
                <li>Notifications not working</li>
                <li>Login issues</li>
              </ul>
            </div>
            <div className="border border-gray-200 rounded-lg p-4">
              <h3 className="text-sm font-semibold text-gray-900 mb-2">Contact us</h3>
              <div className="space-y-2">
                <a href="mailto:support@example.com?subject=MGZ%20Secure%20Support" className="text-primary-700 hover:underline text-sm">Email support</a>
                <button onClick={() => navigate('/chat')} className="block text-left text-primary-700 hover:underline text-sm">Report a problem</button>
              </div>
            </div>
          </div>
        </div>

        {/* Logout at bottom */}
        <div className="lg:col-span-2">
          <div className="bg-white border border-red-200 rounded-xl p-5">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-semibold text-gray-900">Log out</h3>
                <p className="text-sm text-gray-500">End your current session</p>
              </div>
              <button
                onClick={logout}
                className="px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-lg transition-colors"
              >
                Logout
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default SettingsPage
