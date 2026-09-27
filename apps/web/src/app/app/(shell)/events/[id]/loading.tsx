export default function Loading() {
  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-8 lg:py-10" aria-busy="true" aria-label="Loading event">
      <div className="mb-8 grid gap-3">
        <div className="skeleton h-3 w-20 rounded-xs" />
        <div className="skeleton h-12 w-80 max-w-full rounded-md" />
      </div>
      <div className="mb-8 h-px bg-line" />
      <div className="grid gap-8 xl:grid-cols-[1fr_320px]">
        <div className="grid content-start gap-8">
          <div className="skeleton h-48 rounded-lg" />
          <div className="skeleton h-72 rounded-lg" />
        </div>
        <div className="skeleton h-80 rounded-lg" />
      </div>
    </div>
  );
}
