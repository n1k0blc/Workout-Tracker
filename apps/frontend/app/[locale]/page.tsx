import { getTranslations } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import { Button } from '@/components/ui/button';

export default async function Home() {
  const t = await getTranslations('HomePage');
  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="max-w-2xl w-full text-center">
        <h1 className="text-5xl font-bold tracking-tight mb-4">
          Workout Tracker
        </h1>
        <p className="text-xl text-muted-foreground mb-8">
          {t('tagline')}
        </p>
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Button asChild size="lg" className="px-8">
            <Link href="/login">{t('signIn')}</Link>
          </Button>
          <Button asChild variant="outline" size="lg" className="px-8">
            <Link href="/register">{t('register')}</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}

