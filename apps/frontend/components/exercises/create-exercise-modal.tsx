'use client';

import { useState } from 'react';
import { MuscleGroup, Equipment, Exercise } from '@/types';
import { apiClient } from '@/lib/api';

interface CreateExerciseModalProps {
  onClose: () => void;
  onCreated: (exercise: Exercise) => void;
}

export default function CreateExerciseModal({
  onClose,
  onCreated,
}: CreateExerciseModalProps) {
  const [name, setName] = useState('');
  const [muscleGroup, setMuscleGroup] = useState<MuscleGroup>(MuscleGroup.CHEST);
  const [equipment, setEquipment] = useState<Equipment>(Equipment.DUMBBELL);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!name.trim()) {
      setError('Bitte gib einen Namen ein');
      return;
    }

    setLoading(true);
    try {
      const exercise = await apiClient.createExercise({
        name: name.trim(),
        muscleGroup,
        equipment,
      });
      onCreated(exercise);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Fehler beim Erstellen der Übung');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-md w-full p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">
          Benutzerdefinierte Übung erstellen
        </h3>

        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Name
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="z.B. Incline Dumbbell Press"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              autoFocus
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Muskelgruppe
            </label>
            <select
              value={muscleGroup}
              onChange={(e) => setMuscleGroup(e.target.value as MuscleGroup)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value={MuscleGroup.CHEST}>Brust</option>
              <option value={MuscleGroup.BACK}>Rücken</option>
              <option value={MuscleGroup.SHOULDERS}>Schultern</option>
              <option value={MuscleGroup.BICEPS}>Bizeps</option>
              <option value={MuscleGroup.TRICEPS}>Trizeps</option>
              <option value={MuscleGroup.LEGS}>Beine</option>
              <option value={MuscleGroup.ABS}>Bauch</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Equipment
            </label>
            <select
              value={equipment}
              onChange={(e) => setEquipment(e.target.value as Equipment)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value={Equipment.BARBELL}>Langhantel</option>
              <option value={Equipment.DUMBBELL}>Kurzhantel</option>
              <option value={Equipment.CABLE}>Kabel</option>
              <option value={Equipment.MACHINE}>Maschine</option>
              <option value={Equipment.BODYWEIGHT}>Körpergewicht</option>
              <option value={Equipment.SMITH_MACHINE}>Smith Machine</option>
              <option value={Equipment.EZ_BAR}>SZ-Stange</option>
            </select>
          </div>

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="flex-1 py-2 px-4 border border-gray-300 text-gray-700 font-medium rounded-lg hover:bg-gray-50 disabled:opacity-50"
            >
              Abbrechen
            </button>
            <button
              type="submit"
              disabled={loading || !name.trim()}
              className="flex-1 py-2 px-4 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              {loading ? 'Wird erstellt...' : 'Erstellen'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
