'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { useWorkout } from '@/lib/workout-context';
import {
  Menu,
  X,
  Home,
  Dumbbell,
  RefreshCw,
  ListChecks,
  History,
  BarChart3,
  LogOut,
  UserCircle,
} from 'lucide-react';

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
    pathname === '/login' ||
    pathname === '/register' ||
    pathname?.startsWith('/workout') ||
    activeWorkout
  ) {
    return null;
  }

  const navigationLinks = [
    { href: '/dashboard', label: 'Dashboard', icon: Home },
    { href: '/workout', label: 'Workout', icon: Dumbbell },
    { href: '/cycles', label: 'Zyklen', icon: RefreshCw },
    { href: '/exercises', label: 'Übungen', icon: ListChecks },
    { href: '/history', label: 'Verlauf', icon: History },
    { href: '/analytics', label: 'Analytics', icon: BarChart3 },
  ];

  const handleLogout = async () => {
    await logout();
    setIsOpen(false);
  };

  return (
    <>
      {/* Mobile Header */}
      <div className="md:hidden bg-white shadow-sm sticky top-0 z-40">
        <div className="flex items-center justify-between h-16 px-4">
          <button
            onClick={() => setIsOpen(true)}
            className="p-2 -ml-2 text-gray-600 hover:text-gray-900 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-blue-500 rounded-md"
            aria-label="Menü öffnen"
          >
            <Menu className="h-6 w-6" />
          </button>
          <h1 className="text-lg font-bold text-gray-900 absolute left-1/2 transform -translate-x-1/2">
            Workout Tracker
          </h1>
          <Link
            href="/profile"
            className="p-2 -mr-2 text-gray-600 hover:text-gray-900 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-blue-500 rounded-md"
            aria-label="Profil"
          >
            <UserCircle className="h-6 w-6" />
          </Link>
        </div>
      </div>

      {/* Desktop Navigation */}
      <nav className="hidden md:block bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex">
              <div className="flex-shrink-0 flex items-center">
                <h1 className="text-xl font-bold text-gray-900">
                  Workout Tracker
                </h1>
              </div>
              <div className="hidden sm:ml-6 sm:flex sm:space-x-8">
                {navigationLinks.map((link) => {
                  const isActive = pathname === link.href;
                  return (
                    <Link
                      key={link.href}
                      href={link.href}
                      className={`${
                        isActive
                          ? 'border-blue-500 text-gray-900'
                          : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700'
                      } inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium`}
                    >
                      {link.label}
                    </Link>
                  );
                })}
              </div>
            </div>
            <div className="flex items-center">
              <Link
                href="/profile"
                className="p-2 text-gray-600 hover:text-gray-900 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-blue-500 rounded-md"
                aria-label="Profil"
              >
                <UserCircle className="h-8 w-8" />
              </Link>
            </div>
          </div>
        </div>
      </nav>

      {/* Mobile Menu Overlay */}
      {isOpen && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-black bg-opacity-50 z-40 md:hidden"
            onClick={() => setIsOpen(false)}
          />

          {/* Slide-in Menu */}
          <div className="fixed inset-y-0 left-0 w-64 bg-white shadow-xl z-50 md:hidden transform transition-transform duration-300 ease-in-out">
            <div className="flex flex-col h-full">
              {/* Header */}
              <div className="flex items-center justify-between h-16 px-4 border-b border-gray-200">
                <h2 className="text-lg font-semibold text-gray-900">Menü</h2>
                <button
                  onClick={() => setIsOpen(false)}
                  className="p-2 text-gray-600 hover:text-gray-900 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-blue-500 rounded-md"
                  aria-label="Menü schließen"
                >
                  <X className="h-6 w-6" />
                </button>
              </div>

              {/* Navigation Links */}
              <nav className="flex-1 px-4 py-6 space-y-2 overflow-y-auto">
                {navigationLinks.map((link) => {
                  const Icon = link.icon;
                  const isActive = pathname === link.href;
                  return (
                    <Link
                      key={link.href}
                      href={link.href}
                      className={`${
                        isActive
                          ? 'bg-blue-50 text-blue-600'
                          : 'text-gray-700 hover:bg-gray-50 hover:text-gray-900'
                      } group flex items-center px-3 py-3 text-base font-medium rounded-md transition-colors`}
                    >
                      <Icon
                        className={`${
                          isActive ? 'text-blue-600' : 'text-gray-400 group-hover:text-gray-500'
                        } mr-3 h-6 w-6`}
                      />
                      {link.label}
                    </Link>
                  );
                })}
              </nav>

              {/* User Info & Logout */}
              <div className="border-t border-gray-200 p-4">
                <div className="flex items-center mb-3">
                  <div className="flex-1">
                    <p className="text-sm font-medium text-gray-900 truncate">
                      {user?.email}
                    </p>
                  </div>
                </div>
                <button
                  onClick={handleLogout}
                  className="w-full flex items-center justify-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                >
                  <LogOut className="mr-2 h-4 w-4" />
                  Abmelden
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </>
  );
}
