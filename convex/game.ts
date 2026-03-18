/* eslint-disable @typescript-eslint/no-explicit-any */
import { v } from "convex/values";
import { mutation, query, internalMutation } from "./_generated/server";
import { internal } from "./_generated/api";
import { Id } from "./_generated/dataModel";
import type { MutationCtx, QueryCtx } from "./_generated/server";

// ─────────────────────────────────────────────────────────────────────────────
// 🎰  CLASSIC 5-CARD DRAW STRIP POKER ENGINE
//
// Phase flow:
//   deal cards
//     → betting1  (check / bet / call / fold — each player acts once)
//     → draw      (each player discards 0-3 cards, draws replacements)
//     → betting2  (same as betting1)
//     → showdown  (worst hand loses 1 clothing piece)
//
// Bot AI:
//   betting:  bet/call on strong hands, fold weak ones
//   draw:     keep pairs+, discard everything else
// ─────────────────────────────────────────────────────────────────────────────

// ─── Card helpers ─────────────────────────────────────────────────────────────

const SUITS = ["S", "H", "D", "C"] as const;
const RANKS = ["2","3","4","5","6","7","8","9","T","J","Q","K","A"] as const;
type Suit = (typeof SUITS)[number];
type Rank = (typeof RANKS)[number];

function rankValue(rank: string): number { return RANKS.indexOf(rank as Rank); }
function parseCard(card: string) {
  return { rank: card.slice(0, -1) as Rank, suit: card.slice(-1) as Suit };
}
function createDeck(): string[] {
  const deck: string[] = [];
  for (const s of SUITS) for (const r of RANKS) deck.push(r + s);
  return shuffle(deck);
}
function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// ─── Hand evaluation ──────────────────────────────────────────────────────────

export type HandRank =
  | "Royal Flush" | "Straight Flush" | "Four of a Kind" | "Full House"
  | "Flush" | "Straight" | "Three of a Kind" | "Two Pair" | "Pair" | "High Card";

export interface HandResult {
  rank: HandRank;
  value: number;
  description: string;
}

function score5(cards: string[]): HandResult {
  const parsed   = cards.map(parseCard);
  const rankVals = parsed.map(c => rankValue(c.rank)).sort((a, b) => b - a);
  const suits    = parsed.map(c => c.suit);
  const flush    = suits.every(s => s === suits[0]);
  const unique   = [...new Set(rankVals)].sort((a, b) => b - a);
  const isStraight      = unique.length === 5 && unique[0] - unique[4] === 4;
  const isWheelStraight = JSON.stringify(unique) === JSON.stringify([12,3,2,1,0]);
  const counts: Record<number,number> = {};
  rankVals.forEach(r => { counts[r] = (counts[r] || 0) + 1; });
  const groups = Object.entries(counts)
    .map(([r, c]) => ({ r: +r, c: c as number }))
    .sort((a, b) => b.c - a.c || b.r - a.r);

  let value = 0;
  let rank: HandRank = "High Card";

  if (flush && (isStraight || isWheelStraight)) {
    const top = isWheelStraight ? 3 : unique[0];
    value = top === 12 && !isWheelStraight ? 9_000_000 : 8_000_000 + top;
    rank  = top === 12 && !isWheelStraight ? "Royal Flush" : "Straight Flush";
  } else if (groups[0].c === 4) {
    value = 7_000_000 + groups[0].r * 100 + groups[1].r; rank = "Four of a Kind";
  } else if (groups[0].c === 3 && groups[1].c === 2) {
    value = 6_000_000 + groups[0].r * 100 + groups[1].r; rank = "Full House";
  } else if (flush) {
    value = 5_000_000 + rankVals[0]*10000 + rankVals[1]*1000 + rankVals[2]*100 + rankVals[3]*10 + rankVals[4];
    rank  = "Flush";
  } else if (isStraight || isWheelStraight) {
    value = 4_000_000 + (isWheelStraight ? 3 : unique[0]); rank = "Straight";
  } else if (groups[0].c === 3) {
    value = 3_000_000 + groups[0].r*10000 + groups[1].r*100 + groups[2].r; rank = "Three of a Kind";
  } else if (groups[0].c === 2 && groups[1].c === 2) {
    const h = Math.max(groups[0].r, groups[1].r), l = Math.min(groups[0].r, groups[1].r);
    value = 2_000_000 + h*1000 + l*10 + groups[2].r; rank = "Two Pair";
  } else if (groups[0].c === 2) {
    value = 1_000_000 + groups[0].r*10000 + groups[1].r*1000 + groups[2].r*100 + groups[3].r;
    rank  = "Pair";
  } else {
    value = rankVals[0]*10000 + rankVals[1]*1000 + rankVals[2]*100 + rankVals[3]*10 + rankVals[4];
    rank  = "High Card";
  }
  return { rank, value, description: rank };
}

export function evaluateHand(cards: string[]): HandResult { return score5(cards); }

// ─── Which cards a bot should discard ────────────────────────────────────────
// Returns indices (0-4) of cards to throw away.
function botDiscardIndices(hand: string[]): number[] {
  const parsed   = hand.map(parseCard);
  const rankVals = parsed.map(c => rankValue(c.rank));
  const suits    = parsed.map(c => c.suit);

  // Count occurrences of each rank
  const counts: Record<number, number[]> = {};
  rankVals.forEach((r, i) => {
    if (!counts[r]) counts[r] = [];
    counts[r].push(i);
  });

  // Keep four-of-a-kind, full house, three-of-a-kind, two pair, pair
  const groups = Object.values(counts).sort((a, b) => b.length - a.length);
  const bestGroupSize = groups[0].length;

  if (bestGroupSize >= 3) {
    // Keep the three+ matching; discard rest
    const keepIdx = new Set(groups[0]);
    if (groups[1]?.length === 2) groups[1].forEach(i => keepIdx.add(i)); // full house
    return hand.map((_, i) => i).filter(i => !keepIdx.has(i));
  }
  if (bestGroupSize === 2) {
    const keepIdx = new Set(groups[0]);
    if (groups[1]?.length === 2) groups[1].forEach(i => keepIdx.add(i)); // two pair
    return hand.map((_, i) => i).filter(i => !keepIdx.has(i));
  }
  // Check for flush draw (4 of same suit)
  const suitCounts: Record<string, number[]> = {};
  suits.forEach((s, i) => { if (!suitCounts[s]) suitCounts[s] = []; suitCounts[s].push(i); });
  const flushDraw = Object.values(suitCounts).find(arr => arr.length === 4);
  if (flushDraw) {
    const keepIdx = new Set(flushDraw);
    return hand.map((_, i) => i).filter(i => !keepIdx.has(i));
  }
  // No pairs — discard bottom 3 by rank value
  const sorted = rankVals.map((v, i) => ({ v, i })).sort((a, b) => a.v - b.v);
  return sorted.slice(0, 3).map(x => x.i);
}

// ─── Typed document shapes ────────────────────────────────────────────────────

interface GameDoc {
  _id: Id<"games">;
  _creationTime: number;
  roomId: Id<"rooms">;
  deck: string[];
  holeCards: string;
  phase: "betting1" | "draw" | "betting2" | "showdown";
  currentPlayerIndex: number;
  dealerIndex: number;
  playerOrder: string[];
  playerStates: string;
  actedThisRound: string;
  drawnThisRound: string;
  lastAction?: string;
  winnerId?: string;
  winnerIds?: string[];
  loserId?: string;
  loserIds?: string[];
  winningHand?: string;
  losingHand?: string;
  status: "active" | "finished";
  handNumber: number;
  createdAt: number;
}

interface PlayerDoc {
  _id: Id<"players">;
  roomId: Id<"rooms">;
  userId: string;
  name: string;
  isBot: boolean;
  lives: number;
  seatIndex: number;
}

interface RoomDoc {
  _id: Id<"rooms">;
  name: string;
  hostId: string;
  status: "waiting" | "playing" | "finished";
  playerIds: string[];
  startingLives: number;
}

// ─── DB helpers ───────────────────────────────────────────────────────────────

async function getLatestGame(ctx: MutationCtx | QueryCtx, roomId: Id<"rooms">): Promise<GameDoc | null> {
  return (await ctx.db.query("games").withIndex("by_room", q => q.eq("roomId", roomId)).order("desc").first()) as GameDoc | null;
}

async function getPlayerDoc(ctx: MutationCtx, userId: string, roomId: Id<"rooms">): Promise<PlayerDoc | null> {
  return (await ctx.db.query("players").withIndex("by_user_room", q => q.eq("userId", userId).eq("roomId", roomId)).first()) as PlayerDoc | null;
}

// ─── Betting round helpers ────────────────────────────────────────────────────

function getNextActiveIndex(playerOrder: string[], current: number, states: Record<string,string>): number {
  const n = playerOrder.length;
  let next = (current + 1) % n;
  let tries = 0;
  while (states[playerOrder[next]] === "folded" && tries < n) { next = (next + 1) % n; tries++; }
  return next;
}

// Returns true when every active (non-folded) player has acted this round
function bettingRoundComplete(
  playerOrder: string[],
  states: Record<string,string>,
  acted: Record<string,boolean>,
): boolean {
  return playerOrder
    .filter(id => states[id] === "active")
    .every(id => acted[id] === true);
}

// Returns true when every active player has drawn (or chosen to stand pat)
function drawRoundComplete(
  playerOrder: string[],
  states: Record<string,string>,
  drawn: Record<string,boolean>,
): boolean {
  return playerOrder
    .filter(id => states[id] === "active")
    .every(id => drawn[id] === true);
}

// ─── Deal hand ────────────────────────────────────────────────────────────────

async function dealNewHand(
  ctx: MutationCtx,
  roomId: Id<"rooms">,
  players: PlayerDoc[],
  playerOrder: string[],
  dealerIndex: number,
  handNumber: number,
): Promise<Id<"games">> {
  const deck = createDeck();
  const holeCards: Record<string,string[]> = {};
  for (const p of players) holeCards[p.userId] = [deck.pop()!, deck.pop()!, deck.pop()!, deck.pop()!, deck.pop()!];

  const playerStates: Record<string,string>   = {};
  const actedThisRound: Record<string,boolean> = {};
  const drawnThisRound: Record<string,boolean> = {};
  players.forEach(p => {
    playerStates[p.userId]   = "active";
    actedThisRound[p.userId] = false;
    drawnThisRound[p.userId] = false;
  });

  // First to act = player left of dealer
  const firstIdx = (dealerIndex + 1) % players.length;

  const gameId = await ctx.db.insert("games", {
    roomId,
    deck,
    holeCards: JSON.stringify(holeCards),
    phase: "betting1",
    currentPlayerIndex: firstIdx,
    dealerIndex,
    playerOrder,
    playerStates: JSON.stringify(playerStates),
    actedThisRound: JSON.stringify(actedThisRound),
    drawnThisRound: JSON.stringify(drawnThisRound),
    lastAction: `Hand #${handNumber} — 5 cards dealt! Check or bet. 🃏`,
    status: "active",
    handNumber,
    createdAt: Date.now(),
  });

  // If first actor is a bot, kick off its turn
  if (playerOrder[firstIdx]?.startsWith("bot_")) {
    await ctx.scheduler.runAfter(1200, internal.game.botTurn, { roomId });
  }

  return gameId;
}

// ─── Advance after a betting round completes ──────────────────────────────────

async function advanceBettingRound(
  ctx: MutationCtx,
  game: GameDoc,
  roomId: Id<"rooms">,
  playerStates: Record<string,string>,
) {
  // Check solo survivor
  const notFolded = game.playerOrder.filter(id => playerStates[id] !== "folded");
  if (notFolded.length === 1) {
    await awardNoShowdown(ctx, game, roomId, notFolded[0], playerStates);
    return;
  }

  const freshActed: Record<string,boolean> = {};
  const freshDrawn: Record<string,boolean> = {};
  game.playerOrder.forEach(id => { freshActed[id] = false; freshDrawn[id] = false; });

  const nextPhase = game.phase === "betting1" ? "draw" : "showdown";

  if (nextPhase === "showdown") {
    await ctx.db.patch(game._id, {
      phase: "showdown",
      playerStates: JSON.stringify(playerStates),
      actedThisRound: JSON.stringify(freshActed),
      lastAction: "🃏 Showdown!",
    });
    await ctx.scheduler.runAfter(500, internal.game.doShowdown, { roomId });
    return;
  }

  // Advance to draw phase
  const n = game.playerOrder.length;
  let firstActive = (game.dealerIndex + 1) % n;
  let t = 0;
  while (playerStates[game.playerOrder[firstActive]] === "folded" && t < n) {
    firstActive = (firstActive + 1) % n;
    t++;
  }

  await ctx.db.patch(game._id, {
    phase: "draw",
    currentPlayerIndex: firstActive,
    playerStates: JSON.stringify(playerStates),
    actedThisRound: JSON.stringify(freshActed),
    drawnThisRound: JSON.stringify(freshDrawn),
    lastAction: "✋ Draw phase — discard up to 3 cards",
  });

  if (game.playerOrder[firstActive]?.startsWith("bot_")) {
    await ctx.scheduler.runAfter(1200, internal.game.botTurn, { roomId });
  }
}

// ─── Award pot when everyone else folded (no showdown needed) ─────────────────

async function awardNoShowdown(
  ctx: MutationCtx,
  game: GameDoc,
  roomId: Id<"rooms">,
  winnerId: string,
  playerStates: Record<string,string>,
) {
  await ctx.db.patch(game._id, {
    phase: "showdown",
    status: "finished",
    playerStates: JSON.stringify(playerStates),
    winnerId,
    winnerIds: [winnerId],
    loserIds: [],
    lastAction: `🏆 Everyone folded — no clothes lost this round!`,
  });
}

// ─── Queries ──────────────────────────────────────────────────────────────────

export const getGame = query({
  args: { roomId: v.id("rooms") },
  handler: async (ctx, { roomId }) =>
    ctx.db.query("games").withIndex("by_room", q => q.eq("roomId", roomId)).order("desc").first(),
});

export const getPlayerHoleCards = query({
  args: { roomId: v.id("rooms"), userId: v.string() },
  handler: async (ctx, { roomId, userId }) => {
    const game = await ctx.db.query("games").withIndex("by_room", q => q.eq("roomId", roomId)).order("desc").first();
    if (!game) return null;
    return (JSON.parse(game.holeCards) as Record<string,string[]>)[userId] ?? null;
  },
});

export const getFinishedGames = query({
  handler: async (ctx) =>
    ctx.db.query("games").filter(q => q.eq(q.field("status"), "finished")).order("desc").take(100),
});

export const getFinishedGamesForUser = query({
  args: { userId: v.string() },
  handler: async (ctx, { userId }) => {
    const all = await ctx.db.query("games").filter(q => q.eq(q.field("status"), "finished")).order("desc").take(300);
    return all.filter(g => g.playerOrder.includes(userId));
  },
});

// ─── Start game ───────────────────────────────────────────────────────────────

export const startGame = mutation({
  args: { roomId: v.id("rooms"), requesterId: v.string() },
  handler: async (ctx, { roomId, requesterId }) => {
    const room = (await ctx.db.get(roomId)) as RoomDoc | null;
    if (!room) throw new Error("Room not found");
    if (room.hostId !== requesterId) throw new Error("Only host can start");
    if (room.playerIds.length < 2) throw new Error("Need at least 2 players");

    const players = (await ctx.db.query("players").withIndex("by_room", q => q.eq("roomId", roomId)).collect()) as PlayerDoc[];
    const sorted      = players.sort((a, b) => a.seatIndex - b.seatIndex);
    const playerOrder = sorted.map(p => p.userId);

    await dealNewHand(ctx, roomId, sorted, playerOrder, 0, 1);
    await ctx.db.patch(roomId, { status: "playing" });
  },
});

// ─── Player betting action ─────────────────────────────────────────────────────
// Available actions: "check" | "bet" | "call" | "fold"
// Betting is symbolic — there are no chips. "Bet" means "I'm in, I think I can win."
// If someone bets, others must call or fold. No raises.

export const playerAction = mutation({
  args: {
    roomId: v.id("rooms"),
    userId: v.string(),
    action: v.union(
      v.literal("check"),
      v.literal("bet"),
      v.literal("call"),
      v.literal("fold"),
    ),
  },
  handler: async (ctx, { roomId, userId, action }) => {
    const game = await getLatestGame(ctx, roomId);
    if (!game || game.status !== "active") throw new Error("No active game");
    if (game.phase !== "betting1" && game.phase !== "betting2") throw new Error("Not a betting phase");

    const currentPlayerId = game.playerOrder[game.currentPlayerIndex];
    if (currentPlayerId !== userId) throw new Error("Not your turn");

    const playerStates   = JSON.parse(game.playerStates)   as Record<string,string>;
    const actedThisRound = JSON.parse(game.actedThisRound) as Record<string,boolean>;

    if (playerStates[userId] === "folded") throw new Error("Already folded");

    let lastAction = "";
    // Track whether a bet is open (at least one player has bet and not everyone has responded)
    // Simple model: we store "hasBet" in lastAction prefix — use actedThisRound to detect
    const anyoneBet = game.playerOrder.some(
      id => playerStates[id] === "active" && actedThisRound[id] && game.lastAction?.includes("bets")
    );

    if (action === "fold") {
      playerStates[userId] = "folded";
      lastAction = `😬 ${userId} folds`;
    } else if (action === "check") {
      if (anyoneBet) throw new Error("Can't check — someone has bet. Call or fold.");
      lastAction = `✋ ${userId} checks`;
    } else if (action === "bet") {
      if (anyoneBet) throw new Error("Can't bet again — call or fold.");
      lastAction = `💰 ${userId} bets`;
    } else if (action === "call") {
      if (!anyoneBet) throw new Error("Nothing to call — check instead.");
      lastAction = `✅ ${userId} calls`;
    }

    actedThisRound[userId] = true;

    // Check if everyone has now acted
    const notFolded = game.playerOrder.filter(id => playerStates[id] !== "folded");
    if (notFolded.length === 1) {
      await awardNoShowdown(ctx, game, roomId, notFolded[0], playerStates);
      return;
    }

    if (bettingRoundComplete(game.playerOrder, playerStates, actedThisRound)) {
      await ctx.db.patch(game._id, {
        playerStates: JSON.stringify(playerStates),
        actedThisRound: JSON.stringify(actedThisRound),
        lastAction,
      });
      await advanceBettingRound(ctx, game, roomId, playerStates);
      return;
    }

    // Move to next player
    const nextIdx = getNextActiveIndex(game.playerOrder, game.currentPlayerIndex, playerStates);
    await ctx.db.patch(game._id, {
      playerStates: JSON.stringify(playerStates),
      actedThisRound: JSON.stringify(actedThisRound),
      currentPlayerIndex: nextIdx,
      lastAction,
    });

    if (game.playerOrder[nextIdx]?.startsWith("bot_")) {
      await ctx.scheduler.runAfter(1000, internal.game.botTurn, { roomId });
    }
  },
});

// ─── Player draw action ───────────────────────────────────────────────────────
// discardIndices: 0-based indices into their 5-card hand to throw away (max 3)

export const playerDraw = mutation({
  args: {
    roomId: v.id("rooms"),
    userId: v.string(),
    discardIndices: v.array(v.number()), // [] = stand pat, [0,1,2] = discard 3
  },
  handler: async (ctx, { roomId, userId, discardIndices }) => {
    const game = await getLatestGame(ctx, roomId);
    if (!game || game.status !== "active") throw new Error("No active game");
    if (game.phase !== "draw") throw new Error("Not draw phase");

    const currentPlayerId = game.playerOrder[game.currentPlayerIndex];
    if (currentPlayerId !== userId) throw new Error("Not your turn");
    if (discardIndices.length > 3) throw new Error("Can only discard up to 3 cards");

    const playerStates  = JSON.parse(game.playerStates)  as Record<string,string>;
    const drawnThisRound = JSON.parse(game.drawnThisRound) as Record<string,boolean>;
    const holeCards      = JSON.parse(game.holeCards)     as Record<string,string[]>;

    if (playerStates[userId] === "folded") throw new Error("You folded");
    if (drawnThisRound[userId]) throw new Error("Already drawn");

    const deck    = [...game.deck];
    const myCards = [...(holeCards[userId] ?? [])];

    // Replace discarded cards with new ones from deck
    discardIndices.forEach(idx => {
      if (idx >= 0 && idx < myCards.length) {
        myCards[idx] = deck.pop()!;
      }
    });

    holeCards[userId]    = myCards;
    drawnThisRound[userId] = true;

    const discardMsg = discardIndices.length === 0
      ? `🃏 ${userId} stands pat`
      : `🔄 ${userId} draws ${discardIndices.length}`;

    // Check if all active players have drawn
    const tempDrawn = { ...drawnThisRound };
    if (drawRoundComplete(game.playerOrder, playerStates, tempDrawn)) {
      // Everyone drawn — move to betting2
      const freshActed: Record<string,boolean> = {};
      game.playerOrder.forEach(id => { freshActed[id] = false; });
      const n = game.playerOrder.length;
      let firstActive = (game.dealerIndex + 1) % n;
      let t = 0;
      while (playerStates[game.playerOrder[firstActive]] === "folded" && t < n) {
        firstActive = (firstActive + 1) % n;
        t++;
      }
      await ctx.db.patch(game._id, {
        deck,
        holeCards: JSON.stringify(holeCards),
        drawnThisRound: JSON.stringify(tempDrawn),
        phase: "betting2",
        currentPlayerIndex: firstActive,
        actedThisRound: JSON.stringify(freshActed),
        lastAction: `${discardMsg} — Second betting round!`,
      });
      if (game.playerOrder[firstActive]?.startsWith("bot_")) {
        await ctx.scheduler.runAfter(1200, internal.game.botTurn, { roomId });
      }
      return;
    }

    // Move to next player for draw
    const nextIdx = getNextActiveIndex(game.playerOrder, game.currentPlayerIndex, playerStates);
    await ctx.db.patch(game._id, {
      deck,
      holeCards: JSON.stringify(holeCards),
      drawnThisRound: JSON.stringify(tempDrawn),
      currentPlayerIndex: nextIdx,
      lastAction: discardMsg,
    });

    if (game.playerOrder[nextIdx]?.startsWith("bot_")) {
      await ctx.scheduler.runAfter(1000, internal.game.botTurn, { roomId });
    }
  },
});

// ─── Bot turn ─────────────────────────────────────────────────────────────────

export const botTurn = internalMutation({
  args: { roomId: v.id("rooms") },
  handler: async (ctx, { roomId }) => {
    const game = await getLatestGame(ctx, roomId);
    if (!game || game.status !== "active") return;

    const botId = game.playerOrder[game.currentPlayerIndex];
    if (!botId.startsWith("bot_")) return;

    const playerStates   = JSON.parse(game.playerStates)   as Record<string,string>;
    const actedThisRound = JSON.parse(game.actedThisRound) as Record<string,boolean>;
    const drawnThisRound = JSON.parse(game.drawnThisRound) as Record<string,boolean>;
    const holeCards      = JSON.parse(game.holeCards)      as Record<string,string[]>;
    const botHand        = holeCards[botId] ?? [];

    // ── Draw phase ────────────────────────────────────────────────────────
    if (game.phase === "draw") {
      const discardIndices = botDiscardIndices(botHand);
      const deck           = [...game.deck];
      const newHand        = [...botHand];
      discardIndices.forEach(idx => { newHand[idx] = deck.pop()!; });
      holeCards[botId]       = newHand;
      drawnThisRound[botId]  = true;

      const discardMsg = discardIndices.length === 0 ? `🤖 Bot stands pat` : `🤖 Bot draws ${discardIndices.length}`;

      if (drawRoundComplete(game.playerOrder, playerStates, drawnThisRound)) {
        const freshActed: Record<string,boolean> = {};
        game.playerOrder.forEach(id => { freshActed[id] = false; });
        const n = game.playerOrder.length;
        let firstActive = (game.dealerIndex + 1) % n;
        let t = 0;
        while (playerStates[game.playerOrder[firstActive]] === "folded" && t < n) { firstActive = (firstActive + 1) % n; t++; }
        await ctx.db.patch(game._id, {
          deck,
          holeCards: JSON.stringify(holeCards),
          drawnThisRound: JSON.stringify(drawnThisRound),
          phase: "betting2",
          currentPlayerIndex: firstActive,
          actedThisRound: JSON.stringify(freshActed),
          lastAction: `${discardMsg} — Second betting round!`,
        });
        if (game.playerOrder[firstActive]?.startsWith("bot_")) {
          await ctx.scheduler.runAfter(1200, internal.game.botTurn, { roomId });
        }
        return;
      }

      const nextIdx = getNextActiveIndex(game.playerOrder, game.currentPlayerIndex, playerStates);
      await ctx.db.patch(game._id, {
        deck,
        holeCards: JSON.stringify(holeCards),
        drawnThisRound: JSON.stringify(drawnThisRound),
        currentPlayerIndex: nextIdx,
        lastAction: discardMsg,
      });
      if (game.playerOrder[nextIdx]?.startsWith("bot_")) {
        await ctx.scheduler.runAfter(1000, internal.game.botTurn, { roomId });
      }
      return;
    }

    // ── Betting phase ─────────────────────────────────────────────────────
    const strength    = evaluateHand(botHand).value / 9_000_000;
    const anyoneBet   = game.playerOrder.some(
      id => playerStates[id] === "active" && actedThisRound[id] && game.lastAction?.includes("bets")
    );

    let action: "check" | "bet" | "call" | "fold";
    let lastAction = "";

    if (anyoneBet) {
      action     = strength > 0.25 ? "call" : "fold";
      lastAction = action === "call" ? `🤖 Bot calls` : `🤖 Bot folds`;
    } else {
      action     = strength > 0.45 ? "bet" : "check";
      lastAction = action === "bet" ? `🤖 Bot bets` : `🤖 Bot checks`;
    }

    if (action === "fold") playerStates[botId] = "folded";
    actedThisRound[botId] = true;

    const notFolded = game.playerOrder.filter(id => playerStates[id] !== "folded");
    if (notFolded.length === 1) {
      await awardNoShowdown(ctx, game, roomId, notFolded[0], playerStates);
      return;
    }

    if (bettingRoundComplete(game.playerOrder, playerStates, actedThisRound)) {
      await ctx.db.patch(game._id, {
        playerStates: JSON.stringify(playerStates),
        actedThisRound: JSON.stringify(actedThisRound),
        lastAction,
      });
      await advanceBettingRound(ctx, game, roomId, playerStates);
      return;
    }

    const nextIdx = getNextActiveIndex(game.playerOrder, game.currentPlayerIndex, playerStates);
    await ctx.db.patch(game._id, {
      playerStates: JSON.stringify(playerStates),
      actedThisRound: JSON.stringify(actedThisRound),
      currentPlayerIndex: nextIdx,
      lastAction,
    });
    if (game.playerOrder[nextIdx]?.startsWith("bot_")) {
      await ctx.scheduler.runAfter(1000, internal.game.botTurn, { roomId });
    }
  },
});

// ─── Showdown ─────────────────────────────────────────────────────────────────

export const doShowdown = internalMutation({
  args: { roomId: v.id("rooms") },
  handler: async (ctx, { roomId }) => {
    const game = await getLatestGame(ctx, roomId);
    if (!game || game.status !== "active") return;

    const playerStates = JSON.parse(game.playerStates) as Record<string,string>;
    const holeCards    = JSON.parse(game.holeCards)    as Record<string,string[]>;

    const active = game.playerOrder.filter(id => playerStates[id] !== "folded");
    const evals  = active.map(id => ({ id, result: evaluateHand(holeCards[id] ?? []) }));

    const maxVal = Math.max(...evals.map(e => e.result.value));
    const minVal = Math.min(...evals.map(e => e.result.value));

    const winners = evals.filter(e => e.result.value === maxVal);
    // Losers only if there's a clear worst hand (no tie)
    const losers  = maxVal !== minVal ? evals.filter(e => e.result.value === minVal) : [];

    // 🔻 Deduct 1 life from each loser
    for (const loser of losers) {
      const p = await getPlayerDoc(ctx, loser.id, roomId);
      if (p) await ctx.db.patch(p._id, { lives: Math.max(0, p.lives - 1) });
    }

    const winnerIds  = winners.map(w => w.id);
    const loserIds   = losers.map(l => l.id);
    const winningHand = winners[0].result.rank;
    const losingHand  = losers[0]?.result.rank;

    const resultMsg = losers.length === 0
      ? `🤝 It's a tie — nobody loses a piece!`
      : `💀 ${loserIds.join(", ")} ${loserIds.length === 1 ? "loses" : "lose"} a piece! ${winners[0].id} wins with ${winningHand}`;

    await ctx.db.patch(game._id, {
      phase: "showdown",
      status: "finished",
      winnerId: winnerIds[0],
      winnerIds,
      loserId: loserIds[0],
      loserIds,
      winningHand,
      losingHand,
      lastAction: resultMsg,
    });

    // End room if ≤1 player has lives left
    const allPlayers = (await ctx.db.query("players").withIndex("by_room", q => q.eq("roomId", roomId)).collect()) as PlayerDoc[];
    if (allPlayers.filter(p => p.lives > 0).length <= 1) {
      await ctx.db.patch(roomId, { status: "finished" });
    }
  },
});

// ─── Next hand ────────────────────────────────────────────────────────────────

export const nextHand = mutation({
  args: { roomId: v.id("rooms"), requesterId: v.string() },
  handler: async (ctx, { roomId, requesterId }) => {
    const room = (await ctx.db.get(roomId)) as RoomDoc | null;
    if (!room) throw new Error("Room not found");

    const finished = await getLatestGame(ctx, roomId);
    if (!finished || finished.status !== "finished") throw new Error("Hand not finished");

    const all     = (await ctx.db.query("players").withIndex("by_room", q => q.eq("roomId", roomId)).collect()) as PlayerDoc[];
    const active  = all.filter(p => p.lives > 0);

    if (active.length < 2) { await ctx.db.patch(roomId, { status: "finished" }); return; }

    const playerOrder = active
      .sort((a, b) => finished.playerOrder.indexOf(a.userId) - finished.playerOrder.indexOf(b.userId))
      .map(p => p.userId);

    const newDealerIndex = (finished.dealerIndex + 1) % playerOrder.length;
    await dealNewHand(ctx, roomId, active, playerOrder, newDealerIndex, finished.handNumber + 1);
  },
});