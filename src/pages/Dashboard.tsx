import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { Flame, Play, CheckCircle2, Circle, Plus, X, Loader2 } from 'lucide-react';
import type { Game } from '../types';

export function Dashboard() {
  const [games, setGames] = useState<Game[]>([]);
  const [completedTodayIds, setCompletedTodayIds] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(true);
  const [isMarking, setIsMarking] = useState<string | null>(null);

  // Add Game Modal State
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [newGameName, setNewGameName] = useState('');
  const [newGameUrl, setNewGameUrl] = useState('');
  const [newGameColor, setNewGameColor] = useState('#709176');
  const [isAdding, setIsAdding] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);

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
          onClick={() => setIsAddModalOpen(true)}
          className="flex items-center justify-center py-2 px-4 font-medium rounded-lg text-primary-foreground bg-primary hover:opacity-90 transition-colors shadow-sm"
        >
          <Plus className="w-5 h-5 mr-1.5" />
          Añadir Juego
        </button>
      </div>

      {games.length === 0 ? (
        <div className="text-center py-12 bg-card rounded-xl border border-border">
          <p className="text-muted-foreground">No tienes juegos en tu catálogo aún.</p>
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
                    <div className="flex items-center text-white/90 bg-black/20 px-2 py-1 rounded-md backdrop-blur-sm" title="Racha actual">
                      <Flame className={`w-4 h-4 mr-1 ${game.current_streak > 0 ? 'text-orange-300' : 'text-gray-400'}`} />
                      <span className="font-semibold text-sm">{game.current_streak}</span>
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

      {/* Add Game Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm">
          <div className="bg-card w-full max-w-md rounded-2xl shadow-xl border border-border overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="flex justify-between items-center p-6 border-b border-border">
              <h3 className="text-xl font-bold text-foreground">Añadir Nuevo Juego</h3>
              <button 
                onClick={() => setIsAddModalOpen(false)}
                className="text-muted-foreground hover:text-foreground transition-colors"
              >
                <X className="w-6 h-6" />
              </button>
            </div>
            
            <form onSubmit={handleAddGame} className="p-6 space-y-6">
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
                  onClick={() => setIsAddModalOpen(false)}
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
                  Guardar Juego
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
