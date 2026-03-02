import type { NextFunction, Request, Response } from "express";
import { createPublicKey, verify } from "node:crypto";
import { and, eq, or, sql } from "drizzle-orm";
import { createId } from "@paralleldrive/cuid2";
import { db } from "./db";
import {
  auditLogs,
  studioMemberships,
  studios,
  users,
  type AppRole,
  type StudioMembership,
  type StudioMembershipStatus,
  type User,
} from "./schema";

type JwtHeader = {
  alg?: string;
  kid?: string;
  typ?: string;
};

type JwtPayload = {
  sub?: string;
  iss?: string;
  exp?: number;
  nbf?: number;
  iat?: number;
  email?: string;
  email_address?: string;
  given_name?: string;
  family_name?: string;
  name?: string;
  [key: string]: unknown;
};

type Jwk = {
  kid?: string;
  kty?: string;
  alg?: string;
  use?: string;
  n?: string;
  e?: string;
};

type AuthErrorCode =
  | "AUTH_MISSING"
  | "AUTH_INVALID"
  | "AUTH_FORBIDDEN"
  | "AUTH_CONFIG"
  | "AUTH_EXPIRED";

class AuthError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: AuthErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "AuthError";
  }
}

type JwksCacheEntry = {
  keys: Jwk[];
  expiresAt: number;
};

const jwksCache = new Map<string, JwksCacheEntry>();

const DEFAULT_STUDIO_KEY = "default";
const DEFAULT_STUDIO_ID = "studio_default";

export type AuthContext = {
  userId: string;
  clerkUserId: string;
  email: string;
  displayName: string;
  systemRole: AppRole;
  studioId: string;
  studioKey: string;
  membershipId: string;
  membershipRole: AppRole;
  membershipStatus: StudioMembershipStatus;
  tokenClaims: JwtPayload;
};

declare global {
  namespace Express {
    interface Request {
      auth?: AuthContext;
    }
  }
}

function normalizeIssuer(issuer: string): string {
  return issuer.replace(/\/+$/, "");
}

function fromBase64Url(value: string): Buffer {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const padding = (4 - (normalized.length % 4)) % 4;
  return Buffer.from(normalized + "=".repeat(padding), "base64");
}

function parseJsonPart<T extends object>(base64Url: string, label: string): T {
  try {
    const decoded = fromBase64Url(base64Url).toString("utf8");
    return JSON.parse(decoded) as T;
  } catch {
    throw new AuthError(401, "AUTH_INVALID", `Invalid ${label} in bearer token.`);
  }
}

function parseBearerToken(req: Request): string {
  const header = req.header("authorization") || "";
  const [scheme, token] = header.split(" ");
  if (scheme?.toLowerCase() !== "bearer" || !token?.trim()) {
    throw new AuthError(401, "AUTH_MISSING", "Missing bearer token.");
  }
  return token.trim();
}

function assertTimeClaims(payload: JwtPayload): void {
  const now = Math.floor(Date.now() / 1000);
  if (typeof payload.exp !== "number") {
    throw new AuthError(401, "AUTH_INVALID", "Token is missing exp claim.");
  }
  if (payload.exp <= now) {
    throw new AuthError(401, "AUTH_EXPIRED", "Token has expired.");
  }
  if (typeof payload.nbf === "number" && payload.nbf > now) {
    throw new AuthError(401, "AUTH_INVALID", "Token is not active yet.");
  }
}

function assertIssuer(payload: JwtPayload): string {
  const issuerRaw = typeof payload.iss === "string" ? payload.iss.trim() : "";
  if (!issuerRaw) {
    throw new AuthError(401, "AUTH_INVALID", "Token is missing issuer claim.");
  }

  const issuer = normalizeIssuer(issuerRaw);
  if (!issuer.startsWith("https://")) {
    throw new AuthError(401, "AUTH_INVALID", "Token issuer must use https.");
  }

  const requiredIssuer = process.env.CLERK_JWT_ISSUER?.trim();
  if (!requiredIssuer) {
    throw new AuthError(
      500,
      "AUTH_CONFIG",
      "CLERK_JWT_ISSUER must be configured for JWT verification.",
    );
  }

  if (normalizeIssuer(requiredIssuer) !== issuer) {
    throw new AuthError(401, "AUTH_INVALID", "Token issuer is not allowed.");
  }

  return issuer;
}

async function loadJwks(jwksUrl: string): Promise<Jwk[]> {
  const cached = jwksCache.get(jwksUrl);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.keys;
  }

  const response = await fetch(jwksUrl, {
    headers: { Accept: "application/json" },
  });

  if (!response.ok) {
    throw new AuthError(401, "AUTH_INVALID", `Unable to fetch JWKS (${response.status}).`);
  }

  const json = (await response.json()) as { keys?: Jwk[] };
  if (!Array.isArray(json.keys) || json.keys.length === 0) {
    throw new AuthError(401, "AUTH_INVALID", "JWKS response did not include keys.");
  }

  const cacheControl = response.headers.get("cache-control") || "";
  const maxAgeMatch = cacheControl.match(/max-age=(\d+)/i);
  const maxAgeSeconds = maxAgeMatch ? Number(maxAgeMatch[1]) : 300;
  jwksCache.set(jwksUrl, {
    keys: json.keys,
    expiresAt: Date.now() + maxAgeSeconds * 1000,
  });

  return json.keys;
}

function findSigningKey(keys: Jwk[], kid?: string): Jwk {
  if (kid) {
    const byKid = keys.find((key) => key.kid === kid);
    if (byKid) return byKid;
  }

  const rs256 = keys.find((key) => key.kty === "RSA" && (!key.alg || key.alg === "RS256"));
  if (rs256) return rs256;

  throw new AuthError(401, "AUTH_INVALID", "No compatible signing key found in JWKS.");
}

function verifySignature(token: string, header: JwtHeader, key: Jwk): void {
  const [headerB64, payloadB64, signatureB64] = token.split(".");
  if (!headerB64 || !payloadB64 || !signatureB64) {
    throw new AuthError(401, "AUTH_INVALID", "Malformed bearer token.");
  }

  if (header.alg !== "RS256") {
    throw new AuthError(401, "AUTH_INVALID", "Unsupported token signing algorithm.");
  }

  const signingInput = `${headerB64}.${payloadB64}`;
  const signature = fromBase64Url(signatureB64);

  const publicKey = createPublicKey({
    key: {
      kty: key.kty,
      kid: key.kid,
      alg: key.alg,
      use: key.use,
      n: key.n,
      e: key.e,
    },
    format: "jwk",
  });

  const valid = verify("RSA-SHA256", Buffer.from(signingInput), publicKey, signature);
  if (!valid) {
    throw new AuthError(401, "AUTH_INVALID", "Bearer token signature is invalid.");
  }
}

async function verifyClerkJwt(token: string): Promise<JwtPayload> {
  const parts = token.split(".");
  if (parts.length !== 3) {
    throw new AuthError(401, "AUTH_INVALID", "Malformed bearer token.");
  }

  const header = parseJsonPart<JwtHeader>(parts[0], "token header");
  const payload = parseJsonPart<JwtPayload>(parts[1], "token payload");

  assertTimeClaims(payload);
  const issuer = assertIssuer(payload);
  const configuredJwksUrl = process.env.CLERK_JWKS_URL?.trim();
  const jwksUrl = configuredJwksUrl || `${issuer}/.well-known/jwks.json`;

  const keys = await loadJwks(jwksUrl);
  const signingKey = findSigningKey(keys, header.kid);
  verifySignature(token, header, signingKey);

  if (!payload.sub || typeof payload.sub !== "string") {
    throw new AuthError(401, "AUTH_INVALID", "Token is missing subject claim.");
  }

  return payload;
}

function normalizeEmail(payload: JwtPayload): string {
  const raw =
    (typeof payload.email_address === "string" && payload.email_address) ||
    (typeof payload.email === "string" && payload.email) ||
    "";
  return raw.trim().toLowerCase();
}

function resolveDisplayName(payload: JwtPayload, email: string): string {
  const first = typeof payload.given_name === "string" ? payload.given_name.trim() : "";
  const last = typeof payload.family_name === "string" ? payload.family_name.trim() : "";
  const name = typeof payload.name === "string" ? payload.name.trim() : "";
  if (name) return name;
  const full = [first, last].filter(Boolean).join(" ");
  if (full) return full;
  return email || "Authenticated User";
}

function resolveRequestedStudioSelector(req: Request): string | null {
  const fromHeaders =
    req.header("x-studio-id") ||
    req.header("x-studio-key") ||
    req.header("x-tenant-id") ||
    req.header("x-tenant-key");
  if (fromHeaders?.trim()) return fromHeaders.trim();

  const fromQuery = (req.query.studioId || req.query.studioKey || req.query.tenantId || req.query.tenantKey) as
    | string
    | undefined;
  if (typeof fromQuery === "string" && fromQuery.trim()) return fromQuery.trim();

  const body = (req.body || {}) as Record<string, unknown>;
  const fromBody =
    (typeof body.studioId === "string" && body.studioId) ||
    (typeof body.studioKey === "string" && body.studioKey) ||
    (typeof body.tenantId === "string" && body.tenantId) ||
    (typeof body.tenantKey === "string" && body.tenantKey) ||
    "";
  if (fromBody.trim()) return fromBody.trim();

  return null;
}

async function ensureDefaultStudio(): Promise<{ id: string; studioKey: string }> {
  const existing = await db
    .select({ id: studios.id, studioKey: studios.studioKey })
    .from(studios)
    .where(eq(studios.studioKey, DEFAULT_STUDIO_KEY))
    .limit(1);

  if (existing[0]) {
    return existing[0];
  }

  const inserted = await db
    .insert(studios)
    .values({
      id: DEFAULT_STUDIO_ID,
      name: "Default Studio",
      studioKey: DEFAULT_STUDIO_KEY,
      isActive: true,
      createdByUserId: null,
    })
    .onConflictDoNothing({ target: studios.studioKey })
    .returning({ id: studios.id, studioKey: studios.studioKey });

  if (inserted[0]) return inserted[0];

  const reloaded = await db
    .select({ id: studios.id, studioKey: studios.studioKey })
    .from(studios)
    .where(eq(studios.studioKey, DEFAULT_STUDIO_KEY))
    .limit(1);

  if (!reloaded[0]) {
    throw new AuthError(500, "AUTH_CONFIG", "Unable to bootstrap default studio.");
  }

  return reloaded[0];
}

async function resolveTargetStudio(selector: string | null): Promise<{ id: string; studioKey: string }> {
  const fallback = await ensureDefaultStudio();
  if (!selector) return fallback;

  const found = await db
    .select({ id: studios.id, studioKey: studios.studioKey })
    .from(studios)
    .where(or(eq(studios.id, selector), eq(studios.studioKey, selector)))
    .limit(1);

  if (!found[0]) {
    throw new AuthError(403, "AUTH_FORBIDDEN", "Requested studio is not accessible.");
  }

  return found[0];
}

async function upsertUserFromJwt(payload: JwtPayload): Promise<User> {
  const clerkUserId = String(payload.sub);
  const email = normalizeEmail(payload);
  const displayName = resolveDisplayName(payload, email);
  const [firstName, ...rest] = displayName.split(" ");
  const lastName = rest.join(" ").trim();

  const byClerkId = await db
    .select()
    .from(users)
    .where(eq(users.clerkUserId, clerkUserId))
    .limit(1);

  if (byClerkId[0]) {
    const [updated] = await db
      .update(users)
      .set({
        email: email || byClerkId[0].email,
        firstName: firstName || byClerkId[0].firstName,
        lastName: lastName || byClerkId[0].lastName,
        updatedAt: new Date(),
      })
      .where(eq(users.id, byClerkId[0].id))
      .returning();
    return updated;
  }

  if (email) {
    const inviteUser = await db
      .select()
      .from(users)
      .where(and(eq(users.email, email), sql`${users.clerkUserId} IS NULL`))
      .limit(1);

    if (inviteUser[0]) {
      const [linked] = await db
        .update(users)
        .set({
          clerkUserId,
          firstName: firstName || inviteUser[0].firstName,
          lastName: lastName || inviteUser[0].lastName,
          updatedAt: new Date(),
        })
        .where(eq(users.id, inviteUser[0].id))
        .returning();
      return linked;
    }
  }

  const [created] = await db
    .insert(users)
    .values({
      id: createId(),
      clerkUserId,
      email: email || `${clerkUserId}@unknown.local`,
      firstName: firstName || null,
      lastName: lastName || null,
      systemRole: "PARENT",
    })
    .returning();

  return created;
}

async function maybeActivateInvitedMembership(
  user: User,
  studioId: string,
): Promise<StudioMembership | null> {
  const membership = await db
    .select()
    .from(studioMemberships)
    .where(
      and(
        eq(studioMemberships.studioId, studioId),
        eq(studioMemberships.status, "invited"),
        eq(studioMemberships.inviteEmail, user.email),
      ),
    )
    .limit(1);

  if (!membership[0]) return null;

  const [activated] = await db
    .update(studioMemberships)
    .set({
      userId: user.id,
      status: "active",
      updatedAt: new Date(),
    })
    .where(eq(studioMemberships.id, membership[0].id))
    .returning();

  return activated || null;
}

async function maybeBootstrapFounderMembership(
  user: User,
  studioId: string,
): Promise<StudioMembership | null> {
  const totalMemberships = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(studioMemberships)
    .where(eq(studioMemberships.status, "active"));

  if ((totalMemberships[0]?.count || 0) > 0) {
    return null;
  }

  const [membership] = await db
    .insert(studioMemberships)
    .values({
      id: createId(),
      studioId,
      userId: user.id,
      role: "FOUNDER",
      status: "active",
      inviteEmail: user.email,
    })
    .returning();

  await db
    .update(users)
    .set({
      systemRole: "FOUNDER",
      updatedAt: new Date(),
    })
    .where(eq(users.id, user.id));

  return membership;
}

async function resolveMembership(user: User, studioId: string): Promise<StudioMembership> {
  const existing = await db
    .select()
    .from(studioMemberships)
    .where(
      and(
        eq(studioMemberships.studioId, studioId),
        eq(studioMemberships.userId, user.id),
        eq(studioMemberships.status, "active"),
      ),
    )
    .limit(1);

  if (existing[0]) return existing[0];

  const activatedInvite = await maybeActivateInvitedMembership(user, studioId);
  if (activatedInvite) return activatedInvite;

  const bootstrapped = await maybeBootstrapFounderMembership(user, studioId);
  if (bootstrapped) return bootstrapped;

  throw new AuthError(403, "AUTH_FORBIDDEN", "You are not a member of this studio.");
}

function isFounderOrSuperadmin(context: AuthContext): boolean {
  return (
    context.systemRole === "FOUNDER" ||
    context.systemRole === "SUPERADMIN" ||
    context.membershipRole === "FOUNDER" ||
    context.membershipRole === "SUPERADMIN"
  );
}

async function buildAuthContext(req: Request, payload: JwtPayload): Promise<AuthContext> {
  const user = await upsertUserFromJwt(payload);
  const studioSelector = resolveRequestedStudioSelector(req);
  const targetStudio = await resolveTargetStudio(studioSelector);
  const membership = await resolveMembership(user, targetStudio.id);

  return {
    userId: user.id,
    clerkUserId: String(payload.sub),
    email: user.email,
    displayName:
      [user.firstName, user.lastName].filter(Boolean).join(" ").trim() ||
      user.email ||
      "Authenticated User",
    systemRole: user.systemRole,
    studioId: targetStudio.id,
    studioKey: targetStudio.studioKey,
    membershipId: membership.id,
    membershipRole: membership.role,
    membershipStatus: membership.status,
    tokenClaims: payload,
  };
}

function handleAuthFailure(res: Response, error: unknown): void {
  if (error instanceof AuthError) {
    res.status(error.status).json({ error: error.message, code: error.code });
    return;
  }

  res.status(401).json({
    error: "Unauthorized",
    code: "AUTH_INVALID",
  });
}

type AuthMiddlewareOptions = {
  publicPaths?: string[];
  publicPathPrefixes?: string[];
};

export function clerkAuthMiddleware(options?: AuthMiddlewareOptions) {
  const publicPaths = new Set((options?.publicPaths || []).map((path) => path.trim()));
  const publicPathPrefixes = (options?.publicPathPrefixes || []).map((path) => path.trim());

  return async (req: Request, res: Response, next: NextFunction) => {
    const requestPath = req.path || req.originalUrl || "";
    const requestOriginalUrl = req.originalUrl || requestPath;

    if (
      publicPaths.has(requestPath) ||
      publicPaths.has(requestOriginalUrl) ||
      publicPathPrefixes.some(
        (prefix) =>
          requestPath.startsWith(prefix) ||
          requestOriginalUrl.startsWith(prefix),
      )
    ) {
      return next();
    }

    try {
      const token = parseBearerToken(req);
      const payload = await verifyClerkJwt(token);
      req.auth = await buildAuthContext(req, payload);
      next();
    } catch (error) {
      handleAuthFailure(res, error);
    }
  };
}

export function requireFounderOrSuperadmin(
  req: Request,
  res: Response,
): AuthContext | null {
  const context = req.auth;
  if (!context) {
    res.status(401).json({ error: "Unauthorized", code: "AUTH_MISSING" });
    return null;
  }

  if (!isFounderOrSuperadmin(context)) {
    res.status(403).json({
      error: "Founder or superadmin role required.",
      code: "AUTH_FORBIDDEN",
    });
    return null;
  }

  return context;
}

export async function writeAuditLog(input: {
  studioId: string | null;
  actorUserId: string | null;
  action: string;
  resourceType?: string | null;
  resourceId?: string | null;
  metadata?: Record<string, unknown> | null;
}): Promise<void> {
  await db.insert(auditLogs).values({
    id: createId(),
    studioId: input.studioId,
    actorUserId: input.actorUserId,
    action: input.action,
    resourceType: input.resourceType || null,
    resourceId: input.resourceId || null,
    metadata: input.metadata || null,
  });
}

export async function createStudioByAdmin(input: {
  name: string;
  studioKey?: string;
  actorUserId: string;
}): Promise<{ id: string; name: string; studioKey: string }> {
  const normalizedName = input.name.trim();
  if (!normalizedName) {
    throw new Error("Studio name is required.");
  }

  const normalizedKey = (input.studioKey || normalizedName)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  if (!normalizedKey) {
    throw new Error("Studio key is required.");
  }

  const [created] = await db
    .insert(studios)
    .values({
      id: createId(),
      name: normalizedName,
      studioKey: normalizedKey,
      isActive: true,
      createdByUserId: input.actorUserId,
    })
    .returning({
      id: studios.id,
      name: studios.name,
      studioKey: studios.studioKey,
    });

  return created;
}

export async function inviteStudioOwnerByAdmin(input: {
  studioId: string;
  email: string;
  actorUserId: string;
  firstName?: string;
  lastName?: string;
}): Promise<{
  studioId: string;
  userId: string;
  membershipId: string;
  inviteEmail: string;
  status: StudioMembershipStatus;
}> {
  const inviteEmail = input.email.trim().toLowerCase();
  if (!inviteEmail) {
    throw new Error("Invite email is required.");
  }

  const targetStudio = await db
    .select({ id: studios.id })
    .from(studios)
    .where(or(eq(studios.id, input.studioId), eq(studios.studioKey, input.studioId)))
    .limit(1);

  if (!targetStudio[0]) {
    throw new Error("Studio not found.");
  }

  const existingUser = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, inviteEmail))
    .limit(1);

  const userId = existingUser[0]?.id || createId();

  if (!existingUser[0]) {
    await db.insert(users).values({
      id: userId,
      clerkUserId: null,
      email: inviteEmail,
      firstName: input.firstName?.trim() || null,
      lastName: input.lastName?.trim() || null,
      systemRole: "OWNER",
    });
  }

  const existingMembership = await db
    .select({ id: studioMemberships.id })
    .from(studioMemberships)
    .where(
      and(
        eq(studioMemberships.studioId, targetStudio[0].id),
        eq(studioMemberships.userId, userId),
      ),
    )
    .limit(1);

  if (existingMembership[0]) {
    const [updated] = await db
      .update(studioMemberships)
      .set({
        role: "OWNER",
        status: "invited",
        inviteEmail,
        invitedByUserId: input.actorUserId,
        updatedAt: new Date(),
      })
      .where(eq(studioMemberships.id, existingMembership[0].id))
      .returning();

    return {
      studioId: targetStudio[0].id,
      userId,
      membershipId: updated.id,
      inviteEmail,
      status: updated.status,
    };
  }

  const [created] = await db
    .insert(studioMemberships)
    .values({
      id: createId(),
      studioId: targetStudio[0].id,
      userId,
      role: "OWNER",
      status: "invited",
      inviteEmail,
      invitedByUserId: input.actorUserId,
    })
    .returning();

  return {
    studioId: targetStudio[0].id,
    userId,
    membershipId: created.id,
    inviteEmail,
    status: created.status,
  };
}

export function toLegacyActorRole(context: AuthContext): "owner" | "manager" | "staff" | "parent" {
  if (
    context.membershipRole === "FOUNDER" ||
    context.membershipRole === "SUPERADMIN" ||
    context.membershipRole === "OWNER"
  ) {
    return "owner";
  }

  if (context.membershipRole === "MANAGER") {
    return "manager";
  }

  if (context.membershipRole === "STAFF") {
    return "staff";
  }

  return "parent";
}
