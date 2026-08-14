import { useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import {
  ArrowLeft, BookOpen, LayoutDashboard, LogIn, LogOut, Menu, Moon, Shield,
  Sun, User, X,
} from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { useTheme } from '../contexts/ThemeContext'
import { useToast } from '../contexts/ToastContext'
import AccountPanel from './AccountPanel'
export default function TopNav({ maxWidth = 'max-w-5xl', showBack = false }) {
  const { user, profile, isAdmin, logout } = useAuth()
  const { theme, toggleTheme } = useTheme()
  const toast = useToast()
  const location = useLocation()
  const navigate = useNavigate()
  const [navOpen, setNavOpen] = useState(false)
  const [accountOpen, setAccountOpen] = useState(false)
  const isDark = theme === 'dark'
  const initials = (profile?.name || user?.email || '?')
    .split(' ')
    .map(part => part[0])
    .slice(0, 2)
    .join('')
    .toUpperCase()

  async function handleLogout() {
    await logout()
    setNavOpen(false)
    setAccountOpen(false)
    toast('You\'ve been signed out.', 'info')
    navigate('/')
  }

  const navItems = [
    { to: '/', label: 'Browse', icon: BookOpen },
    user && { to: '/dashboard', label: 'Library', icon: LayoutDashboard },
    isAdmin && { to: '/admin', label: 'Admin', icon: Shield },

  ].filter(Boolean)

  return (
    <>
      <header className={`sticky top-0 z-30 border-b backdrop-blur-xl transition-colors
        ${isDark ? 'bg-transparent border-neutral-800' : ' bg-transparent border-neutral-200 shadow-[0_12px_32px_-30px_rgba(15,23,42,0.45)]'}`}>
        <div className={`${maxWidth} mx-auto px-5 sm:px-6 h-16 flex items-center justify-between gap-4`}>
          <div className="flex items-center gap-2.5 shrink-0">
            {showBack && (
              <button
                type="button"
                onClick={() => navigate(-1)}
                aria-label="Go back"
                className={`inline-flex h-9 w-9 items-center justify-center rounded-full border transition
                  ${isDark ? 'border-neutral-800 text-neutral-300 hover:border-amber-400/30 hover:text-amber-300' : 'border-neutral-200 text-neutral-500 hover:border-amber-300 hover:bg-amber-50 hover:text-amber-700'}`}
              >
                <ArrowLeft className="h-4 w-4" />
              </button>
            )}
            <Link to="/" className={`font-bold text-[17px] tracking-tight ${isDark ? 'text-white' : 'text-neutral-950'}`}>
              CoursePress
            </Link>
          </div>

          <nav className="hidden sm:flex items-center gap-1 rounded-full border border-neutral-200 bg-white/70 p-1 shadow-sm dark:border-neutral-800 dark:bg-neutral-900/70">
            {navItems.map(({ to, label, icon: Icon }) => {
              const active = location.pathname === to
              return (
                <Link
                  key={to}
                  to={to}
                  className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium transition
                    ${active
                      ? 'bg-amber-500 text-black shadow-sm'
                      : isDark ? 'text-neutral-300 hover:bg-white/10 hover:text-white' : 'text-neutral-600 hover:bg-amber-50 hover:text-neutral-950'}`}
                >
                  <Icon className="h-4 w-4" />
                  {label}
                </Link>
              )
            })}
          </nav>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={toggleTheme}
              aria-label="Toggle theme"
              className={`inline-flex h-9 w-9 items-center justify-center rounded-full border transition
                ${isDark ? 'border-neutral-800 text-neutral-300 hover:border-amber-400/30 hover:text-amber-300' : 'border-neutral-200 text-neutral-600 hover:border-amber-300 hover:bg-amber-50 hover:text-amber-700'}`}
            >
              {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </button>

            {user ? (
              <button
                type="button"
                onClick={() => setAccountOpen(true)}
                className={`inline-flex items-center gap-2 rounded-full border py-1.5 pl-2.5 pr-1.5 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400/50
                  ${isDark ? 'border-neutral-800 bg-white/[0.03] hover:border-amber-400/30 hover:bg-white/[0.07]' : 'border-neutral-200 bg-white hover:border-amber-300 hover:bg-amber-50'}`}
              >
                <User className={`h-4 w-4 ${isDark ? 'text-amber-300' : 'text-amber-700'}`} />
                <span className={`hidden md:block max-w-[140px] truncate text-sm font-medium ${isDark ? 'text-neutral-200' : 'text-neutral-700'}`}>
                  {profile?.name || user.email}
                </span>
                <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-amber-500 text-xs font-bold text-black">
                  {initials}
                </span>
              </button>
            ) : (
              <Link
                to="/login"
                className="inline-flex items-center gap-1.5 rounded-full bg-amber-500 px-4 py-2 text-sm font-semibold text-black transition hover:bg-amber-400"
              >
                <LogIn className="h-4 w-4" />
                Sign in
              </Link>
            )}

            <button
              type="button"
              onClick={() => setNavOpen(true)}
              aria-label="Open navigation"
              className={`sm:hidden inline-flex h-9 w-9 items-center justify-center rounded-full border transition
                ${isDark ? 'border-neutral-800 text-neutral-300' : 'border-neutral-200 text-neutral-600'}`}
            >
              <Menu className="h-4 w-4" />
            </button>
          </div>
        </div>
      </header>

      {navOpen && (
        <div className="fixed inset-0 z-50">
          <button
            type="button"
            aria-label="Close navigation"
            onClick={() => setNavOpen(false)}
            className="absolute inset-0 h-full w-full bg-black/35 backdrop-blur-[2px]"
          />
          <aside className={`absolute right-0 top-0 flex h-full w-full max-w-[340px] flex-col border-l shadow-2xl
            ${isDark ? 'border-amber-400/10 bg-neutral-950 text-white' : 'border-amber-200 bg-white text-neutral-950'}`}>
            <div className={`flex items-center justify-between border-b px-5 py-4 ${isDark ? 'border-amber-400/10' : 'border-amber-100'}`}>
              <div>
                <p className="text-sm font-semibold">CoursePress</p>
                {/* {user && <p className={`mt-0.5 max-w-[240px] truncate text-xs ${isDark ? 'text-neutral-400' : 'text-neutral-500'}`}>{user.email}</p>} */}
              </div>
              <button
                type="button"
                onClick={() => setNavOpen(false)}
                className={`inline-flex h-9 w-9 items-center justify-center rounded-full transition ${isDark ? 'hover:bg-white/10' : 'hover:bg-amber-50'}`}
              >
                <X className="h-4.5 w-4.5" />
              </button>
            </div>

            {user && (
              <div className={`border-b px-5 py-5 ${isDark ? 'border-amber-400/10' : 'border-amber-100'}`}>
                <div className="flex items-center gap-3">
                  <span className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-amber-500 text-sm font-bold text-black">
                    {initials}
                  </span>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold">{profile?.name || 'Student account'}</p>
                    <p className={`truncate text-xs ${isDark ? 'text-neutral-400' : 'text-neutral-500'}`}>{user.email}</p>
                  </div>
                </div>
              </div>
            )}

            <nav className="flex-1 space-y-1 overflow-y-auto p-3">
              {navItems.map(({ to, label, icon: Icon }) => (
                <Link
                  key={to}
                  to={to}
                  onClick={() => setNavOpen(false)}
                  className={`flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-semibold transition
                    ${isDark ? 'text-white hover:bg-white/10' : 'text-neutral-900 hover:bg-amber-50'}`}
                >
                  <Icon className="h-4 w-4" />
                  {label}
                </Link>
              ))}
              
            </nav>

            {user && (
              <div className={`border-t p-3 ${isDark ? 'border-amber-400/10' : 'border-amber-100'}`}>
                 <button
                type="button"
                onClick={handleLogout}
                className={`flex w-full items-center gap-3 rounded-xl px-3 py-3 text-sm font-semibold transition
                  ${isDark ? 'text-neutral-200 hover:bg-white/10' : 'text-neutral-700 hover:bg-amber-50'}`}
              >
                <LogOut className="h-4 w-4" />
                Sign out
              </button>
              </div>
            )}
          </aside>
        </div>
      )}

      {accountOpen && user && (
        <AccountPanel
          open={accountOpen}
          onClose={() => setAccountOpen(false)}
          user={user}
          profile={profile}
          onLogout={handleLogout}
          navigate={navigate}
          toast={toast}
          theme={theme}
          toggleTheme={toggleTheme}
        />
      )}
    </>
  )
}
