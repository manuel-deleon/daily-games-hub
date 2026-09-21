import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { Lightbulb, ThumbsUp, ThumbsDown, MessageSquare, Plus, Loader2, Filter, Trash2 } from 'lucide-react';
import type { Profile } from '../types';

export function Suggestions() {
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isAdding, setIsAdding] = useState(false);
  
  const [newTitle, setNewTitle] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [submitError, setSubmitError] = useState<string | null>(null);
  
  const [activeFilter, setActiveFilter] = useState<'all' | 'pending' | 'working' | 'implemented'>('all');
  const [myVotes, setMyVotes] = useState<Record<string, number>>({});
  
  const loadData = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;

    // Load profile (to check admin status)
    const { data: profData } = await supabase.from('profiles').select('*').eq('id', session.user.id).single();
    if (profData) setProfile(profData);

    // Load suggestions
    const { data: sugData } = await supabase.from('suggestions_with_votes').select('*').order('score', { ascending: false }).order('created_at', { ascending: false });
      if (sugData) {
        const statusWeight: Record<string, number> = {
          'pending': 1,
          'working': 2,
          'implemented': 3,
          'rejected': 4
        };
        
        sugData.sort((a, b) => {
          const weightA = statusWeight[a.status] || 5;
          const weightB = statusWeight[b.status] || 5;
          if (weightA !== weightB) return weightA - weightB;
          if (b.score !== a.score) return b.score - a.score;
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
        });
        setSuggestions(sugData);
      }
    
    // Load my votes
    const { data: voteData } = await supabase.from('suggestion_votes').select('suggestion_id, vote_type').eq('user_id', session.user.id);
    if (voteData) {
      const voteMap: Record<string, number> = {};
      voteData.forEach(v => voteMap[v.suggestion_id] = v.vote_type);
      setMyVotes(voteMap);
    }
    
    setIsLoading(false);
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleVote = async (suggestionId: string, voteType: number) => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;
    
    const currentVote = myVotes[suggestionId];
    
    if (currentVote === voteType) {
      // Remove vote
      await supabase.from('suggestion_votes').delete().eq('suggestion_id', suggestionId).eq('user_id', session.user.id);
    } else {
      // Insert or update vote
      await supabase.from('suggestion_votes').upsert({
        suggestion_id: suggestionId,
        user_id: session.user.id,
        vote_type: voteType
      }, { onConflict: 'suggestion_id, user_id' });
    }
    
    await loadData();
  };

  const [isAnonymous, setIsAnonymous] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) {
      setSubmitError('Title is required.');
      return;
    }
    
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;
    
    const { error } = await supabase.from('suggestions').insert({
      user_id: session.user.id,
      title: newTitle.trim(),
      description: newDescription.trim() || null,
      is_anonymous: isAnonymous
    });
    
    if (error) {
      setSubmitError(error.message);
    } else {
      setNewTitle('');
      setNewDescription('');
      setIsAnonymous(false);
      setIsAdding(false);
      setSubmitError(null);
      await loadData();
    }
  };

  const handleDeleteSuggestion = async (suggestionId: string) => {
    if (!confirm('Are you sure you want to delete this?')) return;
    await supabase.from('suggestions').delete().eq('id', suggestionId);
    await loadData();
  };

  const handleStatusChange = async (suggestionId: string, status: string) => {
    if (!profile?.is_admin) return;
    await supabase.from('suggestions').update({ status }).eq('id', suggestionId);
    await loadData();
  };
  
  const getStatusBadge = (status: string) => {
    switch(status) {
      case 'working': return <span className="px-2.5 py-0.5 rounded-full text-xs font-bold border" style={{ backgroundColor: '#d4a33633', color: '#d4a336', borderColor: '#d4a33666' }}>Working on it</span>;
      case 'implemented': return <span className="px-2.5 py-0.5 rounded-full text-xs font-bold border" style={{ backgroundColor: '#70917633', color: '#709176', borderColor: '#70917666' }}>Implemented</span>;
      case 'rejected': return <span className="px-2.5 py-0.5 rounded-full text-xs font-bold border" style={{ backgroundColor: '#C0575733', color: '#C05757', borderColor: '#C0575766' }}>Rejected</span>;
      default: return <span className="bg-muted text-muted-foreground px-2.5 py-0.5 rounded-full text-xs font-bold border border-border">Pending</span>;
    }
  };

  const filteredSuggestions = suggestions.filter(s => activeFilter === 'all' || s.status === activeFilter);

  if (isLoading) {
    return <div className="flex justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-black tracking-tight text-foreground flex items-center">
            <Lightbulb className="w-8 h-8 mr-3 text-primary" />
            Ideas & Bugs
          </h1>
          <p className="text-muted-foreground mt-1 font-medium">Vote on ideas, report bugs, or submit feedback.</p>
        </div>
        <button
          onClick={() => setIsAdding(!isAdding)}
          className="flex items-center px-5 py-2.5 bg-primary text-primary-foreground font-bold rounded-xl hover:opacity-90 transition-colors shadow-sm"
        >
          {isAdding ? 'Cancel' : <><Plus className="w-5 h-5 mr-1.5" /> New Post</>}
        </button>
      </div>
      
      {isAdding && (
        <div className="bg-card rounded-3xl p-6 border border-border shadow-sm mb-8 animate-in slide-in-from-top-4 fade-in duration-300">
          <h3 className="text-xl font-bold mb-4 flex items-center">
            <MessageSquare className="w-5 h-5 mr-2 text-primary" /> Submit Feedback
          </h3>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-bold mb-1.5">Title</label>
              <input
                type="text"
                value={newTitle}
                onChange={e => setNewTitle(e.target.value)}
                placeholder="Short, descriptive title"
                className="w-full px-4 py-2.5 bg-background border border-border rounded-xl focus:ring-2 focus:ring-primary outline-none"
                maxLength={100}
              />
            </div>
            <div>
              <label className="block text-sm font-bold mb-1.5">Description (Optional)</label>
              <textarea
                value={newDescription}
                onChange={e => setNewDescription(e.target.value)}
                placeholder="Details about your idea or bug..."
                className="w-full px-4 py-2.5 bg-background border border-border rounded-xl focus:ring-2 focus:ring-primary outline-none min-h-[100px] resize-none"
                maxLength={1000}
              />
            </div>
            <div className="flex items-center space-x-2">
              <input
                type="checkbox"
                id="anonymous"
                checked={isAnonymous}
                onChange={e => setIsAnonymous(e.target.checked)}
                className="w-4 h-4 text-primary bg-background border-border rounded focus:ring-primary"
              />
              <label htmlFor="anonymous" className="text-sm font-medium text-foreground">
                Post anonymously
              </label>
            </div>
            {submitError && <p className="text-destructive text-sm font-bold">{submitError}</p>}
            <div className="flex justify-end">
              <button type="submit" className="px-6 py-2.5 bg-primary text-primary-foreground font-bold rounded-xl hover:opacity-90 shadow-sm">
                Submit
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Filters */}
      <div className="flex overflow-x-auto space-x-2 pb-2 scrollbar-hide">
        {['all', 'pending', 'working', 'implemented'].map(filter => (
          <button
            key={filter}
            onClick={() => setActiveFilter(filter as any)}
            className={`px-4 py-2 rounded-full text-sm font-bold whitespace-nowrap transition-colors ${activeFilter === filter ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:bg-muted/80'}`}
          >
            {filter.charAt(0).toUpperCase() + filter.slice(1)}
          </button>
        ))}
      </div>

      <div className="space-y-4">
        {filteredSuggestions.length === 0 ? (
          <div className="text-center py-12 bg-card rounded-2xl border border-border">
            <Filter className="w-12 h-12 text-muted-foreground mx-auto mb-3 opacity-30" />
            <p className="text-muted-foreground font-medium">No suggestions found in this category.</p>
          </div>
        ) : (
          filteredSuggestions.map(s => (
            <div key={s.id} className="bg-card border border-border rounded-2xl p-5 flex flex-col sm:flex-row sm:items-center gap-4 transition-all hover:border-border/80 shadow-sm">
              <div className="flex items-center space-x-2 sm:flex-col sm:space-x-0 sm:space-y-2 shrink-0">
                <button 
                  onClick={() => handleVote(s.id, 1)}
                  className={`p-2 rounded-xl border flex items-center justify-center transition-colors ${myVotes[s.id] === 1 ? 'bg-primary/10 border-primary text-primary' : 'bg-background border-border text-muted-foreground hover:bg-muted'}`}
                >
                  <ThumbsUp className="w-4 h-4" />
                </button>
                <span className="font-black text-lg w-8 text-center">{s.score}</span>
                <button 
                  onClick={() => handleVote(s.id, -1)}
                  className={`p-2 rounded-xl border flex items-center justify-center transition-colors ${myVotes[s.id] === -1 ? 'bg-destructive/10 border-destructive text-destructive' : 'bg-background border-border text-muted-foreground hover:bg-muted'}`}
                >
                  <ThumbsDown className="w-4 h-4" />
                </button>
              </div>
              
              <div className="flex-1 min-w-0 flex flex-col">
                <div className="flex items-start justify-between gap-4 mb-1">
                  <h3 className="text-lg font-bold text-foreground break-words [word-break:break-word]">{s.title}</h3>
                  <div className="shrink-0">{getStatusBadge(s.status)}</div>
                </div>
                <p className="text-muted-foreground text-sm mb-3 whitespace-pre-wrap break-words [word-break:break-word]">{s.description}</p>
                <div className="flex items-center text-xs text-muted-foreground/60 font-medium">
                  <span className="truncate">By {s.is_anonymous ? 'Anonymous' : (s.username || 'Anonymous')}</span>
                  <span className="mx-2">•</span>
                  <span>{new Date(s.created_at).toLocaleDateString()}</span>
                </div>
              </div>

              {(profile?.is_admin || profile?.id === s.user_id) && (
                <div className="flex sm:flex-col gap-2 shrink-0 border-t sm:border-t-0 sm:border-l border-border pt-4 sm:pt-0 sm:pl-4 mt-4 sm:mt-0 items-center sm:items-start justify-end">
                  {profile?.is_admin && (
                    <select 
                      value={s.status} 
                      onChange={e => handleStatusChange(s.id, e.target.value)}
                      className="text-xs font-bold px-2 py-1.5 bg-background border border-border rounded-lg outline-none cursor-pointer"
                    >
                      <option value="pending">Pending</option>
                      <option value="working">Working</option>
                      <option value="implemented">Implemented</option>
                      <option value="rejected">Rejected</option>
                    </select>
                  )}
                  {(profile?.id === s.user_id || profile?.is_admin) && (
                    <button 
                      onClick={() => handleDeleteSuggestion(s.id)}
                      className="p-1.5 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-lg transition-colors ml-auto sm:ml-0"
                      title="Delete suggestion"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
