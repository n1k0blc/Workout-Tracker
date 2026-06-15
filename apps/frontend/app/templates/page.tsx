'use client';

import { useState } from 'react';
import ExercisesTab from '@/components/templates/exercises-tab';
import WorkoutTemplatesTab from '@/components/templates/workout-templates-tab';

type TabType = 'exercises' | 'templates';

export default function TemplatesPage() {
  const [activeTab, setActiveTab] = useState<TabType>('exercises');

  return (
    <div className="max-w-7xl mx-auto px-4 py-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Vorlagen</h1>
        <p className="mt-2 text-sm text-gray-600">
          Verwalte Übungen und Workout-Vorlagen
        </p>
      </div>

      {/* Tab Navigation */}
      <div className="bg-white rounded-lg shadow-sm">
        <div className="border-b border-gray-200">
          <nav className="flex -mb-px">
            <button
              onClick={() => setActiveTab('exercises')}
              className={`px-6 py-3 text-sm font-medium border-b-2 transition-colors ${
                activeTab === 'exercises'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              Übungen
            </button>
            <button
              onClick={() => setActiveTab('templates')}
              className={`px-6 py-3 text-sm font-medium border-b-2 transition-colors ${
                activeTab === 'templates'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              Workout-Vorlagen
            </button>
          </nav>
        </div>

        {/* Tab Content */}
        <div className="p-6">
          {activeTab === 'exercises' && <ExercisesTab />}
          {activeTab === 'templates' && <WorkoutTemplatesTab />}
        </div>
      </div>
    </div>
  );
}
