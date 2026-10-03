"use client";

import {
  Button,
  Dialog,
  DialogContent,
  DialogTrigger,
  EmptyState,
  Field,
  Input,
  PhotoGrid,
  Progress,
  ProgressRing,
  Sheet,
  SheetContent,
  SheetTrigger,
  Switch,
  toast,
} from "@glimpse/ui";
import { ArrowRight, Images, Plus, Trash2 } from "lucide-react";
import { useState } from "react";

const photos = [
  [1, 1200, 800],
  [2, 800, 1100],
  [3, 1200, 800],
  [4, 1000, 1000],
  [5, 800, 1200],
  [6, 1200, 760],
  [7, 1100, 800],
  [8, 900, 1200],
].map(([n, w, h]) => ({ id: String(n), src: `/marketing/frame-${n}.webp`, width: w!, height: h!, alt: `Sample frame ${n}` }));

export function Interactive() {
  const [on, setOn] = useState(true);
  const [pct, setPct] = useState(62);
  return (
    <>
      <section className="grid gap-6 border-t border-line py-14">
        <h2 className="font-display text-4xl">Buttons</h2>
        <div className="flex flex-wrap items-center gap-3">
          <Button>
            Primary <ArrowRight />
          </Button>
          <Button variant="secondary">Secondary</Button>
          <Button variant="outline">Outline</Button>
          <Button variant="ghost">Ghost</Button>
          <Button variant="danger">
            <Trash2 /> Delete
          </Button>
          <Button variant="link">Link</Button>
          <Button loading>Saving</Button>
          <Button disabled>Disabled</Button>
          <Button size="icon" variant="secondary" aria-label="Add">
            <Plus />
          </Button>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Button size="sm">Small</Button>
          <Button size="md">Medium</Button>
          <Button size="lg">Large</Button>
          <Button size="xl">Extra large</Button>
        </div>
      </section>

      <section className="grid gap-6 border-t border-line py-14">
        <h2 className="font-display text-4xl">Inputs</h2>
        <div className="grid max-w-xl gap-5">
          <Field label="Event name" htmlFor="d-name" hint="Guests see this.">
            <Input id="d-name" placeholder="Priya & Arjun — Sangeet" />
          </Field>
          <Field label="Email" htmlFor="d-email" error="Enter a valid email, like you@studio.com">
            <Input id="d-email" defaultValue="not-an-email" aria-invalid />
          </Field>
          <div className="flex items-center justify-between rounded-md border border-line p-4">
            <label htmlFor="d-switch" className="text-sm">
              Guest downloads
            </label>
            <Switch id="d-switch" checked={on} onCheckedChange={setOn} />
          </div>
        </div>
      </section>

      <section className="grid gap-6 border-t border-line py-14">
        <h2 className="font-display text-4xl">Progress</h2>
        <div className="flex flex-wrap items-center gap-10">
          <ProgressRing value={pct} label="Demo progress">
            <span className="font-mono tabular">{pct}%</span>
          </ProgressRing>
          <div className="grid w-72 gap-3">
            <Progress value={pct} label="Demo progress bar" />
            <div className="flex gap-2">
              <Button size="sm" variant="secondary" onClick={() => setPct((p) => Math.max(0, p - 15))}>
                −15
              </Button>
              <Button size="sm" variant="secondary" onClick={() => setPct((p) => Math.min(100, p + 15))}>
                +15
              </Button>
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-6 border-t border-line py-14">
        <h2 className="font-display text-4xl">Overlays</h2>
        <div className="flex flex-wrap gap-3">
          <Dialog>
            <DialogTrigger asChild>
              <Button variant="secondary">Open dialog</Button>
            </DialogTrigger>
            <DialogContent title="Delete this event?" description="Every photo and all face data will be permanently deleted.">
              <div className="flex justify-end gap-2">
                <Button variant="ghost">Cancel</Button>
                <Button variant="danger">Delete</Button>
              </div>
            </DialogContent>
          </Dialog>
          <Sheet>
            <SheetTrigger asChild>
              <Button variant="secondary">Open sheet</Button>
            </SheetTrigger>
            <SheetContent title="Share" description="Side sheet on desktop.">
              <p className="text-sm text-muted">Sheet body.</p>
            </SheetContent>
          </Sheet>
          <Sheet>
            <SheetTrigger asChild>
              <Button variant="secondary">Bottom sheet</Button>
            </SheetTrigger>
            <SheetContent side="bottom" title="Download" description="Bottom sheet for phones.">
              <p className="text-sm text-muted">Sheet body.</p>
            </SheetContent>
          </Sheet>
          <Button variant="secondary" onClick={() => toast.success("Link copied")}>
            Success toast
          </Button>
          <Button variant="secondary" onClick={() => toast.error("Upload failed", "Check your connection and try again.")}>
            Error toast
          </Button>
        </div>
      </section>

      <section className="grid gap-6 border-t border-line py-14">
        <h2 className="font-display text-4xl">Photo grid</h2>
        <p className="max-w-2xl text-sm text-muted">Justified rows, 6–8px gutters, blurhash placeholder, prints develop blur → sharp in 400ms.</p>
        <PhotoGrid photos={photos} onOpen={() => undefined} targetRowHeight={220} />
      </section>

      <section className="grid gap-6 border-t border-line py-14">
        <h2 className="font-display text-4xl">Empty state</h2>
        <EmptyState
          icon={<Images />}
          title="No photos yet"
          description="Drop a folder. Faces are found automatically as each photo lands."
          action={<Button>Choose folder</Button>}
        />
      </section>
    </>
  );
}
