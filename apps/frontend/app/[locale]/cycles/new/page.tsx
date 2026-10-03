'use client';

import { ProtectedRoute } from '@/components/protected-route';
import CycleWizard from '@/components/cycles/cycle-wizard';

export default function NewCyclePage() {
  return (
    <ProtectedRoute>
      <CycleWizard />
    </ProtectedRoute>
  );
}
