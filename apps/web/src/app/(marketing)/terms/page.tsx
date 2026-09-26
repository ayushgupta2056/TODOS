import type { Metadata } from "next";

export const metadata: Metadata = { title: "Terms" };

export default function TermsPage() {
  return (
    <article className="mx-auto max-w-3xl px-4 py-20 sm:px-6 lg:py-28">
      <p className="eyebrow mb-4">Terms of service · draft, September 2026</p>
      <h1 className="mb-10 font-display text-display-lg">Terms of service</h1>
      <div className="grid gap-8 leading-relaxed text-muted [&_h2]:mb-2 [&_h2]:font-display [&_h2]:text-2xl [&_h2]:text-paper">
        <p className="rounded-md border border-amber/40 bg-amber-soft p-4 text-paper">
          This is a working draft for the pilot. Have it reviewed by a lawyer before taking payments.
        </p>
        <section>
          <h2>1. The service</h2>
          <p>Glimpse lets photographers share event photos with guests, who can find photos of themselves using a selfie.</p>
        </section>
        <section>
          <h2>2. Photographers</h2>
          <p>
            You confirm you have the right to upload each photo and to let guests find themselves in it,
            including telling attendees that face matching is used (for example on the QR card). You are the
            Data Fiduciary for your events; Glimpse processes data on your instructions. You must respond to
            deletion requests we forward to you.
          </p>
        </section>
        <section>
          <h2>3. Guests</h2>
          <p>Use the selfie search only to find photos of yourself. Don&rsquo;t upload someone else&rsquo;s face.</p>
        </section>
        <section>
          <h2>4. Plans and limits</h2>
          <p>Limits are enforced per plan. Paid plans renew monthly until cancelled. Downgrades take effect at the end of the billing period.</p>
        </section>
        <section>
          <h2>5. Deletion</h2>
          <p>When an event expires or is deleted, its photos and face data are permanently deleted and can&rsquo;t be recovered.</p>
        </section>
        <section>
          <h2>6. Liability</h2>
          <p>Face matching is probabilistic: it may miss photos or, rarely, show a photo of someone similar. The service is provided as is, to the extent permitted by law.</p>
        </section>
      </div>
    </article>
  );
}
