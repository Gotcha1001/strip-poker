"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { useSoundManager } from "@/hooks/useSoundManager";
import { motion, AnimatePresence } from "framer-motion";
import { Users, Play, Eye, EyeOff, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PokerCard } from "../components/PokerCard";
import { useBackground } from "../context/BackgroundContext";

// ─── Config ───────────────────────────────────────────────────────────────────
const STARTING_LIVES  = 5;
const CLOTHING_EMOJI  = ["👟", "👟", "🧦", "🧦", "👖", "👔", "👙"];

// ─── Types ────────────────────────────────────────────────────────────────────
type GameStatus = "setup" | "handoff" | "playing" | "handResult" | "gameOver";
type Phase      = "betting1" | "draw" | "betting2" | "showdown";

interface LocalPlayer {
  id: number;
  name: string;
  lives: number;
  holeCards: string[];
  folded: boolean;
  acted: boolean;   // has acted this betting round
  drawn: boolean;   // has completed draw phase
}

interface LocalGameState {
  players: LocalPlayer[];
  deck: string[];
  dealerIdx: number;
  currentIdx: number;
  phase: Phase;
  lastAction: string;
  handNumber: number;
  handResult: HandResult | null;
  anyoneBet: boolean;  // is there an open bet in the current round
}

interface HandResult {
  winnerIds: number[];
  loserIds: number[];
  winningHand: string;
  losingHand: string;
}

// ─── Lives badge ──────────────────────────────────────────────────────────────
function LivesBadge({ lives }: { lives: number }) {
  const pieces = CLOTHING_EMOJI.slice(0, STARTING_LIVES);
  return (
    <div className="flex gap-0.5">
      {pieces.map((p, i) => (
        <span key={i} style={{ opacity: i < lives ? 1 : 0.15, fontSize: "0.8rem" }}>{p}</span>
      ))}
    </div>
  );
}

// ─── Deck helpers ─────────────────────────────────────────────────────────────
const SUITS = ["S","H","D","C"];
const RANKS = ["2","3","4","5","6","7","8","9","T","J","Q","K","A"];

function createDeck(): string[] {
  const d: string[] = [];
  for (const s of SUITS) for (const r of RANKS) d.push(r + s);
  return shuffle(d);
}
function shuffle<T>(a: T[]): T[] {
  const arr = [...a];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}
function rankVal(r: string) { return RANKS.indexOf(r); }

// ─── Hand evaluation ──────────────────────────────────────────────────────────
function score5(cards: string[]): { value: number; name: string } {
  const rv     = cards.map(c => rankVal(c.slice(0, -1))).sort((a, b) => b - a);
  const suits  = cards.map(c => c.slice(-1));
  const flush  = suits.every(s => s === suits[0]);
  const uniq   = [...new Set(rv)].sort((a, b) => b - a);
  const str    = uniq.length === 5 && uniq[0] - uniq[4] === 4;
  const wheel  = JSON.stringify(uniq) === JSON.stringify([12,3,2,1,0]);
  const cnt: Record<number,number> = {};
  rv.forEach(r => { cnt[r] = (cnt[r]||0)+1; });
  const g = Object.entries(cnt).map(([r,c]) => ({r:+r,c})).sort((a,b)=>b.c-a.c||b.r-a.r);
  if (flush&&(str||wheel)){const t=wheel?3:uniq[0];return{value:(t===12&&!wheel?9:8)*1e6+(wheel?3:t),name:t===12&&!wheel?"Royal Flush":"Straight Flush"};}
  if(g[0].c===4)return{value:7e6+g[0].r*100+g[1].r,name:"Four of a Kind"};
  if(g[0].c===3&&g[1].c===2)return{value:6e6+g[0].r*100+g[1].r,name:"Full House"};
  if(flush)return{value:5e6+rv[0]*10000+rv[1]*1000+rv[2]*100+rv[3]*10+rv[4],name:"Flush"};
  if(str||wheel)return{value:4e6+(wheel?3:uniq[0]),name:"Straight"};
  if(g[0].c===3)return{value:3e6+g[0].r*10000+g[1].r*100+g[2].r,name:"Three of a Kind"};
  if(g[0].c===2&&g[1].c===2){const h=Math.max(g[0].r,g[1].r),l=Math.min(g[0].r,g[1].r);return{value:2e6+h*1000+l*10+g[2].r,name:"Two Pair"};}
  if(g[0].c===2)return{value:1e6+g[0].r*10000+g[1].r*1000+g[2].r*100+g[3].r,name:"Pair"};
  return{value:rv[0]*10000+rv[1]*1000+rv[2]*100+rv[3]*10+rv[4],name:"High Card"};
}

// ─── Game logic helpers ───────────────────────────────────────────────────────
function getNextActive(players: LocalPlayer[], current: number): number {
  const n = players.length;
  let next = (current + 1) % n;
  let t = 0;
  while (players[next].folded && t < n) { next = (next + 1) % n; t++; }
  return next;
}

function allActed(players: LocalPlayer[]): boolean {
  return players.filter(p => !p.folded).every(p => p.acted);
}

function allDrawn(players: LocalPlayer[]): boolean {
  return players.filter(p => !p.folded).every(p => p.drawn);
}

function firstActiveIdx(players: LocalPlayer[], dealerIdx: number): number {
  const n = players.length;
  let idx = (dealerIdx + 1) % n;
  let t = 0;
  while (players[idx].folded && t < n) { idx = (idx + 1) % n; t++; }
  return idx;
}

function resolveShowdown(gs: LocalGameState): LocalGameState {
  const active = gs.players.filter(p => !p.folded);
  const evals  = active.map(p => ({ p, res: score5(p.holeCards) }));
  const maxVal = Math.max(...evals.map(e => e.res.value));
  const minVal = Math.min(...evals.map(e => e.res.value));
  const winners = evals.filter(e => e.res.value === maxVal);
  const losers  = maxVal !== minVal ? evals.filter(e => e.res.value === minVal) : [];
  const loserIds  = losers.map(e => e.p.id);
  const winnerIds = winners.map(e => e.p.id);
  const updatedPlayers = gs.players.map(p =>
    loserIds.includes(p.id) ? { ...p, lives: Math.max(0, p.lives - 1) } : p
  );
  return {
    ...gs,
    players: updatedPlayers,
    phase: "showdown",
    handResult: {
      winnerIds,
      loserIds,
      winningHand: winners[0].res.name,
      losingHand: losers[0]?.res.name ?? "",
    },
  };
}

function buildDeal(allPlayers: LocalPlayer[], dealerIdx: number, handNum: number): LocalGameState {
  const active = allPlayers.filter(p => p.lives > 0);
  const deck   = createDeck();
  const players: LocalPlayer[] = active.map(p => ({
    ...p,
    holeCards: [deck.pop()!, deck.pop()!, deck.pop()!, deck.pop()!, deck.pop()!],
    folded: false,
    acted: false,
    drawn: false,
  }));
  return {
    players,
    deck,
    dealerIdx,
    currentIdx: (dealerIdx + 1) % players.length,
    phase: "betting1",
    lastAction: `Hand #${handNum} — 5 cards dealt! Check or bet. 🃏`,
    handNumber: handNum,
    handResult: null,
    anyoneBet: false,
  };
}

// ─── Setup Screen ─────────────────────────────────────────────────────────────
function SetupScreen({ onStart }: { onStart: (names: string[]) => void }) {
  const [count, setCount] = useState(2);
  const [names, setNames] = useState(["Player 1","Player 2","Player 3","Player 4"]);

  return (
    <main className="min-h-screen flex flex-col items-center justify-center px-6 text-center overflow-hidden bg-white dark:bg-emerald-950 py-12">
      <div className="hidden dark:block absolute inset-0 overflow-hidden pointer-events-none">
        <motion.div className="absolute top-[-250px] left-[-250px] w-[700px] h-[700px] rounded-full bg-emerald-900 opacity-40"
          animate={{scale:[1,1.3,1],x:[0,120,0],y:[0,-80,0]}} transition={{duration:25,repeat:Infinity,repeatType:"mirror"}} />
      </div>

      <motion.div initial={{opacity:0,y:30}} animate={{opacity:1,y:0}} className="relative z-10 mb-6">
        <div className="text-6xl mb-3">🎰</div>
        <h1 className="text-4xl md:text-5xl font-bold text-black dark:text-white tracking-tight">Strip Poker</h1>
        <p className="mt-2 text-gray-500 dark:text-emerald-300">Classic 5-Card Draw · 5 pieces each · worst hand strips</p>
      </motion.div>

      <motion.div initial={{opacity:0,y:20}} animate={{opacity:1,y:0}} transition={{delay:0.2}}
        className="w-full max-w-md p-6 rounded-2xl border border-emerald-200 dark:border-emerald-800 bg-white dark:bg-emerald-950/40 shadow-xl relative z-10">

        <div className="mb-5">
          <label className="block text-sm font-semibold text-gray-700 dark:text-emerald-200 mb-3">
            <Users className="inline h-4 w-4 mr-1" /> Number of Players
          </label>
          <div className="flex gap-2">
            {[2,3,4].map(n => (
              <button key={n} onClick={() => setCount(n)}
                className={`flex-1 py-3 rounded-xl font-bold text-lg transition-all ${count===n?"bg-emerald-600 text-white shadow-lg":"bg-gray-100 dark:bg-emerald-900/30 text-gray-600 dark:text-emerald-300 hover:bg-emerald-100"}`}>
                {n}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-2 mb-5">
          <label className="block text-sm font-semibold text-gray-700 dark:text-emerald-200 mb-1">Player Names</label>
          {Array.from({length:count}).map((_,i) => (
            <motion.div key={i} initial={{opacity:0,x:-10}} animate={{opacity:1,x:0}} transition={{delay:i*0.06}}>
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-emerald-600 flex items-center justify-center text-white font-bold text-sm flex-shrink-0">{i+1}</div>
                <input type="text" value={names[i]} onChange={e=>{const n=[...names];n[i]=e.target.value;setNames(n);}}
                  placeholder={`Player ${i+1}`}
                  className="flex-1 px-4 py-2.5 rounded-xl text-sm outline-none bg-gray-50 dark:bg-emerald-900/30 border border-gray-200 dark:border-emerald-700 text-black dark:text-white placeholder:text-gray-400" />
              </div>
            </motion.div>
          ))}
        </div>

        <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 mb-5 text-left">
          <p className="text-xs text-amber-700 dark:text-amber-300 font-semibold">
            🎮 Classic 5-Card Draw: Bet → Discard up to 3 → Bet again → Showdown. Worst hand loses 1 clothing piece. Last clothed player wins!
          </p>
        </div>

        <Button className="w-full py-6 text-lg bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg" onClick={()=>onStart(names.slice(0,count))}>
          <Play className="h-5 w-5 mr-2" /> Deal Cards
        </Button>
      </motion.div>
    </main>
  );
}

// ─── Handoff Screen ───────────────────────────────────────────────────────────
function HandoffScreen({ player, phase, onReveal }: { player: LocalPlayer; phase: Phase; onReveal: () => void }) {
  const phaseMsg = phase === "draw" ? "It's time to draw your cards!" : "It's time to see your hand!";
  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-6 text-center"
      style={{background:"radial-gradient(ellipse at 50% 40%, #1a0a3e 0%, #0d0621 50%, #050312 100%)"}}>
      <motion.div initial={{opacity:0,scale:0.9}} animate={{opacity:1,scale:1}} className="max-w-sm w-full">
        <motion.div className="w-24 h-24 rounded-3xl bg-emerald-700 flex items-center justify-center mx-auto mb-4 shadow-2xl"
          animate={{scale:[1,1.05,1]}} transition={{duration:2,repeat:Infinity}}>
          <EyeOff className="h-10 w-10 text-white" />
        </motion.div>
        <h2 className="text-3xl font-black text-white mb-2">Hand Off!</h2>
        <p className="text-emerald-300 mb-1">Pass the device to</p>
        <p className="text-3xl font-black text-white mt-1 px-4 break-words">{player.name}</p>
        <p className="text-emerald-400 text-sm mt-1">{phaseMsg}</p>
        <div className="flex items-center justify-center gap-2 mt-3 mb-2">
          <span className="text-sm text-emerald-300">Clothing:</span>
          <LivesBadge lives={player.lives} />
        </div>
        <div className="flex justify-center gap-1 my-6">
          {[0,1,2,3,4].map(i => (
            <div key={i} style={{transform:`rotate(${(i-2)*4}deg)`,marginLeft:i>0?"-8px":0}}>
              <PokerCard faceDown size="md" index={i} />
            </div>
          ))}
        </div>
        <p className="text-emerald-400 text-sm mb-6">Make sure nobody else is watching before you reveal!</p>
        <Button className="w-full py-5 text-lg bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg" onClick={onReveal}>
          <Eye className="h-5 w-5 mr-2" /> Reveal My Cards
        </Button>
      </motion.div>
    </div>
  );
}

// ─── Game Screen ──────────────────────────────────────────────────────────────
function GameScreen({
  gs,
  player,
  onBet,
  onDraw,
}: {
  gs: LocalGameState;
  player: LocalPlayer;
  onBet: (action: "check" | "bet" | "call" | "fold") => void;
  onDraw: (indices: number[]) => void;
}) {
  const [selectedDiscard, setSelectedDiscard] = useState<Set<number>>(new Set());
  const opponents = gs.players.filter(p => p.id !== player.id);
  const { selected: bg } = useBackground();

  const PHASE_LABELS: Record<Phase,string> = {
    betting1: "First Bet",
    draw: "Draw Cards",
    betting2: "Final Bet",
    showdown: "Showdown",
  };

  const toggleDiscard = (i: number) => {
    if (gs.phase !== "draw") return;
    setSelectedDiscard(prev => {
      const next = new Set(prev);
      if (next.has(i)) { next.delete(i); }
      else if (next.size < 3) { next.add(i); }
      return next;
    });
  };

  const handleDraw = () => {
    onDraw(Array.from(selectedDiscard));
    setSelectedDiscard(new Set());
  };

  return (
    <div
      className="min-h-screen flex flex-col overflow-hidden relative"
      style={!bg.src ? { background: "radial-gradient(ellipse at 50% 40%, #1a4a2e 0%, #0f2d1c 45%, #091a10 100%)" } : undefined}
    >
      {/* Background image */}
      {bg.src && (
        <div
          className="fixed inset-0"
          style={{ backgroundImage: `url(${bg.src})`, backgroundSize: "cover", backgroundPosition: "center", zIndex: 0 }}
        />
      )}
      {/* Overlay tint */}
      {bg.overlay && (
        <div className="absolute inset-0" style={{ background: bg.overlay, zIndex: 0 }} />
      )}
      {/* Felt noise texture */}
      <div className="absolute inset-0 pointer-events-none opacity-40"
        style={{backgroundImage:`url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.75' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.04'/%3E%3C/svg%3E")`,backgroundSize:"200px 200px",zIndex:0}} />

      <header className="relative z-10 flex items-center justify-between px-4 py-3 border-b border-white/10 bg-black/20 backdrop-blur-sm gap-2">
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl border border-white/20 bg-black/30 text-amber-400 font-bold text-sm">🎰 Strip Poker</div>
        <div className="px-3 py-1 rounded-full text-xs font-bold border border-white/15 text-white/70"
          style={{background:gs.phase==="betting1"?"rgba(124,58,237,0.25)":gs.phase==="draw"?"rgba(16,185,129,0.2)":gs.phase==="betting2"?"rgba(245,158,11,0.2)":"rgba(239,68,68,0.2)"}}>
          {PHASE_LABELS[gs.phase]}
        </div>
        <span className="text-[10px] text-white/40 uppercase tracking-widest">Hand #{gs.handNumber}</span>
      </header>

      <div className="flex-1 flex flex-col relative z-10 overflow-hidden">
        {/* Opponents */}
        <div className="flex justify-center gap-4 pt-4 pb-2 px-4 flex-wrap">
          {opponents.map(opp => (
            <motion.div key={opp.id} className="flex flex-col items-center gap-1.5">
              <div className="px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 border backdrop-blur-sm text-white"
                style={{background:"rgba(0,0,0,0.3)",borderColor:"rgba(255,255,255,0.15)"}}>
                {opp.name}
                {opp.folded && <span className="text-[9px] text-gray-400">FOLD</span>}
                {gs.phase==="draw" && opp.drawn && !opp.folded && <span className="text-[9px] text-emerald-400">DRAWN</span>}
              </div>
              <LivesBadge lives={opp.lives} />
              <div className="flex items-end gap-0.5" style={{height:"3.6rem"}}>
                {[0,1,2,3,4].map(i=>(
                  <div key={i} style={{transform:`rotate(${(i-2)*3}deg)`,marginLeft:i>0?"-8px":0}}>
                    <PokerCard faceDown size="sm" index={i} />
                  </div>
                ))}
              </div>
            </motion.div>
          ))}
        </div>

        {/* Last action */}
        <AnimatePresence mode="wait">
          <motion.div key={gs.lastAction} initial={{opacity:0,y:-6}} animate={{opacity:1,y:0}} exit={{opacity:0,y:6}}
            className="text-xs text-center px-4 py-2 mx-4 mt-3 rounded-xl border border-white/10 bg-black/25 backdrop-blur-sm text-white/55 truncate">
            {gs.lastAction}
          </motion.div>
        </AnimatePresence>

        <div className="flex-1" />

        {/* My hand panel */}
        <div className="relative border-t border-white/10 bg-black/40 backdrop-blur-md px-4 pt-3 pb-4"
          style={{boxShadow:"0 -8px 32px rgba(0,0,0,0.5)"}}>

          <motion.div className="flex items-center gap-2 px-4 py-2 rounded-2xl border text-sm font-bold mb-2 justify-center"
            style={{background:"rgba(16,185,129,0.2)",borderColor:"#34d399",color:"#a7f3d0",boxShadow:"0 0 20px rgba(16,185,129,0.3)"}}>
            <motion.span animate={{rotate:[0,-10,10,0]}} transition={{duration:0.5,repeat:Infinity,repeatDelay:2}}>🎯</motion.span>
            {player.name}&apos;s turn!
          </motion.div>

          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] font-bold uppercase tracking-[0.15em] text-white/35">{player.name}&apos;s Hand</span>
            <LivesBadge lives={player.lives} />
          </div>

          {/* 5 cards — tappable in draw phase */}
          <div className="flex justify-center gap-1.5 mb-2">
            {player.holeCards.map((c, i) => {
              const isSelected = selectedDiscard.has(i);
              const inDraw = gs.phase === "draw";
              return (
                <motion.div key={i}
                  onClick={() => inDraw && toggleDiscard(i)}
                  animate={{ y: isSelected ? -12 : 0 }}
                  transition={{ type: "spring", stiffness: 400, damping: 20 }}
                  className={`relative ${inDraw ? "cursor-pointer" : ""}`}>
                  <PokerCard card={c} size="lg" index={i} />
                  {isSelected && (
                    <div className="absolute -top-2 left-1/2 -translate-x-1/2 text-[8px] font-black text-red-400 bg-black/80 px-1 py-0.5 rounded-full border border-red-500/50 whitespace-nowrap">
                      DISCARD
                    </div>
                  )}
                </motion.div>
              );
            })}
          </div>

          {gs.phase === "draw" && (
            <p className="text-[9px] text-white/35 text-center mb-2">
              Tap to discard (max 3) · tap again to deselect
            </p>
          )}

          {/* Betting actions */}
          {(gs.phase === "betting1" || gs.phase === "betting2") && !player.folded && (
            <div className="flex gap-2">
              <motion.button whileTap={{scale:0.95}} onClick={() => onBet("fold")}
                className="flex-1 py-3 rounded-xl bg-red-900/60 border border-red-500/40 text-red-200 text-sm font-semibold hover:bg-red-900/80 transition-all">
                😬 Fold
              </motion.button>
              {gs.anyoneBet ? (
                <motion.button whileTap={{scale:0.95}} onClick={() => onBet("call")}
                  className="flex-1 py-3 rounded-xl bg-emerald-900/60 border border-emerald-500/40 text-emerald-200 text-sm font-semibold hover:bg-emerald-900/80 transition-all">
                  ✅ Call
                </motion.button>
              ) : (
                <>
                  <motion.button whileTap={{scale:0.95}} onClick={() => onBet("check")}
                    className="flex-1 py-3 rounded-xl bg-white/10 border border-white/25 text-white text-sm font-semibold hover:bg-white/20 transition-all">
                    ✋ Check
                  </motion.button>
                  <motion.button whileTap={{scale:0.95}} onClick={() => onBet("bet")}
                    className="flex-1 py-3 rounded-xl bg-purple-900/60 border border-purple-500/40 text-purple-200 text-sm font-semibold hover:bg-purple-900/80 transition-all">
                    💰 Bet
                  </motion.button>
                </>
              )}
            </div>
          )}

          {/* Draw action */}
          {gs.phase === "draw" && !player.folded && (
            <motion.button whileTap={{scale:0.95}} onClick={handleDraw}
              className="w-full py-3 rounded-xl bg-emerald-900/60 border border-emerald-500/40 text-emerald-200 font-semibold hover:bg-emerald-900/80 transition-all text-sm">
              {selectedDiscard.size === 0
                ? "🃏 Stand Pat — keep all cards"
                : `🔄 Draw ${selectedDiscard.size} new card${selectedDiscard.size > 1 ? "s" : ""}`}
            </motion.button>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Hand Result Screen ───────────────────────────────────────────────────────
function HandResultScreen({ gs, onContinue }: { gs: LocalGameState; onContinue: () => void }) {
  const result   = gs.handResult!;
  const losers   = gs.players.filter(p => result.loserIds.includes(p.id));
  const winners  = gs.players.filter(p => result.winnerIds.includes(p.id));
  const isTie    = result.loserIds.length === 0 && result.winnerIds.length > 1;
  const isFold   = result.loserIds.length === 0 && result.winnerIds.length === 1;

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-indigo-950 px-4 py-8">
      <motion.div initial={{opacity:0,scale:0.85}} animate={{opacity:1,scale:1}} transition={{type:"spring",stiffness:200}}
        className="w-full max-w-md text-center">
        <motion.div className="text-6xl mb-4" animate={{rotate:[0,-10,10,-10,0]}} transition={{duration:0.6,delay:0.3}}>
          {isTie?"🤝":isFold?"🏆":losers.length>0?"💀":"🏆"}
        </motion.div>
        <h1 className="text-3xl font-black text-white mb-1">
          {isTie ? "It's a Tie!"
            : isFold ? `${winners[0]?.name} wins — no strip!`
            : losers.length > 0 ? `${losers.map(l=>l.name).join(" & ")} lose${losers.length===1?"s":""} a piece!`
            : `${winners[0]?.name} Wins!`}
        </h1>

        {!isTie && !isFold && (
          <div className="flex justify-center gap-3 mb-2 flex-wrap">
            {result.winningHand && <span className="text-xs px-2 py-0.5 rounded-full bg-amber-900/40 text-amber-300 border border-amber-600/30">🏆 {result.winningHand}</span>}
            {result.losingHand  && <span className="text-xs px-2 py-0.5 rounded-full bg-red-900/40  text-red-300  border border-red-600/30">💀 {result.losingHand}</span>}
          </div>
        )}

        <p className="text-white/40 text-xs mb-5">Hand #{gs.handNumber}</p>

        {/* Cards */}
        <div className="flex flex-wrap justify-center gap-3 mb-5">
          {gs.players.filter(p => !p.folded).map(p => (
            <div key={p.id} className="flex flex-col items-center gap-2">
              <div className="px-2 py-0.5 rounded text-[10px] font-semibold"
                style={{
                  background:result.loserIds.includes(p.id)?"rgba(239,68,68,0.2)":result.winnerIds.includes(p.id)?"rgba(245,158,11,0.25)":"rgba(0,0,0,0.3)",
                  color:result.loserIds.includes(p.id)?"#fca5a5":result.winnerIds.includes(p.id)?"#fcd34d":"rgba(255,255,255,0.5)",
                  border:`1px solid ${result.loserIds.includes(p.id)?"rgba(239,68,68,0.4)":result.winnerIds.includes(p.id)?"rgba(245,158,11,0.4)":"rgba(255,255,255,0.1)"}`,
                }}>
                {result.loserIds.includes(p.id)?"💀 ":result.winnerIds.includes(p.id)?"🏆 ":""}{p.name}
              </div>
              <div className="flex gap-0.5">
                {p.holeCards.map((c,i)=><PokerCard key={i} card={c} size="sm" index={i} />)}
              </div>
            </div>
          ))}
        </div>

        {/* Standings */}
        <div className="p-4 rounded-2xl border border-emerald-800 bg-emerald-950/40 mb-5 text-left">
          <div className="text-xs font-semibold uppercase tracking-wider text-emerald-300 mb-2">👕 Clothing Standings</div>
          <div className="space-y-2">
            {[...gs.players].sort((a,b)=>b.lives-a.lives).map(p=>(
              <div key={p.id} className="flex justify-between items-center text-sm">
                <span className={result.loserIds.includes(p.id)?"text-red-300 font-semibold":result.winnerIds.includes(p.id)?"text-amber-300 font-semibold":"text-white/70"}>
                  {result.loserIds.includes(p.id)?"💀 ":result.winnerIds.includes(p.id)?"🏆 ":""}{p.name}
                  {p.lives<=0&&<span className="ml-2 text-[10px] text-red-400">ELIMINATED</span>}
                </span>
                <LivesBadge lives={p.lives} />
              </div>
            ))}
          </div>
        </div>

        <Button className="bg-emerald-600 hover:bg-emerald-500 text-white px-10 py-5 text-base" onClick={onContinue}>
          <RotateCcw size={15} className="mr-2" /> Next Hand
        </Button>
      </motion.div>
    </div>
  );
}

// ─── Game Over Screen ─────────────────────────────────────────────────────────
function GameOverScreen({ winner, all, onRestart }: { winner: LocalPlayer; all: LocalPlayer[]; onRestart: () => void }) {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-indigo-950 px-4 text-center">
      <motion.div initial={{opacity:0,scale:0.85}} animate={{opacity:1,scale:1}} transition={{type:"spring",stiffness:200}}>
        <div className="text-7xl mb-4">🎰</div>
        <h1 className="text-3xl md:text-4xl font-black text-white mb-2">{winner.name} Wins the Game!</h1>
        <p className="text-emerald-300 mb-6">All other players are fully... undressed 😂</p>
        <div className="p-4 rounded-2xl border border-emerald-800 bg-emerald-950/40 mb-6 text-left max-w-xs mx-auto">
          {[...all].sort((a,b)=>b.lives-a.lives).map(p=>(
            <div key={p.id} className="flex justify-between items-center text-sm py-1 border-b border-white/5 last:border-0">
              <span className={p.id===winner.id?"text-amber-300 font-semibold":"text-white/60"}>{p.id===winner.id?"🏆 ":""}{p.name}</span>
              <LivesBadge lives={p.lives} />
            </div>
          ))}
        </div>
        <Button className="bg-emerald-600 hover:bg-emerald-500 text-white px-10 py-5 text-base" onClick={onRestart}>New Game</Button>
      </motion.div>
    </div>
  );
}

// ─── Helpers for building ordered queue from a game state ────────────────────
// Returns player ids in turn order starting from dealer+1, active only.
function buildQueue(gs: LocalGameState): number[] {
  const n = gs.players.length;
  const start = (gs.dealerIdx + 1) % n;
  const ordered = [
    ...gs.players.slice(start),
    ...gs.players.slice(0, start),
  ];
  return ordered.filter(p => !p.folded).map(p => p.id);
}

// ─── Main page ────────────────────────────────────────────────────────────────
export default function LocalPlayPage() {
  const [status, setStatus]           = useState<GameStatus>("setup");
  const [gs, setGs]                   = useState<LocalGameState | null>(null);
  const [handoffQueue, setHandoffQueue] = useState<number[]>([]);
  const [currentPlayerId, setCurrentPlayerId] = useState<number | null>(null);

  const { play } = useSoundManager();
  const prevPhase = useRef<Phase | null>(null);

  // ── Sound effects on phase/result changes ─────────────────────────────────
  useEffect(() => {
    if (!gs) return;
    if (gs.phase !== prevPhase.current) {
      prevPhase.current = gs.phase;
      if (gs.phase === "draw")     play("cardDeal");
      if (gs.phase === "betting2") play("cardFlip");
      if (gs.phase === "showdown" && gs.handResult) {
        const isLoser  = gs.handResult.loserIds.includes(currentPlayerId  ?? -1);
        const isWinner = gs.handResult.winnerIds.includes(currentPlayerId ?? -1);
        if (isLoser)       play("lose");
        else if (isWinner) play("win");
        else               play("showdown");
      }
    }
  }, [gs?.phase, gs?.handResult, play, currentPlayerId]);

  // ── Apply a fully-computed new game state and decide what screen to show ───
  // This is the single place that drives all transitions — no racing setTimeouts.
  const applyState = useCallback((
    newGs: LocalGameState,
    remainingQueue: number[],   // players still to act this phase (excluding actor just done)
  ) => {
    setGs(newGs);

    // Hand is over → show result screen
    if (newGs.handResult) {
      setStatus("handResult");
      return;
    }

    // Still players left in this phase's queue → hand off to next
    if (remainingQueue.length > 0) {
      setHandoffQueue(remainingQueue);
      setCurrentPlayerId(remainingQueue[0]);
      setStatus("handoff");
      return;
    }

    // Queue exhausted but no result yet → phase just changed, build new queue
    const newQueue = buildQueue(newGs);
    setHandoffQueue(newQueue);
    setCurrentPlayerId(newQueue[0] ?? null);
    setStatus("handoff");
  }, []);

  // ── Init ───────────────────────────────────────────────────────────────────
  const initGame = useCallback((names: string[]) => {
    const players: LocalPlayer[] = names.map((name, id) => ({
      id, name, lives: STARTING_LIVES, holeCards: [], folded: false, acted: false, drawn: false,
    }));
    const state = buildDeal(players, 0, 1);
    const queue = buildQueue(state);
    prevPhase.current = null;
    play("gameStart");
    setGs(state);
    setHandoffQueue(queue);
    setCurrentPlayerId(queue[0]);
    setStatus("handoff");
  }, [play]);

  // ── Betting action ─────────────────────────────────────────────────────────
  const handleBet = useCallback((action: "check" | "bet" | "call" | "fold") => {
    if (!gs || currentPlayerId === null) return;
    play(action === "fold" ? "fold" : "buttonClick");

    // 1. Compute next game state synchronously
    const players   = gs.players.map(p => ({ ...p }));
    const actor     = players.find(p => p.id === currentPlayerId)!;
    let lastAction  = gs.lastAction;
    let anyoneBet   = gs.anyoneBet;

    if (action === "fold")  { actor.folded = true;  lastAction = `😬 ${actor.name} folds`; }
    if (action === "check") { actor.acted  = true;  lastAction = `✋ ${actor.name} checks`; }
    if (action === "bet")   { actor.acted  = true;  anyoneBet  = true; lastAction = `💰 ${actor.name} bets`; }
    if (action === "call")  { actor.acted  = true;  lastAction = `✅ ${actor.name} calls`; }

    // 2. Check sole survivor
    const notFolded = players.filter(p => !p.folded);
    if (notFolded.length === 1) {
      const winner  = notFolded[0];
      const newGs: LocalGameState = {
        ...gs, players, phase: "showdown", anyoneBet,
        lastAction: `🏆 ${winner.name} wins — everyone else folded!`,
        handResult: { winnerIds: [winner.id], loserIds: [], winningHand: "Everyone folded", losingHand: "" },
      };
      applyState(newGs, []);
      return;
    }

    // 3. Compute remaining queue for this phase (everyone after current actor)
    const currentQueueIdx = handoffQueue.indexOf(currentPlayerId);
    const remainingQueue  = handoffQueue.slice(currentQueueIdx + 1);

    // 4. All active players acted? Advance phase.
    if (allActed(players)) {
      const freshPlayers = players.map(p => ({ ...p, acted: false, drawn: false }));
      const nextPhase: Phase = gs.phase === "betting1" ? "draw" : "showdown";

      if (nextPhase === "showdown") {
        const newGs: LocalGameState = { ...gs, players: freshPlayers, anyoneBet, lastAction, phase: "showdown" };
        applyState(resolveShowdown(newGs), []);
        return;
      }

      // → Draw phase
      const newGs: LocalGameState = {
        ...gs,
        players: freshPlayers,
        phase: "draw",
        currentIdx: firstActiveIdx(freshPlayers, gs.dealerIdx),
        lastAction: `${lastAction} — Draw phase: discard up to 3 cards`,
        anyoneBet: false,
      };
      applyState(newGs, []); // empty queue → applyState will buildQueue for draw phase
      return;
    }

    // 5. Still more players to act this round
    const newGs: LocalGameState = { ...gs, players, lastAction, anyoneBet };
    applyState(newGs, remainingQueue);
  }, [gs, currentPlayerId, handoffQueue, applyState, play]);

  // ── Draw action ────────────────────────────────────────────────────────────
  const handleDraw = useCallback((discardIndices: number[]) => {
    if (!gs || currentPlayerId === null) return;
    play(discardIndices.length === 0 ? "cardFlip" : "cardPlay");

    // 1. Apply discard & draw
    const players = gs.players.map(p => ({ ...p }));
    const actor   = players.find(p => p.id === currentPlayerId)!;
    const deck    = [...gs.deck];
    const hand    = [...actor.holeCards];
    discardIndices.forEach(idx => { hand[idx] = deck.pop()!; });
    actor.holeCards = hand;
    actor.drawn     = true;

    const msg = discardIndices.length === 0
      ? `🃏 ${actor.name} stands pat`
      : `🔄 ${actor.name} draws ${discardIndices.length}`;

    // 2. Remaining queue for draw phase
    const currentQueueIdx = handoffQueue.indexOf(currentPlayerId);
    const remainingQueue  = handoffQueue.slice(currentQueueIdx + 1);

    // 3. All drawn? Move to betting2.
    if (allDrawn(players)) {
      const freshPlayers = players.map(p => ({ ...p, acted: false }));
      const newGs: LocalGameState = {
        ...gs,
        players: freshPlayers,
        deck,
        phase: "betting2",
        currentIdx: firstActiveIdx(freshPlayers, gs.dealerIdx),
        lastAction: `${msg} — Second betting round!`,
        anyoneBet: false,
      };
      applyState(newGs, []); // empty → applyState will buildQueue for betting2
      return;
    }

    // 4. More players still need to draw
    const newGs: LocalGameState = { ...gs, players, deck, lastAction: msg };
    applyState(newGs, remainingQueue);
  }, [gs, currentPlayerId, handoffQueue, applyState, play]);

  // ── Next hand ──────────────────────────────────────────────────────────────
  const handleNextHand = useCallback(() => {
    if (!gs) return;
    const survivors = gs.players.filter(p => p.lives > 0);
    if (survivors.length < 2) { setStatus("gameOver"); return; }
    const newDealerIdx = (gs.dealerIdx + 1) % survivors.length;
    const newGs        = buildDeal(survivors, newDealerIdx, gs.handNumber + 1);
    const queue        = buildQueue(newGs);
    prevPhase.current  = null;
    play("cardDeal");
    setGs(newGs);
    setHandoffQueue(queue);
    setCurrentPlayerId(queue[0]);
    setStatus("handoff");
  }, [gs, play]);

  // ── Render ─────────────────────────────────────────────────────────────────
  if (status === "setup") return <SetupScreen onStart={initGame} />;
  if (!gs) return null;

  const winner = gs.players.reduce((a, b) => a.lives > b.lives ? a : b);
  if (status === "gameOver") {
    return <GameOverScreen winner={winner} all={gs.players} onRestart={() => { setGs(null); setStatus("setup"); }} />;
  }
  if (status === "handResult") {
    return <HandResultScreen gs={gs} onContinue={handleNextHand} />;
  }

  const currentPlayer = gs.players.find(p => p.id === currentPlayerId);
  if (!currentPlayer) return null;

  if (status === "handoff") {
    return (
      <HandoffScreen
        player={currentPlayer}
        phase={gs.phase}
        onReveal={() => {
          play("yourTurn");
          setStatus("playing");
        }}
      />
    );
  }

  return (
    <GameScreen
      gs={gs}
      player={currentPlayer}
      onBet={handleBet}
      onDraw={handleDraw}
    />
  );
}