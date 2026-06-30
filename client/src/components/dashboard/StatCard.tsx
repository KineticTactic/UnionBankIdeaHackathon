import { ReactNode } from "react";

interface StatCardProps {
    title: string;
    value: string | number;
    subtitle: string;
    icon: ReactNode;
    accent?: "default" | "crimson" | "copper" | "neutral" | "brand";
    valueClassName?: string;
}

const ACCENT: Record<string, { border: string; icon: string; badge: string; value: string }> = {
    default:  { border: "border-l-[#C9C3C0]",   icon: "bg-[#F5F4F2] text-[#6B6562]",       badge: "",                  value: "text-[#2A161B]" },
    crimson:  { border: "border-l-crimson",     icon: "bg-crimson-soft text-crimson",      badge: "text-crimson",        value: "text-[#2A161B]" },
    copper:   { border: "border-l-copper",      icon: "bg-copper-soft text-[#8E5026]",      badge: "text-copper",         value: "text-[#2A161B]" },
    neutral:  { border: "border-l-[#8B8481]",   icon: "bg-[#F5F4F2] text-[#6B6562]",       badge: "text-[#6B6562]",      value: "text-[#2A161B]" },
    brand:    { border: "border-l-crimson",     icon: "bg-gradient-brand text-white",      badge: "text-crimson",        value: "text-gradient" },
};

export function StatCard({ title, value, subtitle, icon, accent = "default", valueClassName = "" }: StatCardProps) {
    const a = ACCENT[accent];
    return (
        <div className={`bg-white rounded-md border border-soft border-l-4 ${a.border} p-5 flex flex-col gap-3`}>
            <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-[#6B6562] uppercase tracking-wider font-heading">{title}</span>
                <div className={`w-8 h-8 rounded-md flex items-center justify-center ${a.icon}`}>
                    {icon}
                </div>
            </div>
            <div>
                <div className={`text-3xl font-bold leading-none ${a.value} ${valueClassName}`}>{value}</div>
                <p className="text-xs text-[#8B8481] mt-1.5">{subtitle}</p>
            </div>
        </div>
    );
}
