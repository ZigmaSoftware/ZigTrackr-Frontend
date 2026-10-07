import { gsap } from "gsap";

// Preserve the supplied reference's motion, scoped to this route. All global
// listeners, animation frames and GSAP effects are disposed on navigation.
export function setupLoginAnimations(root) {
  const disposers = [];
  const intervals = [];
  let frame = 0;
  let context;
  const listen = (target, type, callback, options) => {
    const handler = (event) => context.add(() => callback(event));
    target.addEventListener(type, handler, options);
    disposers.push(() => target.removeEventListener(type, handler, options));
  };
  context = gsap.context(() => {
    const reduceMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    const gsapAvailable = true;

    const authShell = root.querySelector("#authShell");
    const authCard = root.querySelector("#authCard");
    const scene = root.querySelector("#scene");
    const cursorLens = root.querySelector("#cursorLens");
    const neonField = root.querySelector("#neonField");
    const neonCursor = root.querySelector("#neonCursor");
    const signalField = root.querySelector("#signalField");
    const submitButton = root.querySelector("#submitButton");
    const passwordToggle = root.querySelector("#passwordToggle");

    const setStaticFallback = () => {
      root.querySelectorAll(".reveal").forEach((el) => {
        el.style.opacity = "1";
        el.style.transform = "none";
      });
      root.querySelectorAll(".headline .line > span").forEach((el) => {
        el.style.transform = "none";
      });
    };

    if (!gsapAvailable || reduceMotion) {
      setStaticFallback();
    } else {
      const intro = gsap.timeline({ defaults: { ease: "power4.out" } });
      intro
        .from(".brand", { y: -18, opacity: 0, duration: 0.75 })
        .from(
          ".headline .line > span",
          {
            yPercent: 115,
            rotate: 2.4,
            duration: 1.15,
            stagger: 0.11,
            ease: "power4.out",
          },
          "-=0.36",
        )
        .to(
          ".reveal",
          {
            y: 0,
            opacity: 1,
            duration: 0.9,
            stagger: 0.075,
            ease: "power4.out",
          },
          "-=0.72",
        )
        .from(
          authShell,
          {
            x: 54,
            rotateY: -7,
            opacity: 0,
            duration: 1.15,
            ease: "power4.out",
          },
          "-=1.0",
        )
        .from(
          signalField,
          {
            y: 42,
            scale: 0.96,
            opacity: 0,
            duration: 1.15,
            ease: "power4.out",
          },
          "-=0.96",
        )
        .from(
          neonField,
          { opacity: 0, duration: 1.1, ease: "power3.out" },
          "-=0.9",
        );

      gsap.to("[data-orb='a']", {
        xPercent: 16,
        yPercent: -8,
        scale: 1.12,
        duration: 10,
        repeat: -1,
        yoyo: true,
        ease: "sine.inOut",
      });

      gsap.to("[data-orb='b']", {
        xPercent: -18,
        yPercent: 12,
        scale: 1.2,
        duration: 12,
        repeat: -1,
        yoyo: true,
        ease: "sine.inOut",
      });

      gsap.utils.toArray(".signal-word").forEach((word, index) => {
        gsap.to(word, {
          x: index % 2 === 0 ? 18 : -14,
          y: index % 2 === 0 ? -10 : 12,
          rotate: index % 2 === 0 ? "+=1.4" : "-=1.2",
          opacity: index % 2 === 0 ? 0.62 : 0.48,
          duration: 5.8 + index * 0.65,
          repeat: -1,
          yoyo: true,
          ease: "sine.inOut",
        });
      });

      gsap.to(".workflow-step", {
        y: -3,
        duration: 2.6,
        stagger: 0.18,
        repeat: -1,
        yoyo: true,
        ease: "sine.inOut",
      });

      gsap.fromTo(
        ".scanbeam",
        { "--scan-y": "0px" },
        {
          "--scan-y": "760px",
          duration: 5.4,
          repeat: -1,
          ease: "none",
        },
      );

      gsap.to(authShell, {
        "--angle": "360deg",
        duration: 11,
        repeat: -1,
        ease: "none",
      });

      const brandMark = root.querySelector("#brandMark");
      const shine = () => {
        gsap.fromTo(
          brandMark,
          { filter: "brightness(1)" },
          {
            filter: "brightness(1.12)",
            duration: 0.28,
            yoyo: true,
            repeat: 1,
            ease: "sine.inOut",
          },
        );
      };
      intervals.push(window.setInterval(() => context.add(shine), 3600));

      let mouseX = window.innerWidth / 2;
      let mouseY = window.innerHeight / 2;
      let targetX = mouseX;
      let targetY = mouseY;

      const lensX = gsap.quickTo(cursorLens, "x", {
        duration: 0.55,
        ease: "power3.out",
      });
      const lensY = gsap.quickTo(cursorLens, "y", {
        duration: 0.55,
        ease: "power3.out",
      });

      const neonState = {
        x: window.innerWidth * 0.42,
        y: window.innerHeight * 0.58,
        targetX: window.innerWidth * 0.42,
        targetY: window.innerHeight * 0.58,
        lastMove: performance.now(),
        idleMix: 0,
        rotation: 0,
        velocity: 0,
        previousX: window.innerWidth * 0.42,
        previousY: window.innerHeight * 0.58,
      };

      const neonLines = [
        { color: "#55d7ff", edge: "left", phase: 0.2, radius: 76, width: 2.1 },
        { color: "#9cf7cf", edge: "top", phase: 1.35, radius: 91, width: 2.35 },
        {
          color: "#d5ff87",
          edge: "right",
          phase: 2.45,
          radius: 106,
          width: 2.15,
        },
        {
          color: "#ff7d86",
          edge: "bottom",
          phase: 3.55,
          radius: 121,
          width: 2.4,
        },
        {
          color: "#a592ff",
          edge: "left",
          phase: 4.72,
          radius: 136,
          width: 2.3,
        },
      ];

      const getEdgeAnchor = (line, index, width, height, time) => {
        const drift = time * (0.00012 + index * 0.000012);
        const wave = Math.sin(drift * 2.3 + line.phase);
        const wave2 = Math.cos(drift * 1.7 + line.phase * 0.75);
        if (line.edge === "left") {
          return {
            x: -40,
            y: height * (0.2 + index * 0.12) + wave * height * 0.14,
          };
        }
        if (line.edge === "right") {
          return { x: width + 40, y: height * 0.34 + wave2 * height * 0.2 };
        }
        if (line.edge === "top") {
          return { x: width * 0.3 + wave * width * 0.22, y: -38 };
        }
        return { x: width * 0.66 + wave2 * width * 0.2, y: height + 40 };
      };

      const resizeNeonField = () => {
        const ratio = Math.min(window.devicePixelRatio || 1, 2);
        neonField.width = Math.max(1, Math.floor(window.innerWidth * ratio));
        neonField.height = Math.max(1, Math.floor(window.innerHeight * ratio));
        neonField.style.width = `${window.innerWidth}px`;
        neonField.style.height = `${window.innerHeight}px`;
        const ctx = neonField.getContext("2d");
        ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
      };

      resizeNeonField();
      listen(window, "resize", resizeNeonField);

      const drawFullPageNeon = (time) => {
        const ctx = neonField.getContext("2d");
        const width = window.innerWidth;
        const height = window.innerHeight;
        ctx.clearRect(0, 0, width, height);
        ctx.lineCap = "round";
        ctx.lineJoin = "round";

        const lerp = 0.16;
        neonState.x += (neonState.targetX - neonState.x) * lerp;
        neonState.y += (neonState.targetY - neonState.y) * lerp;

        const dxv = neonState.x - neonState.previousX;
        const dyv = neonState.y - neonState.previousY;
        const instantVelocity = Math.min(40, Math.hypot(dxv, dyv));
        neonState.velocity += (instantVelocity - neonState.velocity) * 0.16;
        neonState.previousX = neonState.x;
        neonState.previousY = neonState.y;

        const isIdle = performance.now() - neonState.lastMove > 150;
        const idleTarget = isIdle ? 1 : 0;
        neonState.idleMix += (idleTarget - neonState.idleMix) * 0.065;
        neonState.rotation += 0.011 + neonState.velocity * 0.00042;

        neonLines.forEach((line, index) => {
          const anchor = getEdgeAnchor(line, index, width, height, time);
          const dx = neonState.x - anchor.x;
          const dy = neonState.y - anchor.y;
          const curvePush = 0.16 + index * 0.025;
          const c1x = anchor.x + dx * (0.26 + curvePush * 0.18);
          const c1y =
            anchor.y +
            dy * (0.08 + curvePush * 0.34) +
            Math.sin(time * 0.0012 + line.phase) * 46;
          const c2x =
            neonState.x -
            dx * (0.18 + curvePush * 0.16) +
            Math.cos(time * 0.001 + line.phase) * 58;
          const c2y =
            neonState.y -
            dy * 0.16 +
            Math.sin(time * 0.00145 + line.phase) * 38;

          const movingAlpha = 1 - neonState.idleMix * 0.88;
          const baseAlpha = 0.54 + Math.min(neonState.velocity / 22, 0.24);

          const layers = [
            { width: 18, alpha: 0.025 },
            { width: 10, alpha: 0.05 },
            { width: 5.2, alpha: 0.1 },
            { width: line.width, alpha: baseAlpha },
          ];

          layers.forEach((layer, layerIndex) => {
            ctx.save();
            ctx.globalAlpha = movingAlpha * layer.alpha;
            ctx.strokeStyle = line.color;
            ctx.lineWidth = layer.width;
            ctx.shadowBlur = layerIndex === layers.length - 1 ? 28 : 0;
            ctx.shadowColor = line.color;
            ctx.beginPath();
            ctx.moveTo(anchor.x, anchor.y);
            ctx.bezierCurveTo(c1x, c1y, c2x, c2y, neonState.x, neonState.y);
            ctx.stroke();
            ctx.restore();
          });

          const orbitRadius =
            line.radius + Math.sin(time * 0.001 + line.phase) * 5;
          const startAngle =
            neonState.rotation * (1 + index * 0.035) + line.phase;
          const arcSpan = 1.15 + index * 0.09;

          ctx.save();
          ctx.globalAlpha = neonState.idleMix * 0.17;
          ctx.strokeStyle = line.color;
          ctx.lineWidth = 14;
          ctx.beginPath();
          ctx.arc(
            neonState.x,
            neonState.y,
            orbitRadius,
            startAngle,
            startAngle + arcSpan,
          );
          ctx.stroke();
          ctx.restore();

          ctx.save();
          ctx.globalAlpha = neonState.idleMix * 0.98;
          ctx.strokeStyle = line.color;
          ctx.lineWidth = 3.6;
          ctx.shadowBlur = 30;
          ctx.shadowColor = line.color;
          ctx.beginPath();
          ctx.arc(
            neonState.x,
            neonState.y,
            orbitRadius,
            startAngle,
            startAngle + arcSpan,
          );
          ctx.stroke();
          ctx.restore();

          const orbitDotAngle = startAngle + arcSpan;
          const dotX = neonState.x + Math.cos(orbitDotAngle) * orbitRadius;
          const dotY = neonState.y + Math.sin(orbitDotAngle) * orbitRadius;
          ctx.save();
          ctx.globalAlpha = neonState.idleMix;
          ctx.fillStyle = line.color;
          ctx.shadowBlur = 20;
          ctx.shadowColor = line.color;
          ctx.beginPath();
          ctx.arc(dotX, dotY, 3.5, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
        });

        if (neonState.idleMix > 0.02) {
          ctx.save();
          ctx.globalAlpha = neonState.idleMix * 0.28;
          ctx.strokeStyle = "rgba(255,255,255,0.38)";
          ctx.lineWidth = 1;
          ctx.setLineDash([2, 8]);
          ctx.beginPath();
          ctx.arc(neonState.x, neonState.y, 155, 0, Math.PI * 2);
          ctx.stroke();
          ctx.restore();
        }

        const glowRadius = 110 + neonState.velocity * 1.8;
        const centerGlow = ctx.createRadialGradient(
          neonState.x,
          neonState.y,
          0,
          neonState.x,
          neonState.y,
          glowRadius,
        );
        centerGlow.addColorStop(
          0,
          `rgba(255,255,255,${0.24 + neonState.idleMix * 0.08})`,
        );
        centerGlow.addColorStop(0.18, "rgba(85,215,255,0.16)");
        centerGlow.addColorStop(0.5, "rgba(165,146,255,0.07)");
        centerGlow.addColorStop(1, "rgba(85,215,255,0)");
        ctx.save();
        ctx.fillStyle = centerGlow;
        ctx.beginPath();
        ctx.arc(neonState.x, neonState.y, glowRadius, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();

        gsap.set(neonCursor, { x: neonState.x, y: neonState.y });
        frame = window.requestAnimationFrame(drawFullPageNeon);
      };
      frame = window.requestAnimationFrame(drawFullPageNeon);

      listen(
        window,
        "pointermove",
        (event) => {
          targetX = event.clientX;
          targetY = event.clientY;
          mouseX = targetX;
          mouseY = targetY;
          neonState.targetX = event.clientX;
          neonState.targetY = event.clientY;
          neonState.lastMove = performance.now();

          lensX(mouseX);
          lensY(mouseY);
          gsap.to(cursorLens, { opacity: 0.7, duration: 0.35 });
          gsap.to(neonCursor, {
            opacity: 1,
            duration: 0.28,
            ease: "power3.out",
          });

          const sceneRect = scene.getBoundingClientRect();
          const sx =
            (event.clientX - sceneRect.left) / Math.max(sceneRect.width, 1) -
            0.5;
          const sy =
            (event.clientY - sceneRect.top) / Math.max(sceneRect.height, 1) -
            0.5;

          gsap.to(scene, {
            rotateY: sx * 3.2,
            rotateX: -sy * 2.4,
            duration: 1.05,
            ease: "power3.out",
            transformOrigin: "50% 50%",
          });

          gsap.to(signalField, {
            x: sx * 14,
            y: sy * 10,
            duration: 1.15,
            ease: "power3.out",
          });
        },
        { passive: true },
      );

      listen(document, "pointerleave", () => {
        gsap.to(cursorLens, { opacity: 0, duration: 0.5 });
        gsap.to(neonCursor, { opacity: 0, duration: 0.45 });
        gsap.to(scene, {
          rotateX: 0,
          rotateY: 0,
          duration: 1,
          ease: "power3.out",
        });
        gsap.to(signalField, { x: 0, y: 0, duration: 1, ease: "power3.out" });
      });

      listen(authShell, "pointermove", (event) => {
        const rect = authShell.getBoundingClientRect();
        const px = (event.clientX - rect.left) / rect.width - 0.5;
        const py = (event.clientY - rect.top) / rect.height - 0.5;
        gsap.to(authShell, {
          rotateY: px * 5.5,
          rotateX: py * -4.5,
          x: px * 5,
          y: py * 4,
          duration: 0.85,
          ease: "power3.out",
        });
        gsap.to(authCard, {
          x: px * -4,
          y: py * -3,
          duration: 0.9,
          ease: "power3.out",
        });
      });

      listen(authShell, "pointerleave", () => {
        gsap.to(authShell, {
          rotateX: 0,
          rotateY: 0,
          x: 0,
          y: 0,
          duration: 1.1,
          ease: "elastic.out(1, 0.7)",
        });
        gsap.to(authCard, { x: 0, y: 0, duration: 1, ease: "power3.out" });
      });

      const magnetic = (button) => {
        listen(button, "pointermove", (event) => {
          const rect = button.getBoundingClientRect();
          const dx = event.clientX - (rect.left + rect.width / 2);
          const dy = event.clientY - (rect.top + rect.height / 2);
          gsap.to(button, {
            x: dx * 0.08,
            y: dy * 0.08,
            duration: 0.45,
            ease: "power3.out",
          });
        });
        listen(button, "pointerleave", () => {
          gsap.to(button, {
            x: 0,
            y: 0,
            duration: 0.8,
            ease: "elastic.out(1, 0.6)",
          });
        });
      };
      magnetic(submitButton);
      listen(passwordToggle, "click", () => {
        gsap.fromTo(
          passwordToggle,
          { rotate: -8, scale: 0.92 },
          {
            rotate: 0,
            scale: 1,
            duration: 0.5,
            ease: "back.out(1.8)",
          },
        );
      });
      listen(root.querySelector("#loginForm"), "submit", () => {
        if (
          !root.querySelector("#username").value.trim() ||
          !root.querySelector("#password").value
        ) {
          gsap.fromTo(
            authShell,
            { x: -6 },
            { x: 6, duration: 0.07, repeat: 5, yoyo: true, clearProps: "x" },
          );
        }
      });

      listen(submitButton, "pointerenter", () => {
        gsap.fromTo(
          submitButton,
          { "--shine": "0%" },
          { "--shine": "100%", duration: 0.8, ease: "power2.out" },
        );
        gsap.fromTo(
          submitButton,
          { filter: "brightness(1)" },
          { filter: "brightness(1.06)", duration: 0.35, yoyo: true, repeat: 1 },
        );
      });
    }
  }, root);
  return () => {
    disposers.forEach((dispose) => dispose());
    intervals.forEach((id) => window.clearInterval(id));
    window.cancelAnimationFrame(frame);
    context.revert();
  };
}
