
import React, { useState, useEffect, useRef } from 'react';
import SimulationStage from './components/SimulationStage';
import { Watermark } from './components/Watermark';
import { TlsStep, SimulationState, StepInfo, ChatMessage } from './types';
import { 
  ArrowRight, 
  ArrowLeft, 
  RefreshCw, 
  Play, 
  MessageSquare, 
  ShieldCheck,
  CreditCard,
  Globe,
  Lock,
  BookOpen,
  Info,
  Pause
} from './components/Icons';
import { explainConcept, getStepDeepDive } from './services/geminiService';
import ReactMarkdown from 'react-markdown';

// Define the sequence of steps
const STEPS_SEQUENCE = [
  TlsStep.IDLE,
  TlsStep.CLIENT_HELLO,
  TlsStep.SERVER_HELLO,
  TlsStep.KEY_DERIVATION,
  TlsStep.SERVER_FINISHED,
  TlsStep.CLIENT_FINISHED,
  TlsStep.SECURE_TUNNEL
];

const STEP_DETAILS: Record<TlsStep, StepInfo> = {
  [TlsStep.IDLE]: {
    title: '1. Initial State (TCP Connected)',
    description: 'Before TLS can begin, a TCP connection (Layer 4) must be established via the "Three-way Handshake". The line is open but insecure.',
    technicalDetails: [
      'Transport: TCP connection on port 443.',
      'State: Unencrypted. No keys exist yet.'
    ],
    analogy: 'You have dialed a phone number. The line is open, but anyone can tap the wire and listen.',
    whyItMatters: 'TLS relies on TCP for reliability but adds the privacy layer.',
    packetName: '',
    direction: 'internal'
  },
  [TlsStep.CLIENT_HELLO]: {
    title: '2. Client Hello',
    description: 'The browser initiates the handshake, "guessing" the key exchange method (ECDHE) and sending its public key share immediately.',
    technicalDetails: [
      'Protocol: TLS 1.3 (0x0304).',
      'Random: 32 bytes for replay protection.',
      'Key Share: Client\'s ephemeral public key.'
    ],
    analogy: 'Client shouts: "I want to talk securely! Here is my half of the secret key puzzle immediately to save time."',
    whyItMatters: 'This "optimistic" key share saves one full round-trip compared to TLS 1.2.',
    packetName: 'ClientHello + KeyShare',
    direction: 'right'
  },
  [TlsStep.SERVER_HELLO]: {
    title: '3. Server Hello & Certificate',
    description: 'The server accepts the key exchange method, sends its own public key share, and provides its Digital Certificate.',
    technicalDetails: [
      'ServerHello: Confirms Cipher Suite.',
      'Certificate: X.509 Chain (Identity).',
      'Verify: Digital signature proving ownership.'
    ],
    analogy: 'Server replies: "Accepted. Here is my puzzle half and my ID card stamped by a trusted authority."',
    whyItMatters: 'Ensures you are talking to the real website, not an imposter.',
    packetName: 'SvrHello + Cert + Key',
    direction: 'left'
  },
  [TlsStep.KEY_DERIVATION]: {
    title: '4. Key Derivation',
    description: 'Both parties use Math (ECDHE) to calculate the same "Shared Secret" without ever transmitting it over the wire.',
    technicalDetails: [
      'Algo: ECDHE (Elliptic Curve Diffie-Hellman).',
      'Property: Forward Secrecy.',
      'Result: Handshake & App Keys derived.'
    ],
    analogy: 'Both mix their private color with the public color to get the same secret color that no one else can see.',
    whyItMatters: 'Even if the server is hacked later, past conversations remain secure (Forward Secrecy).',
    packetName: 'Computing Keys...',
    direction: 'internal'
  },
  [TlsStep.SERVER_FINISHED]: {
    title: '5. Server Finished',
    description: 'The server sends an encrypted HMAC of the entire conversation transcript to verify integrity.',
    technicalDetails: [
      'Encryption: Handshake Key.',
      'Integrity: HMAC of Transcript.',
      'Defense: Prevents Downgrade Attacks.'
    ],
    analogy: 'Server: "Here is a summary of our chat. If it matches your notes, nobody tampered with the setup."',
    whyItMatters: 'Locks in the security parameters and confirms no tampering occurred.',
    packetName: 'Finished (Encrypted)',
    direction: 'left'
  },
  [TlsStep.CLIENT_FINISHED]: {
    title: '6. Client Finished',
    description: 'The client verifies the certificate and handshake hash, then sends its own finished message. The Secure Tunnel is open.',
    technicalDetails: [
      'Validation: Check CA signature.',
      'State: Switch to Application Keys.',
      'Ready: HTTP data can now flow.'
    ],
    analogy: 'Client: "ID verified. Summary matches. I am ready to send private data."',
    whyItMatters: 'The lock icon appears. The connection is fully authenticated and encrypted.',
    packetName: 'Finished (Encrypted)',
    direction: 'right'
  },
  [TlsStep.SECURE_TUNNEL]: {
    title: '7. Secure Data Tunnel',
    description: 'Symmetric encryption (AES-GCM) is now used to stream data at high speed.',
    technicalDetails: [
      'Cipher: AES-256-GCM or ChaCha20.',
      'Performance: Hardware accelerated.',
      'Security: Authenticated Encryption (AEAD).'
    ],
    analogy: 'An armored truck driving back and forth. Thieves can stop it, but cannot open it.',
    whyItMatters: 'Protects your passwords, credit cards, and personal data.',
    packetName: 'HTTP Data (AES-256)',
    direction: 'both'
  }
};

const App: React.FC = () => {
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  const [chatInput, setChatInput] = useState('');
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [aiTip, setAiTip] = useState<string>('');
  const logsEndRef = useRef<HTMLDivElement>(null);
  
  const currentStep = STEPS_SEQUENCE[currentStepIndex];
  const stepInfo = STEP_DETAILS[currentStep];

  const simulationState: SimulationState = {
    step: currentStep,
    keysExchanged: currentStepIndex >= 3,
    isEncrypted: currentStep === TlsStep.SECURE_TUNNEL,
    clientKey: currentStepIndex >= 3 ? 'generated' : undefined,
    serverKey: currentStepIndex >= 3 ? 'generated' : undefined,
  };

  const handleNext = () => {
    if (currentStepIndex < STEPS_SEQUENCE.length - 1) {
      setCurrentStepIndex(prev => prev + 1);
    } else {
      setIsPlaying(false);
    }
  };

  const handlePrev = () => {
    if (currentStepIndex > 0) {
      setCurrentStepIndex(prev => prev - 1);
    }
  };

  const handleReset = () => {
    setCurrentStepIndex(0);
    setIsPlaying(false);
  };

  const togglePlay = () => {
    if (currentStepIndex === STEPS_SEQUENCE.length - 1) {
      handleReset();
      setIsPlaying(true);
    } else {
      setIsPlaying(!isPlaying);
    }
  };

  // Increased interval to 6000ms to allow for slower animation (5s) to complete
  useEffect(() => {
    let interval: any;
    if (isPlaying) {
      interval = setInterval(() => {
        handleNext();
      }, 6000); 
    }
    return () => clearInterval(interval);
  }, [isPlaying, currentStepIndex]);

  useEffect(() => {
    const fetchQuickTip = async () => {
      setAiTip('Analyzing...');
      const tip = await getStepDeepDive(STEP_DETAILS[currentStep].title);
      setAiTip(tip);
    };
    if (currentStep !== TlsStep.IDLE) {
      fetchQuickTip();
    } else {
      setAiTip('Ready to analyze handshake.');
    }
  }, [currentStep]);

  useEffect(() => {
    logsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [currentStepIndex]);

  const handleChatSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim()) return;

    const userMsg = chatInput;
    setChatInput('');
    setChatHistory(prev => [...prev, { role: 'user', text: userMsg }]);
    setIsLoading(true);

    const response = await explainConcept(userMsg, stepInfo.title);
    
    setChatHistory(prev => [...prev, { role: 'model', text: response }]);
    setIsLoading(false);
  };

  return (
    <div className="min-h-screen bg-background text-slate-100 font-sans selection:bg-primary selection:text-slate-900 w-full overflow-hidden flex flex-col">
      
      {/* Navbar */}
      <header className="border-b border-slate-800 bg-slate-900/90 backdrop-blur sticky top-0 z-50 w-full h-14 flex-none" role="banner">
        <div className="w-full px-4 md:px-8 h-full flex items-center justify-between">
          <div className="flex items-center gap-3">
             <div className="bg-primary/10 p-1.5 rounded-lg" aria-hidden="true">
                <ShieldCheck className="text-primary" size={20} />
             </div>
             <h1 className="text-lg font-bold tracking-tight text-white hidden sm:block">TLS 1.3 <span className="text-slate-400 font-normal">Masterclass</span></h1>
          </div>
          <nav className="flex items-center gap-4 text-xs font-medium text-slate-300">
             <div className="hidden lg:flex items-center gap-4">
               <a href="#" className="flex items-center gap-1.5 hover:text-primary transition-colors focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none rounded px-1"><Globe size={14}/> RFC 8446</a>
               <span className="flex items-center gap-1.5 hover:text-primary transition-colors cursor-help" title="Payment Card Industry Data Security Standard"><CreditCard size={14}/> PCI-DSS</span>
             </div>
             <div className="bg-slate-800 px-2 py-0.5 rounded border border-slate-700 font-mono text-primary shadow-sm" role="status">
               LIVE
             </div>
          </nav>
        </div>
      </header>

      {/* Main Container - Compact Grid */}
      <main className="w-full max-w-[1920px] mx-auto px-4 py-4 flex-1 grid grid-cols-1 xl:grid-cols-12 gap-4 lg:gap-6 h-[calc(100vh-3.5rem)] overflow-y-auto xl:overflow-hidden" role="main">
        
        {/* Left Column: Controls & Educational Info */}
        <section className="xl:col-span-4 lg:col-span-5 flex flex-col gap-4 order-2 xl:order-1 xl:h-full min-h-0" aria-label="Controls and Information">
          
          {/* Controls Card */}
          <div className="bg-surface border border-slate-700 rounded-xl p-4 shadow-lg flex-none">
             <div className="flex items-center justify-between mb-3">
                <h2 className="text-sm font-semibold text-slate-200">Simulation Timeline</h2>
                <span className="text-[10px] font-mono text-slate-400 bg-slate-800 px-1.5 py-0.5 rounded">Step {currentStepIndex + 1}/{STEPS_SEQUENCE.length}</span>
             </div>
             {/* Progress Bar */}
             <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden mb-4" role="progressbar" aria-valuenow={((currentStepIndex + 1) / STEPS_SEQUENCE.length) * 100} aria-valuemin={0} aria-valuemax={100} aria-label="Progress">
                <div 
                  className="h-full bg-gradient-to-r from-primary via-secondary to-accent transition-all duration-500 ease-out"
                  style={{ width: `${((currentStepIndex + 1) / STEPS_SEQUENCE.length) * 100}%` }}
                ></div>
             </div>
             {/* Buttons */}
             <div className="grid grid-cols-5 gap-2">
                <button onClick={handlePrev} disabled={currentStepIndex === 0} aria-label="Previous Step"
                  className="col-span-1 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex justify-center focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none">
                  <ArrowLeft size={18} />
                </button>
                <button onClick={togglePlay} aria-label={isPlaying ? "Pause Simulation" : "Start Simulation"}
                  className={`col-span-2 font-bold py-2 rounded-lg transition-colors flex items-center justify-center gap-2 shadow-lg focus-visible:ring-2 focus-visible:ring-white focus-visible:outline-none ${
                    isPlaying 
                    ? 'bg-amber-500 hover:bg-amber-400 text-slate-900' 
                    : 'bg-primary hover:bg-sky-400 text-slate-900 shadow-primary/10'
                  }`}>
                   {isPlaying ? (
                     <><Pause size={16} fill="currentColor" /> <span>PAUSE</span></>
                   ) : (
                     <><Play size={16} fill="currentColor" /> <span>{currentStepIndex === STEPS_SEQUENCE.length - 1 ? 'REPLAY' : 'START'}</span></>
                   )}
                </button>
                <button onClick={handleNext} disabled={currentStepIndex === STEPS_SEQUENCE.length - 1} aria-label="Next Step"
                  className="col-span-1 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex justify-center focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none">
                  <ArrowRight size={18} />
                </button>
                <button onClick={handleReset} aria-label="Reset Simulation"
                  className="col-span-1 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors flex justify-center focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none">
                  <RefreshCw size={18} />
                </button>
             </div>
          </div>

          {/* Detailed Info Card */}
          <article className="bg-surface border border-slate-700 rounded-xl relative overflow-hidden flex-1 shadow-lg flex flex-col min-h-0">
            <div className="absolute -top-6 -right-6 text-slate-800/50 pointer-events-none" aria-hidden="true">
              <Lock size={200} />
            </div>
            
            <div className="relative z-10 flex flex-col h-full">
              <div className="p-4 border-b border-slate-700/50 bg-slate-900/30 flex-none">
                <h2 className="text-lg font-bold text-white mb-1.5 leading-tight">{stepInfo.title}</h2>
                <p className="text-slate-300 text-sm leading-relaxed">{stepInfo.description}</p>
              </div>
              
              <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar">
                {/* Analogy Section */}
                <div className="bg-indigo-950/40 rounded-lg p-3 border border-indigo-500/20">
                  <div className="flex items-center gap-2 mb-1.5">
                    <BookOpen size={14} className="text-indigo-300" />
                    <h4 className="text-[10px] font-bold text-indigo-300 uppercase tracking-wider">Analogy</h4>
                  </div>
                  <p className="text-indigo-100 italic text-sm leading-relaxed">"{stepInfo.analogy}"</p>
                </div>

                 {/* Why It Matters Section */}
                <div className="bg-emerald-950/40 rounded-lg p-3 border border-emerald-500/20">
                  <div className="flex items-center gap-2 mb-1.5">
                    <Info size={14} className="text-emerald-300" />
                    <h4 className="text-[10px] font-bold text-emerald-300 uppercase tracking-wider">Why It Matters</h4>
                  </div>
                  <p className="text-emerald-50 text-sm leading-relaxed">{stepInfo.whyItMatters}</p>
                </div>

                {/* Technical Breakdown */}
                <div className="bg-slate-900/50 rounded-lg p-3 border border-slate-800">
                   <h4 className="text-[10px] font-bold text-slate-400 uppercase mb-2 tracking-wider">Technical Specs</h4>
                   <ul className="space-y-1.5">
                     {stepInfo.technicalDetails.map((detail, idx) => (
                       <li key={idx} className="text-xs text-slate-300 font-mono flex items-start gap-2">
                         <span className="text-primary mt-0.5 text-sm" aria-hidden="true">›</span>
                         <span className="leading-snug">{detail}</span>
                       </li>
                     ))}
                   </ul>
                </div>
              </div>
            </div>
          </article>

        </section>

        {/* Right Column: Visualization & Logs */}
        <section className="xl:col-span-8 lg:col-span-7 flex flex-col gap-4 order-1 xl:order-2 xl:h-full min-h-0" aria-label="Visual Simulation and Logs">
           
           {/* Stage - Compact Height */}
           <div className="flex-none">
             <SimulationStage currentState={simulationState} />
           </div>

           {/* Bottom Grid */}
           <div className="grid grid-cols-1 md:grid-cols-2 gap-4 flex-1 min-h-[250px] max-h-[300px]">
              
              {/* AI Insights */}
              <div className="bg-gradient-to-br from-indigo-950/50 to-purple-950/50 border border-indigo-500/20 rounded-xl p-4 flex flex-col shadow-lg overflow-hidden">
                <div className="flex items-center justify-between mb-3 flex-none">
                  <div className="flex items-center gap-2">
                      <div className="bg-indigo-500 p-1 rounded text-white shadow-lg shadow-indigo-500/20">
                        <MessageSquare size={14}/>
                      </div>
                      <h3 className="font-semibold text-indigo-100 text-sm">Gemini Analyst</h3>
                  </div>
                  <div className="text-[9px] text-indigo-300 font-mono border border-indigo-500/30 px-1.5 py-0.5 rounded">AI POWERED</div>
                </div>
                
                <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar text-xs text-indigo-50 leading-relaxed font-light">
                   {aiTip}
                </div>
                
                <button 
                    onClick={() => setChatOpen(true)}
                    aria-label="Ask AI Assistant a question"
                    className="mt-3 w-full py-2 text-xs font-bold uppercase tracking-wide text-indigo-200 hover:text-white bg-indigo-500/20 hover:bg-indigo-500/30 border border-indigo-500/40 rounded-lg transition-all focus-visible:ring-2 focus-visible:ring-indigo-400 focus-visible:outline-none"
                >
                  Ask Question
                </button>
              </div>

              {/* Packet Log */}
              <div className="bg-black/90 rounded-xl border border-slate-800 p-4 font-mono text-xs overflow-hidden flex flex-col shadow-lg" role="log" aria-live="polite" aria-label="Packet Capture Log">
                  <div className="flex items-center gap-2 border-b border-slate-800 pb-2 mb-2 flex-none">
                    <div className="flex gap-1.5" aria-hidden="true">
                        <div className="w-2 h-2 rounded-full bg-red-500/80"></div>
                        <div className="w-2 h-2 rounded-full bg-yellow-500/80"></div>
                        <div className="w-2 h-2 rounded-full bg-green-500/80"></div>
                    </div>
                    <span className="text-slate-400 ml-2 uppercase tracking-wider text-[10px]">Packet Capture (Wireshark)</span>
                  </div>
                  <div className="flex-1 overflow-y-auto space-y-1 text-slate-300 custom-scrollbar p-1">
                    {STEPS_SEQUENCE.slice(0, currentStepIndex + 1).map((step, idx) => {
                        const info = STEP_DETAILS[step];
                        if(step === TlsStep.IDLE) return null;
                        return (
                          <div key={idx} className="flex gap-2 hover:bg-white/5 p-1 rounded transition-colors group items-start">
                            <span className="text-slate-500 w-12 text-right select-none text-[10px] mt-0.5">0.{idx}s</span>
                            <span className={`flex-1 break-words font-medium ${
                              step === TlsStep.SECURE_TUNNEL ? 'text-emerald-400' : 
                              step === TlsStep.KEY_DERIVATION ? 'text-yellow-400' : 
                              info.direction === 'right' ? 'text-blue-400' : 'text-purple-400'
                            }`}>
                              <span className="mr-1.5 text-slate-500 group-hover:text-slate-300 font-bold" aria-hidden="true">
                                {info.direction === 'right' ? '→' : info.direction === 'left' ? '←' : '•'}
                              </span>
                              {info.packetName}
                            </span>
                          </div>
                        )
                    })}
                    <div ref={logsEndRef} />
                    {currentStepIndex === 0 && <span className="text-slate-500 italic px-2">Listening on port 443...</span>}
                  </div>
              </div>

           </div>
        </section>

      </main>

      {/* Chat Overlay */}
      {chatOpen && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[100] flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-labelledby="chat-title">
           <div className="bg-surface w-full max-w-2xl rounded-2xl shadow-2xl border border-slate-700 flex flex-col max-h-[80vh]">
              <div className="p-4 border-b border-slate-700 flex justify-between items-center bg-slate-900/50 rounded-t-2xl">
                 <div className="flex items-center gap-3">
                   <div className="bg-primary rounded p-1">
                     <MessageSquare size={16} className="text-slate-900"/>
                   </div>
                   <div>
                     <h3 id="chat-title" className="font-bold text-white text-sm">TLS Expert Assistant</h3>
                   </div>
                 </div>
                 <button onClick={() => setChatOpen(false)} aria-label="Close Chat" className="text-slate-400 hover:text-white p-1.5 hover:bg-slate-800 rounded-full transition-colors focus-visible:ring-2 focus-visible:ring-primary">&times;</button>
              </div>
              <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-950/50 min-h-[300px]">
                 {chatHistory.length === 0 && (
                   <div className="text-center text-slate-500 mt-12">
                      <ShieldCheck size={40} className="mx-auto mb-3 opacity-20" />
                      <p className="text-base font-medium text-slate-400">Ready to assist.</p>
                   </div>
                 )}
                 {chatHistory.map((msg, i) => (
                    <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                       <div className={`max-w-[85%] rounded-2xl px-4 py-2 text-sm leading-relaxed shadow-lg ${
                         msg.role === 'user' 
                           ? 'bg-primary text-slate-900 rounded-br-none' 
                           : 'bg-slate-800 text-slate-200 border border-slate-700 rounded-bl-none'
                       }`}>
                          <ReactMarkdown>{msg.text}</ReactMarkdown>
                       </div>
                    </div>
                 ))}
                 {isLoading && (
                   <div className="flex justify-start">
                      <div className="bg-slate-800 rounded-2xl px-4 py-2 text-xs text-slate-400 animate-pulse flex items-center gap-1 rounded-bl-none">
                         <span>Typing</span>
                         <div className="w-1 h-1 bg-slate-500 rounded-full animate-bounce"></div>
                         <div className="w-1 h-1 bg-slate-500 rounded-full animate-bounce delay-100"></div>
                         <div className="w-1 h-1 bg-slate-500 rounded-full animate-bounce delay-200"></div>
                      </div>
                   </div>
                 )}
              </div>
              <form onSubmit={handleChatSubmit} className="p-4 border-t border-slate-700 flex gap-2 bg-slate-900/50 rounded-b-2xl">
                 <input 
                    type="text" 
                    value={chatInput}
                    onChange={(e) => setChatInput(e.target.value)}
                    placeholder="Ask about handshake details..."
                    className="flex-1 bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all placeholder:text-slate-600"
                    aria-label="Chat Input"
                 />
                 <button type="submit" disabled={isLoading} className="bg-primary hover:bg-sky-400 text-slate-900 font-bold px-4 py-2 rounded-lg transition-colors text-sm focus-visible:ring-2 focus-visible:ring-white">
                    Send
                 </button>
              </form>
           </div>
        </div>
      )}

      <Watermark />
    </div>
  );
};

export default App;
