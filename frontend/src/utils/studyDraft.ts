const DRAFT_KEY_PREFIX = 'study_wizard_draft';

interface StudyDraftData {
  form: unknown;
  currentStep: number;
  lastSaved: string;
}

function draftKey(studyId?: string): string {
  return studyId ? `${DRAFT_KEY_PREFIX}_${studyId}` : `${DRAFT_KEY_PREFIX}_new`;
}

export function saveStudyDraft(form: unknown, step: number, studyId?: string): void {
  const data: StudyDraftData = {
    form,
    currentStep: step,
    lastSaved: new Date().toISOString(),
  };
  try {
    localStorage.setItem(draftKey(studyId), JSON.stringify(data));
  } catch {
    // silently ignore
  }
}

export function loadStudyDraft(studyId?: string): StudyDraftData | null {
  try {
    const raw = localStorage.getItem(draftKey(studyId));
    if (!raw) return null;
    return JSON.parse(raw) as StudyDraftData;
  } catch {
    return null;
  }
}

export function clearStudyDraft(studyId?: string): void {
  localStorage.removeItem(draftKey(studyId));
}

export function hasStudyDraft(studyId?: string): boolean {
  return localStorage.getItem(draftKey(studyId)) !== null;
}
