type StatusBadgeProps = {
  status: "active" | "beta" | "coming-soon";
};

export default function StatusBadge({ status }: StatusBadgeProps) {
  const labelMap = {
    active: "Active",
    beta: "Beta",
    "coming-soon": "Coming soon",
  } as const;

  const classMap = {
    active: "border-emerald-900 bg-emerald-950/40 text-emerald-200",
    beta: "border-amber-900 bg-amber-950/40 text-amber-200",
    "coming-soon": "border-zinc-700 bg-zinc-800/60 text-zinc-300",
  } as const;

  return (
    <span
      className={`rounded-full border px-2.5 py-1 text-xs font-medium ${classMap[status]}`}
    >
      {labelMap[status]}
    </span>
  );
}
