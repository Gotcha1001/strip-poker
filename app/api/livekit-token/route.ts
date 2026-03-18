/**
 * app/api/livekit-token/route.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Generates a LiveKit access token for a given room + user.
 *
 * Required env vars (add to .env.local):
 *   LIVEKIT_API_KEY=your_api_key
 *   LIVEKIT_API_SECRET=your_api_secret
 *   NEXT_PUBLIC_LIVEKIT_URL=wss://your-livekit-server.livekit.cloud
 *
 * Install the server SDK:
 *   npm install livekit-server-sdk
 *   # or
 *   yarn add livekit-server-sdk
 *
 * Free LiveKit Cloud: https://cloud.livekit.io
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { NextRequest, NextResponse } from "next/server";
import { AccessToken } from "livekit-server-sdk";

export const runtime = "edge"; // works on Vercel Edge too

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);

  const room    = searchParams.get("room");
  const userId  = searchParams.get("userId");
  const userName = searchParams.get("userName") ?? "Player";

  if (!room || !userId) {
    return NextResponse.json({ error: "room and userId are required" }, { status: 400 });
  }

  const apiKey    = process.env.LIVEKIT_API_KEY;
  const apiSecret = process.env.LIVEKIT_API_SECRET;

  if (!apiKey || !apiSecret) {
    return NextResponse.json(
      { error: "LIVEKIT_API_KEY and LIVEKIT_API_SECRET must be set" },
      { status: 500 }
    );
  }

  const token = new AccessToken(apiKey, apiSecret, {
    identity: userId,
    name: userName,
    ttl: "4h",    // token valid for 4 hours — plenty for a poker session
  });

  token.addGrant({
    room,
    roomJoin: true,
    canPublish: true,
    canSubscribe: true,
    canPublishData: true,
  });

  return NextResponse.json({ token: await token.toJwt() });
}