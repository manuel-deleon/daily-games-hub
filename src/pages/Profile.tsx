import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { User, AtSign, Loader2, Save, CheckCircle2, Flame, LogOut, Upload, Lock, KeyRound } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import type { Profile } from '../types';

export function Profile() {
  const navigate = useNavigate();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [isSavingPassword, setIsSavingPassword] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [passwordMessage, setPasswordMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Form state
  const [username, setUsername] = useState('');
  const [fullName, setFullName] = useState('');
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  
  // Password state
  const [newPassword, setNewPassword] = useState('');

  useEffect(() => {
    async function loadProfile() {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        navigate('/login');
        return;
      }

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
  }, [navigate]);

  const uploadAvatar = async (file: File): Promise<string> => {
    const fileExt = file.name.split('.').pop();
    const fileName = `${Math.random().toString(36).substring(2)}-${Date.now()}.${fileExt}`;
    const filePath = `${fileName}`;

    const { error: uploadError } = await supabase.storage
      .from('avatars')
      .upload(filePath, file);

    if (uploadError) throw uploadError;

    const { data } = supabase.storage.from('avatars').getPublicUrl(filePath);
    return data.publicUrl;
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile) return;

    setIsSavingProfile(true);
    setMessage(null);

    try {
      let finalAvatarUrl = profile.avatar_url;
      if (avatarFile) {
        finalAvatarUrl = await uploadAvatar(avatarFile);
      }

      const { error } = await supabase
        .from('profiles')
        .update({
          username: username.trim(),
          full_name: fullName.trim(),
          avatar_url: finalAvatarUrl
        })
        .eq('id', profile.id);

      if (error) throw error;
      
      setProfile({ ...profile, username: username.trim(), full_name: fullName.trim(), avatar_url: finalAvatarUrl });
      setAvatarFile(null);
      setMessage({ type: 'success', text: 'Perfil actualizado correctamente.' });
      setTimeout(() => setMessage(null), 3000);
    } catch (err: any) {
      if (err.code === '23505') {
        setMessage({ type: 'error', text: 'Este nombre de usuario ya está en uso.' });
      } else {
        setMessage({ type: 'error', text: 'Ocurrió un error al guardar.' });
      }
    } finally {
      setIsSavingProfile(false);
    }
  };

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPassword) return;

    setIsSavingPassword(true);
    setPasswordMessage(null);

    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      
      if (error) throw error;
      
      setNewPassword('');
      setPasswordMessage({ type: 'success', text: 'Contraseña actualizada.' });
      setTimeout(() => setPasswordMessage(null), 3000);
    } catch (err: any) {
      setPasswordMessage({ type: 'error', text: 'Error al actualizar contraseña. Intenta iniciar sesión de nuevo.' });
    } finally {
      setIsSavingPassword(false);
    }
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    navigate('/login');
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <Loader2 className="w-10 h-10 animate-spin text-primary" />
      </div>
    );
  }

  const avatarPreview = avatarFile ? URL.createObjectURL(avatarFile) : profile?.avatar_url;

  return (
    <div className="max-w-xl mx-auto space-y-8 pb-10">
      <div className="text-center sm:text-left flex flex-col items-center sm:items-start">
        <h2 className="text-3xl font-extrabold tracking-tight text-foreground">Tu Perfil</h2>
        <p className="text-muted-foreground mt-1 font-medium">Administra tu identidad y credenciales.</p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-card border border-border rounded-2xl p-5 shadow-sm flex flex-col items-center sm:items-start">
          <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2">Racha Global</span>
          <div className="flex items-center text-orange-500">
            <Flame className="w-8 h-8 mr-1.5" />
            <span className="text-3xl font-black">{profile?.global_streak || 0}</span>
          </div>
        </div>
        <div className="bg-card border border-border rounded-2xl p-5 shadow-sm flex flex-col items-center sm:items-start relative overflow-hidden">
          <div className="absolute -right-4 -top-4 w-16 h-16 bg-primary/5 rounded-full blur-xl pointer-events-none"></div>
          <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2">Personal Best</span>
          <div className="flex items-center text-primary">
            <Flame className="w-8 h-8 mr-1.5" />
            <span className="text-3xl font-black">{profile?.highest_streak || profile?.global_streak || 0}</span>
          </div>
        </div>
      </div>

      {/* Profile Info Form */}
      <div className="bg-card border border-border rounded-3xl shadow-sm p-6 sm:p-8">
        <form onSubmit={handleSaveProfile} className="space-y-6">
          
          <div className="flex flex-col sm:flex-row items-center sm:space-x-6 space-y-4 sm:space-y-0 mb-2">
            <div className="relative group">
              <div className="h-28 w-28 rounded-full bg-background border-4 border-background shadow-md flex items-center justify-center overflow-hidden">
                {avatarPreview ? (
                  <img src={avatarPreview} alt="Avatar" className="h-full w-full object-cover" />
                ) : (
                  <div className="w-full h-full bg-primary/10 flex items-center justify-center text-primary text-4xl font-black">
                    {profile?.username?.charAt(0).toUpperCase()}
                  </div>
                )}
              </div>
              <label htmlFor="avatar-upload" className="absolute bottom-0 right-0 bg-primary text-primary-foreground p-2 rounded-full cursor-pointer shadow-lg hover:scale-105 transition-transform border-2 border-background">
                <Upload className="w-4 h-4" />
                <input id="avatar-upload" type="file" accept="image/*" className="hidden" onChange={(e) => {
                  if (e.target.files && e.target.files[0]) {
                    setAvatarFile(e.target.files[0]);
                  }
                }} />
              </label>
            </div>
            <div className="text-center sm:text-left">
              <h3 className="text-xl font-bold text-foreground">Foto de perfil</h3>
              <p className="text-sm text-muted-foreground mt-1">Sube una imagen para tu avatar.</p>
            </div>
          </div>

          <div className="space-y-4 pt-4 border-t border-border/50">
            <div className="space-y-1.5">
              <label htmlFor="fullName" className="text-sm font-bold text-foreground block">
                Nombre Completo
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <User className="h-5 w-5 text-muted-foreground" />
                </div>
                <input
                  id="fullName"
                  type="text"
                  required
                  placeholder="Ej. Juan Pérez"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="appearance-none rounded-xl relative block w-full pl-11 px-4 py-3 border bg-background border-border placeholder-muted-foreground text-foreground font-medium focus:outline-none focus:ring-2 focus:ring-primary shadow-sm transition-shadow"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label htmlFor="username" className="text-sm font-bold text-foreground block">
                Nombre de Usuario
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <AtSign className="h-5 w-5 text-muted-foreground" />
                </div>
                <input
                  id="username"
                  type="text"
                  required
                  placeholder="Ej. juanperez123"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="appearance-none rounded-xl relative block w-full pl-11 px-4 py-3 border bg-background border-border placeholder-muted-foreground text-foreground font-medium focus:outline-none focus:ring-2 focus:ring-primary shadow-sm transition-shadow"
                />
              </div>
            </div>
          </div>

          {message && (
            <div className={`p-4 rounded-xl flex items-center font-bold text-sm border ${
              message.type === 'success' ? 'bg-green-500/10 text-green-600 dark:text-green-400 border-green-500/20' : 'bg-destructive/10 text-destructive border-destructive/20'
            }`}>
              {message.type === 'success' && <CheckCircle2 className="w-5 h-5 mr-2" />}
              {message.text}
            </div>
          )}

          <button
            type="submit"
            disabled={isSavingProfile || (username === profile?.username && fullName === profile?.full_name && !avatarFile)}
            className="w-full flex items-center justify-center py-3 px-6 text-sm font-bold rounded-xl text-primary-foreground bg-primary hover:opacity-90 disabled:opacity-50 transition-colors shadow-sm"
          >
            {isSavingProfile ? <Loader2 className="w-5 h-5 animate-spin mr-2" /> : <Save className="w-5 h-5 mr-2" />}
            Guardar Cambios
          </button>
        </form>
      </div>

      {/* Security Form */}
      <div className="bg-card border border-border rounded-3xl shadow-sm p-6 sm:p-8">
        <form onSubmit={handleUpdatePassword} className="space-y-6">
          <div>
            <h3 className="text-lg font-extrabold text-foreground mb-1">Seguridad</h3>
            <p className="text-sm text-muted-foreground font-medium">Actualiza tu contraseña.</p>
          </div>

          <div className="space-y-1.5">
            <label htmlFor="newPassword" className="text-sm font-bold text-foreground block">
              Nueva Contraseña
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                <Lock className="h-5 w-5 text-muted-foreground" />
              </div>
              <input
                id="newPassword"
                type="password"
                required
                minLength={6}
                placeholder="Mínimo 6 caracteres"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="appearance-none rounded-xl relative block w-full pl-11 px-4 py-3 border bg-background border-border placeholder-muted-foreground text-foreground font-medium focus:outline-none focus:ring-2 focus:ring-primary shadow-sm transition-shadow"
              />
            </div>
          </div>

          {passwordMessage && (
            <div className={`p-4 rounded-xl flex items-center font-bold text-sm border ${
              passwordMessage.type === 'success' ? 'bg-green-500/10 text-green-600 dark:text-green-400 border-green-500/20' : 'bg-destructive/10 text-destructive border-destructive/20'
            }`}>
              {passwordMessage.type === 'success' && <CheckCircle2 className="w-5 h-5 mr-2" />}
              {passwordMessage.text}
            </div>
          )}

          <button
            type="submit"
            disabled={isSavingPassword || !newPassword}
            className="w-full flex items-center justify-center py-3 px-6 text-sm font-bold rounded-xl text-foreground bg-background border border-border hover:bg-muted disabled:opacity-50 transition-colors shadow-sm"
          >
            {isSavingPassword ? <Loader2 className="w-5 h-5 animate-spin mr-2" /> : <KeyRound className="w-5 h-5 mr-2" />}
            Actualizar Contraseña
          </button>
        </form>
      </div>

      {/* Danger Zone / Sign Out */}
      <div className="pt-4">
        <button
          onClick={handleSignOut}
          className="w-full flex items-center justify-center py-4 px-6 text-sm font-bold rounded-xl text-destructive bg-destructive/10 hover:bg-destructive hover:text-destructive-foreground transition-colors"
        >
          <LogOut className="w-5 h-5 mr-2" />
          Cerrar Sesión
        </button>
      </div>
    </div>
  );
}
