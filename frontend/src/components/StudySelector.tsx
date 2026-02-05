import React from 'react';
import { Select } from 'antd';
import { useStudies } from '../hooks/useStudies';
import { useStudyContext } from '../context/StudyContext';

const StudySelector: React.FC = () => {
  const { data: studies, isLoading } = useStudies();
  const { selectedStudyId, setSelectedStudyId } = useStudyContext();

  return (
    <Select
      placeholder="All Studies"
      style={{ width: 260 }}
      value={selectedStudyId || undefined}
      onChange={(v) => setSelectedStudyId(v ?? null)}
      allowClear
      loading={isLoading}
      showSearch
      filterOption={(input, opt) =>
        (opt?.label as string)?.toLowerCase().includes(input.toLowerCase())
      }
      options={(studies ?? []).map((s) => ({
        value: s.id,
        label: `${s.study_code} — ${s.name}`,
      }))}
    />
  );
};

export default StudySelector;
