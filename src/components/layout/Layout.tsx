import React, { useState } from 'react';
import { 
  Menu, X, Sun, Moon, Globe, LogOut, User as UserIcon, 
  Folder, Camera, FileText, RefreshCw, Grid, QrCode, Settings, ShieldAlert 
} from 'lucide-react';
import { useTheme } from '../../context/ThemeContext';
import { useLanguage } from '../../context/LanguageContext';
import type { Language } from '../../context/LanguageContext';
import { useAuth } from '../../context/AuthContext';
import { useSubscription } from '../../context/SubscriptionContext';

interface LayoutProps {
  currentTab: string;
  setCurrentTab: (tab: string) => void;
  children: React.ReactNode;
}

export const Layout: React.FC<LayoutProps> = ({ currentTab, setCurrentTab, children }) => {
  const { theme, toggleTheme } = useTheme();
  const { language, setLanguage, t } = useLanguage();
  const { user, signOut } = useAuth();
  const { tier } = useSubscription();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isLangDropdownOpen, setIsLangDropdownOpen] = useState(false);

  const navigationItems = [
    { id: 'dashboard', label: t.dashboard, icon: Folder },
    { id: 'scanner', label: t.scanner, icon: Camera },
    { id: 'translation-center', label: 'AI Translation', icon: Globe },
    { id: 'pdf-tools', label: t.pdfTools, icon: FileText },
    { id: 'converters', label: t.converters, icon: RefreshCw },
    { id: 'spreadsheets', label: t.spreadsheets, icon: Grid },
    { id: 'qr-barcode', label: t.qrBarcode, icon: QrCode },
    { id: 'settings', label: t.settings, icon: Settings },
  ];

  // If user is admin, show Admin Dashboard
  const isAdmin = user?.email?.endsWith('@documax.app') || user?.email === 'admin@example.com';
  if (isAdmin) {
    navigationItems.push({ id: 'admin', label: t.admin, icon: ShieldAlert });
  }

  const handleLangChange = (lang: Language) => {
    setLanguage(lang);
    setIsLangDropdownOpen(false);
  };

  return (
    <div className="min-h-screen flex flex-col md:flex-row bg-background text-on-background">
      
      {/* Mobile Header */}
      <header className="md:hidden flex items-center justify-between px-4 py-3 bg-surface border-b border-outline/15 z-30 sticky top-0">
        <div className="flex items-center gap-2">
          <Menu 
            className="cursor-pointer text-on-surface" 
            onClick={() => setIsSidebarOpen(true)} 
            size={24} 
          />
          <span className="font-bold text-lg text-primary tracking-tight">{t.appName}</span>
        </div>
        <div className="flex items-center gap-2">
          {theme === 'dark' ? (
            <Sun className="cursor-pointer text-primary" onClick={toggleTheme} size={20} />
          ) : (
            <Moon className="cursor-pointer text-primary" onClick={toggleTheme} size={20} />
          )}
          {user && (
            <span className="text-xs font-semibold bg-primary/10 text-primary px-2.5 py-1 rounded-full capitalize">
              {tier}
            </span>
          )}
        </div>
      </header>

      {/* Mobile Drawer Backdrop */}
      {isSidebarOpen && (
        <div 
          className="md:hidden fixed inset-0 bg-black/50 z-40 transition-opacity" 
          onClick={() => setIsSidebarOpen(false)} 
        />
      )}

      {/* Sidebar (Responsive Sidebar) */}
      <aside className={`
        fixed md:static inset-y-0 left-0 w-64 bg-surface border-r border-outline/10 p-5 flex flex-col justify-between z-50 transition-transform duration-300 md:translate-x-0
        ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}
      `}>
        <div className="space-y-6">
          {/* Logo */}
          <div className="flex items-center justify-between">
            <span className="text-2xl font-bold text-primary tracking-tight">{t.appName}</span>
            <X 
              className="md:hidden cursor-pointer text-on-surface" 
              onClick={() => setIsSidebarOpen(false)} 
              size={20} 
            />
          </div>

          {/* Nav Links */}
          <nav className="space-y-1">
            {navigationItems.map((item) => {
              const Icon = item.icon;
              const isActive = currentTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => {
                    setCurrentTab(item.id);
                    setIsSidebarOpen(false);
                  }}
                  className={`
                    flex items-center gap-3 w-full px-4 py-3 rounded-2xl text-sm font-semibold transition cursor-pointer
                    ${isActive 
                      ? 'bg-primary-container text-on-primary-container shadow-sm' 
                      : 'text-on-surface-variant hover:bg-surface-variant/40 hover:text-on-surface'}
                  `}
                >
                  <Icon size={18} />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </nav>
        </div>

        {/* Footer Area */}
        <div className="pt-4 border-t border-outline/10 space-y-4">
          
          {/* User Section */}
          {user ? (
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5 overflow-hidden">
                <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center text-primary flex-shrink-0">
                  {user.avatarUrl ? (
                    <img src={user.avatarUrl} alt="Avatar" className="w-full h-full rounded-full" />
                  ) : (
                    <UserIcon size={16} />
                  )}
                </div>
                <div className="overflow-hidden">
                  <p className="text-xs font-bold truncate text-on-surface">
                    {user.fullName || user.email?.split('@')[0] || t.guestMode}
                  </p>
                  <p className="text-[10px] text-outline capitalize">{tier} Plan</p>
                </div>
              </div>
              <button 
                onClick={signOut} 
                className="p-2 text-outline hover:text-error transition cursor-pointer"
                title={t.signOut}
              >
                <LogOut size={16} />
              </button>
            </div>
          ) : (
            <button
              onClick={() => setCurrentTab('auth')}
              className="flex items-center justify-center gap-2 w-full py-2.5 border border-outline/30 hover:bg-surface-variant/30 text-on-surface rounded-xl text-xs font-semibold transition cursor-pointer"
            >
              <UserIcon size={14} />
              {t.signIn}
            </button>
          )}

          {/* Controls: Theme & Language */}
          <div className="flex items-center justify-between pt-2">
            
            {/* Theme Toggle */}
            <button 
              onClick={toggleTheme}
              className="p-2 rounded-xl border border-outline/20 hover:bg-surface-variant/30 text-primary transition cursor-pointer"
            >
              {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
            </button>

            {/* Language Selector */}
            <div className="relative">
              <button 
                onClick={() => setIsLangDropdownOpen(!isLangDropdownOpen)}
                className="flex items-center gap-1 px-3 py-2 rounded-xl border border-outline/20 hover:bg-surface-variant/30 text-xs font-semibold text-on-surface transition cursor-pointer"
              >
                <Globe size={14} />
                <span className="uppercase">{language}</span>
              </button>

              {isLangDropdownOpen && (
                <div className="absolute bottom-10 right-0 bg-surface border border-outline/20 rounded-xl py-1.5 shadow-lg w-28 z-50">
                  {(['en', 'es', 'fr', 'de', 'vi'] as Language[]).map((lang) => (
                    <button
                      key={lang}
                      onClick={() => handleLangChange(lang)}
                      className={`w-full px-4 py-1.5 text-left text-xs transition cursor-pointer ${
                        language === lang 
                          ? 'bg-primary-container text-on-primary-container font-bold' 
                          : 'text-on-surface hover:bg-surface-variant/30'
                      }`}
                    >
                      {lang === 'en' && 'English'}
                      {lang === 'es' && 'Español'}
                      {lang === 'fr' && 'Français'}
                      {lang === 'de' && 'Deutsch'}
                      {lang === 'vi' && 'Tiếng Việt'}
                    </button>
                  ))}
                </div>
              )}
            </div>

          </div>

        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 p-6 md:p-8 max-w-7xl mx-auto w-full overflow-y-auto">
        {children}
      </main>

    </div>
  );
};
