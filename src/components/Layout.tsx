import { useEffect } from 'react';
import { Outlet, useNavigate, Link, useLocation } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { Flame, User as UserIcon, Users, Home, Shield, Lightbulb, Megaphone } from 'lucide-react';
import type { Profile } from '../types';


export function Layout() {
  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();

  // Fetch profile with React Query (cached)
  const { data: profile } = useQuery<Profile | null>({
    queryKey: ['profile'],
    queryFn: async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        navigate('/login');
        return null;
      }

      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', session.user.id)
        .single();
      
      if (error) return null;
      return data;
    },
  });

  // Listen for profileUpdated events to invalidate cache
  useEffect(() => {
    const handleProfileUpdated = () => {
      queryClient.invalidateQueries({ queryKey: ['profile'] });
    };
    window.addEventListener('profileUpdated', handleProfileUpdated);
    return () => window.removeEventListener('profileUpdated', handleProfileUpdated);
  }, [queryClient]);

  const isActive = (path: string) => location.pathname.startsWith(path);

  return (
    <div className="min-h-screen bg-background text-foreground transition-colors duration-300 relative pb-20 sm:pb-0">

      {/* Top Navbar */}
      <nav className="border-b border-border bg-card sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16 items-center">
            
            <div className="flex-shrink-0 flex items-center">
              <Link to="/dashboard" className="flex items-center hover:opacity-80 transition-opacity">
                <img src="/pwa-192x192.png" alt="App Logo" className="w-10 h-10 rounded-xl shadow-sm" />
              </Link>
            </div>

            {/* Desktop Navigation (Hidden on Mobile) */}
            <div className="hidden sm:flex items-center space-x-8">
              <Link 
                to="/dashboard" 
                className={`font-semibold flex items-center space-x-2 transition-colors ${isActive('/dashboard') ? 'text-primary' : 'text-muted-foreground hover:text-foreground'}`}
              >
                <Home className="w-4 h-4" />
                <span>{'Dashboard'}</span>
              </Link>
              <Link 
                to="/friends" 
                className={`font-semibold flex items-center space-x-2 transition-colors ${isActive('/friends') ? 'text-primary' : 'text-muted-foreground hover:text-foreground'}`}
              >
                <Users className="w-4 h-4" />
                <span>{'Community'}</span>
              </Link>
              <Link 
                to="/suggestions" 
                className={`font-semibold flex items-center space-x-2 transition-colors ${isActive('/suggestions') ? 'text-primary' : 'text-muted-foreground hover:text-foreground'}`}
              >
                <Lightbulb className="w-4 h-4" />
                <span>{'Feedback'}</span>
              </Link>
              <Link 
                to="/updates" 
                className={`font-semibold flex items-center space-x-2 transition-colors ${isActive('/updates') ? 'text-primary' : 'text-muted-foreground hover:text-foreground'}`}
              >
                <Megaphone className="w-4 h-4" />
                <span>{'Updates'}</span>
              </Link>
              {profile?.is_admin && (
                <Link 
                  to="/admin" 
                  className={`font-semibold flex items-center space-x-2 transition-colors ${isActive('/admin') ? 'text-primary' : 'text-muted-foreground hover:text-foreground'}`}
                >
                  <Shield className="w-4 h-4" />
                  <span>Admin</span>
                </Link>
              )}
            </div>

            {/* Right side: User stats & Actions */}
            <div className="flex items-center space-x-4">
              {/* Global Streak */}
              {profile && (
                <div className="flex items-center font-bold px-2 py-1.5 rounded-full" style={{ color: '#D4A336' }} title={"Global Streak"}>
                  <Flame className="w-5 h-5 mr-1.5" />
                  <span>{profile.global_streak}</span>
                </div>
              )}

              {/* User Profile Avatar */}
              {profile && (
                <Link to="/profile" className="h-9 w-9 rounded-full bg-muted border border-border flex items-center justify-center overflow-hidden hover:ring-2 hover:ring-primary hover:ring-offset-2 hover:ring-offset-background transition-all" title={"My Profile"}>
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
        <div className="flex justify-around items-center h-16 px-1 sm:px-4">
          <Link 
            to="/dashboard" 
            className={`flex flex-col items-center justify-center w-full h-full space-y-1 ${isActive('/dashboard') ? 'text-primary' : 'text-muted-foreground hover:text-foreground'}`}
          >
            <Home className="w-5 h-5" />
            <span className="text-[10px] font-semibold">{'Home'}</span>
          </Link>
          <Link 
            to="/friends" 
            className={`flex flex-col items-center justify-center w-full h-full space-y-1 ${isActive('/friends') ? 'text-primary' : 'text-muted-foreground hover:text-foreground'}`}
          >
            <Users className="w-5 h-5" />
            <span className="text-[10px] font-semibold">{'Community'}</span>
          </Link>
          <Link 
            to="/suggestions" 
            className={`flex flex-col items-center justify-center w-full h-full space-y-1 ${isActive('/suggestions') ? 'text-primary' : 'text-muted-foreground hover:text-foreground'}`}
          >
            <Lightbulb className="w-5 h-5" />
            <span className="text-[10px] font-semibold">{'Feedback'}</span>
          </Link>
          <Link 
            to="/updates" 
            className={`flex flex-col items-center justify-center w-full h-full space-y-1 ${isActive('/updates') ? 'text-primary' : 'text-muted-foreground hover:text-foreground'}`}
          >
            <Megaphone className="w-5 h-5" />
            <span className="text-[10px] font-semibold">{'Updates'}</span>
          </Link>
          {profile?.is_admin && (
            <Link 
              to="/admin" 
              className={`flex flex-col items-center justify-center w-full h-full space-y-1 ${isActive('/admin') ? 'text-primary' : 'text-muted-foreground hover:text-foreground'}`}
            >
              <Shield className="w-5 h-5" />
              <span className="text-[10px] font-semibold">Admin</span>
            </Link>
          )}
          <Link 
            to="/profile" 
            className={`flex flex-col items-center justify-center w-full h-full space-y-1 ${isActive('/profile') ? 'text-primary' : 'text-muted-foreground hover:text-foreground'}`}
          >
            <UserIcon className="w-5 h-5" />
            <span className="text-[10px] font-semibold">{'Profile'}</span>
          </Link>
        </div>
      </div>

    </div>
  );
}


