import { RiskTier } from '@/types';

const TIER_CONFIG: Record<RiskTier, { label: string; bg: string; text: string; dot: string }> = {
  ESCALATE: { label: 'ESCALATE',  bg: 'badge-escalate', text: 'text-white',        dot: 'bg-white'    },
  PRIORITY: { label: 'PRIORITY',  bg: 'badge-priority', text: 'text-white',        dot: 'bg-white'    },
  STANDARD: { label: 'WATCH',     bg: 'badge-watch',    text: 'text-[#2A161B]',    dot: 'bg-[#2A161B]' },
  MONITOR:  { label: 'WATCH',     bg: 'badge-watch',    text: 'text-[#2A161B]',    dot: 'bg-[#2A161B]' },
  NONE:     { label: 'STABLE',    bg: 'badge-stable',   text: 'text-[#2A161B]',    dot: 'bg-[#8B8481]' },
};

interface Props {
  tier: RiskTier;
  size?: 'sm' | 'md';
  dot?: boolean;
}

export default function RiskBadge({ tier, size = 'sm', dot = true }: Props) {
  const cfg = TIER_CONFIG[tier] || TIER_CONFIG.NONE;
  return (
    <span className={`inline-flex items-center gap-1.5 font-bold rounded-sm uppercase tracking-wider ${cfg.bg} ${cfg.text} ${
      size === 'sm' ? 'text-[9px] px-1.5 py-0.5' : 'text-[10px] px-2 py-0.5'
    }`}>
      {dot && <span className={`w-1 h-1 rounded-full ${cfg.dot} shrink-0`} />}
      {cfg.label}
    </span>
  );
}

export function tierColor(tier: RiskTier): string {
  const map: Record<RiskTier, string> = {
    ESCALATE: '#6B132B',
    PRIORITY: '#B46B3E',
    STANDARD: '#F4D9C0',
    MONITOR:  '#F4D9C0',
    NONE:     '#8B8481',
  };
  return map[tier] || '#8B8481';
}

export function tierBgColor(tier: RiskTier): string {
  const map: Record<RiskTier, string> = {
    ESCALATE: '#F5E6E9',
    PRIORITY: '#FAF0E6',
    STANDARD: '#FAF0E6',
    MONITOR:  '#FAF0E6',
    NONE:     '#F5F4F2',
  };
  return map[tier] || '#F5F4F2';
}
