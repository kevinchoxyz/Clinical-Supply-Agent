import * as XLSX from 'xlsx';

function downloadWorkbook(wb: XLSX.WorkBook, filename: string) {
  XLSX.writeFile(wb, filename);
}

function buildTemplate(headers: string[], sampleRow: (string | number | boolean)[], filename: string) {
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet([headers, sampleRow]);

  // Set reasonable column widths
  ws['!cols'] = headers.map((h) => ({ wch: Math.max(h.length + 4, 16) }));

  XLSX.utils.book_append_sheet(wb, ws, 'Template');
  downloadWorkbook(wb, filename);
}

export function downloadArmsTemplate() {
  buildTemplate(
    ['arm_id', 'name', 'randomization_weight'],
    ['ARM-1', 'Treatment A', 1],
    'arms_template.xlsx',
  );
}

export function downloadCohortsTemplate() {
  buildTemplate(
    ['cohort_id', 'name', 'max_participants'],
    ['COHORT-1', 'Cohort A', 100],
    'cohorts_template.xlsx',
  );
}

export function downloadVisitsTemplate() {
  buildTemplate(
    ['visit_id', 'day_offset', 'cycle_number', 'cycle_day', 'is_dosing_event'],
    ['VISIT-1', 0, 1, 1, true],
    'visits_template.xlsx',
  );
}

export function downloadNodesTemplate() {
  buildTemplate(
    ['node_id', 'node_type', 'name', 'country'],
    ['NODE-1', 'DEPOT', 'Central Depot', 'US'],
    'nodes_template.xlsx',
  );
}

export function downloadLanesTemplate() {
  buildTemplate(
    ['lane_id', 'from_node_id', 'to_node_id', 'default_lead_time_days', 'mode'],
    ['LANE-1', 'NODE-1', 'NODE-2', 7, 'GROUND'],
    'lanes_template.xlsx',
  );
}

export function downloadDoseScheduleTemplate() {
  const wb = XLSX.utils.book_new();
  const headers = ['cohort_id', 'visit_id', 'dose_per_kg', 'dose_uom', 'phase'];
  const sampleRows = [
    ['COHORT-1', 'VISIT-1', 0.1, 'ng_per_kg', 'priming'],
    ['COHORT-1', 'VISIT-2', 0.5, 'ng_per_kg', 'target'],
    ['COHORT-1', 'VISIT-3', 0.5, 'ng_per_kg', 'target'],
  ];
  const ws = XLSX.utils.aoa_to_sheet([headers, ...sampleRows]);
  ws['!cols'] = headers.map((h) => ({ wch: Math.max(h.length + 4, 16) }));
  XLSX.utils.book_append_sheet(wb, ws, 'Template');
  downloadWorkbook(wb, 'dose_schedule_template.xlsx');
}

export function downloadEnrollmentCurveTemplate() {
  const wb = XLSX.utils.book_new();
  const headers = ['period', 'period_label', 'new_subjects'];
  // Sample: 24 months with ramp-up pattern
  const sampleRows: (string | number)[][] = [];
  const ramp = [2, 5, 8, 12, 15, 18, 20, 20, 20, 20, 18, 15, 12, 10, 8, 6, 5, 4, 3, 3, 2, 2, 1, 1];
  for (let i = 0; i < 24; i++) {
    sampleRows.push([i + 1, `Month ${i + 1}`, ramp[i]]);
  }
  const ws = XLSX.utils.aoa_to_sheet([headers, ...sampleRows]);
  ws['!cols'] = headers.map((h) => ({ wch: Math.max(h.length + 4, 16) }));
  XLSX.utils.book_append_sheet(wb, ws, 'Template');
  downloadWorkbook(wb, 'enrollment_curve_template.xlsx');
}
