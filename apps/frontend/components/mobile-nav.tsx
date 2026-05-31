'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { useWorkout } from '@/lib/workout-context';
import {
  IconMenu2,
  IconX,
  IconHome,
  IconBarbell,
  IconRefresh,
  IconListCheck,
  IconHistory,
  IconChartBar,
  IconLogout,
  IconUserCircle,
} from '@tabler/icons-react';
import { Button } from '@/components/ui/button';
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from '@/components/ui/drawer';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';

export function MobileNav() {
  const [isOpen, setIsOpen] = useState(false);
  const pathname = usePathname();
  const { user, logout } = useAuth();
  const { activeWorkout } = useWorkout();

  // Close menu when route changes
  useEffect(() => {
    setIsOpen(false);
  }, [pathname]);

  // Don't show navigation on auth pages, workout page, or when there's an active workout
  if (
    pathname === '/' ||
    pathname === '/login' ||
    pathname === '/register' ||
    pathname?.startsWith('/workout') ||
    activeWorkout
  ) {
    return null;
  }

  const navigationLinks = [
    { href: '/dashboard', label: 'Dashboard', icon: IconHome },
    { href: '/workout', label: 'Workout', icon: IconBarbell },
    { href: '/cycles', label: 'Zyklen', icon: IconRefresh },
    { href: '/templates', label: 'Vorlagen', icon: IconListCheck },
    { href: '/history', label: 'Verlauf', icon: IconHistory },
    { href: '/analytics', label: 'Analytics', icon: IconChartBar },
  ];

  const handleLogout = async () => {
    await logout();
  };

  return (
    <>
      {/* Mobile Header */}
      <div className="md:hidden bg-background border-b sticky top-0 z-40">
        <div className="flex items-center justify-between h-16 px-4">
          <Drawer open={isOpen} onOpenChange={setIsOpen}>
            <DrawerTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="md:hidden"
                aria-label="Menü öffnen"
              >
                <IconMenu2 />
              </Button>
            </DrawerTrigger>

            <DrawerContent className="md:hidden">
              <DrawerHeader className="text-left">
                <DrawerTitle>Menü</DrawerTitle>
              </DrawerHeader>

              <div className="px-4 pb-6">
                {/* Navigation Links */}
                <nav className="flex flex-col gap-1">
                  {navigationLinks.map((link) => {
                    const Icon = link.icon;
                    const isActive = pathname === link.href;
                    return (
                      <Link
                        key={link.href}
                        href={link.href}
                        onClick={() => setIsOpen(false)}
                        className={cn(
                          'flex items-center gap-3 rounded-lg px-3 py-3 text-base font-medium transition-colors',
                          isActive
                            ? 'bg-primary text-primary-foreground'
                            : 'text-foreground hover:bg-muted'
                        )}
                      >
                        <Icon className="size-5" />
                        {link.label}
                      </Link>
                    );
                  })}
                </nav>

                <Separator className="my-4" />

                {/* User Info & Logout */}
                <div className="space-y-3">
                  <div className="px-1 text-sm text-muted-foreground truncate">
                    {user?.email}
                  </div>
                  <Button
                    variant="outline"
                    className="w-full justify-start gap-2"
                    onClick={handleLogout}
                  >
                    <IconLogout data-icon="inline-start" />
                    Abmelden
                  </Button>
                </div>
              </div>
            </DrawerContent>
          </Drawer>

          <h1 className="text-lg font-semibold absolute left-1/2 -translate-x-1/2">
            Workout Tracker
          </h1>

          <Link href="/profile" aria-label="Profil">
            <Button variant="ghost" size="icon" aria-label="Profil">
              <IconUserCircle />
            </Button>
          </Link>
        </div>
      </div>

      {/* Desktop Navigation */}
      <nav className="hidden md:block border-b bg-background">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex h-16 items-center justify-between">
            <div className="flex items-center gap-8">
              <Link href="/dashboard" className="text-xl font-semibold tracking-tight">
                Workout Tracker
              </Link>

              <div className="flex items-center gap-6 text-sm">
                {navigationLinks.map((link) => {
                  const isActive = pathname === link.href;
                  return (
                    <Link
                      key={link.href}
                      href={link.href}
                      className={cn(
                        'transition-colors hover:text-foreground/80',
                        isActive ? 'text-foreground font-medium' : 'text-muted-foreground'
                      )}
                    >
                      {link.label}
                    </Link>
                  );
                })}
              </div>
            </div>

            <Link href="/profile" aria-label="Profil">
              <Button variant="ghost" size="icon">
                <IconUserCircle className="size-5" />
              </Button>
            </Link>
          </div>
        </div>
      </nav>
    </>
  );
}
