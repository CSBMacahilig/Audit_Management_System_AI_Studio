import { MainTabId, UserProfile } from '../data/auditData';

export type AppRole =
  | 'System administrator'
  | 'Chief Audit Executive'
  | 'Audit Division Head'
  | 'Supervising Auditor'
  | 'Audit-in-Charge'
  | 'Assisting Auditor'
  | 'Auditee';

export function normalizeRole(raw?: string): AppRole {
  if (!raw) return 'Assisting Auditor';
  const trimmed = raw.trim();
  if (trimmed.includes('System administrator')) return 'System administrator';
  if (trimmed.includes('Chief Audit Executive')) return 'Chief Audit Executive';
  if (trimmed.includes('Audit Division Head') || trimmed.includes('Deputy CAE')) return 'Audit Division Head';
  if (trimmed.includes('Audit Manager')) return 'Audit Division Head';
  if (trimmed.includes('Supervising Auditor') || trimmed.includes('Senior Auditor')) return 'Supervising Auditor';
  if (trimmed.includes('Audit-in-Charge') || trimmed.includes('AIC') || trimmed.includes('Information Security Auditor')) return 'Audit-in-Charge';
  if (trimmed.includes('Assisting Auditor') || trimmed === 'Auditor') return 'Assisting Auditor';
  if (trimmed.includes('Auditee') || trimmed.includes('VP') || trimmed.includes('AVP') || trimmed.includes('Officer')) return 'Auditee';
  return 'Assisting Auditor';
}

export interface RoleAuthorityInfo {
  label: string;
  shortRole: string;
  bg: string;
  text: string;
  border: string;
  description: string;
}

export function getRoleAuthorityInfo(role?: string): RoleAuthorityInfo {
  const norm = normalizeRole(role);
  switch (norm) {
    case 'System administrator':
      return {
        label: 'System Admin · Full Authority',
        shortRole: 'System Administrator',
        bg: 'bg-purple-100',
        text: 'text-purple-900',
        border: 'border-purple-300',
        description: 'Full administrative access: user accounts, security policies, master data, and platform settings.',
      };
    case 'Chief Audit Executive':
      return {
        label: 'CAE · Executive Sign-off',
        shortRole: 'Chief Audit Executive',
        bg: 'bg-indigo-100',
        text: 'text-indigo-900',
        border: 'border-indigo-300',
        description: 'Executive authority: Tier 2 report issuance, annual plan approval, and critical issue closure.',
      };
    case 'Audit Division Head':
      return {
        label: 'Division Head · Review & Oversight',
        shortRole: 'Audit Division Head',
        bg: 'bg-blue-100',
        text: 'text-blue-900',
        border: 'border-blue-300',
        description: 'Department oversight: independent quality review, report review, and universe allocation.',
      };
    case 'Supervising Auditor':
      return {
        label: 'Supervisor · Workpaper Clearance',
        shortRole: 'Supervising Auditor',
        bg: 'bg-cyan-100',
        text: 'text-cyan-900',
        border: 'border-cyan-300',
        description: 'Supervisory review: Tier 1 review and clearance of fieldwork working notes.',
      };
    case 'Audit-in-Charge':
      return {
        label: 'Audit-in-Charge · Fieldwork Lead',
        shortRole: 'Audit-in-Charge',
        bg: 'bg-amber-100',
        text: 'text-amber-900',
        border: 'border-amber-300',
        description: 'Engagement lead: prepare audit test plans, lead fieldwork, draft observations, and coordinate exit conferences.',
      };
    case 'Assisting Auditor':
      return {
        label: 'Assisting Auditor · Testing Only',
        shortRole: 'Assisting Auditor',
        bg: 'bg-orange-100',
        text: 'text-orange-900',
        border: 'border-orange-300',
        description: 'Fieldwork execution: perform assigned audit test steps and draft working notes. (Cannot clear own notes or approve reports).',
      };
    case 'Auditee':
      return {
        label: 'Auditee · Management Responses',
        shortRole: 'Auditee',
        bg: 'bg-emerald-100',
        text: 'text-emerald-900',
        border: 'border-emerald-300',
        description: 'Business unit portal: view issued findings, submit management action plans, and upload remediation evidence.',
      };
  }
}

export function canAccessTab(
  userRole?: string,
  tab?: MainTabId,
  accessActive = true
): { allowed: boolean; reason?: string; requiredRole?: string } {
  if (!accessActive) return { allowed: true };
  const norm = normalizeRole(userRole);

  if (norm === 'System administrator') return { allowed: true };

  // Auditee role restrictions
  if (norm === 'Auditee') {
    if (tab === 'overview' || tab === 'fieldwork' || tab === 'issues') {
      return { allowed: true };
    }
    return {
      allowed: false,
      reason: 'This module is restricted to Internal Audit personnel. Business Unit Auditees have access to the Overview dashboard, Fieldwork action plans, and Issue remediation registers.',
      requiredRole: 'Internal Audit Staff or System Administrator',
    };
  }

  // Assisting Auditor restrictions
  if (norm === 'Assisting Auditor') {
    if (tab === 'setup' || tab === 'settings' || tab === 'master-data') {
      return {
        allowed: false,
        reason: `${tab === 'master-data' ? 'Master Data configuration' : 'System configuration'} is restricted to Supervisory and Administrator personnel under Segregation of Duties.`,
        requiredRole: 'Audit Division Head, CAE, or System Administrator',
      };
    }
    return { allowed: true };
  }

  // Audit-in-Charge restrictions
  if (norm === 'Audit-in-Charge') {
    if (tab === 'setup' || tab === 'settings') {
      return {
        allowed: false,
        reason: 'System environment settings and checklist setup require System Administrator authority.',
        requiredRole: 'System Administrator',
      };
    }
    return { allowed: true };
  }

  // Supervising Auditor restrictions
  if (norm === 'Supervising Auditor') {
    if (tab === 'setup' || tab === 'settings') {
      return {
        allowed: false,
        reason: 'System settings and checklist setup require System Administrator authority.',
        requiredRole: 'System Administrator',
      };
    }
    return { allowed: true };
  }

  // Audit Division Head restrictions
  if (norm === 'Audit Division Head') {
    if (tab === 'setup' || tab === 'settings') {
      return {
        allowed: false,
        reason: 'System settings and checklist setup require System Administrator authority.',
        requiredRole: 'System Administrator',
      };
    }
    return { allowed: true };
  }

  // Chief Audit Executive restrictions
  if (norm === 'Chief Audit Executive') {
    if (tab === 'settings') {
      return {
        allowed: false,
        reason: 'Core server and IT infrastructure settings require System Administrator authority.',
        requiredRole: 'System Administrator',
      };
    }
    return { allowed: true };
  }

  return { allowed: true };
}

export function canPerformAction(
  user: UserProfile,
  action: 'manage_users' | 'clear_working_note' | 'approve_cae_report' | 'edit_universe' | 'edit_annual_plan' | 'configure_master_data',
  accessActive = true
): { allowed: boolean; reason?: string } {
  if (!accessActive) return { allowed: true };
  const role = normalizeRole(user.headerSubtitle || user.roleTitle);

  switch (action) {
    case 'manage_users':
      if (role === 'System administrator') return { allowed: true };
      return {
        allowed: false,
        reason: `Only System Administrators can create users, change role assignments, or reset passwords. Current role: ${role}.`,
      };

    case 'clear_working_note':
      if (
        role === 'Supervising Auditor' ||
        role === 'Audit Division Head' ||
        role === 'Chief Audit Executive' ||
        role === 'System administrator' ||
        user.canApproveIndependent
      ) {
        return { allowed: true };
      }
      return {
        allowed: false,
        reason: 'Assisting Auditors and Auditees cannot clear or approve working notes under Segregation of Duties (BSSC Tier 1 review requirement).',
      };

    case 'approve_cae_report':
      if (role === 'Chief Audit Executive' || role === 'System administrator' || user.canApproveCAE) {
        return { allowed: true };
      }
      return {
        allowed: false,
        reason: 'Only the Chief Audit Executive (CAE) has authority to approve and issue the Final Audit Report.',
      };

    case 'edit_universe':
      if (role === 'System administrator' || role === 'Chief Audit Executive' || role === 'Audit Division Head') {
        return { allowed: true };
      }
      return {
        allowed: false,
        reason: 'Adding or modifying Audit Universe entities requires Audit Division Head or CAE authority.',
      };

    case 'edit_annual_plan':
      if (role === 'System administrator' || role === 'Chief Audit Executive' || role === 'Audit Division Head') {
        return { allowed: true };
      }
      return {
        allowed: false,
        reason: 'Scheduling engagements and auto-assigning leads requires Audit Division Head or CAE authority.',
      };

    case 'configure_master_data':
      if (role === 'System administrator' || role === 'Chief Audit Executive' || role === 'Audit Division Head') {
        return { allowed: true };
      }
      return {
        allowed: false,
        reason: 'Modifying master data entities, categories, and directories requires Supervisory or Administrator authority.',
      };
  }
}
