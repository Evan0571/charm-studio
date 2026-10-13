import { createDefaultConfig } from '../shared/catalog';
import { validateConfig } from '../shared/domain';
import type { DesignConfig } from '../shared/types';

export const WORKSPACE_DRAFT_KEY = 'loop-workspace-draft-v1';
export interface WorkspaceDraft {
  draftId: string;
  config: DesignConfig;
  name: string | null;
  savedId?: string;
  savedSignature?: string;
}
export function designSignature(config: DesignConfig, name: string) {
  return JSON.stringify([config, name.trim()]);
}
export function visualKey(config: DesignConfig) {
  return JSON.stringify([config.templateId, config.connectorId, config.cordColor, config.metalTone,
    Object.entries(config.slots).sort(([a], [b]) => a.localeCompare(b))]);
}
export function parseWorkspaceDraft(value: string | null): WorkspaceDraft | null {
  if (!value || value.length > 12000) return null;
  try {
    const draft = JSON.parse(value);
    if (draft.version !== 1 || (draft.name !== null && (typeof draft.name !== 'string' || draft.name.length > 50))) return null;
    const config = validateConfig(draft.config);
    const savedId = typeof draft.savedId === 'string' && /^[0-9a-f-]{36}$/i.test(draft.savedId) ? draft.savedId : undefined;
    const draftId = typeof draft.draftId === 'string' && /^[0-9a-f-]{36}$/i.test(draft.draftId) ? draft.draftId : crypto.randomUUID();
    return { draftId, config, name: draft.name, savedId,
      savedSignature: savedId && typeof draft.savedSignature === 'string' && draft.savedSignature.length < 6000 ? draft.savedSignature : undefined };
  } catch { return null; }
}
export function readWorkspaceDraft(): WorkspaceDraft {
  try { const draft = parseWorkspaceDraft(localStorage.getItem(WORKSPACE_DRAFT_KEY)); if (draft) return draft; } catch { /* Editing remains available without local storage. */ }
  return { draftId: crypto.randomUUID(), config: createDefaultConfig('hero'), name: null };
}
export function storeWorkspaceDraft(draft: WorkspaceDraft): boolean {
  try { localStorage.setItem(WORKSPACE_DRAFT_KEY, JSON.stringify({ version: 1, ...draft })); return true; } catch { return false; }
}
