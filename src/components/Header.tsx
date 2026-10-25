import React from 'react';
import { RotateCcw, KeyRound, Mic } from 'lucide-react';

interface HeaderProps {
  onResetChat: () => void;
  hasMessages: boolean;
  onLockApp: () => void;
  onOpenVoiceMode: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  onResetChat,
  hasMessages,
  onLockApp,
  onOpenVoiceMode,
}) => {
  return (
    <header className="border-b border-slate-800/80 bg-slate-900/95 sticky top-0 z-30 px-4 py-3 backdrop-blur-sm">
      <div className="max-w-3xl mx-auto flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <h1 className="text-xl sm:text-2xl font-black text-emerald-400 tracking-wide font-sans">
            البوب
          </h1>
        </div>

        <div className="flex items-center gap-2">
          {/* Dedicated Voice Chat Button */}
          <button
            onClick={onOpenVoiceMode}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600/90 hover:bg-emerald-500 text-white text-xs font-bold rounded-xl shadow-md transition active:scale-95 cursor-pointer"
            title="فتح المحادثة الصوتية المباشرة"
          >
            <Mic className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">محادثة صوتية</span>
          </button>

          {hasMessages && (
            <button
              onClick={onResetChat}
              className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-slate-800 rounded-lg transition"
              title="محادثة جديدة"
            >
              <RotateCcw className="w-4 h-4" />
            </button>
          )}

          <button
            onClick={onLockApp}
            className="p-1.5 text-slate-400 hover:text-emerald-400 hover:bg-slate-800 rounded-lg transition"
            title="قفل التطبيق / مفتاح الدخول"
          >
            <KeyRound className="w-4 h-4" />
          </button>
        </div>
      </div>
    </header>
  );
};
