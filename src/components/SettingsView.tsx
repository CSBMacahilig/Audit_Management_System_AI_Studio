import React, { useState, useEffect } from 'react';
import {
  DEFAULT_SECURITY_POLICY,
  SecurityPolicy,
  validatePasswordStrength,
  scorePasswordStrength,
  PASSWORD_STRENGTH_LABELS,
  PASSWORD_STRENGTH_COLORS,
} from '../utils/security';
import { SizingConfig } from '../data/auditData';

interface SettingsViewProps {
  frequencies: {
    critical: number;
    high: number;
    medium: number;
    low: number;
  };
  onSaveFrequencies: (next: {
    critical: number;
    high: number;
    medium: number;
    low: number;
  }) => void;
  onSaveSizing?: (sizing: SizingConfig[]) => void;
}

interface EditableSizingRow {
  id: string;
  size: string;
  standardHours: number;
  fieldTeam: number;
  durationWeeks: number;
  supervisorPct: number;
  aicPct: number;
  whenToUse: string;
  canRemove: boolean;
}

const DEFAULT_SIZING: EditableSizingRow[] = [
  {
    id: 'sz-1',
    size: 'Simple',
    standardHours: 120,
    fieldTeam: 2,
    durationWeeks: 3,
    supervisorPct: 10,
    aicPct: 50,
    whenToUse: 'Single process, site or vendor; low complexity',
    canRemove: true,
  },
  {
    id: 'sz-2',
    size: 'Medium',
    standardHours: 240,
    fieldTeam: 3,
    durationWeeks: 4,
    supervisorPct: 10,
    aicPct: 40,
    whenToUse: 'One department or a branch cluster',
    canRemove: false,
  },
  {
    id: 'sz-3',
    size: 'Complex',
    standardHours: 400,
    fieldTeam: 4,
    durationWeeks: 6,
    supervisorPct: 8,
    aicPct: 35,
    whenToUse: 'Cross-department, system-heavy or high-risk area',
    canRemove: false,
  },
  {
    id: 'sz-4',
    size: 'Epic',
    standardHours: 640,
    fieldTeam: 5,
    durationWeeks: 8,
    supervisorPct: 6,
    aicPct: 30,
    whenToUse: 'Enterprise-wide, multi-system or forensic review',
    canRemove: true,
  },
];

export const SettingsView: React.FC<SettingsViewProps> = ({
  frequencies,
  onSaveFrequencies,
  onSaveSizing,
}) => {
  const [crit, setCrit] = useState(frequencies.critical);
  const [high, setHigh] = useState(frequencies.high);
  const [med, setMed] = useState(frequencies.medium);
  const [low, setLow] = useState(frequencies.low);
  const [savedNotice, setSavedNotice] = useState<string | null>(null);

  // ── BSSC V3: Security Policy state (PM, IA, SM, EC, AL configurable settings) ──
  const [secPolicy, setSecPolicy] = useState<SecurityPolicy>(() => {
    try {
      const stored = localStorage.getItem('bssc_security_policy');
      return stored ? JSON.parse(stored) : DEFAULT_SECURITY_POLICY;
    } catch {
      return DEFAULT_SECURITY_POLICY;
    }
  });
  const [secPolicyDraft, setSecPolicyDraft] = useState<SecurityPolicy>(secPolicy);
  const [secPolicySaved, setSecPolicySaved] = useState(false);
  // PM-2 validation preview
  const [pwValidationTest, setPwValidationTest] = useState('');
  const [showPwTest, setShowPwTest] = useState(false);

  const [sizingRows, setSizingRows] = useState<EditableSizingRow[]>(DEFAULT_SIZING);
  const [defaultSizeByRisk, setDefaultSizeByRisk] = useState({
    critical: 'Complex',
    high: 'Medium',
    medium: 'Simple',
    low: 'Simple',
  });

  const [orgName, setOrgName] = useState('City Savings Bank');
  const [iaUnit, setIaUnit] = useState('Internal Audit Division');
  const [address, setAddress] = useState(
    'UnionBank Plaza, Meralco Avenue, Pasig City'
  );
  const [contactLine, setContactLine] = useState(
    'Internal Audit · (02) 8000 0000 · internal.audit@citysavings.com.ph'
  );
  const [defaultCc, setDefaultCc] = useState(
    'President & Chief Executive Officer; Chair, Board Audit Committee'
  );

  const [docSignatories, setDocSignatories] = useState([
    {
      id: 'sig-1',
      document: 'Notification letter to management',
      subLabel: 'Signed by / Noted by',
      signedBy: 'M. Santos – Chief Audit Executive',
      notedBy: '— None —',
    },
    {
      id: 'sig-2',
      document: 'Audit team assignment memo',
      subLabel: 'Issued by / Approved by',
      signedBy: 'M. Santos – Chief Audit Executive',
      notedBy: '— None —',
    },
    {
      id: 'sig-3',
      document: 'Audit timeline & work schedule',
      subLabel: 'Prepared by / Approved by',
      signedBy: 'Audit-in-charge (from the team)',
      notedBy: 'M. Santos – Chief Audit Executive',
    },
    {
      id: 'sig-4',
      document: 'Document request list',
      subLabel: 'Requested by / Noted by',
      signedBy: 'Audit-in-charge (from the team)',
      notedBy: 'M. Santos – Chief Audit Executive',
    },
    {
      id: 'sig-5',
      document: 'Annual Internal Audit Plan',
      subLabel: 'Submitted by / Approved by',
      signedBy: 'M. Santos – Chief Audit Executive',
      notedBy: 'E. Bautista – Chair, Board Audit Committee',
    },
  ]);

  const [selectedTemplateDoc, setSelectedTemplateDoc] = useState(
    'Notification letter to management'
  );
  const [previewTemplate, setPreviewTemplate] = useState<string | null>(null);
  const [sampleRecordCount, setSampleRecordCount] = useState(170);

  const documentTemplates = [
    {
      document: 'Notification letter to management',
      templateName: 'Standard notification letter',
      lastUpdated: '—',
    },
    {
      document: 'Audit team assignment memo',
      templateName: 'Standard team assignment memo',
      lastUpdated: '—',
    },
    {
      document: 'Audit timeline & work schedule',
      templateName: 'Standard timeline & work schedule',
      lastUpdated: '—',
    },
    {
      document: 'Document request list',
      templateName: 'Standard document request list',
      lastUpdated: '—',
    },
    {
      document: 'Internal audit report',
      templateName: 'Standard internal audit report',
      lastUpdated: '—',
    },
    {
      document: 'Annual Internal Audit Plan memo',
      templateName: 'Standard annual plan memo',
      lastUpdated: '—',
    },
  ];

  const notify = (msg: string) => {
    setSavedNotice(msg);
    setTimeout(() => setSavedNotice(null), 3500);
  };

  const handleSaveFrequencies = (e: React.FormEvent) => {
    e.preventDefault();
    onSaveFrequencies({ critical: crit, high, medium: med, low });
    notify('Audit frequencies saved.');
  };

  return (
    <div className="space-y-4">
      {savedNotice && (
        <div className="px-4 py-2.5 bg-purple-50 border border-purple-200 rounded-md flex items-center justify-between text-xs text-purple-950 font-medium">
          <span>{savedNotice}</span>
          <button
            type="button"
            onClick={() => setSavedNotice(null)}
            className="text-[#492785] font-semibold cursor-pointer"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Top 2-Column Grid matching Audit-Management-System (7).png */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Left Card: Audit frequency by risk rating */}
        <div className="bg-white rounded-lg border border-slate-200/90 shadow-2xs p-6">
          <h2 className="text-[18px] font-bold text-slate-900 tracking-tight">
            Audit frequency by risk rating
          </h2>
          <p className="text-xs text-slate-500 mt-1 leading-relaxed">
            How often each entity should be audited. Next due date = last completed audit +
            this many months.
          </p>

          <form onSubmit={handleSaveFrequencies} className="mt-5">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {[
                { label: 'Critical (months)', val: crit, set: setCrit },
                { label: 'High (months)', val: high, set: setHigh },
                { label: 'Medium (months)', val: med, set: setMed },
                { label: 'Low (months)', val: low, set: setLow },
              ].map((item) => (
                <div key={item.label}>
                  <label className="block text-xs font-medium text-slate-600 mb-1.5">
                    {item.label}
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={60}
                    value={item.val}
                    onChange={(e) => item.set(Number(e.target.value))}
                    className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-md text-sm font-medium text-slate-900 tabular-nums focus:outline-none focus:border-[#492785]"
                  />
                </div>
              ))}
            </div>

            <div className="mt-5">
              <button
                type="submit"
                className="px-4 py-2.5 bg-[#492785] hover:bg-[#3b1f6b] text-white text-xs font-semibold rounded-md transition-colors cursor-pointer"
              >
                Save frequencies
              </button>
            </div>
          </form>
        </div>

        {/* Right Card: Risk rating scale */}
        <div className="bg-white rounded-lg border border-slate-200/90 shadow-2xs p-6">
          <h2 className="text-[18px] font-bold text-slate-900 tracking-tight">
            Risk rating scale
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            Inherent risk score = likelihood (1–5) × impact (1–5).
          </p>

          <div className="mt-5 overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                  <th className="py-2.5 pr-4">RATING</th>
                  <th className="py-2.5 px-4">SCORE</th>
                  <th className="py-2.5 px-4">DEFAULT CYCLE</th>
                  <th className="py-2.5 pl-4">DEFAULT FIELDWORK</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200/80 text-[13px] tabular-nums">
                {[
                  {
                    rating: 'Critical',
                    score: '20–25',
                    color: 'bg-[#B93829]',
                    cycle: `${crit} months`,
                    fw: '6 weeks',
                  },
                  {
                    rating: 'High',
                    score: '10–16',
                    color: 'bg-[#D97724]',
                    cycle: `${high} months`,
                    fw: '5 weeks',
                  },
                  {
                    rating: 'Medium',
                    score: '5–9',
                    color: 'bg-[#C99E2C]',
                    cycle: `${med} months`,
                    fw: '4 weeks',
                  },
                  {
                    rating: 'Low',
                    score: '1–4',
                    color: 'bg-[#519E66]',
                    cycle: `${low} months`,
                    fw: '3 weeks',
                  },
                ].map((r) => (
                  <tr key={r.rating}>
                    <td className="py-3 pr-4">
                      <div className="flex items-center gap-2">
                        <span
                          className={`inline-block px-2 py-0.5 rounded ${r.color} text-white text-xs font-bold font-mono-tabular`}
                        >
                          {r.score}
                        </span>
                        <span className="text-slate-900 font-medium">{r.rating}</span>
                      </div>
                    </td>
                    <td className="py-3 px-4 text-slate-800 font-medium">{r.score}</td>
                    <td className="py-3 px-4 text-slate-800">{r.cycle}</td>
                    <td className="py-3 pl-4 text-slate-800">{r.fw}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Card 2: Engagement sizing & standard hours */}
      <div className="bg-white rounded-lg border border-slate-200/90 shadow-2xs p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-[18px] font-bold text-slate-900 tracking-tight">
              Engagement sizing &amp; standard hours
            </h2>
            <p className="text-xs text-slate-500 mt-1">
              Standard hours, field team and hour split for each engagement size. Auto-assignment and new engagements use these values.
            </p>
          </div>
          <button
            type="button"
            onClick={() =>
              setSizingRows((prev) => [
                ...prev,
                {
                  id: `sz-${Date.now()}`,
                  size: 'Custom',
                  standardHours: 320,
                  fieldTeam: 3,
                  durationWeeks: 5,
                  supervisorPct: 10,
                  aicPct: 40,
                  whenToUse: 'Targeted regulatory or special scope review',
                  canRemove: true,
                },
              ])
            }
            className="px-3.5 py-2 bg-white hover:bg-slate-50 text-slate-800 text-xs font-semibold rounded-md border border-slate-300 transition-colors cursor-pointer shrink-0"
          >
            Add size
          </button>
        </div>

        <div className="mt-5 overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                <th className="py-2.5 pr-3">SIZE</th>
                <th className="py-2.5 px-3">STANDARD HOURS</th>
                <th className="py-2.5 px-3">FIELD TEAM</th>
                <th className="py-2.5 px-3">DURATION (WEEKS)</th>
                <th className="py-2.5 px-3">SUPERVISOR %</th>
                <th className="py-2.5 px-3">AUDIT-IN-CHARGE %</th>
                <th className="py-2.5 px-3">STAFF %</th>
                <th className="py-2.5 px-3">WHEN TO USE</th>
                <th className="py-2.5 pl-3 text-right" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200/80 text-[13px] tabular-nums">
              {sizingRows.map((row) => {
                const staffPct = Math.max(0, 100 - row.supervisorPct - row.aicPct);
                return (
                  <tr key={row.id}>
                    <td className="py-3 pr-3">
                      <input
                        type="text"
                        value={row.size}
                        onChange={(e) =>
                          setSizingRows((prev) =>
                            prev.map((r) =>
                              r.id === row.id ? { ...r, size: e.target.value } : r
                            )
                          )
                        }
                        className="w-28 px-3 py-1.5 bg-white border border-slate-300 rounded-md text-xs font-medium text-slate-900"
                      />
                    </td>
                    <td className="py-3 px-3">
                      <input
                        type="number"
                        value={row.standardHours}
                        onChange={(e) =>
                          setSizingRows((prev) =>
                            prev.map((r) =>
                              r.id === row.id
                                ? { ...r, standardHours: Number(e.target.value) }
                                : r
                            )
                          )
                        }
                        className="w-20 px-3 py-1.5 bg-white border border-slate-300 rounded-md text-xs font-medium text-slate-900"
                      />
                    </td>
                    <td className="py-3 px-3">
                      <input
                        type="number"
                        value={row.fieldTeam}
                        onChange={(e) =>
                          setSizingRows((prev) =>
                            prev.map((r) =>
                              r.id === row.id
                                ? { ...r, fieldTeam: Number(e.target.value) }
                                : r
                            )
                          )
                        }
                        className="w-16 px-3 py-1.5 bg-white border border-slate-300 rounded-md text-xs font-medium text-slate-900"
                      />
                    </td>
                    <td className="py-3 px-3">
                      <input
                        type="number"
                        value={row.durationWeeks}
                        onChange={(e) =>
                          setSizingRows((prev) =>
                            prev.map((r) =>
                              r.id === row.id
                                ? { ...r, durationWeeks: Number(e.target.value) }
                                : r
                            )
                          )
                        }
                        className="w-20 px-3 py-1.5 bg-white border border-slate-300 rounded-md text-xs font-medium text-slate-900"
                      />
                    </td>
                    <td className="py-3 px-3">
                      <input
                        type="number"
                        value={row.supervisorPct}
                        onChange={(e) =>
                          setSizingRows((prev) =>
                            prev.map((r) =>
                              r.id === row.id
                                ? { ...r, supervisorPct: Number(e.target.value) }
                                : r
                            )
                          )
                        }
                        className="w-16 px-3 py-1.5 bg-white border border-slate-300 rounded-md text-xs font-medium text-slate-900"
                      />
                    </td>
                    <td className="py-3 px-3">
                      <input
                        type="number"
                        value={row.aicPct}
                        onChange={(e) =>
                          setSizingRows((prev) =>
                            prev.map((r) =>
                              r.id === row.id
                                ? { ...r, aicPct: Number(e.target.value) }
                                : r
                            )
                          )
                        }
                        className="w-20 px-3 py-1.5 bg-white border border-slate-300 rounded-md text-xs font-medium text-slate-900"
                      />
                    </td>
                    <td className="py-3 px-3 text-xs font-medium text-slate-800">
                      {staffPct}%
                    </td>
                    <td className="py-3 px-3">
                      <input
                        type="text"
                        value={row.whenToUse}
                        onChange={(e) =>
                          setSizingRows((prev) =>
                            prev.map((r) =>
                              r.id === row.id ? { ...r, whenToUse: e.target.value } : r
                            )
                          )
                        }
                        className="w-56 px-3 py-1.5 bg-white border border-slate-300 rounded-md text-xs text-slate-800"
                      />
                    </td>
                    <td className="py-3 pl-3 text-right">
                      {row.canRemove && (
                        <button
                          type="button"
                          onClick={() =>
                            setSizingRows((prev) => prev.filter((r) => r.id !== row.id))
                          }
                          className="text-xs font-semibold text-slate-700 hover:text-slate-950 cursor-pointer"
                        >
                          Remove
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <p className="text-xs text-slate-500 mt-4">
          Field team excludes the engagement supervisor. Staff % is shared equally among the other field auditors; with a field team of one, the Audit-in-charge takes it.
        </p>

        <div className="mt-4">
          <div className="text-xs font-bold text-slate-900 mb-2.5">
            Default size by risk rating
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
            {(
              [
                ['Critical', 'critical'],
                ['High', 'high'],
                ['Medium', 'medium'],
                ['Low', 'low'],
              ] as const
            ).map(([label, key]) => (
              <div key={key}>
                <label className="block text-xs text-slate-600 mb-1">{label}</label>
                <select
                  value={defaultSizeByRisk[key]}
                  onChange={(e) =>
                    setDefaultSizeByRisk((prev) => ({ ...prev, [key]: e.target.value }))
                  }
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-md text-xs font-medium text-slate-900"
                >
                  {sizingRows.map((r) => (
                    <option key={r.id} value={r.size}>
                      {r.size}
                    </option>
                  ))}
                </select>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-5 flex items-center gap-4">
          <button
            type="button"
            onClick={() => {
              if (onSaveSizing) {
                const configs: SizingConfig[] = sizingRows.map((r) => ({
                  id: r.id,
                  sizeName: r.size,
                  code: r.size.slice(0, 3).toUpperCase(),
                  workingDays: r.durationWeeks * 5,
                  calendarSpan: `${r.durationWeeks} weeks`,
                  auditors: r.fieldTeam,
                  hoursPerDay: 8,
                  budgetedHours: r.standardHours,
                  typicalUse: r.whenToUse,
                }));
                onSaveSizing(configs);
              }
              notify('Engagement sizing & standard hours saved to database.');
            }}
            className="px-4 py-2.5 bg-[#492785] hover:bg-[#3b1f6b] text-white text-xs font-semibold rounded-md transition-colors cursor-pointer"
          >
            Save sizing
          </button>
          <button
            type="button"
            onClick={() => {
              setSizingRows(DEFAULT_SIZING);
              setDefaultSizeByRisk({
                critical: 'Complex',
                high: 'Medium',
                medium: 'Simple',
                low: 'Simple',
              });
              notify('Engagement sizing restored to defaults.');
            }}
            className="text-xs font-semibold text-slate-800 hover:text-slate-950 cursor-pointer"
          >
            Restore defaults
          </button>
        </div>
      </div>

      {/* Card 3: Letterhead & signatories */}
      <div className="bg-white rounded-lg border border-slate-200/90 shadow-2xs p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="text-[18px] font-bold text-slate-900 tracking-tight">
              Letterhead &amp; signatories
            </h2>
            <p className="text-xs text-slate-500 mt-1">
              Used on every generated document. Add or edit signatories in Master data → Signatories.
            </p>
          </div>
          <button
            type="button"
            onClick={() => notify('Logo, favicon & theme colours are up to date.')}
            className="px-3.5 py-2 bg-white hover:bg-slate-50 text-slate-800 text-xs font-semibold rounded-md border border-slate-300 transition-colors cursor-pointer"
          >
            Logo, favicon &amp; colours →
          </button>
        </div>

        <div className="mt-5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {[
            { label: 'Organization name', val: orgName, set: setOrgName },
            { label: 'Internal audit unit', val: iaUnit, set: setIaUnit },
            { label: 'Address', val: address, set: setAddress },
            { label: 'Contact line', val: contactLine, set: setContactLine },
          ].map((f) => (
            <div key={f.label}>
              <label className="block text-xs text-slate-600 mb-1">{f.label}</label>
              <input
                type="text"
                value={f.val}
                onChange={(e) => f.set(e.target.value)}
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-md text-xs font-medium text-slate-900"
              />
            </div>
          ))}
        </div>

        <div className="mt-3">
          <label className="block text-xs text-slate-600 mb-1">
            Default copy furnished (cc) on notification letters
          </label>
          <input
            type="text"
            value={defaultCc}
            onChange={(e) => setDefaultCc(e.target.value)}
            className="w-full px-3 py-2 bg-white border border-slate-300 rounded-md text-xs font-medium text-slate-900"
          />
        </div>

        <div className="mt-5 overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                <th className="py-2.5 pr-4 w-1/3">DOCUMENT</th>
                <th className="py-2.5 px-4 w-1/3">SIGNED / PREPARED BY</th>
                <th className="py-2.5 pl-4 w-1/3">NOTED / APPROVED BY</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200/80 text-[13px]">
              {docSignatories.map((sig) => (
                <tr key={sig.id}>
                  <td className="py-3.5 pr-4">
                    <div className="font-bold text-slate-900">{sig.document}</div>
                    <div className="text-xs text-slate-500 mt-0.5">{sig.subLabel}</div>
                  </td>
                  <td className="py-3.5 px-4">
                    <select
                      value={sig.signedBy}
                      onChange={(e) =>
                        setDocSignatories((prev) =>
                          prev.map((s) =>
                            s.id === sig.id ? { ...s, signedBy: e.target.value } : s
                          )
                        )
                      }
                      className="w-full px-3 py-2 bg-white border border-slate-300 rounded-md text-xs font-medium text-slate-900"
                    >
                      <option value="M. Santos – Chief Audit Executive">
                        M. Santos – Chief Audit Executive
                      </option>
                      <option value="Audit-in-charge (from the team)">
                        Audit-in-charge (from the team)
                      </option>
                      <option value="R. Dizon – Deputy CAE">R. Dizon – Deputy CAE</option>
                    </select>
                  </td>
                  <td className="py-3.5 pl-4">
                    <select
                      value={sig.notedBy}
                      onChange={(e) =>
                        setDocSignatories((prev) =>
                          prev.map((s) =>
                            s.id === sig.id ? { ...s, notedBy: e.target.value } : s
                          )
                        )
                      }
                      className="w-full px-3 py-2 bg-white border border-slate-300 rounded-md text-xs font-medium text-slate-900"
                    >
                      <option value="— None —">— None —</option>
                      <option value="M. Santos – Chief Audit Executive">
                        M. Santos – Chief Audit Executive
                      </option>
                      <option value="E. Bautista – Chair, Board Audit Committee">
                        E. Bautista – Chair, Board Audit Committee
                      </option>
                    </select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <p className="text-xs text-slate-500 mt-4">
          Defaults apply to documents that haven&apos;t been given their own signatory yet.
        </p>

        <div className="mt-4">
          <button
            type="button"
            onClick={() => notify('Letterhead & default document signatories saved.')}
            className="px-4 py-2.5 bg-[#492785] hover:bg-[#3b1f6b] text-white text-xs font-semibold rounded-md transition-colors cursor-pointer"
          >
            Save letterhead &amp; signatories
          </button>
        </div>
      </div>

      {/* Card 4: Document templates */}
      <div className="bg-white rounded-lg border border-slate-200/90 shadow-2xs p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="text-[18px] font-bold text-slate-900 tracking-tight">
              Document templates
            </h2>
            <p className="text-xs text-slate-500 mt-1">
              The wording used for each generated document. Engagements use the default template until an auditor edits their copy.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <select
              value={selectedTemplateDoc}
              onChange={(e) => setSelectedTemplateDoc(e.target.value)}
              className="px-3 py-2 bg-white border border-slate-300 rounded-md text-xs font-medium text-slate-900"
            >
              {documentTemplates.map((dt) => (
                <option key={dt.document} value={dt.document}>
                  {dt.document}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={() =>
                notify(`Created new custom template draft for "${selectedTemplateDoc}".`)
              }
              className="px-3.5 py-2 bg-[#492785] hover:bg-[#3b1f6b] text-white text-xs font-semibold rounded-md transition-colors cursor-pointer whitespace-nowrap"
            >
              New template
            </button>
          </div>
        </div>

        <div className="mt-5 overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                <th className="py-2.5 pr-4">DOCUMENT</th>
                <th className="py-2.5 px-4">TEMPLATE</th>
                <th className="py-2.5 px-4">LAST UPDATED</th>
                <th className="py-2.5 pl-4 text-right" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200/80 text-[13px]">
              {documentTemplates.map((dt) => (
                <tr key={dt.document}>
                  <td className="py-3.5 pr-4 font-bold text-slate-900">
                    {dt.document}
                  </td>
                  <td className="py-3.5 px-4">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-slate-900">
                        {dt.templateName}
                      </span>
                      <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-[#DCEFE2] text-[#1E6339]">
                        <span className="w-1.5 h-1.5 rounded-full bg-[#1E6339]" />
                        Default
                      </span>
                    </div>
                    <div className="text-xs text-slate-500 mt-0.5">Built in</div>
                  </td>
                  <td className="py-3.5 px-4 text-slate-700">{dt.lastUpdated}</td>
                  <td className="py-3.5 pl-4 text-right">
                    <button
                      type="button"
                      onClick={() => setPreviewTemplate(dt.document)}
                      className="px-3 py-1.5 bg-white hover:bg-slate-50 text-slate-800 border border-slate-300 rounded-md text-xs font-semibold cursor-pointer"
                    >
                      View / copy
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Card 5: Sample data */}
      <div className="bg-white rounded-lg border border-slate-200/90 shadow-2xs p-6">
        <h2 className="text-[18px] font-bold text-slate-900 tracking-tight">
          Sample data
        </h2>
        <div className="mt-4 pt-4 border-t border-slate-200/80 flex flex-wrap items-center justify-between gap-4">
          <p className="text-xs text-slate-600">
            {sampleRecordCount} sample records are loaded. Removing them leaves your own records untouched.
          </p>
          <button
            type="button"
            onClick={() => {
              setSampleRecordCount(0);
              notify('Sample demonstration records marked for removal.');
            }}
            className="px-3.5 py-2 bg-white hover:bg-rose-50 text-[#B93829] border border-[#E39B93] rounded-md text-xs font-semibold transition-colors cursor-pointer"
          >
            Remove sample data
          </button>
        </div>
      </div>

      {/* ── Card 6: Security Policy (BSSC V3) ────────────────────────────── */}
      <div className="bg-white rounded-lg border border-slate-200/90 shadow-2xs p-6">
        <div className="flex flex-wrap items-start justify-between gap-3 mb-1">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-[18px] font-bold text-slate-900 tracking-tight">
                Security policy
              </h2>
              <span className="text-[10px] font-bold bg-[#E4DDF8] text-[#492785] px-2 py-0.5 rounded-full">
                BSSC V3 · OCISO
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-1">
              Configurable security controls per the OCISO Baseline Security Standards Checklist V3.
              Changes take effect on next user login. All policies enforce server-side.
            </p>
          </div>
          {secPolicySaved && (
            <span className="text-xs font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded-md">
              ✓ Security policy saved
            </span>
          )}
        </div>

        <div className="mt-5 grid grid-cols-1 lg:grid-cols-2 gap-6">

          {/* ── Password Management (PM) ─────────────────────────────── */}
          <div className="space-y-4">
            <div className="text-[11px] font-bold uppercase tracking-widest text-[#492785] border-b border-[#492785]/20 pb-1">
              Password Management (PM)
            </div>
            {[
              { label: 'Min length — regular accounts (PM-1)', field: 'passwordMinLengthRegular' as keyof SecurityPolicy, min: 8, max: 64, note: 'BSSC minimum: 8' },
              { label: 'Min length — privileged accounts (PM-1)', field: 'passwordMinLengthPrivileged' as keyof SecurityPolicy, min: 12, max: 64, note: 'BSSC minimum: 12' },
              { label: 'Password history (last N passwords) (PM-5)', field: 'passwordHistoryCount' as keyof SecurityPolicy, min: 1, max: 24, note: 'BSSC minimum: 6' },
              { label: 'Min password age (days) (PM-6)', field: 'passwordMinAgeDays' as keyof SecurityPolicy, min: 1, max: 30, note: 'BSSC: 1 day' },
              { label: 'Max password age without MFA (days) (PM-7)', field: 'passwordMaxAgeDaysNoMfa' as keyof SecurityPolicy, min: 30, max: 365, note: 'BSSC: 180 days' },
              { label: 'Max password age with MFA (days) (PM-7)', field: 'passwordMaxAgeDaysMfa' as keyof SecurityPolicy, min: 90, max: 730, note: 'BSSC: 365 days' },
              { label: 'Expiry warning lead time (days) (PM-8)', field: 'passwordExpiryWarnDays' as keyof SecurityPolicy, min: 1, max: 60, note: 'Optional: 15 days' },
            ].map(({ label, field, min, max, note }) => (
              <div key={field}>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs text-slate-700 font-medium">{label}</label>
                  <span className="text-[10px] text-slate-400">{note}</span>
                </div>
                <input
                  type="number" min={min} max={max}
                  value={secPolicyDraft[field] as number}
                  onChange={(e) => setSecPolicyDraft((prev) => ({ ...prev, [field]: Math.max(min, Math.min(max, Number(e.target.value))) }))}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-md text-sm font-medium text-slate-900 tabular-nums focus:outline-none focus:border-[#492785]"
                />
              </div>
            ))}

            {/* PM-2: Password validation test ─────────────────────────── */}
            <div>
              <div className="text-xs font-medium text-slate-700 mb-1">PM-2: Test password complexity</div>
              <div className="relative">
                <input
                  type={showPwTest ? 'text' : 'password'} autoComplete="new-password"
                  value={pwValidationTest}
                  onChange={(e) => setPwValidationTest(e.target.value)}
                  placeholder="Type a password to validate…"
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-md text-xs text-slate-800 pr-10"
                />
                <button type="button" onClick={() => setShowPwTest((p) => !p)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 cursor-pointer text-[11px]">
                  {showPwTest ? '🙈' : '👁️'}
                </button>
              </div>
              {pwValidationTest && (() => {
                const score = scorePasswordStrength(pwValidationTest);
                const { valid, violations } = validatePasswordStrength(pwValidationTest);
                return (
                  <div className="mt-2 space-y-1.5">
                    <div className="flex gap-0.5">
                      {[0,1,2,3,4].map((i) => (
                        <div key={i} className={`h-1.5 flex-1 rounded-full ${i <= score ? PASSWORD_STRENGTH_COLORS[score] : 'bg-slate-200'}`} />
                      ))}
                    </div>
                    <div className="text-[11px] text-slate-600">
                      PM-13 Strength: <strong className={valid ? 'text-emerald-700' : 'text-orange-700'}>{PASSWORD_STRENGTH_LABELS[score]}</strong>
                      {' · '}
                      {valid
                        ? <span className="text-emerald-700 font-semibold">✓ Meets PM-1/PM-2 requirements</span>
                        : <span className="text-red-700">{violations[0]}</span>
                      }
                    </div>
                  </div>
                );
              })()}
            </div>
          </div>

          {/* ── Right column: IA / SM / EC / AL ──────────────────────── */}
          <div className="space-y-4">
            <div className="text-[11px] font-bold uppercase tracking-widest text-[#492785] border-b border-[#492785]/20 pb-1">
              Authentication, Session &amp; Logging (IA / SM / EC / AL)
            </div>
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs text-slate-700 font-medium">Max failed login attempts before lockout (IA-8)</label>
                <span className="text-[10px] text-slate-400">BSSC: 3</span>
              </div>
              <input type="number" min={1} max={10}
                value={secPolicyDraft.maxFailedLoginAttempts}
                onChange={(e) => setSecPolicyDraft((prev) => ({ ...prev, maxFailedLoginAttempts: Math.max(1, Math.min(10, Number(e.target.value))) }))}
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-md text-sm font-medium text-slate-900 tabular-nums focus:outline-none focus:border-[#492785]"
              />
            </div>
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs text-slate-700 font-medium">Idle session timeout (minutes) (SM-1)</label>
                <span className="text-[10px] text-slate-400">BSSC: 15 min</span>
              </div>
              <input type="number" min={5} max={120}
                value={secPolicyDraft.sessionTimeoutMinutes}
                onChange={(e) => setSecPolicyDraft((prev) => ({ ...prev, sessionTimeoutMinutes: Math.max(5, Math.min(120, Number(e.target.value))) }))}
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-md text-sm font-medium text-slate-900 tabular-nums focus:outline-none focus:border-[#492785]"
              />
            </div>
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs text-slate-700 font-medium">Absolute session timeout (hours) (SM-2)</label>
                <span className="text-[10px] text-slate-400">Optional: 8 h</span>
              </div>
              <input type="number" min={1} max={24}
                value={secPolicyDraft.absoluteSessionHours}
                onChange={(e) => setSecPolicyDraft((prev) => ({ ...prev, absoluteSessionHours: Math.max(1, Math.min(24, Number(e.target.value))) }))}
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-md text-sm font-medium text-slate-900 tabular-nums focus:outline-none focus:border-[#492785]"
              />
            </div>

            {/* Toggle controls */}
            <div className="space-y-2 pt-2">
              {[
                { label: 'MFA / 2FA enabled (IA-4)', field: 'mfaEnabled' as keyof SecurityPolicy, note: 'Required for Tier 1 & externally-facing systems' },
                { label: 'TLS 1.2+ enforced / HTTPS only (EC-2 / IA-10)', field: 'tlsEnforced' as keyof SecurityPolicy, note: 'HSTS max-age ≥ 1 year required' },
                { label: 'Audit logging enabled (AL-1)', field: 'auditLoggingEnabled' as keyof SecurityPolicy, note: 'SIEM & MSOC integration (AL-2/AL-3)' },
              ].map(({ label, field, note }) => (
                <div key={field} className="flex items-center justify-between p-3 bg-slate-50 border border-slate-200 rounded-lg">
                  <div>
                    <div className="text-xs font-semibold text-slate-800">{label}</div>
                    <div className="text-[10px] text-slate-500 mt-0.5">{note}</div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setSecPolicyDraft((prev) => ({ ...prev, [field]: !(prev[field] as boolean) }))}
                    className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors cursor-pointer ${
                      secPolicyDraft[field] ? 'bg-[#492785]' : 'bg-slate-300'
                    }`}
                  >
                    <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform ${
                      secPolicyDraft[field] ? 'translate-x-4' : 'translate-x-0.5'
                    }`} />
                  </button>
                </div>
              ))}
            </div>

            {/* EC status panel */}
            <div className="mt-3 p-3 bg-blue-50 border border-blue-200 rounded-lg space-y-1.5 text-[11px] text-blue-800">
              <div className="font-bold text-blue-900">EC-1/EC-2: Encryption requirements</div>
              <div>• <strong>Data at rest:</strong> AES-256 / TDE required (EC-1). Configure on database and storage layer.</div>
              <div>• <strong>Data in transit:</strong> TLS 1.2+ only. TLS 1.0/1.1 disabled (EC-2).</div>
              <div>• <strong>HSTS header:</strong> <code className="bg-white/60 px-1 rounded">Strict-Transport-Security: max-age=31536000; includeSubDomains; preload</code></div>
              <div>• <strong>Key management:</strong> Use cloud KMS (AWS KMS / Azure Key Vault). Rotate keys periodically.</div>
            </div>

            {/* AL fields panel */}
            <div className="p-3 bg-purple-50 border border-purple-200 rounded-lg space-y-1 text-[11px] text-purple-900">
              <div className="font-bold mb-1">AL-4: Required audit log fields per event</div>
              {['AL-4.1 Username','AL-4.2 Full Name (First · Middle · Last)','AL-4.3 Employee Number','AL-4.4 Last Login Date (ISO 8601)','AL-4.5 Account Modification Timestamp','AL-4.6 Account Change Log (creation, pw changes, status changes)','AL-4.7 Account Status (Active / Inactive / Deactivated)'].map((f) => (
                <div key={f} className="flex items-center gap-1.5">
                  <span className="text-emerald-600 font-bold">✓</span>
                  <span>{f}</span>
                </div>
              ))}
              <div className="mt-1.5 text-[10px] text-purple-700">
                Log format: structured JSON (SIEM-compatible). Logs are append-only — application code cannot modify or delete entries. Retention: 1–3 years (confirm with OCISO).
              </div>
            </div>
          </div>
        </div>

        <div className="mt-6 flex items-center gap-4">
          <button
            type="button"
            onClick={() => {
              setSecPolicy(secPolicyDraft);
              setSecPolicySaved(true);
              try {
                localStorage.setItem('bssc_security_policy', JSON.stringify(secPolicyDraft));
              } catch {
                // ignore
              }
              notify('BSSC V3 security policy saved and applied.');
              setTimeout(() => setSecPolicySaved(false), 4000);
            }}
            className="px-4 py-2.5 bg-[#492785] hover:bg-[#3b1f6b] text-white text-xs font-semibold rounded-md transition-colors cursor-pointer"
          >
            Save security policy
          </button>
          <button
            type="button"
            onClick={() => {
              setSecPolicyDraft(DEFAULT_SECURITY_POLICY);
              setSecPolicy(DEFAULT_SECURITY_POLICY);
              try {
                localStorage.removeItem('bssc_security_policy');
              } catch {
                // ignore
              }
              notify('Security policy restored to BSSC V3 defaults.');
            }}
            className="text-xs font-semibold text-slate-700 hover:text-slate-950 cursor-pointer"
          >
            Restore BSSC defaults
          </button>
          <div className="ml-auto text-[10px] text-slate-400">
            Current policy: lockout={secPolicy.maxFailedLoginAttempts} attempts · session={secPolicy.sessionTimeoutMinutes} min · pw min={secPolicy.passwordMinLengthRegular} chars
          </div>
        </div>
      </div>

      {previewTemplate && (
        <div className="fixed inset-0 bg-slate-900/40 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg border border-slate-200 shadow-xl max-w-lg w-full p-5 text-xs space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-slate-900">
                {previewTemplate} — Standard Template
              </h3>
              <span className="px-2 py-0.5 rounded-full bg-[#DCEFE2] text-[#1E6339] font-semibold">
                Built in · Default
              </span>
            </div>
            <div className="p-3.5 bg-slate-50 rounded border border-slate-200 font-mono text-[11.5px] text-slate-700 space-y-1.5">
              <div>
                <strong>HEADER:</strong> {orgName} · {iaUnit}
              </div>
              <div>
                <strong>ADDRESS:</strong> {address}
              </div>
              <div>
                <strong>CC:</strong> {defaultCc}
              </div>
              <div className="pt-2 border-t border-slate-200">
                Please be informed that Internal Audit will conduct the scheduled engagement in accordance with the approved Annual Internal Audit Plan.
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setPreviewTemplate(null)}
                className="px-3.5 py-1.5 border border-slate-300 rounded-md font-semibold text-slate-700 cursor-pointer"
              >
                Close
              </button>
              <button
                type="button"
                onClick={() => {
                  setPreviewTemplate(null);
                  notify(`Copied "${previewTemplate}" into a new editable template.`);
                }}
                className="px-4 py-1.5 bg-[#492785] text-white rounded-md font-semibold cursor-pointer"
              >
                Duplicate &amp; edit
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
