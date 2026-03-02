import { createHash, createHmac } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";

export type ArtifactStorageBackend = "local" | "s3";

export type StoreArtifactInput = {
  buffer: Buffer;
  fileName: string;
  scope: string;
  contentType?: string;
};

export type StoredArtifact = {
  backend: ArtifactStorageBackend;
  storageKey: string;
  originalFileUrl: string;
};

function cleanSegment(value: string): string {
  return value
    .trim()
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

function getBackend(): ArtifactStorageBackend {
  const raw = String(process.env.ARTIFACT_STORAGE_BACKEND || "local").trim().toLowerCase();
  return raw === "s3" ? "s3" : "local";
}

function getLocalBaseDir(): string {
  const configured =
    process.env.ARTIFACTS_LOCAL_BASE_DIR?.trim() ||
    process.env.EVENT_ARTIFACTS_BASE_DIR?.trim();

  if (configured) {
    return path.resolve(configured);
  }

  return path.resolve(process.cwd(), "artifacts");
}

function sha256Hex(input: Buffer | string): string {
  return createHash("sha256").update(input).digest("hex");
}

function hmacSha256(key: Buffer | string, value: string, encoding?: "hex"): Buffer | string {
  const digest = createHmac("sha256", key).update(value).digest();
  if (encoding === "hex") return digest.toString("hex");
  return digest;
}

function toAmzDate(date: Date): { amzDate: string; dateStamp: string } {
  const iso = date.toISOString();
  const dateStamp = iso.slice(0, 10).replace(/-/g, "");
  const amzDate = `${dateStamp}T${iso.slice(11, 19).replace(/:/g, "")}Z`;
  return { amzDate, dateStamp };
}

function getS3Config(): {
  endpoint: URL;
  region: string;
  bucket: string;
  accessKeyId: string;
  secretAccessKey: string;
  sessionToken?: string;
  forcePathStyle: boolean;
} {
  const endpointRaw = process.env.ARTIFACT_STORAGE_S3_ENDPOINT?.trim();
  const bucket = process.env.ARTIFACT_STORAGE_S3_BUCKET?.trim();
  const accessKeyId = process.env.ARTIFACT_STORAGE_S3_ACCESS_KEY_ID?.trim();
  const secretAccessKey = process.env.ARTIFACT_STORAGE_S3_SECRET_ACCESS_KEY?.trim();
  const region = process.env.ARTIFACT_STORAGE_S3_REGION?.trim() || "auto";
  const forcePathStyle = String(process.env.ARTIFACT_STORAGE_S3_FORCE_PATH_STYLE || "true").toLowerCase() !== "false";

  if (!endpointRaw || !bucket || !accessKeyId || !secretAccessKey) {
    throw new Error(
      "S3 artifact storage is enabled but required env vars are missing (ARTIFACT_STORAGE_S3_ENDPOINT, ARTIFACT_STORAGE_S3_BUCKET, ARTIFACT_STORAGE_S3_ACCESS_KEY_ID, ARTIFACT_STORAGE_S3_SECRET_ACCESS_KEY).",
    );
  }

  return {
    endpoint: new URL(endpointRaw),
    region,
    bucket,
    accessKeyId,
    secretAccessKey,
    sessionToken: process.env.ARTIFACT_STORAGE_S3_SESSION_TOKEN?.trim() || undefined,
    forcePathStyle,
  };
}

async function storeLocal(input: StoreArtifactInput): Promise<StoredArtifact> {
  const baseDir = getLocalBaseDir();
  const safeScope = cleanSegment(input.scope) || "uploads";
  const safeName = cleanSegment(path.basename(input.fileName)) || "artifact.pdf";
  const storageKey = path.posix.join(
    safeScope,
    `${Date.now()}-${Math.random().toString(36).slice(2, 10)}-${safeName}`,
  );

  const destination = path.resolve(baseDir, storageKey);
  await fs.mkdir(path.dirname(destination), { recursive: true });
  await fs.writeFile(destination, input.buffer);

  return {
    backend: "local",
    storageKey,
    originalFileUrl: `local://${storageKey}`,
  };
}

async function putObjectS3(input: StoreArtifactInput): Promise<StoredArtifact> {
  const config = getS3Config();
  const safeScope = cleanSegment(input.scope) || "uploads";
  const safeName = cleanSegment(path.basename(input.fileName)) || "artifact.pdf";
  const objectKey = `${safeScope}/${Date.now()}-${Math.random().toString(36).slice(2, 10)}-${safeName}`;

  const now = new Date();
  const { amzDate, dateStamp } = toAmzDate(now);
  const service = "s3";
  const host = config.endpoint.host;
  const canonicalUri = config.forcePathStyle
    ? `/${encodeURIComponent(config.bucket).replace(/%2F/g, "/")}/${objectKey
        .split("/")
        .map((segment) => encodeURIComponent(segment))
        .join("/")}`
    : `/${objectKey
        .split("/")
        .map((segment) => encodeURIComponent(segment))
        .join("/")}`;

  const payloadHash = sha256Hex(input.buffer);
  const contentType = input.contentType || "application/pdf";

  const canonicalHeadersLines = [
    `host:${host}`,
    `x-amz-content-sha256:${payloadHash}`,
    `x-amz-date:${amzDate}`,
  ];

  if (config.sessionToken) {
    canonicalHeadersLines.push(`x-amz-security-token:${config.sessionToken}`);
  }

  const signedHeaders = canonicalHeadersLines
    .map((line) => line.split(":")[0])
    .sort()
    .join(";");

  const canonicalHeaders = canonicalHeadersLines
    .sort((a, b) => a.localeCompare(b))
    .join("\n");

  const canonicalRequest = [
    "PUT",
    canonicalUri,
    "",
    `${canonicalHeaders}\n`,
    signedHeaders,
    payloadHash,
  ].join("\n");

  const credentialScope = `${dateStamp}/${config.region}/${service}/aws4_request`;
  const stringToSign = [
    "AWS4-HMAC-SHA256",
    amzDate,
    credentialScope,
    sha256Hex(canonicalRequest),
  ].join("\n");

  const kDate = hmacSha256(`AWS4${config.secretAccessKey}`, dateStamp) as Buffer;
  const kRegion = hmacSha256(kDate, config.region) as Buffer;
  const kService = hmacSha256(kRegion, service) as Buffer;
  const kSigning = hmacSha256(kService, "aws4_request") as Buffer;
  const signature = hmacSha256(kSigning, stringToSign, "hex") as string;

  const authorization =
    `AWS4-HMAC-SHA256 Credential=${config.accessKeyId}/${credentialScope}, ` +
    `SignedHeaders=${signedHeaders}, Signature=${signature}`;

  const requestUrl = new URL(config.endpoint.toString());
  if (config.forcePathStyle) {
    requestUrl.pathname = `/${config.bucket}/${objectKey}`;
  } else {
    requestUrl.hostname = `${config.bucket}.${requestUrl.hostname}`;
    requestUrl.pathname = `/${objectKey}`;
  }

  const headers: Record<string, string> = {
    "content-type": contentType,
    "x-amz-content-sha256": payloadHash,
    "x-amz-date": amzDate,
    Authorization: authorization,
  };

  if (config.sessionToken) {
    headers["x-amz-security-token"] = config.sessionToken;
  }

  const response = await fetch(requestUrl.toString(), {
    method: "PUT",
    headers,
    body: input.buffer,
  });

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(
      `Failed to upload artifact to S3-compatible storage (${response.status} ${response.statusText}). ${body}`,
    );
  }

  return {
    backend: "s3",
    storageKey: objectKey,
    originalFileUrl: `s3://${config.bucket}/${objectKey}`,
  };
}

export async function storeArtifact(input: StoreArtifactInput): Promise<StoredArtifact> {
  const backend = getBackend();
  if (backend === "s3") {
    return putObjectS3(input);
  }
  return storeLocal(input);
}

export function resolveLocalArtifactPath(storageKey: string): string {
  if (path.isAbsolute(storageKey)) {
    return path.normalize(storageKey);
  }

  const baseDir = getLocalBaseDir();
  return path.resolve(baseDir, storageKey);
}
