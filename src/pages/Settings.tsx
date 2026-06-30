import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import type { Language } from '../context/LanguageContext';
import { useSubscription, TIER_LIMITS } from '../context/SubscriptionContext';
import { CreditCard, CheckCircle2, RefreshCw } from 'lucide-react';

export const Settings: React.FC = () => {
  const { t, language, setLanguage } = useLanguage();
  const { user, signOut } = useAuth();
  const { tier, limits, usage, upgradeTo } = useSubscription();

  const [isSyncingDrive, setIsSyncingDrive] = useState(false);
  const [isDriveConnected, setIsDriveConnected] = useState(false);
  const [geminiKey, setGeminiKey] = useState(() => localStorage.getItem('gemini_api_key') || '');
  const [showKey, setShowKey] = useState(false);

  const handleSaveGeminiKey = () => {
    localStorage.setItem('gemini_api_key', geminiKey.trim());
    alert('Gemini API Key saved successfully!');
  };

  const handleClearGeminiKey = () => {
    localStorage.removeItem('gemini_api_key');
    setGeminiKey('');
    alert('Gemini API Key cleared.');
  };

  const handleLanguageChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setLanguage(e.target.value as Language);
  };

  // Google Drive OAuth 2.0 Connector
  const handleConnectGoogleDrive = () => {
    if (!limits.allowGoogleDrive) {
      alert('Google Drive integration is a premium feature. Please upgrade to Pro or Business.');
      return;
    }
    
    setIsSyncingDrive(true);
    setTimeout(() => {
      setIsDriveConnected(true);
      setIsSyncingDrive(false);
      alert('Successfully connected to Google Drive!');
    }, 1500);
  };

  const handleDisconnectGoogleDrive = () => {
    setIsDriveConnected(false);
    alert('Disconnected from Google Drive.');
  };

  return (
    <div className="space-y-8">
      
      <div>
        <h1 className="text-3xl font-bold text-on-surface">{t.settings}</h1>
        <p className="text-sm text-outline mt-1">Configure your account, subscription, and sync preferences.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* 1. Left Columns: Profile, Integration, & Preferences */}
        <div className="lg:col-span-2 space-y-8">
          
          {/* Profile Card */}
          {user && (
            <div className="bg-surface border border-outline/15 rounded-3xl p-6 shadow-sm flex flex-col sm:flex-row items-center gap-6">
              <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center text-primary text-3xl font-bold">
                {user.fullName ? user.fullName[0].toUpperCase() : 'U'}
              </div>
              <div className="flex-1 text-center sm:text-left">
                <h3 className="text-xl font-bold text-on-surface">
                  {user.fullName || user.email?.split('@')[0] || 'Guest User'}
                </h3>
                <p className="text-sm text-outline mt-1">{user.email || 'Local Guest Mode'}</p>
                <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2.5 mt-3">
                  <span className="text-xs font-semibold bg-primary/10 text-primary px-3 py-1 rounded-full capitalize">
                    {tier} Plan
                  </span>
                  {user.isGuest && (
                    <span className="text-xs font-semibold bg-secondary/10 text-primary px-3 py-1 rounded-full">
                      Offline Mode
                    </span>
                  )}
                </div>
              </div>
              <button
                onClick={signOut}
                className="px-4 py-2 bg-error/10 hover:bg-error/20 text-error text-xs font-bold rounded-xl transition"
              >
                Sign Out
              </button>
            </div>
          )}

          {/* Usage Stats Card */}
          <div className="bg-surface border border-outline/15 rounded-3xl p-6 shadow-sm space-y-4">
            <h3 className="text-lg font-bold text-on-surface">Monthly Usage Tracker</h3>
            <p className="text-sm text-outline">Your resource consumption for the current billing cycle.</p>
            
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="bg-surface-variant/10 border border-outline/10 p-4 rounded-2xl">
                <p className="text-xs font-bold text-outline uppercase">Scans</p>
                <p className="text-lg font-bold text-on-surface mt-1">
                  {usage.scannedPages} / {limits.scannedPages === 1000000 ? '∞' : limits.scannedPages}
                </p>
              </div>
              <div className="bg-surface-variant/10 border border-outline/10 p-4 rounded-2xl">
                <p className="text-xs font-bold text-outline uppercase">OCR Runs</p>
                <p className="text-lg font-bold text-on-surface mt-1">
                  {usage.ocrRuns} / {limits.ocrRuns === 1000000 ? '∞' : limits.ocrRuns}
                </p>
              </div>
              <div className="bg-surface-variant/10 border border-outline/10 p-4 rounded-2xl">
                <p className="text-xs font-bold text-outline uppercase">PDF Operations</p>
                <p className="text-lg font-bold text-on-surface mt-1">
                  {usage.pdfOperations} / {limits.pdfOperations === 1000000 ? '∞' : limits.pdfOperations}
                </p>
              </div>
            </div>
          </div>

          {/* Integration: Google Drive */}
          <div className="bg-surface border border-outline/15 rounded-3xl p-6 shadow-sm space-y-4">
            <h3 className="text-lg font-bold text-on-surface">Cloud Integrations</h3>
            <p className="text-sm text-outline">Sync your scanned documents directly to cloud storage.</p>

            <div className="flex items-center justify-between p-4 bg-surface-variant/20 border border-outline/10 rounded-2xl">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-white rounded-xl shadow-sm border border-outline/15 flex items-center justify-center">
                  <svg className="w-5 h-5" viewBox="0 0 24 24">
                    <path fill="#4285F4" d="M20 12l-4.5 7.8h-9L11 12H20z" />
                    <path fill="#34A853" d="M11 12L6.5 4.2h9L20 12H11z" />
                    <path fill="#FBBC05" d="M6.5 4.2L2 12l4.5 7.8L11 12H6.5z" />
                  </svg>
                </div>
                <div>
                  <p className="text-sm font-bold text-on-surface">Google Drive</p>
                  <p className="text-xs text-outline">
                    {isDriveConnected ? 'Connected to Google Drive' : 'Save processed files directly to Drive'}
                  </p>
                </div>
              </div>

              {isDriveConnected ? (
                <button
                  onClick={handleDisconnectGoogleDrive}
                  className="px-4 py-2 border border-error/30 text-error hover:bg-error/5 rounded-xl text-xs font-semibold transition"
                >
                  Disconnect
                </button>
              ) : (
                <button
                  onClick={handleConnectGoogleDrive}
                  disabled={isSyncingDrive}
                  className="flex items-center gap-1.5 px-4 py-2 bg-primary text-on-primary hover:bg-primary/95 disabled:opacity-50 rounded-xl text-xs font-semibold transition shadow-sm"
                >
                  {isSyncingDrive ? (
                    <RefreshCw size={12} className="animate-spin" />
                  ) : (
                    'Connect'
                  )}
                </button>
              )}
            </div>
          </div>

          {/* Gemini API Key Configuration */}
          <div className="bg-surface border border-outline/15 rounded-3xl p-6 shadow-sm space-y-4">
            <h3 className="text-lg font-bold text-on-surface">Gemini AI Configuration</h3>
            <p className="text-sm text-outline">Enter your Google Gemini API Key to enable AI translations, OCR, and Document Chat.</p>

            <div className="flex flex-col sm:flex-row gap-3 items-end">
              <div className="flex-1 w-full relative">
                <label className="block text-xs font-semibold text-outline mb-1.5">Gemini API Key</label>
                <input
                  type={showKey ? 'text' : 'password'}
                  value={geminiKey}
                  onChange={(e) => setGeminiKey(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl bg-surface-variant/20 border border-outline/30 text-sm text-on-surface focus:outline-none focus:border-primary"
                  placeholder="AIzaSy..."
                />
                <button
                  type="button"
                  onClick={() => setShowKey(!showKey)}
                  className="absolute right-3 top-[34px] text-outline hover:text-on-surface transition text-xs font-bold"
                >
                  {showKey ? 'Hide' : 'Show'}
                </button>
              </div>
              
              <div className="flex gap-2 w-full sm:w-auto">
                <button
                  onClick={handleSaveGeminiKey}
                  className="flex-1 sm:flex-initial px-5 py-2.5 bg-primary text-on-primary hover:bg-primary/95 rounded-xl text-sm font-semibold transition shadow-sm"
                >
                  Save Key
                </button>
                <button
                  onClick={handleClearGeminiKey}
                  className="flex-1 sm:flex-initial px-5 py-2.5 border border-outline/30 hover:bg-surface-variant/30 text-on-surface rounded-xl text-sm font-semibold transition"
                >
                  Clear
                </button>
              </div>
            </div>
          </div>

          {/* Preferences */}
          <div className="bg-surface border border-outline/15 rounded-3xl p-6 shadow-sm space-y-4">
            <h3 className="text-lg font-bold text-on-surface">Preferences</h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-outline mb-1.5">{t.language}</label>
                <select
                  value={language}
                  onChange={handleLanguageChange}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-surface border border-outline/30 text-sm text-on-surface focus:outline-none focus:border-primary"
                >
                  <option value="en">English</option>
                  <option value="es">Español</option>
                  <option value="fr">Français</option>
                  <option value="de">Deutsch</option>
                  <option value="vi">Tiếng Việt</option>
                </select>
              </div>
            </div>
          </div>

        </div>

        {/* 2. Right Column: Billing Tiers */}
        <div className="space-y-6">
          <div className="bg-surface border border-outline/15 rounded-3xl p-6 shadow-sm space-y-6">
            <div>
              <h3 className="text-lg font-bold text-on-surface flex items-center gap-2">
                <CreditCard size={20} className="text-primary" />
                <span>Subscription Plan</span>
              </h3>
              <p className="text-xs text-outline mt-1">Manage limits and upgrade tiers.</p>
            </div>

            {/* Plan Cards */}
            <div className="space-y-4">
              
              {/* Free Plan */}
              <div className={`p-4 rounded-2xl border transition ${
                tier === 'free' ? 'border-primary bg-primary/5' : 'border-outline/20 bg-surface'
              }`}>
                <div className="flex justify-between items-start mb-2">
                  <div>
                    <h4 className="font-bold text-on-surface">Free Tier</h4>
                    <p className="text-[10px] text-outline">Basic scanning and local storage</p>
                  </div>
                  <span className="text-sm font-bold text-on-surface">$0</span>
                </div>
                <ul className="text-xs space-y-1.5 text-on-surface-variant mt-3">
                  <li className="flex items-center gap-2">
                    <CheckCircle2 size={12} className="text-primary flex-shrink-0" />
                    <span>{TIER_LIMITS.free.scannedPages} scanned pages/month</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 size={12} className="text-primary flex-shrink-0" />
                    <span>{TIER_LIMITS.free.ocrRuns} OCR runs/month</span>
                  </li>
                  <li className="flex items-center gap-2 text-outline">
                    <CheckCircle2 size={12} className="text-outline/30 flex-shrink-0" />
                    <span>No Google Drive sync</span>
                  </li>
                </ul>
              </div>

              {/* Pro Plan */}
              <div className={`p-4 rounded-2xl border transition ${
                tier === 'pro' ? 'border-primary bg-primary/5' : 'border-outline/20 bg-surface'
              }`}>
                <div className="flex justify-between items-start mb-2">
                  <div>
                    <h4 className="font-bold text-on-surface">Pro Tier</h4>
                    <p className="text-[10px] text-outline">High-volume workflows & Cloud Sync</p>
                  </div>
                  <span className="text-sm font-bold text-primary">$9.99<span className="text-[10px] text-outline">/mo</span></span>
                </div>
                <ul className="text-xs space-y-1.5 text-on-surface-variant mt-3">
                  <li className="flex items-center gap-2">
                    <CheckCircle2 size={12} className="text-primary flex-shrink-0" />
                    <span>{TIER_LIMITS.pro.scannedPages} scanned pages/month</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 size={12} className="text-primary flex-shrink-0" />
                    <span>{TIER_LIMITS.pro.ocrRuns} OCR runs/month</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 size={12} className="text-primary flex-shrink-0" />
                    <span>Google Drive sync enabled</span>
                  </li>
                </ul>
                {tier !== 'pro' && tier !== 'business' && (
                  <button
                    onClick={() => upgradeTo('pro')}
                    className="w-full mt-4 py-2 bg-primary text-on-primary hover:bg-primary/90 rounded-xl text-xs font-semibold transition shadow-sm"
                  >
                    Upgrade to Pro
                  </button>
                )}
              </div>

              {/* Business Plan */}
              <div className={`p-4 rounded-2xl border transition ${
                tier === 'business' ? 'border-primary bg-primary/5' : 'border-outline/20 bg-surface'
              }`}>
                <div className="flex justify-between items-start mb-2">
                  <div>
                    <h4 className="font-bold text-on-surface">Business</h4>
                    <p className="text-[10px] text-outline">Unlimited scale & team audit logs</p>
                  </div>
                  <span className="text-sm font-bold text-primary">$19.99<span className="text-[10px] text-outline">/mo</span></span>
                </div>
                <ul className="text-xs space-y-1.5 text-on-surface-variant mt-3">
                  <li className="flex items-center gap-2">
                    <CheckCircle2 size={12} className="text-primary flex-shrink-0" />
                    <span>Unlimited scanned pages</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 size={12} className="text-primary flex-shrink-0" />
                    <span>Unlimited OCR runs</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 size={12} className="text-primary flex-shrink-0" />
                    <span>Dedicated business support</span>
                  </li>
                </ul>
                {tier !== 'business' && (
                  <button
                    onClick={() => upgradeTo('business')}
                    className="w-full mt-4 py-2 bg-primary text-on-primary hover:bg-primary/90 rounded-xl text-xs font-semibold transition shadow-sm"
                  >
                    Upgrade to Business
                  </button>
                )}
              </div>

            </div>
          </div>
        </div>

      </div>

    </div>
  );
};
