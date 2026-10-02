import "server-only";
import { AwsClient } from "aws4fetch";
import { env } from "./env";

/**
 * Minimal S3 client for Cloudflare R2 (prod) / SeaweedFS (dev) built on aws4fetch, which runs
 * both in Node and in Cloudflare Workers. Path-style addressing.
 */

let client: AwsClient | undefined;
function aws(): AwsClient {
  const e = env();
  client ??= new AwsClient({
    accessKeyId: e.S3_ACCESS_KEY_ID,
    secretAccessKey: e.S3_SECRET_ACCESS_KEY,
    service: "s3",
    region: e.S3_REGION,
  });
  return client;
}

function objectUrl(key: string, forBrowser = false): URL {
  const e = env();
  const base = forBrowser ? (e.S3_PUBLIC_ENDPOINT ?? e.S3_ENDPOINT) : e.S3_ENDPOINT;
  const path = key.split("/").map(encodeURIComponent).join("/");
  return new URL(`${base.replace(/\/$/, "")}/${e.S3_BUCKET}/${path}`);
}

async function presign(
  method: "GET" | "PUT",
  key: string,
  expiresIn: number,
  params: Record<string, string> = {},
): Promise<string> {
  const url = objectUrl(key, true);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  url.searchParams.set("X-Amz-Expires", String(expiresIn));
  const signed = await aws().sign(url.toString(), { method, aws: { signQuery: true } });
  return signed.url;
}

export function presignGet(
  key: string,
  opts: { expiresIn?: number; downloadName?: string } = {},
): Promise<string> {
  const params: Record<string, string> = {};
  if (opts.downloadName) {
    const safe = opts.downloadName.replace(/[^\w.\- ]+/g, "_");
    params["response-content-disposition"] = `attachment; filename="${safe}"`;
  }
  return presign("GET", key, opts.expiresIn ?? 3600, params);
}

export function presignPut(key: string, expiresIn = 3600): Promise<string> {
  return presign("PUT", key, expiresIn);
}

async function s3(method: string, key: string, query: string, body?: string): Promise<string> {
  const url = objectUrl(key);
  url.search = query;
  const res = await aws().fetch(url.toString(), {
    method,
    ...(body !== undefined ? { body, headers: { "content-type": "application/xml" } } : {}),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`S3 ${method} ${key} failed: ${res.status} ${text.slice(0, 300)}`);
  return text;
}

function xmlTag(xml: string, tag: string): string | undefined {
  return new RegExp(`<${tag}>([^<]*)</${tag}>`).exec(xml)?.[1];
}

export async function createMultipart(key: string, contentType: string): Promise<string> {
  const url = objectUrl(key);
  url.search = "uploads=";
  const res = await aws().fetch(url.toString(), {
    method: "POST",
    headers: { "content-type": contentType },
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`CreateMultipartUpload failed: ${res.status} ${text.slice(0, 300)}`);
  const id = xmlTag(text, "UploadId");
  if (!id) throw new Error("CreateMultipartUpload: no UploadId");
  return id;
}

export function presignPart(key: string, uploadId: string, partNumber: number): Promise<string> {
  return presign("PUT", key, 3600, { partNumber: String(partNumber), uploadId });
}

export async function completeMultipart(
  key: string,
  uploadId: string,
  parts: { PartNumber: number; ETag: string }[],
): Promise<void> {
  const body =
    "<CompleteMultipartUpload>" +
    [...parts]
      .sort((a, b) => a.PartNumber - b.PartNumber)
      .map(
        (p) =>
          `<Part><PartNumber>${p.PartNumber}</PartNumber><ETag>${p.ETag.replace(/[<>&]/g, "")}</ETag></Part>`,
      )
      .join("") +
    "</CompleteMultipartUpload>";
  const text = await s3("POST", key, `uploadId=${encodeURIComponent(uploadId)}`, body);
  if (text.includes("<Error>")) throw new Error(`CompleteMultipartUpload failed: ${text.slice(0, 300)}`);
}

export async function abortMultipart(key: string, uploadId: string): Promise<void> {
  await s3("DELETE", key, `uploadId=${encodeURIComponent(uploadId)}`);
}

export async function listParts(
  key: string,
  uploadId: string,
): Promise<{ PartNumber: number; ETag: string; Size: number }[]> {
  const xml = await s3("GET", key, `uploadId=${encodeURIComponent(uploadId)}`);
  const parts: { PartNumber: number; ETag: string; Size: number }[] = [];
  for (const m of xml.matchAll(/<Part>([\s\S]*?)<\/Part>/g)) {
    const p = m[1] ?? "";
    parts.push({
      PartNumber: Number(xmlTag(p, "PartNumber")),
      ETag: (xmlTag(p, "ETag") ?? "").replace(/&quot;/g, '"'),
      Size: Number(xmlTag(p, "Size")),
    });
  }
  return parts;
}

export async function headObject(key: string): Promise<{ size: number } | null> {
  const res = await aws().fetch(objectUrl(key).toString(), { method: "HEAD" });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`HEAD ${key} failed: ${res.status}`);
  return { size: Number(res.headers.get("content-length") ?? 0) };
}

export async function putObject(key: string, body: ArrayBuffer, contentType: string): Promise<void> {
  const res = await aws().fetch(objectUrl(key).toString(), {
    method: "PUT",
    body,
    headers: { "content-type": contentType },
  });
  if (!res.ok) throw new Error(`PUT ${key} failed: ${res.status}`);
}

export async function getObject(key: string): Promise<Response> {
  const res = await aws().fetch(objectUrl(key).toString(), { method: "GET" });
  if (!res.ok) throw new Error(`GET ${key} failed: ${res.status}`);
  return res;
}

export interface UppySignRequest {
  method: "PUT" | "POST" | "GET" | "DELETE";
  key: string;
  uploadId?: string | undefined;
  partNumber?: number | undefined;
}

/** Presign exactly the S3 call Uppy's S3 client is about to make (see @uppy/aws-s3 signer). */
export async function presignUppy(req: UppySignRequest): Promise<string> {
  const url = objectUrl(req.key, true);
  if (req.method === "POST" && !req.uploadId) url.searchParams.set("uploads", "");
  if (req.uploadId) url.searchParams.set("uploadId", req.uploadId);
  if (req.partNumber !== undefined) url.searchParams.set("partNumber", String(req.partNumber));
  url.searchParams.set("X-Amz-Expires", "3600");
  const signed = await aws().sign(url.toString(), { method: req.method, aws: { signQuery: true } });
  return signed.url;
}

export async function deleteObject(key: string): Promise<void> {
  const res = await aws().fetch(objectUrl(key).toString(), { method: "DELETE" });
  if (!res.ok && res.status !== 404) throw new Error(`DELETE ${key} failed: ${res.status}`);
}
