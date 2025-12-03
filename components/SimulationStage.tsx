
import React, { useEffect, useState } from 'react';
import { TlsStep, SimulationState } from '../types';
import { Laptop, Server, Lock, Unlock, Key, FileKey, ShieldCheck, Globe, CreditCard } from './Icons';

interface SimulationStageProps {
  currentState: SimulationState;
}

const SimulationStage: React.FC<SimulationStageProps> = ({ currentState }) => {
  const [packetVisible, setPacketVisible] = useState(false);
  // Direction now controls the visual state from Start -> End
  const [packetDirection, setPacketDirection] = useState<'left' | 'right' | 'none'>('none');
  const [packetContent, setPacketContent] = useState<React.ReactNode>(null);
  const [animationActive, setAnimationActive] = useState(false);

  useEffect(() => {
    setPacketVisible(false);
    setAnimationActive(false);
    
    const animateStep = () => {
      let content = null;
      let dir: 'left' | 'right' | 'none' = 'none';

      switch (currentState.step) {
        case TlsStep.CLIENT_HELLO:
          dir = 'right';
          content = (
            <div className="flex flex-col gap-1 min-w-[120px]">
                <div className="flex items-center gap-1 text-[9px] font-mono font-bold bg-slate-900/80 p-1 rounded">
                    <span className="text-blue-300">TLS 1.3</span>
                    <span className="text-yellow-300">Random</span>
                </div>
                <div className="flex gap-1 flex-wrap">
                    <span className="bg-blue-600 text-white px-1.5 py-0.5 rounded text-[9px] whitespace-nowrap">AES-GCM</span>
                    <span className="bg-yellow-600 text-white px-1.5 py-0.5 rounded text-[9px] whitespace-nowrap flex items-center gap-1"><Key size={8}/> KeyShare</span>
                </div>
            </div>
          );
          break;
        case TlsStep.SERVER_HELLO:
          dir = 'left';
          content = (
            <div className="flex flex-col gap-1 min-w-[120px]">
                <div className="flex items-center gap-1 text-[9px] font-mono font-bold bg-slate-900/80 p-1 rounded">
                    <span className="text-purple-300">Selected</span>
                </div>
                <div className="flex gap-1 flex-wrap">
                    <span className="bg-purple-600 text-white px-1.5 py-0.5 rounded text-[9px] whitespace-nowrap flex items-center gap-1"><FileKey size={8}/> Cert</span>
                    <span className="bg-yellow-600 text-white px-1.5 py-0.5 rounded text-[9px] whitespace-nowrap flex items-center gap-1"><Key size={8}/> KeyShare</span>
                </div>
            </div>
          );
          break;
        case TlsStep.SERVER_FINISHED:
          dir = 'left';
          content = (
            <div className="flex items-center gap-2 text-[10px] font-mono bg-green-900/90 border border-green-500/50 px-2 py-1.5 rounded shadow-[0_0_10px_rgba(34,197,94,0.3)]">
                <Lock size={12} className="text-green-300"/>
                <div className="flex flex-col">
                    <span className="font-bold text-green-100">FINISHED</span>
                    <span className="text-[8px] text-green-300">HMAC(All)</span>
                </div>
            </div>
          );
          break;
        case TlsStep.CLIENT_FINISHED:
          dir = 'right';
          content = (
             <div className="flex items-center gap-2 text-[10px] font-mono bg-green-900/90 border border-green-500/50 px-2 py-1.5 rounded shadow-[0_0_10px_rgba(34,197,94,0.3)]">
                <Lock size={12} className="text-green-300"/>
                <div className="flex flex-col">
                    <span className="font-bold text-green-100">FINISHED</span>
                    <span className="text-[8px] text-green-300">HMAC(All)</span>
                </div>
            </div>
          );
          break;
      }

      if (dir !== 'none') {
        setPacketDirection(dir);
        setPacketContent(content);
        setPacketVisible(true);
        // Trigger the CSS transition after render
        setTimeout(() => setAnimationActive(true), 100);
      }
    };

    const timer = setTimeout(animateStep, 100);
    return () => clearTimeout(timer);
  }, [currentState.step]);

  const isLocked = currentState.isEncrypted;

  return (
    <div className="w-full h-[320px] bg-slate-900 rounded-xl border border-slate-700 relative overflow-hidden shadow-2xl flex flex-col items-center justify-center p-4 group" role="region" aria-label="TLS Simulation Stage">
      
      {/* Background */}
      <div className="absolute inset-0 opacity-10 pointer-events-none z-0" 
           style={{ backgroundImage: 'radial-gradient(#64748b 1px, transparent 1px)', backgroundSize: '24px 24px' }}>
      </div>

      {/* Connection Line Visual */}
      <div className="absolute w-[60%] h-1 bg-slate-800 rounded-full top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-0 overflow-hidden">
         {isLocked && <div className="w-full h-full bg-emerald-500/50 animate-pulse"></div>}
      </div>

      {/* PACKET OVERLAY LAYER (Z-50) - Absolute positioning relative to container to float OVER entities */}
      <div className="absolute inset-0 z-50 pointer-events-none overflow-hidden" aria-hidden="true">
          
          {/* Flying Packet - Slowed down duration to 5000ms */}
          {packetVisible && currentState.step !== TlsStep.SECURE_TUNNEL && (
            <div 
              className={`absolute top-1/2 -translate-y-1/2 transition-all duration-[5000ms] linear
                ${/* Initial State vs End State for Animation */ ''}
                ${packetDirection === 'right' 
                    ? (animationActive ? 'left-[75%] opacity-0' : 'left-[15%] opacity-100') 
                    : (animationActive ? 'left-[15%] opacity-0' : 'left-[75%] opacity-100')
                }
              `}
            >
              <div className="bg-slate-800/95 border border-slate-500 text-slate-200 px-3 py-2 rounded-lg shadow-2xl flex items-center gap-2 relative min-w-[140px] justify-center backdrop-blur-md -translate-x-1/2">
                {/* Connector dots */}
                <div className={`absolute top-1/2 w-1.5 h-1.5 bg-slate-400 rounded-full ${packetDirection === 'right' ? '-right-1' : '-left-1'}`}></div>
                {packetContent}
              </div>
            </div>
          )}

          {/* Secure Tunnel Traffic Visualization */}
          {currentState.step === TlsStep.SECURE_TUNNEL && (
             <div className="absolute w-full h-full flex flex-col justify-center items-center gap-6 opacity-60">
                 <div className="w-[60%] h-16 relative overflow-hidden">
                    <div className="absolute top-0 animate-[flowRight_3s_linear_infinite] flex items-center gap-2">
                        <CreditCard size={14} className="text-emerald-400" />
                        <div className="h-1 w-8 bg-emerald-500/50 rounded-full"></div>
                        <span className="text-[9px] font-mono text-emerald-300">AES256</span>
                    </div>
                     <div className="absolute bottom-0 animate-[flowLeft_3.5s_linear_infinite] flex items-center gap-2">
                        <Globe size={14} className="text-emerald-400" />
                        <div className="h-1 w-12 bg-emerald-500/50 rounded-full"></div>
                        <span className="text-[9px] font-mono text-emerald-300">HTML</span>
                    </div>
                 </div>
             </div>
          )}
      </div>

      {/* Entity Layer (Z-20) */}
      <div className="relative w-full flex justify-between items-center px-4 sm:px-12 lg:px-24 z-20 h-full">
        
        {/* Client Entity */}
        <div className={`flex flex-col items-center gap-3 transition-all duration-700 relative ${currentState.step !== TlsStep.IDLE ? 'scale-105' : ''}`}>
          <div className="relative">
            <div className={`w-28 h-28 lg:w-32 lg:h-32 rounded-2xl flex items-center justify-center text-slate-200 border-2 transition-all duration-700 relative bg-slate-800
              ${isLocked ? 'border-emerald-500 shadow-[0_0_30px_rgba(16,185,129,0.2)]' : 'border-slate-600'}
            `}>
              <Laptop size={40} strokeWidth={1} className={`lg:w-14 lg:h-14 ${isLocked ? 'text-emerald-400' : 'text-slate-400'}`} />
            </div>

            {/* Keys & Badges */}
            <div className={`absolute -top-3 -right-3 transition-all duration-500 z-30 ${currentState.clientKey ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}>
               <div className="bg-yellow-500 text-slate-900 p-1.5 rounded-lg shadow-lg border-2 border-slate-900 flex items-center gap-1">
                 <Key size={12} fill="currentColor" />
               </div>
            </div>
            <div className={`absolute -bottom-3 -right-3 transition-all duration-500 z-30 ${isLocked ? 'scale-100 opacity-100' : 'scale-0 opacity-0'}`}>
              <div className="bg-emerald-500 text-white p-2 rounded-full shadow-lg border-4 border-slate-900">
                <ShieldCheck size={16} />
              </div>
            </div>
          </div>
          <div className="text-center">
             <div className="flex items-center gap-2 justify-center">
                <span className="font-bold text-slate-200 text-sm">Browser</span>
                <span className="text-[9px] bg-slate-700 px-1 py-0.5 rounded text-slate-300 uppercase">CLIENT</span>
            </div>
            <p className="text-[10px] text-slate-400 font-mono">192.168.1.10</p>
          </div>
        </div>

        {/* Central Key Calculation */}
        {currentState.step === TlsStep.KEY_DERIVATION && (
           <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 flex flex-col items-center z-10">
               <div className="flex gap-16 mb-2">
                   <Key className="text-yellow-500 animate-[spin_3s_linear_infinite] opacity-50" size={32} />
                   <Key className="text-yellow-500 animate-[spin_3s_linear_infinite_reverse] opacity-50" size={32} />
               </div>
               <div className="bg-slate-900/90 border border-yellow-500/30 text-yellow-400 px-3 py-1 rounded text-[10px] font-mono shadow-xl whitespace-nowrap">
                  Calculating Shared Secret...
               </div>
           </div>
        )}

        {/* Server Entity */}
        <div className={`flex flex-col items-center gap-3 transition-all duration-700 relative ${currentState.step !== TlsStep.IDLE ? 'scale-105' : ''}`}>
           <div className="relative">
            <div className={`w-28 h-28 lg:w-32 lg:h-32 rounded-2xl flex items-center justify-center text-slate-200 border-2 transition-all duration-700 relative bg-slate-800
              ${isLocked ? 'border-emerald-500 shadow-[0_0_30px_rgba(16,185,129,0.2)]' : 'border-slate-600'}
            `}>
              <Server size={40} strokeWidth={1} className={`lg:w-14 lg:h-14 ${isLocked ? 'text-emerald-400' : 'text-slate-400'}`} />
            </div>

            <div className={`absolute -top-3 -left-3 transition-all duration-500 z-30 ${currentState.serverKey ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}>
              <div className="bg-yellow-500 text-slate-900 p-1.5 rounded-lg shadow-lg border-2 border-slate-900 flex items-center gap-1">
                <Key size={12} fill="currentColor" />
              </div>
            </div>

            <div className={`absolute -bottom-3 -left-3 transition-all duration-500 delay-100 z-30 ${currentState.step !== TlsStep.IDLE ? 'opacity-100 scale-100' : 'opacity-0 scale-50'}`}>
                <div className="bg-purple-500 text-white p-1.5 rounded-lg shadow-lg border-4 border-slate-900 flex items-center gap-1">
                    <FileKey size={14} />
                </div>
            </div>
          </div>
          <div className="text-center">
            <div className="flex items-center gap-2 justify-center">
                <span className="font-bold text-slate-200 text-sm">classicdba.com</span>
                <span className="text-[9px] bg-slate-700 px-1 py-0.5 rounded text-slate-300 uppercase">SERVER</span>
            </div>
            <p className="text-[10px] text-slate-400 font-mono">104.21.55.2</p>
          </div>
        </div>

      </div>

      {/* Status Badge */}
      <div className={`absolute top-4 left-1/2 -translate-x-1/2 px-4 py-1.5 rounded-full flex items-center gap-2 border text-xs font-bold tracking-wide transition-all duration-500 z-30
        ${isLocked 
          ? 'bg-emerald-950/90 border-emerald-500 text-emerald-400' 
          : 'bg-slate-900/80 border-slate-700 text-slate-400'}
      `}>
        {isLocked ? <Lock size={12} /> : <Unlock size={12} />}
        <span>{isLocked ? 'ENCRYPTED (TLS 1.3)' : 'NOT SECURE'}</span>
      </div>

    </div>
  );
};

export default SimulationStage;
