import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { Search, UserPlus, Users, Flame, Copy, Loader2, CheckCircle2, X, Bell } from 'lucide-react';
import type { Profile, Game } from '../types';

interface FollowProfile extends Profile {
  relationship_id: string;
}

export function Friends() {
  const [activeTab, setActiveTab] = useState<'following' | 'followers' | 'search'>('following');
  const [currentUser, setCurrentUser] = useState<string | null>(null);
  
  // Following State (Siguiendo)
  const [following, setFollowing] = useState<FollowProfile[]>([]);
  const [isLoadingFollowing, setIsLoadingFollowing] = useState(true);

  // Followers State (Seguidores)
  const [followers, setFollowers] = useState<FollowProfile[]>([]);
  const [isLoadingFollowers, setIsLoadingFollowers] = useState(true);
  
  // Search State
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Profile[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  // Modal State
  const [selectedUser, setSelectedUser] = useState<Profile | null>(null);
  const [userGames, setUserGames] = useState<Game[]>([]);
  const [myGameUrls, setMyGameUrls] = useState<Set<string>>(new Set());
  const [isLoadingCatalog, setIsLoadingCatalog] = useState(false);
  const [copyingId, setCopyingId] = useState<string | null>(null);

  useEffect(() => {
    loadRelationships();
  }, []);

  const loadRelationships = async () => {
    setIsLoadingFollowing(true);
    setIsLoadingFollowers(true);
    
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;
    setCurrentUser(session.user.id);

    // 1. Obtener gente que yo sigo (Following / user_id = yo)
    const { data: followingData } = await supabase
      .from('friendships')
      .select(`
        id,
        profiles!friendships_friend_id_fkey (
          id, username, full_name, avatar_url, global_streak, created_at
        )
      `)
      .eq('user_id', session.user.id);

    if (followingData) {
      setFollowing(followingData.map((f: any) => ({
        ...f.profiles,
        relationship_id: f.id
      })) as FollowProfile[]);
    }
    setIsLoadingFollowing(false);

    // 2. Obtener gente que me sigue (Followers / friend_id = yo)
    const { data: followersData } = await supabase
      .from('friendships')
      .select(`
        id,
        profiles!friendships_user_id_fkey (
          id, username, full_name, avatar_url, global_streak, created_at
        )
      `)
      .eq('friend_id', session.user.id);

    if (followersData) {
      setFollowers(followersData.map((f: any) => ({
        ...f.profiles,
        relationship_id: f.id
      })) as FollowProfile[]);
    }
    setIsLoadingFollowers(false);
  };

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim() || !currentUser) return;
    
    setIsSearching(true);
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .ilike('username', `%${searchQuery.trim()}%`)
      .neq('id', currentUser)
      .limit(10);
    
    if (!error && data) {
      setSearchResults(data);
    }
    setIsSearching(false);
  };

  const handleFollow = async (targetId: string) => {
    if (!currentUser) return;
    
    const { error } = await supabase
      .from('friendships')
      .insert({ user_id: currentUser, friend_id: targetId });
    
    if (!error) {
      await loadRelationships();
    }
  };

  const handleUnfollow = async (relationshipId: string) => {
    const { error } = await supabase
      .from('friendships')
      .delete()
      .eq('id', relationshipId);
    
    if (!error) {
      await loadRelationships();
    }
  };

  const openCatalog = async (user: Profile) => {
    setSelectedUser(user);
    setIsLoadingCatalog(true);
    
    if (!currentUser) return;

    const { data: fGames } = await supabase
      .from('games')
      .select('*')
      .eq('user_id', user.id);
    
    if (fGames) setUserGames(fGames);

    const { data: mGames } = await supabase
      .from('games')
      .select('url')
      .eq('user_id', currentUser);
    
    if (mGames) {
      setMyGameUrls(new Set(mGames.map(g => g.url)));
    }
    
    setIsLoadingCatalog(false);
  };

  const handleCopyGame = async (game: Game) => {
    if (!currentUser) return;
    setCopyingId(game.id);

    const { error } = await supabase
      .from('games')
      .insert({
        user_id: currentUser,
        name: game.name,
        url: game.url,
        color: game.color,
      });

    if (!error) {
      setMyGameUrls(prev => new Set(prev).add(game.url));
    }
    setCopyingId(null);
  };

  // Helper para saber si yo ya sigo a alguien
  const isFollowing = (userId: string) => following.some(f => f.id === userId);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4">
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-foreground">Comunidad</h2>
          <p className="text-muted-foreground mt-1">Conecta, sigue perfiles y descubre juegos nuevos.</p>
        </div>
        
        <div className="flex bg-muted p-1 rounded-lg w-full sm:w-auto overflow-x-auto">
          <button
            onClick={() => setActiveTab('following')}
            className={`flex-1 sm:flex-none whitespace-nowrap px-4 py-2 text-sm font-medium rounded-md transition-colors ${
              activeTab === 'following' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            Siguiendo
          </button>
          <button
            onClick={() => setActiveTab('followers')}
            className={`flex-1 sm:flex-none whitespace-nowrap px-4 py-2 text-sm font-medium rounded-md transition-colors flex items-center justify-center ${
              activeTab === 'followers' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            Seguidores
            {followers.length > 0 && (
              <span className="ml-2 bg-primary/20 text-primary text-xs py-0.5 px-2 rounded-full">{followers.length}</span>
            )}
          </button>
          <button
            onClick={() => setActiveTab('search')}
            className={`flex-1 sm:flex-none whitespace-nowrap px-4 py-2 text-sm font-medium rounded-md transition-colors ${
              activeTab === 'search' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            Buscar
          </button>
        </div>
      </div>

      <div className="bg-card border border-border rounded-xl shadow-sm overflow-hidden min-h-[400px]">
        {/* TAB: SIGUIENDO */}
        {activeTab === 'following' && (
          <div className="p-6">
            {isLoadingFollowing ? (
              <div className="flex justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>
            ) : following.length === 0 ? (
              <div className="text-center py-12">
                <Users className="w-12 h-12 text-muted-foreground mx-auto mb-4 opacity-50" />
                <p className="text-muted-foreground">Aún no sigues a nadie.</p>
                <button onClick={() => setActiveTab('search')} className="mt-4 text-primary font-medium hover:underline">
                  Buscar perfiles
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {following.map(user => (
                  <div key={user.relationship_id} className="flex items-center justify-between p-4 bg-background border border-border rounded-lg hover:border-primary/50 transition-colors">
                    <div className="flex items-center space-x-4">
                      <div className="h-12 w-12 rounded-full bg-muted overflow-hidden flex-shrink-0 cursor-pointer" onClick={() => openCatalog(user)}>
                        {user.avatar_url ? (
                          <img src={user.avatar_url} alt="" className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center bg-primary/10 text-primary font-bold text-lg">
                            {user.username.charAt(0).toUpperCase()}
                          </div>
                        )}
                      </div>
                      <div>
                        <h4 className="font-bold text-foreground cursor-pointer hover:underline" onClick={() => openCatalog(user)}>{user.username}</h4>
                        <div className="flex items-center text-sm text-orange-500 font-medium">
                          <Flame className="w-4 h-4 mr-1" />
                          {user.global_streak} racha global
                        </div>
                      </div>
                    </div>
                    <button 
                      onClick={() => handleUnfollow(user.relationship_id)}
                      className="px-3 py-1.5 bg-muted text-muted-foreground hover:bg-destructive/10 hover:text-destructive text-sm font-medium rounded-md transition-colors"
                    >
                      Dejar de seguir
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* TAB: SEGUIDORES */}
        {activeTab === 'followers' && (
          <div className="p-6">
            <div className="mb-4 text-sm font-medium text-muted-foreground flex items-center">
              <Bell className="w-4 h-4 mr-2" />
              Notificaciones de personas que ven tu catálogo
            </div>
            {isLoadingFollowers ? (
              <div className="flex justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>
            ) : followers.length === 0 ? (
              <div className="text-center py-12">
                <Users className="w-12 h-12 text-muted-foreground mx-auto mb-4 opacity-50" />
                <p className="text-muted-foreground">Aún no tienes seguidores.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {followers.map(user => {
                  const alreadyFollowing = isFollowing(user.id);
                  return (
                    <div key={user.relationship_id} className="flex items-center justify-between p-4 bg-background border border-border rounded-lg">
                      <div className="flex items-center space-x-4">
                        <div className="h-10 w-10 rounded-full bg-muted overflow-hidden flex-shrink-0 cursor-pointer" onClick={() => openCatalog(user)}>
                          {user.avatar_url ? (
                            <img src={user.avatar_url} alt="" className="w-full h-full object-cover" />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center bg-primary/10 text-primary font-bold">
                              {user.username.charAt(0).toUpperCase()}
                            </div>
                          )}
                        </div>
                        <div>
                          <h4 className="font-bold text-foreground cursor-pointer hover:underline" onClick={() => openCatalog(user)}>{user.username}</h4>
                          <span className="text-xs text-muted-foreground">Comenzó a seguirte</span>
                        </div>
                      </div>
                      {!alreadyFollowing ? (
                        <button 
                          onClick={() => handleFollow(user.id)}
                          className="px-3 py-1.5 bg-primary/10 text-primary hover:bg-primary hover:text-primary-foreground text-sm font-medium rounded-md transition-colors"
                        >
                          Devolver follow
                        </button>
                      ) : (
                        <span className="text-sm font-medium text-muted-foreground px-3 py-1.5 bg-muted rounded-md">Siguiendo</span>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* TAB: BÚSQUEDA */}
        {activeTab === 'search' && (
          <div className="p-6">
            <form onSubmit={handleSearch} className="mb-6 flex gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                <input 
                  type="text" 
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Buscar por nombre de usuario..." 
                  className="w-full pl-10 pr-4 py-2 border bg-background border-border rounded-lg text-foreground focus:ring-2 focus:ring-primary focus:outline-none"
                />
              </div>
              <button type="submit" disabled={isSearching || !searchQuery.trim()} className="px-6 py-2 bg-primary text-primary-foreground font-medium rounded-lg hover:opacity-90 disabled:opacity-50 transition-colors">
                {isSearching ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Buscar'}
              </button>
            </form>

            <div className="space-y-3">
              {searchResults.length === 0 && searchQuery && !isSearching ? (
                <p className="text-center text-muted-foreground py-8">No se encontraron perfiles.</p>
              ) : (
                searchResults.map(user => {
                  const alreadyFollowing = isFollowing(user.id);
                  return (
                    <div key={user.id} className="flex items-center justify-between p-4 bg-background border border-border rounded-lg">
                      <div className="flex items-center space-x-4">
                        <div className="h-10 w-10 rounded-full bg-muted overflow-hidden flex-shrink-0 cursor-pointer" onClick={() => openCatalog(user)}>
                          {user.avatar_url ? (
                            <img src={user.avatar_url} alt="" className="w-full h-full object-cover" />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center bg-primary/10 text-primary font-bold">
                              {user.username.charAt(0).toUpperCase()}
                            </div>
                          )}
                        </div>
                        <div>
                          <h4 className="font-bold text-foreground cursor-pointer hover:underline" onClick={() => openCatalog(user)}>{user.username}</h4>
                        </div>
                      </div>
                      {alreadyFollowing ? (
                        <span className="text-sm font-medium text-muted-foreground px-3 py-1.5 bg-muted rounded-md">Siguiendo</span>
                      ) : (
                        <button 
                          onClick={() => handleFollow(user.id)}
                          className="flex items-center px-3 py-1.5 bg-primary text-primary-foreground hover:opacity-90 text-sm font-medium rounded-md transition-colors"
                        >
                          <UserPlus className="w-4 h-4 mr-1.5" />
                          Seguir
                        </button>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}
      </div>

      {/* Catálogo Modal */}
      {selectedUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm">
          <div className="bg-card w-full max-w-2xl rounded-2xl shadow-xl border border-border overflow-hidden flex flex-col max-h-[85vh] animate-in fade-in zoom-in-95 duration-200">
            <div className="flex justify-between items-center p-6 border-b border-border">
              <div className="flex items-center space-x-3">
                <div className="h-10 w-10 rounded-full bg-muted overflow-hidden">
                  {selectedUser.avatar_url ? (
                    <img src={selectedUser.avatar_url} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center bg-primary/10 text-primary font-bold">
                      {selectedUser.username.charAt(0).toUpperCase()}
                    </div>
                  )}
                </div>
                <h3 className="text-xl font-bold text-foreground">Catálogo de {selectedUser.username}</h3>
              </div>
              <button onClick={() => setSelectedUser(null)} className="text-muted-foreground hover:text-foreground">
                <X className="w-6 h-6" />
              </button>
            </div>
            
            <div className="p-6 overflow-y-auto flex-1">
              {isLoadingCatalog ? (
                <div className="flex justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>
              ) : userGames.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">Este perfil no tiene juegos públicos.</div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {userGames.map((game) => {
                    const alreadyHaveIt = myGameUrls.has(game.url);
                    return (
                      <div key={game.id} className="p-4 rounded-xl flex flex-col justify-between h-32 transition-transform hover:-translate-y-1" style={{ backgroundColor: game.color }}>
                        <div className="flex justify-between items-start">
                          <h4 className="font-bold text-white text-lg line-clamp-1">{game.name}</h4>
                          <div className="flex items-center text-white/90 bg-black/20 px-2 py-1 rounded-md text-xs font-semibold" title="Racha en este juego">
                            <Flame className="w-3 h-3 mr-1 text-orange-300" />
                            {game.current_streak}
                          </div>
                        </div>
                        
                        <div className="flex justify-end">
                          {alreadyHaveIt ? (
                            <div className="flex items-center px-3 py-1.5 bg-white/20 text-white rounded-lg text-sm font-medium">
                              <CheckCircle2 className="w-4 h-4 mr-1.5" />
                              Ya lo tienes
                            </div>
                          ) : (
                            <button
                              onClick={() => handleCopyGame(game)}
                              disabled={copyingId === game.id}
                              className="flex items-center px-3 py-1.5 bg-black/30 hover:bg-black/50 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
                            >
                              {copyingId === game.id ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> : <Copy className="w-4 h-4 mr-1.5" />}
                              Copiar a mi catálogo
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

