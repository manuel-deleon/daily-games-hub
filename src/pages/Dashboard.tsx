import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { Flame, Play, CheckCircle2, Circle, Plus, X, Loader2, Pencil, Trash2, Calendar, Gamepad2, Upload } from 'lucide-react';
import type { Game, Profile } from '../types';

export function Dashboard() {
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
    setNewGameName(game.name);
    setNewGameUrl(game.url);
    setNewGameColor(game.color || '#709176');
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
      let finalLogoUrl = editingGame.logo_url;
      if (logoFile) {
        finalLogoUrl = await uploadLogo(logoFile);
      }

      const { error } = await supabase
        .from('games')
        .update({
          name: newGameName.trim(),
          url: newGameUrl.trim(),
          color: newGameColor,
          logo_url: finalLogoUrl
        })
        .eq('id', editingGame.id);

      if (error) throw error;

      setEditingGame(null);
      await loadData();
    } catch (err: any) {
      setAddError(err.message || 'Error al actualizar el juego.');
    } finally {
      setIsAdding(false);
    }
  };

  const handleDeleteGame = async (game: Game) => {
    if (!window.confirm(`¿Estás seguro de que quieres eliminar "${game.name}"? Perderás tu racha actual.`)) {
      return;
    }
    
    const { error } = await supabase.from('games').delete().eq('id', game.id);
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
      .select('*')
      .eq('id', session.user.id)
      .single();
    if (profileData) setProfile(profileData);

    // Fetch Games
    const { data: gamesData, error: gamesError } = await supabase
      .from('games')
      .select('*')
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

  const handleMarkCompleted = async (gameId: string) => {
    setIsMarking(gameId);
    
    const { error } = await supabase.rpc('mark_game_completed', {
      p_game_id: gameId
    });

    if (!error) {
      await loadData();
    } else {
      console.error("Error marcando completado:", error);
    }
    
    setIsMarking(null);
  };

  const handleAddGame = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsAdding(true);
    setAddError(null);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('No session');

      let finalLogoUrl = null;
      if (logoFile) {
        finalLogoUrl = await uploadLogo(logoFile);
      }

      const { error } = await supabase.from('games').insert({
        user_id: session.user.id,
        name: newGameName.trim(),
        url: newGameUrl.trim(),
        color: newGameColor,
        logo_url: finalLogoUrl
      });

      if (error) throw error;

      setIsAddModalOpen(false);
      setNewGameName('');
      setNewGameUrl('');
      setNewGameColor('#709176');
      setLogoFile(null);
      await loadData();
    } catch (err: any) {
      setAddError(err.message || 'Error al añadir el juego.');
    } finally {
      setIsAdding(false);
    }
  };

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
  const options: Intl.DateTimeFormatOptions = { weekday: 'long', month: 'long', day: 'numeric' };
  const dateString = today.toLocaleDateString('es-ES', options);

  return (
    <div className="space-y-8">
      {/* Hero Header */}
      <div className="bg-card border border-border rounded-3xl p-6 sm:p-10 shadow-sm flex flex-col sm:flex-row items-center sm:items-start justify-between gap-6 relative overflow-hidden">
        {/* Background Accent */}
        <div className="absolute -top-24 -right-24 w-48 h-48 bg-primary/10 rounded-full blur-3xl pointer-events-none"></div>

        <div className="flex flex-col items-center sm:items-start z-10">
          <div className="flex items-center text-primary font-semibold mb-2">
            <Calendar className="w-5 h-5 mr-2" />
            <span className="capitalize">{dateString}</span>
          </div>
          <h1 className="text-4xl sm:text-5xl font-extrabold text-foreground tracking-tight mb-2">
            Tu Progreso
          </h1>
          <p className="text-muted-foreground text-lg">
            {totalGames === 0 
              ? 'Empieza añadiendo tu primer juego.'
              : remainingGames === 0 
                ? '¡Has completado todos tus juegos hoy!' 
                : `Te faltan ${remainingGames} ${remainingGames === 1 ? 'juego' : 'juegos'} por hacer hoy.`}
          </p>
        </div>

        <div className="flex flex-col items-center justify-center bg-background rounded-2xl p-6 border border-border min-w[160px] z-10 shadow-sm">
          <span className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-1">Racha Global</span>
          <div className="flex items-center text-orange-500">
            <Flame className="w-10 h-10 mr-1" />
            <span className="text-5xl font-black">{profile?.global_streak || 0}</span>
          </div>
        </div>
      </div>

      {/* Catalog Header */}
      <div className="flex justify-between items-end flex-wrap gap-4 mt-8 mb-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-foreground">Tu Catálogo</h2>
        </div>
        
        <button
          onClick={openAddModal}
          className="flex items-center justify-center py-2 px-4 text-sm font-bold rounded-lg text-primary-foreground bg-primary hover:opacity-90 transition-colors shadow-sm"
        >
          <Plus className="w-4 h-4 mr-1.5" />
          Añadir Juego
        </button>
      </div>

      {games.length === 0 ? (
        <div className="space-y-6">
          <div className="text-center py-12 bg-card rounded-2xl border border-border shadow-sm">
            <Gamepad2 className="w-12 h-12 text-muted-foreground mx-auto mb-4 opacity-50" />
            <p className="text-muted-foreground text-lg mb-6">No tienes juegos en tu catálogo aún.</p>
            <button
              onClick={openAddModal}
              className="inline-flex items-center justify-center py-2.5 px-5 font-bold rounded-xl text-primary-foreground bg-primary hover:opacity-90 transition-colors shadow-sm"
            >
              <Plus className="w-5 h-5 mr-1.5" />
              Añadir tu primer juego
            </button>
          </div>
          
          <div>
            <h3 className="text-lg font-bold text-foreground mb-4">Populares Recomendados</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[
                { name: 'Wordle', url: 'https://www.nytimes.com/games/wordle/index.html', color: '#538d4e' },
                { name: 'Connections', url: 'https://www.nytimes.com/games/connections', color: '#b4a5e5' },
                { name: 'Framed', url: 'https://framed.wtf/', color: '#1f1f23' },
                { name: 'Loldle', url: 'https://loldle.net/', color: '#0a1428' },
                { name: 'Pokedle', url: 'https://pokedle.net/', color: '#ef4444' },
                { name: 'Tradle', url: 'https://oec.world/en/tradle/', color: '#0ea5e9' }
              ].map((rec) => (
                <div key={rec.name} className="flex flex-col p-4 rounded-xl border border-border bg-card shadow-sm hover:shadow-md transition-shadow group">
                  <div className="flex items-center space-x-3 mb-4">
                    <div className="w-10 h-10 rounded-xl shadow-sm flex-shrink-0" style={{ backgroundColor: rec.color }}></div>
                    <span className="font-bold text-foreground truncate">{rec.name}</span>
                  </div>
                  <button
                    onClick={async () => {
                      const { data: { session } } = await supabase.auth.getSession();
                      if (session) {
                        await supabase.from('games').insert({ user_id: session.user.id, name: rec.name, url: rec.url, color: rec.color });
                        await loadData();
                      }
                    }}
                    className="mt-auto py-2 px-3 bg-muted text-muted-foreground hover:bg-primary hover:text-primary-foreground group-hover:bg-primary group-hover:text-primary-foreground rounded-lg text-sm font-bold transition-colors w-full"
                  >
                    + Agregar
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {games.map((game) => {
            const isCompleted = completedTodayIds.has(game.id);

            return (
              <div 
                key={game.id} 
                className="group flex flex-col justify-between overflow-hidden rounded-2xl border border-border bg-card transition-all duration-300 hover:shadow-lg hover:border-primary/50"
              >
                <div className="p-5 flex flex-col flex-grow">
                  <div className="flex justify-between items-start mb-4">
                    <div className="flex items-center space-x-3 min-w-0">
                      {game.logo_url ? (
                        <img src={game.logo_url} alt={game.name} className="w-12 h-12 rounded-xl object-cover shadow-sm flex-shrink-0 border border-border" />
                      ) : (
                        <div className="w-12 h-12 rounded-xl shadow-sm flex-shrink-0 border border-border flex items-center justify-center text-white font-bold text-lg" style={{ backgroundColor: game.color || '#333' }}>
                          {game.name.charAt(0).toUpperCase()}
                        </div>
                      )}
                      <h3 className="text-lg font-bold text-foreground truncate" title={game.name}>{game.name}</h3>
                    </div>
                    
                    {/* Actions Menu (Edit/Delete) */}
                    <div className="flex space-x-1 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0 ml-2 bg-background/80 rounded-lg p-1 backdrop-blur-sm border border-border shadow-sm">
                      <button onClick={() => openEditModal(game)} className="p-1.5 text-muted-foreground hover:text-foreground transition-colors rounded-md hover:bg-muted" title="Editar">
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <button onClick={() => handleDeleteGame(game)} className="p-1.5 text-muted-foreground hover:text-destructive transition-colors rounded-md hover:bg-destructive/10" title="Eliminar">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                  
                  <div className="mt-auto">
                    <div className="flex items-center justify-between mb-4 bg-background p-3 rounded-xl border border-border">
                      <div className="flex flex-col">
                        <span className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground mb-0.5">Racha Actual</span>
                        <div className="flex items-center">
                          <Flame className={`w-4 h-4 mr-1 ${game.current_streak > 0 ? 'text-orange-500' : 'text-muted-foreground'}`} />
                          <span className="font-extrabold text-foreground">{game.current_streak}</span>
                        </div>
                      </div>
                      
                      <div className="flex flex-col items-end">
                        <span className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground mb-0.5">Estado hoy</span>
                        <div className="flex items-center font-bold text-sm">
                          {isCompleted ? (
                            <span className="text-green-500 flex items-center"><CheckCircle2 className="w-4 h-4 mr-1" /> Completado</span>
                          ) : (
                            <span className="text-muted-foreground flex items-center"><Circle className="w-4 h-4 mr-1" /> Pendiente</span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="p-3 bg-muted/50 border-t border-border flex space-x-2">
                  <a 
                    href={game.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex-1 flex items-center justify-center py-2 px-4 bg-background hover:bg-card border border-border text-foreground font-bold rounded-lg transition-colors text-sm shadow-sm"
                  >
                    <Play className="w-4 h-4 mr-1.5" />
                    Jugar
                  </a>
                  
                  <button
                    onClick={() => handleMarkCompleted(game.id)}
                    disabled={isCompleted || isMarking === game.id}
                    className={`flex-1 flex items-center justify-center py-2 px-4 font-bold rounded-lg transition-colors text-sm shadow-sm ${
                      isCompleted 
                        ? 'bg-green-500/20 text-green-600 dark:text-green-400 cursor-default' 
                        : 'bg-primary hover:opacity-90 text-primary-foreground'
                    }`}
                  >
                    {isMarking === game.id ? (
                      <Loader2 className="animate-spin h-4 w-4" />
                    ) : isCompleted ? (
                      'Completado'
                    ) : (
                      'Marcar Listo'
                    )}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Add/Edit Game Modal */}
      {(isAddModalOpen || editingGame) && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm">
          <div className="bg-card w-full max-w-md rounded-3xl shadow-2xl border border-border overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="flex justify-between items-center p-6 border-b border-border bg-muted/30">
              <h3 className="text-xl font-extrabold text-foreground tracking-tight">
                {editingGame ? 'Editar Juego' : 'Añadir Nuevo Juego'}
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
                  <label htmlFor="name" className="text-sm font-bold text-foreground">Nombre del Juego</label>
                  <input
                    id="name"
                    type="text"
                    required
                    placeholder="Ej. Wordle, Framed..."
                    value={newGameName}
                    onChange={(e) => setNewGameName(e.target.value)}
                    className="w-full px-4 py-2.5 border bg-background border-border rounded-xl text-foreground focus:outline-none focus:ring-2 focus:ring-primary shadow-sm transition-shadow"
                  />
                </div>
                
                <div className="space-y-1.5">
                  <label htmlFor="url" className="text-sm font-bold text-foreground">Enlace (URL)</label>
                  <input
                    id="url"
                    type="url"
                    required
                    placeholder="https://..."
                    value={newGameUrl}
                    onChange={(e) => setNewGameUrl(e.target.value)}
                    className="w-full px-4 py-2.5 border bg-background border-border rounded-xl text-foreground focus:outline-none focus:ring-2 focus:ring-primary shadow-sm transition-shadow"
                  />
                </div>

                <div className="space-y-1.5">
                  <label htmlFor="logo" className="text-sm font-bold text-foreground">Logo del Juego (Opcional)</label>
                  <div className="flex items-center justify-center w-full">
                    <label htmlFor="logo" className="flex flex-col items-center justify-center w-full h-24 border-2 border-dashed border-border rounded-xl cursor-pointer bg-background hover:bg-muted/50 transition-colors">
                      <div className="flex flex-col items-center justify-center pt-5 pb-6">
                        <Upload className="w-6 h-6 text-muted-foreground mb-2" />
                        <p className="text-xs text-muted-foreground font-medium">
                          {logoFile ? logoFile.name : (editingGame?.logo_url ? 'Subir nuevo logo para reemplazar' : 'Haz clic para subir imagen')}
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

                <div className="space-y-1.5">
                  <label htmlFor="color" className="text-sm font-bold text-foreground">Color decorativo</label>
                  <div className="flex items-center space-x-3">
                    <div className="relative overflow-hidden rounded-xl shadow-sm border border-border w-16 h-10">
                      <input
                        id="color"
                        type="color"
                        value={newGameColor}
                        onChange={(e) => setNewGameColor(e.target.value)}
                        className="absolute -top-2 -left-2 w-24 h-24 cursor-pointer"
                      />
                    </div>
                    <span className="text-sm text-muted-foreground font-mono font-medium">{newGameColor}</span>
                  </div>
                </div>
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
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isAdding}
                  className="flex items-center justify-center min-w-[120px] px-5 py-2.5 text-sm font-bold text-primary-foreground bg-primary hover:opacity-90 rounded-xl transition-colors disabled:opacity-50 shadow-sm"
                >
                  {isAdding ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : editingGame ? (
                    'Actualizar'
                  ) : (
                    'Guardar Juego'
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
