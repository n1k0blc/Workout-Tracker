'use client';

import { useState } from 'react';
import { Link } from '@/i18n/navigation';
import { useAuth } from '@/lib/auth-context';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Input } from '@/components/ui/input';
import { Field, FieldGroup, FieldLabel } from '@/components/ui/field';

export default function LoginPage() {
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      // Redirect to the user's *stored* locale, not the one this login form happened to be
      // submitted under -- so URL and preference never disagree (#179). A hard navigation,
      // not the locale-aware router: crossing locales remounts the root layout (it owns
      // <html lang>) purely client-side, and next-themes' anti-flash inline <script> (part
      // of every ThemeProvider render) triggers a "script tag while rendering on the
      // client" warning on that remount. A full page load re-renders it server-side, where
      // the script is part of the initial HTML and hydration matches it without complaint.
      const user = await login({ email, password });
      window.location.href = `/${user.locale}/dashboard`;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login fehlgeschlagen');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="max-w-md w-full space-y-8">
        <div>
          <h2 className="mt-6 text-center text-3xl font-bold text-foreground">
            Anmelden
          </h2>
          <p className="mt-2 text-center text-sm text-muted-foreground">
            Oder{' '}
            <Link
              href="/register"
              className="font-medium text-foreground hover:underline"
            >
              erstelle einen neuen Account
            </Link>
          </p>
        </div>
        <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="email">E-Mail-Adresse</FieldLabel>
              <Input
                id="email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="E-Mail-Adresse"
              />
            </Field>

            <Field>
              <FieldLabel htmlFor="password">Passwort</FieldLabel>
              <Input
                id="password"
                type="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Passwort"
              />
            </Field>
          </FieldGroup>

          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <Button type="submit" className="w-full" disabled={loading} size="lg">
            {loading ? 'Wird angemeldet...' : 'Anmelden'}
          </Button>
        </form>
      </div>
    </div>
  );
}
