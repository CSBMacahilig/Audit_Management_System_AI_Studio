import { AuditDivisionRiskScale, AuditRiskLevel } from '../data/auditData';

export const DEFAULT_AUDIT_DIVISION_RISK_SCALES: AuditDivisionRiskScale[] = [
  {
    id: 'branch-assurance',
    name: 'Branch Assurance',
    highMinScore: 7,
    mediumMinScore: 4,
    highCycleMonths: 12,
    mediumCycleMonths: 36,
    lowCycleMonths: 48,
    highFieldworkWeeks: 5,
    mediumFieldworkWeeks: 4,
    lowFieldworkWeeks: 3,
  },
  {
    id: 'head-office-assurance',
    name: 'Head Office Assurance',
    highMinScore: 7,
    mediumMinScore: 4,
    highCycleMonths: 12,
    mediumCycleMonths: 36,
    lowCycleMonths: 48,
    highFieldworkWeeks: 5,
    mediumFieldworkWeeks: 4,
    lowFieldworkWeeks: 3,
  },
  {
    id: 'information-system-assurance',
    name: 'Information System Assurance',
    highMinScore: 7,
    mediumMinScore: 4,
    highCycleMonths: 12,
    mediumCycleMonths: 36,
    lowCycleMonths: 48,
    highFieldworkWeeks: 5,
    mediumFieldworkWeeks: 4,
    lowFieldworkWeeks: 3,
  },
  {
    id: 'audit-excellence-pre-implementation-reviews',
    name: 'Audit Excellence & Pre-Implementation Reviews',
    highMinScore: 7,
    mediumMinScore: 4,
    highCycleMonths: 12,
    mediumCycleMonths: 36,
    lowCycleMonths: 48,
    highFieldworkWeeks: 5,
    mediumFieldworkWeeks: 4,
    lowFieldworkWeeks: 3,
  },
  {
    id: 'data-analytics-investigations-special-audits',
    name: 'Data Analytics, Investigations and Special Audits',
    highMinScore: 7,
    mediumMinScore: 4,
    highCycleMonths: 12,
    mediumCycleMonths: 36,
    lowCycleMonths: 48,
    highFieldworkWeeks: 5,
    mediumFieldworkWeeks: 4,
    lowFieldworkWeeks: 3,
  },
];

export function getAuditRiskLevel(
  score: number,
  divisionId: string | undefined,
  scales: AuditDivisionRiskScale[]
): AuditRiskLevel {
  const scale = scales.find((item) => item.id === divisionId);
  const highMinimum = scale?.highMinScore ?? 7;
  const mediumMinimum = scale?.mediumMinScore ?? 4;
  if (score >= highMinimum) return 'High';
  if (score >= mediumMinimum) return 'Medium';
  return 'Low';
}

export function getAuditCycleMonths(
  riskLevel: AuditRiskLevel,
  divisionId: string | undefined,
  scales: AuditDivisionRiskScale[],
  fallback: { high: number; medium: number; low: number }
): number {
  const scale = scales.find((item) => item.id === divisionId);
  if (!scale) {
    if (riskLevel === 'High') return fallback.high;
    if (riskLevel === 'Medium') return fallback.medium;
    return fallback.low;
  }
  if (riskLevel === 'High') return scale.highCycleMonths;
  if (riskLevel === 'Medium') return scale.mediumCycleMonths;
  return scale.lowCycleMonths;
}

export function getAuditFieldworkWeeks(
  riskLevel: AuditRiskLevel,
  divisionId: string | undefined,
  scales: AuditDivisionRiskScale[]
): number {
  const scale = scales.find((item) => item.id === divisionId);
  if (!scale) {
    if (riskLevel === 'High') return 5;
    if (riskLevel === 'Medium') return 4;
    return 3;
  }
  if (riskLevel === 'High') return scale.highFieldworkWeeks;
  if (riskLevel === 'Medium') return scale.mediumFieldworkWeeks;
  return scale.lowFieldworkWeeks;
}
