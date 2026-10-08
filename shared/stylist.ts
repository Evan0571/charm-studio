import type { DesignConfig, Quote } from './types';
import type { Language } from './localization';

export interface StylistMessage { role: 'user' | 'assistant'; content: string; }
export interface StylistRequest { messages: StylistMessage[]; currentConfig?: DesignConfig; language?: Language; }
export interface StylistProposal { name: string; config: DesignConfig; quote: Quote; reasons: string[]; }
export interface StylistResponse { message: string; suggestions: string[]; proposal: StylistProposal | null; }
