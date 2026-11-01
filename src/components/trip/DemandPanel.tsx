import type { DemandCell, Horizon } from "@/lib/mobility/demand";

const HORIZONS: { v: Horizon; label: string }[] = [
  { v: 0, label: "Now" },
  { v: 30, label: "+30 min" },
  { v: 60, label: "+60 min" },
];

export function DemandPanel({
  horizon,
  setHorizon,
  cells,
}: {
  horizon: Horizon;
  setHorizon: (h: Horizon) => void;
  cells: DemandCell[];
}) {
  const shortfall = cells.filter((c) => c.pressure > 1.2).length;
  const highSupply = cells.filter((c) => c.supply >= 8).length;
  const maxSurge = cells.reduce((a, c) => Math.max(a, c.surge), 1);
  return (
    <div className="mb-2 rounded-2xl bg-muted/70 p-2.5">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-xs font-bold text-foreground">Predicted wait times</span>
        <div className="flex gap-1">
          {HORIZONS.map((h) => (
            <button
              key={h.v}
              onClick={() => setHorizon(h.v)}
              aria-pressed={horizon === h.v}
              className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${
                horizon === h.v
                  ? "bg-primary text-primary-foreground"
                  : "bg-background text-muted-foreground"
              }`}
            >
              {h.label}
            </button>
          ))}
        </div>
      </div>
      <div className="flex items-center gap-2 text-[11px] font-semibold text-muted-foreground">
        <span>2 min</span>
        <div
          className="h-1.5 flex-1 rounded-full"
          style={{ background: "linear-gradient(90deg, hsl(140 80% 48%), hsl(70 80% 48%), hsl(0 80% 48%))" }}
        />
        <span>14+ min</span>
      </div>
      <p className="mt-1.5 text-[11px] text-muted-foreground">
        {cells.length
          ? `${highSupply} high-supply zones · ${shortfall} shortfall zones · surge up to ${maxSurge.toFixed(1)}×`
          : "Calculating forecast…"}
      </p>
    </div>
  );
}
