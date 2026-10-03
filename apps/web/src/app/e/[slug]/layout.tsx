import { notFound } from "next/navigation";
import { brandStyle, getPublicEvent } from "@/lib/guest";

export default async function GuestLayout({ children, params }: { children: React.ReactNode; params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const ev = await getPublicEvent(slug);
  if (!ev) notFound();
  return (
    <div style={brandStyle(ev)} className="min-h-dvh bg-ink text-paper">
      {children}
    </div>
  );
}
