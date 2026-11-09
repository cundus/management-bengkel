export default function Loading() {
  return (
    <div role="status" aria-label="Memuat halaman" className="space-y-5">
      <span className="sr-only">Memuat halaman…</span>
      <div aria-hidden="true" className="animate-pulse space-y-5 motion-reduce:animate-none">
        <div className="space-y-3">
          <div className="h-3 w-28 rounded bg-line" />
          <div className="h-8 w-56 max-w-full rounded-xl bg-line" />
          <div className="h-3 w-80 max-w-full rounded bg-line" />
        </div>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {[0, 1, 2, 3].map((key) => (
            <div key={key} className="h-28 rounded-3xl border border-line bg-surface" />
          ))}
        </div>
        <div className="h-64 rounded-3xl border border-line bg-surface" />
      </div>
    </div>
  );
}
