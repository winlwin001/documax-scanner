import React, { useState } from 'react';
import { ThemeProvider } from './context/ThemeContext';
import { LanguageProvider } from './context/LanguageContext';
import { AuthProvider, useAuth } from './context/AuthContext';
import { SubscriptionProvider } from './context/SubscriptionContext';
import { Layout } from './components/layout/Layout';
import { Dashboard } from './pages/Dashboard';
import { ScannerView } from './components/document/ScannerView';
import { PdfToolsView } from './components/document/PdfToolsView';
import { ConverterView } from './components/document/ConverterView';
import { SpreadsheetEditor } from './components/document/SpreadsheetEditor';
import { QrView } from './components/document/QrView';
import { Settings } from './pages/Settings';
import { Admin } from './pages/Admin';
import { Auth } from './pages/Auth';
import { TranslationCenter } from './pages/TranslationCenter';

const AppContent: React.FC = () => {
  const [currentTab, setCurrentTab] = useState('dashboard');
  const { user } = useAuth();

  // Route/Tab switcher
  const renderTab = () => {
    // If not logged in and trying to access anything other than dashboard/auth, redirect to auth or guest check
    if (!user && currentTab !== 'auth') {
      return <Auth onSuccess={() => setCurrentTab('dashboard')} />;
    }

    switch (currentTab) {
      case 'dashboard':
        return <Dashboard />;
      case 'scanner':
        return <ScannerView />;
      case 'translation-center':
        return <TranslationCenter />;
      case 'pdf-tools':
        return <PdfToolsView />;
      case 'converters':
        return <ConverterView />;
      case 'spreadsheets':
        return <SpreadsheetEditor />;
      case 'qr-barcode':
        return <QrView />;
      case 'settings':
        return <Settings />;
      case 'admin':
        return <Admin />;
      case 'auth':
        return <Auth onSuccess={() => setCurrentTab('dashboard')} />;
      default:
        return <Dashboard />;
    }
  };

  return (
    <Layout currentTab={currentTab} setCurrentTab={setCurrentTab}>
      {renderTab()}
    </Layout>
  );
};

export default function App() {
  return (
    <ThemeProvider>
      <LanguageProvider>
        <AuthProvider>
          <SubscriptionProvider>
            <AppContent />
          </SubscriptionProvider>
        </AuthProvider>
      </LanguageProvider>
    </ThemeProvider>
  );
}
