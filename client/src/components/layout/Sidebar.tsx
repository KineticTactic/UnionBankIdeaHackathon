'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LayoutDashboard, Users, Bell, Send, BarChart3, LogOut } from 'lucide-react';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/hooks/useAuth';

const navItems = [
    { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { href: '/customers', label: 'Customers', icon: Users },
    { href: '/signals', label: 'Signal Monitor', icon: Bell },
    { href: '/outreach', label: 'Outreach Hub', icon: Send },
    { href: '/analytics', label: 'Analytics', icon: BarChart3 },
];

export default function Sidebar() {
    const pathname = usePathname();
    const { user, logout } = useAuth();

    const getInitials = (name: string) => {
        return name
            .split(' ')
            .map(n => n[0])
            .join('')
            .toUpperCase()
            .slice(0, 2);
    };

    const handleLogout = () => {
        logout();
        window.location.href = '/login';
    };

    return (
        <div className="w-60 bg-white border-r border-gray-200 h-screen fixed top-0 left-0 flex flex-col justify-between">
            <div>
                <div className="h-14 flex items-center px-6 border-b border-gray-200">
                    <span className="text-xl font-bold text-slate-900 tracking-tight">PCOP</span>
                    <span className="ml-2 px-2 py-0.5 mt-0.5 rounded text-[10px] font-semibold bg-slate-100 text-slate-500 uppercase tracking-wider">Beta</span>
                </div>

                <nav className="py-4 flex flex-col gap-1 px-3">
                    {navItems.map((item) => {
                        const Icon = item.icon;
                        const isActive = pathname.startsWith(item.href);
                        return (
                            <Link
                                key={item.href}
                                href={item.href}
                                className={`flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                                    isActive
                                        ? 'bg-blue-50 text-blue-700'
                                        : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                                }`}
                            >
                                <Icon className="w-4 h-4" />
                                {item.label}
                            </Link>
                        );
                    })}
                </nav>
            </div>

            <div className="p-4 border-t border-gray-200">
                <div className="flex items-center gap-3 mb-3">
                    <Avatar className="h-8 w-8">
                        <AvatarFallback className="bg-blue-100 text-blue-700 text-xs">
                            {user ? getInitials(user.name) : 'AD'}
                        </AvatarFallback>
                    </Avatar>
                    <div className="flex flex-col flex-1 min-w-0">
                        <span className="text-sm font-medium text-slate-900 truncate">{user?.name || 'User'}</span>
                        <span className="text-xs text-slate-500 capitalize">{user?.role || 'Guest'}</span>
                    </div>
                </div>
                <Button
                    variant="ghost"
                    className="w-full justify-start text-slate-600 hover:text-red-600 hover:bg-red-50"
                    onClick={handleLogout}
                >
                    <LogOut className="w-4 h-4 mr-2" />
                    Logout
                </Button>
            </div>
        </div>
    );
}
