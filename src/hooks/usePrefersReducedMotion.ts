import { useEffect, useState } from "react";

/** Spec 20.4 / 49. Gating motion in JS rather than only in CSS means the
 *  animation never starts, instead of starting and being instantly zeroed. */
export function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(
    () => window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false,
  );

  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const listener = (event: MediaQueryListEvent) => setReduced(event.matches);
    media.addEventListener("change", listener);
    return () => media.removeEventListener("change", listener);
  }, []);

  return reduced;
}

export type MotionTier = "full" | "reduced" | "static";

/** Three tiers so a low-powered office machine gets a still scene rather than
 *  a stuttering one (spec 20.4 asks for a low-performance fallback). */
export function useMotionTier(): MotionTier {
  const reduced = usePrefersReducedMotion();
  const [lowPower] = useState(() => {
    if (typeof navigator === "undefined") return false;
    const cores = navigator.hardwareConcurrency ?? 8;
    const memory = (navigator as Navigator & { deviceMemory?: number }).deviceMemory ?? 8;
    const coarse = window.matchMedia?.("(pointer: coarse)").matches ?? false;
    return cores <= 4 || memory <= 4 || coarse;
  });

  if (reduced) return "static";
  if (lowPower) return "reduced";
  return "full";
}
