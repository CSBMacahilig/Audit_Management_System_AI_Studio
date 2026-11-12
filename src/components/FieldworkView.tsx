import React, { useEffect, useState } from 'react';
import {
  AuditEngagement,
  AuditFile,
  AuditFinding,
  EngagementSubTabId,
  LifecycleStageId,
  UserProfile,
  WorkingNote,
} from '../data/auditData';
import {
  checkWorkingNoteReviewPermission,
  sanitizeMultiline,
  sanitizeText,
  validateFileUpload,
} from '../utils/security';
import { fetchMasterData } from '../utils/db';
import { formatDateForDisplay, toDateInputValue } from '../utils/date';

const DEFAULT_FINDING_SEVERITIES = ['Critical', 'High', 'Medium', 'Low'];

interface FieldworkViewProps {
  engagements: AuditEngagement[];
  selectedEngagement: AuditEngagement | null;
  onSelectEngagement: (engagement: AuditEngagement | null) => void;
  activeSubTab: EngagementSubTabId;
  onSelectSubTab: (subTab: EngagementSubTabId) => void;
  currentUser: UserProfile;
  onChangeUser: (user: UserProfile) => void;
  userProfiles: UserProfile[];
  accessActive?: boolean;
  onApproveWorkingNote: (
    engagementId: string,
    noteId: string,
    newStatus: WorkingNote['status'],
    comment?: string
  ) => void;
  onCompleteActivity: (engagementId: string, activityId: string) => void;
  onAddWorkingNote: (
    engagementId: string,
    title: string,
    controlArea: string,
    procedure: string,
    hasException: boolean
  ) => void;
  onAddFinding?: (engagementId: string, finding: AuditFinding) => void;
  onUpdateFindingStatus?: (
    engagementId: string,
    findingId: string,
    newStatus: AuditFinding['status'],
    owner?: string,
    targetDate?: string
  ) => void;
  onUploadFile?: (engagementId: string, file: AuditFile) => void;
  onUpdateReport?: (
    engagementId: string,
    newStatus: AuditEngagement['reportStatus'],
    executiveSummary: string
  ) => void;
  onAdvanceEngagementStage?: (stageId: LifecycleStageId) => void;
}

interface AuditeeInquiry {
  id: string;
  ref: string;
  subject: string;
  assignedTo: string;
  dueDate: string;
  status: 'Pending auditee' | 'Responded' | 'Verified by IA';
  responseSummary?: string;
}

export const FieldworkView: React.FC<FieldworkViewProps> = ({
  engagements,
  selectedEngagement,
  onSelectEngagement,
  activeSubTab,
  onSelectSubTab,
  currentUser,
  onChangeUser,
  userProfiles,
  accessActive = false,
  onApproveWorkingNote,
  onCompleteActivity,
  onAddWorkingNote,
  onAddFinding,
  onUpdateFindingStatus,
  onUploadFile,
  onUpdateReport,
  onAdvanceEngagementStage,
}) => {
  const [selectedNoteModal, setSelectedNoteModal] = useState<WorkingNote | null>(null);
  const [reviewComment, setReviewComment] = useState('');
  const [securityBanner, setSecurityBanner] = useState<string | null>(null);
  const [actionToast, setActionToast] = useState<string | null>(null);
  const [showCockpitModal, setShowCockpitModal] = useState(false);

  // Working notes sub-tab state
  const [showNewNoteModal, setShowNewNoteModal] = useState(false);
  const [noteFilter, setNoteFilter] = useState<string>('All');
  const [noteTitle, setNoteTitle] = useState('');
  const [noteArea, setNoteArea] = useState('');
  const [noteProc, setNoteProc] = useState('');
  const [noteEx, setNoteEx] = useState(false);

  // Findings sub-tab state
  const [showNewFindingModal, setShowNewFindingModal] = useState(false);
  const [fndTitle, setFndTitle] = useState('');
  const [fndSeverity, setFndSeverity] = useState('High');
  const [findingSeverities, setFindingSeverities] = useState(DEFAULT_FINDING_SEVERITIES);
  const [fndCondition, setFndCondition] = useState('');
  const [fndCriteria, setFndCriteria] = useState('');
  const [fndCause, setFndCause] = useState('');
  const [fndEffect, setFndEffect] = useState('');
  const [fndRecommendation, setFndRecommendation] = useState('');
  const [fndOwner, setFndOwner] = useState('E. Navarro (IT)');
  const [fndTargetDate, setFndTargetDate] = useState('2026-11-30');
  const [fndLinkedNote, setFndLinkedNote] = useState('WN-002');

  useEffect(() => {
    fetchMasterData('finding_severities', DEFAULT_FINDING_SEVERITIES).then((severities) => {
      if (severities.length > 0) {
        setFindingSeverities(severities);
        setFndSeverity((current) => severities.includes(current) ? current : severities[0]);
      }
    });
  }, []);

  // Auditee sub-tab state (Inquiries & PBC requests + Action plan editing)
  const [inquiries, setInquiries] = useState<AuditeeInquiry[]>([
    {
      id: 'inq-1',
      ref: 'PBC-01',
      subject: 'API Gateway WAF rate-limiting policy export & August migration change ticket',
      assignedTo: 'E. Navarro (IT)',
      dueDate: '20 Sept 2026',
      status: 'Verified by IA',
      responseSummary: 'Provided Cloudflare/Kong gateway YAML config and CR-2026-0814 log.',
    },
    {
      id: 'inq-2',
      ref: 'PBC-02',
      subject: 'Redis cluster session revocation architecture & JWT TTL configuration',
      assignedTo: 'E. Navarro (IT)',
      dueDate: '26 Sept 2026',
      status: 'Responded',
      responseSummary: 'Submitted stateless token flow diagram; Redis deny-list patch scheduled in Sprint 42.',
    },
    {
      id: 'inq-3',
      ref: 'PBC-03',
      subject: 'Mobile App v4.2 ProGuard & local crash diagnostic logger configuration',
      assignedTo: 'C. Bautista (Mobile Lead)',
      dueDate: '5 Oct 2026',
      status: 'Pending auditee',
    },
  ]);
  const [newInquirySubject, setNewInquirySubject] = useState('');
  const [newInquiryAssignee, setNewInquiryAssignee] = useState('E. Navarro (IT)');
  const [editingFindingPlan, setEditingFindingPlan] = useState<AuditFinding | null>(null);
  const [planOwnerInput, setPlanOwnerInput] = useState('');
  const [planDateInput, setPlanDateInput] = useState('');
  const [planResponseInput, setPlanResponseInput] = useState('');

  // Files sub-tab state
  const [folderFilter, setFolderFilter] = useState<string>('All folders');
  const [uploadFileName, setUploadFileName] = useState('');
  const [uploadFolder, setUploadFolder] = useState('Working paper evidence');
  const [uploadSizeKB, setUploadSizeKB] = useState(240);

  // Report sub-tab state
  const [execSummaryDraft, setExecSummaryDraft] = useState<string>('');
  const [auditOpinion, setAuditOpinion] = useState<
    'Satisfactory' | 'Needs Improvement' | 'Unsatisfactory'
  >('Needs Improvement');

  // Audit trail sub-tab state
  const [trailSearch, setTrailSearch] = useState('');

  const notify = (msg: string) => {
    setActionToast(msg);
    setTimeout(() => setActionToast(null), 4000);
  };

  // Ongoing audits (Reporting or In progress)
  const ongoingAudits = engagements.filter(
    (e) => e.status === 'Reporting' || e.status === 'In progress'
  );

  // Queue items across all engagements waiting for review matching Audit-Management-System (10).png
  const queueItems = [...engagements]
    .reverse()
    .flatMap((eng) =>
      eng.workingNotes
        .filter((wn) => wn.status === 'For head review' || wn.status === 'Returned')
        .map((wn) => ({
          note: wn,
          engagement: eng,
        }))
    );

  // 1. If no engagement is selected, render Fieldwork Overview (Working as, My queue, Ongoing audits) matching Audit-Management-System (4).png
  if (!selectedEngagement) {
    const ongoingCards = ongoingAudits.map((e) => {
      const critCount = e.findings.filter((f) => f.severity === "Critical").length;
      const highCount = e.findings.filter((f) => f.severity === "High").length;
      const medCount = e.findings.filter((f) => f.severity === "Medium").length;
      const inReviewCount = e.workingNotes.filter(
        (w) => w.status === 'For head review' || w.status === 'For independent review'
      ).length;

      return {
        id: e.id,
        ref: e.ref,
        status: e.status as "Reporting" | "In progress",
        title: e.title,
        meta: `${e.department || e.category} · AIC ${e.lead}`,
        progressType: "bar" as const,
        progressPct: e.fieldworkPct || 0,
        dayText: `Day ${e.fieldworkDayCurrent || 0} of ${e.fieldworkDayTotal || 26}`,
        notes: e.workingNotes.length,
        findings: e.findings.length,
        inReview: inReviewCount,
        files: e.files.length,
        severities: [
          { count: critCount, label: "Critical", color: "bg-[#B93829]" },
          { count: highCount, label: "High", color: "bg-[#D97724]" },
          { count: medCount, label: "Medium", color: "bg-[#C99E2C]" },
        ],
        reportBadge: `Report: ${e.reportStatus || "Draft"}`,
        reportBadgeStyle: e.reportStatus === "Approved by CAE" ? "bg-[#DCEFE2] text-[#1E6339]" : "bg-slate-100 text-slate-700 border border-slate-200",
        reportDotStyle: e.reportStatus === "Approved by CAE" ? "bg-[#1E6339]" : "bg-slate-500",
        engagement: e,
      };
    });

    return (
      <div className="space-y-4">
        {/* Working As Card */}
        <div className="bg-white rounded-lg border border-slate-200/90 shadow-2xs px-6 py-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex-1 max-w-md">
            <label
              htmlFor="working-as-select"
              className="block text-[11.5px] font-semibold text-slate-600 mb-1.5"
            >
              Working as
            </label>
            <select
              id="working-as-select"
              value={currentUser.id}
              onChange={(e) => {
                const found = userProfiles.find((u) => u.id === e.target.value);
                if (found) onChangeUser(found);
              }}
              className="w-full px-3.5 py-2 bg-white border border-slate-300 rounded-md text-[13px] font-medium text-slate-900 focus:outline-none focus:border-[#542D84]"
            >
              {userProfiles.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name} – {u.roleTitle}
                </option>
              ))}
            </select>
          </div>

          <p className="text-xs text-slate-600 md:max-w-md leading-relaxed">
            Your name is recorded on every save, review and upload in the audit trail, and
            decides which review buttons you can use. It&apos;s remembered on this device.
          </p>
        </div>

        {/* My Queue Card matching Audit-Management-System (4).png */}
        <div className="bg-white rounded-lg border border-slate-200/90 shadow-2xs p-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-[18px] font-bold text-slate-900 tracking-tight">
                My queue
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Items waiting for you as reviewer, and your items returned with comments.
              </p>
            </div>
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-[#FBE7D3] text-[#B8500B] tabular-nums">
              <span className="w-1.5 h-1.5 rounded-full bg-[#D97724]" />
              {queueItems.length} items
            </span>
          </div>

          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                  <th className="py-2.5 pr-4">ITEM</th>
                  <th className="py-2.5 px-4">AUDIT</th>
                  <th className="py-2.5 px-4">STATUS</th>
                  <th className="py-2.5 pl-4">UPDATED</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200/80 text-[13px]">
                {queueItems.map(({ note, engagement }) => (
                  <tr
                    key={note.id}
                    onClick={() => {
                      onSelectEngagement(engagement);
                      onSelectSubTab('dashboard');
                      setSelectedNoteModal(note);
                    }}
                    className="hover:bg-purple-50/40 transition-colors cursor-pointer"
                  >
                    <td className="py-3.5 pr-4 font-semibold text-slate-900">
                      <span className="font-mono-tabular">{note.ref}</span> {note.title}
                    </td>
                    <td className="py-3.5 px-4 text-slate-700">
                      <span className="font-mono-tabular">{engagement.ref}</span>{' '}
                      {engagement.title}
                    </td>
                    <td className="py-3.5 px-4">
                      {note.status === 'For independent review' ? (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-[#E4DDF8] text-[#492785]">
                          <span className="w-1.5 h-1.5 rounded-full bg-[#492785]" />
                          For independent review
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-[#DCE8FB] text-[#1D4ED8]">
                          <span className="w-1.5 h-1.5 rounded-full bg-[#1D4ED8]" />
                          {note.status}
                        </span>
                      )}
                    </td>
                    <td className="py-3.5 pl-4 font-mono-tabular text-xs text-slate-700">
                      {note.updatedAt}
                    </td>
                  </tr>
                ))}

                {queueItems.length === 0 && (
                  <tr>
                    <td colSpan={4} className="py-6 text-center text-xs text-slate-500">
                      All review items in your queue have been cleared.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Ongoing Audits Card matching Audit-Management-System (4).png */}
        <div className="bg-white rounded-lg border border-slate-200/90 shadow-2xs p-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h2 className="text-[18px] font-bold text-slate-900 tracking-tight">
                Ongoing audits
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Audits in fieldwork or reporting, and scheduled audits whose notification
                letter is sent and team memo signed.
              </p>
            </div>
            <span className="text-xs text-slate-500 tabular-nums">
              {engagements.filter((e) => e.status === 'Planned').length} other planned audits
            </span>
          </div>

          {ongoingCards.length > 0 ? (
            <div className="mt-5 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {ongoingCards.map((card) => {
                const matchedEng = card.engagement;

                return (
                  <div
                    key={card.ref}
                    onClick={() => {
                      onSelectEngagement(matchedEng);
                      onSelectSubTab('dashboard');
                    }}
                    className="border border-slate-200/90 hover:border-[#542D84]/60 rounded-lg p-4 transition-all cursor-pointer bg-white hover:shadow-xs flex flex-col justify-between"
                  >
                    <div>
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-mono-tabular text-xs font-medium text-slate-600">
                          {card.ref}
                        </span>
                        {card.status === 'Reporting' ? (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-[#FBE7D3] text-[#B8500B]">
                            <span className="w-1.5 h-1.5 rounded-full bg-[#D97724]" />
                            Reporting
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-[#E4DDF8] text-[#492785]">
                            <span className="w-1.5 h-1.5 rounded-full bg-[#492785]" />
                            In progress
                          </span>
                        )}
                      </div>

                      <h3 className="text-[15px] font-bold text-slate-900 mt-2.5 leading-snug">
                        {card.title}
                      </h3>

                      <p className="text-xs text-slate-500 mt-1.5 leading-relaxed">
                        {card.meta}
                      </p>

                      <div className="mt-3">
                        <div className="w-full h-1.5 bg-slate-200 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-[#492785] rounded-full"
                            style={{ width: `${card.progressPct}%` }}
                          />
                        </div>
                        <div className="text-xs text-slate-500 mt-1.5 tabular-nums">
                          {card.dayText}
                        </div>
                      </div>

                      <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-700 tabular-nums">
                        <span>
                          <strong className="font-bold text-slate-900">{card.notes}</strong> notes
                        </span>
                        <span>
                          <strong className="font-bold text-slate-900">{card.findings}</strong> findings
                        </span>
                        <span>
                          <strong className="font-bold text-slate-900">{card.inReview}</strong> in review
                        </span>
                        <span>
                          <strong className="font-bold text-slate-900">{card.files}</strong> files
                        </span>
                      </div>

                      <div className="mt-2.5 flex flex-wrap items-center gap-1.5 text-xs">
                        {card.severities.map((sev, idx) => (
                          <span key={idx} className="inline-flex items-center gap-1">
                            <span
                              className={`inline-flex items-center justify-center px-1.5 py-0.5 rounded text-[11px] font-mono-tabular font-bold text-white ${sev.color}`}
                            >
                              {sev.count}
                            </span>
                            <span className="text-slate-600">{sev.label}</span>
                          </span>
                        ))}
                      </div>

                      <div className="mt-3">
                        <span
                          className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold ${card.reportBadgeStyle}`}
                        >
                          <span className={`w-1.5 h-1.5 rounded-full ${card.reportDotStyle}`} />
                          {card.reportBadge}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="mt-5 py-10 text-center text-xs text-slate-500 bg-slate-50/70 rounded-md border border-dashed border-slate-200">
              No audits currently in fieldwork or reporting. Plan or launch an audit engagement from the Annual Plan to conduct fieldwork.
            </div>
          )}
        </div>
      </div>
    );
  }

  // 2. Selected Engagement Detail View
  const eng = selectedEngagement;
  const completedTimelineCount = eng.timelineActivities.filter(
    (a) => a.status === 'Completed'
  ).length;
  const totalTimelineCount = eng.timelineActivities.length || 9;
  const pastDueActivities = eng.timelineActivities.filter((a) => a.status === 'Past due');
  const notesWithExceptions = eng.workingNotes.filter((n) => n.hasException).length;
  const clearedNotes = eng.workingNotes.filter((n) => n.status === 'Cleared').length;
  const pendingReviewNotes = eng.workingNotes.filter(
    (n) =>
      n.status === 'For head review' ||
      n.status === 'For independent review' ||
      n.status === 'Returned'
  );
  const headReviewCount = eng.workingNotes.filter(
    (n) => n.status === 'For head review'
  ).length;
  const indReviewCount = eng.workingNotes.filter(
    (n) => n.status === 'For independent review'
  ).length;
  const returnedCount = eng.workingNotes.filter((n) => n.status === 'Returned').length;

  const criticalFindings = eng.findings.filter((f) => f.severity === 'Critical').length;
  const highFindings = eng.findings.filter((f) => f.severity === 'High').length;
  const medLowFindings = eng.findings.filter(
    (f) => f.severity === 'Medium' || f.severity === 'Low'
  ).length;

  const SUB_TABS: { id: EngagementSubTabId; label: string; count?: number }[] = [
    { id: 'dashboard', label: 'Dashboard' },
    { id: 'working-notes', label: 'Working notes', count: eng.workingNotes.length },
    { id: 'findings', label: 'Findings', count: eng.findings.length },
    { id: 'review', label: 'Review', count: pendingReviewNotes.length },
    { id: 'auditee', label: 'Auditee', count: eng.findings.length },
    { id: 'files', label: 'Files', count: eng.files.length },
    { id: 'report', label: 'Report' },
    { id: 'audit-trail', label: 'Audit trail' },
  ];

  const handleReviewAction = (
    note: WorkingNote,
    targetStatus: WorkingNote['status'],
    rawComment?: string
  ) => {
    setSecurityBanner(null);
    if (targetStatus === 'Cleared') {
      const check = checkWorkingNoteReviewPermission(
        currentUser,
        note,
        eng,
        accessActive
      );
      if (!check.allowed) {
        setSecurityBanner(check.reason || 'Access denied by Segregation of Duties policy.');
        return;
      }
    }
    const cleanComment = rawComment ? sanitizeMultiline(rawComment, 800) : undefined;
    onApproveWorkingNote(eng.id, note.id, targetStatus, cleanComment);
    notify(`${note.ref} updated to "${targetStatus}" by ${currentUser.name}.`);
  };

  const handleCreateFinding = (e: React.FormEvent) => {
    e.preventDefault();
    const safeTitle = sanitizeText(fndTitle, 180);
    if (!safeTitle) return;
    const nextIdx = eng.findings.length + 1;
    const newFinding: AuditFinding = {
      id: `fnd-${Date.now()}`,
      ref: `${eng.ref.replace('AUD-', 'FND-')}-0${nextIdx}`,
      title: safeTitle,
      severity: fndSeverity,
      condition: sanitizeMultiline(fndCondition, 800) || 'Control exception observed during sample testing.',
      criteria: sanitizeMultiline(fndCriteria, 600) || 'Bank Internal Control Standard & BSP Circular 982.',
      cause: sanitizeMultiline(fndCause, 600) || 'Configuration validation gap during deployment.',
      effect: sanitizeMultiline(fndEffect, 600) || 'Elevated operational or compliance risk exposure.',
      recommendation:
        sanitizeMultiline(fndRecommendation, 800) ||
        'Implement automated validation control and perform retrospective review.',
      owner: sanitizeText(fndOwner, 100) || 'E. Navarro (IT)',
      targetDate: formatDateForDisplay(sanitizeText(fndTargetDate, 40)) || '30 Nov 2026',
      status: 'Open',
      linkedNoteRef: sanitizeText(fndLinkedNote, 20) || 'WN-001',
    };
    onAddFinding?.(eng.id, newFinding);
    setFndTitle('');
    setFndCondition('');
    setFndCriteria('');
    setFndCause('');
    setFndEffect('');
    setFndRecommendation('');
    setShowNewFindingModal(false);
    notify(`Finding ${newFinding.ref} added and linked to ${newFinding.linkedNoteRef}.`);
  };

  const handleUploadNewFile = (e: React.FormEvent) => {
    e.preventDefault();
    const check = validateFileUpload(uploadFileName, uploadSizeKB);
    if (!check.valid) {
      setSecurityBanner(`OWASP File Security Policy: ${check.error}`);
      return;
    }
    setSecurityBanner(null);
    const createdFile: AuditFile = {
      id: `fl-${Date.now()}`,
      name: check.sanitizedName,
      folder: uploadFolder,
      size: `${uploadSizeKB} KB`,
      uploadedBy: currentUser.name,
      uploadedAt: '4 Oct 2026, 14:35',
    };
    onUploadFile?.(eng.id, createdFile);
    setUploadFileName('');
    notify(`Uploaded ${createdFile.name} to folder "${createdFile.folder}".`);
  };

  const filteredNotes = eng.workingNotes.filter((wn) => {
    if (noteFilter === 'All') return true;
    if (noteFilter === 'Exceptions') return wn.hasException;
    return wn.status === noteFilter;
  });

  const filteredFiles = eng.files.filter(
    (f) => folderFilter === 'All folders' || f.folder === folderFilter
  );

  const filteredTrail = eng.activityLog.filter(
    (log) =>
      trailSearch.trim() === '' ||
      log.action.toLowerCase().includes(trailSearch.toLowerCase()) ||
      log.actor.toLowerCase().includes(trailSearch.toLowerCase()) ||
      (log.detail && log.detail.toLowerCase().includes(trailSearch.toLowerCase()))
  );

  return (
    <div className="space-y-3.5">
      {/* Top Breadcrumb Return Row */}
      <div className="flex items-center justify-between text-xs px-1">
        <button
          type="button"
          onClick={() => onSelectEngagement(null)}
          className="font-medium text-slate-700 hover:text-slate-950 flex items-center gap-1 cursor-pointer"
        >
          <span>← Ongoing audits</span>
        </button>

        <div className="text-slate-600">
          Working as <strong className="font-bold text-slate-900">{currentUser.name}</strong>{' '}
          <button
            type="button"
            onClick={() => {
              const idx = userProfiles.findIndex((u) => u.id === currentUser.id);
              const next = userProfiles[(idx + 1) % userProfiles.length];
              onChangeUser(next);
            }}
            className="underline hover:text-slate-900 ml-1 cursor-pointer"
          >
            change
          </button>
        </div>
      </div>

      {securityBanner && (
        <div className="px-4 py-2.5 bg-rose-50 border border-rose-300 rounded-md flex items-center justify-between text-xs text-rose-950">
          <span>
            <strong>Security &amp; SoD Guardrail:</strong> {securityBanner}
          </span>
          <button
            type="button"
            onClick={() => setSecurityBanner(null)}
            className="font-semibold text-rose-800 ml-4 cursor-pointer"
          >
            Dismiss
          </button>
        </div>
      )}

      {actionToast && (
        <div className="px-4 py-2.5 bg-[#E4DDF8] border border-[#542D84]/30 rounded-md flex items-center justify-between text-xs text-[#492785] font-medium">
          <span>{actionToast}</span>
          <button
            type="button"
            onClick={() => setActionToast(null)}
            className="font-bold ml-4 cursor-pointer"
          >
            ✕
          </button>
        </div>
      )}

      {/* Engagement Header Card */}
      <div className="bg-white rounded-lg border border-slate-200/90 shadow-2xs p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="text-[11px] font-semibold tracking-[0.08em] text-slate-500 uppercase font-mono-tabular">
              {eng.ref} · {eng.category.toUpperCase()} · FIELDWORK
            </div>
            <h2 className="text-[22px] font-bold text-slate-900 tracking-tight mt-0.5">
              {eng.title}
            </h2>
          </div>

          <button
            type="button"
            onClick={() => setShowCockpitModal(true)}
            className="px-3.5 py-2 bg-white hover:bg-slate-50 text-slate-800 text-xs font-semibold rounded-md border border-slate-300 transition-colors cursor-pointer"
          >
            Engagement cockpit
          </button>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-x-2.5 gap-y-1.5 text-xs text-slate-600">
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-[#E4DDF8] text-[#492785]">
            <span className="w-1.5 h-1.5 rounded-full bg-[#492785]" />
            {eng.status}
          </span>
          <span>
            {eng.entityName} · {eng.department}
          </span>
          <span>
            AIC <strong className="text-slate-900 font-semibold">{eng.lead}</strong> · Head
            reviewer{' '}
            <strong className="text-slate-900 font-semibold">{eng.headReviewer}</strong> ·
            Independent reviewer{' '}
            <strong className="text-slate-900 font-semibold">
              {eng.independentReviewer}
            </strong>
          </span>
        </div>
      </div>

      {/* Sub-navigation Tabs */}
      <div className="border-b border-slate-300/80 flex items-center gap-1 overflow-x-auto px-1">
        {SUB_TABS.map((st) => {
          const isActive = activeSubTab === st.id;
          return (
            <button
              key={st.id}
              type="button"
              onClick={() => onSelectSubTab(st.id)}
              className={`px-3.5 py-2.5 text-[13px] border-b-2 transition-colors whitespace-nowrap flex items-center gap-1.5 cursor-pointer ${
                isActive
                  ? 'border-slate-900 font-semibold text-slate-900'
                  : 'border-transparent text-slate-600 hover:text-slate-900'
              }`}
            >
              <span>{st.label}</span>
              {typeof st.count === 'number' && (
                <span className="px-1.5 py-0.2 bg-white/90 rounded-full text-[11px] font-mono-tabular font-semibold text-slate-700 border border-slate-300/80">
                  {st.count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* SUB-TAB 1: DASHBOARD */}
      {activeSubTab === 'dashboard' && (
        <div className="space-y-4 pt-1">
          {/* 6 KPI Summary Cards */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3.5">
            {/* 1. FIELDWORK */}
            <div className="bg-white rounded-lg border border-slate-200/90 p-4 shadow-2xs flex flex-col justify-between">
              <div>
                <div className="text-[10.5px] font-semibold uppercase tracking-wider text-slate-500">
                  FIELDWORK
                </div>
                <div className="text-[26px] font-bold text-slate-900 font-mono-tabular leading-tight mt-1">
                  {eng.fieldworkPct}%
                </div>
                <div className="text-xs text-slate-500 mt-1 tabular-nums">
                  Day {eng.fieldworkDayCurrent} of {eng.fieldworkDayTotal}
                </div>
              </div>
              <div className="w-full h-1.5 bg-slate-200 rounded-full overflow-hidden mt-3">
                <div
                  className="h-full bg-slate-600 rounded-full"
                  style={{ width: `${eng.fieldworkPct}%` }}
                />
              </div>
            </div>

            {/* 2. TIMELINE ACTIVITIES */}
            <div
              onClick={() => setShowCockpitModal(true)}
              className="bg-white rounded-lg border border-slate-200/90 hover:border-[#542D84]/50 p-4 shadow-2xs flex flex-col justify-between cursor-pointer"
            >
              <div>
                <div className="text-[10.5px] font-semibold uppercase tracking-wider text-slate-500">
                  TIMELINE ACTIVITIES
                </div>
                <div className="text-[26px] font-bold text-slate-900 font-mono-tabular leading-tight mt-1">
                  {completedTimelineCount}/{totalTimelineCount}
                </div>
              </div>
              <div className="text-xs font-medium text-[#B93829] mt-2 tabular-nums">
                {pastDueActivities.length} past due
              </div>
            </div>

            {/* 3. WORKING NOTES */}
            <div
              onClick={() => onSelectSubTab('working-notes')}
              className="bg-white rounded-lg border border-slate-200/90 hover:border-[#542D84]/50 p-4 shadow-2xs flex flex-col justify-between cursor-pointer"
            >
              <div>
                <div className="text-[10.5px] font-semibold uppercase tracking-wider text-slate-500">
                  WORKING NOTES
                </div>
                <div className="text-[26px] font-bold text-slate-900 font-mono-tabular leading-tight mt-1">
                  {eng.workingNotes.length}
                </div>
              </div>
              <div className="text-xs text-slate-500 mt-2 tabular-nums leading-snug">
                {notesWithExceptions} with exceptions · {clearedNotes} cleared
              </div>
            </div>

            {/* 4. FINDINGS */}
            <div
              onClick={() => onSelectSubTab('findings')}
              className="bg-white rounded-lg border border-slate-200/90 hover:border-[#542D84]/50 p-4 shadow-2xs flex flex-col justify-between cursor-pointer"
            >
              <div>
                <div className="text-[10.5px] font-semibold uppercase tracking-wider text-slate-500">
                  FINDINGS
                </div>
                <div className="text-[26px] font-bold text-slate-900 font-mono-tabular leading-tight mt-1">
                  {eng.findings.length}
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-1.5 text-xs text-slate-600 mt-2 tabular-nums">
                <span className="px-1.5 py-0.5 rounded bg-[#B93829] text-white font-bold text-[11px]">
                  {criticalFindings}
                </span>
                <span>Critical</span>
                <span className="px-1.5 py-0.5 rounded bg-[#D97724] text-white font-bold text-[11px]">
                  {highFindings}
                </span>
                <span>High</span>
                <span className="px-1.5 py-0.5 rounded bg-[#C99E2C] text-white font-bold text-[11px]">
                  {medLowFindings}
                </span>
                <span>—</span>
              </div>
            </div>

            {/* 5. REVIEW QUEUE */}
            <div
              onClick={() => onSelectSubTab('review')}
              className="bg-white rounded-lg border border-slate-200/90 hover:border-[#542D84]/50 p-4 shadow-2xs flex flex-col justify-between cursor-pointer"
            >
              <div>
                <div className="text-[10.5px] font-semibold uppercase tracking-wider text-slate-500">
                  REVIEW QUEUE
                </div>
                <div className="text-[26px] font-bold text-[#B93829] font-mono-tabular leading-tight mt-1">
                  {pendingReviewNotes.length}
                </div>
              </div>
              <div className="text-xs text-slate-500 mt-2 tabular-nums leading-snug">
                {headReviewCount} head · {indReviewCount} independent · {returnedCount} returned
              </div>
            </div>

            {/* 6. FILES */}
            <div
              onClick={() => onSelectSubTab('files')}
              className="bg-white rounded-lg border border-slate-200/90 hover:border-[#542D84]/50 p-4 shadow-2xs flex flex-col justify-between cursor-pointer"
            >
              <div>
                <div className="text-[10.5px] font-semibold uppercase tracking-wider text-slate-500">
                  FILES
                </div>
                <div className="text-[26px] font-bold text-slate-900 font-mono-tabular leading-tight mt-1">
                  {eng.files.length}
                </div>
              </div>
              <div className="text-xs text-slate-500 mt-2 tabular-nums">
                2 folders in use
              </div>
            </div>
          </div>

          {/* Needs Attention & Recent Activity Panels */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
            {/* Left Panel: Needs attention (5 cols) */}
            <div className="lg:col-span-5 bg-white rounded-lg border border-slate-200/90 shadow-2xs p-6">
              <h3 className="text-[16px] font-bold text-slate-900">Needs attention</h3>

              <div className="mt-4 divide-y divide-slate-200/80">
                {pendingReviewNotes.map((wn) => (
                  <div
                    key={wn.id}
                    className="py-3.5 first:pt-0 flex items-center justify-between gap-3"
                  >
                    <div>
                      <div className="text-[13px] font-medium text-slate-900">
                        <span className="font-mono-tabular">{wn.ref}</span> {wn.title}
                      </div>
                      <div className="text-xs text-slate-500 mt-0.5">
                        {wn.status === 'For head review'
                          ? `Waiting for head review (${eng.headReviewer})`
                          : 'Waiting for independent review (reviewer to be assigned)'}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setSelectedNoteModal(wn)}
                      className="px-3 py-1.5 bg-white hover:bg-slate-50 text-slate-800 text-xs font-semibold rounded border border-slate-300 transition-colors cursor-pointer shrink-0"
                    >
                      Open
                    </button>
                  </div>
                ))}

                {pendingReviewNotes.length === 0 && (
                  <div className="py-3 text-xs text-slate-500">
                    All working notes have been reviewed and cleared.
                  </div>
                )}
              </div>

              {/* Past-due activities sub-section */}
              <div className="mt-5 pt-4 border-t border-slate-200">
                <h4 className="text-xs font-bold text-slate-900">Past-due activities</h4>
                <div className="mt-3 divide-y divide-slate-200/80">
                  {pastDueActivities.map((act) => (
                    <div
                      key={act.id}
                      className="py-3 first:pt-0 flex items-center justify-between gap-2"
                    >
                      <div>
                        <div className="text-[13px] text-slate-900 font-medium">
                          {act.name}
                        </div>
                        <div className="text-xs text-[#B93829] mt-0.5 tabular-nums">
                          Due {act.dueDate} · {act.roleResponsible}
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => onCompleteActivity(eng.id, act.id)}
                        className="px-2.5 py-1 bg-slate-100 hover:bg-purple-50 text-slate-700 hover:text-[#542D84] rounded text-[11px] font-semibold cursor-pointer shrink-0"
                      >
                        Mark done
                      </button>
                    </div>
                  ))}
                  {pastDueActivities.length === 0 && (
                    <div className="py-2 text-xs text-emerald-700 font-medium">
                      No past-due timeline activities.
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Right Panel: Recent activity (7 cols) */}
            <div className="lg:col-span-7 bg-white rounded-lg border border-slate-200/90 shadow-2xs p-6">
              <div className="flex items-center justify-between">
                <h3 className="text-[16px] font-bold text-slate-900">Recent activity</h3>
                <button
                  type="button"
                  onClick={() => onSelectSubTab('audit-trail')}
                  className="text-xs font-semibold text-slate-800 hover:text-[#542D84] cursor-pointer"
                >
                  Full audit trail
                </button>
              </div>

              <div className="mt-4 divide-y divide-slate-200/80">
                {eng.activityLog.map((log) => (
                  <div key={log.id} className="py-3 first:pt-0">
                    <div className="text-[11.5px] font-mono-tabular text-slate-500">
                      {log.timestamp} · {log.actor}
                    </div>
                    <div className="text-[13.5px] font-medium text-slate-900 mt-0.5">
                      {log.action}
                    </div>
                    {log.detail && (
                      <div className="text-xs text-slate-500 mt-0.5">{log.detail}</div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* SUB-TAB 2: WORKING NOTES */}
      {activeSubTab === 'working-notes' && (
        <div className="bg-white rounded-lg border border-slate-200/90 shadow-2xs p-6 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h3 className="text-[18px] font-bold text-slate-900">
                Working notes &amp; control testing ({eng.workingNotes.length})
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Stage 02 Fieldwork workpapers — walkthroughs, sample testing, exceptions, and 3-tier supervisory sign-off.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <select
                aria-label="Filter working notes"
                value={noteFilter}
                onChange={(e) => setNoteFilter(e.target.value)}
                className="px-3 py-1.5 bg-white border border-slate-300 rounded-md text-xs font-medium text-slate-800"
              >
                <option value="All">All notes ({eng.workingNotes.length})</option>
                <option value="For independent review">For independent review</option>
                <option value="For head review">For head review</option>
                <option value="Cleared">Cleared</option>
                <option value="Returned">Returned</option>
                <option value="Exceptions">With exceptions ({notesWithExceptions})</option>
              </select>
              <button
                type="button"
                onClick={() => setShowNewNoteModal(true)}
                className="px-3.5 py-2 bg-[#5A626A] hover:bg-slate-700 text-white text-xs font-semibold rounded-md cursor-pointer"
              >
                New working note
              </button>
            </div>
          </div>

          <div className="divide-y divide-slate-200 border-t border-slate-200">
            {filteredNotes.map((wn) => (
              <div
                key={wn.id}
                className="py-4 flex flex-col lg:flex-row lg:items-start justify-between gap-4"
              >
                <div className="space-y-1.5 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-mono-tabular text-xs font-bold px-2 py-0.5 bg-slate-100 rounded text-slate-800">
                      {wn.ref}
                    </span>
                    <span className="text-[15px] font-bold text-slate-900">{wn.title}</span>
                    {wn.hasException ? (
                      <span className="px-2 py-0.5 rounded bg-rose-100 text-[#B93829] text-[11px] font-bold">
                        Exception noted
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 rounded bg-emerald-50 text-emerald-800 text-[11px] font-semibold">
                        No exception
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-slate-500">
                    Control Area: <strong className="text-slate-700">{wn.controlArea}</strong> ·
                    Prepared by <strong className="text-slate-700">{wn.author}</strong> · Updated{' '}
                    <span className="font-mono-tabular">{wn.updatedAt}</span>
                  </div>
                  <div className="mt-2 grid grid-cols-1 md:grid-cols-2 gap-3 bg-slate-50/90 p-3 rounded-md border border-slate-200/80 text-xs">
                    <div>
                      <span className="font-semibold text-slate-800 block mb-0.5">
                        Walkthrough &amp; Testing Procedure:
                      </span>
                      <span className="text-slate-600 leading-relaxed">
                        {wn.testingProcedure}
                      </span>
                    </div>
                    <div>
                      <span className="font-semibold text-slate-800 block mb-0.5">
                        Test Result &amp; Conclusion:
                      </span>
                      <span className="text-slate-700 leading-relaxed">{wn.conclusion}</span>
                      {wn.reviewerComments && (
                        <div className="mt-1.5 pt-1.5 border-t border-slate-200 text-[#492785] font-medium">
                          Reviewer comment: {wn.reviewerComments}
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex flex-wrap lg:flex-col items-end gap-2 shrink-0">
                  <span
                    className={`px-2.5 py-1 rounded-full text-xs font-semibold ${
                      wn.status === 'Cleared'
                        ? 'bg-[#DCEFE2] text-[#1E6339]'
                        : wn.status === 'For head review'
                        ? 'bg-[#DCE8FB] text-[#1D4ED8]'
                        : wn.status === 'Returned'
                        ? 'bg-amber-100 text-amber-900'
                        : 'bg-slate-200 text-slate-800'
                    }`}
                  >
                    {wn.status}
                  </span>

                  <div className="flex flex-wrap items-center gap-1.5 mt-1">
                    {wn.hasException && (
                      <button
                        type="button"
                        onClick={() => {
                          setFndLinkedNote(wn.ref);
                          setFndTitle(wn.title);
                          setFndCondition(wn.conclusion);
                          setShowNewFindingModal(true);
                          onSelectSubTab('findings');
                        }}
                        className="px-2.5 py-1.5 bg-white hover:bg-purple-50 border border-[#542D84]/40 text-[#542D84] rounded text-xs font-semibold cursor-pointer"
                      >
                        + Escalate to finding
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => setSelectedNoteModal(wn)}
                      className="px-3 py-1.5 bg-white hover:bg-slate-50 border border-slate-300 rounded text-xs font-semibold text-slate-800 cursor-pointer"
                    >
                      Open &amp; review
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* SUB-TAB 3: FINDINGS */}
      {activeSubTab === 'findings' && (
        <div className="bg-white rounded-lg border border-slate-200/90 shadow-2xs p-6 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h3 className="text-[18px] font-bold text-slate-900">
                Audit findings &amp; 5-C observations ({eng.findings.length})
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Stage 03 Findings &amp; Report observations (Condition, Criteria, Cause, Effect, Recommendation) linked to fieldwork working notes.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => onSelectSubTab('report')}
                className="px-3 py-2 bg-white hover:bg-slate-50 text-slate-800 border border-slate-300 text-xs font-semibold rounded-md cursor-pointer"
              >
                View draft report &amp; annex
              </button>
              <button
                type="button"
                onClick={() => setShowNewFindingModal(true)}
                className="px-3.5 py-2 bg-[#5A626A] hover:bg-slate-700 text-white text-xs font-semibold rounded-md cursor-pointer"
              >
                New finding
              </button>
            </div>
          </div>

          <div className="space-y-4">
            {eng.findings.map((fnd) => (
              <div
                key={fnd.id}
                className="border border-slate-200 rounded-lg p-5 space-y-3 hover:border-slate-300 transition-colors"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className={`px-2 py-0.5 rounded text-xs font-bold text-white ${
                        fnd.severity === 'Critical'
                          ? 'bg-[#B93829]'
                          : fnd.severity === 'High'
                          ? 'bg-[#D97724]'
                          : 'bg-[#C99E2C]'
                      }`}
                    >
                      {fnd.severity}
                    </span>
                    <span className="font-mono-tabular text-xs font-bold text-slate-600">
                      {fnd.ref}
                    </span>
                    <span className="px-2 py-0.5 bg-slate-100 rounded text-[11px] font-mono-tabular text-slate-700">
                      Linked: {fnd.linkedNoteRef}
                    </span>
                    <h4 className="text-[15px] font-bold text-slate-900">{fnd.title}</h4>
                  </div>
                  <span className="text-xs font-semibold text-[#492785] bg-[#E4DDF8] px-2.5 py-0.5 rounded-full">
                    {fnd.status}
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs text-slate-700 bg-slate-50 p-3.5 rounded-md border border-slate-200/80">
                  <div>
                    <strong className="text-slate-900 block">1. Condition (What was found):</strong>
                    {fnd.condition}
                  </div>
                  <div>
                    <strong className="text-slate-900 block">2. Criteria (Policy / Standard):</strong>
                    {fnd.criteria}
                  </div>
                  <div>
                    <strong className="text-slate-900 block">3. Cause (Root cause):</strong>
                    {fnd.cause}
                  </div>
                  <div>
                    <strong className="text-slate-900 block">4. Effect / Risk Impact:</strong>
                    {fnd.effect}
                  </div>
                  <div className="md:col-span-2 pt-1 border-t border-slate-200/80">
                    <strong className="text-slate-900">5. Audit Recommendation:</strong>{' '}
                    {fnd.recommendation}
                  </div>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-2 pt-1 text-xs">
                  <div className="text-slate-600">
                    Action Owner: <strong className="text-slate-900">{fnd.owner}</strong> ·
                    Target Remediation Date:{' '}
                    <strong className="font-mono-tabular text-slate-900">{fnd.targetDate}</strong>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setEditingFindingPlan(fnd);
                        setPlanOwnerInput(fnd.owner);
                        setPlanDateInput(toDateInputValue(fnd.targetDate));
                        setPlanResponseInput(fnd.recommendation);
                        onSelectSubTab('auditee');
                      }}
                      className="px-3 py-1 bg-white hover:bg-slate-50 border border-slate-300 rounded font-semibold text-slate-700 cursor-pointer"
                    >
                      Manage action plan (Stage 04)
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* SUB-TAB 4: REVIEW */}
      {activeSubTab === 'review' && (
        <div className="space-y-4">
          {/* Review Summary KPI Row */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
            <div className="bg-white rounded-lg border border-slate-200/90 p-4 shadow-2xs">
              <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                INDEPENDENT REVIEW QUEUE
              </div>
              <div className="text-2xl font-bold text-slate-900 font-mono-tabular mt-1">
                {indReviewCount}
              </div>
              <div className="text-xs text-slate-500 mt-1">
                Reviewer: {eng.independentReviewer}
              </div>
            </div>
            <div className="bg-white rounded-lg border border-slate-200/90 p-4 shadow-2xs">
              <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                HEAD REVIEW QUEUE
              </div>
              <div className="text-2xl font-bold text-[#1D4ED8] font-mono-tabular mt-1">
                {headReviewCount}
              </div>
              <div className="text-xs text-slate-500 mt-1">
                Head Reviewer: {eng.headReviewer}
              </div>
            </div>
            <div className="bg-white rounded-lg border border-slate-200/90 p-4 shadow-2xs">
              <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                CLEARED WORKPAPERS
              </div>
              <div className="text-2xl font-bold text-[#1E6339] font-mono-tabular mt-1">
                {clearedNotes}/{eng.workingNotes.length}
              </div>
              <div className="text-xs text-slate-500 mt-1">
                Ready for final report sign-off
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg border border-slate-200/90 shadow-2xs p-6">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h3 className="text-[17px] font-bold text-slate-900">
                  Supervisory Review Queue ({pendingReviewNotes.length})
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Working papers awaiting Head Reviewer ({eng.headReviewer}) or Independent Reviewer sign-off. Segregation of Duties prevents self-approval when RBAC is active.
                </p>
              </div>
              <span className="px-2.5 py-1 rounded-full bg-[#E4DDF8] text-[#492785] text-xs font-semibold">
                Reviewer: {currentUser.name} ({currentUser.roleTitle})
              </span>
            </div>

            <div className="mt-4 divide-y divide-slate-200">
              {pendingReviewNotes.map((wn) => (
                <div
                  key={wn.id}
                  className="py-4 flex flex-wrap items-center justify-between gap-4"
                >
                  <div>
                    <div className="text-sm font-bold text-slate-900">
                      <span className="font-mono-tabular">{wn.ref}</span> {wn.title}
                    </div>
                    <div className="text-xs text-slate-600 mt-0.5">
                      Stage: <strong>{wn.status}</strong> · Prepared by: <strong>{wn.author}</strong> · Control Area: {wn.controlArea}
                    </div>
                    <div className="text-xs text-slate-500 mt-1">{wn.conclusion}</div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    {wn.status === 'For independent review' && (
                      <button
                        type="button"
                        onClick={() => handleReviewAction(wn, 'For head review')}
                        className="px-3 py-1.5 bg-white hover:bg-slate-50 border border-slate-300 text-slate-800 text-xs font-semibold rounded cursor-pointer"
                      >
                        Pass to Head Review
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => handleReviewAction(wn, 'Cleared')}
                      className="px-3.5 py-1.5 bg-[#542D84] hover:bg-[#412268] text-white text-xs font-semibold rounded cursor-pointer"
                    >
                      Approve &amp; clear note
                    </button>
                    <button
                      type="button"
                      onClick={() => setSelectedNoteModal(wn)}
                      className="px-3 py-1.5 bg-white border border-slate-300 text-slate-800 text-xs font-semibold rounded cursor-pointer"
                    >
                      Inspect &amp; comment
                    </button>
                  </div>
                </div>
              ))}
              {pendingReviewNotes.length === 0 && (
                <div className="py-6 text-center text-xs text-slate-500">
                  All working notes in this engagement have been cleared.
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* SUB-TAB 5: AUDITEE (Stage 04 Action Plans + Auditee Inquiries) */}
      {activeSubTab === 'auditee' && (
        <div className="space-y-4">
          {/* Card 1: Stage 04 Agreed Action Plans & Management Responses */}
          <div className="bg-white rounded-lg border border-slate-200/90 shadow-2xs p-6">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h3 className="text-[18px] font-bold text-slate-900">
                  Stage 04 · Auditee Action Plans &amp; Management Responses ({eng.findings.length})
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Business unit owners commit to corrective action plans, responsible officers, and target completion dates before final report issuance.
                </p>
              </div>
              {onAdvanceEngagementStage && (
                <button
                  type="button"
                  onClick={() => {
                    onAdvanceEngagementStage(5);
                    notify('Action plans locked and promoted to Stage 05 Issue Monitoring.');
                  }}
                  className="px-3.5 py-1.5 bg-[#542D84] hover:bg-[#412268] text-white text-xs font-semibold rounded-md cursor-pointer"
                >
                  Sign off action plans → Stage 05
                </button>
              )}
            </div>

            <div className="mt-4 overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-slate-200 text-slate-500 uppercase">
                    <th className="py-2.5 pr-3">FINDING &amp; RECOMMENDATION</th>
                    <th className="py-2.5 px-3">ACTION OWNER</th>
                    <th className="py-2.5 px-3">TARGET DATE</th>
                    <th className="py-2.5 px-3">STATUS</th>
                    <th className="py-2.5 pl-3 text-right">ACTION</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {eng.findings.map((f) => (
                    <tr key={f.id}>
                      <td className="py-3.5 pr-3">
                        <div className="font-bold text-slate-900">
                          <span className="font-mono-tabular">{f.ref}</span> — {f.title}
                        </div>
                        <div className="text-slate-500 mt-0.5">{f.recommendation}</div>
                      </td>
                      <td className="py-3.5 px-3 font-medium text-slate-800">{f.owner}</td>
                      <td className="py-3.5 px-3 font-mono-tabular text-slate-800">
                        {f.targetDate}
                      </td>
                      <td className="py-3.5 px-3">
                        <span className="px-2.5 py-0.5 rounded-full bg-[#E4DDF8] text-[#492785] font-semibold">
                          {f.status}
                        </span>
                      </td>
                      <td className="py-3.5 pl-3 text-right whitespace-nowrap">
                        <button
                          type="button"
                          onClick={() => {
                            setEditingFindingPlan(f);
                            setPlanOwnerInput(f.owner);
                            setPlanDateInput(toDateInputValue(f.targetDate));
                            setPlanResponseInput(f.recommendation);
                          }}
                          className="px-2.5 py-1 bg-white hover:bg-slate-50 border border-slate-300 rounded font-semibold text-slate-800 cursor-pointer"
                        >
                          Update response
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {editingFindingPlan && (
              <div className="mt-4 p-4 bg-slate-50 rounded-md border border-slate-200 space-y-3 text-xs">
                <div className="font-bold text-slate-900">
                  Update Auditee Management Response — {editingFindingPlan.ref} ({editingFindingPlan.title})
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">
                      Action Owner (Unit Head)
                    </label>
                    <input
                      type="text"
                      value={planOwnerInput}
                      onChange={(e) => setPlanOwnerInput(e.target.value)}
                      className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">
                      Target Completion Date
                    </label>
                    <input
                      type="date"
                      required
                      value={planDateInput}
                      onChange={(e) => setPlanDateInput(e.target.value)}
                      className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">
                      Commitment Status
                    </label>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        disabled={!planDateInput}
                        onClick={() => {
                          onUpdateFindingStatus?.(
                            eng.id,
                            editingFindingPlan.id,
                            'Action plan submitted',
                            sanitizeText(planOwnerInput, 80),
                            formatDateForDisplay(sanitizeText(planDateInput, 40))
                          );
                          setEditingFindingPlan(null);
                          notify(`Management action plan committed for ${editingFindingPlan.ref}.`);
                        }}
                        className="px-3.5 py-1.5 bg-[#542D84] text-white font-semibold rounded cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        Save &amp; commit plan
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditingFindingPlan(null)}
                        className="px-3 py-1.5 bg-white border border-slate-300 text-slate-700 font-semibold rounded cursor-pointer"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Agreed Corrective Action Plan Details
                  </label>
                  <input
                    type="text"
                    value={planResponseInput}
                    onChange={(e) => setPlanResponseInput(e.target.value)}
                    className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Card 2: Auditee Inquiries & PBC Document Requests */}
          <div className="bg-white rounded-lg border border-slate-200/90 shadow-2xs p-6">
            <h3 className="text-[17px] font-bold text-slate-900">
              Auditee Inquiries &amp; PBC (Provided-by-Client) Requests ({inquiries.length})
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Item-level scoped requests dispatched via Power Automate Outlook flow FLW-04.
            </p>

            <div className="mt-4 divide-y divide-slate-200 text-xs">
              {inquiries.map((inq) => (
                <div
                  key={inq.id}
                  className="py-3 flex flex-wrap items-center justify-between gap-3"
                >
                  <div>
                    <div className="font-bold text-slate-900">
                      <span className="font-mono-tabular">{inq.ref}</span> · {inq.subject}
                    </div>
                    <div className="text-slate-500 mt-0.5">
                      Assigned to: <strong>{inq.assignedTo}</strong> · Due {inq.dueDate}
                    </div>
                    {inq.responseSummary && (
                      <div className="text-slate-700 mt-1 bg-slate-50 px-2.5 py-1 rounded border border-slate-200">
                        Auditee response: {inq.responseSummary}
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <span
                      className={`px-2.5 py-0.5 rounded-full font-semibold ${
                        inq.status === 'Verified by IA'
                          ? 'bg-[#DCEFE2] text-[#1E6339]'
                          : inq.status === 'Responded'
                          ? 'bg-[#DCE8FB] text-[#1D4ED8]'
                          : 'bg-amber-100 text-amber-900'
                      }`}
                    >
                      {inq.status}
                    </span>
                    {inq.status !== 'Verified by IA' && (
                      <button
                        type="button"
                        onClick={() =>
                          setInquiries((prev) =>
                            prev.map((item) =>
                              item.id === inq.id
                                ? {
                                    ...item,
                                    status:
                                      item.status === 'Pending auditee'
                                        ? 'Responded'
                                        : 'Verified by IA',
                                    responseSummary:
                                      item.responseSummary ||
                                      'Requested configuration artifact uploaded to SharePoint library.',
                                  }
                                : item
                            )
                          )
                        }
                        className="px-2.5 py-1 bg-white hover:bg-slate-50 border border-slate-300 rounded font-semibold text-slate-800 cursor-pointer"
                      >
                        {inq.status === 'Pending auditee' ? 'Submit response' : 'Verify (IA)'}
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-4 pt-3 border-t border-slate-200 flex flex-wrap items-center gap-2 text-xs">
              <input
                type="text"
                value={newInquirySubject}
                onChange={(e) => setNewInquirySubject(e.target.value)}
                placeholder="New auditee inquiry or document request..."
                className="flex-1 min-w-[220px] px-3 py-2 border border-slate-300 rounded-md"
              />
              <input
                type="text"
                value={newInquiryAssignee}
                onChange={(e) => setNewInquiryAssignee(e.target.value)}
                placeholder="Assignee"
                className="w-44 px-3 py-2 border border-slate-300 rounded-md"
              />
              <button
                type="button"
                onClick={() => {
                  const cleanSub = sanitizeText(newInquirySubject, 200);
                  if (!cleanSub) return;
                  setInquiries((prev) => [
                    ...prev,
                    {
                      id: `inq-${Date.now()}`,
                      ref: `PBC-0${prev.length + 1}`,
                      subject: cleanSub,
                      assignedTo: sanitizeText(newInquiryAssignee, 80) || 'E. Navarro (IT)',
                      dueDate: '12 Oct 2026',
                      status: 'Pending auditee',
                    },
                  ]);
                  setNewInquirySubject('');
                  notify('Auditee inquiry dispatched via Outlook notification flow.');
                }}
                className="px-3.5 py-2 bg-[#5A626A] hover:bg-slate-700 text-white font-semibold rounded-md cursor-pointer"
              >
                Send inquiry
              </button>
            </div>
          </div>
        </div>
      )}

      {/* SUB-TAB 6: FILES */}
      {activeSubTab === 'files' && (
        <div className="bg-white rounded-lg border border-slate-200/90 shadow-2xs p-6 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h3 className="text-[18px] font-bold text-slate-900">
                Controlled Workpaper Document Library ({eng.files.length} files · 2 folders in use)
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Stored in SharePoint Document Library <code className="bg-slate-100 px-1 py-0.5 rounded">EngagementWorkpapers/{eng.ref}</code> with OWASP file-extension allowlisting.
              </p>
            </div>

            <div className="flex items-center gap-2">
              {['All folders', 'Final report', 'Working paper evidence', 'Planning & memos'].map(
                (fld) => (
                  <button
                    key={fld}
                    type="button"
                    onClick={() => setFolderFilter(fld)}
                    className={`px-3 py-1.5 rounded-full text-xs font-medium border cursor-pointer ${
                      folderFilter === fld
                        ? 'bg-slate-900 text-white border-slate-900 font-semibold'
                        : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
                    }`}
                  >
                    {fld}
                  </button>
                )
              )}
            </div>
          </div>

          <div className="divide-y divide-slate-200 text-xs border-t border-slate-200">
            {filteredFiles.map((fl) => (
              <div key={fl.id} className="py-3.5 flex items-center justify-between gap-4">
                <div>
                  <div className="font-bold text-slate-900 text-[13px]">{fl.name}</div>
                  <div className="text-slate-500 mt-0.5">
                    Folder: <strong className="text-slate-700">{fl.folder}</strong> · Size:{' '}
                    <span className="font-mono-tabular">{fl.size}</span> · Uploaded by{' '}
                    <strong className="text-slate-700">{fl.uploadedBy}</strong> ({fl.uploadedAt})
                  </div>
                </div>
                <span className="px-2.5 py-1 bg-[#DCEFE2] text-[#1E6339] rounded-full font-semibold">
                  SHA-256 Verified
                </span>
              </div>
            ))}
          </div>

          {/* Upload File Form */}
          <form
            onSubmit={handleUploadNewFile}
            className="pt-4 border-t border-slate-200 grid grid-cols-1 sm:grid-cols-4 gap-3 items-end text-xs"
          >
            <div className="sm:col-span-2">
              <label className="block font-semibold text-slate-700 mb-1">
                Upload Workpaper / Report Artifact (.pdf, .docx, .xlsx, .csv, .png, .txt)
              </label>
              <input
                type="text"
                value={uploadFileName}
                onChange={(e) => setUploadFileName(e.target.value)}
                placeholder="e.g. WN-002_OTP_RateLimit_Test_Evidence.pdf"
                className="w-full px-3 py-2 border border-slate-300 rounded-md"
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Target Folder
              </label>
              <select
                value={uploadFolder}
                onChange={(e) => setUploadFolder(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-md bg-white"
              >
                <option value="Working paper evidence">Working paper evidence</option>
                <option value="Final report">Final report</option>
                <option value="Planning & memos">Planning &amp; memos</option>
                <option value="Remediation evidence">Remediation evidence</option>
              </select>
            </div>
            <div>
              <button
                type="submit"
                className="w-full px-4 py-2 bg-[#5A626A] hover:bg-slate-700 text-white font-semibold rounded-md cursor-pointer"
              >
                Upload file
              </button>
            </div>
          </form>
        </div>
      )}

      {/* SUB-TAB 7: REPORT (Stage 03 Findings & Report + 3-Step Approval Workflow) */}
      {activeSubTab === 'report' && (
        <div className="bg-white rounded-lg border border-slate-200/90 shadow-2xs p-6 space-y-5">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <div className="font-mono-tabular text-xs font-semibold text-slate-500 uppercase">
                {eng.reportRef} · STAGE 03 FINDINGS &amp; REPORT
              </div>
              <h3 className="text-[19px] font-bold text-slate-900 mt-0.5">
                Final Audit Report, Annex &amp; Sign-Off Approvals
              </h3>
            </div>
            <span className="px-3 py-1 rounded-full bg-[#DCEFE2] text-[#1E6339] text-xs font-semibold">
              Status: {eng.reportStatus}
            </span>
          </div>

          {/* 3-Step Approval Workflow Stepper */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {[
              {
                step: '01',
                title: 'Drafted & Submitted by AIC',
                actor: eng.lead,
                done: true,
              },
              {
                step: '02',
                title: 'Engagement Lead Approval',
                actor: eng.lead,
                done:
                  eng.reportStatus === 'Approved by Lead' ||
                  eng.reportStatus === 'Approved by CAE',
              },
              {
                step: '03',
                title: 'Final CAE Approval & Issuance',
                actor: eng.headReviewer,
                done: eng.reportStatus === 'Approved by CAE',
              },
            ].map((st) => (
              <div
                key={st.step}
                className={`p-3.5 rounded-lg border text-xs ${
                  st.done
                    ? 'bg-[#F3F0F9] border-[#542D84]/40'
                    : 'bg-slate-50 border-slate-200'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-mono-tabular font-bold text-[#542D84]">
                    APPROVAL GATE {st.step}
                  </span>
                  <span
                    className={`px-2 py-0.5 rounded-full text-[10.5px] font-semibold ${
                      st.done
                        ? 'bg-[#DCEFE2] text-[#1E6339]'
                        : 'bg-slate-200 text-slate-700'
                    }`}
                  >
                    {st.done ? 'Signed off ✓' : 'Pending'}
                  </span>
                </div>
                <div className="font-bold text-slate-900 mt-1">{st.title}</div>
                <div className="text-slate-500 mt-0.5">Signatory: {st.actor}</div>
              </div>
            ))}
          </div>

          {/* Executive Summary & Audit Opinion */}
          <div className="space-y-3 text-xs">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <label className="font-bold text-slate-900">
                Executive Summary &amp; Overall Audit Opinion
              </label>
              <div className="flex items-center gap-2">
                <span className="text-slate-600">Overall Rating:</span>
                <select
                  aria-label="Overall audit opinion"
                  value={auditOpinion}
                  onChange={(e) =>
                    setAuditOpinion(
                      e.target.value as
                        | 'Satisfactory'
                        | 'Needs Improvement'
                        | 'Unsatisfactory'
                    )
                  }
                  className="px-2.5 py-1 border border-slate-300 rounded bg-white font-semibold text-slate-900"
                >
                  <option value="Satisfactory">Satisfactory</option>
                  <option value="Needs Improvement">Needs Improvement</option>
                  <option value="Unsatisfactory">Unsatisfactory</option>
                </select>
              </div>
            </div>

            <textarea
              rows={3}
              value={execSummaryDraft || eng.executiveSummary}
              onChange={(e) => setExecSummaryDraft(e.target.value)}
              className="w-full p-3 bg-slate-50 rounded-md border border-slate-300 text-xs text-slate-800 leading-relaxed"
            />

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  onUpdateReport?.(
                    eng.id,
                    'Submitted to Lead',
                    sanitizeMultiline(execSummaryDraft || eng.executiveSummary, 1500)
                  );
                  notify(`${eng.reportRef} saved and submitted to Engagement Lead.`);
                }}
                className="px-3.5 py-1.5 bg-white hover:bg-slate-50 border border-slate-300 rounded font-semibold text-slate-800 cursor-pointer"
              >
                Submit to engagement lead
              </button>
              <button
                type="button"
                onClick={() => {
                  onUpdateReport?.(
                    eng.id,
                    'Approved by Lead',
                    sanitizeMultiline(execSummaryDraft || eng.executiveSummary, 1500)
                  );
                  notify(`${eng.reportRef} approved by Engagement Lead (${eng.lead}).`);
                }}
                className="px-3.5 py-1.5 bg-white hover:bg-slate-50 border border-slate-300 rounded font-semibold text-slate-800 cursor-pointer"
              >
                Approve as engagement lead
              </button>
              <button
                type="button"
                onClick={() => {
                  if (accessActive && !currentUser.canApproveCAE) {
                    setSecurityBanner(
                      'Segregation of Duties: Only Chief Audit Executive (M. Santos) can grant final CAE report approval.'
                    );
                    return;
                  }
                  onUpdateReport?.(
                    eng.id,
                    'Approved by CAE',
                    sanitizeMultiline(execSummaryDraft || eng.executiveSummary, 1500)
                  );
                  notify(
                    `${eng.reportRef} Final Audit Report approved by CAE (${currentUser.name}).`
                  );
                }}
                className="px-4 py-1.5 bg-[#542D84] hover:bg-[#412268] text-white rounded font-semibold cursor-pointer"
              >
                Approve final report (CAE)
              </button>
            </div>
          </div>

          {/* Annex A Table */}
          <div className="pt-3 border-t border-slate-200">
            <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
              Annex A — Summary of Audit Findings &amp; Management Action Plans ({eng.findings.length})
            </h4>
            <div className="mt-2 overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-slate-200 text-slate-500">
                    <th className="py-2 pr-3">REF</th>
                    <th className="py-2 px-3">OBSERVATION</th>
                    <th className="py-2 px-3">SEVERITY</th>
                    <th className="py-2 px-3">OWNER &amp; TARGET</th>
                    <th className="py-2 pl-3">STATUS</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {eng.findings.map((f) => (
                    <tr key={f.id}>
                      <td className="py-2.5 pr-3 font-mono-tabular font-semibold">
                        {f.ref}
                      </td>
                      <td className="py-2.5 px-3 font-medium text-slate-900">{f.title}</td>
                      <td className="py-2.5 px-3">{f.severity}</td>
                      <td className="py-2.5 px-3 text-slate-600">
                        {f.owner} · {f.targetDate}
                      </td>
                      <td className="py-2.5 pl-3 font-semibold text-[#492785]">{f.status}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* SUB-TAB 8: AUDIT TRAIL */}
      {activeSubTab === 'audit-trail' && (
        <div className="bg-white rounded-lg border border-slate-200/90 shadow-2xs p-6 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h3 className="text-[18px] font-bold text-slate-900">
                Immutable Engagement Audit Trail ({eng.activityLog.length} events)
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Append-only cryptographic log of all saves, supervisory reviews, report approvals, and file uploads (OWASP A09 Security Logging).
              </p>
            </div>
            <input
              type="text"
              value={trailSearch}
              onChange={(e) => setTrailSearch(e.target.value)}
              placeholder="Filter by user or action..."
              className="px-3 py-1.5 border border-slate-300 rounded-md text-xs"
            />
          </div>

          <div className="divide-y divide-slate-200 border-t border-slate-200">
            {filteredTrail.map((log) => (
              <div key={log.id} className="py-3 flex items-start justify-between gap-4">
                <div>
                  <div className="text-xs font-mono-tabular text-slate-500">
                    {log.timestamp} · <strong className="text-slate-700">{log.actor}</strong>
                  </div>
                  <div className="text-sm font-medium text-slate-900 mt-0.5">
                    {log.action}
                  </div>
                  {log.detail && (
                    <div className="text-xs text-slate-600 mt-0.5">{log.detail}</div>
                  )}
                </div>
                <span className="px-2 py-0.5 bg-slate-100 rounded text-[10.5px] font-mono-tabular text-slate-500 shrink-0">
                  APPEND-ONLY
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Modal: Open Working Note for Review */}
      {selectedNoteModal && (
        <div className="fixed inset-0 bg-slate-900/40 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg border border-slate-200 shadow-xl max-w-lg w-full p-5 space-y-3 text-xs">
            <div className="flex items-start justify-between gap-2">
              <div>
                <span className="font-mono-tabular font-bold text-slate-500">
                  {selectedNoteModal.ref} · {selectedNoteModal.controlArea}
                </span>
                <h3 className="text-base font-bold text-slate-900 mt-0.5">
                  {selectedNoteModal.title}
                </h3>
                <div className="text-[11px] text-slate-500 mt-0.5">
                  Prepared by {selectedNoteModal.author} · Updated {selectedNoteModal.updatedAt}
                </div>
              </div>
              <span className="px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-800 font-semibold">
                {selectedNoteModal.status}
              </span>
            </div>

            <div className="p-3 bg-slate-50 rounded border border-slate-200 space-y-2">
              <div>
                <strong className="text-slate-900">Testing Procedure:</strong>
                <p className="text-slate-700 mt-0.5">
                  {selectedNoteModal.testingProcedure}
                </p>
              </div>
              <div>
                <strong className="text-slate-900">Audit Conclusion:</strong>
                <p className="text-slate-700 mt-0.5">{selectedNoteModal.conclusion}</p>
              </div>
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Reviewer Note / Sign-off Remarks ({currentUser.name})
              </label>
              <textarea
                rows={2}
                value={reviewComment}
                onChange={(e) => setReviewComment(e.target.value)}
                placeholder="Add supervisory review note..."
                className="w-full px-3 py-2 border border-slate-300 rounded-md"
              />
            </div>

            <div className="flex flex-wrap justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setSelectedNoteModal(null)}
                className="px-3.5 py-1.5 border border-slate-300 rounded-md font-semibold text-slate-700 cursor-pointer"
              >
                Close
              </button>
              <button
                type="button"
                onClick={() => {
                  handleReviewAction(selectedNoteModal, 'Returned', reviewComment);
                  setReviewComment('');
                  setSelectedNoteModal(null);
                }}
                className="px-3.5 py-1.5 border border-amber-300 bg-amber-50 text-amber-900 rounded-md font-semibold cursor-pointer"
              >
                Return with comments
              </button>
              <button
                type="button"
                onClick={() => {
                  handleReviewAction(selectedNoteModal, 'Cleared', reviewComment);
                  setReviewComment('');
                  setSelectedNoteModal(null);
                }}
                className="px-4 py-1.5 bg-[#542D84] hover:bg-[#412268] text-white rounded-md font-semibold cursor-pointer"
              >
                Approve &amp; Clear ({currentUser.name})
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: New Working Note */}
      {showNewNoteModal && (
        <div className="fixed inset-0 bg-slate-900/40 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg border border-slate-200 shadow-xl max-w-md w-full p-5 space-y-3 text-xs">
            <h3 className="text-base font-bold text-slate-900">Add Working Note</h3>
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Title</label>
              <input
                type="text"
                value={noteTitle}
                onChange={(e) => setNoteTitle(e.target.value)}
                placeholder="e.g. Encryption key rotation verification"
                className="w-full px-3 py-2 border border-slate-300 rounded-md"
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Control Area
              </label>
              <input
                type="text"
                value={noteArea}
                onChange={(e) => setNoteArea(e.target.value)}
                placeholder="e.g. Cryptographic Controls"
                className="w-full px-3 py-2 border border-slate-300 rounded-md"
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Testing Procedure &amp; Conclusion
              </label>
              <textarea
                rows={3}
                value={noteProc}
                onChange={(e) => setNoteProc(e.target.value)}
                placeholder="Describe sample tested and results..."
                className="w-full px-3 py-2 border border-slate-300 rounded-md"
              />
            </div>
            <label className="flex items-center gap-2 font-medium text-slate-800">
              <input
                type="checkbox"
                checked={noteEx}
                onChange={(e) => setNoteEx(e.target.checked)}
              />
              Exception noted during testing
            </label>
            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setShowNewNoteModal(false)}
                className="px-3 py-1.5 border border-slate-300 rounded-md font-semibold cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  const safeTitle = sanitizeText(noteTitle, 160);
                  if (!safeTitle) return;
                  onAddWorkingNote(
                    eng.id,
                    safeTitle,
                    sanitizeText(noteArea, 100) || 'General Controls',
                    sanitizeMultiline(noteProc, 1000) || 'Walkthrough completed.',
                    noteEx
                  );
                  setNoteTitle('');
                  setNoteArea('');
                  setNoteProc('');
                  setNoteEx(false);
                  setShowNewNoteModal(false);
                  notify(`Working note "${safeTitle}" created and submitted for review.`);
                }}
                className="px-4 py-1.5 bg-[#5A626A] text-white rounded-md font-semibold cursor-pointer"
              >
                Save note
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: New Finding */}
      {showNewFindingModal && (
        <div className="fixed inset-0 bg-slate-900/40 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg border border-slate-200 shadow-xl max-w-lg w-full p-5 space-y-3 text-xs max-h-[90vh] overflow-y-auto">
            <h3 className="text-base font-bold text-slate-900">
              Draft New Audit Finding (Stage 03 Observation)
            </h3>
            <form onSubmit={handleCreateFinding} className="space-y-3">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Finding Title
                </label>
                <input
                  type="text"
                  required
                  value={fndTitle}
                  onChange={(e) => setFndTitle(e.target.value)}
                  placeholder="e.g. Lack of rate limiting on password reset endpoint"
                  className="w-full px-3 py-2 border border-slate-300 rounded-md"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Severity Rating
                  </label>
                  <select
                    value={fndSeverity}
                    onChange={(e) => setFndSeverity(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-md bg-white"
                  >
                    {findingSeverities.map((severity) => (
                      <option key={severity} value={severity}>{severity}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Linked Working Note
                  </label>
                  <input
                    type="text"
                    value={fndLinkedNote}
                    onChange={(e) => setFndLinkedNote(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-md font-mono-tabular"
                  />
                </div>
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Condition (Observation)
                </label>
                <textarea
                  rows={2}
                  value={fndCondition}
                  onChange={(e) => setFndCondition(e.target.value)}
                  className="w-full px-3 py-1.5 border border-slate-300 rounded-md"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Criteria (Policy / Standard)
                  </label>
                  <input
                    type="text"
                    value={fndCriteria}
                    onChange={(e) => setFndCriteria(e.target.value)}
                    placeholder="e.g. BSP Circular 982 / InfoSec §4.1"
                    className="w-full px-3 py-1.5 border border-slate-300 rounded-md"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Root Cause
                  </label>
                  <input
                    type="text"
                    value={fndCause}
                    onChange={(e) => setFndCause(e.target.value)}
                    placeholder="e.g. Missing gateway policy check"
                    className="w-full px-3 py-1.5 border border-slate-300 rounded-md"
                  />
                </div>
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Recommendation
                </label>
                <textarea
                  rows={2}
                  value={fndRecommendation}
                  onChange={(e) => setFndRecommendation(e.target.value)}
                  className="w-full px-3 py-1.5 border border-slate-300 rounded-md"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Action Owner
                  </label>
                  <input
                    type="text"
                    value={fndOwner}
                    onChange={(e) => setFndOwner(e.target.value)}
                    className="w-full px-3 py-1.5 border border-slate-300 rounded-md"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Target Remediation Date
                  </label>
                  <input
                    type="date"
                    required
                    value={fndTargetDate}
                    onChange={(e) => setFndTargetDate(e.target.value)}
                    className="w-full px-3 py-1.5 border border-slate-300 rounded-md bg-white"
                  />
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowNewFindingModal(false)}
                  className="px-3.5 py-1.5 border border-slate-300 rounded-md font-semibold text-slate-700 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 bg-[#542D84] text-white rounded-md font-semibold cursor-pointer"
                >
                  Save finding
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Engagement Cockpit & 9-Milestone Timeline Process Flow */}
      {showCockpitModal && (
        <div className="fixed inset-0 bg-slate-900/40 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg border border-slate-200 shadow-xl max-w-2xl w-full p-6 space-y-4 text-xs max-h-[88vh] overflow-y-auto">
            <div className="flex items-start justify-between gap-2">
              <div>
                <div className="font-mono-tabular font-bold text-[#542D84]">
                  ENGAGEMENT COCKPIT · {eng.ref}
                </div>
                <h3 className="text-lg font-bold text-slate-900 mt-0.5">
                  {eng.title}
                </h3>
                <p className="text-slate-600 mt-0.5">
                  Lifecycle Stage: <strong>Stage 0{eng.lifecycleStage}</strong> · Budget:{' '}
                  <strong>{eng.budgetedHours} hrs</strong> · Risk Score:{' '}
                  <strong>
                    {eng.likelihood}×{eng.impact}={eng.riskScore} ({eng.riskLevel})
                  </strong>
                </p>
              </div>
              <span className="px-2.5 py-1 rounded-full bg-[#E4DDF8] text-[#492785] font-semibold">
                {completedTimelineCount}/{totalTimelineCount} milestones ready
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 p-3 bg-slate-50 rounded-md border border-slate-200">
              <div>
                <div className="text-[10.5px] text-slate-500 uppercase">Entity</div>
                <div className="font-semibold text-slate-900 mt-0.5">{eng.entityName}</div>
              </div>
              <div>
                <div className="text-[10.5px] text-slate-500 uppercase">Audit-in-Charge</div>
                <div className="font-semibold text-slate-900 mt-0.5">{eng.lead}</div>
              </div>
              <div>
                <div className="text-[10.5px] text-slate-500 uppercase">Head Reviewer</div>
                <div className="font-semibold text-slate-900 mt-0.5">
                  {eng.headReviewer}
                </div>
              </div>
              <div>
                <div className="text-[10.5px] text-slate-500 uppercase">Report Ref</div>
                <div className="font-semibold text-slate-900 mt-0.5">
                  {eng.reportRef} ({eng.reportStatus})
                </div>
              </div>
            </div>

            <div>
              <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                9-Milestone Engagement Process Flow
              </h4>
              <div className="mt-2 divide-y divide-slate-200 border border-slate-200 rounded-md">
                {eng.timelineActivities.map((act, idx) => (
                  <div
                    key={act.id}
                    className="p-2.5 flex items-center justify-between gap-3 bg-white"
                  >
                    <div className="flex items-center gap-2.5">
                      <span className="font-mono-tabular font-bold text-slate-400 w-5">
                        0{idx + 1}
                      </span>
                      <div>
                        <div className="font-semibold text-slate-900">{act.name}</div>
                        <div className="text-[11px] text-slate-500">
                          Stage 0{act.stageId} · {act.roleResponsible} · Due {act.dueDate}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span
                        className={`px-2 py-0.5 rounded-full text-[11px] font-semibold ${
                          act.status === 'Completed'
                            ? 'bg-emerald-100 text-emerald-900'
                            : act.status === 'Past due'
                            ? 'bg-rose-100 text-[#B93829]'
                            : 'bg-slate-100 text-slate-700'
                        }`}
                      >
                        {act.status}
                      </span>
                      {act.status !== 'Completed' && (
                        <button
                          type="button"
                          onClick={() => onCompleteActivity(eng.id, act.id)}
                          className="px-2.5 py-1 bg-[#542D84] text-white rounded text-[11px] font-semibold cursor-pointer"
                        >
                          Complete
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {onAdvanceEngagementStage && (
              <div className="p-3 bg-[#F3F0F9] rounded-md border border-[#542D84]/20 flex flex-wrap items-center justify-between gap-2">
                <span className="font-semibold text-slate-800">
                  Advance Engagement Lifecycle Stage Gate:
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {([1, 2, 3, 4, 5, 6] as LifecycleStageId[]).map((stId) => (
                    <button
                      key={stId}
                      type="button"
                      onClick={() => {
                        onAdvanceEngagementStage(stId);
                        notify(`Engagement advanced to Stage 0${stId}.`);
                      }}
                      className={`px-2.5 py-1 rounded text-[11px] font-semibold cursor-pointer ${
                        eng.lifecycleStage === stId
                          ? 'bg-[#542D84] text-white'
                          : 'bg-white border border-slate-300 text-slate-700 hover:bg-slate-50'
                      }`}
                    >
                      Stage 0{stId}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="flex justify-end pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setShowCockpitModal(false)}
                className="px-4 py-1.5 bg-[#5A626A] text-white font-semibold rounded-md cursor-pointer"
              >
                Close cockpit
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
