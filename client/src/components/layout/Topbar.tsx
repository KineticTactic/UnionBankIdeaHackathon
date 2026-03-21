"use client";

import { usePathname } from 'next/navigation';

export default function Topbar() {
    const pathname = usePathname();

    let title = "Dashboard";
    if (pathname.includes('/customers')) {
        title = pathname === '/customers' ? 'Customer Directory' : 'Customer Detail';
    }

    return (
        <div className="h-14 bg-white border-b border-gray-200 flex items-center justify-between px-8 sticky top-0 z-10 w-full">
            <h1 className="text-lg font-semibold text-slate-900">{title}</h1>
            <div className="text-xs text-slate-500 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-green-500 inline-block"></span>
                Data live via Demo Server
            </div>
        </div>
    );
}
