import React from 'react';
import {
  LIFECYCLE_STAGES,
  LifecycleStageId,
  MainTabId,
  UserProfile,
  AuditEngagement,
} from '../data/auditData';
import { Check, Lock } from 'lucide-react';
import { AuthSession } from '../utils/authStore';
import { canAccessTab, getRoleAuthorityInfo } from '../utils/rbac';

interface HeaderAndLifecycleProps {
  activeTab: MainTabId;
  onSelectTab: (tab: MainTabId) => void;
  activeLifecycleStage: LifecycleStageId;
  maxCompletedStage: number;
  onSelectLifecycleStage: (stageId: LifecycleStageId) => void;
  currentUser: UserProfile;
  onChangeUser: (user: UserProfile) => void;
  userProfiles: UserProfile[];
  accessActive: boolean;
  onToggleAccess: () => void;
  selectedEngagement: AuditEngagement | null;
  onAdvanceEngagementStage?: (stageId: LifecycleStageId) => void;
  // Auth
  authSession?: AuthSession | null;
  onLogout?: () => void;
  onOpenAdminPanel?: () => void;
  onResetSystemForUAT?: () => Promise<void> | void;
}

const MAIN_TABS: { id: MainTabId; label: string }[] = [
  { id: 'overview', label: 'Overview' },
  { id: 'universe', label: 'Audit universe' },
  { id: 'annual-plan', label: 'Annual plan' },
  { id: 'timeline', label: 'Timeline' },
  { id: 'fieldwork', label: 'Fieldwork' },
  { id: 'issues', label: 'Issues' },
  { id: 'master-data', label: 'Master data' },
  { id: 'settings', label: 'Settings' },
  { id: 'setup', label: 'Setup' },
  { id: 'access', label: 'Access' },
];

export const HeaderAndLifecycle: React.FC<HeaderAndLifecycleProps> = ({
  activeTab,
  onSelectTab,
  activeLifecycleStage,
  onSelectLifecycleStage,
  currentUser,
  onChangeUser,
  userProfiles,
  accessActive,
  onToggleAccess,
  authSession,
  onLogout,
  onOpenAdminPanel,
  onResetSystemForUAT,
}) => {
  const [showUserMenu, setShowUserMenu] = React.useState(false);
  const [showUatResetModal, setShowUatResetModal] = React.useState(false);
  const [isResetting, setIsResetting] = React.useState(false);

  const handleConfirmUatReset = async () => {
    setIsResetting(true);
    try {
      if (onResetSystemForUAT) {
        await onResetSystemForUAT();
      }
      setShowUatResetModal(false);
    } finally {
      setIsResetting(false);
    }
  };

  return (
    <div className="w-full max-w-[1220px] mx-auto pt-6 pb-3 px-4 sm:px-6">
      {/* Top Brand & Institution Header */}
      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-5">
          {/* CitySavings Bank Logo Box */}
          <div className="bg-white rounded-md px-4 py-2.5 shadow-2xs border border-[#542D84]/10 flex items-center shrink-0 select-none">
            <div className="relative flex items-baseline tracking-tight leading-none pt-1">
              <span className="text-[#F37021] font-serif font-bold text-[24px] tracking-tight">
                City
              </span>
              <div className="relative inline-flex flex-col">
                <span className="text-[6.5px] font-bold tracking-wider uppercase text-[#512B81] -mb-1 ml-0.5">
                  a UNIONBANK subsidiary
                </span>
                <span className="text-[#512B81] font-serif font-bold text-[24px] tracking-tight">
                  Savings
                </span>
              </div>
            </div>
          </div>

          {/* Title & Division */}
          <div className="flex flex-col">
            <span className="text-[11px] font-semibold tracking-[0.12em] text-slate-600 uppercase">
              CSB · INTERNAL AUDIT DIVISION
            </span>
            <h1 className="text-[26px] sm:text-[28px] font-bold text-slate-900 tracking-tight leading-tight mt-0.5">
              Audit Management - System
            </h1>
            <p className="text-[13.5px] text-slate-600 mt-0.5">
              Planning · Fieldwork · Reporting · Issue monitoring and closure
            </p>
          </div>

          {/* Auth session pill — pushed to the right */}
          {authSession && (
            <div className="ml-auto flex items-center gap-2 shrink-0">
              {/* Signed-in user badge */}
              <div className="flex items-center gap-2 px-3 py-1.5 bg-white border border-slate-200 rounded-lg shadow-2xs">
                <div className="w-6 h-6 rounded-full bg-[#492785] flex items-center justify-center text-white text-[10px] font-bold select-none">
                  {authSession.fullName.charAt(0).toUpperCase()}
                </div>
                <div className="leading-tight">
                  <div className="text-[12px] font-bold text-slate-900">{authSession.fullName}</div>
                  <div className="text-[10px] text-slate-500">
                    @{authSession.username} ·{' '}
                    <span className={`font-semibold ${authSession.role === 'admin' ? 'text-[#492785]' : 'text-slate-600'}`}>
                      {authSession.role}
                    </span>
                  </div>
                </div>
              </div>

              {/* Admin panel button — only shown to admins */}
              {authSession.role === 'admin' && onOpenAdminPanel && (
                <button
                  type="button"
                  onClick={onOpenAdminPanel}
                  className="px-3 py-1.5 bg-[#492785] hover:bg-[#3b1f6b] text-white text-xs font-semibold rounded-md border border-[#492785] shadow-2xs transition-colors cursor-pointer whitespace-nowrap"
                >
                  Manage users
                </button>
              )}

              {/* Logout */}
              {onLogout && (
                <button
                  type="button"
                  onClick={onLogout}
                  className="px-3 py-1.5 bg-white hover:bg-red-50 text-slate-700 hover:text-red-700 text-xs font-semibold rounded-md border border-slate-300 hover:border-red-200 shadow-2xs transition-colors cursor-pointer whitespace-nowrap"
                >
                  Sign out
                </button>
              )}
            </div>
          )}
        </div>

        {/* Simulated Access & User Switcher Row */}
        <div className="flex flex-wrap items-center gap-4 pt-0.5">
          <div className="flex items-center">
            <span
              className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold ${
                accessActive
                  ? 'bg-emerald-100 text-emerald-900 border border-emerald-300'
                  : 'bg-[#F8E7D2] text-[#A64B00]'
              }`}
            >
              <span
                className={`w-1.5 h-1.5 rounded-full ${
                  accessActive ? 'bg-emerald-700' : 'bg-[#D96B12]'
                }`}
              />
              {accessActive ? 'Access enforced' : 'Access simulated'}
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <div className="text-right leading-tight">
              <div className="flex items-center justify-end gap-1.5">
                <div className="text-[13px] font-bold text-slate-900">
                  {currentUser.name}
                </div>
                {(() => {
                  const roleInfo = getRoleAuthorityInfo(currentUser.headerSubtitle || currentUser.roleTitle);
                  return (
                    <span
                      className={`px-2 py-0.5 rounded text-[10.5px] font-bold ${roleInfo.bg} ${roleInfo.text} border ${roleInfo.border}`}
                      title={roleInfo.description}
                    >
                      {roleInfo.label}
                    </span>
                  );
                })()}
              </div>
              <div className="text-[11px] text-slate-600 mt-0.5">
                {currentUser.email || `${currentUser.name.toLowerCase().replace(/[^a-z0-9]/g, '.')}@citysavings.com.ph`} · {currentUser.headerSubtitle}
              </div>
            </div>

            <button
              type="button"
              onClick={onToggleAccess}
              className="px-3.5 py-1.5 bg-white hover:bg-slate-50 text-slate-900 text-xs font-semibold rounded-md border border-slate-300/90 shadow-2xs transition-colors cursor-pointer whitespace-nowrap"
            >
              {accessActive ? 'Simulate access' : 'Activate access'}
            </button>

            <div className="relative">
              <button
                type="button"
                onClick={() => setShowUserMenu((prev) => !prev)}
                className="px-3.5 py-1.5 bg-white hover:bg-slate-50 text-slate-900 text-xs font-semibold rounded-md border border-slate-300/90 shadow-2xs transition-colors cursor-pointer whitespace-nowrap"
              >
                Switch audit role
              </button>

              {showUserMenu && (
                <div className="absolute right-0 mt-1.5 w-72 bg-white rounded-lg shadow-lg border border-slate-200 py-1.5 z-50">
                  <div className="px-3 py-1.5 text-[11px] font-semibold text-slate-400 uppercase tracking-wider border-b border-slate-100">
                    Select Active Audit Role
                  </div>
                  {userProfiles.map((u) => (
                    <button
                      key={u.id}
                      type="button"
                      onClick={() => {
                        onChangeUser(u);
                        setShowUserMenu(false);
                      }}
                      className={`w-full text-left px-3 py-2 text-xs flex items-center justify-between hover:bg-purple-50/70 transition-colors cursor-pointer ${
                        u.id === currentUser.id
                          ? 'bg-purple-50/90 font-semibold text-[#542D84]'
                          : 'text-slate-700'
                      }`}
                    >
                      <div>
                        <div className="font-semibold text-slate-900">{u.name}</div>
                        <div className="text-[11px] text-slate-500">{u.roleTitle}</div>
                      </div>
                      {u.id === currentUser.id && (
                        <Check className="w-3.5 h-3.5 text-[#542D84] shrink-0" />
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* 7-Stage Audit Lifecycle Breadcrumbs Bar */}
      <div className="mt-4 bg-[#E5DFF0] rounded-lg border border-slate-300/80 overflow-hidden shadow-2xs">
        <nav
          aria-label="Audit Lifecycle Stages"
          className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 divide-y sm:divide-y-0 sm:divide-x divide-slate-300/75"
        >
          {LIFECYCLE_STAGES.map((stage) => {
            const isCurrent = stage.id === activeLifecycleStage;
            return (
              <button
                key={stage.id}
                type="button"
                onClick={() => onSelectLifecycleStage(stage.id)}
                className={`group relative text-left px-3.5 py-2.5 transition-all cursor-pointer flex flex-col justify-start min-h-[76px] ${
                  isCurrent
                    ? 'bg-[#EFEBF7]'
                    : 'bg-[#E8E2F3] hover:bg-[#EFEBF7]'
                }`}
              >
                <div className="font-mono-tabular text-[11px] text-[#542D84] font-medium">
                  {stage.code}
                </div>
                <div className="text-[13px] font-bold text-[#492785] leading-snug mt-0.5">
                  {stage.title}
                </div>
                <div className="text-[11.5px] text-slate-600 leading-tight mt-0.5">
                  {stage.subtitle}
                </div>
              </button>
            );
          })}
        </nav>
      </div>

      {/* Main CitySavings Golden-Orange Navigation Bar */}
      <div className="mt-3.5 bg-[#F7A81B] rounded-lg px-2 sm:px-4 shadow-2xs flex items-center overflow-x-auto no-scrollbar">
        {MAIN_TABS.map((tab) => {
          const isActive = activeTab === tab.id;
          const accessCheck = canAccessTab(
            currentUser.headerSubtitle || currentUser.roleTitle,
            tab.id,
            accessActive
          );
          const isRestricted = !accessCheck.allowed;

          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => onSelectTab(tab.id)}
              title={isRestricted ? accessCheck.reason : undefined}
              className={`relative px-3.5 py-3 text-[13.5px] whitespace-nowrap transition-colors cursor-pointer select-none inline-flex items-center gap-1.5 ${
                isActive
                  ? 'font-bold text-slate-950'
                  : isRestricted
                  ? 'font-medium text-slate-900/70 hover:text-slate-950 hover:bg-black/5'
                  : 'font-medium text-slate-900 hover:text-slate-950 hover:bg-black/5'
              }`}
            >
              {isRestricted && <Lock className="w-3 h-3 text-slate-900/60 shrink-0" />}
              <span>{tab.label}</span>
              {isActive && (
                <span className="absolute bottom-0 left-2 right-2 h-[3px] bg-[#492785] rounded-t-xs" />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
};
