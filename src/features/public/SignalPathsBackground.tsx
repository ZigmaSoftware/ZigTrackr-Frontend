import { useEffect, useRef, useState } from "react";

export function SignalPathsBackground({ dark = false }: { dark?: boolean }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const elapsed = useRef(0);
  const [reducedMotion, setReducedMotion] = useState(
    () => window.matchMedia("(prefers-reduced-motion: reduce)").matches,
  );

  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReducedMotion(media.matches);
    media.addEventListener("change", update);
    update();
    return () => media.removeEventListener("change", update);
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    let width = 0;
    let height = 0;
    let frame = 0;
    let lastFrame = 0;

    function line(points: number[][], color: string, thickness = 1) {
      if (!ctx) return;
      ctx.beginPath();
      points.forEach(([x, y], i) => i ? ctx.lineTo(x, y) : ctx.moveTo(x, y));
      ctx.strokeStyle = color;
      ctx.lineWidth = thickness;
      ctx.stroke();
    }

    function draw() {
      if (!ctx) return;
      ctx.fillStyle = dark ? "#171b1e" : "#f4f7fa";
      ctx.fillRect(0, 0, width, height);
      for (let i = 0; i < 7; i++) {
        const y = height * (.12 + i * .13);
        const x = width * (.06 + i * .023);
        const y2 = y + (i % 2 ? 45 : -45);
        const left = [[0, y], [x, y], [x, y2], [width * .245, y2]];
        const right = [[width, y2 + 32], [width - x, y2 + 32], [width - x, y + 76], [width * .755, y + 76]];
        line(left, dark ? "#2a3842" : "#d7e1ed");
        line(right, dark ? "#2c3b36" : "#d9e4dd");
        ctx.setLineDash([32, 470]);
        ctx.lineDashOffset = -elapsed.current * 21 - i * 70;
        line(left, dark ? "#577fa5" : "#8cabd5", 1.6);
        line(right, dark ? "#527e68" : "#8eb9a1", 1.6);
        ctx.setLineDash([]);
        ctx.strokeStyle = dark ? "#43586b" : "#bdccde";
        ctx.strokeRect(x - 2.5, y - 2.5, 5, 5);
      }
    }

    function resize() {
      if (!canvas || !ctx) return;
      width = window.innerWidth;
      height = window.innerHeight;
      const dpr = Math.min(window.devicePixelRatio || 1, 1.25);
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      draw();
    }

    function tick(now: number) {
      if (now - lastFrame >= 1000 / 24) {
        elapsed.current += Math.min((now - lastFrame) / 1000, .1);
        lastFrame = now;
        draw();
      }
      frame = requestAnimationFrame(tick);
    }

    function syncPlayback() {
      cancelAnimationFrame(frame);
      if (!reducedMotion && !document.hidden) {
        lastFrame = performance.now();
        frame = requestAnimationFrame(tick);
      }
    }

    resize();
    syncPlayback();
    window.addEventListener("resize", resize);
    document.addEventListener("visibilitychange", syncPlayback);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("resize", resize);
      document.removeEventListener("visibilitychange", syncPlayback);
    };
  }, [dark, reducedMotion]);

  return <canvas ref={canvasRef} className="track-signal-background" aria-hidden="true" />;
}
