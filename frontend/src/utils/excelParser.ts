import * as XLSX from 'xlsx';
import type { Arm, Cohort, VisitDef, NetworkNode, NetworkLane, EnrollmentCurvePoint } from '../types/scenario';
import type { NodeCreate, LotCreate, VialCreate } from '../types/inventory';

export interface ParseResult<T> {
  data: T[];
  errors: string[];
  warnings: string[];
}

/**
 * Generic Excel parser: reads the first sheet, maps columns via `columnMap`,
 * and runs optional per-row validators.
 */
function parseExcel<T>(
  workbook: XLSX.WorkBook,
  columnMap: Record<string, string>, // header label → field name
  validators?: Array<(row: T, rowIndex: number) => string | null>,
): ParseResult<T> {
  const errors: string[] = [];
  const warnings: string[] = [];

  const sheetName = workbook.SheetNames[0];
  if (!sheetName) {
    return { data: [], errors: ['Workbook contains no sheets'], warnings };
  }

  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(
    workbook.Sheets[sheetName],
  );

  if (rows.length === 0) {
    return { data: [], errors: ['Sheet is empty — no data rows found'], warnings };
  }

  // Build reverse map: lowercase header → field name
  const reverseMap: Record<string, string> = {};
  for (const [header, field] of Object.entries(columnMap)) {
    reverseMap[header.toLowerCase()] = field;
  }

  // Check that expected headers exist in the first row's keys
  const firstRowKeys = Object.keys(rows[0]).map((k) => k.toLowerCase());
  const missingHeaders: string[] = [];
  for (const header of Object.keys(columnMap)) {
    if (!firstRowKeys.includes(header.toLowerCase())) {
      missingHeaders.push(header);
    }
  }
  if (missingHeaders.length > 0) {
    warnings.push(`Missing columns (will use defaults): ${missingHeaders.join(', ')}`);
  }

  const data: T[] = [];

  for (let i = 0; i < rows.length; i++) {
    const raw = rows[i];
    const mapped: Record<string, unknown> = {};

    for (const [rawKey, rawVal] of Object.entries(raw)) {
      const field = reverseMap[rawKey.toLowerCase()];
      if (field) {
        mapped[field] = rawVal;
      }
    }

    if (validators) {
      for (const validate of validators) {
        const err = validate(mapped as T, i + 2); // +2 for 1-based + header row
        if (err) errors.push(err);
      }
    }

    data.push(mapped as T);
  }

  return { data, errors, warnings };
}

/** Read a File object into an XLSX workbook */
function readFile(file: File): Promise<XLSX.WorkBook> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const wb = XLSX.read(e.target?.result, { type: 'array' });
        resolve(wb);
      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsArrayBuffer(file);
  });
}

/* ------------------------------------------------------------------ */
/*  Typed parsers                                                      */
/* ------------------------------------------------------------------ */

export async function parseArms(file: File): Promise<ParseResult<Arm>> {
  const wb = await readFile(file);
  const result = parseExcel<Arm>(
    wb,
    { arm_id: 'arm_id', name: 'name', randomization_weight: 'randomization_weight' },
    [
      (row, idx) =>
        !row.arm_id ? `Row ${idx}: arm_id is required` : null,
      (row, idx) => {
        const w = Number(row.randomization_weight);
        if (row.randomization_weight !== undefined && (isNaN(w) || w < 0))
          return `Row ${idx}: randomization_weight must be a non-negative number`;
        return null;
      },
    ],
  );
  // Coerce randomization_weight to number, default to 1
  result.data = result.data.map((a) => ({
    ...a,
    randomization_weight: Number(a.randomization_weight) || 1,
  }));
  return result;
}

export async function parseCohorts(file: File): Promise<ParseResult<Cohort>> {
  const wb = await readFile(file);
  const result = parseExcel<Cohort>(
    wb,
    { cohort_id: 'cohort_id', name: 'name', max_participants: 'max_participants' },
    [
      (row, idx) =>
        !row.cohort_id ? `Row ${idx}: cohort_id is required` : null,
    ],
  );
  // Ensure attributes exists on each row
  result.data = result.data.map((c) => ({ ...c, attributes: c.attributes ?? {} }));
  return result;
}

export async function parseVisits(file: File): Promise<ParseResult<VisitDef>> {
  const wb = await readFile(file);
  const result = parseExcel<VisitDef>(
    wb,
    {
      visit_id: 'visit_id',
      day_offset: 'day_offset',
      cycle_number: 'cycle_number',
      cycle_day: 'cycle_day',
      is_dosing_event: 'is_dosing_event',
    },
    [
      (row, idx) =>
        !row.visit_id ? `Row ${idx}: visit_id is required` : null,
      (row, idx) => {
        if (row.day_offset === undefined || String(row.day_offset) === '')
          return `Row ${idx}: day_offset is required`;
        return null;
      },
    ],
  );
  // Coerce is_dosing_event to boolean, ensure attributes
  result.data = result.data.map((v) => ({
    ...v,
    day_offset: Number(v.day_offset) || 0,
    cycle_number: v.cycle_number !== undefined ? Number(v.cycle_number) : undefined,
    cycle_day: v.cycle_day !== undefined ? Number(v.cycle_day) : undefined,
    is_dosing_event: coerceBool(v.is_dosing_event),
    attributes: v.attributes ?? {},
  }));
  return result;
}

export async function parseNodes(file: File): Promise<ParseResult<NetworkNode>> {
  const wb = await readFile(file);
  const result = parseExcel<NetworkNode>(
    wb,
    { node_id: 'node_id', node_type: 'node_type', name: 'name', country: 'country' },
    [
      (row, idx) =>
        !row.node_id ? `Row ${idx}: node_id is required` : null,
      (row, idx) => {
        const valid = ['DEPOT', 'SITE'];
        if (row.node_type && !valid.includes(String(row.node_type).toUpperCase()))
          return `Row ${idx}: node_type must be DEPOT or SITE`;
        return null;
      },
    ],
  );
  result.data = result.data.map((n) => ({
    ...n,
    node_type: (n.node_type ?? 'DEPOT').toUpperCase(),
    attributes: n.attributes ?? {},
  }));
  return result;
}

export async function parseLanes(file: File): Promise<ParseResult<NetworkLane>> {
  const wb = await readFile(file);
  const result = parseExcel<NetworkLane>(
    wb,
    {
      lane_id: 'lane_id',
      from_node_id: 'from_node_id',
      to_node_id: 'to_node_id',
      default_lead_time_days: 'default_lead_time_days',
      mode: 'mode',
    },
    [
      (row, idx) => (!row.lane_id ? `Row ${idx}: lane_id is required` : null),
      (row, idx) => (!row.from_node_id ? `Row ${idx}: from_node_id is required` : null),
      (row, idx) => (!row.to_node_id ? `Row ${idx}: to_node_id is required` : null),
    ],
  );
  result.data = result.data.map((l) => ({
    ...l,
    default_lead_time_days: Number(l.default_lead_time_days) || 7,
  }));
  return result;
}

export interface DoseScheduleRow {
  cohort_id: string;
  visit_id: string;
  dose_per_kg: number;
  dose_uom: string;
  phase: string;
}

export async function parseDoseSchedule(file: File): Promise<ParseResult<DoseScheduleRow>> {
  const wb = await readFile(file);
  const result = parseExcel<DoseScheduleRow>(
    wb,
    {
      cohort_id: 'cohort_id',
      visit_id: 'visit_id',
      dose_per_kg: 'dose_per_kg',
      dose_uom: 'dose_uom',
      phase: 'phase',
    },
    [
      (row, idx) => (!row.cohort_id ? `Row ${idx}: cohort_id is required` : null),
      (row, idx) => (!row.visit_id ? `Row ${idx}: visit_id is required` : null),
    ],
  );
  result.data = result.data.map((r) => ({
    ...r,
    dose_per_kg: Number(r.dose_per_kg) || 0,
    dose_uom: r.dose_uom || 'ng_per_kg',
    phase: r.phase || '',
  }));
  return result;
}

export async function parseEnrollmentCurve(file: File): Promise<ParseResult<EnrollmentCurvePoint>> {
  const wb = await readFile(file);
  const result = parseExcel<EnrollmentCurvePoint>(
    wb,
    {
      period: 'period',
      month: 'period',
      period_label: 'period_label',
      month_label: 'period_label',
      new_subjects: 'new_subjects',
      subjects: 'new_subjects',
    },
    [
      (row, idx) => {
        if (row.period === undefined || row.period === null)
          return `Row ${idx}: period is required`;
        return null;
      },
      (row, idx) => {
        const v = Number(row.new_subjects);
        if (isNaN(v) || v < 0) return `Row ${idx}: new_subjects must be a non-negative number`;
        return null;
      },
    ],
  );
  result.data = result.data.map((r) => ({
    ...r,
    period: Number(r.period) || 1,
    new_subjects: Number(r.new_subjects) || 0,
    period_label: r.period_label || undefined,
  }));
  return result;
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function coerceBool(val: unknown): boolean {
  if (typeof val === 'boolean') return val;
  if (typeof val === 'number') return val !== 0;
  if (typeof val === 'string') {
    const lower = val.toLowerCase().trim();
    return lower === 'true' || lower === 'yes' || lower === '1';
  }
  return false;
}

/* ------------------------------------------------------------------ */
/*  Inventory parsers                                                   */
/* ------------------------------------------------------------------ */

export async function parseInventoryNodes(file: File, studyId?: string): Promise<ParseResult<NodeCreate>> {
  const wb = await readFile(file);
  const result = parseExcel<NodeCreate>(
    wb,
    { node_id: 'node_id', node_type: 'node_type', name: 'name', country: 'country' },
    [
      (row, idx) => (!row.node_id ? `Row ${idx}: node_id is required` : null),
      (row, idx) => {
        const valid = ['DEPOT', 'SITE'];
        if (row.node_type && !valid.includes(String(row.node_type).toUpperCase()))
          return `Row ${idx}: node_type must be DEPOT or SITE`;
        return null;
      },
    ],
  );
  result.data = result.data.map((n) => ({
    ...n,
    node_type: (n.node_type ?? 'SITE').toUpperCase(),
    study_id: studyId,
  }));
  return result;
}

interface LotParseRow extends Omit<LotCreate, 'vials'> {
  medication_numbers?: string;
}

export async function parseLots(file: File): Promise<ParseResult<LotCreate>> {
  const wb = await readFile(file);
  const result = parseExcel<LotParseRow>(
    wb,
    {
      node_id: 'node_id',
      product_id: 'product_id',
      presentation_id: 'presentation_id',
      lot_number: 'lot_number',
      qty_on_hand: 'qty_on_hand',
      status: 'status',
      expiry_date: 'expiry_date',
      medication_numbers: 'medication_numbers',
    },
    [
      (row, idx) => (!row.node_id ? `Row ${idx}: node_id is required` : null),
      (row, idx) => (!row.product_id ? `Row ${idx}: product_id is required` : null),
      (row, idx) => (!row.lot_number ? `Row ${idx}: lot_number is required` : null),
    ],
  );

  // Transform medication_numbers string to vials array
  const transformedData: LotCreate[] = result.data.map((row) => {
    const vials: VialCreate[] | undefined = row.medication_numbers
      ? String(row.medication_numbers)
          .split(',')
          .map((m) => m.trim())
          .filter((m) => m)
          .map((medication_number) => ({ medication_number, status: 'AVAILABLE' }))
      : undefined;

    return {
      node_id: row.node_id,
      product_id: row.product_id,
      presentation_id: row.presentation_id || undefined,
      lot_number: row.lot_number,
      qty_on_hand: Number(row.qty_on_hand) || 0,
      status: String(row.status || 'RELEASED').toUpperCase(),
      expiry_date: row.expiry_date ? String(row.expiry_date) : undefined,
      vials,
    };
  });

  return { data: transformedData, errors: result.errors, warnings: result.warnings };
}
