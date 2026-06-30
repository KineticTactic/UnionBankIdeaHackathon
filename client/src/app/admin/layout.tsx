'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';

const ALLOWED = ['admin', 'manager', 'risk'];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && (!user || !ALLOWED.includes(user.role))) {
      router.replace('/dashboard');
    }
  }, [user, isLoading, router]);

  if (isLoading || !user) {
    return (
      <div className="flex items-center justify-center h-64 text-white/40 text-sm">
        Loading…
      </div>
    );
  }

  if (!ALLOWED.includes(user.role)) return null;

  return <>{children}</>;
}
