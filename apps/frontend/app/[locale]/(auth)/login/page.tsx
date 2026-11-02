'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { useAuth } from '@/lib/auth-context';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Field, FieldError, FieldGroup, FieldLabel } from '@/components/ui/field';
import { useFormErrors } from '@/hooks/useFormErrors';
import { checkEmail, checkPassword } from '@/lib/field-rules';

export default function LoginPage() {
  const t = useTranslations('LoginPage');
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [form, formRef] = useFormErrors({ fields: ['email', 'password'] });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const valid = form.setConstraints({
      email: checkEmail(email),
      password: checkPassword(password),
    });
    if (!valid) return;
    setLoading(true);

    try {
      // Redirect to the user's *stored* locale, not the one this login form happened to be
      // submitted under -- so URL and preference never disagree (#179). A hard navigation,
      // not the locale-aware router: crossing locales remounts the root layout (it owns
      // <html lang>) purely client-side, and next-themes' anti-flash inline <script> (part
      // of every ThemeProvider render) triggers a "script tag while rendering on the
      // client" warning on that remount. A full page load re-renders it server-side, where
      // the script is part of the initial HTML and hydration matches it without complaint.
      const user = await login({ email: email.trim(), password });
      window.location.href = `/${user.locale}/dashboard`;
    } catch (err) {
      form.showApiError(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="max-w-md w-full space-y-8">
        <div>
          <h2 className="mt-6 text-center text-3xl font-bold text-foreground">
            {t('title')}
          </h2>
          <p className="mt-2 text-center text-sm text-muted-foreground">
            {t('or')}{' '}
            <Link
              href="/register"
              className="font-medium text-foreground hover:underline"
            >
              {t('createAccount')}
            </Link>
          </p>
        </div>
        <form ref={formRef} noValidate className="mt-8 space-y-6" onSubmit={handleSubmit}>
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="email">{t('email')}</FieldLabel>
              <Input
                id="email"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => { setEmail(e.target.value); form.clear('email'); }}
                placeholder={t('email')}
                {...form.fieldProps('email')}
              />
              <FieldError id={form.errorId('email')}>{form.errors.email}</FieldError>
            </Field>

            <Field>
              <FieldLabel htmlFor="password">{t('password')}</FieldLabel>
              <Input
                id="password"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => { setPassword(e.target.value); form.clear('password'); }}
                placeholder={t('password')}
                {...form.fieldProps('password')}
              />
              <FieldError id={form.errorId('password')}>{form.errors.password}</FieldError>
            </Field>
          </FieldGroup>

          <Button type="submit" className="w-full" disabled={loading} size="lg">
            {loading ? t('submitting') : t('submit')}
          </Button>
        </form>
      </div>
    </div>
  );
}
