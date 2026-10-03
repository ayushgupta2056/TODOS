// Values inlined into the browser bundle. Keep this list tiny.
export const publicEnv = {
  supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
  supabaseAnonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "",
  googleAuth: process.env.NEXT_PUBLIC_GOOGLE_AUTH === "true",
  // Supabase Storage's S3 API rejects presigned CreateMultipartUpload, so it uses single PUTs
  // (its free plan caps files at 50 MB anyway). R2 / MinIO keep resumable multipart.
  uploadMultipart: process.env.NEXT_PUBLIC_UPLOAD_MULTIPART !== "false",
  maxUploadMb: Number(process.env.NEXT_PUBLIC_MAX_UPLOAD_MB ?? 200) || 200,
};
