'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { apiClient } from '@/lib/api';
import { WorkoutTemplate } from '@/types';
import { Plus, Edit, Trash2, Dumbbell, Clock, Tag } from 'lucide-react';

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
        <p className="text-sm text-gray-600">
          {systemTemplates.length} System-Vorlagen · {customTemplates.length} Benutzerdefinierte
          Vorlagen
        </p>
        <button
          onClick={() => router.push('/templates/new')}
          className="px-4 py-2 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2"
        >
          <Plus className="h-5 w-5" />
          Neue Vorlage
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="text-lg text-gray-600">Lädt Vorlagen...</div>
        </div>
      ) : (
        <div className="space-y-8">
          {/* System Templates */}
          {systemTemplates.length > 0 && (
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <Dumbbell className="h-5 w-5" />
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
            <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <Tag className="h-5 w-5" />
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
              <div className="bg-white rounded-lg shadow-sm p-12 text-center">
                <p className="text-gray-600 mb-4">Noch keine benutzerdefinierten Vorlagen</p>
                <p className="text-sm text-gray-500">
                  Erstelle Vorlagen aus Blueprints oder abgeschlossenen Workouts
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteTemplateId && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg p-6 max-w-md w-full">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Vorlage löschen?</h3>
            <p className="text-sm text-gray-600 mb-6">
              Möchten Sie diese Workout-Vorlage wirklich löschen? Diese Aktion kann nicht
              rückgängig gemacht werden.
            </p>
            <div className="flex gap-3">
              <button
                onClick={handleDeleteTemplate}
                className="flex-1 bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 font-medium transition-colors"
              >
                Löschen
              </button>
              <button
                onClick={() => setDeleteTemplateId(null)}
                className="flex-1 bg-gray-200 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-300 font-medium transition-colors"
              >
                Abbrechen
              </button>
            </div>
          </div>
        </div>
      )}
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
    <div className="bg-white rounded-lg shadow-sm p-5 hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between gap-3 mb-4">
        <h4 className="font-semibold text-gray-900 text-lg">{template.name}</h4>
        {template.isCustom && (
          <div className="flex gap-2">
            {onEdit && (
              <button
                onClick={onEdit}
                className="text-blue-600 hover:text-blue-800 transition-colors"
                title="Vorlage bearbeiten"
              >
                <Edit className="h-4 w-4" />
              </button>
            )}
            {onDelete && (
              <button
                onClick={onDelete}
                className="text-red-600 hover:text-red-800 transition-colors"
                title="Vorlage löschen"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            )}
          </div>
        )}
      </div>

      <div className="space-y-2 text-sm text-gray-600">
        <div className="flex items-center gap-2">
          <Dumbbell className="h-4 w-4" />
          <span>
            {template.totalExercises} {template.totalExercises === 1 ? 'Übung' : 'Übungen'}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <Clock className="h-4 w-4" />
          <span>
            {template.totalSets} {template.totalSets === 1 ? 'Satz' : 'Sätze'}
          </span>
        </div>
        {template.recommendedGymName && (
          <div className="flex items-center gap-2">
            <Tag className="h-4 w-4" />
            <span className="truncate">{template.recommendedGymName}</span>
          </div>
        )}
      </div>

      {!template.isCustom && (
        <div className="mt-4 pt-3 border-t border-gray-100">
          <span className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded">
            System-Vorlage
          </span>
        </div>
      )}

      {template.isCustom && (
        <div className="mt-4 pt-3 border-t border-gray-100">
          <span className="text-xs bg-purple-100 text-purple-800 px-2 py-1 rounded">
            Benutzerdefiniert
          </span>
        </div>
      )}
    </div>
  );
}
