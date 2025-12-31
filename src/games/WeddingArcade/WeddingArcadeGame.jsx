import React, { useEffect, useMemo, useRef, useState } from "react";

const TILE = 24;
const TICK_MS = 110; // faster = harder

// 0 = open, 1 = wall
// We will auto-fill all open tiles with jellybeans at runtime.
const RAW_MAP = [
  "1111111111111111111",
  "1000000000000000001",
  "1011111101110111101",
  "1000000100000100001",
  "1011110101110101111",
  "1000010001000000001",
  "1111011101011110101",
  "1000000000000000001",
  "1010111110111110101",
  "1000100000100000101",
  "1110101110101110101",
  "1000001000001000001",
  "1011111011111011111",
  "1000000000000000001",
  "1111111111111111111",
];

function parseBaseMap(raw) {
  return raw.map((row) => row.split("").map((c) => Number(c)));
}

function nextPos(p, d) {
  if (d === "up") return { x: p.x, y: p.y - 1 };
  if (d === "down") return { x: p.x, y: p.y + 1 };
  if (d === "left") return { x: p.x - 1, y: p.y };
  if (d === "right") return { x: p.x + 1, y: p.y };
  return p;
}

function isWall(map, p) {
  return map[p.y]?.[p.x] === 1;
}

function sameCell(a, b) {
  return a.x === b.x && a.y === b.y;
}

function fillJellybeans(baseMap, emptyCells) {
  // Returns a new map where every open tile (0) becomes a jellybean (2),
  // except for specified "emptyCells" which remain open (0).
  const empty = new Set(emptyCells.map((p) => `${p.x},${p.y}`));
  return baseMap.map((row, y) =>
    row.map((v, x) => {
      if (v === 1) return 1; // wall
      if (empty.has(`${x},${y}`)) return 0; // keep clear
      return 2; // jellybean
    })
  );
}

function countBeans(map) {
  let n = 0;
  for (const row of map) for (const v of row) if (v === 2) n++;
  return n;
}

function jellybeanGradient(x, y) {
  // deterministic "random" colors so the map doesn’t flicker on re-render
  const palette = [
    ["#ff4d6d", "#c9184a"], // red
    ["#ffd166", "#f4a261"], // yellow/orange
    ["#80ed99", "#38b000"], // green
    ["#74c0fc", "#1c7ed6"], // blue
    ["#b197fc", "#7048e8"], // purple
  ];
  const [c1, c2] = palette[(x * 7 + y * 11) % palette.length];
  return `radial-gradient(circle at 30% 25%, rgba(255,255,255,0.55), transparent 42%),
          linear-gradient(145deg, ${c1}, ${c2})`;
}

export default function WeddingArcadeGame({ onSubmitScore, onGameEnd }) {
  // Positions
  const PLAYER_START = { x: 1, y: 1 };
  const GHOST_STARTS = useMemo(
    () => [
      { x: 9, y: 7 },
      { x: 11, y: 7 },
      { x: 9, y: 8 },
      { x: 11, y: 8 },
    ],
    []
  );

  const baseMap = useMemo(() => parseBaseMap(RAW_MAP), []);

  // Build the actual play map: fill all open tiles with beans.
  const initialMap = useMemo(() => {
    const emptyCells = [PLAYER_START, ...GHOST_STARTS];
    return fillJellybeans(baseMap, emptyCells);
  }, [baseMap, GHOST_STARTS]);

  const [map, setMap] = useState(initialMap);
  const [player, setPlayer] = useState(PLAYER_START);
  const [ghosts, setGhosts] = useState(GHOST_STARTS);

  const [dir, setDir] = useState("right");
  const [pendingDir, setPendingDir] = useState(null);

  const [score, setScore] = useState(0);
  const [beansLeft, setBeansLeft] = useState(() => countBeans(initialMap));

  // ui: instructions -> playing -> reveal | over
  const [ui, setUi] = useState("instructions");
  const [status, setStatus] = useState("playing"); // playing | win | over

  const [startTime, setStartTime] = useState(null);

  const boardRef = useRef(null);

  const width = RAW_MAP[0].length * TILE;
  const height = RAW_MAP.length * TILE;

  // Reset everything
  const reset = () => {
    setMap(initialMap);
    setPlayer(PLAYER_START);
    setGhosts(GHOST_STARTS);
    setDir("right");
    setPendingDir(null);
    setScore(0);
    setBeansLeft(countBeans(initialMap));
    setStatus("playing");
    setStartTime(Date.now());
    setUi("playing");
  };

  // Keyboard controls
  useEffect(() => {
    const onKeyDown = (e) => {
      if (ui !== "playing" || status !== "playing") return;

      const d =
        e.key === "ArrowUp"
          ? "up"
          : e.key === "ArrowDown"
          ? "down"
          : e.key === "ArrowLeft"
          ? "left"
          : e.key === "ArrowRight"
          ? "right"
          : null;

      if (d) {
        e.preventDefault();
        setPendingDir(d);
      }
    };

    window.addEventListener("keydown", onKeyDown, { passive: false });
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [ui, status]);

  // Swipe controls
  useEffect(() => {
    const el = boardRef.current;
    if (!el) return;

    let sx = 0;
    let sy = 0;

    const onStart = (e) => {
      if (ui !== "playing" || status !== "playing") return;
      const t = e.touches[0];
      sx = t.clientX;
      sy = t.clientY;
    };

    const onEnd = (e) => {
      if (ui !== "playing" || status !== "playing") return;
      const t = e.changedTouches[0];
      const dx = t.clientX - sx;
      const dy = t.clientY - sy;

      if (Math.abs(dx) < 20 && Math.abs(dy) < 20) return;

      const d =
        Math.abs(dx) > Math.abs(dy)
          ? dx > 0
            ? "right"
            : "left"
          : dy > 0
          ? "down"
          : "up";

      setPendingDir(d);
    };

    el.addEventListener("touchstart", onStart, { passive: true });
    el.addEventListener("touchend", onEnd, { passive: true });

    return () => {
      el.removeEventListener("touchstart", onStart);
      el.removeEventListener("touchend", onEnd);
    };
  }, [ui, status]);

  // Main game loop
  useEffect(() => {
    if (ui !== "playing" || status !== "playing") return;

    const id = setInterval(() => {
      // Move player
      setPlayer((p) => {
        // try pending direction
        if (pendingDir) {
          const t = nextPos(p, pendingDir);
          if (!isWall(map, t)) {
            setDir(pendingDir);
            setPendingDir(null);
            return t;
          }
        }

        // go forward
        const f = nextPos(p, dir);
        return isWall(map, f) ? p : f;
      });

      // Move ghosts: random legal move, faster pressure via count + tick rate
      setGhosts((gs) =>
        gs.map((g) => {
          const moves = ["up", "down", "left", "right"]
            .map((d) => nextPos(g, d))
            .filter((p) => !isWall(map, p));
          if (!moves.length) return g;
          return moves[Math.floor(Math.random() * moves.length)];
        })
      );
    }, TICK_MS);

    return () => clearInterval(id);
  }, [ui, status, dir, pendingDir, map]);

  // Collect beans + check collisions
  useEffect(() => {
    if (ui !== "playing" || status !== "playing") return;

    // Collect bean
    if (map[player.y]?.[player.x] === 2) {
      setMap((prev) => {
        const copy = prev.map((r) => r.slice());
        copy[player.y][player.x] = 0;
        return copy;
      });

      // Score decay: perfect score becomes effectively impossible
      // Bean value starts high and decays over time.
      const elapsedSec = startTime ? (Date.now() - startTime) / 1000 : 0;
      const beanValue = Math.max(1, Math.floor(12 - elapsedSec / 6)); // decays to 1
      setScore((s) => s + beanValue);

      setBeansLeft((n) => n - 1);
    }

    // Ghost collision
    for (const g of ghosts) {
  if (sameCell(player, g)) {
    setStatus("over");
    setUi("reveal"); // still show the dinner reveal even if they lose
    return;
  }
}

  }, [player, ghosts, map, ui, status, startTime]);

  // Win: all beans collected
  useEffect(() => {
    if (ui !== "playing" || status !== "playing") return;
    if (beansLeft <= 0) {
      setStatus("win");
      setUi("reveal");
    }
  }, [beansLeft, ui, status]);

  const continueAfterReveal = () => {
  const winBonus = status === "win" ? 250 : 0;
  const finalScore = score + winBonus;

  onSubmitScore?.(finalScore);
  onGameEnd?.(finalScore);
};


  return (
    <div className="min-h-screen bg-rose-50 p-4 flex flex-col items-center">
      {/* Header */}
      <div className="w-full max-w-3xl flex items-center justify-between mb-3">
        <div className="text-rose-900 font-semibold">
          Wedding Arcade
          <div className="text-xs text-rose-600 font-normal">
            Collect all the jellybeans. Avoid chaos.
          </div>
        </div>
        <div className="text-rose-700 font-bold">
          Score: <span className="text-rose-500">{score}</span>
        </div>
      </div>

      {/* Board */}
      <div
        ref={boardRef}
        className="relative bg-white border border-rose-100 rounded-2xl shadow-xl overflow-hidden"
        style={{ width, height, touchAction: "manipulation" }}
      >
        {/* Tiles */}
        {map.map((row, y) =>
          row.map((v, x) => (
            <div
              key={`${x}-${y}`}
              className="absolute"
              style={{
                left: x * TILE,
                top: y * TILE,
                width: TILE,
                height: TILE,
              }}
            >
              {v === 1 && <div className="w-full h-full bg-rose-200" />}

              {v === 2 && (
                <div className="w-full h-full flex items-center justify-center">
                  <div
                    style={{
                      width: 10,
                      height: 14,
                      borderRadius: "50% 50% 45% 45%",
                      background: jellybeanGradient(x, y),
                      boxShadow: "0 1px 2px rgba(0,0,0,0.25)",
                    }}
                  />
                </div>
              )}
            </div>
          ))
        )}

        {/* Player */}
        <div
          className="absolute"
          style={{
            left: player.x * TILE,
            top: player.y * TILE,
            width: TILE,
            height: TILE,
          }}
        >
          <div className="w-full h-full flex items-center justify-center">
            <div className="w-4 h-4 rounded-full bg-indigo-600 shadow" />
          </div>
        </div>

        {/* Ghosts */}
        {ghosts.map((g, i) => (
          <div
            key={i}
            className="absolute"
            style={{
              left: g.x * TILE,
              top: g.y * TILE,
              width: TILE,
              height: TILE,
            }}
          >
            <div className="w-full h-full flex items-center justify-center">
              <div className="w-4 h-4 rounded bg-gray-700 shadow" />
            </div>
          </div>
        ))}

        {/* Instructions Overlay */}
        {ui === "instructions" && (
          <div className="absolute inset-0 bg-white/92 backdrop-blur-sm flex items-center justify-center p-6">
            <div className="max-w-md w-full text-center bg-white rounded-2xl border border-rose-100 shadow-xl p-6">
              <h2 className="text-2xl font-bold text-rose-900 mb-3">
                Capture all the jellybeans
              </h2>
              <p className="text-rose-700 mb-5 leading-relaxed">
                Capture all the jellybeans to find out what Jessica and Joshua had for dinner on their first date.
              </p>
              <div className="text-sm text-rose-600 mb-5">
                Controls: swipe on mobile or use arrow keys.
              </div>
              <button
                onClick={reset}
                className="w-full py-3 rounded-xl bg-rose-500 text-white font-bold hover:bg-rose-600 active:bg-rose-700"
              >
                Start
              </button>
            </div>
          </div>
        )}

        {/* Game Over Overlay */}
        {ui === "over" && (
          <div className="absolute inset-0 bg-white/92 backdrop-blur-sm flex items-center justify-center p-6">
            <div className="max-w-md w-full text-center bg-white rounded-2xl border border-rose-100 shadow-xl p-6">
              <h2 className="text-2xl font-bold text-gray-800 mb-2">Game Over</h2>
              <p className="text-gray-600 mb-5">
                You got caught by the chaos. Try again.
              </p>
              <button
                onClick={reset}
                className="w-full py-3 rounded-xl bg-rose-500 text-white font-bold hover:bg-rose-600 active:bg-rose-700"
              >
                Play Again
              </button>
            </div>
          </div>
        )}

        {/* Taco Reveal Overlay */}
        {ui === "reveal" && (
          <div className="absolute inset-0 bg-white flex items-center justify-center p-6">
            <div className="max-w-md w-full text-center bg-white rounded-2xl border border-rose-100 shadow-xl p-6">
              <div className="text-7xl mb-4">🌮</div>
              <h2 className="text-2xl font-bold text-rose-900 mb-3">
                Taco Reveal
              </h2>
              <p className="text-rose-700 mb-4 leading-relaxed">
                They had their first date at{" "}
                <span className="font-semibold">Fat Rosie’s</span> in Naperville and ate{" "}
                <span className="font-semibold">MEXICAN FOOD</span>.
              </p>

              <div className="text-sm text-rose-600 mb-5">
  {status === "win" ? (
    <>
      You captured them all. Win bonus: +250 • Final score:{" "}
      <span className="font-bold text-rose-700">{score + 250}</span>
    </>
  ) : (
    <>
      Nice try. Final score:{" "}
      <span className="font-bold text-rose-700">{score}</span>
    </>
  )}
</div>


              <button
                onClick={continueAfterReveal}
                className="w-full py-3 rounded-xl bg-rose-500 text-white font-bold hover:bg-rose-600 active:bg-rose-700"
              >
                Continue to Leaderboard
              </button>
            </div>
          </div>
        )}
      </div>

      <div className="mt-3 text-xs text-rose-600">
        Jellybeans left: {beansLeft} • Jessicas snapchat is jellybean lol.... love herrrrr
      </div>
    </div>
  );
}

