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

  // RM users are confined to /rm/* — redirect any other route to My Day.
  useEffect(() => {
    if (!user || isPublic) return;
    if (user.role === 'rm' && !pathname.startsWith('/rm')) {
      router.replace('/rm/today');
    }
  }, [user, pathname, isPublic, router]);

  if (isPublic) return <>{children}</>;

  return (
    <div className="flex min-h-screen w-full bg-[#f8fafc]">
      <Sidebar />
      <main className="flex-1 ml-[220px] min-h-screen overflow-x-hidden">
        {children}
      </main>
    </div>
  );
}
