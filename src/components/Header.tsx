import React from 'react';
import { RotateCcw } from 'lucide-react';

interface HeaderProps {
  onResetChat: () => void;
  hasMessages: boolean;
}

export const Header: React.FC<HeaderProps> = ({ onResetChat, hasMessages }) => {
  return (
    <header className="border-b border-slate-800/80 bg-slate-900/95 sticky top-0 z-30 px-4 py-3.5 backdrop-blur-sm">
      <div className="max-w-3xl mx-auto flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <h1 className="text-xl sm:text-2xl font-black text-emerald-400 tracking-wide font-sans">
            البوب
          </h1>
        </div>

        {hasMessages && (
          <button
            onClick={onResetChat}
            className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-slate-800 rounded-lg transition"
            title="محادثة جديدة"
          >
            <RotateCcw className="w-4 h-4" />
          </button>
        )}
      </div>
    </header>
  );
};
