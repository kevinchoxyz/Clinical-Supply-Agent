import React, { createContext, useContext, useState, useCallback } from 'react';

interface StudyContextState {
  selectedStudyId: string | null;
  setSelectedStudyId: (id: string | null) => void;
}

const StudyContext = createContext<StudyContextState | undefined>(undefined);

const STORAGE_KEY = 'selected_study_id';

export const StudyProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [selectedStudyId, setSelectedStudyIdState] = useState<string | null>(
    () => localStorage.getItem(STORAGE_KEY),
  );

  const setSelectedStudyId = useCallback((id: string | null) => {
    setSelectedStudyIdState(id);
    if (id) {
      localStorage.setItem(STORAGE_KEY, id);
    } else {
      localStorage.removeItem(STORAGE_KEY);
    }
  }, []);

  return (
    <StudyContext.Provider value={{ selectedStudyId, setSelectedStudyId }}>
      {children}
    </StudyContext.Provider>
  );
};

export const useStudyContext = () => {
  const ctx = useContext(StudyContext);
  if (!ctx) throw new Error('useStudyContext must be used within StudyProvider');
  return ctx;
};
