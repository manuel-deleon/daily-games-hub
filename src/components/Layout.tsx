import { useEffect, useState } from 'react';
import { Outlet, useNavigate, Link, useLocation } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { Flame, User as UserIcon, Users, Bell, Settings, Home, Gamepad2 } from 'lucide-react';
import type { Profile } from '../types';
import { SettingsModal } from './SettingsModal';

export function Layout() {
  const navigate = useNavigate();
  const location = useLocation();
  const [profile, setProfile] = useState<Profile | null>(null);
  
  // Toast Notification State
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  
  // Settings Modal State
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

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
          const { data } = await supabase
            .from('profiles')
            .select('username')
            .eq('id', payload.new.user_id)
            .single();

          if (data) {
            setToastMessage(`¡${data.username} comenzó a seguirte!`);
            setTimeout(() => setToastMessage(null), 5000);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [profile]);

  const isActive = (path: string) => location.pathname.startsWith(path);

  return (
    <div className="min-h-screen bg-background text-foreground transition-colors duration-300 relative pb-20 sm:pb-0">
      
      {/* Toast Notification UI */}
      {toastMessage && (
        <div className="fixed bottom-24 sm:bottom-6 right-6 z-50 animate-in slide-in-from-bottom-5 fade-in duration-300">
          <div className="bg-primary text-primary-foreground px-6 py-4 rounded-xl shadow-2xl flex items-center space-x-3">
            <div className="bg-white/20 p-2 rounded-full">
              <Bell className="w-5 h-5 text-white" />
            </div>
            <p className="font-medium">{toastMessage}</p>
          </div>
        </div>
      )}

      <SettingsModal isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} />

      {/* Top Navbar */}
      <nav className="border-b border-border bg-card sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16 items-center">
            
            {/* Left side: Logo */}
            <div className="flex-shrink-0 flex items-center">
              <Link to="/dashboard" className="flex items-center space-x-2 text-xl font-extrabold text-foreground hover:opacity-80 transition-opacity tracking-tight">
                <Gamepad2 className="w-6 h-6 text-primary" />
                <span>DailyPlay</span>
              </Link>
            </div>

            {/* Desktop Navigation (Hidden on Mobile) */}
            <div className="hidden sm:flex items-center space-x-8">
              <Link 
                to="/dashboard" 
                className={`font-semibold flex items-center space-x-2 transition-colors ${isActive('/dashboard') ? 'text-primary' : 'text-muted-foreground hover:text-foreground'}`}
              >
                <Home className="w-4 h-4" />
                <span>Dashboard</span>
              </Link>
              <Link 
                to="/friends" 
                className={`font-semibold flex items-center space-x-2 transition-colors ${isActive('/friends') ? 'text-primary' : 'text-muted-foreground hover:text-foreground'}`}
              >
                <Users className="w-4 h-4" />
                <span>Comunidad</span>
              </Link>
            </div>

            {/* Right side: User stats & Actions */}
            <div className="flex items-center space-x-4">
              {/* Global Streak (Visible on Desktop) */}
              {profile && (
                <div className="hidden sm:flex items-center text-orange-500 font-bold bg-orange-500/10 px-3 py-1.5 rounded-full" title="Racha Global">
                  <Flame className="w-5 h-5 mr-1.5" />
                  <span>{profile.global_streak}</span>
                </div>
              )}

              <button
                onClick={() => setIsSettingsOpen(true)}
                className="p-2 rounded-full hover:bg-muted text-muted-foreground transition-colors"
                title="Configuración"
              >
                <Settings className="w-5 h-5" />
              </button>

              {/* User Profile Avatar */}
              {profile && (
                <Link to="/profile" className="h-9 w-9 rounded-full bg-muted border border-border flex items-center justify-center overflow-hidden hover:ring-2 hover:ring-primary hover:ring-offset-2 hover:ring-offset-background transition-all" title="Mi Perfil">
                  {profile.avatar_url ? (
                    <img src={profile.avatar_url} alt="Avatar" className="h-full w-full object-cover" />
                  ) : (
                    <UserIcon className="w-5 h-5 text-muted-foreground" />
                  )}
                </Link>
              )}
            </div>
          </div>
        </div>
      </nav>

      {/* Main Content Area */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
        <Outlet />
      </main>

      {/* Bottom Navigation Bar (Mobile Only) */}
      <div className="sm:hidden fixed bottom-0 left-0 right-0 z-40 bg-card border-t border-border pb-safe">
        <div className="flex justify-around items-center h-16 px-4">
          <Link 
            to="/dashboard" 
            className={`flex flex-col items-center justify-center w-full h-full space-y-1 ${isActive('/dashboard') ? 'text-primary' : 'text-muted-foreground hover:text-foreground'}`}
          >
            <Home className="w-5 h-5" />
            <span className="text-[10px] font-semibold">Inicio</span>
          </Link>
          <Link 
            to="/friends" 
            className={`flex flex-col items-center justify-center w-full h-full space-y-1 ${isActive('/friends') ? 'text-primary' : 'text-muted-foreground hover:text-foreground'}`}
          >
            <Users className="w-5 h-5" />
            <span className="text-[10px] font-semibold">Comunidad</span>
          </Link>
          <Link 
            to="/profile" 
            className={`flex flex-col items-center justify-center w-full h-full space-y-1 ${isActive('/profile') ? 'text-primary' : 'text-muted-foreground hover:text-foreground'}`}
          >
            <UserIcon className="w-5 h-5" />
            <span className="text-[10px] font-semibold">Perfil</span>
          </Link>
        </div>
      </div>

    </div>
  );
}
