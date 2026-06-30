"use client";

import { usePathname } from 'next/navigation';
import { CheckCircle2 } from 'lucide-react';

const PAGE_TITLES: Record<string, { title: string; sub: string }> = {
    '/dashboard': { title: 'Dashboard', sub: 'Portfolio overview & ML intelligence' },
    '/customers': { title: 'Customer Directory', sub: 'Scored portfolio · 20 customers' },
    '/signals':   { title: 'Signal Monitor', sub: 'Real-time CUSUM & BOCPD alerts' },
    '/outreach':  { title: 'Outreach Hub', sub: 'Campaign dispatch & history' },
    '/analytics': { title: 'Analytics', sub: 'VERDICT uplift & performance' },
    '/pipeline':  { title: 'Pipeline Architecture', sub: '7-layer PCOP system' },
};

export default function Topbar() {
    const pathname = usePathname();

    let info = PAGE_TITLES[pathname];
    if (!info && pathname.startsWith('/customers/')) {
        info = { title: 'Customer Detail', sub: 'CHRONOS v2 · COMPASS · HERALD' };
    }
    info = info || { title: 'PCOP', sub: '' };

    const now = new Date();
    const timeStr = now.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
    const dateStr = now.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });

    return (
        <div className="h-14 bg-white border-b border-[#E5E0DF] flex items-center justify-between px-8 sticky top-0 z-10 w-full">
            <div className="flex flex-col">
                <h1 className="text-[15px] font-bold text-[#2A161B] leading-tight font-heading">{info.title}</h1>
                {info.sub && <p className="text-[11px] text-[#6B6562] leading-none mt-0.5">{info.sub}</p>}
            </div>

            <div className="flex items-center gap-4">
                <div className="flex items-center gap-1.5 text-[11px] text-[#2A161B]">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#6B132B] animate-live-pulse" />
                    <span className="font-semibold text-[#6B132B]">Kafka Live</span>
                </div>
                <div className="h-4 w-px bg-[#E5E0DF]" />
                <span className="text-[11px] text-[#6B6562] font-medium tabular-nums">{dateStr} · {timeStr}</span>
            </div>
        </div>
    );
}
