import React, { useState, useEffect } from 'react';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { 
  ShieldAlert, Users, Brain, DollarSign, 
  RefreshCw, UserCheck 
} from 'lucide-react';

interface AuditLog {
  id: string;
  user_id: string;
  email?: string;
  action: string;
  created_at: string;
}

interface UserProfile {
  id: string;
  email: string;
  full_name?: string;
  tier: string;
}

export const Admin: React.FC = () => {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    activeUsers: 142,
    ocrRuns: 1240,
    monthlyRevenue: 890,
  });

  const loadAdminData = async () => {
    setLoading(true);

    if (!isSupabaseConfigured) {
      // Mock Data for demonstration
      setLogs([
        { id: '1', user_id: 'u1', email: 'alex@example.com', action: 'create_document', created_at: new Date(Date.now() - 1000 * 60 * 10).toISOString() },
        { id: '2', user_id: 'u2', email: 'sophie@example.com', action: 'ocr_run', created_at: new Date(Date.now() - 1000 * 60 * 25).toISOString() },
        { id: '3', user_id: 'u3', email: 'john@documax.app', action: 'merge_pdf', created_at: new Date(Date.now() - 1000 * 60 * 45).toISOString() },
        { id: '4', user_id: 'u1', email: 'alex@example.com', action: 'sync_google_drive', created_at: new Date(Date.now() - 1000 * 3600 * 2).toISOString() },
      ]);
      setUsers([
        { id: 'u1', email: 'alex@example.com', full_name: 'Alex Rivera', tier: 'pro' },
        { id: 'u2', email: 'sophie@example.com', full_name: 'Sophie Dubois', tier: 'free' },
        { id: 'u3', email: 'john@documax.app', full_name: 'John Miller', tier: 'business' },
      ]);
      setLoading(false);
      return;
    }

    try {
      // Fetch users and subscriptions
      const { data: profileData } = await supabase
        .from('profiles')
        .select(`
          id,
          email,
          full_name,
          subscriptions ( tier )
        `);

      if (profileData) {
        const formattedUsers = profileData.map((p: any) => ({
          id: p.id,
          email: p.email,
          full_name: p.full_name,
          tier: p.subscriptions?.[0]?.tier || 'free',
        }));
        setUsers(formattedUsers);
        setStats(prev => ({ ...prev, activeUsers: formattedUsers.length }));
      }

      // Fetch audit logs
      const { data: logData } = await supabase
        .from('audit_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(30);

      if (logData) {
        setLogs(logData.map((l: any) => ({
          id: l.id,
          user_id: l.user_id,
          action: l.action,
          created_at: l.created_at,
          email: users.find(u => u.id === l.user_id)?.email || 'Unknown User',
        })));
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAdminData();
  }, []);

  const handleUpdateTier = async (userId: string, newTier: string) => {
    if (!isSupabaseConfigured) {
      // Mock update
      setUsers(prev => prev.map(u => u.id === userId ? { ...u, tier: newTier } : u));
      alert(`User tier updated to ${newTier} (mock mode).`);
      return;
    }

    try {
      const { error } = await supabase
        .from('subscriptions')
        .upsert({ user_id: userId, tier: newTier, updated_at: new Date().toISOString() });

      if (error) throw error;
      await loadAdminData();
      alert('User subscription tier updated successfully.');
    } catch (e) {
      console.error(e);
      alert('Failed to update tier.');
    }
  };

  return (
    <div className="space-y-8">
      
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-on-surface flex items-center gap-3">
          <ShieldAlert className="text-primary" size={32} />
          <span>Admin Control Center</span>
        </h1>
        <p className="text-sm text-outline mt-1">Monitor users, track metrics, audit logs, and manage subscription billing.</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Stat 1 */}
        <div className="bg-surface border border-outline/15 rounded-3xl p-6 shadow-sm flex items-center gap-4">
          <div className="p-4 bg-primary/10 text-primary rounded-2xl">
            <Users size={24} />
          </div>
          <div>
            <p className="text-xs font-bold text-outline uppercase">Active Accounts</p>
            <h3 className="text-2xl font-bold text-on-surface mt-1">{stats.activeUsers}</h3>
          </div>
        </div>

        {/* Stat 2 */}
        <div className="bg-surface border border-outline/15 rounded-3xl p-6 shadow-sm flex items-center gap-4">
          <div className="p-4 bg-secondary/10 text-primary rounded-2xl">
            <Brain size={24} />
          </div>
          <div>
            <p className="text-xs font-bold text-outline uppercase">OCR Extractions</p>
            <h3 className="text-2xl font-bold text-on-surface mt-1">{stats.ocrRuns}</h3>
          </div>
        </div>

        {/* Stat 3 */}
        <div className="bg-surface border border-outline/15 rounded-3xl p-6 shadow-sm flex items-center gap-4">
          <div className="p-4 bg-success/10 text-success rounded-2xl">
            <DollarSign size={24} />
          </div>
          <div>
            <p className="text-xs font-bold text-outline uppercase">Monthly Revenue</p>
            <h3 className="text-2xl font-bold text-on-surface mt-1">${stats.monthlyRevenue}</h3>
          </div>
        </div>
      </div>

      {/* Content grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        
        {/* User Management */}
        <div className="bg-surface border border-outline/15 rounded-3xl p-6 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-bold text-on-surface">User Accounts</h3>
              <button onClick={loadAdminData} className="p-2 hover:bg-surface-variant/30 rounded-xl transition">
                <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-surface-variant/20 border-b border-outline/10 text-outline uppercase font-semibold">
                    <th className="p-3">User</th>
                    <th className="p-3">Email</th>
                    <th className="p-3">Tier</th>
                    <th className="p-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-outline/10">
                  {users.map((u) => (
                    <tr key={u.id} className="hover:bg-surface-variant/10">
                      <td className="p-3 font-semibold text-on-surface">{u.full_name || 'No Name'}</td>
                      <td className="p-3 text-on-surface-variant font-mono">{u.email}</td>
                      <td className="p-3">
                        <span className={`px-2 py-0.5 rounded-full font-semibold capitalize ${
                          u.tier === 'business' ? 'bg-success/10 text-success' :
                          u.tier === 'pro' ? 'bg-primary/10 text-primary' : 'bg-outline/10 text-outline'
                        }`}>
                          {u.tier}
                        </span>
                      </td>
                      <td className="p-3 text-right">
                        <select
                          value={u.tier}
                          onChange={(e) => handleUpdateTier(u.id, e.target.value)}
                          className="px-2 py-1 rounded bg-surface border border-outline/30 text-[10px] font-semibold text-on-surface focus:outline-none"
                        >
                          <option value="free">Free</option>
                          <option value="pro">Pro</option>
                          <option value="business">Business</option>
                        </select>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Real-time Audit Logs */}
        <div className="bg-surface border border-outline/15 rounded-3xl p-6 shadow-sm">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-bold text-on-surface">System Audit Logs</h3>
            <span className="text-xs font-semibold bg-primary/10 text-primary px-2.5 py-1 rounded-full">Live Logs</span>
          </div>

          <div className="space-y-4 max-h-[350px] overflow-y-auto">
            {logs.map((log) => (
              <div key={log.id} className="flex items-start gap-3 text-xs bg-surface-variant/10 p-3 rounded-2xl border border-outline/5">
                <div className="p-1.5 bg-primary/10 text-primary rounded-lg mt-0.5">
                  <UserCheck size={12} />
                </div>
                <div className="flex-1 overflow-hidden">
                  <p className="font-semibold text-on-surface">
                    {log.email || 'guest@documax.local'}
                  </p>
                  <p className="text-outline mt-0.5">
                    Action: <span className="font-mono text-primary font-medium">{log.action}</span>
                  </p>
                  <p className="text-[10px] text-outline/80 mt-1">
                    {new Date(log.created_at).toLocaleString()}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>

      </div>

    </div>
  );
};
