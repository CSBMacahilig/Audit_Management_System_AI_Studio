import React, { useState } from 'react';
import {
  AuditEngagement,
  AuditFile,
  AuditFinding,
  EngagementSubTabId,
  INITIAL_ENGAGEMENTS,
  INITIAL_UNIVERSE,
  LifecycleStageId,
  MainTabId,
  UniverseEntity,
  UserProfile,
  USERS,
  WorkingNote,
} from './data/auditData';
import { HeaderAndLifecycle } from './components/HeaderAndLifecycle';
import { AnnualPlanView } from './components/AnnualPlanView';
import { FieldworkView } from './components/FieldworkView';
import { SettingsView } from './components/SettingsView';
import {
  AuditUniverseView,
  IssuesView,
  MasterDataSetupAccessView,
  OverviewView,
  TimelineView,
} from './components/AdditionalViews';

export default function App() {
  const [engagements, setEngagements] = useState<AuditEngagement[]>(INITIAL_ENGAGEMENTS);
  const [universe] = useState<UniverseEntity[]>(INITIAL_UNIVERSE);
  const [currentUser, setCurrentUser] = useState<UserProfile>(USERS[0]);
  const [accessActive, setAccessActive] = useState<boolean>(false);

  // Navigation & Lifecycle Progress State
  const [activeTab, setActiveTab] = useState<MainTabId>('overview');
  const [activeLifecycleStage, setActiveLifecycleStage] = useState<LifecycleStageId>(1);
  const [selectedEngagementId, setSelectedEngagementId] = useState<string | null>(null);
  const [activeSubTab, setActiveSubTab] = useState<EngagementSubTabId>('dashboard');

  const [frequencies, setFrequencies] = useState({
    critical: 6,
    high: 12,
    medium: 24,
    low: 36,
  });

  const selectedEngagement =
    engagements.find((e) => e.id === selectedEngagementId) || null;

  // Synchronize Main Tab selection with Audit Lifecycle Breadcrumb progress
  const handleSelectTab = (tab: MainTabId) => {
    setActiveTab(tab);
    switch (tab) {
      case 'overview':
      case 'universe':
      case 'annual-plan':
      case 'timeline':
        setActiveLifecycleStage(1);
        break;
      case 'fieldwork':
        if (selectedEngagement) {
          setActiveLifecycleStage(selectedEngagement.lifecycleStage);
        } else {
          setActiveLifecycleStage(2);
        }
        break;
      case 'issues':
        setActiveLifecycleStage(5);
        break;
      case 'settings':
      case 'master-data':
      case 'setup':
      case 'access':
        // Preserve current lifecycle context or default to 1 (Planning & risk config)
        setActiveLifecycleStage(1);
        break;
    }
  };

  // Synchronize Lifecycle Stage Breadcrumb click with Main Tab & Engagement Sub-Tab
  const handleSelectLifecycleStage = (stageId: LifecycleStageId) => {
    setActiveLifecycleStage(stageId);

    switch (stageId) {
      case 1:
        setActiveTab('annual-plan');
        break;
      case 2:
        setActiveTab('fieldwork');
        if (!selectedEngagementId) {
          setSelectedEngagementId('aud-2026-006');
        }
        setActiveSubTab('dashboard');
        break;
      case 3:
        setActiveTab('fieldwork');
        if (!selectedEngagementId) {
          // Open the primary reporting engagement AUD-2026-006 to show Findings & Report
          setSelectedEngagementId('aud-2026-006');
        }
        setActiveSubTab('findings');
        break;
      case 4:
        setActiveTab('fieldwork');
        if (!selectedEngagementId) {
          setSelectedEngagementId('aud-2026-006');
        }
        setActiveSubTab('auditee');
        break;
      case 5:
        setActiveTab('issues');
        break;
      case 6:
        setActiveTab('issues');
        break;
      case 7:
        setActiveTab('universe');
        break;
    }
  };

  // Synchronize Engagement Sub-Tab selection with Lifecycle Stage Breadcrumbs
  const handleSelectSubTab = (subTab: EngagementSubTabId) => {
    setActiveSubTab(subTab);
    if (subTab === 'working-notes' || subTab === 'review' || subTab === 'files') {
      setActiveLifecycleStage(2);
    } else if (subTab === 'findings' || subTab === 'report') {
      setActiveLifecycleStage(3);
    } else if (subTab === 'auditee') {
      setActiveLifecycleStage(4);
    } else if (subTab === 'dashboard' && selectedEngagement) {
      setActiveLifecycleStage(selectedEngagement.lifecycleStage);
    }
  };

  const handleSelectEngagement = (eng: AuditEngagement | null) => {
    if (!eng) {
      setSelectedEngagementId(null);
      setActiveLifecycleStage(2);
      return;
    }
    setSelectedEngagementId(eng.id);
    setActiveTab('fieldwork');
    setActiveSubTab('dashboard');
    setActiveLifecycleStage(eng.lifecycleStage);
  };

  const handleAdvanceEngagementStage = (nextStage: LifecycleStageId) => {
    if (!selectedEngagementId) return;
    setActiveLifecycleStage(nextStage);
    setEngagements((prev) =>
      prev.map((eng) => {
        if (eng.id !== selectedEngagementId) return eng;
        const nextStatus =
          nextStage === 1
            ? 'Planned'
            : nextStage === 2
            ? 'In progress'
            : nextStage >= 6
            ? 'Closed'
            : 'Reporting';
        return {
          ...eng,
          lifecycleStage: nextStage,
          status: nextStatus,
          fieldworkPct: nextStage >= 3 ? Math.max(eng.fieldworkPct, 75) : eng.fieldworkPct,
          activityLog: [
            {
              id: `act-${Date.now()}`,
              timestamp: '4 Oct 2026, 14:10',
              actor: currentUser.name,
              action: `Engagement lifecycle advanced to Stage 0${nextStage}`,
            },
            ...eng.activityLog,
          ],
        };
      })
    );
  };

  const handleApproveWorkingNote = (
    engagementId: string,
    noteId: string,
    newStatus: WorkingNote['status'],
    comment?: string
  ) => {
    setEngagements((prev) =>
      prev.map((eng) => {
        if (eng.id !== engagementId) return eng;
        const updatedNotes = eng.workingNotes.map((wn) =>
          wn.id === noteId
            ? {
                ...wn,
                status: newStatus,
                updatedAt: '4 Oct 2026, 14:15',
                reviewerComments: comment || wn.reviewerComments,
              }
            : wn
        );
        const noteObj = eng.workingNotes.find((w) => w.id === noteId);
        return {
          ...eng,
          fieldworkPct: Math.min(100, eng.fieldworkPct + 12),
          workingNotes: updatedNotes,
          activityLog: [
            {
              id: `act-${Date.now()}`,
              timestamp: '4 Oct 2026, 14:15',
              actor: currentUser.name,
              action: `${noteObj?.ref || 'Working note'} marked as ${newStatus}`,
              detail: comment ? `Reviewer note: ${comment}` : undefined,
            },
            ...eng.activityLog,
          ],
        };
      })
    );
  };

  const handleCompleteActivity = (engagementId: string, activityId: string) => {
    setEngagements((prev) =>
      prev.map((eng) => {
        if (eng.id !== engagementId) return eng;
        const actObj = eng.timelineActivities.find((a) => a.id === activityId);
        return {
          ...eng,
          timelineActivities: eng.timelineActivities.map((a) =>
            a.id === activityId
              ? { ...a, status: 'Completed', completedDate: '4 Oct 2026' }
              : a
          ),
          activityLog: [
            {
              id: `act-${Date.now()}`,
              timestamp: '4 Oct 2026, 14:18',
              actor: currentUser.name,
              action: `Timeline activity completed: ${actObj?.name || ''}`,
            },
            ...eng.activityLog,
          ],
        };
      })
    );
  };

  const handleAddWorkingNote = (
    engagementId: string,
    title: string,
    controlArea: string,
    procedure: string,
    hasException: boolean
  ) => {
    setEngagements((prev) =>
      prev.map((eng) => {
        if (eng.id !== engagementId) return eng;
        const nextNum = eng.workingNotes.length + 1;
        const ref = `WN-00${nextNum}`;
        const newNote: WorkingNote = {
          id: `wn-${Date.now()}`,
          ref,
          title,
          controlArea,
          author: currentUser.name,
          status: 'For head review',
          hasException,
          updatedAt: '4 Oct 2026, 14:20',
          testingProcedure: procedure,
          conclusion: hasException
            ? 'Exception noted during sample walk-through.'
            : 'Controls operating effectively without exception.',
        };
        return {
          ...eng,
          workingNotes: [...eng.workingNotes, newNote],
          activityLog: [
            {
              id: `act-${Date.now()}`,
              timestamp: '4 Oct 2026, 14:20',
              actor: currentUser.name,
              action: `${ref} (${title}) created and submitted for review`,
            },
            ...eng.activityLog,
          ],
        };
      })
    );
  };

  const handleValidateAndCloseFinding = (engagementId: string, findingId: string) => {
    setEngagements((prev) =>
      prev.map((eng) => {
        if (eng.id !== engagementId) return eng;
        const fnd = eng.findings.find((f) => f.id === findingId);
        return {
          ...eng,
          findings: eng.findings.map((f) =>
            f.id === findingId ? { ...f, status: 'Validated & Closed' } : f
          ),
          activityLog: [
            {
              id: `act-${Date.now()}`,
              timestamp: '4 Oct 2026, 14:25',
              actor: currentUser.name,
              action: `Finding ${fnd?.ref || ''} evidence validated & closed`,
            },
            ...eng.activityLog,
          ],
        };
      })
    );
    setActiveLifecycleStage(6);
  };

  const handleAddFinding = (engagementId: string, finding: AuditFinding) => {
    setEngagements((prev) =>
      prev.map((eng) => {
        if (eng.id !== engagementId) return eng;
        return {
          ...eng,
          findings: [...eng.findings, finding],
          activityLog: [
            {
              id: `act-${Date.now()}`,
              timestamp: '4 Oct 2026, 14:28',
              actor: currentUser.name,
              action: `Finding ${finding.ref} (${finding.title}) drafted`,
              detail: `Severity: ${finding.severity} · Linked to ${finding.linkedNoteRef}`,
            },
            ...eng.activityLog,
          ],
        };
      })
    );
  };

  const handleUpdateFindingStatus = (
    engagementId: string,
    findingId: string,
    newStatus: AuditFinding['status'],
    owner?: string,
    targetDate?: string
  ) => {
    setEngagements((prev) =>
      prev.map((eng) => {
        if (eng.id !== engagementId) return eng;
        const target = eng.findings.find((f) => f.id === findingId);
        return {
          ...eng,
          findings: eng.findings.map((f) =>
            f.id === findingId
              ? {
                  ...f,
                  status: newStatus,
                  owner: owner || f.owner,
                  targetDate: targetDate || f.targetDate,
                }
              : f
          ),
          activityLog: [
            {
              id: `act-${Date.now()}`,
              timestamp: '4 Oct 2026, 14:30',
              actor: currentUser.name,
              action: `${target?.ref || 'Finding'} action plan updated (${newStatus})`,
              detail: owner && targetDate ? `Owner: ${owner} · Due ${targetDate}` : undefined,
            },
            ...eng.activityLog,
          ],
        };
      })
    );
  };

  const handleUploadFile = (engagementId: string, file: AuditFile) => {
    setEngagements((prev) =>
      prev.map((eng) => {
        if (eng.id !== engagementId) return eng;
        return {
          ...eng,
          files: [file, ...eng.files],
          activityLog: [
            {
              id: `act-${Date.now()}`,
              timestamp: file.uploadedAt,
              actor: currentUser.name,
              action: 'File uploaded',
              detail: `${file.folder} / ${file.name} (${file.size})`,
            },
            ...eng.activityLog,
          ],
        };
      })
    );
  };

  const handleUpdateReport = (
    engagementId: string,
    newStatus: AuditEngagement['reportStatus'],
    executiveSummary: string
  ) => {
    setEngagements((prev) =>
      prev.map((eng) => {
        if (eng.id !== engagementId) return eng;
        return {
          ...eng,
          reportStatus: newStatus,
          executiveSummary,
          activityLog: [
            {
              id: `act-${Date.now()}`,
              timestamp: '4 Oct 2026, 14:32',
              actor: currentUser.name,
              action: `${eng.reportRef} Report status updated to ${newStatus}`,
            },
            ...eng.activityLog,
          ],
        };
      })
    );
  };

  const handleAutoAssignLeads = () => {
    const leads = ['A. Villanueva', 'P. Mendoza', 'J. Reyes', 'K. Lim', 'B. Tolentino'];
    setEngagements((prev) =>
      prev.map((eng, idx) =>
        eng.status === 'Planned'
          ? { ...eng, lead: leads[idx % leads.length] }
          : eng
      )
    );
  };

  const handleDraftFromUniverse = () => {
    const exists = engagements.some((e) => e.ref === 'AUD-2026-011');
    if (exists) return;
    const drafted: AuditEngagement = {
      id: `aud-${Date.now()}`,
      ref: 'AUD-2026-011',
      year: 2026,
      title: 'Fixed Assets & Head Office Procurement Audit',
      category: 'Operations',
      department: 'Administrative Services',
      entityName: 'Fixed assets & Head Office procurement',
      likelihood: 3,
      impact: 4,
      riskScore: 12,
      riskLevel: 'High',
      lead: 'K. Lim',
      headReviewer: 'M. Santos',
      independentReviewer: 'A. Villanueva',
      startDate: '23 Nov',
      endDate: '29 Dec 2026',
      durationDays: 25,
      budgetedHours: 200,
      status: 'Planned',
      readyRatio: '1/9 ready',
      lifecycleStage: 1,
      fieldworkPct: 0,
      fieldworkDayCurrent: 0,
      fieldworkDayTotal: 25,
      reportStatus: 'Draft',
      reportRef: 'IA-2026-011-RPT',
      executiveSummary: 'Drafted automatically from the Audit Universe based on risk cycle.',
      workingNotes: [],
      findings: [],
      timelineActivities: [],
      files: [],
      activityLog: [],
    };
    setEngagements((prev) => [...prev, drafted]);
  };

  return (
    <div className="min-h-screen bg-[#E8E2F4] text-slate-900 pb-16">
      <HeaderAndLifecycle
        activeTab={activeTab}
        onSelectTab={handleSelectTab}
        activeLifecycleStage={activeLifecycleStage}
        maxCompletedStage={
          selectedEngagement
            ? Math.max(selectedEngagement.lifecycleStage - 1, activeLifecycleStage - 1)
            : activeLifecycleStage - 1
        }
        onSelectLifecycleStage={handleSelectLifecycleStage}
        currentUser={currentUser}
        onChangeUser={setCurrentUser}
        accessActive={accessActive}
        onToggleAccess={() => setAccessActive((prev) => !prev)}
        selectedEngagement={activeTab === 'fieldwork' ? selectedEngagement : null}
        onAdvanceEngagementStage={handleAdvanceEngagementStage}
      />

      <main className="w-full max-w-[1220px] mx-auto px-4 sm:px-6 mt-2">
        {activeTab === 'overview' && (
          <OverviewView
            engagements={engagements}
            onSelectLifecycleStage={handleSelectLifecycleStage}
            onOpenEngagement={handleSelectEngagement}
            onSelectTab={handleSelectTab}
          />
        )}

        {activeTab === 'universe' && (
          <AuditUniverseView
            universe={universe}
            frequencies={frequencies}
            isReauditMode={activeLifecycleStage === 7}
          />
        )}

        {activeTab === 'annual-plan' && (
          <AnnualPlanView
            engagements={engagements}
            universe={universe}
            onSelectEngagement={handleSelectEngagement}
            onAddEngagement={(newEng) =>
              setEngagements((prev) => [newEng, ...prev])
            }
            onAutoAssignLeads={handleAutoAssignLeads}
            onDraftFromUniverse={handleDraftFromUniverse}
          />
        )}

        {activeTab === 'timeline' && (
          <TimelineView
            engagements={engagements}
            onOpenEngagement={handleSelectEngagement}
          />
        )}

        {activeTab === 'fieldwork' && (
          <FieldworkView
            engagements={engagements}
            selectedEngagement={selectedEngagement}
            onSelectEngagement={handleSelectEngagement}
            activeSubTab={activeSubTab}
            onSelectSubTab={handleSelectSubTab}
            currentUser={currentUser}
            onChangeUser={setCurrentUser}
            accessActive={accessActive}
            onApproveWorkingNote={handleApproveWorkingNote}
            onCompleteActivity={handleCompleteActivity}
            onAddWorkingNote={handleAddWorkingNote}
            onAddFinding={handleAddFinding}
            onUpdateFindingStatus={handleUpdateFindingStatus}
            onUploadFile={handleUploadFile}
            onUpdateReport={handleUpdateReport}
            onAdvanceEngagementStage={handleAdvanceEngagementStage}
          />
        )}

        {activeTab === 'issues' && (
          <IssuesView
            engagements={engagements}
            activeLifecycleStage={activeLifecycleStage}
            onValidateAndCloseFinding={handleValidateAndCloseFinding}
          />
        )}

        {activeTab === 'settings' && (
          <SettingsView
            frequencies={frequencies}
            onSaveFrequencies={setFrequencies}
          />
        )}

        {(activeTab === 'master-data' ||
          activeTab === 'setup' ||
          activeTab === 'access') && (
          <MasterDataSetupAccessView
            tab={activeTab}
            currentUser={currentUser}
            onChangeUser={setCurrentUser}
            accessActive={accessActive}
            onToggleAccess={() => setAccessActive((prev) => !prev)}
            onSelectTab={handleSelectTab}
          />
        )}
      </main>
    </div>
  );
}
