import { useSyncExternalStore } from "react";

const listeners = new Set<() => void>();
let mqBound = false;

function apply(dark: boolean) {
  document.documentElement.classList.toggle("dark", dark);
  listeners.forEach((l) => l());
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  if (!mqBound && typeof window !== "undefined") {
    mqBound = true;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const stored = localStorage.getItem("theme");
    apply(stored ? stored === "dark" : mq.matches);
    mq.addEventListener("change", (e) => {
      if (!localStorage.getItem("theme")) apply(e.matches);
    });
  }
  return () => listeners.delete(cb);
}

export function setDark(dark: boolean) {
  localStorage.setItem("theme", dark ? "dark" : "light");
  apply(dark);
}

export function useIsDark() {
  return useSyncExternalStore(
    subscribe,
    () => document.documentElement.classList.contains("dark"),
    () => false,
  );
}

/** Runs before paint to avoid a light flash. */
export const THEME_BOOT_SCRIPT = `(function(){try{var s=localStorage.getItem('theme');var d=s?s==='dark':matchMedia('(prefers-color-scheme: dark)').matches;if(d)document.documentElement.classList.add('dark')}catch(e){}})()`;
