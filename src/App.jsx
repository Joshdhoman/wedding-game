import React, { useEffect, useState } from "react";
import { initializeApp } from "firebase/app";
import { getAuth, signInAnonymously, onAuthStateChanged } from "firebase/auth";
import {
  getFirestore,
  collection,
  addDoc,
  onSnapshot,
  serverTimestamp,
  query,
  orderBy,
  limit,
} from "firebase/firestore";
import { Heart, Trophy, Crown, ArrowRight, User, Sparkles } from "lucide-react";

import FruitSliceGame from "./games/FruitSlice/FruitSliceGame";
import WeddingArcadeGame from "./games/WeddingArcade/WeddingArcadeGame";

// --- FIREBASE SETUP ---
const firebaseConfig = {
  apiKey: "AIzaSyApmtZRpLEM68WZwnH_yRQ68eXESabXMSM",
  authDomain: "wedding-app-4ccf7.firebaseapp.com",
  projectId: "wedding-app-4ccf7",
  storageBucket: "wedding-app-4ccf7.firebasestorage.app",
  messagingSenderId: "800410129800",
  appId: "1:800410129800:web:180baa7eae03e4daab163d",
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// --- SUB-COMPONENTS ---

const IntroScreen = ({ playerName, setPlayerName, setGameState }) => (
  <div className="flex flex-col items-center justify-center min-h-screen p-6 text-center space-y-8 bg-gradient-to-br from-pink-50 to-rose-100 animate-in fade-in duration-700">
    <div className="relative">
      <Heart className="w-24 h-24 text-rose-500 animate-pulse" fill="currentColor" />
      <Sparkles className="absolute -top-4 -right-4 w-8 h-8 text-yellow-400 animate-bounce" />
    </div>

    <div className="space-y-2">
      <h1 className="text-4xl font-serif text-rose-900 tracking-wide">Jessica & Josh</h1>
      <p className="text-rose-600 font-light italic">The Wedding Game</p>
    </div>

    <div className="w-full max-w-xs space-y-4">
      <div className="bg-white/80 backdrop-blur-sm p-6 rounded-2xl shadow-xl border border-rose-100">
        <label className="block text-sm font-medium text-rose-700 mb-2">
          Enter Your Name to Join
        </label>
        <input
          type="text"
          value={playerName}
          onChange={(e) => setPlayerName(e.target.value)}
          className="w-full px-4 py-3 rounded-xl border border-rose-200 focus:ring-2 focus:ring-rose-400 focus:border-rose-400 outline-none text-center text-lg placeholder:text-rose-200"
          placeholder="e.g. Aunt Sarah"
          autoFocus
        />
      </div>

      <button
        onClick={() => playerName.trim() && setGameState("menu")}
        disabled={!playerName.trim()}
        className="w-full py-4 bg-rose-500 hover:bg-rose-600 active:bg-rose-700 text-white rounded-xl font-medium text-lg shadow-lg shadow-rose-200 disabled:opacity-50 disabled:cursor-not-allowed transition-all transform hover:-translate-y-1"
      >
        Enter Wedding <ArrowRight className="inline ml-2 w-5 h-5" />
      </button>
    </div>
  </div>
);

const GameCard = ({ title, icon, desc, color, onClick }) => (
  <button
    onClick={onClick}
    className="relative overflow-hidden p-6 rounded-2xl text-left transition-all hover:scale-[1.02] active:scale-95 shadow-sm hover:shadow-md bg-white border border-gray-100 group"
  >
    <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
      {React.cloneElement(icon, { size: 64 })}
    </div>
    <div className="flex items-start gap-4 relative z-10">
      <div className={`p-3 rounded-xl ${color}`}>{icon}</div>
      <div>
        <h3 className="font-bold text-gray-800 text-lg">{title}</h3>
        <p className="text-gray-500 text-sm">{desc}</p>
      </div>
    </div>
  </button>
);

const MenuScreen = ({ playerName, setGameState, onStartGame }) => (
  <div className="min-h-screen bg-rose-50 p-6 flex flex-col items-center">
    <header className="w-full flex justify-between items-center mb-8">
      <div className="flex items-center gap-2">
        <User className="w-5 h-5 text-rose-400" />
        <span className="font-medium text-rose-900">{playerName}</span>
      </div>

      <button
        onClick={() => setGameState("leaderboard")}
        className="p-2 bg-white rounded-full shadow-sm text-rose-500 hover:text-rose-600"
        aria-label="Open leaderboard"
      >
        <Trophy className="w-6 h-6" />
      </button>
    </header>

    <h2 className="text-2xl font-serif text-rose-900 mb-6 text-center">
      Choose a Challenge
    </h2>

    <div className="grid gap-4 w-full max-w-md">
      <GameCard
        title="Wedding Arcade"
        icon={<Sparkles className="w-6 h-6 text-indigo-600" />}
        desc="Pac-Man style: collect rings, avoid chaos"
        color="bg-indigo-100"
        onClick={() => onStartGame(5)}
      />

      <GameCard
        title="Honeymoon Slice"
        icon={<Sparkles className="w-6 h-6 text-orange-500" />}
        desc="Slice fruit to reveal the surprise"
        color="bg-orange-100"
        onClick={() => onStartGame(4)}
      />
    </div>
  </div>
);

const LeaderboardScreen = ({ playerName, setGameState }) => {
  const [leaderboardData, setLeaderboardData] = useState([]);

  useEffect(() => {
    const qRef = query(
      collection(db, "leaderboard"),
      orderBy("score", "desc"),
      limit(10)
    );

    const unsub = onSnapshot(qRef, (snapshot) => {
      setLeaderboardData(snapshot.docs.map((d) => ({ id: d.id, ...d.data() })));
    });

    return () => unsub();
  }, []);

  return (
    <div className="min-h-screen bg-rose-50 p-6">
      <div className="text-center mb-8">
        <Crown className="w-12 h-12 text-yellow-500 mx-auto mb-2" />
        <h2 className="text-3xl font-serif text-rose-900">Leaderboard</h2>
      </div>

      <div className="bg-white rounded-2xl shadow-xl overflow-hidden border border-rose-100">
        {leaderboardData.map((entry, idx) => (
          <div
            key={entry.id}
            className={`flex items-center justify-between p-4 border-b border-gray-50 ${
              idx === 0 ? "bg-yellow-50" : ""
            } ${entry.name === playerName ? "bg-rose-50" : ""}`}
          >
            <div className="flex items-center gap-4">
              <span
                className={`w-8 h-8 flex items-center justify-center rounded-full font-bold ${
                  idx === 0
                    ? "bg-yellow-400 text-white"
                    : idx === 1
                    ? "bg-gray-300 text-white"
                    : idx === 2
                    ? "bg-amber-600 text-white"
                    : "text-gray-400"
                }`}
              >
                {idx + 1}
              </span>
              <span className="font-medium text-gray-800">
                {entry.name} {entry.name === playerName && "(You)"}
              </span>
            </div>
            <span className="font-bold text-rose-500">{entry.score} pts</span>
          </div>
        ))}
      </div>

      <button
        onClick={() => setGameState("menu")}
        className="w-full mt-6 py-4 bg-white border-2 border-rose-500 text-rose-500 rounded-xl font-bold hover:bg-rose-50"
      >
        Back to Menu
      </button>
    </div>
  );
};

// --- MAIN COMPONENT ---
export default function WeddingGame() {
  const [user, setUser] = useState(null);
  const [playerName, setPlayerName] = useState("");
  const [gameState, setGameState] = useState("loading");
  const [selectedLevel, setSelectedLevel] = useState(null);

  // Auth Handling
  useEffect(() => {
    const initAuth = async () => {
      try {
        await signInAnonymously(auth);
      } catch (err) {
        console.error("Auth error:", err);
      }
    };

    initAuth();

    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setUser(u);
      if (u) setGameState((prev) => (prev === "loading" ? "intro" : prev));
    });

    return () => unsubscribe();
  }, []);

  const handleStartGame = (level) => {
    setSelectedLevel(level);
    setGameState("playing");
  };

  // Save score ONCE per round (used by all games)
  const handleSubmitScore = async (finalScore) => {
    if (!user || !playerName) return;

    try {
      await addDoc(collection(db, "leaderboard"), {
        name: playerName,
        score: finalScore,
        level: selectedLevel,
        timestamp: serverTimestamp(),
        uid: user.uid,
      });
    } catch (error) {
      console.error("Error saving score:", error);
    }
  };

  const handleGameEnd = () => {
    setGameState("leaderboard");
  };

  // --- RENDER CONTROLLER ---
  if (gameState === "loading") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-rose-50">
        <Heart className="w-12 h-12 text-rose-400 animate-bounce" />
        <p className="ml-4 text-rose-800 font-medium">Loading Love...</p>
      </div>
    );
  }

  if (gameState === "intro") {
    return (
      <IntroScreen
        playerName={playerName}
        setPlayerName={setPlayerName}
        setGameState={setGameState}
      />
    );
  }

  if (gameState === "menu") {
    return (
      <MenuScreen
        playerName={playerName}
        setGameState={setGameState}
        onStartGame={handleStartGame}
      />
    );
  }

  if (gameState === "leaderboard") {
    return <LeaderboardScreen playerName={playerName} setGameState={setGameState} />;
  }

  // Level 5: Wedding Arcade
  if (selectedLevel === 5 && gameState === "playing") {
    return (
      <WeddingArcadeGame
        onSubmitScore={handleSubmitScore}
        onGameEnd={handleGameEnd}
      />
    );
  }

  // Level 4: Fruit Slice
  if (selectedLevel === 4 && gameState === "playing") {
    return (
      <FruitSliceGame
        onSubmitScore={handleSubmitScore}
        onGameEnd={handleGameEnd}
      />
    );
  }

  // Fallback
  return (
    <MenuScreen
      playerName={playerName}
      setGameState={setGameState}
      onStartGame={handleStartGame}
    />
  );
}
