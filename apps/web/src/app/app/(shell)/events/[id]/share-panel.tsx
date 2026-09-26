"use client";

import { Button, Card, CardContent, toast } from "@glimpse/ui";
import { Copy, Download, Share2 } from "lucide-react";

export function SharePanel({ url, slug, name, qrSvg, pin }: { url: string; slug: string; name: string; qrSvg: string; pin: boolean }) {
  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      toast.success("Link copied");
    } catch {
      toast.error("Couldn't copy", "Select the link and copy it manually.");
    }
  }
  async function share() {
    if (navigator.share) await navigator.share({ title: name, text: `Find your photos from ${name}`, url }).catch(() => undefined);
    else await copy();
  }
  function downloadCard() {
    // A print-ready 1200x1600 PNG: event name, QR, short instructions.
    const img = new Image();
    img.onload = () => {
      const c = document.createElement("canvas");
      c.width = 1200;
      c.height = 1600;
      const g = c.getContext("2d");
      if (!g) return;
      g.fillStyle = "#0E0C0A";
      g.fillRect(0, 0, c.width, c.height);
      g.fillStyle = "#F3EDE4";
      g.textAlign = "center";
      g.font = "italic 88px 'Instrument Serif', Georgia, serif";
      g.fillText("Find your photos", 600, 220);
      g.font = "44px 'Instrument Serif', Georgia, serif";
      g.fillStyle = "#A89E92";
      g.fillText(name.length > 38 ? `${name.slice(0, 37)}…` : name, 600, 300);
      g.fillStyle = "#F3EDE4";
      g.fillRect(250, 390, 700, 700);
      g.drawImage(img, 280, 420, 640, 640);
      g.fillStyle = "#FF8A3D";
      g.beginPath();
      g.arc(600, 1200, 10, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = "#F3EDE4";
      g.font = "40px ui-sans-serif, system-ui, sans-serif";
      g.fillText("Scan · take a selfie · see every photo you're in", 600, 1290);
      g.fillStyle = "#A89E92";
      g.font = "30px ui-monospace, monospace";
      g.fillText(url.replace(/^https?:\/\//, ""), 600, 1370);
      g.font = "26px ui-sans-serif, system-ui, sans-serif";
      g.fillText("Your selfie is never stored. Face matching is used only for this event.", 600, 1480);
      const a = document.createElement("a");
      a.href = c.toDataURL("image/png");
      a.download = `glimpse-${slug}-qr.png`;
      a.click();
    };
    img.src = `data:image/svg+xml;utf8,${encodeURIComponent(qrSvg)}`;
  }
  return (
    <div className="grid gap-6 lg:grid-cols-[360px_1fr]">
      <Card>
        <CardContent className="grid gap-5">
          <div
            className="overflow-hidden rounded-md bg-[#F3EDE4] p-3 [&_svg]:h-auto [&_svg]:w-full"
            role="img"
            aria-label={`QR code for ${url}`}
            dangerouslySetInnerHTML={{ __html: qrSvg }}
          />
          <Button onClick={downloadCard}>
            <Download /> Download QR card
          </Button>
        </CardContent>
      </Card>
      <div className="grid content-start gap-6">
        <div className="grid gap-2">
          <h2 className="font-display text-3xl">Share with guests</h2>
          <p className="text-muted">
            Put the QR card on tables, the entrance, or the screen during speeches. Anyone who scans it can find
            their photos{pin ? " after entering the PIN" : ""}.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 rounded-md border border-line-strong bg-surface p-2 pl-4">
          <code className="min-w-0 flex-1 truncate font-mono text-sm">{url}</code>
          <Button variant="secondary" size="sm" onClick={copy}>
            <Copy /> Copy
          </Button>
          <Button variant="secondary" size="sm" onClick={share}>
            <Share2 /> Share
          </Button>
        </div>
        <p className="text-sm text-muted">
          Tip: a short line on the card like &ldquo;Face matching is used to find your photos; selfies are never
          stored&rdquo; keeps everyone informed, as the DPDP Act expects.
        </p>
      </div>
    </div>
  );
}
