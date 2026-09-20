import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { Flame, Play, CheckCircle2, Circle, Plus, X, Loader2, Pencil, Trash2, Gamepad2, Upload } from 'lucide-react';
import type { Game, Profile } from '../types';

export function Dashboard() {
  // Helper to get logo or favicon
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

  const [profile, setProfile] = useState<Profile | null>(null);
  const [games, setGames] = useState<Game[]>([]);
  const [completedTodayIds, setCompletedTodayIds] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(true);
  const [isMarking, setIsMarking] = useState<string | null>(null);

  // Add/Edit Game Modal State
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingGame, setEditingGame] = useState<Game | null>(null);
  const [newGameName, setNewGameName] = useState('');
  const [newGameUrl, setNewGameUrl] = useState('');
  const [newGameColor, setNewGameColor] = useState('#709176');
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [addingRec, setAddingRec] = useState<string | null>(null);
  const [isAdding, setIsAdding] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);

  const openAddModal = () => {
    setEditingGame(null);
    setNewGameName('');
    setNewGameUrl('');
    setNewGameColor('#709176');
    setLogoFile(null);
    setAddError(null);
    setIsAddModalOpen(true);
  };

  const openEditModal = (game: Game) => {
    setEditingGame(game);
    setNewGameName((game.custom_name || game.global_games?.name || ""));
    setNewGameUrl((game.global_games?.url || ""));
    setNewGameColor((game.custom_color || game.global_games?.color || "#333333") || '#709176');
    setLogoFile(null);
    setAddError(null);
  };

  const uploadLogo = async (file: File): Promise<string> => {
    const fileExt = file.name.split('.').pop();
    const fileName = `${Math.random().toString(36).substring(2)}-${Date.now()}.${fileExt}`;
    const filePath = `${fileName}`;

    const { error: uploadError } = await supabase.storage
      .from('game-logos')
      .upload(filePath, file);

    if (uploadError) throw uploadError;

    const { data } = supabase.storage.from('game-logos').getPublicUrl(filePath);
    return data.publicUrl;
  };

  const handleUpdateGame = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingGame) return;
    setIsAdding(true);
    setAddError(null);

    try {
      let finalLogoUrl = editingGame.custom_logo_url;
      if (logoFile) {
        finalLogoUrl = await uploadLogo(logoFile);
      }

      const { error } = await supabase.from('user_games').update({
        custom_name: newGameName.trim() !== editingGame.global_games?.name ? newGameName.trim() : null,
        custom_color: newGameColor !== editingGame.global_games?.color ? newGameColor : null,
        custom_logo_url: finalLogoUrl
      }).eq('id', editingGame.id);

      if (error) throw error;

      setEditingGame(null);
      await loadData();
    } catch (err: any) {
      setAddError(err.message || 'Error updating game.');
    } finally {
      setIsAdding(false);
    }
  };

  const handleDeleteGame = async (game: Game) => {
    if (!window.confirm(`Are you sure you want to delete "${(game.custom_name || game.global_games?.name || "")}"? You will lose your current streak.`)) {
      return;
    }
    
    const { error } = await supabase.from('user_games').delete().eq('id', game.id);
    if (!error) {
      await loadData();
    }
  };

  const loadData = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;

    // Fetch Profile
    const { data: profileData } = await supabase
      .from('profiles')
      .select('*, global_games(*)')
      .eq('id', session.user.id)
      .single();
    if (profileData) setProfile(profileData);

    // Fetch Games
    const { data: gamesData, error: gamesError } = await supabase
      .from('user_games')
      .select('*, global_games(*)')
      .eq('user_id', session.user.id)
      .order('created_at', { ascending: false });
    
    if (!gamesError && gamesData) {
      setGames(gamesData);
    }

    // Fetch Progress
    const today = new Date().toISOString().split('T')[0];
    const { data: progressData, error: progressError } = await supabase
      .from('daily_progress')
      .select('game_id')
      .eq('user_id', session.user.id)
      .eq('completed_date', today);

    if (!progressError && progressData) {
      const completedIds = new Set(progressData.map(p => p.game_id));
      setCompletedTodayIds(completedIds);
    }

    setIsLoading(false);
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleMarkCompleted = async (e: React.MouseEvent, gameId: string) => {
    e.preventDefault();
    e.stopPropagation();
    setIsMarking(gameId);
    
    const isCompleted = completedTodayIds.has(gameId);
    
    if (isCompleted) {
      const today = new Date().toISOString().split('T')[0];
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        const { error } = await supabase
          .from('daily_progress')
          .delete()
          .eq('user_id', session.user.id)
          .eq('game_id', gameId)
          .eq('completed_date', today);
          
        if (!error) {
          await loadData();
        }
      }
    } else {
      const { error } = await supabase.rpc('mark_game_completed', {
        p_game_id: gameId
      });
  
      if (!error) {
        await loadData();
      } else {
        console.error("Error marcando completado:", error);
      }
    }
    
    setIsMarking(null);
  };

  
  // Auto-extract name from URL
  const handleUrlChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const urlStr = e.target.value;
    setNewGameUrl(urlStr);
    
    if (!newGameName.trim() && urlStr.trim()) {
      let parseUrl = urlStr.trim();
      if (!parseUrl.startsWith('http://') && !parseUrl.startsWith('https://')) {
        parseUrl = 'https://' + parseUrl;
      }
      
      try {
        const urlObj = new URL(parseUrl);
        const pathSegments = urlObj.pathname.split('/').filter(Boolean);
        let extractedName = '';
        
        if (pathSegments.length > 0) {
           const lastSegment = pathSegments[pathSegments.length - 1];
           if (!lastSegment.includes('.')) {
              extractedName = lastSegment;
           } else if (pathSegments.length > 1) {
              extractedName = pathSegments[pathSegments.length - 2];
           }
        }
        
        if (!extractedName) {
           const domainParts = urlObj.hostname.replace(/^www\./, '').split('.');
           extractedName = domainParts[0];
        }

        if (extractedName) {
          const capitalized = extractedName.charAt(0).toUpperCase() + extractedName.slice(1).replace(/-/g, ' ').toLowerCase();
          setNewGameName(capitalized);
        }
      } catch {
        // Invalid URL yet
      }
    }
  };

  const handleUrlBlur = () => {
    if (newGameUrl.trim() && !newGameUrl.startsWith('http://') && !newGameUrl.startsWith('https://')) {
      setNewGameUrl('https://' + newGameUrl.trim());
    }
  };
const handleAddGame = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsAdding(true);
    setAddError(null);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('No session');

      let rawUrl = newGameUrl.trim();
      if (!rawUrl.startsWith("http://") && !rawUrl.startsWith("https://")) {
        rawUrl = "https://" + rawUrl;
      }
      
      let normalizedUrl = rawUrl;
      try {
        const parsed = new URL(rawUrl);
        normalizedUrl = parsed.href;
        if (normalizedUrl.endsWith('/')) {
            normalizedUrl = normalizedUrl.slice(0, -1);
        }
      } catch (err) {
        // fallback if invalid URL
        if (normalizedUrl.endsWith('/')) {
            normalizedUrl = normalizedUrl.slice(0, -1);
        }
      }
      
      let globalGameId;

      const { data: existingGlobal, } = await supabase
        .from('global_games')
        .select('id, name, color, logo_url')
        .eq('url', normalizedUrl)
        .maybeSingle();

      if (existingGlobal) {
        globalGameId = existingGlobal.id;
      } else {
        // Extract domain for favicon
        let domain = "";
        try {
            domain = new URL(normalizedUrl).hostname;
        } catch(e) {}
        
        const generatedFavicon = domain ? `https://www.google.com/s2/favicons?domain=${domain}&sz=128` : null;

        const { data: newGlobal, error: newGlobalError } = await supabase
          .from('global_games')
          .insert({
            url: normalizedUrl,
            name: newGameName.trim() || 'New Game',
            color: '#333333',
            logo_url: generatedFavicon
          })
          .select()
          .single();
        if (newGlobalError) throw newGlobalError;
        globalGameId = newGlobal.id;
      }

      const { error } = await supabase.from('user_games').insert({
        user_id: session.user.id,
        global_game_id: globalGameId,
        custom_name: null,
        custom_color: null,
        custom_logo_url: null
      });

      if (error) throw error;
      setNewGameUrl('');
      setNewGameColor('#709176');
      setLogoFile(null);
      await loadData();
      setIsAddModalOpen(false);
    } catch (err: any) {
      setAddError(err.message || 'Error adding game.');
    } finally {
      setIsAdding(false);
    }
  };

  // Recommendations state
  const [showRecommendations, setShowRecommendations] = useState(() => {
    return localStorage.getItem('hideRecommendations') !== 'true';
  });

  // Weekly progress
  const [weeklyProgress, setWeeklyProgress] = useState<Record<string, number>>({});
  
  useEffect(() => {
    const fetchWeeklyProgress = async () => {
      if (!profile || games.length === 0) return;
      
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const weekAgo = new Date();
      weekAgo.setDate(weekAgo.getDate() - 7);
      const weekAgoStr = weekAgo.toISOString().split('T')[0];

      const { data } = await supabase
        .from('daily_progress')
        .select('completed_date, game_id')
        .eq('user_id', session.user.id)
        .gte('completed_date', weekAgoStr);

      if (data) {
        const progress: Record<string, Set<string>> = {};
        data.forEach(p => {
          if (!progress[p.completed_date]) {
            progress[p.completed_date] = new Set();
          }
          progress[p.completed_date].add(p.game_id);
        });

        const progressCounts: Record<string, number> = {};
        Object.keys(progress).forEach(date => {
          progressCounts[date] = progress[date].size;
        });
        setWeeklyProgress(progressCounts);
      }
    };
    
    fetchWeeklyProgress();
  }, [profile, games.length]);

  if (isLoading) {
    
  
return (
      <div className="flex justify-center items-center h-64">
        <Loader2 className="w-10 h-10 animate-spin text-primary" />
      </div>
    );
  }

  // Dashboard calculations
  const totalGames = games.length;
  const completedGamesCount = completedTodayIds.size;
  const remainingGames = totalGames - completedGamesCount;
  
  // Date formatting
  const today = new Date();
  
  

  const dismissRecommendations = () => {
    localStorage.setItem('hideRecommendations', 'true');
    setShowRecommendations(false);
  };

  
  const todayIndex = (today.getDay() + 6) % 7; // Monday = 0, Sunday = 6
  
  const getDayStatus = (offsetFromToday: number) => {
    if (totalGames === 0) return false;
    const d = new Date();
    d.setDate(d.getDate() - offsetFromToday);
    const dStr = d.toISOString().split('T')[0];
    const completedCount = weeklyProgress[dStr] || 0;
    return completedCount >= totalGames;
  };

  return (
    <div className="space-y-8">
      {/* Seamless Minimalist Hero */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-6 mb-2">
          <div className="flex-1 space-y-3">
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-foreground">
              {totalGames === 0 
                ? 'Start by adding your first game.'
                : remainingGames === 0 
                  ? 'You have completed all your games today!' 
                  : `You have ${remainingGames} game${remainingGames === 1 ? "" : "s"} left to complete today.`}
            </h1>
            
            {/* Weekly Progress Bar */}
            <div className="flex items-center space-x-2 mt-2">
              {[0, 1, 2, 3, 4, 5, 6].map((dayIndex) => {
                const offset = todayIndex - dayIndex;
                const isFuture = offset < 0;
                const isCompleted = !isFuture && getDayStatus(offset);
                const isToday = offset === 0;
                return (
                  <div key={dayIndex} className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs transition-all ${
                      isCompleted 
                        ? 'bg-foreground text-background shadow-sm' 
                        : isToday
                          ? 'bg-muted text-foreground ring-2 ring-primary ring-offset-2 ring-offset-background'
                          : isFuture
                            ? 'bg-transparent text-muted-foreground/30 border border-border/50'
                            : 'bg-muted text-muted-foreground'
                    }`}>
                    {['S', 'M', 'T', 'W', 'T', 'F', 'S'][(new Date(new Date().setDate(new Date().getDate() - offset))).getDay()]}
                  </div>
                );
              })}
            </div>
          </div>
          
          <button
            onClick={openAddModal}
            className="flex items-center justify-center py-2.5 px-5 text-sm font-bold rounded-xl text-primary-foreground bg-primary hover:opacity-90 transition-colors shadow-sm whitespace-nowrap w-full sm:w-auto"
          >
            <Plus className="w-4 h-4 mr-1.5" />
            Add Game
          </button>
        </div>

      {games.length === 0 ? (
        <div className="text-center py-12 bg-card rounded-2xl border border-border shadow-sm mb-8">
          <Gamepad2 className="w-12 h-12 text-muted-foreground mx-auto mb-4 opacity-50" />
          <p className="text-muted-foreground text-lg mb-6">You have no games in your catalog yet.</p>
          <button
            onClick={openAddModal}
            className="inline-flex items-center justify-center py-2.5 px-5 font-bold rounded-xl text-primary-foreground bg-primary hover:opacity-90 transition-colors shadow-sm"
          >
            <Plus className="w-5 h-5 mr-1.5" />
            Add your first game
          </button>
        </div>
      ) : (
        <div className="flex flex-col sm:grid sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-5 mb-8">
            {games.map((game) => {
              const isCompleted = completedTodayIds.has(game.id);
  
              return (
                <div 
                  key={game.id}
                  className="group relative flex flex-row sm:flex-col items-center sm:items-start justify-between p-4 sm:p-5 rounded-xl sm:rounded-2xl border border-border bg-card hover:bg-muted/30 transition-all sm:hover:border-primary/50 gap-4"
                >
                  {/* Invisible Link covering the whole card for Play */}
                  <a 
                    href={game.global_games?.url || ""}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="absolute inset-0 z-0 rounded-xl sm:rounded-2xl"
                    aria-label={`Play ${game.custom_name || game.global_games?.name}`}
                  ></a>

                  {/* Absolute Edit/Delete Menu (Desktop hover) */}
                  <div className="hidden sm:flex absolute top-3 right-3 items-center space-x-1 opacity-0 group-hover:opacity-100 transition-opacity z-20">
                    <button onClick={(e) => { e.preventDefault(); e.stopPropagation(); openEditModal(game); }} className="p-1.5 text-muted-foreground hover:text-foreground transition-colors rounded-md hover:bg-background shadow-sm border border-border bg-card relative" title="Edit">
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                    <button onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleDeleteGame(game); }} className="p-1.5 text-muted-foreground hover:text-destructive transition-colors rounded-md hover:bg-destructive/10 shadow-sm border border-border bg-card relative" title="Delete">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  <div className="flex items-center space-x-4 min-w-0 flex-1 w-full z-10 pointer-events-none">
                    {getGameLogo(game) ? (
                      <img src={getGameLogo(game)} alt={(game.custom_name || game.global_games?.name || "")} className="w-12 h-12 sm:w-14 sm:h-14 rounded-xl object-cover shadow-sm border border-border flex-shrink-0" />
                    ) : (
                      <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-xl shadow-sm border border-border flex items-center justify-center text-white font-bold text-lg sm:text-xl flex-shrink-0" style={{ backgroundColor: (game.custom_color || game.global_games?.color || "#333333") || '#333' }}>
                        {(game.custom_name || game.global_games?.name || "").charAt(0).toUpperCase()}
                      </div>
                    )}
                    
                    <div className="flex flex-col min-w-0 sm:pr-8">
                      <h3 className="text-lg font-bold text-foreground truncate" title={(game.custom_name || game.global_games?.name || "")}>
                        {(game.custom_name || game.global_games?.name || "")}
                      </h3>
                      
                      <div className="flex items-center space-x-3 mt-0.5 sm:mt-1">
                        {/* Relaxed custom color Streak */}
                        {game.current_streak > 0 && (
                          <div className="flex items-center font-bold text-sm" style={{ color: '#D4A336' }}>
                            <Flame className="w-3.5 h-3.5 mr-1" />
                            {game.current_streak}
                          </div>
                        )}
                        
                        {/* Status inline */}
                        <div className="hidden sm:flex items-center text-sm font-semibold">
                          {isCompleted ? (
                            <span className="text-foreground/60 flex items-center"><CheckCircle2 className="w-3.5 h-3.5 mr-1" /> Done</span>
                          ) : (
                            <span className="text-muted-foreground/50 flex items-center"><Circle className="w-3.5 h-3.5 mr-1" /> Pending</span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                  
                  {/* Buttons wrapper (z-10 so they are clickable above the absolute link) */}
                  <div className="flex items-center justify-end space-x-2 w-auto sm:w-full sm:mt-2 z-10 relative">
                    
                    {/* Mobile Edit/Delete */}
                    <div className="flex sm:hidden items-center space-x-1 mr-1">
                      <button onClick={(e) => { e.preventDefault(); e.stopPropagation(); openEditModal(game); }} className="p-2 text-muted-foreground hover:text-foreground relative" title="Edit">
                        <Pencil className="w-4 h-4" />
                      </button>
                      <button onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleDeleteGame(game); }} className="p-2 text-muted-foreground hover:text-destructive relative" title="Delete">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                    
                    <a 
                      href={game.global_games?.url || ""}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="hidden sm:flex flex-1 items-center justify-center py-2.5 px-4 bg-background hover:bg-muted border border-border text-foreground font-bold rounded-xl transition-colors text-sm shadow-sm relative"
                    >
                      <Play className="w-4 h-4 mr-2" />
                      Play
                    </a>

                    <button
                      onClick={(e) => handleMarkCompleted(e, game.id)}
                      disabled={isMarking === game.id}
                      className={`relative flex items-center justify-center py-2 px-3 sm:py-2.5 sm:px-4 sm:flex-1 font-bold rounded-lg sm:rounded-xl transition-colors disabled:opacity-50 text-sm whitespace-nowrap shadow-sm ${
                        isCompleted 
                          ? 'bg-muted text-muted-foreground hover:bg-muted/70 border border-border' 
                          : 'bg-primary text-primary-foreground hover:opacity-90'
                      }`}
                    >
                      {isMarking === game.id ? (
                         <Loader2 className="w-4 h-4 sm:mr-2 animate-spin" />
                      ) : isCompleted ? (
                         <CheckCircle2 className="w-4 h-4 sm:mr-2" />
                      ) : (
                         <CheckCircle2 className="w-4 h-4 sm:mr-2" />
                      )}
                      <span className="hidden sm:inline">{isCompleted ? 'Undo' : 'Mark Done'}</span>
                      <span className="sm:hidden ml-1.5">{isCompleted ? 'Undo' : 'Done'}</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {(showRecommendations || games.length === 0) && (
        <div className="bg-muted/30 p-6 rounded-3xl border border-border mt-8">
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-lg font-bold text-foreground">Popular Recommendations</h3>
            {games.length > 0 && (
              <button onClick={dismissRecommendations} className="text-muted-foreground hover:text-foreground p-2 rounded-full hover:bg-muted transition-colors" title="Hide recommendations">
                <X className="w-5 h-5" />
              </button>
            )}
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {[
              { name: 'Wordle', url: 'https://www.nytimes.com/games/wordle/index.html', icon: 'https://www.nytimes.com/games-assets/v2/metadata/wordle-apple-touch-icon.png' },
              { name: 'Connections', url: 'https://www.nytimes.com/games/connections', icon: 'https://www.nytimes.com/games-assets/v2/metadata/connections-apple-touch-icon.png' },
              { name: 'Strands', url: 'https://www.nytimes.com/games/strands', icon: 'https://www.nytimes.com/games-assets/v2/metadata/strands-apple-touch-icon.png' }
            ].map((rec) => {
              const alreadyHasIt = games.some(g => (g.custom_name || g.global_games?.name) === rec.name);
              if (alreadyHasIt) return null;
              
              return (
                <div key={rec.name} className="flex flex-col p-4 rounded-xl border border-border bg-card shadow-sm hover:shadow-md transition-shadow group">
                  <div className="flex items-center space-x-3 mb-4">
                    <img src={rec.icon} alt={rec.name} className="w-10 h-10 rounded-xl object-cover shadow-sm flex-shrink-0 border border-border" />
                    <span className="font-bold text-foreground truncate">{rec.name}</span>
                  </div>
                  <button
                    disabled={addingRec === rec.name}
                    onClick={async () => {
                      setAddingRec(rec.name);
                      try {
                        const { data: { session } } = await supabase.auth.getSession();
                        if (session) {
                          const { data: existingGlobal } = await supabase.from('global_games').select('id').eq('url', rec.url).maybeSingle();
                          let gId = existingGlobal?.id;
                          if (!gId) {
                              const { data: newG } = await supabase.from('global_games').insert({ url: rec.url, name: rec.name, logo_url: rec.icon, color: '#333333' }).select().single();
                              gId = newG.id;
                          }
                          await supabase.from('user_games').insert({ user_id: session.user.id, global_game_id: gId });

                          await loadData();
                        }
                      } finally {
                        setAddingRec(null);
                      }
                    }}
                    className="mt-auto flex items-center justify-center py-2 px-3 bg-primary text-primary-foreground hover:opacity-90 rounded-lg text-sm font-bold transition-colors w-full shadow-sm disabled:opacity-50"
                  >
                    {addingRec === rec.name ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> : <Plus className="w-4 h-4 mr-1.5" />}
                    Add
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Add/Edit Game Modal */}
      {(isAddModalOpen || editingGame) && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm">
          <div className="bg-card w-full max-w-md rounded-3xl shadow-2xl border border-border overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="flex justify-between items-center p-6 border-b border-border bg-muted/30">
              <h3 className="text-xl font-extrabold text-foreground tracking-tight">
                {editingGame ? 'Edit Game' : 'Add New Game'}
              </h3>
              <button 
                onClick={() => {
                  setIsAddModalOpen(false);
                  setEditingGame(null);
                }}
                className="text-muted-foreground hover:text-foreground transition-colors bg-background p-1.5 rounded-full border border-border shadow-sm"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <form onSubmit={editingGame ? handleUpdateGame : handleAddGame} className="p-6 space-y-5">
              <div className="space-y-4">
                <div className="space-y-1.5">
                  <label htmlFor="url" className="text-sm font-bold text-foreground">URL Link</label>
                  <input
                      id="url"
                      type="text"
                      inputMode="url"
                      required
                      placeholder="e.g. minicrossword.com"
                      value={newGameUrl}
                      onChange={handleUrlChange}
                      onBlur={handleUrlBlur}
                      className="w-full px-4 py-2.5 border bg-background border-border rounded-xl text-foreground focus:outline-none focus:ring-2 focus:ring-primary shadow-sm transition-shadow"
                    />
                </div>
                
                {editingGame && (
                  <div className="space-y-1.5">
                  <label htmlFor="name" className="text-sm font-bold text-foreground">Game Name</label>
                  <input
                    id="name"
                    type="text"
                    required
                    placeholder="e.g. Wordle, Framed..."
                    value={newGameName}
                    onChange={(e) => setNewGameName(e.target.value)}
                    className="w-full px-4 py-2.5 border bg-background border-border rounded-xl text-foreground focus:outline-none focus:ring-2 focus:ring-primary shadow-sm transition-shadow"
                  />
                </div>
                  )}

                {editingGame && (
                  <div className="space-y-1.5">
                  <label htmlFor="logo" className="text-sm font-bold text-foreground">Game Logo (Optional)</label>
                  <div className="flex items-center justify-center w-full">
                    <label htmlFor="logo" className="flex flex-col items-center justify-center w-full h-24 border-2 border-dashed border-border rounded-xl cursor-pointer bg-background hover:bg-muted/50 transition-colors">
                      <div className="flex flex-col items-center justify-center pt-5 pb-6">
                        <Upload className="w-6 h-6 text-muted-foreground mb-2" />
                        <p className="text-xs text-muted-foreground font-medium">
                          {logoFile ? logoFile.name : (editingGame?.custom_logo_url ? 'Upload new logo to replace' : 'Click to upload image')}
                        </p>
                      </div>
                      <input id="logo" type="file" accept="image/*" className="hidden" onChange={(e) => {
                        if (e.target.files && e.target.files[0]) {
                          setLogoFile(e.target.files[0]);
                        }
                      }} />
                    </label>
                  </div>
                </div>
                  )}
                  
              </div>

              {addError && (
                <div className="p-3 text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-xl font-bold">
                  {addError}
                </div>
              )}

              <div className="flex justify-end gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => {
                    setIsAddModalOpen(false);
                    setEditingGame(null);
                  }}
                  className="px-5 py-2.5 text-sm font-bold text-foreground bg-background border border-border hover:bg-muted rounded-xl transition-colors shadow-sm"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isAdding}
                  className="flex items-center justify-center min-w-[120px] px-5 py-2.5 text-sm font-bold text-primary-foreground bg-primary hover:opacity-90 rounded-xl transition-colors disabled:opacity-50 shadow-sm"
                >
                  {isAdding ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : editingGame ? (
                    'Update'
                  ) : (
                    'Save Game'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
