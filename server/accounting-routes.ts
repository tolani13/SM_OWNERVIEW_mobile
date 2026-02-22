import type { Express, Request } from "express";
import crypto from "crypto";
import { and, asc, desc, eq, inArray, ne, sql } from "drizzle-orm";
import { db } from "./db";
import {
  accountingConnections,
  accountingSyncRecords,
  dancers,
  feeTypes,
  feeTypeValues,
  transactions,
  type AccountingConnection,
  type AccountingObjectType,
  type AccountingProvider,
  type AccountingSyncRecordStatus,
  type FeeType,
  type Transaction,
} from "./schema";

type ProviderSyncResult = {
  externalObjectType: AccountingObjectType;
  externalObjectId: string;
  raw?: unknown;
};

type OAuthStateRecord = {
  provider: AccountingProvider;
  studioKey: string;
  createdAt: number;
  activateOnConnect: boolean;
  codeVerifier?: string;
};

type SyncRunItem = {
  transactionId: string;
  status: "synced" | "failed" | "skipped";
  provider: AccountingProvider;
  externalObjectType?: AccountingObjectType;
  externalObjectId?: string;
  message?: string;
};

type PublicAccountingConnection = Omit<AccountingConnection, "accessToken" | "refreshToken"> & {
  hasAccessToken: boolean;
  hasRefreshToken: boolean;
};

const DEFAULT_STUDIO_KEY = "default";
const OAUTH_STATE_TTL_MS = 1000 * 60 * 10;
const oauthStateStore = new Map<string, OAuthStateRecord>();

const QUICKBOOKS_SCOPE_DEFAULT = "com.intuit.quickbooks.accounting openid profile email";
const XERO_SCOPE_DEFAULT =
  "openid profile email offline_access accounting.transactions accounting.contacts accounting.settings accounting.reports.read files";

const FEE_TYPE_LABEL_DEFAULTS: Record<FeeType, string> = {
  tuition: "Tuition",
  costume: "Costume",
  competition: "Competition Fee",
  recital: "Recital Fee",
  other: "Other",
};

function asProvider(value: unknown): AccountingProvider | null {
  if (value === "quickbooks" || value === "xero") return value;
  return null;
}

function getStudioKey(req: Request): string {
  const fromHeader = req.headers["x-studio-key"];
  if (typeof fromHeader === "string" && fromHeader.trim()) return fromHeader.trim();

  const fromQuery = req.query.studioKey;
  if (typeof fromQuery === "string" && fromQuery.trim()) return fromQuery.trim();

  const bodyStudio = (req.body as { studioKey?: unknown } | undefined)?.studioKey;
  if (typeof bodyStudio === "string" && bodyStudio.trim()) return bodyStudio.trim();

  return DEFAULT_STUDIO_KEY;
}

function boolFromUnknown(value: unknown, fallback = false): boolean {
  if (typeof value === "boolean") return value;
  if (typeof value === "string") {
    if (value.toLowerCase() === "true") return true;
    if (value.toLowerCase() === "false") return false;
  }
  return fallback;
}

function hasOwn(object: Record<string, unknown>, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(object, key);
}

function normalizeNullableText(value: unknown): string | null | undefined {
  if (value === null) return null;
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed.length ? trimmed : null;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function shouldReturnHtml(req: Request): boolean {
  const responseMode = typeof req.query.response === "string" ? req.query.response.toLowerCase() : "";
  if (responseMode === "json") return false;
  if (responseMode === "html") return true;

  const accept = req.headers.accept;
  return typeof accept === "string" && accept.includes("text/html");
}

function renderOAuthCallbackSuccessHtml(input: {
  providerLabel: string;
  studioKey: string;
  connectionLabel: string;
}): string {
  const provider = escapeHtml(input.providerLabel);
  const studioKey = escapeHtml(input.studioKey);
  const connectionLabel = escapeHtml(input.connectionLabel);

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${provider} Connected • Studio Maestro</title>
    <style>
      :root { color-scheme: light; }
      body { margin: 0; font-family: Inter, Segoe UI, Arial, sans-serif; background: #f7f8fa; color: #111827; }
      .wrap { max-width: 560px; margin: 8vh auto; background: #fff; border: 1px solid #e5e7eb; border-radius: 14px; overflow: hidden; box-shadow: 0 8px 24px rgba(16,24,40,.08); }
      .bar { height: 8px; background: #4f46e5; }
      .content { padding: 24px; }
      h1 { margin: 0 0 8px; font-size: 20px; }
      p { margin: 0 0 10px; line-height: 1.5; color: #374151; }
      .meta { margin-top: 14px; padding: 12px; border-radius: 10px; background: #f3f4f6; font-size: 13px; color: #374151; }
      .ok { display: inline-flex; align-items: center; gap: 6px; font-size: 12px; color: #166534; background: #dcfce7; border: 1px solid #bbf7d0; border-radius: 999px; padding: 4px 10px; }
      .foot { margin-top: 16px; font-size: 12px; color: #6b7280; }
    </style>
  </head>
  <body>
    <div class="wrap">
      <div class="bar"></div>
      <div class="content">
        <span class="ok">Connection established</span>
        <h1>${provider} authorization completed</h1>
        <p>${connectionLabel} is now connected to Studio Maestro and available for finance synchronization workflows.</p>
        <div class="meta">
          <div><strong>Studio key:</strong> ${studioKey}</div>
          <div><strong>Provider:</strong> ${provider}</div>
        </div>
        <p class="foot">You may close this window and return to Finance in the Studio Maestro application.</p>
      </div>
    </div>
    <script>
      try {
        if (window.opener && !window.opener.closed) {
          window.opener.postMessage({ type: "studio-maestro-accounting-connected" }, "*");
        }
      } catch {}
      setTimeout(() => window.close(), 1500);
    </script>
  </body>
</html>`;
}

function renderOAuthCallbackErrorHtml(input: {
  providerLabel: string;
  errorMessage: string;
}): string {
  const provider = escapeHtml(input.providerLabel);
  const errorMessage = escapeHtml(input.errorMessage);

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${provider} Connection Error • Studio Maestro</title>
    <style>
      body { margin: 0; font-family: Inter, Segoe UI, Arial, sans-serif; background: #f7f8fa; color: #111827; }
      .wrap { max-width: 560px; margin: 8vh auto; background: #fff; border: 1px solid #fecaca; border-radius: 14px; overflow: hidden; box-shadow: 0 8px 24px rgba(16,24,40,.08); }
      .bar { height: 8px; background: #dc2626; }
      .content { padding: 24px; }
      h1 { margin: 0 0 8px; font-size: 20px; }
      p { margin: 0 0 10px; line-height: 1.5; color: #374151; }
      .err { margin-top: 12px; padding: 12px; border-radius: 10px; background: #fef2f2; border: 1px solid #fecaca; font-size: 13px; color: #991b1b; }
      .foot { margin-top: 16px; font-size: 12px; color: #6b7280; }
    </style>
  </head>
  <body>
    <div class="wrap">
      <div class="bar"></div>
      <div class="content">
        <h1>${provider} authorization could not be completed</h1>
        <p>Studio Maestro was unable to finalize this provider connection. Review the details below and try again from Finance.</p>
        <div class="err">${errorMessage}</div>
        <p class="foot">You may close this window and return to Studio Maestro.</p>
      </div>
    </div>
    <script>
      try {
        if (window.opener && !window.opener.closed) {
          window.opener.postMessage({ type: "studio-maestro-accounting-connect-error" }, "*");
        }
      } catch {}
    </script>
  </body>
</html>`;
}

function cleanupOAuthStateStore() {
  const cutoff = Date.now() - OAUTH_STATE_TTL_MS;
  for (const [key, value] of oauthStateStore.entries()) {
    if (value.createdAt < cutoff) {
      oauthStateStore.delete(key);
    }
  }
}

function randomBase64Url(bytes = 32): string {
  return crypto
    .randomBytes(bytes)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function sha256Base64Url(value: string): string {
  return crypto
    .createHash("sha256")
    .update(value)
    .digest("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function hashFingerprint(value: string): string {
  return crypto.createHash("sha256").update(value).digest("hex");
}

function toIsoDate(value: unknown): string {
  if (typeof value === "string") {
    const parsed = Date.parse(value);
    if (!Number.isNaN(parsed)) return new Date(parsed).toISOString().slice(0, 10);
  }
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return new Date().toISOString().slice(0, 10);
}

function parseMoney(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return 0;
}

function quickbooksEnvironment(): "sandbox" | "production" {
  const env = (process.env.QUICKBOOKS_ENV || "sandbox").toLowerCase();
  return env === "production" ? "production" : "sandbox";
}

function quickbooksApiBase(realmId: string): string {
  if (quickbooksEnvironment() === "production") {
    return `https://quickbooks.api.intuit.com/v3/company/${realmId}`;
  }
  return `https://sandbox-quickbooks.api.intuit.com/v3/company/${realmId}`;
}

function requireEnvVar(name: string): string {
  const value = process.env[name];
  if (!value || !value.trim()) {
    throw new Error(`${name} is not configured`);
  }
  return value.trim();
}

async function getConnection(studioKey: string, provider: AccountingProvider): Promise<AccountingConnection | null> {
  const rows = await db
    .select()
    .from(accountingConnections)
    .where(and(eq(accountingConnections.studioKey, studioKey), eq(accountingConnections.provider, provider)));
  return rows[0] ?? null;
}

async function upsertConnection(
  studioKey: string,
  provider: AccountingProvider,
  patch: Partial<typeof accountingConnections.$inferInsert>,
): Promise<AccountingConnection> {
  const existing = await getConnection(studioKey, provider);

  if (existing) {
    const rows = await db
      .update(accountingConnections)
      .set({
        ...patch,
        updatedAt: new Date() as any,
      })
      .where(eq(accountingConnections.id, existing.id))
      .returning();
    return rows[0];
  }

  const rows = await db
    .insert(accountingConnections)
    .values({
      studioKey,
      provider,
      status: "disconnected",
      oauthType: provider === "xero" ? "oauth2_pkce" : "oauth2",
      ...patch,
      updatedAt: new Date() as any,
    })
    .returning();
  return rows[0];
}

async function setActiveProvider(studioKey: string, provider: AccountingProvider): Promise<void> {
  await db.transaction(async (tx) => {
    await tx
      .update(accountingConnections)
      .set({ isActive: false, updatedAt: new Date() as any })
      .where(eq(accountingConnections.studioKey, studioKey));

    await tx
      .update(accountingConnections)
      .set({ isActive: true, updatedAt: new Date() as any })
      .where(and(eq(accountingConnections.studioKey, studioKey), eq(accountingConnections.provider, provider)));
  });
}

async function getActiveConnection(studioKey: string, provider?: AccountingProvider): Promise<AccountingConnection | null> {
  if (provider) {
    return getConnection(studioKey, provider);
  }

  const activeRows = await db
    .select()
    .from(accountingConnections)
    .where(and(eq(accountingConnections.studioKey, studioKey), eq(accountingConnections.isActive, true)))
    .limit(1);

  if (activeRows[0]) return activeRows[0];

  const connectedRows = await db
    .select()
    .from(accountingConnections)
    .where(and(eq(accountingConnections.studioKey, studioKey), eq(accountingConnections.status, "connected")))
    .orderBy(desc(accountingConnections.updatedAt))
    .limit(1);

  return connectedRows[0] ?? null;
}

function buildQuickBooksAuthorizeUrl(state: string): string {
  const clientId = requireEnvVar("QUICKBOOKS_CLIENT_ID");
  const redirectUri = requireEnvVar("QUICKBOOKS_REDIRECT_URI");
  const scope = process.env.QUICKBOOKS_SCOPES?.trim() || QUICKBOOKS_SCOPE_DEFAULT;

  const params = new URLSearchParams({
    client_id: clientId,
    response_type: "code",
    scope,
    redirect_uri: redirectUri,
    state,
  });

  return `https://appcenter.intuit.com/connect/oauth2?${params.toString()}`;
}

async function exchangeQuickBooksCode(code: string): Promise<{
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  refreshExpiresIn: number;
  scope: string;
}> {
  const clientId = requireEnvVar("QUICKBOOKS_CLIENT_ID");
  const clientSecret = requireEnvVar("QUICKBOOKS_CLIENT_SECRET");
  const redirectUri = requireEnvVar("QUICKBOOKS_REDIRECT_URI");

  const body = new URLSearchParams({
    grant_type: "authorization_code",
    code,
    redirect_uri: redirectUri,
  });

  const auth = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");
  const response = await fetch("https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer", {
    method: "POST",
    headers: {
      Authorization: `Basic ${auth}`,
      "Content-Type": "application/x-www-form-urlencoded",
      Accept: "application/json",
    },
    body,
  });

  const json = (await response.json().catch(() => null)) as any;
  if (!response.ok || !json?.access_token || !json?.refresh_token) {
    throw new Error(`QuickBooks token exchange failed: ${json?.error_description || json?.error || response.statusText}`);
  }

  return {
    accessToken: String(json.access_token),
    refreshToken: String(json.refresh_token),
    expiresIn: Number(json.expires_in || 0),
    refreshExpiresIn: Number(json.x_refresh_token_expires_in || 0),
    scope: String(json.scope || ""),
  };
}

async function refreshQuickBooksToken(connection: AccountingConnection): Promise<AccountingConnection> {
  const clientId = requireEnvVar("QUICKBOOKS_CLIENT_ID");
  const clientSecret = requireEnvVar("QUICKBOOKS_CLIENT_SECRET");

  if (!connection.refreshToken) {
    throw new Error("QuickBooks refresh token is missing");
  }

  const body = new URLSearchParams({
    grant_type: "refresh_token",
    refresh_token: connection.refreshToken,
  });
  const auth = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");

  const response = await fetch("https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer", {
    method: "POST",
    headers: {
      Authorization: `Basic ${auth}`,
      "Content-Type": "application/x-www-form-urlencoded",
      Accept: "application/json",
    },
    body,
  });

  const json = (await response.json().catch(() => null)) as any;
  if (!response.ok || !json?.access_token || !json?.refresh_token) {
    throw new Error(`QuickBooks token refresh failed: ${json?.error_description || json?.error || response.statusText}`);
  }

  const now = Date.now();
  return upsertConnection(connection.studioKey, "quickbooks", {
    accessToken: String(json.access_token),
    refreshToken: String(json.refresh_token),
    tokenExpiresAt: new Date(now + Number(json.expires_in || 0) * 1000) as any,
    refreshTokenExpiresAt: new Date(now + Number(json.x_refresh_token_expires_in || 0) * 1000) as any,
    scope: String(json.scope || connection.scope || ""),
    status: "connected",
    lastError: null,
  });
}

function buildXeroAuthorizeUrl(state: string, codeChallenge: string): string {
  const clientId = requireEnvVar("XERO_CLIENT_ID");
  const redirectUri = requireEnvVar("XERO_REDIRECT_URI");
  const scope = process.env.XERO_SCOPES?.trim() || XERO_SCOPE_DEFAULT;

  const params = new URLSearchParams({
    response_type: "code",
    client_id: clientId,
    redirect_uri: redirectUri,
    scope,
    state,
    code_challenge: codeChallenge,
    code_challenge_method: "S256",
  });

  return `https://login.xero.com/identity/connect/authorize?${params.toString()}`;
}

async function exchangeXeroCode(code: string, codeVerifier: string): Promise<{
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  scope: string;
  idToken?: string;
}> {
  const clientId = requireEnvVar("XERO_CLIENT_ID");
  const redirectUri = requireEnvVar("XERO_REDIRECT_URI");

  const body = new URLSearchParams({
    grant_type: "authorization_code",
    client_id: clientId,
    code,
    code_verifier: codeVerifier,
    redirect_uri: redirectUri,
  });

  const response = await fetch("https://identity.xero.com/connect/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Accept: "application/json",
    },
    body,
  });

  const json = (await response.json().catch(() => null)) as any;
  if (!response.ok || !json?.access_token || !json?.refresh_token) {
    throw new Error(`Xero token exchange failed: ${json?.error_description || json?.error || response.statusText}`);
  }

  return {
    accessToken: String(json.access_token),
    refreshToken: String(json.refresh_token),
    expiresIn: Number(json.expires_in || 0),
    scope: String(json.scope || ""),
    idToken: typeof json.id_token === "string" ? json.id_token : undefined,
  };
}

async function refreshXeroToken(connection: AccountingConnection): Promise<AccountingConnection> {
  const clientId = requireEnvVar("XERO_CLIENT_ID");

  if (!connection.refreshToken) {
    throw new Error("Xero refresh token is missing");
  }

  const body = new URLSearchParams({
    grant_type: "refresh_token",
    refresh_token: connection.refreshToken,
    client_id: clientId,
  });

  const response = await fetch("https://identity.xero.com/connect/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Accept: "application/json",
    },
    body,
  });

  const json = (await response.json().catch(() => null)) as any;
  if (!response.ok || !json?.access_token || !json?.refresh_token) {
    throw new Error(`Xero token refresh failed: ${json?.error_description || json?.error || response.statusText}`);
  }

  const now = Date.now();
  return upsertConnection(connection.studioKey, "xero", {
    accessToken: String(json.access_token),
    refreshToken: String(json.refresh_token),
    tokenExpiresAt: new Date(now + Number(json.expires_in || 0) * 1000) as any,
    scope: String(json.scope || connection.scope || ""),
    status: "connected",
    lastError: null,
  });
}

async function fetchXeroTenants(accessToken: string): Promise<Array<{ tenantId: string; tenantName: string }>> {
  const response = await fetch("https://api.xero.com/connections", {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: "application/json",
    },
  });

  const json = (await response.json().catch(() => [])) as any[];
  if (!response.ok || !Array.isArray(json)) {
    throw new Error("Unable to fetch Xero tenant connections");
  }

  return json
    .filter((entry) => typeof entry?.tenantId === "string")
    .map((entry) => ({
      tenantId: String(entry.tenantId),
      tenantName: String(entry.tenantName || "Xero Tenant"),
    }));
}

async function ensureQuickBooksConnection(connection: AccountingConnection): Promise<AccountingConnection> {
  const expiresAt = connection.tokenExpiresAt ? new Date(connection.tokenExpiresAt).getTime() : 0;
  if (!connection.accessToken || !Number.isFinite(expiresAt) || expiresAt - Date.now() < 60_000) {
    return refreshQuickBooksToken(connection);
  }
  return connection;
}

async function ensureXeroConnection(connection: AccountingConnection): Promise<AccountingConnection> {
  const expiresAt = connection.tokenExpiresAt ? new Date(connection.tokenExpiresAt).getTime() : 0;
  if (!connection.accessToken || !Number.isFinite(expiresAt) || expiresAt - Date.now() < 60_000) {
    return refreshXeroToken(connection);
  }
  return connection;
}

async function quickBooksApiRequest(
  connection: AccountingConnection,
  method: string,
  path: string,
  body?: unknown,
): Promise<any> {
  if (!connection.realmId) {
    throw new Error("QuickBooks realmId is not connected");
  }

  const authenticated = await ensureQuickBooksConnection(connection);
  const realmId = authenticated.realmId || connection.realmId;
  if (!realmId) {
    throw new Error("QuickBooks realmId is not connected");
  }

  const url = `${quickbooksApiBase(realmId)}${path}`;

  const response = await fetch(url, {
    method,
    headers: {
      Authorization: `Bearer ${authenticated.accessToken}`,
      Accept: "application/json",
      ...(body ? { "Content-Type": "application/json" } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  const json = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(`QuickBooks API error (${response.status}): ${JSON.stringify(json)}`);
  }
  return json;
}

async function xeroApiRequest(
  connection: AccountingConnection,
  method: string,
  path: string,
  body?: unknown,
): Promise<any> {
  if (!connection.tenantId) {
    throw new Error("Xero tenant is not connected");
  }

  const authenticated = await ensureXeroConnection(connection);
  const tenantId = authenticated.tenantId || connection.tenantId;
  if (!tenantId) {
    throw new Error("Xero tenant is not connected");
  }

  const url = `https://api.xero.com/api.xro/2.0${path}`;

  const response = await fetch(url, {
    method,
    headers: {
      Authorization: `Bearer ${authenticated.accessToken}`,
      "xero-tenant-id": tenantId,
      Accept: "application/json",
      ...(body ? { "Content-Type": "application/json" } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  const json = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(`Xero API error (${response.status}): ${JSON.stringify(json)}`);
  }
  return json;
}

async function getFeeTypeDefaultsValue(feeTypeValue: FeeType) {
  const rows = await db.select().from(feeTypes).where(eq(feeTypes.feeType, feeTypeValue)).limit(1);
  return rows[0] ?? null;
}

async function ensureFeeTypeDefaultsSeedRows(): Promise<void> {
  await db.execute(sql`
    INSERT INTO "fee_types" ("fee_type", "label")
    VALUES
      ('tuition', 'Tuition'),
      ('costume', 'Costume'),
      ('competition', 'Competition Fee'),
      ('recital', 'Recital Fee'),
      ('other', 'Other')
    ON CONFLICT ("fee_type") DO NOTHING
  `);
}

async function getDancerDisplayName(dancerId: string): Promise<string> {
  const rows = await db
    .select({ firstName: dancers.firstName, lastName: dancers.lastName })
    .from(dancers)
    .where(eq(dancers.id, dancerId))
    .limit(1);
  const row = rows[0];
  if (!row) return `Dancer ${dancerId}`;
  return `${row.firstName} ${row.lastName}`.trim();
}

async function findLinkedInvoiceId(
  studioKey: string,
  provider: AccountingProvider,
  eventFeeId: string | null,
): Promise<string | null> {
  if (!eventFeeId) return null;

  const chargeRows = await db
    .select({ id: transactions.id })
    .from(transactions)
    .where(and(eq(transactions.eventFeeId, eventFeeId), eq(transactions.type, "charge")))
    .orderBy(desc(transactions.date))
    .limit(1);

  const chargeId = chargeRows[0]?.id;
  if (!chargeId) return null;

  const syncRows = await db
    .select({ externalObjectId: accountingSyncRecords.externalObjectId })
    .from(accountingSyncRecords)
    .where(
      and(
        eq(accountingSyncRecords.studioKey, studioKey),
        eq(accountingSyncRecords.provider, provider),
        eq(accountingSyncRecords.transactionId, chargeId),
        eq(accountingSyncRecords.status, "synced"),
        eq(accountingSyncRecords.externalObjectType, "invoice"),
      ),
    )
    .orderBy(desc(accountingSyncRecords.updatedAt))
    .limit(1);

  return syncRows[0]?.externalObjectId ?? null;
}

async function ensureQuickBooksCustomerId(connection: AccountingConnection, displayName: string): Promise<string> {
  const escapedName = displayName.replace(/'/g, "\\'");
  const query = `select * from Customer where DisplayName = '${escapedName}' maxresults 1`;
  const result = await quickBooksApiRequest(
    connection,
    "GET",
    `/query?query=${encodeURIComponent(query)}&minorversion=73`,
  );

  const existing = result?.QueryResponse?.Customer?.[0];
  if (existing?.Id) return String(existing.Id);

  const created = await quickBooksApiRequest(connection, "POST", "/customer?minorversion=73", {
    DisplayName: displayName,
  });

  const id = created?.Customer?.Id;
  if (!id) throw new Error("Failed to create QuickBooks customer");
  return String(id);
}

async function ensureXeroContactId(connection: AccountingConnection, name: string): Promise<string> {
  const escaped = name.replace(/"/g, '\\"');
  const existing = await xeroApiRequest(
    connection,
    "GET",
    `/Contacts?where=${encodeURIComponent(`Name==\"${escaped}\"`)}`,
  );

  const first = existing?.Contacts?.[0];
  if (first?.ContactID) return String(first.ContactID);

  const created = await xeroApiRequest(connection, "PUT", "/Contacts", {
    Contacts: [{ Name: name }],
  });

  const id = created?.Contacts?.[0]?.ContactID;
  if (!id) throw new Error("Failed to create Xero contact");
  return String(id);
}

function buildIdempotencyKey(studioKey: string, provider: AccountingProvider, tx: Transaction): string {
  const payload = [
    studioKey,
    provider,
    tx.id,
    tx.type,
    tx.feeType,
    String(tx.amount),
    tx.date ? new Date(tx.date as any).toISOString() : "",
  ].join("|");

  return hashFingerprint(payload);
}

function buildFingerprint(tx: Transaction): string {
  const payload = [
    tx.id,
    tx.dancerId,
    tx.type,
    tx.feeType,
    String(tx.amount),
    tx.description || "",
    tx.eventFeeId || "",
    tx.date ? new Date(tx.date as any).toISOString() : "",
  ].join("|");
  return hashFingerprint(payload);
}

async function syncToQuickBooks(
  studioKey: string,
  connection: AccountingConnection,
  tx: Transaction,
): Promise<ProviderSyncResult> {
  const dancerName = await getDancerDisplayName(tx.dancerId);
  const customerId = await ensureQuickBooksCustomerId(connection, dancerName);
  const defaults = await getFeeTypeDefaultsValue(tx.feeType);
  const amount = Number(parseMoney(tx.amount).toFixed(2));
  const txnDate = toIsoDate(tx.date);

  if (tx.type === "charge") {
    const itemId = tx.quickbooksItemId || defaults?.defaultQuickbooksItemId || process.env.QUICKBOOKS_DEFAULT_ITEM_ID;
    if (!itemId) {
      throw new Error(`Missing QuickBooks item mapping for fee type '${tx.feeType}'`);
    }

    const created = await quickBooksApiRequest(connection, "POST", "/invoice?minorversion=73", {
      CustomerRef: { value: customerId },
      TxnDate: txnDate,
      PrivateNote: `Studio Maestro transaction ${tx.id}`,
      Line: [
        {
          Amount: amount,
          Description: tx.description || `Studio Maestro ${tx.feeType} charge`,
          DetailType: "SalesItemLineDetail",
          SalesItemLineDetail: {
            ItemRef: { value: itemId },
            Qty: 1,
            UnitPrice: amount,
          },
        },
      ],
    });

    const invoiceId = created?.Invoice?.Id;
    if (!invoiceId) {
      throw new Error("QuickBooks invoice creation did not return an invoice id");
    }

    return {
      externalObjectType: "invoice",
      externalObjectId: String(invoiceId),
      raw: created,
    };
  }

  const accountId =
    tx.quickbooksAccountId ||
    defaults?.defaultQuickbooksAccountId ||
    process.env.QUICKBOOKS_DEFAULT_DEPOSIT_ACCOUNT_ID;

  if (!accountId) {
    throw new Error(`Missing QuickBooks payment account mapping for fee type '${tx.feeType}'`);
  }

  const linkedInvoiceId = await findLinkedInvoiceId(studioKey, "quickbooks", tx.eventFeeId ?? null);
  if (linkedInvoiceId) {
    const payment = await quickBooksApiRequest(connection, "POST", "/payment?minorversion=73", {
      CustomerRef: { value: customerId },
      TotalAmt: amount,
      TxnDate: txnDate,
      DepositToAccountRef: { value: accountId },
      Line: [
        {
          Amount: amount,
          LinkedTxn: [{ TxnId: linkedInvoiceId, TxnType: "Invoice" }],
        },
      ],
    });

    const paymentId = payment?.Payment?.Id;
    if (!paymentId) {
      throw new Error("QuickBooks payment creation did not return a payment id");
    }

    return {
      externalObjectType: "payment",
      externalObjectId: String(paymentId),
      raw: payment,
    };
  }

  const itemId = tx.quickbooksItemId || defaults?.defaultQuickbooksItemId || process.env.QUICKBOOKS_DEFAULT_ITEM_ID;
  if (!itemId) {
    throw new Error(`Missing QuickBooks item mapping for fee type '${tx.feeType}'`);
  }

  const salesReceipt = await quickBooksApiRequest(connection, "POST", "/salesreceipt?minorversion=73", {
    CustomerRef: { value: customerId },
    TxnDate: txnDate,
    DepositToAccountRef: { value: accountId },
    PrivateNote: `Studio Maestro payment ${tx.id}`,
    Line: [
      {
        Amount: amount,
        Description: tx.description || `Studio Maestro ${tx.feeType} payment`,
        DetailType: "SalesItemLineDetail",
        SalesItemLineDetail: {
          ItemRef: { value: itemId },
          Qty: 1,
          UnitPrice: amount,
        },
      },
    ],
  });

  const receiptId = salesReceipt?.SalesReceipt?.Id;
  if (!receiptId) {
    throw new Error("QuickBooks sales receipt creation did not return an id");
  }

  return {
    externalObjectType: "payment",
    externalObjectId: String(receiptId),
    raw: salesReceipt,
  };
}

async function syncToXero(
  studioKey: string,
  connection: AccountingConnection,
  tx: Transaction,
): Promise<ProviderSyncResult> {
  const dancerName = await getDancerDisplayName(tx.dancerId);
  const contactId = await ensureXeroContactId(connection, dancerName);
  const defaults = await getFeeTypeDefaultsValue(tx.feeType);
  const amount = Number(parseMoney(tx.amount).toFixed(2));
  const txnDate = toIsoDate(tx.date);

  if (tx.type === "charge") {
    const revenueAccountCode =
      defaults?.defaultXeroRevenueAccountCode || process.env.XERO_DEFAULT_REVENUE_ACCOUNT_CODE;

    if (!revenueAccountCode) {
      throw new Error(`Missing Xero revenue account code mapping for fee type '${tx.feeType}'`);
    }

    const created = await xeroApiRequest(connection, "POST", "/Invoices", {
      Invoices: [
        {
          Type: "ACCREC",
          Status: "AUTHORISED",
          Contact: { ContactID: contactId },
          Date: txnDate,
          DueDate: txnDate,
          Reference: `SM-${tx.id}`,
          LineAmountTypes: "Exclusive",
          LineItems: [
            {
              Description: tx.description || `Studio Maestro ${tx.feeType} charge`,
              Quantity: 1,
              UnitAmount: amount,
              AccountCode: revenueAccountCode,
            },
          ],
        },
      ],
    });

    const invoiceId = created?.Invoices?.[0]?.InvoiceID;
    if (!invoiceId) {
      throw new Error("Xero invoice creation did not return an invoice id");
    }

    return {
      externalObjectType: "invoice",
      externalObjectId: String(invoiceId),
      raw: created,
    };
  }

  const paymentAccountCode =
    defaults?.defaultXeroPaymentAccountCode || process.env.XERO_DEFAULT_PAYMENT_ACCOUNT_CODE;

  if (!paymentAccountCode) {
    throw new Error(`Missing Xero payment account code mapping for fee type '${tx.feeType}'`);
  }

  const linkedInvoiceId = await findLinkedInvoiceId(studioKey, "xero", tx.eventFeeId ?? null);
  if (!linkedInvoiceId) {
    throw new Error(
      "No linked synced invoice found for this payment. Sync the related charge first or attach payment to an event fee.",
    );
  }

  const payment = await xeroApiRequest(connection, "POST", "/Payments", {
    Payments: [
      {
        Invoice: { InvoiceID: linkedInvoiceId },
        Account: { Code: paymentAccountCode },
        Contact: { ContactID: contactId },
        Date: txnDate,
        Amount: amount,
        Reference: tx.description || `Studio Maestro payment ${tx.id}`,
      },
    ],
  });

  const paymentId = payment?.Payments?.[0]?.PaymentID;
  if (!paymentId) {
    throw new Error("Xero payment creation did not return a payment id");
  }

  return {
    externalObjectType: "payment",
    externalObjectId: String(paymentId),
    raw: payment,
  };
}

async function syncTransactionWithProvider(
  studioKey: string,
  connection: AccountingConnection,
  tx: Transaction,
  dryRun: boolean,
): Promise<ProviderSyncResult> {
  if (dryRun) {
    return {
      externalObjectType: tx.type === "charge" ? "invoice" : "payment",
      externalObjectId: `dry_${connection.provider}_${tx.id}`,
      raw: { dryRun: true },
    };
  }

  if (connection.provider === "quickbooks") {
    return syncToQuickBooks(studioKey, connection, tx);
  }

  return syncToXero(studioKey, connection, tx);
}

async function syncTransactions(
  studioKey: string,
  connection: AccountingConnection,
  transactionsToSync: Transaction[],
  dryRun: boolean,
): Promise<SyncRunItem[]> {
  const results: SyncRunItem[] = [];

  for (const txRow of transactionsToSync) {
    const provider = connection.provider;
    const idempotencyKey = buildIdempotencyKey(studioKey, provider, txRow);
    const fingerprint = buildFingerprint(txRow);

    const existingSyncRows = await db
      .select()
      .from(accountingSyncRecords)
      .where(
        and(
          eq(accountingSyncRecords.studioKey, studioKey),
          eq(accountingSyncRecords.provider, provider),
          eq(accountingSyncRecords.idempotencyKey, idempotencyKey),
        ),
      )
      .limit(1);

    const existingSync = existingSyncRows[0] ?? null;
    if (existingSync?.status === "synced" && existingSync.externalObjectId) {
      results.push({
        transactionId: txRow.id,
        provider,
        status: "skipped",
        externalObjectType: existingSync.externalObjectType,
        externalObjectId: existingSync.externalObjectId,
        message: "Already synced with same idempotency key",
      });
      continue;
    }

    const retryCount = (existingSync?.retryCount || 0) + 1;

    const pendingPayload = {
      studioKey,
      provider,
      connectionId: connection.id,
      transactionId: txRow.id,
      externalObjectType: (txRow.type === "charge" ? "invoice" : "payment") as AccountingObjectType,
      idempotencyKey,
      fingerprint,
      status: "pending" as AccountingSyncRecordStatus,
      retryCount,
      lastError: null,
      updatedAt: new Date() as any,
    };

    if (existingSync) {
      await db
        .update(accountingSyncRecords)
        .set(pendingPayload)
        .where(eq(accountingSyncRecords.id, existingSync.id));
    } else {
      await db.insert(accountingSyncRecords).values({
        ...pendingPayload,
        createdAt: new Date() as any,
      });
    }

    try {
      const syncResult = await syncTransactionWithProvider(studioKey, connection, txRow, dryRun);

      await db
        .update(accountingSyncRecords)
        .set({
          status: "synced",
          externalObjectType: syncResult.externalObjectType,
          externalObjectId: syncResult.externalObjectId,
          syncedAt: new Date() as any,
          lastError: null,
          updatedAt: new Date() as any,
        })
        .where(
          and(
            eq(accountingSyncRecords.studioKey, studioKey),
            eq(accountingSyncRecords.provider, provider),
            eq(accountingSyncRecords.idempotencyKey, idempotencyKey),
          ),
        );

      await db
        .update(transactions)
        .set({
          syncStatus: "synced",
          updatedAt: new Date() as any,
        })
        .where(eq(transactions.id, txRow.id));

      await db
        .update(accountingConnections)
        .set({
          lastSyncedAt: new Date() as any,
          lastError: null,
          status: "connected",
          updatedAt: new Date() as any,
        })
        .where(eq(accountingConnections.id, connection.id));

      results.push({
        transactionId: txRow.id,
        provider,
        status: "synced",
        externalObjectType: syncResult.externalObjectType,
        externalObjectId: syncResult.externalObjectId,
      });
    } catch (error: any) {
      const message = error?.message || "Sync failed";

      await db
        .update(accountingSyncRecords)
        .set({
          status: "failed",
          lastError: message,
          updatedAt: new Date() as any,
        })
        .where(
          and(
            eq(accountingSyncRecords.studioKey, studioKey),
            eq(accountingSyncRecords.provider, provider),
            eq(accountingSyncRecords.idempotencyKey, idempotencyKey),
          ),
        );

      await db
        .update(transactions)
        .set({
          syncStatus: "failed",
          updatedAt: new Date() as any,
        })
        .where(eq(transactions.id, txRow.id));

      await db
        .update(accountingConnections)
        .set({
          lastError: message,
          status: "error",
          updatedAt: new Date() as any,
        })
        .where(eq(accountingConnections.id, connection.id));

      results.push({
        transactionId: txRow.id,
        provider,
        status: "failed",
        message,
      });
    }
  }

  return results;
}

async function getTransactionsForSync(studioKey: string, options: { transactionIds?: string[]; limit: number }) {
  if (options.transactionIds?.length) {
    return db.select().from(transactions).where(inArray(transactions.id, options.transactionIds));
  }

  const rows = await db
    .select()
    .from(transactions)
    .where(ne(transactions.syncStatus, "synced"))
    .orderBy(asc(transactions.date), asc(transactions.createdAt))
    .limit(options.limit);

  return rows;
}

function parseTransactionIds(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((entry): entry is string => typeof entry === "string" && entry.trim().length > 0);
}

function toPublicConnection(connection: AccountingConnection): PublicAccountingConnection {
  const { accessToken, refreshToken, ...rest } = connection;
  return {
    ...rest,
    hasAccessToken: Boolean(accessToken),
    hasRefreshToken: Boolean(refreshToken),
  };
}

async function retryFailedSyncRecords(studioKey: string, provider?: AccountingProvider): Promise<{
  retried: number;
  failedRecordIds: string[];
}> {
  const conditions = [
    eq(accountingSyncRecords.studioKey, studioKey),
    eq(accountingSyncRecords.status, "failed"),
  ];

  if (provider) {
    conditions.push(eq(accountingSyncRecords.provider, provider));
  }

  const failedRows = await db
    .select({ id: accountingSyncRecords.id, transactionId: accountingSyncRecords.transactionId })
    .from(accountingSyncRecords)
    .where(and(...conditions))
    .orderBy(desc(accountingSyncRecords.updatedAt))
    .limit(500);

  if (!failedRows.length) {
    return { retried: 0, failedRecordIds: [] };
  }

  const transactionIds = Array.from(new Set(failedRows.map((row) => row.transactionId)));

  await db
    .update(transactions)
    .set({
      syncStatus: "pending",
      updatedAt: new Date() as any,
    })
    .where(inArray(transactions.id, transactionIds));

  await db
    .update(accountingSyncRecords)
    .set({
      status: "pending",
      lastError: null,
      updatedAt: new Date() as any,
    })
    .where(inArray(accountingSyncRecords.id, failedRows.map((row) => row.id)));

  return {
    retried: transactionIds.length,
    failedRecordIds: failedRows.map((row) => row.id),
  };
}

export function registerAccountingRoutes(app: Express): void {
  app.get("/api/accounting/connections", async (req, res) => {
    try {
      const studioKey = getStudioKey(req);
      const rows = await db
        .select()
        .from(accountingConnections)
        .where(eq(accountingConnections.studioKey, studioKey))
        .orderBy(asc(accountingConnections.provider));

      res.json(rows.map(toPublicConnection));
    } catch (error: any) {
      console.error("List accounting connections error:", error);
      res.status(500).json({ error: error?.message || "Failed to list accounting connections" });
    }
  });

  app.post("/api/accounting/connect/:provider", async (req, res) => {
    try {
      cleanupOAuthStateStore();

      const provider = asProvider(req.params.provider);
      if (!provider) {
        return res.status(400).json({ error: "provider must be 'quickbooks' or 'xero'" });
      }

      const studioKey = getStudioKey(req);
      const activateOnConnect = boolFromUnknown((req.body as any)?.activateOnConnect, true);
      const state = randomBase64Url(24);

      if (provider === "quickbooks") {
        const authUrl = buildQuickBooksAuthorizeUrl(state);
        oauthStateStore.set(state, {
          provider,
          studioKey,
          createdAt: Date.now(),
          activateOnConnect,
        });

        return res.json({ provider, authUrl, state });
      }

      const codeVerifier = randomBase64Url(64);
      const codeChallenge = sha256Base64Url(codeVerifier);
      const authUrl = buildXeroAuthorizeUrl(state, codeChallenge);

      oauthStateStore.set(state, {
        provider,
        studioKey,
        createdAt: Date.now(),
        activateOnConnect,
        codeVerifier,
      });

      res.json({ provider, authUrl, state });
    } catch (error: any) {
      console.error("Start accounting connect error:", error);
      res.status(400).json({ error: error?.message || "Failed to build provider authorization URL" });
    }
  });

  app.get("/api/accounting/fee-type-defaults", async (_req, res) => {
    try {
      await ensureFeeTypeDefaultsSeedRows();
      const rows = await db.select().from(feeTypes).orderBy(asc(feeTypes.feeType));
      res.json(rows);
    } catch (error: any) {
      console.error("List accounting fee type defaults error:", error);
      res.status(500).json({ error: error?.message || "Failed to list fee type defaults" });
    }
  });

  app.patch("/api/accounting/fee-type-defaults/:feeType", async (req, res) => {
    try {
      const rawFeeType = typeof req.params.feeType === "string" ? req.params.feeType.toLowerCase() : "";
      if (!feeTypeValues.includes(rawFeeType as FeeType)) {
        return res.status(400).json({ error: "Invalid feeType. Must be one of tuition|costume|competition|recital|other" });
      }

      const feeType = rawFeeType as FeeType;
      const body = ((req.body ?? {}) as Record<string, unknown>);

      await ensureFeeTypeDefaultsSeedRows();

      const [existing] = await db
        .select()
        .from(feeTypes)
        .where(eq(feeTypes.feeType, feeType))
        .limit(1);

      if (!existing) {
        await db.insert(feeTypes).values({
          feeType,
          label: FEE_TYPE_LABEL_DEFAULTS[feeType],
          updatedAt: new Date() as any,
        });
      }

      const patch: Record<string, unknown> = {
        updatedAt: new Date() as any,
      };

      if (hasOwn(body, "label") && typeof body.label === "string") {
        const trimmed = body.label.trim();
        patch.label = trimmed.length ? trimmed : FEE_TYPE_LABEL_DEFAULTS[feeType];
      }

      const qbItem = normalizeNullableText(body.defaultQuickbooksItemId);
      if (qbItem !== undefined) patch.defaultQuickbooksItemId = qbItem;

      const qbAccount = normalizeNullableText(body.defaultQuickbooksAccountId);
      if (qbAccount !== undefined) patch.defaultQuickbooksAccountId = qbAccount;

      const xeroRevenue = normalizeNullableText(body.defaultXeroRevenueAccountCode);
      if (xeroRevenue !== undefined) patch.defaultXeroRevenueAccountCode = xeroRevenue;

      const xeroPayment = normalizeNullableText(body.defaultXeroPaymentAccountCode);
      if (xeroPayment !== undefined) patch.defaultXeroPaymentAccountCode = xeroPayment;

      const waveIncome = normalizeNullableText(body.defaultWaveIncomeAccountId);
      if (waveIncome !== undefined) patch.defaultWaveIncomeAccountId = waveIncome;

      const [updated] = await db
        .update(feeTypes)
        .set(patch)
        .where(eq(feeTypes.feeType, feeType))
        .returning();

      res.json(updated);
    } catch (error: any) {
      console.error("Update accounting fee type default error:", error);
      res.status(500).json({ error: error?.message || "Failed to update fee type default" });
    }
  });

  app.get("/api/accounting/callback/quickbooks", async (req, res) => {
    try {
      cleanupOAuthStateStore();

      const stateParam = typeof req.query.state === "string" ? req.query.state : "";
      const code = typeof req.query.code === "string" ? req.query.code : "";
      const realmId = typeof req.query.realmId === "string" ? req.query.realmId : "";
      const oauthError = typeof req.query.error === "string" ? req.query.error : "";

      if (oauthError) {
        const errorMessage = `QuickBooks OAuth error: ${oauthError}`;
        if (shouldReturnHtml(req)) {
          return res.status(400).type("html").send(
            renderOAuthCallbackErrorHtml({
              providerLabel: "QuickBooks",
              errorMessage,
            }),
          );
        }
        return res.status(400).json({ error: errorMessage });
      }

      const stateRecord = oauthStateStore.get(stateParam);
      oauthStateStore.delete(stateParam);

      if (!stateRecord || stateRecord.provider !== "quickbooks") {
        const errorMessage = "Invalid or expired OAuth state for QuickBooks";
        if (shouldReturnHtml(req)) {
          return res.status(400).type("html").send(
            renderOAuthCallbackErrorHtml({
              providerLabel: "QuickBooks",
              errorMessage,
            }),
          );
        }
        return res.status(400).json({ error: errorMessage });
      }

      if (!code) {
        const errorMessage = "Missing authorization code from QuickBooks";
        if (shouldReturnHtml(req)) {
          return res.status(400).type("html").send(
            renderOAuthCallbackErrorHtml({
              providerLabel: "QuickBooks",
              errorMessage,
            }),
          );
        }
        return res.status(400).json({ error: errorMessage });
      }

      const token = await exchangeQuickBooksCode(code);
      const now = Date.now();

      await upsertConnection(stateRecord.studioKey, "quickbooks", {
        oauthType: "oauth2",
        status: "connected",
        realmId: realmId || null,
        accessToken: token.accessToken,
        refreshToken: token.refreshToken,
        scope: token.scope,
        tokenExpiresAt: new Date(now + token.expiresIn * 1000) as any,
        refreshTokenExpiresAt: new Date(now + token.refreshExpiresIn * 1000) as any,
        lastError: null,
      });

      if (stateRecord.activateOnConnect) {
        await setActiveProvider(stateRecord.studioKey, "quickbooks");
      }

      const payload = {
        success: true,
        provider: "quickbooks",
        studioKey: stateRecord.studioKey,
        realmId: realmId || null,
      };

      if (shouldReturnHtml(req)) {
        const connectionLabel = realmId
          ? `QuickBooks realm ${realmId}`
          : "QuickBooks";
        return res
          .status(200)
          .type("html")
          .send(
            renderOAuthCallbackSuccessHtml({
              providerLabel: "QuickBooks",
              studioKey: stateRecord.studioKey,
              connectionLabel,
            }),
          );
      }

      res.json(payload);
    } catch (error: any) {
      console.error("QuickBooks callback error:", error);
      const errorMessage = error?.message || "QuickBooks callback failed";
      if (shouldReturnHtml(req)) {
        return res.status(400).type("html").send(
          renderOAuthCallbackErrorHtml({
            providerLabel: "QuickBooks",
            errorMessage,
          }),
        );
      }
      res.status(400).json({ error: errorMessage });
    }
  });

  app.get("/api/accounting/callback/xero", async (req, res) => {
    try {
      cleanupOAuthStateStore();

      const stateParam = typeof req.query.state === "string" ? req.query.state : "";
      const code = typeof req.query.code === "string" ? req.query.code : "";
      const oauthError = typeof req.query.error === "string" ? req.query.error : "";
      const requestedTenantId = typeof req.query.tenantId === "string" ? req.query.tenantId : "";

      if (oauthError) {
        const errorMessage = `Xero OAuth error: ${oauthError}`;
        if (shouldReturnHtml(req)) {
          return res.status(400).type("html").send(
            renderOAuthCallbackErrorHtml({
              providerLabel: "Xero",
              errorMessage,
            }),
          );
        }
        return res.status(400).json({ error: errorMessage });
      }

      const stateRecord = oauthStateStore.get(stateParam);
      oauthStateStore.delete(stateParam);

      if (!stateRecord || stateRecord.provider !== "xero") {
        const errorMessage = "Invalid or expired OAuth state for Xero";
        if (shouldReturnHtml(req)) {
          return res.status(400).type("html").send(
            renderOAuthCallbackErrorHtml({
              providerLabel: "Xero",
              errorMessage,
            }),
          );
        }
        return res.status(400).json({ error: errorMessage });
      }

      if (!code || !stateRecord.codeVerifier) {
        const errorMessage = "Missing authorization code or PKCE verifier for Xero";
        if (shouldReturnHtml(req)) {
          return res.status(400).type("html").send(
            renderOAuthCallbackErrorHtml({
              providerLabel: "Xero",
              errorMessage,
            }),
          );
        }
        return res.status(400).json({ error: errorMessage });
      }

      const token = await exchangeXeroCode(code, stateRecord.codeVerifier);
      const tenantConnections = await fetchXeroTenants(token.accessToken);

      if (!tenantConnections.length) {
        throw new Error("No Xero tenants were returned for this authorization");
      }

      const selectedTenant =
        tenantConnections.find((tenant) => tenant.tenantId === requestedTenantId) || tenantConnections[0];

      const now = Date.now();
      await upsertConnection(stateRecord.studioKey, "xero", {
        oauthType: "oauth2_pkce",
        status: "connected",
        tenantId: selectedTenant.tenantId,
        tenantName: selectedTenant.tenantName,
        accessToken: token.accessToken,
        refreshToken: token.refreshToken,
        scope: token.scope,
        tokenExpiresAt: new Date(now + token.expiresIn * 1000) as any,
        lastError: null,
      });

      if (stateRecord.activateOnConnect) {
        await setActiveProvider(stateRecord.studioKey, "xero");
      }

      const payload = {
        success: true,
        provider: "xero",
        studioKey: stateRecord.studioKey,
        tenantId: selectedTenant.tenantId,
        tenantName: selectedTenant.tenantName,
        availableTenants: tenantConnections,
      };

      if (shouldReturnHtml(req)) {
        return res
          .status(200)
          .type("html")
          .send(
            renderOAuthCallbackSuccessHtml({
              providerLabel: "Xero",
              studioKey: stateRecord.studioKey,
              connectionLabel: selectedTenant.tenantName || selectedTenant.tenantId,
            }),
          );
      }

      res.json(payload);
    } catch (error: any) {
      console.error("Xero callback error:", error);
      const errorMessage = error?.message || "Xero callback failed";
      if (shouldReturnHtml(req)) {
        return res.status(400).type("html").send(
          renderOAuthCallbackErrorHtml({
            providerLabel: "Xero",
            errorMessage,
          }),
        );
      }
      res.status(400).json({ error: errorMessage });
    }
  });

  app.post("/api/accounting/activate/:provider", async (req, res) => {
    try {
      const provider = asProvider(req.params.provider);
      if (!provider) {
        return res.status(400).json({ error: "provider must be 'quickbooks' or 'xero'" });
      }

      const studioKey = getStudioKey(req);
      const connection = await getConnection(studioKey, provider);

      if (!connection || connection.status !== "connected") {
        return res.status(400).json({ error: `${provider} is not connected for studio '${studioKey}'` });
      }

      await setActiveProvider(studioKey, provider);
      const updatedConnections = await db
        .select()
        .from(accountingConnections)
        .where(eq(accountingConnections.studioKey, studioKey))
        .orderBy(asc(accountingConnections.provider));

      res.json({
        success: true,
        activeProvider: provider,
        connections: updatedConnections.map(toPublicConnection),
      });
    } catch (error: any) {
      console.error("Activate accounting provider error:", error);
      res.status(500).json({ error: error?.message || "Failed to activate provider" });
    }
  });

  app.post("/api/accounting/disconnect/:provider", async (req, res) => {
    try {
      const provider = asProvider(req.params.provider);
      if (!provider) {
        return res.status(400).json({ error: "provider must be 'quickbooks' or 'xero'" });
      }

      const studioKey = getStudioKey(req);
      const connection = await getConnection(studioKey, provider);
      if (!connection) {
        return res.status(404).json({ error: `${provider} connection not found for studio '${studioKey}'` });
      }

      await db
        .update(accountingConnections)
        .set({
          isActive: false,
          status: "disconnected",
          accessToken: null,
          refreshToken: null,
          tokenExpiresAt: null,
          refreshTokenExpiresAt: null,
          scope: null,
          realmId: null,
          tenantId: null,
          tenantName: null,
          externalUserId: null,
          lastError: null,
          updatedAt: new Date() as any,
        })
        .where(eq(accountingConnections.id, connection.id));

      res.json({ success: true, provider, studioKey });
    } catch (error: any) {
      console.error("Disconnect accounting provider error:", error);
      res.status(500).json({ error: error?.message || "Failed to disconnect provider" });
    }
  });

  app.get("/api/accounting/sync-records", async (req, res) => {
    try {
      const studioKey = getStudioKey(req);
      const provider = asProvider(req.query.provider);
      const status = typeof req.query.status === "string" ? req.query.status : undefined;
      const limit = Math.max(1, Math.min(500, Number(req.query.limit || 100)));

      const conditions = [eq(accountingSyncRecords.studioKey, studioKey)];
      if (provider) conditions.push(eq(accountingSyncRecords.provider, provider));
      if (status && ["pending", "synced", "failed", "skipped"].includes(status)) {
        conditions.push(eq(accountingSyncRecords.status, status as AccountingSyncRecordStatus));
      }

      const rows = await db
        .select()
        .from(accountingSyncRecords)
        .where(and(...conditions))
        .orderBy(desc(accountingSyncRecords.updatedAt))
        .limit(limit);

      res.json(rows);
    } catch (error: any) {
      console.error("List accounting sync records error:", error);
      res.status(500).json({ error: error?.message || "Failed to list accounting sync records" });
    }
  });

  app.post("/api/accounting/sync/retry-failed", async (req, res) => {
    try {
      const studioKey = getStudioKey(req);
      const provider = asProvider((req.body as any)?.provider ?? req.query.provider);

      const retryResult = await retryFailedSyncRecords(studioKey, provider ?? undefined);

      if (retryResult.retried === 0) {
        return res.json({
          success: true,
          retried: 0,
          synced: 0,
          failed: 0,
          skipped: 0,
          provider: provider ?? null,
          results: [],
          message: "No failed sync records found.",
        });
      }

      const activeConnection = await getActiveConnection(studioKey, provider ?? undefined);
      if (!activeConnection || activeConnection.status !== "connected") {
        return res.status(400).json({
          error:
            "Failed records were reset to pending, but no connected provider is active for retry execution.",
          retried: retryResult.retried,
        });
      }

      const toSync = await getTransactionsForSync(studioKey, {
        limit: Math.min(200, Math.max(1, retryResult.retried)),
      });

      const results = await syncTransactions(studioKey, activeConnection, toSync, false);
      const summary = {
        synced: results.filter((r) => r.status === "synced").length,
        failed: results.filter((r) => r.status === "failed").length,
        skipped: results.filter((r) => r.status === "skipped").length,
      };

      res.json({
        success: summary.failed === 0,
        retried: retryResult.retried,
        provider: activeConnection.provider,
        ...summary,
        results,
      });
    } catch (error: any) {
      console.error("Retry failed sync records error:", error);
      res.status(500).json({ error: error?.message || "Failed to retry failed sync records" });
    }
  });

  app.get("/api/accounting/reconciliation-summary", async (req, res) => {
    try {
      const studioKey = getStudioKey(req);
      const provider = asProvider(req.query.provider);

      const syncedRows = await db
        .select({
          provider: accountingSyncRecords.provider,
          transactionId: accountingSyncRecords.transactionId,
          amount: transactions.amount,
          type: transactions.type,
        })
        .from(accountingSyncRecords)
        .innerJoin(transactions, eq(transactions.id, accountingSyncRecords.transactionId))
        .where(
          and(
            eq(accountingSyncRecords.studioKey, studioKey),
            eq(accountingSyncRecords.status, "synced"),
            ...(provider ? [eq(accountingSyncRecords.provider, provider)] : []),
          ),
        );

      const pendingRows = await db
        .select({
          id: transactions.id,
          amount: transactions.amount,
          type: transactions.type,
          feeType: transactions.feeType,
          syncStatus: transactions.syncStatus,
          updatedAt: transactions.updatedAt,
        })
        .from(transactions)
        .where(ne(transactions.syncStatus, "synced"))
        .orderBy(desc(transactions.updatedAt))
        .limit(50);

      let syncedChargeTotal = 0;
      let syncedPaymentTotal = 0;
      for (const row of syncedRows) {
        const amount = parseMoney(row.amount);
        if (row.type === "charge") syncedChargeTotal += amount;
        if (row.type === "payment") syncedPaymentTotal += amount;
      }

      res.json({
        studioKey,
        provider: provider ?? null,
        syncedCounts: {
          total: syncedRows.length,
          charges: syncedRows.filter((row) => row.type === "charge").length,
          payments: syncedRows.filter((row) => row.type === "payment").length,
        },
        syncedTotals: {
          charges: Number(syncedChargeTotal.toFixed(2)),
          payments: Number(syncedPaymentTotal.toFixed(2)),
          net: Number((syncedChargeTotal - syncedPaymentTotal).toFixed(2)),
        },
        outstanding: {
          count: pendingRows.length,
          total: Number(
            pendingRows
              .reduce((sum, row) => sum + parseMoney(row.amount), 0)
              .toFixed(2),
          ),
          items: pendingRows,
        },
      });
    } catch (error: any) {
      console.error("Reconciliation summary error:", error);
      res.status(500).json({ error: error?.message || "Failed to load reconciliation summary" });
    }
  });

  app.post("/api/accounting/sync/run", async (req, res) => {
    try {
      const studioKey = getStudioKey(req);
      const provider = asProvider((req.body as any)?.provider ?? req.query.provider);

      const connection = await getActiveConnection(studioKey, provider ?? undefined);
      if (!connection) {
        return res.status(400).json({ error: "No connected accounting provider found for this studio" });
      }

      if (connection.status !== "connected") {
        return res.status(400).json({ error: `Provider '${connection.provider}' is not connected` });
      }

      const requestedIds = parseTransactionIds((req.body as any)?.transactionIds);
      const limitRaw = Number((req.body as any)?.limit ?? req.query.limit ?? 50);
      const limit = Number.isFinite(limitRaw) ? Math.max(1, Math.min(200, Math.trunc(limitRaw))) : 50;
      const dryRun = boolFromUnknown(
        (req.body as any)?.dryRun,
        boolFromUnknown(process.env.ACCOUNTING_SYNC_DRY_RUN, false),
      );

      const toSync = await getTransactionsForSync(studioKey, {
        transactionIds: requestedIds.length ? requestedIds : undefined,
        limit,
      });

      if (!toSync.length) {
        return res.json({
          success: true,
          provider: connection.provider,
          dryRun,
          synced: 0,
          failed: 0,
          skipped: 0,
          results: [],
        });
      }

      const results = await syncTransactions(studioKey, connection, toSync, dryRun);

      const summary = {
        synced: results.filter((r) => r.status === "synced").length,
        failed: results.filter((r) => r.status === "failed").length,
        skipped: results.filter((r) => r.status === "skipped").length,
      };

      res.json({
        success: summary.failed === 0,
        provider: connection.provider,
        dryRun,
        ...summary,
        results,
      });
    } catch (error: any) {
      console.error("Run accounting sync error:", error);
      res.status(500).json({ error: error?.message || "Failed to run accounting sync" });
    }
  });
}
