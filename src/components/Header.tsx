import React from 'react';
import { RotateCcw } from 'lucide-react';
import { PWAInstallButton } from './PWAInstallButton';

interface HeaderProps {
  onResetChat: () => void;
  hasMessages: boolean;
}

export const Header: React.FC<HeaderProps> = ({
  onResetChat,
  hasMessages,
}) => {
  return (
    <header className="border-b border-slate-800/80 bg-slate-900/95 sticky top-0 z-30 px-4 py-2.5 sm:py-3 backdrop-blur-sm">
      <div className="max-w-3xl mx-auto flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 font-bold text-sm shadow-inner">
            🎓
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-black text-emerald-400 tracking-wide font-sans leading-none">
              البوب
            </h1>
            <span className="text-[11px] text-slate-400 font-medium hidden sm:inline">
              معلم المحاسبة المالية - الصف الثاني الثانوي (2026)
            </span>
          </div>
        </div>

        <div className="flex items-center gap-1.5 sm:gap-2">
          {/* PWA Install Button */}
          <PWAInstallButton />

          {hasMessages && (
            <button
              onClick={onResetChat}
              className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs text-slate-400 hover:text-rose-400 hover:bg-slate-800 rounded-lg transition cursor-pointer border border-transparent hover:border-slate-700"
              title="محادثة جديدة"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">محادثة جديدة</span>
            </button>
          )}
        </div>
      </div>
    </header>
  );
};
