import { useEffect, useState, useRef } from 'react';
import { supabase } from '../lib/supabase';
import {
  Lightbulb, ThumbsUp, ThumbsDown, MessageSquare, Plus, Loader2,
  Trash2, Bug, HelpCircle, Megaphone, SlidersHorizontal, X, Send, ChevronDown, Clock, CalendarDays, User
} from 'lucide-react';
import type { Profile } from '../types';
import { createNotification } from '../lib/notifications';

// ─── Types ────────────────────────────────────────────────────────────────────
type FeedbackType = 'idea' | 'bug' | 'question' | 'other';
type SortMode = 'score' | 'newest' | 'oldest';
type StatusFilter = 'working' | 'pending' | 'rejected' | 'implemented';

const STATUS_GROUPS: {
  key: StatusFilter;
  label: string;
  dotColor: string;
  activeClass: string;
}[] = [
  { key: 'working', label: 'Working on it', dotColor: 'bg-amber-500', activeClass: 'bg-amber-500 text-white border-amber-500' },
  { key: 'pending', label: 'Pending', dotColor: 'bg-primary', activeClass: 'bg-primary text-primary-foreground border-primary' },
  { key: 'rejected', label: 'Rejected', dotColor: 'bg-red-500', activeClass: 'bg-red-500 text-white border-red-500' },
  { key: 'implemented', label: 'Implemented', dotColor: 'bg-[#709176]', activeClass: 'bg-[#709176] text-white border-[#709176]' },
];

const STATUS_PRIORITY: Record<string, number> = {
  working: 0,
  pending: 1,
  rejected: 2,
  implemented: 3,
};

const FEEDBACK_TYPES: { value: FeedbackType; label: string; icon: React.ReactNode; color: string }[] = [
  { value: 'idea',     label: 'Idea',     icon: <Lightbulb className="w-4 h-4" />, color: 'text-yellow-500 bg-yellow-500/10 border-yellow-500/30' },
  { value: 'bug',      label: 'Bug',      icon: <Bug className="w-4 h-4" />,       color: 'text-red-500 bg-red-500/10 border-red-500/30' },
  { value: 'question', label: 'Question', icon: <HelpCircle className="w-4 h-4" />, color: 'text-blue-500 bg-blue-500/10 border-blue-500/30' },
  { value: 'other',    label: 'Other',    icon: <Megaphone className="w-4 h-4" />, color: 'text-purple-500 bg-purple-500/10 border-purple-500/30' },
];

function getFeedbackType(type: string) {
  return FEEDBACK_TYPES.find(t => t.value === type) ?? FEEDBACK_TYPES[3];
}

// ─── Component ─────────────────────────────────────────────────────────────
export function Suggestions() {
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isAdding, setIsAdding] = useState(false);

  const [newTitle, setNewTitle] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [newType, setNewType] = useState<FeedbackType>('idea');
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isAnonymous, setIsAnonymous] = useState(false);

  // Filters (Multi-select)
  const [selectedStatuses, setSelectedStatuses] = useState<StatusFilter[]>([]);
  const [selectedTypes, setSelectedTypes] = useState<FeedbackType[]>([]);
  const [onlyMine, setOnlyMine] = useState(false);
  const [sortMode, setSortMode] = useState<SortMode>('score');
  const [showFilters, setShowFilters] = useState(false);

  const toggleStatus = (status: StatusFilter) => {
    setSelectedStatuses(prev =>
      prev.includes(status) ? prev.filter(s => s !== status) : [...prev, status]
    );
  };

  const toggleType = (type: FeedbackType) => {
    setSelectedTypes(prev =>
      prev.includes(type) ? prev.filter(t => t !== type) : [...prev, type]
    );
  };

  const [myVotes, setMyVotes] = useState<Record<string, number>>({});

  // Thread modal
  const [threadSuggestion, setThreadSuggestion] = useState<any | null>(null);
  const [threadComments, setThreadComments] = useState<any[]>([]);
  const [isLoadingComments, setIsLoadingComments] = useState(false);
  const [newComment, setNewComment] = useState('');
  const [isPostingComment, setIsPostingComment] = useState(false);
  const [commentError, setCommentError] = useState<string | null>(null);
  const commentEndRef = useRef<HTMLDivElement>(null);

  const loadData = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;

    const { data: profData } = await supabase.from('profiles').select('*').eq('id', session.user.id).single();
    if (profData) setProfile(profData);

    const { data: sugData } = await supabase
      .from('suggestions_with_votes')
      .select('*')
      .order('created_at', { ascending: false });

    if (sugData) setSuggestions(sugData);

    const { data: voteData } = await supabase
      .from('suggestion_votes')
      .select('suggestion_id, vote_type')
      .eq('user_id', session.user.id);

    if (voteData) {
      const voteMap: Record<string, number> = {};
      voteData.forEach(v => (voteMap[v.suggestion_id] = v.vote_type));
      setMyVotes(voteMap);
    }

    setIsLoading(false);
  };

  useEffect(() => { loadData(); }, []);

  // ── Voting ──────────────────────────────────────────────────────────────
  const handleVote = async (suggestionId: string, voteType: number) => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;

    const currentVote = myVotes[suggestionId];
    const isRemoving = currentVote === voteType;
    const newVoteVal = isRemoving ? undefined : voteType;
    const prevScoreDelta = (currentVote || 0);
    const newScoreDelta = (newVoteVal || 0) - prevScoreDelta;

    // Optimistic UI update: instant feedback, no full page reload
    setMyVotes(prev => {
      const next = { ...prev };
      if (isRemoving) {
        delete next[suggestionId];
      } else {
        next[suggestionId] = voteType;
      }
      return next;
    });

    setSuggestions(prev => prev.map(s => {
      if (s.id === suggestionId) {
        return { ...s, score: (s.score ?? 0) + newScoreDelta };
      }
      return s;
    }));

    try {
      if (isRemoving) {
        await supabase.from('suggestion_votes').delete().eq('suggestion_id', suggestionId).eq('user_id', session.user.id);
      } else {
        await supabase.from('suggestion_votes').upsert({
          suggestion_id: suggestionId,
          user_id: session.user.id,
          vote_type: voteType,
        }, { onConflict: 'suggestion_id, user_id' });

        // Notify suggestion author on like/upvote
        if (voteType === 1) {
          const targetSuggestion = suggestions.find(s => s.id === suggestionId);
          if (targetSuggestion && targetSuggestion.user_id && targetSuggestion.user_id !== session.user.id) {
            createNotification({
              userId: targetSuggestion.user_id,
              actorId: session.user.id,
              type: 'suggestion_like',
              title: `@${profile?.username || 'Someone'} liked your feedback`,
              message: targetSuggestion.title,
              entityId: suggestionId,
            });
          }
        }
      }
    } catch (err) {
      console.error('Error saving vote:', err);
      // Revert if failed
      loadData();
    }
  };

  // ── Submit ──────────────────────────────────────────────────────────────
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) { setSubmitError('Title is required.'); return; }

    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;

    const payload: any = {
      user_id: session.user.id,
      title: newTitle.trim(),
      description: newDescription.trim() || null,
      is_anonymous: isAnonymous,
    };

    // Add feedback_type only if the column exists (graceful degradation)
    payload.feedback_type = newType;

    const { error } = await supabase.from('suggestions').insert(payload);

    if (error) {
      // If the column doesn't exist yet, try without it
      if (error.message?.includes('feedback_type')) {
        const { error: error2 } = await supabase.from('suggestions').insert({ ...payload, feedback_type: undefined });
        if (error2) { setSubmitError(error2.message); return; }
      } else {
        setSubmitError(error.message);
        return;
      }
    }

    setNewTitle('');
    setNewDescription('');
    setNewType('idea');
    setIsAnonymous(false);
    setIsAdding(false);
    setSubmitError(null);
    await loadData();
  };

  // ── Delete / Status ──────────────────────────────────────────────────────
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

  // ── Thread / Comments ─────────────────────────────────────────────────
  const fetchThreadComments = async (suggestionId: string) => {
    setCommentError(null);
    try {
      // 1. Fetch comments directly (up to 100 per thread)
      const { data: comments, error: commentsError } = await supabase
        .from('suggestion_comments')
        .select('*')
        .eq('suggestion_id', suggestionId)
        .order('created_at', { ascending: true })
        .limit(100);

      if (commentsError) {
        console.error('Error fetching comments:', commentsError);
        setCommentError(`Error cargando comentarios: ${commentsError.message}`);
        return [];
      }

      if (!comments || comments.length === 0) {
        return [];
      }

      // 2. Fetch associated profiles for usernames/avatars
      const userIds = Array.from(new Set(comments.map((c: any) => c.user_id).filter(Boolean)));
      if (userIds.length > 0) {
        const { data: profiles, error: profError } = await supabase
          .from('profiles')
          .select('id, username, avatar_url, is_admin')
          .in('id', userIds);

        if (profError) {
          console.warn('Error fetching comment profiles:', profError);
        }

        const profileMap = new Map((profiles || []).map((p: any) => [p.id, p]));
        return comments.map((c: any) => ({
          ...c,
          profiles: profileMap.get(c.user_id) || null,
        }));
      }

      return comments;
    } catch (err: any) {
      console.error('Exception fetching comments:', err);
      setCommentError(err.message || 'Error inesperado al cargar comentarios');
      return [];
    }
  };

  const openThread = async (s: any) => {
    setThreadSuggestion(s);
    setCommentError(null);
    setIsLoadingComments(true);
    const comments = await fetchThreadComments(s.id);
    setThreadComments(comments);
    setIsLoadingComments(false);
  };

  const postComment = async () => {
    if (!newComment.trim() || !threadSuggestion) return;
    setCommentError(null);
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      setCommentError('Debes iniciar sesión para comentar.');
      return;
    }
    setIsPostingComment(true);

    const { error } = await supabase.from('suggestion_comments').insert({
      suggestion_id: threadSuggestion.id,
      user_id: session.user.id,
      content: newComment.trim(),
    });

    if (error) {
      console.error('Error posting comment:', error);
      setCommentError(`Error al publicar comentario: ${error.message}`);
    } else {
      const postedContent = newComment.trim();
      setNewComment('');
      const updated = await fetchThreadComments(threadSuggestion.id);
      setThreadComments(updated);
      setTimeout(() => commentEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);

      // 1. Notify suggestion author if someone else commented
      if (threadSuggestion.user_id && threadSuggestion.user_id !== session.user.id) {
        createNotification({
          userId: threadSuggestion.user_id,
          actorId: session.user.id,
          type: 'suggestion_comment',
          title: `@${profile?.username || 'Someone'} commented on your feedback`,
          message: postedContent.slice(0, 100),
          entityId: threadSuggestion.id,
        });
      }

      // 2. Notify other participants who already commented on this suggestion
      const otherParticipantIds = Array.from(new Set(
        threadComments
          .map((c: any) => c.user_id)
          .filter((uid: string) => uid && uid !== session.user.id && uid !== threadSuggestion.user_id)
      ));

      for (const participantId of otherParticipantIds) {
        createNotification({
          userId: participantId,
          actorId: session.user.id,
          type: 'suggestion_comment',
          title: `@${profile?.username || 'Someone'} replied in "${threadSuggestion.title.slice(0, 30)}"`,
          message: postedContent.slice(0, 100),
          entityId: threadSuggestion.id,
        });
      }
    }
    setIsPostingComment(false);
  };

  const handleDeleteComment = async (commentId: string) => {
    if (!confirm('¿Seguro que deseas eliminar este comentario?')) return;
    const { error } = await supabase.from('suggestion_comments').delete().eq('id', commentId);
    if (error) {
      console.error('Error deleting comment:', error);
      setCommentError(error.message);
    } else if (threadSuggestion) {
      const updated = await fetchThreadComments(threadSuggestion.id);
      setThreadComments(updated);
    }
  };

  // ── Helpers ──────────────────────────────────────────────────────────────
  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'working':     return <span className="px-2.5 py-0.5 rounded-full text-xs font-bold border" style={{ backgroundColor: '#d4a33633', color: '#d4a336', borderColor: '#d4a33666' }}>Working on it</span>;
      case 'implemented': return <span className="px-2.5 py-0.5 rounded-full text-xs font-bold border" style={{ backgroundColor: '#70917633', color: '#709176', borderColor: '#70917666' }}>Implemented</span>;
      case 'rejected':    return <span className="px-2.5 py-0.5 rounded-full text-xs font-bold border" style={{ backgroundColor: '#C0575733', color: '#C05757', borderColor: '#C0575766' }}>Rejected</span>;
      default:            return <span className="bg-muted text-muted-foreground px-2.5 py-0.5 rounded-full text-xs font-bold border border-border">Pending</span>;
    }
  };

  // ── Filtering + Sorting ──────────────────────────────────────────────────
  let filtered = suggestions.filter(s => {
    const sStatus = (s.status || 'pending') as StatusFilter;
    if (selectedStatuses.length > 0 && !selectedStatuses.includes(sStatus)) return false;
    if (selectedTypes.length > 0 && !selectedTypes.includes(s.feedback_type)) return false;
    if (onlyMine && s.user_id !== profile?.id) return false;
    return true;
  });

  filtered = [...filtered].sort((a, b) => {
    const statusA = STATUS_PRIORITY[a.status || 'pending'] ?? 1;
    const statusB = STATUS_PRIORITY[b.status || 'pending'] ?? 1;
    if (statusA !== statusB) {
      return statusA - statusB;
    }

    if (sortMode === 'score') {
      const scoreDiff = (b.score ?? 0) - (a.score ?? 0);
      if (scoreDiff !== 0) return scoreDiff;
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    }
    if (sortMode === 'newest') return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    if (sortMode === 'oldest') return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
    return 0;
  });

  // Group sorted suggestions by status (Working on it -> Pending -> Rejected -> Implemented)
  const groupedSuggestions = STATUS_GROUPS.map(g => ({
    ...g,
    items: filtered.filter(s => (s.status || 'pending') === g.key),
  })).filter(g => g.items.length > 0);

  const activeFiltersCount = selectedStatuses.length + selectedTypes.length + (onlyMine ? 1 : 0) + (sortMode !== 'score' ? 1 : 0);

  if (isLoading) {
    return <div className="flex justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-500">

      {/* ── Header ── */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-black tracking-tight text-foreground flex items-center">
            <Lightbulb className="w-8 h-8 mr-3 text-primary" />
            Ideas &amp; Bugs
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

      {/* ── New Post Form ── */}
      {isAdding && (
        <div className="bg-card rounded-3xl p-6 border border-border shadow-sm mb-8 animate-in slide-in-from-top-4 fade-in duration-300">
          <h3 className="text-xl font-bold mb-4 flex items-center">
            <MessageSquare className="w-5 h-5 mr-2 text-primary" /> Submit Feedback
          </h3>
          <form onSubmit={handleSubmit} className="space-y-4">

            {/* Feedback type selector */}
            <div>
              <label className="block text-sm font-bold mb-2">Type</label>
              <div className="flex flex-wrap gap-2">
                {FEEDBACK_TYPES.map(t => (
                  <button
                    key={t.value}
                    type="button"
                    onClick={() => setNewType(t.value)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-bold border transition-all ${
                      newType === t.value
                        ? t.color
                        : 'bg-background border-border text-muted-foreground hover:bg-muted'
                    }`}
                  >
                    {t.icon} {t.label}
                  </button>
                ))}
              </div>
            </div>

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
              <label htmlFor="anonymous" className="text-sm font-medium text-foreground">Post anonymously</label>
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

      {/* ── Filter Bar ── */}
      <div className="bg-card border border-border rounded-2xl overflow-hidden shadow-sm">
        {/* Top row: status pills + onlyMine + filter toggle */}
        <div className="flex items-center gap-2 p-3 border-b border-border flex-wrap">
          <div className="flex flex-wrap items-center gap-1.5 flex-1 min-w-0">
            <button
              onClick={() => setSelectedStatuses([])}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap transition-colors border ${
                selectedStatuses.length === 0
                  ? 'bg-primary text-primary-foreground border-primary'
                  : 'bg-background border-border text-muted-foreground hover:bg-muted'
              }`}
            >
              All
            </button>
            {STATUS_GROUPS.map(f => {
              const isSelected = selectedStatuses.includes(f.key);
              return (
                <button
                  key={f.key}
                  onClick={() => toggleStatus(f.key)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap transition-colors border ${
                    isSelected
                      ? f.activeClass
                      : 'bg-background border-border text-muted-foreground hover:bg-muted'
                  }`}
                >
                  {f.label}
                </button>
              );
            })}

            <div className="h-4 w-px bg-border mx-1 hidden sm:block" />

            <button
              onClick={() => setOnlyMine(!onlyMine)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap transition-colors border ${
                onlyMine
                  ? 'bg-primary text-primary-foreground border-primary'
                  : 'bg-background border-border text-muted-foreground hover:bg-muted'
              }`}
            >
              <User className="w-3.5 h-3.5" />
              My posts
            </button>
          </div>

          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold border transition-colors flex-shrink-0 ${
              showFilters || activeFiltersCount > 0
                ? 'bg-primary/10 border-primary text-primary'
                : 'bg-background border-border text-muted-foreground hover:bg-muted'
            }`}
          >
            <SlidersHorizontal className="w-3.5 h-3.5" />
            Filters
            {activeFiltersCount > 0 && (
              <span className="bg-primary text-primary-foreground text-[10px] font-bold rounded-full w-4 h-4 flex items-center justify-center">
                {activeFiltersCount}
              </span>
            )}
            <ChevronDown className={`w-3.5 h-3.5 transition-transform ${showFilters ? 'rotate-180' : ''}`} />
          </button>
        </div>

        {/* Expandable filter panel */}
        {showFilters && (
          <div className="p-4 space-y-4 animate-in slide-in-from-top-2 fade-in duration-200">
            {/* Type filter (Multi-select) */}
            <div>
              <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2">Feedback Type (Multi-select)</p>
              <div className="flex flex-wrap gap-1.5">
                <button
                  onClick={() => setSelectedTypes([])}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-colors ${
                    selectedTypes.length === 0
                      ? 'bg-foreground text-background border-foreground'
                      : 'bg-background border-border text-muted-foreground hover:bg-muted'
                  }`}
                >
                  All types
                </button>
                {FEEDBACK_TYPES.map(t => {
                  const isSelected = selectedTypes.includes(t.value);
                  return (
                    <button
                      key={t.value}
                      onClick={() => toggleType(t.value)}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold border transition-colors ${
                        isSelected ? t.color : 'bg-background border-border text-muted-foreground hover:bg-muted'
                      }`}
                    >
                      {t.icon} {t.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Sort */}
            <div>
              <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2">Sort by</p>
              <div className="flex flex-wrap gap-1.5">
                {([
                  { value: 'score',  label: 'Most Liked', icon: <ThumbsUp className="w-3.5 h-3.5" /> },
                  { value: 'newest', label: 'Newest',     icon: <Clock className="w-3.5 h-3.5" /> },
                  { value: 'oldest', label: 'Oldest',     icon: <CalendarDays className="w-3.5 h-3.5" /> },
                ] as const).map(opt => (
                  <button
                    key={opt.value}
                    onClick={() => setSortMode(opt.value)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold border transition-colors ${
                      sortMode === opt.value
                        ? 'bg-primary text-primary-foreground border-primary'
                        : 'bg-background border-border text-muted-foreground hover:bg-muted'
                    }`}
                  >
                    {opt.icon} {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Reset */}
            {activeFiltersCount > 0 && (
              <button
                onClick={() => { setSelectedStatuses([]); setSelectedTypes([]); setOnlyMine(false); setSortMode('score'); }}
                className="text-xs font-bold text-muted-foreground hover:text-destructive transition-colors flex items-center gap-1"
              >
                <X className="w-3 h-3" /> Clear all filters
              </button>
            )}
          </div>
        )}
      </div>

      {/* ── Suggestion List ── */}
      <div className="space-y-6">
        {filtered.length === 0 ? (
          <div className="text-center py-12 bg-card rounded-2xl border border-border">
            <SlidersHorizontal className="w-12 h-12 text-muted-foreground mx-auto mb-3 opacity-30" />
            <p className="text-muted-foreground font-medium">No suggestions found with these filters.</p>
          </div>
        ) : (
          groupedSuggestions.map(group => (
            <div key={group.key} className="space-y-3">
              {/* Group Header - shown when displaying multiple statuses (e.g. default 'All') */}
              {selectedStatuses.length !== 1 && (
                <div className="flex items-center gap-2 pt-2 pb-1">
                  <span className={`w-2.5 h-2.5 rounded-full ${group.dotColor}`} />
                  <h2 className="text-xs font-black uppercase tracking-wider text-muted-foreground">
                    {group.label}
                  </h2>
                  <span className="text-[11px] font-bold text-muted-foreground bg-muted border border-border px-2 py-0.5 rounded-full">
                    {group.items.length}
                  </span>
                  <div className="h-px bg-border flex-1 ml-2" />
                </div>
              )}

              {/* Suggestions in this group */}
              <div className="space-y-3">
                {group.items.map(s => {
            const ft = getFeedbackType(s.feedback_type);
            return (
              <div
                key={s.id}
                className="bg-card border border-border rounded-2xl p-5 flex flex-col sm:flex-row sm:items-center gap-4 transition-all hover:border-border/80 shadow-sm cursor-pointer hover:shadow-md"
                onClick={() => openThread(s)}
              >
                {/* Vote column */}
                <div
                  className="flex items-center space-x-2 sm:flex-col sm:space-x-0 sm:space-y-2 shrink-0"
                  onClick={e => e.stopPropagation()}
                >
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

                {/* Content */}
                <div className="flex-1 min-w-0 flex flex-col">
                  <div className="flex items-start justify-between gap-3 mb-1 flex-wrap">
                    <div className="flex items-center gap-2 flex-wrap">
                      {/* Type badge */}
                      <span className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold border ${ft.color}`}>
                        {ft.icon} {ft.label}
                      </span>
                      <h3 className="text-base font-bold text-foreground break-words [word-break:break-word]">{s.title}</h3>
                    </div>
                    <div className="shrink-0 flex items-center gap-2">
                      {getStatusBadge(s.status)}
                    </div>
                  </div>
                  {s.description && (
                    <p className="text-muted-foreground text-sm mb-2 whitespace-pre-wrap break-words [word-break:break-word] line-clamp-2">{s.description}</p>
                  )}
                  <div className="flex items-center text-xs text-muted-foreground/60 font-medium gap-2 flex-wrap">
                    <span className="truncate">By {s.is_anonymous ? 'Anonymous' : (s.username || 'Anonymous')}</span>
                    <span>•</span>
                    <span>{new Date(s.created_at).toLocaleDateString()}</span>
                    <span>•</span>
                    <span className="flex items-center gap-1"><MessageSquare className="w-3 h-3" /> View thread</span>
                  </div>
                </div>

                {/* Admin controls */}
                {(profile?.is_admin || profile?.id === s.user_id) && (
                  <div
                    className="flex sm:flex-col gap-2 shrink-0 border-t sm:border-t-0 sm:border-l border-border pt-4 sm:pt-0 sm:pl-4 mt-4 sm:mt-0 items-center sm:items-start justify-end"
                    onClick={e => e.stopPropagation()}
                  >
                    {profile?.is_admin && (
                      <select
                        value={s.status}
                        onChange={e => handleStatusChange(s.id, e.target.value)}
                        className="text-xs font-bold px-2 py-1.5 bg-background border border-border rounded-lg outline-none cursor-pointer"
                      >
                        <option value="working">Working on it</option>
                        <option value="pending">Pending</option>
                        <option value="rejected">Rejected</option>
                        <option value="implemented">Implemented</option>
                      </select>
                    )}
                    {(profile?.id === s.user_id || profile?.is_admin) && (
                      <button
                        onClick={() => handleDeleteSuggestion(s.id)}
                        className="p-1.5 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-lg transition-colors ml-auto sm:ml-0"
                        title="Delete"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                )}
              </div>
            );
          })}
              </div>
            </div>
          ))
        )}
      </div>

      {/* ── Thread Modal ── */}
      {threadSuggestion && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm"
          onClick={() => setThreadSuggestion(null)}
        >
          <div
            className="bg-card w-full max-w-lg rounded-3xl shadow-2xl border border-border flex flex-col max-h-[85vh] animate-in fade-in zoom-in-95 duration-200"
            onClick={e => e.stopPropagation()}
          >
            {/* Thread header */}
            <div className="flex justify-between items-start p-6 border-b border-border bg-muted/30 flex-shrink-0">
              <div className="flex-1 min-w-0 pr-4">
                <div className="flex items-center gap-2 mb-1 flex-wrap">
                  {(() => {
                    const ft = getFeedbackType(threadSuggestion.feedback_type);
                    return (
                      <span className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold border ${ft.color}`}>
                        {ft.icon} {ft.label}
                      </span>
                    );
                  })()}
                  {getStatusBadge(threadSuggestion.status)}
                </div>
                <h3 className="text-lg font-extrabold text-foreground leading-snug">{threadSuggestion.title}</h3>
                {threadSuggestion.description && (
                  <p className="text-sm text-muted-foreground mt-1 whitespace-pre-wrap">{threadSuggestion.description}</p>
                )}
                <p className="text-xs text-muted-foreground/60 mt-2">
                  By {threadSuggestion.is_anonymous ? 'Anonymous' : (threadSuggestion.username || 'Anonymous')}
                  {' · '}{new Date(threadSuggestion.created_at).toLocaleDateString()}
                  {' · '}<span className="font-bold">{threadSuggestion.score > 0 ? '+' : ''}{threadSuggestion.score} votes</span>
                </p>
              </div>
              <button
                onClick={() => setThreadSuggestion(null)}
                className="text-muted-foreground hover:text-foreground bg-background p-1.5 rounded-full border border-border shadow-sm transition-colors flex-shrink-0"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Comments list */}
            <div className="flex-1 overflow-y-auto p-6 space-y-4 min-h-0">
              {isLoadingComments ? (
                <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>
              ) : threadComments.length === 0 ? (
                <div className="text-center py-8">
                  <MessageSquare className="w-10 h-10 text-muted-foreground mx-auto mb-2 opacity-30" />
                  <p className="text-sm text-muted-foreground font-medium">No responses yet. Be the first!</p>
                </div>
              ) : (
                threadComments.map((c, i) => {
                  const isAdmin = c.profiles?.is_admin;
                  const isMe = c.user_id === profile?.id;
                  const canDelete = isMe || profile?.is_admin;
                  return (
                    <div key={c.id || i} className={`flex gap-3 ${isMe ? 'flex-row-reverse' : ''} group`}>
                      {/* Avatar */}
                      <div className={`w-8 h-8 rounded-full flex-shrink-0 flex items-center justify-center text-xs font-bold border ${
                        isAdmin ? 'bg-primary/10 border-primary text-primary' : 'bg-muted border-border text-foreground'
                      }`}>
                        {c.profiles?.avatar_url
                          ? <img src={c.profiles.avatar_url} className="w-full h-full rounded-full object-cover" alt="" />
                          : (c.profiles?.username?.[0]?.toUpperCase() ?? '?')
                        }
                      </div>
                      <div className={`flex flex-col max-w-[75%] ${isMe ? 'items-end' : ''}`}>
                        <div className="flex items-center gap-1.5 mb-1">
                          <span className="text-xs font-bold text-foreground">
                            {c.profiles?.username ?? 'User'}
                          </span>
                          {isAdmin && (
                            <span className="text-[10px] font-bold bg-primary/10 text-primary px-1.5 py-0.5 rounded-full border border-primary/20">Admin</span>
                          )}
                          <span className="text-[10px] text-muted-foreground/60">
                            {new Date(c.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                          </span>
                          {canDelete && c.id && (
                            <button
                              onClick={() => handleDeleteComment(c.id)}
                              className="opacity-0 group-hover:opacity-100 p-0.5 text-muted-foreground hover:text-destructive transition-all"
                              title="Delete comment"
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
                          )}
                        </div>
                        <div className={`px-3 py-2 rounded-2xl text-sm whitespace-pre-wrap break-words ${
                          isMe
                            ? 'bg-primary text-primary-foreground rounded-tr-sm'
                            : isAdmin
                              ? 'bg-primary/10 border border-primary/25 text-foreground rounded-tl-sm'
                              : 'bg-background/80 border border-foreground/15 shadow-xs text-foreground rounded-tl-sm'
                        }`}>
                          {c.content}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
              <div ref={commentEndRef} />
            </div>

            {/* Comment input */}
            <div className="p-4 border-t border-border bg-muted/20 flex-shrink-0">
              {commentError && (
                <div className="bg-destructive/10 border border-destructive/20 text-destructive text-xs font-bold p-3 rounded-xl mb-3 flex items-start gap-2">
                  <span className="flex-1">{commentError}</span>
                  <button onClick={() => setCommentError(null)} className="text-destructive/80 hover:text-destructive">
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}
              <div className="flex gap-2 items-end">
                <textarea
                  value={newComment}
                  onChange={e => setNewComment(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); postComment(); }
                  }}
                  placeholder="Write a response..."
                  className="flex-1 px-3 py-2 bg-background border border-border rounded-xl text-sm text-foreground resize-none focus:outline-none focus:ring-2 focus:ring-primary min-h-[42px] max-h-32"
                  rows={1}
                />
                <button
                  onClick={postComment}
                  disabled={isPostingComment || !newComment.trim()}
                  className="flex-shrink-0 p-2.5 bg-primary text-primary-foreground rounded-xl hover:opacity-90 transition-colors disabled:opacity-50 shadow-sm"
                >
                  {isPostingComment ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                </button>
              </div>
              <p className="text-xs text-muted-foreground mt-1.5">Press Enter to send · Shift+Enter for new line</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
