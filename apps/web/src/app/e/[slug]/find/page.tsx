import { notFound, redirect } from "next/navigation";
import { getPublicEvent, hasEventAccess, readGuest } from "@/lib/guest";
import { SelfieCamera } from "./selfie-camera";

export const metadata = { title: "Find my photos", robots: { index: false } };

export default async function FindPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const ev = await getPublicEvent(slug);
  if (!ev) notFound();
  if (!(await hasEventAccess(ev))) redirect(`/e/${slug}`);
  if (!(await readGuest(ev.id))?.s) redirect(`/e/${slug}/consent`);
  return <SelfieCamera slug={slug} eventName={ev.name} />;
}
