import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { Search, UserPlus, Users, Flame, Copy, Loader2, CheckCircle2, X, Trophy, Hash, Gamepad2 } from 'lucide-react';
import type { Profile, Game } from '../types';

interface FollowProfile extends Profile {
  relationship_id: string;
}

export function Friends() {
  const getGameLogo = (game: any) => {
    const url = game.custom_logo_url || game.global_games?.logo_url;
    if (url) return url;
    const gameUrl = game.global_games?.url;
    if (gameUrl) {
      try {
        const domain = new URL(gameUrl).hostname;
        return `https://www.google.com/s2/favicons?domain=${domain}&sz=128`;
      } catch {
        return undefined;
      }
    }
    return undefined;
  };

  const [activeTab, setActiveTab] = useState<'ranking' | 'following' | 'followers' | 'search'>('ranking');
  const [currentUser, setCurrentUser] = useState<string | null>(null);
  
  // Following State (Siguiendo)
  const [following, setFollowing] = useState<FollowProfile[]>([]);
  const [isLoadingFollowing, setIsLoadingFollowing] = useState(true);

  // Followers State (Seguidores)
  const [followers, setFollowers] = useState<FollowProfile[]>([]);
  const [isLoadingFollowers, setIsLoadingFollowers] = useState(true);
  
  // Ranking State
  const [ranking, setRanking] = useState<Profile[]>([]);
  const [myRank, setMyRank] = useState<number | null>(null);
  const [isLoadingRanking, setIsLoadingRanking] = useState(true);

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
    setIsLoadingRanking(true);
    
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;
    setCurrentUser(session.user.id);

    // 1. Obtener gente que yo sigo (Following / user_id = yo)
    const { data: followingData } = await supabase
      .from('friendships')
      .select(`
        id,
        friend_id,
        profiles!friendships_friend_id_fkey (
          id, username, full_name, avatar_url, global_streak, created_at, highest_streak
        )
      `)
      .eq('user_id', session.user.id);

    const followingProfiles: FollowProfile[] = [];
    const followingIds = [session.user.id]; // Me incluyo para el ranking

    if (followingData) {
      followingData.forEach((f: any) => {
        followingIds.push(f.friend_id);
        followingProfiles.push({
          ...f.profiles,
          relationship_id: f.id
        });
      });
      setFollowing(followingProfiles);
    }
    setIsLoadingFollowing(false);

    // 2. Obtener gente que me sigue (Followers / friend_id = yo)
    const { data: followersData } = await supabase
      .from('friendships')
      .select(`
        id,
        profiles!friendships_user_id_fkey (
          id, username, full_name, avatar_url, global_streak, created_at, highest_streak
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

    // 3. Obtener Ranking (Top 10 entre mis amigos y yo)
    const { data: rankingData } = await supabase
      .from('profiles')
      .select('*, global_games(*)')
      .in('id', followingIds)
      .order('global_streak', { ascending: false });

    if (rankingData) {
      setRanking(rankingData);
      const rankIndex = rankingData.findIndex(p => p.id === session.user.id);
      if (rankIndex !== -1) setMyRank(rankIndex + 1);
    }
    setIsLoadingRanking(false);
  };

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim() || !currentUser) return;
    
    setIsSearching(true);
    const { data, error } = await supabase
      .from('profiles')
      .select('*, global_games(*)')
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
      .from('user_games')
      .select('*, global_games(*)')
      .eq('user_id', user.id);
    
    if (fGames) setUserGames(fGames);

    const { data: mGames } = await supabase
      .from('user_games')
      .select('global_game_id')
      .eq('user_id', currentUser);
    
    if (mGames) {
      setMyGameUrls(new Set(mGames.map(g => g.global_game_id)));
    }
    
    setIsLoadingCatalog(false);
  };

  const handleCopyGame = async (game: Game) => {
    if (!currentUser) return;
    setCopyingId(game.id);

    const { error } = await supabase
      .from('user_games')
      .insert({
          user_id: currentUser,
          global_game_id: game.global_game_id
        });

    if (!error) {
      setMyGameUrls(prev => new Set(prev).add(game.global_game_id));
    }
    setCopyingId(null);
  };

  const isFollowing = (userId: string) => following.some(f => f.id === userId);

  
  
return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4">
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-foreground">Community</h2>
          
        </div>
        
        <div className="flex border-b border-border w-full sm:w-auto overflow-x-auto gap-2">
          <button
            onClick={() => setActiveTab('ranking')}
            className={`flex-1 sm:flex-none whitespace-nowrap px-4 py-3 text-sm font-bold transition-all border-b-2 -mb-px flex items-center justify-center ${
              activeTab === 'ranking' ? 'border-primary text-foreground' : 'border-transparent text-muted-foreground hover:text-foreground hover:border-border'
            }`}
          >
            <Trophy className="w-4 h-4 mr-2" />
            Ranking
          </button>
          <button
            onClick={() => setActiveTab('following')}
            className={`flex-1 sm:flex-none whitespace-nowrap px-4 py-3 text-sm font-bold transition-all border-b-2 -mb-px ${
              activeTab === 'following' ? 'border-primary text-foreground' : 'border-transparent text-muted-foreground hover:text-foreground hover:border-border'
            }`}
          >Following</button>
          <button
            onClick={() => setActiveTab('followers')}
            className={`flex-1 sm:flex-none whitespace-nowrap px-4 py-3 text-sm font-bold transition-all border-b-2 -mb-px flex items-center justify-center ${
              activeTab === 'followers' ? 'border-primary text-foreground' : 'border-transparent text-muted-foreground hover:text-foreground hover:border-border'
            }`}
          >
            Followers
            {followers.length > 0 && (
              <span className="ml-1.5 bg-primary/20 text-primary text-[10px] py-0.5 px-1.5 rounded-full">{followers.length}</span>
            )}
          </button>
          <button
            onClick={() => setActiveTab('search')}
            className={`flex-1 sm:flex-none whitespace-nowrap px-4 py-3 text-sm font-bold transition-all border-b-2 -mb-px flex items-center justify-center ${
              activeTab === 'search' ? 'border-primary text-foreground' : 'border-transparent text-muted-foreground hover:text-foreground hover:border-border'
            }`}
          >
            <Search className="w-4 h-4 mr-2" />Search</button>
        </div>
      </div>

      <div className="min-h-[400px] mt-6">
        {/* TAB: RANKING */}
        {activeTab === 'ranking' && (
          <div className="">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-bold">Top Global (Friends)</h3>
              {myRank && ranking.length > 0 && (
                <div className="flex items-center bg-primary/10 text-primary px-3 py-1.5 rounded-lg font-bold text-sm">
                  <Hash className="w-4 h-4 mr-1" />
                  Your Rank: {myRank}/{ranking.length}
                </div>
              )}
            </div>

            {isLoadingRanking ? (
              <div className="flex justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>
            ) : ranking.length === 0 ? (
              <div className="text-center py-12">
                <Trophy className="w-12 h-12 text-muted-foreground mx-auto mb-4 opacity-50" />
                <p className="text-muted-foreground font-medium">Not enough data for ranking.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {ranking.map((user, index) => {
                  const isMe = user.id === currentUser;
                  let badgeColor = "bg-muted text-muted-foreground";
                  if (index === 0) badgeColor = "bg-yellow-500/20 text-yellow-600 dark:text-yellow-500";
                  else if (index === 1) badgeColor = "bg-slate-300/50 text-slate-600 dark:text-slate-300";
                  else if (index === 2) badgeColor = "bg-amber-600/20 text-amber-700 dark:text-amber-500";

                  return (
                    <div 
                      key={user.id} 
                      className={`flex items-center justify-between p-4 rounded-xl border transition-colors ${
                        isMe ? 'border-primary bg-primary/5' : 'border-border bg-background hover:border-primary/30'
                      }`}
                    >
                      <div className="flex items-center space-x-4">
                        <div className={`w-8 text-center font-black text-lg ${index < 3 ? badgeColor.split(' ')[1] : 'text-muted-foreground'}`}>
                          #{index + 1}
                        </div>
                        <div className="h-12 w-12 rounded-full bg-muted overflow-hidden flex-shrink-0 cursor-pointer border border-border" onClick={() => !isMe && openCatalog(user)}>
                          {user.avatar_url ? (
                            <img src={user.avatar_url} alt="" className="w-full h-full object-cover" />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center bg-primary/10 text-primary font-bold text-lg">
                              {user.username.charAt(0).toUpperCase()}
                            </div>
                          )}
                        </div>
                        <div>
                          <h4 
                            className={`font-bold ${isMe ? 'text-primary' : 'text-foreground cursor-pointer hover:underline'}`}
                            onClick={() => !isMe && openCatalog(user)}
                          >
                            {user.username} {isMe && '(Tú)'}
                          </h4>
                        </div>
                      </div>
                      <div className="flex items-center text-orange-500 font-extrabold bg-orange-500/10 px-3 py-1.5 rounded-xl">
                        <Flame className="w-5 h-5 mr-1.5" />
                        {user.global_streak}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* TAB: SIGUIENDO */}
        {activeTab === 'following' && (
          <div className="">
            {isLoadingFollowing ? (
              <div className="flex justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>
            ) : following.length === 0 ? (
              <div className="text-center py-12">
                <Users className="w-12 h-12 text-muted-foreground mx-auto mb-4 opacity-50" />
                <p className="text-muted-foreground font-medium">You don't follow anyone yet.</p>
                <button onClick={() => setActiveTab('search')} className="mt-4 text-primary font-bold hover:underline">Search friends</button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {following.map(user => (
                  <div key={user.relationship_id} className="flex items-center justify-between p-4 bg-background border border-border rounded-xl hover:border-primary/30 transition-colors">
                    <div className="flex items-center space-x-4">
                      <div className="h-12 w-12 rounded-full bg-muted overflow-hidden flex-shrink-0 cursor-pointer border border-border" onClick={() => openCatalog(user)}>
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
                        <div className="flex items-center text-sm text-orange-500 font-bold mt-0.5">
                          <Flame className="w-3.5 h-3.5 mr-1" />
                          {user.global_streak} streak
                        </div>
                      </div>
                    </div>
                    <button 
                      onClick={() => handleUnfollow(user.relationship_id)}
                      className="px-3 py-1.5 bg-muted text-muted-foreground hover:bg-destructive/10 hover:text-destructive text-sm font-bold rounded-lg transition-colors"
                    >
                      Unfollow
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* TAB: SEGUIDORES */}
        {activeTab === 'followers' && (
          <div className="">
            
            {isLoadingFollowers ? (
              <div className="flex justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>
            ) : followers.length === 0 ? (
              <div className="text-center py-12">
                <Users className="w-12 h-12 text-muted-foreground mx-auto mb-4 opacity-50" />
                <p className="text-muted-foreground font-medium">You don't have any followers yet.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {followers.map(user => {
                  const alreadyFollowing = isFollowing(user.id);
                  return (
                    <div key={user.relationship_id} className="flex items-center justify-between p-4 bg-background border border-border rounded-xl hover:border-primary/30 transition-colors">
                      <div className="flex items-center space-x-4">
                        <div className="h-12 w-12 rounded-full bg-muted overflow-hidden flex-shrink-0 cursor-pointer border border-border" onClick={() => openCatalog(user)}>
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
                          <span className="text-xs font-medium text-muted-foreground">Started following you</span>
                        </div>
                      </div>
                      {!alreadyFollowing ? (
                        <button 
                          onClick={() => handleFollow(user.id)}
                          className="px-4 py-2 bg-primary/10 text-primary hover:bg-primary hover:text-primary-foreground text-sm font-bold rounded-lg transition-colors"
                        >
                          Follow back
                        </button>
                      ) : (
                        <span className="text-sm font-bold text-muted-foreground px-4 py-2 bg-muted rounded-lg">Friends</span>
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
          <div className="">
            <form onSubmit={handleSearch} className="mb-6 flex gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                <input 
                  type="text" 
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search by username..." 
                  className="w-full pl-12 pr-4 py-3 border bg-background border-border rounded-xl text-foreground font-medium focus:ring-2 focus:ring-primary focus:outline-none shadow-sm transition-shadow"
                />
              </div>
              <button type="submit" disabled={isSearching || !searchQuery.trim()} className="px-6 py-3 bg-primary text-primary-foreground font-bold rounded-xl hover:opacity-90 disabled:opacity-50 transition-colors shadow-sm">
                {isSearching ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Search'}
              </button>
            </form>

            <div className="space-y-3">
              {searchResults.length === 0 && searchQuery && !isSearching ? (
                <p className="text-center text-muted-foreground py-8 font-medium">No profiles found with that name.</p>
              ) : (
                searchResults.map(user => {
                  const alreadyFollowing = isFollowing(user.id);
                  return (
                    <div key={user.id} className="flex items-center justify-between p-4 bg-background border border-border rounded-xl hover:border-primary/30 transition-colors">
                      <div className="flex items-center space-x-4">
                        <div className="h-12 w-12 rounded-full bg-muted overflow-hidden flex-shrink-0 cursor-pointer border border-border" onClick={() => openCatalog(user)}>
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
                        </div>
                      </div>
                      {alreadyFollowing ? (
                        <span className="text-sm font-bold text-muted-foreground px-4 py-2 bg-muted rounded-lg border border-border">Following</span>
                      ) : (
                        <button 
                          onClick={() => handleFollow(user.id)}
                          className="flex items-center px-4 py-2 bg-primary text-primary-foreground hover:opacity-90 text-sm font-bold rounded-lg transition-colors shadow-sm"
                        >
                          <UserPlus className="w-4 h-4 mr-2" />
                          Follow
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
          <div className="bg-card w-full max-w-2xl rounded-3xl shadow-2xl border border-border overflow-hidden flex flex-col max-h-[85vh] animate-in fade-in zoom-in-95 duration-200">
            <div className="flex justify-between items-center p-6 border-b border-border bg-muted/30">
              <div className="flex items-center space-x-4">
                <div className="h-12 w-12 rounded-full bg-background overflow-hidden border border-border shadow-sm">
                  {selectedUser.avatar_url ? (
                    <img src={selectedUser.avatar_url} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center bg-primary/10 text-primary font-bold text-lg">
                      {selectedUser.username.charAt(0).toUpperCase()}
                    </div>
                  )}
                </div>
                <div>
                  <h3 className="text-xl font-extrabold text-foreground leading-none mb-1">{selectedUser.username}</h3>
                  <div className="flex items-center space-x-2">
                    <span className="text-sm text-muted-foreground font-medium">Daily games catalog</span>
                    <span className="text-muted-foreground">•</span>
                    <span className="text-sm font-bold text-orange-500 flex items-center">
                      <Flame className="w-3.5 h-3.5 mr-1" />
                      PB: {selectedUser.highest_streak || selectedUser.global_streak || 0}
                    </span>
                  </div>
                </div>
              </div>
              <button onClick={() => setSelectedUser(null)} className="text-muted-foreground hover:text-foreground bg-background p-1.5 rounded-full border border-border shadow-sm transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="p-6 overflow-y-auto flex-1">
              {isLoadingCatalog ? (
                <div className="flex justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>
              ) : userGames.length === 0 ? (
                <div className="text-center py-12">
                  <Gamepad2 className="w-12 h-12 text-muted-foreground mx-auto mb-4 opacity-50" />
                  <p className="text-muted-foreground font-medium">This profile has no public games.</p>
                </div>
              ) : (
                <div className="flex flex-col space-y-3">
                  {userGames.map((game) => {
                    const alreadyHaveIt = myGameUrls.has(game.global_game_id);
                    return (
                      <div key={game.id} className="p-4 rounded-2xl flex flex-col justify-between h-36 transition-transform hover:-translate-y-1 shadow-sm border border-transparent" style={{ backgroundColor: (game.custom_color || game.global_games?.color || "#333333") || '#333' }}>
                        <div className="flex justify-between items-start">
                          <div className="flex items-center space-x-2 min-w-0">
                            {getGameLogo(game) && (
                               <img src={getGameLogo(game)} alt="" className="w-8 h-8 rounded-lg object-cover shadow-sm bg-white/20" />
                            )}
                            <h4 className="font-bold text-white text-lg truncate">{(game.custom_name || game.global_games?.name || "")}</h4>
                          </div>
                          
                          <div className="flex items-center text-white/90 bg-black/20 px-2 py-1 rounded-lg text-xs font-bold backdrop-blur-sm" title="Streak in this game">
                            <Flame className="w-3.5 h-3.5 mr-1 text-orange-300" />
                            {game.current_streak}
                          </div>
                        </div>
                        
                        <div className="flex justify-end mt-4">
                          {alreadyHaveIt ? (
                            <div className="flex items-center px-4 py-2 bg-white/20 text-white rounded-xl text-sm font-bold backdrop-blur-sm">
                              <CheckCircle2 className="w-4 h-4 mr-1.5" />Already in catalog</div>
                          ) : (
                            <button
                              onClick={() => handleCopyGame(game)}
                              disabled={copyingId === game.id}
                              className="flex items-center px-4 py-2 bg-black/30 hover:bg-black/50 text-white rounded-xl text-sm font-bold transition-colors disabled:opacity-50 backdrop-blur-sm"
                            >
                              {copyingId === game.id ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> : <Copy className="w-4 h-4 mr-1.5" />}
                              Copy to my catalog
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

