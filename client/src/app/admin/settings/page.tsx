'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { Settings, Save, RefreshCw, ShieldCheck, Users, Sliders } from 'lucide-react';

const VALID_ROLES = ['admin', 'manager', 'risk', 'rm', 'analyst'];
const ROLE_COLORS: Record<string, string> = {
  admin:   'bg-red-500/15 text-red-300 border-red-500/30',
  manager: 'bg-amber-500/15 text-amber-300 border-amber-500/30',
  risk:    'bg-orange-500/15 text-orange-300 border-orange-500/30',
  rm:      'bg-sky-500/15 text-sky-300 border-sky-500/30',
  analyst: 'bg-purple-500/15 text-purple-300 border-purple-500/30',
};

export default function AdminSettingsPage() {
  const [settings,  setSettings]  = useState<any>(null);
  const [users,     setUsers]     = useState<any[]>([]);
  const [loading,   setLoading]   = useState(true);
  const [saving,    setSaving]    = useState<string | null>(null);
  const [tab,       setTab]       = useState<'thresholds' | 'fatigue' | 'rbac'>('thresholds');
  const [thresholds, setThresh]   = useState({ PRIORITY: 0.80, ESCALATE: 0.65, STANDARD: 0.45, MONITOR: 0.25 });
  const [fatigue,    setFatigue]  = useState({ max_per_day: 3, min_days_between: 2, suppression_window_days: 30 });
  const [savedMsg,  setSavedMsg]  = useState('');

  const load = async () => {
    setLoading(true);
    try {
      const [s, u] = await Promise.all([api.getAdminSettings(), api.getAdminUsers()]);
      setSettings(s.settings);
      setThresh(s.settings?.thresholds || thresholds);
      setFatigue(s.settings?.fatigue   || fatigue);
      setUsers(u.users || []);
    } catch {}
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const flash = (msg: string) => { setSavedMsg(msg); setTimeout(() => setSavedMsg(''), 2500); };

  const saveThresholds = async () => {
    setSaving('thresholds');
    try {
      await api.updateThresholds(thresholds);
      flash('Thresholds saved');
    } catch (e: any) { flash(`Error: ${e.message}`); }
    setSaving(null);
  };

  const saveFatigue = async () => {
    setSaving('fatigue');
    try {
      await api.updateFatigue(fatigue);
      flash('Fatigue rules saved');
    } catch (e: any) { flash(`Error: ${e.message}`); }
    setSaving(null);
  };

  const changeRole = async (username: string, role: string) => {
    try {
      await api.updateUserRole(username, role);
      setUsers(prev => prev.map(u => u.username === username ? { ...u, role } : u));
    } catch {}
  };

  if (loading) return (
    <div className="flex items-center justify-center h-64 text-white/30 text-sm animate-pulse">Loading settings…</div>
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Settings</h1>
          <p className="text-white/40 text-sm mt-0.5">Model thresholds, outreach fatigue rules, and access control</p>
        </div>
        <div className="flex items-center gap-3">
          {savedMsg && (
            <span className="text-sm text-emerald-400 font-medium animate-pulse">{savedMsg}</span>
          )}
          <button onClick={load} className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white/6 hover:bg-white/10 text-white/60 hover:text-white text-xs transition-all">
            <RefreshCw className="w-3.5 h-3.5" /> Refresh
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-white/4 border border-white/8 rounded-xl p-1 w-fit">
        {([
          { key: 'thresholds', label: 'Risk Thresholds', icon: Sliders },
          { key: 'fatigue',    label: 'Outreach Fatigue', icon: Settings },
          { key: 'rbac',       label: 'User Roles',        icon: Users },
        ] as const).map(({ key, label, icon: Icon }) => (
          <button key={key} onClick={() => setTab(key as any)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${tab === key ? 'bg-white/12 text-white' : 'text-white/40 hover:text-white'}`}>
            <Icon className="w-3.5 h-3.5" />{label}
          </button>
        ))}
      </div>

      {/* Thresholds tab */}
      {tab === 'thresholds' && (
        <div className="max-w-xl space-y-5">
          <div className="rounded-xl border border-white/8 bg-white/4 p-5 space-y-4">
            <p className="text-[11px] font-semibold uppercase tracking-widest text-white/40 mb-3">Churn Score → Risk Tier Mapping</p>
            <p className="text-xs text-white/35">Customer is placed in the highest tier whose threshold their churn score exceeds. Thresholds must be strictly descending.</p>

            {(['PRIORITY', 'ESCALATE', 'STANDARD', 'MONITOR'] as const).map(tier => {
              const dotColor = tier === 'PRIORITY' ? 'bg-red-500' : tier === 'ESCALATE' ? 'bg-orange-500' : tier === 'STANDARD' ? 'bg-amber-500' : 'bg-blue-500';
              return (
                <div key={tier} className="flex items-center gap-4">
                  <div className="flex items-center gap-2 w-28 shrink-0">
                    <div className={`w-2 h-2 rounded-full ${dotColor}`} />
                    <span className="text-sm font-semibold text-white">{tier}</span>
                  </div>
                  <div className="flex-1 flex items-center gap-3">
                    <input
                      type="range"
                      min={0.01}
                      max={0.99}
                      step={0.01}
                      value={thresholds[tier]}
                      onChange={e => setThresh(prev => ({ ...prev, [tier]: parseFloat(e.target.value) }))}
                      className="flex-1 accent-sky-400"
                    />
                    <span className="w-14 text-right text-sm font-bold text-white tabular-nums">{Math.round(thresholds[tier]*100)}%</span>
                  </div>
                </div>
              );
            })}
          </div>
          <button
            onClick={saveThresholds}
            disabled={saving === 'thresholds'}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#0f2d5c] border border-white/20 text-white font-semibold text-sm hover:bg-white/10 transition-all disabled:opacity-50"
          >
            <Save className="w-4 h-4" />
            {saving === 'thresholds' ? 'Saving…' : 'Save Thresholds'}
          </button>
        </div>
      )}

      {/* Fatigue tab */}
      {tab === 'fatigue' && (
        <div className="max-w-xl space-y-5">
          <div className="rounded-xl border border-white/8 bg-white/4 p-5 space-y-5">
            <p className="text-[11px] font-semibold uppercase tracking-widest text-white/40 mb-1">Contact Fatigue Rules</p>
            <p className="text-xs text-white/35">Controls how often HERALD will contact a customer to prevent over-communication.</p>

            {[
              { key: 'max_per_day',             label: 'Max contacts per day',       min: 1, max: 10 },
              { key: 'min_days_between',        label: 'Min days between contacts',  min: 1, max: 30 },
              { key: 'suppression_window_days', label: 'Suppression window (days)',  min: 7, max: 90 },
            ].map(({ key, label, min, max }) => (
              <div key={key} className="flex items-center gap-4">
                <label className="flex-1 text-sm text-white/70">{label}</label>
                <div className="flex items-center gap-3">
                  <input
                    type="range"
                    min={min}
                    max={max}
                    step={1}
                    value={(fatigue as any)[key]}
                    onChange={e => setFatigue(prev => ({ ...prev, [key]: parseInt(e.target.value) }))}
                    className="w-32 accent-amber-500"
                  />
                  <span className="w-10 text-right text-sm font-bold text-white tabular-nums">{(fatigue as any)[key]}</span>
                </div>
              </div>
            ))}
          </div>
          <button
            onClick={saveFatigue}
            disabled={saving === 'fatigue'}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#0f2d5c] border border-white/20 text-white font-semibold text-sm hover:bg-white/10 transition-all disabled:opacity-50"
          >
            <Save className="w-4 h-4" />
            {saving === 'fatigue' ? 'Saving…' : 'Save Fatigue Rules'}
          </button>
        </div>
      )}

      {/* RBAC tab */}
      {tab === 'rbac' && (
        <div className="space-y-4">
          <div className="rounded-xl border border-white/8 bg-white/4 overflow-hidden">
            <div className="grid grid-cols-[1fr_auto_auto] gap-0 text-[10px] font-semibold uppercase tracking-widest text-white/30 px-5 py-3 border-b border-white/8">
              <span>User</span>
              <span className="w-32 text-center">Current Role</span>
              <span className="w-40 text-center">Change Role</span>
            </div>
            {users.map((u: any) => (
              <div key={u.username} className="grid grid-cols-[1fr_auto_auto] gap-0 items-center px-5 py-4 border-b border-white/5 last:border-0 hover:bg-white/4 transition-colors">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-white/8 flex items-center justify-center text-[11px] font-bold text-white">
                    {u.name.split(' ').map((n: string) => n[0]).join('').slice(0,2)}
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-white">{u.name}</p>
                    <p className="text-[11px] text-white/35">@{u.username}</p>
                  </div>
                </div>
                <div className="w-32 flex justify-center">
                  <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${ROLE_COLORS[u.role] || 'bg-white/8 text-white/50 border-white/10'}`}>
                    {u.role}
                  </span>
                </div>
                <div className="w-40 flex justify-center">
                  <select
                    value={u.role}
                    onChange={e => changeRole(u.username, e.target.value)}
                    className="rounded-lg bg-white/6 border border-white/10 text-sm text-white px-3 py-1.5 focus:outline-none focus:border-white/30 w-full"
                  >
                    {VALID_ROLES.map(r => <option key={r} value={r}>{r}</option>)}
                  </select>
                </div>
              </div>
            ))}
          </div>
          <p className="text-[11px] text-white/25 px-1">
            Role changes take effect on the user's next login. Admin role grants full access to all portal sections.
          </p>
        </div>
      )}
    </div>
  );
}
