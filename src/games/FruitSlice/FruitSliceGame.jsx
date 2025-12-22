import React, { useEffect, useMemo, useRef, useState } from "react";

/**
 * FruitSliceGame.jsx (stable)
 * - Full-screen canvas fruit slicing
 * - Round ends on timer OR bomb hit
 * - Spawns & animation STOP reliably (no stale state closure)
 * - Submits score ONCE via onSubmitScore, then Continue navigates via onGameEnd
 */

// ---- SETTINGS ----
const REVEAL_SCORE_THRESHOLD = 100; // you said 100
const ROUND_SECONDS = 30;

const SPAWN_INTERVAL_MS = 650;
const GRAVITY = 1400;

const FRUIT_RADIUS_MIN = 24;
const FRUIT_RADIUS_MAX = 38;

const BOMB_CHANCE = 0.12; // 0 disables bombs

function rand(min, max) {
  return Math.random() * (max - min) + min;
}

function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v));
}

// Distance from point P to segment AB, squared
function distToSegmentSquared(px, py, ax, ay, bx, by) {
  const vx = bx - ax;
  const vy = by - ay;
  const wx = px - ax;
  const wy = py - ay;

  const c1 = wx * vx + wy * vy;
  if (c1 <= 0) return (px - ax) ** 2 + (py - ay) ** 2;

  const c2 = vx * vx + vy * vy;
  if (c2 <= c1) return (px - bx) ** 2 + (py - by) ** 2;

  const t = c1 / c2;
  const projX = ax + t * vx;
  const projY = ay + t * vy;
  return (px - projX) ** 2 + (py - projY) ** 2;
}

function safeId() {
  return globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`;
}

export default function FruitSliceGame({ onSubmitScore, onGameEnd }) {
  const canvasRef = useRef(null);

  // RAF + timing
  const rafRef = useRef(null);
  const lastTRef = useRef(null);

  // Game objects
  const objectsRef = useRef([]);

  // Swipe state
  const swipeRef = useRef({
    isDown: false,
    lastX: null,
    lastY: null,
    trail: [],
  });

  // Phase refs to avoid stale closures
  const [phase, setPhase] = useState("playing"); // playing | over
  const phaseRef = useRef("playing");

  const [score, setScore] = useState(0);
  const scoreRef = useRef(0);

  const [timeLeft, setTimeLeft] = useState(ROUND_SECONDS);
  const timeRef = useRef(ROUND_SECONDS);

  const [endReason, setEndReason] = useState("time"); // "time" | "bomb"
  const submittedRef = useRef(false);

  const devicePixelRatio = useMemo(() => window.devicePixelRatio || 1, []);

  // Keep refs in sync
  useEffect(() => {
    phaseRef.current = phase;
  }, [phase]);

  useEffect(() => {
    scoreRef.current = score;
  }, [score]);

  useEffect(() => {
    timeRef.current = timeLeft;
  }, [timeLeft]);

  // ---- END ROUND (single source of truth) ----
  const endRound = (reason) => {
    if (phaseRef.current !== "playing") return;

    setEndReason(reason);
    setPhase("over");

    // stop swipe interaction immediately
    swipeRef.current.isDown = false;
    swipeRef.current.lastX = null;
    swipeRef.current.lastY = null;
    swipeRef.current.trail = [];

    // submit score ONCE
    if (!submittedRef.current) {
      submittedRef.current = true;
      onSubmitScore?.(scoreRef.current);
    }
  };

  // ---- RESET ----
  const resetRound = () => {
    // stop any running RAF before restarting
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
    lastTRef.current = null;

    objectsRef.current = [];
    swipeRef.current = { isDown: false, lastX: null, lastY: null, trail: [] };

    submittedRef.current = false;

    setScore(0);
    setTimeLeft(ROUND_SECONDS);
    setEndReason("time");
    setPhase("playing");
  };

  // ---- CANVAS RESIZE ----
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const resize = () => {
      const w = window.innerWidth;
      const h = window.innerHeight;

      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      canvas.width = Math.floor(w * devicePixelRatio);
      canvas.height = Math.floor(h * devicePixelRatio);

      const ctx = canvas.getContext("2d");
      ctx.setTransform(devicePixelRatio, 0, 0, devicePixelRatio, 0, 0);
    };

    resize();
    window.addEventListener("resize", resize);
    return () => window.removeEventListener("resize", resize);
  }, [devicePixelRatio]);

  // ---- TIMER (interval, reliable stop) ----
  useEffect(() => {
    if (phase !== "playing") return;

    const interval = setInterval(() => {
      // compute next time
      const next = timeRef.current - 1;
      setTimeLeft(next);

      if (next <= 0) {
        clearInterval(interval);
        endRound("time");
      }
    }, 1000);

    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  // ---- SPAWNER (stops when phase changes) ----
  useEffect(() => {
    if (phase !== "playing") return;

    const spawn = () => {
      if (phaseRef.current !== "playing") return;

      const w = window.innerWidth;
      const h = window.innerHeight;

      const isBomb = Math.random() < BOMB_CHANCE;
      const r = rand(FRUIT_RADIUS_MIN, FRUIT_RADIUS_MAX);

      const x = rand(r + 20, w - r - 20);
      const y = h + r + 20;

      const vx = rand(-260, 260);
      const vy = rand(-1150, -900);

      objectsRef.current.push({
        id: safeId(),
        type: isBomb ? "bomb" : "fruit",
        x,
        y,
        vx,
        vy,
        r,
        sliced: false,
        bornAt: performance.now(),
      });
    };

    const interval = setInterval(spawn, SPAWN_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [phase]);

  // ---- INPUT (MOUSE + TOUCH) ----
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const getXY = (e) => {
      const rect = canvas.getBoundingClientRect();
      const clientX = "touches" in e ? e.touches[0].clientX : e.clientX;
      const clientY = "touches" in e ? e.touches[0].clientY : e.clientY;
      return { x: clientX - rect.left, y: clientY - rect.top };
    };

    const onDown = (e) => {
      if (phaseRef.current !== "playing") return;
      if ("touches" in e) e.preventDefault?.();

      const { x, y } = getXY(e);
      swipeRef.current.isDown = true;
      swipeRef.current.lastX = x;
      swipeRef.current.lastY = y;
      swipeRef.current.trail = [{ x, y, t: performance.now() }];
    };

    const onMove = (e) => {
      if (phaseRef.current !== "playing") return;
      if (!swipeRef.current.isDown) return;
      if ("touches" in e) e.preventDefault?.();

      const { x, y } = getXY(e);
      const { lastX, lastY } = swipeRef.current;

      if (lastX != null && lastY != null) {
        const ax = lastX;
        const ay = lastY;
        const bx = x;
        const by = y;

        const objs = objectsRef.current;

        for (const obj of objs) {
          if (obj.sliced) continue;
          if (obj.type !== "fruit" && obj.type !== "bomb") continue;

          const d2 = distToSegmentSquared(obj.x, obj.y, ax, ay, bx, by);
          const hitRadius = obj.r + 10;

          if (d2 <= hitRadius * hitRadius) {
            obj.sliced = true;

            // BOMB: end immediately
            if (obj.type === "bomb") {
              endRound("bomb");
              return;
            }

            // FRUIT: score + particles
            setScore((s) => s + 100);

            const now = performance.now();
            objectsRef.current.push(
              {
                id: obj.id + "-p1",
                type: "particle",
                x: obj.x,
                y: obj.y,
                vx: obj.vx - 220,
                vy: obj.vy - 140,
                r: obj.r * 0.4,
                bornAt: now,
              },
              {
                id: obj.id + "-p2",
                type: "particle",
                x: obj.x,
                y: obj.y,
                vx: obj.vx + 220,
                vy: obj.vy - 140,
                r: obj.r * 0.4,
                bornAt: now,
              }
            );
          }
        }
      }

      swipeRef.current.lastX = x;
      swipeRef.current.lastY = y;

      swipeRef.current.trail.push({ x, y, t: performance.now() });
      const cutoff = performance.now() - 120;
      swipeRef.current.trail = swipeRef.current.trail.filter((p) => p.t >= cutoff);
    };

    const onUp = () => {
      swipeRef.current.isDown = false;
      swipeRef.current.lastX = null;
      swipeRef.current.lastY = null;
      swipeRef.current.trail = [];
    };

    canvas.addEventListener("mousedown", onDown);
    canvas.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);

    // passive:false so preventDefault works
    canvas.addEventListener("touchstart", onDown, { passive: false });
    canvas.addEventListener("touchmove", onMove, { passive: false });
    window.addEventListener("touchend", onUp);

    return () => {
      canvas.removeEventListener("mousedown", onDown);
      canvas.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);

      canvas.removeEventListener("touchstart", onDown);
      canvas.removeEventListener("touchmove", onMove);
      window.removeEventListener("touchend", onUp);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ---- MAIN LOOP (PHYSICS + DRAW) ----
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");

    const loop = (t) => {
      // If round ended, do NOT keep animating
      if (phaseRef.current !== "playing") return;

      if (!lastTRef.current) lastTRef.current = t;
      const dt = clamp((t - lastTRef.current) / 1000, 0, 0.033);
      lastTRef.current = t;

      const w = window.innerWidth;
      const h = window.innerHeight;

      // background
      ctx.clearRect(0, 0, w, h);
      ctx.fillStyle = "#fff1f2";
      ctx.fillRect(0, 0, w, h);

      // physics
      const objs = objectsRef.current;
      for (const obj of objs) {
        if (obj.type === "particle") obj.vy += GRAVITY * dt * 0.55;
        else obj.vy += GRAVITY * dt;

        obj.x += obj.vx * dt;
        obj.y += obj.vy * dt;
      }

      // cull
      const now = performance.now();
      objectsRef.current = objs.filter((obj) => {
        if (obj.type === "fruit" || obj.type === "bomb") {
          if (obj.sliced) return false;
          if (obj.y > h + 220) return false;
          if (obj.x < -220 || obj.x > w + 220) return false;
          return true;
        }
        if (obj.type === "particle") return now - obj.bornAt < 350;
        return true;
      });

      // draw
      for (const obj of objectsRef.current) {
        if (obj.type === "bomb") {
          ctx.beginPath();
          ctx.arc(obj.x, obj.y, obj.r, 0, Math.PI * 2);
          ctx.fillStyle = "#111827";
          ctx.fill();

          ctx.beginPath();
          ctx.arc(obj.x - obj.r * 0.3, obj.y - obj.r * 0.3, obj.r * 0.25, 0, Math.PI * 2);
          ctx.fillStyle = "#374151";
          ctx.fill();
        } else if (obj.type === "fruit") {
          ctx.beginPath();
          ctx.arc(obj.x, obj.y, obj.r, 0, Math.PI * 2);
          ctx.fillStyle = "#fb7185";
          ctx.fill();

          ctx.beginPath();
          ctx.arc(obj.x - obj.r * 0.35, obj.y - obj.r * 0.35, obj.r * 0.35, 0, Math.PI * 2);
          ctx.fillStyle = "rgba(255,255,255,0.35)";
          ctx.fill();
        } else if (obj.type === "particle") {
          ctx.beginPath();
          ctx.arc(obj.x, obj.y, obj.r, 0, Math.PI * 2);
          ctx.fillStyle = "rgba(251,113,133,0.7)";
          ctx.fill();
        }
      }

      // swipe trail
      const trail = swipeRef.current.trail;
      if (trail.length >= 2) {
        ctx.beginPath();
        ctx.moveTo(trail[0].x, trail[0].y);
        for (let i = 1; i < trail.length; i++) ctx.lineTo(trail[i].x, trail[i].y);
        ctx.strokeStyle = "rgba(244,63,94,0.65)";
        ctx.lineWidth = 6;
        ctx.lineCap = "round";
        ctx.stroke();
      }

      // loop
      rafRef.current = requestAnimationFrame(loop);
    };

    if (phase === "playing") {
      lastTRef.current = null;
      rafRef.current = requestAnimationFrame(loop);
    } else {
      // ensure RAF is stopped
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    };
  }, [phase]);

  // ---- ROUND OVER SCREEN ----
  if (phase === "over") {
    const revealUnlocked = score >= REVEAL_SCORE_THRESHOLD;

    return (
      <div className="min-h-screen bg-gradient-to-br from-rose-50 to-rose-100 flex flex-col items-center justify-center text-center p-6">
        <h2 className="text-4xl font-serif text-rose-900 mb-3">Round Over</h2>

        {endReason === "bomb" ? (
          <p className="text-rose-700 mb-4">
            You hit a <span className="font-bold">black</span> ball — instant loss.
          </p>
        ) : (
          <p className="text-rose-700 mb-4">Time’s up.</p>
        )}

        <p className="text-rose-700 mb-8">
          You scored <span className="font-bold">{score}</span>. Score more than{" "}
          <span className="font-bold">{REVEAL_SCORE_THRESHOLD}</span> to reveal the honeymoon.
        </p>

        {revealUnlocked && (
          <div className="mb-8">
            <div className="text-sm text-rose-700 mb-2">Honeymoon Reveal:</div>
            <div className="text-5xl font-bold text-rose-600">Kauai + Maui</div>
          </div>
        )}

        <div className="flex gap-4 w-full max-w-md">
          <button
            onClick={resetRound}
            className="flex-1 px-6 py-4 bg-rose-500 text-white rounded-xl text-lg font-bold shadow-lg hover:bg-rose-600"
          >
            Try Again
          </button>
          <button
            onClick={() => onGameEnd?.(score)}
            className="flex-1 px-6 py-4 bg-white border-2 border-rose-500 text-rose-600 rounded-xl text-lg font-bold hover:bg-rose-50"
          >
            Continue
          </button>
        </div>

        <p className="text-xs text-rose-500 mt-5">
          Tip: long, fast swipes work best. Don’t hit the black balls or you lose.
        </p>
      </div>
    );
  }

  // ---- PLAYING UI ----
  return (
    <div
      className="relative min-h-screen overflow-hidden bg-rose-50"
      style={{ touchAction: "none" }}
    >
      <canvas
        ref={canvasRef}
        className="absolute inset-0"
        style={{ touchAction: "none" }}
      />

      <div className="absolute top-4 left-4 bg-white/85 backdrop-blur px-4 py-2 rounded-xl shadow">
        ⏱ {timeLeft}s
      </div>

      <div className="absolute top-4 right-4 bg-white/85 backdrop-blur px-4 py-2 rounded-xl shadow">
        🍍 {score}
      </div>

      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-white/75 backdrop-blur px-4 py-2 rounded-xl shadow text-sm text-rose-700 text-center">
        Reach <span className="font-bold">{REVEAL_SCORE_THRESHOLD}</span> to reveal the honeymoon.
        <div className="text-xs text-rose-600 mt-1">
          Don’t hit the black balls or you lose.
        </div>
      </div>
    </div>
  );
}
