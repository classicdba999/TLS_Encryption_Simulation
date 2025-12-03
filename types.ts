export enum TlsStep {
  IDLE = 'IDLE',
  CLIENT_HELLO = 'CLIENT_HELLO',
  SERVER_HELLO = 'SERVER_HELLO',
  KEY_DERIVATION = 'KEY_DERIVATION',
  SERVER_FINISHED = 'SERVER_FINISHED',
  CLIENT_FINISHED = 'CLIENT_FINISHED',
  SECURE_TUNNEL = 'SECURE_TUNNEL',
}

export interface SimulationState {
  step: TlsStep;
  keysExchanged: boolean;
  isEncrypted: boolean;
  clientKey?: string;
  serverKey?: string;
  sessionKey?: string;
}

export interface StepInfo {
  title: string;
  description: string;
  technicalDetails: string[];
  analogy: string;
  whyItMatters: string;
  packetName: string;
  direction: 'right' | 'left' | 'both' | 'internal';
}

export interface ChatMessage {
  role: 'user' | 'model';
  text: string;
  isError?: boolean;
}