import React from 'react';

export const Watermark: React.FC = () => {
  return (
    <div className="fixed bottom-6 right-8 pointer-events-none z-[200] opacity-40 hover:opacity-100 transition-opacity">
      <div className="text-right flex flex-col items-end">
        <h1 className="text-3xl font-black tracking-tighter text-slate-700 uppercase drop-shadow-lg select-none">
          classicdba.com
        </h1>
        <div className="flex items-center gap-2">
            <div className="h-px w-12 bg-slate-700"></div>
            <p className="text-[10px] text-slate-600 font-mono tracking-widest uppercase">
            Official TLS Simulation
            </p>
        </div>
      </div>
    </div>
  );
};