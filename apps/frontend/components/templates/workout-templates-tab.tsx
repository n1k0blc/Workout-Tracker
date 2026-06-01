'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { apiClient } from '@/lib/api';
import { WorkoutTemplate } from '@/types';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
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
import { IconPlus, IconEdit, IconTrash, IconBarbell, IconClock, IconTag } from '@tabler/icons-react';

export default function WorkoutTemplatesTab() {
  const router = useRouter();
  const [templates, setTemplates] = useState<WorkoutTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleteTemplateId, setDeleteTemplateId] = useState<string | null>(null);

  useEffect(() => {
    loadTemplates();
  }, []);

  const loadTemplates = async () => {
    setLoading(true);
    try {
      const data = await apiClient.getWorkoutTemplates();
      setTemplates(data);
    } catch (error) {
      console.error('Failed to load workout templates:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteTemplate = async () => {
    if (!deleteTemplateId) return;

    try {
      await apiClient.deleteWorkoutTemplate(deleteTemplateId);
      setTemplates((prev) => prev.filter((t) => t.id !== deleteTemplateId));
      setDeleteTemplateId(null);
    } catch (error) {
      console.error('Failed to delete template:', error);
      alert('Fehler beim Löschen der Vorlage.');
    }
  };

  const systemTemplates = templates.filter((t) => !t.isCustom);
  const customTemplates = templates.filter((t) => t.isCustom);

  return (
    <div className="space-y-6">
      {/* Header with count */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {systemTemplates.length} System-Vorlagen · {customTemplates.length} Benutzerdefinierte
          Vorlagen
        </p>
        <Button onClick={() => router.push('/templates/new')}>
          <IconPlus className="mr-2 size-4" />
          Neue Vorlage
        </Button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="text-lg text-muted-foreground">Lädt Vorlagen...</div>
        </div>
      ) : (
        <div className="space-y-8">
          {/* System Templates */}
          {systemTemplates.length > 0 && (
            <div>
              <h3 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
                <IconBarbell className="size-5" />
                System-Vorlagen
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {systemTemplates.map((template) => (
                  <TemplateCard key={template.id} template={template} />
                ))}
              </div>
            </div>
          )}

          {/* Custom Templates */}
          <div>
            <h3 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
              <IconTag className="size-5" />
              Benutzerdefinierte Vorlagen
            </h3>
            {customTemplates.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {customTemplates.map((template) => (
                  <TemplateCard
                    key={template.id}
                    template={template}
                    onDelete={() => setDeleteTemplateId(template.id)}
                    onEdit={() => router.push(`/templates/${template.id}/edit`)}
                  />
                ))}
              </div>
            ) : (
              <Card>
                <CardContent className="p-12 text-center">
                  <p className="text-muted-foreground mb-4">Noch keine benutzerdefinierten Vorlagen</p>
                  <p className="text-sm text-muted-foreground">
                    Erstelle Vorlagen aus Blueprints oder abgeschlossenen Workouts
                  </p>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      )}

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!deleteTemplateId} onOpenChange={(open) => !open && setDeleteTemplateId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Vorlage löschen?</AlertDialogTitle>
            <AlertDialogDescription>
              Möchten Sie diese Workout-Vorlage wirklich löschen? Diese Aktion kann nicht
              rückgängig gemacht werden.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Abbrechen</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteTemplate}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Löschen
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

interface TemplateCardProps {
  template: WorkoutTemplate;
  onDelete?: () => void;
  onEdit?: () => void;
}

function TemplateCard({ template, onDelete, onEdit }: TemplateCardProps) {
  return (
    <Card className="hover:shadow-sm transition-shadow">
      <CardContent className="p-5">
        <div className="flex items-start justify-between gap-3 mb-4">
          <h4 className="font-semibold text-foreground text-lg">{template.name}</h4>
          {template.isCustom && (
            <div className="flex gap-1">
              {onEdit && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-8"
                  onClick={onEdit}
                  title="Vorlage bearbeiten"
                >
                  <IconEdit className="size-4" />
                </Button>
              )}
              {onDelete && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                  onClick={onDelete}
                  title="Vorlage löschen"
                >
                  <IconTrash className="size-4" />
                </Button>
              )}
            </div>
          )}
        </div>

        <div className="space-y-1.5 text-sm text-muted-foreground">
          <div className="flex items-center gap-2">
            <IconBarbell className="size-4" />
            <span>
              {template.totalExercises} {template.totalExercises === 1 ? 'Übung' : 'Übungen'}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <IconClock className="size-4" />
            <span>
              {template.totalSets} {template.totalSets === 1 ? 'Satz' : 'Sätze'}
            </span>
          </div>
          {template.recommendedGymName && (
            <div className="flex items-center gap-2">
              <IconTag className="size-4" />
              <span className="truncate">{template.recommendedGymName}</span>
            </div>
          )}
        </div>

        <div className="mt-4 pt-3 border-t">
          {template.isCustom ? (
            <Badge variant="secondary" className="text-xs">Benutzerdefiniert</Badge>
          ) : (
            <Badge variant="outline" className="text-xs">System-Vorlage</Badge>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
