'use client';

import { usePathname } from 'next/navigation';
import Sidebar from '@/components/layout/Sidebar';
import Topbar from '@/components/layout/Topbar';

const PUBLIC_ROUTES = ['/', '/login'];

export default function ConditionalShell({ children }: { children: React.ReactNode }) {
    const pathname = usePathname();
    const isPublic = PUBLIC_ROUTES.includes(pathname);

    if (isPublic) {
        return <>{children}</>;
    }

    return (
        <>
            <Sidebar />
            <div className="flex-1 ml-60 flex flex-col min-h-screen">
                <Topbar />
                <main className="p-8 flex-1">
                    {children}
                </main>
            </div>
        </>
    );
}
