import { X, Sun, Moon, Globe } from 'lucide-react';
import { useTheme } from '../hooks/useTheme';
import { useEffect } from 'react';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function SettingsModal({ isOpen, onClose }: SettingsModalProps) {
  const { theme, toggleTheme } = useTheme();

  // Close on Escape key
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm">
      <div 
        className="fixed inset-0" 
        onClick={onClose}
        aria-hidden="true"
      />
      
      <div className="bg-card w-full max-w-sm rounded-2xl shadow-xl border border-border overflow-hidden relative z-10 animate-in fade-in zoom-in-95 duration-200">
        <div className="flex justify-between items-center p-6 border-b border-border">
          <h3 className="text-xl font-bold text-foreground">Configuración</h3>
          <button 
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground transition-colors p-1"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        
        <div className="p-6 space-y-6">
          
          {/* Apariencia */}
          <div className="space-y-3">
            <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Apariencia</h4>
            
            <div className="flex items-center justify-between p-3 rounded-xl border border-border bg-background">
              <div className="flex items-center space-x-3 text-foreground">
                {theme === 'light' ? <Sun className="w-5 h-5 text-amber-500" /> : <Moon className="w-5 h-5 text-blue-400" />}
                <span className="font-medium">Modo Oscuro</span>
              </div>
              <button
                onClick={toggleTheme}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${theme === 'dark' ? 'bg-primary' : 'bg-muted'}`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${theme === 'dark' ? 'translate-x-6' : 'translate-x-1'}`}
                />
              </button>
            </div>
          </div>

          {/* Idioma */}
          <div className="space-y-3">
            <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Idioma</h4>
            
            <div className="flex flex-col space-y-2">
              <label className="flex items-center justify-between p-3 rounded-xl border border-primary/20 bg-primary/5 cursor-pointer">
                <div className="flex items-center space-x-3 text-foreground">
                  <Globe className="w-5 h-5 text-primary" />
                  <span className="font-medium">Español</span>
                </div>
                <div className="w-4 h-4 rounded-full border-2 border-primary flex items-center justify-center">
                  <div className="w-2 h-2 rounded-full bg-primary" />
                </div>
              </label>

              <label className="flex items-center justify-between p-3 rounded-xl border border-border bg-background cursor-pointer opacity-60 hover:opacity-100 transition-opacity">
                <div className="flex items-center space-x-3 text-foreground">
                  <Globe className="w-5 h-5 text-muted-foreground" />
                  <span className="font-medium">English (Coming soon)</span>
                </div>
                <div className="w-4 h-4 rounded-full border-2 border-border" />
              </label>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
