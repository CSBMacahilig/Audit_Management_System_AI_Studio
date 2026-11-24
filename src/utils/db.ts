/**
 * db.ts — Supabase data layer for all audit app entities.
 *
 * Provides typed CRUD functions for:
 *  - engagements (with nested working notes, findings, timeline, files, activity log)
 *  - issues register
 *  - universe entities
 *  - sizing configs
 *  - user profiles
 *  - audit frequencies
 */

import { supabase } from './supabaseClient';

// Log the Supabase URL on load so we can confirm the right project is connected
console.log('[Supabase] connecting to: https://lpsxrwesflgkoosncyrc.supabase.co');
import type {
  AuditEngagement,
  AuditFinding,
  AuditFile,
  ActivityLogItem,
  AuditDivisionRiskScale,
  IssueRegisterItem,
  SizingConfig,
  TimelineActivity,
  UniverseEntity,
  UserProfile,
  WorkingNote,
} from '../data/auditData';
import {
  normalizeLegacyIdentifier,
  normalizeYearIdentifier,
} from './identifiers';
import { getCurrentAccountEmail } from './auditMetadata';
import { DEFAULT_AUDIT_DIVISION_RISK_SCALES } from './riskScale';

const USE_AMS_EDGE_API = import.meta.env.VITE_USE_AMS_EDGE_API === 'true';
const CUSTOM_DIVISION_MAP_KEY = 'custom_audit_division_assignments';

async function saveCustomDivisionAssignment(
  kind: 'engagement' | 'universe',
  recordId: string,
  divisionId?: string
): Promise<void> {
  const existing = await fetchMasterData<Record<string, string>>(CUSTOM_DIVISION_MAP_KEY, {});
  const key = `${kind}:${recordId}`;
  const next = { ...existing };
  if (divisionId) {
    if (next[key] === divisionId) return;
    next[key] = divisionId;
  } else {
    if (!(key in next)) return;
    delete next[key];
  }
  await saveMasterData(CUSTOM_DIVISION_MAP_KEY, next);
}

// ─────────────────────────────────────────────────────────────────────────────
// Row mappers
// ─────────────────────────────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function rowToEngagement(row: any, subs: {
  workingNotes: WorkingNote[];
  findings: AuditFinding[];
  timelineActivities: TimelineActivity[];
  files: AuditFile[];
  activityLog: ActivityLogItem[];
}): AuditEngagement {
  return {
    id: row.id,
    ref: normalizeYearIdentifier(row.ref, 'AE', row.year, 1),
    year: row.year,
    title: row.title,
    category: row.category,
    department: row.department,
    auditDivisionId: row.audit_division_id ?? undefined,
    entityName: row.entity_name,
    likelihood: row.likelihood,
    impact: row.impact,
    riskScore: row.risk_score,
    riskLevel: row.risk_level,
    lead: row.lead,
    headReviewer: row.head_reviewer,
    independentReviewer: row.independent_reviewer,
    startDate: row.start_date,
    endDate: row.end_date,
    objectives: row.objectives ?? '',
    scope: row.scope ?? '',
    criteria: row.criteria ?? '',
    addresseeName: row.addressee_name ?? '',
    addresseeTitle: row.addressee_title ?? '',
    copyFurnished: row.copy_furnished ?? '',
    durationDays: row.duration_days,
    budgetedHours: row.budgeted_hours,
    status: row.status,
    readyRatio: row.ready_ratio,
    lifecycleStage: row.lifecycle_stage,
    fieldworkPct: row.fieldwork_pct,
    fieldworkDayCurrent: row.fieldwork_day_current,
    fieldworkDayTotal: row.fieldwork_day_total,
    reportStatus: row.report_status,
    reportRating: row.report_rating ?? undefined,
    reportRef: row.report_ref,
    executiveSummary: row.executive_summary,
    addedBy: row.added_by ?? undefined,
    modifiedBy: row.modified_by ?? undefined,
    modifiedAt: row.modified_at ?? row.updated_at ?? undefined,
    ...subs,
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function rowToWorkingNote(row: any): WorkingNote {
  return {
    id: row.id,
    ref: normalizeLegacyIdentifier(row.ref, 'WP', 1),
    title: row.title,
    controlArea: row.control_area,
    author: row.author,
    status: row.status,
    hasException: row.has_exception,
    updatedAt: row.updated_at,
    testingProcedure: row.testing_procedure,
    observations: row.observations ?? '',
    conclusion: row.conclusion,
    reviewerComments: row.reviewer_comments ?? undefined,
    addedBy: row.added_by ?? undefined,
    modifiedBy: row.modified_by ?? undefined,
    modifiedAt: row.modified_at ?? undefined,
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function rowToFinding(row: any): AuditFinding {
  return {
    id: row.id,
    ref: normalizeLegacyIdentifier(row.ref, 'FN', 1),
    title: row.title,
    severity: row.severity,
    category: row.category ?? 'General',
    condition: row.condition,
    criteria: row.criteria,
    cause: row.cause,
    effect: row.effect,
    recommendation: row.recommendation,
    owner: row.owner,
    targetDate: row.target_date,
    status: row.status,
    linkedNoteRef: row.linked_note_ref,
    addedBy: row.added_by ?? undefined,
    modifiedBy: row.modified_by ?? undefined,
    modifiedAt: row.modified_at ?? undefined,
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function rowToTimeline(row: any): TimelineActivity {
  return {
    id: normalizeLegacyIdentifier(row.id, 'AL', 1),
    name: row.name,
    roleResponsible: row.role_responsible,
    dueDate: row.due_date,
    completedDate: row.completed_date ?? undefined,
    status: row.status,
    stageId: row.stage_id,
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function rowToFile(row: any): AuditFile {
  return {
    id: normalizeLegacyIdentifier(row.id, 'AF', 1),
    name: row.name,
    folder: row.folder,
    size: row.size,
    uploadedBy: row.uploaded_by,
    uploadedAt: row.uploaded_at,
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function rowToActivityLog(row: any): ActivityLogItem {
  return {
    id: normalizeLegacyIdentifier(row.id, 'AL', 1),
    timestamp: row.timestamp,
    actor: row.actor,
    action: row.action,
    detail: row.detail ?? undefined,
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function rowToIssue(row: any): IssueRegisterItem {
  return {
    id: normalizeLegacyIdentifier(row.id, 'IS', 1),
    ref: normalizeLegacyIdentifier(row.ref, 'IS', 1),
    title: row.title,
    auditRef: row.audit_ref,
    auditTitle: row.audit_title,
    severity: row.severity,
    owner: row.owner,
    ownerUnit: row.owner_unit,
    originalDue: row.original_due,
    currentDue: row.current_due,
    extensionCount: row.extension_count,
    daysStatus: row.days_status,
    isOverdue: row.is_overdue,
    isDueSoon: row.is_due_soon,
    status: row.status,
    actionPlanSummary: row.action_plan_summary,
    evidenceNote: row.evidence_note ?? undefined,
    extensionReason: row.extension_reason ?? undefined,
    addedBy: row.added_by ?? undefined,
    modifiedBy: row.modified_by ?? undefined,
    modifiedAt: row.modified_at ?? row.updated_at ?? undefined,
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function rowToUniverse(row: any): UniverseEntity {
  return {
    id: normalizeLegacyIdentifier(row.id, 'AU', 1),
    code: normalizeLegacyIdentifier(row.code, 'AU', 1),
    name: row.name,
    division: row.division,
    auditDivisionId: row.audit_division_id ?? undefined,
    category: row.category,
    likelihood: row.likelihood,
    impact: row.impact,
    riskScore: row.risk_score,
    riskLevel: row.risk_level,
    lastAudited: row.last_audited,
    nextDue: row.next_due,
    cycleMonths: row.cycle_months,
    defaultLead: row.default_lead,
    riskNotes: row.risk_notes ?? '',
    addedBy: row.added_by ?? undefined,
    modifiedBy: row.modified_by ?? undefined,
    modifiedAt: row.modified_at ?? row.updated_at ?? undefined,
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function rowToSizing(row: any): SizingConfig {
  return {
    id: row.id,
    sizeName: row.size_name,
    code: row.code,
    workingDays: row.working_days,
    calendarSpan: row.calendar_span,
    auditors: row.auditors,
    hoursPerDay: row.hours_per_day,
    budgetedHours: row.budgeted_hours,
    typicalUse: row.typical_use,
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function rowToUserProfile(row: any): UserProfile {
  return {
    id: normalizeLegacyIdentifier(row.id, 'IA', 1),
    name: row.name,
    roleTitle: row.role_title,
    fullLabel: row.full_label,
    headerSubtitle: row.header_subtitle,
    department: row.department,
    canApproveHead: row.can_approve_head,
    canApproveIndependent: row.can_approve_independent,
    canApproveCAE: row.can_approve_cae,
    employeeNumber: row.employee_number ?? undefined,
    lastLoginDate: row.last_login_date ?? undefined,
    accountModifiedAt: row.account_modified_at ?? undefined,
    accountStatus: row.account_status,
    failedLoginCount: row.failed_login_count,
    isLocked: row.is_locked,
    requiresPasswordChange: row.requires_password_change,
    passwordLastChanged: row.password_last_changed ?? undefined,
    passwordHistory: row.password_history ?? [],
    mfaEnabled: row.mfa_enabled,
    isPrivileged: row.is_privileged,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Engagements
// ─────────────────────────────────────────────────────────────────────────────

export async function fetchEngagements(): Promise<AuditEngagement[]> {
  const [engRes, wnRes, fndRes, taRes, fileRes, logRes, customDivisions] = await Promise.all([
    supabase.from('engagements').select('*').order('ref'),
    supabase.from('working_notes').select('*').order('created_at'),
    supabase.from('findings').select('*').order('created_at'),
    supabase.from('timeline_activities').select('*').order('created_at'),
    supabase.from('engagement_files').select('*').order('created_at', { ascending: false }),
    supabase.from('activity_logs').select('*').order('created_at', { ascending: false }),
    fetchMasterData<Record<string, string>>(CUSTOM_DIVISION_MAP_KEY, {}),
  ]);

  if (engRes.error) { console.error('fetchEngagements:', engRes.error.message); return []; }

  return (engRes.data ?? []).map((row) => {
    const id = row.id;
    const resolvedRow = !row.audit_division_id && customDivisions[`engagement:${id}`]
      ? { ...row, audit_division_id: customDivisions[`engagement:${id}`] }
      : row;
    return rowToEngagement(resolvedRow, {
      workingNotes: (wnRes.data ?? []).filter((r) => r.engagement_id === id).map(rowToWorkingNote),
      findings: (fndRes.data ?? []).filter((r) => r.engagement_id === id).map(rowToFinding),
      timelineActivities: (taRes.data ?? []).filter((r) => r.engagement_id === id).map(rowToTimeline),
      files: (fileRes.data ?? []).filter((r) => r.engagement_id === id).map(rowToFile),
      activityLog: (logRes.data ?? []).filter((r) => r.engagement_id === id).map(rowToActivityLog),
    });
  });
}

export async function upsertEngagement(eng: AuditEngagement): Promise<string | null> {
  const actor = getCurrentAccountEmail();
  const modifiedAt = new Date().toISOString();
  const payload = {
    id: eng.id,
    ref: eng.ref,
    year: eng.year,
    title: eng.title,
    category: eng.category,
    department: eng.department,
    audit_division_id: eng.auditDivisionId ?? null,
    entity_name: eng.entityName,
    likelihood: eng.likelihood,
    impact: eng.impact,
    risk_score: eng.riskScore,
    risk_level: eng.riskLevel,
    lead: eng.lead,
    head_reviewer: eng.headReviewer,
    independent_reviewer: eng.independentReviewer,
    start_date: eng.startDate,
    end_date: eng.endDate,
    objectives: eng.objectives ?? '',
    scope: eng.scope ?? '',
    criteria: eng.criteria ?? '',
    addressee_name: eng.addresseeName ?? '',
    addressee_title: eng.addresseeTitle ?? '',
    copy_furnished: eng.copyFurnished ?? '',
    duration_days: eng.durationDays,
    budgeted_hours: eng.budgetedHours,
    status: eng.status,
    ready_ratio: eng.readyRatio,
    lifecycle_stage: eng.lifecycleStage,
    fieldwork_pct: eng.fieldworkPct,
    fieldwork_day_current: eng.fieldworkDayCurrent,
    fieldwork_day_total: eng.fieldworkDayTotal,
    report_status: eng.reportStatus,
    report_rating: eng.reportRating ?? null,
    report_ref: eng.reportRef,
    executive_summary: eng.executiveSummary,
    added_by: eng.addedBy || actor,
    modified_by: actor,
    modified_at: modifiedAt,
    updated_at: new Date().toISOString(),
  };
  const { error } = await supabase.from('engagements').upsert(payload);
  if (error && (error.code === '23503' || error.message.includes('audit_division_id'))) {
    const { error: retryErr } = await supabase
      .from('engagements')
      .upsert({ ...payload, audit_division_id: null });
    if (retryErr) {
      console.error('upsertEngagement:', retryErr.message);
      return retryErr.message;
    }
    await saveCustomDivisionAssignment('engagement', eng.id, eng.auditDivisionId);
    return null;
  }
  if (error) {
    console.error('upsertEngagement:', error.message);
    return error.message;
  }
  await saveCustomDivisionAssignment('engagement', eng.id, undefined);
  return null;
}

export async function upsertWorkingNote(engagementId: string, note: WorkingNote): Promise<string | null> {
  const actor = getCurrentAccountEmail();
  const modifiedAt = new Date().toISOString();
  const { error } = await supabase.from('working_notes').upsert({
    id: note.id,
    engagement_id: engagementId,
    ref: note.ref,
    title: note.title,
    control_area: note.controlArea,
    author: note.author,
    status: note.status,
    has_exception: note.hasException,
    updated_at: note.updatedAt,
    testing_procedure: note.testingProcedure,
    observations: note.observations ?? '',
    conclusion: note.conclusion,
    reviewer_comments: note.reviewerComments ?? null,
    added_by: note.addedBy || actor,
    modified_by: actor,
    modified_at: modifiedAt,
  });
  if (error) {
    console.error('upsertWorkingNote:', error.message);
    return error.message;
  }
  return null;
}

export async function upsertFinding(engagementId: string, finding: AuditFinding): Promise<string | null> {
  const actor = getCurrentAccountEmail();
  const modifiedAt = new Date().toISOString();
  const { error } = await supabase.from('findings').upsert({
    id: finding.id,
    engagement_id: engagementId,
    ref: finding.ref,
    title: finding.title,
    severity: finding.severity,
    category: finding.category ?? 'General',
    condition: finding.condition,
    criteria: finding.criteria,
    cause: finding.cause,
    effect: finding.effect,
    recommendation: finding.recommendation,
    owner: finding.owner,
    target_date: finding.targetDate,
    status: finding.status,
    linked_note_ref: finding.linkedNoteRef,
    added_by: finding.addedBy || actor,
    modified_by: actor,
    modified_at: modifiedAt,
  });
  if (error) {
    console.error('upsertFinding:', error.message);
    return error.message;
  }
  return null;
}

export async function upsertTimelineActivity(engagementId: string, activity: TimelineActivity): Promise<void> {
  const actor = getCurrentAccountEmail();
  const modifiedAt = new Date().toISOString();
  const { error } = await supabase.from('timeline_activities').upsert({
    id: activity.id,
    engagement_id: engagementId,
    name: activity.name,
    role_responsible: activity.roleResponsible,
    due_date: activity.dueDate,
    completed_date: activity.completedDate ?? null,
    status: activity.status,
    stage_id: activity.stageId,
    added_by: actor,
    modified_by: actor,
    modified_at: modifiedAt,
  });
  if (error) console.error('upsertTimelineActivity:', error.message);
}

export async function insertFile(engagementId: string, file: AuditFile): Promise<void> {
  const actor = getCurrentAccountEmail();
  const modifiedAt = new Date().toISOString();
  const { error } = await supabase.from('engagement_files').insert({
    id: file.id,
    engagement_id: engagementId,
    name: file.name,
    folder: file.folder,
    size: file.size,
    uploaded_by: file.uploadedBy,
    uploaded_at: file.uploadedAt,
    added_by: file.uploadedBy || actor,
    modified_by: actor,
    modified_at: modifiedAt,
  });
  if (error) console.error('insertFile:', error.message);
}

export async function insertActivityLog(engagementId: string, log: ActivityLogItem): Promise<void> {
  const actor = getCurrentAccountEmail();
  const modifiedAt = new Date().toISOString();
  const { error } = await supabase.from('activity_logs').insert({
    id: log.id,
    engagement_id: engagementId,
    timestamp: log.timestamp,
    actor: log.actor,
    action: log.action,
    detail: log.detail ?? null,
    added_by: log.actor || actor,
    modified_by: actor,
    modified_at: modifiedAt,
  });
  if (error) console.error('insertActivityLog:', error.message);
}

// ─────────────────────────────────────────────────────────────────────────────
// Issues register
// ─────────────────────────────────────────────────────────────────────────────

export async function fetchIssues(): Promise<IssueRegisterItem[]> {
  const { data, error } = await supabase.from('issues_register').select('*').order('ref');
  if (error) { console.error('fetchIssues:', error.message); return []; }
  return (data ?? []).map(rowToIssue);
}

export async function upsertIssue(issue: IssueRegisterItem): Promise<string | null> {
  const actor = getCurrentAccountEmail();
  const modifiedAt = new Date().toISOString();
  const { error } = await supabase.from('issues_register').upsert({
    id: issue.id,
    ref: issue.ref,
    title: issue.title,
    audit_ref: issue.auditRef,
    audit_title: issue.auditTitle,
    severity: issue.severity,
    owner: issue.owner,
    owner_unit: issue.ownerUnit,
    original_due: issue.originalDue,
    current_due: issue.currentDue,
    extension_count: issue.extensionCount,
    days_status: issue.daysStatus,
    is_overdue: issue.isOverdue,
    is_due_soon: issue.isDueSoon,
    status: issue.status,
    action_plan_summary: issue.actionPlanSummary,
    evidence_note: issue.evidenceNote ?? null,
    extension_reason: issue.extensionReason ?? '',
    added_by: issue.addedBy || actor,
    modified_by: actor,
    modified_at: modifiedAt,
    updated_at: new Date().toISOString(),
  });
  if (error) {
    console.error('upsertIssue:', error.message);
    return error.message;
  }
  return null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Universe entities
// ─────────────────────────────────────────────────────────────────────────────

export async function fetchUniverse(): Promise<UniverseEntity[]> {
  const [{ data, error }, customDivisions] = await Promise.all([
    supabase.from('universe_entities').select('*').order('code'),
    fetchMasterData<Record<string, string>>(CUSTOM_DIVISION_MAP_KEY, {}),
  ]);
  if (error) { console.error('fetchUniverse:', error.message); return []; }
  return (data ?? []).map((row, index) => rowToUniverse({
    ...row,
    audit_division_id: row.audit_division_id ?? customDivisions[`universe:${row.id}`] ?? null,
    code: normalizeLegacyIdentifier(row.code, 'AU', index + 1),
  }));
}

export async function upsertUniverseEntity(entity: UniverseEntity): Promise<string | null> {
  const actor = getCurrentAccountEmail();
  const modifiedAt = new Date().toISOString();
  const payload = {
    id: entity.id,
    code: entity.code,
    name: entity.name,
    division: entity.division,
    audit_division_id: entity.auditDivisionId ?? null,
    category: entity.category,
    likelihood: entity.likelihood,
    impact: entity.impact,
    risk_score: entity.riskScore,
    risk_level: entity.riskLevel,
    last_audited: entity.lastAudited,
    next_due: entity.nextDue,
    cycle_months: entity.cycleMonths,
    default_lead: entity.defaultLead,
    risk_notes: entity.riskNotes ?? '',
    added_by: entity.addedBy || actor,
    modified_by: actor,
    modified_at: modifiedAt,
    updated_at: new Date().toISOString(),
  };
  const { error } = await supabase.from('universe_entities').upsert(payload);
  if (error && (error.code === '23503' || error.message.includes('audit_division_id'))) {
    const { error: retryErr } = await supabase
      .from('universe_entities')
      .upsert({ ...payload, audit_division_id: null });
    if (retryErr) {
      console.error('upsertUniverseEntity:', retryErr.message);
      return retryErr.message;
    }
    await saveCustomDivisionAssignment('universe', entity.id, entity.auditDivisionId);
    return null;
  }
  if (error) {
    console.error('upsertUniverseEntity:', error.message);
    return error.message;
  }
  await saveCustomDivisionAssignment('universe', entity.id, undefined);
  return null;
}

export async function deleteUniverseEntity(id: string): Promise<void> {
  const { error } = await supabase.from('universe_entities').delete().eq('id', id);
  if (error) console.error('deleteUniverseEntity:', error.message);
}

// ─────────────────────────────────────────────────────────────────────────────
// Sizing configs
// ─────────────────────────────────────────────────────────────────────────────

export async function fetchSizing(): Promise<SizingConfig[]> {
  const { data, error } = await supabase.from('sizing_configs').select('*').order('working_days');
  if (error) { console.error('fetchSizing:', error.message); return []; }
  return (data ?? []).map(rowToSizing);
}

export async function upsertSizingConfig(cfg: SizingConfig): Promise<void> {
  const { error } = await supabase.from('sizing_configs').upsert({
    id: cfg.id,
    size_name: cfg.sizeName,
    code: cfg.code,
    working_days: cfg.workingDays,
    calendar_span: cfg.calendarSpan,
    auditors: cfg.auditors,
    hours_per_day: cfg.hoursPerDay,
    budgeted_hours: cfg.budgetedHours,
    typical_use: cfg.typicalUse,
    updated_at: new Date().toISOString(),
  });
  if (error) console.error('upsertSizingConfig:', error.message);
}

export async function saveSizingConfigs(configs: SizingConfig[]): Promise<void> {
  for (const cfg of configs) {
    await upsertSizingConfig(cfg);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// User profiles
// ─────────────────────────────────────────────────────────────────────────────

export async function fetchUserProfiles(): Promise<UserProfile[]> {
  const { data, error } = await supabase.from('user_profiles').select('*').order('employee_number');
  if (error) { console.error('fetchUserProfiles:', error.message); return []; }
  return (data ?? []).map(rowToUserProfile);
}

export async function upsertUserProfile(u: UserProfile): Promise<string | null> {
  const actor = getCurrentAccountEmail();
  const modifiedAt = new Date().toISOString();
  const { error } = await supabase.from('user_profiles').upsert({
    id: u.id,
    name: u.name,
    role_title: u.roleTitle,
    full_label: u.fullLabel,
    header_subtitle: u.headerSubtitle,
    department: u.department,
    can_approve_head: u.canApproveHead,
    can_approve_independent: u.canApproveIndependent,
    can_approve_cae: u.canApproveCAE,
    employee_number: u.employeeNumber ?? null,
    last_login_date: u.lastLoginDate ?? null,
    account_modified_at: u.accountModifiedAt ?? null,
    account_status: u.accountStatus ?? 'Active',
    failed_login_count: u.failedLoginCount ?? 0,
    is_locked: u.isLocked ?? false,
    requires_password_change: u.requiresPasswordChange ?? false,
    password_last_changed: u.passwordLastChanged ?? null,
    password_history: u.passwordHistory ?? [],
    mfa_enabled: u.mfaEnabled ?? false,
    is_privileged: u.isPrivileged ?? false,
    added_by: actor,
    modified_by: actor,
    modified_at: modifiedAt,
    updated_at: new Date().toISOString(),
  });
  if (error) {
    console.error('upsertUserProfile:', error.message);
    return error.message;
  }
  return null;
}

export async function deleteUserProfile(id: string): Promise<string | null> {
  const { error } = await supabase.from('user_profiles').delete().eq('id', id);
  if (error) {
    console.error('deleteUserProfile:', error.message);
    return error.message;
  }
  return null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Audit frequencies
// ─────────────────────────────────────────────────────────────────────────────

export interface AuditFrequencies { high: number; medium: number; low: number; }

export async function fetchFrequencies(): Promise<AuditFrequencies> {
  const { data, error } = await supabase.from('audit_frequencies').select('*').eq('id', 'global').single();
  if (error || !data) return { high: 12, medium: 36, low: 48 };
  return { high: data.high, medium: data.medium, low: data.low };
}

export async function saveFrequencies(freq: AuditFrequencies): Promise<void> {
  const actor = getCurrentAccountEmail();
  const modifiedAt = new Date().toISOString();
  const { error } = await supabase.from('audit_frequencies').upsert({
    id: 'global',
    ...freq,
    added_by: actor,
    modified_by: actor,
    modified_at: modifiedAt,
    updated_at: new Date().toISOString(),
  });
  if (error) console.error('saveFrequencies:', error.message);
}

export async function fetchAuditDivisionRiskScales(): Promise<AuditDivisionRiskScale[]> {
  const savedScales = await fetchMasterData<AuditDivisionRiskScale[] | null>(
    'audit_division_risk_scales',
    null
  );
  if (Array.isArray(savedScales) && savedScales.length > 0) {
    return savedScales;
  }

  const { data, error } = await supabase
    .from('audit_division_risk_scales')
    .select('*')
    .order('name');
  if (error) {
    console.error('fetchAuditDivisionRiskScales:', error.message);
    return DEFAULT_AUDIT_DIVISION_RISK_SCALES;
  }
  if (!data || data.length === 0) return DEFAULT_AUDIT_DIVISION_RISK_SCALES;
  return data.map((row) => ({
    id: row.id,
    name: row.name,
    highMinScore: Number(row.high_min_score),
    mediumMinScore: Number(row.medium_min_score),
    highCycleMonths: row.high_cycle_months,
    mediumCycleMonths: row.medium_cycle_months,
    lowCycleMonths: row.low_cycle_months,
    highFieldworkWeeks: row.high_fieldwork_weeks,
    mediumFieldworkWeeks: row.medium_fieldwork_weeks,
    lowFieldworkWeeks: row.low_fieldwork_weeks,
    addedBy: row.added_by ?? undefined,
    modifiedBy: row.modified_by ?? undefined,
    modifiedAt: row.modified_at ?? undefined,
  }));
}

export async function saveAuditDivisionRiskScales(
  scales: AuditDivisionRiskScale[],
  sessionToken?: string
): Promise<void> {
  const actor = getCurrentAccountEmail();
  const now = new Date().toISOString();
  const enrichedScales = scales.map((scale) => ({
    ...scale,
    name: scale.name.trim(),
    addedBy: scale.addedBy || actor,
    modifiedBy: actor,
    modifiedAt: now,
  }));

  if (USE_AMS_EDGE_API && sessionToken) {
    const { data, error } = await supabase.functions.invoke<{
      success: boolean;
      error?: string;
    }>('ams-api', {
      body: { action: 'saveAuditDivisionRiskScales', scales: enrichedScales },
      headers: { Authorization: `Bearer ${sessionToken}` },
    });
    if (!error && data?.success) {
      await saveMasterData('audit_division_risk_scales', enrichedScales);
      return;
    }
    if (error && error.context instanceof Response) {
      const payload = await error.context.clone().json().catch(() => undefined);
      if (typeof payload?.error === 'string') {
        throw new Error(`Could not save audit division scales: ${payload.error}`);
      }
    }
    if (data && !data.success && data.error) {
      throw new Error(data.error);
    }
  }

  let localSaved = false;
  try {
    localStorage.setItem('ams_master_audit_division_risk_scales', JSON.stringify(enrichedScales));
    localSaved = true;
  } catch (err) {
    console.warn('localStorage save failed:', err);
  }

  const { error } = await supabase.from('master_data').upsert({
    id: 'audit_division_risk_scales',
    data: enrichedScales as any,
    added_by: actor,
    modified_by: actor,
    modified_at: now,
    updated_at: now,
  });

  if (error && !localSaved) {
    throw new Error(`Could not save audit division scales: ${error.message}`);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Master data & Setup checklist persistence
// ─────────────────────────────────────────────────────────────────────────────

export async function fetchMasterData<T>(key: string, fallback: T): Promise<T> {
  // 1. Try Supabase public.master_data
  try {
    const { data, error } = await supabase
      .from('master_data')
      .select('data')
      .eq('id', key)
      .single();
    if (!error && data?.data !== undefined && data?.data !== null) {
      try {
        localStorage.setItem(`ams_master_${key}`, JSON.stringify(data.data));
      } catch {
        // ignore
      }
      return data.data as T;
    }
  } catch {
    // ignore
  }

  // 2. Try localStorage
  try {
    const cached = localStorage.getItem(`ams_master_${key}`);
    if (cached) {
      return JSON.parse(cached) as T;
    }
  } catch {
    // ignore
  }

  return fallback;
}

export async function saveMasterData<T>(key: string, value: T): Promise<void> {
  const actor = getCurrentAccountEmail();
  const modifiedAt = new Date().toISOString();
  // 1. Immediately write to localStorage so reload NEVER loses data
  try {
    localStorage.setItem(`ams_master_${key}`, JSON.stringify(value));
  } catch (err) {
    console.warn('localStorage save failed:', err);
  }

  // 2. Try to sync to Supabase public.master_data
  try {
    await supabase.from('master_data').upsert({
      id: key,
      data: value as any,
      added_by: actor,
      modified_by: actor,
      modified_at: modifiedAt,
      updated_at: new Date().toISOString(),
    });
  } catch {
    // If table does not exist in Supabase, localStorage ensures it stays persistent
  }
}

export async function resetSystemToBaseline(): Promise<void> {
  const tables = [
    'working_notes',
    'findings',
    'timeline_activities',
    'engagement_files',
    'activity_logs',
    'engagements',
    'issues_register',
    'universe_entities',
    'sizing_configs',
    'audit_frequencies',
    'master_data',
  ] as const;

  for (const table of tables) {
    const records = supabase.from(table).delete();
    const { error } = table === 'master_data'
      ? await records.neq('id', 'app_roles')
      : await records.not('id', 'is', null);
    if (error) {
      throw new Error(`Could not reset ${table}: ${error.message}`);
    }
  }

  const keysToRemove: string[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key?.startsWith('ams_') || key?.startsWith('bssc_')) {
      keysToRemove.push(key);
    }
  }
  keysToRemove.forEach((key) => localStorage.removeItem(key));
}
