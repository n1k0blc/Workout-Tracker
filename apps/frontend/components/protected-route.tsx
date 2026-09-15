'use client';

import { useEffect } from 'react';
import { useRouter } from '@/i18n/navigation';
import { useAuth } from '@/lib/auth-context';

export function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { user, loading } = useAuth();

  useEffect(() => {
    // Locale-aware push, not a hardcoded /de/login: this stays in the current locale
    // (same-locale navigation, like logout), so the client router is fine here -- a
    // hardcoded locale would both send an English-locale user to the German login page
    // and cross locales via the client router, which remounts the root layout and
    // triggers next-themes' anti-flash script warning (see the comment on
    // handleLocaleChange in profile/page.tsx).
    if (!loading && !user) {
      router.push('/login');
    }
  }, [user, loading, router]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-lg text-gray-600">Lädt...</div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return <>{children}</>;
}
