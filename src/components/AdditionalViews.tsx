import React, { useState, useEffect } from 'react';
import { fetchMasterData, saveMasterData } from '../utils/db';
import {
  AuditEngagement,
  IssueRegisterItem,
  LifecycleStageId,
  MainTabId,
  AuditRiskLevel,
  RiskLevel,
  UniverseEntity,
  UniverseRecord,
  UserProfile,
} from '../data/auditData';
import {
  safeParseBackupJson,
  sanitizeText,
  exportAccessListCsv,
  downloadCsv,
  processFailedLogin,
  unlockAccount,
  getPasswordExpiryState,
  validatePasswordStrength,
  generateTemporaryPassword,
  scorePasswordStrength,
  PASSWORD_STRENGTH_LABELS,
  PASSWORD_STRENGTH_COLORS,
  isUsernameTaken,
  genericAuthError,
  AccessListRow,
} from '../utils/security';
import { createOrSyncSystemUser } from '../utils/authStore';
import { formatDateForDisplay, toDateInputValue } from '../utils/date';
import {
  APP_ROLES,
  AppRole,
  AppRoleDefinition,
  DEFAULT_ROLE_DEFINITIONS,
  normalizeRole,
} from '../utils/rbac';

// 1. OVERVIEW VIEW
export const OverviewView: React.FC<{
  engagements: AuditEngagement[];
  universe?: UniverseEntity[];
  issues?: IssueRegisterItem[];
  onSelectLifecycleStage: (stageId: LifecycleStageId) => void;
  onOpenEngagement: (eng: AuditEngagement) => void;
  onSelectTab: (tab: MainTabId) => void;
}> = ({ onOpenEngagement, onSelectTab, onSelectLifecycleStage, engagements, universe = [], issues = [] }) => {
  const getRiskLevel = (score: number): AuditRiskLevel => {
    if (score >= 15) return 'High';
    if (score >= 8) return 'Medium';
    return 'Low';
  };

  // Dynamic heat map cells
  const heatMapCells: {
    l: number;
    i: number;
    count: number;
    level: AuditRiskLevel;
  }[][] = [5, 4, 3, 2, 1].map((l) =>
    [1, 2, 3, 4, 5].map((i) => {
      const count = universe.filter((u) => u.likelihood === l && u.impact === i).length;
      return {
        l,
        i,
        count,
        level: getRiskLevel(l * i),
      };
    })
  );

  const getCellStyle = (level: AuditRiskLevel, count: number) => {
    switch (level) {
      case 'High':
        return count > 0
          ? 'bg-[#D97724] text-white'
          : 'bg-[#FDF3EA] text-slate-400 border border-[#D97724]/20';
      case 'Medium':
        return count > 0
          ? 'bg-[#C99E2C] text-white'
          : 'bg-[#FAF6EC] text-slate-400 border border-[#C99E2C]/20';
      case 'Low':
        return count > 0
          ? 'bg-[#519E66] text-white'
          : 'bg-[#EFF7F2] text-slate-400 border border-[#519E66]/20';
    }
  };

  const highUniverseCount = universe.filter((u) => u.riskLevel === 'High').length;
  const mediumUniverseCount = universe.filter((u) => u.riskLevel === 'Medium').length;
  const lowUniverseCount = universe.filter((u) => u.riskLevel === 'Low').length;

  const closedEngagementsCount = engagements.filter((e) => e.status === 'Closed').length;
  const activeEngagementsCount = engagements.filter(
    (e) => e.status === 'In progress' || e.status === 'Reporting'
  ).length;
  const plannedEngagementsCount = engagements.filter(
    (e) => e.status === 'Planned' || e.status === 'Scheduled'
  ).length;
  const planProgressPct =
    engagements.length > 0 ? Math.round((closedEngagementsCount / engagements.length) * 100) : 0;

  const openIssues = issues.filter((i) => i.status !== 'Closed');
  const overdueIssues = issues.filter((i) => i.isOverdue && i.status !== 'Closed');
  const dueSoonIssues = issues.filter((i) => i.isDueSoon && i.status !== 'Closed');

  const reauditWatchlist = universe
    .filter((u) => u.nextDue && u.nextDue.toLowerCase().includes('overdue'))
    .slice(0, 5)
    .map((u) => ({
      name: u.name,
      risk: u.riskLevel,
      dueText: `Due: ${u.nextDue || 'Pending'}`,
    }));

  const overdueReauditCount = universe.filter(
    (u) => u.nextDue && u.nextDue.toLowerCase().includes('overdue')
  ).length;

  const overdueRemediation = overdueIssues.slice(0, 5).map((iss) => ({
    ref: iss.ref,
    title: iss.title,
    severity: iss.severity,
    meta: `${iss.owner} · Overdue`,
  }));

  const activeAndUpcoming = engagements
    .filter((e) => e.status === 'In progress' || e.status === 'Reporting' || e.status === 'Scheduled')
    .slice(0, 5);

  return (
    <div className="space-y-4">
      {/* Top 4 KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
        {/* Card 1: AUDIT UNIVERSE */}
        <div
          onClick={() => {
            onSelectLifecycleStage(1);
            onSelectTab('universe');
          }}
          className="bg-white rounded-lg border border-slate-200/90 p-5 shadow-2xs cursor-pointer hover:border-[#542D84]/50 transition-colors"
        >
          <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
            AUDIT UNIVERSE
          </div>
          <div className="text-[30px] font-bold text-slate-900 font-mono-tabular leading-tight mt-1">
            {universe.length}
          </div>
          <div className="flex flex-wrap items-center gap-1.5 text-xs text-slate-600 mt-2.5 tabular-nums">
            <span className="px-1.5 py-0.5 rounded bg-[#D97724] text-white font-bold text-[11px]">
              {highUniverseCount}
            </span>
            <span>High</span>
            <span className="px-1.5 py-0.5 rounded bg-[#C99E2C] text-white font-bold text-[11px] ml-1">
              {mediumUniverseCount}
            </span>
            <span>Medium</span>
            <span className="px-1.5 py-0.5 rounded bg-[#519E66] text-white font-bold text-[11px] ml-1">
              {lowUniverseCount}
            </span>
            <span>Low</span>
          </div>
        </div>

        {/* Card 2: PLAN PROGRESS */}
        <div
          onClick={() => {
            onSelectLifecycleStage(1);
            onSelectTab('annual-plan');
          }}
          className="bg-white rounded-lg border border-slate-200/90 p-5 shadow-2xs cursor-pointer hover:border-[#542D84]/50 transition-colors"
        >
          <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
            ANNUAL PLAN PROGRESS
          </div>
          <div className="text-[30px] font-bold text-slate-900 font-mono-tabular leading-tight mt-1">
            {closedEngagementsCount}/{engagements.length}
          </div>
          <div className="w-full h-1.5 bg-slate-200 rounded-full overflow-hidden mt-3">
            <div className="h-full bg-[#492785] rounded-full" style={{ width: `${planProgressPct}%` }} />
          </div>
          <div className="text-xs text-slate-500 mt-2 tabular-nums">
            {activeEngagementsCount} active · {plannedEngagementsCount} planned
          </div>
        </div>

        {/* Card 3: OPEN ISSUES */}
        <div
          onClick={() => {
            onSelectLifecycleStage(5);
            onSelectTab('issues');
          }}
          className="bg-white rounded-lg border border-slate-200/90 p-5 shadow-2xs cursor-pointer hover:border-[#542D84]/50 transition-colors"
        >
          <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
            OPEN ISSUES
          </div>
          <div className="text-[30px] font-bold text-slate-900 font-mono-tabular leading-tight mt-1">
            {openIssues.length}
          </div>
          <div className="text-xs text-slate-600 mt-2.5 tabular-nums">
            <span className="text-[#B93829] font-semibold">{overdueIssues.length} overdue</span> · {dueSoonIssues.length} due in 30d
          </div>
        </div>

        {/* Card 4: RE-AUDIT DUE / OVERDUE */}
        <div
          onClick={() => {
            onSelectLifecycleStage(7);
            onSelectTab('universe');
          }}
          className="bg-white rounded-lg border border-slate-200/90 p-5 shadow-2xs cursor-pointer hover:border-[#542D84]/50 transition-colors"
        >
          <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
            RE-AUDIT DUE / OVERDUE
          </div>
          <div className="text-[30px] font-bold text-[#B93829] font-mono-tabular leading-tight mt-1">
            {overdueReauditCount}
          </div>
          <div className="text-xs text-slate-500 mt-2.5 tabular-nums">
            {reauditWatchlist.length} watchlist entities
          </div>
        </div>
      </div>

      {/* Middle Row: Inherent risk heat map & Re-audit schedule watchlist */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Left Card: Inherent risk heat map */}
        <div className="bg-white rounded-lg border border-slate-200/90 p-6 shadow-2xs">
          <h2 className="text-[17px] font-bold text-slate-900 tracking-tight">
            Inherent risk heat map
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Likelihood (vertical) × Impact (horizontal) across registered auditable entities.
          </p>

          <div className="mt-4">
            <div className="grid grid-cols-6 gap-2 items-center">
              {heatMapCells.map((row, rIdx) => (
                <React.Fragment key={rIdx}>
                  <div className="text-xs text-slate-500 font-mono-tabular pr-2">
                    L = {5 - rIdx}
                  </div>
                  {row.map((cell) => (
                    <div
                      key={`${cell.l}-${cell.i}`}
                      onClick={() => {
                        onSelectLifecycleStage(1);
                        onSelectTab('universe');
                      }}
                      className={`h-11 rounded-md flex items-center justify-center font-mono-tabular text-sm font-bold cursor-pointer transition-transform hover:scale-[1.02] ${getCellStyle(
                        cell.level,
                        cell.count
                      )}`}
                      title={`Likelihood ${cell.l} × Impact ${cell.i} = ${
                        cell.l * cell.i
                      } (${cell.level}): ${cell.count} entities`}
                    >
                      {cell.count}
                    </div>
                  ))}
                </React.Fragment>
              ))}

              {/* Bottom Impact Label Row */}
              <div />
              {[1, 2, 3, 4, 5].map((imp) => (
                <div
                  key={imp}
                  className="text-center text-xs text-slate-500 font-mono-tabular pt-1"
                >
                  I = {imp}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right Card: Re-audit schedule watchlist */}
        <div className="bg-white rounded-lg border border-slate-200/90 p-6 shadow-2xs">
          <h2 className="text-[17px] font-bold text-slate-900 tracking-tight">
            Re-audit schedule watchlist
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Entities whose next cyclical audit is overdue or due within 60 days.
          </p>

          {reauditWatchlist.length > 0 ? (
            <div className="mt-4 divide-y divide-slate-200/80">
              {reauditWatchlist.map((item, idx) => (
                <div
                  key={idx}
                  onClick={() => {
                    onSelectLifecycleStage(7);
                    onSelectTab('universe');
                  }}
                  className="py-2.5 first:pt-1 last:pb-0 flex items-center justify-between gap-3 cursor-pointer hover:bg-slate-50/70 px-1 rounded"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="px-2 py-0.5 rounded text-[11px] font-bold text-white shrink-0 bg-[#D97724]">
                      {item.risk}
                    </span>
                    <span className="text-[13px] font-medium text-slate-900 truncate">
                      {item.name}
                    </span>
                  </div>
                  <span className="text-xs font-mono-tabular font-medium text-[#B93829] whitespace-nowrap shrink-0">
                    {item.dueText}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <div className="mt-8 py-6 text-center text-xs text-slate-500 bg-slate-50/70 rounded-md border border-dashed border-slate-200">
              No cyclical re-audits are currently due or overdue. Auditable entities are on schedule.
            </div>
          )}
        </div>
      </div>

      {/* Bottom 2-Column Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Left Bottom Card: Overdue remediation items */}
        <div className="bg-white rounded-lg border border-slate-200/90 p-6 shadow-2xs">
          <h2 className="text-[17px] font-bold text-slate-900 tracking-tight">
            Overdue remediation items
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Issues past their current due date requiring escalation.
          </p>

          {overdueRemediation.length > 0 ? (
            <div className="mt-4 divide-y divide-slate-200/80">
              {overdueRemediation.map((iss) => (
                <div
                  key={iss.ref}
                  onClick={() => {
                    onSelectLifecycleStage(5);
                    onSelectTab('issues');
                  }}
                  className="py-3 first:pt-1 last:pb-0 flex items-center justify-between gap-3 hover:bg-slate-50/70 px-1 rounded cursor-pointer"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span
                      className={`px-2 py-0.5 rounded text-[11px] font-bold text-white shrink-0 ${
                        iss.severity === 'Critical'
                          ? 'bg-[#B93829]'
                          : iss.severity === 'High'
                          ? 'bg-[#D97724]'
                          : 'bg-[#C99E2C]'
                      }`}
                    >
                      {iss.severity}
                    </span>
                    <span className="text-[13px] font-medium text-slate-900 truncate">
                      <span className="font-mono-tabular">{iss.ref}</span> {iss.title}
                    </span>
                  </div>
                  <span className="text-xs font-mono-tabular font-medium text-[#B93829] whitespace-nowrap shrink-0">
                    {iss.meta}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <div className="mt-8 py-6 text-center text-xs text-slate-500 bg-slate-50/70 rounded-md border border-dashed border-slate-200">
              No overdue remediation items. All audit findings are resolved or within remediation target dates.
            </div>
          )}
        </div>

        {/* Right Bottom Card: Active & upcoming engagements */}
        <div className="bg-white rounded-lg border border-slate-200/90 p-6 shadow-2xs">
          <h2 className="text-[17px] font-bold text-slate-900 tracking-tight">
            Active &amp; upcoming engagements
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Audits currently in fieldwork, reporting, or scheduled next.
          </p>

          {activeAndUpcoming.length > 0 ? (
            <div className="mt-4 divide-y divide-slate-200/80">
              {activeAndUpcoming.map((item) => {
                return (
                  <div
                    key={item.ref}
                    onClick={() => onOpenEngagement(item)}
                    className="py-3 first:pt-1 last:pb-0 flex items-center justify-between gap-3 hover:bg-slate-50/70 px-1 rounded cursor-pointer"
                  >
                    <div>
                      <div className="text-[13.5px] font-bold text-slate-900">
                        <span className="font-mono-tabular">{item.ref}</span> {item.title}
                      </div>
                      <div className="text-xs text-slate-500 mt-0.5">{item.lead || '—'} · {item.startDate} – {item.endDate}</div>
                    </div>
                    <div className="shrink-0">
                      {item.status === 'Reporting' ? (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-[#FBE7D3] text-[#B8500B]">
                          <span className="w-1.5 h-1.5 rounded-full bg-[#D97724]" />
                          Reporting
                        </span>
                      ) : item.status === 'In progress' ? (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-[#E4DDF8] text-[#492785]">
                          <span className="w-1.5 h-1.5 rounded-full bg-[#492785]" />
                          In progress
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-[#DCE8FB] text-[#1D4ED8]">
                          <span className="w-1.5 h-1.5 rounded-full bg-[#1D4ED8]" />
                          Scheduled
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="mt-8 py-6 text-center text-xs text-slate-500 bg-slate-50/70 rounded-md border border-dashed border-slate-200">
              No active or scheduled engagements. Use &ldquo;Annual audit plan&rdquo; to schedule new audits.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// 2. AUDIT UNIVERSE VIEW (Exact match to Audit-Management-System (8).png)
export const AuditUniverseView: React.FC<{
  universe: UniverseEntity[];
  universeRecords: UniverseRecord[];
  frequencies: { high: number; medium: number; low: number };
  isReauditMode?: boolean;
  onAddUniverseEntity?: (entity: UniverseEntity) => void;
  onUpdateUniverseEntity?: (entity: UniverseEntity) => void;
  onDeleteUniverseEntity?: (id: string) => void;
}> = ({
  universe,
  frequencies,
  universeRecords,
  onAddUniverseEntity,
  onUpdateUniverseEntity,
  onDeleteUniverseEntity,
}) => {
  const [records, setRecords] = useState<UniverseRecord[]>(universeRecords);
  const [dynamicEntityTypes, setDynamicEntityTypes] = useState<string[]>(DEFAULT_ENTITY_TYPES);
  const [dynamicCategories, setDynamicCategories] = useState<string[]>(DEFAULT_AUDIT_CATEGORIES);
  const [dynamicOwners, setDynamicOwners] = useState<AuditeeUnitRecord[]>(DEFAULT_AUDITEE_DIRECTORY);

  React.useEffect(() => {
    setRecords(universeRecords);
  }, [universeRecords]);

  React.useEffect(() => {
    fetchMasterData('entity_types', DEFAULT_ENTITY_TYPES).then((types) => {
      if (types && types.length > 0) setDynamicEntityTypes(types);
    });
    fetchMasterData('audit_categories', DEFAULT_AUDIT_CATEGORIES).then((cats) => {
      if (cats && cats.length > 0) {
        setDynamicCategories(cats);
        setNewSubtitle(cats[0]);
      }
    });
    fetchMasterData('auditee_directory', DEFAULT_AUDITEE_DIRECTORY).then((dirs) => {
      if (dirs && dirs.length > 0) {
        const activeOwners = normalizeAuditeeDirectory(dirs).filter((dir) => dir.isActive);
        setDynamicOwners(activeOwners);
        if (activeOwners.length > 0) {
          setNewOwner(`${activeOwners[0].head} (${activeOwners[0].unit})`);
        }
      }
    });
  }, []);

  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState('All types');
  const [categoryFilter, setCategoryFilter] = useState('All categories');
  const [riskFilter, setRiskFilter] = useState('All risk levels');
  const [showAddModal, setShowAddModal] = useState(false);

  // Add entity form
  const [newName, setNewName] = useState('');
  const [newSubtitle, setNewSubtitle] = useState('Operations');
  const [newType, setNewType] = useState<UniverseRecord['type']>('Process');
  const [newOwner, setNewOwner] = useState('R. Bautista');
  const [newLikelihood, setNewLikelihood] = useState(4);
  const [newImpact, setNewImpact] = useState(4);
  const [newRiskScore, setNewRiskScore] = useState(16);
  const [scoreOverridden, setScoreOverridden] = useState(false);
  const [newLastAudit, setNewLastAudit] = useState('2026-10-04');

  // Edit entity modal form
  const [editingRecord, setEditingRecord] = useState<UniverseRecord | null>(null);
  const [editName, setEditName] = useState('');
  const [editSubtitle, setEditSubtitle] = useState('');
  const [editType, setEditType] = useState<UniverseRecord['type']>('Process');
  const [editOwner, setEditOwner] = useState('');
  const [editLikelihood, setEditLikelihood] = useState(4);
  const [editImpact, setEditImpact] = useState(4);
  const [editRiskScore, setEditRiskScore] = useState(16);
  const [editLastAudit, setEditLastAudit] = useState('2026-10-04');
  const [editCycleMonths, setEditCycleMonths] = useState(12);
  const [editNextDue, setEditNextDue] = useState('');
  const [editNextDueStatus, setEditNextDueStatus] = useState<'Overdue' | 'Due soon' | 'On track'>('On track');

  const calculateRiskLevel = (score: number): AuditRiskLevel => {
    if (score >= 15) return 'High';
    if (score >= 8) return 'Medium';
    return 'Low';
  };

  const getCycleMonths = (level: AuditRiskLevel): number => {
    if (level === 'High') return frequencies.high;
    if (level === 'Medium') return frequencies.medium;
    return frequencies.low;
  };

  const formatDateDisplay = (dateStr: string): string => {
    return formatDateForDisplay(dateStr) || '—';
  };

  const computeNextDueDate = (dateStr: string, months: number): string => {
    if (!dateStr) return 'Pending';
    try {
      const d = new Date(dateStr);
      if (!isNaN(d.getTime())) {
        d.setMonth(d.getMonth() + months);
        return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
      }
    } catch {
      // ignore
    }
    return 'Pending';
  };

  const handleOpenEditModal = (rec: UniverseRecord) => {
    setEditingRecord(rec);
    setEditName(rec.name);
    setEditSubtitle(rec.subtitle);
    setEditType(rec.type);
    setEditOwner(rec.owner);
    setEditLikelihood(rec.likelihood);
    setEditImpact(rec.impact);
    setEditRiskScore(rec.riskScore);
    setEditLastAudit(toDateInputValue(rec.lastAudit));
    setEditCycleMonths(rec.cycleMonths);
    setEditNextDue(toDateInputValue(rec.nextDue));
    setEditNextDueStatus(rec.nextDueStatus);
  };

  const filtered = records.filter((r) => {
    const matchesSearch =
      searchQuery.trim() === '' ||
      r.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      r.subtitle.toLowerCase().includes(searchQuery.toLowerCase()) ||
      r.owner.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesType = typeFilter === 'All types' || r.type === typeFilter;
    const matchesCat = categoryFilter === 'All categories' || r.subtitle.toLowerCase().includes(categoryFilter.toLowerCase());
    const matchesRisk =
      riskFilter === 'All risk levels' || r.riskLevel === riskFilter;
    return matchesSearch && matchesType && matchesCat && matchesRisk;
  });

  const handleAddEntity = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) return;
    const score = Number(newRiskScore) || (newLikelihood * newImpact);
    const riskLevel: AuditRiskLevel = calculateRiskLevel(score);
    const cycleMonths = getCycleMonths(riskLevel);
    const formattedLastAudit = formatDateDisplay(newLastAudit);
    const nextDue = computeNextDueDate(newLastAudit, cycleMonths);

    const added: UniverseRecord = {
      id: `ur-${Date.now()}`,
      name: newName.trim(),
      subtitle: newSubtitle.trim(),
      type: newType,
      owner: newOwner.trim(),
      likelihood: newLikelihood,
      impact: newImpact,
      riskScore: score,
      riskLevel,
      cycleMonths,
      lastAudit: formattedLastAudit,
      nextDue,
      nextDueStatus: 'On track',
    };
    setRecords((prev) => [added, ...prev]);

    if (onAddUniverseEntity) {
      onAddUniverseEntity({
        id: added.id,
        code: `UNV-${Date.now().toString().slice(-4)}`,
        name: added.name,
        division: added.subtitle,
        category: added.type,
        likelihood: added.likelihood,
        impact: added.impact,
        riskScore: added.riskScore,
        riskLevel: added.riskLevel,
        lastAudited: added.lastAudit,
        nextDue: added.nextDue,
        cycleMonths: added.cycleMonths,
        defaultLead: added.owner,
      });
    }

    setNewName('');
    setScoreOverridden(false);
    setShowAddModal(false);
  };

  const handleSaveEditEntity = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingRecord || !editName.trim()) return;

    const score = Number(editRiskScore) || (editLikelihood * editImpact);
    const riskLevel: AuditRiskLevel = calculateRiskLevel(score);
    const cycleMonths = editCycleMonths || getCycleMonths(riskLevel);
    const formattedLastAudit = formatDateDisplay(editLastAudit);
    const nextDue = editNextDue.trim()
      ? formatDateDisplay(editNextDue)
      : computeNextDueDate(editLastAudit, cycleMonths);

    const updated: UniverseRecord = {
      ...editingRecord,
      name: editName.trim(),
      subtitle: editSubtitle.trim(),
      type: editType,
      owner: editOwner.trim(),
      likelihood: editLikelihood,
      impact: editImpact,
      riskScore: score,
      riskLevel,
      cycleMonths,
      lastAudit: formattedLastAudit,
      nextDue,
      nextDueStatus: editNextDueStatus,
    };

    setRecords((prev) => prev.map((r) => (r.id === editingRecord.id ? updated : r)));

    if (onUpdateUniverseEntity) {
      const currentEntity = universe.find((entity) => entity.id === updated.id);
      onUpdateUniverseEntity({
        id: updated.id,
        code: currentEntity?.code || `UNV-${updated.id.slice(-4)}`,
        name: updated.name,
        division: updated.subtitle,
        category: updated.type,
        likelihood: updated.likelihood,
        impact: updated.impact,
        riskScore: updated.riskScore,
        riskLevel: updated.riskLevel,
        lastAudited: updated.lastAudit,
        nextDue: updated.nextDue,
        cycleMonths: updated.cycleMonths,
        defaultLead: updated.owner,
      });
    }

    setEditingRecord(null);
  };

  return (
    <div className="bg-white rounded-lg border border-slate-200/90 shadow-2xs p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-[19px] font-bold text-slate-900 tracking-tight">
            Audit universe
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            All auditable entities (departments, branches, products, IT systems) with inherent risk scoring and audit cycle tracking.
          </p>
        </div>

        <button
          type="button"
          onClick={() => setShowAddModal(true)}
          className="px-3.5 py-2 bg-[#492785] hover:bg-[#3b1f6b] text-white text-xs font-semibold rounded-md transition-colors cursor-pointer"
        >
          Add entity
        </button>
      </div>

      {/* Filter Bar matching Audit-Management-System (2).png */}
      <div className="mt-5 flex flex-wrap items-center gap-2.5">
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search entity, category, owner"
          className="w-full sm:w-64 px-3.5 py-2 bg-white border border-slate-300 rounded-md text-xs text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-[#492785]"
        />

        <select
          aria-label="Filter by entity type"
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
          className="px-3 py-2 bg-white border border-slate-300 rounded-md text-xs font-medium text-slate-800 focus:outline-none focus:border-[#492785]"
        >
          <option value="All types">All types</option>
          {dynamicEntityTypes.map((et) => (
            <option key={et} value={et}>{et}</option>
          ))}
        </select>

        <select
          aria-label="Filter by category"
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
          className="px-3 py-2 bg-white border border-slate-300 rounded-md text-xs font-medium text-slate-800 focus:outline-none focus:border-[#492785]"
        >
          <option value="All categories">All categories</option>
          {dynamicCategories.map((cat) => (
            <option key={cat} value={cat}>{cat}</option>
          ))}
        </select>

        <select
          aria-label="Filter by risk level"
          value={riskFilter}
          onChange={(e) => setRiskFilter(e.target.value)}
          className="px-3 py-2 bg-white border border-slate-300 rounded-md text-xs font-medium text-slate-800 focus:outline-none focus:border-[#492785]"
        >
          <option value="All risk levels">All risk levels</option>
          <option value="High">High</option>
          <option value="Medium">Medium</option>
          <option value="Low">Low</option>
        </select>
      </div>

      {/* Table matching Audit-Management-System (2).png */}
      <div className="mt-5 overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-slate-200 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
              <th className="py-2.5 pr-4">ENTITY</th>
              <th className="py-2.5 px-4">TYPE</th>
              <th className="py-2.5 px-4">OWNER</th>
              <th className="py-2.5 px-4">L × I</th>
              <th className="py-2.5 px-4">RISK</th>
              <th className="py-2.5 px-4">CYCLE</th>
              <th className="py-2.5 px-4">LAST AUDIT</th>
              <th className="py-2.5 px-4">NEXT DUE</th>
              <th className="py-2.5 pl-4 text-right">ACTIONS</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200/80 text-[13px] tabular-nums">
            {filtered.map((rec) => {
              const cycle =
                rec.riskLevel === 'High'
                  ? frequencies.high
                  : rec.riskLevel === 'Medium'
                  ? frequencies.medium
                  : frequencies.low;

              return (
                <tr key={rec.id} className="hover:bg-slate-50/70 transition-colors">
                  <td className="py-3.5 pr-4">
                    <div className="font-bold text-slate-900">{rec.name}</div>
                    <div className="text-xs text-slate-500 mt-0.5">{rec.subtitle}</div>
                  </td>
                  <td className="py-3.5 px-4 text-slate-700">{rec.type}</td>
                  <td className="py-3.5 px-4 text-slate-800">{rec.owner}</td>
                  <td className="py-3.5 px-4 font-mono-tabular text-xs font-semibold text-slate-800">
                    {rec.likelihood} × {rec.impact} = {rec.riskScore}
                  </td>
                  <td className="py-3.5 px-4">
                    <span
                      className={`inline-block px-2 py-0.5 rounded text-xs font-bold text-white ${
                        rec.riskLevel === 'High'
                          ? 'bg-[#D97724]'
                          : rec.riskLevel === 'Medium'
                          ? 'bg-[#C99E2C]'
                          : 'bg-[#519E66]'
                      }`}
                    >
                      {rec.riskLevel}
                    </span>
                  </td>
                  <td className="py-3.5 px-4 text-slate-700">Every {cycle} mo</td>
                  <td className="py-3.5 px-4 text-slate-800">{rec.lastAudit}</td>
                  <td className="py-3.5 px-4">
                    <div className="text-slate-900 font-medium">{rec.nextDue}</div>
                    <div
                      className={`text-xs font-medium mt-0.5 ${
                        rec.nextDueStatus === 'Overdue'
                          ? 'text-[#B93829]'
                          : rec.nextDueStatus === 'Due soon'
                          ? 'text-[#D97724]'
                          : 'text-emerald-700'
                      }`}
                    >
                      {rec.nextDueStatus}
                    </div>
                  </td>
                  <td className="py-3.5 pl-4 text-right">
                    <div className="flex items-center justify-end gap-1.5">
                      <button
                        type="button"
                        onClick={() => handleOpenEditModal(rec)}
                        className="px-2.5 py-1 bg-white hover:bg-purple-50 text-[#492785] border border-purple-200 rounded text-xs font-semibold cursor-pointer transition-colors"
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setRecords((prev) => prev.filter((item) => item.id !== rec.id));
                          if (onDeleteUniverseEntity) {
                            onDeleteUniverseEntity(rec.id);
                          }
                        }}
                        className="px-2.5 py-1 bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 rounded text-xs font-medium cursor-pointer"
                      >
                        Remove
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}

            {filtered.length === 0 && (
              <tr>
                <td colSpan={9} className="py-12 text-center">
                  <div className="flex flex-col items-center justify-center max-w-sm mx-auto">
                    <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center text-slate-400 mb-3">
                      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                      </svg>
                    </div>
                    {records.length === 0 ? (
                      <>
                        <p className="text-sm font-semibold text-slate-800">No auditable entities found</p>
                        <p className="text-xs text-slate-500 mt-1 mb-4">The audit universe is currently clean and ready for testing. Click &ldquo;Add entity&rdquo; to register your first auditable department, process, or system.</p>
                        <button
                          type="button"
                          onClick={() => setShowAddModal(true)}
                          className="px-3.5 py-2 bg-[#492785] hover:bg-[#3b1f6b] text-white text-xs font-semibold rounded-md transition-colors cursor-pointer"
                        >
                          + Add Auditable Entity
                        </button>
                      </>
                    ) : (
                      <p className="text-xs text-slate-500">No auditable entities match your current filter criteria.</p>
                    )}
                  </div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Modal: Add Entity */}
      {showAddModal && (
        <div className="fixed inset-0 bg-slate-900/40 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg border border-slate-200 shadow-xl max-w-lg w-full p-5 text-xs">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <h3 className="text-base font-bold text-slate-900">
                Add Auditable Entity to Universe
              </h3>
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                className="text-slate-400 hover:text-slate-600 font-bold"
              >
                ✕
              </button>
            </div>
            <form onSubmit={handleAddEntity} className="mt-4 space-y-3.5">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Entity Name
                </label>
                <input
                  type="text"
                  required
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="e.g. Davao Regional Lending Hub"
                  className="w-full px-3 py-2 border border-slate-300 rounded-md"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Division / Category
                </label>
                <select
                  value={newSubtitle}
                  onChange={(e) => setNewSubtitle(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-md bg-white text-xs text-slate-800 focus:outline-none focus:border-[#492785]"
                >
                  {dynamicCategories.map((cat) => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Entity Type
                  </label>
                  <select
                    value={newType}
                    onChange={(e) =>
                      setNewType(e.target.value as UniverseRecord['type'])
                    }
                    className="w-full px-3 py-2 border border-slate-300 rounded-md bg-white text-xs text-slate-800 focus:outline-none focus:border-[#492785]"
                  >
                    {dynamicEntityTypes.map((et) => (
                      <option key={et} value={et}>{et}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Process Owner
                  </label>
                  <select
                    value={newOwner}
                    onChange={(e) => setNewOwner(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-md bg-white text-xs text-slate-800 focus:outline-none focus:border-[#492785]"
                  >
                    {dynamicOwners.map((owner) => (
                      <option key={owner.head + ' - ' + owner.unit} value={`${owner.head} (${owner.unit})`}>
                        {owner.head} — {owner.unit}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Likelihood & Impact */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Likelihood (1–5)
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={5}
                    value={newLikelihood}
                    onChange={(e) => {
                      const l = Number(e.target.value);
                      setNewLikelihood(l);
                      if (!scoreOverridden) {
                        setNewRiskScore(l * newImpact);
                      }
                    }}
                    className="w-full px-3 py-2 border border-slate-300 rounded-md"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Impact (1–5)
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={5}
                    value={newImpact}
                    onChange={(e) => {
                      const i = Number(e.target.value);
                      setNewImpact(i);
                      if (!scoreOverridden) {
                        setNewRiskScore(newLikelihood * i);
                      }
                    }}
                    className="w-full px-3 py-2 border border-slate-300 rounded-md"
                  />
                </div>
              </div>

              {/* Risk Score (Auditor Defined - short-term solution) */}
              <div className="bg-purple-50/60 border border-purple-200/80 rounded-md p-3">
                <div className="flex items-center justify-between mb-1">
                  <label className="block font-semibold text-[#492785]">
                    Risk Score (Auditor Defined)
                  </label>
                  {(() => {
                    const level = calculateRiskLevel(newRiskScore);
                    return (
                      <span
                        className={`px-2 py-0.5 rounded text-[11px] font-bold text-white ${
                          level === 'High'
                            ? 'bg-[#D97724]'
                            : level === 'Medium'
                            ? 'bg-[#C99E2C]'
                            : 'bg-[#519E66]'
                        }`}
                      >
                        {level} Risk (Score: {newRiskScore})
                      </span>
                    );
                  })()}
                </div>
                <p className="text-[11px] text-slate-500 mb-2">
                  Auditor may define or directly override the risk score per entity (Calculated: {newLikelihood} × {newImpact} = {newLikelihood * newImpact}).
                </p>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min={1}
                    max={50}
                    value={newRiskScore}
                    onChange={(e) => {
                      setNewRiskScore(Number(e.target.value));
                      setScoreOverridden(true);
                    }}
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-md text-xs font-bold text-slate-900"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      setNewRiskScore(newLikelihood * newImpact);
                      setScoreOverridden(false);
                    }}
                    className="px-2.5 py-2 text-[11px] font-semibold text-slate-600 bg-white border border-slate-200 rounded hover:bg-slate-50 shrink-0"
                  >
                    Reset to L × I
                  </button>
                </div>
              </div>

              {/* Last Audit Date */}
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Last Audit Date
                </label>
                <input
                  type="date"
                  value={newLastAudit}
                  onChange={(e) => setNewLastAudit(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-md bg-white text-xs text-slate-800"
                />
                <span className="text-[11px] text-slate-500 mt-1 block">
                  Next audit due will be automatically scheduled from this date based on {calculateRiskLevel(newRiskScore)} risk cycle.
                </span>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-3.5 py-1.5 border border-slate-300 rounded-md font-semibold text-slate-700 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 bg-[#492785] hover:bg-[#3b1f6b] text-white rounded-md font-semibold cursor-pointer"
                >
                  Save entity
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Edit Entity (Item 13 & 16) */}
      {editingRecord && (
        <div className="fixed inset-0 bg-slate-900/40 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg border border-slate-200 shadow-xl max-w-lg w-full p-5 text-xs">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <h3 className="text-base font-bold text-slate-900">
                Edit Auditable Entity
              </h3>
              <button
                type="button"
                onClick={() => setEditingRecord(null)}
                className="text-slate-400 hover:text-slate-600 font-bold"
              >
                ✕
              </button>
            </div>
            <form onSubmit={handleSaveEditEntity} className="mt-4 space-y-3.5">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Entity Name
                </label>
                <input
                  type="text"
                  required
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-md"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Division / Category
                </label>
                <select
                  value={editSubtitle}
                  onChange={(e) => setEditSubtitle(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-md bg-white text-xs text-slate-800 focus:outline-none focus:border-[#492785]"
                >
                  {dynamicCategories.map((cat) => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Entity Type
                  </label>
                  <select
                    value={editType}
                    onChange={(e) =>
                      setEditType(e.target.value as UniverseRecord['type'])
                    }
                    className="w-full px-3 py-2 border border-slate-300 rounded-md bg-white text-xs text-slate-800 focus:outline-none focus:border-[#492785]"
                  >
                    {dynamicEntityTypes.map((et) => (
                      <option key={et} value={et}>{et}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Process Owner
                  </label>
                  <select
                    value={editOwner}
                    onChange={(e) => setEditOwner(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-md bg-white text-xs text-slate-800 focus:outline-none focus:border-[#492785]"
                  >
                    {dynamicOwners.map((owner) => (
                      <option key={owner.head + ' - ' + owner.unit} value={`${owner.head} (${owner.unit})`}>
                        {owner.head} — {owner.unit}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Likelihood & Impact */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Likelihood (1–5)
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={5}
                    value={editLikelihood}
                    onChange={(e) => setEditLikelihood(Number(e.target.value))}
                    className="w-full px-3 py-2 border border-slate-300 rounded-md"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Impact (1–5)
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={5}
                    value={editImpact}
                    onChange={(e) => setEditImpact(Number(e.target.value))}
                    className="w-full px-3 py-2 border border-slate-300 rounded-md"
                  />
                </div>
              </div>

              {/* Risk Score (Auditor Defined) */}
              <div className="bg-purple-50/60 border border-purple-200/80 rounded-md p-3">
                <div className="flex items-center justify-between mb-1">
                  <label className="block font-semibold text-[#492785]">
                    Risk Score (Auditor Defined)
                  </label>
                  {(() => {
                    const level = calculateRiskLevel(editRiskScore);
                    return (
                      <span
                        className={`px-2 py-0.5 rounded text-[11px] font-bold text-white ${
                          level === 'High'
                            ? 'bg-[#D97724]'
                            : level === 'Medium'
                            ? 'bg-[#C99E2C]'
                            : 'bg-[#519E66]'
                        }`}
                      >
                        {level} Risk (Score: {editRiskScore})
                      </span>
                    );
                  })()}
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min={1}
                    max={50}
                    value={editRiskScore}
                    onChange={(e) => setEditRiskScore(Number(e.target.value))}
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-md text-xs font-bold text-slate-900"
                  />
                  <button
                    type="button"
                    onClick={() => setEditRiskScore(editLikelihood * editImpact)}
                    className="px-2.5 py-2 text-[11px] font-semibold text-slate-600 bg-white border border-slate-200 rounded hover:bg-slate-50 shrink-0"
                  >
                    Reset to L × I
                  </button>
                </div>
              </div>

              {/* Last Audit Date & Cycle */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Last Audit Date
                  </label>
                  <input
                    type="date"
                    required
                    value={editLastAudit}
                    onChange={(e) => setEditLastAudit(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-md bg-white text-xs text-slate-800"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Cycle (Months)
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={60}
                    value={editCycleMonths}
                    onChange={(e) => setEditCycleMonths(Number(e.target.value))}
                    className="w-full px-3 py-2 border border-slate-300 rounded-md bg-white text-xs text-slate-800"
                  />
                </div>
              </div>

              {/* Next Due & Status */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Next Due Date
                  </label>
                  <input
                    type="date"
                    value={editNextDue}
                    onChange={(e) => setEditNextDue(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-md bg-white text-xs text-slate-800"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Schedule Status
                  </label>
                  <select
                    value={editNextDueStatus}
                    onChange={(e) => setEditNextDueStatus(e.target.value as any)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-md bg-white text-xs text-slate-800 focus:outline-none focus:border-[#492785]"
                  >
                    <option value="On track">On track</option>
                    <option value="Due soon">Due soon</option>
                    <option value="Overdue">Overdue</option>
                  </select>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setEditingRecord(null)}
                  className="px-3.5 py-1.5 border border-slate-300 rounded-md font-semibold text-slate-700 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 bg-[#492785] hover:bg-[#3b1f6b] text-white rounded-md font-semibold cursor-pointer"
                >
                  Update entity
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

// 3. TIMELINE VIEW (Exact match to Audit-Management-System (3).png)
export const TimelineView: React.FC<{
  engagements: AuditEngagement[];
  onOpenEngagement: (eng: AuditEngagement) => void;
}> = ({ engagements, onOpenEngagement }) => {
  const [selectedYear, setSelectedYear] = useState('2026');
  const months = [
    'Jan',
    'Feb',
    'Mar',
    'Apr',
    'May',
    'Jun',
    'Jul',
    'Aug',
    'Sept',
    'Oct',
    'Nov',
    'Dec',
  ];

  const monthMap: Record<string, number> = {
    Jan: 0, Feb: 1, Mar: 2, Apr: 3, May: 4, Jun: 5,
    Jul: 6, Aug: 7, Sept: 8, Sep: 8, Oct: 9, Nov: 10, Dec: 11
  };

  const ganttRows = engagements.map((eng) => {
    let startMonthIdx = 0;
    const parts = eng.startDate ? eng.startDate.split(" ") : [];
    if (parts.length >= 2) {
      const mStr = parts[1];
      startMonthIdx = monthMap[mStr] !== undefined ? monthMap[mStr] : 0;
    }
    const spanMonths = Math.max(0.6, (eng.durationDays || 26) / 30);
    const barColor =
      eng.status === "Closed"
        ? "bg-[#1D7A4C]"
        : eng.status === "Reporting" || eng.status === "In progress"
        ? "bg-[#D97724]"
        : "bg-[#6C737A]";

    return {
      ref: eng.ref,
      title: eng.title,
      lead: eng.lead || "—",
      risk: eng.riskLevel,
      startMonthIdx,
      spanMonths,
      barColor,
      engId: eng.id,
      engagement: eng,
    };
  });

  return (
    <div className="bg-white rounded-lg border border-slate-200/90 shadow-2xs p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-[19px] font-bold text-slate-900 tracking-tight">
            Audit engagement timeline {selectedYear}
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Gantt schedule of active, reporting, and planned engagements across 12 months.
          </p>
        </div>

        <select
          aria-label="Select timeline year"
          value={selectedYear}
          onChange={(e) => setSelectedYear(e.target.value)}
          className="px-3 py-2 bg-white border border-slate-300 rounded-md text-xs font-medium text-slate-800 focus:outline-none focus:border-[#492785]"
        >
          <option value="2026">2026</option>
          <option value="2027">2027</option>
          <option value="2025">2025</option>
        </select>
      </div>

      {/* Month Columns Header */}
      <div className="mt-6 border-b border-slate-200 pb-2">
        <div className="grid grid-cols-12 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
          <div className="col-span-4 pr-4">ENGAGEMENT</div>
          <div className="col-span-8 grid grid-cols-12 text-center font-mono-tabular">
            {months.map((m) => (
              <div key={m}>{m}</div>
            ))}
          </div>
        </div>
      </div>

      {/* Gantt Rows */}
      <div className="divide-y divide-slate-200/80">
            {ganttRows.map((row) => {
              const matchedEng =
                engagements.find((e) => e.id === row.engId) || engagements[0];
              const leftPct = (row.startMonthIdx / 12) * 100;
              const widthPct = (row.spanMonths / 12) * 100;

              return (
                <div
                  key={row.ref}
                  onClick={() => onOpenEngagement(matchedEng)}
                  className="grid grid-cols-12 items-center py-3 hover:bg-teal-50/30 cursor-pointer transition-colors"
                >
                  <div className="col-span-4 pr-4">
                    <div className="text-[13px] font-bold text-slate-900 leading-snug">
                      <span className="font-mono-tabular font-semibold">{row.ref}</span>{' '}
                      {row.title}
                    </div>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-xs text-slate-500">{row.lead} ·</span>
                      <span
                        className={`px-1.5 py-0.5 rounded text-[10.5px] font-bold text-white ${
                          row.risk === 'High'
                            ? 'bg-[#D97724]'
                            : 'bg-[#C99E2C]'
                        }`}
                      >
                        {row.risk}
                      </span>
                    </div>
                  </div>

                  <div className="col-span-8 relative h-6">
                    {/* 12 Month vertical grid lines */}
                    <div className="absolute inset-0 grid grid-cols-12 pointer-events-none">
                      {months.map((m) => (
                        <div
                          key={m}
                          className="border-l border-slate-100 first:border-l-0 h-full"
                        />
                      ))}
                    </div>

                    {/* Horizontal Gantt Bar */}
                    <div
                      className={`absolute top-1.5 h-3 rounded-sm ${row.barColor}`}
                      style={{
                        left: `${leftPct}%`,
                        width: `${widthPct}%`,
                      }}
                    />
                  </div>
                </div>
              );
            })}

            {ganttRows.length === 0 && (
              <div className="py-12 text-center text-xs text-slate-500">
                No scheduled engagements in timeline. Plan or launch audits from the Annual Plan tab to visualize the timeline schedule.
              </div>
            )}
          </div>
        </div>
  );
};

// 4. ISSUES VIEW (Exact match to Audit-Management-System (5).png)
export const IssuesView: React.FC<{
  engagements: AuditEngagement[];
  issues: IssueRegisterItem[];
  onUpdateIssue: (issue: IssueRegisterItem) => void;
  activeLifecycleStage: LifecycleStageId;
  onValidateAndCloseFinding: (engagementId: string, findingId: string) => void;
}> = ({ activeLifecycleStage, onValidateAndCloseFinding, issues: initialIssues, onUpdateIssue }) => {
  const [issues, setIssues] = useState<IssueRegisterItem[]>(initialIssues);

  React.useEffect(() => {
    setIssues(initialIssues);
  }, [initialIssues]);

  const [filterTab, setFilterTab] = useState<string>(
    activeLifecycleStage === 6 ? 'For validation' : 'Open'
  );
  const [selectedIssue, setSelectedIssue] = useState<IssueRegisterItem | null>(null);
  const [extensionDate, setExtensionDate] = useState('2026-11-30');
  const [closureRemarks, setClosureRemarks] = useState('');

  const openIssues = issues.filter((i) => i.status !== 'Closed');
  const overdueIssues = issues.filter((i) => i.isOverdue && i.status !== 'Closed');
  const dueSoonIssues = issues.filter((i) => i.isDueSoon && i.status !== 'Closed');
  const forValidationIssues = issues.filter((i) => i.status === 'For validation');
  const closedIssues = issues.filter((i) => i.status === 'Closed');

  const displayed = issues.filter((iss) => {
    if (filterTab === 'Open') return iss.status !== 'Closed';
    if (filterTab === 'Overdue') return iss.isOverdue && iss.status !== 'Closed';
    if (filterTab === 'For validation') return iss.status === 'For validation';
    if (filterTab === 'Closed') return iss.status === 'Closed';
    return true;
  });

  const handleValidateClose = (issue: IssueRegisterItem) => {
    const updated: IssueRegisterItem = {
      ...issue,
      status: 'Closed',
      isOverdue: false,
      isDueSoon: false,
      daysStatus: 'Closed 4 Oct 2026',
      evidenceNote:
        closureRemarks.trim() ||
        'Validated remediation evidence & closed by Internal Audit.',
    };
    setIssues((prev) =>
      prev.map((item) => (item.id === issue.id ? updated : item))
    );
    onUpdateIssue(updated);
    onValidateAndCloseFinding('aud-2026-006', 'fnd-001');
    setClosureRemarks('');
    setSelectedIssue(null);
  };

  const handleGrantExtension = (issue: IssueRegisterItem) => {
    const updated: IssueRegisterItem = {
      ...issue,
      currentDue: formatDateForDisplay(extensionDate),
      extensionCount: issue.extensionCount + 1,
      isOverdue: false,
      daysStatus: `Extended to ${formatDateForDisplay(extensionDate)}`,
      status: 'In progress',
    };
    setIssues((prev) =>
      prev.map((item) => (item.id === issue.id ? updated : item))
    );
    onUpdateIssue(updated);
    setSelectedIssue(null);
  };

  return (
    <div className="space-y-4">
      {/* Top 4 KPI Cards matching Audit-Management-System (5).png */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
        <div className="bg-white rounded-lg border border-slate-200/90 p-5 shadow-2xs">
          <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
            OPEN ISSUES
          </div>
          <div className="text-[30px] font-bold text-slate-900 font-mono-tabular leading-tight mt-1">
            {openIssues.length}
          </div>
          <div className="text-xs text-slate-500 mt-2 tabular-nums">
            Across all audits
          </div>
        </div>

        <div className="bg-white rounded-lg border border-slate-200/90 p-5 shadow-2xs">
          <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
            OVERDUE
          </div>
          <div className="text-[30px] font-bold text-[#B93829] font-mono-tabular leading-tight mt-1">
            {overdueIssues.length}
          </div>
          <div className="text-xs text-slate-500 mt-2 tabular-nums">
            Past current due date
          </div>
        </div>

        <div className="bg-white rounded-lg border border-slate-200/90 p-5 shadow-2xs">
          <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
            DUE WITHIN 30 DAYS
          </div>
          <div className="text-[30px] font-bold text-[#D97724] font-mono-tabular leading-tight mt-1">
            {dueSoonIssues.length}
          </div>
          <div className="text-xs text-slate-500 mt-2 tabular-nums">
            Upcoming target dates
          </div>
        </div>

        <div className="bg-white rounded-lg border border-slate-200/90 p-5 shadow-2xs">
          <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
            AWAITING VALIDATION
          </div>
          <div className="text-[30px] font-bold text-slate-900 font-mono-tabular leading-tight mt-1">
            {forValidationIssues.length}
          </div>
          <div className="text-xs text-slate-500 mt-2 tabular-nums">
            Evidence submitted by owner
          </div>
        </div>
      </div>

      {/* Issue Register Card matching Audit-Management-System (5).png */}
      <div className="bg-white rounded-lg border border-slate-200/90 shadow-2xs p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="text-[19px] font-bold text-slate-900 tracking-tight">
              Issue register &amp; monitoring
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Track agreed action plans, due date extensions, and evidence validation before closure.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            {[
              { id: 'Open', label: `Open ${openIssues.length}` },
              { id: 'Overdue', label: `Overdue ${overdueIssues.length}` },
              {
                id: 'For validation',
                label: `For validation ${forValidationIssues.length}`,
              },
              { id: 'Closed', label: `Closed ${closedIssues.length}` },
              { id: 'All', label: 'All' },
            ].map((tab) => {
              const active = filterTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setFilterTab(tab.id)}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors cursor-pointer tabular-nums ${
                    active
                      ? 'bg-slate-900 text-white border-slate-900 font-semibold'
                      : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
                  }`}
                >
                  {tab.label}
                </button>
              );
            })}
          </div>
        </div>

        <div className="mt-5 overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                <th className="py-2.5 pr-4 w-32">REF</th>
                <th className="py-2.5 px-4">ISSUE &amp; AUDIT</th>
                <th className="py-2.5 px-4">SEVERITY</th>
                <th className="py-2.5 px-4">OWNER</th>
                <th className="py-2.5 px-4">ORIGINAL DUE</th>
                <th className="py-2.5 px-4">CURRENT DUE</th>
                <th className="py-2.5 px-4">STATUS</th>
                <th className="py-2.5 pl-4 text-right" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200/80 text-[13px] tabular-nums">
              {displayed.map((iss) => (
                <tr key={iss.id} className="hover:bg-teal-50/30 transition-colors">
                  <td className="py-3.5 pr-4 align-top font-mono-tabular text-xs font-semibold text-slate-800 whitespace-nowrap">
                    {iss.ref}
                  </td>
                  <td className="py-3.5 px-4 align-top">
                    <div className="font-bold text-slate-900 leading-snug">
                      {iss.title}
                    </div>
                    <div className="text-xs text-slate-500 mt-0.5">
                      <span className="font-mono-tabular">{iss.auditRef}</span> ·{' '}
                      {iss.auditTitle}
                    </div>
                  </td>
                  <td className="py-3.5 px-4 align-top">
                    <span
                      className={`inline-block px-2 py-0.5 rounded text-xs font-bold text-white ${
                        iss.severity === 'Critical'
                          ? 'bg-[#B93829]'
                          : iss.severity === 'High'
                          ? 'bg-[#D97724]'
                          : 'bg-[#C99E2C]'
                      }`}
                    >
                      {iss.severity}
                    </span>
                  </td>
                  <td className="py-3.5 px-4 align-top">
                    <div className="font-medium text-slate-900">{iss.owner}</div>
                    <div className="text-xs text-slate-500 mt-0.5">{iss.ownerUnit}</div>
                  </td>
                  <td className="py-3.5 px-4 align-top text-slate-700 whitespace-nowrap">
                    {iss.originalDue}
                  </td>
                  <td className="py-3.5 px-4 align-top whitespace-nowrap">
                    <div className="font-medium text-slate-900">{iss.currentDue}</div>
                    <div
                      className={`text-xs mt-0.5 ${
                        iss.isOverdue
                          ? 'text-[#B93829] font-medium'
                          : 'text-slate-500'
                      }`}
                    >
                      {iss.daysStatus}
                      {iss.extensionCount > 0 && ` · ${iss.extensionCount} ext.`}
                    </div>
                  </td>
                  <td className="py-3.5 px-4 align-top">
                    {iss.status === 'Overdue' ? (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-100 text-[#B93829]">
                        <span className="w-1.5 h-1.5 rounded-full bg-[#B93829]" />
                        Overdue
                      </span>
                    ) : iss.status === 'Extension requested' ? (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-900">
                        <span className="w-1.5 h-1.5 rounded-full bg-amber-700" />
                        Extension requested
                      </span>
                    ) : iss.status === 'For validation' ? (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-[#DCE8FB] text-[#1D4ED8]">
                        <span className="w-1.5 h-1.5 rounded-full bg-[#1D4ED8]" />
                        For validation
                      </span>
                    ) : iss.status === 'Closed' ? (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-[#DCEFE2] text-[#1E6339]">
                        <span className="w-1.5 h-1.5 rounded-full bg-[#1E6339]" />
                        Closed
                      </span>
                    ) : iss.status === 'Open' ? (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-700 border border-slate-200">
                        <span className="w-1.5 h-1.5 rounded-full bg-slate-500" />
                        Open
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-[#E4DDF8] text-[#492785]">
                        <span className="w-1.5 h-1.5 rounded-full bg-[#492785]" />
                        In progress
                      </span>
                    )}
                  </td>
                  <td className="py-3.5 pl-4 align-top text-right">
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedIssue(iss);
                        setExtensionDate(toDateInputValue(iss.currentDue));
                      }}
                      className="px-3 py-1.5 bg-white hover:bg-slate-50 text-slate-800 border border-slate-300 rounded text-xs font-semibold cursor-pointer"
                    >
                      Manage
                    </button>
                  </td>
                </tr>
              ))}

              {displayed.length === 0 && (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-xs text-slate-500">
                    {issues.length === 0
                      ? 'No audit issues currently registered. Issues will appear here when findings are raised during fieldwork and reporting.'
                      : 'No issues match the selected filter.'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal: Manage Issue (Extension / Evidence Validation & Closure) */}
      {selectedIssue && (
        <div className="fixed inset-0 bg-slate-900/40 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg border border-slate-200 shadow-xl max-w-lg w-full p-5 space-y-3 text-xs">
            <div className="flex items-start justify-between gap-2">
              <div>
                <span className="font-mono-tabular font-bold text-slate-500">
                  {selectedIssue.ref} · {selectedIssue.auditRef}
                </span>
                <h3 className="text-base font-bold text-slate-900 mt-0.5">
                  {selectedIssue.title}
                </h3>
              </div>
              <span className="px-2.5 py-0.5 rounded bg-slate-100 text-slate-800 font-semibold">
                {selectedIssue.status}
              </span>
            </div>

            <div className="p-3 bg-slate-50 rounded border border-slate-200 space-y-1.5">
              <div>
                <strong className="text-slate-900">Action Owner:</strong>{' '}
                {selectedIssue.owner} ({selectedIssue.ownerUnit})
              </div>
              <div>
                <strong className="text-slate-900">Agreed Action Plan:</strong>{' '}
                {selectedIssue.actionPlanSummary}
              </div>
              <div>
                <strong className="text-slate-900">Target Dates:</strong> Original{' '}
                {selectedIssue.originalDue} → Current {selectedIssue.currentDue} (
                {selectedIssue.extensionCount} extensions)
              </div>
            </div>

            {selectedIssue.status !== 'Closed' && (
              <>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">
                      Grant Due-Date Extension
                    </label>
                    <div className="flex gap-2">
                      <input
                        type="date"
                        required
                        value={extensionDate}
                        onChange={(e) => setExtensionDate(e.target.value)}
                        className="w-full px-2.5 py-1.5 border border-slate-300 rounded bg-white"
                      />
                      <button
                        type="button"
                        disabled={!extensionDate}
                        onClick={() => handleGrantExtension(selectedIssue)}
                        className="px-3 py-1.5 bg-white border border-slate-300 rounded font-semibold text-slate-800 hover:bg-slate-50 cursor-pointer shrink-0 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        Extend
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">
                      Stage 06 Validation Note
                    </label>
                    <input
                      type="text"
                      value={closureRemarks}
                      onChange={(e) => setClosureRemarks(e.target.value)}
                      placeholder="Evidence reference / sign-off..."
                      className="w-full px-2.5 py-1.5 border border-slate-300 rounded"
                    />
                  </div>
                </div>
              </>
            )}

            <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setSelectedIssue(null)}
                className="px-3.5 py-1.5 border border-slate-300 rounded-md font-semibold text-slate-700 cursor-pointer"
              >
                Close
              </button>
              {selectedIssue.status !== 'Closed' && (
                <button
                  type="button"
                  onClick={() => handleValidateClose(selectedIssue)}
                  className="px-4 py-1.5 bg-teal-700 hover:bg-teal-800 text-white rounded-md font-semibold cursor-pointer"
                >
                  Validate evidence &amp; close issue
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// 5. MASTER DATA, SETUP, AND ACCESS VIEWS
export interface AuditorRecord {
  name: string;
  role: string;
  email: string;
  skills: string;
}

export interface AuditeeUnitRecord {
  unit: string;
  head: string;
  title: string;
  email: string;
  reportsTo?: string;
  isActive?: boolean;
}

const DEFAULT_ENTITY_TYPES = [
  'Department',
  'Branch',
  'Product / process',
  'IT system',
  'Vendor',
];

const DEFAULT_AUDIT_CATEGORIES = [
  'Operations',
  'Credit review',
  'IT audit',
  'Information security',
  'Compliance',
  'Financial',
  'Branch audit',
];

const DEFAULT_DEPARTMENTS = [
  'Administrative Services',
  'Branch Banking',
  'Compliance',
  'Credit',
  'Finance',
  'Human Resources',
  'Information Technology',
  'Internal Audit',
  'Operations',
  'Risk Management',
];

const DEFAULT_CONFIGURABLE_LISTS = {
  departments: DEFAULT_DEPARTMENTS,
  audit_types: ['Financial audit', 'Operational audit', 'Compliance audit', 'IT audit', 'Thematic audit'],
  finding_severities: ['Critical', 'High', 'Medium', 'Low'],
  report_ratings: ['Satisfactory', 'Needs improvement', 'Unsatisfactory'],
  signatories: [
    'M. Santos – Chief Audit Executive',
    'Audit-in-charge (from the team)',
    'R. Dizon – Deputy CAE',
    'E. Bautista – Chair, Board Audit Committee',
  ],
  audit_statuses: ['Planned', 'Scheduled', 'In progress', 'Reporting', 'Closed'],
};

type ConfigurableListKey = keyof typeof DEFAULT_CONFIGURABLE_LISTS;
const CONFIGURABLE_LISTS: { key: ConfigurableListKey; label: string; description: string }[] = [
  { key: 'departments', label: 'Departments', description: 'Departments available in auditee and audit-universe forms.' },
  { key: 'audit_types', label: 'Audit types', description: 'Maintain the types of audits available for planning.' },
  { key: 'finding_severities', label: 'Finding severities', description: 'Maintain severity levels used for audit findings.' },
  { key: 'report_ratings', label: 'Report ratings', description: 'Maintain report rating options.' },
  { key: 'signatories', label: 'Signatories', description: 'People or roles available for document sign-off.' },
  { key: 'audit_statuses', label: 'Audit statuses', description: 'Maintain statuses used by audit operations.' },
];

const normalizeAuditeeDirectory = (records: AuditeeUnitRecord[]): AuditeeUnitRecord[] =>
  records.map((record) => ({
    ...record,
    reportsTo: record.reportsTo ?? '',
    isActive: record.isActive ?? true,
  }));

const isAuditeeRole = (role: string): boolean =>
  normalizeRole(role).endsWith('(auditee)');

const DEFAULT_AUDITORS: AuditorRecord[] = [
  {
    name: 'M. Santos',
    role: 'Chief Audit Executive',
    email: 'm.santos@citysavings.com.ph',
    skills: 'Operations, Credit review, IT audit, Information security, Compliance, Financial, Branch audit',
  },
  {
    name: 'J. Dela Cruz',
    role: 'Audit Division Head',
    email: 'j.delacruz@citysavings.com.ph',
    skills: 'IT audit, Information security',
  },
  {
    name: 'A. Villanueva',
    role: 'Audit Supervisor',
    email: 'a.villanueva@citysavings.com.ph',
    skills: 'Operations, Financial, Branch audit',
  },
  {
    name: 'P. Mendoza',
    role: 'Audit-in-Charge',
    email: 'p.mendoza@citysavings.com.ph',
    skills: 'IT audit, Information security',
  },
  {
    name: 'K. Lim',
    role: 'Assisting Auditor',
    email: 'k.lim@citysavings.com.ph',
    skills: 'Compliance, Branch audit, Operations',
  },
  {
    name: 'D. Ramos',
    role: 'Assisting Auditor',
    email: 'd.ramos@citysavings.com.ph',
    skills: 'Credit review, Financial',
  },
  {
    name: 'B. Tolentino',
    role: 'Assisting Auditor',
    email: 'b.tolentino@citysavings.com.ph',
    skills: 'IT audit, Operations',
  },
  {
    name: 'R. Garcia',
    role: 'Assisting Auditor',
    email: 'r.garcia@citysavings.com.ph',
    skills: 'Operations, Financial, Compliance',
  },
  {
    name: 'L. Fernandez',
    role: 'Assisting Auditor',
    email: 'l.fernandez@citysavings.com.ph',
    skills: 'Branch audit, Compliance, Credit review',
  },
];

const DEFAULT_AUDITEE_DIRECTORY: AuditeeUnitRecord[] = [
  {
    unit: 'Operations · Cash & clearing',
    head: 'R. Bautista',
    title: 'VP, Operations',
    email: 'r.bautista@citysavings.com.ph',
  },
  {
    unit: 'Operations · Billing & collection',
    head: 'R. Bautista',
    title: 'VP, Operations',
    email: 'r.bautista@citysavings.com.ph',
  },
  {
    unit: 'Operations · Records & Collateral',
    head: 'R. Bautista',
    title: 'VP, Operations',
    email: 'r.bautista@citysavings.com.ph',
  },
  {
    unit: 'Loan Release & Disbursement · Card ops',
    head: 'G. Soriano',
    title: 'AVP, Loan Release & Cards',
    email: 'g.soriano@citysavings.com.ph',
  },
  {
    unit: 'IT · Core banking (Temenos T24)',
    head: 'E. Navarro',
    title: 'VP, Chief Information Officer',
    email: 'e.navarro@citysavings.com.ph',
  },
  {
    unit: 'IT · Digital channels',
    head: 'E. Navarro',
    title: 'VP, Chief Information Officer',
    email: 'e.navarro@citysavings.com.ph',
  },
  {
    unit: 'IT · Payment switches',
    head: 'E. Navarro',
    title: 'VP, Chief Information Officer',
    email: 'e.navarro@citysavings.com.ph',
  },
  {
    unit: 'IT · Network & Infrastructure Security',
    head: 'E. Navarro',
    title: 'VP, Chief Information Officer',
    email: 'e.navarro@citysavings.com.ph',
  },
  {
    unit: 'IT & Operations · Mission-Critical Systems',
    head: 'E. Navarro',
    title: 'VP, Chief Information Officer',
    email: 'e.navarro@citysavings.com.ph',
  },
  {
    unit: 'Lending · Salary loans',
    head: 'V. Pascual',
    title: 'VP, Consumer & Teacher Lending',
    email: 'v.pascual@citysavings.com.ph',
  },
  {
    unit: 'Lending · Product governance',
    head: 'V. Pascual',
    title: 'VP, Consumer & Teacher Lending',
    email: 'v.pascual@citysavings.com.ph',
  },
  {
    unit: 'Lending · Key Regional Hub',
    head: 'V. Pascual',
    title: 'VP, Consumer & Teacher Lending',
    email: 'v.pascual@citysavings.com.ph',
  },
  {
    unit: 'Compliance · AML / CFT',
    head: 'C. Dizon',
    title: 'Chief Compliance Officer',
    email: 'c.dizon@citysavings.com.ph',
  },
  {
    unit: 'Legal & Compliance · Accreditation',
    head: 'C. Dizon',
    title: 'Chief Compliance Officer',
    email: 'c.dizon@citysavings.com.ph',
  },
  {
    unit: 'Vendor Management & IT · Compliance',
    head: 'C. Dizon',
    title: 'Chief Compliance Officer',
    email: 'c.dizon@citysavings.com.ph',
  },
  {
    unit: 'Treasury · Liquidity',
    head: 'L. Mercado',
    title: 'VP, Treasurer',
    email: 'l.mercado@citysavings.com.ph',
  },
  {
    unit: 'Finance · General Ledger',
    head: 'L. Mercado',
    title: 'VP, Treasurer',
    email: 'l.mercado@citysavings.com.ph',
  },
  {
    unit: 'Branch Banking · Mindanao Region',
    head: 'G. Soriano',
    title: 'VP, Branch Banking',
    email: 'g.soriano@citysavings.com.ph',
  },
  {
    unit: 'Branch Banking · Visayas Region',
    head: 'G. Soriano',
    title: 'VP, Branch Banking',
    email: 'g.soriano@citysavings.com.ph',
  },
  {
    unit: 'Administrative Services · General services',
    head: 'M. Ocampo',
    title: 'AVP, Administrative Services',
    email: 'm.ocampo@citysavings.com.ph',
  },
];

export const DEFAULT_SETUP_ITEMS = [
  {
    id: 'ob-1',
    group: '1. Organization & branding',
    stepNum: 1,
    title: 'Organization name, unit & report header',
    description:
      'Set the institution name, internal audit department title, address, and confidentiality banner printed on all Word (.docx) memos and reports.',
    status: 'Done' as 'Done' | 'In progress' | 'To do',
    summary: 'City Savings Bank · Internal Audit Division',
    note: '',
    actionLabel: 'Open →',
    targetTab: 'settings' as MainTabId,
  },
  {
    id: 'ob-2',
    group: '1. Organization & branding',
    stepNum: 2,
    title: 'Planning horizon & active audit year',
    description:
      'Confirm the multi-year planning window (default 2026–2028) and the active plan year shown on the Overview and Annual Plan.',
    status: 'Done' as 'Done' | 'In progress' | 'To do',
    summary: 'Active plan year: 2026 (3-year horizon)',
    note: '',
    actionLabel: 'Open →',
    targetTab: 'annual-plan' as MainTabId,
  },
  {
    id: 'am-1',
    group: '2. Audit methodology & risk scoring',
    stepNum: 3,
    title: 'Inherent risk matrix (Likelihood × Impact)',
    description:
      'Review the 5×5 scoring thresholds (High ≥ 15, Medium ≥ 8, Low < 8) and risk rating definitions.',
    status: 'Done' as 'Done' | 'In progress' | 'To do',
    summary: '5×5 matrix · 3 risk tiers configured',
    note: '',
    actionLabel: 'Open →',
    targetTab: 'universe' as MainTabId,
  },
  {
    id: 'am-2',
    group: '2. Audit methodology & risk scoring',
    stepNum: 4,
    title: 'Risk-based audit cycle frequencies',
    description:
      'Set how many months may elapse before an entity becomes due for re-audit based on its inherent risk rating.',
    status: 'Done' as 'Done' | 'In progress' | 'To do',
    summary: 'High 12m · Medium 24m · Low 36m',
    note: '',
    actionLabel: 'Open →',
    targetTab: 'settings' as MainTabId,
  },
  {
    id: 'am-3',
    group: '2. Audit methodology & risk scoring',
    stepNum: 5,
    title: 'Engagement sizing, hours & capacity defaults',
    description:
      'Configure working days, calendar span, team size, and budgeted hours per engagement size (Small, Medium, Large, Extra-large) plus annual auditor capacity.',
    status: 'Done' as 'Done' | 'In progress' | 'To do',
    summary: '8 h/day · 220 days/auditor/yr (1,760 h)',
    note: '',
    actionLabel: 'Open →',
    targetTab: 'settings' as MainTabId,
  },
  {
    id: 'md-1',
    group: '3. Master data & directories',
    stepNum: 6,
    title: 'Entity types & audit categories',
    description:
      'Define the classification lists used in the Audit Universe and Annual Plan (e.g., Department, Branch, Product / process, IT system, Vendor; Operations, Credit review, IT audit, etc.).',
    status: 'Done' as 'Done' | 'In progress' | 'To do',
    summary: '5 entity types · 7 audit categories',
    note: '',
    actionLabel: 'Open →',
    targetTab: 'master-data' as MainTabId,
  },
  {
    id: 'md-2',
    group: '3. Master data & directories',
    stepNum: 7,
    title: 'Internal Audit team & specialisations',
    description:
      'Register all internal auditors, their roles, email addresses, and category specialisations so auto-assignment and independent review routing work.',
    status: 'Done' as 'Done' | 'In progress' | 'To do',
    summary: '9 auditors in directory',
    note: '',
    actionLabel: 'Open →',
    targetTab: 'master-data' as MainTabId,
  },
  {
    id: 'md-3',
    group: '3. Master data & directories',
    stepNum: 8,
    title: 'Auditee directory (departments, units & unit heads)',
    description:
      'Maintain the list of business units, branch regions, and unit heads who receive notifications, inquiries, draft findings, and action-plan assignments.',
    status: 'Done' as 'Done' | 'In progress' | 'To do',
    summary: '20 auditee units registered',
    note: '',
    actionLabel: 'Open →',
    targetTab: 'master-data' as MainTabId,
  },
  {
    id: 'md-4',
    group: '3. Master data & directories',
    stepNum: 9,
    title: 'Signatories & approval hierarchy',
    description:
      'Confirm who acts as Chief Audit Executive, Audit Division Head, Audit Supervisor, and independent reviewers for audit review and sign-off.',
    status: 'Done' as 'Done' | 'In progress' | 'To do',
    summary: '1 CAE · 2 Audit Managers',
    note: '',
    actionLabel: 'Open →',
    targetTab: 'access' as MainTabId,
  },
  {
    id: 'up-1',
    group: '4. Audit Universe & Annual Plan baseline',
    stepNum: 10,
    title: 'Populate the Audit Universe & last-audited dates',
    description:
      'Import or enter all auditable departments, branches, products/processes, IT systems, and vendors together with their inherent risk scores and last audit dates.',
    status: 'Done' as 'Done' | 'In progress' | 'To do',
    summary: '160 auditable entities using High, Medium, and Low risk tiers',
    note: '',
    actionLabel: 'Open →',
    targetTab: 'universe' as MainTabId,
  },
  {
    id: 'up-2',
    group: '4. Audit Universe & Annual Plan baseline',
    stepNum: 11,
    title: 'Generate & balance the Annual Audit Plan',
    description:
      'Auto-populate due audits from the Universe, assign leads and reviewers, balance hours across quarters, and export the Audit Committee plan package.',
    status: 'Done' as 'Done' | 'In progress' | 'To do',
    summary: '20 engagements across plan years',
    note: '',
    actionLabel: 'Open →',
    targetTab: 'annual-plan' as MainTabId,
  },
  {
    id: 'up-3',
    group: '4. Audit Universe & Annual Plan baseline',
    stepNum: 12,
    title: 'Seed historical open issues for follow-up tracking',
    description:
      'Load any prior-year open audit findings, action owners, and target remediation dates so Stage 06 Follow-up & Closure reflects your live backlog.',
    status: 'Done' as 'Done' | 'In progress' | 'To do',
    summary: '9 issues tracked (9 open)',
    note: '',
    actionLabel: 'Open →',
    targetTab: 'issues' as MainTabId,
  },
  {
    id: 'ac-1',
    group: '5. Access control & go-live',
    stepNum: 13,
    title: 'User accounts & role-based access control',
    description:
      'Verify user accounts, roles (System administrator, CAE, Audit Division Head, Audit Supervisor, reviewers, executives, committee members, and issue owners), and engagement/unit scopes before activating RBAC.',
    status: 'Done' as 'Done' | 'In progress' | 'To do',
    summary: '13 active accounts · Enforcement: Simulated',
    note: '',
    actionLabel: 'Open →',
    targetTab: 'access' as MainTabId,
  },
  {
    id: 'ac-2',
    group: '5. Access control & go-live',
    stepNum: 14,
    title: 'Remove sample data & take a baseline backup',
    description:
      'Once your real master data and universe are loaded, export a JSON backup from Settings so the baseline configuration can be restored at any time.',
    status: 'Done' as 'Done' | 'In progress' | 'To do',
    summary: 'Backup & restore available in Settings',
    note: '',
    actionLabel: 'Open →',
    targetTab: 'settings' as MainTabId,
  },
];

const DEFAULT_ACCESS_USERS = [
  {
    id: 'acc-1',
    name: 'M. Santos',
    title: 'Chief Audit Executive · Internal Audit',
    email: 'm.santos@citysavings.com.ph',
    roles: ['System administrator', 'Chief Audit Executive'],
    scope: 'Full access',
    status: 'Active',
    employeeNumber: 'EMP-001',
    dateGranted: '2026-01-15',
    lastModified: '2026-01-15',
    lastLoginDate: '—',
    failedLoginCount: 0,
    isLocked: false,
    requiresPasswordChange: false,
    mfaEnabled: true,
    isPrivileged: true,
  },
  {
    id: 'acc-cm',
    name: 'Christian John Macahilig',
    title: 'Chief Audit Executive · Internal Audit',
    email: 'christian.macahilig@citysavings.com.ph',
    roles: ['System administrator', 'Chief Audit Executive'],
    scope: 'Full access',
    status: 'Active',
    employeeNumber: 'CSB-00001',
    dateGranted: '2026-01-15',
    lastModified: '2026-01-15',
    lastLoginDate: '—',
    failedLoginCount: 0,
    isLocked: false,
    requiresPasswordChange: false,
    mfaEnabled: true,
    isPrivileged: true,
  },
  {
    id: 'acc-2',
    name: 'J. Dela Cruz',
    title: 'Audit Division Head · Internal Audit',
    email: 'j.delacruz@citysavings.com.ph',
    roles: ['System administrator', 'Audit Division Head'],
    scope: 'Full access',
    status: 'Active',
    employeeNumber: 'EMP-002',
    dateGranted: '2026-01-15',
    lastModified: '2026-01-15',
    lastLoginDate: '—',
    failedLoginCount: 0,
    isLocked: false,
    requiresPasswordChange: false,
    mfaEnabled: true,
    isPrivileged: true,
  },
  {
    id: 'acc-3',
    name: 'A. Villanueva',
    title: 'Audit Supervisor · Internal Audit',
    email: 'a.villanueva@citysavings.com.ph',
    roles: ['Audit Supervisor'],
    scope: 'Assigned + team engagements',
    status: 'Active',
    employeeNumber: 'EMP-003',
    dateGranted: '2026-01-15',
    lastModified: '2026-01-15',
    lastLoginDate: '—',
    failedLoginCount: 0,
    isLocked: false,
    requiresPasswordChange: false,
    mfaEnabled: false,
    isPrivileged: false,
  },
  {
    id: 'acc-4',
    name: 'P. Mendoza',
    title: 'Audit-in-Charge · Internal Audit',
    email: 'p.mendoza@citysavings.com.ph',
    roles: ['Audit-in-Charge'],
    scope: 'Assigned engagements (AUD-2026-006)',
    status: 'Active',
    employeeNumber: 'EMP-004',
    dateGranted: '2026-01-15',
    lastModified: '2026-01-15',
    lastLoginDate: '—',
    failedLoginCount: 0,
    isLocked: false,
    requiresPasswordChange: false,
    mfaEnabled: false,
    isPrivileged: false,
  },
  {
    id: 'acc-5',
    name: 'K. Lim',
    title: 'Assisting Auditor · Internal Audit',
    email: 'k.lim@citysavings.com.ph',
    roles: ['Assisting Auditor'],
    scope: 'Assigned engagements (AUD-2026-004, AUD-2026-005, AUD-2026-007)',
    status: 'Active',
    employeeNumber: 'EMP-005',
    dateGranted: '2026-01-15',
    lastModified: '2026-01-15',
    lastLoginDate: '—',
    failedLoginCount: 0,
    isLocked: false,
    requiresPasswordChange: false,
    mfaEnabled: false,
    isPrivileged: false,
  },
  {
    id: 'acc-6',
    name: 'D. Ramos',
    title: 'Assisting Auditor · Internal Audit',
    email: 'd.ramos@citysavings.com.ph',
    roles: ['Assisting Auditor'],
    scope: 'Assigned engagements (AUD-2027-003)',
    status: 'Active',
    employeeNumber: 'EMP-006',
    dateGranted: '2026-01-15',
    lastModified: '2026-01-15',
    lastLoginDate: '—',
    failedLoginCount: 0,
    isLocked: false,
    requiresPasswordChange: false,
    mfaEnabled: false,
    isPrivileged: false,
  },
  {
    id: 'acc-7',
    name: 'B. Tolentino',
    title: 'Assisting Auditor · Internal Audit',
    email: 'b.tolentino@citysavings.com.ph',
    roles: ['Assisting Auditor'],
    scope: 'Assigned engagements (AUD-2026-003, AUD-2027-001)',
    status: 'Active',
    employeeNumber: 'EMP-007',
    dateGranted: '2026-01-15',
    lastModified: '2026-01-15',
    lastLoginDate: '—',
    failedLoginCount: 0,
    isLocked: false,
    requiresPasswordChange: false,
    mfaEnabled: false,
    isPrivileged: false,
  },
  {
    id: 'acc-8',
    name: 'R. Garcia',
    title: 'Assisting Auditor · Internal Audit',
    email: 'r.garcia@citysavings.com.ph',
    roles: ['Assisting Auditor'],
    scope: 'Assigned engagements (AUD-2026-001, AUD-2027-002)',
    status: 'Active',
    employeeNumber: 'EMP-008',
    dateGranted: '2026-01-15',
    lastModified: '2026-01-15',
    lastLoginDate: '—',
    failedLoginCount: 0,
    isLocked: false,
    requiresPasswordChange: false,
    mfaEnabled: false,
    isPrivileged: false,
  },
  {
    id: 'acc-9',
    name: 'L. Fernandez',
    title: 'Assisting Auditor · Internal Audit',
    email: 'l.fernandez@citysavings.com.ph',
    roles: ['Assisting Auditor'],
    scope: 'Assigned engagements (AUD-2026-002)',
    status: 'Active',
    employeeNumber: 'EMP-009',
    dateGranted: '2026-01-15',
    lastModified: '2026-01-15',
    lastLoginDate: '—',
    failedLoginCount: 0,
    isLocked: false,
    requiresPasswordChange: false,
    mfaEnabled: false,
    isPrivileged: false,
  },
  {
    id: 'acc-10',
    name: 'R. Bautista',
    title: 'VP, Operations · Operations',
    email: 'r.bautista@citysavings.com.ph',
    roles: ['Issue Owner (auditee)'],
    scope: 'Operations · Cash & clearing · Operations · Billing & collection',
    status: 'Active',
    employeeNumber: 'EMP-010',
    dateGranted: '2026-01-15',
    lastModified: '2026-01-15',
    lastLoginDate: '—',
    failedLoginCount: 0,
    isLocked: false,
    requiresPasswordChange: false,
    mfaEnabled: false,
    isPrivileged: false,
  },
  {
    id: 'acc-11',
    name: 'E. Navarro',
    title: 'VP, Chief Information Officer · Information Technology',
    email: 'e.navarro@citysavings.com.ph',
    roles: ['Issue Owner (auditee)'],
    scope: 'IT · Core banking (Temenos T24) · IT · Digital channels · IT · Payment switches',
    status: 'Active',
    employeeNumber: 'EMP-011',
    dateGranted: '2026-01-15',
    lastModified: '2026-01-15',
    lastLoginDate: '—',
    failedLoginCount: 0,
    isLocked: false,
    requiresPasswordChange: false,
    mfaEnabled: false,
    isPrivileged: false,
  },
  {
    id: 'acc-12',
    name: 'V. Pascual',
    title: 'VP, Consumer & Teacher Lending · Lending',
    email: 'v.pascual@citysavings.com.ph',
    roles: ['Issue Owner (auditee)'],
    scope: 'Lending · Salary loans · Lending · Product governance',
    status: 'Active',
    employeeNumber: 'EMP-012',
    dateGranted: '2026-01-15',
    lastModified: '2026-01-15',
    lastLoginDate: '—',
    failedLoginCount: 0,
    isLocked: false,
    requiresPasswordChange: false,
    mfaEnabled: false,
    isPrivileged: false,
  },
  {
    id: 'acc-13',
    name: 'C. Dizon',
    title: 'Chief Compliance Officer · Compliance',
    email: 'c.dizon@citysavings.com.ph',
    roles: ['Issue Owner (auditee)'],
    scope: 'Compliance · AML / CFT',
    status: 'Active',
    employeeNumber: 'EMP-013',
    dateGranted: '2026-01-15',
    lastModified: '2026-01-15',
    lastLoginDate: '—',
    failedLoginCount: 0,
    isLocked: false,
    requiresPasswordChange: false,
    mfaEnabled: false,
    isPrivileged: false,
  },
];

export interface MatrixRow {
  capability: string;
  sysAdmin: string;
  cae: string;
  divHead: string;
  supervising: string;
  inCharge: string;
  assisting: string;
  auditee: string;
  rolePermissions?: Record<string, string>;
}

const getMatrixValue = (row: MatrixRow, role: AppRoleDefinition): string => {
  if (row.rolePermissions?.[role.name] !== undefined) return row.rolePermissions[role.name];
  if (role.accessRole === 'Executive Viewer' || role.accessRole === 'Audit Committee Member') {
    return row.capability.startsWith('System Setup,') ||
      row.capability.startsWith('User Accounts & Role Assignments')
      ? '—'
      : 'View';
  }
  const matrixField: Record<AppRole, keyof MatrixRow> = {
    'System administrator': 'sysAdmin',
    'Chief Audit Executive': 'cae',
    'Audit Division Head': 'divHead',
    'Audit Supervisor': 'supervising',
    'Independent Reviewer': 'supervising',
    'Audit-in-Charge': 'inCharge',
    'Assisting Auditor': 'assisting',
    'Audit Committee Member': 'auditee',
    'Executive Viewer': 'auditee',
    'Group Head (auditee)': 'auditee',
    'Department Head (auditee)': 'auditee',
    'Issue Owner (auditee)': 'auditee',
  };
  const value = row[matrixField[role.accessRole]];
  return typeof value === 'string' ? value : '—';
};

export const DEFAULT_ROLE_PERMISSIONS_MATRIX: MatrixRow[] = [
  { capability: 'System Setup, Master Data & Settings', sysAdmin: 'Full', cae: 'Full', divHead: 'View', supervising: 'View', inCharge: '—', assisting: '—', auditee: '—' },
  { capability: 'User Accounts & Role Assignments (Access)', sysAdmin: 'Full', cae: 'View', divHead: '—', supervising: '—', inCharge: '—', assisting: '—', auditee: '—' },
  { capability: 'Audit Universe & Inherent Risk Scoring', sysAdmin: 'Full', cae: 'Full', divHead: 'Edit', supervising: 'Edit', inCharge: 'View', assisting: 'View', auditee: '—' },
  { capability: 'Annual Audit Plan & Budgeted Hours', sysAdmin: 'Full', cae: 'Approve & Edit', divHead: 'Propose & Edit', supervising: 'Propose', inCharge: 'View', assisting: 'View', auditee: '—' },
  { capability: 'Stage 02 Notification & Kickoff Memo', sysAdmin: 'Full', cae: 'Issue & Sign', divHead: 'Review & Sign', supervising: 'Review', inCharge: 'Draft', assisting: 'Draft (assigned)', auditee: 'Receive & Acknowledge' },
  { capability: 'Stage 03 Working Papers — Prepare & Submit', sysAdmin: 'Full', cae: 'View all', divHead: 'Review / Reassign', supervising: 'Review / Reassign', inCharge: 'Lead & Prepare', assisting: 'Assigned audit tests', auditee: 'Respond to inquiries' },
  { capability: 'Stage 03 Tier 1 Independent Quality Review', sysAdmin: 'Configure', cae: 'Override', divHead: 'Approve / Return', supervising: 'Approve / Return', inCharge: 'Review notes', assisting: 'Peer reviewer only', auditee: '—' },
  { capability: 'Stage 03 Tier 2 Head of Internal Audit Sign-Off', sysAdmin: 'Configure', cae: 'Final Sign-Off', divHead: 'Sign-Off', supervising: 'Recommend', inCharge: '—', assisting: '—', auditee: '—' },
  { capability: 'Stage 04 Exit Conference & Management Responses', sysAdmin: 'Full', cae: 'Approve', divHead: 'Lead & Facilitate', supervising: 'Facilitate', inCharge: 'Present findings', assisting: 'Record minutes', auditee: 'Submit action plan & target date' },
  { capability: 'Stage 05 Final Audit Report Issuance', sysAdmin: 'Full', cae: 'Approve & Issue', divHead: 'Final Review', supervising: 'Review draft', inCharge: 'Compile draft', assisting: 'Compile draft', auditee: 'Read issued report' },
  { capability: 'Stage 06 Follow-up, Extensions & Issue Closure', sysAdmin: 'Full', cae: 'Close Critical/High', divHead: 'Verify & Close', supervising: 'Verify', inCharge: 'Test remediation', assisting: 'Test remediation', auditee: 'Upload remediation evidence' },
];

export const MasterDataSetupAccessView: React.FC<{
  tab: 'master-data' | 'setup' | 'access';
  currentUser: UserProfile;
  onChangeUser: (u: UserProfile) => void;
  userProfiles: UserProfile[];
  accessActive?: boolean;
  onToggleAccess?: () => void;
  onSelectTab?: (tab: MainTabId) => void;
  onAddUserProfile?: (user: UserProfile) => void;
  onUpdateUserProfile?: (user: UserProfile) => void;
  onDeleteUserProfile?: (id: string) => void;
  onResetSystemForUAT?: () => Promise<void> | void;
}> = ({
  tab,
  currentUser,
  onChangeUser,
  userProfiles,
  accessActive,
  onToggleAccess,
  onSelectTab,
  onAddUserProfile,
  onUpdateUserProfile,
  onDeleteUserProfile,
  onResetSystemForUAT,
}) => {
  const isSystemAdmin =
    Boolean(currentUser.headerSubtitle?.includes('System administrator')) ||
    Boolean(currentUser.roleTitle?.includes('System administrator'));

  // ── Master data state with persistence ─────────────────────────────────────
  const [entityTypes, setEntityTypes] = useState<string[]>(DEFAULT_ENTITY_TYPES);
  const [newEntityType, setNewEntityType] = useState('');
  const [editingEntityType, setEditingEntityType] = useState<string | null>(null);
  const [editingEntityValue, setEditingEntityValue] = useState('');

  const [auditCategories, setAuditCategories] = useState<string[]>(DEFAULT_AUDIT_CATEGORIES);
  const [newAuditCategory, setNewAuditCategory] = useState('');
  const [editingCategory, setEditingCategory] = useState<string | null>(null);
  const [editingCategoryValue, setEditingCategoryValue] = useState('');

  const [auditorsList, setAuditorsList] = useState<AuditorRecord[]>(DEFAULT_AUDITORS);
  const [auditorSearch, setAuditorSearch] = useState('');
  const [auditeeDirectory, setAuditeeDirectory] = useState<AuditeeUnitRecord[]>(DEFAULT_AUDITEE_DIRECTORY);

  // 14 Setup steps across 5 groups matching Audit-Management-System (8).png & (12).png
  const [setupItems, setSetupItems] = useState(DEFAULT_SETUP_ITEMS);
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [draftNote, setDraftNote] = useState('');

  // ── Modal State for Auditors ───────────────────────────────────────────────
  const [showAuditorModal, setShowAuditorModal] = useState(false);
  const [editingAuditorEmail, setEditingAuditorEmail] = useState<string | null>(null);
  const [auditorFormName, setAuditorFormName] = useState('');
  const [auditorFormRole, setAuditorFormRole] = useState('Senior Operations Auditor');
  const [auditorFormEmail, setAuditorFormEmail] = useState('');
  const [auditorFormSkills, setAuditorFormSkills] = useState('');

  // ── Modal State for Auditee Directory ──────────────────────────────────────
  const [showAuditeeModal, setShowAuditeeModal] = useState(false);
  const [editingAuditeeUnit, setEditingAuditeeUnit] = useState<string | null>(null);
  const [auditeeFormUnit, setAuditeeFormUnit] = useState('');
  const [auditeeFormHead, setAuditeeFormHead] = useState('');
  const [auditeeFormTitle, setAuditeeFormTitle] = useState('VP, Operations');
  const [auditeeFormEmail, setAuditeeFormEmail] = useState('');
  const [auditeeFormReportsTo, setAuditeeFormReportsTo] = useState('');
  const [auditeeFormIsActive, setAuditeeFormIsActive] = useState(true);

  const [configurableLists, setConfigurableLists] = useState(DEFAULT_CONFIGURABLE_LISTS);
  const [newLookupValues, setNewLookupValues] = useState<Record<ConfigurableListKey, string>>({
    departments: '',
    audit_types: '',
    finding_severities: '',
    report_ratings: '',
    signatories: '',
    audit_statuses: '',
  });

  // ── Access Users state & sync with DB profiles ─────────────────────────────
  const [accessUsers, setAccessUsers] = useState(DEFAULT_ACCESS_USERS);
  const [userSearchQuery, setUserSearchQuery] = useState('');
  const [userTypeFilter, setUserTypeFilter] = useState('All types');
  const [userRoleFilter, setUserRoleFilter] = useState('All roles');
  const [userStatusFilter, setUserStatusFilter] = useState('All statuses');
  const [roleDefinitions, setRoleDefinitions] = useState<AppRoleDefinition[]>(DEFAULT_ROLE_DEFINITIONS);
  const [newRoleName, setNewRoleName] = useState('');
  const [newRoleAccess, setNewRoleAccess] = useState<AppRole>('Assisting Auditor');

  // ── Edit Access Modal State ────────────────────────────────────────────────
  const [editingAccessUser, setEditingAccessUser] = useState<any | null>(null);
  const [editFormName, setEditFormName] = useState('');
  const [editFormEmail, setEditFormEmail] = useState('');
  const [editFormRole, setEditFormRole] = useState('Assisting Auditor');
  const [editFormScope, setEditFormScope] = useState('');
  const [editFormStatus, setEditFormStatus] = useState('Active');
  const [editFormEmpNo, setEditFormEmpNo] = useState('');
  const [editFormMfa, setEditFormMfa] = useState(false);
  const [editFormPrivileged, setEditFormPrivileged] = useState(false);

  // ── Configurable Role Permissions Matrix ───────────────────────────────────
  const [matrixRows, setMatrixRows] = useState<MatrixRow[]>(DEFAULT_ROLE_PERMISSIONS_MATRIX);
  const [isEditingMatrix, setIsEditingMatrix] = useState(false);
  const [newMatrixCapability, setNewMatrixCapability] = useState('');

  // ── Load persisted master data & setup checklist on mount ───────────────────
  useEffect(() => {
    fetchMasterData('app_roles', DEFAULT_ROLE_DEFINITIONS).then((roles) => {
      if (Array.isArray(roles) && roles.length > 0) setRoleDefinitions(roles);
    });
    fetchMasterData('entity_types', DEFAULT_ENTITY_TYPES).then(setEntityTypes);
    fetchMasterData('audit_categories', DEFAULT_AUDIT_CATEGORIES).then(setAuditCategories);
    fetchMasterData('auditors', DEFAULT_AUDITORS).then(setAuditorsList);
    fetchMasterData('auditee_directory', DEFAULT_AUDITEE_DIRECTORY).then((dirs) =>
      setAuditeeDirectory(normalizeAuditeeDirectory(dirs))
    );
    CONFIGURABLE_LISTS.forEach(({ key }) => {
      fetchMasterData(key, DEFAULT_CONFIGURABLE_LISTS[key]).then((values) => {
        setConfigurableLists((prev) => ({ ...prev, [key]: values }));
      });
    });
    fetchMasterData('setup_checklist', DEFAULT_SETUP_ITEMS).then(setSetupItems);
    fetchMasterData('access_users_registry', DEFAULT_ACCESS_USERS).then((saved) => {
      if (saved && Array.isArray(saved) && saved.length > 0) {
        setAccessUsers(saved);
      }
    });
    fetchMasterData('role_permissions_matrix', DEFAULT_ROLE_PERMISSIONS_MATRIX).then((saved) => {
      if (saved && Array.isArray(saved) && saved.length > 0) {
        setMatrixRows(saved);
      }
    });
  }, []);

  // Sync access users whenever userProfiles from Supabase change
  useEffect(() => {
    if (userProfiles && userProfiles.length > 0) {
      const dbUsers = userProfiles.map((p) => {
        // Priority for user email:
        // 1. Explicit profile email
        // 2. Existing email in accessUsers or saved registry
        // 3. Fallback CitySavings Bank corporate email
        const existing = accessUsers.find(
          (u) => u.id === p.id || u.name.toLowerCase() === p.name.toLowerCase()
        );
        const resolvedEmail =
          p.email ||
          existing?.email ||
          `${p.name.toLowerCase().replace(/[^a-z0-9]/g, '.')}@citysavings.com.ph`;

        return {
          id: p.id,
          name: p.name,
          title: `${p.roleTitle || 'Internal Auditor'} · ${p.department || 'Internal Audit'}`,
          email: resolvedEmail,
          roles: (() => {
            if (p.headerSubtitle) {
              const configured = roleDefinitions.find(
                (role) => role.name.toLowerCase() === p.headerSubtitle?.toLowerCase()
              );
              return [configured?.name ?? normalizeRole(p.headerSubtitle)];
            }
            if (p.canApproveCAE) return ['Chief Audit Executive'];
            if (p.canApproveHead) return ['Chief Audit Executive'];
            if (p.canApproveIndependent) return ['Audit Division Head'];
            if (p.roleTitle?.toLowerCase().includes('division head')) return ['Audit Division Head'];
            if (p.roleTitle?.toLowerCase().includes('supervising') || p.roleTitle?.toLowerCase().includes('audit supervisor')) return ['Audit Supervisor'];
            if (p.roleTitle?.toLowerCase().includes('charge') || p.roleTitle?.toLowerCase().includes('aic')) return ['Audit-in-Charge'];
            if (p.roleTitle?.toLowerCase().includes('manager')) return ['Audit Division Head'];
            if (p.roleTitle?.toLowerCase().includes('auditee')) return ['Issue Owner (auditee)'];
            return ['Assisting Auditor'];
          })(),
          scope: p.department === 'Internal Audit' ? 'Full access' : `${p.department} operations`,
          status: p.accountStatus || 'Active',
          employeeNumber: p.employeeNumber || 'EMP-DB',
          dateGranted: '2026-01-15',
          lastModified: '2026-01-15',
          lastLoginDate: '—',
          failedLoginCount: p.failedLoginCount || 0,
          isLocked: p.isLocked || false,
          requiresPasswordChange: p.requiresPasswordChange || false,
          mfaEnabled: p.mfaEnabled || false,
          isPrivileged: p.isPrivileged || false,
        };
      });

      // Merge ensuring DB profiles are prioritized and baseline accounts are retained
      const merged: any[] = [...dbUsers];
      DEFAULT_ACCESS_USERS.forEach((def) => {
        if (!merged.some((m) => m.name.toLowerCase() === def.name.toLowerCase() || m.id === def.id)) {
          merged.push(def);
        }
      });
      setAccessUsers(merged as any);
      saveMasterData('access_users_registry', merged);
    }
  }, [userProfiles, roleDefinitions]);

  // ── Access tab local security state ────────────────────────────────────────
  const [accessNotice, setAccessNotice] = useState<{ type: 'success' | 'error'; msg: string } | null>(null);
  const [showAddUserForm, setShowAddUserForm] = useState(false);
  const [newUserName, setNewUserName] = useState('');
  const [newUserEmail, setNewUserEmail] = useState('');
  const [newUserEmployeeNo, setNewUserEmployeeNo] = useState('');
  const [newUserRole, setNewUserRole] = useState('Assisting Auditor');
  const [newUserScope, setNewUserScope] = useState('');
  const [newUserPassword, setNewUserPassword] = useState('');
  const [showNewUserPassword, setShowNewUserPassword] = useState(false);
  const [newUserNameError, setNewUserNameError] = useState('');
  const [newUserFormError, setNewUserFormError] = useState('');
  const [resetTargetId, setResetTargetId] = useState<string | null>(null);
  const [generatedTempPw, setGeneratedTempPw] = useState('');
  const [showTempPw, setShowTempPw] = useState(false);
  const [loginSimUser, setLoginSimUser] = useState('');
  const [loginSimPw, setLoginSimPw] = useState('');
  const [showLoginSimPw, setShowLoginSimPw] = useState(false);
  const [loginSimError, setLoginSimError] = useState('');
  const [loginSimSuccess, setLoginSimSuccess] = useState('');

  const notifyAccess = (type: 'success' | 'error', msg: string) => {
    setAccessNotice({ type, msg });
    setTimeout(() => setAccessNotice(null), 4500);
  };

  // ── Handlers: Entity Types ─────────────────────────────────────────────────
  const handleAddEntityType = () => {
    if (!newEntityType.trim()) return;
    const trimmed = newEntityType.trim();
    if (entityTypes.includes(trimmed)) return;
    const updated = [...entityTypes, trimmed];
    setEntityTypes(updated);
    saveMasterData('entity_types', updated);
    setNewEntityType('');
  };

  const handleRemoveEntityType = (et: string) => {
    const updated = entityTypes.filter((item) => item !== et);
    setEntityTypes(updated);
    saveMasterData('entity_types', updated);
  };

  const handleStartEditEntityType = (et: string) => {
    setEditingEntityType(et);
    setEditingEntityValue(et);
  };

  const handleSaveEditEntityType = (oldVal: string) => {
    const trimmed = editingEntityValue.trim();
    if (!trimmed || trimmed === oldVal) {
      setEditingEntityType(null);
      return;
    }
    const updated = entityTypes.map((item) => (item === oldVal ? trimmed : item));
    setEntityTypes(updated);
    saveMasterData('entity_types', updated);
    setEditingEntityType(null);
  };

  // ── Handlers: Audit Categories ─────────────────────────────────────────────
  const handleAddAuditCategory = () => {
    if (!newAuditCategory.trim()) return;
    const trimmed = newAuditCategory.trim();
    if (auditCategories.includes(trimmed)) return;
    const updated = [...auditCategories, trimmed];
    setAuditCategories(updated);
    saveMasterData('audit_categories', updated);
    setNewAuditCategory('');
  };

  const handleRemoveAuditCategory = (cat: string) => {
    const updated = auditCategories.filter((item) => item !== cat);
    setAuditCategories(updated);
    saveMasterData('audit_categories', updated);
  };

  const handleStartEditCategory = (cat: string) => {
    setEditingCategory(cat);
    setEditingCategoryValue(cat);
  };

  const handleSaveEditCategory = (oldVal: string) => {
    const trimmed = editingCategoryValue.trim();
    if (!trimmed || trimmed === oldVal) {
      setEditingCategory(null);
      return;
    }
    const updated = auditCategories.map((item) => (item === oldVal ? trimmed : item));
    setAuditCategories(updated);
    saveMasterData('audit_categories', updated);
    setEditingCategory(null);
  };

  // ── Handlers: Edit Access Modal ────────────────────────────────────────────
  const handleOpenEditAccess = (usr: any) => {
    setEditingAccessUser(usr);
    setEditFormName(usr.name);
    setEditFormEmail(usr.email || '');
    const assignedRole = usr.roles[0] || 'Assisting Auditor';
    setEditFormRole(
      roleDefinitions.some((role) => role.name === assignedRole)
        ? assignedRole
        : normalizeRole(assignedRole)
    );
    setEditFormScope(usr.scope || 'Assigned engagements');
    setEditFormStatus(usr.status || 'Active');
    setEditFormEmpNo((usr as any).employeeNumber || '');
    setEditFormMfa(Boolean((usr as any).mfaEnabled));
    setEditFormPrivileged(Boolean((usr as any).isPrivileged));
  };

  const handleSaveEditAccess = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingAccessUser) return;

    const targetId = editingAccessUser.id;
    const accessRole = normalizeRole(editFormRole);
    const canApproveHead = accessRole === 'Chief Audit Executive' || accessRole === 'System administrator';
    const canApproveIndependent = ['Audit Division Head', 'Audit Supervisor', 'Independent Reviewer'].includes(accessRole);
    const canApproveCAE = accessRole === 'Chief Audit Executive';
    const updatedEmail = editFormEmail.trim() || editingAccessUser.email;

    setAccessUsers((prev) => {
      const updated = prev.map((item) => {
        if (item.id !== targetId) return item;
        return {
          ...item,
          name: editFormName.trim() || item.name,
          email: updatedEmail,
          roles: [editFormRole],
          title: `${editFormRole} · Internal Audit`,
          scope: editFormScope.trim() || item.scope,
          status: editFormStatus,
          employeeNumber: editFormEmpNo.trim() || item.employeeNumber,
          mfaEnabled: editFormMfa,
          isPrivileged: editFormPrivileged,
          lastModified: new Date().toISOString().slice(0, 10),
        } as any;
      });
      saveMasterData('access_users_registry', updated);
      return updated;
    });

    if (onUpdateUserProfile) {
      onUpdateUserProfile({
        id: targetId,
        name: editFormName.trim() || editingAccessUser.name,
        email: updatedEmail,
        roleTitle: `${editFormRole} (Internal Audit)`,
        fullLabel: `${editFormName.trim() || editingAccessUser.name} – ${editFormRole}`,
        headerSubtitle: editFormRole,
        department: 'Internal Audit',
        canApproveHead,
        canApproveIndependent,
        canApproveCAE,
        accountStatus: editFormStatus === 'Active' ? 'Active' : 'Inactive',
        employeeNumber: editFormEmpNo.trim() || editingAccessUser.employeeNumber,
        mfaEnabled: editFormMfa,
        isPrivileged: editFormPrivileged,
      });
    }

    notifyAccess('success', `Access rights and account profile updated for "${editFormName.trim() || editingAccessUser.name}".`);
    setEditingAccessUser(null);
  };

  // ── Handlers: Role Permissions Matrix ──────────────────────────────────────
  const handleMatrixCellChange = (rowIdx: number, roleName: string, val: string) => {
    setMatrixRows((prev) => {
      const updated = [...prev];
      updated[rowIdx] = {
        ...updated[rowIdx],
        rolePermissions: { ...updated[rowIdx].rolePermissions, [roleName]: val },
      };
      return updated;
    });
  };

  const handleSaveMatrix = () => {
    saveMasterData('role_permissions_matrix', matrixRows);
    setIsEditingMatrix(false);
    notifyAccess('success', 'Role permission matrix successfully saved and updated in system configuration.');
  };

  const handleAddRole = () => {
    const name = newRoleName.trim();
    if (!name || roleDefinitions.some((role) => role.name.toLowerCase() === name.toLowerCase())) {
      notifyAccess('error', 'Enter a unique role name before adding it.');
      return;
    }
    const updated = [...roleDefinitions, { name, accessRole: newRoleAccess }];
    setRoleDefinitions(updated);
    saveMasterData('app_roles', updated);
    setNewRoleName('');
    notifyAccess('success', `Role "${name}" added with ${newRoleAccess} access.`);
  };

  const handleRemoveRole = (role: AppRoleDefinition) => {
    if (role.builtIn) return;
    if (accessUsers.some((user) => user.roles.includes(role.name))) {
      notifyAccess('error', `Reassign users from "${role.name}" before removing this role.`);
      return;
    }
    const updated = roleDefinitions.filter((item) => item.name !== role.name);
    setRoleDefinitions(updated);
    saveMasterData('app_roles', updated);
    notifyAccess('success', `Role "${role.name}" removed.`);
  };

  const handleUpdateRoleAccess = (roleName: string, accessRole: AppRole) => {
    const updated = roleDefinitions.map((role) =>
      role.name === roleName ? { ...role, accessRole } : role
    );
    setRoleDefinitions(updated);
    saveMasterData('app_roles', updated);
    notifyAccess('success', `Access template for "${roleName}" updated to ${accessRole}.`);
  };

  const handleResetMatrix = () => {
    setMatrixRows(DEFAULT_ROLE_PERMISSIONS_MATRIX);
    saveMasterData('role_permissions_matrix', DEFAULT_ROLE_PERMISSIONS_MATRIX);
    setIsEditingMatrix(false);
    notifyAccess('success', 'Role permission matrix reset to baseline standards.');
  };

  const handleAddMatrixRow = () => {
    if (!newMatrixCapability.trim()) return;
    const newRow: MatrixRow = {
      capability: newMatrixCapability.trim(),
      sysAdmin: 'Full',
      cae: 'Approve',
      divHead: 'Review',
      supervising: 'Review',
      inCharge: 'Lead',
      assisting: 'Perform',
      auditee: 'View',
      rolePermissions: Object.fromEntries(
        roleDefinitions.map((role) => [role.name, getMatrixValue({
          capability: newMatrixCapability.trim(),
          sysAdmin: 'Full',
          cae: 'Approve',
          divHead: 'Review',
          supervising: 'Review',
          inCharge: 'Lead',
          assisting: 'Perform',
          auditee: 'View',
        }, role)])
      ),
    };
    const updated = [...matrixRows, newRow];
    setMatrixRows(updated);
    saveMasterData('role_permissions_matrix', updated);
    setNewMatrixCapability('');
    notifyAccess('success', `Added new capability "${newMatrixCapability.trim()}" to matrix.`);
  };

  // ── Handlers: Auditors List ────────────────────────────────────────────────
  const handleOpenAddAuditor = () => {
    setEditingAuditorEmail(null);
    setAuditorFormName('');
    setAuditorFormRole('Senior Operations Auditor');
    setAuditorFormEmail('');
    setAuditorFormSkills('Operations, Financial, Compliance');
    setShowAuditorModal(true);
  };

  const handleOpenEditAuditor = (aud: AuditorRecord) => {
    setEditingAuditorEmail(aud.email);
    setAuditorFormName(aud.name);
    setAuditorFormRole(aud.role);
    setAuditorFormEmail(aud.email);
    setAuditorFormSkills(aud.skills);
    setShowAuditorModal(true);
  };

  const handleSaveAuditor = (e: React.FormEvent) => {
    e.preventDefault();
    if (!auditorFormName.trim() || !auditorFormEmail.trim()) return;
    const item: AuditorRecord = {
      name: auditorFormName.trim(),
      role: auditorFormRole.trim() || 'Internal Auditor',
      email: auditorFormEmail.trim(),
      skills: auditorFormSkills.trim() || 'General Audit',
    };

    let updated: AuditorRecord[];
    if (editingAuditorEmail) {
      updated = auditorsList.map((a) => (a.email === editingAuditorEmail ? item : a));
    } else {
      updated = [...auditorsList, item];
    }
    setAuditorsList(updated);
    saveMasterData('auditors', updated);
    setShowAuditorModal(false);
  };

  const handleRemoveAuditor = (email: string) => {
    const updated = auditorsList.filter((a) => a.email !== email);
    setAuditorsList(updated);
    saveMasterData('auditors', updated);
  };

  // ── Handlers: Auditee Directory ────────────────────────────────────────────
  const handleOpenAddAuditee = () => {
    setEditingAuditeeUnit(null);
    setAuditeeFormUnit('');
    setAuditeeFormHead('');
    setAuditeeFormTitle('VP, Head of Unit');
    setAuditeeFormEmail('');
    setAuditeeFormReportsTo('');
    setAuditeeFormIsActive(true);
    setShowAuditeeModal(true);
  };

  const handleOpenEditAuditee = (dir: AuditeeUnitRecord) => {
    setEditingAuditeeUnit(dir.unit);
    setAuditeeFormUnit(dir.unit);
    setAuditeeFormHead(dir.head);
    setAuditeeFormTitle(dir.title);
    setAuditeeFormEmail(dir.email);
    setAuditeeFormReportsTo(dir.reportsTo ?? '');
    setAuditeeFormIsActive(dir.isActive ?? true);
    setShowAuditeeModal(true);
  };

  const handleSaveAuditee = (e: React.FormEvent) => {
    e.preventDefault();
    if (!auditeeFormUnit.trim() || !auditeeFormHead.trim()) return;
    const item: AuditeeUnitRecord = {
      unit: auditeeFormUnit.trim(),
      head: auditeeFormHead.trim(),
      title: auditeeFormTitle.trim() || 'Unit Head',
      email: auditeeFormEmail.trim() || 'auditee@citysavings.com.ph',
      reportsTo: auditeeFormReportsTo.trim(),
      isActive: auditeeFormIsActive,
    };

    let updated: AuditeeUnitRecord[];
    if (editingAuditeeUnit) {
      updated = auditeeDirectory.map((d) => (d.unit === editingAuditeeUnit ? item : d));
    } else {
      updated = [...auditeeDirectory, item];
    }
    setAuditeeDirectory(updated);
    saveMasterData('auditee_directory', updated);
    let departments = configurableLists.departments;
    if (editingAuditeeUnit && editingAuditeeUnit !== item.unit) {
      departments = departments.filter((department) =>
        department !== editingAuditeeUnit ||
        updated.some((directoryItem) => directoryItem.unit === editingAuditeeUnit)
      );
    }
    if (!departments.includes(item.unit)) {
      departments = [...departments, item.unit];
    }
    if (departments !== configurableLists.departments) {
      setConfigurableLists((prev) => ({ ...prev, departments }));
      saveMasterData('departments', departments);
    }
    setShowAuditeeModal(false);
  };

  const handleRemoveAuditee = (unit: string) => {
    const updated = auditeeDirectory.filter((d) => d.unit !== unit);
    setAuditeeDirectory(updated);
    saveMasterData('auditee_directory', updated);
  };

  const handleToggleAuditeeStatus = (unit: string) => {
    const updated = auditeeDirectory.map((dir) =>
      dir.unit === unit ? { ...dir, isActive: !(dir.isActive ?? true) } : dir
    );
    setAuditeeDirectory(updated);
    saveMasterData('auditee_directory', updated);
  };

  const handleAddLookupValue = (key: ConfigurableListKey) => {
    const value = newLookupValues[key].trim();
    if (!value || configurableLists[key].some((item) => item.toLowerCase() === value.toLowerCase())) return;
    const updated = [...configurableLists[key], value];
    setConfigurableLists((prev) => ({ ...prev, [key]: updated }));
    saveMasterData(key, updated);
    setNewLookupValues((prev) => ({ ...prev, [key]: '' }));
  };

  const handleRemoveLookupValue = (key: ConfigurableListKey, value: string) => {
    const updated = configurableLists[key].filter((item) => item !== value);
    setConfigurableLists((prev) => ({ ...prev, [key]: updated }));
    saveMasterData(key, updated);
  };

  // ── Handlers: Setup Checklist ──────────────────────────────────────────────
  const handleCycleStatus = (id: string) => {
    setSetupItems((prev) => {
      const updated = prev.map((item) => {
        if (item.id !== id) return item;
        const nextStatus: 'Done' | 'In progress' | 'To do' =
          item.status === 'Done'
            ? 'To do'
            : item.status === 'To do'
            ? 'In progress'
            : 'Done';
        return { ...item, status: nextStatus };
      });
      saveMasterData('setup_checklist', updated);
      return updated;
    });
  };

  const handleMarkAllDone = () => {
    setSetupItems((prev) => {
      const updated = prev.map((item) => ({ ...item, status: 'Done' as const }));
      saveMasterData('setup_checklist', updated);
      return updated;
    });
  };

  const handleResetChecklist = () => {
    setSetupItems((prev) => {
      const updated = prev.map((item) => ({ ...item, status: 'To do' as const }));
      saveMasterData('setup_checklist', updated);
      return updated;
    });
  };

  const handleSaveNote = (id: string) => {
    setSetupItems((prev) => {
      const updated = prev.map((item) => (item.id === id ? { ...item, note: draftNote.trim() } : item));
      saveMasterData('setup_checklist', updated);
      return updated;
    });
    setEditingNoteId(null);
    setDraftNote('');
  };

  // ── Derived counts for Access Tab ──────────────────────────────────────────
  const activeCount = accessUsers.filter((u) => u.status === 'Active').length;
  const suspendedCount = accessUsers.filter((u) => u.status === 'Suspended').length;
  const lockedCount = accessUsers.filter((u) => (u as any).isLocked).length;
  const iaStaffCount = accessUsers.filter((u) => !u.roles.some(isAuditeeRole)).length;
  const auditeeCount = accessUsers.filter((u) => u.roles.some(isAuditeeRole)).length;
  const privilegedCount = accessUsers.filter(
    (u) => u.roles.includes('System administrator') || u.roles.includes('Chief Audit Executive')
  ).length;

  const matchesAccessUserFilters = (user: (typeof accessUsers)[number]) => {
    if (userSearchQuery.trim()) {
      const query = userSearchQuery.toLowerCase();
      const matches =
        user.name.toLowerCase().includes(query) ||
        user.email.toLowerCase().includes(query) ||
        ((user as any).employeeNumber && (user as any).employeeNumber.toLowerCase().includes(query)) ||
        (user.scope && user.scope.toLowerCase().includes(query)) ||
        user.roles.some((role: string) => role.toLowerCase().includes(query));
      if (!matches) return false;
    }
    if (userTypeFilter !== 'All types') {
      const isAuditee = user.roles.some(isAuditeeRole);
      if ((userTypeFilter === 'Auditee') !== isAuditee) return false;
    }
    if (
      userRoleFilter !== 'All roles' &&
      !user.roles.includes(userRoleFilter)
    ) return false;
    if (userStatusFilter === 'Active' && user.status !== 'Active') return false;
    if (userStatusFilter === 'Suspended' && user.status !== 'Suspended') return false;
    if (userStatusFilter === 'Locked' && !(user as any).isLocked) return false;
    if (userStatusFilter === 'Privileged' && !(user as any).isPrivileged) return false;
    if (userStatusFilter === 'MFA' && !(user as any).mfaEnabled) return false;
    return true;
  };

  const handleExportAccessList = () => {
    const rows: AccessListRow[] = accessUsers.map((u) => ({
      username: u.email.split('@')[0],
      fullName: u.name,
      email: u.email,
      employeeNumber: (u as any).employeeNumber || '—',
      roles: u.roles,
      scope: u.scope,
      accountStatus: u.status,
      dateGranted: (u as any).dateGranted || '2026-01-15',
      lastModified: (u as any).lastModified || '2026-01-15',
      lastLogin: (u as any).lastLoginDate || '—',
    }));
    const csv = exportAccessListCsv(rows);
    downloadCsv(csv, `UAM_AccessList_${new Date().toISOString().slice(0, 10)}.csv`);
    notifyAccess('success', 'LAC-3: User access list exported as CSV for UAM review.');
  };

  const handleSimulateLogin = () => {
    setLoginSimError('');
    setLoginSimSuccess('');
    if (!loginSimUser.trim() || !loginSimPw.trim()) {
      setLoginSimError(genericAuthError());
      return;
    }
    const found = accessUsers.find(
      (u) => u.email.split('@')[0].toLowerCase() === loginSimUser.trim().toLowerCase()
    );
    if (!found) {
      setLoginSimError(genericAuthError());
      return;
    }
    if ((found as any).isLocked) {
      setLoginSimError(
        'Your account has been locked due to multiple failed login attempts. Please contact your system administrator to unlock.'
      );
      return;
    }
    if (loginSimPw !== 'CorrectPw!1') {
      const { newCount, shouldLock } = processFailedLogin((found as any).failedLoginCount || 0);
      setAccessUsers((prev) =>
        prev.map((u) =>
          u.id === found.id
            ? { ...u, failedLoginCount: newCount, isLocked: shouldLock } as any
            : u
        )
      );
      if (shouldLock) {
        setLoginSimError(
          `IA-8/IA-9: Account "${found.name}" has been locked after ${newCount} consecutive failed attempts. Administrator intervention required to unlock. — ${genericAuthError()}`
        );
      } else {
        setLoginSimError(`${genericAuthError()} (Attempt ${newCount} of 3)`);
      }
      return;
    }
    setAccessUsers((prev) =>
      prev.map((u) =>
        u.id === found.id
          ? { ...u, failedLoginCount: 0, isLocked: false, lastLoginDate: new Date().toISOString() } as any
          : u
      )
    );
    setLoginSimSuccess(`IA-1/SM-4: Login successful. Session token issued. Previous sessions revoked. Welcome, ${found.name}.`);
  };

  const handleAdminUnlock = (userId: string, userName: string) => {
    const reset = unlockAccount();
    setAccessUsers((prev) =>
      prev.map((u) => (u.id === userId ? { ...u, ...reset } as any : u))
    );
    notifyAccess('success', `IA-9: Account "${userName}" has been unlocked by the administrator. Failed login counter reset.`);
  };

  const handleGenerateTempPw = (userId: string) => {
    const tmp = generateTemporaryPassword();
    setGeneratedTempPw(tmp);
    setResetTargetId(userId);
    setShowTempPw(false);
    setAccessUsers((prev) =>
      prev.map((u) => (u.id === userId ? { ...u, requiresPasswordChange: true } as any : u))
    );
  };

  const handleAddUser = async () => {
    setNewUserNameError('');
    setNewUserFormError('');
    if (!newUserName.trim() || !newUserEmail.trim()) {
      const err = 'Full name and email address are required.';
      setNewUserFormError(err);
      notifyAccess('error', err);
      return;
    }
    const existingUsernames = accessUsers.map((u) => u.email.split('@')[0]);
    const candidateUsername = newUserEmail.split('@')[0];
    if (isUsernameTaken(candidateUsername, existingUsernames)) {
      const err = `IA-2: Username "${candidateUsername}" already exists. Each user must have a unique username/ID.`;
      setNewUserNameError(err);
      setNewUserFormError(err);
      return;
    }
    const newUserAccessRole = normalizeRole(newUserRole);
    if (newUserPassword) {
      const isPrivileged = newUserAccessRole === 'System administrator';
      const { valid, violations } = validatePasswordStrength(newUserPassword, isPrivileged);
      if (!valid) {
        const hint = !/[^a-zA-Z0-9]/.test(newUserPassword)
          ? ` (Tip: add a special symbol like "!" or "@" to your password, e.g. ${newUserPassword}!)`
          : '';
        const errMsg = `Password does not meet BSP/BSSC policy: ${violations[0]}${hint}`;
        setNewUserFormError(errMsg);
        notifyAccess('error', `PM-1/PM-2: ${violations[0]}`);
        return;
      }
    }
    const newAcc = {
      id: `acc-${Date.now()}`,
      name: newUserName.trim(),
      title: `${newUserRole} · Internal Audit`,
      email: newUserEmail.trim(),
      roles: [newUserRole],
      scope: newUserScope.trim() || 'Assigned engagements',
      status: 'Active',
      employeeNumber: newUserEmployeeNo.trim() || `EMP-${Date.now().toString().slice(-4)}`,
      dateGranted: new Date().toISOString().slice(0, 10),
      lastModified: new Date().toISOString().slice(0, 10),
      lastLoginDate: '—',
      failedLoginCount: 0,
      isLocked: false,
      requiresPasswordChange: true,
      passwordLastChanged: null,
      mfaEnabled: false,
      isPrivileged: newUserAccessRole === 'System administrator',
    };
    setAccessUsers((prev) => {
      const updated = [...prev, newAcc as any];
      saveMasterData('access_users_registry', updated);
      return updated;
    });
    const canApproveHead = newUserAccessRole === 'Chief Audit Executive' || newUserAccessRole === 'System administrator';
    const canApproveIndependent = ['Audit Division Head', 'Audit Supervisor', 'Independent Reviewer'].includes(newUserAccessRole);
    const canApproveCAE = newUserAccessRole === 'Chief Audit Executive';

    if (onAddUserProfile) {
      onAddUserProfile({
        id: newAcc.id,
        name: newAcc.name,
        email: newAcc.email,
        roleTitle: `${newUserRole} (Internal Audit)`,
        fullLabel: `${newAcc.name} – ${newUserRole}`,
        headerSubtitle: newUserRole,
        department: 'Internal Audit',
        canApproveHead,
        canApproveIndependent,
        canApproveCAE,
        employeeNumber: newAcc.employeeNumber,
        accountStatus: 'Active',
        failedLoginCount: 0,
        isLocked: false,
        requiresPasswordChange: true,
        mfaEnabled: false,
        isPrivileged: newUserAccessRole === 'System administrator',
      });
    }

    // Also sync to system_users table so user can log in at the root sign-in screen
    await createOrSyncSystemUser({
      username: candidateUsername,
      fullName: newAcc.name,
      email: newAcc.email,
      role: newUserAccessRole === 'System administrator' ? 'admin' : 'user',
      password: newUserPassword || undefined,
    });

    notifyAccess('success', `IA-1/PM-3: User "${newUserName.trim()}" created with role "${newUserRole}". Temporary password issued.`);
    setNewUserName(''); setNewUserEmail(''); setNewUserEmployeeNo('');
    setNewUserRole('Assisting Auditor'); setNewUserScope(''); setNewUserPassword('');
    setNewUserFormError('');
    setShowAddUserForm(false);
  };

  const handleUpdateUserRole = (userId: string, newRole: string) => {
    const accessRole = normalizeRole(newRole);
    setAccessUsers((prev) =>
      prev.map((item) => {
        if (item.id !== userId) return item;
        return {
          ...item,
          roles: [newRole],
          title: `${newRole} · Internal Audit`,
        } as any;
      })
    );

    const targetUser = accessUsers.find((u) => u.id === userId);
    if (onUpdateUserProfile && targetUser) {
      const canApproveHead = accessRole === 'Chief Audit Executive' || accessRole === 'System administrator';
      const canApproveIndependent = ['Audit Division Head', 'Audit Supervisor', 'Independent Reviewer'].includes(accessRole);
      const canApproveCAE = accessRole === 'Chief Audit Executive';

      onUpdateUserProfile({
        id: userId,
        name: targetUser.name,
        roleTitle: `${newRole} (Internal Audit)`,
        fullLabel: `${targetUser.name} – ${newRole}`,
        headerSubtitle: newRole,
        department: 'Internal Audit',
        canApproveHead,
        canApproveIndependent,
        canApproveCAE,
        accountStatus: targetUser.status === 'Active' ? 'Active' : 'Inactive',
        employeeNumber: (targetUser as any).employeeNumber,
      });
    }
    saveMasterData('access_users_registry', accessUsers.map((user) =>
      user.id === userId ? { ...user, roles: [newRole], title: `${newRole} · Internal Audit` } : user
    ));
    notifyAccess('success', `Role for "${targetUser?.name || 'User'}" updated to "${newRole}".`);
  };

  const getUserExpiryState = (u: any) => {
    return getPasswordExpiryState(u.passwordLastChanged || null, u.mfaEnabled || false);
  };


  // ═══════════════════════════════════════════════════════════════════════════
  // TAB: MASTER DATA
  // ═══════════════════════════════════════════════════════════════════════════
  if (tab === 'master-data') {
    return (
      <div className="space-y-4">
        {/* Top 2-Column Grid: Entity types & Audit categories */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Left Card: Entity types */}
          <div className="bg-white rounded-lg border border-slate-200/90 shadow-2xs p-6">
            <h2 className="text-[18px] font-bold text-slate-900 tracking-tight">
              Entity types
            </h2>
            <p className="text-xs text-slate-500 mt-1">
              Used to classify rows in the Audit Universe. Removing or editing a type updates universe options dynamically.
            </p>

            <div className="mt-4 divide-y divide-slate-200/80">
              {entityTypes.map((et) => {
                const isEditing = editingEntityType === et;
                return (
                  <div
                    key={et}
                    className="py-2.5 flex items-center justify-between gap-2 text-[13px] text-slate-900"
                  >
                    {isEditing ? (
                      <div className="flex-1 flex items-center gap-2">
                        <input
                          type="text"
                          value={editingEntityValue}
                          onChange={(e) => setEditingEntityValue(e.target.value)}
                          onKeyDown={(e) => e.key === 'Enter' && handleSaveEditEntityType(et)}
                          className="flex-1 px-2.5 py-1 text-xs border border-[#492785] rounded bg-white text-slate-900 focus:outline-none"
                          autoFocus
                        />
                        <button
                          type="button"
                          onClick={() => handleSaveEditEntityType(et)}
                          className="px-2.5 py-1 bg-[#492785] text-white rounded text-xs font-semibold hover:bg-[#3b1f6b] cursor-pointer"
                        >
                          Save
                        </button>
                        <button
                          type="button"
                          onClick={() => setEditingEntityType(null)}
                          className="px-2 py-1 bg-white border border-slate-300 text-slate-600 rounded text-xs font-medium hover:bg-slate-50 cursor-pointer"
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <>
                        <span className="font-medium">{et}</span>
                        <div className="inline-flex items-center gap-1.5 shrink-0">
                          <button
                            type="button"
                            onClick={() => handleStartEditEntityType(et)}
                            className="px-2.5 py-1 bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 rounded text-xs font-medium cursor-pointer"
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            onClick={() => handleRemoveEntityType(et)}
                            className="px-2.5 py-1 bg-white hover:bg-rose-50 text-rose-700 border border-rose-200 rounded text-xs font-medium cursor-pointer"
                          >
                            Remove
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                );
              })}
            </div>

            <div className="mt-4 flex items-center gap-2">
              <input
                type="text"
                value={newEntityType}
                onChange={(e) => setNewEntityType(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleAddEntityType()}
                placeholder="New entity type (e.g. Outsourced vendor)"
                className="flex-1 px-3 py-2 bg-white border border-slate-300 rounded-md text-xs text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-[#492785]"
              />
              <button
                type="button"
                onClick={handleAddEntityType}
                className="px-3.5 py-2 bg-[#492785] hover:bg-[#3b1f6b] text-white text-xs font-semibold rounded-md cursor-pointer"
              >
                Add
              </button>
            </div>
          </div>

          {/* Right Card: Audit categories */}
          <div className="bg-white rounded-lg border border-slate-200/90 shadow-2xs p-6">
            <h2 className="text-[18px] font-bold text-slate-900 tracking-tight">
              Audit categories
            </h2>
            <p className="text-xs text-slate-500 mt-1">
              Used on the Annual Plan, Audit Universe, and when matching auditors by expertise.
            </p>

            <div className="mt-4 divide-y divide-slate-200/80">
              {auditCategories.map((cat) => {
                const isEditing = editingCategory === cat;
                return (
                  <div
                    key={cat}
                    className="py-2.5 flex items-center justify-between gap-2 text-[13px] text-slate-900"
                  >
                    {isEditing ? (
                      <div className="flex-1 flex items-center gap-2">
                        <input
                          type="text"
                          value={editingCategoryValue}
                          onChange={(e) => setEditingCategoryValue(e.target.value)}
                          onKeyDown={(e) => e.key === 'Enter' && handleSaveEditCategory(cat)}
                          className="flex-1 px-2.5 py-1 text-xs border border-[#492785] rounded bg-white text-slate-900 focus:outline-none"
                          autoFocus
                        />
                        <button
                          type="button"
                          onClick={() => handleSaveEditCategory(cat)}
                          className="px-2.5 py-1 bg-[#492785] text-white rounded text-xs font-semibold hover:bg-[#3b1f6b] cursor-pointer"
                        >
                          Save
                        </button>
                        <button
                          type="button"
                          onClick={() => setEditingCategory(null)}
                          className="px-2 py-1 bg-white border border-slate-300 text-slate-600 rounded text-xs font-medium hover:bg-slate-50 cursor-pointer"
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <>
                        <span className="font-medium">{cat}</span>
                        <div className="inline-flex items-center gap-1.5 shrink-0">
                          <button
                            type="button"
                            onClick={() => handleStartEditCategory(cat)}
                            className="px-2.5 py-1 bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 rounded text-xs font-medium cursor-pointer"
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            onClick={() => handleRemoveAuditCategory(cat)}
                            className="px-2.5 py-1 bg-white hover:bg-rose-50 text-rose-700 border border-rose-200 rounded text-xs font-medium cursor-pointer"
                          >
                            Remove
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                );
              })}
            </div>

            <div className="mt-4 flex items-center gap-2">
              <input
                type="text"
                value={newAuditCategory}
                onChange={(e) => setNewAuditCategory(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleAddAuditCategory()}
                placeholder="New audit category (e.g. ESG / sustainability)"
                className="flex-1 px-3 py-2 bg-white border border-slate-300 rounded-md text-xs text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-[#492785]"
              />
              <button
                type="button"
                onClick={handleAddAuditCategory}
                className="px-3.5 py-2 bg-[#492785] hover:bg-[#3b1f6b] text-white text-xs font-semibold rounded-md cursor-pointer"
              >
                Add
              </button>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {CONFIGURABLE_LISTS.map(({ key, label, description }) => (
            <section key={key} className="bg-white rounded-lg border border-slate-200/90 shadow-2xs p-5">
              <h2 className="text-[16px] font-bold text-slate-900">{label}</h2>
              <p className="text-xs text-slate-500 mt-1 min-h-8">{description}</p>
              <ul className="mt-3 space-y-1.5 max-h-48 overflow-y-auto">
                {configurableLists[key].map((value) => (
                  <li key={value} className="flex items-center justify-between gap-2 text-xs text-slate-800 border-b border-slate-100 py-1.5">
                    <span>{value}</span>
                    <button
                      type="button"
                      onClick={() => handleRemoveLookupValue(key, value)}
                      className="text-rose-700 hover:text-rose-900 font-semibold"
                      aria-label={`Remove ${value} from ${label}`}
                    >
                      Remove
                    </button>
                  </li>
                ))}
                {configurableLists[key].length === 0 && (
                  <li className="text-xs text-slate-500 py-2">No values configured.</li>
                )}
              </ul>
              <form
                className="mt-3 flex gap-2"
                onSubmit={(event) => {
                  event.preventDefault();
                  handleAddLookupValue(key);
                }}
              >
                <input
                  type="text"
                  value={newLookupValues[key]}
                  onChange={(event) => setNewLookupValues((prev) => ({ ...prev, [key]: event.target.value }))}
                  placeholder={`Add ${label.toLowerCase()} value`}
                  className="min-w-0 flex-1 px-2.5 py-2 bg-white border border-slate-300 rounded-md text-xs text-slate-800"
                />
                <button
                  type="submit"
                  className="px-3 py-2 bg-[#492785] hover:bg-[#3b1f6b] text-white text-xs font-semibold rounded-md"
                >
                  Add
                </button>
              </form>
            </section>
          ))}
        </div>

        {/* Auditors Card */}
        <div className="bg-white rounded-lg border border-slate-200/90 shadow-2xs p-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h2 className="text-[18px] font-bold text-slate-900 tracking-tight">
                Auditors
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Internal Audit staff available as engagement leads, team members, and reviewers.
              </p>
            </div>
            <button
              type="button"
              onClick={handleOpenAddAuditor}
              className="px-3.5 py-2 bg-[#492785] hover:bg-[#3b1f6b] text-white text-xs font-semibold rounded-md cursor-pointer"
            >
              + Add auditor
            </button>
          </div>

          {/* Search bar for auditors */}
          <div className="mt-4 flex items-center gap-2">
            <div className="relative flex-1 max-w-md">
              <input
                type="text"
                value={auditorSearch}
                onChange={(e) => setAuditorSearch(e.target.value)}
                placeholder="Search auditors by name, role, email, or specialisations..."
                className="w-full pl-8 pr-8 py-2 bg-slate-50 border border-slate-200 rounded-md text-xs text-slate-800 placeholder:text-slate-400 focus:outline-none focus:bg-white focus:border-[#492785]"
              />
              <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 text-xs">🔍</span>
              {auditorSearch && (
                <button
                  type="button"
                  onClick={() => setAuditorSearch('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs cursor-pointer"
                >
                  ✕
                </button>
              )}
            </div>
            {auditorSearch && (
              <span className="text-xs text-slate-500">
                Found {auditorsList.filter((a) => {
                  const q = auditorSearch.toLowerCase();
                  return (
                    a.name.toLowerCase().includes(q) ||
                    a.role.toLowerCase().includes(q) ||
                    a.email.toLowerCase().includes(q) ||
                    a.skills.toLowerCase().includes(q)
                  );
                }).length} auditor(s)
              </span>
            )}
          </div>

          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-left border-collapse text-[13px]">
              <thead>
                <tr className="border-b border-slate-200 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                  <th className="py-2.5 pr-4">NAME</th>
                  <th className="py-2.5 px-4">ROLE</th>
                  <th className="py-2.5 px-4">EMAIL</th>
                  <th className="py-2.5 px-4">SPECIALISATIONS</th>
                  <th className="py-2.5 pl-4 text-right" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200/80">
                {auditorsList
                  .filter((aud) => {
                    if (!auditorSearch.trim()) return true;
                    const q = auditorSearch.toLowerCase();
                    return (
                      aud.name.toLowerCase().includes(q) ||
                      aud.role.toLowerCase().includes(q) ||
                      aud.email.toLowerCase().includes(q) ||
                      aud.skills.toLowerCase().includes(q)
                    );
                  })
                  .map((aud) => (
                  <tr key={aud.email} className="hover:bg-slate-50/50 transition-colors">
                    <td className="py-3 pr-4 font-bold text-slate-900">{aud.name}</td>
                    <td className="py-3 px-4 text-slate-700">{aud.role}</td>
                    <td className="py-3 px-4 text-xs font-mono text-slate-600">{aud.email}</td>
                    <td className="py-3 px-4 text-xs text-slate-600">{aud.skills}</td>
                    <td className="py-3 pl-4 text-right whitespace-nowrap">
                      <div className="inline-flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => handleOpenEditAuditor(aud)}
                          className="px-2.5 py-1 bg-white hover:bg-slate-50 text-slate-800 border border-slate-300 rounded text-xs font-medium cursor-pointer"
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => handleRemoveAuditor(aud.email)}
                          className="px-2.5 py-1 bg-white hover:bg-rose-50 text-rose-700 border border-rose-200 rounded text-xs font-medium cursor-pointer"
                        >
                          Remove
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {auditorsList.filter((aud) => {
                  if (!auditorSearch.trim()) return true;
                  const q = auditorSearch.toLowerCase();
                  return (
                    aud.name.toLowerCase().includes(q) ||
                    aud.role.toLowerCase().includes(q) ||
                    aud.email.toLowerCase().includes(q) ||
                    aud.skills.toLowerCase().includes(q)
                  );
                }).length === 0 && (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-xs text-slate-500">
                      {auditorSearch ? 'No auditors match your search query.' : 'No internal auditors registered.'}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Auditee Directory Card */}
        <div className="bg-white rounded-lg border border-slate-200/90 shadow-2xs p-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h2 className="text-[18px] font-bold text-slate-900 tracking-tight">
                Auditee directory (units &amp; heads)
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Departments and unit heads who receive notifications, inquiries, findings and action-plan assignments.
              </p>
            </div>
            <button
              type="button"
              onClick={handleOpenAddAuditee}
              className="px-3.5 py-2 bg-[#492785] hover:bg-[#3b1f6b] text-white text-xs font-semibold rounded-md cursor-pointer"
            >
              + Add auditee unit
            </button>
          </div>

          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-left border-collapse text-[13px]">
              <thead>
                <tr className="border-b border-slate-200 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                  <th className="py-2.5 pr-4">DEPARTMENT / UNIT</th>
                  <th className="py-2.5 px-4">UNIT HEAD</th>
                  <th className="py-2.5 px-4">TITLE</th>
                  <th className="py-2.5 px-4">EMAIL</th>
                  <th className="py-2.5 px-4">REPORTS TO</th>
                  <th className="py-2.5 px-4">STATUS</th>
                  <th className="py-2.5 pl-4 text-right" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200/80">
                {auditeeDirectory.map((dir) => (
                  <tr key={dir.unit} className="hover:bg-slate-50/50 transition-colors">
                    <td className="py-3 pr-4 font-bold text-slate-900">
                      {dir.unit}
                    </td>
                    <td className="py-3 px-4 text-slate-800">{dir.head}</td>
                    <td className="py-3 px-4 text-xs text-slate-600">{dir.title}</td>
                    <td className="py-3 px-4 text-xs font-mono text-slate-600">
                      {dir.email}
                    </td>
                    <td className="py-3 px-4 text-slate-700">{dir.reportsTo || '—'}</td>
                    <td className="py-3 px-4">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                        dir.isActive === false ? 'bg-slate-100 text-slate-600' : 'bg-emerald-50 text-emerald-700'
                      }`}>
                        {dir.isActive === false ? 'Inactive' : 'Active'}
                      </span>
                    </td>
                    <td className="py-3 pl-4 text-right whitespace-nowrap">
                      <div className="inline-flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => handleToggleAuditeeStatus(dir.unit)}
                          className="px-2.5 py-1 bg-white hover:bg-slate-50 text-slate-800 border border-slate-300 rounded text-xs font-medium cursor-pointer"
                        >
                          {dir.isActive === false ? 'Activate' : 'Deactivate'}
                        </button>
                        <button
                          type="button"
                          onClick={() => handleOpenEditAuditee(dir)}
                          className="px-2.5 py-1 bg-white hover:bg-slate-50 text-slate-800 border border-slate-300 rounded text-xs font-medium cursor-pointer"
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => handleRemoveAuditee(dir.unit)}
                          className="px-2.5 py-1 bg-white hover:bg-rose-50 text-rose-700 border border-rose-200 rounded text-xs font-medium cursor-pointer"
                        >
                          Remove
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {auditeeDirectory.length === 0 && (
                  <tr>
                    <td colSpan={7} className="py-8 text-center text-xs text-slate-500">
                      No auditee units registered. Click &ldquo;+ Add auditee unit&rdquo; to register auditable departments.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Modal: Add/Edit Auditor */}
        {showAuditorModal && (
          <div className="fixed inset-0 bg-slate-900/50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-lg border border-slate-200 shadow-xl max-w-md w-full p-6 text-xs">
              <h3 className="text-base font-bold text-slate-900">
                {editingAuditorEmail ? 'Edit Auditor' : 'Add Internal Auditor'}
              </h3>
              <p className="text-xs text-slate-500 mt-1">
                Register an auditor in the pool for automatic lead assignment and review workflows.
              </p>
              <form onSubmit={handleSaveAuditor} className="mt-4 space-y-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Auditor Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={auditorFormName}
                    onChange={(e) => setAuditorFormName(e.target.value)}
                    placeholder="e.g. S. Magsaysay"
                    className="w-full px-3 py-2 border border-slate-300 rounded-md text-xs text-slate-800 focus:outline-none focus:border-[#492785]"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Role / Position *
                  </label>
                  <input
                    type="text"
                    required
                    value={auditorFormRole}
                    onChange={(e) => setAuditorFormRole(e.target.value)}
                    placeholder="e.g. IT Audit Manager"
                    className="w-full px-3 py-2 border border-slate-300 rounded-md text-xs text-slate-800 focus:outline-none focus:border-[#492785]"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Email Address *
                  </label>
                  <input
                    type="email"
                    required
                    value={auditorFormEmail}
                    onChange={(e) => setAuditorFormEmail(e.target.value)}
                    placeholder="s.magsaysay@citysavings.com.ph"
                    className="w-full px-3 py-2 border border-slate-300 rounded-md text-xs text-slate-800 focus:outline-none focus:border-[#492785]"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Specialisations &amp; Expertise (Comma-separated)
                  </label>
                  <input
                    type="text"
                    value={auditorFormSkills}
                    onChange={(e) => setAuditorFormSkills(e.target.value)}
                    placeholder="e.g. Operations, Credit review, IT audit, Compliance"
                    className="w-full px-3 py-2 border border-slate-300 rounded-md text-xs text-slate-800 focus:outline-none focus:border-[#492785]"
                  />
                </div>
                <div className="flex justify-end gap-2 pt-3 border-t border-slate-100 mt-4">
                  <button
                    type="button"
                    onClick={() => setShowAuditorModal(false)}
                    className="px-3.5 py-1.5 border border-slate-300 rounded-md font-semibold text-slate-700 cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-1.5 bg-[#492785] hover:bg-[#3b1f6b] text-white rounded-md font-semibold cursor-pointer"
                  >
                    {editingAuditorEmail ? 'Update Auditor' : 'Save Auditor'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Modal: Add/Edit Auditee Unit */}
        {showAuditeeModal && (
          <div className="fixed inset-0 bg-slate-900/50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-lg border border-slate-200 shadow-xl max-w-md w-full p-6 text-xs">
              <h3 className="text-base font-bold text-slate-900">
                {editingAuditeeUnit ? 'Edit Auditee Directory Unit' : 'Add Auditee Unit & Head'}
              </h3>
              <p className="text-xs text-slate-500 mt-1">
                Register a department, business unit, and unit head for audit notices and action plans.
              </p>
              <form onSubmit={handleSaveAuditee} className="mt-4 space-y-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Department / Unit Name *
                  </label>
                  <select
                    required
                    value={auditeeFormUnit}
                    onChange={(e) => setAuditeeFormUnit(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-md text-xs text-slate-800 focus:outline-none focus:border-[#492785]"
                  >
                    <option value="" disabled>Select a department or unit</option>
                    {[...new Set([...configurableLists.departments, ...auditeeDirectory.map((dir) => dir.unit)])]
                      .sort((a, b) => a.localeCompare(b))
                      .map((department) => (
                        <option key={department} value={department}>{department}</option>
                      ))}
                  </select>
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Unit Head Full Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={auditeeFormHead}
                    onChange={(e) => setAuditeeFormHead(e.target.value)}
                    placeholder="e.g. M. Ocampo"
                    className="w-full px-3 py-2 border border-slate-300 rounded-md text-xs text-slate-800 focus:outline-none focus:border-[#492785]"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Official Title / Designation
                  </label>
                  <input
                    type="text"
                    value={auditeeFormTitle}
                    onChange={(e) => setAuditeeFormTitle(e.target.value)}
                    placeholder="e.g. VP, Head of Digital Banking"
                    className="w-full px-3 py-2 border border-slate-300 rounded-md text-xs text-slate-800 focus:outline-none focus:border-[#492785]"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Email Address
                  </label>
                  <input
                    type="email"
                    value={auditeeFormEmail}
                    onChange={(e) => setAuditeeFormEmail(e.target.value)}
                    placeholder="m.ocampo@citysavings.com.ph"
                    className="w-full px-3 py-2 border border-slate-300 rounded-md text-xs text-slate-800 focus:outline-none focus:border-[#492785]"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Reports to (issue-closure approver)
                  </label>
                  <select
                    value={auditeeFormReportsTo}
                    onChange={(e) => setAuditeeFormReportsTo(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-md text-xs text-slate-800 focus:outline-none focus:border-[#492785]"
                  >
                    <option value="">Select approver</option>
                    {[...new Set(auditeeDirectory.map((dir) => dir.head).filter(Boolean))]
                      .sort((a, b) => a.localeCompare(b))
                      .map((head) => <option key={head} value={head}>{head}</option>)}
                  </select>
                </div>
                <label className="flex items-center gap-2 text-xs font-medium text-slate-700">
                  <input
                    type="checkbox"
                    checked={auditeeFormIsActive}
                    onChange={(e) => setAuditeeFormIsActive(e.target.checked)}
                    className="accent-[#492785]"
                  />
                  Active auditee unit
                </label>
                <div className="flex justify-end gap-2 pt-3 border-t border-slate-100 mt-4">
                  <button
                    type="button"
                    onClick={() => setShowAuditeeModal(false)}
                    className="px-3.5 py-1.5 border border-slate-300 rounded-md font-semibold text-slate-700 cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-1.5 bg-[#492785] hover:bg-[#3b1f6b] text-white rounded-md font-semibold cursor-pointer"
                  >
                    {editingAuditeeUnit ? 'Update Unit' : 'Save Unit'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    );
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // TAB: SETUP (Implementation · Configuration cockpit)
  // ═══════════════════════════════════════════════════════════════════════════
  if (tab === 'setup') {
    const groups = [
      '1. Organization & branding',
      '2. Audit methodology & risk scoring',
      '3. Master data & directories',
      '4. Audit Universe & Annual Plan baseline',
      '5. Access control & go-live',
    ];

    const doneCount = setupItems.filter((item) => item.status === 'Done').length;
    const totalCount = setupItems.length;
    const pctDone = Math.round((doneCount / totalCount) * 100);

    return (
      <div className="space-y-4">
        {/* Top Card: IMPLEMENTATION · Configuration cockpit */}
        <div className="bg-white rounded-lg border border-slate-200/90 shadow-2xs p-6 flex flex-col lg:flex-row lg:items-center justify-between gap-5">
          <div className="max-w-2xl">
            <div className="text-[10.5px] font-semibold uppercase tracking-[0.08em] text-slate-500">
              IMPLEMENTATION · CONFIGURATION COCKPIT
            </div>
            <h2 className="text-[20px] font-bold text-slate-900 tracking-tight mt-0.5">
              Prepare the workspace for production
            </h2>
            <p className="text-xs text-slate-500 mt-1 leading-relaxed">
              Work through the 14 configuration steps below in order. Each item links directly to the screen that holds the setting and reflects live counts from your workspace.
            </p>
          </div>

          <div className="flex flex-col items-start lg:items-end shrink-0 min-w-[270px]">
            <div className="flex items-baseline gap-2">
              <span className="text-[24px] font-bold text-slate-900 font-mono-tabular leading-none">
                {doneCount} / {totalCount}
              </span>
              <span className="text-xs text-slate-500 font-medium">
                steps complete ({pctDone}%)
              </span>
            </div>

            <div className="w-full h-1.5 bg-slate-200 rounded-full overflow-hidden mt-2.5">
              <div
                className="h-full bg-[#492785] rounded-full transition-all"
                style={{ width: `${pctDone}%` }}
              />
            </div>

            <div className="flex items-center gap-2 mt-3">
              <button
                type="button"
                onClick={handleMarkAllDone}
                className="px-3 py-1.5 bg-[#492785] hover:bg-[#3b1f6b] text-white text-xs font-semibold rounded-md transition-colors cursor-pointer"
              >
                Mark all done
              </button>
              <button
                type="button"
                onClick={handleResetChecklist}
                className="px-3 py-1.5 bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 text-xs font-semibold rounded-md transition-colors cursor-pointer"
              >
                Reset checklist
              </button>
              <button
                type="button"
                onClick={async () => {
                  if (!window.confirm('This clears audit records and configurable master data from Supabase. Login accounts, user profiles, and role definitions will be kept. Continue?')) return;
                  handleResetChecklist();
                  try {
                    if (!onResetSystemForUAT) throw new Error('The UAT reset action is not available.');
                    await onResetSystemForUAT();
                  } catch (error) {
                    console.error('UAT reset failed:', error);
                    notifyAccess('error', `System reset failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
                  }
                }}
                className="px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white text-xs font-semibold rounded-md transition-colors cursor-pointer"
              >
                Reset System for UAT
              </button>
            </div>
          </div>
        </div>

        {/* 5 Configuration Section Cards */}
        {groups.map((groupName) => {
          const groupItems = setupItems.filter((item) => item.group === groupName);
          const groupDoneCount = groupItems.filter((item) => item.status === 'Done').length;

          return (
            <div
              key={groupName}
              className="bg-white rounded-lg border border-slate-200/90 shadow-2xs overflow-hidden"
            >
              <div className="px-6 py-4 border-b border-slate-200/80 flex items-center justify-between">
                <h3 className="text-[16px] font-bold text-slate-900 tracking-tight">
                  {groupName}
                </h3>
                <span className="text-xs text-slate-500 font-mono-tabular">
                  {groupDoneCount} of {groupItems.length} done
                </span>
              </div>

              <div className="divide-y divide-slate-200/80">
                {groupItems.map((step) => {
                  const isDone = step.status === 'Done';
                  const isInProgress = step.status === 'In progress';

                  return (
                    <div
                      key={step.id}
                      className="px-6 py-4 flex flex-col sm:flex-row sm:items-start justify-between gap-4 hover:bg-slate-50/40 transition-colors"
                    >
                      <div className="flex items-start gap-3.5 min-w-0">
                        <button
                          type="button"
                          onClick={() => handleCycleStatus(step.id)}
                          title="Click to cycle status (Done / In progress / To do)"
                          className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 mt-0.5 text-xs font-bold cursor-pointer transition-colors ${
                            isDone
                              ? 'bg-[#1B6E44] text-white'
                              : isInProgress
                              ? 'border border-[#D97724] bg-[#FDF5EC] text-[#B8500B] font-mono-tabular'
                              : 'border border-slate-300 bg-white text-slate-500 font-mono-tabular'
                          }`}
                        >
                          {isDone ? '✓' : step.stepNum}
                        </button>

                        <div className="min-w-0">
                          <div className="text-[13.5px] font-bold text-slate-900 leading-snug">
                            {step.title}
                          </div>
                          <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">
                            {step.description}
                          </p>

                          <div className="flex flex-wrap items-center gap-2 mt-2">
                            {isDone ? (
                              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-[#DCEFE2] text-[#1E6339]">
                                <span className="w-1.5 h-1.5 rounded-full bg-[#1E6339]" />
                                Done
                              </span>
                            ) : isInProgress ? (
                              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-[#FBE7D3] text-[#B8500B]">
                                <span className="w-1.5 h-1.5 rounded-full bg-[#D97724]" />
                                In progress
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-slate-100 text-slate-600 border border-slate-200">
                                <span className="w-1.5 h-1.5 rounded-full bg-slate-500" />
                                To do
                              </span>
                            )}

                            <span className="text-xs text-slate-700 font-medium">
                              {step.summary}
                            </span>

                            <button
                              type="button"
                              onClick={() => {
                                setEditingNoteId(step.id);
                                setDraftNote(step.note);
                              }}
                              className="text-xs text-[#492785] hover:underline font-medium cursor-pointer ml-1"
                            >
                              {step.note ? 'Edit note' : '+ Add note'}
                            </button>
                          </div>

                          {step.note && editingNoteId !== step.id && (
                            <div className="mt-2 px-3 py-1.5 bg-slate-50 border border-slate-200 rounded text-xs text-slate-700">
                              <span className="font-semibold text-slate-900">Note:</span>{' '}
                              {step.note}
                            </div>
                          )}

                          {editingNoteId === step.id && (
                            <div className="mt-2 flex items-center gap-2">
                              <input
                                type="text"
                                value={draftNote}
                                onChange={(e) => setDraftNote(e.target.value)}
                                placeholder="Add implementation note..."
                                className="px-2.5 py-1 bg-white border border-slate-300 rounded text-xs text-slate-800 w-64"
                              />
                              <button
                                type="button"
                                onClick={() => handleSaveNote(step.id)}
                                className="px-2.5 py-1 bg-[#492785] text-white rounded text-xs font-semibold cursor-pointer"
                              >
                                Save
                              </button>
                              <button
                                type="button"
                                onClick={() => setEditingNoteId(null)}
                                className="px-2.5 py-1 bg-white border border-slate-300 text-slate-700 rounded text-xs font-medium cursor-pointer"
                              >
                                Cancel
                              </button>
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0 pt-0.5">
                        <button
                          type="button"
                          onClick={() => {
                            if (onSelectTab) {
                              onSelectTab(step.targetTab);
                            }
                          }}
                          className="px-3 py-1.5 rounded-md text-xs font-semibold bg-white hover:bg-slate-50 text-slate-800 border border-slate-300 transition-colors cursor-pointer whitespace-nowrap"
                        >
                          {step.actionLabel}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    );
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // TAB: ACCESS CONTROL & USER MANAGEMENT
  // ═══════════════════════════════════════════════════════════════════════════
  return (
    <div className="space-y-4">
      {/* Global notification banner */}
      {accessNotice && (
        <div className={`px-4 py-2.5 rounded-md flex items-center justify-between text-xs font-medium border ${
          accessNotice.type === 'success'
            ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
            : 'bg-red-50 border-red-200 text-red-900'
        }`}>
          <span>{accessNotice.msg}</span>
          <button type="button" onClick={() => setAccessNotice(null)} className="ml-4 font-bold cursor-pointer">✕</button>
        </div>
      )}

      {/* ── Top 5 KPI Cards ─────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        <div className="bg-white rounded-lg border border-slate-200/90 p-4 shadow-2xs">
          <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">ENFORCEMENT MODE</div>
          <div className="text-[18px] font-bold text-[#492785] leading-tight mt-1">
            {accessActive ? 'Enforced' : 'Simulated'}
          </div>
          <div className="text-[11px] text-slate-500 mt-1">{currentUser.name}</div>
        </div>
        <div className="bg-white rounded-lg border border-slate-200/90 p-4 shadow-2xs">
          <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">REGISTERED USERS</div>
          <div className="text-[28px] font-bold text-slate-900 font-mono-tabular leading-tight mt-1">{accessUsers.length}</div>
          <div className="text-[11px] text-slate-500 mt-1 tabular-nums">{activeCount} active · {suspendedCount} suspended</div>
        </div>
        <div className="bg-white rounded-lg border border-slate-200/90 p-4 shadow-2xs">
          <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">IA STAFF / AUDITEES</div>
          <div className="text-[28px] font-bold text-slate-900 font-mono-tabular leading-tight mt-1">{iaStaffCount} / {auditeeCount}</div>
          <div className="text-[11px] text-slate-500 mt-1">{privilegedCount} privileged accounts (IA-11)</div>
        </div>
        <div className={`rounded-lg border p-4 shadow-2xs ${lockedCount > 0 ? 'bg-red-50 border-red-200' : 'bg-white border-slate-200/90'}`}>
          <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">LOCKED ACCOUNTS</div>
          <div className={`text-[28px] font-bold font-mono-tabular leading-tight mt-1 ${lockedCount > 0 ? 'text-red-700' : 'text-slate-900'}`}>{lockedCount}</div>
          <div className="text-[11px] text-slate-500 mt-1">IA-8/IA-9: Admin unlock required</div>
        </div>
        <div className="bg-white rounded-lg border border-slate-200/90 p-4 shadow-2xs">
          <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">MFA ENABLED</div>
          <div className="text-[28px] font-bold text-slate-900 font-mono-tabular leading-tight mt-1">
            {accessUsers.filter((u) => (u as any).mfaEnabled).length}
          </div>
          <div className="text-[11px] text-slate-500 mt-1">IA-4: Required for Tier 1 systems</div>
        </div>
      </div>

      {/* ── RBAC Control Banner ──────────────────────────────────────────── */}
      <div className="bg-white rounded-lg border border-slate-200/90 shadow-2xs p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="max-w-3xl">
          <div className="flex items-center gap-2">
            <h2 className="text-[17px] font-bold text-slate-900 tracking-tight">
              Role-based access control (RBAC) &amp; segregation of duties
            </h2>
            <span className="text-[10px] font-bold bg-[#E4DDF8] text-[#492785] px-2 py-0.5 rounded-full">LAC-1 · LAC-2</span>
          </div>
          <p className="text-xs text-slate-600 mt-1 leading-relaxed">
            When <strong>Activated</strong>, all API endpoints check the caller's role before executing. Navigation tabs, engagements,
            working paper sign-offs, report approvals, and issue closures are filtered per role. Maker ≠ Checker is enforced
            system-wide — a user who prepares a working note cannot approve it. Keep <strong>Simulated</strong> mode during configuration.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <select
            aria-label="Select simulated user"
            value={currentUser.id}
            onChange={(e) => { const found = userProfiles.find((u) => u.id === e.target.value); if (found) onChangeUser(found); }}
            className="px-3 py-2 bg-white border border-slate-300 rounded-md text-xs font-medium text-slate-800"
          >
            {userProfiles.map((u) => (
              <option key={u.id} value={u.id}>{u.name} — {u.headerSubtitle}</option>
            ))}
          </select>
          <button type="button" onClick={onToggleAccess}
            className="px-3.5 py-2 bg-[#492785] hover:bg-[#3b1f6b] text-white text-xs font-semibold rounded-md transition-colors cursor-pointer whitespace-nowrap">
            {accessActive ? 'Switch to simulated mode' : 'Activate access control'}
          </button>
        </div>
      </div>

      {/* ── IA-8/IA-9: Login Simulation & Lockout Demo ──────────────────── */}
      <div className="bg-white rounded-lg border border-slate-200/90 shadow-2xs p-5">
        <div className="flex items-center gap-2 mb-3">
          <h2 className="text-[16px] font-bold text-slate-900">Authentication controls demo</h2>
          <span className="text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200 px-2 py-0.5 rounded-full">IA-7 · IA-8 · IA-9 · SM-4</span>
        </div>
        <p className="text-xs text-slate-500 mb-4">
          Simulates login with account lockout after 3 failed attempts. Use <code className="bg-slate-100 px-1 rounded">CorrectPw!1</code> as the correct password. Demonstrates generic error messages (IA-7), lockout (IA-8), and single-session enforcement (SM-4).
        </p>
        <div className="flex flex-wrap gap-3 items-end">
          <div>
            <label className="block text-xs text-slate-600 mb-1">Username (email prefix)</label>
            <input type="text" autoComplete="off" value={loginSimUser}
              onChange={(e) => setLoginSimUser(e.target.value)}
              placeholder="e.g. m.santos"
              className="px-3 py-2 bg-white border border-slate-300 rounded-md text-xs text-slate-800 w-44" />
          </div>
          <div>
            <label className="block text-xs text-slate-600 mb-1">Password</label>
            <div className="relative">
              <input type={showLoginSimPw ? 'text' : 'password'} autoComplete="new-password" value={loginSimPw}
                onChange={(e) => setLoginSimPw(e.target.value)}
                placeholder="Enter password"
                className="px-3 py-2 bg-white border border-slate-300 rounded-md text-xs text-slate-800 w-44 pr-10" />
              <button type="button" onClick={() => setShowLoginSimPw((p) => !p)}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 cursor-pointer text-[11px]">
                {showLoginSimPw ? '🙈' : '👁️'}
              </button>
            </div>
          </div>
          <button type="button" onClick={handleSimulateLogin}
            className="px-4 py-2 bg-[#492785] hover:bg-[#3b1f6b] text-white text-xs font-semibold rounded-md cursor-pointer">
            Simulate login
          </button>
          <button type="button" onClick={() => { setLoginSimUser(''); setLoginSimPw(''); setLoginSimError(''); setLoginSimSuccess(''); }}
            className="px-3 py-2 bg-white border border-slate-300 text-xs text-slate-700 font-medium rounded-md cursor-pointer">
            Clear
          </button>
        </div>
        {loginSimError && (
          <div className="mt-3 px-3.5 py-2.5 bg-red-50 border border-red-200 rounded-md text-xs text-red-800 font-medium">
            🔒 {loginSimError}
          </div>
        )}
        {loginSimSuccess && (
          <div className="mt-3 px-3.5 py-2.5 bg-emerald-50 border border-emerald-200 rounded-md text-xs text-emerald-800 font-medium">
            ✓ {loginSimSuccess}
          </div>
        )}
      </div>

      {/* ── LAC-3: User accounts table with AL-4.x fields & UAM export ──── */}
      <div className="bg-white rounded-lg border border-slate-200/90 shadow-2xs p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="max-w-3xl">
            <div className="flex items-center gap-2">
              <h2 className="text-[17px] font-bold text-slate-900 tracking-tight">User accounts &amp; role assignments</h2>
              <span className="text-[10px] font-bold bg-[#E4DDF8] text-[#492785] px-2 py-0.5 rounded-full">LAC-1 · LAC-3 · LAC-4 · AL-4</span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Assign roles to users and choose each custom role’s access template. Includes all AL-4.x required audit log fields.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <button type="button" onClick={handleExportAccessList}
              className="px-3.5 py-2 bg-white hover:bg-emerald-50 text-emerald-800 border border-emerald-300 text-xs font-semibold rounded-md cursor-pointer whitespace-nowrap">
              ↓ Export UAM list (CSV)
            </button>
            <button
              type="button"
              onClick={() => {
                if (accessActive && !isSystemAdmin) {
                  notifyAccess('error', 'LAC-1: User account creation is restricted to System Administrators.');
                  return;
                }
                setShowAddUserForm((v) => !v);
              }}
              className={`px-3.5 py-2 text-white text-xs font-semibold rounded-md cursor-pointer shrink-0 ${
                accessActive && !isSystemAdmin ? 'bg-slate-400 hover:bg-slate-500' : 'bg-[#492785] hover:bg-[#3b1f6b]'
              }`}
            >
              {showAddUserForm ? 'Cancel' : accessActive && !isSystemAdmin ? 'Add user account (Admin only)' : 'Add user account'}
            </button>
          </div>
        </div>

        {accessActive && !isSystemAdmin && (
          <div className="mt-3 px-3.5 py-2.5 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-900 flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className="font-bold">🔒 View-Only Mode (LAC-1 / LAC-3):</span>
              <span>
                Signed in as <strong>{currentUser.name}</strong> ({currentUser.headerSubtitle}). User account creation, role editing, and password resets require <strong>System administrator</strong> authority.
              </span>
            </div>
            <span className="px-2 py-0.5 rounded text-[10.5px] font-bold bg-amber-100 text-amber-800 border border-amber-300 uppercase">
              Role Authority Enforced
            </span>
          </div>
        )}

        {/* Add user form */}
        {showAddUserForm && (
          <div className="mt-4 p-4 bg-slate-50 border border-slate-200 rounded-lg space-y-3">
            <div className="flex items-center justify-between">
              <div className="text-xs font-bold text-slate-900">New user account — IA-1 / IA-2 / PM-3 / PM-4</div>
              <span className="text-[11px] text-slate-500">All fields with * are required</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Full name *</label>
                <input type="text" autoComplete="off" value={newUserName}
                  onChange={(e) => { setNewUserName(e.target.value); setNewUserFormError(''); }}
                  placeholder="e.g. S. Magsaysay"
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-md text-xs text-slate-800 focus:outline-none focus:ring-1 focus:ring-[#492785]" />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Email / UPN * <span className="text-slate-400 font-normal">(becomes username)</span></label>
                <input type="email" autoComplete="off" value={newUserEmail}
                  onChange={(e) => { setNewUserEmail(e.target.value); setNewUserNameError(''); setNewUserFormError(''); }}
                  placeholder="s.magsaysay@citysavings.com.ph"
                  className={`w-full px-3 py-2 bg-white border rounded-md text-xs text-slate-800 focus:outline-none focus:ring-1 focus:ring-[#492785] ${newUserNameError ? 'border-red-400 bg-red-50/30' : 'border-slate-300'}`} />
                {newUserNameError && <div className="text-xs text-red-700 mt-1 font-medium">{newUserNameError}</div>}
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Employee number</label>
                <input type="text" autoComplete="off" value={newUserEmployeeNo}
                  onChange={(e) => { setNewUserEmployeeNo(e.target.value); setNewUserFormError(''); }}
                  placeholder="EMP-XXX"
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-md text-xs text-slate-800 focus:outline-none focus:ring-1 focus:ring-[#492785]" />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Role</label>
                <select value={newUserRole}
                  onChange={(e) => { setNewUserRole(e.target.value); setNewUserFormError(''); }}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-md text-xs text-slate-800 focus:outline-none focus:ring-1 focus:ring-[#492785]">
                  {roleDefinitions.map(({ name }) => (
                    <option key={name} value={name}>{name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Scope</label>
                <input type="text" autoComplete="off" value={newUserScope}
                  onChange={(e) => { setNewUserScope(e.target.value); setNewUserFormError(''); }}
                  placeholder="Assigned engagements"
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-md text-xs text-slate-800 focus:outline-none focus:ring-1 focus:ring-[#492785]" />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Initial password <span className="text-slate-400 font-normal">(PM-4: leave blank for auto-generated)</span>
                </label>
                <div className="relative">
                  <input type={showNewUserPassword ? 'text' : 'password'} autoComplete="new-password"
                    value={newUserPassword}
                    onChange={(e) => { setNewUserPassword(e.target.value); setNewUserFormError(''); }}
                    placeholder="Auto-generated if empty"
                    className={`w-full px-3 py-2 bg-white border rounded-md text-xs text-slate-800 pr-10 focus:outline-none focus:ring-1 focus:ring-[#492785] ${newUserFormError && newUserPassword ? 'border-red-400' : 'border-slate-300'}`} />
                  <button type="button" onClick={() => setShowNewUserPassword((p) => !p)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 cursor-pointer text-[11px]">
                    {showNewUserPassword ? '🙈' : '👁️'}
                  </button>
                </div>
                {!newUserPassword && (
                  <p className="text-[10px] text-slate-500 mt-1">
                    Tip: If left blank, a compliant 14-character temporary password will be auto-generated.
                  </p>
                )}
                {newUserPassword && (() => {
                  const isPriv = normalizeRole(newUserRole) === 'System administrator';
                  const score = scorePasswordStrength(newUserPassword);
                  const { valid } = validatePasswordStrength(newUserPassword, isPriv);
                  const hasMinLen = newUserPassword.length >= (isPriv ? 12 : 8);
                  const hasLetter = /[a-zA-Z]/.test(newUserPassword);
                  const hasNumber = /[0-9]/.test(newUserPassword);
                  const hasSpecial = /[^a-zA-Z0-9]/.test(newUserPassword);

                  return (
                    <div className="mt-1.5 space-y-1">
                      <div className="flex gap-0.5">
                        {[0,1,2,3,4].map((i) => (
                          <div key={i} className={`h-1 flex-1 rounded-full ${i <= score ? PASSWORD_STRENGTH_COLORS[score] : 'bg-slate-200'}`} />
                        ))}
                      </div>
                      <div className="flex items-center justify-between text-[11px] text-slate-500">
                        <span>PM-13: Strength — <strong>{PASSWORD_STRENGTH_LABELS[score]}</strong></span>
                        <span className={valid ? 'text-emerald-700 font-semibold' : 'text-amber-700 font-medium'}>
                          {valid ? '✓ Policy met' : 'Policy requirement missing'}
                        </span>
                      </div>
                      <div className="flex flex-wrap gap-x-2.5 gap-y-0.5 text-[10px] pt-0.5">
                        <span className={hasMinLen ? 'text-emerald-700 font-medium' : 'text-slate-400'}>
                          {hasMinLen ? '✓' : '•'} {isPriv ? '12+ chars' : '8+ chars'}
                        </span>
                        <span className={hasLetter ? 'text-emerald-700 font-medium' : 'text-slate-400'}>
                          {hasLetter ? '✓' : '•'} Letters
                        </span>
                        <span className={hasNumber ? 'text-emerald-700 font-medium' : 'text-slate-400'}>
                          {hasNumber ? '✓' : '•'} Numbers
                        </span>
                        <span className={hasSpecial ? 'text-emerald-700 font-medium' : 'text-red-600 font-bold'}>
                          {hasSpecial ? '✓ Special symbol' : '✗ Symbol (!@#$%^&*)'}
                        </span>
                      </div>
                    </div>
                  );
                })()}
              </div>
            </div>

            {/* Inline validation error display right above the button */}
            {newUserFormError && (
              <div className="p-3 bg-red-50 border border-red-300 rounded-md text-xs text-red-900 font-medium flex items-start gap-2.5 shadow-2xs">
                <span className="text-red-600 font-bold text-sm shrink-0 leading-none mt-0.5">⚠️</span>
                <div className="flex-1">
                  <div className="font-bold text-red-900 mb-0.5">Cannot create account</div>
                  <div className="text-red-800 text-[11px] leading-relaxed">{newUserFormError}</div>
                </div>
              </div>
            )}

            <div className="flex items-center gap-3 pt-1">
              <button type="button" onClick={handleAddUser}
                className="px-4 py-2 bg-[#492785] hover:bg-[#3b1f6b] text-white text-xs font-semibold rounded-md cursor-pointer shadow-xs transition-colors">
                Create account
              </button>
              <button type="button" onClick={() => { setShowAddUserForm(false); setNewUserFormError(''); }}
                className="px-3 py-2 bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 text-xs font-medium rounded-md cursor-pointer">
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* Search & Filter Bar */}
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 p-3 bg-slate-50 border border-slate-200 rounded-md">
          <div className="flex flex-wrap items-center gap-3 flex-1 min-w-[280px]">
            <div className="relative flex-1 min-w-[220px] max-w-sm">
              <input
                type="text"
                value={userSearchQuery}
                onChange={(e) => setUserSearchQuery(e.target.value)}
                placeholder="Search by name, email, employee #, scope..."
                className="w-full pl-8 pr-7 py-1.5 bg-white border border-slate-300 rounded text-xs text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-[#492785]"
              />
              <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 text-xs">🔍</span>
              {userSearchQuery && (
                <button
                  type="button"
                  onClick={() => setUserSearchQuery('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs cursor-pointer"
                >
                  ✕
                </button>
              )}
            </div>

            <div className="flex items-center gap-1.5">
              <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">User type:</span>
              <select
                value={userTypeFilter}
                onChange={(e) => setUserTypeFilter(e.target.value)}
                className="px-2 py-1.5 bg-white border border-slate-300 rounded text-xs font-medium text-slate-800 focus:outline-none focus:border-[#492785]"
              >
                <option value="All types">All types</option>
                <option value="Internal Audit">Internal Audit</option>
                <option value="Auditee">Auditee</option>
              </select>
            </div>

            <div className="flex items-center gap-1.5">
              <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Role:</span>
              <select
                value={userRoleFilter}
                onChange={(e) => setUserRoleFilter(e.target.value)}
                className="px-2 py-1.5 bg-white border border-slate-300 rounded text-xs font-medium text-slate-800 focus:outline-none focus:border-[#492785]"
              >
                <option value="All roles">All roles</option>
                {roleDefinitions.map(({ name }) => (
                  <option key={name} value={name}>{name}</option>
                ))}
              </select>
            </div>

            <div className="flex items-center gap-1.5">
              <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Status:</span>
              <select
                value={userStatusFilter}
                onChange={(e) => setUserStatusFilter(e.target.value)}
                className="px-2 py-1.5 bg-white border border-slate-300 rounded text-xs font-medium text-slate-800 focus:outline-none focus:border-[#492785]"
              >
                <option value="All statuses">All statuses</option>
                <option value="Active">Active</option>
                <option value="Suspended">Suspended</option>
                <option value="Locked">Locked</option>
                <option value="Privileged">Privileged (IA-11)</option>
                <option value="MFA">MFA Enabled</option>
              </select>
            </div>

            {(userSearchQuery || userTypeFilter !== 'All types' || userRoleFilter !== 'All roles' || userStatusFilter !== 'All statuses') && (
              <button
                type="button"
                onClick={() => {
                  setUserSearchQuery('');
                  setUserTypeFilter('All types');
                  setUserRoleFilter('All roles');
                  setUserStatusFilter('All statuses');
                }}
                className="text-xs text-[#492785] hover:underline font-semibold cursor-pointer"
              >
                Reset
              </button>
            )}
          </div>

          <div className="text-[11px] font-mono-tabular text-slate-500">
            Showing {accessUsers.filter(matchesAccessUserFilters).length} of {accessUsers.length} accounts
          </div>
        </div>

        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 text-[10px] font-semibold text-slate-500 uppercase tracking-wider">
                <th className="py-2.5 pr-3">USER / EMP NO.</th>
                <th className="py-2.5 px-3">EMAIL</th>
                <th className="py-2.5 px-3">ROLES</th>
                <th className="py-2.5 px-3">LAST LOGIN (AL-4.4)</th>
                <th className="py-2.5 px-3">PW STATUS (PM-7/PM-9)</th>
                <th className="py-2.5 px-3">STATUS (AL-4.7)</th>
                <th className="py-2.5 pl-3 text-right">ACTIONS</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200/80 text-[12px]">
              {accessUsers
                .filter(matchesAccessUserFilters)
                .map((usr) => {
                const isLocked = (usr as any).isLocked || false;
                const failedCount = (usr as any).failedLoginCount || 0;
                const requiresPwChange = (usr as any).requiresPasswordChange || false;
                const mfaOn = (usr as any).mfaEnabled || false;
                const empNo = (usr as any).employeeNumber || '—';
                const lastLogin = (usr as any).lastLoginDate;
                const lastLoginDisplay = lastLogin && lastLogin !== '—'
                  ? new Date(lastLogin).toLocaleString('en-PH', { dateStyle: 'medium', timeStyle: 'short' })
                  : '—';
                const expiryState = getUserExpiryState(usr);
                return (
                  <tr key={usr.id} className={`transition-colors ${isLocked ? 'bg-red-50/40' : 'hover:bg-slate-50/40'}`}>
                    <td className="py-3 pr-3">
                      <div className="font-bold text-slate-900">{usr.name}</div>
                      <div className="text-[11px] text-slate-500 mt-0.5">{usr.title}</div>
                      <div className="text-[10px] text-slate-400 font-mono-tabular mt-0.5">{empNo}</div>
                      {(usr as any).isPrivileged && (
                        <span className="inline-block mt-0.5 text-[9px] font-bold bg-amber-100 text-amber-800 border border-amber-300 px-1.5 py-0.5 rounded-full">
                          IA-11 Privileged
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-3 font-mono-tabular text-[11px] text-slate-700">{usr.email}</td>
                    <td className="py-3 px-3">
                      <div className="flex flex-wrap items-center gap-1.5">
                        {usr.roles.map((r) => {
                          const norm = normalizeRole(r);
                          return (
                            <span key={r} className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                              norm === 'System administrator' || norm === 'Chief Audit Executive'
                                ? 'bg-[#E4DDF8] text-[#492785]'
                                : norm === 'Audit Division Head'
                                ? 'bg-[#DCE8FB] text-[#1D4ED8]'
                                : norm === 'Audit Supervisor' || norm === 'Independent Reviewer'
                                ? 'bg-indigo-50 text-indigo-700 border border-indigo-200'
                                : norm === 'Audit-in-Charge'
                                ? 'bg-teal-50 text-teal-800 border border-teal-200'
                                : norm === 'Assisting Auditor'
                                ? 'bg-amber-100 text-amber-900 border border-amber-300'
                                : 'bg-slate-100 text-slate-700'
                            }`}>{r}</span>
                          );
                        })}
                        <select
                          value={roleDefinitions.some((role) => role.name === usr.roles[0]) ? usr.roles[0] : normalizeRole(usr.roles[0])}
                          onChange={(e) => handleUpdateUserRole(usr.id, e.target.value)}
                          className="text-[10px] bg-white border border-slate-300 rounded px-1.5 py-0.5 text-slate-700 hover:border-[#492785] cursor-pointer focus:outline-none focus:ring-1 focus:ring-[#492785]"
                          title="Change assigned role">
                          {roleDefinitions.map(({ name }) => (
                            <option key={name} value={name}>{name}</option>
                          ))}
                        </select>
                        {mfaOn && <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 rounded-full">MFA ✓</span>}
                      </div>
                    </td>
                    <td className="py-3 px-3 text-[11px] text-slate-600">{lastLoginDisplay}</td>
                    <td className="py-3 px-3">
                      {requiresPwChange && (
                        <span className="inline-block text-[10px] font-semibold bg-orange-100 text-orange-800 border border-orange-300 px-2 py-0.5 rounded-full">
                          PM-3: First login — change required
                        </span>
                      )}
                      {!requiresPwChange && expiryState === 'expired' && (
                        <span className="inline-block text-[10px] font-semibold bg-red-100 text-red-800 border border-red-300 px-2 py-0.5 rounded-full">
                          PM-9: Password expired
                        </span>
                      )}
                      {!requiresPwChange && expiryState === 'warningSoon' && (
                        <span className="inline-block text-[10px] font-semibold bg-yellow-100 text-yellow-800 border border-yellow-300 px-2 py-0.5 rounded-full">
                          PM-8: Expires soon (&lt;15 days)
                        </span>
                      )}
                      {!requiresPwChange && expiryState === 'ok' && (
                        <span className="inline-block text-[10px] font-semibold bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded-full">
                          OK
                        </span>
                      )}
                      {!requiresPwChange && expiryState === 'notSet' && (
                        <span className="text-[10px] text-slate-400">—</span>
                      )}
                    </td>
                    <td className="py-3 px-3">
                      {isLocked ? (
                        <div>
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-red-100 text-red-700 border border-red-300">
                            <span className="w-1.5 h-1.5 rounded-full bg-red-600" />
                            Locked ({failedCount} attempts)
                          </span>
                        </div>
                      ) : usr.status === 'Suspended' ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-slate-100 text-slate-600 border border-slate-300">
                          <span className="w-1.5 h-1.5 rounded-full bg-slate-400" />
                          Suspended
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-[#DCEFE2] text-[#1E6339]">
                          <span className="w-1.5 h-1.5 rounded-full bg-[#1E6339]" />
                          {usr.status}
                        </span>
                      )}
                    </td>
                    <td className="py-3 pl-3 text-right whitespace-nowrap">
                      <div className="inline-flex items-center gap-1 flex-wrap justify-end">
                        {isLocked && (
                          <button type="button" onClick={() => handleAdminUnlock(usr.id, usr.name)}
                            className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white border border-emerald-700 rounded text-[10px] font-bold cursor-pointer">
                            Unlock (IA-9)
                          </button>
                        )}
                        <button type="button"
                          onClick={() => handleOpenEditAccess(usr)}
                          className="px-2 py-1 bg-[#492785] hover:bg-[#3b1f6b] text-white rounded text-[10px] font-semibold cursor-pointer whitespace-nowrap">
                          {accessActive && !isSystemAdmin ? 'View access' : 'Edit access'}
                        </button>
                        <button type="button"
                          onClick={() => { const found = userProfiles.find((u: UserProfile) => u.name === usr.name); if (found) { onChangeUser(found); } else { const roleName = usr.roles[0]; const accessRole = normalizeRole(roleName); onChangeUser({ id: usr.id, name: usr.name, roleTitle: usr.roles.join(', '), fullLabel: `${usr.name} — ${usr.roles.join(', ')}`, headerSubtitle: roleName, department: usr.title, canApproveHead: accessRole === 'Chief Audit Executive' || accessRole === 'System administrator', canApproveIndependent: accessRole === 'Audit Division Head' || accessRole === 'Audit Supervisor' || accessRole === 'Independent Reviewer', canApproveCAE: accessRole === 'Chief Audit Executive' }); } }}
                          className="px-2 py-1 bg-white hover:bg-slate-50 text-slate-800 border border-slate-300 rounded text-[10px] font-medium cursor-pointer">
                          Impersonate
                        </button>
                        {(!accessActive || isSystemAdmin) && (
                          <>
                            <button type="button"
                              onClick={() => handleGenerateTempPw(usr.id)}
                              className="px-2 py-1 bg-white hover:bg-slate-50 text-slate-800 border border-slate-300 rounded text-[10px] font-medium cursor-pointer">
                              Reset PW
                            </button>
                            <button type="button"
                              onClick={() => {
                                setAccessUsers((prev) =>
                                  prev.map((item) => {
                                    if (item.id !== usr.id) return item;
                                    const nextStatus = item.status === 'Active' ? 'Suspended' : 'Active';
                                    const roleName = usr.roles[0];
                                    const normR = normalizeRole(roleName);
                                    if (onUpdateUserProfile) {
                                      onUpdateUserProfile({
                                        id: usr.id,
                                        name: usr.name,
                                        roleTitle: usr.title,
                                        fullLabel: `${usr.name} – ${roleName}`,
                                        headerSubtitle: roleName,
                                        department: 'Internal Audit',
                                        canApproveHead: normR === 'Chief Audit Executive' || normR === 'System administrator',
                                        canApproveIndependent: normR === 'Audit Division Head' || normR === 'Audit Supervisor' || normR === 'Independent Reviewer',
                                        canApproveCAE: normR === 'Chief Audit Executive',
                                        accountStatus: nextStatus === 'Active' ? 'Active' : 'Inactive',
                                      });
                                    }
                                    return { ...item, status: nextStatus } as any;
                                  })
                                );
                              }}
                              className="px-2 py-1 bg-white hover:bg-slate-50 text-slate-800 border border-slate-300 rounded text-[10px] font-medium cursor-pointer">
                              {usr.status === 'Active' ? 'Suspend' : 'Activate'}
                            </button>
                            <button type="button"
                              onClick={() => {
                                setAccessUsers((prev) => prev.filter((item) => item.id !== usr.id));
                                if (onDeleteUserProfile) {
                                  onDeleteUserProfile(usr.id);
                                }
                              }}
                              className="px-2 py-1 bg-white hover:bg-rose-50 text-rose-700 border border-rose-200 rounded text-[10px] font-medium cursor-pointer">
                              Remove
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
              {accessUsers.filter(matchesAccessUserFilters).length === 0 && (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-xs text-slate-500">
                    No user accounts match the selected filters or search query.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Modal: Edit Access Rights & Account Settings */}
        {editingAccessUser && (
          <div className="fixed inset-0 bg-slate-900/50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-lg border border-slate-200 shadow-xl max-w-lg w-full p-6 text-xs">
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="text-base font-bold text-slate-900">
                    Edit Access Rights &amp; User Profile
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Configure role assignments, operational scope, MFA requirement, and account status (LAC-1 / LAC-3).
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setEditingAccessUser(null)}
                  className="text-slate-400 hover:text-slate-600 text-sm font-bold cursor-pointer"
                >
                  ✕
                </button>
              </div>

              <form onSubmit={handleSaveEditAccess} className="mt-4 space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">
                      Full Name *
                    </label>
                    <input
                      type="text"
                      required
                      value={editFormName}
                      onChange={(e) => setEditFormName(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-300 rounded text-xs text-slate-800 focus:outline-none focus:border-[#492785]"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">
                      Employee Number
                    </label>
                    <input
                      type="text"
                      value={editFormEmpNo}
                      onChange={(e) => setEditFormEmpNo(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-300 rounded text-xs text-slate-800 focus:outline-none focus:border-[#492785]"
                    />
                  </div>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Email Address / Corporate UPN *
                  </label>
                  <input
                    type="email"
                    required
                    value={editFormEmail}
                    onChange={(e) => setEditFormEmail(e.target.value)}
                    placeholder="e.g. christian.macahilig@citysavings.com.ph"
                    className="w-full px-3 py-2 border border-slate-300 rounded text-xs text-slate-800 focus:outline-none focus:border-[#492785]"
                  />
                  <p className="text-[11px] text-slate-500 mt-1">
                    Official corporate email address (e.g. @citysavings.com.ph or @citysaving.com.ph).
                  </p>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Internal Audit Role *
                  </label>
                  <select
                    value={editFormRole}
                    onChange={(e) => setEditFormRole(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded text-xs text-slate-800 bg-white focus:outline-none focus:border-[#492785]"
                  >
                    {roleDefinitions.map(({ name }) => (
                      <option key={name} value={name}>{name}</option>
                    ))}
                  </select>
                  <p className="text-[11px] text-slate-500 mt-1">
                    {editFormRole === 'Chief Audit Executive' && 'Full executive authority: Stage 02 memo sign-off, Tier 2 QA review, final report issuance, and issue closure.'}
                    {editFormRole === 'Audit Division Head' && 'Review sign-off authority: independent quality review (Tier 1), report review, and issue verification.'}
                    {editFormRole === 'Audit Supervisor' && 'Fieldwork supervisory review authority: reviewer notes and engagement recommendation.'}
                    {editFormRole === 'Independent Reviewer' && 'Independent quality review authority for working papers and findings.'}
                    {editFormRole === 'Audit Committee Member' && 'Read-only oversight of audit plans, progress, and issues.'}
                    {editFormRole === 'Executive Viewer' && 'Read-only access to executive audit summaries and plans.'}
                    {editFormRole === 'Audit-in-Charge' && 'Engagement lead: prepare working papers, coordinate exit conferences, compile report drafts.'}
                    {editFormRole === 'Assisting Auditor' && 'Audit fieldwork executor: prepare assigned working notes and execute audit test steps.'}
                    {editFormRole === 'System administrator' && 'Platform setup, master data configuration, user access management, and security policy.'}
                    {isAuditeeRole(editFormRole) && 'Business unit recipient: receive kickoff notices, review findings, and upload remediation evidence.'}
                  </p>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Operational Scope
                  </label>
                  <input
                    type="text"
                    value={editFormScope}
                    onChange={(e) => setEditFormScope(e.target.value)}
                    placeholder="e.g. Assigned engagements, Full access, IT operations"
                    className="w-full px-3 py-2 border border-slate-300 rounded text-xs text-slate-800 focus:outline-none focus:border-[#492785]"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Account Status
                  </label>
                  <select
                    value={editFormStatus}
                    onChange={(e) => setEditFormStatus(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded text-xs text-slate-800 bg-white focus:outline-none focus:border-[#492785]"
                  >
                    <option value="Active">Active (Permitted to log in)</option>
                    <option value="Suspended">Suspended (Access temporarily revoked)</option>
                  </select>
                </div>

                <div className="pt-2 border-t border-slate-200/80 space-y-2">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={editFormMfa}
                      onChange={(e) => setEditFormMfa(e.target.checked)}
                      className="rounded text-[#492785] focus:ring-[#492785]"
                    />
                    <span className="font-semibold text-slate-800 text-xs">
                      Enforce Multi-Factor Authentication (MFA / 2FA)
                    </span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={editFormPrivileged}
                      onChange={(e) => setEditFormPrivileged(e.target.checked)}
                      className="rounded text-[#492785] focus:ring-[#492785]"
                    />
                    <span className="font-semibold text-slate-800 text-xs">
                      IA-11 Privileged Account (Registers in OCISO Assessment Ledger)
                    </span>
                  </label>
                </div>

                {accessActive && !isSystemAdmin && (
                  <div className="p-2.5 bg-amber-50 border border-amber-200 rounded text-amber-900 text-xs font-medium">
                    🔒 View-Only Mode (LAC-1): You are inspecting this user&apos;s access configuration. Modifying roles, credentials, or scopes requires System Administrator authority.
                  </div>
                )}

                <div className="flex justify-end gap-2 pt-3 border-t border-slate-100 mt-4">
                  <button
                    type="button"
                    onClick={() => setEditingAccessUser(null)}
                    className="px-3.5 py-1.5 border border-slate-300 rounded-md font-semibold text-slate-700 cursor-pointer hover:bg-slate-50"
                  >
                    {accessActive && !isSystemAdmin ? 'Close' : 'Cancel'}
                  </button>
                  {(!accessActive || isSystemAdmin) && (
                    <button
                      type="submit"
                      className="px-4 py-1.5 bg-[#492785] hover:bg-[#3b1f6b] text-white rounded-md font-semibold cursor-pointer"
                    >
                      Save Changes
                    </button>
                  )}
                </div>
              </form>
            </div>
          </div>
        )}

        {/* PM-10: Password reset token modal */}
        {resetTargetId && (
          <div className="mt-4 p-4 bg-amber-50 border border-amber-200 rounded-lg">
            <div className="text-xs font-bold text-amber-900 mb-1">
              PM-4/PM-10: Temporary password generated — single-use, expires in 15–30 min
            </div>
            <p className="text-xs text-amber-800 mb-2">
              User will be required to change this password on first login (PM-3). Send via secure channel only — do not transmit in cleartext email.
            </p>
            <div className="flex items-center gap-2">
              <code className={`px-3 py-1.5 bg-white border border-amber-300 rounded text-sm font-mono font-bold text-amber-900 tracking-widest ${showTempPw ? '' : 'blur-sm select-none'}`}>
                {generatedTempPw}
              </code>
              <button type="button" onClick={() => setShowTempPw((p) => !p)}
                className="text-xs text-amber-700 hover:underline cursor-pointer font-medium">
                {showTempPw ? 'Hide' : 'Reveal'}
              </button>
              <button type="button" onClick={() => { setResetTargetId(null); setGeneratedTempPw(''); setShowTempPw(false); }}
                className="ml-auto text-xs text-amber-700 hover:underline cursor-pointer font-medium">
                Dismiss
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ── IA-11: Privileged Account Register ──────────────────────────── */}
      <div className="bg-white rounded-lg border border-slate-200/90 shadow-2xs p-5">
        <div className="flex items-center gap-2 mb-1">
          <h2 className="text-[16px] font-bold text-slate-900">Privileged account register</h2>
          <span className="text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-300 px-2 py-0.5 rounded-full">IA-11</span>
        </div>
        <p className="text-xs text-slate-500 mb-4">
          All Admin and privileged accounts at application, database, and OS layers must be declared and handed over to OCISO as a supporting artifact during assessment.
        </p>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-[12px]">
            <thead>
              <tr className="border-b border-slate-200 text-[10px] font-semibold text-slate-500 uppercase tracking-wider">
                <th className="py-2 pr-4">ACCOUNT</th>
                <th className="py-2 px-4">EMPLOYEE NO.</th>
                <th className="py-2 px-4">LAYER</th>
                <th className="py-2 px-4">MFA</th>
                <th className="py-2 px-4">PW MAX AGE</th>
                <th className="py-2 pl-4">STATUS</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {accessUsers
                .filter((u) => u.roles.includes('System administrator') || u.roles.includes('Chief Audit Executive'))
                .map((u) => (
                  <tr key={u.id} className="hover:bg-amber-50/30">
                    <td className="py-2.5 pr-4">
                      <div className="font-bold text-slate-900">{u.name}</div>
                      <div className="text-[10px] text-slate-500">{u.email}</div>
                    </td>
                    <td className="py-2.5 px-4 font-mono-tabular text-slate-600">{(u as any).employeeNumber || '—'}</td>
                    <td className="py-2.5 px-4 text-slate-600">Application</td>
                    <td className="py-2.5 px-4">
                      {(u as any).mfaEnabled
                        ? <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 rounded-full">Enabled ✓</span>
                        : <span className="text-[10px] font-bold text-red-700 bg-red-50 border border-red-200 px-1.5 py-0.5 rounded-full">⚠ Not set</span>
                      }
                    </td>
                    <td className="py-2.5 px-4 text-slate-600">
                      {(u as any).mfaEnabled ? '365 days (PM-7 with MFA)' : '180 days (PM-7 no MFA)'}
                    </td>
                    <td className="py-2.5 pl-4">
                      <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                        u.status === 'Active' ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-600'
                      }`}>{u.status}</span>
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── SM-1/SM-4: Session Management Info ──────────────────────────── */}
      <div className="bg-white rounded-lg border border-slate-200/90 shadow-2xs p-5">
        <div className="flex items-center gap-2 mb-2">
          <h2 className="text-[16px] font-bold text-slate-900">Session management policy</h2>
          <span className="text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200 px-2 py-0.5 rounded-full">SM-1 · SM-2 · SM-4</span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg">
            <div className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">IDLE TIMEOUT (SM-1)</div>
            <div className="text-[22px] font-bold text-[#492785] mt-1">15 min</div>
            <p className="text-[11px] text-slate-500 mt-1">Configurable in Settings → Security Policy. Session invalidated server-side on timeout.</p>
          </div>
          <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg">
            <div className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">ABSOLUTE TIMEOUT (SM-2)</div>
            <div className="text-[22px] font-bold text-[#492785] mt-1">8 hours</div>
            <p className="text-[11px] text-slate-500 mt-1">Force re-login after 8 h of continuous activity regardless of idle state.</p>
          </div>
          <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg">
            <div className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">CONCURRENT LOGINS (SM-4)</div>
            <div className="text-[22px] font-bold text-[#492785] mt-1">Disallowed</div>
            <p className="text-[11px] text-slate-500 mt-1">New login revokes all existing session tokens. One active session per user at all times.</p>
          </div>
        </div>
        <div className="mt-3 px-3 py-2 bg-blue-50 border border-blue-200 rounded text-[11px] text-blue-800">
          <strong>SM-3 (optional):</strong> A countdown dialog appears 2 minutes before idle timeout: &ldquo;Your session will expire in 2 minutes. Click to stay logged in.&rdquo;
          Session cookies issued with <code>Secure</code>, <code>HttpOnly</code>, and <code>SameSite=Strict</code> attributes.
          Session ID regenerated after each successful login (session fixation prevention).
        </div>
      </div>

      <div className="bg-white rounded-lg border border-slate-200/90 shadow-2xs p-5">
        <h2 className="text-[16px] font-bold text-slate-900">Role definitions</h2>
        <p className="text-xs text-slate-500 mt-1">
          Add roles and select an existing access template. New roles appear in user assignment and in the permission matrix.
        </p>
        <div className="mt-4 flex flex-wrap items-end gap-3">
          <label className="flex-1 min-w-[220px] text-xs font-medium text-slate-700">
            Role name
            <input
              value={newRoleName}
              onChange={(event) => setNewRoleName(event.target.value)}
              onKeyDown={(event) => event.key === 'Enter' && handleAddRole()}
              placeholder="e.g. Regional Audit Lead"
              className="mt-1 w-full px-3 py-2 border border-slate-300 rounded-md text-xs"
            />
          </label>
          <label className="min-w-[220px] text-xs font-medium text-slate-700">
            Access template
            <select
              value={newRoleAccess}
              onChange={(event) => setNewRoleAccess(event.target.value as AppRole)}
              className="mt-1 w-full px-3 py-2 border border-slate-300 rounded-md text-xs bg-white"
            >
              {APP_ROLES.map((role) => <option key={role} value={role}>{role}</option>)}
            </select>
          </label>
          <button
            type="button"
            onClick={handleAddRole}
            className="px-3.5 py-2 bg-[#492785] hover:bg-[#3b1f6b] text-white text-xs font-semibold rounded-md"
          >
            Add role
          </button>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          {roleDefinitions.map((role) => (
            <span key={role.name} className="inline-flex items-center gap-2 px-2.5 py-1 bg-slate-50 border border-slate-200 rounded-full text-[11px] text-slate-700">
              <span>{role.name}</span>
              {role.builtIn ? (
                <span className="text-slate-400">· built-in</span>
              ) : (
                <select
                  aria-label={`Access template for ${role.name}`}
                  value={role.accessRole}
                  onChange={(event) => handleUpdateRoleAccess(role.name, event.target.value as AppRole)}
                  className="bg-white border border-slate-200 rounded px-1.5 py-0.5 text-[10px]"
                >
                  {APP_ROLES.map((accessRole) => <option key={accessRole} value={accessRole}>{accessRole}</option>)}
                </select>
              )}
              {!role.builtIn && (
                <button
                  type="button"
                  onClick={() => handleRemoveRole(role)}
                  aria-label={`Remove ${role.name}`}
                  className="text-slate-500 hover:text-red-700 font-bold"
                >
                  ×
                </button>
              )}
            </span>
          ))}
        </div>
      </div>

      {/* ── Role permission matrix (Configurable) ───────────────────────── */}
      <div className="bg-white rounded-lg border border-slate-200/90 shadow-2xs p-5">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-[16px] font-bold text-slate-900">Role permission matrix</h2>
              <span className="text-[10px] font-bold bg-[#E4DDF8] text-[#492785] px-2 py-0.5 rounded-full">
                {isEditingMatrix ? 'Editing Mode' : 'Configured & Active'}
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Maintain the role-to-capability matrix across the 6-stage audit lifecycle. Application access follows each role’s selected access template.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {!isEditingMatrix ? (
              <button
                type="button"
                onClick={() => setIsEditingMatrix(true)}
                className="px-3.5 py-1.5 bg-[#492785] hover:bg-[#3b1f6b] text-white text-xs font-semibold rounded-md cursor-pointer transition-colors"
              >
                ⚙️ Configure matrix
              </button>
            ) : (
              <>
                <button
                  type="button"
                  onClick={handleSaveMatrix}
                  className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-md cursor-pointer transition-colors"
                >
                  ✓ Save matrix
                </button>
                <button
                  type="button"
                  onClick={handleResetMatrix}
                  className="px-3 py-1.5 bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 text-xs font-medium rounded-md cursor-pointer transition-colors"
                >
                  Reset defaults
                </button>
                <button
                  type="button"
                  onClick={() => setIsEditingMatrix(false)}
                  className="px-3 py-1.5 bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 text-xs font-medium rounded-md cursor-pointer transition-colors"
                >
                  Cancel
                </button>
              </>
            )}
          </div>
        </div>

        {isEditingMatrix && (
          <div className="mb-4 p-3 bg-purple-50/50 border border-purple-200 rounded-md flex flex-wrap items-center gap-2">
            <span className="text-xs font-semibold text-[#492785]">Add custom capability:</span>
            <input
              type="text"
              value={newMatrixCapability}
              onChange={(e) => setNewMatrixCapability(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleAddMatrixRow()}
              placeholder="e.g. Stage 07 Continuous Monitoring & Analytics"
              className="flex-1 min-w-[240px] px-2.5 py-1 text-xs bg-white border border-slate-300 rounded focus:outline-none focus:border-[#492785]"
            />
            <button
              type="button"
              onClick={handleAddMatrixRow}
              className="px-3 py-1 bg-[#492785] text-white text-xs font-semibold rounded cursor-pointer"
            >
              + Add Row
            </button>
          </div>
        )}

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-[12px]">
            <thead>
              <tr className="border-b border-slate-200 text-[10px] font-semibold text-slate-500 uppercase tracking-wider">
                <th className="py-2.5 pr-3 min-w-[200px]">CAPABILITY / LIFECYCLE STAGE</th>
                {roleDefinitions.map((role) => (
                  <th key={role.name} className="py-2.5 px-2 min-w-[120px]">{role.name}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200/80">
              {matrixRows.map((row, rIdx) => (
                <tr key={row.capability + rIdx} className="hover:bg-slate-50/40">
                  <td className="py-2.5 pr-3 font-semibold text-slate-900 text-[11.5px]">
                    {row.capability}
                  </td>
                  {roleDefinitions.map((role) => {
                    const value = getMatrixValue(row, role);
                    return (
                      <td key={role.name} className="py-2.5 px-2">
                        {isEditingMatrix ? (
                          <input
                            type="text"
                            value={value}
                            onChange={(e) => handleMatrixCellChange(rIdx, role.name, e.target.value)}
                            aria-label={`${row.capability} permission for ${role.name}`}
                            className="w-28 px-1.5 py-1 border border-slate-300 rounded text-xs bg-white"
                          />
                        ) : (
                          <span className={`inline-block px-1.5 py-0.5 rounded text-[11px] font-medium ${
                            value === 'Full' ? 'bg-purple-100 text-purple-900' :
                              value.includes('Approve') || value.includes('Sign') ? 'bg-[#E4DDF8] text-[#492785] font-semibold' :
                                value === '—' ? 'text-slate-400' : 'text-slate-700'
                          }`}>
                            {value}
                          </span>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
