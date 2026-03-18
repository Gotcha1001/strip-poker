

import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

export const createOrGet = mutation({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Unauthorized -- no identity found");
    }

    console.log("[createOrGet] Identity:", JSON.stringify(identity, null, 2));

    const clerkId = identity.subject;

    const existing = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", clerkId))
      .first();

    if (existing) {
      console.log("[createOrGet] Returning existing user:", existing._id);
      return existing;
    }

    // Safe extraction
    const email = typeof identity.email === "string" ? identity.email : "";
    const name =
      typeof identity.name === "string"
        ? identity.name
        : typeof identity.givenName === "string"
          ? identity.givenName
          : "Unknown User";

    const imageUrl =
      typeof identity.pictureUrl === "string"
        ? identity.pictureUrl
        : typeof identity.picture === "string"
          ? identity.picture
          : typeof identity.image === "string"
            ? identity.image
            : undefined;

    console.log("[createOrGet] Creating new user with:", {
      clerkId,
      email,
      name,
      imageUrl: imageUrl ? "present" : "missing",
    });

    const userId = await ctx.db.insert("users", {
      clerkId,
      email,
      name,
      imageUrl,
      role: "user" as const,
      createdAt: Date.now(),
    });

    const newUser = await ctx.db.get(userId);
    if (newUser) {
      console.log("[createOrGet] Successfully created user:", newUser._id);
    } else {
      console.error("[createOrGet] Failed to retrieve new user");
    }

    return newUser;
  },
});

export const getMe = query({
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return null;

    return (
      (await ctx.db
        .query("users")
        .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
        .first()) ?? null
    );
  },
});

// Batch-fetch users by their Clerk IDs.
// Used by the leaderboard to resolve userIds → display names without
// storing names redundantly on every game record.
// Returns only the fields the client needs (clerkId + name) to keep
// the payload small.
export const getUsersByClerkIds = query({
  args: { clerkIds: v.array(v.string()) },
  handler: async (ctx, { clerkIds }) => {
    if (clerkIds.length === 0) return [];

    // Convex doesn't support IN queries, so we fetch in parallel.
    // For leaderboards this is typically ≤20 unique players — fine as N+1.
    const results = await Promise.all(
      clerkIds.map((clerkId) =>
        ctx.db
          .query("users")
          .withIndex("by_clerk_id", (q) => q.eq("clerkId", clerkId))
          .first(),
      ),
    );

    // Filter nulls (user deleted or not yet synced) and return minimal shape
    return results
      .filter((u): u is NonNullable<typeof u> => u !== null)
      .map((u) => ({ clerkId: u.clerkId, name: u.name }));
  },
});
