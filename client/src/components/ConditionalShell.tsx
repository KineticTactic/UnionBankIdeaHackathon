'use client';

import { useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import Sidebar from '@/components/layout/Sidebar';
import { useAuth } from '@/hooks/useAuth';

const PUBLIC_ROUTES = ['/', '/login'];

export default function ConditionalShell({ children }: { children: React.ReactNode }) {
  const pathname  = usePathname();
  const router    = useRouter();
  const { user }  = useAuth();
  const isPublic  = PUBLIC_ROUTES.includes(pathname);

  useEffect(() => {
    if (!user || isPublic) return;
    // Admin users must NOT enter /rm/* — send to dashboard
    if (user.role === 'admin' && pathname.startsWith('/rm')) {
      router.replace('/dashboard');
    }
  }, [user, pathname, isPublic, router]);

  if (isPublic) return <>{children}</>;

  return (
    <div className="flex min-h-screen w-full bg-[#F9F9F7]">
      <Sidebar />
      <main className="flex-1 ml-[220px] min-h-screen overflow-x-hidden">
        {children}
      </main>
    </div>
  );
}
