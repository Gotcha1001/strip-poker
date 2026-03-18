

import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

// ────────────────────────────────────────────────────────────────────────────
// 🎰 CLASSIC 5-CARD DRAW STRIP POKER
//
// Rules:
//   • Each player gets 5 hole cards
//   • Betting round 1 (check / bet / call / fold)
//   • Draw phase — discard & redraw up to 3 cards
//   • Betting round 2 (check / bet / call / fold)
//   • Showdown — worst hand loses 1 clothing piece
//   • 5 pieces each: 👟👟🧦🧦👖👔👙  (shoes×2, socks×2, pants, shirt, underwear)
//   • Run out → eliminated. Last clothed player wins.
//
// Phases:
//   deal → betting1 → draw → betting2 → showdown
// ────────────────────────────────────────────────────────────────────────────

export default defineSchema({
  users: defineTable({
    clerkId: v.string(),
    email: v.string(),
    name: v.string(),
    imageUrl: v.optional(v.string()),
    role: v.union(v.literal("admin"), v.literal("user")),
    createdAt: v.number(),
  }).index("by_clerk_id", ["clerkId"]),

  rooms: defineTable({
    name: v.string(),
    hostId: v.string(),
    hostName: v.string(),
    status: v.union(
      v.literal("waiting"),
      v.literal("playing"),
      v.literal("finished")
    ),
    maxPlayers: v.number(),
    playerIds: v.array(v.string()),
    startingLives: v.number(), // default 5
    createdAt: v.number(),
  }).index("by_status", ["status"]),

  players: defineTable({
    roomId: v.id("rooms"),
    userId: v.string(),
    name: v.string(),
    avatarUrl: v.optional(v.string()),
    isBot: v.boolean(),
    isReady: v.boolean(),
    isConnected: v.boolean(),
    lives: v.number(),      // clothing pieces remaining
    seatIndex: v.number(),
  })
    .index("by_room", ["roomId"])
    .index("by_user_room", ["userId", "roomId"]),

  games: defineTable({
    roomId: v.id("rooms"),

    // ── Cards ──────────────────────────────────────────────────────────────
    deck: v.array(v.string()),
    // JSON: { [playerId]: ["AS","KH","2D","7C","QS"] }
    holeCards: v.string(),

    // ── Game flow ──────────────────────────────────────────────────────────
    phase: v.union(
      v.literal("betting1"),   // first betting round after deal
      v.literal("draw"),       // players discard & draw
      v.literal("betting2"),   // second betting round after draw
      v.literal("showdown")    // reveal & penalise loser
    ),

    // Index into playerOrder of who acts next
    currentPlayerIndex: v.number(),
    dealerIndex: v.number(),
    playerOrder: v.array(v.string()),

    // JSON: { [playerId]: "active" | "folded" }
    playerStates: v.string(),

    // JSON: { [playerId]: boolean } — has this player acted this betting round?
    actedThisRound: v.string(),

    // JSON: { [playerId]: boolean } — has this player completed their draw?
    drawnThisRound: v.string(),

    // ── Results ────────────────────────────────────────────────────────────
    lastAction: v.optional(v.string()),
    winnerId: v.optional(v.string()),
    winnerIds: v.optional(v.array(v.string())),
    loserId: v.optional(v.string()),
    loserIds: v.optional(v.array(v.string())),
    winningHand: v.optional(v.string()),
    losingHand: v.optional(v.string()),

    status: v.union(
      v.literal("active"),
      v.literal("finished")
    ),
    handNumber: v.number(),
    createdAt: v.number(),
  }).index("by_room", ["roomId"]),

  messages: defineTable({
    roomId: v.id("rooms"),
    userId: v.string(),
    userName: v.string(),
    text: v.string(),
    createdAt: v.number(),
  }).index("by_room", ["roomId"]),
});