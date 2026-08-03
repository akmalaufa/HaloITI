export default function AdminLoading() {
  return (
    <div className="flex h-[70vh] w-full flex-col items-center justify-center gap-6">
      <div className="flex items-center space-x-3">
        <div className="h-3 w-3 animate-bounce rounded-full bg-[var(--color-brand)] [animation-delay:-0.3s]"></div>
        <div className="h-3 w-3 animate-bounce rounded-full bg-[var(--color-brand)] [animation-delay:-0.15s]"></div>
        <div className="h-3 w-3 animate-bounce rounded-full bg-[var(--color-brand)]"></div>
      </div>
    </div>
  );
}
