import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Steps,
  Button,
  Form,
  Input,
  InputNumber,
  Select,
  DatePicker,
  Switch,
  Radio,
  Table,
  Space,
  Card,
  Collapse,
  Typography,
  Divider,
  Alert,
  message,
} from 'antd';
import { PlusOutlined, DeleteOutlined, UploadOutlined, DownloadOutlined } from '@ant-design/icons';
import { useNavigate, useSearchParams } from 'react-router-dom';
import dayjs from 'dayjs';

import { useCreateScenario } from '../../../hooks/useScenarios';
import { useStudies, useStudy } from '../../../hooks/useStudies';
import { saveDraft, loadDraft, clearDraft, hasDraft } from '../../../utils/wizardDraft';
import { parseArms, parseCohorts, parseVisits, parseNodes, parseEnrollmentCurve } from '../../../utils/excelParser';
import {
  downloadArmsTemplate,
  downloadCohortsTemplate,
  downloadVisitsTemplate,
  downloadNodesTemplate,
  downloadEnrollmentCurveTemplate,
} from '../../../utils/excelTemplates';
import DraftResumeModal from './DraftResumeModal';
import ExcelUploadModal from './ExcelUploadModal';
import DispenseRuleEditor from './DispenseRuleEditor';
import { getVersion } from '../../../api/scenarios';
import type {
  CanonicalPayload,
  TrialInfo,
  ScenarioMeta,
  NetworkNode,
  NetworkLane,
  Product,
  Presentation,
  Arm,
  Cohort,
  VisitDef,
  Regimen,
  DoseTableRow,
  DispenseRule,
  EnrollmentWave,
  EnrollmentCurve,
  EnrollmentCurvePoint,
  Assumptions,
} from '../../../types/scenario';
import type { DosingStrategy, DoseSchedule } from '../../../types/study';

/* ------------------------------------------------------------------ */
/*  Default empty payload                                              */
/* ------------------------------------------------------------------ */
const emptyPayload = (): CanonicalPayload => ({
  schema_version: '1.0',
  trial: { code: '', countries: [] },
  scenario: { trial_code: '', name: '' },
  network_nodes: [],
  network_lanes: [],
  products: [],
  study_design: { arms: [], cohorts: [], visits: [], arm_to_regimen: {}, cohort_to_regimen: {} },
  regimens: [],
  dispense_rules: [],
  assumptions: {
    enrollment_waves: [],
    enrollment_curve: undefined,
    lead_time_overrides: [],
  },
  tags: [],
  metadata: {},
});

/* ------------------------------------------------------------------ */
/*  Step labels                                                        */
/* ------------------------------------------------------------------ */
const STEP_TITLES_FULL = [
  'Select Study',
  'Products',
  'Study Design',
  'Network',
  'Visits',
  'Regimens & Mapping',
  'Assumptions',
  'Review',
];

const STEP_TITLES_WITH_STUDY = [
  'Select Study',
  'Study Design',
  'Regimens & Mapping',
  'Assumptions',
  'Review',
];

/* ------------------------------------------------------------------ */
/*  Excel preview column definitions                                   */
/* ------------------------------------------------------------------ */
const armPreviewColumns = [
  { title: 'Arm ID', dataIndex: 'arm_id', key: 'arm_id' },
  { title: 'Name', dataIndex: 'name', key: 'name' },
  { title: 'Weight', dataIndex: 'randomization_weight', key: 'randomization_weight' },
];

const cohortPreviewColumns = [
  { title: 'Cohort ID', dataIndex: 'cohort_id', key: 'cohort_id' },
  { title: 'Name', dataIndex: 'name', key: 'name' },
  { title: 'Max Participants', dataIndex: 'max_participants', key: 'max_participants' },
];

const nodePreviewColumns = [
  { title: 'Node ID', dataIndex: 'node_id', key: 'node_id' },
  { title: 'Type', dataIndex: 'node_type', key: 'node_type' },
  { title: 'Name', dataIndex: 'name', key: 'name' },
  { title: 'Country', dataIndex: 'country', key: 'country' },
];

const visitPreviewColumns = [
  { title: 'Visit ID', dataIndex: 'visit_id', key: 'visit_id' },
  { title: 'Day Offset', dataIndex: 'day_offset', key: 'day_offset' },
  { title: 'Cycle #', dataIndex: 'cycle_number', key: 'cycle_number' },
  { title: 'Cycle Day', dataIndex: 'cycle_day', key: 'cycle_day' },
  {
    title: 'Dosing Event',
    dataIndex: 'is_dosing_event',
    key: 'is_dosing_event',
    render: (v: boolean) => (v ? 'Yes' : 'No'),
  },
];

const enrollmentCurvePreviewColumns = [
  { title: 'Period', dataIndex: 'period', key: 'period' },
  { title: 'Label', dataIndex: 'period_label', key: 'period_label' },
  { title: 'New Subjects', dataIndex: 'new_subjects', key: 'new_subjects' },
];

/* ------------------------------------------------------------------ */
/*  Main Component                                                     */
/* ------------------------------------------------------------------ */
const ScenarioWizard: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const existingScenarioId = searchParams.get('scenarioId') ?? '';
  const editVersionParam = searchParams.get('version');
  const isEditing = !!(existingScenarioId && editVersionParam);

  const [current, setCurrent] = useState(0);
  const [payload, setPayload] = useState<CanonicalPayload>(emptyPayload());
  const [lastSavedAt, setLastSavedAt] = useState<string | null>(null);
  const [versionLoaded, setVersionLoaded] = useState(false);

  // Study selection
  const [selectedStudyId, setSelectedStudyId] = useState<string | null>(null);
  const { data: studies } = useStudies();
  const { data: selectedStudyDetail } = useStudy(selectedStudyId ?? '');
  const hasStudy = !!selectedStudyId;
  const STEP_TITLES = hasStudy ? STEP_TITLES_WITH_STUDY : STEP_TITLES_FULL;

  // Draft resume modal
  const [draftModalOpen, setDraftModalOpen] = useState(false);
  const [draftLastSaved, setDraftLastSaved] = useState('');
  const draftChecked = useRef(false);
  // Blocks auto-save until the user has made a resume/fresh decision (or no draft exists)
  const draftReady = useRef(false);

  // Excel upload modals
  const [excelModal, setExcelModal] = useState<
    'arms' | 'cohorts' | 'nodes' | 'visits' | 'enrollment_curve' | null
  >(null);

  const createScenario = useCreateScenario();

  /* ---- Draft: debounced auto-save (declared before mount effect) ---- */
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const cancelPendingSave = () => {
    if (saveTimer.current) {
      clearTimeout(saveTimer.current);
      saveTimer.current = null;
    }
  };

  const debouncedSave = useCallback(
    (p: CanonicalPayload, step: number) => {
      cancelPendingSave();
      saveTimer.current = setTimeout(() => {
        const sid = existingScenarioId || undefined;
        saveDraft(p, step, sid);
        setLastSavedAt(new Date().toISOString());
      }, 2000);
    },
    [existingScenarioId],
  );

  /* ---- Edit mode: load existing version on mount ---- */
  useEffect(() => {
    if (!isEditing || versionLoaded) return;
    const vNum = Number(editVersionParam);
    if (!vNum) return;
    getVersion(existingScenarioId, vNum).then((detail) => {
      setPayload({ ...emptyPayload(), ...detail.payload });
      setVersionLoaded(true);
      draftReady.current = true;
      draftChecked.current = true; // skip draft resume modal
    }).catch((err) => {
      console.error('Failed to load version for editing:', err);
      message.error('Failed to load version');
      draftReady.current = true;
      draftChecked.current = true;
    });
  }, [isEditing, editVersionParam, existingScenarioId, versionLoaded]);

  /* ---- Draft: check on mount ---- */
  useEffect(() => {
    if (draftChecked.current) return;
    draftChecked.current = true;

    // Skip draft check when editing an existing version
    if (isEditing) return;

    const sid = existingScenarioId || undefined;
    if (hasDraft(sid)) {
      const draft = loadDraft(sid);
      if (draft) {
        setDraftLastSaved(draft.lastSaved);
        setDraftModalOpen(true);
        // draftReady stays false — auto-save is blocked until user decides
        return;
      }
    }
    // No draft found — safe to auto-save immediately
    draftReady.current = true;
  }, [existingScenarioId, isEditing]);

  const handleResumeDraft = () => {
    cancelPendingSave();
    const draft = loadDraft(existingScenarioId || undefined);
    if (draft) {
      setPayload(draft.payload);
      setCurrent(draft.currentStep);
      setLastSavedAt(draft.lastSaved);
    }
    setDraftModalOpen(false);
    draftReady.current = true;
  };

  const handleStartFresh = () => {
    cancelPendingSave();
    clearDraft(existingScenarioId || undefined);
    setDraftModalOpen(false);
    draftReady.current = true;
  };

  /* ---- Draft: auto-save on payload/step change ---- */
  useEffect(() => {
    // Don't auto-save until draft initialization is complete
    if (!draftReady.current) return;
    debouncedSave(payload, current);
  }, [payload, current, debouncedSave]);

  // Cleanup timer on unmount
  useEffect(() => {
    return () => cancelPendingSave();
  }, []);

  /* ---- Draft: beforeunload warning ---- */
  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      // Warn if the payload differs from empty
      const hasData =
        (payload.trial?.code ?? '').length > 0 ||
        payload.network_nodes.length > 0 ||
        payload.products.length > 0 ||
        (payload.study_design?.arms?.length ?? 0) > 0;
      if (hasData) {
        e.preventDefault();
      }
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [payload]);

  /* ---- helpers ---- */
  const updateTrial = (partial: Partial<TrialInfo>) =>
    setPayload((p) => ({ ...p, trial: { ...(p.trial ?? { code: '', countries: [] }), ...partial } }));

  const updateScenario = (partial: Partial<ScenarioMeta>) =>
    setPayload((p) => ({ ...p, scenario: { ...p.scenario, ...partial } }));

  const updateAssumptions = (partial: Partial<Assumptions>) =>
    setPayload((p) => ({ ...p, assumptions: { ...p.assumptions, ...partial } }));

  const next = () => setCurrent((c) => Math.min(c + 1, STEP_TITLES.length - 1));
  const prev = () => setCurrent((c) => Math.max(c - 1, 0));

  /* ---- submit ---- */
  const handleSubmit = async () => {
    try {
      let scenarioId = existingScenarioId;

      if (!scenarioId) {
        const created = await createScenario.mutateAsync({
          trial_code: payload.trial?.code ?? payload.scenario.trial_code,
          name: payload.scenario.name ?? payload.scenario.scenario_name ?? 'Untitled',
          description: payload.scenario.description ?? payload.scenario.scenario_description,
          study_id: selectedStudyId ?? undefined,
        });
        scenarioId = created.id;
      }

      const { createVersion: createVersionApi } = await import('../../../api/scenarios');
      await createVersionApi(scenarioId, {
        label: isEditing ? `Based on v${editVersionParam}` : 'Initial version',
        payload,
      });

      // Clear draft on successful submit
      clearDraft(existingScenarioId || undefined);

      message.success('Scenario version created successfully');
      navigate(`/scenarios/${scenarioId}`);
    } catch (err: unknown) {
      // Surface the actual backend validation error
      let detail = 'Failed to create scenario version';
      if (err && typeof err === 'object' && 'response' in err) {
        const resp = (err as { response?: { data?: { detail?: unknown } } }).response;
        if (resp?.data?.detail) {
          const d = resp.data.detail;
          if (typeof d === 'string') {
            detail = d;
          } else if (Array.isArray(d)) {
            // Pydantic validation errors come as an array of {loc, msg, type}
            detail = d
              .map((e: { loc?: unknown[]; msg?: string }) =>
                `${(e.loc ?? []).join(' → ')}: ${e.msg ?? 'invalid'}`,
              )
              .join('\n');
          } else {
            detail = JSON.stringify(d);
          }
        }
      }
      console.error('Submit error:', err);
      message.error(detail, 8);
    }
  };

  /* ---- Manual save draft ---- */
  const handleSaveDraft = () => {
    cancelPendingSave();
    const sid = existingScenarioId || undefined;
    saveDraft(payload, current, sid);
    const now = new Date().toISOString();
    setLastSavedAt(now);
    message.success('Draft saved');
  };

  /* ================================================================ */
  /*  Excel upload handlers                                            */
  /* ================================================================ */
  const handleExcelConfirm = (
    target: 'arms' | 'cohorts' | 'nodes' | 'visits' | 'enrollment_curve',
    data: unknown[],
    mode: 'replace' | 'append',
  ) => {
    setPayload((p) => {
      switch (target) {
        case 'arms': {
          const existing = mode === 'append' ? (p.study_design?.arms ?? []) : [];
          return {
            ...p,
            study_design: {
              ...p.study_design!,
              arms: [...existing, ...(data as Arm[])],
            },
          };
        }
        case 'cohorts': {
          const existing = mode === 'append' ? (p.study_design?.cohorts ?? []) : [];
          return {
            ...p,
            study_design: {
              ...p.study_design!,
              cohorts: [...existing, ...(data as Cohort[])],
            },
          };
        }
        case 'nodes': {
          const existing = mode === 'append' ? p.network_nodes : [];
          return {
            ...p,
            network_nodes: [...existing, ...(data as NetworkNode[])],
          };
        }
        case 'visits': {
          const existing = mode === 'append' ? (p.study_design?.visits ?? []) : [];
          return {
            ...p,
            study_design: {
              ...p.study_design!,
              visits: [...existing, ...(data as VisitDef[])],
            },
          };
        }
        case 'enrollment_curve': {
          const points = data as EnrollmentCurvePoint[];
          return {
            ...p,
            assumptions: {
              ...p.assumptions,
              enrollment_curve: {
                curve_type: 'monthly_forecast',
                screen_fail_rate: p.assumptions.enrollment_curve?.screen_fail_rate,
                points,
              },
            },
          };
        }
        default:
          return p;
      }
    });
    setExcelModal(null);
    message.success(`${data.length} rows imported`);
  };

  /* ================================================================ */
  /*  STEP 1 — Select Study (unified first step)                       */
  /* ================================================================ */
  const SelectStudyStepContent = (
    <Card bordered={false} title="Select Study">
      <Form layout="vertical">
        <Form.Item label="Study" required={false}>
          <Select
            placeholder="Select a study to use its protocol data (or leave blank for manual entry)"
            style={{ width: '100%' }}
            value={selectedStudyId || undefined}
            onChange={(v) => {
              setSelectedStudyId(v ?? null);
              setCurrent(0); // stay on step 0 when study changes
            }}
            allowClear
            showSearch
            filterOption={(input, opt) =>
              (opt?.label as string)?.toLowerCase().includes(input.toLowerCase())
            }
            options={(studies ?? []).map((s) => ({
              value: s.id,
              label: `${s.study_code} — ${s.name}`,
            }))}
          />
        </Form.Item>

        {/* Study selected: show summary + scenario fields only */}
        {selectedStudyDetail && (
          <>
            <Card size="small" style={{ marginBottom: 16, background: '#fafafa' }}>
              <Typography.Text strong>Study Summary</Typography.Text>
              <Typography.Paragraph type="secondary" style={{ margin: '4px 0 0' }}>
                Trial Info, Products, Network, Visits, and Dispense Rules come from the study.
              </Typography.Paragraph>
              <div style={{ marginTop: 8 }}>
                <Typography.Text type="secondary">Code: </Typography.Text>
                <Typography.Text>{selectedStudyDetail.study_code}</Typography.Text>
              </div>
              <div>
                <Typography.Text type="secondary">Phase: </Typography.Text>
                <Typography.Text>{selectedStudyDetail.phase ?? '—'}</Typography.Text>
              </div>
              <div>
                <Typography.Text type="secondary">Countries: </Typography.Text>
                <Typography.Text>{selectedStudyDetail.countries?.join(', ') ?? '—'}</Typography.Text>
              </div>
              <div>
                <Typography.Text type="secondary">Products: </Typography.Text>
                <Typography.Text>
                  {(selectedStudyDetail.payload?.products as unknown[] ?? []).length} defined
                </Typography.Text>
              </div>
              <div>
                <Typography.Text type="secondary">Network nodes: </Typography.Text>
                <Typography.Text>
                  {(selectedStudyDetail.payload?.network_nodes as unknown[] ?? []).length} defined
                </Typography.Text>
              </div>
            </Card>
            <Form.Item label="Scenario Name" required>
              <Input
                value={payload.scenario.name ?? ''}
                onChange={(e) => updateScenario({ name: e.target.value })}
                placeholder="e.g. Base Case"
              />
            </Form.Item>
            <Form.Item label="Scenario Description">
              <Input.TextArea
                value={payload.scenario.description ?? ''}
                onChange={(e) => updateScenario({ description: e.target.value })}
                rows={2}
              />
            </Form.Item>
            <Form.Item label="Start Date">
              <DatePicker
                value={payload.scenario.start_date ? dayjs(payload.scenario.start_date) : null}
                onChange={(d) => updateScenario({ start_date: d?.format('YYYY-MM-DD') })}
                style={{ width: '100%' }}
              />
            </Form.Item>
            <Form.Item label="Forecast Bucket">
              <Select
                value={payload.scenario.forecast_bucket}
                onChange={(val) => updateScenario({ forecast_bucket: val })}
                placeholder="Select bucket"
                options={[
                  { value: 'WEEK', label: 'Weekly' },
                  { value: 'MONTH', label: 'Monthly' },
                ]}
              />
            </Form.Item>
            <Form.Item label="Horizon Buckets">
              <InputNumber
                min={1}
                max={520}
                value={payload.scenario.horizon_buckets}
                onChange={(val) => updateScenario({ horizon_buckets: val ?? undefined })}
                placeholder="e.g. 52"
                style={{ width: '100%' }}
              />
            </Form.Item>
          </>
        )}

        {/* No study selected: show full trial info fields */}
        {!selectedStudyId && (
          <>
            <Divider orientation="left">Trial Information</Divider>
            <Form.Item label="Trial Code" required>
              <Input
                value={payload.trial?.code ?? ''}
                onChange={(e) => {
                  updateTrial({ code: e.target.value });
                  updateScenario({ trial_code: e.target.value });
                }}
                placeholder="e.g. TRIAL-001"
              />
            </Form.Item>
            <Form.Item label="Phase">
              <Select
                value={payload.trial?.phase}
                onChange={(val) => updateTrial({ phase: val })}
                placeholder="Select phase"
                allowClear
                options={[
                  { value: 'P1', label: 'Phase 1' },
                  { value: 'P2', label: 'Phase 2' },
                  { value: 'P3', label: 'Phase 3' },
                  { value: 'P4', label: 'Phase 4' },
                ]}
              />
            </Form.Item>
            <Form.Item label="Countries">
              <Select
                mode="tags"
                value={payload.trial?.countries ?? []}
                onChange={(vals) => updateTrial({ countries: vals })}
                placeholder="Type country codes and press Enter"
              />
            </Form.Item>
            <Form.Item label="Scenario Name">
              <Input
                value={payload.scenario.name ?? ''}
                onChange={(e) => updateScenario({ name: e.target.value })}
                placeholder="e.g. Base Case"
              />
            </Form.Item>
            <Form.Item label="Start Date">
              <DatePicker
                value={payload.scenario.start_date ? dayjs(payload.scenario.start_date) : null}
                onChange={(d) => updateScenario({ start_date: d?.format('YYYY-MM-DD') })}
                style={{ width: '100%' }}
              />
            </Form.Item>
            <Form.Item label="Forecast Bucket">
              <Select
                value={payload.scenario.forecast_bucket}
                onChange={(val) => updateScenario({ forecast_bucket: val })}
                placeholder="Select bucket"
                options={[
                  { value: 'WEEK', label: 'Weekly' },
                  { value: 'MONTH', label: 'Monthly' },
                ]}
              />
            </Form.Item>
            <Form.Item label="Horizon Buckets">
              <InputNumber
                min={1}
                max={520}
                value={payload.scenario.horizon_buckets}
                onChange={(val) => updateScenario({ horizon_buckets: val ?? undefined })}
                placeholder="e.g. 52"
                style={{ width: '100%' }}
              />
            </Form.Item>
          </>
        )}
      </Form>
    </Card>
  );

  /* ================================================================ */
  /*  STEP 2 — Study Design                                            */
  /* ================================================================ */
  const addArm = () => {
    const arms = [...(payload.study_design?.arms ?? [])];
    arms.push({ arm_id: `ARM-${arms.length + 1}`, name: '', randomization_weight: 1 });
    setPayload((p) => ({
      ...p,
      study_design: { ...p.study_design!, arms },
    }));
  };

  const updateArm = (index: number, partial: Partial<Arm>) => {
    const arms = [...(payload.study_design?.arms ?? [])];
    arms[index] = { ...arms[index], ...partial };
    setPayload((p) => ({ ...p, study_design: { ...p.study_design!, arms } }));
  };

  const removeArm = (index: number) => {
    const arms = (payload.study_design?.arms ?? []).filter((_, i) => i !== index);
    setPayload((p) => ({ ...p, study_design: { ...p.study_design!, arms } }));
  };

  const addCohort = () => {
    const cohorts = [...(payload.study_design?.cohorts ?? [])];
    cohorts.push({ cohort_id: `COHORT-${cohorts.length + 1}`, name: '', attributes: {} });
    setPayload((p) => ({
      ...p,
      study_design: { ...p.study_design!, cohorts },
    }));
  };

  const updateCohort = (index: number, partial: Partial<Cohort>) => {
    const cohorts = [...(payload.study_design?.cohorts ?? [])];
    cohorts[index] = { ...cohorts[index], ...partial };
    setPayload((p) => ({ ...p, study_design: { ...p.study_design!, cohorts } }));
  };

  const removeCohort = (index: number) => {
    const cohorts = (payload.study_design?.cohorts ?? []).filter((_, i) => i !== index);
    setPayload((p) => ({ ...p, study_design: { ...p.study_design!, cohorts } }));
  };

  const StudyDesignStep = (
    <Card bordered={false} title="Study Design">
      <Space style={{ marginBottom: 12 }}>
        <Typography.Title level={5} style={{ margin: 0 }}>Arms</Typography.Title>
        <Button size="small" icon={<UploadOutlined />} onClick={() => setExcelModal('arms')}>
          Upload from Excel
        </Button>
        <Button size="small" icon={<DownloadOutlined />} onClick={downloadArmsTemplate}>
          Download Template
        </Button>
      </Space>
      <Table
        size="small"
        pagination={false}
        dataSource={(payload.study_design?.arms ?? []).map((a, i) => ({ ...a, _idx: i }))}
        rowKey="_idx"
        columns={[
          {
            title: 'Arm ID',
            dataIndex: 'arm_id',
            render: (val: string, _: Arm & { _idx: number }) => (
              <Input
                value={val}
                onChange={(e) => updateArm(_._idx, { arm_id: e.target.value })}
                size="small"
              />
            ),
          },
          {
            title: 'Name',
            dataIndex: 'name',
            render: (val: string, _: Arm & { _idx: number }) => (
              <Input
                value={val}
                onChange={(e) => updateArm(_._idx, { name: e.target.value })}
                size="small"
              />
            ),
          },
          {
            title: 'Weight',
            dataIndex: 'randomization_weight',
            width: 100,
            render: (val: number, _: Arm & { _idx: number }) => (
              <InputNumber
                value={val}
                min={0}
                step={0.1}
                onChange={(v) => updateArm(_._idx, { randomization_weight: v ?? 1 })}
                size="small"
                style={{ width: '100%' }}
              />
            ),
          },
          {
            title: '',
            width: 50,
            render: (_: unknown, __: Arm & { _idx: number }) => (
              <Button
                type="text"
                danger
                size="small"
                icon={<DeleteOutlined />}
                onClick={() => removeArm(__._idx)}
              />
            ),
          },
        ]}
      />
      <Button type="dashed" block icon={<PlusOutlined />} onClick={addArm} style={{ marginTop: 8 }}>
        Add Arm
      </Button>

      <Divider />

      <Space style={{ marginBottom: 12 }}>
        <Typography.Title level={5} style={{ margin: 0 }}>Cohorts</Typography.Title>
        <Button size="small" icon={<UploadOutlined />} onClick={() => setExcelModal('cohorts')}>
          Upload from Excel
        </Button>
        <Button size="small" icon={<DownloadOutlined />} onClick={downloadCohortsTemplate}>
          Download Template
        </Button>
      </Space>
      <Table
        size="small"
        pagination={false}
        dataSource={(payload.study_design?.cohorts ?? []).map((c, i) => ({ ...c, _idx: i }))}
        rowKey="_idx"
        columns={[
          {
            title: 'Cohort ID',
            dataIndex: 'cohort_id',
            render: (val: string, _: Cohort & { _idx: number }) => (
              <Input
                value={val}
                onChange={(e) => updateCohort(_._idx, { cohort_id: e.target.value })}
                size="small"
              />
            ),
          },
          {
            title: 'Name',
            dataIndex: 'name',
            render: (val: string | undefined, _: Cohort & { _idx: number }) => (
              <Input
                value={val ?? ''}
                onChange={(e) => updateCohort(_._idx, { name: e.target.value })}
                size="small"
              />
            ),
          },
          {
            title: 'Max Participants',
            dataIndex: 'max_participants',
            width: 150,
            render: (val: number | undefined, _: Cohort & { _idx: number }) => (
              <InputNumber
                value={val}
                min={0}
                onChange={(v) => updateCohort(_._idx, { max_participants: v ?? undefined })}
                size="small"
                style={{ width: '100%' }}
              />
            ),
          },
          {
            title: '',
            width: 50,
            render: (_: unknown, __: Cohort & { _idx: number }) => (
              <Button
                type="text"
                danger
                size="small"
                icon={<DeleteOutlined />}
                onClick={() => removeCohort(__._idx)}
              />
            ),
          },
        ]}
      />
      <Button type="dashed" block icon={<PlusOutlined />} onClick={addCohort} style={{ marginTop: 8 }}>
        Add Cohort
      </Button>

      {hasStudy && selectedStudyDetail && (
        <>
          <Divider />
          <Card size="small" style={{ background: '#f6f8fa' }}>
            <Typography.Text type="secondary">
              Arms and cohorts above are defaulted from Study {selectedStudyDetail.study_code}. You can add additional arms/cohorts for scenario analysis.
            </Typography.Text>
          </Card>
        </>
      )}
    </Card>
  );

  /* ================================================================ */
  /*  STEP 3 — Products                                                */
  /* ================================================================ */
  const addProduct = () => {
    setPayload((p) => ({
      ...p,
      products: [
        ...p.products,
        {
          product_id: `PROD-${p.products.length + 1}`,
          name: '',
          product_type: '',
          inventory_uom: 'UNIT',
          presentations: [],
          attributes: {},
        },
      ],
    }));
  };

  const updateProduct = (index: number, partial: Partial<Product>) => {
    setPayload((p) => {
      const products = [...p.products];
      products[index] = { ...products[index], ...partial };
      return { ...p, products };
    });
  };

  const removeProduct = (index: number) => {
    setPayload((p) => ({ ...p, products: p.products.filter((_, i) => i !== index) }));
  };

  const addPresentation = (prodIndex: number) => {
    setPayload((p) => {
      const products = [...p.products];
      const prod = { ...products[prodIndex] };
      prod.presentations = [
        ...prod.presentations,
        {
          presentation_id: `PRES-${prod.presentations.length + 1}`,
          uom: 'UNIT',
          attributes: {},
        },
      ];
      products[prodIndex] = prod;
      return { ...p, products };
    });
  };

  const updatePresentation = (prodIndex: number, presIndex: number, partial: Partial<Presentation>) => {
    setPayload((p) => {
      const products = [...p.products];
      const prod = { ...products[prodIndex] };
      const presentations = [...prod.presentations];
      presentations[presIndex] = { ...presentations[presIndex], ...partial };
      prod.presentations = presentations;
      products[prodIndex] = prod;
      return { ...p, products };
    });
  };

  const removePresentation = (prodIndex: number, presIndex: number) => {
    setPayload((p) => {
      const products = [...p.products];
      const prod = { ...products[prodIndex] };
      prod.presentations = prod.presentations.filter((_, i) => i !== presIndex);
      products[prodIndex] = prod;
      return { ...p, products };
    });
  };

  const ProductsStep = (
    <Card bordered={false} title="Products">
      {payload.products.map((prod, pi) => (
        <Card
          key={pi}
          size="small"
          type="inner"
          title={`Product ${pi + 1}`}
          style={{ marginBottom: 16 }}
          extra={
            <Button type="text" danger size="small" icon={<DeleteOutlined />} onClick={() => removeProduct(pi)} />
          }
        >
          <Space wrap style={{ width: '100%' }}>
            <Form.Item label="Product ID" style={{ margin: 0 }}>
              <Input
                value={prod.product_id}
                onChange={(e) => updateProduct(pi, { product_id: e.target.value })}
                size="small"
              />
            </Form.Item>
            <Form.Item label="Name" style={{ margin: 0 }}>
              <Input
                value={prod.name ?? ''}
                onChange={(e) => updateProduct(pi, { name: e.target.value })}
                size="small"
              />
            </Form.Item>
            <Form.Item label="Type" style={{ margin: 0 }}>
              <Input
                value={prod.product_type ?? ''}
                onChange={(e) => updateProduct(pi, { product_type: e.target.value })}
                size="small"
                placeholder="e.g. DRUG, DEVICE"
              />
            </Form.Item>
          </Space>
          <Divider orientation="left" plain style={{ margin: '12px 0 8px' }}>
            Presentations
          </Divider>
          <Table
            size="small"
            pagination={false}
            dataSource={prod.presentations.map((pr, i) => ({ ...pr, _idx: i }))}
            rowKey="_idx"
            columns={[
              {
                title: 'Presentation ID',
                dataIndex: 'presentation_id',
                render: (val: string, _: Presentation & { _idx: number }) => (
                  <Input
                    value={val}
                    onChange={(e) => updatePresentation(pi, _._idx, { presentation_id: e.target.value })}
                    size="small"
                  />
                ),
              },
              {
                title: 'UOM',
                dataIndex: 'uom',
                width: 120,
                render: (val: string, _: Presentation & { _idx: number }) => (
                  <Input
                    value={val}
                    onChange={(e) => updatePresentation(pi, _._idx, { uom: e.target.value })}
                    size="small"
                  />
                ),
              },
              {
                title: '',
                width: 50,
                render: (_: unknown, __: Presentation & { _idx: number }) => (
                  <Button
                    type="text"
                    danger
                    size="small"
                    icon={<DeleteOutlined />}
                    onClick={() => removePresentation(pi, __._idx)}
                  />
                ),
              },
            ]}
          />
          <Button
            type="dashed"
            size="small"
            icon={<PlusOutlined />}
            onClick={() => addPresentation(pi)}
            style={{ marginTop: 8 }}
          >
            Add Presentation
          </Button>
        </Card>
      ))}
      <Button type="dashed" block icon={<PlusOutlined />} onClick={addProduct}>
        Add Product
      </Button>
    </Card>
  );

  /* ================================================================ */
  /*  STEP 4 — Network                                                 */
  /* ================================================================ */
  const addNode = () => {
    setPayload((p) => ({
      ...p,
      network_nodes: [
        ...p.network_nodes,
        {
          node_id: `NODE-${p.network_nodes.length + 1}`,
          node_type: 'DEPOT',
          name: '',
          country: '',
          attributes: {},
        },
      ],
    }));
  };

  const updateNode = (index: number, partial: Partial<NetworkNode>) => {
    setPayload((p) => {
      const nodes = [...p.network_nodes];
      nodes[index] = { ...nodes[index], ...partial };
      return { ...p, network_nodes: nodes };
    });
  };

  const removeNode = (index: number) => {
    setPayload((p) => ({ ...p, network_nodes: p.network_nodes.filter((_, i) => i !== index) }));
  };

  const addLane = () => {
    setPayload((p) => ({
      ...p,
      network_lanes: [
        ...p.network_lanes,
        {
          lane_id: `LANE-${p.network_lanes.length + 1}`,
          from_node_id: '',
          to_node_id: '',
          default_lead_time_days: 7,
        },
      ],
    }));
  };

  const updateLane = (index: number, partial: Partial<NetworkLane>) => {
    setPayload((p) => {
      const lanes = [...p.network_lanes];
      lanes[index] = { ...lanes[index], ...partial };
      return { ...p, network_lanes: lanes };
    });
  };

  const removeLane = (index: number) => {
    setPayload((p) => ({ ...p, network_lanes: p.network_lanes.filter((_, i) => i !== index) }));
  };

  const nodeOptions = payload.network_nodes.map((n) => ({
    value: n.node_id,
    label: n.name ? `${n.node_id} (${n.name})` : n.node_id,
  }));

  const siteNodeOptions = payload.network_nodes
    .filter((n) => n.node_type === 'SITE')
    .map((n) => ({
      value: n.node_id,
      label: n.name ? `${n.node_id} (${n.name})` : n.node_id,
    }));

  const NetworkStep = (
    <Card bordered={false} title="Network">
      <Space style={{ marginBottom: 12 }}>
        <Typography.Title level={5} style={{ margin: 0 }}>Nodes</Typography.Title>
        <Button size="small" icon={<UploadOutlined />} onClick={() => setExcelModal('nodes')}>
          Upload from Excel
        </Button>
        <Button size="small" icon={<DownloadOutlined />} onClick={downloadNodesTemplate}>
          Download Template
        </Button>
      </Space>
      <Table
        size="small"
        pagination={false}
        dataSource={payload.network_nodes.map((n, i) => ({ ...n, _idx: i }))}
        rowKey="_idx"
        columns={[
          {
            title: 'Node ID',
            dataIndex: 'node_id',
            render: (val: string, _: NetworkNode & { _idx: number }) => (
              <Input value={val} onChange={(e) => updateNode(_._idx, { node_id: e.target.value })} size="small" />
            ),
          },
          {
            title: 'Type',
            dataIndex: 'node_type',
            width: 130,
            render: (val: string, _: NetworkNode & { _idx: number }) => (
              <Select
                value={val}
                onChange={(v) => updateNode(_._idx, { node_type: v })}
                size="small"
                style={{ width: '100%' }}
                options={[
                  { value: 'DEPOT', label: 'Depot' },
                  { value: 'SITE', label: 'Site' },
                ]}
              />
            ),
          },
          {
            title: 'Name',
            dataIndex: 'name',
            render: (val: string | undefined, _: NetworkNode & { _idx: number }) => (
              <Input value={val ?? ''} onChange={(e) => updateNode(_._idx, { name: e.target.value })} size="small" />
            ),
          },
          {
            title: 'Country',
            dataIndex: 'country',
            width: 100,
            render: (val: string | undefined, _: NetworkNode & { _idx: number }) => (
              <Input value={val ?? ''} onChange={(e) => updateNode(_._idx, { country: e.target.value })} size="small" />
            ),
          },
          {
            title: '',
            width: 50,
            render: (_: unknown, __: NetworkNode & { _idx: number }) => (
              <Button type="text" danger size="small" icon={<DeleteOutlined />} onClick={() => removeNode(__._idx)} />
            ),
          },
        ]}
      />
      <Button type="dashed" block icon={<PlusOutlined />} onClick={addNode} style={{ marginTop: 8 }}>
        Add Node
      </Button>

      <Divider />

      <Typography.Title level={5}>Lanes</Typography.Title>
      <Table
        size="small"
        pagination={false}
        dataSource={payload.network_lanes.map((l, i) => ({ ...l, _idx: i }))}
        rowKey="_idx"
        columns={[
          {
            title: 'Lane ID',
            dataIndex: 'lane_id',
            render: (val: string, _: NetworkLane & { _idx: number }) => (
              <Input value={val} onChange={(e) => updateLane(_._idx, { lane_id: e.target.value })} size="small" />
            ),
          },
          {
            title: 'From',
            dataIndex: 'from_node_id',
            render: (val: string, _: NetworkLane & { _idx: number }) => (
              <Select
                value={val || undefined}
                onChange={(v) => updateLane(_._idx, { from_node_id: v })}
                size="small"
                style={{ width: '100%' }}
                options={nodeOptions}
                placeholder="Select"
              />
            ),
          },
          {
            title: 'To',
            dataIndex: 'to_node_id',
            render: (val: string, _: NetworkLane & { _idx: number }) => (
              <Select
                value={val || undefined}
                onChange={(v) => updateLane(_._idx, { to_node_id: v })}
                size="small"
                style={{ width: '100%' }}
                options={nodeOptions}
                placeholder="Select"
              />
            ),
          },
          {
            title: 'Lead Time (days)',
            dataIndex: 'default_lead_time_days',
            width: 130,
            render: (val: number, _: NetworkLane & { _idx: number }) => (
              <InputNumber
                value={val}
                min={0}
                onChange={(v) => updateLane(_._idx, { default_lead_time_days: v ?? 0 })}
                size="small"
                style={{ width: '100%' }}
              />
            ),
          },
          {
            title: '',
            width: 50,
            render: (_: unknown, __: NetworkLane & { _idx: number }) => (
              <Button type="text" danger size="small" icon={<DeleteOutlined />} onClick={() => removeLane(__._idx)} />
            ),
          },
        ]}
      />
      <Button type="dashed" block icon={<PlusOutlined />} onClick={addLane} style={{ marginTop: 8 }}>
        Add Lane
      </Button>
    </Card>
  );

  /* ================================================================ */
  /*  STEP 5 — Visits                                                  */
  /* ================================================================ */
  const addVisit = () => {
    setPayload((p) => {
      const visits = [...(p.study_design?.visits ?? [])];
      visits.push({
        visit_id: `VISIT-${visits.length + 1}`,
        day_offset: 0,
        is_dosing_event: false,
        attributes: {},
      });
      return { ...p, study_design: { ...p.study_design!, visits } };
    });
  };

  const updateVisit = (index: number, partial: Partial<VisitDef>) => {
    setPayload((p) => {
      const visits = [...(p.study_design?.visits ?? [])];
      visits[index] = { ...visits[index], ...partial };
      return { ...p, study_design: { ...p.study_design!, visits } };
    });
  };

  /** Update interval (days since previous visit) and cascade day_offset recalculation */
  const updateVisitInterval = (index: number, interval: number) => {
    setPayload((p) => {
      const visits = [...(p.study_design?.visits ?? [])];
      // Compute new day_offset for this visit
      const prevOffset = index === 0 ? 0 : visits[index - 1].day_offset;
      const oldOffset = visits[index].day_offset;
      const newOffset = index === 0 ? interval : prevOffset + interval;
      const delta = newOffset - oldOffset;
      visits[index] = { ...visits[index], day_offset: newOffset };
      // Cascade: shift all subsequent visits by the same delta to preserve their intervals
      for (let j = index + 1; j < visits.length; j++) {
        visits[j] = { ...visits[j], day_offset: visits[j].day_offset + delta };
      }
      return { ...p, study_design: { ...p.study_design!, visits } };
    });
  };

  /** Compute interval for a visit at given index */
  const getVisitInterval = (visits: VisitDef[], index: number): number => {
    if (index === 0) return visits[0]?.day_offset ?? 0;
    return visits[index].day_offset - visits[index - 1].day_offset;
  };

  const removeVisit = (index: number) => {
    setPayload((p) => {
      const visits = (p.study_design?.visits ?? []).filter((_, i) => i !== index);
      return { ...p, study_design: { ...p.study_design!, visits } };
    });
  };

  const VisitsStep = (
    <Card bordered={false} title="Visits">
      <Space style={{ marginBottom: 12 }}>
        <Button size="small" icon={<UploadOutlined />} onClick={() => setExcelModal('visits')}>
          Upload from Excel
        </Button>
        <Button size="small" icon={<DownloadOutlined />} onClick={downloadVisitsTemplate}>
          Download Template
        </Button>
      </Space>
      <Table
        size="small"
        pagination={false}
        dataSource={(payload.study_design?.visits ?? []).map((v, i) => ({ ...v, _idx: i }))}
        rowKey="_idx"
        columns={[
          {
            title: 'Visit ID',
            dataIndex: 'visit_id',
            render: (val: string, _: VisitDef & { _idx: number }) => (
              <Input value={val} onChange={(e) => updateVisit(_._idx, { visit_id: e.target.value })} size="small" />
            ),
          },
          {
            title: 'Days Since Previous',
            dataIndex: 'day_offset',
            width: 160,
            render: (_val: number, record: VisitDef & { _idx: number }) => {
              const visits = payload.study_design?.visits ?? [];
              const interval = getVisitInterval(visits, record._idx);
              return (
                <InputNumber
                  value={interval}
                  min={0}
                  onChange={(v) => updateVisitInterval(record._idx, v ?? 0)}
                  size="small"
                  style={{ width: '100%' }}
                />
              );
            },
          },
          {
            title: 'Day (from enrollment)',
            dataIndex: 'day_offset',
            key: 'abs_day',
            width: 160,
            render: (val: number) => (
              <Typography.Text type="secondary">{val}</Typography.Text>
            ),
          },
          {
            title: 'Dosing Event',
            dataIndex: 'is_dosing_event',
            width: 120,
            render: (val: boolean, _: VisitDef & { _idx: number }) => (
              <Switch checked={val} onChange={(v) => updateVisit(_._idx, { is_dosing_event: v })} size="small" />
            ),
          },
          {
            title: '',
            width: 50,
            render: (_: unknown, __: VisitDef & { _idx: number }) => (
              <Button type="text" danger size="small" icon={<DeleteOutlined />} onClick={() => removeVisit(__._idx)} />
            ),
          },
        ]}
      />
      <Button type="dashed" block icon={<PlusOutlined />} onClick={addVisit} style={{ marginTop: 8 }}>
        Add Visit
      </Button>
    </Card>
  );

  /* ================================================================ */
  /*  STEP 6 — Regimens                                                */
  /* ================================================================ */
  const addRegimen = () => {
    setPayload((p) => ({
      ...p,
      regimens: [
        ...p.regimens,
        {
          regimen_id: `REG-${p.regimens.length + 1}`,
          name: '',
          dose_rule: { type: hasStudy ? 'table' : 'fixed', rows: [] },
          dose_inputs: { weight_kg_mean: 80 },
          visit_dispense: {},
          attributes: {},
        },
      ],
    }));
  };

  const addDoseTableRow = (regimenIndex: number) => {
    setPayload((p) => {
      const regimens = [...p.regimens];
      const reg = { ...regimens[regimenIndex] };
      const rule = { ...reg.dose_rule!, rows: [...(reg.dose_rule?.rows ?? [])] };
      rule.rows.push({ visit_id: '', dose_value: 0, dose_uom: '' });
      reg.dose_rule = rule;
      regimens[regimenIndex] = reg;
      return { ...p, regimens };
    });
  };

  const updateDoseTableRow = (regimenIndex: number, rowIndex: number, partial: Partial<DoseTableRow>) => {
    setPayload((p) => {
      const regimens = [...p.regimens];
      const reg = { ...regimens[regimenIndex] };
      const rule = { ...reg.dose_rule!, rows: [...(reg.dose_rule?.rows ?? [])] };
      rule.rows[rowIndex] = { ...rule.rows[rowIndex], ...partial };
      reg.dose_rule = rule;
      regimens[regimenIndex] = reg;
      return { ...p, regimens };
    });
  };

  const removeDoseTableRow = (regimenIndex: number, rowIndex: number) => {
    setPayload((p) => {
      const regimens = [...p.regimens];
      const reg = { ...regimens[regimenIndex] };
      const rule = { ...reg.dose_rule!, rows: (reg.dose_rule?.rows ?? []).filter((_, i) => i !== rowIndex) };
      reg.dose_rule = rule;
      regimens[regimenIndex] = reg;
      return { ...p, regimens };
    });
  };

  const updateRegimen = (index: number, partial: Partial<Regimen>) => {
    setPayload((p) => {
      const regimens = [...p.regimens];
      regimens[index] = { ...regimens[index], ...partial };
      return { ...p, regimens };
    });
  };

  const removeRegimen = (index: number) => {
    setPayload((p) => ({ ...p, regimens: p.regimens.filter((_, i) => i !== index) }));
  };

  /** Build a DoseRule from the study's dose_schedule for a given regimen */
  const buildDoseRuleFromStudy = (
    regimenId: string,
    cohortToRegimen: Record<string, string>,
    doseSchedule: DoseSchedule,
    dosingStrategy: DosingStrategy | undefined,
  ): DoseTableRow[] => {
    // Reverse-lookup: find which cohort maps to this regimen
    const cohortId = Object.entries(cohortToRegimen).find(([, rId]) => rId === regimenId)?.[0];
    if (!cohortId) return [];
    const cohortData = doseSchedule.cohorts?.[cohortId];
    if (!cohortData?.visits) return [];
    return Object.entries(cohortData.visits).map(([visitId, dose]) => {
      if (dosingStrategy === 'fixed') {
        return { visit_id: visitId, dose_value: dose.dose_value, dose_uom: dose.dose_uom ?? '' };
      }
      return { visit_id: visitId, per_kg_value: dose.dose_per_kg, per_kg_uom: dose.dose_uom ?? '' };
    });
  };

  const visitOptions = (payload.study_design?.visits ?? []).map((v) => ({
    value: v.visit_id,
    label: v.visit_id,
  }));

  /* ---- Dispense Rules helpers ---- */
  const addDispenseRule = () => {
    setPayload((p) => ({
      ...p,
      dispense_rules: [
        ...p.dispense_rules,
        {
          dispense_rule_id: `DISP-${p.dispense_rules.length + 1}`,
          name: '',
          rule: {
            type: 'conditional',
            conditions: [],
            default: { dispense: [{ product_id: '', qty: 1 }] },
          },
        },
      ],
    }));
  };

  const updateDispenseRule = (index: number, updated: DispenseRule) => {
    setPayload((p) => {
      const rules = [...p.dispense_rules];
      rules[index] = updated;
      return { ...p, dispense_rules: rules };
    });
  };

  const removeDispenseRule = (index: number) => {
    setPayload((p) => ({ ...p, dispense_rules: p.dispense_rules.filter((_, i) => i !== index) }));
  };

  const dispenseRuleOptions = payload.dispense_rules.map((dr) => ({
    value: dr.dispense_rule_id,
    label: dr.name ? `${dr.dispense_rule_id} — ${dr.name}` : dr.dispense_rule_id,
  }));

  /* ---- Arm/Cohort → Regimen mapping (shared by both regimen steps) ---- */
  const ArmRegimenMapping = (
    <>
      <Divider />
      <Typography.Title level={5}>Arm → Regimen Mapping</Typography.Title>
      <Typography.Text type="secondary" style={{ display: 'block', marginBottom: 12 }}>
        Assign a regimen to each arm.
      </Typography.Text>
      {(payload.study_design?.arms ?? []).length === 0 ? (
        <Typography.Text type="secondary">No arms defined. Add arms in the Study Design step.</Typography.Text>
      ) : (
        <Table
          size="small"
          pagination={false}
          dataSource={(payload.study_design?.arms ?? []).map((a) => ({
            key: a.arm_id,
            arm_id: a.arm_id,
            arm_name: a.name,
            regimen_id: payload.study_design?.arm_to_regimen?.[a.arm_id] ?? '',
          }))}
          columns={[
            { title: 'Arm ID', dataIndex: 'arm_id', key: 'arm_id', width: 180 },
            { title: 'Name', dataIndex: 'arm_name', key: 'arm_name', width: 200 },
            {
              title: 'Regimen',
              dataIndex: 'regimen_id',
              key: 'regimen_id',
              render: (val: string, row: { arm_id: string }) => (
                <Select
                  value={val || undefined}
                  placeholder="Select regimen"
                  allowClear
                  style={{ width: '100%' }}
                  size="small"
                  onChange={(v) => {
                    setPayload((p) => {
                      const mapping = { ...(p.study_design?.arm_to_regimen ?? {}) };
                      if (v) mapping[row.arm_id] = v;
                      else delete mapping[row.arm_id];
                      return { ...p, study_design: { ...p.study_design!, arm_to_regimen: mapping } };
                    });
                  }}
                  options={payload.regimens.map((r) => ({
                    value: r.regimen_id,
                    label: r.name ? `${r.regimen_id} (${r.name})` : r.regimen_id,
                  }))}
                />
              ),
            },
          ]}
        />
      )}

      <Divider />

      <Typography.Title level={5}>Cohort → Regimen Mapping</Typography.Title>
      <Typography.Text type="secondary" style={{ display: 'block', marginBottom: 12 }}>
        Assign a regimen to each cohort.
      </Typography.Text>
      {(payload.study_design?.cohorts ?? []).length === 0 ? (
        <Typography.Text type="secondary">No cohorts defined. Add cohorts in the Study Design step.</Typography.Text>
      ) : (
        <Table
          size="small"
          pagination={false}
          dataSource={(payload.study_design?.cohorts ?? []).map((c) => ({
            key: c.cohort_id,
            cohort_id: c.cohort_id,
            cohort_name: c.name,
            regimen_id: payload.study_design?.cohort_to_regimen?.[c.cohort_id] ?? '',
          }))}
          columns={[
            { title: 'Cohort ID', dataIndex: 'cohort_id', key: 'cohort_id', width: 180 },
            { title: 'Name', dataIndex: 'cohort_name', key: 'cohort_name', width: 200 },
            {
              title: 'Regimen',
              dataIndex: 'regimen_id',
              key: 'regimen_id',
              render: (val: string, row: { cohort_id: string }) => (
                <Select
                  value={val || undefined}
                  placeholder="Select regimen"
                  allowClear
                  style={{ width: '100%' }}
                  size="small"
                  onChange={(v) => {
                    setPayload((p) => {
                      const mapping = { ...(p.study_design?.cohort_to_regimen ?? {}) };
                      if (v) mapping[row.cohort_id] = v;
                      else delete mapping[row.cohort_id];
                      return { ...p, study_design: { ...p.study_design!, cohort_to_regimen: mapping } };
                    });
                  }}
                  options={payload.regimens.map((r) => ({
                    value: r.regimen_id,
                    label: r.name ? `${r.regimen_id} (${r.name})` : r.regimen_id,
                  }))}
                />
              ),
            },
          ]}
        />
      )}
    </>
  );

  const RegimensStep = (
    <Space direction="vertical" size="large" style={{ width: '100%' }}>
      {/* Dispense Rules definition */}
      <Card bordered={false} title="Dispense Rules">
        <p style={{ color: '#888', marginBottom: 16 }}>
          Define dispense rules first, then map them to visits in each regimen below.
          Choose <strong>Conditional</strong> for dose-based branching logic, or{' '}
          <strong>Vial Optimization</strong> for simple dose-to-unit calculation.
        </p>
        {payload.dispense_rules.map((dr, di) => (
          <DispenseRuleEditor
            key={di}
            rule={dr}
            products={payload.products}
            onChange={(updated) => updateDispenseRule(di, updated)}
            onRemove={() => removeDispenseRule(di)}
          />
        ))}
        <Button type="dashed" block icon={<PlusOutlined />} onClick={addDispenseRule}>
          Add Dispense Rule
        </Button>
      </Card>

      {/* Regimens */}
      <Card bordered={false} title="Regimens">
        {payload.regimens.map((reg, ri) => (
          <Card
            key={ri}
            size="small"
            type="inner"
            title={`Regimen ${ri + 1}`}
            style={{ marginBottom: 16 }}
            extra={
              <Button type="text" danger size="small" icon={<DeleteOutlined />} onClick={() => removeRegimen(ri)} />
            }
          >
            <Space wrap style={{ width: '100%', marginBottom: 12 }}>
              <Form.Item label="Regimen ID" style={{ margin: 0 }}>
                <Input
                  value={reg.regimen_id}
                  onChange={(e) => updateRegimen(ri, { regimen_id: e.target.value })}
                  size="small"
                />
              </Form.Item>
              <Form.Item label="Name" style={{ margin: 0 }}>
                <Input
                  value={reg.name ?? ''}
                  onChange={(e) => updateRegimen(ri, { name: e.target.value })}
                  size="small"
                />
              </Form.Item>
              <Form.Item label="Dose Rule Type" style={{ margin: 0 }}>
                <Select
                  value={reg.dose_rule?.type ?? 'fixed'}
                  onChange={(val) =>
                    updateRegimen(ri, {
                      dose_rule: { ...reg.dose_rule!, type: val, rows: val === 'table' ? (reg.dose_rule?.rows ?? []) : [] },
                    })
                  }
                  size="small"
                  style={{ width: 150 }}
                  options={[
                    { value: 'fixed', label: 'Fixed' },
                    { value: 'table', label: 'Table (per-visit)' },
                  ]}
                />
              </Form.Item>
            </Space>

            {/* Fixed dose fields */}
            {(reg.dose_rule?.type ?? 'fixed') === 'fixed' && (
              <Space wrap style={{ marginTop: 12, marginBottom: 8 }}>
                <Form.Item label="Dose Value" style={{ margin: 0 }}>
                  <InputNumber
                    value={reg.dose_rule?.dose_value}
                    onChange={(v) => updateRegimen(ri, { dose_rule: { ...reg.dose_rule!, dose_value: v ?? undefined } })}
                    size="small"
                    style={{ width: 120 }}
                  />
                </Form.Item>
                <Form.Item label="Dose UOM" style={{ margin: 0 }}>
                  <Input
                    value={reg.dose_rule?.dose_uom ?? ''}
                    onChange={(e) => updateRegimen(ri, { dose_rule: { ...reg.dose_rule!, dose_uom: e.target.value } })}
                    size="small"
                    style={{ width: 120 }}
                    placeholder="e.g. mg"
                  />
                </Form.Item>
              </Space>
            )}

            {/* Table dose fields */}
            {reg.dose_rule?.type === 'table' && (
              <>
                <Divider orientation="left" plain style={{ margin: '8px 0' }}>
                  Dose Table (per-visit doses)
                </Divider>
                <Table
                  size="small"
                  pagination={false}
                  dataSource={(reg.dose_rule.rows ?? []).map((row, i) => ({ ...row, _idx: i }))}
                  rowKey="_idx"
                  columns={[
                    {
                      title: 'Visit',
                      dataIndex: 'visit_id',
                      width: 160,
                      render: (val: string, _: DoseTableRow & { _idx: number }) => (
                        <Select
                          value={val || undefined}
                          onChange={(v) => updateDoseTableRow(ri, _._idx, { visit_id: v })}
                          size="small"
                          style={{ width: '100%' }}
                          placeholder="Select visit"
                          options={visitOptions}
                        />
                      ),
                    },
                    {
                      title: 'Per-kg Value',
                      dataIndex: 'per_kg_value',
                      width: 120,
                      render: (val: number | undefined, _: DoseTableRow & { _idx: number }) => (
                        <InputNumber
                          value={val}
                          onChange={(v) => updateDoseTableRow(ri, _._idx, { per_kg_value: v ?? undefined })}
                          size="small"
                          style={{ width: '100%' }}
                        />
                      ),
                    },
                    {
                      title: 'Per-kg UOM',
                      dataIndex: 'per_kg_uom',
                      width: 140,
                      render: (val: string | undefined, _: DoseTableRow & { _idx: number }) => (
                        <Select
                          value={val || undefined}
                          onChange={(v) => updateDoseTableRow(ri, _._idx, { per_kg_uom: v })}
                          size="small"
                          style={{ width: '100%' }}
                          allowClear
                          placeholder="Select"
                          options={[
                            { value: 'ng_per_kg', label: 'ng/kg' },
                            { value: 'mcg_per_kg', label: 'mcg/kg' },
                            { value: 'mg_per_kg', label: 'mg/kg' },
                          ]}
                        />
                      ),
                    },
                    {
                      title: 'Fixed Dose',
                      dataIndex: 'dose_value',
                      width: 120,
                      render: (val: number | undefined, _: DoseTableRow & { _idx: number }) => (
                        <InputNumber
                          value={val}
                          onChange={(v) => updateDoseTableRow(ri, _._idx, { dose_value: v ?? undefined })}
                          size="small"
                          style={{ width: '100%' }}
                        />
                      ),
                    },
                    {
                      title: 'Dose UOM',
                      dataIndex: 'dose_uom',
                      width: 100,
                      render: (val: string | undefined, _: DoseTableRow & { _idx: number }) => (
                        <Input
                          value={val ?? ''}
                          onChange={(e) => updateDoseTableRow(ri, _._idx, { dose_uom: e.target.value })}
                          size="small"
                        />
                      ),
                    },
                    {
                      title: '',
                      width: 50,
                      render: (_: unknown, __: DoseTableRow & { _idx: number }) => (
                        <Button type="text" danger size="small" icon={<DeleteOutlined />} onClick={() => removeDoseTableRow(ri, __._idx)} />
                      ),
                    },
                  ]}
                />
                <Button type="dashed" size="small" icon={<PlusOutlined />} onClick={() => addDoseTableRow(ri)} style={{ marginTop: 8 }}>
                  Add Row
                </Button>
              </>
            )}

            {/* Dose Inputs */}
            <Divider orientation="left" plain style={{ margin: '8px 0' }}>
              Dose Inputs
            </Divider>
            <Space wrap>
              <Form.Item label="Weight Mean (kg)" style={{ margin: 0 }}>
                <InputNumber
                  value={(reg.dose_inputs as Record<string, number>)?.weight_kg_mean ?? 80}
                  onChange={(v) => updateRegimen(ri, { dose_inputs: { ...reg.dose_inputs, weight_kg_mean: v ?? 80 } })}
                  size="small"
                  style={{ width: 120 }}
                  min={0}
                />
              </Form.Item>
              <Form.Item label="Weight SD (kg)" style={{ margin: 0 }}>
                <InputNumber
                  value={(reg.dose_inputs as Record<string, number>)?.weight_kg_sd}
                  onChange={(v) => updateRegimen(ri, { dose_inputs: { ...reg.dose_inputs, weight_kg_sd: v ?? undefined } })}
                  size="small"
                  style={{ width: 120 }}
                  min={0}
                />
              </Form.Item>
            </Space>

            <Divider orientation="left" plain style={{ margin: '8px 0' }}>
              Visit Dispense Mapping
            </Divider>
            <p style={{ color: '#888', fontSize: 12, marginBottom: 8 }}>
              For each visit, select which dispense rule applies. Leave blank for visits with no dispensing.
            </p>
            <Space wrap>
              {visitOptions.map((vo) => (
                <Form.Item key={vo.value} label={vo.label} style={{ margin: '0 8px 8px 0' }}>
                  <Select
                    size="small"
                    value={reg.visit_dispense[vo.value] || undefined}
                    onChange={(val) => {
                      const vd = { ...reg.visit_dispense };
                      if (val) {
                        vd[vo.value] = val;
                      } else {
                        delete vd[vo.value];
                      }
                      updateRegimen(ri, { visit_dispense: vd });
                    }}
                    placeholder="Select rule"
                    style={{ width: 180 }}
                    allowClear
                    options={dispenseRuleOptions}
                    notFoundContent="Add dispense rules above first"
                  />
                </Form.Item>
              ))}
            </Space>
          </Card>
        ))}
        <Button type="dashed" block icon={<PlusOutlined />} onClick={addRegimen}>
          Add Regimen
        </Button>
      </Card>

      {/* Arm/Cohort → Regimen Mapping */}
      <Card bordered={false} title="Arm & Cohort Mapping">
        {ArmRegimenMapping}
      </Card>
    </Space>
  );

  /* ================================================================ */
  /*  STEP 7 — Assumptions                                             */
  /* ================================================================ */
  const addWave = () => {
    updateAssumptions({
      enrollment_waves: [
        ...payload.assumptions.enrollment_waves,
        {
          wave_id: `WAVE-${payload.assumptions.enrollment_waves.length + 1}`,
          node_ids: [],
          enrollment_rate_per_bucket: 1,
          screen_fail_rate: 0,
        },
      ],
    });
  };

  const updateWave = (index: number, partial: Partial<EnrollmentWave>) => {
    const waves = [...payload.assumptions.enrollment_waves];
    waves[index] = { ...waves[index], ...partial };
    updateAssumptions({ enrollment_waves: waves });
  };

  const removeWave = (index: number) => {
    updateAssumptions({
      enrollment_waves: payload.assumptions.enrollment_waves.filter((_, i) => i !== index),
    });
  };

  const AssumptionsStep = (
    <Card bordered={false} title="Assumptions">
      <Form layout="vertical">
        <Space size="large" wrap>
          <Form.Item label="Discontinuation Rate" style={{ margin: 0 }}>
            <InputNumber
              min={0}
              max={1}
              step={0.01}
              value={
                typeof payload.assumptions.discontinuation === 'object'
                  ? (payload.assumptions.discontinuation as Record<string, unknown>)?.rate as number | undefined
                  : undefined
              }
              onChange={(v) =>
                updateAssumptions({
                  discontinuation: { rate: v ?? 0 },
                })
              }
              style={{ width: 160 }}
              placeholder="e.g. 0.15"
            />
          </Form.Item>
          <Form.Item label="Overage Factor" style={{ margin: 0 }}>
            <InputNumber
              min={1}
              step={0.05}
              value={payload.assumptions.global_overage_factor}
              onChange={(v) => updateAssumptions({ global_overage_factor: v ?? undefined })}
              style={{ width: 160 }}
              placeholder="e.g. 1.2"
            />
          </Form.Item>
          <Form.Item label="Depot Safety Stock (days)" style={{ margin: 0 }}>
            <InputNumber
              min={0}
              step={1}
              value={(payload.assumptions.buffers as Record<string, number> | undefined)?.depot_safety_stock_days}
              onChange={(v) =>
                updateAssumptions({
                  buffers: { ...payload.assumptions.buffers, depot_safety_stock_days: v ?? undefined },
                })
              }
              style={{ width: 160 }}
              placeholder="e.g. 30"
            />
          </Form.Item>
          <Form.Item label="Site Safety Stock (days)" style={{ margin: 0 }}>
            <InputNumber
              min={0}
              step={1}
              value={(payload.assumptions.buffers as Record<string, number> | undefined)?.site_safety_stock_days}
              onChange={(v) =>
                updateAssumptions({
                  buffers: { ...payload.assumptions.buffers, site_safety_stock_days: v ?? undefined },
                })
              }
              style={{ width: 160 }}
              placeholder="e.g. 14"
            />
          </Form.Item>
          <Form.Item label="Expiry Buffer (days)" style={{ margin: 0 }}>
            <InputNumber
              min={0}
              step={1}
              value={(payload.assumptions.buffers as Record<string, number> | undefined)?.expiry_buffer_days}
              onChange={(v) =>
                updateAssumptions({
                  buffers: { ...payload.assumptions.buffers, expiry_buffer_days: v ?? undefined },
                })
              }
              style={{ width: 160 }}
              placeholder="e.g. 30"
            />
          </Form.Item>
        </Space>
      </Form>

      <Divider />

      <Typography.Title level={5}>Enrollment</Typography.Title>
      <Form.Item label="Enrollment Mode" style={{ marginBottom: 16 }}>
        <Radio.Group
          value={payload.assumptions.enrollment_curve?.points?.length ? 'curve' : 'waves'}
          onChange={(e) => {
            if (e.target.value === 'curve') {
              updateAssumptions({
                enrollment_curve: {
                  curve_type: 'monthly_forecast',
                  points: payload.assumptions.enrollment_curve?.points ?? [],
                },
              });
            } else {
              updateAssumptions({ enrollment_curve: undefined });
            }
          }}
        >
          <Radio.Button value="curve">Enrollment Curve (recommended)</Radio.Button>
          <Radio.Button value="waves">Manual Waves (legacy)</Radio.Button>
        </Radio.Group>
      </Form.Item>

      {/* Enrollment Curve mode */}
      {payload.assumptions.enrollment_curve?.points !== undefined ? (
        <>
          <Space style={{ marginBottom: 12 }}>
            <Button size="small" icon={<UploadOutlined />} onClick={() => setExcelModal('enrollment_curve')}>
              Upload Curve from Excel
            </Button>
            <Button size="small" icon={<DownloadOutlined />} onClick={downloadEnrollmentCurveTemplate}>
              Download Template
            </Button>
          </Space>
          <Form.Item label="Screen Fail Rate" style={{ marginBottom: 12 }}>
            <InputNumber
              value={payload.assumptions.enrollment_curve?.screen_fail_rate}
              min={0}
              max={1}
              step={0.01}
              onChange={(v) =>
                updateAssumptions({
                  enrollment_curve: {
                    ...payload.assumptions.enrollment_curve!,
                    screen_fail_rate: v ?? undefined,
                  },
                })
              }
              style={{ width: 160 }}
              placeholder="e.g. 0.15"
            />
          </Form.Item>
          <Table
            size="small"
            pagination={false}
            dataSource={(payload.assumptions.enrollment_curve?.points ?? []).map((pt, i) => ({ ...pt, _idx: i }))}
            rowKey="_idx"
            columns={[
              {
                title: 'Period (month)', dataIndex: 'period', width: 130,
                render: (val: number, _: EnrollmentCurvePoint & { _idx: number }) => (
                  <InputNumber
                    value={val}
                    min={1}
                    onChange={(v) => {
                      const points = [...(payload.assumptions.enrollment_curve?.points ?? [])];
                      points[_._idx] = { ...points[_._idx], period: v ?? 1 };
                      updateAssumptions({
                        enrollment_curve: { ...payload.assumptions.enrollment_curve!, points },
                      });
                    }}
                    size="small"
                    style={{ width: '100%' }}
                  />
                ),
              },
              {
                title: 'Label', dataIndex: 'period_label', width: 160,
                render: (val: string | undefined, _: EnrollmentCurvePoint & { _idx: number }) => (
                  <Input
                    value={val ?? ''}
                    onChange={(e) => {
                      const points = [...(payload.assumptions.enrollment_curve?.points ?? [])];
                      points[_._idx] = { ...points[_._idx], period_label: e.target.value };
                      updateAssumptions({
                        enrollment_curve: { ...payload.assumptions.enrollment_curve!, points },
                      });
                    }}
                    size="small"
                    placeholder={`Month ${_._idx + 1}`}
                  />
                ),
              },
              {
                title: 'New Subjects', dataIndex: 'new_subjects', width: 130,
                render: (val: number, _: EnrollmentCurvePoint & { _idx: number }) => (
                  <InputNumber
                    value={val}
                    min={0}
                    step={1}
                    onChange={(v) => {
                      const points = [...(payload.assumptions.enrollment_curve?.points ?? [])];
                      points[_._idx] = { ...points[_._idx], new_subjects: v ?? 0 };
                      updateAssumptions({
                        enrollment_curve: { ...payload.assumptions.enrollment_curve!, points },
                      });
                    }}
                    size="small"
                    style={{ width: '100%' }}
                  />
                ),
              },
              {
                title: '', width: 50,
                render: (_: unknown, __: EnrollmentCurvePoint & { _idx: number }) => (
                  <Button
                    type="text"
                    danger
                    size="small"
                    icon={<DeleteOutlined />}
                    onClick={() => {
                      const points = (payload.assumptions.enrollment_curve?.points ?? []).filter((_, i) => i !== __._idx);
                      updateAssumptions({
                        enrollment_curve: { ...payload.assumptions.enrollment_curve!, points },
                      });
                    }}
                  />
                ),
              },
            ]}
          />
          <Button
            type="dashed"
            block
            icon={<PlusOutlined />}
            onClick={() => {
              const pts = payload.assumptions.enrollment_curve?.points ?? [];
              const nextPeriod = pts.length > 0 ? Math.max(...pts.map((p) => p.period)) + 1 : 1;
              updateAssumptions({
                enrollment_curve: {
                  ...payload.assumptions.enrollment_curve!,
                  points: [...pts, { period: nextPeriod, new_subjects: 0 }],
                },
              });
            }}
            style={{ marginTop: 8 }}
          >
            Add Period
          </Button>
          {(payload.assumptions.enrollment_curve?.points ?? []).length > 0 && (
            <Card size="small" style={{ marginTop: 12, background: '#f6f8fa' }}>
              <Typography.Text type="secondary">
                Total subjects: {(payload.assumptions.enrollment_curve?.points ?? []).reduce((sum, p) => sum + p.new_subjects, 0)} |
                Peak month: {(() => {
                  const pts = payload.assumptions.enrollment_curve?.points ?? [];
                  if (pts.length === 0) return '—';
                  const max = Math.max(...pts.map((p) => p.new_subjects));
                  const peak = pts.find((p) => p.new_subjects === max);
                  return peak?.period_label ?? `Month ${peak?.period}`;
                })()}
              </Typography.Text>
            </Card>
          )}
        </>
      ) : (
        /* Manual Waves mode (legacy) */
        <>
          {payload.assumptions.enrollment_waves.map((wave, wi) => (
            <Card
              key={wi}
              size="small"
              type="inner"
              title={wave.wave_id ?? `Wave ${wi + 1}`}
              style={{ marginBottom: 12 }}
              extra={
                <Button type="text" danger size="small" icon={<DeleteOutlined />} onClick={() => removeWave(wi)} />
              }
            >
              <Space wrap style={{ width: '100%' }}>
                <Form.Item label="Wave ID" style={{ margin: 0 }}>
                  <Input
                    value={wave.wave_id ?? ''}
                    onChange={(e) => updateWave(wi, { wave_id: e.target.value })}
                    size="small"
                  />
                </Form.Item>
                <Form.Item label="Node IDs" style={{ margin: 0 }}>
                  <Select
                    mode="tags"
                    value={wave.node_ids}
                    onChange={(vals) => updateWave(wi, { node_ids: vals })}
                    size="small"
                    style={{ minWidth: 200 }}
                    options={siteNodeOptions}
                    placeholder="Select or type node IDs"
                  />
                </Form.Item>
                <Form.Item label="Start Bucket Index" style={{ margin: 0 }}>
                  <InputNumber
                    value={wave.start_bucket_index}
                    min={0}
                    step={1}
                    onChange={(v) => updateWave(wi, { start_bucket_index: v ?? undefined })}
                    size="small"
                    style={{ width: 120 }}
                    placeholder="e.g. 0"
                  />
                </Form.Item>
                <Form.Item label="End Bucket Index" style={{ margin: 0 }}>
                  <InputNumber
                    value={wave.end_bucket_index}
                    min={0}
                    step={1}
                    onChange={(v) => updateWave(wi, { end_bucket_index: v ?? undefined })}
                    size="small"
                    style={{ width: 120 }}
                    placeholder="e.g. 24"
                  />
                </Form.Item>
                <Form.Item label="Rate / Bucket" style={{ margin: 0 }}>
                  <InputNumber
                    value={wave.enrollment_rate_per_bucket}
                    min={0}
                    step={0.5}
                    onChange={(v) => updateWave(wi, { enrollment_rate_per_bucket: v ?? 0 })}
                    size="small"
                    style={{ width: 120 }}
                  />
                </Form.Item>
                <Form.Item label="Screen Fail Rate" style={{ margin: 0 }}>
                  <InputNumber
                    value={wave.screen_fail_rate}
                    min={0}
                    max={1}
                    step={0.01}
                    onChange={(v) => updateWave(wi, { screen_fail_rate: v ?? 0 })}
                    size="small"
                    style={{ width: 120 }}
                  />
                </Form.Item>
              </Space>
            </Card>
          ))}
          <Button type="dashed" block icon={<PlusOutlined />} onClick={addWave}>
            Add Enrollment Wave
          </Button>
        </>
      )}
    </Card>
  );

  /* ================================================================ */
  /*  STEP 8 — Review                                                  */
  /* ================================================================ */
  const ReviewStep = (
    <Card bordered={false} title="Review Payload">
      <Typography.Paragraph type="secondary">
        Review the complete scenario payload below. Click Submit to create the scenario version.
      </Typography.Paragraph>
      <Collapse
        defaultActiveKey={['payload']}
        items={[
          {
            key: 'payload',
            label: 'Canonical Payload (JSON)',
            children: (
              <pre
                style={{
                  maxHeight: 500,
                  overflow: 'auto',
                  background: '#fafafa',
                  padding: 16,
                  borderRadius: 4,
                  fontSize: 12,
                }}
              >
                {JSON.stringify(payload, null, 2)}
              </pre>
            ),
          },
        ]}
      />
      <div style={{ marginTop: 24 }}>
        <Button
          type="primary"
          size="large"
          onClick={handleSubmit}
          loading={createScenario.isPending}
        >
          {isEditing ? 'Create New Version' : 'Submit'}
        </Button>
      </div>
    </Card>
  );

  // When a study is selected, sync trial_code to scenario so submit works
  useEffect(() => {
    if (selectedStudyDetail) {
      updateScenario({ trial_code: selectedStudyDetail.study_code });
      updateTrial({ code: selectedStudyDetail.study_code });
    }
  }, [selectedStudyDetail]); // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-populate arms/cohorts from study
  useEffect(() => {
    if (selectedStudyDetail) {
      const sp = selectedStudyDetail.payload;
      setPayload((p) => ({
        ...p,
        study_design: {
          ...p.study_design!,
          // Default arms from study (user can add more for scenario analysis)
          arms: sp?.arms?.length
            ? sp.arms.map((a: { arm_id: string; name?: string; randomization_weight?: number }) => ({
                arm_id: a.arm_id,
                name: a.name,
                randomization_weight: a.randomization_weight ?? 1,
              }))
            : (p.study_design?.arms ?? []),
          // Default cohorts from dose_schedule keys
          cohorts: sp?.dose_schedule?.cohorts
            ? Object.keys(sp.dose_schedule.cohorts).map((id) => ({
                cohort_id: id,
                name: id,
                attributes: {},
              }))
            : (p.study_design?.cohorts ?? []),
          visits: (sp?.visits as VisitDef[] | undefined) ?? (p.study_design?.visits ?? []),
        },
      }));
    }
  }, [selectedStudyDetail]); // eslint-disable-line react-hooks/exhaustive-deps

  /* ---- Regimens step without dispense rules (study-based flow) ---- */
  const studyDosingStrategy: DosingStrategy | undefined = (selectedStudyDetail?.payload?.dosing_strategy as DosingStrategy | undefined) ?? undefined;
  const isStudyFixedDosing = studyDosingStrategy === 'fixed';

  // Auto-populate regimen dose_rules from study when cohort_to_regimen or regimens change
  useEffect(() => {
    if (!selectedStudyDetail?.payload?.dose_schedule) return;
    const ds = selectedStudyDetail.payload.dose_schedule as DoseSchedule;

    setPayload((p) => {
      const c2r = p.study_design?.cohort_to_regimen ?? {};
      if (Object.keys(c2r).length === 0) return p;
      let changed = false;
      const regimens = p.regimens.map((reg) => {
        if ((reg.dose_rule?.rows ?? []).length > 0) return reg; // already has rows
        const rows = buildDoseRuleFromStudy(reg.regimen_id, c2r, ds, studyDosingStrategy);
        if (rows.length === 0) return reg;
        changed = true;
        return { ...reg, dose_rule: { ...reg.dose_rule!, type: 'table', rows } };
      });
      return changed ? { ...p, regimens } : p;
    });
  }, [payload.study_design?.cohort_to_regimen, payload.regimens.length, selectedStudyDetail, studyDosingStrategy]); // eslint-disable-line react-hooks/exhaustive-deps

  const RegimensOnlyStep = (
    <Space direction="vertical" size="large" style={{ width: '100%' }}>
      {/* Arm & Cohort Mapping FIRST — triggers auto-population */}
      <Card bordered={false} title="Arm & Cohort Mapping">
        <Typography.Paragraph type="secondary">
          Map arms and cohorts to regimens. When a cohort is mapped, doses are auto-populated from the study.
        </Typography.Paragraph>
        {ArmRegimenMapping}
      </Card>

      {/* Regimens card */}
      <Card bordered={false} title="Regimens">
        {payload.regimens.map((reg, ri) => (
          <Card
            key={ri}
            size="small"
            type="inner"
            title={`Regimen ${ri + 1}`}
            style={{ marginBottom: 16 }}
            extra={
              <Button type="text" danger size="small" icon={<DeleteOutlined />} onClick={() => removeRegimen(ri)} />
            }
          >
            <Space wrap style={{ width: '100%', marginBottom: 12 }}>
              <Form.Item label="Regimen ID" style={{ margin: 0 }}>
                <Input
                  value={reg.regimen_id}
                  onChange={(e) => updateRegimen(ri, { regimen_id: e.target.value })}
                  size="small"
                />
              </Form.Item>
              <Form.Item label="Name" style={{ margin: 0 }}>
                <Input
                  value={reg.name ?? ''}
                  onChange={(e) => updateRegimen(ri, { name: e.target.value })}
                  size="small"
                />
              </Form.Item>
            </Space>

            {(reg.dose_rule?.rows ?? []).length > 0 && (
              <Alert
                type="info"
                showIcon
                message="Doses pre-populated from study. Edit if needed."
                style={{ marginBottom: 12 }}
              />
            )}

            {/* Dose table — always shown for study-based regimens */}
            <Divider orientation="left" plain style={{ margin: '8px 0' }}>
              Dose Table (per-visit doses)
            </Divider>
            <Table
              size="small"
              pagination={false}
              dataSource={(reg.dose_rule?.rows ?? []).map((row, i) => ({ ...row, _idx: i }))}
              rowKey="_idx"
              columns={[
                {
                  title: 'Visit',
                  dataIndex: 'visit_id',
                  width: 160,
                  render: (val: string, _: DoseTableRow & { _idx: number }) => (
                    <Select
                      value={val || undefined}
                      onChange={(v) => updateDoseTableRow(ri, _._idx, { visit_id: v })}
                      size="small"
                      style={{ width: '100%' }}
                      placeholder="Select visit"
                      options={visitOptions}
                    />
                  ),
                },
                ...(isStudyFixedDosing
                  ? [
                      {
                        title: 'Dose Value',
                        dataIndex: 'dose_value',
                        width: 120,
                        render: (val: number | undefined, _: DoseTableRow & { _idx: number }) => (
                          <InputNumber
                            value={val}
                            onChange={(v) => updateDoseTableRow(ri, _._idx, { dose_value: v ?? undefined })}
                            size="small"
                            style={{ width: '100%' }}
                          />
                        ),
                      },
                      {
                        title: 'UOM',
                        dataIndex: 'dose_uom',
                        width: 120,
                        render: (val: string | undefined, _: DoseTableRow & { _idx: number }) => (
                          <Select
                            value={val || undefined}
                            onChange={(v) => updateDoseTableRow(ri, _._idx, { dose_uom: v })}
                            size="small"
                            style={{ width: '100%' }}
                            options={[
                              { value: 'mg', label: 'mg' },
                              { value: 'mcg', label: 'mcg' },
                              { value: 'ng', label: 'ng' },
                            ]}
                          />
                        ),
                      },
                    ]
                  : [
                      {
                        title: 'Dose/kg',
                        dataIndex: 'per_kg_value',
                        width: 120,
                        render: (val: number | undefined, _: DoseTableRow & { _idx: number }) => (
                          <InputNumber
                            value={val}
                            onChange={(v) => updateDoseTableRow(ri, _._idx, { per_kg_value: v ?? undefined })}
                            size="small"
                            style={{ width: '100%' }}
                          />
                        ),
                      },
                      {
                        title: 'UOM',
                        dataIndex: 'per_kg_uom',
                        width: 120,
                        render: (val: string | undefined, _: DoseTableRow & { _idx: number }) => (
                          <Select
                            value={val || undefined}
                            onChange={(v) => updateDoseTableRow(ri, _._idx, { per_kg_uom: v })}
                            size="small"
                            style={{ width: '100%' }}
                            options={[
                              { value: 'ng_per_kg', label: 'ng/kg' },
                              { value: 'mcg_per_kg', label: 'mcg/kg' },
                              { value: 'mg_per_kg', label: 'mg/kg' },
                            ]}
                          />
                        ),
                      },
                    ]),
                {
                  title: '',
                  width: 50,
                  render: (_: unknown, __: DoseTableRow & { _idx: number }) => (
                    <Button type="text" danger size="small" icon={<DeleteOutlined />} onClick={() => removeDoseTableRow(ri, __._idx)} />
                  ),
                },
              ]}
            />
            <Button type="dashed" size="small" icon={<PlusOutlined />} onClick={() => addDoseTableRow(ri)} style={{ marginTop: 8 }}>
              Add Row
            </Button>

            {/* Weight Mean/SD — only for non-fixed dosing */}
            {!isStudyFixedDosing && (
              <>
                <Divider orientation="left" plain style={{ margin: '8px 0' }}>
                  Dose Inputs
                </Divider>
                <Space wrap>
                  <Form.Item label="Weight Mean (kg)" style={{ margin: 0 }}>
                    <InputNumber
                      value={(reg.dose_inputs as Record<string, number>)?.weight_kg_mean ?? 80}
                      onChange={(v) => updateRegimen(ri, { dose_inputs: { ...reg.dose_inputs, weight_kg_mean: v ?? 80 } })}
                      size="small"
                      style={{ width: 120 }}
                      min={0}
                    />
                  </Form.Item>
                  <Form.Item label="Weight SD (kg)" style={{ margin: 0 }}>
                    <InputNumber
                      value={(reg.dose_inputs as Record<string, number>)?.weight_kg_sd}
                      onChange={(v) => updateRegimen(ri, { dose_inputs: { ...reg.dose_inputs, weight_kg_sd: v ?? undefined } })}
                      size="small"
                      style={{ width: 120 }}
                      min={0}
                    />
                  </Form.Item>
                </Space>
              </>
            )}
          </Card>
        ))}
        <Button type="dashed" block icon={<PlusOutlined />} onClick={addRegimen}>
          Add Regimen
        </Button>
      </Card>
    </Space>
  );

  /* ---- step content map ---- */
  const fullSteps = [
    SelectStudyStepContent,
    ProductsStep,
    StudyDesignStep,
    NetworkStep,
    VisitsStep,
    RegimensStep,
    AssumptionsStep,
    ReviewStep,
  ];

  const studySteps = [
    SelectStudyStepContent,
    StudyDesignStep,
    RegimensOnlyStep,
    AssumptionsStep,
    ReviewStep,
  ];

  const steps = hasStudy ? studySteps : fullSteps;

  return (
    <div>
      {/* Draft Resume Modal */}
      <DraftResumeModal
        open={draftModalOpen}
        lastSaved={draftLastSaved}
        onResume={handleResumeDraft}
        onStartFresh={handleStartFresh}
      />

      {/* Excel Upload Modals */}
      <ExcelUploadModal<Arm>
        open={excelModal === 'arms'}
        title="Import Arms from Excel"
        onCancel={() => setExcelModal(null)}
        onConfirm={(data, mode) => handleExcelConfirm('arms', data, mode)}
        parseFn={parseArms}
        columns={armPreviewColumns}
        onDownloadTemplate={downloadArmsTemplate}
      />
      <ExcelUploadModal<Cohort>
        open={excelModal === 'cohorts'}
        title="Import Cohorts from Excel"
        onCancel={() => setExcelModal(null)}
        onConfirm={(data, mode) => handleExcelConfirm('cohorts', data, mode)}
        parseFn={parseCohorts}
        columns={cohortPreviewColumns}
        onDownloadTemplate={downloadCohortsTemplate}
      />
      <ExcelUploadModal<NetworkNode>
        open={excelModal === 'nodes'}
        title="Import Nodes from Excel"
        onCancel={() => setExcelModal(null)}
        onConfirm={(data, mode) => handleExcelConfirm('nodes', data, mode)}
        parseFn={parseNodes}
        columns={nodePreviewColumns}
        onDownloadTemplate={downloadNodesTemplate}
      />
      <ExcelUploadModal<VisitDef>
        open={excelModal === 'visits'}
        title="Import Visits from Excel"
        onCancel={() => setExcelModal(null)}
        onConfirm={(data, mode) => handleExcelConfirm('visits', data, mode)}
        parseFn={parseVisits}
        columns={visitPreviewColumns}
        onDownloadTemplate={downloadVisitsTemplate}
      />
      <ExcelUploadModal<EnrollmentCurvePoint>
        open={excelModal === 'enrollment_curve'}
        title="Import Enrollment Curve from Excel"
        onCancel={() => setExcelModal(null)}
        onConfirm={(data, mode) => handleExcelConfirm('enrollment_curve', data, mode)}
        parseFn={parseEnrollmentCurve}
        columns={enrollmentCurvePreviewColumns}
        onDownloadTemplate={downloadEnrollmentCurveTemplate}
      />

      <Steps
        current={current}
        items={STEP_TITLES.map((t) => ({ title: t }))}
        style={{ marginBottom: 32 }}
        size="small"
      />

      {steps[current]}

      <div
        style={{
          marginTop: 24,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <Space>
          <Button disabled={current === 0} onClick={prev}>
            Previous
          </Button>
          {current < STEP_TITLES.length - 1 && (
            <Button type="primary" onClick={next}>
              Next
            </Button>
          )}
        </Space>
        <Space>
          {lastSavedAt && (
            <Typography.Text type="secondary" style={{ fontSize: 12 }}>
              Last saved {dayjs(lastSavedAt).format('h:mm:ss A')}
            </Typography.Text>
          )}
          <Button onClick={handleSaveDraft}>Save Draft</Button>
        </Space>
      </div>
    </div>
  );
};

export default ScenarioWizard;
