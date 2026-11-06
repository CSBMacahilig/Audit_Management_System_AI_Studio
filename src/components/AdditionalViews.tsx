import React, { useState } from 'react';
import {
  AuditEngagement,
  FULL_UNIVERSE_RECORDS,
  INITIAL_ENGAGEMENTS,
  INITIAL_ISSUES_REGISTER,
  IssueRegisterItem,
  LifecycleStageId,
  MainTabId,
  RiskLevel,
  UniverseEntity,
  UniverseRecord,
  USERS,
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

// 1. OVERVIEW VIEW (Exact match to Audit-Management-System.png)
export const OverviewView: React.FC<{
  engagements: AuditEngagement[];
  onSelectLifecycleStage: (stageId: LifecycleStageId) => void;
  onOpenEngagement: (eng: AuditEngagement) => void;
  onSelectTab: (tab: MainTabId) => void;
}> = ({ onOpenEngagement, onSelectTab, onSelectLifecycleStage, engagements }) => {
  // Exact 5 matrix rows for L=5 down to L=1 and I=1 to I=5 matching Audit-Management-System.png
  // Total 160 entities: 30 Critical, 82 High, 45 Medium, 3 Low
  const heatMapCells: {
    l: number;
    i: number;
    count: number;
    level: RiskLevel;
  }[][] = [
    [
      { l: 5, i: 1, count: 0, level: 'Medium' },
      { l: 5, i: 2, count: 1, level: 'High' },
      { l: 5, i: 3, count: 2, level: 'High' },
      { l: 5, i: 4, count: 9, level: 'Critical' },
      { l: 5, i: 5, count: 9, level: 'Critical' },
    ],
    [
      { l: 4, i: 1, count: 0, level: 'Low' },
      { l: 4, i: 2, count: 5, level: 'Medium' },
      { l: 4, i: 3, count: 23, level: 'High' },
      { l: 4, i: 4, count: 53, level: 'High' },
      { l: 4, i: 5, count: 12, level: 'Critical' },
    ],
    [
      { l: 3, i: 1, count: 0, level: 'Low' },
      { l: 3, i: 2, count: 8, level: 'Medium' },
      { l: 3, i: 3, count: 32, level: 'Medium' },
      { l: 3, i: 4, count: 3, level: 'High' },
      { l: 3, i: 5, count: 0, level: 'High' },
    ],
    [
      { l: 2, i: 1, count: 0, level: 'Low' },
      { l: 2, i: 2, count: 3, level: 'Low' },
      { l: 2, i: 3, count: 0, level: 'Medium' },
      { l: 2, i: 4, count: 0, level: 'Medium' },
      { l: 2, i: 5, count: 0, level: 'High' },
    ],
    [
      { l: 1, i: 1, count: 0, level: 'Low' },
      { l: 1, i: 2, count: 0, level: 'Low' },
      { l: 1, i: 3, count: 0, level: 'Low' },
      { l: 1, i: 4, count: 0, level: 'Low' },
      { l: 1, i: 5, count: 0, level: 'Medium' },
    ],
  ];

  const getCellStyle = (level: RiskLevel, count: number) => {
    switch (level) {
      case 'Critical':
        return count > 0
          ? 'bg-[#B93829] text-white'
          : 'bg-[#E39B93] text-white/90';
      case 'High':
        return count > 0
          ? 'bg-[#D97724] text-white'
          : 'bg-[#EAB586] text-white/90';
      case 'Medium':
        return count > 0
          ? 'bg-[#C99E2C] text-white'
          : 'bg-[#E3CC8D] text-white/90';
      case 'Low':
        return count > 0
          ? 'bg-[#519E66] text-white'
          : 'bg-[#9DCAA9] text-white/90';
    }
  };

  const reauditWatchlist = [
    {
      name: 'APDS deduction file generation & transmission',
      risk: 'Critical' as RiskLevel,
      dueText: 'Due 20 May 2026 (140d overdue)',
    },
    {
      name: 'Mobile Banking App – application security',
      risk: 'Critical' as RiskLevel,
      dueText: 'Due 15 Jun 2026 (114d overdue)',
    },
    {
      name: 'Treasury – liquidity & BSP reserve management',
      risk: 'Critical' as RiskLevel,
      dueText: 'Due 18 Aug 2026 (50d overdue)',
    },
    {
      name: 'APDS remittance reconciliation',
      risk: 'Critical' as RiskLevel,
      dueText: 'Due 13 Sept 2026 (24d overdue)',
    },
    {
      name: 'Loan release via cash card',
      risk: 'High' as RiskLevel,
      dueText: 'Due 18 Sept 2026 (19d overdue)',
    },
  ];

  const overdueRemediation = [
    {
      ref: 'ISS-2026-001',
      title: 'Long-outstanding APDS variance items (>90 days)',
      severity: 'High' as RiskLevel,
      meta: 'R. Bautista · 8d overdue',
    },
    {
      ref: 'ISS-2026-002',
      title: 'Manual adjustments without dual sign-off',
      severity: 'Medium' as RiskLevel,
      meta: 'R. Bautista · 8d overdue',
    },
    {
      ref: 'ISS-2026-003',
      title: '28 loans exceeded 50% NTHP cap',
      severity: 'High' as RiskLevel,
      meta: 'V. Pascual · 8d overdue',
    },
  ];

  const activeAndUpcoming = [
    {
      ref: 'AUD-2026-006',
      title: 'Mobile Banking Application Security Review',
      meta: 'P. Mendoza · 14 Sept – 23 Oct',
      status: 'Reporting' as const,
      engId: 'aud-2026-006',
    },
    {
      ref: 'AUD-2026-005',
      title: 'Cash Card Loan Release Audit',
      meta: 'K. Lim · 1 Oct – 9 Nov',
      status: 'Reporting' as const,
      engId: 'aud-2026-005',
    },
    {
      ref: 'AUD-2026-007',
      title: 'Stopped Deductions & Unremitted Accounts Audit',
      meta: 'A. Villanueva · 12 Oct – 20 Nov',
      status: 'Scheduled' as const,
      engId: 'aud-2026-007',
    },
    {
      ref: 'AUD-2026-094',
      title: 'Core Banking – privileged access management Audit-Test',
      meta: 'N. Lopez · 27 Oct – 4 Dec',
      status: 'In progress' as const,
      engId: 'aud-2026-094',
    },
    {
      ref: 'AUD-2027-004',
      title: 'APDS system integration',
      meta: 'B. Tolentino · 16 Feb – 27 Mar',
      status: 'In progress' as const,
      engId: 'aud-2027-004',
    },
  ];

  return (
    <div className="space-y-4">
      {/* Top 4 KPI Cards matching Audit-Management-System (1).png */}
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
            160
          </div>
          <div className="flex flex-wrap items-center gap-1.5 text-xs text-slate-600 mt-2.5 tabular-nums">
            <span className="px-1.5 py-0.5 rounded bg-[#B93829] text-white font-bold text-[11px]">
              30
            </span>
            <span>Critical</span>
            <span className="px-1.5 py-0.5 rounded bg-[#D97724] text-white font-bold text-[11px] ml-1">
              82
            </span>
            <span>High</span>
          </div>
        </div>

        {/* Card 2: 2026 PLAN PROGRESS */}
        <div
          onClick={() => {
            onSelectLifecycleStage(1);
            onSelectTab('annual-plan');
          }}
          className="bg-white rounded-lg border border-slate-200/90 p-5 shadow-2xs cursor-pointer hover:border-[#542D84]/50 transition-colors"
        >
          <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
            2026 PLAN PROGRESS
          </div>
          <div className="text-[30px] font-bold text-slate-900 font-mono-tabular leading-tight mt-1">
            4/93
          </div>
          <div className="w-full h-1.5 bg-slate-200 rounded-full overflow-hidden mt-3">
            <div className="h-full bg-[#492785] rounded-full" style={{ width: '5%' }} />
          </div>
          <div className="text-xs text-slate-500 mt-2 tabular-nums">
            4 active · 85 planned
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
            9
          </div>
          <div className="text-xs text-slate-600 mt-2.5 tabular-nums">
            <span className="text-[#B93829] font-semibold">3 overdue</span> · 1 due in 30d
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
            5
          </div>
          <div className="text-xs text-slate-500 mt-2.5 tabular-nums">
            + 0 due within 60 days
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
            Likelihood (vertical) × Impact (horizontal) across the audit universe.
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
                  <span
                    className={`px-2 py-0.5 rounded text-[11px] font-bold text-white shrink-0 ${
                      item.risk === 'Critical' ? 'bg-[#B93829]' : 'bg-[#D97724]'
                    }`}
                  >
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
        </div>
      </div>

      {/* Bottom 2-Column Row matching Audit-Management-System.png */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Left Bottom Card: Overdue remediation items */}
        <div className="bg-white rounded-lg border border-slate-200/90 p-6 shadow-2xs">
          <h2 className="text-[17px] font-bold text-slate-900 tracking-tight">
            Overdue remediation items
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Issues past their current due date requiring escalation.
          </p>

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
        </div>

        {/* Right Bottom Card: Active & upcoming engagements */}
        <div className="bg-white rounded-lg border border-slate-200/90 p-6 shadow-2xs">
          <h2 className="text-[17px] font-bold text-slate-900 tracking-tight">
            Active &amp; upcoming engagements
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Audits currently in fieldwork, reporting, or scheduled next.
          </p>

          <div className="mt-4 divide-y divide-slate-200/80">
            {activeAndUpcoming.map((item) => {
              const matched =
                engagements.find((e) => e.id === item.engId) || engagements[0];
              return (
                <div
                  key={item.ref}
                  onClick={() => onOpenEngagement(matched)}
                  className="py-3 first:pt-1 last:pb-0 flex items-center justify-between gap-3 hover:bg-slate-50/70 px-1 rounded cursor-pointer"
                >
                  <div>
                    <div className="text-[13.5px] font-bold text-slate-900">
                      <span className="font-mono-tabular">{item.ref}</span> {item.title}
                    </div>
                    <div className="text-xs text-slate-500 mt-0.5">{item.meta}</div>
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
        </div>
      </div>
    </div>
  );
};

// 2. AUDIT UNIVERSE VIEW (Exact match to Audit-Management-System (8).png)
export const AuditUniverseView: React.FC<{
  universe: UniverseEntity[];
  frequencies: { critical: number; high: number; medium: number; low: number };
  isReauditMode?: boolean;
}> = ({ frequencies }) => {
  const [records, setRecords] = useState<UniverseRecord[]>(FULL_UNIVERSE_RECORDS);
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState('All types');
  const [riskFilter, setRiskFilter] = useState('All risk levels');
  const [showAddModal, setShowAddModal] = useState(false);

  // Add entity form
  const [newName, setNewName] = useState('');
  const [newSubtitle, setNewSubtitle] = useState('Operations · Branch banking');
  const [newType, setNewType] = useState<UniverseRecord['type']>('Process');
  const [newOwner, setNewOwner] = useState('R. Bautista');
  const [newLikelihood, setNewLikelihood] = useState(4);
  const [newImpact, setNewImpact] = useState(4);

  const filtered = records.filter((r) => {
    const matchesSearch =
      searchQuery.trim() === '' ||
      r.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      r.subtitle.toLowerCase().includes(searchQuery.toLowerCase()) ||
      r.owner.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesType = typeFilter === 'All types' || r.type === typeFilter;
    const matchesRisk =
      riskFilter === 'All risk levels' || r.riskLevel === riskFilter;
    return matchesSearch && matchesType && matchesRisk;
  });

  const handleAddEntity = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) return;
    const score = newLikelihood * newImpact;
    const riskLevel: RiskLevel =
      score >= 20
        ? 'Critical'
        : score >= 10
        ? 'High'
        : score >= 5
        ? 'Medium'
        : 'Low';
    const cycleMonths =
      riskLevel === 'Critical'
        ? frequencies.critical
        : riskLevel === 'High'
        ? frequencies.high
        : riskLevel === 'Medium'
        ? frequencies.medium
        : frequencies.low;

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
      lastAudit: '4 Oct 2026',
      nextDue: '4 Apr 2027',
      nextDueStatus: 'On track',
    };
    setRecords((prev) => [added, ...prev]);
    setNewName('');
    setShowAddModal(false);
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
          <option value="Process">Process</option>
          <option value="IT system">IT system</option>
          <option value="Branch">Branch</option>
          <option value="Department">Department</option>
          <option value="Vendor">Vendor</option>
          <option value="Product / process">Product / process</option>
        </select>

        <select
          aria-label="Filter by risk level"
          value={riskFilter}
          onChange={(e) => setRiskFilter(e.target.value)}
          className="px-3 py-2 bg-white border border-slate-300 rounded-md text-xs font-medium text-slate-800 focus:outline-none focus:border-[#492785]"
        >
          <option value="All risk levels">All risk levels</option>
          <option value="Critical">Critical</option>
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
              <th className="py-2.5 pl-4 text-right" />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200/80 text-[13px] tabular-nums">
            {filtered.map((rec) => {
              const cycle =
                rec.riskLevel === 'Critical'
                  ? frequencies.critical
                  : rec.riskLevel === 'High'
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
                        rec.riskLevel === 'Critical'
                          ? 'bg-[#B93829]'
                          : rec.riskLevel === 'High'
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
                    <button
                      type="button"
                      onClick={() =>
                        setRecords((prev) => prev.filter((item) => item.id !== rec.id))
                      }
                      className="px-2.5 py-1 bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 rounded text-xs font-medium cursor-pointer"
                    >
                      Remove
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Modal: Add Entity */}
      {showAddModal && (
        <div className="fixed inset-0 bg-slate-900/40 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg border border-slate-200 shadow-xl max-w-md w-full p-5 text-xs">
            <h3 className="text-base font-bold text-slate-900">
              Add Auditable Entity to Universe
            </h3>
            <form onSubmit={handleAddEntity} className="mt-4 space-y-3">
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
                  Division / Category Subtitle
                </label>
                <input
                  type="text"
                  value={newSubtitle}
                  onChange={(e) => setNewSubtitle(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-md"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Type
                  </label>
                  <select
                    value={newType}
                    onChange={(e) =>
                      setNewType(e.target.value as UniverseRecord['type'])
                    }
                    className="w-full px-3 py-2 border border-slate-300 rounded-md bg-white"
                  >
                    <option value="Process">Process</option>
                    <option value="IT system">IT system</option>
                    <option value="Branch">Branch</option>
                    <option value="Department">Department</option>
                    <option value="Vendor">Vendor</option>
                    <option value="Product / process">Product / process</option>
                  </select>
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Process Owner
                  </label>
                  <input
                    type="text"
                    value={newOwner}
                    onChange={(e) => setNewOwner(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-md"
                  />
                </div>
              </div>
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
                    onChange={(e) => setNewLikelihood(Number(e.target.value))}
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
                    onChange={(e) => setNewImpact(Number(e.target.value))}
                    className="w-full px-3 py-2 border border-slate-300 rounded-md"
                  />
                </div>
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
                  className="px-4 py-1.5 bg-[#492785] text-white rounded-md font-semibold cursor-pointer"
                >
                  Save entity
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

  // Gantt rows matching Audit-Management-System (9).png
  const ganttRows: {
    ref: string;
    title: string;
    lead: string;
    risk: RiskLevel;
    startMonthIdx: number;
    spanMonths: number;
    barColor: string;
    engId: string;
  }[] = [
    {
      ref: 'AUD-2026-001',
      title: 'APDS Remittance Reconciliation Audit',
      lead: 'A. Villanueva',
      risk: 'Critical',
      startMonthIdx: 1.0, // Feb
      spanMonths: 1.4,
      barColor: 'bg-[#1D7A4C]',
      engId: 'aud-2026-001',
    },
    {
      ref: 'AUD-2026-002',
      title: 'Core Banking Privileged Access Review',
      lead: 'J. Reyes',
      risk: 'Critical',
      startMonthIdx: 2.4, // Mid Mar
      spanMonths: 1.4,
      barColor: 'bg-[#1D7A4C]',
      engId: 'aud-2026-002',
    },
    {
      ref: 'AUD-2026-003',
      title: 'Teacher Salary Loan Origination Audit',
      lead: 'A. Villanueva',
      risk: 'Critical',
      startMonthIdx: 3.8, // Late Apr
      spanMonths: 1.4,
      barColor: 'bg-[#1D7A4C]',
      engId: 'aud-2026-003',
    },
    {
      ref: 'AUD-2026-004',
      title: 'Cebu Branch Operations Audit',
      lead: 'L. Garcia',
      risk: 'Medium',
      startMonthIdx: 5.2, // Jun
      spanMonths: 0.7,
      barColor: 'bg-[#1D7A4C]',
      engId: 'aud-2026-004',
    },
    {
      ref: 'AUD-2026-006',
      title: 'Mobile Banking Application Security Review',
      lead: 'P. Mendoza',
      risk: 'Critical',
      startMonthIdx: 8.4, // Mid Sept
      spanMonths: 1.4,
      barColor: 'bg-[#D97724]',
      engId: 'aud-2026-006',
    },
    {
      ref: 'AUD-2026-005',
      title: 'Cash Card Loan Release Audit',
      lead: 'K. Lim',
      risk: 'High',
      startMonthIdx: 9.0, // Oct
      spanMonths: 1.3,
      barColor: 'bg-[#D97724]',
      engId: 'aud-2026-005',
    },
    {
      ref: 'AUD-2026-086',
      title: 'Operational risk & loss event reporting Audit',
      lead: '—',
      risk: 'Medium',
      startMonthIdx: 9.1,
      spanMonths: 0.9,
      barColor: 'bg-[#6C737A]',
      engId: 'aud-2026-005',
    },
    {
      ref: 'AUD-2026-072',
      title: 'Iloilo Branch Audit',
      lead: '—',
      risk: 'Medium',
      startMonthIdx: 9.3,
      spanMonths: 0.9,
      barColor: 'bg-[#6C737A]',
      engId: 'aud-2026-005',
    },
    {
      ref: 'AUD-2026-034',
      title: 'Mobile Banking – authentication & OTP controls Audit',
      lead: '—',
      risk: 'High',
      startMonthIdx: 9.3,
      spanMonths: 1.1,
      barColor: 'bg-[#6C737A]',
      engId: 'aud-2026-006',
    },
    {
      ref: 'AUD-2026-078',
      title: 'Cash-in-Transit Service Provider Audit',
      lead: '—',
      risk: 'Medium',
      startMonthIdx: 9.3,
      spanMonths: 0.9,
      barColor: 'bg-[#6C737A]',
      engId: 'aud-2026-005',
    },
    {
      ref: 'AUD-2026-007',
      title: 'Stopped Deductions & Unremitted Accounts Audit',
      lead: 'A. Villanueva',
      risk: 'Critical',
      startMonthIdx: 9.3,
      spanMonths: 1.3,
      barColor: 'bg-[#3B6998]',
      engId: 'aud-2026-007',
    },
    {
      ref: 'AUD-2026-055',
      title: 'Walk-in teacher loan application intake Audit',
      lead: '—',
      risk: 'High',
      startMonthIdx: 9.3,
      spanMonths: 1.1,
      barColor: 'bg-[#6C737A]',
      engId: 'aud-2026-003',
    },
    {
      ref: 'AUD-2026-021',
      title: 'Loan loss provisioning (ECL) Audit',
      lead: '—',
      risk: 'Critical',
      startMonthIdx: 9.6,
      spanMonths: 1.3,
      barColor: 'bg-[#6C737A]',
      engId: 'aud-2026-001',
    },
    {
      ref: 'AUD-2026-057',
      title: 'Calamity loan restructuring for teachers Audit',
      lead: '—',
      risk: 'High',
      startMonthIdx: 9.6,
      spanMonths: 1.1,
      barColor: 'bg-[#6C737A]',
      engId: 'aud-2026-003',
    },
    {
      ref: 'AUD-2026-067',
      title: 'Business continuity management Audit',
      lead: '—',
      risk: 'High',
      startMonthIdx: 9.6,
      spanMonths: 1.1,
      barColor: 'bg-[#6C737A]',
      engId: 'aud-2026-002',
    },
    {
      ref: 'AUD-2026-091',
      title: 'Whistleblowing & ethics hotline Audit',
      lead: '—',
      risk: 'Medium',
      startMonthIdx: 9.6,
      spanMonths: 0.9,
      barColor: 'bg-[#6C737A]',
      engId: 'aud-2026-004',
    },
    {
      ref: 'AUD-2026-089',
      title: 'Co-maker & guarantor validation Audit',
      lead: '—',
      risk: 'Medium',
      startMonthIdx: 9.6,
      spanMonths: 0.9,
      barColor: 'bg-[#6C737A]',
      engId: 'aud-2026-003',
    },
    {
      ref: 'AUD-2026-058',
      title: 'Retiree & pensioner teacher loans Audit',
      lead: '—',
      risk: 'High',
      startMonthIdx: 9.6,
      spanMonths: 1.1,
      barColor: 'bg-[#6C737A]',
      engId: 'aud-2026-003',
    },
    {
      ref: 'AUD-2026-073',
      title: 'Cagayan de Oro Branch Audit',
      lead: '—',
      risk: 'Medium',
      startMonthIdx: 9.6,
      spanMonths: 0.9,
      barColor: 'bg-[#6C737A]',
      engId: 'aud-2026-004',
    },
    {
      ref: 'AUD-2026-079',
      title: 'Recovery on written-off accounts Audit',
      lead: '—',
      risk: 'Medium',
      startMonthIdx: 9.6,
      spanMonths: 0.9,
      barColor: 'bg-[#6C737A]',
      engId: 'aud-2026-001',
    },
    {
      ref: 'AUD-2026-066',
      title: 'Credit data submission to CIC Audit',
      lead: '—',
      risk: 'High',
      startMonthIdx: 9.6,
      spanMonths: 1.1,
      barColor: 'bg-[#6C737A]',
      engId: 'aud-2026-003',
    },
    {
      ref: 'AUD-2026-060',
      title: 'Release to authorized representatives (SPA) Audit',
      lead: '—',
      risk: 'High',
      startMonthIdx: 9.6,
      spanMonths: 1.1,
      barColor: 'bg-[#6C737A]',
      engId: 'aud-2026-005',
    },
    {
      ref: 'AUD-2026-053',
      title: 'Tacloban Branch Audit',
      lead: '—',
      risk: 'High',
      startMonthIdx: 9.6,
      spanMonths: 1.1,
      barColor: 'bg-[#6C737A]',
      engId: 'aud-2026-004',
    },
    {
      ref: 'AUD-2026-040',
      title: 'Core Banking Software Vendor – remote support Audit',
      lead: '—',
      risk: 'High',
      startMonthIdx: 9.6,
      spanMonths: 1.1,
      barColor: 'bg-[#6C737A]',
      engId: 'aud-2026-002',
    },
    {
      ref: 'AUD-2026-025',
      title: 'Accredited School Marketing Agents Audit',
      lead: '—',
      risk: 'High',
      startMonthIdx: 9.6,
      spanMonths: 1.1,
      barColor: 'bg-[#6C737A]',
      engId: 'aud-2026-003',
    },
    {
      ref: 'AUD-2026-010',
      title: 'Cash Card Platform – admin & privileged access Audit',
      lead: '—',
      risk: 'Critical',
      startMonthIdx: 9.6,
      spanMonths: 1.3,
      barColor: 'bg-[#6C737A]',
      engId: 'aud-2026-005',
    },
    {
      ref: 'AUD-2026-043',
      title: 'Outsourcing & third-party risk management Audit',
      lead: '—',
      risk: 'High',
      startMonthIdx: 9.6,
      spanMonths: 1.1,
      barColor: 'bg-[#6C737A]',
      engId: 'aud-2026-002',
    },
    {
      ref: 'AUD-2026-012',
      title: 'APDS Deduction Interface – file transfer security Audit',
      lead: '—',
      risk: 'Critical',
      startMonthIdx: 9.6,
      spanMonths: 1.3,
      barColor: 'bg-[#6C737A]',
      engId: 'aud-2026-001',
    },
    {
      ref: 'AUD-2026-085',
      title: 'Data Warehouse & MIS – report integrity Audit',
      lead: '—',
      risk: 'Medium',
      startMonthIdx: 9.6,
      spanMonths: 0.9,
      barColor: 'bg-[#6C737A]',
      engId: 'aud-2026-002',
    },
    {
      ref: 'AUD-2026-031',
      title: 'Third-party Collection Agencies Audit',
      lead: '—',
      risk: 'High',
      startMonthIdx: 9.6,
      spanMonths: 1.1,
      barColor: 'bg-[#6C737A]',
      engId: 'aud-2026-003',
    },
    {
      ref: 'AUD-2026-014',
      title: 'Core Banking – vulnerability & patch management Audit',
      lead: '—',
      risk: 'Critical',
      startMonthIdx: 9.6,
      spanMonths: 1.3,
      barColor: 'bg-[#6C737A]',
      engId: 'aud-2026-002',
    },
    {
      ref: 'AUD-2026-094',
      title: 'Core Banking – privileged access management Audit-Test',
      lead: 'N. Lopez',
      risk: 'Critical',
      startMonthIdx: 9.8,
      spanMonths: 1.3,
      barColor: 'bg-[#492785]',
      engId: 'aud-2026-094',
    },
  ];

  return (
    <div className="bg-white rounded-lg border border-slate-200/90 shadow-2xs p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-[19px] font-bold text-slate-900 tracking-tight">
            Audit schedule timeline ({selectedYear})
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Month-by-month Gantt view of planned, ongoing and completed engagements.
          </p>
        </div>

        <select
          aria-label="Select timeline year"
          value={selectedYear}
          onChange={(e) => setSelectedYear(e.target.value)}
          className="px-3 py-1.5 bg-white border border-slate-300 rounded-md text-xs font-medium text-slate-800"
        >
          <option value="2026">2026</option>
          <option value="2027">2027</option>
        </select>
      </div>

      <div className="mt-5 overflow-x-auto">
        <div className="min-w-[880px]">
          {/* Header Row */}
          <div className="grid grid-cols-12 border-b border-slate-200 pb-2 text-xs text-slate-500">
            <div className="col-span-4 pr-4 font-medium">Audit</div>
            <div className="col-span-8 grid grid-cols-12 text-center font-medium">
              {months.map((m) => (
                <div key={m}>{m}</div>
              ))}
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
                          row.risk === 'Critical'
                            ? 'bg-[#B93829]'
                            : row.risk === 'High'
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
          </div>
        </div>
      </div>
    </div>
  );
};

// 4. ISSUES VIEW (Exact match to Audit-Management-System (5).png)
export const IssuesView: React.FC<{
  engagements: AuditEngagement[];
  activeLifecycleStage: LifecycleStageId;
  onValidateAndCloseFinding: (engagementId: string, findingId: string) => void;
}> = ({ activeLifecycleStage, onValidateAndCloseFinding }) => {
  const [issues, setIssues] = useState<IssueRegisterItem[]>(INITIAL_ISSUES_REGISTER);
  const [filterTab, setFilterTab] = useState<string>(
    activeLifecycleStage === 6 ? 'For validation' : 'Open'
  );
  const [selectedIssue, setSelectedIssue] = useState<IssueRegisterItem | null>(null);
  const [extensionDate, setExtensionDate] = useState('30 Nov 2026');
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
    setIssues((prev) =>
      prev.map((item) =>
        item.id === issue.id
          ? {
              ...item,
              status: 'Closed',
              isOverdue: false,
              isDueSoon: false,
              daysStatus: 'Closed 4 Oct 2026',
              evidenceNote:
                closureRemarks.trim() ||
                'Validated remediation evidence & closed by Internal Audit.',
            }
          : item
      )
    );
    onValidateAndCloseFinding('aud-2026-006', 'fnd-001');
    setClosureRemarks('');
    setSelectedIssue(null);
  };

  const handleGrantExtension = (issue: IssueRegisterItem) => {
    setIssues((prev) =>
      prev.map((item) =>
        item.id === issue.id
          ? {
              ...item,
              currentDue: extensionDate,
              extensionCount: item.extensionCount + 1,
              isOverdue: false,
              daysStatus: `Extended to ${extensionDate}`,
              status: 'In progress',
            }
          : item
      )
    );
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
                      onClick={() => setSelectedIssue(iss)}
                      className="px-3 py-1.5 bg-white hover:bg-slate-50 text-slate-800 border border-slate-300 rounded text-xs font-semibold cursor-pointer"
                    >
                      Manage
                    </button>
                  </td>
                </tr>
              ))}
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
                        type="text"
                        value={extensionDate}
                        onChange={(e) => setExtensionDate(e.target.value)}
                        className="w-full px-2.5 py-1.5 border border-slate-300 rounded"
                      />
                      <button
                        type="button"
                        onClick={() => handleGrantExtension(selectedIssue)}
                        className="px-3 py-1.5 bg-white border border-slate-300 rounded font-semibold text-slate-800 hover:bg-slate-50 cursor-pointer shrink-0"
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
export const MasterDataSetupAccessView: React.FC<{
  tab: 'master-data' | 'setup' | 'access';
  currentUser: UserProfile;
  onChangeUser: (u: UserProfile) => void;
  accessActive?: boolean;
  onToggleAccess?: () => void;
  onSelectTab?: (tab: MainTabId) => void;
}> = ({ tab, currentUser, onChangeUser, accessActive, onToggleAccess, onSelectTab }) => {
  // Master data state matching Audit-Management-System (4).png & (6).png
  const [entityTypes, setEntityTypes] = useState([
    'Department',
    'Branch',
    'Product / process',
    'IT system',
    'Vendor',
  ]);
  const [newEntityType, setNewEntityType] = useState('');

  const [auditCategories, setAuditCategories] = useState([
    'Operations',
    'Credit review',
    'IT audit',
    'Information security',
    'Compliance',
    'Financial',
    'Branch audit',
  ]);
  const [newAuditCategory, setNewAuditCategory] = useState('');

  const [auditorsList, setAuditorsList] = useState([
    {
      name: 'M. Santos',
      role: 'Chief Audit Executive',
      email: 'm.santos@bank.com.ph',
      skills: 'Operations, Credit review, IT audit, Information security, Compliance, Financial, Branch audit',
    },
    {
      name: 'J. Dela Cruz',
      role: 'IT Audit Manager',
      email: 'j.delacruz@bank.com.ph',
      skills: 'IT audit, Information security',
    },
    {
      name: 'A. Villanueva',
      role: 'Senior Operations Auditor',
      email: 'a.villanueva@bank.com.ph',
      skills: 'Operations, Financial, Branch audit',
    },
    {
      name: 'P. Mendoza',
      role: 'IT & InfoSec Auditor',
      email: 'p.mendoza@bank.com.ph',
      skills: 'IT audit, Information security',
    },
    {
      name: 'K. Lim',
      role: 'Compliance & Branch Auditor',
      email: 'k.lim@bank.com.ph',
      skills: 'Compliance, Branch audit, Operations',
    },
    {
      name: 'D. Ramos',
      role: 'Credit Review Specialist',
      email: 'd.ramos@bank.com.ph',
      skills: 'Credit review, Financial',
    },
    {
      name: 'B. Tolentino',
      role: 'IT Systems Auditor',
      email: 'b.tolentino@bank.com.ph',
      skills: 'IT audit, Operations',
    },
    {
      name: 'R. Garcia',
      role: 'Operations & Financial Auditor',
      email: 'r.garcia@bank.com.ph',
      skills: 'Operations, Financial, Compliance',
    },
    {
      name: 'L. Fernandez',
      role: 'Branch & Compliance Auditor',
      email: 'l.fernandez@bank.com.ph',
      skills: 'Branch audit, Compliance, Credit review',
    },
  ]);

  const [auditeeDirectory, setAuditeeDirectory] = useState([
    {
      unit: 'Operations · Cash & clearing',
      head: 'R. Bautista',
      title: 'VP, Operations',
      email: 'r.bautista@bank.com.ph',
    },
    {
      unit: 'Operations · Billing & collection',
      head: 'R. Bautista',
      title: 'VP, Operations',
      email: 'r.bautista@bank.com.ph',
    },
    {
      unit: 'Operations · Records & Collateral',
      head: 'R. Bautista',
      title: 'VP, Operations',
      email: 'r.bautista@bank.com.ph',
    },
    {
      unit: 'Loan Release & Disbursement · Card ops',
      head: 'G. Soriano',
      title: 'AVP, Loan Release & Cards',
      email: 'g.soriano@bank.com.ph',
    },
    {
      unit: 'IT · Core banking (Temenos T24)',
      head: 'E. Navarro',
      title: 'VP, Chief Information Officer',
      email: 'e.navarro@bank.com.ph',
    },
    {
      unit: 'IT · Digital channels',
      head: 'E. Navarro',
      title: 'VP, Chief Information Officer',
      email: 'e.navarro@bank.com.ph',
    },
    {
      unit: 'IT · Payment switches',
      head: 'E. Navarro',
      title: 'VP, Chief Information Officer',
      email: 'e.navarro@bank.com.ph',
    },
    {
      unit: 'IT · Network & Infrastructure Security',
      head: 'E. Navarro',
      title: 'VP, Chief Information Officer',
      email: 'e.navarro@bank.com.ph',
    },
    {
      unit: 'IT & Operations · Mission-Critical Systems',
      head: 'E. Navarro',
      title: 'VP, Chief Information Officer',
      email: 'e.navarro@bank.com.ph',
    },
    {
      unit: 'Lending · Salary loans',
      head: 'V. Pascual',
      title: 'VP, Consumer & Teacher Lending',
      email: 'v.pascual@bank.com.ph',
    },
    {
      unit: 'Lending · Product governance',
      head: 'V. Pascual',
      title: 'VP, Consumer & Teacher Lending',
      email: 'v.pascual@bank.com.ph',
    },
    {
      unit: 'Lending · Key Regional Hub',
      head: 'V. Pascual',
      title: 'VP, Consumer & Teacher Lending',
      email: 'v.pascual@bank.com.ph',
    },
    {
      unit: 'Compliance · AML / CFT',
      head: 'C. Dizon',
      title: 'Chief Compliance Officer',
      email: 'c.dizon@bank.com.ph',
    },
    {
      unit: 'Legal & Compliance · Accreditation',
      head: 'C. Dizon',
      title: 'Chief Compliance Officer',
      email: 'c.dizon@bank.com.ph',
    },
    {
      unit: 'Vendor Management & IT · Compliance',
      head: 'C. Dizon',
      title: 'Chief Compliance Officer',
      email: 'c.dizon@bank.com.ph',
    },
    {
      unit: 'Treasury · Liquidity',
      head: 'L. Mercado',
      title: 'VP, Treasurer',
      email: 'l.mercado@bank.com.ph',
    },
    {
      unit: 'Finance · General Ledger',
      head: 'L. Mercado',
      title: 'VP, Treasurer',
      email: 'l.mercado@bank.com.ph',
    },
    {
      unit: 'Branch Banking · Mindanao Region',
      head: 'G. Soriano',
      title: 'VP, Branch Banking',
      email: 'g.soriano@bank.com.ph',
    },
    {
      unit: 'Branch Banking · Visayas Region',
      head: 'G. Soriano',
      title: 'VP, Branch Banking',
      email: 'g.soriano@bank.com.ph',
    },
    {
      unit: 'Administrative Services · General services',
      head: 'M. Ocampo',
      title: 'AVP, Administrative Services',
      email: 'm.ocampo@bank.com.ph',
    },
  ]);

  // 14 Setup steps across 5 groups matching Audit-Management-System (8).png & (12).png
  const [setupItems, setSetupItems] = useState([
    // Group 1: 1. Organization & branding (2 of 2 done)
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
    // Group 2: 2. Audit methodology & risk scoring (3 of 3 done)
    {
      id: 'am-1',
      group: '2. Audit methodology & risk scoring',
      stepNum: 3,
      title: 'Inherent risk matrix (Likelihood × Impact)',
      description:
        'Review the 5×5 scoring thresholds (Critical ≥ 16, High ≥ 10, Medium ≥ 5, Low < 5) and risk rating definitions.',
      status: 'Done' as 'Done' | 'In progress' | 'To do',
      summary: '5×5 matrix · 4 risk tiers configured',
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
      summary: 'Critical 6m · High 12m · Medium 24m · Low 36m',
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
    // Group 3: 3. Master data & directories (4 of 4 done)
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
        'Confirm who acts as Chief Audit Executive (Head of Internal Audit) and Audit Managers for two-tier working paper review and report sign-off.',
      status: 'Done' as 'Done' | 'In progress' | 'To do',
      summary: '1 CAE · 2 Audit Managers',
      note: '',
      actionLabel: 'Open →',
      targetTab: 'access' as MainTabId,
    },
    // Group 4: 4. Audit Universe & Annual Plan baseline (3 of 3 done)
    {
      id: 'up-1',
      group: '4. Audit Universe & Annual Plan baseline',
      stepNum: 10,
      title: 'Populate the Audit Universe & last-audited dates',
      description:
        'Import or enter all auditable departments, branches, products/processes, IT systems, and vendors together with their inherent risk scores and last audit dates.',
      status: 'Done' as 'Done' | 'In progress' | 'To do',
      summary: '160 auditable entities (30 Critical, 82 High)',
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
    // Group 5: 5. Access control & go-live (2 of 2 done)
    {
      id: 'ac-1',
      group: '5. Access control & go-live',
      stepNum: 13,
      title: 'User accounts & role-based access control',
      description:
        'Verify user accounts, role assignments (System Admin, CAE, Audit Manager, Auditor, Auditee), and engagement/unit scopes before activating RBAC.',
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
  ]);
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [draftNote, setDraftNote] = useState('');

  // Access state (13 user accounts matching Audit-Management-System (13).png: 9 IA staff + 4 Auditees)
  const [accessUsers, setAccessUsers] = useState([
    {
      id: 'acc-1',
      name: 'M. Santos',
      title: 'Chief Audit Executive · Internal Audit',
      email: 'm.santos@bank.com.ph',
      roles: ['System administrator', 'Chief Audit Executive'],
      scope: 'Full access',
      status: 'Active',
    },
    {
      id: 'acc-2',
      name: 'J. Dela Cruz',
      title: 'IT Audit Manager · Internal Audit',
      email: 'j.delacruz@bank.com.ph',
      roles: ['System administrator', 'Audit Manager'],
      scope: 'Full access',
      status: 'Active',
    },
    {
      id: 'acc-3',
      name: 'A. Villanueva',
      title: 'Senior Operations Auditor · Internal Audit',
      email: 'a.villanueva@bank.com.ph',
      roles: ['Audit Manager', 'Auditor'],
      scope: 'Assigned + team engagements',
      status: 'Active',
    },
    {
      id: 'acc-4',
      name: 'P. Mendoza',
      title: 'IT & InfoSec Auditor · Internal Audit',
      email: 'p.mendoza@bank.com.ph',
      roles: ['Auditor'],
      scope: 'Assigned engagements (AUD-2026-006)',
      status: 'Active',
    },
    {
      id: 'acc-5',
      name: 'K. Lim',
      title: 'Compliance & Branch Auditor · Internal Audit',
      email: 'k.lim@bank.com.ph',
      roles: ['Auditor'],
      scope: 'Assigned engagements (AUD-2026-004, AUD-2026-005, AUD-2026-007)',
      status: 'Active',
    },
    {
      id: 'acc-6',
      name: 'D. Ramos',
      title: 'Credit Review Specialist · Internal Audit',
      email: 'd.ramos@bank.com.ph',
      roles: ['Auditor'],
      scope: 'Assigned engagements (AUD-2027-003)',
      status: 'Active',
    },
    {
      id: 'acc-7',
      name: 'B. Tolentino',
      title: 'IT Systems Auditor · Internal Audit',
      email: 'b.tolentino@bank.com.ph',
      roles: ['Auditor'],
      scope: 'Assigned engagements (AUD-2026-003, AUD-2027-001)',
      status: 'Active',
    },
    {
      id: 'acc-8',
      name: 'R. Garcia',
      title: 'Operations & Financial Auditor · Internal Audit',
      email: 'r.garcia@bank.com.ph',
      roles: ['Auditor'],
      scope: 'Assigned engagements (AUD-2026-001, AUD-2027-002)',
      status: 'Active',
    },
    {
      id: 'acc-9',
      name: 'L. Fernandez',
      title: 'Branch & Compliance Auditor · Internal Audit',
      email: 'l.fernandez@bank.com.ph',
      roles: ['Auditor'],
      scope: 'Assigned engagements (AUD-2026-002)',
      status: 'Active',
    },
    {
      id: 'acc-10',
      name: 'R. Bautista',
      title: 'VP, Operations · Operations',
      email: 'r.bautista@bank.com.ph',
      roles: ['Auditee'],
      scope: 'Operations · Cash & clearing · Operations · Billing & collection',
      status: 'Active',
    },
    {
      id: 'acc-11',
      name: 'E. Navarro',
      title: 'VP, Chief Information Officer · Information Technology',
      email: 'e.navarro@bank.com.ph',
      roles: ['Auditee'],
      scope: 'IT · Core banking (Temenos T24) · IT · Digital channels · IT · Payment switches',
      status: 'Active',
    },
    {
      id: 'acc-12',
      name: 'V. Pascual',
      title: 'VP, Consumer & Teacher Lending · Lending',
      email: 'v.pascual@bank.com.ph',
      roles: ['Auditee'],
      scope: 'Lending · Salary loans · Lending · Product governance',
      status: 'Active',
    },
    {
      id: 'acc-13',
      name: 'C. Dizon',
      title: 'Chief Compliance Officer · Compliance',
      email: 'c.dizon@bank.com.ph',
      roles: ['Auditee'],
      scope: 'Compliance · AML / CFT',
      status: 'Active',
    },
  ]);

  // Role permission matrix matching Audit-Management-System (13).png bottom card
  const rolePermissionsMatrix = [
    {
      capability: 'System Setup, Master Data & Settings',
      sysAdmin: 'Full',
      cae: 'Full',
      manager: 'View',
      auditor: '—',
      auditee: '—',
    },
    {
      capability: 'User Accounts & Role Assignments (Access)',
      sysAdmin: 'Full',
      cae: 'View',
      manager: '—',
      auditor: '—',
      auditee: '—',
    },
    {
      capability: 'Audit Universe & Inherent Risk Scoring',
      sysAdmin: 'Full',
      cae: 'Full',
      manager: 'Edit',
      auditor: 'View',
      auditee: '—',
    },
    {
      capability: 'Annual Audit Plan & Budgeted Hours',
      sysAdmin: 'Full',
      cae: 'Approve & Edit',
      manager: 'Propose & Edit',
      auditor: 'View',
      auditee: '—',
    },
    {
      capability: 'Stage 02 Notification & Kickoff Memo',
      sysAdmin: 'Full',
      cae: 'Issue & Sign',
      manager: 'Draft',
      auditor: 'Draft (assigned)',
      auditee: 'Receive & Acknowledge',
    },
    {
      capability: 'Stage 03 Working Papers — Prepare & Submit',
      sysAdmin: 'Full',
      cae: 'View all',
      manager: 'Prepare / Reassign',
      auditor: 'Assigned engagements',
      auditee: 'Respond to inquiries',
    },
    {
      capability: 'Stage 03 Tier 1 Independent Quality Review',
      sysAdmin: 'Configure',
      cae: 'Override',
      manager: 'Approve / Return',
      auditor: 'Peer reviewer only',
      auditee: '—',
    },
    {
      capability: 'Stage 03 Tier 2 Head of Internal Audit Sign-Off',
      sysAdmin: 'Configure',
      cae: 'Final Sign-Off',
      manager: '—',
      auditor: '—',
      auditee: '—',
    },
    {
      capability: 'Stage 04 Exit Conference & Management Responses',
      sysAdmin: 'Full',
      cae: 'Approve',
      manager: 'Facilitate',
      auditor: 'Record minutes',
      auditee: 'Submit action plan & target date',
    },
    {
      capability: 'Stage 05 Final Audit Report Issuance',
      sysAdmin: 'Full',
      cae: 'Approve & Issue',
      manager: 'Review draft',
      auditor: 'Compile draft',
      auditee: 'Read issued report',
    },
    {
      capability: 'Stage 06 Follow-up, Extensions & Issue Closure',
      sysAdmin: 'Full',
      cae: 'Close Critical/High',
      manager: 'Verify & Close',
      auditor: 'Test remediation',
      auditee: 'Upload remediation evidence',
    },
  ];

  // TAB: MASTER DATA (Exact match to Audit-Management-System (4).png & (6).png)
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
              Used to classify rows in the Audit Universe. Removing a type does not change existing entities.
            </p>

            <div className="mt-4 divide-y divide-slate-200/80">
              {entityTypes.map((et) => (
                <div
                  key={et}
                  className="py-2.5 flex items-center justify-between text-[13px] text-slate-900"
                >
                  <span>{et}</span>
                  <button
                    type="button"
                    onClick={() =>
                      setEntityTypes((prev) => prev.filter((item) => item !== et))
                    }
                    className="px-2.5 py-1 bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 rounded text-xs font-medium cursor-pointer"
                  >
                    Remove
                  </button>
                </div>
              ))}
            </div>

            <div className="mt-4 flex items-center gap-2">
              <input
                type="text"
                value={newEntityType}
                onChange={(e) => setNewEntityType(e.target.value)}
                placeholder="New entity type (e.g. Outsourced vendor)"
                className="flex-1 px-3 py-2 bg-white border border-slate-300 rounded-md text-xs text-slate-800 placeholder:text-slate-400"
              />
              <button
                type="button"
                onClick={() => {
                  if (!newEntityType.trim()) return;
                  setEntityTypes((prev) => [...prev, newEntityType.trim()]);
                  setNewEntityType('');
                }}
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
              Used on the Annual Plan and when matching auditors by expertise.
            </p>

            <div className="mt-4 divide-y divide-slate-200/80">
              {auditCategories.map((cat) => (
                <div
                  key={cat}
                  className="py-2.5 flex items-center justify-between text-[13px] text-slate-900"
                >
                  <span>{cat}</span>
                  <button
                    type="button"
                    onClick={() =>
                      setAuditCategories((prev) => prev.filter((item) => item !== cat))
                    }
                    className="px-2.5 py-1 bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 rounded text-xs font-medium cursor-pointer"
                  >
                    Remove
                  </button>
                </div>
              ))}
            </div>

            <div className="mt-4 flex items-center gap-2">
              <input
                type="text"
                value={newAuditCategory}
                onChange={(e) => setNewAuditCategory(e.target.value)}
                placeholder="New audit category (e.g. ESG / sustainability)"
                className="flex-1 px-3 py-2 bg-white border border-slate-300 rounded-md text-xs text-slate-800 placeholder:text-slate-400"
              />
              <button
                type="button"
                onClick={() => {
                  if (!newAuditCategory.trim()) return;
                  setAuditCategories((prev) => [...prev, newAuditCategory.trim()]);
                  setNewAuditCategory('');
                }}
                className="px-3.5 py-2 bg-[#492785] hover:bg-[#3b1f6b] text-white text-xs font-semibold rounded-md cursor-pointer"
              >
                Add
              </button>
            </div>
          </div>
        </div>

        {/* Auditors Card matching Audit-Management-System (6).png */}
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
              onClick={() => {
                setAuditorsList((prev) => [
                  ...prev,
                  {
                    name: 'S. Magsaysay',
                    role: 'IT & Cyber Risk Auditor',
                    email: 's.magsaysay@bank.com.ph',
                    skills: 'IT audit, Information security, Compliance',
                  },
                ]);
              }}
              className="px-3.5 py-2 bg-[#492785] hover:bg-[#3b1f6b] text-white text-xs font-semibold rounded-md cursor-pointer"
            >
              Add auditor
            </button>
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
                {auditorsList.map((aud) => (
                  <tr key={aud.email}>
                    <td className="py-3 pr-4 font-bold text-slate-900">{aud.name}</td>
                    <td className="py-3 px-4 text-slate-700">{aud.role}</td>
                    <td className="py-3 px-4 text-xs text-slate-600">{aud.email}</td>
                    <td className="py-3 px-4 text-xs text-slate-600">{aud.skills}</td>
                    <td className="py-3 pl-4 text-right whitespace-nowrap">
                      <div className="inline-flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => {
                            const updatedRole = `${aud.role} (Lead)`;
                            setAuditorsList((prev) =>
                              prev.map((a) =>
                                a.email === aud.email
                                  ? { ...a, role: a.role.includes('(Lead)') ? a.role : updatedRole }
                                  : a
                              )
                            );
                          }}
                          className="px-2.5 py-1 bg-white hover:bg-slate-50 text-slate-800 border border-slate-300 rounded text-xs font-medium cursor-pointer"
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            setAuditorsList((prev) =>
                              prev.filter((a) => a.email !== aud.email)
                            )
                          }
                          className="px-2.5 py-1 bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 rounded text-xs font-medium cursor-pointer"
                        >
                          Remove
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Auditee Directory Card matching Audit-Management-System (6).png */}
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
              onClick={() => {
                setAuditeeDirectory((prev) => [
                  ...prev,
                  {
                    unit: 'Digital Channels & bancassurance',
                    head: 'M. Ocampo',
                    title: 'VP, Head of Digital Banking',
                    email: 'm.ocampo@bank.com.ph',
                  },
                ]);
              }}
              className="px-3.5 py-2 bg-[#492785] hover:bg-[#3b1f6b] text-white text-xs font-semibold rounded-md cursor-pointer"
            >
              Add auditee unit
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
                  <th className="py-2.5 pl-4 text-right" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200/80">
                {auditeeDirectory.map((dir) => (
                  <tr key={dir.unit}>
                    <td className="py-3 pr-4 font-bold text-slate-900">
                      {dir.unit}
                    </td>
                    <td className="py-3 px-4 text-slate-800">{dir.head}</td>
                    <td className="py-3 px-4 text-xs text-slate-600">{dir.title}</td>
                    <td className="py-3 px-4 text-xs text-slate-600">
                      {dir.email}
                    </td>
                    <td className="py-3 pl-4 text-right whitespace-nowrap">
                      <div className="inline-flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => {
                            setAuditeeDirectory((prev) =>
                              prev.map((d) =>
                                d.unit === dir.unit
                                  ? { ...d, title: `${d.title} (Verified)` }
                                  : d
                              )
                            );
                          }}
                          className="px-2.5 py-1 bg-white hover:bg-slate-50 text-slate-800 border border-slate-300 rounded text-xs font-medium cursor-pointer"
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            setAuditeeDirectory((prev) =>
                              prev.filter((d) => d.unit !== dir.unit)
                            )
                          }
                          className="px-2.5 py-1 bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 rounded text-xs font-medium cursor-pointer"
                        >
                          Remove
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  }

  // TAB: SETUP (Implementation · Configuration cockpit matching Audit-Management-System (8).png & (12).png)
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

    const handleCycleStatus = (id: string) => {
      setSetupItems((prev) =>
        prev.map((item) => {
          if (item.id !== id) return item;
          const nextStatus: 'Done' | 'In progress' | 'To do' =
            item.status === 'Done'
              ? 'To do'
              : item.status === 'To do'
              ? 'In progress'
              : 'Done';
          return { ...item, status: nextStatus };
        })
      );
    };

    const handleMarkAllDone = () => {
      setSetupItems((prev) => prev.map((item) => ({ ...item, status: 'Done' })));
    };

    const handleResetChecklist = () => {
      setSetupItems((prev) => prev.map((item) => ({ ...item, status: 'To do' })));
    };

    const handleSaveNote = (id: string) => {
      setSetupItems((prev) =>
        prev.map((item) => (item.id === id ? { ...item, note: draftNote.trim() } : item))
      );
      setEditingNoteId(null);
      setDraftNote('');
    };

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
              {/* Card Header */}
              <div className="px-6 py-4 border-b border-slate-200/80 flex items-center justify-between">
                <h3 className="text-[16px] font-bold text-slate-900 tracking-tight">
                  {groupName}
                </h3>
                <span className="text-xs text-slate-500 font-mono-tabular">
                  {groupDoneCount} of {groupItems.length} done
                </span>
              </div>

              {/* Step Rows */}
              <div className="divide-y divide-slate-200/80">
                {groupItems.map((step) => {
                  const isDone = step.status === 'Done';
                  const isInProgress = step.status === 'In progress';

                  return (
                    <div
                      key={step.id}
                      className="px-6 py-4 flex flex-col sm:flex-row sm:items-start justify-between gap-4 hover:bg-slate-50/40 transition-colors"
                    >
                      {/* Left Icon + Details */}
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

                          {/* Status Pill + Summary Text + Note */}
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

                      {/* Right Action Button */}
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

  // ── BSSC V3: Access tab local security state ─────────────────────────────
  const [accessNotice, setAccessNotice] = useState<{ type: 'success' | 'error'; msg: string } | null>(null);
  const [showAddUserForm, setShowAddUserForm] = useState(false);
  const [newUserName, setNewUserName] = useState('');
  const [newUserEmail, setNewUserEmail] = useState('');
  const [newUserEmployeeNo, setNewUserEmployeeNo] = useState('');
  const [newUserRole, setNewUserRole] = useState('Auditor');
  const [newUserScope, setNewUserScope] = useState('');
  const [newUserPassword, setNewUserPassword] = useState('');
  const [showNewUserPassword, setShowNewUserPassword] = useState(false);
  const [newUserNameError, setNewUserNameError] = useState('');
  // PM-10: password reset flow
  const [resetTargetId, setResetTargetId] = useState<string | null>(null);
  const [generatedTempPw, setGeneratedTempPw] = useState('');
  const [showTempPw, setShowTempPw] = useState(false);
  // IA-8/IA-9: simulate failed logins
  const [loginSimUser, setLoginSimUser] = useState('');
  const [loginSimPw, setLoginSimPw] = useState('');
  const [showLoginSimPw, setShowLoginSimPw] = useState(false);
  const [loginSimError, setLoginSimError] = useState('');
  const [loginSimSuccess, setLoginSimSuccess] = useState('');

  const notifyAccess = (type: 'success' | 'error', msg: string) => {
    setAccessNotice({ type, msg });
    setTimeout(() => setAccessNotice(null), 4500);
  };

  // ── Derived counts ────────────────────────────────────────────────────────
  const activeCount = accessUsers.filter((u) => u.status === 'Active').length;
  const suspendedCount = accessUsers.filter((u) => u.status === 'Suspended').length;
  const lockedCount = accessUsers.filter((u) => (u as any).isLocked).length;
  const iaStaffCount = accessUsers.filter((u) => !u.roles.includes('Auditee')).length;
  const auditeeCount = accessUsers.filter((u) => u.roles.includes('Auditee')).length;
  const privilegedCount = accessUsers.filter(
    (u) => u.roles.includes('System administrator') || u.roles.includes('Chief Audit Executive')
  ).length;

  // ── LAC-3: export user access list as CSV ────────────────────────────────
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

  // ── IA-8/IA-9: simulate login attempt ────────────────────────────────────
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
      // IA-7: generic error — do not reveal whether username exists
      setLoginSimError(genericAuthError());
      return;
    }
    if ((found as any).isLocked) {
      setLoginSimError(
        'Your account has been locked due to multiple failed login attempts. Please contact your system administrator to unlock.'
      );
      return;
    }
    // Simulate wrong password → increment counter
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
    // Success
    setAccessUsers((prev) =>
      prev.map((u) =>
        u.id === found.id
          ? { ...u, failedLoginCount: 0, isLocked: false, lastLoginDate: new Date().toISOString() } as any
          : u
      )
    );
    setLoginSimSuccess(`IA-1/SM-4: Login successful. Session token issued. Previous sessions revoked. Welcome, ${found.name}.`);
  };

  // ── IA-9: admin unlock ────────────────────────────────────────────────────
  const handleAdminUnlock = (userId: string, userName: string) => {
    const reset = unlockAccount();
    setAccessUsers((prev) =>
      prev.map((u) => (u.id === userId ? { ...u, ...reset } as any : u))
    );
    notifyAccess('success', `IA-9: Account "${userName}" has been unlocked by the administrator. Failed login counter reset.`);
  };

  // ── PM-4/PM-10: generate temporary password ───────────────────────────────
  const handleGenerateTempPw = (userId: string) => {
    const tmp = generateTemporaryPassword();
    setGeneratedTempPw(tmp);
    setResetTargetId(userId);
    setShowTempPw(false);
    // Flag user to require password change on next login (PM-3)
    setAccessUsers((prev) =>
      prev.map((u) => (u.id === userId ? { ...u, requiresPasswordChange: true } as any : u))
    );
  };

  // ── IA-2/LAC-1: add user with duplicate-username check ───────────────────
  const handleAddUser = () => {
    setNewUserNameError('');
    if (!newUserName.trim() || !newUserEmail.trim()) {
      notifyAccess('error', 'Name and email are required.');
      return;
    }
    // IA-2: prevent duplicate usernames
    const existingUsernames = accessUsers.map((u) => u.email.split('@')[0]);
    const candidateUsername = newUserEmail.split('@')[0];
    if (isUsernameTaken(candidateUsername, existingUsernames)) {
      setNewUserNameError(`IA-2: Username "${candidateUsername}" already exists. Each user must have a unique username/ID.`);
      return;
    }
    // PM-2: validate password if provided
    if (newUserPassword) {
      const { valid, violations } = validatePasswordStrength(newUserPassword, newUserRole === 'System administrator');
      if (!valid) {
        notifyAccess('error', `PM-1/PM-2: Password does not meet policy: ${violations[0]}`);
        return;
      }
    }
    // PM-4: generate a cryptographically secure temporary password (not stored client-side)
    void (newUserPassword || generateTemporaryPassword());
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
      requiresPasswordChange: true, // PM-3: force change on first login
      passwordLastChanged: null,
      mfaEnabled: false,
      isPrivileged: newUserRole === 'System administrator',
    };
    setAccessUsers((prev) => [...prev, newAcc as any]);
    notifyAccess('success', `IA-1/PM-3: User "${newUserName.trim()}" created. Temporary password issued. Password change required on first login.`);
    // Reset form
    setNewUserName(''); setNewUserEmail(''); setNewUserEmployeeNo('');
    setNewUserRole('Auditor'); setNewUserScope(''); setNewUserPassword('');
    setShowAddUserForm(false);
  };

  // ── Password expiry check helper ──────────────────────────────────────────
  const getUserExpiryState = (u: any) => {
    return getPasswordExpiryState(u.passwordLastChanged || null, u.mfaEnabled || false);
  };

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
            onChange={(e) => { const found = USERS.find((u) => u.id === e.target.value); if (found) onChangeUser(found); }}
            className="px-3 py-2 bg-white border border-slate-300 rounded-md text-xs font-medium text-slate-800"
          >
            {USERS.map((u) => (
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
            {/* IA-5: no autocomplete on auth fields */}
            <input type="text" autoComplete="off" value={loginSimUser}
              onChange={(e) => setLoginSimUser(e.target.value)}
              placeholder="e.g. m.santos"
              className="px-3 py-2 bg-white border border-slate-300 rounded-md text-xs text-slate-800 w-44" />
          </div>
          <div>
            <label className="block text-xs text-slate-600 mb-1">Password</label>
            <div className="relative">
              {/* IA-5: autocomplete="new-password" prevents hint display */}
              <input type={showLoginSimPw ? 'text' : 'password'} autoComplete="new-password" value={loginSimPw}
                onChange={(e) => setLoginSimPw(e.target.value)}
                placeholder="Enter password"
                className="px-3 py-2 bg-white border border-slate-300 rounded-md text-xs text-slate-800 w-44 pr-10" />
              {/* IA-6 (optional): show/hide password toggle */}
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
              Permissions are assigned to roles, then roles to users (default-deny policy). Includes all AL-4.x required audit log fields.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <button type="button" onClick={handleExportAccessList}
              className="px-3.5 py-2 bg-white hover:bg-emerald-50 text-emerald-800 border border-emerald-300 text-xs font-semibold rounded-md cursor-pointer whitespace-nowrap">
              ↓ Export UAM list (CSV)
            </button>
            <button type="button" onClick={() => setShowAddUserForm((v) => !v)}
              className="px-3.5 py-2 bg-[#492785] hover:bg-[#3b1f6b] text-white text-xs font-semibold rounded-md cursor-pointer shrink-0">
              {showAddUserForm ? 'Cancel' : 'Add user account'}
            </button>
          </div>
        </div>

        {/* IA-1/IA-2: Add user form with duplicate username validation */}
        {showAddUserForm && (
          <div className="mt-4 p-4 bg-slate-50 border border-slate-200 rounded-lg space-y-3">
            <div className="text-xs font-bold text-slate-900 mb-1">New user account — IA-1 / IA-2 / PM-3 / PM-4</div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs text-slate-600 mb-1">Full name *</label>
                <input type="text" autoComplete="off" value={newUserName} onChange={(e) => setNewUserName(e.target.value)}
                  placeholder="e.g. S. Magsaysay"
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-md text-xs text-slate-800" />
              </div>
              <div>
                <label className="block text-xs text-slate-600 mb-1">Email / UPN * <span className="text-slate-400">(becomes username)</span></label>
                <input type="email" autoComplete="off" value={newUserEmail} onChange={(e) => { setNewUserEmail(e.target.value); setNewUserNameError(''); }}
                  placeholder="s.magsaysay@bank.com.ph"
                  className={`w-full px-3 py-2 bg-white border rounded-md text-xs text-slate-800 ${newUserNameError ? 'border-red-400' : 'border-slate-300'}`} />
                {newUserNameError && <div className="text-xs text-red-700 mt-1">{newUserNameError}</div>}
              </div>
              <div>
                <label className="block text-xs text-slate-600 mb-1">Employee number</label>
                <input type="text" autoComplete="off" value={newUserEmployeeNo} onChange={(e) => setNewUserEmployeeNo(e.target.value)}
                  placeholder="EMP-XXX"
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-md text-xs text-slate-800" />
              </div>
              <div>
                <label className="block text-xs text-slate-600 mb-1">Role</label>
                <select value={newUserRole} onChange={(e) => setNewUserRole(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-md text-xs text-slate-800">
                  {['System administrator','Chief Audit Executive','Audit Manager','Auditor','Auditee'].map((r) => (
                    <option key={r} value={r}>{r}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs text-slate-600 mb-1">Scope</label>
                <input type="text" autoComplete="off" value={newUserScope} onChange={(e) => setNewUserScope(e.target.value)}
                  placeholder="Assigned engagements"
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-md text-xs text-slate-800" />
              </div>
              <div>
                <label className="block text-xs text-slate-600 mb-1">
                  Initial password <span className="text-slate-400">(PM-4: leave blank for auto-generated)</span>
                </label>
                <div className="relative">
                  {/* IA-5: autocomplete="new-password", no hint */}
                  <input type={showNewUserPassword ? 'text' : 'password'} autoComplete="new-password"
                    value={newUserPassword} onChange={(e) => setNewUserPassword(e.target.value)}
                    placeholder="Auto-generated if empty"
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-md text-xs text-slate-800 pr-10" />
                  {/* IA-6: show/hide toggle */}
                  <button type="button" onClick={() => setShowNewUserPassword((p) => !p)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 cursor-pointer text-[11px]">
                    {showNewUserPassword ? '🙈' : '👁️'}
                  </button>
                </div>
                {newUserPassword && (() => {
                  const score = scorePasswordStrength(newUserPassword);
                  return (
                    <div className="mt-1.5">
                      <div className="flex gap-0.5">
                        {[0,1,2,3,4].map((i) => (
                          <div key={i} className={`h-1 flex-1 rounded-full ${i <= score ? PASSWORD_STRENGTH_COLORS[score] : 'bg-slate-200'}`} />
                        ))}
                      </div>
                      <div className="text-[11px] text-slate-500 mt-0.5">
                        PM-13: Strength — <strong>{PASSWORD_STRENGTH_LABELS[score]}</strong>
                      </div>
                    </div>
                  );
                })()}
              </div>
            </div>
            <button type="button" onClick={handleAddUser}
              className="px-4 py-2 bg-[#492785] hover:bg-[#3b1f6b] text-white text-xs font-semibold rounded-md cursor-pointer">
              Create account
            </button>
          </div>
        )}

        <div className="mt-5 overflow-x-auto">
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
              {accessUsers.map((usr) => {
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
                      <div className="flex flex-wrap gap-1">
                        {usr.roles.map((r) => (
                          <span key={r} className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                            r === 'System administrator' || r === 'Chief Audit Executive'
                              ? 'bg-[#E4DDF8] text-[#492785]'
                              : r === 'Audit Manager' ? 'bg-[#DCE8FB] text-[#1D4ED8]'
                              : 'bg-slate-100 text-slate-700'
                          }`}>{r}</span>
                        ))}
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
                          onClick={() => { const found = USERS.find((u) => u.name === usr.name); if (found) { onChangeUser(found); } else { onChangeUser({ id: usr.id, name: usr.name, roleTitle: usr.roles.join(', '), fullLabel: `${usr.name} — ${usr.roles.join(', ')}`, headerSubtitle: usr.roles.join(', '), department: usr.title, canApproveHead: usr.roles.includes('Chief Audit Executive'), canApproveIndependent: usr.roles.includes('Audit Manager') || usr.roles.includes('Auditor'), canApproveCAE: usr.roles.includes('Chief Audit Executive') }); } }}
                          className="px-2 py-1 bg-white hover:bg-slate-50 text-slate-800 border border-slate-300 rounded text-[10px] font-medium cursor-pointer">
                          Impersonate
                        </button>
                        <button type="button"
                          onClick={() => handleGenerateTempPw(usr.id)}
                          className="px-2 py-1 bg-white hover:bg-slate-50 text-slate-800 border border-slate-300 rounded text-[10px] font-medium cursor-pointer">
                          Reset PW
                        </button>
                        <button type="button"
                          onClick={() => setAccessUsers((prev) => prev.map((item) => item.id === usr.id ? { ...item, status: item.status === 'Active' ? 'Suspended' : 'Active' } as any : item))}
                          className="px-2 py-1 bg-white hover:bg-slate-50 text-slate-800 border border-slate-300 rounded text-[10px] font-medium cursor-pointer">
                          {usr.status === 'Active' ? 'Suspend' : 'Activate'}
                        </button>
                        <button type="button"
                          onClick={() => setAccessUsers((prev) => prev.filter((item) => item.id !== usr.id))}
                          className="px-2 py-1 bg-white hover:bg-rose-50 text-rose-700 border border-rose-200 rounded text-[10px] font-medium cursor-pointer">
                          Remove
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

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
          <strong>SM-3 (optional):</strong> A countdown dialog appears 2 minutes before idle timeout: "Your session will expire in 2 minutes. Click to stay logged in."
          Session cookies issued with <code>Secure</code>, <code>HttpOnly</code>, and <code>SameSite=Strict</code> attributes.
          Session ID regenerated after each successful login (session fixation prevention).
        </div>
      </div>

      {/* ── Role permission matrix ───────────────────────────────────────── */}
      <div className="bg-white rounded-lg border border-slate-200/90 shadow-2xs p-5">
        <h2 className="text-[16px] font-bold text-slate-900 mb-0.5">Role permission matrix</h2>
        <p className="text-xs text-slate-500 mb-4">
          Capabilities enforced per role across the 6-stage audit lifecycle. Permissions are assigned to roles — never directly to individual users (LAC-1 default-deny policy).
        </p>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-[12px]">
            <thead>
              <tr className="border-b border-slate-200 text-[10px] font-semibold text-slate-500 uppercase tracking-wider">
                <th className="py-2.5 pr-4">CAPABILITY / LIFECYCLE STAGE</th>
                <th className="py-2.5 px-4">SYSTEM ADMIN</th>
                <th className="py-2.5 px-4">CAE</th>
                <th className="py-2.5 px-4">AUDIT MANAGER</th>
                <th className="py-2.5 px-4">AUDITOR</th>
                <th className="py-2.5 pl-4">AUDITEE</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200/80">
              {rolePermissionsMatrix.map((row) => (
                <tr key={row.capability} className="hover:bg-slate-50/40">
                  <td className="py-2.5 pr-4 font-bold text-slate-900">{row.capability}</td>
                  <td className="py-2.5 px-4 text-xs text-slate-700">{row.sysAdmin}</td>
                  <td className="py-2.5 px-4 text-xs text-slate-700">{row.cae}</td>
                  <td className="py-2.5 px-4 text-xs text-slate-700">{row.manager}</td>
                  <td className="py-2.5 px-4 text-xs text-slate-700">{row.auditor}</td>
                  <td className="py-2.5 pl-4 text-xs text-slate-700">{row.auditee}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
