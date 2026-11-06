import React, { useState } from 'react';
import { AuditEngagement, RiskLevel, UniverseEntity, USERS } from '../data/auditData';

interface AnnualPlanViewProps {
  engagements: AuditEngagement[];
  universe: UniverseEntity[];
  onSelectEngagement: (engagement: AuditEngagement) => void;
  onAddEngagement: (newEng: AuditEngagement) => void;
  onAutoAssignLeads: () => void;
  onDraftFromUniverse: () => void;
}

export const AnnualPlanView: React.FC<AnnualPlanViewProps> = ({
  engagements,
  onSelectEngagement,
  onAddEngagement,
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
  const [newCategory, setNewCategory] = useState('Financial');
  const [newEntity, setNewEntity] = useState('');
  const [newLikelihood, setNewLikelihood] = useState(4);
  const [newImpact, setNewImpact] = useState(5);
  const [newLead, setNewLead] = useState('A. Villanueva');
  const [newStart, setNewStart] = useState('2 Nov');
  const [newEnd, setNewEnd] = useState('11 Dec 2026');

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

  const getRiskBadgeColor = (level: RiskLevel) => {
    switch (level) {
      case 'Critical':
        return 'bg-[#B93829] text-white';
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
            Planned
          </span>
        );
    }
  };

  // Exact top rows from Audit-Management-System (2).png
  const PLAN_ROWS_2026: {
    id: string;
    ref: string;
    title: string;
    category: string;
    entityName: string;
    likelihood: number;
    impact: number;
    riskScore: number;
    riskLevel: RiskLevel;
    lead: string;
    dates: string;
    days: number;
    status: AuditEngagement['status'];
    readyRatio: string;
    startDatePassed?: boolean;
  }[] = [
    {
      id: 'aud-2026-001',
      ref: 'AUD-2026-001',
      title: 'APDS Remittance Reconciliation Audit',
      category: 'Financial',
      entityName: 'APDS remittance reconciliation',
      likelihood: 5,
      impact: 5,
      riskScore: 25,
      riskLevel: 'Critical',
      lead: 'A. Villanueva',
      dates: '2 Feb – 13 Mar 2026',
      days: 40,
      status: 'Closed',
      readyRatio: '5/9 ready',
    },
    {
      id: 'aud-2026-002',
      ref: 'AUD-2026-002',
      title: 'Core Banking Privileged Access Review',
      category: 'Information security',
      entityName: 'Core Banking – privileged access management',
      likelihood: 5,
      impact: 5,
      riskScore: 25,
      riskLevel: 'Critical',
      lead: 'J. Reyes',
      dates: '16 Mar – 24 Apr 2026',
      days: 40,
      status: 'Closed',
      readyRatio: '5/9 ready',
    },
    {
      id: 'aud-2026-003',
      ref: 'AUD-2026-003',
      title: 'Teacher Salary Loan Origination Audit',
      category: 'Credit review',
      entityName: 'Teacher salary loan application (APDS)',
      likelihood: 4,
      impact: 5,
      riskScore: 20,
      riskLevel: 'Critical',
      lead: 'A. Villanueva',
      dates: '27 Apr – 5 Jun 2026',
      days: 40,
      status: 'Closed',
      readyRatio: '5/9 ready',
    },
    {
      id: 'aud-2026-004',
      ref: 'AUD-2026-004',
      title: 'Cebu Branch Operations Audit',
      category: 'Operational',
      entityName: 'Cebu Branch',
      likelihood: 3,
      impact: 3,
      riskScore: 9,
      riskLevel: 'Medium',
      lead: 'L. Garcia',
      dates: '8 Jun – 26 Jun 2026',
      days: 19,
      status: 'Closed',
      readyRatio: '5/9 ready',
    },
    {
      id: 'aud-2026-006',
      ref: 'AUD-2026-006',
      title: 'Mobile Banking Application Security Review',
      category: 'Information security',
      entityName: 'Mobile Banking App – application security',
      likelihood: 5,
      impact: 5,
      riskScore: 25,
      riskLevel: 'Critical',
      lead: 'P. Mendoza',
      dates: '14 Sept – 23 Oct 2026',
      days: 40,
      status: 'Reporting',
      readyRatio: '8/9 ready',
    },
    {
      id: 'aud-2026-005',
      ref: 'AUD-2026-005',
      title: 'Cash Card Loan Release Audit',
      category: 'Internal control · rescheduled 1×',
      entityName: 'Loan release via cash card',
      likelihood: 4,
      impact: 4,
      riskScore: 16,
      riskLevel: 'High',
      lead: 'K. Lim',
      dates: '1 Oct – 9 Nov 2026',
      days: 40,
      status: 'Reporting',
      readyRatio: '8/9 ready',
    },
    {
      id: 'aud-2026-086',
      ref: 'AUD-2026-086',
      title: 'Operational risk & loss event reporting Audit',
      category: 'Operational',
      entityName: 'Operational risk & loss event reporting',
      likelihood: 3,
      impact: 3,
      riskScore: 9,
      riskLevel: 'Medium',
      lead: '—',
      dates: '5 Oct – 30 Oct 2026',
      days: 26,
      status: 'Planned',
      readyRatio: '2/9 ready',
      startDatePassed: true,
    },
    {
      id: 'aud-2026-072',
      ref: 'AUD-2026-072',
      title: 'Iloilo Branch Audit',
      category: 'Operational',
      entityName: 'Iloilo Branch',
      likelihood: 3,
      impact: 3,
      riskScore: 9,
      riskLevel: 'Medium',
      lead: '—',
      dates: '12 Oct – 6 Nov 2026',
      days: 26,
      status: 'Planned',
      readyRatio: '2/9 ready',
    },
    {
      id: 'aud-2026-034',
      ref: 'AUD-2026-034',
      title: 'Mobile Banking – authentication & OTP controls Audit',
      category: 'IT / Systems',
      entityName: 'Mobile Banking – authentication & OTP controls',
      likelihood: 4,
      impact: 4,
      riskScore: 16,
      riskLevel: 'High',
      lead: '—',
      dates: '12 Oct – 13 Nov 2026',
      days: 33,
      status: 'Planned',
      readyRatio: '2/9 ready',
    },
    {
      id: 'aud-2026-078',
      ref: 'AUD-2026-078',
      title: 'Cash-in-Transit Service Provider Audit',
      category: 'Supplier / Third-party',
      entityName: 'Cash-in-Transit Service Provider',
      likelihood: 3,
      impact: 3,
      riskScore: 9,
      riskLevel: 'Medium',
      lead: '—',
      dates: '12 Oct – 6 Nov 2026',
      days: 26,
      status: 'Planned',
      readyRatio: '2/9 ready',
    },
    {
      id: 'aud-2026-007',
      ref: 'AUD-2026-007',
      title: 'Stopped Deductions & Unremitted Accounts Audit',
      category: 'Credit review',
      entityName: 'Stopped deductions – resigned, transferred, retired or deceased teachers',
      likelihood: 5,
      impact: 5,
      riskScore: 25,
      riskLevel: 'Critical',
      lead: 'A. Villanueva',
      dates: '12 Oct – 20 Nov 2026',
      days: 40,
      status: 'Scheduled',
      readyRatio: '5/9 ready',
    },
    {
      id: 'aud-2026-055',
      ref: 'AUD-2026-055',
      title: 'Walk-in teacher loan application intake Audit',
      category: 'Operational',
      entityName: 'Walk-in teacher loan application intake',
      likelihood: 3,
      impact: 4,
      riskScore: 12,
      riskLevel: 'High',
      lead: '—',
      dates: '12 Oct – 13 Nov 2026',
      days: 33,
      status: 'Planned',
      readyRatio: '2/9 ready',
    },
    {
      id: 'aud-2026-021',
      ref: 'AUD-2026-021',
      title: 'Loan loss provisioning (ECL) Audit',
      category: 'Operational',
      entityName: 'Loan loss provisioning (ECL)',
      likelihood: 4,
      impact: 5,
      riskScore: 20,
      riskLevel: 'Critical',
      lead: '—',
      dates: '19 Oct – 27 Nov 2026',
      days: 40,
      status: 'Planned',
      readyRatio: '2/9 ready',
    },
    {
      id: 'aud-2026-057',
      ref: 'AUD-2026-057',
      title: 'Calamity loan restructuring for teachers Audit',
      category: 'Operational',
      entityName: 'Calamity loan restructuring for teachers',
      likelihood: 3,
      impact: 4,
      riskScore: 12,
      riskLevel: 'High',
      lead: '—',
      dates: '19 Oct – 20 Nov 2026',
      days: 33,
      status: 'Planned',
      readyRatio: '2/9 ready',
    },
    {
      id: 'aud-2026-067',
      ref: 'AUD-2026-067',
      title: 'Business continuity management Audit',
      category: 'Operational',
      entityName: 'Business continuity management',
      likelihood: 3,
      impact: 4,
      riskScore: 12,
      riskLevel: 'High',
      lead: '—',
      dates: '19 Oct – 20 Nov 2026',
      days: 33,
      status: 'Planned',
      readyRatio: '2/9 ready',
    },
    {
      id: 'aud-2026-091',
      ref: 'AUD-2026-091',
      title: 'Whistleblowing & ethics hotline Audit',
      category: 'Operational',
      entityName: 'Whistleblowing & ethics hotline',
      likelihood: 2,
      impact: 3,
      riskScore: 6,
      riskLevel: 'Medium',
      lead: '—',
      dates: '19 Oct – 13 Nov 2026',
      days: 26,
      status: 'Planned',
      readyRatio: '2/9 ready',
    },
    {
      id: 'aud-2026-089',
      ref: 'AUD-2026-089',
      title: 'Co-maker & guarantor validation Audit',
      category: 'Operational',
      entityName: 'Co-maker & guarantor validation',
      likelihood: 2,
      impact: 3,
      riskScore: 6,
      riskLevel: 'Medium',
      lead: '—',
      dates: '19 Oct – 13 Nov 2026',
      days: 26,
      status: 'Planned',
      readyRatio: '2/9 ready',
    },
    {
      id: 'aud-2026-058',
      ref: 'AUD-2026-058',
      title: 'Retiree & pensioner teacher loans Audit',
      category: 'Operational',
      entityName: 'Retiree & pensioner teacher loans',
      likelihood: 3,
      impact: 4,
      riskScore: 12,
      riskLevel: 'High',
      lead: '—',
      dates: '19 Oct – 20 Nov 2026',
      days: 33,
      status: 'Planned',
      readyRatio: '2/9 ready',
    },
    {
      id: 'aud-2026-073',
      ref: 'AUD-2026-073',
      title: 'Cagayan de Oro Branch Audit',
      category: 'Operational',
      entityName: 'Cagayan de Oro Branch',
      likelihood: 3,
      impact: 3,
      riskScore: 9,
      riskLevel: 'Medium',
      lead: '—',
      dates: '19 Oct – 13 Nov 2026',
      days: 26,
      status: 'Planned',
      readyRatio: '2/9 ready',
    },
    {
      id: 'aud-2026-079',
      ref: 'AUD-2026-079',
      title: 'Recovery on written-off accounts Audit',
      category: 'Operational',
      entityName: 'Recovery on written-off accounts',
      likelihood: 3,
      impact: 3,
      riskScore: 9,
      riskLevel: 'Medium',
      lead: '—',
      dates: '19 Oct – 13 Nov 2026',
      days: 26,
      status: 'Planned',
      readyRatio: '2/9 ready',
    },
    {
      id: 'aud-2026-066',
      ref: 'AUD-2026-066',
      title: 'Credit data submission to CIC Audit',
      category: 'Supplier / Third-party',
      entityName: 'Credit data submission to CIC',
      likelihood: 3,
      impact: 4,
      riskScore: 12,
      riskLevel: 'High',
      lead: '—',
      dates: '19 Oct – 20 Nov 2026',
      days: 33,
      status: 'Planned',
      readyRatio: '2/9 ready',
    },
    {
      id: 'aud-2026-060',
      ref: 'AUD-2026-060',
      title: 'Release to authorized representatives (SPA) Audit',
      category: 'Operational',
      entityName: 'Release to authorized representatives (SPA)',
      likelihood: 3,
      impact: 4,
      riskScore: 12,
      riskLevel: 'High',
      lead: '—',
      dates: '19 Oct – 20 Nov 2026',
      days: 33,
      status: 'Planned',
      readyRatio: '2/9 ready',
    },
    {
      id: 'aud-2026-053',
      ref: 'AUD-2026-053',
      title: 'Tacloban Branch Audit',
      category: 'Operational',
      entityName: 'Tacloban Branch',
      likelihood: 3,
      impact: 4,
      riskScore: 12,
      riskLevel: 'High',
      lead: '—',
      dates: '19 Oct – 20 Nov 2026',
      days: 33,
      status: 'Planned',
      readyRatio: '2/9 ready',
    },
    {
      id: 'aud-2026-040',
      ref: 'AUD-2026-040',
      title: 'Core Banking Software Vendor – remote support Audit',
      category: 'Supplier / Third-party',
      entityName: 'Core Banking Software Vendor – remote support',
      likelihood: 4,
      impact: 4,
      riskScore: 16,
      riskLevel: 'High',
      lead: '—',
      dates: '19 Oct – 20 Nov 2026',
      days: 33,
      status: 'Planned',
      readyRatio: '2/9 ready',
    },
    {
      id: 'aud-2026-025',
      ref: 'AUD-2026-025',
      title: 'Accredited School Marketing Agents Audit',
      category: 'Supplier / Third-party',
      entityName: 'Accredited School Marketing Agents',
      likelihood: 4,
      impact: 4,
      riskScore: 16,
      riskLevel: 'High',
      lead: '—',
      dates: '19 Oct – 20 Nov 2026',
      days: 33,
      status: 'Planned',
      readyRatio: '2/9 ready',
    },
    {
      id: 'aud-2026-010',
      ref: 'AUD-2026-010',
      title: 'Cash Card Platform – admin & privileged access Audit',
      category: 'IT / Systems',
      entityName: 'Cash Card Platform – admin & privileged access',
      likelihood: 5,
      impact: 5,
      riskScore: 25,
      riskLevel: 'Critical',
      lead: '—',
      dates: '19 Oct – 27 Nov 2026',
      days: 40,
      status: 'Planned',
      readyRatio: '2/9 ready',
    },
    {
      id: 'aud-2026-043',
      ref: 'AUD-2026-043',
      title: 'Outsourcing & third-party risk management Audit',
      category: 'Operational',
      entityName: 'Outsourcing & third-party risk management',
      likelihood: 4,
      impact: 4,
      riskScore: 16,
      riskLevel: 'High',
      lead: '—',
      dates: '19 Oct – 20 Nov 2026',
      days: 33,
      status: 'Planned',
      readyRatio: '2/9 ready',
    },
    {
      id: 'aud-2026-012',
      ref: 'AUD-2026-012',
      title: 'APDS Deduction Interface – file transfer security Audit',
      category: 'IT / Systems',
      entityName: 'APDS Deduction Interface – file transfer security',
      likelihood: 5,
      impact: 5,
      riskScore: 25,
      riskLevel: 'Critical',
      lead: '—',
      dates: '19 Oct – 27 Nov 2026',
      days: 40,
      status: 'Planned',
      readyRatio: '2/9 ready',
    },
    {
      id: 'aud-2026-085',
      ref: 'AUD-2026-085',
      title: 'Data Warehouse & MIS – report integrity Audit',
      category: 'IT / Systems',
      entityName: 'Data Warehouse & MIS – report integrity',
      likelihood: 3,
      impact: 3,
      riskScore: 9,
      riskLevel: 'Medium',
      lead: '—',
      dates: '19 Oct – 13 Nov 2026',
      days: 26,
      status: 'Planned',
      readyRatio: '2/9 ready',
    },
    {
      id: 'aud-2026-031',
      ref: 'AUD-2026-031',
      title: 'Third-party Collection Agencies Audit',
      category: 'Supplier / Third-party',
      entityName: 'Third-party Collection Agencies',
      likelihood: 4,
      impact: 4,
      riskScore: 16,
      riskLevel: 'High',
      lead: '—',
      dates: '19 Oct – 20 Nov 2026',
      days: 33,
      status: 'Planned',
      readyRatio: '2/9 ready',
    },
    {
      id: 'aud-2026-014',
      ref: 'AUD-2026-014',
      title: 'Core Banking – vulnerability & patch management Audit',
      category: 'IT / Systems',
      entityName: 'Core Banking – vulnerability & patch management',
      likelihood: 5,
      impact: 5,
      riskScore: 25,
      riskLevel: 'Critical',
      lead: '—',
      dates: '19 Oct – 27 Nov 2026',
      days: 40,
      status: 'Planned',
      readyRatio: '2/9 ready',
    },
    {
      id: 'aud-2026-094',
      ref: 'AUD-2026-094',
      title: 'Core Banking – privileged access management Audit-Test',
      category: 'Information security',
      entityName: 'Core Banking – privileged access management',
      likelihood: 5,
      impact: 5,
      riskScore: 25,
      riskLevel: 'Critical',
      lead: 'N. Lopez',
      dates: '27 Oct – 4 Dec 2026',
      days: 40,
      status: 'In progress',
      readyRatio: '5/9 ready',
    },
  ];

  const displayedRows = PLAN_ROWS_2026.filter((row) => {
    const matchesSearch =
      searchQuery.trim() === '' ||
      row.ref.toLowerCase().includes(searchQuery.toLowerCase()) ||
      row.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      row.entityName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      row.lead.toLowerCase().includes(searchQuery.toLowerCase()) ||
      row.category.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesStatus =
      statusFilter === 'All' ||
      row.status.toLowerCase() === statusFilter.toLowerCase();

    return matchesSearch && matchesStatus;
  });

  const handleCreateAudit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim() || !newEntity.trim()) return;
    const score = newLikelihood * newImpact;
    const riskLevel: RiskLevel =
      score >= 20 ? 'Critical' : score >= 10 ? 'High' : score >= 5 ? 'Medium' : 'Low';
    const nextNum = engagements.length + 1;
    const ref = `AUD-${selectedYear}-0${nextNum < 10 ? '0' + nextNum : nextNum}`;

    const created: AuditEngagement = {
      id: `aud-${Date.now()}`,
      ref,
      year: Number(selectedYear),
      title: newTitle.trim(),
      category: newCategory,
      department: newCategory,
      entityName: newEntity.trim(),
      likelihood: newLikelihood,
      impact: newImpact,
      riskScore: score,
      riskLevel,
      lead: newLead,
      headReviewer: 'M. Santos',
      independentReviewer: 'Not needed',
      startDate: newStart,
      endDate: newEnd,
      durationDays: 26,
      budgetedHours: 240,
      status: 'Planned',
      readyRatio: '0/9 ready',
      lifecycleStage: 1,
      fieldworkPct: 0,
      fieldworkDayCurrent: 0,
      fieldworkDayTotal: 26,
      reportStatus: 'Draft',
      reportRef: `IA-${selectedYear}-0${nextNum}-RPT`,
      executiveSummary: `Scheduled audit engagement for ${newEntity.trim()}.`,
      workingNotes: [],
      findings: [],
      timelineActivities: [],
      files: [],
      activityLog: [
        {
          id: `act-${Date.now()}`,
          timestamp: '4 Oct 2026, 09:15',
          actor: 'M. Santos',
          action: `${ref} added to Annual Audit Plan ${selectedYear}`,
        },
      ],
    };

    onAddEngagement(created);
    setNewTitle('');
    setNewEntity('');
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
            93 engagements · 2,920 budgeted hours
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
              setBannerMessage('Auditors automatically balanced across planned 2026 engagements by specialization and risk tier.');
            }}
            className="px-3.5 py-2 bg-white hover:bg-slate-50 text-slate-800 text-xs font-semibold rounded-md border border-slate-300 transition-colors cursor-pointer whitespace-nowrap"
          >
            Auto-assign auditors
          </button>
          <button
            type="button"
            onClick={() => {
              onDraftFromUniverse();
              setBannerMessage('Drafted overdue Critical/High entities from the Audit Universe into the 2026 Annual Plan.');
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

      {/* Search & Status Filter Bar matching Audit-Management-System (2).png */}
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

        {/* Status Filter Buttons matching Audit-Management-System (2).png */}
        <div className="flex flex-wrap items-center gap-1.5">
          {[
            { id: 'All', label: 'All' },
            { id: 'Planned', label: 'Planned 85' },
            { id: 'Scheduled', label: 'Scheduled 1' },
            { id: 'In progress', label: 'In progress 1' },
            { id: 'Reporting', label: 'Reporting 2' },
            { id: 'Closed', label: 'Closed 4' },
          ].map((tab) => {
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

      {/* Engagements Table matching Audit-Management-System (2).png */}
      <div className="mt-5 overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-slate-200 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
              <th className="py-2.5 pr-4 w-36">REF</th>
              <th className="py-2.5 px-4">AUDIT</th>
              <th className="py-2.5 px-4">ENTITY &amp; RISK</th>
              <th className="py-2.5 px-4 w-32">LEAD</th>
              <th className="py-2.5 px-4 w-44">DATES</th>
              <th className="py-2.5 pl-4 w-32">STATUS</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200/80 text-[13px]">
            {displayedRows.map((row) => {
              const matchedEng =
                engagements.find((e) => e.id === row.id || e.ref === row.ref) ||
                engagements[0];
              return (
                <tr
                  key={row.ref}
                  onClick={() => onSelectEngagement(matchedEng)}
                  className="hover:bg-purple-50/40 transition-colors cursor-pointer group"
                >
                  <td className="py-3.5 pr-4 align-top font-mono-tabular text-xs font-medium text-slate-800 whitespace-nowrap">
                    {row.ref}
                  </td>
                  <td className="py-3.5 px-4 align-top">
                    <div className="font-bold text-slate-900 group-hover:text-[#492785] transition-colors">
                      {row.title}
                    </div>
                    <div className="text-xs text-slate-500 mt-0.5">{row.category}</div>
                  </td>
                  <td className="py-3.5 px-4 align-top">
                    <div className="text-slate-800 font-medium">{row.entityName}</div>
                    <div className="flex items-center gap-2 mt-1">
                      <span
                        className={`inline-block px-1.5 py-0.5 rounded text-[11px] font-mono-tabular font-bold ${getRiskBadgeColor(
                          row.riskLevel
                        )}`}
                      >
                        {row.likelihood}×{row.impact}={row.riskScore}
                      </span>
                      <span className="text-xs text-slate-600">{row.riskLevel}</span>
                    </div>
                  </td>
                  <td className="py-3.5 px-4 align-top font-medium text-slate-800">
                    {row.lead}
                  </td>
                  <td className="py-3.5 px-4 align-top tabular-nums">
                    <div className="text-slate-900 font-medium">{row.dates}</div>
                    <div className="text-xs text-slate-500 mt-0.5">{row.days} days</div>
                  </td>
                  <td className="py-3.5 pl-4 align-top">
                    <div className="flex flex-col items-start gap-1">
                      {getStatusBadge(row.status)}
                      {row.startDatePassed && (
                        <span className="text-[11px] font-semibold text-[#B93829] leading-tight">
                          Start date passed
                        </span>
                      )}
                      <span className="inline-block px-2 py-0.5 bg-white border border-slate-300 rounded text-[11px] font-mono-tabular text-slate-600">
                        {row.readyRatio}
                      </span>
                    </div>
                  </td>
                </tr>
              );
            })}

            {displayedRows.length === 0 && (
              <tr>
                <td colSpan={6} className="py-8 text-center text-xs text-slate-500">
                  No audit engagements match your current filter criteria.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Modal: New Audit */}
      {showNewModal && (
        <div className="fixed inset-0 bg-slate-900/40 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg border border-slate-200 shadow-xl max-w-md w-full p-5">
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
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Audit Category
                  </label>
                  <select
                    value={newCategory}
                    onChange={(e) => setNewCategory(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-md bg-white"
                  >
                    <option value="Financial">Financial</option>
                    <option value="Information security">Information security</option>
                    <option value="Credit review">Credit review</option>
                    <option value="Operations">Operations</option>
                    <option value="Compliance">Compliance</option>
                  </select>
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Engagement Lead
                  </label>
                  <select
                    value={newLead}
                    onChange={(e) => setNewLead(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-md bg-white"
                  >
                    {USERS.map((u) => (
                      <option key={u.id} value={u.name}>
                        {u.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Auditable Entity Name
                </label>
                <input
                  type="text"
                  required
                  value={newEntity}
                  onChange={(e) => setNewEntity(e.target.value)}
                  placeholder="e.g. Bancassurance settlement & commission ledger"
                  className="w-full px-3 py-2 border border-slate-300 rounded-md"
                />
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
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Start Date
                  </label>
                  <input
                    type="text"
                    value={newStart}
                    onChange={(e) => setNewStart(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-md"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    End Date
                  </label>
                  <input
                    type="text"
                    value={newEnd}
                    onChange={(e) => setNewEnd(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-md"
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
                <span>Critical Risk Coverage (6-month cycle):</span>
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
