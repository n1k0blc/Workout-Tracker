'use client';

import { ProtectedRoute } from '@/components/protected-route';
import { NewCycleGuard } from '@/components/cycles/new-cycle-guard';
import CycleWizard from '@/components/cycles/cycle-wizard';

export default function NewCyclePage() {
  return (
    <ProtectedRoute>
      <NewCycleGuard>
        <CycleWizard />
      </NewCycleGuard>
    </ProtectedRoute>
  );
}
