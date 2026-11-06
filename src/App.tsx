import React, { useState, useEffect } from 'react';
import {
  AuditEngagement,
  AuditFile,
  AuditFinding,
  EngagementSubTabId,
  FULL_UNIVERSE_RECORDS,
  IssueRegisterItem,
  LifecycleStageId,
  MainTabId,
  UniverseEntity,
  UserProfile,
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
import { LoginPage, ForcePasswordChange } from './components/LoginPage';
import { AdminUserManagement } from './components/AdminUserManagement';
import {
  AuthSession,
  loadSession,
  logout,
  seedDefaultAdmin,
} from './utils/authStore';
import {
  fetchEngagements,
  fetchIssues,
  fetchUniverse,
  fetchUserProfiles,
  fetchFrequencies,
  upsertEngagement,
  upsertIssue,
  upsertWorkingNote,
  upsertFinding,
  upsertTimelineActivity,
  insertFile,
  insertActivityLog,
  saveFrequencies,
  AuditFrequencies,
} from './utils/db';

// Fallback profile used when user_profiles table is empty (fresh database)
const FALLBACK_USER: UserProfile = {
  id: 'system',
  name: 'System User',
  roleTitle: 'Internal Auditor',
  fullLabel: 'System User – Internal Auditor',
  headerSubtitle: 'Internal Auditor',
  department: 'Internal Audit',
  canApproveHead: false,
  canApproveIndependent: false,
  canApproveCAE: false,
  accountStatus: 'Active',
  failedLoginCount: 0,
  isLocked: false,
  requiresPasswordChange: false,
  passwordHistory: [],
  mfaEnabled: false,
  isPrivileged: false,
};

export default function App() {
  // ── Auth state ────────────────────────────────────────────────────────────
  const [authSession, setAuthSession] = useState<AuthSession | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [showAdminPanel, setShowAdminPanel] = useState(false);

  // Seed the default admin account (idempotent) and restore any existing session
  useEffect(() => {
    seedDefaultAdmin().then(() => {
      const existing = loadSession();
      setAuthSession(existing);
      setAuthReady(true);
    });
  }, []);

  const handleLoginSuccess = (session: AuthSession) => {
    setAuthSession(session);
  };

  const handleLogout = () => {
    logout();
    setAuthSession(null);
    setShowAdminPanel(false);
  };

  const handlePasswordChanged = (updatedSession: AuthSession) => {
    setAuthSession(updatedSession);
  };

  // ── Audit app state ───────────────────────────────────────────────────────
  const [engagements, setEngagements] = useState<AuditEngagement[]>([]);
  const [issues, setIssues] = useState<IssueRegisterItem[]>([]);
  const [universe, setUniverse] = useState<UniverseEntity[]>([]);
  const [userProfiles, setUserProfiles] = useState<UserProfile[]>([]);
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(null);
  const [accessActive, setAccessActive] = useState<boolean>(false);
  const [dataLoading, setDataLoading] = useState(true);

  const [frequencies, setFrequenciesState] = useState<AuditFrequencies>({
    critical: 6,
    high: 12,
    medium: 24,
    low: 36,
  });

  // Load all data from Supabase once authenticated
  useEffect(() => {
    if (!authSession) return;
    setDataLoading(true);
    Promise.all([
      fetchEngagements(),
      fetchIssues(),
      fetchUniverse(),
      fetchUserProfiles(),
      fetchFrequencies(),
    ]).then(([engs, iss, uni, profiles, freq]) => {
      setEngagements(engs);
      setIssues(iss);
      setUniverse(uni);
      setUserProfiles(profiles);
      setCurrentUser(profiles[0] ?? FALLBACK_USER);
      setFrequenciesState(freq);
    }).catch((err) => {
      console.error('Failed to load data from Supabase:', err);
    }).finally(() => {
      setDataLoading(false);
    });
  }, [authSession]);

  const handleUpdateIssue = (issue: IssueRegisterItem) => {
    setIssues((prev) => prev.map((i) => i.id === issue.id ? issue : i));
    upsertIssue(issue);
  };

  // Navigation & Lifecycle Progress State
  const [activeTab, setActiveTab] = useState<MainTabId>('overview');
  const [activeLifecycleStage, setActiveLifecycleStage] = useState<LifecycleStageId>(1);
  const [selectedEngagementId, setSelectedEngagementId] = useState<string | null>(null);
  const [activeSubTab, setActiveSubTab] = useState<EngagementSubTabId>('dashboard');

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
        setActiveLifecycleStage(1);
        break;
    }
  };

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
        const logEntry = {
          id: `act-${Date.now()}`,
          timestamp: '4 Oct 2026, 14:10',
          actor: currentUser?.name ?? '',
          action: `Engagement lifecycle advanced to Stage 0${nextStage}`,
        };
        const updated: AuditEngagement = {
          ...eng,
          lifecycleStage: nextStage,
          status: nextStatus,
          fieldworkPct: nextStage >= 3 ? Math.max(eng.fieldworkPct, 75) : eng.fieldworkPct,
          activityLog: [logEntry, ...eng.activityLog],
        };
        upsertEngagement(updated);
        insertActivityLog(eng.id, logEntry);
        return updated;
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
        const updatedNote = updatedNotes.find((w) => w.id === noteId);
        if (updatedNote) upsertWorkingNote(engagementId, updatedNote);

        const logEntry = {
          id: `act-${Date.now()}`,
          timestamp: '4 Oct 2026, 14:15',
          actor: currentUser?.name ?? '',
          action: `${noteObj?.ref || 'Working note'} marked as ${newStatus}`,
          detail: comment ? `Reviewer note: ${comment}` : undefined,
        };
        const updated: AuditEngagement = {
          ...eng,
          fieldworkPct: Math.min(100, eng.fieldworkPct + 12),
          workingNotes: updatedNotes,
          activityLog: [logEntry, ...eng.activityLog],
        };
        upsertEngagement(updated);
        insertActivityLog(engagementId, logEntry);
        return updated;
      })
    );
  };

  const handleCompleteActivity = (engagementId: string, activityId: string) => {
    setEngagements((prev) =>
      prev.map((eng) => {
        if (eng.id !== engagementId) return eng;
        const actObj = eng.timelineActivities.find((a) => a.id === activityId);
        const updatedActivities = eng.timelineActivities.map((a) =>
          a.id === activityId
            ? { ...a, status: 'Completed' as const, completedDate: '4 Oct 2026' }
            : a
        );
        const updatedActivity = updatedActivities.find((a) => a.id === activityId);
        if (updatedActivity) upsertTimelineActivity(engagementId, updatedActivity);

        const logEntry = {
          id: `act-${Date.now()}`,
          timestamp: '4 Oct 2026, 14:18',
          actor: currentUser?.name ?? '',
          action: `Timeline activity completed: ${actObj?.name || ''}`,
        };
        const updated: AuditEngagement = {
          ...eng,
          timelineActivities: updatedActivities,
          activityLog: [logEntry, ...eng.activityLog],
        };
        upsertEngagement(updated);
        insertActivityLog(engagementId, logEntry);
        return updated;
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
          author: currentUser?.name ?? '',
          status: 'For head review',
          hasException,
          updatedAt: '4 Oct 2026, 14:20',
          testingProcedure: procedure,
          conclusion: hasException
            ? 'Exception noted during sample walk-through.'
            : 'Controls operating effectively without exception.',
        };
        upsertWorkingNote(engagementId, newNote);

        const logEntry = {
          id: `act-${Date.now()}`,
          timestamp: '4 Oct 2026, 14:20',
          actor: currentUser?.name ?? '',
          action: `${ref} (${title}) created and submitted for review`,
        };
        const updated: AuditEngagement = {
          ...eng,
          workingNotes: [...eng.workingNotes, newNote],
          activityLog: [logEntry, ...eng.activityLog],
        };
        upsertEngagement(updated);
        insertActivityLog(engagementId, logEntry);
        return updated;
      })
    );
  };

  const handleValidateAndCloseFinding = (engagementId: string, findingId: string) => {
    setEngagements((prev) =>
      prev.map((eng) => {
        if (eng.id !== engagementId) return eng;
        const fnd = eng.findings.find((f) => f.id === findingId);
        const updatedFindings = eng.findings.map((f) =>
          f.id === findingId ? { ...f, status: 'Validated & Closed' as const } : f
        );
        const updatedFinding = updatedFindings.find((f) => f.id === findingId);
        if (updatedFinding) upsertFinding(engagementId, updatedFinding);

        const logEntry = {
          id: `act-${Date.now()}`,
          timestamp: '4 Oct 2026, 14:25',
          actor: currentUser?.name ?? '',
          action: `Finding ${fnd?.ref || ''} evidence validated & closed`,
        };
        const updated: AuditEngagement = {
          ...eng,
          findings: updatedFindings,
          activityLog: [logEntry, ...eng.activityLog],
        };
        upsertEngagement(updated);
        insertActivityLog(engagementId, logEntry);
        return updated;
      })
    );
    setActiveLifecycleStage(6);
  };

  const handleAddFinding = (engagementId: string, finding: AuditFinding) => {
    setEngagements((prev) =>
      prev.map((eng) => {
        if (eng.id !== engagementId) return eng;
        upsertFinding(engagementId, finding);
        const logEntry = {
          id: `act-${Date.now()}`,
          timestamp: '4 Oct 2026, 14:28',
          actor: currentUser?.name ?? '',
          action: `Finding ${finding.ref} (${finding.title}) drafted`,
          detail: `Severity: ${finding.severity} · Linked to ${finding.linkedNoteRef}`,
        };
        const updated: AuditEngagement = {
          ...eng,
          findings: [...eng.findings, finding],
          activityLog: [logEntry, ...eng.activityLog],
        };
        upsertEngagement(updated);
        insertActivityLog(engagementId, logEntry);
        return updated;
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
        const updatedFindings = eng.findings.map((f) =>
          f.id === findingId
            ? {
                ...f,
                status: newStatus,
                owner: owner || f.owner,
                targetDate: targetDate || f.targetDate,
              }
            : f
        );
        const updatedFinding = updatedFindings.find((f) => f.id === findingId);
        if (updatedFinding) upsertFinding(engagementId, updatedFinding);

        const logEntry = {
          id: `act-${Date.now()}`,
          timestamp: '4 Oct 2026, 14:30',
          actor: currentUser?.name ?? '',
          action: `${target?.ref || 'Finding'} action plan updated (${newStatus})`,
          detail: owner && targetDate ? `Owner: ${owner} · Due ${targetDate}` : undefined,
        };
        const updated: AuditEngagement = {
          ...eng,
          findings: updatedFindings,
          activityLog: [logEntry, ...eng.activityLog],
        };
        upsertEngagement(updated);
        insertActivityLog(engagementId, logEntry);
        return updated;
      })
    );
  };

  const handleUploadFile = (engagementId: string, file: AuditFile) => {
    setEngagements((prev) =>
      prev.map((eng) => {
        if (eng.id !== engagementId) return eng;
        insertFile(engagementId, file);
        const logEntry = {
          id: `act-${Date.now()}`,
          timestamp: file.uploadedAt,
          actor: currentUser?.name ?? '',
          action: 'File uploaded',
          detail: `${file.folder} / ${file.name} (${file.size})`,
        };
        const updated: AuditEngagement = {
          ...eng,
          files: [file, ...eng.files],
          activityLog: [logEntry, ...eng.activityLog],
        };
        upsertEngagement(updated);
        insertActivityLog(engagementId, logEntry);
        return updated;
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
        const logEntry = {
          id: `act-${Date.now()}`,
          timestamp: '4 Oct 2026, 14:32',
          actor: currentUser?.name ?? '',
          action: `${eng.reportRef} Report status updated to ${newStatus}`,
        };
        const updated: AuditEngagement = {
          ...eng,
          reportStatus: newStatus,
          executiveSummary,
          activityLog: [logEntry, ...eng.activityLog],
        };
        upsertEngagement(updated);
        insertActivityLog(engagementId, logEntry);
        return updated;
      })
    );
  };

  const handleAutoAssignLeads = () => {
    const leads = ['A. Villanueva', 'P. Mendoza', 'J. Reyes', 'K. Lim', 'B. Tolentino'];
    setEngagements((prev) =>
      prev.map((eng, idx) => {
        if (eng.status !== 'Planned') return eng;
        const updated = { ...eng, lead: leads[idx % leads.length] };
        upsertEngagement(updated);
        return updated;
      })
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
    upsertEngagement(drafted);
    setEngagements((prev) => [...prev, drafted]);
  };

  const handleSaveFrequencies = (freq: { critical: number; high: number; medium: number; low: number }) => {
    setFrequenciesState(freq);
    saveFrequencies(freq);
  };

  // ── Auth gates ────────────────────────────────────────────────────────────

  if (!authReady) {
    return (
      <div className="min-h-screen bg-[#E8E2F4] flex items-center justify-center">
        <div className="text-slate-500 text-sm animate-pulse">Loading…</div>
      </div>
    );
  }

  if (!authSession) {
    return <LoginPage onLoginSuccess={handleLoginSuccess} />;
  }

  if (authSession.requiresPasswordChange) {
    return (
      <ForcePasswordChange
        session={authSession}
        onChanged={handlePasswordChanged}
        onLogout={handleLogout}
      />
    );
  }

  if (dataLoading) {
    return (
      <div className="min-h-screen bg-[#E8E2F4] flex items-center justify-center">
        <div className="text-slate-500 text-sm animate-pulse">Loading data…</div>
      </div>
    );
  }

  // ── Authenticated app ─────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-[#E8E2F4] text-slate-900 pb-16">
      {/* Admin user management modal */}
      {showAdminPanel && authSession.role === 'admin' && (
        <AdminUserManagement
          session={authSession}
          onClose={() => setShowAdminPanel(false)}
        />
      )}

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
        currentUser={currentUser ?? FALLBACK_USER}
        onChangeUser={setCurrentUser}
        userProfiles={userProfiles}
        accessActive={accessActive}
        onToggleAccess={() => setAccessActive((prev) => !prev)}
        selectedEngagement={activeTab === 'fieldwork' ? selectedEngagement : null}
        onAdvanceEngagementStage={handleAdvanceEngagementStage}
        authSession={authSession}
        onLogout={handleLogout}
        onOpenAdminPanel={() => setShowAdminPanel(true)}
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
            universeRecords={FULL_UNIVERSE_RECORDS}
            frequencies={frequencies}
            isReauditMode={activeLifecycleStage === 7}
          />
        )}

        {activeTab === 'annual-plan' && (
          <AnnualPlanView
            engagements={engagements}
            universe={universe}
            userProfiles={userProfiles}
            onSelectEngagement={handleSelectEngagement}
            onAddEngagement={(newEng) => {
              upsertEngagement(newEng);
              setEngagements((prev) => [newEng, ...prev]);
            }}
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
            currentUser={currentUser ?? FALLBACK_USER}
            onChangeUser={setCurrentUser}
            userProfiles={userProfiles}
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
            issues={issues}
            onUpdateIssue={handleUpdateIssue}
            activeLifecycleStage={activeLifecycleStage}
            onValidateAndCloseFinding={handleValidateAndCloseFinding}
          />
        )}

        {activeTab === 'settings' && (
          <SettingsView
            frequencies={frequencies}
            onSaveFrequencies={handleSaveFrequencies}
          />
        )}

        {(activeTab === 'master-data' ||
          activeTab === 'setup' ||
          activeTab === 'access') && (
          <MasterDataSetupAccessView
            tab={activeTab}
            currentUser={currentUser ?? FALLBACK_USER}
            onChangeUser={setCurrentUser}
            userProfiles={userProfiles}
            accessActive={accessActive}
            onToggleAccess={() => setAccessActive((prev) => !prev)}
            onSelectTab={handleSelectTab}
          />
        )}
      </main>
    </div>
  );
}
