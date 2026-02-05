import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Steps,
  Button,
  Form,
  Input,
  InputNumber,
  Select,
  Switch,
  Table,
  Space,
  Card,
  Collapse,
  Typography,
  Divider,
  Modal,
  message,
} from 'antd';
import {
  PlusOutlined,
  DeleteOutlined,
  UploadOutlined,
  DownloadOutlined,
  SaveOutlined,
  ThunderboltOutlined,
} from '@ant-design/icons';
import { useNavigate, useParams } from 'react-router-dom';
import { useCreateStudy, useStudy, useUpdateStudy } from '../../hooks/useStudies';
import { parseArms, parseNodes, parseLanes, parseVisits, parseDoseSchedule } from '../../utils/excelParser';
import type { DoseScheduleRow } from '../../utils/excelParser';
import {
  downloadArmsTemplate,
  downloadNodesTemplate,
  downloadLanesTemplate,
  downloadVisitsTemplate,
  downloadDoseScheduleTemplate,
} from '../../utils/excelTemplates';
import { saveStudyDraft, loadStudyDraft, clearStudyDraft, hasStudyDraft } from '../../utils/studyDraft';
import ExcelUploadModal from '../Scenarios/components/ExcelUploadModal';
import DispenseRuleEditor from '../Scenarios/components/DispenseRuleEditor';
import DraftResumeModal from '../Scenarios/components/DraftResumeModal';
import PageHeader from '../../components/PageHeader';
import type { StudyPayload, DosingStrategy, StudyArm } from '../../types/study';
import type {
  NetworkNode,
  NetworkLane,
  Product,
  Presentation,
  Arm,
  VisitDef,
  DispenseRule,
  DispenseRuleBody,
  DispenseItem,
} from '../../types/scenario';

/* ------------------------------------------------------------------ */
/*  Step labels                                                        */
/* ------------------------------------------------------------------ */
const STEP_TITLES = ['Trial Info', 'Products', 'Network', 'Visits', 'Arms & Dosing', 'Dispense Rules', 'Review'];

interface DoseRow {
  visit_id: string;
  dose_per_kg?: number;
  dose_value?: number;
  dose_uom: string;
  phase: string;
}

interface CohortSchedule {
  cohort_id: string;
  cohort_name: string;
  doses: DoseRow[];
}

interface StudyFormData {
  study_code: string;
  name: string;
  description: string;
  phase: string;
  protocol_version: string;
  countries: string[];
  products: Product[];
  network_nodes: NetworkNode[];
  network_lanes: NetworkLane[];
  visits: VisitDef[];
  arms: StudyArm[];
  dosing_strategy: DosingStrategy | '';
  cohort_schedules: CohortSchedule[];
  dispense_rules: DispenseRule[];
}

const emptyFormData = (): StudyFormData => ({
  study_code: '',
  name: '',
  description: '',
  phase: '',
  protocol_version: '',
  countries: [],
  products: [],
  network_nodes: [],
  network_lanes: [],
  visits: [],
  arms: [],
  dosing_strategy: '',
  cohort_schedules: [],
  dispense_rules: [],
});

/* ------------------------------------------------------------------ */
/*  Dose schedule conversion helpers                                   */
/* ------------------------------------------------------------------ */
function doseScheduleToForm(ds: StudyPayload['dose_schedule']): CohortSchedule[] {
  if (!ds || !ds.cohorts) return [];
  return Object.entries(ds.cohorts).map(([cohortId, cohortData]) => ({
    cohort_id: cohortId,
    cohort_name: '',
    doses: Object.entries(cohortData.visits || {}).map(([visitId, dose]) => ({
      visit_id: visitId,
      dose_per_kg: dose.dose_per_kg,
      dose_value: dose.dose_value,
      dose_uom: dose.dose_uom,
      phase: dose.phase,
    })),
  }));
}

function formToDoseSchedule(schedules: CohortSchedule[]): StudyPayload['dose_schedule'] {
  if (schedules.length === 0) return undefined;
  const cohorts: Record<string, { visits: Record<string, { dose_per_kg?: number; dose_value?: number; dose_uom: string; phase: string }> }> = {};
  for (const sched of schedules) {
    const visits: Record<string, { dose_per_kg?: number; dose_value?: number; dose_uom: string; phase: string }> = {};
    for (const dose of sched.doses) {
      if (dose.visit_id) {
        visits[dose.visit_id] = {
          dose_per_kg: dose.dose_per_kg,
          dose_value: dose.dose_value,
          dose_uom: dose.dose_uom,
          phase: dose.phase,
        };
      }
    }
    cohorts[sched.cohort_id] = { visits };
  }
  return { cohorts };
}

/* ================================================================== */
/*  Main Component                                                     */
/* ================================================================== */
const StudyWizard: React.FC = () => {
  const navigate = useNavigate();
  const { id: editId } = useParams<{ id: string }>();
  const isEditing = !!editId;

  const [current, setCurrent] = useState(0);
  const [form, setForm] = useState<StudyFormData>(emptyFormData());
  const [lastSavedAt, setLastSavedAt] = useState<string | null>(null);

  // Draft resume
  const [draftModalOpen, setDraftModalOpen] = useState(false);
  const [draftLastSaved, setDraftLastSaved] = useState('');
  const draftChecked = useRef(false);
  const draftReady = useRef(false);

  // Excel upload modals
  const [uploadTarget, setUploadTarget] = useState<'arms' | 'nodes' | 'lanes' | 'visits' | 'dose_schedule' | null>(null);

  const createStudy = useCreateStudy();
  const { data: existingStudy } = useStudy(editId ?? '');
  const updateStudy = useUpdateStudy(editId ?? '');

  /* ---- Draft: check on mount ---- */
  useEffect(() => {
    if (draftChecked.current || isEditing) return;
    draftChecked.current = true;
    if (hasStudyDraft()) {
      const draft = loadStudyDraft();
      if (draft) {
        setDraftLastSaved(draft.lastSaved);
        setDraftModalOpen(true);
        return;
      }
    }
    draftReady.current = true;
  }, [isEditing]);

  const handleResumeDraft = () => {
    const draft = loadStudyDraft();
    if (draft) {
      setForm(draft.form as StudyFormData);
      setCurrent(draft.currentStep);
      setLastSavedAt(draft.lastSaved);
    }
    setDraftModalOpen(false);
    draftReady.current = true;
  };

  const handleStartFresh = () => {
    clearStudyDraft();
    setDraftModalOpen(false);
    draftReady.current = true;
  };

  /* ---- Draft: auto-save every 10s ---- */
  useEffect(() => {
    if (isEditing || !draftReady.current) return;
    const interval = setInterval(() => {
      saveStudyDraft(form, current);
      setLastSavedAt(new Date().toISOString());
    }, 10_000);
    return () => clearInterval(interval);
  }, [form, current, isEditing]);

  const handleManualSave = () => {
    if (isEditing) return;
    saveStudyDraft(form, current);
    setLastSavedAt(new Date().toISOString());
    message.success('Draft saved');
  };

  /* ---- Load existing study for editing ---- */
  useEffect(() => {
    if (!existingStudy) return;
    const p = existingStudy.payload || {};
    setForm({
      study_code: existingStudy.study_code,
      name: existingStudy.name,
      description: existingStudy.description ?? '',
      phase: existingStudy.phase ?? '',
      protocol_version: existingStudy.protocol_version ?? '',
      countries: existingStudy.countries ?? [],
      products: (p.products ?? []) as Product[],
      network_nodes: (p.network_nodes ?? []) as NetworkNode[],
      network_lanes: (p.network_lanes ?? []) as NetworkLane[],
      visits: (p.visits ?? []) as VisitDef[],
      arms: (p.arms ?? []) as StudyArm[],
      dosing_strategy: (p.dosing_strategy ?? '') as DosingStrategy | '',
      cohort_schedules: doseScheduleToForm(p.dose_schedule),
      dispense_rules: ((p as Record<string, unknown>).dispense_rules ?? []) as DispenseRule[],
    });
    draftReady.current = true;
    draftChecked.current = true;
  }, [existingStudy]);

  /* ---- helpers ---- */
  const update = (partial: Partial<StudyFormData>) => setForm((f) => ({ ...f, ...partial }));
  const next = () => setCurrent((c) => Math.min(c + 1, STEP_TITLES.length - 1));
  const prev = () => setCurrent((c) => Math.max(c - 1, 0));

  /* ---- build payload ---- */
  const buildPayload = (): StudyPayload => ({
    trial: {
      code: form.study_code,
      phase: form.phase || undefined,
      protocol_version: form.protocol_version || undefined,
      countries: form.countries,
    },
    products: form.products as StudyPayload['products'],
    network_nodes: form.network_nodes as StudyPayload['network_nodes'],
    network_lanes: form.network_lanes as StudyPayload['network_lanes'],
    visits: form.visits as StudyPayload['visits'],
    arms: form.arms.length > 0 ? form.arms : undefined,
    dosing_strategy: form.dosing_strategy || undefined,
    dose_schedule: formToDoseSchedule(form.cohort_schedules),
    metadata: {},
    // Store dispense_rules in payload (uses extra="allow" on StudyPayload)
    ...(form.dispense_rules.length > 0 ? { dispense_rules: form.dispense_rules } : {}),
  } as StudyPayload);

  /* ---- submit ---- */
  const handleSubmit = async () => {
    if (!form.study_code || !form.name) {
      message.error('Study code and name are required');
      return;
    }
    try {
      if (isEditing) {
        await updateStudy.mutateAsync({
          name: form.name,
          description: form.description || undefined,
          phase: form.phase || undefined,
          protocol_version: form.protocol_version || undefined,
          countries: form.countries,
          payload: buildPayload(),
        });
        message.success('Study updated');
        navigate('/studies');
      } else {
        await createStudy.mutateAsync({
          study_code: form.study_code,
          name: form.name,
          description: form.description || undefined,
          phase: form.phase || undefined,
          protocol_version: form.protocol_version || undefined,
          countries: form.countries,
          payload: buildPayload(),
        });
        clearStudyDraft();
        message.success('Study created');
        navigate('/studies');
      }
    } catch (err: unknown) {
      const detail =
        (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail ??
        'Failed to save study';
      message.error(detail);
    }
  };

  /* ---- Excel upload handler ---- */
  const handleExcelConfirm = useCallback(
    (data: unknown[], mode: 'replace' | 'append') => {
      if (!uploadTarget) return;
      setForm((f) => {
        switch (uploadTarget) {
          case 'arms': {
            const existing = mode === 'append' ? f.arms : [];
            const imported = (data as Arm[]).map((a) => ({
              arm_id: a.arm_id,
              name: a.name,
              randomization_weight: a.randomization_weight ?? 1,
            }));
            return { ...f, arms: [...existing, ...imported] };
          }
          case 'nodes': {
            const existing = mode === 'append' ? f.network_nodes : [];
            return { ...f, network_nodes: [...existing, ...(data as NetworkNode[])] };
          }
          case 'lanes': {
            const existing = mode === 'append' ? f.network_lanes : [];
            return { ...f, network_lanes: [...existing, ...(data as NetworkLane[])] };
          }
          case 'visits': {
            const existing = mode === 'append' ? f.visits : [];
            return { ...f, visits: [...existing, ...(data as VisitDef[])] };
          }
          case 'dose_schedule': {
            const rows = data as DoseScheduleRow[];
            // Group by cohort_id
            const cohortMap = new Map<string, DoseRow[]>();
            for (const row of rows) {
              const doses = cohortMap.get(row.cohort_id) ?? [];
              doses.push({
                visit_id: row.visit_id,
                dose_per_kg: row.dose_per_kg,
                dose_uom: row.dose_uom,
                phase: row.phase,
              });
              cohortMap.set(row.cohort_id, doses);
            }
            const newSchedules: CohortSchedule[] = Array.from(cohortMap.entries()).map(
              ([cohort_id, doses]) => ({ cohort_id, cohort_name: '', doses }),
            );
            const existing = mode === 'append' ? f.cohort_schedules : [];
            return { ...f, cohort_schedules: [...existing, ...newSchedules] };
          }
          default:
            return f;
        }
      });
      setUploadTarget(null);
    },
    [uploadTarget],
  );

  const excelModalConfig = uploadTarget
    ? {
        arms: {
          title: 'Import Arms',
          parseFn: parseArms,
          onTemplate: downloadArmsTemplate,
          columns: [
            { title: 'Arm ID', dataIndex: 'arm_id' },
            { title: 'Name', dataIndex: 'name' },
            { title: 'Weight', dataIndex: 'randomization_weight' },
          ],
        },
        nodes: {
          title: 'Import Nodes',
          parseFn: parseNodes,
          onTemplate: downloadNodesTemplate,
          columns: [
            { title: 'Node ID', dataIndex: 'node_id' },
            { title: 'Type', dataIndex: 'node_type' },
            { title: 'Name', dataIndex: 'name' },
            { title: 'Country', dataIndex: 'country' },
          ],
        },
        lanes: {
          title: 'Import Lanes',
          parseFn: parseLanes,
          onTemplate: downloadLanesTemplate,
          columns: [
            { title: 'Lane ID', dataIndex: 'lane_id' },
            { title: 'From', dataIndex: 'from_node_id' },
            { title: 'To', dataIndex: 'to_node_id' },
            { title: 'Lead Time', dataIndex: 'default_lead_time_days' },
          ],
        },
        visits: {
          title: 'Import Visits',
          parseFn: parseVisits,
          onTemplate: downloadVisitsTemplate,
          columns: [
            { title: 'Visit ID', dataIndex: 'visit_id' },
            { title: 'Day Offset', dataIndex: 'day_offset' },
            { title: 'Dosing', dataIndex: 'is_dosing_event', render: (v: boolean) => (v ? 'Yes' : 'No') },
          ],
        },
        dose_schedule: {
          title: 'Import Dose Schedule',
          parseFn: parseDoseSchedule,
          onTemplate: downloadDoseScheduleTemplate,
          columns: [
            { title: 'Cohort', dataIndex: 'cohort_id' },
            { title: 'Visit', dataIndex: 'visit_id' },
            { title: 'Dose/kg', dataIndex: 'dose_per_kg' },
            { title: 'UOM', dataIndex: 'dose_uom' },
            { title: 'Phase', dataIndex: 'phase' },
          ],
        },
      }[uploadTarget]
    : null;

  /* ================================================================ */
  /*  STEP 1 — Trial Info                                              */
  /* ================================================================ */
  const TrialInfoStep = (
    <Card bordered={false} title="Trial Information">
      <Form layout="vertical">
        <Form.Item label="Study Code" required>
          <Input
            value={form.study_code}
            onChange={(e) => update({ study_code: e.target.value })}
            placeholder="e.g. STUDY-001"
            disabled={isEditing}
          />
        </Form.Item>
        <Form.Item label="Name" required>
          <Input
            value={form.name}
            onChange={(e) => update({ name: e.target.value })}
            placeholder="e.g. Phase 1a PK Study"
          />
        </Form.Item>
        <Form.Item label="Description">
          <Input.TextArea
            value={form.description}
            onChange={(e) => update({ description: e.target.value })}
            rows={3}
          />
        </Form.Item>
        <Form.Item label="Phase">
          <Select
            value={form.phase || undefined}
            onChange={(v) => update({ phase: v ?? '' })}
            placeholder="Select phase"
            allowClear
            options={[
              { value: 'P1', label: 'Phase 1' },
              { value: 'P1A', label: 'Phase 1a' },
              { value: 'P1B', label: 'Phase 1b' },
              { value: 'P2', label: 'Phase 2' },
              { value: 'P3', label: 'Phase 3' },
              { value: 'P4', label: 'Phase 4' },
            ]}
          />
        </Form.Item>
        <Form.Item label="Protocol Version">
          <Input
            value={form.protocol_version}
            onChange={(e) => update({ protocol_version: e.target.value })}
            placeholder="e.g. v1.0"
          />
        </Form.Item>
        <Form.Item label="Countries">
          <Select
            mode="tags"
            value={form.countries}
            onChange={(vals) => update({ countries: vals })}
            placeholder="Type country codes and press Enter"
          />
        </Form.Item>
      </Form>
    </Card>
  );

  /* ================================================================ */
  /*  STEP 2 — Products                                                */
  /* ================================================================ */
  const addProduct = () => {
    update({
      products: [
        ...form.products,
        {
          product_id: `PROD-${form.products.length + 1}`,
          name: '',
          product_type: '',
          inventory_uom: 'UNIT',
          presentations: [],
          attributes: {},
        },
      ],
    });
  };

  const updateProduct = (index: number, partial: Partial<Product>) => {
    const products = [...form.products];
    products[index] = { ...products[index], ...partial };
    update({ products });
  };

  const removeProduct = (index: number) => {
    update({ products: form.products.filter((_, i) => i !== index) });
  };

  const addPresentation = (prodIndex: number) => {
    const products = [...form.products];
    const prod = { ...products[prodIndex] };
    prod.presentations = [
      ...prod.presentations,
      { presentation_id: `PRES-${prod.presentations.length + 1}`, uom: 'UNIT', attributes: {} },
    ];
    products[prodIndex] = prod;
    update({ products });
  };

  const updatePresentation = (prodIndex: number, presIndex: number, partial: Partial<Presentation>) => {
    const products = [...form.products];
    const prod = { ...products[prodIndex] };
    const presentations = [...prod.presentations];
    presentations[presIndex] = { ...presentations[presIndex], ...partial };
    prod.presentations = presentations;
    products[prodIndex] = prod;
    update({ products });
  };

  const removePresentation = (prodIndex: number, presIndex: number) => {
    const products = [...form.products];
    const prod = { ...products[prodIndex] };
    prod.presentations = prod.presentations.filter((_, i) => i !== presIndex);
    products[prodIndex] = prod;
    update({ products });
  };

  const ProductsStep = (
    <Card bordered={false} title="Products">
      {form.products.map((prod, pi) => (
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
              <Input value={prod.product_id} onChange={(e) => updateProduct(pi, { product_id: e.target.value })} size="small" />
            </Form.Item>
            <Form.Item label="Name" style={{ margin: 0 }}>
              <Input value={prod.name ?? ''} onChange={(e) => updateProduct(pi, { name: e.target.value })} size="small" />
            </Form.Item>
            <Form.Item label="Type" style={{ margin: 0 }}>
              <Input value={prod.product_type ?? ''} onChange={(e) => updateProduct(pi, { product_type: e.target.value })} size="small" placeholder="e.g. DRUG" />
            </Form.Item>
          </Space>
          <Divider orientation="left" plain style={{ margin: '12px 0 8px' }}>Presentations</Divider>
          <Table
            size="small"
            pagination={false}
            dataSource={prod.presentations.map((pr, i) => ({ ...pr, _idx: i }))}
            rowKey="_idx"
            columns={[
              {
                title: 'Presentation ID', dataIndex: 'presentation_id',
                render: (val: string, _: Presentation & { _idx: number }) => (
                  <Input value={val} onChange={(e) => updatePresentation(pi, _._idx, { presentation_id: e.target.value })} size="small" />
                ),
              },
              {
                title: 'UOM', dataIndex: 'uom', width: 120,
                render: (val: string, _: Presentation & { _idx: number }) => (
                  <Input value={val} onChange={(e) => updatePresentation(pi, _._idx, { uom: e.target.value })} size="small" />
                ),
              },
              {
                title: '', width: 50,
                render: (_: unknown, __: Presentation & { _idx: number }) => (
                  <Button type="text" danger size="small" icon={<DeleteOutlined />} onClick={() => removePresentation(pi, __._idx)} />
                ),
              },
            ]}
          />
          <Button type="dashed" size="small" icon={<PlusOutlined />} onClick={() => addPresentation(pi)} style={{ marginTop: 8 }}>
            Add Presentation
          </Button>
        </Card>
      ))}
      <Button type="dashed" block icon={<PlusOutlined />} onClick={addProduct}>Add Product</Button>
    </Card>
  );

  /* ================================================================ */
  /*  STEP 3 — Network                                                 */
  /* ================================================================ */
  const addNode = () => {
    update({
      network_nodes: [
        ...form.network_nodes,
        { node_id: `NODE-${form.network_nodes.length + 1}`, node_type: 'DEPOT', name: '', country: '', attributes: {} },
      ],
    });
  };

  const updateNode = (index: number, partial: Partial<NetworkNode>) => {
    const nodes = [...form.network_nodes];
    nodes[index] = { ...nodes[index], ...partial };
    update({ network_nodes: nodes });
  };

  const removeNode = (index: number) => {
    update({ network_nodes: form.network_nodes.filter((_, i) => i !== index) });
  };

  const addLane = () => {
    update({
      network_lanes: [
        ...form.network_lanes,
        { lane_id: `LANE-${form.network_lanes.length + 1}`, from_node_id: '', to_node_id: '', default_lead_time_days: 7 },
      ],
    });
  };

  const updateLane = (index: number, partial: Partial<NetworkLane>) => {
    const lanes = [...form.network_lanes];
    lanes[index] = { ...lanes[index], ...partial };
    update({ network_lanes: lanes });
  };

  const removeLane = (index: number) => {
    update({ network_lanes: form.network_lanes.filter((_, i) => i !== index) });
  };

  const nodeOptions = form.network_nodes.map((n) => ({
    value: n.node_id,
    label: n.name ? `${n.node_id} (${n.name})` : n.node_id,
  }));

  const NetworkStep = (
    <Card bordered={false} title="Network">
      <Space style={{ marginBottom: 12 }}>
        <Button icon={<UploadOutlined />} onClick={() => setUploadTarget('nodes')}>Import Nodes</Button>
        <Button icon={<DownloadOutlined />} onClick={downloadNodesTemplate}>Nodes Template</Button>
        <Button icon={<UploadOutlined />} onClick={() => setUploadTarget('lanes')}>Import Lanes</Button>
        <Button icon={<DownloadOutlined />} onClick={downloadLanesTemplate}>Lanes Template</Button>
      </Space>

      <Typography.Title level={5}>Nodes</Typography.Title>
      <Table
        size="small"
        pagination={false}
        dataSource={form.network_nodes.map((n, i) => ({ ...n, _idx: i }))}
        rowKey="_idx"
        columns={[
          {
            title: 'Node ID', dataIndex: 'node_id',
            render: (val: string, _: NetworkNode & { _idx: number }) => (
              <Input value={val} onChange={(e) => updateNode(_._idx, { node_id: e.target.value })} size="small" />
            ),
          },
          {
            title: 'Type', dataIndex: 'node_type', width: 130,
            render: (val: string, _: NetworkNode & { _idx: number }) => (
              <Select value={val} onChange={(v) => updateNode(_._idx, { node_type: v })} size="small" style={{ width: '100%' }}
                options={[{ value: 'DEPOT', label: 'Depot' }, { value: 'SITE', label: 'Site' }]} />
            ),
          },
          {
            title: 'Name', dataIndex: 'name',
            render: (val: string | undefined, _: NetworkNode & { _idx: number }) => (
              <Input value={val ?? ''} onChange={(e) => updateNode(_._idx, { name: e.target.value })} size="small" />
            ),
          },
          {
            title: 'Country', dataIndex: 'country', width: 100,
            render: (val: string | undefined, _: NetworkNode & { _idx: number }) => (
              <Input value={val ?? ''} onChange={(e) => updateNode(_._idx, { country: e.target.value })} size="small" />
            ),
          },
          {
            title: '', width: 50,
            render: (_: unknown, __: NetworkNode & { _idx: number }) => (
              <Button type="text" danger size="small" icon={<DeleteOutlined />} onClick={() => removeNode(__._idx)} />
            ),
          },
        ]}
      />
      <Button type="dashed" block icon={<PlusOutlined />} onClick={addNode} style={{ marginTop: 8 }}>Add Node</Button>

      <Divider />

      <Typography.Title level={5}>Lanes</Typography.Title>
      <Table
        size="small"
        pagination={false}
        dataSource={form.network_lanes.map((l, i) => ({ ...l, _idx: i }))}
        rowKey="_idx"
        columns={[
          {
            title: 'Lane ID', dataIndex: 'lane_id',
            render: (val: string, _: NetworkLane & { _idx: number }) => (
              <Input value={val} onChange={(e) => updateLane(_._idx, { lane_id: e.target.value })} size="small" />
            ),
          },
          {
            title: 'From', dataIndex: 'from_node_id',
            render: (val: string, _: NetworkLane & { _idx: number }) => (
              <Select value={val || undefined} onChange={(v) => updateLane(_._idx, { from_node_id: v })} size="small" style={{ width: '100%' }} options={nodeOptions} placeholder="Select" />
            ),
          },
          {
            title: 'To', dataIndex: 'to_node_id',
            render: (val: string, _: NetworkLane & { _idx: number }) => (
              <Select value={val || undefined} onChange={(v) => updateLane(_._idx, { to_node_id: v })} size="small" style={{ width: '100%' }} options={nodeOptions} placeholder="Select" />
            ),
          },
          {
            title: 'Lead Time (days)', dataIndex: 'default_lead_time_days', width: 130,
            render: (val: number, _: NetworkLane & { _idx: number }) => (
              <InputNumber value={val} min={0} onChange={(v) => updateLane(_._idx, { default_lead_time_days: v ?? 0 })} size="small" style={{ width: '100%' }} />
            ),
          },
          {
            title: '', width: 50,
            render: (_: unknown, __: NetworkLane & { _idx: number }) => (
              <Button type="text" danger size="small" icon={<DeleteOutlined />} onClick={() => removeLane(__._idx)} />
            ),
          },
        ]}
      />
      <Button type="dashed" block icon={<PlusOutlined />} onClick={addLane} style={{ marginTop: 8 }}>Add Lane</Button>
    </Card>
  );

  /* ================================================================ */
  /*  STEP 4 — Visits                                                  */
  /* ================================================================ */
  const addVisit = () => {
    const visits = [...form.visits];
    visits.push({ visit_id: `VISIT-${visits.length + 1}`, day_offset: 0, is_dosing_event: false, attributes: {} });
    update({ visits });
  };

  const updateVisit = (index: number, partial: Partial<VisitDef>) => {
    const visits = [...form.visits];
    visits[index] = { ...visits[index], ...partial };
    update({ visits });
  };

  const updateVisitInterval = (index: number, interval: number) => {
    const visits = [...form.visits];
    const prevOffset = index === 0 ? 0 : visits[index - 1].day_offset;
    const oldOffset = visits[index].day_offset;
    const newOffset = index === 0 ? interval : prevOffset + interval;
    const delta = newOffset - oldOffset;
    visits[index] = { ...visits[index], day_offset: newOffset };
    for (let j = index + 1; j < visits.length; j++) {
      visits[j] = { ...visits[j], day_offset: visits[j].day_offset + delta };
    }
    update({ visits });
  };

  const getVisitInterval = (visits: VisitDef[], index: number): number => {
    if (index === 0) return visits[0]?.day_offset ?? 0;
    return visits[index].day_offset - visits[index - 1].day_offset;
  };

  const removeVisit = (index: number) => {
    update({ visits: form.visits.filter((_, i) => i !== index) });
  };

  const VisitsStep = (
    <Card bordered={false} title="Visits">
      <Space style={{ marginBottom: 12 }}>
        <Button icon={<UploadOutlined />} onClick={() => setUploadTarget('visits')}>Import Visits</Button>
        <Button icon={<DownloadOutlined />} onClick={downloadVisitsTemplate}>Visits Template</Button>
      </Space>
      <Table
        size="small"
        pagination={false}
        dataSource={form.visits.map((v, i) => ({ ...v, _idx: i }))}
        rowKey="_idx"
        columns={[
          {
            title: 'Visit ID', dataIndex: 'visit_id',
            render: (val: string, _: VisitDef & { _idx: number }) => (
              <Input value={val} onChange={(e) => updateVisit(_._idx, { visit_id: e.target.value })} size="small" />
            ),
          },
          {
            title: 'Days Since Previous', dataIndex: 'day_offset', width: 160,
            render: (_val: number, record: VisitDef & { _idx: number }) => {
              const interval = getVisitInterval(form.visits, record._idx);
              return (
                <InputNumber value={interval} min={0} onChange={(v) => updateVisitInterval(record._idx, v ?? 0)} size="small" style={{ width: '100%' }} />
              );
            },
          },
          {
            title: 'Day (from enrollment)', dataIndex: 'day_offset', key: 'abs_day', width: 160,
            render: (val: number) => <Typography.Text type="secondary">{val}</Typography.Text>,
          },
          {
            title: 'Dosing Event', dataIndex: 'is_dosing_event', width: 120,
            render: (val: boolean, _: VisitDef & { _idx: number }) => (
              <Switch checked={val} onChange={(v) => updateVisit(_._idx, { is_dosing_event: v })} size="small" />
            ),
          },
          {
            title: '', width: 50,
            render: (_: unknown, __: VisitDef & { _idx: number }) => (
              <Button type="text" danger size="small" icon={<DeleteOutlined />} onClick={() => removeVisit(__._idx)} />
            ),
          },
        ]}
      />
      <Button type="dashed" block icon={<PlusOutlined />} onClick={addVisit} style={{ marginTop: 8 }}>Add Visit</Button>
    </Card>
  );

  /* ================================================================ */
  /*  STEP 5 — Dose Schedule                                           */
  /* ================================================================ */
  const addCohortSchedule = () => {
    update({
      cohort_schedules: [
        ...form.cohort_schedules,
        { cohort_id: `COHORT-${form.cohort_schedules.length + 1}`, cohort_name: '', doses: [] },
      ],
    });
  };

  const updateCohortSchedule = (index: number, partial: Partial<CohortSchedule>) => {
    const schedules = [...form.cohort_schedules];
    schedules[index] = { ...schedules[index], ...partial };
    update({ cohort_schedules: schedules });
  };

  const removeCohortSchedule = (index: number) => {
    update({ cohort_schedules: form.cohort_schedules.filter((_, i) => i !== index) });
  };

  const addDoseRow = (cohortIndex: number) => {
    const schedules = [...form.cohort_schedules];
    const sched = { ...schedules[cohortIndex] };
    const isFixed = form.dosing_strategy === 'fixed';
    sched.doses = [...sched.doses, {
      visit_id: '',
      dose_per_kg: isFixed ? undefined : 0,
      dose_value: isFixed ? 0 : undefined,
      dose_uom: isFixed ? 'mg' : 'ng_per_kg',
      phase: '',
    }];
    schedules[cohortIndex] = sched;
    update({ cohort_schedules: schedules });
  };

  const updateDoseRow = (cohortIndex: number, rowIndex: number, partial: Partial<DoseRow>) => {
    const schedules = [...form.cohort_schedules];
    const sched = { ...schedules[cohortIndex] };
    const doses = [...sched.doses];
    doses[rowIndex] = { ...doses[rowIndex], ...partial };
    sched.doses = doses;
    schedules[cohortIndex] = sched;
    update({ cohort_schedules: schedules });
  };

  const removeDoseRow = (cohortIndex: number, rowIndex: number) => {
    const schedules = [...form.cohort_schedules];
    const sched = { ...schedules[cohortIndex] };
    sched.doses = sched.doses.filter((_, i) => i !== rowIndex);
    schedules[cohortIndex] = sched;
    update({ cohort_schedules: schedules });
  };

  /** Fill remaining visits with the target dose for a cohort */
  const fillToTarget = (cohortIndex: number) => {
    const sched = form.cohort_schedules[cohortIndex];
    // Find the last dose row tagged as "target"
    const targetRow = [...sched.doses].reverse().find((d) => d.phase === 'target');
    if (!targetRow || !targetRow.visit_id) {
      message.warning('Set at least one visit dose with phase "target" first');
      return;
    }
    // Determine which visits already have doses
    const existingVisitIds = new Set(sched.doses.map((d) => d.visit_id));
    // Find the target visit's position in the visits array
    const targetVisitIdx = form.visits.findIndex((v) => v.visit_id === targetRow.visit_id);
    // Fill all visits after the target that don't have a dose yet
    const newDoses: DoseRow[] = [];
    for (let i = targetVisitIdx + 1; i < form.visits.length; i++) {
      const v = form.visits[i];
      if (!existingVisitIds.has(v.visit_id)) {
        newDoses.push({
          visit_id: v.visit_id,
          dose_per_kg: targetRow.dose_per_kg,
          dose_value: targetRow.dose_value,
          dose_uom: targetRow.dose_uom,
          phase: 'target',
        });
      }
    }
    if (newDoses.length === 0) {
      message.info('All visits after target already have doses');
      return;
    }
    const schedules = [...form.cohort_schedules];
    schedules[cohortIndex] = { ...sched, doses: [...sched.doses, ...newDoses] };
    update({ cohort_schedules: schedules });
    message.success(`Filled ${newDoses.length} visits with target dose`);
  };

  const visitSelectOptions = form.visits.map((v) => ({ value: v.visit_id, label: v.visit_id }));

  /* ---- Arms helpers ---- */
  const addStudyArm = () => {
    update({
      arms: [...form.arms, { arm_id: `ARM-${form.arms.length + 1}`, name: '', randomization_weight: 1 }],
    });
  };

  const updateStudyArm = (index: number, partial: Partial<StudyArm>) => {
    const arms = [...form.arms];
    arms[index] = { ...arms[index], ...partial };
    update({ arms });
  };

  const removeStudyArm = (index: number) => {
    update({ arms: form.arms.filter((_, i) => i !== index) });
  };

  const isFixedDosing = form.dosing_strategy === 'fixed';

  const doseColumn = isFixedDosing
    ? {
        title: 'Dose Value', dataIndex: 'dose_value' as const, width: 120,
        render: (val: number | undefined, _: DoseRow & { _idx: number }, ci: number) => (
          <InputNumber value={val} onChange={(v) => updateDoseRow(ci, _._idx, { dose_value: v ?? 0 })} size="small" style={{ width: '100%' }} min={0} step={0.1} />
        ),
      }
    : {
        title: 'Dose/kg', dataIndex: 'dose_per_kg' as const, width: 120,
        render: (val: number | undefined, _: DoseRow & { _idx: number }, ci: number) => (
          <InputNumber value={val} onChange={(v) => updateDoseRow(ci, _._idx, { dose_per_kg: v ?? 0 })} size="small" style={{ width: '100%' }} min={0} step={0.1} />
        ),
      };

  const uomOptions = isFixedDosing
    ? [
        { value: 'mg', label: 'mg' },
        { value: 'mcg', label: 'mcg' },
        { value: 'ng', label: 'ng' },
      ]
    : [
        { value: 'ng_per_kg', label: 'ng/kg' },
        { value: 'mcg_per_kg', label: 'mcg/kg' },
        { value: 'mg_per_kg', label: 'mg/kg' },
      ];

  const DoseScheduleStep = (
    <Card bordered={false} title="Arms & Dosing">
      {/* Arms table */}
      <Typography.Title level={5}>Arms</Typography.Title>
      <Typography.Paragraph type="secondary">
        Define treatment arms with randomization weights. These will be available as defaults when creating scenarios.
      </Typography.Paragraph>
      <Space style={{ marginBottom: 12 }}>
        <Button icon={<UploadOutlined />} onClick={() => setUploadTarget('arms')}>Import Arms</Button>
        <Button icon={<DownloadOutlined />} onClick={downloadArmsTemplate}>Arms Template</Button>
      </Space>
      <Table
        size="small"
        pagination={false}
        dataSource={form.arms.map((a, i) => ({ ...a, _idx: i }))}
        rowKey="_idx"
        columns={[
          {
            title: 'Arm ID', dataIndex: 'arm_id',
            render: (val: string, _: StudyArm & { _idx: number }) => (
              <Input value={val} onChange={(e) => updateStudyArm(_._idx, { arm_id: e.target.value })} size="small" />
            ),
          },
          {
            title: 'Name', dataIndex: 'name',
            render: (val: string | undefined, _: StudyArm & { _idx: number }) => (
              <Input value={val ?? ''} onChange={(e) => updateStudyArm(_._idx, { name: e.target.value })} size="small" />
            ),
          },
          {
            title: 'Weight', dataIndex: 'randomization_weight', width: 100,
            render: (val: number | undefined, _: StudyArm & { _idx: number }) => (
              <InputNumber value={val ?? 1} min={0} step={0.1} onChange={(v) => updateStudyArm(_._idx, { randomization_weight: v ?? 1 })} size="small" style={{ width: '100%' }} />
            ),
          },
          {
            title: '', width: 50,
            render: (_: unknown, __: StudyArm & { _idx: number }) => (
              <Button type="text" danger size="small" icon={<DeleteOutlined />} onClick={() => removeStudyArm(__._idx)} />
            ),
          },
        ]}
      />
      <Button type="dashed" block icon={<PlusOutlined />} onClick={addStudyArm} style={{ marginTop: 8 }}>Add Arm</Button>

      <Divider />

      {/* Dosing Strategy selector */}
      <Typography.Title level={5}>Dosing Strategy</Typography.Title>
      <Form.Item label="Strategy" style={{ marginBottom: 16 }}>
        <Select
          value={form.dosing_strategy || undefined}
          onChange={(v) => update({ dosing_strategy: (v ?? '') as DosingStrategy | '' })}
          placeholder="Select dosing strategy"
          allowClear
          style={{ width: 300 }}
          options={[
            { value: 'fixed', label: 'Fixed Dose' },
            { value: 'weight_based', label: 'Weight-Based' },
            { value: 'loading_maintenance', label: 'Loading + Maintenance' },
            { value: 'dose_escalation', label: 'Dose Escalation' },
          ]}
        />
      </Form.Item>

      <Divider />

      {/* Cohort Dose Schedules */}
      <Typography.Title level={5}>Cohort Dose Schedules</Typography.Title>
      <Space style={{ marginBottom: 12 }}>
        <Button icon={<UploadOutlined />} onClick={() => setUploadTarget('dose_schedule')}>Import Dose Schedule</Button>
        <Button icon={<DownloadOutlined />} onClick={downloadDoseScheduleTemplate}>Dose Schedule Template</Button>
      </Space>
      <Typography.Paragraph type="secondary">
        Define per-cohort, per-visit dose levels. Use "Fill to Target" to auto-populate remaining visits.
        {isFixedDosing ? ' Using fixed dose values (dose_value).' : ' Using weight-based values (dose/kg).'}
      </Typography.Paragraph>
      {form.cohort_schedules.map((sched, ci) => (
        <Card
          key={ci}
          size="small"
          type="inner"
          title={`Cohort: ${sched.cohort_id}`}
          style={{ marginBottom: 16 }}
          extra={
            <Space>
              <Button
                size="small"
                icon={<ThunderboltOutlined />}
                onClick={() => fillToTarget(ci)}
              >
                Fill to Target
              </Button>
              <Button type="text" danger size="small" icon={<DeleteOutlined />} onClick={() => removeCohortSchedule(ci)} />
            </Space>
          }
        >
          <Space wrap style={{ marginBottom: 12 }}>
            <Form.Item label="Cohort ID" style={{ margin: 0 }}>
              <Input value={sched.cohort_id} onChange={(e) => updateCohortSchedule(ci, { cohort_id: e.target.value })} size="small" />
            </Form.Item>
            <Form.Item label="Cohort Name" style={{ margin: 0 }}>
              <Input value={sched.cohort_name} onChange={(e) => updateCohortSchedule(ci, { cohort_name: e.target.value })} size="small" />
            </Form.Item>
          </Space>
          <Table
            size="small"
            pagination={false}
            dataSource={sched.doses.map((d, i) => ({ ...d, _idx: i }))}
            rowKey="_idx"
            columns={[
              {
                title: 'Visit', dataIndex: 'visit_id', width: 160,
                render: (val: string, _: DoseRow & { _idx: number }) => (
                  <Select value={val || undefined} onChange={(v) => updateDoseRow(ci, _._idx, { visit_id: v })} size="small" style={{ width: '100%' }} placeholder="Select visit" options={visitSelectOptions} />
                ),
              },
              {
                title: doseColumn.title, dataIndex: doseColumn.dataIndex, width: doseColumn.width,
                render: (val: number | undefined, row: DoseRow & { _idx: number }) => doseColumn.render(val, row, ci),
              },
              {
                title: 'UOM', dataIndex: 'dose_uom', width: 140,
                render: (val: string, _: DoseRow & { _idx: number }) => (
                  <Select value={val || undefined} onChange={(v) => updateDoseRow(ci, _._idx, { dose_uom: v })} size="small" style={{ width: '100%' }}
                    options={uomOptions}
                  />
                ),
              },
              {
                title: 'Phase', dataIndex: 'phase', width: 140,
                render: (val: string, _: DoseRow & { _idx: number }) => (
                  <Select value={val || undefined} onChange={(v) => updateDoseRow(ci, _._idx, { phase: v ?? '' })} size="small" style={{ width: '100%' }} allowClear placeholder="Select"
                    options={[
                      { value: 'priming', label: 'Priming' },
                      { value: 'target', label: 'Target' },
                      { value: 'maintenance', label: 'Maintenance' },
                    ]}
                  />
                ),
              },
              {
                title: '', width: 50,
                render: (_: unknown, __: DoseRow & { _idx: number }) => (
                  <Button type="text" danger size="small" icon={<DeleteOutlined />} onClick={() => removeDoseRow(ci, __._idx)} />
                ),
              },
            ]}
          />
          <Button type="dashed" size="small" icon={<PlusOutlined />} onClick={() => addDoseRow(ci)} style={{ marginTop: 8 }}>
            Add Visit Dose
          </Button>
        </Card>
      ))}
      <Button type="dashed" block icon={<PlusOutlined />} onClick={addCohortSchedule}>Add Cohort</Button>
    </Card>
  );

  /* ================================================================ */
  /*  STEP 6 — Dispense Rules                                         */
  /* ================================================================ */
  const addDispenseRule = () => {
    update({
      dispense_rules: [
        ...form.dispense_rules,
        {
          dispense_rule_id: `DISP-${form.dispense_rules.length + 1}`,
          name: '',
          rule: {
            type: 'conditional',
            conditions: [],
            default: { dispense: [{ product_id: '', qty: 1 }] },
          } as DispenseRuleBody,
        },
      ],
    });
  };

  const updateDispenseRule = (index: number, updated: DispenseRule) => {
    const rules = [...form.dispense_rules];
    rules[index] = updated;
    update({ dispense_rules: rules });
  };

  const removeDispenseRule = (index: number) => {
    update({ dispense_rules: form.dispense_rules.filter((_, i) => i !== index) });
  };

  const DispenseRulesStep = (
    <Card bordered={false} title="Dispense Rules">
      <Typography.Paragraph type="secondary">
        Define dispense rules at the study level. These rules determine which products and quantities are dispensed at each visit based on conditions.
      </Typography.Paragraph>
      {form.dispense_rules.map((rule, i) => (
        <DispenseRuleEditor
          key={i}
          rule={rule}
          products={form.products}
          onChange={(updated) => updateDispenseRule(i, updated)}
          onRemove={() => removeDispenseRule(i)}
        />
      ))}
      <Button type="dashed" block icon={<PlusOutlined />} onClick={addDispenseRule}>Add Dispense Rule</Button>
    </Card>
  );

  /* ================================================================ */
  /*  STEP 7 — Review                                                  */
  /* ================================================================ */
  const ReviewStep = (
    <Card bordered={false} title="Review">
      <Typography.Paragraph type="secondary">
        Review the complete study definition below. Click Submit to {isEditing ? 'update' : 'create'} the study.
      </Typography.Paragraph>
      <Collapse
        defaultActiveKey={['payload']}
        items={[
          {
            key: 'payload',
            label: 'Study Payload (JSON)',
            children: (
              <pre style={{ maxHeight: 500, overflow: 'auto', background: '#fafafa', padding: 16, borderRadius: 4, fontSize: 12 }}>
                {JSON.stringify(
                  {
                    study_code: form.study_code,
                    name: form.name,
                    phase: form.phase,
                    countries: form.countries,
                    payload: buildPayload(),
                  },
                  null,
                  2,
                )}
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
          loading={createStudy.isPending || updateStudy.isPending}
        >
          {isEditing ? 'Update Study' : 'Create Study'}
        </Button>
      </div>
    </Card>
  );

  /* ---- step content ---- */
  const steps = [TrialInfoStep, ProductsStep, NetworkStep, VisitsStep, DoseScheduleStep, DispenseRulesStep, ReviewStep];

  return (
    <div>
      <PageHeader
        title={isEditing ? 'Edit Study' : 'Create Study'}
        subtitle={isEditing ? form.study_code : undefined}
        breadcrumbs={[
          { label: 'Studies', path: '/studies' },
          { label: isEditing ? 'Edit' : 'New' },
        ]}
        extra={
          !isEditing ? (
            <Space>
              {lastSavedAt && (
                <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                  Draft saved {new Date(lastSavedAt).toLocaleTimeString()}
                </Typography.Text>
              )}
              <Button icon={<SaveOutlined />} onClick={handleManualSave}>
                Save Draft
              </Button>
            </Space>
          ) : undefined
        }
      />

      <Steps
        current={current}
        items={STEP_TITLES.map((t) => ({ title: t }))}
        style={{ marginBottom: 32 }}
        size="small"
      />

      {steps[current]}

      <div style={{ marginTop: 24, display: 'flex', justifyContent: 'space-between' }}>
        <Space>
          <Button disabled={current === 0} onClick={prev}>Previous</Button>
          {current < STEP_TITLES.length - 1 && (
            <Button type="primary" onClick={next}>Next</Button>
          )}
        </Space>
        <Button onClick={() => navigate('/studies')}>Cancel</Button>
      </div>

      {/* Excel upload modal */}
      {uploadTarget && excelModalConfig && (
        <ExcelUploadModal
          open
          title={excelModalConfig.title}
          parseFn={excelModalConfig.parseFn as (file: File) => Promise<{ data: object[]; errors: string[]; warnings: string[] }>}
          columns={excelModalConfig.columns as { title: string; dataIndex: string }[]}
          onDownloadTemplate={excelModalConfig.onTemplate}
          onConfirm={handleExcelConfirm}
          onCancel={() => setUploadTarget(null)}
        />
      )}

      {/* Draft resume modal */}
      <DraftResumeModal
        open={draftModalOpen}
        lastSaved={draftLastSaved}
        onResume={handleResumeDraft}
        onStartFresh={handleStartFresh}
      />
    </div>
  );
};

export default StudyWizard;
