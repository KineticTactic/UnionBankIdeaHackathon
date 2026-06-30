'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import {
  Save, RefreshCw, Users, Sliders, Settings, CheckCircle2, Mail,
  MessageSquare, Bell, Phone, UserCheck, Plus, X, Shield, Zap, AlertTriangle
} from 'lucide-react';

/* ── constants ─────────────────────────────────────────────────────────────── */
const VALID_ROLES = ['admin', 'manager', 'risk', 'rm', 'analyst'] as const;
type Role = typeof VALID_ROLES[number];

const ROLE_META: Record<Role, { color: string; desc: string }> = {
  admin:   { color: 'bg-crimson-soft text-crimson border-soft',          desc: 'Full access to all admin sections' },
  manager: { color: 'bg-copper-soft text-copper-dark border-soft',    desc: 'Branch oversight, escalations, reports' },
  risk:    { color: 'bg-copper-soft text-copper-dark border-soft', desc: 'Risk model settings, bias audit' },
  rm:      { color: 'bg-teal-soft text-teal-dark border-soft',          desc: 'Customer portal, outreach, consent' },
  analyst: { color: 'bg-teal-soft text-teal-dark border-soft', desc: 'Read-only analytics and reports' },
};

const TIER_CONFIG = [
  { key: 'PRIORITY', color: 'var(--crimson)', dot: 'bg-crimson',    label: 'PRIORITY', desc: 'Immediate — COMPASS triggers RM call within 24h' },
  { key: 'ESCALATE', color: 'var(--copper)', dot: 'bg-copper', label: 'ESCALATE', desc: 'Urgent — email/SMS outreach within 48h' },
  { key: 'STANDARD', color: 'var(--copper)', dot: 'bg-copper',  label: 'STANDARD', desc: 'Watch — standard outreach cycle, 7-day cadence' },
  { key: 'MONITOR',  color: 'var(--teal)', dot: 'bg-teal',   label: 'MONITOR',  desc: 'Low risk — monthly check-in only' },
] as const;

const CHANNEL_CONFIG = [
  { key: 'email',    Icon: Mail,        label: 'Email',       desc: 'HERALD email dispatch (SendGrid)',        badge: 'TRAI-compliant' },
  { key: 'sms',      Icon: MessageSquare, label: 'SMS',       desc: 'Promotional SMS via DLT header',         badge: 'TRAI-compliant' },
  { key: 'push',     Icon: Bell,        label: 'Push',        desc: 'Mobile app push notifications',          badge: 'Opt-in only' },
  { key: 'phone',    Icon: Phone,       label: 'Phone Call',  desc: 'RM outbound call, logged in CRM',        badge: 'Manual' },
  { key: 'rm_visit', Icon: UserCheck,   label: 'RM Visit',    desc: 'In-branch or doorstep RM visit',         badge: 'HNW/Priority only' },
];

function Toggle({ value, onChange }: { value: boolean; onChange: (v: boolean) => void }) {
  return (
    <button onClick={() => onChange(!value)}
      className={`relative w-11 h-6 rounded-full transition-colors ${value ? 'bg-sage-brand' : 'bg-slate-300'}`}>
      <span className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-all ${value ? 'left-6' : 'left-1'}`} />
    </button>
  );
}

function SectionCard({ title, desc, children }: { title: string; desc?: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 space-y-4">
      <div>
        <h3 className="text-sm font-bold text-slate-800">{title}</h3>
        {desc && <p className="text-[11px] text-slate-400 mt-0.5">{desc}</p>}
      </div>
      {children}
    </div>
  );
}

/* ── page ───────────────────────────────────────────────────────────────────── */
export default function AdminSettingsPage() {
  const [loading,     setLoading]    = useState(true);
  const [saving,      setSaving]     = useState<string | null>(null);
  const [tab,         setTab]        = useState<'thresholds' | 'fatigue' | 'channels' | 'rbac'>('thresholds');
  const [flash,       setFlash]      = useState('');
  const [flashOk,     setFlashOk]    = useState(true);
  const [thresholds,  setThresh]     = useState({ PRIORITY: 0.80, ESCALATE: 0.65, STANDARD: 0.45, MONITOR: 0.25 });
  const [fatigue,     setFatigue]    = useState({ max_per_day: 3, min_days_between: 2, suppression_window_days: 30 });
  const [channels,    setChannels]   = useState({ sms: true, email: true, push: true, phone: true, rm_visit: false });
  const [users,       setUsers]      = useState<any[]>([]);
  const [showAddUser, setShowAddUser]= useState(false);
  const [newUser,     setNewUser]    = useState({ username: '', name: '', role: 'rm' as Role, password: '' });
  const [addingUser,  setAddingUser] = useState(false);

  const showFlash = (msg: string, ok = true) => { setFlash(msg); setFlashOk(ok); setTimeout(() => setFlash(''), 3000); };

  const load = async () => {
    setLoading(true);
    try {
      const [s, u] = await Promise.all([api.getAdminSettings(), api.getAdminUsers()]);
      if (s.settings?.thresholds) setThresh(s.settings.thresholds);
      if (s.settings?.fatigue)    setFatigue(s.settings.fatigue);
      if (s.settings?.channels)   setChannels(s.settings.channels);
      setUsers(u.users || []);
    } catch {}
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const threshValid =
    thresholds.PRIORITY > thresholds.ESCALATE &&
    thresholds.ESCALATE > thresholds.STANDARD &&
    thresholds.STANDARD > thresholds.MONITOR;

  const saveThresholds = async () => {
    if (!threshValid) { showFlash('Thresholds must be strictly descending', false); return; }
    setSaving('thresholds');
    try { await api.updateThresholds(thresholds); showFlash('Thresholds saved'); }
    catch (e: any) { showFlash(e.message, false); }
    setSaving(null);
  };

  const saveFatigue = async () => {
    setSaving('fatigue');
    try { await api.updateFatigue(fatigue); showFlash('Fatigue rules saved'); }
    catch (e: any) { showFlash(e.message, false); }
    setSaving(null);
  };

  const saveChannels = async () => {
    setSaving('channels');
    try { await api.updateChannels(channels); showFlash('Channel settings saved'); }
    catch (e: any) { showFlash(e.message, false); }
    setSaving(null);
  };

  const changeRole = async (username: string, role: string) => {
    try {
      await api.updateUserRole(username, role);
      setUsers(prev => prev.map(u => u.username === username ? { ...u, role } : u));
      showFlash('Role updated');
    } catch (e: any) { showFlash(e.message, false); }
  };

  const addUser = async () => {
    if (!newUser.username || !newUser.name || !newUser.password) return;
    setAddingUser(true);
    try {
      const token = typeof localStorage !== 'undefined' ? localStorage.getItem('pcop_token') : '';
      const r = await fetch('/api/admin/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify(newUser),
      });
      if (!r.ok) throw new Error((await r.json()).message || 'Failed');
      setShowAddUser(false);
      setNewUser({ username: '', name: '', role: 'rm', password: '' });
      await load();
      showFlash('User created successfully');
    } catch (e: any) { showFlash(e.message, false); }
    setAddingUser(false);
  };

  const tabs = [
    { key: 'thresholds', label: 'Risk Thresholds',  Icon: Sliders },
    { key: 'fatigue',    label: 'Outreach Fatigue',  Icon: Zap },
    { key: 'channels',   label: 'Channels',           Icon: Settings },
    { key: 'rbac',       label: 'User Roles',         Icon: Users },
  ] as const;

  return (
    <div className="p-6 space-y-6">
      {/* header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Settings & Access Control</h1>
          <p className="text-slate-400 text-sm mt-0.5">Risk thresholds · outreach fatigue · channel config · user roles</p>
        </div>
        <div className="flex items-center gap-3">
          {flash && (
            <span className={`flex items-center gap-1.5 text-sm font-semibold ${flashOk ? 'text-sage-brand' : 'text-crimson'}`}>
              {flashOk ? <CheckCircle2 className="w-4 h-4" /> : <AlertTriangle className="w-4 h-4" />}{flash}
            </span>
          )}
          <button onClick={load}
            className="flex items-center gap-2 px-3 py-2 rounded-lg border border-slate-200 bg-white text-slate-500 hover:text-slate-700 text-xs shadow-sm transition-all">
            <RefreshCw className="w-3.5 h-3.5" /> Refresh
          </button>
        </div>
      </div>

      {/* tabs */}
      <div className="flex gap-1 border-b border-slate-200">
        {tabs.map(({ key, label, Icon }) => (
          <button key={key} onClick={() => setTab(key)}
            className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-semibold transition-all border-b-2 -mb-px ${
              tab === key
                ? 'border-[var(--crimson)] text-[var(--crimson)]'
                : 'border-transparent text-slate-400 hover:text-slate-600'
            }`}>
            <Icon className="w-3.5 h-3.5" />{label}
          </button>
        ))}
      </div>

      {/* ── Risk Thresholds ─────────────────────────────────────────────────── */}
      {tab === 'thresholds' && (
        <div className="max-w-2xl space-y-4">
          <SectionCard
            title="Churn Score → Risk Tier Mapping"
            desc="CHRONOS FusionX scores are compared against these thresholds to assign a risk tier. Thresholds must be strictly descending."
          >
            {loading ? (
              <div className="space-y-3">{[1,2,3,4].map(i => <div key={i} className="h-12 bg-slate-50 rounded-lg animate-pulse" />)}</div>
            ) : (
              <div className="space-y-5">
                {TIER_CONFIG.map(({ key, dot, label, desc }) => (
                  <div key={key}>
                    <div className="flex items-center gap-3 mb-2">
                      <div className="flex items-center gap-2 w-28 shrink-0">
                        <div className={`w-2.5 h-2.5 rounded-full shrink-0 ${dot}`} />
                        <span className="text-sm font-bold text-slate-700">{label}</span>
                      </div>
                      <input type="range" min={0.01} max={0.99} step={0.01}
                        value={(thresholds as any)[key]}
                        onChange={e => setThresh(p => ({ ...p, [key]: parseFloat(e.target.value) }))}
                        className="flex-1 accent-[var(--crimson)] h-1.5 cursor-pointer" />
                      <span className="text-base font-bold text-slate-900 tabular-nums w-12 text-right">
                        {Math.round((thresholds as any)[key] * 100)}%
                      </span>
                    </div>
                    <p className="text-[10px] text-slate-400 pl-[124px]">{desc}</p>
                  </div>
                ))}
              </div>
            )}

            {!threshValid && (
              <p className="text-xs text-crimson bg-crimson-soft border border-soft rounded-lg p-2.5 flex items-center gap-2">
                <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                Thresholds must be strictly descending (PRIORITY &gt; ESCALATE &gt; STANDARD &gt; MONITOR)
              </p>
            )}
          </SectionCard>

          {/* tier distribution bar */}
          <SectionCard title="Tier Distribution Preview" desc="How the 0–100% score axis is divided at current thresholds.">
            <div className="relative h-9 rounded-xl overflow-hidden flex">
              {[
                { label: 'NONE',     pct: thresholds.MONITOR * 100,                                        bg: 'bg-sage-soft' },
                { label: 'MONITOR',  pct: (thresholds.STANDARD - thresholds.MONITOR) * 100,                bg: 'border-soft' },
                { label: 'STANDARD', pct: (thresholds.ESCALATE - thresholds.STANDARD) * 100,               bg: 'bg-amber-300' },
                { label: 'ESCALATE', pct: (thresholds.PRIORITY - thresholds.ESCALATE) * 100,               bg: 'bg-orange-400' },
                { label: 'PRIORITY', pct: (1 - thresholds.PRIORITY) * 100,                                 bg: 'bg-crimson' },
              ].map(s => (
                <div key={s.label} className={`${s.bg} flex items-center justify-center overflow-hidden transition-all`}
                  style={{ width: `${s.pct}%` }}>
                  {s.pct > 7 && <span className="text-[9px] font-black text-white drop-shadow">{s.label}</span>}
                </div>
              ))}
            </div>
            <div className="flex justify-between text-[10px] text-slate-400 mt-1 px-0.5">
              <span>0%</span><span className="text-center">Churn Score →</span><span>100%</span>
            </div>
          </SectionCard>

          <button onClick={saveThresholds} disabled={saving === 'thresholds' || !threshValid}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[var(--crimson)] text-white font-semibold text-sm hover:bg-[var(--crimson)]/90 disabled:opacity-50 transition-all">
            <Save className="w-4 h-4" />
            {saving === 'thresholds' ? 'Saving…' : 'Save Thresholds'}
          </button>
        </div>
      )}

      {/* ── Outreach Fatigue ────────────────────────────────────────────────── */}
      {tab === 'fatigue' && (
        <div className="max-w-2xl space-y-4">
          <SectionCard
            title="Contact Fatigue Rules"
            desc="Controls how often HERALD will contact a customer. Prevents over-communication and satisfies TRAI TCCCPR 2025 limits."
          >
            {loading ? (
              <div className="space-y-3">{[1,2,3].map(i => <div key={i} className="h-14 bg-slate-50 rounded-lg animate-pulse" />)}</div>
            ) : (
              <div className="space-y-6">
                {([
                  { key: 'max_per_day',           label: 'Max contacts per day',      unit: 'contacts', min: 1, max: 10,
                    desc: 'Hard cap on outreach attempts to one customer in a 24h window.' },
                  { key: 'min_days_between',        label: 'Min days between contacts', unit: 'days',     min: 1, max: 30,
                    desc: 'Minimum cooldown between two consecutive attempts for the same customer.' },
                  { key: 'suppression_window_days', label: 'Post-conversion suppression', unit: 'days',   min: 7, max: 90,
                    desc: 'After a customer converts or churns, suppress AI-driven outreach for this many days.' },
                ] as const).map(({ key, label, unit, min, max, desc }) => (
                  <div key={key}>
                    <div className="flex items-center gap-4 mb-1.5">
                      <label className="flex-1 text-sm font-semibold text-slate-700">{label}</label>
                      <div className="flex items-center gap-3 shrink-0">
                        <input type="range" min={min} max={max} step={1}
                          value={(fatigue as any)[key]}
                          onChange={e => setFatigue(p => ({ ...p, [key]: parseInt(e.target.value) }))}
                          className="w-36 accent-[var(--crimson)] h-1.5 cursor-pointer" />
                        <span className="text-sm font-bold text-slate-900 tabular-nums w-24 text-right">
                          {(fatigue as any)[key]}&nbsp;<span className="text-slate-400 font-normal text-xs">{unit}</span>
                        </span>
                      </div>
                    </div>
                    <p className="text-[10px] text-slate-400">{desc}</p>
                  </div>
                ))}
              </div>
            )}
          </SectionCard>

          <SectionCard title="Regulatory Compliance Check" desc="">
            <div className="grid grid-cols-2 gap-3">
              {[
                { label: 'TRAI TCCCPR 2025', value: 'Max 3 commercial msgs/day per DND registry', ok: fatigue.max_per_day <= 3 },
                { label: 'RBI AI Guidelines', value: '2+ day cooling period post-contact',         ok: fatigue.min_days_between >= 2 },
              ].map(r => (
                <div key={r.label} className={`rounded-xl p-3 border ${r.ok ? 'border-soft bg-sage-soft' : 'border-soft bg-copper-soft'}`}>
                  <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wide mb-1">{r.label}</p>
                  <p className="text-xs font-medium text-slate-700 mb-1.5">{r.value}</p>
                  <p className={`text-[10px] font-bold ${r.ok ? 'text-sage-brand' : 'text-copper-dark'}`}>
                    {r.ok ? '✓ Compliant' : '⚠ Review recommended'}
                  </p>
                </div>
              ))}
            </div>
          </SectionCard>

          <button onClick={saveFatigue} disabled={saving === 'fatigue'}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[var(--crimson)] text-white font-semibold text-sm hover:bg-[var(--crimson)]/90 disabled:opacity-50 transition-all">
            <Save className="w-4 h-4" />
            {saving === 'fatigue' ? 'Saving…' : 'Save Fatigue Rules'}
          </button>
        </div>
      )}

      {/* ── Channels ────────────────────────────────────────────────────────── */}
      {tab === 'channels' && (
        <div className="max-w-2xl space-y-4">
          <SectionCard
            title="Global Outreach Channel Control"
            desc="Enable or disable communication channels system-wide. Disabled channels are skipped by COMPASS during action planning and by HERALD during dispatch — overriding all per-customer consent."
          >
            {loading ? (
              <div className="space-y-3">{[1,2,3,4,5].map(i => <div key={i} className="h-16 bg-slate-50 rounded-xl animate-pulse" />)}</div>
            ) : (
              <div className="space-y-3">
                {CHANNEL_CONFIG.map(({ key, Icon, label, desc, badge }) => {
                  const active = (channels as any)[key];
                  return (
                    <div key={key}
                      className={`flex items-center gap-4 p-4 rounded-xl border-2 transition-all ${active ? 'border-soft bg-sage-soft/30' : 'border-slate-200 bg-slate-50/50'}`}>
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${active ? 'bg-sage-soft' : 'bg-slate-100'}`}>
                        <Icon className={`w-5 h-5 ${active ? 'text-sage-brand' : 'text-slate-400'}`} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-0.5">
                          <p className={`text-sm font-bold ${active ? 'text-slate-800' : 'text-slate-400'}`}>{label}</p>
                          <span className="text-[9px] font-bold text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded">{badge}</span>
                        </div>
                        <p className="text-[11px] text-slate-400">{desc}</p>
                      </div>
                      <div className="flex items-center gap-3 shrink-0">
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${active ? 'bg-sage-soft text-sage-brand' : 'bg-slate-100 text-slate-500'}`}>
                          {active ? 'ENABLED' : 'DISABLED'}
                        </span>
                        <Toggle value={active} onChange={v => setChannels(p => ({ ...p, [key]: v }))} />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </SectionCard>

          <div className="bg-teal-soft border border-soft rounded-xl p-4 flex items-start gap-3">
            <Shield className="w-4 h-4 text-teal-dark mt-0.5 shrink-0" />
            <p className="text-sm text-teal-dark">
              Per-customer channel opt-outs are managed in <strong>Compliance Hub → Consent Ledger</strong>.
              These global toggles override all individual preferences — disabling a channel here blocks it for everyone.
            </p>
          </div>

          <button onClick={saveChannels} disabled={saving === 'channels'}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[var(--crimson)] text-white font-semibold text-sm hover:bg-[var(--crimson)]/90 disabled:opacity-50 transition-all">
            <Save className="w-4 h-4" />
            {saving === 'channels' ? 'Saving…' : 'Save Channel Settings'}
          </button>
        </div>
      )}

      {/* ── User Roles ──────────────────────────────────────────────────────── */}
      {tab === 'rbac' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-slate-500">{users.length} users · Role changes take effect on next login</p>
            <button onClick={() => setShowAddUser(p => !p)}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[var(--crimson)] text-white text-sm font-semibold hover:bg-[var(--crimson)]/90 transition-all">
              {showAddUser ? <><X className="w-3.5 h-3.5" /> Cancel</> : <><Plus className="w-3.5 h-3.5" /> Add User</>}
            </button>
          </div>

          {/* add user form */}
          {showAddUser && (
            <div className="bg-white rounded-xl border border-[var(--crimson)]/20 shadow-sm p-5 space-y-4">
              <h3 className="text-sm font-bold text-slate-800">Create New User</h3>
              <div className="grid grid-cols-2 gap-3">
                {([
                  { field: 'name',     label: 'Full Name',     placeholder: 'Priya Menon',  type: 'text' },
                  { field: 'username', label: 'Username',       placeholder: 'priya.menon', type: 'text' },
                  { field: 'password', label: 'Temp Password',  placeholder: '••••••••',    type: 'password' },
                ] as const).map(({ field, label, placeholder, type }) => (
                  <div key={field}>
                    <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide mb-1 block">{label}</label>
                    <input type={type} value={(newUser as any)[field]}
                      onChange={e => setNewUser(p => ({ ...p, [field]: e.target.value }))}
                      placeholder={placeholder}
                      className="w-full rounded-lg border border-slate-200 text-sm text-slate-800 px-3 py-2 focus:outline-none focus:border-[var(--crimson)]/40 bg-white" />
                  </div>
                ))}
                <div>
                  <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide mb-1 block">Role</label>
                  <select value={newUser.role}
                    onChange={e => setNewUser(p => ({ ...p, role: e.target.value as Role }))}
                    className="w-full rounded-lg border border-slate-200 text-sm text-slate-800 px-3 py-2 focus:outline-none focus:border-[var(--crimson)]/40 bg-white">
                    {VALID_ROLES.map(r => <option key={r} value={r}>{r}</option>)}
                  </select>
                </div>
              </div>
              {newUser.role && (
                <p className="text-[11px] text-slate-500 bg-slate-50 rounded-lg p-2.5">
                  <strong className="text-slate-700">{newUser.role}:</strong> {ROLE_META[newUser.role].desc}
                </p>
              )}
              <button onClick={addUser}
                disabled={addingUser || !newUser.username || !newUser.name || !newUser.password}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[var(--crimson)] text-white font-semibold text-sm hover:bg-[var(--crimson)]/90 disabled:opacity-40 transition-all">
                <Plus className="w-4 h-4" />{addingUser ? 'Creating…' : 'Create User'}
              </button>
            </div>
          )}

          {/* role legend */}
          <div className="grid grid-cols-5 gap-2">
            {VALID_ROLES.map(r => (
              <div key={r} className={`rounded-xl p-3 border text-center ${ROLE_META[r].color}`}>
                <p className="text-[10px] font-black uppercase tracking-wide mb-1">{r}</p>
                <p className="text-[9px] leading-relaxed opacity-80">{ROLE_META[r].desc}</p>
              </div>
            ))}
          </div>

          {/* user table */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="grid grid-cols-[1fr_110px_170px] px-5 py-3 border-b border-slate-100 bg-slate-50">
              <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">User</span>
              <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-400 text-center">Current Role</span>
              <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-400 text-center">Change Role</span>
            </div>
            {loading ? (
              <div className="p-5 space-y-3">{[1,2,3,4].map(i => <div key={i} className="h-14 bg-slate-50 rounded animate-pulse" />)}</div>
            ) : users.length === 0 ? (
              <div className="py-10 text-center text-slate-400 text-sm">No users found</div>
            ) : users.map((u: any) => {
              const initials = (u.name || u.username || '?').split(' ').map((n: string) => n[0]).join('').slice(0,2).toUpperCase();
              return (
                <div key={u.username}
                  className="grid grid-cols-[1fr_110px_170px] items-center px-5 py-4 border-b border-slate-50 last:border-0 hover:bg-slate-50/60 transition-colors">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-full bg-[var(--crimson)]/10 flex items-center justify-center text-[11px] font-bold text-[var(--crimson)] shrink-0">
                      {initials}
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-slate-800">{u.name}</p>
                      <p className="text-[11px] text-slate-400">@{u.username}</p>
                    </div>
                  </div>
                  <div className="flex justify-center">
                    <span className={`text-[11px] font-semibold px-2 py-0.5 rounded border ${ROLE_META[u.role as Role]?.color || 'bg-slate-100 text-slate-600 border-slate-200'}`}>
                      {u.role}
                    </span>
                  </div>
                  <div className="flex justify-center">
                    <select value={u.role} onChange={e => changeRole(u.username, e.target.value)}
                      className="rounded-lg border border-slate-200 text-sm text-slate-700 px-3 py-1.5 focus:outline-none focus:border-[var(--crimson)]/40 bg-white w-full">
                      {VALID_ROLES.map(r => <option key={r} value={r}>{r}</option>)}
                    </select>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
