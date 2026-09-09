'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { ProtectedRoute } from '@/components/protected-route';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import ExercisesTab from '@/components/templates/exercises-tab';
import WorkoutTemplatesTab from '@/components/templates/workout-templates-tab';
import FoodsTab from '@/components/templates/foods-tab';
import MealsTab from '@/components/templates/meals-tab';

/** The tabs, in URL form. `?tab=` makes each one linkable and, more to the point, lets an
 *  editor page send you back to the tab you left rather than to Übungen. */
const TABS = ['exercises', 'templates', 'foods', 'meals'] as const;
type TabId = (typeof TABS)[number];

export default function TemplatesPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const requested = searchParams.get('tab');
  const tab: TabId = TABS.includes(requested as TabId) ? (requested as TabId) : 'exercises';

  return (
    <ProtectedRoute>
      <div className="min-h-screen bg-background">
        <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
          <div className="px-4 py-6 sm:px-0 space-y-6">
            {/* Header */}
            <div>
              <h2 className="text-2xl font-bold text-foreground">Vorlagen</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Verwalte Übungen, Workouts und Ernährung
              </p>
            </div>

            {/* Tabs */}
            <Tabs
              value={tab}
              onValueChange={(next) =>
                // `replace`, not `push`: switching tabs should not build up history that the
                // back button then has to walk through.
                router.replace(next === 'exercises' ? '/templates' : `/templates?tab=${next}`)
              }
              className="space-y-4"
            >
              <TabsList
                variant="line"
                className="w-full justify-start gap-1 overflow-x-auto border-b pb-0 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
              >
                <TabsTrigger value="exercises" className="shrink-0">
                  Übungen
                </TabsTrigger>
                <TabsTrigger value="templates" className="shrink-0">
                  Workouts
                </TabsTrigger>
                <TabsTrigger value="foods" className="shrink-0">
                  Lebensmittel
                </TabsTrigger>
                <TabsTrigger value="meals" className="shrink-0">
                  Mahlzeiten
                </TabsTrigger>
              </TabsList>

              <TabsContent value="exercises" className="mt-0">
                <ExercisesTab />
              </TabsContent>

              <TabsContent value="templates" className="mt-0">
                <WorkoutTemplatesTab />
              </TabsContent>

              <TabsContent value="foods" className="mt-0">
                <FoodsTab />
              </TabsContent>

              <TabsContent value="meals" className="mt-0">
                <MealsTab />
              </TabsContent>
            </Tabs>
          </div>
        </main>
      </div>
    </ProtectedRoute>
  );
}
