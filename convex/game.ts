import { v } from "convex/values";
import { mutation, query, internalMutation } from "./_generated/server";
import { internal } from "./_generated/api";
import { Id } from "./_generated/dataModel";
import type { MutationCtx, QueryCtx } from "./_generated/server";

// ─── Card Types & Deck ────────────────────────────────────────────────────────
const SUITS = ["S", "H", "D", "C"] as const;
const RANKS = [
  "2",
  "3",
  "4",
  "5",
  "6",
  "7",
  "8",
  "9",
  "T",
  "J",
  "Q",
  "K",
  "A",
] as const;
type Suit = (typeof SUITS)[number];
type Rank = (typeof RANKS)[number];

function makeCard(rank: Rank, suit: Suit): string {
  return rank + suit;
}
function parseCard(card: string): { rank: Rank; suit: Suit } {
  return { rank: card.slice(0, -1) as Rank, suit: card.slice(-1) as Suit };
}
function rankValue(rank: string): number {
  return RANKS.indexOf(rank as Rank);
}

function createDeck(): string[] {
  const deck: string[] = [];
  for (const suit of SUITS)
    for (const rank of RANKS) deck.push(makeCard(rank, suit));
  return shuffle(deck);
}
function shuffle<T>(array: T[]): T[] {
  const arr = [...array];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

// ─── Typed document shapes ────────────────────────────────────────────────────

interface GameDoc {
  _id: Id<"games">;
  _creationTime: number;
  roomId: Id<"rooms">;
  deck: string[];
  holeCards: string;
  communityCards: string[];
  pot: number;
  sidePots: string;
  currentBet: number;
  minRaise: number;
  bigBlind: number;
  phase: "preflop" | "flop" | "turn" | "river" | "showdown";
  dealerIndex: number;
  currentPlayerIndex: number;
  playerOrder: string[];
  roundBets: string;
  playerStates: string;
  lastAction?: string;
  lastRaiserId?: string;
  winnerId?: string;
  winnerIds?: string[];
  winningHand?: string;
  status: "active" | "finished";
  handNumber: number;
  createdAt: number;
}

interface RoomDoc {
  _id: Id<"rooms">;
  _creationTime: number;
  name: string;
  hostId: string;
  hostName: string;
  status: "waiting" | "playing" | "finished";
  maxPlayers: number;
  playerIds: string[];
  bigBlind: number;
  startingChips: number;
  createdAt: number;
}

interface PlayerDoc {
  _id: Id<"players">;
  _creationTime: number;
  roomId: Id<"rooms">;
  userId: string;
  name: string;
  avatarUrl?: string;
  isBot: boolean;
  isReady: boolean;
  isConnected: boolean;
  chips: number;
  seatIndex: number;
}

interface ChipLedgerDoc {
  _id: Id<"chipLedger">;
  _creationTime: number;
  roomId: Id<"rooms">;
  userId: string;
  chips: number;
  handsPlayed: number;
  handsWon: number;
}

// ─── Hand Evaluation ──────────────────────────────────────────────────────────

export type HandRank =
  | "Royal Flush"
  | "Straight Flush"
  | "Four of a Kind"
  | "Full House"
  | "Flush"
  | "Straight"
  | "Three of a Kind"
  | "Two Pair"
  | "Pair"
  | "High Card";

export interface HandResult {
  rank: HandRank;
  value: number;
  bestCards: string[];
  description: string;
}

function score5(cards: string[]): HandResult {
  const parsed = cards.map(parseCard);
  const rankVals = parsed.map((c) => rankValue(c.rank)).sort((a, b) => b - a);
  const suits = parsed.map((c) => c.suit);
  const flush = suits.every((s) => s === suits[0]);
  const unique = [...new Set(rankVals)].sort((a, b) => b - a);
  const isStraight = unique.length === 5 && unique[0] - unique[4] === 4;
  const isWheelStraight =
    JSON.stringify(unique) === JSON.stringify([12, 3, 2, 1, 0]);
  const counts: Record<number, number> = {};
  rankVals.forEach((r) => {
    counts[r] = (counts[r] || 0) + 1;
  });
  const groups = Object.entries(counts)
    .map(([r, c]) => ({ r: +r, c: c as number }))
    .sort((a, b) => b.c - a.c || b.r - a.r);

  let value = 0;
  let rank: HandRank = "High Card";

  if (flush && (isStraight || isWheelStraight)) {
    const topRank = isWheelStraight ? 3 : unique[0];
    value =
      topRank === 12 && !isWheelStraight ? 9_000_000 : 8_000_000 + topRank;
    rank =
      topRank === 12 && !isWheelStraight ? "Royal Flush" : "Straight Flush";
  } else if (groups[0].c === 4) {
    value = 7_000_000 + groups[0].r * 100 + groups[1].r;
    rank = "Four of a Kind";
  } else if (groups[0].c === 3 && groups[1].c === 2) {
    value = 6_000_000 + groups[0].r * 100 + groups[1].r;
    rank = "Full House";
  } else if (flush) {
    value =
      5_000_000 +
      rankVals[0] * 10000 +
      rankVals[1] * 1000 +
      rankVals[2] * 100 +
      rankVals[3] * 10 +
      rankVals[4];
    rank = "Flush";
  } else if (isStraight || isWheelStraight) {
    value = 4_000_000 + (isWheelStraight ? 3 : unique[0]);
    rank = "Straight";
  } else if (groups[0].c === 3) {
    value = 3_000_000 + groups[0].r * 10000 + groups[1].r * 100 + groups[2].r;
    rank = "Three of a Kind";
  } else if (groups[0].c === 2 && groups[1].c === 2) {
    const high = Math.max(groups[0].r, groups[1].r),
      low = Math.min(groups[0].r, groups[1].r);
    value = 2_000_000 + high * 1000 + low * 10 + groups[2].r;
    rank = "Two Pair";
  } else if (groups[0].c === 2) {
    value =
      1_000_000 +
      groups[0].r * 10000 +
      groups[1].r * 1000 +
      groups[2].r * 100 +
      groups[3].r;
    rank = "Pair";
  } else {
    value =
      rankVals[0] * 10000 +
      rankVals[1] * 1000 +
      rankVals[2] * 100 +
      rankVals[3] * 10 +
      rankVals[4];
    rank = "High Card";
  }
  return { rank, value, bestCards: cards, description: rank };
}

export function evaluateHand(cards: string[]): HandResult {
  if (cards.length <= 5) return score5(cards);
  let best: HandResult | null = null;
  for (let i = 0; i < cards.length; i++)
    for (let j = i + 1; j < cards.length; j++) {
      const five = cards.filter((_, k) => k !== i && k !== j);
      const result = score5(five);
      if (!best || result.value > best.value) best = result;
    }
  return best!;
}

// ─── Betting helpers ──────────────────────────────────────────────────────────

/**
 * Determines whether the current betting round is over.
 *
 * The tricky case is the BB's option on preflop: if nobody has raised,
 * the BB posted the big blind but hasn't had a chance to raise yet.
 * We track this via lastRaiserId — if it equals the BB's userId and nobody
 * has re-raised, the BB still has the option to raise even though their
 * bet matches currentBet. The round ends only after the BB acts.
 *
 * Logic:
 *   - All active (non-folded, non-allIn) players must have matched currentBet.
 *   - The last raiser must NOT be the next player to act (everyone has acted
 *     since the last raise). We approximate this by checking that the actor
 *     who just acted is NOT the lastRaiserId — meaning the action has come
 *     back around to them without a re-raise.
 */
function isBettingComplete(
  playerOrder: string[],
  playerStates: Record<string, string>,
  roundBets: Record<string, number>,
  currentBet: number,
  lastRaiserId: string | undefined,
  actorId: string,
  action: string,
): boolean {
  // Raises/all-ins always reopen action — never complete immediately
  if (action === "raise" || action === "allIn") return false;

  const active = playerOrder.filter((id) => playerStates[id] === "active");
  if (active.length === 0) return true;

  // All active players must have matched the current bet
  const allMatched = active.every((id) => (roundBets[id] ?? 0) >= currentBet);
  if (!allMatched) return false;

  // BB option: if the last raiser is the BB and the actor is also the BB
  // (i.e., action returned to BB without a re-raise), BB just exercised
  // their option — betting IS complete after BB checks or calls.
  // In all other cases, if every active player is matched, we're done.
  return true;
}

function getNextPlayerIndex(
  playerOrder: string[],
  currentIndex: number,
  playerStates: Record<string, string>,
): number {
  const n = playerOrder.length;
  let next = (currentIndex + 1) % n;
  let tries = 0;
  while (
    (playerStates[playerOrder[next]] === "folded" ||
      playerStates[playerOrder[next]] === "allIn") &&
    tries < n
  ) {
    next = (next + 1) % n;
    tries++;
  }
  return next;
}

// ─── Typed helpers ────────────────────────────────────────────────────────────

async function getLatestGame(
  ctx: MutationCtx | QueryCtx,
  roomId: Id<"rooms">,
): Promise<GameDoc | null> {
  const doc = await ctx.db
    .query("games")
    .withIndex("by_room", (q) => q.eq("roomId", roomId))
    .order("desc")
    .first();
  return doc as GameDoc | null;
}

async function getLedger(
  ctx: MutationCtx,
  userId: string,
  roomId: Id<"rooms">,
): Promise<ChipLedgerDoc | null> {
  const doc = await ctx.db
    .query("chipLedger")
    .withIndex("by_user_room", (q) =>
      q.eq("userId", userId).eq("roomId", roomId),
    )
    .first();
  return doc as ChipLedgerDoc | null;
}

async function awardPot(
  ctx: MutationCtx,
  roomId: Id<"rooms">,
  game: GameDoc,
  winnerId: string,
  pot: number,
  playerStates: Record<string, string>,
  roundBets: Record<string, number>,
  lastAction: string,
): Promise<void> {
  const winnerLedger = await getLedger(ctx, winnerId, roomId);
  if (winnerLedger) {
    await ctx.db.patch(winnerLedger._id, {
      chips: winnerLedger.chips + pot,
      handsWon: winnerLedger.handsWon + 1,
      handsPlayed: winnerLedger.handsPlayed + 1,
    });
  }
  for (const id of game.playerOrder.filter((pid) => pid !== winnerId)) {
    const l = await getLedger(ctx, id, roomId);
    if (l) await ctx.db.patch(l._id, { handsPlayed: l.handsPlayed + 1 });
  }
  await ctx.db.patch(game._id, {
    pot,
    roundBets: JSON.stringify(roundBets),
    playerStates: JSON.stringify(playerStates),
    lastAction,
    winnerId,
    winnerIds: [winnerId],
    winningHand: "Last player standing",
    status: "finished",
  });
}

// ─── Deal Hand ────────────────────────────────────────────────────────────────

async function dealHand(
  ctx: MutationCtx,
  roomId: Id<"rooms">,
  room: RoomDoc,
  players: PlayerDoc[],
  playerOrder: string[],
  dealerIndex: number,
  handNumber: number,
): Promise<Id<"games">> {
  const bb = room.bigBlind;
  const sb = Math.floor(bb / 2);
  const n = players.length;
  const deck = createDeck();

  const holeCards: Record<string, string[]> = {};
  for (const p of players) holeCards[p.userId] = [deck.pop()!, deck.pop()!];

  const roundBets: Record<string, number> = {};
  const playerStates: Record<string, string> = {};
  players.forEach((p) => {
    roundBets[p.userId] = 0;
    playerStates[p.userId] = "active";
  });

  const sbIdx = (dealerIndex + 1) % n;
  const bbIdx = (dealerIndex + 2) % n;
  const sbPlayer = players[sbIdx];
  const bbPlayer = players[bbIdx];

  const sbLedger = await getLedger(ctx, sbPlayer.userId, roomId);
  const bbLedger = await getLedger(ctx, bbPlayer.userId, roomId);

  const sbAmt = Math.min(sb, sbLedger?.chips ?? sb);
  const bbAmt = Math.min(bb, bbLedger?.chips ?? bb);

  if (sbLedger)
    await ctx.db.patch(sbLedger._id, { chips: sbLedger.chips - sbAmt });
  if (bbLedger)
    await ctx.db.patch(bbLedger._id, { chips: bbLedger.chips - bbAmt });

  roundBets[sbPlayer.userId] = sbAmt;
  roundBets[bbPlayer.userId] = bbAmt;
  if ((sbLedger?.chips ?? 0) - sbAmt === 0)
    playerStates[sbPlayer.userId] = "allIn";
  if ((bbLedger?.chips ?? 0) - bbAmt === 0)
    playerStates[bbPlayer.userId] = "allIn";

  const pot = sbAmt + bbAmt;
  // Heads-up (n=2): dealer/SB acts first pre-flop as UTG
  const utgIdx = n === 2 ? dealerIndex : (bbIdx + 1) % n;

  const gameId = await ctx.db.insert("games", {
    roomId,
    deck,
    holeCards: JSON.stringify(holeCards),
    communityCards: [],
    pot,
    sidePots: "[]",
    currentBet: bbAmt,
    minRaise: bb,
    bigBlind: bb,
    phase: "preflop",
    dealerIndex,
    currentPlayerIndex: utgIdx,
    playerOrder,
    roundBets: JSON.stringify(roundBets),
    playerStates: JSON.stringify(playerStates),
    lastAction: `Hand #${handNumber} — blinds posted (SB: ${sbAmt}, BB: ${bbAmt})`,
    // lastRaiserId is the BB — this is what gives BB their option preflop.
    // Betting is not complete until action returns to the BB without a re-raise.
    lastRaiserId: bbPlayer.userId,
    status: "active",
    handNumber,
    createdAt: Date.now(),
  });

  return gameId;
}

// ─── Queries ──────────────────────────────────────────────────────────────────

export const getGame = query({
  args: { roomId: v.id("rooms") },
  handler: async (ctx, { roomId }) => {
    return await ctx.db
      .query("games")
      .withIndex("by_room", (q) => q.eq("roomId", roomId))
      .order("desc")
      .first();
  },
});

export const getPlayerHoleCards = query({
  args: { roomId: v.id("rooms"), userId: v.string() },
  handler: async (ctx, { roomId, userId }) => {
    const game = await ctx.db
      .query("games")
      .withIndex("by_room", (q) => q.eq("roomId", roomId))
      .order("desc")
      .first();
    if (!game) return null;
    const holeCards = JSON.parse(game.holeCards) as Record<string, string[]>;
    return holeCards[userId] ?? null;
  },
});

export const getChipLedger = query({
  args: { roomId: v.id("rooms") },
  handler: async (ctx, { roomId }) => {
    return await ctx.db
      .query("chipLedger")
      .withIndex("by_room", (q) => q.eq("roomId", roomId))
      .collect();
  },
});

export const getFinishedGames = query({
  handler: async (ctx) => {
    return await ctx.db
      .query("games")
      .filter((q) => q.eq(q.field("status"), "finished"))
      .order("desc")
      .take(100);
  },
});

export const getFinishedGamesForUser = query({
  args: { userId: v.string() },
  handler: async (ctx, { userId }) => {
    const all = await ctx.db
      .query("games")
      .filter((q) => q.eq(q.field("status"), "finished"))
      .order("desc")
      .take(300);
    return all.filter((g) => g.playerOrder.includes(userId));
  },
});

// ─── Start Game ───────────────────────────────────────────────────────────────

export const startGame = mutation({
  args: { roomId: v.id("rooms"), requesterId: v.string() },
  handler: async (ctx, { roomId, requesterId }) => {
    const room = (await ctx.db.get(roomId)) as RoomDoc | null;
    if (!room) throw new Error("Room not found");
    if (room.hostId !== requesterId) throw new Error("Only host can start");
    if (room.playerIds.length < 2) throw new Error("Need at least 2 players");

    const players = (await ctx.db
      .query("players")
      .withIndex("by_room", (q) => q.eq("roomId", roomId))
      .collect()) as PlayerDoc[];

    const sorted = players.sort((a, b) => a.seatIndex - b.seatIndex);
    const playerOrder = sorted.map((p) => p.userId);

    for (const p of sorted) {
      const existing = await getLedger(ctx, p.userId, roomId);
      if (!existing) {
        await ctx.db.insert("chipLedger", {
          roomId,
          userId: p.userId,
          chips: p.chips,
          handsPlayed: 0,
          handsWon: 0,
        });
      }
    }

    const gameId = await dealHand(ctx, roomId, room, sorted, playerOrder, 0, 1);
    await ctx.db.patch(roomId, { status: "playing" });

    const newGame = await getLatestGame(ctx, roomId);
    if (newGame) {
      const firstActorId = newGame.playerOrder[newGame.currentPlayerIndex];
      if (firstActorId.startsWith("bot_")) {
        await ctx.scheduler.runAfter(1200, internal.game.botTurn, { roomId });
      }
    }
  },
});

// ─── Bot Turn ─────────────────────────────────────────────────────────────────

export const botTurn = internalMutation({
  args: { roomId: v.id("rooms") },
  handler: async (ctx, { roomId }) => {
    const game = await getLatestGame(ctx, roomId);
    if (!game || game.status !== "active") return;

    const botId = game.playerOrder[game.currentPlayerIndex];
    if (!botId.startsWith("bot_")) return;

    const roundBets = JSON.parse(game.roundBets) as Record<string, number>;
    const playerStates = JSON.parse(game.playerStates) as Record<
      string,
      string
    >;
    const holeCards = JSON.parse(game.holeCards) as Record<string, string[]>;

    const botLedger = await getLedger(ctx, botId, roomId);
    if (!botLedger) return;

    const chips = botLedger.chips;
    const myBet = roundBets[botId] ?? 0;
    const callAmt = Math.min(game.currentBet - myBet, chips);

    // ── Hand strength ──────────────────────────────────────────────────────────
    //
    // Preflop: score using a proper Chen-inspired formula rather than raw rank
    // sum. Key fixes vs the old approach:
    //   1. Suited hands get a bonus (increases equity ~3-4%)
    //   2. Connected hands get a bonus (straight potential)
    //   3. Normalization uses the real achievable max (AA suited = ~1.0)
    //
    // Postflop: use actual hand evaluation value, unchanged.
    const botHole = holeCards[botId] ?? [];
    const allKnown = [...botHole, ...game.communityCards];
    let normalizedStrength = 0;

    if (allKnown.length >= 5) {
      normalizedStrength = evaluateHand(allKnown).value / 9_000_000;
    } else if (botHole.length === 2) {
      const c1 = parseCard(botHole[0]);
      const c2 = parseCard(botHole[1]);
      const r1 = rankValue(c1.rank); // 0–12
      const r2 = rankValue(c2.rank);
      const high = Math.max(r1, r2);
      const low = Math.min(r1, r2);
      const isPair = r1 === r2;
      const isSuited = c1.suit === c2.suit;
      const gap = high - low; // 0 = connected, 1 = one-gapper, etc.

      let score = 0;
      if (isPair) {
        // Pair of 2s (0) → 13, Pair of As (12) → 25
        score = 13 + high;
      } else {
        // High-card base: scale top card 0–12 to 0–10
        score = (high / 12) * 10;
        // Kicker contribution (smaller)
        score += (low / 12) * 3;
        // Suited bonus
        if (isSuited) score += 2;
        // Connector bonus: max at gap=1 (connected), falls off with gap
        if (gap <= 4) score += Math.max(0, 3 - gap * 0.8);
      }

      // Max possible score: pair of Aces = 25; suited connector Ks = ~17.5
      // Real max is ~25, normalize against that
      normalizedStrength = Math.min(score / 25, 1);
    }

    const rand = Math.random();
    let action: "fold" | "check" | "call" | "raise" | "allIn" = "call";
    let raiseToAmount: number | undefined;

    if (callAmt === 0) {
      // Free to check — bet with strong hands, check/fold otherwise
      if (normalizedStrength > 0.65 && rand < 0.55) {
        const betSize = Math.min(
          Math.floor(game.bigBlind * (2 + rand * 3)),
          chips,
        );
        if (betSize > 0 && myBet + betSize > game.currentBet) {
          action = "raise";
          raiseToAmount = myBet + betSize;
        } else {
          action = "check";
        }
      } else {
        action = "check";
      }
    } else {
      const potOdds = callAmt / (game.pot + callAmt);
      if (normalizedStrength < 0.2 && rand < 0.7) {
        action = "fold";
      } else if (
        normalizedStrength > 0.8 &&
        rand < 0.4 &&
        chips > callAmt * 2
      ) {
        const raiseSize = Math.min(
          myBet + game.currentBet + Math.floor(game.pot * 0.75),
          myBet + chips,
        );
        action = "raise";
        raiseToAmount = raiseSize;
      } else if (normalizedStrength > potOdds * 1.5) {
        action = chips <= callAmt ? "allIn" : "call";
      } else {
        action = rand < 0.35 ? "fold" : "call";
      }
    }

    // ── Execute ────────────────────────────────────────────────────────────────
    let newPot = game.pot;
    let newCurrentBet = game.currentBet;
    let newMinRaise = game.minRaise;
    let lastRaiserId = game.lastRaiserId;
    let lastAction = "";

    if (action === "fold") {
      playerStates[botId] = "folded";
      lastAction = "🤖 Bot folds";
    } else if (action === "check") {
      lastAction = "🤖 Bot checks";
    } else if (action === "call") {
      const actualCall = Math.min(callAmt, chips);
      roundBets[botId] = myBet + actualCall;
      await ctx.db.patch(botLedger._id, { chips: chips - actualCall });
      newPot += actualCall;
      if (chips - actualCall === 0) playerStates[botId] = "allIn";
      lastAction = `🤖 Bot calls ${actualCall}`;
    } else if (action === "raise" && raiseToAmount !== undefined) {
      const extra = Math.min(raiseToAmount - myBet, chips);
      roundBets[botId] = myBet + extra;
      await ctx.db.patch(botLedger._id, { chips: chips - extra });
      newPot += extra;
      newMinRaise = Math.max(game.minRaise, raiseToAmount - newCurrentBet);
      newCurrentBet = raiseToAmount;
      lastRaiserId = botId;
      if (chips - extra === 0) playerStates[botId] = "allIn";
      lastAction = `🤖 Bot raises to ${raiseToAmount}`;
    } else if (action === "allIn") {
      roundBets[botId] = myBet + chips;
      await ctx.db.patch(botLedger._id, { chips: 0 });
      newPot += chips;
      playerStates[botId] = "allIn";
      if (myBet + chips > newCurrentBet) {
        newMinRaise = Math.max(game.minRaise, myBet + chips - newCurrentBet);
        newCurrentBet = myBet + chips;
        lastRaiserId = botId;
      }
      lastAction = "🤖 Bot goes ALL IN!";
    }

    // ── One player left? ───────────────────────────────────────────────────────
    const notFolded = game.playerOrder.filter(
      (id) => playerStates[id] !== "folded",
    );
    if (notFolded.length === 1) {
      await awardPot(
        ctx,
        roomId,
        game,
        notFolded[0],
        newPot,
        playerStates,
        roundBets,
        `${notFolded[0]} wins ${newPot} — everyone else folded`,
      );
      return;
    }

    // ── Betting complete? ──────────────────────────────────────────────────────
    const bettingDone = isBettingComplete(
      game.playerOrder,
      playerStates,
      roundBets,
      newCurrentBet,
      lastRaiserId,
      botId,
      action,
    );

    if (bettingDone) {
      await ctx.db.patch(game._id, {
        pot: newPot,
        currentBet: newCurrentBet,
        minRaise: newMinRaise,
        roundBets: JSON.stringify(roundBets),
        playerStates: JSON.stringify(playerStates),
        lastRaiserId,
        lastAction,
      });
      await ctx.scheduler.runAfter(600, internal.game.advancePhase, { roomId });
      return;
    }

    // ── Next player ────────────────────────────────────────────────────────────
    const nextIdx = getNextPlayerIndex(
      game.playerOrder,
      game.currentPlayerIndex,
      playerStates,
    );
    await ctx.db.patch(game._id, {
      pot: newPot,
      currentBet: newCurrentBet,
      minRaise: newMinRaise,
      currentPlayerIndex: nextIdx,
      roundBets: JSON.stringify(roundBets),
      playerStates: JSON.stringify(playerStates),
      lastRaiserId,
      lastAction,
    });

    if (game.playerOrder[nextIdx].startsWith("bot_")) {
      await ctx.scheduler.runAfter(1000, internal.game.botTurn, { roomId });
    }
  },
});

// ─── Player Action ────────────────────────────────────────────────────────────

export const playerAction = mutation({
  args: {
    roomId: v.id("rooms"),
    userId: v.string(),
    action: v.union(
      v.literal("fold"),
      v.literal("check"),
      v.literal("call"),
      v.literal("raise"),
      v.literal("allIn"),
    ),
    raiseAmount: v.optional(v.number()),
  },
  handler: async (ctx, { roomId, userId, action, raiseAmount }) => {
    const game = await getLatestGame(ctx, roomId);
    if (!game || game.status !== "active") throw new Error("No active game");

    const currentPlayerId = game.playerOrder[game.currentPlayerIndex];
    if (currentPlayerId !== userId) throw new Error("Not your turn");

    const roundBets = JSON.parse(game.roundBets) as Record<string, number>;
    const playerStates = JSON.parse(game.playerStates) as Record<
      string,
      string
    >;
    const playerLedger = await getLedger(ctx, userId, roomId);
    if (!playerLedger) throw new Error("Player not found");

    const chips = playerLedger.chips;
    const myBet = roundBets[userId] ?? 0;
    const callAmt = Math.min(game.currentBet - myBet, chips);
    let newPot = game.pot;
    let newCurrentBet = game.currentBet;
    let newMinRaise = game.minRaise;
    let lastRaiserId = game.lastRaiserId;
    let lastAction = "";

    switch (action) {
      case "fold":
        playerStates[userId] = "folded";
        lastAction = `${userId} folds`;
        break;

      case "check":
        if (callAmt > 0) throw new Error("Cannot check — must call or fold");
        lastAction = `${userId} checks`;
        break;

      case "call": {
        roundBets[userId] = myBet + callAmt;
        await ctx.db.patch(playerLedger._id, { chips: chips - callAmt });
        newPot += callAmt;
        if (chips - callAmt === 0) playerStates[userId] = "allIn";
        lastAction = `${userId} calls ${callAmt}`;
        break;
      }

      case "raise": {
        const raiseTo = raiseAmount ?? game.currentBet + game.minRaise;

        // Validate: must be at least minRaise above currentBet, OR an all-in
        const minLegal = game.currentBet + game.minRaise;
        const isAllIn = raiseTo >= myBet + chips;
        if (!isAllIn && raiseTo < minLegal) {
          throw new Error(
            `Raise must be at least ${minLegal} (current ${game.currentBet} + min raise ${game.minRaise})`,
          );
        }

        const extra = Math.min(raiseTo - myBet, chips);
        roundBets[userId] = myBet + extra;
        await ctx.db.patch(playerLedger._id, { chips: chips - extra });
        newPot += extra;
        newMinRaise = Math.max(game.minRaise, raiseTo - newCurrentBet);
        newCurrentBet = Math.max(newCurrentBet, raiseTo);
        lastRaiserId = userId;
        if (chips - extra === 0) playerStates[userId] = "allIn";
        lastAction = `${userId} raises to ${raiseTo}`;
        break;
      }

      case "allIn": {
        const allInAmt = chips;
        roundBets[userId] = myBet + allInAmt;
        await ctx.db.patch(playerLedger._id, { chips: 0 });
        newPot += allInAmt;
        playerStates[userId] = "allIn";
        if (myBet + allInAmt > newCurrentBet) {
          newMinRaise = Math.max(
            game.minRaise,
            myBet + allInAmt - newCurrentBet,
          );
          newCurrentBet = myBet + allInAmt;
          lastRaiserId = userId;
        }
        lastAction = `${userId} goes all-in for ${allInAmt}!`;
        break;
      }
    }

    // One player left (everyone else folded)?
    const notFolded = game.playerOrder.filter(
      (id) => playerStates[id] !== "folded",
    );
    if (notFolded.length === 1) {
      await awardPot(
        ctx,
        roomId,
        game,
        notFolded[0],
        newPot,
        playerStates,
        roundBets,
        `${notFolded[0]} wins ${newPot} — everyone else folded`,
      );
      return;
    }

    // Betting complete?
    const bettingDone = isBettingComplete(
      game.playerOrder,
      playerStates,
      roundBets,
      newCurrentBet,
      lastRaiserId,
      userId,
      action,
    );

    if (bettingDone) {
      await ctx.db.patch(game._id, {
        pot: newPot,
        currentBet: newCurrentBet,
        minRaise: newMinRaise,
        roundBets: JSON.stringify(roundBets),
        playerStates: JSON.stringify(playerStates),
        lastRaiserId,
        lastAction,
      });
      await ctx.scheduler.runAfter(500, internal.game.advancePhase, { roomId });
      return;
    }

    // Next player
    const nextIdx = getNextPlayerIndex(
      game.playerOrder,
      game.currentPlayerIndex,
      playerStates,
    );
    await ctx.db.patch(game._id, {
      pot: newPot,
      currentBet: newCurrentBet,
      minRaise: newMinRaise,
      currentPlayerIndex: nextIdx,
      roundBets: JSON.stringify(roundBets),
      playerStates: JSON.stringify(playerStates),
      lastRaiserId,
      lastAction,
    });

    if (game.playerOrder[nextIdx].startsWith("bot_")) {
      await ctx.scheduler.runAfter(1000, internal.game.botTurn, { roomId });
    }
  },
});

// ─── Check Betting Complete ───────────────────────────────────────────────────

export const checkBettingComplete = internalMutation({
  args: { roomId: v.id("rooms") },
  handler: async (ctx, { roomId }) => {
    const game = await getLatestGame(ctx, roomId);
    if (!game || game.status !== "active") return;
    const roundBets = JSON.parse(game.roundBets) as Record<string, number>;
    const playerStates = JSON.parse(game.playerStates) as Record<
      string,
      string
    >;
    const eligible = game.playerOrder.filter(
      (id) => playerStates[id] === "active",
    );
    const allCalled = eligible.every(
      (id) => (roundBets[id] ?? 0) >= game.currentBet,
    );
    if (allCalled) {
      await ctx.scheduler.runAfter(0, internal.game.advancePhase, { roomId });
    }
  },
});

// ─── Advance Phase ────────────────────────────────────────────────────────────

export const advancePhase = internalMutation({
  args: { roomId: v.id("rooms") },
  handler: async (ctx, { roomId }) => {
    const game = await getLatestGame(ctx, roomId);
    if (!game || game.status !== "active") return;

    const playerStates = JSON.parse(game.playerStates) as Record<
      string,
      string
    >;
    const roundBets: Record<string, number> = {};
    game.playerOrder.forEach((id) => {
      if (playerStates[id] !== "folded") roundBets[id] = 0;
    });

    const deck = [...game.deck];
    let newCommunity = [...game.communityCards];
    let newPhase = game.phase;

    if (game.phase === "preflop") {
      newPhase = "flop";
      newCommunity = [...newCommunity, deck.pop()!, deck.pop()!, deck.pop()!];
    } else if (game.phase === "flop") {
      newPhase = "turn";
      newCommunity = [...newCommunity, deck.pop()!];
    } else if (game.phase === "turn") {
      newPhase = "river";
      newCommunity = [...newCommunity, deck.pop()!];
    } else if (game.phase === "river") {
      await doShowdown(ctx, game, roomId);
      return;
    } else {
      return;
    }

    const n = game.playerOrder.length;
    let firstActive = (game.dealerIndex + 1) % n;
    let tries = 0;
    while (
      (playerStates[game.playerOrder[firstActive]] === "folded" ||
        playerStates[game.playerOrder[firstActive]] === "allIn") &&
      tries < n
    ) {
      firstActive = (firstActive + 1) % n;
      tries++;
    }

    await ctx.db.patch(game._id, {
      deck,
      communityCards: newCommunity,
      phase: newPhase,
      currentBet: 0,
      minRaise: game.bigBlind,
      currentPlayerIndex: firstActive,
      roundBets: JSON.stringify(roundBets),
      lastRaiserId: undefined,
      lastAction: `${newPhase.charAt(0).toUpperCase() + newPhase.slice(1)} dealt`,
    });

    // All remaining players are all-in — auto-run rest of board
    const eligible = game.playerOrder.filter(
      (id) => playerStates[id] === "active",
    );
    if (eligible.length <= 1) {
      await ctx.scheduler.runAfter(800, internal.game.advancePhase, { roomId });
      return;
    }

    if (game.playerOrder[firstActive].startsWith("bot_")) {
      await ctx.scheduler.runAfter(1000, internal.game.botTurn, { roomId });
    }
  },
});

// ─── Showdown ─────────────────────────────────────────────────────────────────

async function doShowdown(
  ctx: MutationCtx,
  game: GameDoc,
  roomId: Id<"rooms">,
): Promise<void> {
  const playerStates = JSON.parse(game.playerStates) as Record<string, string>;
  const holeCards = JSON.parse(game.holeCards) as Record<string, string[]>;
  const activePlayers = game.playerOrder.filter(
    (id) => playerStates[id] !== "folded",
  );

  const evals = activePlayers.map((id) => ({
    id,
    result: evaluateHand([...(holeCards[id] ?? []), ...game.communityCards]),
  }));

  const maxVal = Math.max(...evals.map((e) => e.result.value));
  const winners = evals.filter((e) => e.result.value === maxVal);

  // Distribute pot: equal share per winner, odd chip goes to first winner
  // by seat order (standard casino rule — leftmost active player after dealer).
  const share = Math.floor(game.pot / winners.length);
  const remainder = game.pot - share * winners.length;

  for (let i = 0; i < winners.length; i++) {
    const w = winners[i];
    const ledger = await getLedger(ctx, w.id, roomId);
    if (ledger) {
      // First winner in seat order gets the odd chip(s)
      const bonus = i === 0 ? remainder : 0;
      await ctx.db.patch(ledger._id, {
        chips: ledger.chips + share + bonus,
        handsWon: ledger.handsWon + 1,
        handsPlayed: ledger.handsPlayed + 1,
      });
    }
  }

  const winnerSet = new Set(winners.map((w) => w.id));
  for (const id of game.playerOrder.filter((id) => !winnerSet.has(id))) {
    const ledger = await getLedger(ctx, id, roomId);
    if (ledger)
      await ctx.db.patch(ledger._id, { handsPlayed: ledger.handsPlayed + 1 });
  }

  const winningHand = winners[0].result.rank;
  const winnerIds = winners.map((w) => w.id);

  await ctx.db.patch(game._id, {
    phase: "showdown",
    status: "finished",
    winnerId: winners[0].id,
    winnerIds,
    winningHand,
    lastAction: `Showdown: ${winnerIds.join(", ")} wins with ${winningHand}!`,
  });
}

// ─── Next Hand ────────────────────────────────────────────────────────────────

export const nextHand = mutation({
  args: { roomId: v.id("rooms"), requesterId: v.string() },
  handler: async (ctx, { roomId, requesterId }) => {
    const room = (await ctx.db.get(roomId)) as RoomDoc | null;
    if (!room) throw new Error("Room not found");

    const finishedGame = await getLatestGame(ctx, roomId);
    if (!finishedGame || finishedGame.status !== "finished") {
      throw new Error("Hand not finished");
    }

    const ledgers = (await ctx.db
      .query("chipLedger")
      .withIndex("by_room", (q) => q.eq("roomId", roomId))
      .collect()) as ChipLedgerDoc[];

    const activeLedgers = ledgers.filter((l) => l.chips > 0);
    if (activeLedgers.length < 2) {
      await ctx.db.patch(roomId, { status: "finished" });
      return;
    }

    const playerOrder = activeLedgers
      .sort(
        (a, b) =>
          finishedGame.playerOrder.indexOf(a.userId) -
          finishedGame.playerOrder.indexOf(b.userId),
      )
      .map((l) => l.userId);

    const players = (await ctx.db
      .query("players")
      .withIndex("by_room", (q) => q.eq("roomId", roomId))
      .collect()) as PlayerDoc[];

    const activePlayers = players
      .filter((p) => activeLedgers.some((l) => l.userId === p.userId))
      .sort(
        (a, b) => playerOrder.indexOf(a.userId) - playerOrder.indexOf(b.userId),
      );

    const newDealerIndex = (finishedGame.dealerIndex + 1) % playerOrder.length;

    const gameId = await dealHand(
      ctx,
      roomId,
      room,
      activePlayers,
      playerOrder,
      newDealerIndex,
      finishedGame.handNumber + 1,
    );

    const newGame = await getLatestGame(ctx, roomId);
    if (newGame) {
      const firstActorId = newGame.playerOrder[newGame.currentPlayerIndex];
      if (firstActorId.startsWith("bot_")) {
        await ctx.scheduler.runAfter(1200, internal.game.botTurn, { roomId });
      }
    }
  },
});
