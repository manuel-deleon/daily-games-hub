import { useEffect, useState } from 'react';
import { supabase } from './lib/supabase';
import { Auth } from './components/Auth';
import type { Session } from '@supabase/supabase-js';
import { useTheme } from './hooks/useTheme';
import { Sun, Moon } from 'lucide-react';

function App() {
  const [session, setSession] = useState<Session | null>(null);
  const { theme, toggleTheme } = useTheme();

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
    <div className="min-h-screen flex flex-col items-center justify-center p-4 relative">
      <button 
        onClick={toggleTheme} 
        className="absolute top-6 right-6 p-2 rounded-full bg-card border border-border shadow-sm text-foreground hover:bg-muted transition-colors"
        aria-label="Alternar tema"
      >
        {theme === 'light' ? <Moon className="w-5 h-5" /> : <Sun className="w-5 h-5" />}
      </button>

      <div className="bg-card p-8 rounded-xl shadow-lg border border-border max-w-md w-full text-center space-y-4">
        <h1 className="text-2xl font-bold text-foreground">¡Bienvenido a Daily Games Hub!</h1>
        <p className="text-muted-foreground">Has iniciado sesión exitosamente.</p>
        <p className="text-sm font-medium text-primary bg-primary/10 p-2 rounded-lg break-all">
          {session.user.email}
        </p>
        <button
          onClick={() => supabase.auth.signOut()}
          className="mt-6 w-full py-2 px-4 border border-transparent text-sm font-medium rounded-lg text-destructive-foreground bg-destructive hover:opacity-90 transition-colors"
        >
          Cerrar Sesión
        </button>
      </div>
    </div>
  );
}

export default App;
