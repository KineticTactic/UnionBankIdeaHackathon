'use client';

import { useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';

export default function RmLayout({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const router   = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (!user) return;
    // Non-RM roles shouldn't be locked in the RM portal — they can browse freely.
    // RM users must stay inside /rm/* — redirect all other routes to My Day.
    if (user.role === 'rm' && !pathname.startsWith('/rm')) {
      router.replace('/rm/today');
    }
  }, [user, pathname, router]);

  return <>{children}</>;
}
