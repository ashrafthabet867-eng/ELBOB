import React, { useState } from 'react';
import { usePWAInstall } from '../hooks/usePWAInstall';
import { Download, Smartphone, X, Share2, PlusSquare } from 'lucide-react';

export const PWAInstallButton: React.FC = () => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showIOSModal, setShowIOSModal] = useState(false);

  // If already installed as standalone app, hide the button
  if (isInstalled) {
    return null;
  }

  // Chromium / Android / Desktop flow
  if (isInstallable) {
    return (
      <button
        onClick={install}
        className="flex items-center gap-1.5 px-3 py-1.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-xs font-bold rounded-xl shadow-md transition active:scale-95 cursor-pointer border border-emerald-400/30"
        title="تثبيت تطبيق البوب على جهازك"
      >
        <Download className="w-3.5 h-3.5" />
        <span className="hidden sm:inline">تثبيت التطبيق</span>
      </button>
    );
  }

  // iOS Safari flow
  if (isIOS) {
    return (
      <>
        <button
          onClick={() => setShowIOSModal(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-emerald-400 border border-slate-700 text-xs font-bold rounded-xl shadow-sm transition active:scale-95 cursor-pointer"
          title="تثبيت التطبيق على آيفون / آيباد"
        >
          <Smartphone className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">تثبيت التطبيق</span>
        </button>

        {showIOSModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
            <div className="w-full max-w-sm rounded-2xl bg-slate-900 border border-slate-800 p-6 shadow-2xl text-slate-100 space-y-4">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <Smartphone className="w-5 h-5 text-emerald-400" />
                  تثبيت «البوب» على الآيفون
                </h3>
                <button
                  onClick={() => setShowIOSModal(false)}
                  className="p-1.5 text-slate-400 hover:text-white rounded-lg transition"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-3 text-xs leading-relaxed text-slate-300">
                <div className="flex items-start gap-2.5 bg-slate-800/60 p-3 rounded-xl border border-slate-700/60">
                  <Share2 className="w-5 h-5 text-sky-400 shrink-0 mt-0.5" />
                  <p>1. اضغط على زر <strong>المشاركة (Share)</strong> في شريط متصفح سفاري السفلي.</p>
                </div>
                <div className="flex items-start gap-2.5 bg-slate-800/60 p-3 rounded-xl border border-slate-700/60">
                  <PlusSquare className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
                  <p>2. مرر للأسفل واضغط على <strong>«إضافة إلى الصفحة الرئيسية» (Add to Home Screen)</strong>.</p>
                </div>
              </div>

              <button
                onClick={() => setShowIOSModal(false)}
                className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl transition cursor-pointer"
              >
                فهمت، شكراً
              </button>
            </div>
          </div>
        )}
      </>
    );
  }

  // Fallback for browsers before beforeinstallprompt fires or desktop
  return (
    <button
      onClick={() => {
        alert('لتثبيت تطبيق البوب على هاتفك أو كمبيوترك:\n- في متصفح Chrome/Edge: اضغط على الثلاث نقاط بالأعلى واختر "تثبيت التطبيق" (Install App).\n- في هواتف أندرويد: اختر "إضافة إلى الشاشة الرئيسية".');
      }}
      className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800/90 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 text-xs font-bold rounded-xl transition cursor-pointer"
      title="كيفية تثبيت التطبيق"
    >
      <Download className="w-3.5 h-3.5 text-emerald-400" />
      <span className="hidden sm:inline">تثبيت التطبيق</span>
    </button>
  );
};
