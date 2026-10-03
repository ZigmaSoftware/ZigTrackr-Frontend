import { motion } from "framer-motion";
import {
  Archive, Bug, CheckCircle2, FlaskConical, PlayCircle, Plus, UserCheck,
  type LucideIcon,
} from "lucide-react";
import { useMotionTier } from "@/hooks/usePrefersReducedMotion";

/* ---- LOGIN SCENE (spec 20) ----
   The bug lifecycle rendered as a slowly rotating ring of glass cards, built
   from CSS 3D transforms. No WebGL: spec 20.2 says use Three.js only if
   necessary, and a ring of six cards does not need a renderer.

   One element animates -- the ring. The six cards carry static transforms and
   ride along. Animating each card independently would create six composited
   layers all ticking, which is what makes this kind of scene stutter. */

const STAGES: { id: string; label: string; icon: LucideIcon; token: string }[] = [
  { id: "NEW", label: "New", icon: Plus, token: "new" },
  { id: "ASSIGNED", label: "Assigned", icon: UserCheck, token: "assigned" },
  { id: "IN_PROGRESS", label: "In Progress", icon: PlayCircle, token: "inprogress" },
  { id: "TESTING", label: "Testing", icon: FlaskConical, token: "testing" },
  { id: "RESOLVED", label: "Resolved", icon: CheckCircle2, token: "resolved" },
  { id: "CLOSED", label: "Closed", icon: Archive, token: "closed" },
];

const RADIUS = 200;
const STEP = 360 / STAGES.length;

export function LoginScene() {
  const tier = useMotionTier();
  const animate = tier === "full";

  return (
    <div
      // Decorative only: the form carries every piece of meaning (spec 49).
      aria-hidden
      className="pointer-events-none absolute inset-0 flex items-center justify-center overflow-hidden"
      style={{ perspective: "1500px", perspectiveOrigin: "50% 50%" }}
    >
      {/* Ambient ground: static, cheap, carries the brand colour. */}
      <div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(120% 100% at 50% 0%, var(--brand-700), var(--brand-950) 55%, #05060f)",
        }}
      />
      <div
        className="absolute inset-0 opacity-[0.13]"
        style={{
          backgroundImage:
            "linear-gradient(var(--brand-300) 1px, transparent 1px), linear-gradient(90deg, var(--brand-300) 1px, transparent 1px)",
          backgroundSize: "56px 56px",
          maskImage: "radial-gradient(58% 58% at 50% 45%, #000, transparent)",
          WebkitMaskImage: "radial-gradient(58% 58% at 50% 45%, #000, transparent)",
        }}
      />

      {/* ---- THE RING ---- */}
      <motion.div
        className="relative translate-x-6 -translate-y-4"
        style={{ transformStyle: "preserve-3d", width: 1, height: 1 }}
        // A steeper tilt keeps every card in frame: at a shallow angle the
        // cards at 90 and 270 degrees turn edge-on and disappear.
        initial={{ rotateX: -22, rotateY: 15 }}
        animate={animate ? { rotateX: -22, rotateY: 375 } : { rotateX: -22, rotateY: 15 }}
        transition={animate ? { duration: 58, ease: "linear", repeat: Infinity } : undefined}
      >
        {STAGES.map((stage, index) => {
          const Icon = stage.icon;
          return (
            // The ring placement lives on a plain div, not on the motion
            // element. Framer Motion writes its own `transform` on elements it
            // animates, which silently discards an inline transform set
            // alongside it -- the cards end up stacked at the centre.
            <div
              key={stage.id}
              className="absolute left-0 top-0"
              style={{
                transform: `rotateY(${index * STEP}deg) translateZ(${RADIUS}px) rotateY(${-index * STEP}deg)`,
                transformStyle: "preserve-3d",
              }}
            >
              <motion.div
                className="flex h-[76px] w-[124px] -translate-x-1/2 -translate-y-1/2 flex-col justify-between
                           rounded-2xl border border-white/20 bg-white/[0.07] p-3 backdrop-blur-md"
                style={{
                  boxShadow:
                    "0 8px 32px -8px rgb(0 0 0 / 0.5), inset 0 1px 0 0 rgb(255 255 255 / 0.12)",
                }}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.08 * index, duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
              >
                <Icon className="size-4 text-white/85" aria-hidden />
                <div>
                  <div className="text-[13px] font-medium text-white">{stage.label}</div>
                  <div
                    className="mt-1 h-1 w-10 rounded-full"
                    style={{
                      background: `var(--status-${stage.token}-solid)`,
                      animation: animate ? `zpulse 3s ease-in-out ${index * 0.4}s infinite` : undefined,
                    }}
                  />
                </div>
              </motion.div>
            </div>
          );
        })}

        {/* Bug glyph on a counter-rotating inner orbit (spec 20.2). */}
        <motion.div
          className="absolute left-0 top-0"
          style={{ transformStyle: "preserve-3d" }}
          animate={animate ? { rotateY: -360 } : undefined}
          transition={animate ? { duration: 18, ease: "linear", repeat: Infinity } : undefined}
        >
          <div
            className="grid size-11 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-xl
                       border border-white/25 bg-white/10 backdrop-blur-md"
            style={{
              transform: `translateZ(${RADIUS - 92}px)`,
              boxShadow: "0 0 40px -6px var(--brand-400)",
            }}
          >
            <Bug className="size-5 text-white" aria-hidden />
          </div>
        </motion.div>
      </motion.div>

      {/* Drifting particles, skipped below the full tier. */}
      {animate ? (
        <div className="absolute inset-0">
          {Array.from({ length: 12 }).map((_, index) => (
            <span
              key={index}
              className="absolute rounded-full bg-white/40"
              style={{
                width: 2 + (index % 3),
                height: 2 + (index % 3),
                left: `${8 + index * 7.5}%`,
                top: `${18 + ((index * 37) % 64)}%`,
                animation: `zfloat ${7 + (index % 5)}s ease-in-out ${index * 0.4}s infinite`,
              }}
            />
          ))}
        </div>
      ) : null}

      <div className="absolute bottom-10 left-0 right-0 text-center">
        <p className="text-[13px] font-medium tracking-wide text-white/85">
          Track · Assign · Resolve
        </p>
        <p className="mt-1 text-[11px] text-white/50">
          Complete bug lifecycle management for the Zigma team
        </p>
      </div>
    </div>
  );
}
