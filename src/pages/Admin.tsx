import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Shield, Users, Gamepad2, Activity, Trash2, Edit, Save, X, Search, AlertTriangle } from 'lucide-react';


export function Admin() {
  const [isAdmin, setIsAdmin] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'dashboard' | 'games' | 'users'>('dashboard');

  const [stats, setStats] = useState({ totalUsers: 0, totalGames: 0, totalCompletions: 0 });
  const [users, setUsers] = useState<any[]>([]);
  const [globalGames, setGlobalGames] = useState<any[]>([]);
  
  const [searchUsers, setSearchUsers] = useState('');
  const [searchGames, setSearchGames] = useState('');

  const [editingGame, setEditingGame] = useState<any | null>(null);
  const [editingUser, setEditingUser] = useState<any | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  useEffect(() => {
    checkAdmin();
  }, []);

  const checkAdmin = async () => {
    setIsLoading(true);
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      setIsAdmin(false);
      setIsLoading(false);
      return;
    }

    const { data } = await supabase.from('profiles').select('is_admin').eq('id', session.user.id).single();
    if (data?.is_admin) {
      setIsAdmin(true);
      await loadAdminData();
    } else {
      setIsAdmin(false);
    }
    setIsLoading(false);
  };

  const loadAdminData = async () => {
    // Stats
    const [{ count: usersCount }, { count: gamesCount }, { count: completionsCount }] = await Promise.all([
      supabase.from('profiles').select('*', { count: 'exact', head: true }),
      supabase.from('global_games').select('*', { count: 'exact', head: true }),
      supabase.from('daily_progress').select('*', { count: 'exact', head: true })
    ]);
    setStats({ totalUsers: usersCount || 0, totalGames: gamesCount || 0, totalCompletions: completionsCount || 0 });

    // Load full lists
    const { data: uData } = await supabase.from('profiles').select('*').order('created_at', { ascending: false });
    if (uData) setUsers(uData);

    const { data: gData } = await supabase.from('global_games').select('*').order('name');
    if (gData) setGlobalGames(gData);
  };

  // Game Handlers
  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !editingGame) return;

    setIsUploading(true);
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${Date.now()}_${Math.random()}.${fileExt}`;
      const filePath = `admin-uploads/${fileName}`;
      
      const { error: uploadError } = await supabase.storage
        .from('game-logos')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('game-logos')
        .getPublicUrl(filePath);

      setEditingGame({ ...editingGame, logo_url: publicUrl });
    } catch (error) {
      console.error('Error uploading logo:', error);
      alert('Error uploading image. Is the game-logos bucket created and public?');
    } finally {
      setIsUploading(false);
    }
  };

  const handleSaveGame = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingGame) return;
    const { error } = await supabase.from('global_games').update({ name: editingGame.name, url: editingGame.url, logo_url: editingGame.logo_url }).eq('id', editingGame.id);
    if (error) alert("Error saving game: " + error.message);
    else { setEditingGame(null); loadAdminData(); }
  };


  const toggleRecommended = async (gameId: string, currentVal: boolean) => {
    await supabase.from('global_games').update({ is_recommended: !currentVal }).eq('id', gameId);
    loadAdminData();
  };

  const handleDeleteGame = async (id: string) => {
    if (confirm('Are you sure you want to permanently delete this global game? All users will lose it.')) {
      const { error } = await supabase.from('global_games').delete().eq('id', id);
      if (error) alert("Error deleting game: " + error.message);
      else loadAdminData();
    }
  };

  // User Handlers
  const handleSaveUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUser) return;
    const { error } = await supabase.from('profiles').update({ username: editingUser.username, avatar_url: editingUser.avatar_url }).eq('id', editingUser.id);
    if (error) alert("Error saving user: " + error.message);
    else { setEditingUser(null); loadAdminData(); }
  };

  const handleDeleteUser = async (id: string) => {
    if (confirm('WARNING: Are you sure you want to completely ban and delete this user?')) {
      const { error } = await supabase.from('profiles').delete().eq('id', id);
      if (error) alert("Error deleting user: " + error.message);
      else loadAdminData();
    }
  };

  if (isLoading) return <div className="flex justify-center p-12"><Activity className="w-8 h-8 animate-spin" /></div>;
  if (!isAdmin) return <div className="p-12 text-center text-destructive font-bold text-xl"><AlertTriangle className="mx-auto mb-4 w-12 h-12" /> Unauthorized Access</div>;

  const filteredGames = globalGames.filter(g => (g.name || '').toLowerCase().includes(searchGames.toLowerCase()) || (g.url || '').toLowerCase().includes(searchGames.toLowerCase()));
  const filteredUsers = users.filter(u => (u.username || '').toLowerCase().includes(searchUsers.toLowerCase()) || (u.full_name || '').toLowerCase().includes(searchUsers.toLowerCase()));

  return (
    <div className="max-w-5xl mx-auto space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black text-foreground flex items-center">
            <Shield className="w-8 h-8 mr-3 text-primary" /> Admin Panel
          </h1>
          <p className="text-muted-foreground font-medium mt-1">Manage platform, users, and games.</p>
        </div>
        <div className="flex space-x-2 bg-muted/50 p-1 rounded-xl">
          <button onClick={() => setActiveTab('dashboard')} className={`px-4 py-2 rounded-lg font-bold text-sm transition-all ${activeTab === 'dashboard' ? 'bg-background shadow-sm' : 'text-muted-foreground'}`}>Overview</button>
          <button onClick={() => setActiveTab('games')} className={`px-4 py-2 rounded-lg font-bold text-sm transition-all ${activeTab === 'games' ? 'bg-background shadow-sm' : 'text-muted-foreground'}`}>Games</button>
          <button onClick={() => setActiveTab('users')} className={`px-4 py-2 rounded-lg font-bold text-sm transition-all ${activeTab === 'users' ? 'bg-background shadow-sm' : 'text-muted-foreground'}`}>Users</button>
        </div>
      </div>

      {activeTab === 'dashboard' && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-card p-6 rounded-2xl border border-border shadow-sm flex items-center space-x-4">
            <div className="p-3 bg-primary/10 rounded-xl text-primary"><Users className="w-8 h-8" /></div>
            <div>
              <p className="text-sm font-bold text-muted-foreground uppercase">Total Users</p>
              <p className="text-3xl font-black">{stats.totalUsers}</p>
            </div>
          </div>
          <div className="bg-card p-6 rounded-2xl border border-border shadow-sm flex items-center space-x-4">
            <div className="p-3 bg-orange-500/10 rounded-xl text-orange-500"><Gamepad2 className="w-8 h-8" /></div>
            <div>
              <p className="text-sm font-bold text-muted-foreground uppercase">Global Games</p>
              <p className="text-3xl font-black">{stats.totalGames}</p>
            </div>
          </div>
          <div className="bg-card p-6 rounded-2xl border border-border shadow-sm flex items-center space-x-4">
            <div className="p-3 bg-blue-500/10 rounded-xl text-blue-500"><Activity className="w-8 h-8" /></div>
            <div>
              <p className="text-sm font-bold text-muted-foreground uppercase">Total Completions</p>
              <p className="text-3xl font-black">{stats.totalCompletions}</p>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'games' && (
        <div className="bg-card rounded-2xl border border-border shadow-sm overflow-hidden">
          <div className="p-4 border-b border-border bg-muted/30">
            <div className="relative max-w-sm">
              <Search className="absolute left-3 top-2.5 w-5 h-5 text-muted-foreground" />
              <input type="text" placeholder="Search games by name or URL..." value={searchGames} onChange={e => setSearchGames(e.target.value)} className="w-full pl-10 pr-4 py-2 border border-border rounded-xl bg-background text-foreground" />
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-muted/50 text-sm text-muted-foreground border-b border-border">
                  <th className="p-4 font-bold">Logo</th>
                  <th className="p-4 font-bold">Name</th>
                  <th className="p-4 font-bold">URL</th>
                  <th className="p-4 font-bold text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filteredGames.map(game => (
                  <tr key={game.id} className="hover:bg-muted/30 transition-colors">
                    <td className="p-4"><img src={game.logo_url || 'https://via.placeholder.com/40'} alt="logo" className="w-10 h-10 rounded-lg object-cover" /></td>
                    <td className="p-4 font-bold">{game.name}</td>
                      <td className="p-4 text-sm text-muted-foreground truncate max-w-[200px]">{game.url}</td>
                      <td className="p-4 text-center">
                        <input 
                          type="checkbox" 
                          checked={game.is_recommended || false} 
                          onChange={() => toggleRecommended(game.id, game.is_recommended)}
                          className="w-5 h-5 accent-primary cursor-pointer"
                        />
                      </td>
                      <td className="p-4 text-right space-x-2">
                      <button onClick={() => setEditingGame(game)} className="p-2 bg-background border border-border rounded-lg hover:bg-muted"><Edit className="w-4 h-4" /></button>
                      <button onClick={() => handleDeleteGame(game.id)} className="p-2 bg-destructive/10 text-destructive border border-destructive/20 rounded-lg hover:bg-destructive hover:text-white"><Trash2 className="w-4 h-4" /></button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === 'users' && (
        <div className="bg-card rounded-2xl border border-border shadow-sm overflow-hidden">
          <div className="p-4 border-b border-border bg-muted/30">
            <div className="relative max-w-sm">
              <Search className="absolute left-3 top-2.5 w-5 h-5 text-muted-foreground" />
              <input type="text" placeholder="Search users by name..." value={searchUsers} onChange={e => setSearchUsers(e.target.value)} className="w-full pl-10 pr-4 py-2 border border-border rounded-xl bg-background text-foreground" />
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-muted/50 text-sm text-muted-foreground border-b border-border">
                  <th className="p-4 font-bold">PFP</th>
                  <th className="p-4 font-bold">Username</th>
                  <th className="p-4 font-bold">Streak (Cur/Best)</th>
                  <th className="p-4 font-bold text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filteredUsers.map(user => (
                  <tr key={user.id} className="hover:bg-muted/30 transition-colors">
                    <td className="p-4">
                      {user.avatar_url ? <img src={user.avatar_url} className="w-10 h-10 rounded-full object-cover" /> : <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center font-bold">{user.username.charAt(0).toUpperCase()}</div>}
                    </td>
                    <td className="p-4 font-bold flex items-center">
                      {user.username} {user.is_admin && <span title="Admin"><Shield className="w-3 h-3 ml-2 text-primary" /></span>}
                    </td>
                    <td className="p-4 font-bold">{user.global_streak} / {user.highest_streak}</td>
                    <td className="p-4 text-right space-x-2">
                      <button onClick={() => setEditingUser(user)} className="p-2 bg-background border border-border rounded-lg hover:bg-muted"><Edit className="w-4 h-4" /></button>
                      <button onClick={() => handleDeleteUser(user.id)} disabled={user.is_admin} className="p-2 bg-destructive/10 text-destructive border border-destructive/20 rounded-lg hover:bg-destructive hover:text-white disabled:opacity-50"><Trash2 className="w-4 h-4" /></button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Edit Game Modal */}
      {editingGame && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm">
          <div className="bg-card w-full max-w-md rounded-3xl shadow-2xl border border-border p-6">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-black">Edit Game</h3>
              <button onClick={() => setEditingGame(null)}><X className="w-5 h-5" /></button>
            </div>
            <form onSubmit={handleSaveGame} className="space-y-4">
              <div>
                <label className="text-sm font-bold block mb-1">Name</label>
                <input value={editingGame.name} onChange={e => setEditingGame({...editingGame, name: e.target.value})} className="w-full px-4 py-2 border rounded-xl bg-background" />
              </div>
              <div>
                <label className="text-sm font-bold block mb-1">URL</label>
                <input value={editingGame.url} onChange={e => setEditingGame({...editingGame, url: e.target.value})} className="w-full px-4 py-2 border rounded-xl bg-background" />
              </div>
              <div>
                <label className="text-sm font-bold block mb-1">Logo URL or Upload Image</label>
                <div className="space-y-2">
                  <input value={editingGame.logo_url || ''} onChange={e => setEditingGame({...editingGame, logo_url: e.target.value})} placeholder="https://..." className="w-full px-4 py-2 border rounded-xl bg-background" />
                  <div className="relative">
                    <input 
                      type="file" 
                      accept="image/*"
                      onChange={handleLogoUpload}
                      disabled={isUploading}
                      className="block w-full text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-sm file:font-semibold file:bg-primary/10 file:text-primary hover:file:bg-primary/20 cursor-pointer disabled:opacity-50"
                    />
                    {isUploading && <Activity className="absolute right-3 top-2 w-5 h-5 animate-spin text-primary" />}
                  </div>
                </div>
              </div>
              <button type="submit" className="w-full py-3 bg-primary text-white font-bold rounded-xl flex justify-center items-center"><Save className="w-5 h-5 mr-2" /> Save Changes</button>
            </form>
          </div>
        </div>
      )}

      {/* Edit User Modal */}
      {editingUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm">
          <div className="bg-card w-full max-w-md rounded-3xl shadow-2xl border border-border p-6">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-black text-destructive flex items-center"><AlertTriangle className="mr-2" /> Moderate User</h3>
              <button onClick={() => setEditingUser(null)}><X className="w-5 h-5" /></button>
            </div>
            <form onSubmit={handleSaveUser} className="space-y-4">
              <div>
                <label className="text-sm font-bold block mb-1">Force Username</label>
                <input value={editingUser.username} onChange={e => setEditingUser({...editingUser, username: e.target.value})} className="w-full px-4 py-2 border rounded-xl bg-background" />
              </div>
              <div>
                <label className="text-sm font-bold block mb-1">Force Avatar URL (Clear to remove)</label>
                <input value={editingUser.avatar_url || ''} onChange={e => setEditingUser({...editingUser, avatar_url: e.target.value})} className="w-full px-4 py-2 border rounded-xl bg-background" />
              </div>
              <button type="submit" className="w-full py-3 bg-primary text-white font-bold rounded-xl flex justify-center items-center"><Save className="w-5 h-5 mr-2" /> Apply Moderation</button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
