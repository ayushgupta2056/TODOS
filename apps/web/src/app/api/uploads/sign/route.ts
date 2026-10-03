import { NextResponse } from "next/server";
import { z } from "zod";
import { presignUppy } from "@/lib/s3";
import { ORIGINAL_KEY, readUploadToken } from "@/lib/upload-token";

const Body = z.object({
  token: z.string().min(10),
  request: z.object({
    method: z.enum(["PUT", "POST", "GET", "DELETE"]),
    key: z.string().max(200),
    uploadId: z.string().max(1024).optional(),
    partNumber: z.number().int().min(1).max(10000).optional(),
  }),
});

/** POST /api/uploads/sign — presign one S3 request for a browser upload into an event. */
export async function POST(req: Request) {
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "bad request" }, { status: 400 });
  const token = await readUploadToken(parsed.data.token);
  if (!token) return NextResponse.json({ error: "upload session expired, reload the page" }, { status: 401 });
  const { request } = parsed.data;
  const m = ORIGINAL_KEY.exec(request.key);
  if (!m || m[1] !== token.event) return NextResponse.json({ error: "key not allowed" }, { status: 403 });
  // Deleting a finished object isn't part of uploading: only aborting multipart uploads is allowed.
  if (request.method === "DELETE" && !request.uploadId) {
    return NextResponse.json({ error: "not allowed" }, { status: 403 });
  }
  const url = await presignUppy(request);
  return NextResponse.json({ url }, { headers: { "cache-control": "no-store" } });
}
