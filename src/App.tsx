import { useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { supabase } from './lib/supabase';
import { Auth } from './components/Auth';
import { Layout } from './components/Layout';
import { Dashboard } from './pages/Dashboard';
import { Profile } from './pages/Profile';
import { Friends } from './pages/Friends';
import type { Session } from '@supabase/supabase-js';
import { useTheme } from './hooks/useTheme';

function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  
  // Inicializamos el hook aquí para que todo el documento reciba la clase del tema
  useTheme();

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setIsLoading(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setIsLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  if (isLoading) {
    return (
      <div className="min-h-screen flex justify-center items-center bg-background">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <BrowserRouter>
      <Routes>
        {/* Ruta pública */}
        <Route 
          path="/login" 
          element={!session ? <Auth /> : <Navigate to="/dashboard" replace />} 
        />
        
        {/* Rutas protegidas que usan el Layout principal */}
        <Route 
          path="/" 
          element={session ? <Layout /> : <Navigate to="/login" replace />}
        >
          {/* Redirigir la raíz al dashboard */}
          <Route index element={<Navigate to="/dashboard" replace />} />
          <Route path="dashboard" element={<Dashboard />} />
          <Route path="profile" element={<Profile />} />
          <Route path="friends" element={<Friends />} />
        </Route>

        {/* Catch all para URLs inexistentes */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
