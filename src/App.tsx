import { useEffect, useState } from 'react';
import { supabase } from './lib/supabase';
import { Auth } from './components/Auth';
import type { Session } from '@supabase/supabase-js';

function App() {
  const [session, setSession] = useState<Session | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    return () => subscription.unsubscribe();
  }, []);

  if (!session) {
    return <Auth />;
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-4">
      <div className="bg-white p-8 rounded-xl shadow-lg border border-gray-100 max-w-md w-full text-center space-y-4">
        <h1 className="text-2xl font-bold text-gray-900">¡Bienvenido a Daily Games Hub!</h1>
        <p className="text-gray-600">Has iniciado sesión exitosamente.</p>
        <p className="text-sm font-medium text-blue-600 bg-blue-50 p-2 rounded-lg break-all">
          {session.user.email}
        </p>
        <button
          onClick={() => supabase.auth.signOut()}
          className="mt-6 w-full py-2 px-4 border border-transparent text-sm font-medium rounded-lg text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 transition-colors"
        >
          Cerrar Sesión
        </button>
      </div>
    </div>
  );
}

export default App;
