import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { Megaphone, Plus, Loader2, Trash2, Pencil } from 'lucide-react';
import type { Profile } from '../types';

export function Updates() {
  const [updates, setUpdates] = useState<any[]>([]);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  
  const [newTitle, setNewTitle] = useState('');
  const [newContent, setNewContent] = useState('');
  const [submitError, setSubmitError] = useState<string | null>(null);
  
  const loadData = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;

    const { data: profData } = await supabase.from('profiles').select('*').eq('id', session.user.id).single();
    if (profData) setProfile(profData);

    const { data: updateData } = await supabase.from('patch_notes').select('*').order('created_at', { ascending: false });
    if (updateData) setUpdates(updateData);
    
    setIsLoading(false);
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim() || !newContent.trim()) {
      setSubmitError('Title and content are required.');
      return;
    }
    
    if (editingId) {
      const { error } = await supabase.from('patch_notes').update({
        title: newTitle.trim(),
        content: newContent.trim()
      }).eq('id', editingId);
      
      if (error) setSubmitError(error.message);
      else resetForm();
    } else {
      const { error } = await supabase.from('patch_notes').insert({
        title: newTitle.trim(),
        content: newContent.trim()
      });
      
      if (error) setSubmitError(error.message);
      else resetForm();
    }
  };

  const resetForm = async () => {
    setNewTitle('');
    setNewContent('');
    setIsAdding(false);
    setEditingId(null);
    setSubmitError(null);
    await loadData();
  };

  const handleEdit = (update: any) => {
    setEditingId(update.id);
    setNewTitle(update.title);
    setNewContent(update.content);
    setIsAdding(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this update?')) return;
    await supabase.from('patch_notes').delete().eq('id', id);
    await loadData();
  };

  if (isLoading) {
    return <div className="flex justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-black tracking-tight text-foreground flex items-center">
            <Megaphone className="w-8 h-8 mr-3 text-primary" />
            Patch Notes
          </h1>
          <p className="text-muted-foreground mt-1 font-medium">Read the latest updates and changes to the app.</p>
        </div>
        {profile?.is_admin && (
          <button
            onClick={() => {
              if (isAdding) resetForm();
              else setIsAdding(true);
            }}
            className="flex items-center px-5 py-2.5 bg-primary text-primary-foreground font-bold rounded-xl hover:opacity-90 transition-colors shadow-sm"
          >
            {isAdding ? 'Cancel' : <><Plus className="w-5 h-5 mr-1.5" /> New Update</>}
          </button>
        )}
      </div>
      
      {isAdding && profile?.is_admin && (
        <div className="bg-card rounded-3xl p-6 border border-border shadow-sm mb-8 animate-in slide-in-from-top-4 fade-in duration-300">
          <h3 className="text-xl font-bold mb-4 flex items-center">
            <Pencil className="w-5 h-5 mr-2 text-primary" /> {editingId ? 'Edit Update' : 'Post Update'}
          </h3>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-bold mb-1.5">Version / Title</label>
              <input
                type="text"
                value={newTitle}
                onChange={e => setNewTitle(e.target.value)}
                placeholder="e.g. v1.2.0 - Dark Mode & Leaderboards"
                className="w-full px-4 py-2.5 bg-background border border-border rounded-xl focus:ring-2 focus:ring-primary outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-bold mb-1.5">Release Notes</label>
              <textarea
                value={newContent}
                onChange={e => setNewContent(e.target.value)}
                placeholder="What's new in this update?"
                className="w-full px-4 py-2.5 bg-background border border-border rounded-xl focus:ring-2 focus:ring-primary outline-none min-h-[200px] resize-none"
              />
            </div>
            {submitError && <p className="text-destructive text-sm font-bold">{submitError}</p>}
            <div className="flex justify-end">
              <button type="submit" className="px-6 py-2.5 bg-primary text-primary-foreground font-bold rounded-xl hover:opacity-90 shadow-sm">
                {editingId ? 'Update Patch Notes' : 'Publish Patch Notes'}
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="space-y-6">
        {updates.length === 0 ? (
          <div className="text-center py-12 bg-card rounded-2xl border border-border">
            <Megaphone className="w-12 h-12 text-muted-foreground mx-auto mb-3 opacity-30" />
            <p className="text-muted-foreground font-medium">No updates posted yet.</p>
          </div>
        ) : (
          updates.map((update, idx) => (
            <div key={update.id} className="relative">
              {idx !== updates.length - 1 && (
                <div className="absolute left-6 top-16 bottom-[-24px] w-px bg-border z-0"></div>
              )}
              <div className="bg-card border border-border rounded-3xl p-6 relative z-10 shadow-sm transition-all hover:shadow-md">
                <div className="flex flex-col sm:flex-row justify-between items-start gap-4 mb-4">
                  <div>
                    <div className="flex items-center space-x-3 mb-2">
                      <div className="bg-primary/20 text-primary px-3 py-1 rounded-lg text-xs font-black tracking-widest uppercase">
                        {new Date(update.created_at).toLocaleDateString()}
                      </div>
                    </div>
                    <h2 className="text-2xl font-black text-foreground break-words [word-break:break-word]">{update.title}</h2>
                  </div>
                  
                  {profile?.is_admin && (
                    <div className="flex items-center space-x-2">
                      <button onClick={() => handleEdit(update)} className="p-2 text-muted-foreground hover:text-foreground bg-muted/50 rounded-lg transition-colors border border-transparent hover:border-border"><Pencil className="w-4 h-4" /></button>
                      <button onClick={() => handleDelete(update.id)} className="p-2 text-muted-foreground hover:text-destructive bg-muted/50 rounded-lg transition-colors border border-transparent hover:border-destructive/30"><Trash2 className="w-4 h-4" /></button>
                    </div>
                  )}
                </div>
                
                <div className="prose prose-sm sm:prose-base dark:prose-invert max-w-none prose-p:leading-relaxed prose-li:my-1 text-muted-foreground whitespace-pre-wrap break-words [word-break:break-word]">
                  {update.content}
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
