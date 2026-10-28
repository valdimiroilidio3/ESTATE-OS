export default function WorkspaceLoading() {
  return (
    <div className="mx-auto max-w-[1400px] animate-pulse space-y-6">
      <div className="h-3 w-24 rounded bg-obsidian/10" />
      <div className="h-7 w-72 rounded bg-obsidian/10" />
      <div className="h-3 w-96 max-w-full rounded bg-obsidian/[0.07]" />
      <div className="grid grid-cols-2 gap-x-8 gap-y-4 border-y border-obsidian/10 py-4 md:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <div key={index} className="space-y-2">
            <div className="h-2 w-20 rounded bg-obsidian/[0.07]" />
            <div className="h-6 w-12 rounded bg-obsidian/10" />
          </div>
        ))}
      </div>
      <div className="grid gap-3 md:grid-cols-3">
        {Array.from({ length: 6 }).map((_, index) => (
          <div key={index} className="h-28 border border-obsidian/10 bg-white/50" />
        ))}
      </div>
      <p className="sr-only">A carregar conteúdo do espaço de trabalho.</p>
    </div>
  );
}
