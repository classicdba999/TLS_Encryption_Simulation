import React, { useState, useEffect, useRef } from 'react';
import { createRoot } from 'react-dom/client';
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
  BookOpen
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
    description: 'The underlying TCP connection (Three-way handshake) has been established. The client (browser) is now ready to request a secure session with classicdba.com. No encrypted data has been exchanged yet.',
    technicalDetails: [
      'Layer 4 (Transport) is established via SYN, SYN-ACK, ACK.',
      'We are now beginning Layer 5/6 (Session/Presentation) logic.',
      'Latency: 0-RTT options exist in TLS 1.3, but we are simulating a standard 1-RTT handshake.'
    ],
    analogy: 'Imagine you have dialed a phone number and the other person has picked up. The line is open, but you haven\'t started speaking your secret code language yet.',
    packetName: '',
    direction: 'internal'
  },
  [TlsStep.CLIENT_HELLO]: {
    title: '2. Client Hello',
    description: 'The browser initiates the TLS handshake. Crucially, in TLS 1.3, it "guesses" the key exchange method to save a round-trip, sending its key share immediately.',
    technicalDetails: [
      'Protocol Version: TLS 1.3 (0x0304)',
      'Random: 32 bytes of random data (prevents replay attacks).',
      'Cipher Suites: List of supported algorithms (e.g., TLS_AES_128_GCM_SHA256).',
      'Key Share Extension: The client generates an ephemeral ECDHE public key pair and sends the public part immediately.'
    ],
    analogy: 'The client shouts: "I want to talk securely! Here are the languages I speak (Cipher Suites) and here is half of a puzzle piece (Key Share) to start our secret key."',
    packetName: 'ClientHello + KeyShare',
    direction: 'right'
  },
  [TlsStep.SERVER_HELLO]: {
    title: '3. Server Hello & Certificate',
    description: 'The server responds. It selects the cipher suite, sends its own key share, and provides its Digital Certificate to prove "classicdba.com" is who it says it is.',
    technicalDetails: [
      'ServerHello: Confirms TLS 1.3 and the selected Cipher Suite.',
      'Key Share: Server sends its matching ECDHE public key.',
      'Certificate: X.509 Certificate chain signed by a CA (Certificate Authority).',
      'CertificateVerify: Digital signature over the handshake transcript using the Certificate\'s private key.'
    ],
    analogy: 'The server replies: "Let\'s use this specific secret language. Here is my half of the puzzle piece. Also, here is my ID card (Certificate) stamped by the government (CA) to prove I am real."',
    packetName: 'SvrHello + Cert + Key',
    direction: 'left'
  },
  [TlsStep.KEY_DERIVATION]: {
    title: '4. Key Derivation',
    description: 'Mathematics takes over. Both parties now have enough information (their private key + the other\'s public key share) to calculate the exact same "Master Secret" independently.',
    technicalDetails: [
      'Algorithm: ECDHE (Elliptic Curve Diffie-Hellman Ephemeral).',
      'Property: Shared Secret = (ClientPriv * ServerPub) = (ServerPriv * ClientPub).',
      'Result: Handshake Keys (for finishing the handshake) and Application Data Keys (for the actual traffic) are generated.',
      'Forward Secrecy: New keys are generated for every session.'
    ],
    analogy: 'Both sides mix their own secret color with the public color they received. The result is a specific shade of paint that only they know, without ever sending the mixed paint over the wire.',
    packetName: 'Computing Keys...',
    direction: 'internal'
  },
  [TlsStep.SERVER_FINISHED]: {
    title: '5. Server Finished',
    description: 'The server sends a "Finished" message. This is the first encrypted message of the session. It contains a hash of the entire conversation so far to ensure no one tampered with the setup.',
    technicalDetails: [
      'Encryption: Uses the newly derived Handshake Traffic Key.',
      'Content: HMAC (Hash-based Message Authentication Code) of the handshake transcript.',
      'Purpose: Verifies integrity. If a middleman changed the "Client Hello" (e.g., trying to downgrade security), this hash check will fail.'
    ],
    analogy: 'The server says (in the new secret language): "Here is a summary of everything we just said. If this summary matches your notes, we are safe."',
    packetName: 'Finished (Encrypted)',
    direction: 'left'
  },
  [TlsStep.CLIENT_FINISHED]: {
    title: '6. Client Finished',
    description: 'The client verifies the server\'s ID and hash. If everything looks good, it sends its own encrypted "Finished" message. The Handshake is complete.',
    technicalDetails: [
      'Validation: Client checks the Certificate signature against its store of trusted CAs.',
      'State Switch: Both parties discard the Handshake Keys and switch to Application Data Keys.',
      'Ready: The secure tunnel is established.'
    ],
    analogy: 'The client checks the ID card, verifies the summary, and replies (encrypted): "Everything looks perfect. I am ready to send real data now."',
    packetName: 'Finished (Encrypted)',
    direction: 'right'
  },
  [TlsStep.SECURE_TUNNEL]: {
    title: '7. Secure Data Tunnel',
    description: 'The application layer (HTTP) data can now flow. To any outside observer, this traffic looks like random noise. The lock icon appears in the browser.',
    technicalDetails: [
      'Symmetric Encryption: AES-GCM or ChaCha20-Poly1305 is used for speed.',
      'Throughput: Symmetric encryption is much faster than the asymmetric math used in the handshake.',
      'Renegotiation: Keys can be updated periodically during the session for added security.'
    ],
    analogy: 'An armored truck (the secure tunnel) is now driving back and forth carrying valuables (data). Even if thieves stop the truck, they cannot open the lock.',
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
  
  const currentStep = STEPS_SEQUENCE[currentStepIndex];
  const stepInfo = STEP_DETAILS[currentStep];

  // Derive state for the visualization
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

  useEffect(() => {
    let interval: any;
    if (isPlaying) {
      interval = setInterval(() => {
        handleNext();
      }, 3500); // Slightly longer for detailed reading
    }
    return () => clearInterval(interval);
  }, [isPlaying, currentStepIndex]);

  // AI Deep Dive when step changes
  useEffect(() => {
    const fetchQuickTip = async () => {
      setAiTip('Analyzing protocol step...');
      const tip = await getStepDeepDive(STEP_DETAILS[currentStep].title);
      setAiTip(tip);
    };
    if (currentStep !== TlsStep.IDLE) {
      fetchQuickTip();
    } else {
      setAiTip('Click "Start" or "Play" to begin the TLS 1.3 handshake analysis.');
    }
  }, [currentStep]);

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
    <div className="min-h-screen bg-background text-slate-100 font-sans selection:bg-primary selection:text-slate-900 pb-20">
      
      {/* Navbar */}
      <header className="border-b border-slate-800 bg-slate-900/80 backdrop-blur sticky top-0 z-50">
        <div className="w-full px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
             <div className="bg-primary/10 p-2 rounded-lg">
                <ShieldCheck className="text-primary" size={24} />
             </div>
             <h1 className="text-xl font-bold tracking-tight text-white">TLS 1.3 <span className="text-slate-500 font-normal">Masterclass</span></h1>
          </div>
          <div className="flex items-center gap-6 text-sm font-medium text-slate-400">
             <div className="hidden md:flex items-center gap-6">
               <span className="flex items-center gap-2 hover:text-primary cursor-pointer transition-colors"><Globe size={16}/> Protocol RFC 8446</span>
               <span className="flex items-center gap-2 hover:text-primary cursor-pointer transition-colors"><CreditCard size={16}/> PCI-DSS Compliance</span>
             </div>
             <div className="bg-slate-800 px-3 py-1 rounded border border-slate-700 text-xs font-mono text-primary shadow-[0_0_10px_rgba(56,189,248,0.1)]">
               SIMULATION MODE
             </div>
          </div>
        </div>
      </header>

      {/* Main Full-Width Container */}
      <main className="w-full px-6 py-8 grid grid-cols-1 xl:grid-cols-12 gap-8">
        
        {/* Left Column: Controls & Educational Info */}
        <div className="xl:col-span-4 lg:col-span-5 space-y-6 flex flex-col">
          
          {/* Controls Card */}
          <div className="bg-surface border border-slate-700 rounded-xl p-6 shadow-xl">
             <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-slate-200">Handshake Timeline</h2>
                <span className="text-xs font-mono text-slate-500 bg-slate-800 px-2 py-1 rounded">Step {currentStepIndex + 1} / {STEPS_SEQUENCE.length}</span>
             </div>
             <div className="h-2 bg-slate-800 rounded-full overflow-hidden mb-6">
                <div 
                  className="h-full bg-gradient-to-r from-primary via-secondary to-accent transition-all duration-500 ease-out"
                  style={{ width: `${((currentStepIndex + 1) / STEPS_SEQUENCE.length) * 100}%` }}
                ></div>
             </div>
             <div className="grid grid-cols-5 gap-2">
                <button onClick={handlePrev} disabled={currentStepIndex === 0}
                  className="col-span-1 py-3 rounded-lg bg-slate-800 hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex justify-center">
                  <ArrowLeft size={20} />
                </button>
                <button onClick={togglePlay} 
                  className="col-span-2 bg-primary hover:bg-sky-400 text-slate-900 font-bold py-3 rounded-lg transition-colors flex items-center justify-center gap-2">
                   {isPlaying ? (
                     <><span>PAUSE</span></>
                   ) : (
                     <><Play size={18} fill="currentColor" /> <span>{currentStepIndex === STEPS_SEQUENCE.length - 1 ? 'REPLAY' : 'START'}</span></>
                   )}
                </button>
                <button onClick={handleNext} disabled={currentStepIndex === STEPS_SEQUENCE.length - 1}
                  className="col-span-1 py-3 rounded-lg bg-slate-800 hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex justify-center">
                  <ArrowRight size={20} />
                </button>
                <button onClick={handleReset}
                  className="col-span-1 py-3 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors flex justify-center">
                  <RefreshCw size={20} />
                </button>
             </div>
          </div>

          {/* Detailed Info Card */}
          <div className="bg-surface border border-slate-700 rounded-xl p-8 relative overflow-hidden flex-1 shadow-xl">
            <div className="absolute -top-6 -right-6 text-slate-800/50">
              <Lock size={200} />
            </div>
            
            <div className="relative z-10">
              <h2 className="text-3xl font-bold text-white mb-4">{stepInfo.title}</h2>
              <p className="text-slate-300 leading-relaxed text-lg mb-8">{stepInfo.description}</p>
              
              <div className="space-y-6">
                <div className="bg-slate-900/80 rounded-lg p-5 border border-slate-800 backdrop-blur-sm">
                  <div className="flex items-center gap-2 mb-3">
                    <BookOpen size={16} className="text-secondary" />
                    <h4 className="text-xs font-bold text-secondary uppercase tracking-wider">Analogy</h4>
                  </div>
                  <p className="text-slate-300 italic">"{stepInfo.analogy}"</p>
                </div>

                <div className="bg-slate-900/80 rounded-lg p-5 border border-slate-800 backdrop-blur-sm">
                   <h4 className="text-xs font-bold text-primary uppercase mb-3 tracking-wider">Technical Breakdown</h4>
                   <ul className="space-y-2">
                     {stepInfo.technicalDetails.map((detail, idx) => (
                       <li key={idx} className="text-sm text-slate-400 font-mono flex items-start gap-2">
                         <span className="text-primary mt-1">›</span>
                         <span>{detail}</span>
                       </li>
                     ))}
                   </ul>
                </div>
              </div>
            </div>
          </div>

        </div>

        {/* Right Column: Wide Visualization */}
        <div className="xl:col-span-8 lg:col-span-7 flex flex-col gap-6">
           <SimulationStage currentState={simulationState} />

           {/* AI & Logs Section */}
           <div className="grid grid-cols-1 md:grid-cols-2 gap-6 h-64">
              
              {/* AI Insights */}
              <div className="bg-gradient-to-br from-indigo-950/50 to-purple-950/50 border border-indigo-500/20 rounded-xl p-6 flex flex-col shadow-lg">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                      <div className="bg-indigo-500 p-1.5 rounded text-white shadow-lg shadow-indigo-500/20">
                        <MessageSquare size={16}/>
                      </div>
                      <h3 className="font-semibold text-indigo-200">Gemini Network Analyst</h3>
                  </div>
                  <div className="text-[10px] text-indigo-400 font-mono border border-indigo-500/30 px-2 py-0.5 rounded">AI POWERED</div>
                </div>
                
                <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar text-sm text-indigo-100/90 leading-relaxed font-light">
                   {aiTip}
                </div>
                
                <button 
                    onClick={() => setChatOpen(true)}
                    className="mt-4 w-full py-2.5 text-xs font-bold uppercase tracking-wide text-indigo-300 hover:text-white bg-indigo-500/10 hover:bg-indigo-500/20 border border-indigo-500/30 rounded-lg transition-all"
                >
                  Ask Gemini a Question
                </button>
              </div>

              {/* Packet Log */}
              <div className="bg-black/80 rounded-xl border border-slate-800 p-4 font-mono text-xs overflow-hidden flex flex-col shadow-lg">
                  <div className="flex items-center gap-2 border-b border-slate-800 pb-2 mb-2">
                    <div className="flex gap-1.5">
                        <div className="w-2.5 h-2.5 rounded-full bg-red-500/80"></div>
                        <div className="w-2.5 h-2.5 rounded-full bg-yellow-500/80"></div>
                        <div className="w-2.5 h-2.5 rounded-full bg-green-500/80"></div>
                    </div>
                    <span className="text-slate-500 ml-2 uppercase tracking-wider">Live Packet Capture</span>
                  </div>
                  <div className="flex-1 overflow-y-auto space-y-1.5 text-slate-300 custom-scrollbar p-2">
                    {STEPS_SEQUENCE.slice(0, currentStepIndex + 1).map((step, idx) => {
                        const info = STEP_DETAILS[step];
                        if(step === TlsStep.IDLE) return null;
                        return (
                          <div key={idx} className="flex gap-3 hover:bg-white/5 p-1 rounded transition-colors group">
                            <span className="text-slate-600 w-16 text-right select-none">00:0{idx}.{idx*155}</span>
                            <span className={`flex-1 font-medium ${
                              step === TlsStep.SECURE_TUNNEL ? 'text-emerald-400' : 
                              step === TlsStep.KEY_DERIVATION ? 'text-yellow-400' : 
                              info.direction === 'right' ? 'text-blue-400' : 'text-purple-400'
                            }`}>
                              <span className="mr-2 text-slate-600 group-hover:text-slate-400">
                                {info.direction === 'right' ? '→' : info.direction === 'left' ? '←' : '•'}
                              </span>
                              {info.packetName}
                            </span>
                          </div>
                        )
                    })}
                    {currentStepIndex === 0 && <span className="text-slate-700 italic px-2">Listening on port 443...</span>}
                  </div>
              </div>

           </div>
        </div>

      </main>

      {/* Chat Overlay */}
      {chatOpen && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[100] flex items-center justify-center p-6">
           <div className="bg-surface w-full max-w-2xl rounded-2xl shadow-2xl border border-slate-700 flex flex-col max-h-[85vh] animate-pulse-slow">
              <div className="p-5 border-b border-slate-700 flex justify-between items-center bg-slate-900/50 rounded-t-2xl">
                 <div className="flex items-center gap-3">
                   <div className="bg-primary rounded p-1">
                     <MessageSquare size={18} className="text-slate-900"/>
                   </div>
                   <div>
                     <h3 className="font-bold text-white">TLS Expert Assistant</h3>
                     <p className="text-xs text-slate-400">Ask about cryptographic primitives, handshakes, or security vulnerabilities.</p>
                   </div>
                 </div>
                 <button onClick={() => setChatOpen(false)} className="text-slate-400 hover:text-white p-2 hover:bg-slate-800 rounded-full transition-colors">&times;</button>
              </div>
              <div className="flex-1 overflow-y-auto p-6 space-y-6 bg-slate-950/50 min-h-[400px]">
                 {chatHistory.length === 0 && (
                   <div className="text-center text-slate-500 mt-20">
                      <ShieldCheck size={48} className="mx-auto mb-4 opacity-20" />
                      <p className="text-lg font-medium text-slate-400">Ready to assist.</p>
                      <p className="text-sm mt-2">Try asking: "What happens if the certificate is expired?"</p>
                   </div>
                 )}
                 {chatHistory.map((msg, i) => (
                    <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                       <div className={`max-w-[85%] rounded-2xl px-5 py-3 text-sm leading-relaxed shadow-lg ${
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
                      <div className="bg-slate-800 rounded-2xl px-5 py-3 text-sm text-slate-400 animate-pulse flex items-center gap-2 rounded-bl-none">
                         <div className="w-2 h-2 bg-slate-500 rounded-full animate-bounce"></div>
                         <div className="w-2 h-2 bg-slate-500 rounded-full animate-bounce delay-100"></div>
                         <div className="w-2 h-2 bg-slate-500 rounded-full animate-bounce delay-200"></div>
                      </div>
                   </div>
                 )}
              </div>
              <form onSubmit={handleChatSubmit} className="p-5 border-t border-slate-700 flex gap-3 bg-slate-900/50 rounded-b-2xl">
                 <input 
                    type="text" 
                    value={chatInput}
                    onChange={(e) => setChatInput(e.target.value)}
                    placeholder="E.g., How does Forward Secrecy work?"
                    className="flex-1 bg-slate-950 border border-slate-700 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all placeholder:text-slate-600"
                 />
                 <button type="submit" disabled={isLoading} className="bg-primary hover:bg-sky-400 text-slate-900 font-bold px-6 py-2 rounded-lg transition-colors shadow-lg shadow-primary/20">
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