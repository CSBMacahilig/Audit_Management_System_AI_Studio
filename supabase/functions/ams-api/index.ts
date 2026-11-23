import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const GENERIC_LOGIN_ERROR = "Login failed. Invalid user ID or password.";
const MAX_FAILED_LOGINS = 3;
const SESSION_DURATION_MS = 8 * 60 * 60 * 1000;

type UserRow = {
  id: string;
  username: string;
  full_name: string | null;
  email: string | null;
  role: string;
  password_hash: string;
  is_active: boolean;
  is_locked: boolean;
  failed_login_count: number;
  requires_password_change: boolean;
};

type RiskScale = {
  id: string;
  name: string;
  highMinScore: number;
  mediumMinScore: number;
  highCycleMonths: number;
  mediumCycleMonths: number;
  lowCycleMonths: number;
  highFieldworkWeeks: number;
  mediumFieldworkWeeks: number;
  lowFieldworkWeeks: number;
};

const supabaseUrl = Deno.env.get("SUPABASE_URL");
const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

if (!supabaseUrl || !serviceRoleKey) {
  throw new Error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.");
}

const adminClient = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

function response(status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function sha256(value: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function makeToken(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function matchesUser(user: UserRow, cleanInput: string, emailPrefix: string): boolean {
  const username = user.username.toLowerCase();
  const fullName = user.full_name?.toLowerCase();
  return username === cleanInput ||
    user.email?.toLowerCase() === cleanInput ||
    username === emailPrefix ||
    fullName === cleanInput ||
    fullName?.replace(/\s+/g, "") === cleanInput.replace(/\s+/g, "");
}

async function login(username: unknown, password: unknown) {
  if (typeof username !== "string" || typeof password !== "string" || !username.trim() || !password) {
    return response(200, { success: false, error: GENERIC_LOGIN_ERROR });
  }

  const cleanInput = username.trim().toLowerCase();
  const emailPrefix = cleanInput.includes("@") ? cleanInput.split("@")[0] : cleanInput;
  const [{ data: users, error: usersError }, { data: profiles, error: profilesError }] = await Promise.all([
    adminClient.from("system_users").select(
      "id,username,full_name,email,role,password_hash,is_active,is_locked,failed_login_count,requires_password_change",
    ),
    adminClient.from("user_profiles").select("employee_number,name"),
  ]);

  if (usersError) {
    console.error("Login could not load system users:", usersError.message);
    return response(500, { success: false, error: "Login service is temporarily unavailable." });
  }
  if (profilesError) console.error("Login could not load employee identifiers:", profilesError.message);

  const profile = profiles?.find((row: { employee_number: string | null; name: string | null }) =>
    typeof row.employee_number === "string" &&
    row.employee_number.toLowerCase() === cleanInput
  );
  const profileName = profile?.name?.toLowerCase();
  const profileEmployeeNumber = profile?.employee_number?.toLowerCase();
  const candidates = (users ?? []).filter((user: UserRow) =>
    matchesUser(user, cleanInput, emailPrefix) ||
    (profile && (
      user.full_name?.toLowerCase() === profileName ||
      user.username.toLowerCase() === profileName?.replace(/\s+/g, ".") ||
      (profileEmployeeNumber && user.username.toLowerCase().includes(profileEmployeeNumber))
    ))
  );

  if (candidates.length === 0) {
    return response(200, { success: false, error: GENERIC_LOGIN_ERROR });
  }

  const attemptedHash = await sha256(password);
  const targetUser = (candidates.find((candidate: UserRow) => candidate.password_hash === attemptedHash) ??
    candidates[0]) as UserRow;

  if (!targetUser.is_active) {
    return response(200, { success: false, error: GENERIC_LOGIN_ERROR });
  }
  if (targetUser.is_locked) {
    return response(200, {
      success: false,
      locked: true,
      error: "Your account has been locked due to multiple failed login attempts. Please contact your system administrator to unlock your account.",
    });
  }

  const now = new Date();
  if (targetUser.password_hash !== attemptedHash) {
    const failedLoginCount = (targetUser.failed_login_count ?? 0) + 1;
    const shouldLock = failedLoginCount >= MAX_FAILED_LOGINS;
    const { error } = await adminClient.from("system_users")
      .update({
        failed_login_count: failedLoginCount,
        is_locked: shouldLock,
        modified_at: now.toISOString(),
      })
      .eq("id", targetUser.id);
    if (error) {
      console.error("Login failed-attempt tracking failed:", error.message);
      return response(500, { success: false, error: "Login service is temporarily unavailable." });
    }

    return response(200, {
      success: false,
      locked: shouldLock,
      error: shouldLock
        ? `${GENERIC_LOGIN_ERROR} Your account has been locked after ${MAX_FAILED_LOGINS} failed attempts. Contact an administrator to unlock.`
        : GENERIC_LOGIN_ERROR,
    });
  }

  const token = makeToken();
  const expiresAt = new Date(now.getTime() + SESSION_DURATION_MS).toISOString();
  const [{ error: updateError }, { error: sessionError }] = await Promise.all([
    adminClient.from("system_users")
      .update({
        failed_login_count: 0,
        is_locked: false,
        last_login: now.toISOString(),
        modified_at: now.toISOString(),
      })
      .eq("id", targetUser.id),
    adminClient.from("app_sessions").insert({
      token_hash: await sha256(token),
      user_id: targetUser.id,
      expires_at: expiresAt,
    }),
  ]);

  if (updateError || sessionError) {
    console.error("Login could not establish the session:", updateError?.message ?? sessionError?.message);
    return response(500, { success: false, error: "Login service is temporarily unavailable." });
  }

  const { error: cleanupError } = await adminClient.from("app_sessions")
    .delete()
    .lt("expires_at", now.toISOString());
  if (cleanupError) console.error("Could not remove expired app sessions:", cleanupError.message);

  return response(200, {
    success: true,
    session: {
      userId: targetUser.id,
      username: targetUser.username,
      email: targetUser.email,
      role: targetUser.role,
      fullName: targetUser.full_name,
      token,
      issuedAt: now.toISOString(),
      expiresAt,
      requiresPasswordChange: targetUser.requires_password_change,
    },
  });
}

async function getActiveSession(request: Request) {
  const authorization = request.headers.get("Authorization");
  const token = authorization?.match(/^Bearer\s+(.+)$/i)?.[1];
  if (!token) return null;

  const { data: storedSession, error } = await adminClient.from("app_sessions")
    .select("user_id,expires_at,revoked_at")
    .eq("token_hash", await sha256(token))
    .maybeSingle();

  if (error) {
    console.error("Session validation failed:", error.message);
    throw new Error("Session validation is temporarily unavailable.");
  }
  if (
    !storedSession ||
    storedSession.revoked_at ||
    new Date(storedSession.expires_at).getTime() <= Date.now()
  ) return null;

  const { data: user, error: userError } = await adminClient.from("system_users")
    .select("id,role,email,is_active")
    .eq("id", storedSession.user_id)
    .maybeSingle();

  if (userError) {
    console.error("Session user validation failed:", userError.message);
    throw new Error("Session validation is temporarily unavailable.");
  }
  if (!user?.is_active) return null;
  return { ...storedSession, user };
}

function isValidScale(value: unknown): value is RiskScale {
  if (!value || typeof value !== "object") return false;
  const scale = value as RiskScale;
  const validInteger = (number: unknown) =>
    typeof number === "number" && Number.isSafeInteger(number) && number > 0;
  return typeof scale.id === "string" && scale.id.trim().length > 0 && scale.id.length <= 120 &&
    typeof scale.name === "string" && scale.name.trim().length > 0 && scale.name.trim().length <= 150 &&
    Number.isFinite(scale.highMinScore) && Number.isFinite(scale.mediumMinScore) &&
    scale.mediumMinScore >= 0 && scale.highMinScore > scale.mediumMinScore && scale.highMinScore <= 10 &&
    validInteger(scale.highCycleMonths) && scale.highCycleMonths <= 60 &&
    validInteger(scale.mediumCycleMonths) && scale.mediumCycleMonths <= 60 &&
    validInteger(scale.lowCycleMonths) && scale.lowCycleMonths <= 60 &&
    validInteger(scale.highFieldworkWeeks) && scale.highFieldworkWeeks <= 52 &&
    validInteger(scale.mediumFieldworkWeeks) && scale.mediumFieldworkWeeks <= 52 &&
    validInteger(scale.lowFieldworkWeeks) && scale.lowFieldworkWeeks <= 52;
}

async function saveRiskScales(request: Request, scales: unknown) {
  const session = await getActiveSession(request);
  if (!session) return response(401, { success: false, error: "Your session is invalid or expired. Sign in again." });
  if (session.user.role !== "admin") {
    return response(403, { success: false, error: "Only a system administrator can manage audit division scales." });
  }
  if (!Array.isArray(scales) || scales.length < 1 || scales.length > 100 || !scales.every(isValidScale)) {
    return response(400, { success: false, error: "The audit division scale data is invalid." });
  }

  const normalizedScales = scales as RiskScale[];
  const ids = new Set(normalizedScales.map((scale) => scale.id.trim()));
  const names = normalizedScales.map((scale) => scale.name.trim().toLowerCase());
  if (ids.size !== normalizedScales.length || new Set(names).size !== names.length) {
    return response(400, { success: false, error: "Audit division IDs and names must be unique." });
  }

  const { data: existing, error: existingError } = await adminClient
    .from("audit_division_risk_scales")
    .select("id,added_by");
  if (existingError) {
    console.error("Could not load existing audit division scales:", existingError.message);
    return response(500, { success: false, error: "Could not load existing audit division scales." });
  }

  const retainedIds = new Set(normalizedScales.map((scale) => scale.id.trim()));
  const removedIds = (existing ?? [])
    .map((row: { id: string }) => row.id)
    .filter((id: string) => !retainedIds.has(id));

  if (removedIds.length > 0) {
    const [universeResult, engagementResult] = await Promise.all([
      adminClient.from("universe_entities").select("audit_division_id").in("audit_division_id", removedIds),
      adminClient.from("engagements").select("audit_division_id").in("audit_division_id", removedIds),
    ]);
    if (universeResult.error || engagementResult.error) {
      console.error("Could not verify audit division references:", universeResult.error?.message ?? engagementResult.error?.message);
      return response(500, { success: false, error: "Could not verify audit division assignments." });
    }
    if ((universeResult.data?.length ?? 0) + (engagementResult.data?.length ?? 0) > 0) {
      return response(409, { success: false, error: "An assigned audit division cannot be removed." });
    }
  }

  const existingById = new Map<string, string | null>(
    (existing ?? []).map((row: { id: string; added_by: string | null }) => [row.id, row.added_by] as const),
  );
  const now = new Date().toISOString();
  const { error: upsertError } = await adminClient.from("audit_division_risk_scales").upsert(
    normalizedScales.map((scale) => ({
      id: scale.id.trim(),
      name: scale.name.trim(),
      high_min_score: scale.highMinScore,
      medium_min_score: scale.mediumMinScore,
      high_cycle_months: scale.highCycleMonths,
      medium_cycle_months: scale.mediumCycleMonths,
      low_cycle_months: scale.lowCycleMonths,
      high_fieldwork_weeks: scale.highFieldworkWeeks,
      medium_fieldwork_weeks: scale.mediumFieldworkWeeks,
      low_fieldwork_weeks: scale.lowFieldworkWeeks,
      added_by: existingById.get(scale.id.trim()) || session.user.email,
      modified_by: session.user.email,
      modified_at: now,
      updated_at: now,
    })),
  );
  if (upsertError) {
    console.error("Could not save audit division scales:", upsertError.message);
    return response(500, { success: false, error: "Could not save audit division scales." });
  }

  if (removedIds.length > 0) {
    const { error: deleteError } = await adminClient.from("audit_division_risk_scales").delete().in("id", removedIds);
    if (deleteError) {
      console.error("Could not remove audit divisions:", deleteError.message);
      return response(500, { success: false, error: "Could not remove audit divisions." });
    }
  }

  return response(200, { success: true });
}

Deno.serve(async (request: Request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (request.method !== "POST") return response(405, { success: false, error: "Method not allowed." });

  try {
    const body = await request.json();
    if (!body || typeof body !== "object" || typeof body.action !== "string") {
      return response(400, { success: false, error: "Invalid request." });
    }

    if (body.action === "login") return await login(body.username, body.password);

    if (body.action === "logout") {
      const session = await getActiveSession(request);
      if (session) {
        const { error } = await adminClient.from("app_sessions")
          .update({ revoked_at: new Date().toISOString() })
          .eq("token_hash", await sha256(request.headers.get("Authorization")!.replace(/^Bearer\s+/i, "")));
        if (error) {
          console.error("Could not revoke session:", error.message);
          return response(500, { success: false, error: "Could not complete sign out on the server." });
        }
      }
      return response(200, { success: true });
    }

    if (body.action === "saveAuditDivisionRiskScales") {
      return await saveRiskScales(request, body.scales);
    }

    return response(400, { success: false, error: "Unsupported action." });
  } catch (error) {
    console.error("AMS API request failed:", error);
    return response(500, { success: false, error: "Request could not be completed." });
  }
});
