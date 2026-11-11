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
  IssueRegisterItem,
  SizingConfig,
  TimelineActivity,
  UniverseEntity,
  UserProfile,
  WorkingNote,
} from '../data/auditData';

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
    ref: row.ref,
    year: row.year,
    title: row.title,
    category: row.category,
    department: row.department,
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
    durationDays: row.duration_days,
    budgetedHours: row.budgeted_hours,
    status: row.status,
    readyRatio: row.ready_ratio,
    lifecycleStage: row.lifecycle_stage,
    fieldworkPct: row.fieldwork_pct,
    fieldworkDayCurrent: row.fieldwork_day_current,
    fieldworkDayTotal: row.fieldwork_day_total,
    reportStatus: row.report_status,
    reportRef: row.report_ref,
    executiveSummary: row.executive_summary,
    ...subs,
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function rowToWorkingNote(row: any): WorkingNote {
  return {
    id: row.id,
    ref: row.ref,
    title: row.title,
    controlArea: row.control_area,
    author: row.author,
    status: row.status,
    hasException: row.has_exception,
    updatedAt: row.updated_at,
    testingProcedure: row.testing_procedure,
    conclusion: row.conclusion,
    reviewerComments: row.reviewer_comments ?? undefined,
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function rowToFinding(row: any): AuditFinding {
  return {
    id: row.id,
    ref: row.ref,
    title: row.title,
    severity: row.severity,
    condition: row.condition,
    criteria: row.criteria,
    cause: row.cause,
    effect: row.effect,
    recommendation: row.recommendation,
    owner: row.owner,
    targetDate: row.target_date,
    status: row.status,
    linkedNoteRef: row.linked_note_ref,
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function rowToTimeline(row: any): TimelineActivity {
  return {
    id: row.id,
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
    id: row.id,
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
    id: row.id,
    timestamp: row.timestamp,
    actor: row.actor,
    action: row.action,
    detail: row.detail ?? undefined,
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function rowToIssue(row: any): IssueRegisterItem {
  return {
    id: row.id,
    ref: row.ref,
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
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function rowToUniverse(row: any): UniverseEntity {
  return {
    id: row.id,
    code: row.code,
    name: row.name,
    division: row.division,
    category: row.category,
    likelihood: row.likelihood,
    impact: row.impact,
    riskScore: row.risk_score,
    riskLevel: row.risk_level,
    lastAudited: row.last_audited,
    nextDue: row.next_due,
    cycleMonths: row.cycle_months,
    defaultLead: row.default_lead,
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
    id: row.id,
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
  const [engRes, wnRes, fndRes, taRes, fileRes, logRes] = await Promise.all([
    supabase.from('engagements').select('*').order('ref'),
    supabase.from('working_notes').select('*').order('created_at'),
    supabase.from('findings').select('*').order('created_at'),
    supabase.from('timeline_activities').select('*').order('created_at'),
    supabase.from('engagement_files').select('*').order('created_at', { ascending: false }),
    supabase.from('activity_logs').select('*').order('created_at', { ascending: false }),
  ]);

  if (engRes.error) { console.error('fetchEngagements:', engRes.error.message); return []; }

  return (engRes.data ?? []).map((row) => {
    const id = row.id;
    return rowToEngagement(row, {
      workingNotes: (wnRes.data ?? []).filter((r) => r.engagement_id === id).map(rowToWorkingNote),
      findings: (fndRes.data ?? []).filter((r) => r.engagement_id === id).map(rowToFinding),
      timelineActivities: (taRes.data ?? []).filter((r) => r.engagement_id === id).map(rowToTimeline),
      files: (fileRes.data ?? []).filter((r) => r.engagement_id === id).map(rowToFile),
      activityLog: (logRes.data ?? []).filter((r) => r.engagement_id === id).map(rowToActivityLog),
    });
  });
}

export async function upsertEngagement(eng: AuditEngagement): Promise<void> {
  const { error } = await supabase.from('engagements').upsert({
    id: eng.id,
    ref: eng.ref,
    year: eng.year,
    title: eng.title,
    category: eng.category,
    department: eng.department,
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
    duration_days: eng.durationDays,
    budgeted_hours: eng.budgetedHours,
    status: eng.status,
    ready_ratio: eng.readyRatio,
    lifecycle_stage: eng.lifecycleStage,
    fieldwork_pct: eng.fieldworkPct,
    fieldwork_day_current: eng.fieldworkDayCurrent,
    fieldwork_day_total: eng.fieldworkDayTotal,
    report_status: eng.reportStatus,
    report_ref: eng.reportRef,
    executive_summary: eng.executiveSummary,
    updated_at: new Date().toISOString(),
  });
  if (error) console.error('upsertEngagement:', error.message);
}

export async function upsertWorkingNote(engagementId: string, note: WorkingNote): Promise<void> {
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
    conclusion: note.conclusion,
    reviewer_comments: note.reviewerComments ?? null,
  });
  if (error) console.error('upsertWorkingNote:', error.message);
}

export async function upsertFinding(engagementId: string, finding: AuditFinding): Promise<void> {
  const { error } = await supabase.from('findings').upsert({
    id: finding.id,
    engagement_id: engagementId,
    ref: finding.ref,
    title: finding.title,
    severity: finding.severity,
    condition: finding.condition,
    criteria: finding.criteria,
    cause: finding.cause,
    effect: finding.effect,
    recommendation: finding.recommendation,
    owner: finding.owner,
    target_date: finding.targetDate,
    status: finding.status,
    linked_note_ref: finding.linkedNoteRef,
  });
  if (error) console.error('upsertFinding:', error.message);
}

export async function upsertTimelineActivity(engagementId: string, activity: TimelineActivity): Promise<void> {
  const { error } = await supabase.from('timeline_activities').upsert({
    id: activity.id,
    engagement_id: engagementId,
    name: activity.name,
    role_responsible: activity.roleResponsible,
    due_date: activity.dueDate,
    completed_date: activity.completedDate ?? null,
    status: activity.status,
    stage_id: activity.stageId,
  });
  if (error) console.error('upsertTimelineActivity:', error.message);
}

export async function insertFile(engagementId: string, file: AuditFile): Promise<void> {
  const { error } = await supabase.from('engagement_files').insert({
    id: file.id,
    engagement_id: engagementId,
    name: file.name,
    folder: file.folder,
    size: file.size,
    uploaded_by: file.uploadedBy,
    uploaded_at: file.uploadedAt,
  });
  if (error) console.error('insertFile:', error.message);
}

export async function insertActivityLog(engagementId: string, log: ActivityLogItem): Promise<void> {
  const { error } = await supabase.from('activity_logs').insert({
    id: log.id,
    engagement_id: engagementId,
    timestamp: log.timestamp,
    actor: log.actor,
    action: log.action,
    detail: log.detail ?? null,
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

export async function upsertIssue(issue: IssueRegisterItem): Promise<void> {
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
    updated_at: new Date().toISOString(),
  });
  if (error) console.error('upsertIssue:', error.message);
}

// ─────────────────────────────────────────────────────────────────────────────
// Universe entities
// ─────────────────────────────────────────────────────────────────────────────

export async function fetchUniverse(): Promise<UniverseEntity[]> {
  const { data, error } = await supabase.from('universe_entities').select('*').order('code');
  if (error) { console.error('fetchUniverse:', error.message); return []; }
  return (data ?? []).map(rowToUniverse);
}

export async function upsertUniverseEntity(entity: UniverseEntity): Promise<void> {
  const { error } = await supabase.from('universe_entities').upsert({
    id: entity.id,
    code: entity.code,
    name: entity.name,
    division: entity.division,
    category: entity.category,
    likelihood: entity.likelihood,
    impact: entity.impact,
    risk_score: entity.riskScore,
    risk_level: entity.riskLevel,
    last_audited: entity.lastAudited,
    next_due: entity.nextDue,
    cycle_months: entity.cycleMonths,
    default_lead: entity.defaultLead,
    updated_at: new Date().toISOString(),
  });
  if (error) console.error('upsertUniverseEntity:', error.message);
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

export async function upsertUserProfile(u: UserProfile): Promise<void> {
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
    updated_at: new Date().toISOString(),
  });
  if (error) console.error('upsertUserProfile:', error.message);
}

export async function deleteUserProfile(id: string): Promise<void> {
  const { error } = await supabase.from('user_profiles').delete().eq('id', id);
  if (error) console.error('deleteUserProfile:', error.message);
}

// ─────────────────────────────────────────────────────────────────────────────
// Audit frequencies
// ─────────────────────────────────────────────────────────────────────────────

export interface AuditFrequencies { critical: number; high: number; medium: number; low: number; }

export async function fetchFrequencies(): Promise<AuditFrequencies> {
  const { data, error } = await supabase.from('audit_frequencies').select('*').eq('id', 'global').single();
  if (error || !data) return { critical: 6, high: 12, medium: 24, low: 36 };
  return { critical: data.critical, high: data.high, medium: data.medium, low: data.low };
}

export async function saveFrequencies(freq: AuditFrequencies): Promise<void> {
  const { error } = await supabase.from('audit_frequencies').upsert({
    id: 'global',
    ...freq,
    updated_at: new Date().toISOString(),
  });
  if (error) console.error('saveFrequencies:', error.message);
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
      updated_at: new Date().toISOString(),
    });
  } catch {
    // If table does not exist in Supabase, localStorage ensures it stays persistent
  }
}

export async function resetSystemToBaseline(): Promise<void> {
  try {
    const keysToRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (
        k &&
        (k.startsWith('ams_') ||
          k.startsWith('bssc_') ||
          k.includes('master_data') ||
          k.includes('access_users') ||
          k.includes('setup_checklist'))
      ) {
        keysToRemove.push(k);
      }
    }
    keysToRemove.forEach((k) => localStorage.removeItem(k));
  } catch (err) {
    console.warn('localStorage clean failed:', err);
  }

  try {
    await supabase.from('audit_frequencies').upsert({
      id: 'global',
      critical: 12,
      high: 12,
      medium: 24,
      low: 36,
      updated_at: new Date().toISOString(),
    });
  } catch {
    // ignore
  }
}
