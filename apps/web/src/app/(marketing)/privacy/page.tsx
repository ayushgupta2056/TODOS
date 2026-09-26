import type { Metadata } from "next";
import { DeleteRequestForm } from "./delete-request-form";

export const metadata: Metadata = { title: "Privacy" };

export default function PrivacyPage() {
  return (
    <article className="mx-auto max-w-3xl px-4 py-20 sm:px-6 lg:py-28">
      <p className="eyebrow mb-4">Privacy notice · updated September 2026</p>
      <h1 className="mb-10 font-display text-display-lg">How Glimpse handles your face.</h1>
      <div className="grid gap-10 text-[1.02rem] leading-relaxed text-paper/90 [&_h2]:mb-3 [&_h2]:font-display [&_h2]:text-3xl [&_li]:ml-5 [&_li]:list-disc [&_p]:text-muted [&_ul]:grid [&_ul]:gap-2 [&_ul]:text-muted">
        <section>
          <h2>In short</h2>
          <ul>
            <li>We use your selfie only to find your photos in one event, only after you agree.</li>
            <li>Your selfie is processed in memory and discarded. It is never saved to disk, storage or logs.</li>
            <li>Faces in event photos are turned into numbers (&ldquo;face data&rdquo;) that stay inside that one event and are deleted with it.</li>
            <li>We never search your face across events or share face data with anyone.</li>
          </ul>
        </section>
        <section>
          <h2>Who is responsible</h2>
          <p>
            The photographer or studio who created the event decides why the photos are taken and
            shared (the &ldquo;Data Fiduciary&rdquo; / controller). Glimpse processes photos and face data on
            their behalf (the &ldquo;Data Processor&rdquo;). Questions about a specific event can go to the
            studio named on the event page, or to us using the form below.
          </p>
        </section>
        <section>
          <h2>What we process, and why</h2>
          <ul>
            <li><strong className="text-paper">Event photos</strong> uploaded by the photographer, to show them to guests.</li>
            <li><strong className="text-paper">Face data</strong> (a 128-number description of each face, plus its position) for each photo, so guests can find themselves. Stored only in the event it came from.</li>
            <li><strong className="text-paper">Your selfie</strong>, once, to compute the same kind of description and compare it with that event. Then it is discarded.</li>
            <li><strong className="text-paper">A consent record</strong>: when you agreed, which version of this notice, and a one-way hash of your IP address (to prevent abuse). No name, no email, no selfie.</li>
            <li><strong className="text-paper">Your matched photo list</strong>, kept for 24 hours so you can download a ZIP, then erased.</li>
          </ul>
        </section>
        <section>
          <h2>How long we keep it</h2>
          <p>
            Photos and face data are kept until the event&rsquo;s expiry date or until the photographer
            deletes the event, whichever comes first. Deletion removes the files and the face data
            permanently. Backups roll off within 7 days.
          </p>
        </section>
        <section>
          <h2>Your rights</h2>
          <p>
            Under the Digital Personal Data Protection Act, 2023 and the DPDP Rules, 2025 (and GDPR where it
            applies) you can withdraw consent, ask what we hold, ask us to correct or erase it, and
            complain to the Data Protection Board of India. Withdrawing consent is as easy as giving
            it: simply close the page, and use the form below to have face data about you removed from
            an event.
          </p>
        </section>
        <section id="delete" className="scroll-mt-24">
          <h2>Delete my face data</h2>
          <p className="mb-6">
            Tell us which event (the link or code on the QR card) and how to reach you. We&rsquo;ll ask
            the studio to remove photos of you and delete your face data from that event, and confirm
            by email within 30 days (usually far sooner).
          </p>
          <DeleteRequestForm />
        </section>
      </div>
    </article>
  );
}
