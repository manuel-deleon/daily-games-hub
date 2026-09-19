import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { Trophy, Flame, User as UserIcon, Loader2 } from 'lucide-react';
import type { Profile } from '../types';

export function Leaderboard() {
  const [leaderboard, setLeaderboard] = useState<Profile[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  useEffect(() => {
    async function loadLeaderboard() {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      setCurrentUserId(session.user.id);

      // 1. Obtener a quiénes sigo
      const { data: following } = await supabase
        .from('friendships')
        .select('friend_id')
        .eq('user_id', session.user.id);
      
      const friendIds = following?.map(f => f.friend_id) || [];
      const allIds = [...friendIds, session.user.id]; // Yo y mis amigos

      // 2. Traer perfiles de ese grupo ordenados por racha global
      const { data: topProfiles, error } = await supabase
        .from('profiles')
        .select('*')
        .in('id', allIds)
        .order('global_streak', { ascending: false })
        .limit(10);

      if (!error && topProfiles) {
        setLeaderboard(topProfiles);
      }
      setIsLoading(false);
    }

    loadLeaderboard();
  }, []);

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <Loader2 className="w-12 h-12 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="text-center mb-10">
        <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-yellow-500/20 mb-4">
          <Trophy className="w-10 h-10 text-yellow-500" />
        </div>
        <h2 className="text-4xl font-bold tracking-tight text-foreground">Tabla de Clasificación</h2>
        <p className="text-muted-foreground mt-2 text-lg">Top 10 global entre tú y los perfiles que sigues.</p>
      </div>

      <div className="bg-card border border-border rounded-2xl shadow-sm overflow-hidden">
        {leaderboard.map((profile, index) => {
          const isMe = profile.id === currentUserId;
          // Asignar colores a las medallas 1, 2 y 3
          let rankColor = 'text-muted-foreground';
          let rankBg = 'bg-muted';
          if (index === 0) { rankColor = 'text-yellow-600'; rankBg = 'bg-yellow-500/20'; }
          else if (index === 1) { rankColor = 'text-slate-400'; rankBg = 'bg-slate-400/20'; }
          else if (index === 2) { rankColor = 'text-amber-700'; rankBg = 'bg-amber-700/20'; }

          return (
            <div 
              key={profile.id} 
              className={`flex items-center justify-between p-4 sm:p-6 border-b border-border last:border-b-0 transition-colors hover:bg-background ${isMe ? 'bg-primary/5' : ''}`}
            >
              <div className="flex items-center space-x-4">
                {/* Posición */}
                <div className={`w-10 h-10 flex items-center justify-center rounded-full font-bold text-lg ${rankBg} ${rankColor}`}>
                  #{index + 1}
                </div>

                {/* Avatar */}
                <div className="h-12 w-12 rounded-full bg-muted border border-border flex items-center justify-center overflow-hidden">
                  {profile.avatar_url ? (
                    <img src={profile.avatar_url} alt="Avatar" className="h-full w-full object-cover" />
                  ) : (
                    <UserIcon className="w-6 h-6 text-muted-foreground" />
                  )}
                </div>

                {/* Username */}
                <div>
                  <h4 className="font-bold text-foreground text-lg flex items-center">
                    {profile.username}
                    {isMe && <span className="ml-2 text-xs font-semibold px-2 py-0.5 bg-primary text-primary-foreground rounded-full">Tú</span>}
                  </h4>
                </div>
              </div>

              {/* Racha */}
              <div className="flex items-center text-orange-500 font-bold text-xl bg-orange-500/10 px-4 py-2 rounded-xl">
                <Flame className="w-6 h-6 mr-1" />
                {profile.global_streak}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
