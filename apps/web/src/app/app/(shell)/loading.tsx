export default function Loading() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-8 lg:py-12" aria-busy="true" aria-label="Loading">
      <div className="mb-10 grid gap-3">
        <div className="skeleton h-3 w-32 rounded-xs" />
        <div className="skeleton h-12 w-64 rounded-md" />
      </div>
      <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
        {[0, 1, 2].map((i) => (
          <div key={i} className="overflow-hidden rounded-lg border border-line">
            <div className="skeleton aspect-[16/10]" />
            <div className="grid gap-2 p-4">
              <div className="skeleton h-6 w-3/4 rounded-sm" />
              <div className="skeleton h-3 w-1/2 rounded-xs" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
