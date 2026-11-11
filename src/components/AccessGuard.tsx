import React from 'react';
import { MainTabId, UserProfile } from '../data/auditData';
import { getRoleAuthorityInfo } from '../utils/rbac';
import { ShieldAlert, ArrowLeft, Users } from 'lucide-react';

interface AccessGuardProps {
  tabName: string;
  tabId: MainTabId;
  currentUser: UserProfile;
  reason?: string;
  requiredRole?: string;
  onGoToOverview: () => void;
  onSwitchRole?: () => void;
  onBypassSimulation?: () => void;
}

export const AccessGuard: React.FC<AccessGuardProps> = ({
  tabName,
  currentUser,
  reason,
  requiredRole,
  onGoToOverview,
  onSwitchRole,
  onBypassSimulation,
}) => {
  const roleInfo = getRoleAuthorityInfo(currentUser.headerSubtitle || currentUser.roleTitle);

  return (
    <div className="w-full my-8 bg-white border border-rose-200 rounded-xl shadow-xs p-8 max-w-2xl mx-auto text-center">
      <div className="w-14 h-14 mx-auto rounded-full bg-rose-50 border border-rose-200 flex items-center justify-center text-rose-600 mb-4">
        <ShieldAlert className="w-7 h-7" />
      </div>

      <span className="inline-block px-3 py-1 bg-rose-100 text-rose-800 text-[11px] font-bold uppercase tracking-wider rounded-full border border-rose-200">
        Access Control Enforcement · LAC-1 / LAC-3
      </span>

      <h2 className="text-xl font-bold text-slate-900 mt-3">
        Access to &ldquo;{tabName}&rdquo; is Restricted
      </h2>

      <p className="text-sm text-slate-600 mt-2 max-w-lg mx-auto">
        {reason || 'Your assigned user role does not possess the required privilege level to access this internal audit module.'}
      </p>

      <div className="my-6 p-4 bg-slate-50 border border-slate-200 rounded-lg text-left max-w-md mx-auto space-y-2 text-xs">
        <div className="flex items-center justify-between">
          <span className="text-slate-500 font-medium">Your Active Profile:</span>
          <span className="font-bold text-slate-900">{currentUser.name}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-slate-500 font-medium">Assigned Role:</span>
          <span className={`px-2 py-0.5 rounded font-semibold text-[11px] ${roleInfo.bg} ${roleInfo.text} border ${roleInfo.border}`}>
            {roleInfo.shortRole}
          </span>
        </div>
        {requiredRole && (
          <div className="flex items-center justify-between pt-1 border-t border-slate-200/80">
            <span className="text-slate-500 font-medium">Required Authority:</span>
            <span className="font-semibold text-slate-800">{requiredRole}</span>
          </div>
        )}
      </div>

      <div className="flex flex-wrap items-center justify-center gap-3">
        <button
          type="button"
          onClick={onGoToOverview}
          className="inline-flex items-center gap-1.5 px-4 py-2 bg-[#492785] hover:bg-[#3b1f6b] text-white text-xs font-semibold rounded-md shadow-2xs transition-colors cursor-pointer"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          Return to Overview
        </button>

        {onSwitchRole && (
          <button
            type="button"
            onClick={onSwitchRole}
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-white hover:bg-slate-50 text-slate-800 text-xs font-semibold rounded-md border border-slate-300 shadow-2xs transition-colors cursor-pointer"
          >
            <Users className="w-3.5 h-3.5 text-[#492785]" />
            Switch Audit Role
          </button>
        )}

        {onBypassSimulation && (
          <button
            type="button"
            onClick={onBypassSimulation}
            className="px-3.5 py-2 bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-300 text-xs font-semibold rounded-md transition-colors cursor-pointer"
          >
            Toggle to Simulated Mode
          </button>
        )}
      </div>
    </div>
  );
};
