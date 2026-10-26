import React, { useState } from 'react';
import { Copy, Check, FileText, Volume2, VolumeX } from 'lucide-react';
import { Message } from '../types';

interface ChatMessageProps {
  message: Message;
  isStreaming?: boolean;
}

export const ChatMessage: React.FC<ChatMessageProps> = ({ message, isStreaming }) => {
  const isModel = message.role === 'model';
  const [copied, setCopied] = useState(false);
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);
  const [showImagePreview, setShowImagePreview] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(message.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleToggleVoice = () => {
    if (!('speechSynthesis' in window)) {
      alert('متصفحك لا يدعم القراءة الصوتية.');
      return;
    }

    if (isPlayingAudio) {
      window.speechSynthesis.cancel();
      setIsPlayingAudio(false);
      return;
    }

    window.speechSynthesis.cancel();

    const cleanText = message.content
      .replace(/[#*`_~|]/g, '')
      .replace(/https?:\/\/\S+/g, '')
      .trim();

    const utterance = new SpeechSynthesisUtterance(cleanText);
    utterance.lang = 'ar-SA';
    utterance.rate = 1.05;

    const voices = window.speechSynthesis.getVoices();
    const arVoice = voices.find((v) => v.lang.startsWith('ar'));
    if (arVoice) utterance.voice = arVoice;

    utterance.onstart = () => setIsPlayingAudio(true);
    utterance.onend = () => setIsPlayingAudio(false);
    utterance.onerror = () => setIsPlayingAudio(false);

    window.speechSynthesis.speak(utterance);
  };

  return (
    <div className={`flex flex-col my-3.5 ${isModel ? 'items-start' : 'items-end'}`}>
      {/* Sender Header */}
      <div className="flex items-center gap-2 mb-1 px-1 text-xs">
        {isModel ? (
          <span className="font-extrabold text-emerald-400">البوب</span>
        ) : (
          <span className="font-medium text-slate-400">أنت</span>
        )}
        <span className="text-[10px] text-slate-500">{message.timestamp}</span>
      </div>

      {/* Bubble */}
      <div
        className={`rounded-2xl p-4 text-sm leading-relaxed max-w-full sm:max-w-[90%] border shadow-md ${
          isModel
            ? 'bg-slate-900 text-slate-100 border-slate-800'
            : 'bg-emerald-700 text-white border-emerald-600 rounded-tr-none'
        }`}
      >
        {/* Render Attachment if present */}
        {message.attachment && (
          <div className="mb-3">
            {message.attachment.type === 'image' ? (
              <div>
                <img
                  src={`data:${message.attachment.mimeType};base64,${message.attachment.data}`}
                  alt={message.attachment.name}
                  onClick={() => setShowImagePreview(true)}
                  className="max-h-60 rounded-xl border border-white/20 cursor-pointer hover:opacity-95 transition object-cover"
                />
                <span className="block text-[11px] text-emerald-200/80 mt-1">
                  📷 {message.attachment.name} (انقر للتكبير)
                </span>
              </div>
            ) : (
              <div className="flex items-center gap-2.5 p-2.5 rounded-xl bg-black/20 border border-white/10 text-xs">
                <FileText className="w-5 h-5 text-emerald-300 shrink-0" />
                <div className="truncate">
                  <span className="font-semibold block truncate">{message.attachment.name}</span>
                  <span className="text-[10px] opacity-75">مستند مرفق</span>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Message Content */}
        {isModel ? (
          <div className="space-y-2.5">
            {renderFormattedContent(message.content)}
            {isStreaming && (
              <span className="inline-block w-2 h-3.5 bg-emerald-400 animate-pulse mr-1 align-middle rounded" />
            )}
          </div>
        ) : (
          message.content && <p className="whitespace-pre-wrap leading-relaxed">{message.content}</p>
        )}
      </div>

      {/* Action buttons for model messages: Copy & Speak Aloud */}
      {isModel && !isStreaming && (
        <div className="mt-1 mr-1 flex items-center gap-2">
          {/* Read Aloud Button */}
          <button
            onClick={handleToggleVoice}
            className={`flex items-center gap-1 text-[11px] transition py-0.5 px-2 rounded cursor-pointer ${
              isPlayingAudio
                ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30 animate-pulse'
                : 'text-slate-400 hover:text-emerald-400 hover:bg-slate-800/80'
            }`}
            title={isPlayingAudio ? 'إيقاف الصوت' : 'استمع للشرح صوتياً'}
          >
            {isPlayingAudio ? (
              <>
                <VolumeX className="w-3.5 h-3.5" />
                <span>إيقاف الصوت</span>
              </>
            ) : (
              <>
                <Volume2 className="w-3.5 h-3.5" />
                <span>استمع للشرح</span>
              </>
            )}
          </button>

          {/* Copy Button */}
          <button
            onClick={handleCopy}
            className="flex items-center gap-1 text-[11px] text-slate-400 hover:text-slate-200 transition py-0.5 px-2 rounded hover:bg-slate-800/80 cursor-pointer"
            title="نسخ النص"
          >
            {copied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
            <span>{copied ? 'تم النسخ' : 'نسخ'}</span>
          </button>
        </div>
      )}

      {/* Lightbox Image Preview Modal */}
      {showImagePreview && message.attachment && (
        <div
          onClick={() => setShowImagePreview(false)}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md cursor-pointer animate-fade-in"
        >
          <div className="relative max-w-3xl max-h-[90vh] overflow-hidden rounded-2xl">
            <img
              src={`data:${message.attachment.mimeType};base64,${message.attachment.data}`}
              alt={message.attachment.name}
              className="max-h-[85vh] max-w-full object-contain rounded-xl shadow-2xl"
            />
          </div>
        </div>
      )}
    </div>
  );
};

function renderFormattedContent(text: string): React.ReactNode {
  const lines = text.split('\n');
  const elements: React.ReactNode[] = [];
  let tableLines: string[] = [];
  let key = 0;

  const flushTable = () => {
    if (tableLines.length > 0) {
      elements.push(renderTable(tableLines, `tbl-${key++}`));
      tableLines = [];
    }
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    if (line.trim().startsWith('|') && line.trim().endsWith('|')) {
      tableLines.push(line);
      continue;
    } else {
      flushTable();
    }

    if (!line.trim()) {
      elements.push(<div key={`sp-${key++}`} className="h-1.5" />);
      continue;
    }

    if (line.startsWith('### ')) {
      elements.push(
        <h4 key={`h3-${key++}`} className="font-bold text-emerald-400 text-sm pt-1">
          {line.replace('### ', '')}
        </h4>
      );
      continue;
    }
    if (line.startsWith('## ')) {
      elements.push(
        <h3 key={`h2-${key++}`} className="font-bold text-emerald-300 text-base pt-1">
          {line.replace('## ', '')}
        </h3>
      );
      continue;
    }

    // Bullet points
    if (line.trim().startsWith('- ') || line.trim().startsWith('* ')) {
      elements.push(
        <div key={`li-${key++}`} className="flex items-start gap-2 text-slate-200 my-0.5 text-xs sm:text-sm">
          <span className="text-emerald-400 font-bold shrink-0 mt-0.5">•</span>
          <div className="flex-1">{renderInlineStyles(line.trim().substring(2))}</div>
        </div>
      );
      continue;
    }

    // Numbered points
    const numMatch = line.trim().match(/^(\d+)\.\s+(.*)/);
    if (numMatch) {
      elements.push(
        <div key={`num-${key++}`} className="flex items-start gap-2 text-slate-200 my-0.5 text-xs sm:text-sm">
          <span className="font-bold text-emerald-400 font-mono shrink-0">{numMatch[1]}.</span>
          <div className="flex-1">{renderInlineStyles(numMatch[2])}</div>
        </div>
      );
      continue;
    }

    elements.push(
      <p key={`p-${key++}`} className="text-xs sm:text-sm text-slate-200 leading-relaxed">
        {renderInlineStyles(line)}
      </p>
    );
  }

  flushTable();
  return elements;
}

function renderTable(lines: string[], tableKey: string): React.ReactNode {
  const content = lines.filter((l) => !l.replace(/[\s|:-]/g, '').length === false);
  if (content.length === 0) return null;

  const headers = content[0]
    .split('|')
    .map((c) => c.trim())
    .filter((_, i, arr) => i > 0 && i < arr.length - 1);

  const rows = content.slice(1).filter((l) => !l.includes('---'));

  return (
    <div key={tableKey} className="my-2.5 overflow-x-auto rounded-xl border border-slate-700 bg-slate-950/70">
      <table className="w-full text-right text-xs">
        <thead>
          <tr className="bg-slate-800/80 text-emerald-300 border-b border-slate-700">
            {headers.map((h, idx) => (
              <th key={idx} className="py-2 px-3 font-bold border-l border-slate-700 last:border-l-0">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-800">
          {rows.map((row, rIdx) => {
            const cells = row
              .split('|')
              .map((c) => c.trim())
              .filter((_, i, arr) => i > 0 && i < arr.length - 1);
            return (
              <tr key={rIdx} className="hover:bg-slate-800/40 transition">
                {cells.map((cell, cIdx) => (
                  <td key={cIdx} className="py-1.5 px-3 border-l border-slate-800 last:border-l-0 text-slate-200">
                    {renderInlineStyles(cell)}
                  </td>
                ))}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function renderInlineStyles(text: string): React.ReactNode {
  const parts = text.split(/(\*\*.*?\*\*|`.*?`)/g);
  return parts.map((part, index) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return (
        <strong key={index} className="font-bold text-emerald-300">
          {part.slice(2, -2)}
        </strong>
      );
    }
    if (part.startsWith('`') && part.endsWith('`')) {
      return (
        <code key={index} className="px-1 py-0.5 rounded bg-slate-800 text-emerald-300 font-mono text-xs">
          {part.slice(1, -1)}
        </code>
      );
    }
    return part;
  });
}
