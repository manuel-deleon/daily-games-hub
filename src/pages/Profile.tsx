import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { User, AtSign, Loader2, Save, CheckCircle2 } from 'lucide-react';
import type { Profile } from '../types';

export function Profile() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Form state
  const [username, setUsername] = useState('');
  const [fullName, setFullName] = useState('');

  useEffect(() => {
    async function loadProfile() {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', session.user.id)
        .single();
      
      if (!error && data) {
        setProfile(data);
        setUsername(data.username || '');
        setFullName(data.full_name || '');
      }
      setIsLoading(false);
    }

    loadProfile();
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile) return;

    setIsSaving(true);
    setMessage(null);

    try {
      // Validate unique username logic is handled by the database constraint
      const { error } = await supabase
        .from('profiles')
        .update({
          username: username.trim(),
          full_name: fullName.trim(),
        })
        .eq('id', profile.id);

      if (error) throw error;
      
      setMessage({ type: 'success', text: 'Perfil actualizado correctamente.' });
    } catch (err: any) {
      // If error is unique constraint violation for username
      if (err.code === '23505') {
        setMessage({ type: 'error', text: 'Este nombre de usuario ya está en uso.' });
      } else {
        setMessage({ type: 'error', text: 'Ocurrió un error al guardar.' });
      }
    } finally {
      setIsSaving(false);
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
    <div className="max-w-2xl mx-auto space-y-8">
      <div>
        <h2 className="text-3xl font-bold tracking-tight text-foreground">Mi Perfil</h2>
        <p className="text-muted-foreground mt-1">Administra tu información personal y apariencia.</p>
      </div>

      <div className="bg-card border border-border rounded-xl shadow-sm p-6 sm:p-8">
        
        {/* Avatar Section */}
        <div className="flex items-center space-x-6 mb-8">
          <div className="h-24 w-24 rounded-full bg-muted border-2 border-border flex items-center justify-center overflow-hidden">
            {profile?.avatar_url ? (
              <img src={profile.avatar_url} alt="Avatar" className="h-full w-full object-cover" />
            ) : (
              <User className="w-10 h-10 text-muted-foreground" />
            )}
          </div>
          <div>
            <h3 className="text-lg font-medium text-foreground">Foto de perfil</h3>
            <p className="text-sm text-muted-foreground mt-1">Por ahora se asigna automáticamente desde Google.</p>
          </div>
        </div>

        <div className="border-t border-border mb-8"></div>

        {/* Edit Form */}
        <form onSubmit={handleSave} className="space-y-6">
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
            
            <div className="space-y-2">
              <label htmlFor="fullName" className="text-sm font-medium text-foreground block">
                Nombre Completo
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <User className="h-5 w-5 text-muted-foreground" />
                </div>
                <input
                  id="fullName"
                  type="text"
                  required
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="appearance-none rounded-lg relative block w-full pl-10 px-3 py-2 border bg-background border-border placeholder-muted-foreground text-foreground focus:outline-none focus:ring-primary focus:border-primary sm:text-sm"
                />
              </div>
            </div>

            <div className="space-y-2">
              <label htmlFor="username" className="text-sm font-medium text-foreground block">
                Nombre de Usuario
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <AtSign className="h-5 w-5 text-muted-foreground" />
                </div>
                <input
                  id="username"
                  type="text"
                  required
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="appearance-none rounded-lg relative block w-full pl-10 px-3 py-2 border bg-background border-border placeholder-muted-foreground text-foreground focus:outline-none focus:ring-primary focus:border-primary sm:text-sm"
                />
              </div>
              <p className="text-xs text-muted-foreground">Este es tu identificador único público.</p>
            </div>
          </div>

          {message && (
            <div className={`p-4 rounded-lg flex items-center ${
              message.type === 'success' ? 'bg-primary/10 text-primary' : 'bg-destructive/10 text-destructive'
            }`}>
              {message.type === 'success' && <CheckCircle2 className="w-5 h-5 mr-2" />}
              <span className="text-sm font-medium">{message.text}</span>
            </div>
          )}

          <div className="flex justify-end pt-4">
            <button
              type="submit"
              disabled={isSaving || (username === profile?.username && fullName === profile?.full_name)}
              className="flex items-center justify-center py-2 px-6 border border-transparent text-sm font-medium rounded-lg text-primary-foreground bg-primary hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary disabled:opacity-50 transition-colors"
            >
              {isSaving ? (
                <Loader2 className="w-5 h-5 animate-spin mr-2" />
              ) : (
                <Save className="w-5 h-5 mr-2" />
              )}
              Guardar Cambios
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
