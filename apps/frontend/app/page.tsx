import Link from 'next/link';

export default function Home() {
  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="max-w-2xl w-full text-center">
        <h1 className="text-5xl font-bold text-gray-900 mb-4">
          Workout Tracker
        </h1>
        <p className="text-xl text-gray-600 mb-8">
          Deine persönliche Workout-Tracking-App für maximalen Trainingserfolg
        </p>
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Link
            href="/login"
            className="inline-flex items-center justify-center px-8 py-3 border border-transparent text-base font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 md:text-lg"
          >
            Anmelden
          </Link>
          <Link
            href="/register"
            className="inline-flex items-center justify-center px-8 py-3 border border-gray-300 text-base font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 md:text-lg"
          >
            Registrieren
          </Link>
        </div>
      </div>
    </div>
  );
}

