'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function RmRoot() {
  const router = useRouter();
  useEffect(() => { router.replace('/rm/today'); }, [router]);
  return null;
}
