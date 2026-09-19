import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { Flame, Play, CheckCircle2, Circle, Plus, X, Loader2, Pencil, Trash2 } from 'lucide-react';
import type { Game } from '../types';

export function Dashboard() {
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
  const [isAdding, setIsAdding] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);

  const openAddModal = () => {
    setEditingGame(null);
    setNewGameName('');
    setNewGameUrl('');
    setNewGameColor('#709176');
    setAddError(null);
    setIsAddModalOpen(true);
  };

  const openEditModal = (game: Game) => {
    setEditingGame(game);
    setNewGameName(game.name);
    setNewGameUrl(game.url);
    setNewGameColor(game.color);
    setAddError(null);
  };

  const handleUpdateGame = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingGame) return;
    setIsAdding(true);
    setAddError(null);

    try {
      const { error } = await supabase
        .from('games')
        .update({
          name: newGameName.trim(),
          url: newGameUrl.trim(),
          color: newGameColor,
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

    // 1. Obtener juegos
    const { data: gamesData, error: gamesError } = await supabase
      .from('games')
      .select('*')
      .eq('user_id', session.user.id)
      .order('created_at', { ascending: false }); // Sort by newest first
    
    if (!gamesError && gamesData) {
      setGames(gamesData);
    }

    // 2. Saber cuáles se completaron hoy
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

      const { error } = await supabase.from('games').insert({
        user_id: session.user.id,
        name: newGameName.trim(),
        url: newGameUrl.trim(),
        color: newGameColor,
      });

      if (error) throw error;

      // Close modal and reset form
      setIsAddModalOpen(false);
      setNewGameName('');
      setNewGameUrl('');
      setNewGameColor('#709176');
      
      // Reload games
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
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center flex-wrap gap-4">
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-foreground">Tu Catálogo</h2>
          <p className="text-muted-foreground mt-1">Tus juegos diarios listos para jugar.</p>
        </div>
        
        <button
          onClick={openAddModal}
          className="flex items-center justify-center py-2 px-4 font-medium rounded-lg text-primary-foreground bg-primary hover:opacity-90 transition-colors shadow-sm"
        >
          <Plus className="w-5 h-5 mr-1.5" />
          Añadir Juego
        </button>
      </div>

      {games.length === 0 ? (
        <div className="space-y-6">
          <div className="text-center py-12 bg-card rounded-xl border border-border shadow-sm">
            <p className="text-muted-foreground text-lg mb-4">No tienes juegos en tu catálogo aún.</p>
            <button
              onClick={openAddModal}
              className="inline-flex items-center justify-center py-2 px-4 font-medium rounded-lg text-primary-foreground bg-primary hover:opacity-90 transition-colors shadow-sm"
            >
              <Plus className="w-5 h-5 mr-1.5" />
              Añadir tu primer juego
            </button>
          </div>
          
          <div>
            <h3 className="text-xl font-bold text-foreground mb-4">Juegos Populares Recomendados</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {[
                { name: 'Wordle', url: 'https://www.nytimes.com/games/wordle/index.html', color: '#538d4e' },
                { name: 'Connections', url: 'https://www.nytimes.com/games/connections', color: '#b4a5e5' },
                { name: 'Framed', url: 'https://framed.wtf/', color: '#1f1f23' },
                { name: 'Loldle', url: 'https://loldle.net/', color: '#0a1428' },
                { name: 'Pokedle', url: 'https://pokedle.net/', color: '#ef4444' },
                { name: 'Tradle', url: 'https://oec.world/en/tradle/', color: '#0ea5e9' }
              ].map((rec) => (
                <div key={rec.name} className="flex flex-col p-4 rounded-xl border border-border bg-card shadow-sm hover:shadow-md transition-shadow">
                  <div className="flex items-center space-x-3 mb-3">
                    <div className="w-8 h-8 rounded-full" style={{ backgroundColor: rec.color }}></div>
                    <span className="font-bold text-foreground">{rec.name}</span>
                  </div>
                  <button
                    onClick={async () => {
                      const { data: { session } } = await supabase.auth.getSession();
                      if (session) {
                        await supabase.from('games').insert({ user_id: session.user.id, name: rec.name, url: rec.url, color: rec.color });
                        await loadData();
                      }
                    }}
                    className="mt-auto py-1.5 px-3 bg-muted text-muted-foreground hover:bg-primary/10 hover:text-primary rounded-lg text-sm font-medium transition-colors"
                  >
                    + Agregar
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {games.map((game) => {
            const isCompleted = completedTodayIds.has(game.id);

            return (
              <div 
                key={game.id} 
                className="group relative flex flex-col justify-between overflow-hidden rounded-2xl transition-all duration-300 hover:shadow-xl hover:-translate-y-1"
                style={{ backgroundColor: game.color }}
              >
                <div className="p-6">
                  <div className="flex justify-between items-start">
                    <h3 className="text-2xl font-bold text-white mb-2">{game.name}</h3>
                    <div className="flex space-x-2">
                      <div className="flex items-center text-white/90 bg-black/20 px-2 py-1 rounded-md backdrop-blur-sm" title="Racha actual">
                        <Flame className={`w-4 h-4 mr-1 ${game.current_streak > 0 ? 'text-orange-300' : 'text-gray-400'}`} />
                        <span className="font-semibold text-sm">{game.current_streak}</span>
                      </div>
                      <div className="flex items-center bg-black/20 rounded-md backdrop-blur-sm opacity-0 group-hover:opacity-100 transition-opacity">
                        <button onClick={() => openEditModal(game)} className="p-1.5 text-white/70 hover:text-white transition-colors" title="Editar">
                          <Pencil className="w-4 h-4" />
                        </button>
                        <button onClick={() => handleDeleteGame(game)} className="p-1.5 text-white/70 hover:text-red-400 transition-colors" title="Eliminar">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                  
                  {/* Estado del día */}
                  <div className="mt-4 flex items-center text-white/90 text-sm font-medium">
                    {isCompleted ? (
                      <>
                        <CheckCircle2 className="w-5 h-5 mr-1.5 text-green-300" />
                        <span>¡Completado hoy!</span>
                      </>
                    ) : (
                      <>
                        <Circle className="w-5 h-5 mr-1.5 opacity-60" />
                        <span className="opacity-80">Pendiente</span>
                      </>
                    )}
                  </div>
                </div>

                <div className="p-4 bg-black/10 backdrop-blur-md flex space-x-3">
                  <a 
                    href={game.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex-1 flex items-center justify-center py-2.5 px-4 bg-white/20 hover:bg-white/30 text-white font-medium rounded-xl transition-colors backdrop-blur-sm"
                  >
                    <Play className="w-4 h-4 mr-2" />
                    Jugar
                  </a>
                  
                  <button
                    onClick={() => handleMarkCompleted(game.id)}
                    disabled={isCompleted || isMarking === game.id}
                    className={`flex-1 flex items-center justify-center py-2.5 px-4 font-medium rounded-xl transition-colors backdrop-blur-sm ${
                      isCompleted 
                        ? 'bg-green-500/30 text-white cursor-default' 
                        : 'bg-black/20 hover:bg-black/40 text-white'
                    }`}
                  >
                    {isMarking === game.id ? (
                      <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
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
          <div className="bg-card w-full max-w-md rounded-2xl shadow-xl border border-border overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="flex justify-between items-center p-6 border-b border-border">
              <h3 className="text-xl font-bold text-foreground">
                {editingGame ? 'Editar Juego' : 'Añadir Nuevo Juego'}
              </h3>
              <button 
                onClick={() => {
                  setIsAddModalOpen(false);
                  setEditingGame(null);
                }}
                className="text-muted-foreground hover:text-foreground transition-colors"
              >
                <X className="w-6 h-6" />
              </button>
            </div>
            
            <form onSubmit={editingGame ? handleUpdateGame : handleAddGame} className="p-6 space-y-6">
              <div className="space-y-4">
                <div className="space-y-2">
                  <label htmlFor="name" className="text-sm font-medium text-foreground">Nombre del Juego</label>
                  <input
                    id="name"
                    type="text"
                    required
                    placeholder="Ej. Framed, Loldle, Pokedle..."
                    value={newGameName}
                    onChange={(e) => setNewGameName(e.target.value)}
                    className="w-full px-3 py-2 border bg-background border-border rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>
                
                <div className="space-y-2">
                  <label htmlFor="url" className="text-sm font-medium text-foreground">URL (Enlace al juego)</label>
                  <input
                    id="url"
                    type="url"
                    required
                    placeholder="https://..."
                    value={newGameUrl}
                    onChange={(e) => setNewGameUrl(e.target.value)}
                    className="w-full px-3 py-2 border bg-background border-border rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>

                <div className="space-y-2">
                  <label htmlFor="color" className="text-sm font-medium text-foreground">Color de la Tarjeta</label>
                  <div className="flex items-center space-x-3">
                    <input
                      id="color"
                      type="color"
                      value={newGameColor}
                      onChange={(e) => setNewGameColor(e.target.value)}
                      className="h-10 w-20 rounded cursor-pointer border border-border bg-background p-1"
                    />
                    <span className="text-sm text-muted-foreground font-mono">{newGameColor}</span>
                  </div>
                </div>
              </div>

              {addError && (
                <div className="p-3 text-sm text-destructive bg-destructive/10 rounded-lg font-medium">
                  {addError}
                </div>
              )}

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setIsAddModalOpen(false);
                    setEditingGame(null);
                  }}
                  className="px-4 py-2 text-sm font-medium text-foreground hover:bg-muted rounded-lg transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isAdding}
                  className="flex items-center px-4 py-2 text-sm font-medium text-primary-foreground bg-primary hover:opacity-90 rounded-lg transition-colors disabled:opacity-50"
                >
                  {isAdding && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                  {editingGame ? 'Actualizar' : 'Guardar Juego'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
