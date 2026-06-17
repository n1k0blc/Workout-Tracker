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
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';

export function MobileNav() {
  const [isOpen, setIsOpen] = useState(false);
  const pathname = usePathname();
  const { user, logout } = useAuth();
  const { activeWorkout } = useWorkout();

  const getUserInitial = () => {
    if (user?.firstName) return user.firstName[0].toUpperCase();
    if (user?.email) return user.email[0].toUpperCase();
    return 'U';
  };

  // Close menu when route changes (async to avoid sync setState-in-effect cascade warnings)
  useEffect(() => {
    const id = setTimeout(() => setIsOpen(false), 0);
    return () => clearTimeout(id);
  }, [pathname]);

  // Don't show navigation on auth pages, the active workout screen (live or past tracking),
  // or when there is a real active (IN_PROGRESS) workout session.
  // Note: completed workouts loaded into context for history edit (via setActiveWorkoutDirectly)
  // should NOT hide the main site header — they are for viewing/editing historical data.
  if (
    pathname === '/' ||
    pathname === '/login' ||
    pathname === '/register' ||
    pathname?.startsWith('/workout') ||
    (activeWorkout && activeWorkout.status === 'IN_PROGRESS')
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
                className="md:hidden h-12 w-12"
                aria-label="Menü öffnen"
              >
                <IconMenu2 className="size-8" />
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
            <Button variant="ghost" size="icon" className="rounded-full h-12 w-12" aria-label="Profil">
              <Avatar className="h-10 w-10">
                <AvatarFallback className="text-sm">
                  {getUserInitial()}
                </AvatarFallback>
              </Avatar>
            </Button>
          </Link>
        </div>
      </div>

      {/* Desktop Navigation */}
      <nav className="hidden md:block border-b bg-background sticky top-0 z-40">
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
              <Button variant="ghost" size="icon" className="rounded-full">
                <Avatar className="h-8 w-8">
                  <AvatarFallback className="text-xs">
                    {getUserInitial()}
                  </AvatarFallback>
                </Avatar>
              </Button>
            </Link>
          </div>
        </div>
      </nav>
    </>
  );
}
