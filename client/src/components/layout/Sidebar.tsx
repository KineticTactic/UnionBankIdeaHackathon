"use client";

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LayoutDashboard, Users, User } from 'lucide-react';
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

export default function Sidebar() {
    const pathname = usePathname();

    return (
        <div className="w-60 bg-white border-r border-gray-200 h-screen fixed top-0 left-0 flex flex-col justify-between">
            <div>
                <div className="h-14 flex items-center px-6 border-b border-gray-200">
                    <span className="text-xl font-bold text-slate-900 tracking-tight">PCOP</span>
                    <span className="ml-2 px-2 py-0.5 mt-0.5 rounded text-[10px] font-semibold bg-slate-100 text-slate-500 uppercase tracking-wider">Beta</span>
                </div>

                <div className="py-4 flex flex-col gap-1 px-3">
                    <Link href="/dashboard" className={`flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors ${pathname.startsWith('/dashboard') ? 'bg-slate-100 text-slate-900' : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'}`}>
                        <LayoutDashboard className="w-4 h-4" />
                        Dashboard
                    </Link>
                    <Link href="/customers" className={`flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors ${pathname.startsWith('/customers') ? 'bg-slate-100 text-slate-900' : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'}`}>
                        <Users className="w-4 h-4" />
                        Customers
                    </Link>
                </div>
            </div>

            <div className="p-4 border-t border-gray-200">
                <div className="flex items-center gap-3">
                    <Avatar className="h-8 w-8">
                        <AvatarFallback className="bg-slate-200 text-slate-700 text-xs">AD</AvatarFallback>
                    </Avatar>
                    <div className="flex flex-col">
                        <span className="text-sm font-medium text-slate-900">Bank Admin</span>
                        <span className="text-xs text-slate-500">Retail Portfolio</span>
                    </div>
                </div>
            </div>
        </div>
    );
}
