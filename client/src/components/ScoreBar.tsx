import { RiskTier } from '@/types';
import { tierColor } from './RiskBadge';

interface Props {
  score:  number;   // 0–1
  tier?:  RiskTier;
  height?: number;
  showLabel?: boolean;
}

export default function ScoreBar({ score, tier, height = 4, showLabel = false }: Props) {
  const pct   = Math.round(score * 100);
  const color = tier ? tierColor(tier) : (
    score >= 0.80 ? '#6B132B' :
    score >= 0.60 ? '#B46B3E' :
    score >= 0.40 ? '#F4D9C0' :
    score >= 0.20 ? '#8B8481' : '#6B6562'
  );

  return (
    <div className="flex items-center gap-2 w-full">
      <div className="flex-1 bg-[#F5F4F2] rounded-full overflow-hidden" style={{ height }}>
        <div
          className="h-full rounded-full transition-all duration-300"
          style={{ width: `${pct}%`, backgroundColor: color }}
        />
      </div>
      {showLabel && (
        <span className="text-[11px] font-semibold tabular-nums" style={{ color, minWidth: '2.5rem', textAlign: 'right' }}>
          {pct}%
        </span>
      )}
    </div>
  );
}
