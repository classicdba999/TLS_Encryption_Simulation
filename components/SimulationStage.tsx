import React, { useEffect, useState } from 'react';
import { TlsStep, SimulationState } from '../types';
import { Laptop, Server, Lock, Unlock, Key, FileKey, ShieldCheck, Globe, CreditCard } from './Icons';

interface SimulationStageProps {
  currentState: SimulationState;
}

const SimulationStage: React.FC<SimulationStageProps> = ({ currentState }) => {
  // Visual state for animations
  const [packetVisible, setPacketVisible] = useState(false);
  const [packetDirection, setPacketDirection] = useState<'left' | 'right' | 'none'>('none');
  const [packetContent, setPacketContent] = useState<React.ReactNode>(null);

  useEffect(() => {
    // Reset visuals on step change
    setPacketVisible(false);
    
    const animateStep = () => {
      switch (currentState.step) {
        case TlsStep.CLIENT_HELLO:
          setPacketDirection('right');
          setPacketContent(
            <div className="flex flex-col gap-1 min-w-[140px]">
                <div className="flex items-center gap-1 text-[10px] font-mono font-bold bg-slate-900/50 p-1.5 rounded">
                    <span className="text-blue-400">TLS 1.3</span>
                    <span className="text-slate-500">|</span>
                    <span className="text-yellow-400">Client Random</span>
                </div>
                <div className="flex gap-1.5 flex-wrap">
                    <span className="bg-blue-600 text-white px-2 py-0.5 rounded text-[10px] whitespace-nowrap">Cipher: AES-GCM</span>
                    <span className="bg-yellow-600 text-white px-2 py-0.5 rounded text-[10px] whitespace-nowrap flex items-center gap-1"><Key size={8}/> PubKey Share</span>
                </div>
            </div>
          );
          setPacketVisible(true);
          break;
        case TlsStep.SERVER_HELLO:
          setPacketDirection('left');
          setPacketContent(
            <div className="flex flex-col gap-1 min-w-[140px]">
                <div className="flex items-center gap-1 text-[10px] font-mono font-bold bg-slate-900/50 p-1.5 rounded">
                    <span className="text-purple-400">Selected: AES-GCM</span>
                </div>
                <div className="flex gap-1.5 flex-wrap">
                    <span className="bg-purple-600 text-white px-2 py-0.5 rounded text-[10px] whitespace-nowrap flex items-center gap-1"><FileKey size={8}/> Cert</span>
                    <span className="bg-yellow-600 text-white px-2 py-0.5 rounded text-[10px] whitespace-nowrap flex items-center gap-1"><Key size={8}/> PubKey Share</span>
                </div>
            </div>
          );
          setPacketVisible(true);
          break;
        case TlsStep.SERVER_FINISHED:
          setPacketDirection('left');
          setPacketContent(
            <div className="flex items-center gap-2 text-xs font-mono bg-green-900/90 border border-green-500/50 px-3 py-2 rounded shadow-[0_0_15px_rgba(34,197,94,0.3)]">
                <Lock size={14} className="text-green-400"/>
                <div className="flex flex-col">
                    <span className="font-bold text-green-200">FINISHED</span>
                    <span className="text-[9px] text-green-400">HMAC(Transcript)</span>
                </div>
            </div>
          );
          setPacketVisible(true);
          break;
        case TlsStep.CLIENT_FINISHED:
          setPacketDirection('right');
          setPacketContent(
             <div className="flex items-center gap-2 text-xs font-mono bg-green-900/90 border border-green-500/50 px-3 py-2 rounded shadow-[0_0_15px_rgba(34,197,94,0.3)]">
                <Lock size={14} className="text-green-400"/>
                <div className="flex flex-col">
                    <span className="font-bold text-green-200">FINISHED</span>
                    <span className="text-[9px] text-green-400">HMAC(Transcript)</span>
                </div>
            </div>
          );
          setPacketVisible(true);
          break;
        case TlsStep.SECURE_TUNNEL:
          setPacketDirection('none'); 
          setPacketVisible(false);
          break;
        default:
          setPacketVisible(false);
      }
    };

    const timer = setTimeout(animateStep, 100);
    return () => clearTimeout(timer);
  }, [currentState.step]);

  // Determine lock state
  const isLocked = currentState.isEncrypted;

  return (
    <div className="w-full h-[500px] xl:h-[600px] bg-slate-900 rounded-xl border border-slate-700 relative overflow-hidden shadow-2xl flex flex-col items-center justify-center p-8 group">
      
      {/* Background Grid & Decor */}
      <div className="absolute inset-0 opacity-10 pointer-events-none" 
           style={{ backgroundImage: 'radial-gradient(#475569 1px, transparent 1px)', backgroundSize: '30px 30px' }}>
      </div>
      <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-slate-500/20 to-transparent"></div>
      <div className="absolute bottom-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-slate-500/20 to-transparent"></div>

      {/* Main Container */}
      <div className="relative w-full flex justify-between items-center px-8 lg:px-24">
        
        {/* Client Entity */}
        <div className={`flex flex-col items-center gap-4 transition-all duration-700 z-10 ${currentState.step !== TlsStep.IDLE ? 'scale-110' : ''}`}>
          <div className="relative">
            <div className={`w-36 h-36 xl:w-48 xl:h-48 rounded-3xl flex items-center justify-center text-slate-200 border-2 transition-all duration-700 relative
              ${isLocked 
                  ? 'bg-slate-900 border-emerald-500 shadow-[0_0_50px_rgba(16,185,129,0.2)]' 
                  : 'bg-slate-800 border-slate-600'}
            `}>
              <Laptop size={64} strokeWidth={1} className={`xl:w-24 xl:h-24 ${isLocked ? 'text-emerald-400' : 'text-slate-400'}`} />
              
              {/* Browser Tabs Visualization */}
              {isLocked && (
                  <div className="absolute top-8 right-8 w-4 h-4 bg-red-500 rounded-full animate-ping opacity-75"></div>
              )}
            </div>

            {/* Client Key Visual */}
            <div className={`absolute -top-4 -right-4 transition-all duration-500 z-20 ${currentState.clientKey ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}>
               <div className="bg-yellow-500 text-slate-900 p-2 xl:p-3 rounded-lg shadow-lg border-2 border-slate-900 flex items-center gap-1">
                 <Key size={18} fill="currentColor" />
                 <span className="text-[10px] font-bold font-mono uppercase">Priv Key</span>
               </div>
            </div>

            {/* Lock Badge */}
            <div className={`absolute -bottom-4 -right-4 transition-all duration-500 z-20 ${isLocked ? 'scale-100 opacity-100' : 'scale-0 opacity-0'}`}>
              <div className="bg-emerald-500 text-white p-2.5 rounded-full shadow-lg border-4 border-slate-900">
                <ShieldCheck size={24} />
              </div>
            </div>
          </div>
          <div className="text-center z-10">
            <div className="flex items-center gap-2 justify-center">
                <h3 className="font-bold text-slate-200 text-lg xl:text-xl">Browser</h3>
                <span className="text-[10px] bg-slate-700 px-1.5 py-0.5 rounded text-slate-400 border border-slate-600 uppercase tracking-wider">CLIENT</span>
            </div>
            <p className="text-xs text-slate-500 font-mono mt-1">192.168.1.10</p>
          </div>
        </div>

        {/* Connection Space / Packets 
            z-30 is higher than entities (z-10) so packets fly over.
            pointer-events-none allows clicks to pass through if needed.
        */}
        <div className="flex-1 mx-8 lg:mx-20 h-40 relative flex items-center justify-center z-30 pointer-events-none">
          
          {/* Connection Line - Sits below packets but within this space */}
          <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 h-1 bg-slate-800 rounded-full overflow-hidden z-0">
             {isLocked && (
                 <div className="w-full h-full bg-emerald-500/50 animate-pulse"></div>
             )}
          </div>

          {/* Secure Tunnel Visualization */}
          {currentState.step === TlsStep.SECURE_TUNNEL && (
            <div className="absolute inset-x-0 -top-16 -bottom-16 bg-emerald-500/5 rounded-full blur-2xl animate-pulse z-0"></div>
          )}
          
          {currentState.step === TlsStep.SECURE_TUNNEL && (
            <div className="absolute inset-0 flex items-center justify-center overflow-hidden z-10">
               {/* Flying Data Packets */}
               <div className="absolute w-full h-full flex flex-col justify-center gap-12 opacity-80">
                  <div className="flex items-center gap-2 animate-[packet-flow-right_1.5s_linear_infinite] w-max">
                      <CreditCard size={18} className="text-emerald-400" />
                      <span className="text-emerald-400 font-mono text-xs bg-emerald-950/80 px-2 py-1 rounded border border-emerald-500/30 backdrop-blur-sm shadow-lg">AES256(CC_NUM)</span>
                  </div>
                  <div className="flex items-center gap-2 animate-[packet-flow-left_2s_linear_infinite] w-max self-end">
                      <span className="text-emerald-400 font-mono text-xs bg-emerald-950/80 px-2 py-1 rounded border border-emerald-500/30 backdrop-blur-sm shadow-lg">AES256(HTML_BODY)</span>
                      <Globe size={18} className="text-emerald-400" />
                  </div>
               </div>
            </div>
          )}

          {/* Moving Packet - High Z-Index to fly OVER everything */}
          {packetVisible && currentState.step !== TlsStep.SECURE_TUNNEL && (
            <div 
              className={`absolute top-1/2 -translate-y-1/2 transition-all duration-[4500ms] linear z-50
                ${packetDirection === 'right' ? 'left-[0%] translate-x-[40vw] opacity-0' : ''}
                ${packetDirection === 'left' ? 'right-[0%] -translate-x-[40vw] opacity-0' : ''}
                ${packetDirection === 'none' ? 'opacity-0' : 'opacity-100'}
              `}
              key={currentState.step}
              style={{ transitionDelay: '100ms' }}
            >
              <div className="bg-slate-800/95 border border-slate-500 text-slate-200 px-5 py-3 rounded-lg shadow-2xl flex items-center gap-3 relative min-w-[180px] justify-center backdrop-blur-md">
                {/* Connector dots */}
                <div className={`absolute top-1/2 w-2 h-2 bg-slate-400 rounded-full ${packetDirection === 'right' ? '-right-1' : '-left-1'}`}></div>
                {packetContent}
              </div>
            </div>
          )}

          {/* Key Derivation Visualization */}
          {currentState.step === TlsStep.KEY_DERIVATION && (
             <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-40 w-full flex justify-center">
                <div className="relative">
                    <div className="flex gap-24">
                        <div className="bg-yellow-500/10 p-8 rounded-full animate-[pulse_1s_infinite] border border-yellow-500/30 backdrop-blur-sm">
                            <Key className="text-yellow-500 animate-[spin_3s_linear_infinite]" size={48} />
                        </div>
                        <div className="bg-yellow-500/10 p-8 rounded-full animate-[pulse_1s_infinite] border border-yellow-500/30 animation-delay-500 backdrop-blur-sm">
                            <Key className="text-yellow-500 animate-[spin_3s_linear_infinite_reverse]" size={48} />
                        </div>
                    </div>
                    {/* Math Operator */}
                    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-yellow-500 font-bold text-3xl drop-shadow-lg">
                        ×
                    </div>
                </div>
                
                <div className="absolute top-32 text-center w-full">
                    <div className="text-yellow-400 font-mono text-sm bg-slate-900/90 px-4 py-2 rounded border border-yellow-500/30 shadow-xl inline-block">
                        <span className="block font-bold mb-1">ECDHE(Curve25519)</span>
                        Calculating Shared Secret...
                    </div>
                </div>
             </div>
          )}

        </div>

        {/* Server Entity */}
        <div className={`flex flex-col items-center gap-4 transition-all duration-700 z-10 ${currentState.step !== TlsStep.IDLE ? 'scale-110' : ''}`}>
           <div className="relative">
            <div className={`w-36 h-36 xl:w-48 xl:h-48 rounded-3xl flex items-center justify-center text-slate-200 border-2 transition-all duration-700 relative z-10
              ${isLocked 
                ? 'bg-slate-900 border-emerald-500 shadow-[0_0_50px_rgba(16,185,129,0.2)]' 
                : 'bg-slate-800 border-slate-600'}
            `}>
              <Server size={64} strokeWidth={1} className={`xl:w-24 xl:h-24 ${isLocked ? 'text-emerald-400' : 'text-slate-400'}`} />
            </div>

            {/* Server Key Visual */}
            <div className={`absolute -top-4 -left-4 transition-all duration-500 z-20 ${currentState.serverKey ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}>
              <div className="bg-yellow-500 text-slate-900 p-2 xl:p-3 rounded-lg shadow-lg border-2 border-slate-900 flex items-center gap-1">
                <Key size={18} fill="currentColor" />
                <span className="text-[10px] font-bold font-mono uppercase">Priv Key</span>
              </div>
            </div>

            {/* Certificate Badge */}
            <div className={`absolute -bottom-4 -left-4 transition-all duration-500 delay-100 z-20 ${currentState.step !== TlsStep.IDLE ? 'opacity-100 scale-100' : 'opacity-0 scale-50'}`}>
                <div className="bg-purple-500 text-white p-2.5 rounded-lg shadow-lg border-4 border-slate-900 flex items-center gap-2">
                    <FileKey size={20} />
                    <span className="text-[10px] font-bold">CERT</span>
                </div>
            </div>
          </div>
          <div className="text-center z-10">
            <div className="flex items-center gap-2 justify-center">
                <h3 className="font-bold text-slate-200 text-lg xl:text-xl">classicdba.com</h3>
                <span className="text-[10px] bg-slate-700 px-1.5 py-0.5 rounded text-slate-400 border border-slate-600 uppercase tracking-wider">SERVER</span>
            </div>
            <p className="text-xs text-slate-500 font-mono mt-1">104.21.55.2</p>
          </div>
        </div>

      </div>

      {/* Connection Status Badge */}
      <div className={`absolute top-6 left-1/2 -translate-x-1/2 px-6 py-2 rounded-full flex items-center gap-3 border text-sm font-bold tracking-wide transition-all duration-500 z-40
        ${isLocked 
          ? 'bg-emerald-950/80 border-emerald-500 text-emerald-400 shadow-[0_0_20px_rgba(16,185,129,0.4)]' 
          : 'bg-slate-900/80 border-slate-700 text-slate-500'}
      `}>
        {isLocked ? <Lock size={16} /> : <Unlock size={16} />}
        <span>{isLocked ? 'ENCRYPTED CONNECTION (TLS 1.3)' : 'NOT SECURE'}</span>
      </div>

    </div>
  );
};

export default SimulationStage;