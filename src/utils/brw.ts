export type BranchRiskRating = 'High' | 'Moderate' | 'Low';
export type AdjectivalRating =
  | 'Excellent'
  | 'Very Satisfactory'
  | 'Satisfactory'
  | 'Needs Improvement'
  | 'Unsatisfactory';

export interface WeightedRiskFactors {
  financialAssetExposure: number;
  priorAuditRatingFindings: number;
  timeElapsedSinceLastAudit: number;
  operationalFraudIncidents: number;
  staffTurnoverSystemChanges: number;
}

export function validateRiskScore(value: number): boolean {
  return Number.isFinite(value) && value >= 0 && value <= 10;
}

export function calculateWeightedRiskScore(factors: WeightedRiskFactors): number {
  const weights = {
    financialAssetExposure: 0.30,
    priorAuditRatingFindings: 0.25,
    timeElapsedSinceLastAudit: 0.20,
    operationalFraudIncidents: 0.15,
    staffTurnoverSystemChanges: 0.10,
  };

  for (const value of Object.values(factors)) {
    if (!validateRiskScore(value)) {
      throw new Error('Each weighted risk factor must be a numeric value from 0.00 to 10.00.');
    }
  }

  const weighted = Object.entries(factors).reduce(
    (total, [key, value]) => total + value * weights[key as keyof WeightedRiskFactors],
    0
  );
  return Math.min(10, Math.max(1, Number(weighted.toFixed(2))));
}

export function getBranchRiskRating(score: number): BranchRiskRating {
  if (!validateRiskScore(score)) throw new Error('Risk score must be from 0.00 to 10.00.');
  if (score >= 7) return 'High';
  if (score >= 4) return 'Moderate';
  return 'Low';
}

export function getAuditFrequencyMonths(score: number): 12 | 36 | 48 {
  const rating = getBranchRiskRating(score);
  if (rating === 'High') return 12;
  if (rating === 'Moderate') return 36;
  return 48;
}

export function getAdjectivalRating(scorePercent: number): AdjectivalRating {
  if (!Number.isFinite(scorePercent) || scorePercent < 0 || scorePercent > 100) {
    throw new Error('Engagement audit score must be between 0.00 and 100.00 percent.');
  }
  if (scorePercent >= 98) return 'Excellent';
  if (scorePercent >= 90) return 'Very Satisfactory';
  if (scorePercent >= 80) return 'Satisfactory';
  if (scorePercent >= 70) return 'Needs Improvement';
  return 'Unsatisfactory';
}

export type EngagementStatus =
  | 'Planned'
  | 'Scheduled'
  | 'In progress'
  | 'Reporting'
  | 'Closed'
  | 'Deferred'
  | 'Cancelled';

const ENGAGEMENT_TRANSITIONS: Record<EngagementStatus, EngagementStatus[]> = {
  Planned: ['Scheduled', 'Deferred', 'Cancelled'],
  Scheduled: ['In progress', 'Deferred', 'Cancelled'],
  'In progress': ['Reporting', 'Deferred'],
  Reporting: ['Closed'],
  Closed: [],
  Deferred: ['Scheduled', 'Cancelled'],
  Cancelled: [],
};

export function canTransitionEngagementStatus(from: EngagementStatus, to: EngagementStatus): boolean {
  return ENGAGEMENT_TRANSITIONS[from]?.includes(to) ?? false;
}

export function calculateEngagementMandays(
  planningDays: number,
  fieldworkDays: number,
  reportingDays: number,
  assignedAuditors: number,
  tlReviewDays: number
): number {
  const values = [planningDays, fieldworkDays, reportingDays, tlReviewDays];
  if (values.some((value) => !Number.isFinite(value) || value < 0)) {
    throw new Error('Manday values cannot be negative.');
  }
  if (!Number.isInteger(assignedAuditors) || assignedAuditors < 1) {
    throw new Error('Assigned auditors must be at least one.');
  }
  return (planningDays + fieldworkDays + reportingDays) * assignedAuditors + tlReviewDays;
}
