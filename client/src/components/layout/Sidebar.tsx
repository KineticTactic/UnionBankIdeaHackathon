'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LayoutDashboard, Users, Bell, Send, BarChart3, LogOut, Workflow, Shield, ChevronRight } from 'lucide-react';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/hooks/useAuth';
import { useReviewStats } from '@/hooks/useReviews';

const navItems = [
    { href: '/dashboard', label: 'Dashboard',      icon: LayoutDashboard },
    { href: '/customers', label: 'Customers',       icon: Users },
    { href: '/signals',   label: 'Signal Monitor',  icon: Bell },
    { href: '/outreach',  label: 'Outreach Hub',    icon: Send },
    { href: '/reviews',   label: 'Reviews',         icon: Shield },
    { href: '/analytics', label: 'Analytics',       icon: BarChart3 },
    { href: '/pipeline',  label: 'Pipeline',        icon: Workflow },
];

export default function Sidebar() {
    const pathname = usePathname();
    const { user, logout } = useAuth();
    const { stats } = useReviewStats();
    const pendingCount = (stats?.pending ?? 0) + (stats?.in_review ?? 0);

    const getInitials = (name: string) =>
        name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);

    const handleLogout = () => { logout(); window.location.href = '/login'; };

    return (
        <div className="w-60 bg-white border-r border-slate-200 h-screen fixed top-0 left-0 flex flex-col justify-between shadow-sm">
            {/* Logo */}
            <div>
                <div className="h-14 flex items-center px-5 border-b border-slate-100">
                    <div className="flex items-center gap-2.5">
                        <div className="w-7 h-7 rounded-md bg-blue-700 flex items-center justify-center">
                            <span className="text-white text-[11px] font-black tracking-tight">UB</span>
                        </div>
                        <div>
                            <span className="text-sm font-bold text-slate-900 tracking-tight">PCOP</span>
                            <span className="ml-1.5 text-[9px] font-semibold px-1.5 py-0.5 rounded bg-blue-50 text-blue-600 uppercase tracking-wider">v2</span>
                        </div>
                    </div>
                </div>

                <nav className="py-3 flex flex-col gap-0.5 px-2">
                    <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest px-3 pt-2 pb-1.5">Navigation</p>
                    {navItems.map((item) => {
                        const Icon = item.icon;
                        const isActive = pathname === item.href || (item.href !== '/dashboard' && pathname.startsWith(item.href));
                        const showBadge = item.href === '/reviews' && pendingCount > 0;
                        return (
                            <Link
                                key={item.href}
                                href={item.href}
                                className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                                    isActive
                                        ? 'bg-blue-50 text-blue-700 font-semibold'
                                        : 'text-slate-500 hover:text-slate-800 hover:bg-slate-50'
                                }`}
                            >
                                <Icon className={`w-4 h-4 ${isActive ? 'text-blue-600' : 'text-slate-400'}`} />
                                <span className="flex-1">{item.label}</span>
                                {showBadge && (
                                    <span className="inline-flex items-center justify-center min-w-[18px] h-[18px] px-1.5 rounded-full bg-amber-500 text-white text-[10px] font-bold leading-none">
                                        {pendingCount > 99 ? '99+' : pendingCount}
                                    </span>
                                )}
                                {isActive && !showBadge && <ChevronRight className="w-3 h-3 text-blue-400" />}
                                {isActive && showBadge && <ChevronRight className="w-3 h-3 text-blue-400" />}
                            </Link>
                        );
                    })}
                </nav>
            </div>

            {/* User footer */}
            <div className="p-3 border-t border-slate-100">
                <div className="flex items-center gap-2.5 px-2 py-2 rounded-lg hover:bg-slate-50 transition-colors mb-1">
                    <Avatar className="h-7 w-7">
                        <AvatarFallback className="bg-blue-700 text-white text-[10px] font-bold">
                            {user ? getInitials(user.name) : 'AD'}
                        </AvatarFallback>
                    </Avatar>
                    <div className="flex flex-col min-w-0">
                        <span className="text-xs font-semibold text-slate-800 truncate">{user?.name || 'User'}</span>
                        <span className="text-[10px] text-slate-400 capitalize">{user?.role || 'Guest'}</span>
                    </div>
                </div>
                <Button
                    variant="ghost"
                    size="sm"
                    className="w-full justify-start text-slate-500 hover:text-red-600 hover:bg-red-50 text-xs h-8"
                    onClick={handleLogout}
                >
                    <LogOut className="w-3.5 h-3.5 mr-2" />
                    Sign out
                </Button>
            </div>
        </div>
    );
}
