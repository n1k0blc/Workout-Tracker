'use client';

import { type ComponentProps, useCallback, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { useWorkout } from '@/lib/workout-context';
import { Button } from '@/components/ui/button';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

type LogoutButtonProps = Omit<ComponentProps<typeof Button>, 'onClick'> & {
  /** Fired just before the confirm prompt opens. The mobile nav passes this to
   *  close its drawer, so the prompt is not stacked on top of another modal. */
  onRequestConfirm?: () => void;
};

/**
 * The user-initiated logout button. With a live workout running it asks first
 * (issue #133) -- exposing the navigation put logout two taps from a session.
 * A forced logout (after a password change) calls `logout()` directly and never
 * reaches this. The draft is namespaced per user (#127), so a confirmed logout
 * only interrupts the session; it resumes on the next sign-in with that account.
 */
export function LogoutButton({ children, onRequestConfirm, ...props }: LogoutButtonProps) {
  const router = useRouter();
  const { logout } = useAuth();
  const { activeWorkout, isPastWorkout } = useWorkout();
  const [confirmOpen, setConfirmOpen] = useState(false);

  const hasLiveWorkout = !!activeWorkout && !isPastWorkout;

  const runLogout = useCallback(async () => {
    await logout(); // best-effort client-side, never rejects
    router.push('/login');
  }, [logout, router]);

  return (
    <>
      <Button
        {...props}
        onClick={() => {
          if (hasLiveWorkout) {
            onRequestConfirm?.();
            setConfirmOpen(true);
          } else {
            void runLogout();
          }
        }}
      >
        {children}
      </Button>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Laufendes Workout</AlertDialogTitle>
            <AlertDialogDescription>
              Du hast ein laufendes Workout mit noch nicht gespeicherten Sätzen.
              Meldest du dich ab, wird die Sitzung unterbrochen — fortsetzen kannst du
              sie nur auf diesem Gerät mit demselben Konto.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Abbrechen</AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={() => void runLogout()}>
              Abmelden
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
