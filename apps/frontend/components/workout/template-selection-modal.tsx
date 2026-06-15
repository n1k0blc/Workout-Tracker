'use client';

import { useState, useEffect } from 'react';
import { apiClient } from '@/lib/api';
import { WorkoutTemplate } from '@/types';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { IconDumbbell, IconClock } from '@tabler/icons-react';

interface TemplateSelectionModalProps {
  onSelect: (templateId: string, recommendedGymId?: string) => void;
  onClose: () => void;
  /** When provided, the modal acts in "selection + confirm" mode (used for past workout tracking) */
  onProceedToDetails?: (templateId: string, recommendedGymId?: string) => void;
}

export default function TemplateSelectionModal({
  onSelect,
  onClose,
  onProceedToDetails,
}: TemplateSelectionModalProps) {
  const [templates, setTemplates] = useState<WorkoutTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'system' | 'custom'>('all');
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null);

  useEffect(() => {
    loadTemplates();
  }, []);

  const loadTemplates = async () => {
    setLoading(true);
    try {
      const data = await apiClient.getWorkoutTemplates();
      setTemplates(data);
    } catch (error) {
      console.error('Failed to load templates:', error);
    } finally {
      setLoading(false);
    }
  };

  const systemTemplates = templates.filter((t) => !t.isCustom);
  const customTemplates = templates.filter((t) => t.isCustom);

  const filteredTemplates =
    filter === 'system'
      ? systemTemplates
      : filter === 'custom'
      ? customTemplates
      : templates;

  return (
    <Dialog open={true} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-2xl max-h-[80vh] flex flex-col p-0">
        {/* Header */}
        <DialogHeader className="px-6 pt-6 pb-4 border-b">
          <DialogTitle>Workout-Vorlage wählen</DialogTitle>
        </DialogHeader>

        {/* Filter Tabs */}
        <div className="flex border-b px-6">
          <button
            onClick={() => setFilter('all')}
            className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
              filter === 'all'
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            Alle ({templates.length})
          </button>
          <button
            onClick={() => setFilter('system')}
            className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
              filter === 'system'
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            System ({systemTemplates.length})
          </button>
          <button
            onClick={() => setFilter('custom')}
            className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
              filter === 'custom'
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            Benutzerdefiniert ({customTemplates.length})
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="text-muted-foreground">Lädt Vorlagen...</div>
            </div>
          ) : filteredTemplates.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {filteredTemplates.map((template) => {
                const isSelected = selectedTemplateId === template.id;

                return (
                  <button
                    key={template.id}
                    onClick={() => {
                      if (onProceedToDetails) {
                        setSelectedTemplateId(template.id);
                      } else {
                        onSelect(template.id, template.recommendedGymId);
                      }
                    }}
                    className={`text-left border rounded-lg p-4 transition-colors hover:border-primary hover:bg-muted/50 text-left ${
                      isSelected ? 'border-primary ring-2 ring-primary ring-offset-2' : ''
                    }`}
                  >
                    <div className="flex items-start justify-between mb-2">
                      <h4 className="font-semibold text-foreground flex-1 pr-2">
                        {template.name}
                      </h4>
                      {!template.isCustom && (
                        <Badge variant="secondary" className="text-xs shrink-0">
                          System
                        </Badge>
                      )}
                    </div>
                    <div className="space-y-1 text-sm text-muted-foreground">
                      <div className="flex items-center gap-2">
                        <IconDumbbell className="size-4" />
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
                        <div className="text-xs text-muted-foreground mt-2">
                          Empfohlenes Gym: {template.recommendedGymName}
                        </div>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-12 text-muted-foreground">
              Keine Vorlagen gefunden
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t p-6">
          {onProceedToDetails ? (
            <div className="flex gap-3">
              <Button variant="outline" onClick={onClose} className="flex-1">
                Zurück
              </Button>
              <Button
                onClick={() => {
                  if (selectedTemplateId) {
                    const template = filteredTemplates.find(t => t.id === selectedTemplateId);
                    if (template) {
                      onProceedToDetails(template.id, template.recommendedGymId);
                    }
                  }
                }}
                disabled={!selectedTemplateId}
                className="flex-1"
              >
                Weiter zu Workout Details
              </Button>
            </div>
          ) : (
            <Button variant="outline" onClick={onClose} className="w-full">
              Abbrechen
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
