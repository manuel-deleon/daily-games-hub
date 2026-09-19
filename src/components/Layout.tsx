import { useEffect, useState } from 'react';
import { Outlet, useNavigate, Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useTheme } from '../hooks/useTheme';
import { LogOut, Sun, Moon, Flame, User as UserIcon, Users, Bell } from 'lucide-react';
import type { Profile } from '../types';

export function Layout() {
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();
  const [profile, setProfile] = useState<Profile | null>(null);
  
  // Toast Notification State
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  useEffect(() => {
    async function loadProfile() {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        navigate('/login');
        return;
      }

      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', session.user.id)
        .single();
      
      if (!error && data) {
        setProfile(data);
      }
    }

    loadProfile();
  }, [navigate]);

  // Supabase Realtime Subscription for Followers
  useEffect(() => {
    if (!profile) return;

    const channel = supabase
      .channel('public:friendships')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'friendships',
          filter: `friend_id=eq.${profile.id}`,
        },
        async (payload) => {
          // Buscar el nombre del usuario que nos acaba de seguir
          const { data } = await supabase
            .from('profiles')
            .select('username')
            .eq('id', payload.new.user_id)
            .single();

          if (data) {
            setToastMessage(`¡${data.username} comenzó a seguirte!`);
            // Ocultar el toast después de 5 segundos
            setTimeout(() => setToastMessage(null), 5000);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [profile]);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    navigate('/login');
  };

  return (
    <div className="min-h-screen bg-background text-foreground transition-colors duration-300 relative">
      
      {/* Toast Notification UI */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 animate-in slide-in-from-bottom-5 fade-in duration-300">
          <div className="bg-primary text-primary-foreground px-6 py-4 rounded-xl shadow-2xl flex items-center space-x-3">
            <div className="bg-white/20 p-2 rounded-full">
              <Bell className="w-5 h-5 text-white" />
            </div>
            <p className="font-medium">{toastMessage}</p>
          </div>
        </div>
      )}

      {/* Top Navbar */}
      <nav className="border-b border-border bg-card sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16 items-center">
            
            {/* Left side: Logo/Title */}
            <div className="flex-shrink-0 flex items-center">
              <Link to="/dashboard" className="text-xl font-bold text-primary hover:opacity-80 transition-opacity">
                DailyPlay
              </Link>
            </div>

            {/* Right side: User stats & Actions */}
            <div className="flex items-center space-x-4">
              
              <Link to="/friends" className="text-muted-foreground hover:text-foreground transition-colors p-2" title="Comunidad / Amigos">
                <Users className="w-5 h-5" />
              </Link>

              {/* Global Streak */}
              {profile && (
                <div className="flex items-center text-orange-500 font-bold bg-orange-500/10 px-3 py-1.5 rounded-full" title="Racha Global">
                  <Flame className="w-5 h-5 mr-1" />
                  <span>{profile.global_streak}</span>
                </div>
              )}

              {/* User Profile info */}
              {profile && (
                <Link to="/profile" className="flex items-center space-x-2 hidden sm:flex hover:opacity-80 transition-opacity cursor-pointer">
                  <div className="text-sm text-right">
                    <p className="font-medium text-foreground">{profile.username}</p>
                  </div>
                  <div className="h-9 w-9 rounded-full bg-muted border border-border flex items-center justify-center overflow-hidden" title="Mi Perfil">
                    {profile.avatar_url ? (
                      <img src={profile.avatar_url} alt="Avatar" className="h-full w-full object-cover" />
                    ) : (
                      <UserIcon className="w-5 h-5 text-muted-foreground" />
                    )}
                  </div>
                </Link>
              )}

              {/* Theme Toggle */}
              <button
                onClick={toggleTheme}
                className="p-2 rounded-full hover:bg-muted text-muted-foreground transition-colors"
                aria-label="Alternar tema"
              >
                {theme === 'light' ? <Moon className="w-5 h-5" /> : <Sun className="w-5 h-5" />}
              </button>

              {/* Logout */}
              <button
                onClick={handleSignOut}
                className="p-2 rounded-full hover:bg-destructive/10 text-destructive transition-colors"
                title="Cerrar sesión"
              >
                <LogOut className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>
      </nav>

      {/* Main Content Area */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Outlet />
      </main>
    </div>
  );
}
