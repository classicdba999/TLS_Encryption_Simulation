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
  BookOpen,
  Info
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
    description: 'Before TLS can begin, a TCP connection (Layer 4) must be established via the "Three-way Handshake" (SYN, SYN-ACK, ACK). The client and server can talk, but the line is completely insecure. Anyone with a wiretap can read every byte sent.',
    technicalDetails: [
      'Transport Layer: TCP connection established on port 443.',
      'Latency: TLS 1.3 builds on top of this, adding 1-RTT (Round Trip Time) to the total setup time.',
      'State: Unencrypted. No keys exist yet.'
    ],
    analogy: 'You have successfully dialed a phone number and someone picked up. The line is open, but you are effectively shouting in a crowded room. You haven\'t started speaking your secret code language yet.',
    whyItMatters: 'TLS lives at Layer 5/6 (Session/Presentation). It relies on TCP to ensure packets actually arrive, but TCP does not provide privacy or identity. Without TLS, the internet would just be "text files over a wire" visible to everyone.',
    packetName: '',
    direction: 'internal'
  },
  [TlsStep.CLIENT_HELLO]: {
    title: '2. Client Hello',
    description: 'The browser initiates the secure handshake. In TLS 1.3, this step is aggressively optimized. The client "guesses" the key exchange method (usually ECDHE) and sends its public key share immediately, saving an entire round-trip compared to TLS 1.2.',
    technicalDetails: [
      'Protocol Version: TLS 1.3 (0x0304).',
      'Random: 32 bytes of high-entropy random data to prevent replay attacks.',
      'Cipher Suites: An ordered list of supported algorithms (e.g., TLS_AES_128_GCM_SHA256).',
      'Key Share Extension: The critical TLS 1.3 upgrade. The client generates an ephemeral key pair (ECDHE) and sends the public part now.'
    ],
    analogy: 'The client shouts: "I want to talk securely! I speak these languages (Cipher Suites). I am betting we will use this specific method, so here is my half of the puzzle piece (Key Share) right now to save time."',
    whyItMatters: 'This "optimistic" key share is what makes TLS 1.3 faster. In older versions, the client would just say "Hello" and wait for the server to choose a method before creating keys. TLS 1.3 assumes a modern default.',
    packetName: 'ClientHello + KeyShare',
    direction: 'right'
  },
  [TlsStep.SERVER_HELLO]: {
    title: '3. Server Hello & Certificate',
    description: 'The server responds. It selects the cryptographic parameters, completes the key exchange, and sends its Digital Certificate. This certificate is the "ID Card" of the internet, proving the server really is "classicdba.com".',
    technicalDetails: [
      'ServerHello: Confirms the selected Cipher Suite and Protocol Version.',
      'Key Share: Server sends its matching ECDHE public key.',
      'Certificate: The X.509 Certificate chain (Leaf -> Intermediate -> Root CA).',
      'CertificateVerify: A digital signature using the Certificate\'s private key to prove ownership.',
      'Encrypted Extensions: Other handshake parameters are now encrypted immediately.'
    ],
    analogy: 'The server replies: "Let\'s use the method you guessed. Here is my half of the puzzle piece. Also, here is my ID card (Certificate) stamped by a trusted government (CA), and a signature to prove I own this ID."',
    whyItMatters: 'Authentication is critical. Without the Certificate, you might be setting up a perfectly encrypted connection with a hacker (Man-in-the-Middle). The Certificate ensures you are talking to the real owner.',
    packetName: 'SvrHello + Cert + Key',
    direction: 'left'
  },
  [TlsStep.KEY_DERIVATION]: {
    title: '4. Key Derivation',
    description: 'Pure Mathematics. Both parties now have the other\'s public key share and their own private key. Using Elliptic Curve Diffie-Hellman (ECDH), they independently calculate the exact same "Shared Secret" without ever transmitting it.',
    technicalDetails: [
      'Algorithm: ECDHE (Elliptic Curve Diffie-Hellman Ephemeral).',
      'Math: Shared Secret = (ClientPriv * ServerPub) = (ServerPriv * ClientPub).',
      'HKDF: This shared secret is run through a Key Derivation Function to split it into specific keys: Handshake Keys, Application Data Keys, and Resumption Keys.',
      'Forward Secrecy: Because the keys are ephemeral (temporary), recording this traffic now won\'t help a hacker decrypt it later, even if they steal the server\'s main private key.'
    ],
    analogy: 'Both sides mix their own secret color (private key) with the public color they received (public key). The laws of math ensure they both end up with the exact same shade of "Master Paint", even though that final color was never sent over the air.',
    whyItMatters: 'This allows two strangers who have never met to agree on a secret password while everyone is listening, yet no one else can figure out what the password is.',
    packetName: 'Computing Keys...',
    direction: 'internal'
  },
  [TlsStep.SERVER_FINISHED]: {
    title: '5. Server Finished',
    description: 'The server sends a "Finished" message. This is the first fully encrypted packet of the session. It contains an HMAC (Hash) of the entire conversation so far to ensure integrity.',
    technicalDetails: [
      'Encryption: Uses the newly derived Handshake Traffic Key.',
      'Integrity Check: HMAC (Hash-based Message Authentication Code) over the Transcript Hash.',
      'Protection: Prevents "Downgrade Attacks" where a hacker might have tried to modify the "Client Hello" to force a weaker encryption method. If the hash doesn\'t match, the server knows the Hello was tampered with.'
    ],
    analogy: 'The server says (in the new secret language): "Here is a summary of everything we just said. If this summary matches your notes, we know no one changed our messages while we were setting this up."',
    whyItMatters: 'This step confirms that the "Negotiation" phase wasn\'t tampered with. It locks in the security parameters.',
    packetName: 'Finished (Encrypted)',
    direction: 'left'
  },
  [TlsStep.CLIENT_FINISHED]: {
    title: '6. Client Finished',
    description: 'The client verifies the server\'s ID and hash. If valid, the browser displays the Lock Icon. The client sends its own encrypted "Finished" message. The handshake is complete.',
    technicalDetails: [
      'Validation: Client checks the Certificate signature against its trusted Root Store (e.g., DigiCert, Let\'s Encrypt).',
      'Context Switch: Both parties discard the Handshake Keys and switch to the final Application Data Keys.',
      '0-RTT ready: The client may store a "session ticket" to make future connections faster.'
    ],
    analogy: 'The client checks the ID card, verifies the summary, and replies (encrypted): "Your ID is valid and the summary matches. I am ready to send real data now."',
    whyItMatters: 'This is the moment the browser URL bar turns green (or shows the lock). The secure tunnel is officially open.',
    packetName: 'Finished (Encrypted)',
    direction: 'right'
  },
  [TlsStep.SECURE_TUNNEL]: {
    title: '7. Secure Data Tunnel',
    description: 'The heavy lifting of asymmetric cryptography (handshake) is done. Now, efficient symmetric encryption (AES-GCM or ChaCha20) is used to stream data securely.',
    technicalDetails: [
      'Symmetric Encryption: Used for speed. Algorithms like AES-GCM are hardware-accelerated on most modern CPUs.',
      'AEAD: Authenticated Encryption with Associated Data. Ensures confidentiality (reading) and authenticity (tampering).',
      'Key Rotation: TLS 1.3 can automatically rotate keys periodically during a long download to prevent statistical analysis attacks.'
    ],
    analogy: 'An armored truck (the secure tunnel) is now driving back and forth carrying valuables (data). Even if thieves stop the truck, they cannot open the lock, and they can\'t even tell if the truck is carrying gold or empty boxes (padding).',
    whyItMatters: 'This is the state used for 99% of the connection duration. It protects your credit card numbers, passwords, and personal emails from prying eyes.',
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
      }, 5000); // 5 seconds per step for better readability
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
    <div className="min-h-screen bg-background text-slate-100 font-sans selection:bg-primary selection:text-slate-900 pb-20 w-full overflow-x-hidden">
      
      {/* Navbar */}
      <header className="border-b border-slate-800 bg-slate-900/80 backdrop-blur sticky top-0 z-50 w-full">
        <div className="w-full px-6 md:px-10 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
             <div className="bg-primary/10 p-2 rounded-lg">
                <ShieldCheck className="text-primary" size={24} />
             </div>
             <h1 className="text-xl font-bold tracking-tight text-white hidden sm:block">TLS 1.3 <span className="text-slate-500 font-normal">Masterclass</span></h1>
          </div>
          <div className="flex items-center gap-4 sm:gap-6 text-sm font-medium text-slate-400">
             <div className="hidden lg:flex items-center gap-6">
               <a href="#" className="flex items-center gap-2 hover:text-primary cursor-pointer transition-colors"><Globe size={16}/> Protocol RFC 8446</a>
               <span className="flex items-center gap-2 hover:text-primary cursor-pointer transition-colors"><CreditCard size={16}/> PCI-DSS Compliance</span>
             </div>
             <div className="bg-slate-800 px-3 py-1 rounded border border-slate-700 text-xs font-mono text-primary shadow-[0_0_10px_rgba(56,189,248,0.1)]">
               SIMULATION ACTIVE
             </div>
          </div>
        </div>
      </header>

      {/* Main Full-Width Container */}
      <main className="w-full px-4 md:px-8 py-8 grid grid-cols-1 xl:grid-cols-12 gap-8 max-w-[2400px] mx-auto">
        
        {/* Left Column: Controls & Educational Info */}
        <div className="xl:col-span-4 lg:col-span-5 space-y-6 flex flex-col order-2 xl:order-1">
          
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
                  className="col-span-2 bg-primary hover:bg-sky-400 text-slate-900 font-bold py-3 rounded-lg transition-colors flex items-center justify-center gap-2 shadow-lg shadow-primary/10">
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
          <div className="bg-surface border border-slate-700 rounded-xl p-6 md:p-8 relative overflow-hidden flex-1 shadow-xl flex flex-col">
            <div className="absolute -top-6 -right-6 text-slate-800/50 pointer-events-none">
              <Lock size={240} />
            </div>
            
            <div className="relative z-10 space-y-6">
              <div>
                <h2 className="text-3xl font-bold text-white mb-4 leading-tight">{stepInfo.title}</h2>
                <p className="text-slate-300 leading-relaxed text-lg">{stepInfo.description}</p>
              </div>
              
              <div className="space-y-4">
                {/* Analogy Section */}
                <div className="bg-indigo-950/40 rounded-lg p-5 border border-indigo-500/20 backdrop-blur-sm">
                  <div className="flex items-center gap-2 mb-2">
                    <BookOpen size={16} className="text-indigo-400" />
                    <h4 className="text-xs font-bold text-indigo-400 uppercase tracking-wider">Real World Analogy</h4>
                  </div>
                  <p className="text-indigo-100/90 italic text-sm leading-relaxed">"{stepInfo.analogy}"</p>
                </div>

                 {/* Why It Matters Section */}
                <div className="bg-emerald-950/40 rounded-lg p-5 border border-emerald-500/20 backdrop-blur-sm">
                  <div className="flex items-center gap-2 mb-2">
                    <Info size={16} className="text-emerald-400" />
                    <h4 className="text-xs font-bold text-emerald-400 uppercase tracking-wider">Why It Matters</h4>
                  </div>
                  <p className="text-emerald-100/90 text-sm leading-relaxed">{stepInfo.whyItMatters}</p>
                </div>

                {/* Technical Breakdown */}
                <div className="bg-slate-900/80 rounded-lg p-5 border border-slate-800 backdrop-blur-sm">
                   <h4 className="text-xs font-bold text-primary uppercase mb-3 tracking-wider">Technical Breakdown</h4>
                   <ul className="space-y-3">
                     {stepInfo.technicalDetails.map((detail, idx) => (
                       <li key={idx} className="text-sm text-slate-400 font-mono flex items-start gap-3">
                         <span className="text-primary mt-1 text-lg leading-none">›</span>
                         <span className="leading-snug">{detail}</span>
                       </li>
                     ))}
                   </ul>
                </div>
              </div>
            </div>
          </div>

        </div>

        {/* Right Column: Wide Visualization */}
        <div className="xl:col-span-8 lg:col-span-7 flex flex-col gap-6 order-1 xl:order-2">
           <SimulationStage currentState={simulationState} />

           {/* AI & Logs Section */}
           <div className="grid grid-cols-1 md:grid-cols-2 gap-6 h-[400px] xl:h-[320px]">
              
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