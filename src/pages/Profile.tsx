import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { Loader2, Save, CheckCircle2, Flame, LogOut, Upload, KeyRound, Sun, Moon, Eye, EyeOff } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import type { Profile } from '../types';
import { useTheme } from '../hooks/useTheme';

export function Profile() {
  const navigate = useNavigate();
  const { theme, toggleTheme } = useTheme();
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
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

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

  const extractStoragePath = (publicUrl: string, bucket: string): string | null => {
    const marker = `/${bucket}/`;
    const idx = publicUrl.indexOf(marker);
    if (idx === -1) return null;
    return publicUrl.substring(idx + marker.length);
  };

  const uploadAvatar = async (file: File): Promise<string> => {
    // Delete old avatar from storage to prevent orphaned files
    if (profile?.avatar_url) {
      const oldPath = extractStoragePath(profile.avatar_url, 'avatars');
      if (oldPath) {
        await supabase.storage.from('avatars').remove([oldPath]);
      }
    }

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
      setMessage({ type: 'success', text: 'Profile updated successfully.' });
      setTimeout(() => setMessage(null), 3000);
    } catch (err: any) {
      if (err.code === '23505') {
        setMessage({ type: 'error', text: 'This username is already taken.' });
      } else {
        setMessage({ type: 'error', text: 'An error occurred while saving.' });
      }
    } finally {
      setIsSavingProfile(false);
    }
  };

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPassword || newPassword.length < 6) {
      setPasswordMessage({ type: 'error', text: 'Password must be at least 6 characters.' });
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordMessage({ type: 'error', text: 'Passwords do not match.' });
      return;
    }
    setIsSavingPassword(true);
    setPasswordMessage(null);

    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      
      if (error) throw error;
      
      setNewPassword('');
      setConfirmPassword('');
      setPasswordMessage({ type: 'success', text: 'Password updated successfully.' });
      setTimeout(() => setPasswordMessage(null), 3000);
    } catch (err: any) {
      setPasswordMessage({ type: 'error', text: 'Error updating password. Try signing in again.' });
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
        <h2 className="text-3xl font-extrabold tracking-tight text-foreground">Your Profile</h2>
        <p className="text-muted-foreground mt-1 font-medium">Manage your identity and credentials.</p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-card border border-border rounded-2xl p-5 shadow-sm flex flex-col items-center sm:items-start">
          <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2">Global Streak</span>
          <div className="flex items-center text-[#D4A336]">
            <Flame className="w-8 h-8 mr-1.5" />
            <span className="text-3xl font-black">{profile?.global_streak || 0}</span>
          </div>
        </div>
        <div className="bg-card border border-border rounded-2xl p-5 shadow-sm flex flex-col items-center sm:items-start relative overflow-hidden">
          <div className="absolute -right-4 -top-4 w-16 h-16 bg-primary/5 rounded-full blur-xl pointer-events-none"></div>
          <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2">Personal Best</span>
          <div className="flex items-center text-orange-500">
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
              <h3 className="text-xl font-bold text-foreground">Profile Picture</h3>
              <p className="text-sm text-muted-foreground mt-1">Upload an image for your avatar.</p>
            </div>
          </div>

          <div className="space-y-4 pt-4 border-t border-border/50">
            <div className="space-y-1.5">
              <label htmlFor="fullName" className="text-sm font-bold text-foreground block">
                Full Name
              </label>
              <div className="relative">
                <input
                  id="fullName"
                  type="text"
                  required
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="block w-full px-4 py-3 border bg-background border-border rounded-xl text-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all sm:text-sm font-medium"
                  placeholder="e.g. John Doe"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label htmlFor="username" className="text-sm font-bold text-foreground block">
                Username
              </label>
              <div className="relative">
                <input
                  id="username"
                  type="text"
                  required
                  placeholder="e.g. johndoe123"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="appearance-none rounded-xl relative block w-full px-4 py-3 border bg-background border-border placeholder-muted-foreground text-foreground font-medium focus:outline-none focus:ring-2 focus:ring-primary shadow-sm transition-shadow"
                />
              </div>
            </div>
          </div>

          {message && (
            <div className={`p-4 rounded-xl flex items-center font-bold text-sm border ${
              message.type === 'success' ? 'bg-[#709176]/10 text-[#709176] border-[#709176]/20' : 'bg-destructive/10 text-destructive border-destructive/20'
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
            Save Changes
          </button>
        </form>
      </div>

      {/* Security Form */}
      <div className="bg-card border border-border rounded-3xl shadow-sm p-6 sm:p-8">
        <form onSubmit={handleUpdatePassword} className="space-y-6">
          <div>
            <h3 className="text-lg font-extrabold text-foreground mb-1">Security</h3>
            <p className="text-sm text-muted-foreground font-medium">Update your password.</p>
          </div>

          <div className="space-y-1.5">
            <label htmlFor="newPassword" className="text-sm font-bold text-foreground block">
              New Password
            </label>
              <div className="relative">
                <input
                  id="newPassword"
                  type="password"
                  required
                  minLength={6}
                  placeholder="Minimum 6 characters"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="appearance-none rounded-xl relative block w-full px-4 py-3 border bg-background border-border placeholder-muted-foreground text-foreground font-medium focus:outline-none focus:ring-2 focus:ring-primary shadow-sm transition-shadow"
                />
              </div>
          </div>
            <div className="space-y-1.5 mt-5">
              <label htmlFor="confirmPassword" className="text-sm font-bold text-foreground">
                Confirm New Password
              </label>
              <div className="relative">
                <input
                  id="confirmPassword"
                  type={showPassword ? "text" : "password"}
                  required
                  minLength={6}
                  placeholder="Confirm your new password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="appearance-none rounded-xl relative block w-full px-4 py-3 border bg-background border-border placeholder-muted-foreground text-foreground font-medium focus:outline-none focus:ring-2 focus:ring-primary shadow-sm transition-shadow pr-12"
                />
                <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-3.5 text-muted-foreground hover:text-foreground">
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
            </div>

          {passwordMessage && (
            <div className={`p-4 rounded-xl flex items-center font-bold text-sm border ${
              passwordMessage.type === 'success' ? 'bg-[#709176]/10 text-[#709176] border-[#709176]/20' : 'bg-destructive/10 text-destructive border-destructive/20'
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
            Update Password
          </button>
        </form>
      </div>

      {/* Appearance Section */}
      <div className="bg-card border border-border rounded-3xl shadow-sm p-6 sm:p-8">
        <div>
          <h3 className="text-lg font-extrabold text-foreground mb-1">Appearance</h3>
          <p className="text-sm text-muted-foreground font-medium mb-6">Customize the look of your app.</p>
        </div>
        
        <div className="flex items-center justify-between p-4 rounded-xl border border-border bg-background">
          <div className="flex items-center space-x-3 text-foreground">
            {theme === 'light' ? <Sun className="w-6 h-6 text-amber-500" /> : <Moon className="w-6 h-6 text-blue-400" />}
            <span className="font-bold">{theme === 'light' ? 'Light Mode' : 'Dark Mode'}</span>
          </div>
          <button
            onClick={toggleTheme}
            className={`relative inline-flex h-7 w-12 items-center rounded-full transition-colors focus:outline-none ${theme === 'dark' ? 'bg-primary' : 'bg-muted border border-border'}`}
          >
            <span
              className={`inline-block h-5 w-5 transform rounded-full bg-white transition-transform ${theme === 'dark' ? 'translate-x-6' : 'translate-x-1'}`}
            />
          </button>
        </div>
      </div>

      {/* Danger Zone / Sign Out */}
      <div className="pt-4">
        <button
          onClick={handleSignOut}
          className="w-full flex items-center justify-center py-4 px-6 text-sm font-bold rounded-xl text-destructive bg-destructive/10 border border-destructive/20 hover:bg-destructive hover:text-destructive-foreground hover:shadow-md transition-all active:scale-95 cursor-pointer"
        >
          <LogOut className="w-5 h-5 mr-2" />
          Sign Out
          </button>
        </div>

        {/* Version Info */}
        <div className="text-center pt-8 pb-4">
          <p className="text-xs font-bold text-muted-foreground/40">DailyHub v1.2.0</p>
        </div>
      </div>
  );
}
