import React, { createContext, useContext, useEffect, useState } from 'react';
import { useAuth } from './AuthContext';
import { supabase, isSupabaseConfigured } from '../lib/supabase';

export type SubscriptionTier = 'free' | 'pro' | 'business';

interface UsageStats {
  scannedPages: number;
  ocrRuns: number;
  pdfOperations: number;
  googleDriveSyncs: number;
}

interface TierLimits {
  scannedPages: number; // monthly limit
  ocrRuns: number;       // monthly limit
  pdfOperations: number; // monthly limit
  allowGoogleDrive: boolean;
  maxFileSizeMB: number;
}

export const TIER_LIMITS: Record<SubscriptionTier, TierLimits> = {
  free: {
    scannedPages: 10,
    ocrRuns: 5,
    pdfOperations: 5,
    allowGoogleDrive: false,
    maxFileSizeMB: 5,
  },
  pro: {
    scannedPages: 500,
    ocrRuns: 100,
    pdfOperations: 100,
    allowGoogleDrive: true,
    maxFileSizeMB: 50,
  },
  business: {
    scannedPages: 1000000, // Unlimited
    ocrRuns: 1000000,
    pdfOperations: 1000000,
    allowGoogleDrive: true,
    maxFileSizeMB: 500,
  },
};

interface SubscriptionContextType {
  tier: SubscriptionTier;
  limits: TierLimits;
  usage: UsageStats;
  loading: boolean;
  upgradeTo: (tier: SubscriptionTier) => Promise<void>;
  incrementUsage: (key: keyof UsageStats) => void;
  checkLimit: (key: keyof UsageStats) => boolean;
}

const SubscriptionContext = createContext<SubscriptionContextType | undefined>(undefined);

export const SubscriptionProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const [tier, setTier] = useState<SubscriptionTier>('free');
  const [loading, setLoading] = useState(true);
  const [usage, setUsage] = useState<UsageStats>({
    scannedPages: 0,
    ocrRuns: 0,
    pdfOperations: 0,
    googleDriveSyncs: 0,
  });

  // Load subscription and usage data
  useEffect(() => {
    if (!user) {
      setTier('free');
      setUsage({ scannedPages: 0, ocrRuns: 0, pdfOperations: 0, googleDriveSyncs: 0 });
      setLoading(false);
      return;
    }

    setLoading(true);

    if (user.isGuest) {
      // Guest users use localStorage for billing mock
      const savedTier = localStorage.getItem(`guest_tier_${user.id}`) as SubscriptionTier || 'free';
      const savedUsage = localStorage.getItem(`guest_usage_${user.id}`);
      setTier(savedTier);
      if (savedUsage) {
        try {
          setUsage(JSON.parse(savedUsage));
        } catch (e) {}
      }
      setLoading(false);
      return;
    }

    if (!isSupabaseConfigured) {
      // Offline mode for signed-in user
      const savedTier = localStorage.getItem(`offline_tier_${user.id}`) as SubscriptionTier || 'free';
      const savedUsage = localStorage.getItem(`offline_usage_${user.id}`);
      setTier(savedTier);
      if (savedUsage) {
        try {
          setUsage(JSON.parse(savedUsage));
        } catch (e) {}
      }
      setLoading(false);
      return;
    }

    // Load from Supabase (Real Database)
    const fetchSubscriptionAndUsage = async () => {
      try {
        // Fetch subscription
        const { data: subData } = await supabase
          .from('subscriptions')
          .select('tier')
          .eq('user_id', user.id)
          .maybeSingle();

        if (subData) {
          setTier(subData.tier as SubscriptionTier);
        } else {
          setTier('free');
        }

        // Fetch usage
        const { data: usageData } = await supabase
          .from('usage_tracking')
          .select('*')
          .eq('user_id', user.id)
          .maybeSingle();

        if (usageData) {
          setUsage({
            scannedPages: usageData.scanned_pages || 0,
            ocrRuns: usageData.ocr_runs || 0,
            pdfOperations: usageData.pdf_operations || 0,
            googleDriveSyncs: usageData.google_drive_syncs || 0,
          });
        }
      } catch (e) {
        console.error('Failed to load billing details:', e);
      } finally {
        setLoading(false);
      }
    };

    fetchSubscriptionAndUsage();
  }, [user]);

  // Save guest/offline usage to localStorage
  const saveLocalUsage = (newUsage: UsageStats, currentTier: SubscriptionTier) => {
    if (!user) return;
    const prefix = user.isGuest ? 'guest' : 'offline';
    localStorage.setItem(`${prefix}_usage_${user.id}`, JSON.stringify(newUsage));
    localStorage.setItem(`${prefix}_tier_${user.id}`, currentTier);
  };

  const upgradeTo = async (newTier: SubscriptionTier) => {
    setLoading(true);
    if (!user) return;

    if (user.isGuest || !isSupabaseConfigured) {
      // Mock upgrade instantly for demonstration
      setTier(newTier);
      saveLocalUsage(usage, newTier);
      setLoading(false);
      return;
    }

    // Real Supabase + Stripe checkout session creation
    try {
      // Call a Supabase Edge Function to create a Stripe Checkout Session
      const { data, error } = await supabase.functions.invoke('create-checkout-session', {
        body: { tier: newTier, returnUrl: window.location.origin + '/settings' },
      });

      if (error) throw error;
      if (data?.url) {
        // Redirect to Stripe Checkout
        window.location.href = data.url;
      } else {
        // Fallback mock upgrade if function is not deployed
        const { error: upsertError } = await supabase
          .from('subscriptions')
          .upsert({ user_id: user.id, tier: newTier, updated_at: new Date().toISOString() });
        if (upsertError) throw upsertError;
        setTier(newTier);
      }
    } catch (e) {
      console.error('Stripe billing error, falling back to mock upgrade:', e);
      // Fallback
      setTier(newTier);
    } finally {
      setLoading(false);
    }
  };

  const incrementUsage = async (key: keyof UsageStats) => {
    const newUsage = { ...usage, [key]: usage[key] + 1 };
    setUsage(newUsage);

    if (!user) return;

    if (user.isGuest || !isSupabaseConfigured) {
      saveLocalUsage(newUsage, tier);
      return;
    }

    // Sync to Supabase in the background
    try {
      const dbKey = 
        key === 'scannedPages' ? 'scanned_pages' :
        key === 'ocrRuns' ? 'ocr_runs' :
        key === 'pdfOperations' ? 'pdf_operations' : 'google_drive_syncs';

      await supabase.from('usage_tracking').upsert({
        user_id: user.id,
        [dbKey]: newUsage[key],
        updated_at: new Date().toISOString()
      });
    } catch (e) {
      console.error('Failed to sync usage to Supabase:', e);
    }
  };

  const checkLimit = (key: keyof UsageStats): boolean => {
    const limit = TIER_LIMITS[tier];
    if (key === 'scannedPages') return usage.scannedPages < limit.scannedPages;
    if (key === 'ocrRuns') return usage.ocrRuns < limit.ocrRuns;
    if (key === 'pdfOperations') return usage.pdfOperations < limit.pdfOperations;
    if (key === 'googleDriveSyncs') return limit.allowGoogleDrive;
    return true;
  };

  const limits = TIER_LIMITS[tier];

  return (
    <SubscriptionContext.Provider
      value={{
        tier,
        limits,
        usage,
        loading,
        upgradeTo,
        incrementUsage,
        checkLimit,
      }}
    >
      {children}
    </SubscriptionContext.Provider>
  );
};

export const useSubscription = () => {
  const context = useContext(SubscriptionContext);
  if (!context) {
    throw new Error('useSubscription must be used within a SubscriptionProvider');
  }
  return context;
};
