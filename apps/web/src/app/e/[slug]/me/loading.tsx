export default function Loading() {
  return (
    <main className="mx-auto max-w-7xl px-3 pt-6 sm:px-6" aria-busy="true" aria-label="Loading your photos">
      <div className="mb-8 grid gap-4 px-1 pt-2">
        <div className="skeleton h-4 w-40 rounded-xs" />
        <div className="skeleton h-14 w-72 max-w-full rounded-md" />
      </div>
      <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-4">
        {Array.from({ length: 8 }, (_, i) => (
          <div key={i} className="skeleton aspect-[4/5] rounded-sm" />
        ))}
      </div>
    </main>
  );
}
