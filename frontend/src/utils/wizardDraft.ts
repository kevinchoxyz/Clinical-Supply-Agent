import type { CanonicalPayload } from '../types/scenario';

interface DraftData {
  payload: CanonicalPayload;
  currentStep: number;
  lastSaved: string; // ISO timestamp
}

const DRAFT_KEY_PREFIX = 'wizard_draft';

function draftKey(scenarioId?: string): string {
  return scenarioId ? `${DRAFT_KEY_PREFIX}_${scenarioId}` : `${DRAFT_KEY_PREFIX}_new`;
}

export function saveDraft(
  payload: CanonicalPayload,
  step: number,
  scenarioId?: string,
): void {
  const data: DraftData = {
    payload,
    currentStep: step,
    lastSaved: new Date().toISOString(),
  };
  try {
    localStorage.setItem(draftKey(scenarioId), JSON.stringify(data));
  } catch {
    // localStorage full or unavailable — silently ignore
  }
}

export function loadDraft(scenarioId?: string): DraftData | null {
  try {
    const raw = localStorage.getItem(draftKey(scenarioId));
    if (!raw) return null;
    return JSON.parse(raw) as DraftData;
  } catch {
    return null;
  }
}

export function clearDraft(scenarioId?: string): void {
  localStorage.removeItem(draftKey(scenarioId));
}

export function hasDraft(scenarioId?: string): boolean {
  return localStorage.getItem(draftKey(scenarioId)) !== null;
}
