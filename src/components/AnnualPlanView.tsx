import React, { useEffect, useState } from 'react';
import { formatYearIdentifier, normalizeYearIdentifier } from '../utils/identifiers';
import { formatAuditDate, getCurrentAccountEmail } from '../utils/auditMetadata';
import { AuditDivisionRiskScale, AuditEngagement, AuditRiskLevel, UniverseEntity, UserProfile } from '../data/auditData';
import { fetchMasterData } from '../utils/db';
import { formatDateForDisplay } from '../utils/date';
import { getAuditFieldworkWeeks, getAuditRiskLevel } from '../utils/riskScale';

const DEFAULT_AUDIT_TYPES = [
  'Financial audit',
  'Operational audit',
  'Compliance audit',
  'IT audit',
  'Thematic audit',
];

interface AnnualPlanViewProps {
  engagements: AuditEngagement[];
  universe: UniverseEntity[];
  userProfiles: UserProfile[];
  auditDivisionRiskScales: AuditDivisionRiskScale[];
  onSelectEngagement: (engagement: AuditEngagement) => void;
  onAddEngagement: (newEng: AuditEngagement) => void;
  onUpdateEngagement: (engagement: AuditEngagement) => void;
  onUpdateEngagementStatus: (engagementId: string, status: string) => void;
  onAutoAssignLeads: () => void;
  onDraftFromUniverse: () => void;
}

export const AnnualPlanView: React.FC<AnnualPlanViewProps> = ({
  engagements,
  universe,
  userProfiles,
  auditDivisionRiskScales,
  onSelectEngagement,
  onAddEngagement,
  onUpdateEngagement,
  onUpdateEngagementStatus,
  onAutoAssignLeads,
  onDraftFromUniverse,
}) => {
  const [selectedYear, setSelectedYear] = useState<string>('2026');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('All');
  const [showNewModal, setShowNewModal] = useState<boolean>(false);
  const [showPlanDocModal, setShowPlanDocModal] = useState<boolean>(false);
  const [bannerMessage, setBannerMessage] = useState<string | null>(null);

  // New audit form state
  const [newTitle, setNewTitle] = useState('');
  const [newCategory, setNewCategory] = useState(DEFAULT_AUDIT_TYPES[0]);
  const [auditTypes, setAuditTypes] = useState(DEFAULT_AUDIT_TYPES);
  const [auditStatuses, setAuditStatuses] = useState(['Planned', 'Scheduled', 'In progress', 'Reporting', 'Closed', 'Deferred', 'Cancelled']);
  const [newEntityId, setNewEntityId] = useState('');
  const [newAuditDivisionId, setNewAuditDivisionId] = useState('');
  const [newLikelihood, setNewLikelihood] = useState(4);
  const [newImpact, setNewImpact] = useState(5);
  const [newLead, setNewLead] = useState('');
  const [newHeadReviewer, setNewHeadReviewer] = useState('');
  const [newIndependentReviewer, setNewIndependentReviewer] = useState('Not needed');
  const [newStart, setNewStart] = useState('');
  const [newEnd, setNewEnd] = useState('');
  const [newStatus, setNewStatus] = useState('Planned');
  const [newObjectives, setNewObjectives] = useState('');
  const [newScope, setNewScope] = useState('');
  const [newCriteria, setNewCriteria] = useState('');
  const [newAddresseeName, setNewAddresseeName] = useState('');
  const [newAddresseeTitle, setNewAddresseeTitle] = useState('');
  const [newCopyFurnished, setNewCopyFurnished] = useState('');
  const [newBudgetedHours, setNewBudgetedHours] = useState('');

  useEffect(() => {
    fetchMasterData('audit_types', DEFAULT_AUDIT_TYPES).then((types) => {
      if (types.length === 0) return;
      setAuditTypes(types);
      setNewCategory((current) => types.includes(current) ? current : types[0]);
    });
    fetchMasterData('audit_statuses', ['Planned', 'Scheduled', 'In progress', 'Reporting', 'Closed', 'Deferred', 'Cancelled']).then((statuses) => {
      if (statuses.length === 0) return;
      setAuditStatuses(statuses);
      setNewStatus((current) => statuses.includes(current) ? current : statuses[0]);
    });
  }, []);

  const filteredEngagements = engagements.filter((eng) => {
    const matchesSearch =
      searchQuery.trim() === '' ||
      eng.ref.toLowerCase().includes(searchQuery.toLowerCase()) ||
      eng.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      eng.entityName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      eng.lead.toLowerCase().includes(searchQuery.toLowerCase()) ||
      eng.category.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesStatus =
      statusFilter === 'All' ||
      eng.status.toLowerCase() === statusFilter.toLowerCase();

    return matchesSearch && matchesStatus;
  });

  const getRiskBadgeColor = (level: AuditRiskLevel) => {
    switch (level) {
      case 'High':
        return 'bg-[#D97724] text-white';
      case 'Medium':
        return 'bg-[#C99E2C] text-white';
      case 'Low':
        return 'bg-[#519E66] text-white';
    }
  };

  const getStatusBadge = (status: AuditEngagement['status']) => {
    switch (status) {
      case 'Closed':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-[#DCEFE2] text-[#1E6339]">
            <span className="w-1.5 h-1.5 rounded-full bg-[#1E6339]" />
            Closed
          </span>
        );
      case 'Reporting':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-[#FBE7D3] text-[#B8500B]">
            <span className="w-1.5 h-1.5 rounded-full bg-[#D97724]" />
            Reporting
          </span>
        );
      case 'In progress':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-[#E4DDF8] text-[#492785]">
            <span className="w-1.5 h-1.5 rounded-full bg-[#492785]" />
            In progress
          </span>
        );
      case 'Scheduled':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-[#DCE8FB] text-[#1D4ED8]">
            <span className="w-1.5 h-1.5 rounded-full bg-[#1D4ED8]" />
            Scheduled
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-600 border border-slate-200">
            <span className="w-1.5 h-1.5 rounded-full bg-slate-500" />
            {status}
          </span>
        );
    }
  };

  const totalBudgetedHours = engagements.reduce(
    (sum, e) => sum + (e.budgetedHours || 0),
    0
  );

  const availableAuditStatuses = [...new Set([...auditStatuses, ...engagements.map((engagement) => engagement.status)])];
  const statusFilterTabs = [
    { id: "All", label: `All ${engagements.length > 0 ? `(${engagements.length})` : ""}`.trim() },
    ...availableAuditStatuses.map((status) => ({
      id: status,
      label: `${status} ${engagements.filter((engagement) => engagement.status === status).length}`,
    })),
  ];

  const displayedEngagements = filteredEngagements;

  const handleCreateAudit = (e: React.FormEvent) => {
    e.preventDefault();
    const selectedEntity = universe.find((entity) => entity.id === newEntityId);
    const startTime = Date.parse(`${newStart}T00:00:00Z`);
    const endTime = Date.parse(`${newEnd}T00:00:00Z`);
    const budgetedHours = Number(newBudgetedHours);
    if (
      !newTitle.trim() ||
      !selectedEntity ||
      !newAuditDivisionId ||
      !newLead ||
      !newHeadReviewer ||
      !newIndependentReviewer ||
      !newStart ||
      !newEnd ||
      !Number.isFinite(startTime) ||
      !Number.isFinite(endTime) ||
      endTime < startTime ||
      !Number.isFinite(budgetedHours) ||
      budgetedHours <= 0 ||
      !newObjectives.trim() ||
      !newScope.trim() ||
      !newCriteria.trim() ||
      !newAddresseeName.trim() ||
      !newAddresseeTitle.trim()
    ) {
      setBannerMessage('Complete all required planning fields, select an Audit Universe entity, and use valid dates and budget hours.');
      return;
    }
    const score = newLikelihood * newImpact;
    const riskLevel = getAuditRiskLevel(score, newAuditDivisionId, auditDivisionRiskScales);
    const fieldworkWeeks = getAuditFieldworkWeeks(riskLevel, newAuditDivisionId, auditDivisionRiskScales);
    const nextNum = engagements.length + 1;
    const ref = formatYearIdentifier('AE', Number(selectedYear), nextNum);

    const created: AuditEngagement = {
      id: ref.toLowerCase(),
      ref,
      year: Number(selectedYear),
      title: newTitle.trim(),
      category: newCategory,
      department: newCategory,
      auditDivisionId: newAuditDivisionId,
      entityName: selectedEntity.name,
      likelihood: newLikelihood,
      impact: newImpact,
      riskScore: score,
      riskLevel,
      lead: newLead,
      headReviewer: newHeadReviewer,
      independentReviewer: newIndependentReviewer,
      startDate: newStart,
      endDate: newEnd,
      objectives: newObjectives.trim(),
      scope: newScope.trim(),
      criteria: newCriteria.trim(),
      addresseeName: newAddresseeName.trim(),
      addresseeTitle: newAddresseeTitle.trim(),
      copyFurnished: newCopyFurnished.trim(),
      durationDays: Math.floor((endTime - startTime) / 86_400_000) + 1,
      budgetedHours,
      status: newStatus,
      readyRatio: '0/9 ready',
      lifecycleStage: 1,
      fieldworkPct: 0,
      fieldworkDayCurrent: 0,
      fieldworkDayTotal: fieldworkWeeks * 5,
      reportStatus: 'Draft',
      reportRef: `IA-${selectedYear}-0${nextNum}-RPT`,
      executiveSummary: newObjectives.trim(),
      addedBy: getCurrentAccountEmail(),
      modifiedBy: getCurrentAccountEmail(),
      modifiedAt: new Date().toISOString(),
      workingNotes: [],
      findings: [],
      timelineActivities: [],
      files: [],
      activityLog: [
        {
          id: `AL-${Date.now().toString().slice(-4).padStart(4, '0')}`,
          timestamp: new Date().toLocaleString('en-GB'),
          actor: newLead,
          action: `${ref} added to Annual Audit Plan ${selectedYear}`,
        },
      ],
    };

    onAddEngagement(created);
    setNewTitle('');
    setNewEntityId('');
    setNewAuditDivisionId('');
    setNewHeadReviewer('');
    setNewIndependentReviewer('Not needed');
    setNewStart('');
    setNewEnd('');
    setNewObjectives('');
    setNewScope('');
    setNewCriteria('');
    setNewAddresseeName('');
    setNewAddresseeTitle('');
    setNewCopyFurnished('');
    setNewBudgetedHours('');
    setShowNewModal(false);
    setBannerMessage(`Added ${created.ref} (${created.title}) to Annual Plan ${selectedYear}.`);
  };

  return (
    <div className="bg-white rounded-lg border border-slate-200/90 shadow-2xs p-6">
      {/* Top Card Header matching Audit-Management-System (2).png */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-[19px] font-bold text-slate-900 tracking-tight">
            Annual audit plan {selectedYear}
          </h2>
          <p className="text-xs text-slate-500 mt-0.5 tabular-nums">
            {engagements.length} {engagements.length === 1 ? 'engagement' : 'engagements'} · {totalBudgetedHours.toLocaleString()} budgeted hours
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setShowPlanDocModal(true)}
            className="px-3.5 py-2 bg-white hover:bg-slate-50 text-slate-800 text-xs font-semibold rounded-md border border-slate-300 transition-colors cursor-pointer whitespace-nowrap"
          >
            Plan document
          </button>
          <button
            type="button"
            onClick={() => {
              onAutoAssignLeads();
              setBannerMessage('Auditors automatically balanced across planned engagements by specialization and risk tier.');
            }}
            className="px-3.5 py-2 bg-white hover:bg-slate-50 text-slate-800 text-xs font-semibold rounded-md border border-slate-300 transition-colors cursor-pointer whitespace-nowrap"
          >
            Auto-assign auditors
          </button>
          <button
            type="button"
            onClick={() => {
              onDraftFromUniverse();
              setBannerMessage('Drafted overdue high-risk entities from the Audit Universe into the Annual Plan.');
            }}
            className="px-3.5 py-2 bg-white hover:bg-slate-50 text-slate-800 text-xs font-semibold rounded-md border border-slate-300 transition-colors cursor-pointer whitespace-nowrap"
          >
            Draft from universe
          </button>
          <button
            type="button"
            onClick={() => setShowNewModal(true)}
            className="px-4 py-2 bg-[#492785] hover:bg-[#3b1f6b] text-white text-xs font-semibold rounded-md transition-colors cursor-pointer whitespace-nowrap"
          >
            New audit
          </button>
        </div>
      </div>

      {bannerMessage && (
        <div className="mt-4 px-3.5 py-2.5 bg-purple-50 border border-purple-200 rounded-md flex items-center justify-between text-xs text-purple-950">
          <span>{bannerMessage}</span>
          <button
            type="button"
            onClick={() => setBannerMessage(null)}
            className="text-purple-700 hover:text-purple-950 font-semibold ml-4 cursor-pointer"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Search & Status Filter Bar */}
      <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5 flex-1 min-w-[280px]">
          <select
            aria-label="Select plan year"
            value={selectedYear}
            onChange={(e) => setSelectedYear(e.target.value)}
            className="px-3 py-2 bg-white border border-slate-300 rounded-md text-xs font-medium text-slate-800 focus:outline-none focus:border-[#492785]"
          >
            <option value="2026">2026</option>
            <option value="2027">2027</option>
            <option value="2025">2025</option>
          </select>

          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search ref, audit, entity, lead"
            className="w-full max-w-lg px-3.5 py-2 bg-white border border-slate-300 rounded-md text-xs text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-[#492785]"
          />
        </div>

        {/* Dynamic Status Filter Buttons */}
        <div className="flex flex-wrap items-center gap-1.5">
          {statusFilterTabs.map((tab) => {
            const active = statusFilter === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setStatusFilter(tab.id)}
                className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors cursor-pointer whitespace-nowrap tabular-nums ${
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

      {/* Engagements Table */}
      <div className="mt-5 overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-slate-200 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
              <th className="py-2.5 pr-4 w-36">REF</th>
              <th className="py-2.5 px-4">AUDIT</th>
              <th className="py-2.5 px-4">ENTITY &amp; RISK</th>
              <th className="py-2.5 px-4">AUDIT DIVISION</th>
              <th className="py-2.5 px-4 w-32">LEAD</th>
              <th className="py-2.5 px-4 w-44">DATES</th>
              <th className="py-2.5 pl-4 w-32">STATUS</th>
              <th className="py-2.5 px-4">ADDED BY</th>
              <th className="py-2.5 px-4">MODIFIED BY</th>
              <th className="py-2.5 px-4">LAST MODIFIED</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200/80 text-[13px]">
            {displayedEngagements.map((eng, index) => {
              const identifier = normalizeYearIdentifier(eng.ref, 'AE', eng.year, index + 1);
              return (
                <tr
                  key={eng.id || eng.ref}
                  onClick={() => onSelectEngagement(eng)}
                  className="hover:bg-purple-50/40 transition-colors cursor-pointer group"
                >
                  <td className="py-3.5 pr-4 align-top font-mono-tabular text-xs font-medium text-slate-800 whitespace-nowrap">
                    {identifier}
                  </td>
                  <td className="py-3.5 px-4 align-top">
                    <div className="font-bold text-slate-900 group-hover:text-[#492785] transition-colors">
                      {eng.title}
                    </div>
                    <div className="text-xs text-slate-500 mt-0.5">{eng.category}</div>
                  </td>
                  <td className="py-3.5 px-4 align-top">
                    <div className="text-slate-800 font-medium">{eng.entityName}</div>
                    <div className="flex items-center gap-2 mt-1">
                      <span
                        className={`inline-block px-1.5 py-0.5 rounded text-[11px] font-mono-tabular font-bold ${getRiskBadgeColor(
                          eng.riskLevel
                        )}`}
                      >
                        {eng.likelihood}×{eng.impact}={eng.riskScore}
                      </span>
                      <span className="text-xs text-slate-600">{eng.riskLevel}</span>
                    </div>
                  </td>
                  <td className="py-3.5 px-4 align-top">
                    <select
                      aria-label={`Audit division for ${eng.ref}`}
                      value={eng.auditDivisionId || ''}
                      onClick={(event) => event.stopPropagation()}
                      onChange={(event) => {
                        event.stopPropagation();
                        const auditDivisionId = event.target.value || undefined;
                        const riskLevel = getAuditRiskLevel(eng.riskScore, auditDivisionId, auditDivisionRiskScales);
                        const fieldworkWeeks = getAuditFieldworkWeeks(riskLevel, auditDivisionId, auditDivisionRiskScales);
                        onUpdateEngagement({
                          ...eng,
                          auditDivisionId,
                          riskLevel,
                          fieldworkDayTotal: fieldworkWeeks * 5,
                          modifiedBy: getCurrentAccountEmail(),
                          modifiedAt: new Date().toISOString(),
                        });
                      }}
                      className="max-w-52 px-2 py-1 bg-white border border-slate-300 rounded text-[11px] text-slate-700"
                    >
                      <option value="">Unassigned</option>
                      {auditDivisionRiskScales.map((scale) => (
                        <option key={scale.id} value={scale.id}>{scale.name}</option>
                      ))}
                    </select>
                  </td>
                  <td className="py-3.5 px-4 align-top font-medium text-slate-800">
                    {eng.lead || '—'}
                  </td>
                  <td className="py-3.5 px-4 align-top tabular-nums">
                    <div className="text-slate-900 font-medium">{formatDateForDisplay(eng.startDate)} – {formatDateForDisplay(eng.endDate)}</div>
                    <div className="text-xs text-slate-500 mt-0.5">{eng.durationDays} days</div>
                  </td>
                  <td className="py-3.5 pl-4 align-top">
                    <div className="flex flex-col items-start gap-1" onClick={(event) => event.stopPropagation()}>
                      {getStatusBadge(eng.status)}
                      <select
                        aria-label={`Audit status for ${eng.ref}`}
                        value={eng.status}
                        onChange={(event) => onUpdateEngagementStatus(eng.id, event.target.value)}
                        className="max-w-40 px-2 py-1 bg-white border border-slate-300 rounded text-[11px] text-slate-700"
                      >
                        {[...new Set([...auditStatuses, eng.status])].map((status) => (
                          <option key={status} value={status}>{status}</option>
                        ))}
                      </select>
                      <span className="inline-block px-2 py-0.5 bg-white border border-slate-300 rounded text-[11px] font-mono-tabular text-slate-600">
                        {eng.readyRatio || '0/9 ready'}
                      </span>
                    </div>
                  </td>
                  <td className="py-3.5 px-4 align-top text-xs text-slate-700 break-all">
                    {eng.addedBy || '—'}
                  </td>
                  <td className="py-3.5 px-4 align-top text-xs text-slate-700 break-all">
                    {eng.modifiedBy || '—'}
                  </td>
                  <td className="py-3.5 px-4 align-top text-xs text-slate-600 whitespace-nowrap">
                    {formatAuditDate(eng.modifiedAt)}
                  </td>
                </tr>
              );
            })}

            {displayedEngagements.length === 0 && (
              <tr>
                <td colSpan={10} className="py-12 text-center">
                  <div className="flex flex-col items-center justify-center max-w-md mx-auto">
                    <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center text-slate-400 mb-3">
                      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                    </div>
                    {engagements.length === 0 ? (
                      <>
                        <p className="text-sm font-semibold text-slate-800">No audit engagements yet</p>
                        <p className="text-xs text-slate-500 mt-1 mb-4">The audit database is fresh and ready for testing. Click &ldquo;New audit&rdquo; to plan an audit or &ldquo;Draft from universe&rdquo; to generate engagements from registered entities.</p>
                        <button
                          type="button"
                          onClick={() => setShowNewModal(true)}
                          className="px-3.5 py-2 bg-[#492785] hover:bg-[#3b1f6b] text-white text-xs font-semibold rounded-md transition-colors cursor-pointer"
                        >
                          + Plan First Audit
                        </button>
                      </>
                    ) : (
                      <p className="text-xs text-slate-500">No audit engagements match your current filter criteria.</p>
                    )}
                  </div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Modal: New Audit */}
      {showNewModal && (
        <div className="fixed inset-0 bg-slate-900/40 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg border border-slate-200 shadow-xl max-w-2xl w-full p-5 max-h-[90vh] overflow-y-auto">
            <h3 className="text-base font-bold text-slate-900">
              Schedule New Audit Engagement
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Adds a new risk-scored audit engagement to Annual Plan {selectedYear} (Stage 01).
            </p>
            <form onSubmit={handleCreateAudit} className="mt-4 space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Audit Title
                </label>
                <input
                  type="text"
                  required
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  placeholder="e.g. Bancassurance Fee Reconciliation Audit"
                  className="w-full px-3 py-2 border border-slate-300 rounded-md"
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Audit Type
                  </label>
                  <select
                    required
                    value={newCategory}
                    onChange={(e) => setNewCategory(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-md bg-white"
                  >
                    {auditTypes.map((type) => (
                      <option key={type} value={type}>{type}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Engagement Lead
                  </label>
                  <select
                    required
                    value={newLead}
                    onChange={(e) => setNewLead(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-md bg-white"
                  >
                    <option value="">Select an engagement lead</option>
                    {userProfiles.map((u) => (
                      <option key={u.id} value={u.name}>
                        {u.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Audit Status
                  </label>
                  <select
                    required
                    value={newStatus}
                    onChange={(e) => setNewStatus(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-md bg-white"
                  >
                    {auditStatuses.map((status) => (
                      <option key={status} value={status}>{status}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Head Reviewer</label>
                  <select
                    required
                    value={newHeadReviewer}
                    onChange={(e) => setNewHeadReviewer(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-md bg-white"
                  >
                    <option value="">Select a head reviewer</option>
                    {userProfiles.filter((profile) => profile.canApproveHead).map((profile) => (
                      <option key={profile.id} value={profile.name}>{profile.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Independent Reviewer</label>
                  <select
                    required
                    value={newIndependentReviewer}
                    onChange={(e) => setNewIndependentReviewer(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-md bg-white"
                  >
                    <option value="Not needed">Not needed</option>
                    {userProfiles.filter((profile) => profile.canApproveIndependent).map((profile) => (
                      <option key={profile.id} value={profile.name}>{profile.name}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Audit Universe Entity
                </label>
                <select
                  required
                  value={newEntityId}
                  onChange={(e) => setNewEntityId(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-md bg-white"
                >
                  <option value="">Select an audited entity</option>
                  {universe.map((entity) => (
                    <option key={entity.id} value={entity.id}>{entity.code} · {entity.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Audit Division
                </label>
                <select
                  required
                  value={newAuditDivisionId}
                  onChange={(e) => setNewAuditDivisionId(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-md bg-white"
                >
                  <option value="">Select audit division</option>
                  {auditDivisionRiskScales.map((scale) => (
                    <option key={scale.id} value={scale.id}>{scale.name}</option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Likelihood (1–5)
                  </label>
                  <input
                    type="number"
                    required
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
                    required
                    min={1}
                    max={5}
                    value={newImpact}
                    onChange={(e) => setNewImpact(Number(e.target.value))}
                    className="w-full px-3 py-2 border border-slate-300 rounded-md"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Budgeted Hours</label>
                  <input
                    type="number"
                    required
                    min={1}
                    step={1}
                    value={newBudgetedHours}
                    onChange={(e) => setNewBudgetedHours(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-md"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Objectives</label>
                  <textarea
                    required
                    rows={2}
                    maxLength={2000}
                    value={newObjectives}
                    onChange={(e) => setNewObjectives(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-md"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Scope</label>
                  <textarea
                    required
                    rows={2}
                    maxLength={2000}
                    value={newScope}
                    onChange={(e) => setNewScope(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-md"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Criteria</label>
                  <textarea
                    required
                    rows={2}
                    maxLength={2000}
                    value={newCriteria}
                    onChange={(e) => setNewCriteria(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-md"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Notification Addressee</label>
                    <input
                      type="text"
                      required
                      maxLength={160}
                      value={newAddresseeName}
                      onChange={(e) => setNewAddresseeName(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-300 rounded-md"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Addressee Title</label>
                    <input
                      type="text"
                      required
                      maxLength={160}
                      value={newAddresseeTitle}
                      onChange={(e) => setNewAddresseeTitle(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-300 rounded-md"
                    />
                  </div>
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Copy Furnished</label>
                  <textarea
                    rows={2}
                    maxLength={1000}
                    value={newCopyFurnished}
                    onChange={(e) => setNewCopyFurnished(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-md"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Start Date
                  </label>
                  <input
                    type="date"
                    required
                    max={newEnd || undefined}
                    value={newStart}
                    onChange={(e) => setNewStart(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-md bg-white"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    End Date
                  </label>
                  <input
                    type="date"
                    required
                    min={newStart || undefined}
                    value={newEnd}
                    onChange={(e) => setNewEnd(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-md bg-white"
                  />
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowNewModal(false)}
                  className="px-3.5 py-1.5 border border-slate-300 rounded-md font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 bg-[#5A626A] hover:bg-slate-700 text-white rounded-md font-semibold cursor-pointer"
                >
                  Create engagement
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Plan Document */}
      {showPlanDocModal && (
        <div className="fixed inset-0 bg-slate-900/40 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg border border-slate-200 shadow-xl max-w-lg w-full p-5">
            <h3 className="text-base font-bold text-slate-900">
              Annual Audit Plan {selectedYear} — Board Audit Committee Charter Memo
            </h3>
            <p className="text-xs text-slate-500 mt-1">
              Approved by the Audit Committee of Silangan Teachers&apos; Savings Bank (Ref: BAC-RES-2026-01).
            </p>
            <div className="mt-4 p-3.5 bg-slate-50 rounded-md border border-slate-200 text-xs space-y-2 text-slate-700">
              <div className="flex justify-between">
                <span>Total Auditable Universe Entities:</span>
                <strong className="font-mono-tabular">92 entities</strong>
              </div>
              <div className="flex justify-between">
                <span>Total Budgeted Staff Hours:</span>
                <strong className="font-mono-tabular">2,520 hours (6 FTE auditors)</strong>
              </div>
              <div className="flex justify-between">
                <span>High Risk Coverage (12-month cycle):</span>
                <strong className="font-mono-tabular">100% scheduled</strong>
              </div>
              <div className="flex justify-between">
                <span>Chief Audit Executive Sign-off:</span>
                <strong>M. Santos (15 Jan 2026)</strong>
              </div>
            </div>
            <div className="mt-4 flex justify-end">
              <button
                type="button"
                onClick={() => setShowPlanDocModal(false)}
                className="px-4 py-1.5 bg-[#5A626A] text-white text-xs font-semibold rounded-md cursor-pointer"
              >
                Close preview
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
