import { Bike, CarTaxiFront, Footprints, Scooter, TramFront } from "lucide-react";
import { providerById, type Mode } from "@/lib/mobility/providers";

export const MODE_ICONS = {
  ride: CarTaxiFront,
  transit: TramFront,
  scooter: Scooter,
  bike: Bike,
  walk: Footprints,
} as const;

export function ModeIcon({ mode, className }: { mode: Mode; className?: string }) {
  const Icon = MODE_ICONS[mode] ?? Footprints;
  return <Icon className={className} strokeWidth={2.2} />;
}

export function ProviderBadge({
  providerId,
  mode,
  size = 40,
}: {
  providerId: string;
  mode: Mode;
  size?: number;
}) {
  const p = providerById(providerId);
  return (
    <div
      className="flex shrink-0 items-center justify-center rounded-2xl text-primary-foreground shadow-sm ring-1 ring-border/40"
      style={{ width: size, height: size, background: `var(${p.colorVar})` }}
    >
      <ModeIcon mode={mode} className="h-5 w-5" />
    </div>
  );
}
