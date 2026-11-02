import { Check, Navigation, Pause, Play, SkipForward, X } from "lucide-react";
import type { Segment } from "@/lib/mobility/engine";
import type { LiveProgress } from "@/lib/mobility/liveTrip";
import { providerById } from "@/lib/mobility/providers";
import { ModeIcon } from "./ProviderBadge";

function clock(min: number) {
  const d = new Date(Date.now() + min * 60000);
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

export function LiveTripSheet({
  segments,
  progress,
  paused,
  onPause,
  onSkip,
  onEnd,
  destinationName,
  co2SavedG = 0,
  points = 0,
}: {
  segments: Segment[];
  progress: LiveProgress;
  paused: boolean;
  onPause: () => void;
  onSkip: () => void;
  onEnd: () => void;
  destinationName: string;
  co2SavedG?: number;
  points?: number;
}) {
  const cur = segments[progress.step];
  const next = segments[progress.step + 1];
  const remaining = Math.max(0, progress.totalMin - progress.elapsedMin);
  const pct = progress.totalMin ? (progress.elapsedMin / progress.totalMin) * 100 : 0;

  if (progress.done) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-3 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary text-primary-foreground">
          <Check className="h-8 w-8" />
        </div>
        <h2 className="text-xl font-extrabold text-foreground">You've arrived</h2>
        <p className="text-sm text-muted-foreground">Welcome to {destinationName}.</p>
        {co2SavedG > 0 && (
          <p className="rounded-2xl bg-muted px-4 py-2 text-sm font-bold text-foreground">
            🌱 You saved {co2SavedG >= 1000 ? `${(co2SavedG / 1000).toFixed(1)} kg` : `${co2SavedG} g`} CO₂ vs. driving
            {points > 0 && ` · +${points} green points`}
          </p>
        )}
        <button onClick={onEnd} className="mt-2 rounded-2xl bg-primary px-6 py-3 font-bold text-primary-foreground">
          Done
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col" aria-live="polite">
      <div className="flex items-center justify-between">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-3 py-1 text-xs font-bold text-primary">
          <Navigation className="h-3.5 w-3.5" /> Live trip
        </span>
        <button onClick={onEnd} className="rounded-full bg-muted p-2 text-foreground hover:bg-accent" aria-label="End trip">
          <X className="h-4 w-4" />
        </button>
      </div>

      {cur && (
        <div className="mt-4 flex items-center gap-3 rounded-2xl bg-muted p-4">
          <div
            className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full text-primary-foreground"
            style={{ background: `var(${providerById(cur.providerId).colorVar})` }}
          >
            <ModeIcon mode={cur.mode} className="h-6 w-6" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-lg font-extrabold leading-tight text-foreground">{cur.label}</p>
            <p className="truncate text-sm text-muted-foreground">{cur.detail}</p>
          </div>
          <div className="text-right">
            <p className="text-2xl font-extrabold text-foreground">{Math.ceil(progress.stepRemainingMin)}</p>
            <p className="text-[11px] font-bold uppercase text-muted-foreground">min</p>
          </div>
        </div>
      )}
      {next && <p className="mt-2 px-1 text-sm text-muted-foreground">Then: {next.label}</p>}

      <div className="mt-5">
        <div className="h-2 overflow-hidden rounded-full bg-muted">
          <div className="h-full rounded-full bg-primary transition-[width] duration-200" style={{ width: `${pct}%` }} />
        </div>
        <div className="mt-2 flex justify-between text-sm">
          <span className="font-bold text-foreground">{Math.ceil(remaining)} min left</span>
          <span className="text-muted-foreground">Arrive {clock(remaining)}</span>
        </div>
      </div>

      <ol className="mt-5 space-y-2">
        {segments.map((s, i) => {
          const state = i < progress.step ? "done" : i === progress.step ? "now" : "next";
          return (
            <li key={i} className="flex items-center gap-3">
              <div
                className={`flex h-7 w-7 items-center justify-center rounded-full ${state === "done" ? "bg-primary text-primary-foreground" : state === "now" ? "bg-primary/15 text-primary ring-2 ring-primary" : "bg-muted text-muted-foreground"}`}
              >
                {state === "done" ? <Check className="h-4 w-4" /> : <ModeIcon mode={s.mode} className="h-3.5 w-3.5" />}
              </div>
              <span className={`flex-1 text-sm ${state === "now" ? "font-bold text-foreground" : "text-muted-foreground"} ${state === "done" ? "line-through" : ""}`}>
                {s.label}
              </span>
              <span className="text-xs text-muted-foreground">{s.durationMin} min</span>
            </li>
          );
        })}
      </ol>

      <div className="mt-auto flex gap-2 pt-6">
        <button onClick={onPause} className="flex flex-1 items-center justify-center gap-2 rounded-2xl bg-muted py-3 font-bold text-foreground">
          {paused ? <Play className="h-4 w-4" /> : <Pause className="h-4 w-4" />} {paused ? "Resume" : "Pause"}
        </button>
        <button onClick={onSkip} className="flex flex-1 items-center justify-center gap-2 rounded-2xl bg-muted py-3 font-bold text-foreground">
          <SkipForward className="h-4 w-4" /> Next step
        </button>
      </div>
    </div>
  );
}
