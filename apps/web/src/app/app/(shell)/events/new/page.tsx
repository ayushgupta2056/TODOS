import { NewEventForm } from "./new-event-form";

export const metadata = { title: "New event" };

export default function NewEventPage() {
  return (
    <div className="mx-auto max-w-2xl px-4 py-8 sm:px-8 lg:py-12">
      <div className="mb-10 grid gap-2">
        <p className="eyebrow">New event</p>
        <h1 className="font-display text-display-md">Name it. Then drop in the photos.</h1>
      </div>
      <NewEventForm />
    </div>
  );
}
