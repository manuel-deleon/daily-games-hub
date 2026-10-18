import { useState } from 'react';
import { useRegisterSW } from 'virtual:pwa-register/react';
import { Sparkles, RefreshCw, X } from 'lucide-react';

export function UpdateNotification() {
  const [isUpdating, setIsUpdating] = useState(false);

  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegistered(registration) {
      if (!registration) return;

      // Check for updates every 15 minutes
      setInterval(() => {
        registration.update().catch((err: unknown) => {
          console.warn('Failed to check for SW update:', err);
        });
      }, 15 * 60 * 1000);

      // Check for updates when user returns to tab
      const handleFocus = () => {
        registration.update().catch((err: unknown) => {
          console.warn('Failed to check for SW update on focus:', err);
        });
      };

      const handleVisibilityChange = () => {
        if (document.visibilityState === 'visible') {
          registration.update().catch((err: unknown) => {
            console.warn('Failed to check for SW update on visibility:', err);
          });
        }
      };

      window.addEventListener('focus', handleFocus);
      document.addEventListener('visibilitychange', handleVisibilityChange);
    },
    onRegisterError(error) {
      console.error('Service Worker registration failed:', error);
    },
  });

  if (!needRefresh) {
    return null;
  }

  const handleUpdate = async () => {
    setIsUpdating(true);
    try {
      await updateServiceWorker(true);
    } catch (err) {
      console.error('Failed to update service worker:', err);
      setIsUpdating(false);
    }
  };

  return (
    <div
      role="alert"
      className="fixed z-50 bottom-20 sm:bottom-6 right-4 sm:right-6 left-4 sm:left-auto sm:max-w-md bg-card border border-primary/30 shadow-2xl rounded-2xl p-4 transition-all duration-300 animate-in fade-in slide-in-from-bottom-4"
    >
      <div className="flex items-start gap-3">
        <div className="p-2.5 rounded-xl bg-primary/10 text-primary flex-shrink-0 mt-0.5">
          <Sparkles className="w-5 h-5 animate-pulse" />
        </div>

        <div className="flex-1 min-w-0 pr-1">
          <div className="flex items-center justify-between gap-2">
            <h4 className="text-sm font-bold text-foreground">Update Available!</h4>
            <button
              onClick={() => setNeedRefresh(false)}
              className="text-muted-foreground hover:text-foreground p-1 rounded-lg hover:bg-muted transition-colors cursor-pointer"
              title="Dismiss"
              aria-label="Dismiss"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
            A new version of DailyHub is ready. Refresh now to get the latest features and improvements.
          </p>

          <div className="mt-3 flex items-center gap-2">
            <button
              onClick={handleUpdate}
              disabled={isUpdating}
              className="flex-1 inline-flex items-center justify-center gap-2 px-3.5 py-2 text-xs font-semibold rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 shadow-sm transition-all active:scale-95 cursor-pointer disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isUpdating ? 'animate-spin' : ''}`} />
              {isUpdating ? 'Updating...' : 'Refresh now'}
            </button>
            <button
              onClick={() => setNeedRefresh(false)}
              className="px-3 py-2 text-xs font-semibold rounded-xl text-muted-foreground hover:text-foreground hover:bg-muted border border-border transition-all cursor-pointer"
            >
              Later
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
