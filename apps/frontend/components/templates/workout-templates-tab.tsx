'use client';

import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { useRouter } from '@/i18n/navigation';
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
import { IconPlus, IconTrash, IconBarbell, IconClock, IconTag } from '@tabler/icons-react';

export default function WorkoutTemplatesTab() {
  const router = useRouter();
  const t = useTranslations('WorkoutTemplatesTab');
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
      alert(t('deleteFailed'));
    }
  };

  const systemTemplates = templates.filter((t) => !t.isCustom);
  const customTemplates = templates.filter((t) => t.isCustom);

  return (
    <div className="space-y-6">
      {/* Header with count */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {t('counts', { system: systemTemplates.length, custom: customTemplates.length })}
        </p>
        <Button onClick={() => router.push('/templates/new')}>
          <IconPlus className="mr-2 size-4" />
          {t('newTemplate')}
        </Button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="text-lg text-muted-foreground">{t('loading')}</div>
        </div>
      ) : (
        <div className="space-y-8">
          {/* System Templates */}
          {systemTemplates.length > 0 && (
            <div>
              <h3 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
                <IconBarbell className="size-5" />
                {t('systemTemplates')}
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {systemTemplates.map((template) => (
                  <TemplateCard
                    key={template.id}
                    template={template}
                    onClick={() => router.push(`/templates/${template.id}/edit`)}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Custom Templates */}
          <div>
            <h3 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
              <IconTag className="size-5" />
              {t('customTemplates')}
            </h3>
            {customTemplates.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {customTemplates.map((template) => (
                  <TemplateCard
                    key={template.id}
                    template={template}
                    onDelete={() => setDeleteTemplateId(template.id)}
                    onClick={() => router.push(`/templates/${template.id}/edit`)}
                  />
                ))}
              </div>
            ) : (
              <Card>
                <CardContent className="p-12 text-center">
                  <p className="text-muted-foreground mb-4">{t('customEmptyTitle')}</p>
                  <p className="text-sm text-muted-foreground">
                    {t('customEmptyHint')}
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
            <AlertDialogTitle>{t('deleteDialog.title')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('deleteDialog.description')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('deleteDialog.cancel')}</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteTemplate}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {t('deleteDialog.confirm')}
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
  onClick?: () => void;
}

function TemplateCard({ template, onDelete, onClick }: TemplateCardProps) {
  const t = useTranslations('WorkoutTemplatesTab');
  return (
    <Card 
      className={`hover:shadow-sm transition-shadow ${onClick ? 'cursor-pointer' : ''}`}
      onClick={onClick}
    >
      <CardContent className="p-5">
        <div className="flex items-start justify-between gap-3 mb-4">
          <h4 className="font-semibold text-foreground text-lg">{template.name}</h4>
          {template.isCustom && (
            <div className="flex gap-1">
              {onDelete && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                  onClick={(e) => {
                    e.stopPropagation();
                    onDelete();
                  }}
                  title={t('card.delete')}
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
              {t('card.exerciseCount', { count: template.totalExercises ?? 0 })}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <IconClock className="size-4" />
            <span>
              {t('card.setCount', { count: template.totalSets ?? 0 })}
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
            <Badge variant="secondary" className="text-xs">{t('card.custom')}</Badge>
          ) : (
            <Badge variant="outline" className="text-xs">{t('card.system')}</Badge>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
