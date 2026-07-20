"use client";

import { useEffect, useRef } from "react";

// Renders a helix-shaped neural/molecular node field using a classic 2D
// projection trick: x is scaled by cos(phase) to fake rotation around the
// vertical axis, z (from the same phase) drives depth-based glow and width.
// A handful of bright "signal" pulses travel along the strands on top of
// the static structure, reinforcing that this is a live system, not art.
export default function MolecularField({ className = "" }) {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");

    const reduceMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;

    let width = 0;
    let height = 0;
    let dpr = Math.min(window.devicePixelRatio || 1, 2);

    let pointer = { x: 0, y: 0, targetX: 0, targetY: 0 };
    let scrollFactor = 0;
    let rotation = 0;
    let raf;

    function resize() {
      const rect = canvas.parentElement.getBoundingClientRect();
      width = rect.width;
      height = rect.height;
      canvas.width = width * dpr;
      canvas.height = height * dpr;
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    function onPointerMove(e) {
      const rect = canvas.getBoundingClientRect();
      pointer.targetX = (e.clientX - rect.left - width / 2) / width;
      pointer.targetY = (e.clientY - rect.top - height / 2) / height;
    }

    function onScroll() {
      scrollFactor = Math.min(window.scrollY / (window.innerHeight || 1), 1.2);
    }

    const NODE_COUNT = 46;
    const PULSE_COUNT = 4;
    const pulses = Array.from({ length: PULSE_COUNT }, (_, i) => ({
      offset: i / PULSE_COUNT,
      speed: 0.00009 + (i % 2) * 0.00002,
      strand: i % 2,
    }));

    const AMPLITUDE = () => Math.min(width * 0.16, 150);
    const SPACING = () => height / (NODE_COUNT - 1);

    function lerp(a, b, t) {
      return a + (b - a) * t;
    }

    function draw(time) {
      ctx.clearRect(0, 0, width, height);

      pointer.x += (pointer.targetX - pointer.x) * 0.04;
      pointer.y += (pointer.targetY - pointer.y) * 0.04;

      if (!reduceMotion) {
        rotation = time * 0.00016 + scrollFactor * 0.6;
      }

      const cx = width * 0.66 + pointer.x * 40;
      const amp = AMPLITUDE();
      const spacing = SPACING();
      const tilt = pointer.y * 0.3;

      const strandA = [];
      const strandB = [];

      for (let i = 0; i < NODE_COUNT; i++) {
        const t = i / (NODE_COUNT - 1);
        const phase = t * Math.PI * 3.6 + rotation;
        const y = i * spacing - scrollFactor * spacing * 4;

        const xA = Math.cos(phase) * amp;
        const zA = Math.sin(phase);
        const xB = Math.cos(phase + Math.PI) * amp;
        const zB = Math.sin(phase + Math.PI);

        strandA.push({ x: cx + xA, y: y + zA * tilt * amp, z: zA });
        strandB.push({ x: cx + xB, y: y + zB * tilt * amp, z: zB });
      }

      function depthStyle(z, base) {
        const d = (z + 1) / 2;
        return { alpha: 0.12 + d * 0.5, width: base + d * 1.3 };
      }

      // rungs
      for (let i = 0; i < NODE_COUNT; i += 2) {
        const a = strandA[i];
        const b = strandB[i];
        if (!a || !b || a.y < -20 || a.y > height + 20) continue;
        const avgZ = (a.z + b.z) / 2;
        const s = depthStyle(avgZ, 0.6);
        ctx.strokeStyle = `rgba(200, 162, 74, ${s.alpha * 0.45})`;
        ctx.lineWidth = s.width;
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);
        ctx.stroke();
      }

      // strands (glow via shadowBlur)
      [strandA, strandB].forEach((strand) => {
        for (let i = 0; i < strand.length - 1; i++) {
          const p1 = strand[i];
          const p2 = strand[i + 1];
          if (p1.y < -20 && p2.y < -20) continue;
          if (p1.y > height + 20 && p2.y > height + 20) continue;
          const s = depthStyle((p1.z + p2.z) / 2, 0.9);
          ctx.save();
          ctx.shadowColor = "rgba(226, 195, 131, 0.35)";
          ctx.shadowBlur = 3;
          ctx.strokeStyle = `rgba(226, 195, 131, ${s.alpha})`;
          ctx.lineWidth = s.width;
          ctx.beginPath();
          ctx.moveTo(p1.x, p1.y);
          ctx.lineTo(p2.x, p2.y);
          ctx.stroke();
          ctx.restore();
        }
        strand.forEach((p) => {
          if (p.y < -20 || p.y > height + 20) return;
          const s = depthStyle(p.z, 1.2);
          ctx.save();
          ctx.shadowColor = "rgba(226, 195, 131, 0.5)";
          ctx.shadowBlur = 4;
          ctx.beginPath();
          ctx.fillStyle = `rgba(226, 195, 131, ${s.alpha})`;
          ctx.arc(p.x, p.y, s.width, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
        });
      });

      // traveling signal pulses
      if (!reduceMotion) {
        pulses.forEach((p) => {
          const t = ((time * p.speed + p.offset) % 1 + 1) % 1;
          const strand = p.strand === 0 ? strandA : strandB;
          const fPos = t * (strand.length - 1);
          const i = Math.floor(fPos);
          const frac = fPos - i;
          const a = strand[i];
          const b = strand[Math.min(i + 1, strand.length - 1)];
          if (!a || !b) return;
          const x = lerp(a.x, b.x, frac);
          const y = lerp(a.y, b.y, frac);
          if (y < -20 || y > height + 20) return;
          const z = lerp(a.z, b.z, frac);
          const d = (z + 1) / 2;

          ctx.save();
          ctx.shadowColor = "rgba(226, 195, 131, 0.9)";
          ctx.shadowBlur = 10;
          ctx.beginPath();
          ctx.fillStyle = `rgba(240, 215, 160, ${0.5 + d * 0.5})`;
          ctx.arc(x, y, 1.6 + d * 1.4, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
        });
      }

      raf = requestAnimationFrame(draw);
    }

    resize();
    draw(0);

    if (reduceMotion) {
      cancelAnimationFrame(raf);
    }

    window.addEventListener("resize", resize);
    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("scroll", onScroll, { passive: true });

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("scroll", onScroll);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className={`pointer-events-none block h-full w-full ${className}`}
    />
  );
}
