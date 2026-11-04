import React, { useState } from 'react';
import { usePWAInstall } from '../hooks/usePWAInstall';
import { Download, Smartphone, X, Share2, PlusSquare, Monitor, CheckCircle2 } from 'lucide-react';

export const PWAInstallButton: React.FC = () => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showModal, setShowModal] = useState(false);

  // If already installed as standalone app, hide the button
  if (isInstalled) {
    return null;
  }

  // Chromium / Android / Desktop standard prompt
  if (isInstallable) {
    return (
      <button
        onClick={install}
        className="flex items-center gap-1.5 px-3 py-1.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-xs font-bold rounded-xl shadow-md transition active:scale-95 cursor-pointer border border-emerald-400/40"
        title="تثبيت تطبيق البوب على جهازك"
      >
        <Download className="w-3.5 h-3.5" />
        <span>تثبيت التطبيق</span>
      </button>
    );
  }

  return (
    <>
      <button
        onClick={() => setShowModal(true)}
        className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 border border-emerald-500/30 text-xs font-bold rounded-xl transition cursor-pointer"
        title="تثبيت التطبيق على جهازك"
      >
        <Download className="w-3.5 h-3.5 text-emerald-400" />
        <span>تثبيت التطبيق</span>
      </button>

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-sm rounded-2xl bg-slate-900 border border-slate-800 p-6 shadow-2xl text-slate-100 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Smartphone className="w-5 h-5 text-emerald-400" />
                تثبيت تطبيق «البوب»
              </h3>
              <button
                onClick={() => setShowModal(false)}
                className="p-1.5 text-slate-400 hover:text-white rounded-lg transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs leading-relaxed text-slate-300">
              {isIOS ? (
                <>
                  <div className="flex items-start gap-2.5 bg-slate-800/60 p-3 rounded-xl border border-slate-700/60">
                    <Share2 className="w-5 h-5 text-sky-400 shrink-0 mt-0.5" />
                    <p>1. اضغط على زر <strong>المشاركة (Share)</strong> في شريط متصفح سفاري السفلي.</p>
                  </div>
                  <div className="flex items-start gap-2.5 bg-slate-800/60 p-3 rounded-xl border border-slate-700/60">
                    <PlusSquare className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
                    <p>2. اختر <strong>«إضافة إلى الصفحة الرئيسية» (Add to Home Screen)</strong>.</p>
                  </div>
                </>
              ) : (
                <>
                  <div className="flex items-start gap-2.5 bg-slate-800/60 p-3 rounded-xl border border-slate-700/60">
                    <Monitor className="w-5 h-5 text-sky-400 shrink-0 mt-0.5" />
                    <p><strong>في متصفح Chrome أو Edge:</strong> اضغط على قائمة الثلاث نقاط بالأعلى، ثم اختر <strong>«تثبيت التطبيق» (Install App)</strong> أو من شريط العنوان.</p>
                  </div>
                  <div className="flex items-start gap-2.5 bg-slate-800/60 p-3 rounded-xl border border-slate-700/60">
                    <Smartphone className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
                    <p><strong>في هواتف أندرويد:</strong> اضغط على قائمة المتصفح واختر <strong>«إضافة إلى الشاشة الرئيسية»</strong> لتثبيت التطبيق واستخدامه دون فتح المتصفح.</p>
                  </div>
                </>
              )}
            </div>

            <button
              onClick={() => setShowModal(false)}
              className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl transition cursor-pointer shadow-md"
            >
              فهمت، شكراً
            </button>
          </div>
        </div>
      )}
    </>
  );
};
