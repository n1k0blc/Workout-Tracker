'use client';

import { useState, useEffect } from 'react';
import { apiClient } from '@/lib/api';
import { WorkoutTemplate } from '@/types';
import { Dumbbell, Clock, X } from 'lucide-react';

interface TemplateSelectionModalProps {
  onSelect: (templateId: string, recommendedGymId?: string) => void;
  onClose: () => void;
}

export default function TemplateSelectionModal({
  onSelect,
  onClose,
}: TemplateSelectionModalProps) {
  const [templates, setTemplates] = useState<WorkoutTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'system' | 'custom'>('all');

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
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-2xl w-full max-h-[80vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900">
            Workout-Vorlage wählen
          </h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
            aria-label="Schließen"
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        {/* Filter Tabs */}
        <div className="flex border-b border-gray-200 px-6">
          <button
            onClick={() => setFilter('all')}
            className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
              filter === 'all'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            Alle ({templates.length})
          </button>
          <button
            onClick={() => setFilter('system')}
            className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
              filter === 'system'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            System ({systemTemplates.length})
          </button>
          <button
            onClick={() => setFilter('custom')}
            className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
              filter === 'custom'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            Benutzerdefiniert ({customTemplates.length})
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="text-gray-600">Lädt Vorlagen...</div>
            </div>
          ) : filteredTemplates.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {filteredTemplates.map((template) => (
                <button
                  key={template.id}
                  onClick={() => onSelect(template.id, template.recommendedGymId)}
                  className="text-left bg-gray-50 hover:bg-blue-50 border border-gray-200 hover:border-blue-400 rounded-lg p-4 transition-colors"
                >
                  <div className="flex items-start justify-between mb-2">
                    <h4 className="font-semibold text-gray-900 flex-1">
                      {template.name}
                    </h4>
                    {!template.isCustom && (
                      <span className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded ml-2">
                        System
                      </span>
                    )}
                  </div>
                  <div className="space-y-1 text-sm text-gray-600">
                    <div className="flex items-center gap-2">
                      <Dumbbell className="h-4 w-4" />
                      <span>
                        {template.totalExercises}{' '}
                        {template.totalExercises === 1 ? 'Übung' : 'Übungen'}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Clock className="h-4 w-4" />
                      <span>
                        {template.totalSets}{' '}
                        {template.totalSets === 1 ? 'Satz' : 'Sätze'}
                      </span>
                    </div>
                    {template.recommendedGymName && (
                      <div className="text-xs text-gray-500 mt-2">
                        Empfohlenes Gym: {template.recommendedGymName}
                      </div>
                    )}
                  </div>
                </button>
              ))}
            </div>
          ) : (
            <div className="text-center py-12 text-gray-600">
              Keine Vorlagen gefunden
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-gray-200 p-6">
          <button
            onClick={onClose}
            className="w-full py-2 px-4 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 font-medium"
          >
            Abbrechen
          </button>
        </div>
      </div>
    </div>
  );
}
