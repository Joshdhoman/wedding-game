import React, { useState, useEffect } from 'react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, onAuthStateChanged } from 'firebase/auth';
import { 
  getFirestore, collection, addDoc, onSnapshot, 
  serverTimestamp, doc, setDoc, getDoc, query, orderBy, limit 
} from 'firebase/firestore';
import { Heart, Trophy, Crown, ArrowRight, User, Star, Gem, Camera, Sparkles } from 'lucide-react';

// --- CONFIGURATION ---
const WHO_IS_LIKELY_QUESTIONS = [
  {
    question: "Who is more likely to cry during the ceremony?",
    options: ["Jessica", "Josh", "Both", "Neither"],
    answer: "Josh"
  },
  {
    question: "Who takes longer to get ready?",
    options: ["Jessica", "Josh"],
    answer: "Jessica"
  },
  {
    question: "Who said 'I love you' first?",
    options: ["Jessica", "Josh"],
    answer: "Josh"
  }
];

// --- FIREBASE SETUP ---
const firebaseConfig = {
  apiKey: "AIzaSyApmtZRpLEM68WZwnH_yRQ68eXESabXMSM",
  authDomain: "wedding-app-4ccf7.firebaseapp.com",
  projectId: "wedding-app-4ccf7",
  storageBucket: "wedding-app-4ccf7.firebasestorage.app",
  messagingSenderId: "800410129800",
  appId: "1:800410129800:web:180baa7eae03e4daab163d"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// --- SUB-COMPONENTS (Defined OUTSIDE to fix focus bug) ---

const IntroScreen = ({ playerName, setPlayerName, setGameState }) => (
  <div className="flex flex-col items-center justify-center min-h-screen p-6 text-center space-y-8 bg-gradient-to-br from-pink-50 to-rose-100 animate-in fade-in duration-700">
    <div className="relative">
      <Heart className="w-24 h-24 text-rose-500 animate-pulse" fill="currentColor" />
      <Sparkles className="absolute -top-4 -right-4 w-8 h-8 text-yellow-400 animate-bounce" />
    </div>
    
    <div className="space-y-2">
      <h1 className="text-4xl font-serif text-rose-900 tracking-wide">
        Jessica & Josh
      </h1>
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
        onClick={() => playerName.trim() && setGameState('menu')}
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
    className={`relative overflow-hidden p-6 rounded-2xl text-left transition-all hover:scale-[1.02] active:scale-95 shadow-sm hover:shadow-md bg-white border border-gray-100 group`}
  >
    <div className={`absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity`}>
      {React.cloneElement(icon, { size: 64 })}
    </div>
    <div className="flex items-start gap-4 relative z-10">
      <div className={`p-3 rounded-xl ${color}`}>
        {icon}
      </div>
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
        onClick={() => setGameState('leaderboard')}
        className="p-2 bg-white rounded-full shadow-sm text-rose-500 hover:text-rose-600"
      >
        <Trophy className="w-6 h-6" />
      </button>
    </header>

    <h2 className="text-2xl font-serif text-rose-900 mb-6 text-center">
      Choose a Challenge
    </h2>

    <div className="grid gap-4 w-full max-w-md">
      <GameCard 
        title="Who is most likely?" 
        icon={<Heart className="w-6 h-6 text-rose-500" />}
        desc="Guess the couple's habits"
        color="bg-rose-100"
        onClick={() => onStartGame(1)}
      />
      <GameCard 
        title="Wedding Trivia" 
        icon={<Gem className="w-6 h-6 text-purple-500" />}
        desc="How well do you know them?"
        color="bg-purple-100"
        onClick={() => onStartGame(2)}
      />
      <GameCard 
        title="Scavenger Hunt" 
        icon={<Camera className="w-6 h-6 text-emerald-500" />}
        desc="Find items at the venue"
        color="bg-emerald-100"
        onClick={() => onStartGame(3)}
      />
    </div>
  </div>
);

const TriviaGame = ({ onGameEnd }) => {
  const [currentQ, setCurrentQ] = useState(0);
  const [localScore, setLocalScore] = useState(0);
  const [answered, setAnswered] = useState(false);

  const handleAnswer = (option) => {
    if (answered) return;
    setAnswered(true);
    const correct = option === WHO_IS_LIKELY_QUESTIONS[currentQ].answer;
    
    if (correct) {
      setLocalScore(s => s + 100);
    }

    setTimeout(() => {
      if (currentQ < WHO_IS_LIKELY_QUESTIONS.length - 1) {
        setCurrentQ(q => q + 1);
        setAnswered(false);
      } else {
        onGameEnd(localScore + (correct ? 100 : 0));
      }
    }, 1500);
  };

  const q = WHO_IS_LIKELY_QUESTIONS[currentQ];

  return (
    <div className="min-h-screen bg-rose-50 p-6 flex flex-col justify-center">
      <div className="text-center mb-8">
        <span className="inline-block px-3 py-1 bg-rose-200 text-rose-800 rounded-full text-xs font-bold tracking-wider mb-2">
          QUESTION {currentQ + 1}/{WHO_IS_LIKELY_QUESTIONS.length}
        </span>
        <h3 className="text-2xl font-bold text-gray-800">{q.question}</h3>
      </div>

      <div className="space-y-3">
        {q.options.map((opt) => (
          <button
            key={opt}
            onClick={() => handleAnswer(opt)}
            disabled={answered}
            className={`w-full p-4 rounded-xl text-lg font-medium transition-all transform ${
              answered 
                ? opt === q.answer 
                  ? 'bg-green-500 text-white' 
                  : 'bg-gray-200 text-gray-400'
                : 'bg-white text-gray-700 shadow-sm hover:shadow-md hover:bg-rose-50 active:scale-95'
            }`}
          >
            {opt}
          </button>
        ))}
      </div>
      <div className="mt-8 text-center text-rose-400 font-bold text-xl">
        Score: {localScore}
      </div>
    </div>
  );
};

const LeaderboardScreen = ({ playerName, setGameState }) => {
  const [leaderboardData, setLeaderboardData] = useState([]);

  useEffect(() => {
    const q = query(collection(db, 'leaderboard'), orderBy('score', 'desc'), limit(10));
    const unsub = onSnapshot(q, (snapshot) => {
      setLeaderboardData(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
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
              idx === 0 ? 'bg-yellow-50' : ''
            } ${entry.name === playerName ? 'bg-rose-50' : ''}`}
          >
            <div className="flex items-center gap-4">
              <span className={`w-8 h-8 flex items-center justify-center rounded-full font-bold ${
                idx === 0 ? 'bg-yellow-400 text-white' : 
                idx === 1 ? 'bg-gray-300 text-white' :
                idx === 2 ? 'bg-amber-600 text-white' : 'text-gray-400'
              }`}>
                {idx + 1}
              </span>
              <span className="font-medium text-gray-800">
                {entry.name} {entry.name === playerName && '(You)'}
              </span>
            </div>
            <span className="font-bold text-rose-500">{entry.score} pts</span>
          </div>
        ))}
      </div>

      <button 
        onClick={() => setGameState('menu')}
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
  const [playerName, setPlayerName] = useState('');
  const [gameState, setGameState] = useState('loading');
  const [score, setScore] = useState(0);
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
      if (u) {
        setGameState(prev => prev === 'loading' ? 'intro' : prev);
      }
    });
    return () => unsubscribe();
  }, []);

  const handleStartGame = (level) => {
    setSelectedLevel(level);
    setScore(0);
    setGameState('playing');
  };

  const handleGameEnd = async (finalScore) => {
    setScore(finalScore);
    if (user && playerName) {
      try {
        await addDoc(collection(db, 'leaderboard'), {
          name: playerName,
          score: finalScore,
          level: selectedLevel,
          timestamp: serverTimestamp(),
          uid: user.uid
        });
      } catch (error) {
        console.error("Error saving score:", error);
      }
    }
    setGameState('leaderboard');
  };

  // --- RENDER CONTROLLER ---
  if (gameState === 'loading') return (
    <div className="min-h-screen flex items-center justify-center bg-rose-50">
      <Heart className="w-12 h-12 text-rose-400 animate-bounce" />
      <p className="ml-4 text-rose-800 font-medium">Loading Love...</p>
    </div>
  );

  if (gameState === 'intro') {
    return <IntroScreen playerName={playerName} setPlayerName={setPlayerName} setGameState={setGameState} />;
  }
  
  if (gameState === 'menu') {
    return <MenuScreen playerName={playerName} setGameState={setGameState} onStartGame={handleStartGame} />;
  }
  
  if (gameState === 'leaderboard') {
    return <LeaderboardScreen playerName={playerName} setGameState={setGameState} />;
  }
  
  if (selectedLevel === 1 && gameState === 'playing') {
    return <TriviaGame onGameEnd={handleGameEnd} />;
  }

  return <MenuScreen playerName={playerName} setGameState={setGameState} onStartGame={handleStartGame} />;
}