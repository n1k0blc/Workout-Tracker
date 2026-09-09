'use client';

import { use } from 'react';
import MealEditorScreen from '@/components/templates/meal-editor-screen';

export default function EditMealPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return <MealEditorScreen mealId={id} />;
}
