import { RiskTier } from "@/types";

const TIER_CONFIG: Record<RiskTier, { label: string; cls: string }> = {
    ESCALATE: { label: "ESCALATE", cls: "bg-crimson text-white border border-crimson" },
    PRIORITY: { label: "PRIORITY", cls: "bg-copper text-white border border-copper" },
    STANDARD: { label: "WATCH",    cls: "bg-[#F4D9C0] text-[#2A161B] border border-[#F4D9C0]" },
    MONITOR:  { label: "WATCH",    cls: "bg-[#F4D9C0] text-[#2A161B] border border-[#F4D9C0]" },
    NONE:     { label: "STABLE",   cls: "bg-white text-[#2A161B] border border-soft" },
};

interface RiskBadgeProps {
    tier: RiskTier;
    className?: string;
}

export function RiskBadge({ tier, className = "" }: RiskBadgeProps) {
    const cfg = TIER_CONFIG[tier] || TIER_CONFIG.NONE;
    return (
        <span className={`inline-flex items-center font-bold rounded-sm uppercase tracking-wider text-[10px] px-2 py-0.5 ${cfg.cls} ${className}`}>
            {cfg.label}
        </span>
    );
}
