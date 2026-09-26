import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Badge } from "./components/badge";
import { Button } from "./components/button";
import { Dialog, DialogContent, DialogTrigger } from "./components/dialog";
import { EmptyState } from "./components/empty-state";
import { Field, Input } from "./components/input";
import { justify } from "./components/photo-grid";
import { Progress, ProgressRing } from "./components/progress";
import { Switch } from "./components/switch";
import { toast, Toaster } from "./components/toast";

describe("Button", () => {
  it("fires clicks and blocks them while loading", async () => {
    const fn = vi.fn();
    const { rerender } = render(<Button onClick={fn}>Save</Button>);
    await userEvent.click(screen.getByRole("button", { name: "Save" }));
    expect(fn).toHaveBeenCalledTimes(1);
    rerender(
      <Button onClick={fn} loading>
        Save
      </Button>,
    );
    const btn = screen.getByRole("button", { name: "Save" });
    expect(btn).toBeDisabled();
    expect(btn).toHaveAttribute("aria-busy", "true");
  });
  it("renders as a child link", () => {
    render(
      <Button asChild>
        <a href="/x">Go</a>
      </Button>,
    );
    expect(screen.getByRole("link", { name: "Go" })).toHaveAttribute("href", "/x");
  });
});

describe("Field", () => {
  it("associates label and shows errors as alerts", () => {
    render(
      <Field label="Email" htmlFor="e" error="Bad email">
        <Input id="e" />
      </Field>,
    );
    expect(screen.getByLabelText("Email")).toBeInTheDocument();
    expect(screen.getByRole("alert")).toHaveTextContent("Bad email");
  });
});

describe("Progress", () => {
  it("clamps and exposes value", () => {
    render(
      <>
        <Progress value={140} label="Upload" />
        <ProgressRing value={-3} label="Ring" />
      </>,
    );
    expect(screen.getByRole("progressbar", { name: "Upload" })).toHaveAttribute("aria-valuenow", "100");
    expect(screen.getByRole("progressbar", { name: "Ring" })).toHaveAttribute("aria-valuenow", "0");
  });
});

describe("Switch", () => {
  it("toggles", async () => {
    const fn = vi.fn();
    render(<Switch aria-label="Downloads" onCheckedChange={fn} />);
    await userEvent.click(screen.getByRole("switch", { name: "Downloads" }));
    expect(fn).toHaveBeenCalledWith(true);
  });
});

describe("Dialog", () => {
  it("opens with an accessible title and closes on Escape", async () => {
    render(
      <Dialog>
        <DialogTrigger>Open</DialogTrigger>
        <DialogContent title="Delete event?">body</DialogContent>
      </Dialog>,
    );
    await userEvent.click(screen.getByRole("button", { name: "Open" }));
    expect(screen.getByRole("dialog", { name: "Delete event?" })).toBeInTheDocument();
    await userEvent.keyboard("{Escape}");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});

describe("Toast", () => {
  it("shows queued toasts", async () => {
    render(<Toaster />);
    act(() => toast.success("Link copied"));
    expect(await screen.findByText("Link copied")).toBeInTheDocument();
  });
});

describe("EmptyState & Badge", () => {
  it("render content", () => {
    render(
      <>
        <EmptyState title="No photos yet" description="Drop a folder" />
        <Badge dot>Live</Badge>
      </>,
    );
    expect(screen.getByRole("heading", { name: "No photos yet" })).toBeInTheDocument();
    expect(screen.getByText("Live")).toBeInTheDocument();
  });
});

describe("justify", () => {
  const p = (w: number, h: number, id: string) => ({ id, src: "", width: w, height: h, alt: id });
  it("fills full rows to the container width", () => {
    const rows = justify([p(300, 200, "a"), p(300, 200, "b"), p(200, 300, "c"), p(300, 200, "d")], 600, 200, 8);
    const first = rows[0]!;
    const w = first.items.reduce((a, i) => a + i.w, 0) + 8 * (first.items.length - 1);
    expect(w).toBeCloseTo(600, 0);
    expect(rows.flatMap((r) => r.items.map((i) => i.photo.id))).toEqual(["a", "b", "c", "d"]);
  });
  it("never stretches the last row beyond the target height", () => {
    const rows = justify([p(300, 200, "a")], 1200, 200, 8);
    expect(rows[0]!.h).toBeLessThanOrEqual(200);
  });
});
