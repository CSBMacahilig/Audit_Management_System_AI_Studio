import type {
  AuditDivisionRiskScale,
  AuditEngagement,
  IssueRegisterItem,
  UniverseEntity,
  UserProfile,
} from '../data/auditData';

export const BULK_IMPORT_TARGETS = [
  { id: 'universe', label: 'Audit Universe' },
  { id: 'profiles', label: 'User and auditor profiles' },
  { id: 'annual_plan', label: 'Annual Plan engagements' },
  { id: 'working_notes', label: 'Working Notes' },
  { id: 'findings', label: 'Findings' },
  { id: 'issues', label: 'Issues register' },
] as const;

export type BulkImportTarget = (typeof BULK_IMPORT_TARGETS)[number]['id'];
export type BulkImportValues = Record<string, string>;

export interface BulkImportRow {
  line: number;
  values: BulkImportValues;
  errors: string[];
}

export interface BulkImportContext {
  universe: UniverseEntity[];
  engagements: AuditEngagement[];
  userProfiles: UserProfile[];
  issues: IssueRegisterItem[];
  riskScales: AuditDivisionRiskScale[];
}

const MAX_FILE_BYTES = 10 * 1024 * 1024;
const MAX_IMPORT_ROWS = 2000;

const TEMPLATE_COLUMNS: Record<BulkImportTarget, string[]> = {
  universe: [
    'code', 'name', 'division', 'entity_type', 'audit_division', 'likelihood',
    'impact', 'risk_score', 'last_audited', 'cycle_months', 'default_lead', 'risk_notes',
  ],
  profiles: [
    'employee_number', 'name', 'email', 'role_title', 'department', 'header_subtitle',
    'can_approve_head', 'can_approve_independent', 'can_approve_cae', 'username',
    'system_role', 'initial_password',
  ],
  annual_plan: [
    'ref', 'year', 'title', 'audit_type', 'entity_code', 'audit_division', 'likelihood',
    'impact', 'lead', 'head_reviewer', 'independent_reviewer', 'start_date', 'end_date',
    'objectives', 'scope', 'criteria', 'addressee_name', 'addressee_title',
    'copy_furnished', 'budgeted_hours', 'status', 'executive_summary',
  ],
  working_notes: [
    'audit_ref', 'ref', 'title', 'control_area', 'testing_procedure', 'observations',
    'conclusion', 'author', 'status',
  ],
  findings: [
    'audit_ref', 'ref', 'title', 'severity', 'category', 'condition', 'criteria',
    'cause', 'effect', 'recommendation', 'owner', 'target_date', 'linked_note_ref',
  ],
  issues: [
    'ref', 'audit_ref', 'title', 'severity', 'owner', 'owner_unit', 'original_due',
    'current_due', 'extension_count', 'status', 'action_plan_summary', 'evidence_note',
  ],
};

const REQUIRED_COLUMNS: Record<BulkImportTarget, string[]> = {
  universe: [
    'name', 'division', 'entity_type', 'audit_division', 'likelihood', 'impact',
    'last_audited', 'default_lead',
  ],
  profiles: ['employee_number', 'name', 'email', 'role_title', 'department'],
  annual_plan: [
    'title', 'audit_type', 'entity_code', 'audit_division', 'likelihood', 'impact',
    'lead', 'head_reviewer', 'start_date', 'end_date', 'objectives', 'scope',
    'criteria', 'addressee_name', 'addressee_title', 'budgeted_hours', 'status',
  ],
  working_notes: [
    'audit_ref', 'title', 'control_area', 'testing_procedure', 'observations', 'conclusion',
  ],
  findings: [
    'audit_ref', 'title', 'severity', 'category', 'condition', 'criteria', 'cause',
    'effect', 'recommendation', 'owner', 'target_date', 'linked_note_ref',
  ],
  issues: [
    'audit_ref', 'title', 'severity', 'owner', 'owner_unit', 'original_due',
    'action_plan_summary',
  ],
};

const SAMPLE_ROWS: Record<BulkImportTarget, string[]> = {
  universe: [
    'AU-0101', 'Sample Lending Process', 'Lending Operations', 'Process',
    'branch-assurance', '3', '4', '12', '2026-01-15', '12',
    'A. Villanueva', 'Risk rationale and key control considerations',
  ],
  profiles: [
    'EMP-101', 'J. Reyes', 'j.reyes@example.com', 'Assisting Auditor',
    'Internal Audit', 'Assisting Auditor', 'false', 'false', 'false', '', '', '',
  ],
  annual_plan: [
    'AE-2026-101', '2026', 'Sample Lending Audit', 'Operational audit', 'AU-0101',
    'branch-assurance', '3', '4', 'A. Villanueva', 'R. Dizon', 'Not needed',
    '2026-11-02', '2026-11-20', 'Assess the design and operating effectiveness of controls.',
    'Loan approval and disbursement activities for the selected period.',
    'Approved policies and applicable regulatory requirements.', 'J. Reyes',
    'Department Head', 'Audit Division Head', '120', 'Planned',
    'Review of lending operations and related controls.',
  ],
  working_notes: [
    'AE-2026-101', 'WP-0101', 'Sample approval testing', 'Credit approval',
    'Select a sample and compare approvals with delegated authority limits.',
    'One sampled approval exceeded the recorded delegation limit.',
    'Exception noted', 'A. Villanueva', 'Draft',
  ],
  findings: [
    'AE-2026-101', 'FN-0101', 'Approval limit override not documented', 'High',
    'Operations', 'A sampled loan approval exceeded the documented limit.',
    'Delegation of Authority Policy, section 4.', 'Approval workflow did not enforce limits.',
    'Unauthorized approvals may result in credit losses.',
    'Configure approval limits and review affected approvals.', 'J. Reyes',
    '2026-12-15', 'WP-0101',
  ],
  issues: [
    'IS-0101', 'AE-2026-101', 'Approval limit override not documented', 'High',
    'J. Reyes', 'Lending Operations', '2026-12-15', '2026-12-15', '0',
    'Open', 'Configure approval limits and review affected approvals.',
    'Evidence location or supporting document reference',
  ],
};

const REQUIRED_VALUES: Record<BulkImportTarget, string[]> = {
  universe: REQUIRED_COLUMNS.universe,
  profiles: REQUIRED_COLUMNS.profiles,
  annual_plan: REQUIRED_COLUMNS.annual_plan,
  working_notes: REQUIRED_COLUMNS.working_notes,
  findings: REQUIRED_COLUMNS.findings,
  issues: REQUIRED_COLUMNS.issues,
};

export function getBulkImportTemplate(target: BulkImportTarget): string {
  const columns = TEMPLATE_COLUMNS[target];
  const sample = SAMPLE_ROWS[target];
  return `\uFEFF${columns.join(',')}\r\n${sample.map(escapeCsvValue).join(',')}\r\n`;
}

function escapeCsvValue(value: string): string {
  return /[",\r\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let inQuotes = false;

  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];
    if (inQuotes) {
      if (character === '"' && text[index + 1] === '"') {
        cell += '"';
        index += 1;
      } else if (character === '"') {
        inQuotes = false;
      } else {
        cell += character;
      }
      continue;
    }

    if (character === '"' && cell.length === 0) {
      inQuotes = true;
    } else if (character === ',') {
      row.push(cell);
      cell = '';
    } else if (character === '\n' || character === '\r') {
      if (character === '\r' && text[index + 1] === '\n') index += 1;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = '';
    } else {
      cell += character;
    }
  }

  if (inQuotes) throw new Error('The CSV file contains an unclosed quoted field.');
  if (cell.length > 0 || row.length > 0) {
    row.push(cell);
    rows.push(row);
  }
  return rows;
}

function normalizeHeader(value: string): string {
  return value.trim().replace(/^\uFEFF/, '').toLowerCase().replace(/[\s-]+/g, '_');
}

function cellToString(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value.toISOString().slice(0, 10);
  }
  return String(value).trim();
}

export async function readBulkImportFile(
  file: File,
  target: BulkImportTarget
): Promise<BulkImportRow[]> {
  if (file.size > MAX_FILE_BYTES) {
    throw new Error('File is larger than the 10 MB import limit.');
  }

  const extension = file.name.toLowerCase().split('.').pop();
  let matrix: unknown[][];
  if (extension === 'csv') {
    matrix = parseCsv(await file.text());
  } else if (extension === 'xlsx') {
    const { readSheet } = await import('read-excel-file/browser');
    const sheet = await readSheet(file, 1);
    matrix = sheet;
  } else {
    throw new Error('Choose a .csv or .xlsx file.');
  }

  if (matrix.length === 0) throw new Error('The selected file is empty.');
  const headers = matrix[0].map((cell) => normalizeHeader(cellToString(cell)));
  if (headers.some((header) => !header)) throw new Error('The header row contains an empty column name.');
  if (new Set(headers).size !== headers.length) throw new Error('The header row contains duplicate column names.');

  const missingColumns = REQUIRED_COLUMNS[target].filter((column) => !headers.includes(column));
  if (missingColumns.length > 0) {
    throw new Error(`Missing required columns: ${missingColumns.join(', ')}.`);
  }

  const nonEmptyRows = matrix.slice(1).filter((cells) =>
    cells.some((cell) => cellToString(cell) !== '')
  );
  if (nonEmptyRows.length > MAX_IMPORT_ROWS) {
    throw new Error(`Import is limited to ${MAX_IMPORT_ROWS.toLocaleString()} rows per file.`);
  }

  return nonEmptyRows.map((cells, index) => {
    const values: BulkImportValues = {};
    headers.forEach((header, columnIndex) => {
      values[header] = cellToString(cells[columnIndex]);
    });
    return { line: index + 2, values, errors: [] };
  });
}

export function normalizeImportDate(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const isoMatch = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (isoMatch) {
    const date = new Date(`${trimmed}T00:00:00.000Z`);
    return Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== trimmed
      ? null
      : trimmed;
  }
  const parsed = new Date(trimmed);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString().slice(0, 10);
}

function parseNumber(value: string): number | null {
  if (!value.trim()) return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function findScale(value: string, context: BulkImportContext): AuditDivisionRiskScale | undefined {
  const normalized = value.trim().toLowerCase();
  return context.riskScales.find(
    (scale) => scale.id.toLowerCase() === normalized || scale.name.toLowerCase() === normalized
  );
}

function findEngagement(value: string, context: BulkImportContext): AuditEngagement | undefined {
  const normalized = value.trim().toLowerCase();
  return context.engagements.find(
    (engagement) => engagement.ref.toLowerCase() === normalized || engagement.id.toLowerCase() === normalized
  );
}

function addError(row: BulkImportRow, message: string): void {
  row.errors.push(message);
}

function validateDate(row: BulkImportRow, key: string, label: string, required: boolean): string | null {
  const value = row.values[key] ?? '';
  if (!value.trim() && !required) return null;
  const date = normalizeImportDate(value);
  if (!date) addError(row, `${label} must be a valid date (use YYYY-MM-DD).`);
  return date;
}

export function validateBulkImportRows(
  target: BulkImportTarget,
  sourceRows: BulkImportRow[],
  context: BulkImportContext
): BulkImportRow[] {
  const rows = sourceRows.map((row) => ({ ...row, errors: [...row.errors] }));
  const fileKeys = new Set<string>();

  for (const row of rows) {
    for (const column of REQUIRED_VALUES[target]) {
      if (!row.values[column]?.trim()) addError(row, `${column} is required.`);
    }

    const values = row.values;
    if (target === 'universe') {
      if (values.code?.trim() && !/^AU-\d{3,}$/i.test(values.code.trim())) {
        addError(row, 'code must use the AU-#### format.');
      }
      const likelihood = parseNumber(values.likelihood ?? '');
      const impact = parseNumber(values.impact ?? '');
      const score = parseNumber(values.risk_score ?? '');
      const cycle = parseNumber(values.cycle_months ?? '');
      if (likelihood === null || !Number.isInteger(likelihood) || likelihood < 1 || likelihood > 5) {
        addError(row, 'likelihood must be an integer from 1 to 5.');
      }
      if (impact === null || !Number.isInteger(impact) || impact < 1 || impact > 5) {
        addError(row, 'impact must be an integer from 1 to 5.');
      }
      if (values.risk_score?.trim() && (score === null || !Number.isInteger(score) || score < 1 || score > 25)) {
        addError(row, 'risk_score must be an integer from 1 to 25.');
      }
      if (values.cycle_months?.trim() && (cycle === null || !Number.isInteger(cycle) || cycle < 1 || cycle > 60)) {
        addError(row, 'cycle_months must be an integer from 1 to 60.');
      }
      if (!findScale(values.audit_division ?? '', context)) {
        addError(row, 'audit_division must match a configured audit division name or ID.');
      }
      validateDate(row, 'last_audited', 'last_audited', true);
    }

    if (target === 'profiles') {
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.email ?? '')) {
        addError(row, 'email must be a valid email address.');
      }
      for (const key of ['can_approve_head', 'can_approve_independent', 'can_approve_cae']) {
        const value = values[key]?.trim().toLowerCase();
        if (value && !['true', 'false', 'yes', 'no', '1', '0'].includes(value)) {
          addError(row, `${key} must be true or false.`);
        }
      }
      const username = values.username?.trim() ?? '';
      const systemRole = values.system_role?.trim().toLowerCase() ?? '';
      const password = values.initial_password ?? '';
      const hasAnyLoginField = Boolean(username || systemRole || password);
      if (hasAnyLoginField && (!username || !systemRole || !password)) {
        addError(row, 'To create a login, provide username, system_role, and initial_password together.');
      }
      if (username && !/^[a-z0-9._-]{3,64}$/i.test(username)) {
        addError(row, 'username must be 3–64 letters, numbers, dots, underscores, or hyphens.');
      }
      if (systemRole && systemRole !== 'user') {
        addError(row, 'Bulk import can create standard user accounts only; create admin accounts separately.');
      }
      if (password && password.length < 8) {
        addError(row, 'initial_password must be at least 8 characters.');
      }
    }

    if (target === 'annual_plan') {
      if (values.ref?.trim() && !/^AE-\d{4}-\d{3,}$/i.test(values.ref.trim())) {
        addError(row, 'ref must use the AE-YYYY-### format.');
      }
      const likelihood = parseNumber(values.likelihood ?? '');
      const impact = parseNumber(values.impact ?? '');
      const budget = parseNumber(values.budgeted_hours ?? '');
      const year = parseNumber(values.year ?? '');
      if (likelihood === null || !Number.isInteger(likelihood) || likelihood < 1 || likelihood > 5) {
        addError(row, 'likelihood must be an integer from 1 to 5.');
      }
      if (impact === null || !Number.isInteger(impact) || impact < 1 || impact > 5) {
        addError(row, 'impact must be an integer from 1 to 5.');
      }
      if (budget === null || !Number.isInteger(budget) || budget <= 0) {
        addError(row, 'budgeted_hours must be a positive whole number.');
      }
      if (values.year?.trim() && (year === null || !Number.isInteger(year) || year < 2000 || year > 2200)) {
        addError(row, 'year must be a four-digit year.');
      }
      const start = validateDate(row, 'start_date', 'start_date', true);
      const end = validateDate(row, 'end_date', 'end_date', true);
      if (start && end && end < start) addError(row, 'end_date must be on or after start_date.');
      if (!context.universe.some((entity) =>
        entity.code.toLowerCase() === (values.entity_code ?? '').trim().toLowerCase()
      )) {
        addError(row, 'entity_code must match an existing Audit Universe code.');
      }
      if (!findScale(values.audit_division ?? '', context)) {
        addError(row, 'audit_division must match a configured audit division name or ID.');
      }
      if (!context.userProfiles.some((profile) => profile.name.toLowerCase() === (values.lead ?? '').trim().toLowerCase())) {
        addError(row, 'lead must match an existing user profile name.');
      }
      if (!context.userProfiles.some((profile) =>
        profile.name.toLowerCase() === (values.head_reviewer ?? '').trim().toLowerCase() && profile.canApproveHead
      )) {
        addError(row, 'head_reviewer must match a profile authorized for head review.');
      }
      const independentReviewer = (values.independent_reviewer ?? '').trim();
      if (independentReviewer && independentReviewer.toLowerCase() !== 'not needed' &&
        !context.userProfiles.some((profile) =>
          profile.name.toLowerCase() === independentReviewer.toLowerCase() && profile.canApproveIndependent
        )) {
        addError(row, 'independent_reviewer must match a profile authorized for independent review, or be Not needed.');
      }
    }

    if (target === 'working_notes') {
      if (values.ref?.trim() && !/^WP-\d{3,}$/i.test(values.ref.trim())) {
        addError(row, 'ref must use the WP-### format.');
      }
      if (!findEngagement(values.audit_ref ?? '', context)) {
        addError(row, 'audit_ref must match an existing engagement reference.');
      }
      if (!['Not concluded', 'Satisfactory', 'Exception noted'].includes(values.conclusion ?? '')) {
        addError(row, 'conclusion must be Not concluded, Satisfactory, or Exception noted.');
      }
      if (values.status?.trim() &&
        !['Draft', 'For head review', 'For independent review', 'Cleared', 'Returned'].includes(values.status)) {
        addError(row, 'status is not a supported Working Note status.');
      }
    }

    if (target === 'findings') {
      if (values.ref?.trim() && !/^FN-\d{3,}$/i.test(values.ref.trim())) {
        addError(row, 'ref must use the FN-### format.');
      }
      const engagement = findEngagement(values.audit_ref ?? '', context);
      if (!engagement) {
        addError(row, 'audit_ref must match an existing engagement reference.');
      } else if (!engagement.workingNotes.some((note) =>
        note.ref.toLowerCase() === (values.linked_note_ref ?? '').trim().toLowerCase()
      )) {
        addError(row, 'linked_note_ref must match a Working Note in the selected engagement.');
      }
      if (!['Critical', 'High', 'Medium', 'Low'].includes(values.severity ?? '')) {
        addError(row, 'severity must be Critical, High, Medium, or Low.');
      }
      validateDate(row, 'target_date', 'target_date', true);
    }

    if (target === 'issues') {
      if (values.ref?.trim() && !/^IS-\d{3,}$/i.test(values.ref.trim())) {
        addError(row, 'ref must use the IS-### format.');
      }
      const engagement = findEngagement(values.audit_ref ?? '', context);
      if (!engagement) addError(row, 'audit_ref must match an existing engagement reference.');
      const originalDue = validateDate(row, 'original_due', 'original_due', true);
      const currentDue = validateDate(row, 'current_due', 'current_due', false) ?? originalDue;
      if (originalDue && currentDue && currentDue < originalDue) {
        addError(row, 'current_due must be on or after original_due.');
      }
      const extensionCount = parseNumber(values.extension_count ?? '');
      if (values.extension_count?.trim() &&
        (extensionCount === null || !Number.isInteger(extensionCount) || extensionCount < 0)) {
        addError(row, 'extension_count must be a non-negative whole number.');
      }
      if (!['Critical', 'High', 'Medium', 'Low'].includes(values.severity ?? '')) {
        addError(row, 'severity must be Critical, High, Medium, or Low.');
      }
      if (values.status?.trim() &&
        !['Overdue', 'In progress', 'Open', 'Extension requested', 'For validation', 'Closed'].includes(values.status)) {
        addError(row, 'status is not a supported Issues Register status.');
      }
    }

    const keys = uniqueKeys(target, values, context);
    for (const key of keys) {
      if (fileKeys.has(key)) {
        addError(row, 'This row duplicates an earlier row in the same file.');
        break;
      }
    }
    keys.forEach((key) => fileKeys.add(key));
    if (matchesExisting(target, values, context)) {
      addError(row, 'A matching record already exists; bulk import does not overwrite existing records.');
    }
  }

  return rows;
}

function uniqueKeys(
  target: BulkImportTarget,
  values: BulkImportValues,
  context: BulkImportContext
): string[] {
  switch (target) {
    case 'universe':
      return [
        values.name?.trim() ? `name:${values.name.trim().toLowerCase()}` : '',
        values.code?.trim() ? `code:${values.code.trim().toLowerCase()}` : '',
      ].filter(Boolean);
    case 'profiles':
      return [
        values.employee_number?.trim() ? `employee:${values.employee_number.trim().toLowerCase()}` : '',
        values.email?.trim() ? `email:${values.email.trim().toLowerCase()}` : '',
        values.username?.trim() ? `username:${values.username.trim().toLowerCase()}` : '',
      ].filter(Boolean);
    case 'annual_plan': {
      const title = values.title?.trim().toLowerCase();
      const year = values.year?.trim() || normalizeImportDate(values.start_date ?? '')?.slice(0, 4) || 'current';
      return [
        title ? `plan:${year}:${title}` : '',
        values.ref?.trim() ? `ref:${values.ref.trim().toLowerCase()}` : '',
      ].filter(Boolean);
    }
    case 'working_notes':
    case 'findings': {
      const title = values.title?.trim().toLowerCase();
      const prefix = target === 'working_notes' ? 'note' : 'finding';
      const engagementRef = findEngagement(values.audit_ref ?? '', context)?.ref ??
        values.audit_ref?.trim().toLowerCase();
      return [
        values.ref?.trim() ? `ref:${values.ref.trim().toLowerCase()}` : '',
        title ? `${prefix}:${engagementRef}:${title}` : '',
      ].filter(Boolean);
    }
    case 'issues': {
      const title = values.title?.trim().toLowerCase();
      const engagementRef = findEngagement(values.audit_ref ?? '', context)?.ref ??
        values.audit_ref?.trim().toLowerCase();
      return [
        title ? `issue:${engagementRef}:${title}` : '',
        values.ref?.trim() ? `ref:${values.ref.trim().toLowerCase()}` : '',
      ].filter(Boolean);
    }
  }
}

function matchesExisting(
  target: BulkImportTarget,
  values: BulkImportValues,
  context: BulkImportContext
): boolean {
  switch (target) {
    case 'universe':
      return context.universe.some((entity) =>
        entity.name.toLowerCase() === (values.name ?? '').trim().toLowerCase() ||
        Boolean(values.code && entity.code.toLowerCase() === values.code.trim().toLowerCase())
      );
    case 'profiles':
      return context.userProfiles.some((profile) =>
        Boolean(profile.employeeNumber && profile.employeeNumber.toLowerCase() === (values.employee_number ?? '').trim().toLowerCase()) ||
        Boolean(profile.email && profile.email.toLowerCase() === (values.email ?? '').trim().toLowerCase())
      );
    case 'annual_plan': {
      const year = values.year?.trim();
      return context.engagements.some((engagement) =>
        Boolean(values.ref && engagement.ref.toLowerCase() === values.ref.trim().toLowerCase()) ||
        ((year ? String(engagement.year) === year : true) &&
          engagement.title.toLowerCase() === (values.title ?? '').trim().toLowerCase())
      );
    }
    case 'working_notes': {
      const engagement = findEngagement(values.audit_ref ?? '', context);
      return Boolean(engagement?.workingNotes.some((note) =>
        values.ref?.trim()
          ? note.ref.toLowerCase() === values.ref.trim().toLowerCase()
          : note.title.toLowerCase() === (values.title ?? '').trim().toLowerCase()
      ));
    }
    case 'findings': {
      const engagement = findEngagement(values.audit_ref ?? '', context);
      return Boolean(engagement?.findings.some((finding) =>
        values.ref?.trim()
          ? finding.ref.toLowerCase() === values.ref.trim().toLowerCase()
          : finding.title.toLowerCase() === (values.title ?? '').trim().toLowerCase()
      ));
    }
    case 'issues':
      return context.issues.some((issue) => {
        const engagement = findEngagement(values.audit_ref ?? '', context);
        const ref = engagement?.ref ?? (values.audit_ref ?? '').trim();
        return (values.ref?.trim() && issue.ref.toLowerCase() === values.ref.trim().toLowerCase()) ||
        (issue.auditRef.toLowerCase() === ref.toLowerCase() &&
        issue.title.toLowerCase() === (values.title ?? '').trim().toLowerCase()
        );
      });
  }
}

export function getBulkImportColumns(target: BulkImportTarget): string[] {
  return [...TEMPLATE_COLUMNS[target]];
}

export function getBulkImportSampleRow(target: BulkImportTarget): string[] {
  return [...SAMPLE_ROWS[target]];
}

export function getBulkImportTargetLabel(target: BulkImportTarget): string {
  return BULK_IMPORT_TARGETS.find((item) => item.id === target)?.label ?? target;
}

export function parseImportBoolean(value: string): boolean {
  return ['true', 'yes', '1'].includes(value.trim().toLowerCase());
}
