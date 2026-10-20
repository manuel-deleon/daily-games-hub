import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { Search, UserPlus, Users, Flame, Copy, Loader2, CheckCircle2, X, Trophy, Hash, Gamepad2 , Circle, Lock, ArrowLeftRight, Check } from 'lucide-react';
import type { Profile, Game } from '../types';
import { useTheme } from '../hooks/useTheme';
import { createNotification } from '../lib/notifications';

interface FollowProfile extends Profile {
  relationship_id: string;
}

export function Friends() {
  const { theme } = useTheme();
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

  const formatUsername = (name: string, max = 18) => {
    if (!name) return '';
    return name.length > max ? `${name.slice(0, max)}…` : name;
  };

  const [searchParams, setSearchParams] = useSearchParams();
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
  const [rankingScope, setRankingScope] = useState<'friends' | 'global'>('friends');
  const [rankingMode, setRankingMode] = useState<'current' | 'highest'>('current');
  const [followingIdsList, setFollowingIdsList] = useState<string[]>([]);

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
  const [selectedHistoryGame, setSelectedHistoryGame] = useState<Game | null>(null);
  const [historyProgress, setHistoryProgress] = useState<{ completed_date: string, share_text: string | null }[]>([]);
  const [copiedHistoryIndex, setCopiedHistoryIndex] = useState<number | null>(null);

  // Compare State
  const [comparingGame, setComparingGame] = useState<Game | null>(null);
  const [isLoadingComparison, setIsLoadingComparison] = useState(false);
  const [comparisonDays, setComparisonDays] = useState<{ date: string; myText: string | null; friendText: string | null; }[]>([]);
  const [copiedCompareSide, setCopiedCompareSide] = useState<string | null>(null);
  const [myMatchingGameId, setMyMatchingGameId] = useState<string | null>(null);

  const openHistory = async (game: Game) => {
    if (game.is_private) {
      alert("This player has set this game's history to private.");
      return;
    }
    setSelectedHistoryGame(game);
    setCopiedHistoryIndex(null);
    if (!selectedUser) return;
    const { data } = await supabase
      .from('daily_progress')
      .select('completed_date, share_text')
      .eq('user_id', selectedUser.id)
      .eq('game_id', game.id)
      .order('completed_date', { ascending: false })
      .limit(90);
    
    setHistoryProgress(data || []);
  };

  const openCompare = async (friendGame: Game) => {
    if (friendGame.is_private) {
      alert("This game's history is set to private.");
      return;
    }
    if (!selectedUser || !currentUser) return;

    setComparingGame(friendGame);
    setIsLoadingComparison(true);
    setComparisonDays([]);
    setCopiedCompareSide(null);

    try {
      // 1. Find my game corresponding to this friendGame (match by global_game_id)
      const { data: myGame } = await supabase
        .from('user_games')
        .select('id')
        .eq('user_id', currentUser)
        .eq('global_game_id', friendGame.global_game_id)
        .maybeSingle();

      setMyMatchingGameId(myGame ? myGame.id : null);

      // 2. Fetch friend's progress (last 90 days)
      const { data: friendProgress } = await supabase
        .from('daily_progress')
        .select('completed_date, share_text')
        .eq('user_id', selectedUser.id)
        .eq('game_id', friendGame.id)
        .order('completed_date', { ascending: false })
        .limit(90);

      // 3. Fetch my progress (if I have this game in my catalog - last 90 days)
      let myProgress: { completed_date: string; share_text: string | null }[] = [];
      if (myGame) {
        const { data: mProg } = await supabase
          .from('daily_progress')
          .select('completed_date, share_text')
          .eq('user_id', currentUser)
          .eq('game_id', myGame.id)
          .order('completed_date', { ascending: false })
          .limit(90);
        if (mProg) myProgress = mProg;
      }

      // 4. Merge by date, keeping ONLY days where at least one side pasted text
      const map = new Map<string, { myText: string | null; friendText: string | null }>();

      (friendProgress || []).forEach(p => {
        if (p.share_text && p.share_text.trim()) {
          map.set(p.completed_date, { myText: null, friendText: p.share_text.trim() });
        }
      });

      (myProgress || []).forEach(p => {
        if (p.share_text && p.share_text.trim()) {
          const entry = map.get(p.completed_date) || { myText: null, friendText: null };
          entry.myText = p.share_text.trim();
          map.set(p.completed_date, entry);
        }
      });

      const merged = Array.from(map.entries())
        .map(([date, data]) => ({ date, ...data }))
        .sort((a, b) => b.date.localeCompare(a.date));

      setComparisonDays(merged);
    } catch (err) {
      console.error('Error fetching comparison:', err);
    } finally {
      setIsLoadingComparison(false);
    }
  };


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

    setFollowingIdsList(followingIds);
  };

  useEffect(() => {
    const fetchRanking = async () => {
      if (!currentUser) return;
      setIsLoadingRanking(true);
      
      let query = supabase.from('profiles').select('*');
      
      if (rankingScope === 'friends') {
        if (followingIdsList.length > 0) {
          query = query.in('id', [...followingIdsList, currentUser]);
        } else {
          query = query.in('id', [currentUser]);
        }
      } else {
        query = query.eq('is_admin', false); // Hide admins from global ranking
      }
      
      if (rankingMode === 'highest') {
        query = query.order('highest_streak', { ascending: false });
      } else {
        query = query.order('global_streak', { ascending: false });
      }
      
      const { data: rankingData } = await query;
      
      if (rankingData) {
        setRanking(rankingData);
        const rankIndex = rankingData.findIndex(p => p.id === currentUser);
        if (rankIndex !== -1) setMyRank(rankIndex + 1);
        else setMyRank(null);
      }
      setIsLoadingRanking(false);
    };
    
    if (followingIdsList.length > 0 || rankingScope === 'global') {
      fetchRanking();
    }
  }, [rankingScope, rankingMode, followingIdsList, currentUser]);

  // Auto-open user catalog if ?userId= parameter is present (e.g. from follow alerts)
  useEffect(() => {
    const targetUserId = searchParams.get('userId');
    if (targetUserId && currentUser) {
      supabase
        .from('profiles')
        .select('*')
        .eq('id', targetUserId)
        .single()
        .then(({ data, error }) => {
          if (data && !error) {
            openCatalog(data);
          }
        });
    }
  }, [searchParams, currentUser]);

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
      // Send notification to followed user
      const { data: myProf } = await supabase.from('profiles').select('username').eq('id', currentUser).single();
      createNotification({
        userId: targetId,
        actorId: currentUser,
        type: 'follow',
        title: `@${myProf?.username || 'Someone'} started following you`,
      });
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

  const handleUnfollowUser = async (targetUserId: string) => {
    if (!currentUser) return;
    const rel = following.find(f => f.id === targetUserId);
    if (rel?.relationship_id) {
      await handleUnfollow(rel.relationship_id);
    } else {
      const { error } = await supabase
        .from('friendships')
        .delete()
        .eq('user_id', currentUser)
        .eq('friend_id', targetUserId);
      if (!error) {
        await loadRelationships();
      }
    }
  };

  const closeCatalog = () => {
    setSelectedUser(null);
    if (searchParams.get('userId')) {
      setSearchParams({});
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
        
        <div className="flex border-b border-border w-full sm:w-auto overflow-x-auto gap-2 [&::-webkit-scrollbar]:hidden" style={{ scrollbarWidth: "none" }}>
          <button
            onClick={() => setActiveTab('ranking')}
            className={`flex-1 sm:flex-none whitespace-nowrap px-4 py-2 text-sm font-bold transition-all border-b-2 -mb-px flex items-center justify-center ${
              activeTab === 'ranking' ? 'border-primary text-foreground' : 'border-transparent text-muted-foreground hover:text-foreground hover:border-border'
            }`}
          >
            <Trophy className="w-4 h-4 mr-2" />
            Ranking
          </button>
          <button
            onClick={() => setActiveTab('following')}
            className={`flex-1 sm:flex-none whitespace-nowrap px-4 py-2 text-sm font-bold transition-all border-b-2 -mb-px ${
              activeTab === 'following' ? 'border-primary text-foreground' : 'border-transparent text-muted-foreground hover:text-foreground hover:border-border'
            }`}
          >Following</button>
          <button
            onClick={() => setActiveTab('followers')}
            className={`flex-1 sm:flex-none whitespace-nowrap px-4 py-2 text-sm font-bold transition-all border-b-2 -mb-px flex items-center justify-center ${
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
            className={`flex-1 sm:flex-none whitespace-nowrap px-4 py-2 text-sm font-bold transition-all border-b-2 -mb-px flex items-center justify-center ${
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
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
              <div className="flex items-center space-x-2 bg-muted/50 p-1 rounded-xl w-fit">
                <button 
                  onClick={() => setRankingScope('friends')}
                  className={`px-3 py-1.5 rounded-lg text-sm font-bold transition-all ${rankingScope === 'friends' ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
                >
                  Friends
                </button>
                <button 
                  onClick={() => setRankingScope('global')}
                  className={`px-3 py-1.5 rounded-lg text-sm font-bold transition-all ${rankingScope === 'global' ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
                >
                  Global
                </button>
              </div>

              <div className="flex items-center space-x-2 bg-muted/50 p-1 rounded-xl w-fit">
                <button 
                  onClick={() => setRankingMode('current')}
                  className={`px-3 py-1.5 rounded-lg text-sm font-bold transition-all ${rankingMode === 'current' ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
                >
                  Current Streak
                </button>
                <button 
                  onClick={() => setRankingMode('highest')}
                  className={`px-3 py-1.5 rounded-lg text-sm font-bold transition-all ${rankingMode === 'highest' ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
                >
                  Personal Best
                </button>
              </div>
            </div>
            
            {myRank && ranking.length > 0 && (
              <div className="flex items-center bg-primary/10 text-primary px-3 py-1.5 rounded-lg font-bold text-sm mb-4 w-fit">
                <Hash className="w-4 h-4 mr-1" />
                Your Rank: {myRank}/{ranking.length}
              </div>
            )}

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
                      <div className="flex items-center text-[#D4A336] font-extrabold bg-[#D4A336]/10 px-3 py-1.5 rounded-xl">
                        <Flame className="w-5 h-5 mr-1.5" />
                        {rankingMode === 'highest' ? (user.highest_streak ?? user.global_streak) : user.global_streak}
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
                  <div key={user.relationship_id} className="flex items-center justify-between p-4 bg-background border border-border rounded-xl hover:border-primary/30 transition-colors gap-3">
                    <div className="flex items-center space-x-4 min-w-0 flex-1">
                      <div className="h-12 w-12 rounded-full bg-muted overflow-hidden flex-shrink-0 cursor-pointer border border-border" onClick={() => openCatalog(user)}>
                        {user.avatar_url ? (
                          <img src={user.avatar_url} alt="" className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center bg-primary/10 text-primary font-bold text-lg">
                            {user.username.charAt(0).toUpperCase()}
                          </div>
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <h4 className="font-bold text-foreground cursor-pointer hover:underline truncate" title={user.username} onClick={() => openCatalog(user)}>
                          {formatUsername(user.username, 18)}
                        </h4>
                        <div className="flex items-center text-sm text-[#D4A336] font-bold mt-0.5">
                          <Flame className="w-3.5 h-3.5 mr-1 flex-shrink-0" />
                          {user.global_streak} streak
                        </div>
                      </div>
                    </div>
                    <button 
                      onClick={() => handleUnfollow(user.relationship_id)}
                      className="ml-auto flex-shrink-0 px-3 py-1.5 bg-muted text-muted-foreground hover:bg-destructive/10 hover:text-destructive text-sm font-bold rounded-lg transition-colors"
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
                    <div key={user.relationship_id} className="flex items-center justify-between p-4 bg-background border border-border rounded-xl hover:border-primary/30 transition-colors gap-3">
                      <div className="flex items-center space-x-4 min-w-0 flex-1">
                        <div className="h-12 w-12 rounded-full bg-muted overflow-hidden flex-shrink-0 cursor-pointer border border-border" onClick={() => openCatalog(user)}>
                          {user.avatar_url ? (
                            <img src={user.avatar_url} alt="" className="w-full h-full object-cover" />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center bg-primary/10 text-primary font-bold text-lg">
                              {user.username.charAt(0).toUpperCase()}
                            </div>
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <h4 className="font-bold text-foreground cursor-pointer hover:underline truncate" title={user.username} onClick={() => openCatalog(user)}>
                            {formatUsername(user.username, 18)}
                          </h4>
                          <span className="text-xs font-medium text-muted-foreground">Started following you</span>
                        </div>
                      </div>
                      {!alreadyFollowing ? (
                        <button 
                          onClick={() => handleFollow(user.id)}
                          className="ml-auto flex-shrink-0 px-5 py-2.5 bg-primary/10 text-primary hover:bg-primary hover:text-primary-foreground text-sm font-bold rounded-xl transition-colors shadow-sm"
                        >
                          Follow back
                        </button>
                      ) : (
                        <button 
                          onClick={() => handleUnfollowUser(user.id)}
                          className="ml-auto flex-shrink-0 text-sm font-bold text-muted-foreground hover:text-destructive hover:bg-destructive/10 hover:border-destructive/30 px-5 py-2.5 bg-muted rounded-xl border border-border transition-all group cursor-pointer"
                          title="Click to unfollow"
                        >
                          <span className="group-hover:hidden">Following</span>
                          <span className="hidden group-hover:inline">Unfollow</span>
                        </button>
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
                  className="w-full pl-12 pr-4 py-2 border bg-background border-border rounded-xl text-foreground font-medium focus:ring-2 focus:ring-primary focus:outline-none shadow-sm transition-shadow"
                />
              </div>
              <button type="submit" disabled={isSearching || !searchQuery.trim()} className="px-6 py-2 bg-primary text-primary-foreground font-bold rounded-xl hover:opacity-90 disabled:opacity-50 transition-colors shadow-sm">
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
                    <div key={user.id} className="flex items-center justify-between p-4 bg-background border border-border rounded-xl hover:border-primary/30 transition-colors gap-3">
                      <div className="flex items-center space-x-4 min-w-0 flex-1">
                        <div className="h-12 w-12 rounded-full bg-muted overflow-hidden flex-shrink-0 cursor-pointer border border-border" onClick={() => openCatalog(user)}>
                          {user.avatar_url ? (
                            <img src={user.avatar_url} alt="" className="w-full h-full object-cover" />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center bg-primary/10 text-primary font-bold text-lg">
                              {user.username.charAt(0).toUpperCase()}
                            </div>
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <h4 className="font-bold text-foreground cursor-pointer hover:underline truncate" title={user.username} onClick={() => openCatalog(user)}>
                            {formatUsername(user.username, 18)}
                          </h4>
                        </div>
                      </div>
                      {alreadyFollowing ? (
                        <button 
                          onClick={() => handleUnfollowUser(user.id)}
                          className="ml-auto flex-shrink-0 text-sm font-bold text-muted-foreground hover:text-destructive hover:bg-destructive/10 hover:border-destructive/30 px-5 py-2.5 bg-muted rounded-xl border border-border transition-all group cursor-pointer"
                          title="Click to unfollow"
                        >
                          <span className="group-hover:hidden">Following</span>
                          <span className="hidden group-hover:inline">Unfollow</span>
                        </button>
                      ) : (
                        <button 
                          onClick={() => handleFollow(user.id)}
                          className="ml-auto flex-shrink-0 flex items-center px-5 py-2.5 bg-primary text-primary-foreground hover:opacity-90 text-sm font-bold rounded-xl transition-colors shadow-sm"
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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm" onClick={closeCatalog}>
          <div className="bg-card w-full max-w-2xl rounded-3xl shadow-2xl border border-border overflow-hidden flex flex-col max-h-[85vh] animate-in fade-in zoom-in-95 duration-200" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-start p-5 sm:p-6 border-b border-border bg-muted/30 gap-3">
              <div className="flex items-center space-x-3 sm:space-x-4 min-w-0 flex-1">
                <div className="h-12 w-12 rounded-full bg-background overflow-hidden border border-border shadow-sm flex-shrink-0">
                  {selectedUser.avatar_url ? (
                    <img src={selectedUser.avatar_url} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center bg-primary/10 text-primary font-bold text-lg">
                      {selectedUser.username.charAt(0).toUpperCase()}
                    </div>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <h3 className="text-xl font-extrabold text-foreground leading-tight truncate" title={selectedUser.username}>
                    {formatUsername(selectedUser.username, 20)}
                  </h3>
                  <div className="flex flex-col sm:flex-row sm:items-center sm:space-x-3 space-y-1 sm:space-y-0 mt-1.5">
                    <span className="text-xs sm:text-sm font-bold text-[#D4A336] flex items-center bg-[#D4A336]/10 px-2 py-0.5 rounded-lg w-fit">
                      <Flame className="w-3.5 h-3.5 mr-1" />
                      Global Streak: {selectedUser.global_streak || 0}
                    </span>
                    <span className="text-xs sm:text-sm font-bold text-orange-500 flex items-center bg-orange-500/10 px-2 py-0.5 rounded-lg w-fit">
                      <Flame className="w-3.5 h-3.5 mr-1" />
                      Personal Best: {selectedUser.highest_streak || selectedUser.global_streak || 0}
                    </span>
                  </div>
                </div>
              </div>

              {/* Actions column anchored to the far right */}
              <div className="flex flex-col items-end gap-2 flex-shrink-0 ml-auto">
                <button 
                  onClick={closeCatalog} 
                  className="text-muted-foreground hover:text-foreground bg-background p-1.5 rounded-full border border-border shadow-sm transition-colors cursor-pointer"
                  title="Close"
                >
                  <X className="w-5 h-5" />
                </button>
                {selectedUser.id !== currentUser && !isFollowing(selectedUser.id) && (
                  <button
                    onClick={() => handleFollow(selectedUser.id)}
                    className="px-4 py-2 bg-primary text-primary-foreground text-sm font-bold rounded-xl hover:opacity-90 transition-opacity shadow-sm flex items-center whitespace-nowrap cursor-pointer"
                  >
                    <UserPlus className="w-4 h-4 mr-1.5" />
                    {followers.some(f => f.id === selectedUser.id) ? 'Follow back' : 'Follow'}
                  </button>
                )}
                {selectedUser.id !== currentUser && isFollowing(selectedUser.id) && (
                  <button
                    onClick={() => handleUnfollowUser(selectedUser.id)}
                    className="px-4 py-2 bg-muted text-muted-foreground hover:bg-destructive/10 hover:text-destructive hover:border-destructive/30 border border-border text-sm font-bold rounded-xl shadow-sm transition-all whitespace-nowrap group cursor-pointer"
                    title="Click to unfollow"
                  >
                    <span className="group-hover:hidden">Following</span>
                    <span className="hidden group-hover:inline">Unfollow</span>
                  </button>
                )}
              </div>
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
                <div className="flex flex-col sm:grid sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-5">
                  {userGames.map((game) => {
                    const alreadyHaveIt = myGameUrls.has(game.global_game_id);
                    const dbColor = game.custom_color || game.global_games?.color || "#333333";
                    const isDefaultDark = dbColor === '#333333';
                    const useLightFallback = isDefaultDark && theme === 'light';
                    
                    return (
                      <div
                        key={game.id}
                        onClick={() => {
                          if (game.is_private) return;
                          openHistory(game);
                        }}
                        className={`p-4 rounded-2xl flex flex-col justify-between min-h-[150px] transition-transform hover:-translate-y-1 shadow-sm border ${
                          game.is_private ? 'cursor-default' : 'cursor-pointer'
                        } relative ${useLightFallback ? 'bg-muted border-border' : 'border-transparent'}`}
                        style={useLightFallback ? undefined : { backgroundColor: dbColor }}
                      >
                        <div className="flex justify-between items-start gap-2">
                          <div className="flex items-center space-x-2 min-w-0">
                            {getGameLogo(game) && (
                              <img src={getGameLogo(game)} alt="" className={`w-8 h-8 rounded-lg object-cover shadow-sm flex-shrink-0 ${useLightFallback ? 'bg-background' : 'bg-white/20'}`} />
                            )}
                            <h4 className={`font-bold text-lg truncate ${useLightFallback ? 'text-foreground' : 'text-white'}`}>
                              {(game.custom_name || game.global_games?.name || "")}
                            </h4>
                          </div>
                          
                          <div className="flex items-center gap-1.5 flex-shrink-0">
                            {game.is_private && (
                              <span className="flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-lg bg-black/40 text-amber-300 backdrop-blur-sm" title="History is private">
                                <Lock className="w-3 h-3" /> Private
                              </span>
                            )}
                            <div className={`flex items-center px-2 py-1 rounded-lg text-xs font-bold backdrop-blur-sm ${useLightFallback ? 'bg-background/50 text-foreground border border-border/50' : 'bg-black/20 text-white/90'}`} title="Streak in this game">
                              <Flame className="w-3.5 h-3.5 mr-1 text-[#D4A336]" />
                              {game.current_streak}
                            </div>
                          </div>
                        </div>
                        
                        <div className="flex items-center justify-between gap-2 mt-4 flex-wrap">
                          {/* Compare Button */}
                          {game.is_private ? (
                            <span className={`text-xs italic flex items-center gap-1 ${useLightFallback ? 'text-muted-foreground' : 'text-white/70'}`}>
                              <Lock className="w-3 h-3" /> History private
                            </span>
                          ) : (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                openCompare(game);
                              }}
                              className={`flex items-center px-3 py-1.5 rounded-xl text-xs font-bold transition-colors backdrop-blur-sm shadow-sm ${
                                useLightFallback
                                  ? 'bg-background/80 hover:bg-background text-foreground border border-border'
                                  : 'bg-black/30 hover:bg-black/50 text-white border border-white/10'
                              }`}
                            >
                              <ArrowLeftRight className="w-3.5 h-3.5 mr-1.5" />
                              Compare
                            </button>
                          )}

                          {/* Copy / Already in Catalog */}
                          <div>
                            {alreadyHaveIt ? (
                              <div className={`flex items-center px-3 py-1.5 rounded-xl text-xs font-bold backdrop-blur-sm ${useLightFallback ? 'bg-background/50 text-foreground border border-border/50' : 'bg-white/20 text-white'}`}>
                                <CheckCircle2 className="w-3.5 h-3.5 mr-1" /> Added
                              </div>
                            ) : (
                              <button
                                type="button"
                                onClick={(e) => { e.stopPropagation(); handleCopyGame(game); }}
                                disabled={copyingId === game.id}
                                className={`flex items-center px-3 py-1.5 rounded-xl text-xs font-bold transition-colors disabled:opacity-50 backdrop-blur-sm ${useLightFallback ? 'bg-primary/10 hover:bg-primary/20 text-primary border border-primary/20' : 'bg-black/30 hover:bg-black/50 text-white'}`}
                              >
                                {copyingId === game.id ? <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" /> : <Copy className="w-3.5 h-3.5 mr-1" />}
                                Add
                              </button>
                            )}
                          </div>
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

      {/* History Modal */}
      {selectedHistoryGame && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm" onClick={() => setSelectedHistoryGame(null)}>
          <div className="bg-card w-full max-w-lg max-h-[85vh] rounded-3xl shadow-2xl border border-border flex flex-col animate-in fade-in zoom-in-95 duration-200" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center p-6 border-b border-border bg-muted/30">
              <div className="flex items-center space-x-3">
                {getGameLogo(selectedHistoryGame) ? (
                  <img src={getGameLogo(selectedHistoryGame)} alt="" className="w-10 h-10 rounded-lg object-cover shadow-sm border border-border" />
                ) : (
                  <Gamepad2 className="w-8 h-8 text-muted-foreground" />
                )}
                <div>
                  <h3 className="text-xl font-extrabold text-foreground leading-none mb-1">
                    {(selectedHistoryGame.custom_name || selectedHistoryGame.global_games?.name || "")}
                  </h3>
                  <p className="text-sm text-muted-foreground font-medium">{selectedUser?.username}'s History</p>
                </div>
              </div>
              <button 
                onClick={() => setSelectedHistoryGame(null)}
                className="text-muted-foreground hover:text-foreground transition-colors bg-background p-1.5 rounded-full border border-border shadow-sm"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="p-6 overflow-y-auto flex-1 space-y-4">
              {historyProgress.length === 0 ? (
                <div className="text-center py-12">
                  <Circle className="w-12 h-12 text-muted-foreground mx-auto mb-3 opacity-30" />
                  <p className="text-muted-foreground font-medium">This user hasn't played this game yet.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {historyProgress.map((prog, i) => (
                    <div key={i} className="p-4 rounded-xl border border-border bg-muted/30 flex flex-col space-y-3">
                      <div className="flex items-center justify-between text-sm font-bold text-foreground">
                        <div className="flex items-center space-x-2">
                          <CheckCircle2 className="w-4 h-4 text-primary" />
                          <span>{new Date(prog.completed_date + 'T00:00:00').toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}</span>
                        </div>
                        {prog.share_text && (
                          <button
                            type="button"
                            onClick={() => {
                              navigator.clipboard.writeText(prog.share_text!);
                              setCopiedHistoryIndex(i);
                              setTimeout(() => setCopiedHistoryIndex(null), 2000);
                            }}
                            className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold border border-border bg-background hover:bg-muted text-muted-foreground hover:text-foreground transition-colors shadow-sm"
                            title="Copy result"
                          >
                            {copiedHistoryIndex === i ? (
                              <>
                                <Check className="w-3.5 h-3.5 text-[#709176]" />
                                <span className="text-[#709176]">Copied!</span>
                              </>
                            ) : (
                              <>
                                <Copy className="w-3.5 h-3.5" />
                                <span>Copy</span>
                              </>
                            )}
                          </button>
                        )}
                      </div>
                      {prog.share_text && (
                        <div className="bg-background border border-border rounded-lg p-3 text-sm whitespace-pre-wrap font-mono text-muted-foreground">
                          {prog.share_text}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Compare Modal (Side-by-Side) */}
      {comparingGame && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm" onClick={() => setComparingGame(null)}>
          <div className="bg-card w-full max-w-2xl max-h-[85vh] rounded-3xl shadow-2xl border border-border flex flex-col animate-in fade-in zoom-in-95 duration-200" onClick={e => e.stopPropagation()}>
            {/* Header */}
            <div className="flex justify-between items-center p-5 sm:p-6 border-b border-border bg-muted/30">
              <div className="flex items-center space-x-3 min-w-0">
                {getGameLogo(comparingGame) ? (
                  <img src={getGameLogo(comparingGame)} alt="" className="w-10 h-10 rounded-xl object-cover shadow-sm border border-border flex-shrink-0" />
                ) : (
                  <Gamepad2 className="w-8 h-8 text-muted-foreground flex-shrink-0" />
                )}
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="text-lg sm:text-xl font-extrabold text-foreground leading-tight truncate">
                      {comparingGame.custom_name || comparingGame.global_games?.name || "Game"}
                    </h3>
                    <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20 shrink-0">
                      Compare
                    </span>
                  </div>
                  <p className="text-xs sm:text-sm text-muted-foreground font-medium truncate">
                    Side-by-side: You vs. <span className="font-bold text-foreground">{selectedUser?.username}</span>
                  </p>
                </div>
              </div>
              <button 
                onClick={() => setComparingGame(null)}
                className="text-muted-foreground hover:text-foreground transition-colors bg-background p-1.5 rounded-full border border-border shadow-sm flex-shrink-0"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Content */}
            <div className="p-5 sm:p-6 overflow-y-auto flex-1 space-y-4">
              {isLoadingComparison ? (
                <div className="flex justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>
              ) : comparisonDays.length === 0 ? (
                <div className="text-center py-12">
                  <ArrowLeftRight className="w-12 h-12 text-muted-foreground mx-auto mb-3 opacity-30" />
                  <p className="text-foreground font-bold text-base mb-1">No shared results to compare</p>
                  <p className="text-xs sm:text-sm text-muted-foreground max-w-sm mx-auto">
                    Neither you nor {selectedUser?.username} have pasted results for this game yet.
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {comparisonDays.map((item) => {
                    const bothPlayed = !!(item.myText && item.friendText);
                    const formattedDate = new Date(item.date + 'T00:00:00').toLocaleDateString(undefined, {
                      weekday: 'short',
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric'
                    });

                    return (
                      <div key={item.date} className="p-4 rounded-2xl border border-border bg-muted/20 space-y-3">
                        {/* Day Header */}
                        <div className="flex items-center justify-between flex-wrap gap-2 pb-2 border-b border-border/60">
                          <span className="text-xs sm:text-sm font-extrabold text-foreground flex items-center gap-1.5">
                            📅 {formattedDate}
                          </span>
                          {bothPlayed ? (
                            <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-[#709176]/15 text-[#709176] border border-[#709176]/30 flex items-center gap-1">
                              <CheckCircle2 className="w-3 h-3" /> Both shared
                            </span>
                          ) : (
                            <span className="text-[11px] font-medium text-muted-foreground">
                              {item.myText ? 'You only' : `${selectedUser?.username} only`}
                            </span>
                          )}
                        </div>

                        {/* Side by side columns */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          {/* You */}
                          <div className="bg-background border border-border rounded-xl p-3 flex flex-col justify-between space-y-2">
                            <div className="flex items-center justify-between text-xs font-bold text-foreground">
                              <span className="flex items-center gap-1.5 text-primary">
                                <span className="w-2 h-2 rounded-full bg-primary"></span>
                                You
                              </span>
                              {item.myText && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    navigator.clipboard.writeText(item.myText!);
                                    setCopiedCompareSide(`${item.date}-my`);
                                    setTimeout(() => setCopiedCompareSide(null), 2000);
                                  }}
                                  className="flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-lg border border-border bg-muted/50 hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                                  title="Copy your result"
                                >
                                  {copiedCompareSide === `${item.date}-my` ? (
                                    <>
                                      <Check className="w-3 h-3 text-[#709176]" />
                                      <span className="text-[#709176]">Copied</span>
                                    </>
                                  ) : (
                                    <>
                                      <Copy className="w-3 h-3" />
                                      <span>Copy</span>
                                    </>
                                  )}
                                </button>
                              )}
                            </div>
                            {item.myText ? (
                              <div className="text-xs sm:text-sm font-mono whitespace-pre-wrap text-foreground bg-muted/30 p-2.5 rounded-lg border border-border/50 max-h-48 overflow-y-auto">
                                {item.myText}
                              </div>
                            ) : (
                              <div className="text-xs text-muted-foreground/70 italic text-center py-4 bg-muted/10 rounded-lg border border-dashed border-border/50">
                                {myMatchingGameId ? 'No result shared this day' : 'Game not in your catalog'}
                              </div>
                            )}
                          </div>

                          {/* Friend */}
                          <div className="bg-background border border-border rounded-xl p-3 flex flex-col justify-between space-y-2">
                            <div className="flex items-center justify-between text-xs font-bold text-foreground">
                              <span className="flex items-center gap-1.5 text-foreground truncate">
                                <span className="w-2 h-2 rounded-full bg-amber-500"></span>
                                <span className="truncate">{selectedUser?.username}</span>
                              </span>
                              {item.friendText && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    navigator.clipboard.writeText(item.friendText!);
                                    setCopiedCompareSide(`${item.date}-friend`);
                                    setTimeout(() => setCopiedCompareSide(null), 2000);
                                  }}
                                  className="flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-lg border border-border bg-muted/50 hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                                  title={`Copy ${selectedUser?.username}'s result`}
                                >
                                  {copiedCompareSide === `${item.date}-friend` ? (
                                    <>
                                      <Check className="w-3 h-3 text-[#709176]" />
                                      <span className="text-[#709176]">Copied</span>
                                    </>
                                  ) : (
                                    <>
                                      <Copy className="w-3 h-3" />
                                      <span>Copy</span>
                                    </>
                                  )}
                                </button>
                              )}
                            </div>
                            {item.friendText ? (
                              <div className="text-xs sm:text-sm font-mono whitespace-pre-wrap text-foreground bg-muted/30 p-2.5 rounded-lg border border-border/50 max-h-48 overflow-y-auto">
                                {item.friendText}
                              </div>
                            ) : (
                              <div className="text-xs text-muted-foreground/70 italic text-center py-4 bg-muted/10 rounded-lg border border-dashed border-border/50">
                                No result shared this day
                              </div>
                            )}
                          </div>
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

