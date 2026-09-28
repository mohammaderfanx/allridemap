import { Bike, Bus, Car, Footprints, Zap } from "lucide-react";
import { providerById, type Mode } from "@/lib/mobility/providers";

export function ModeIcon({ mode, className }: { mode: Mode; className?: string }) {
  const Icon = mode === "ride" ? Car : mode === "transit" ? Bus : mode === "bike" ? Bike : mode === "scooter" ? Zap : Footprints;
  return <Icon className={className} />;
}

export function ProviderBadge({ providerId, mode, size = 40 }: { providerId: string; mode: Mode; size?: number }) {
  const p = providerById(providerId);
  return (
    <div
      className="flex shrink-0 items-center justify-center rounded-2xl text-primary-foreground shadow-sm"
      style={{ width: size, height: size, background: `var(${p.colorVar})` }}
    >
      <ModeIcon mode={mode} className="h-5 w-5" />
    </div>
  );
}
