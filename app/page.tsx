"use client";

import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { useUser } from "@clerk/nextjs";
import { SignInButton } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

const FEATURES = [
  {
    title: "Real-Time Multiplayer",
    description: "Play live Texas Hold'em with friends or players around the world with instant updates powered by Convex.",
    icon: "🌍",
  },
  {
    title: "Private Game Rooms",
    description: "Create a room, set your blinds and starting stack, invite friends or fill seats with AI bots.",
    icon: "🏠",
  },
  {
    title: "Hand History & Stats",
    description: "Track every hand — win rate, chips won, best hands, and a live leaderboard across all players.",
    icon: "📊",
  },
];

const DEMO_CARDS = [
  { rank: "A", suit: "♠", color: "#1f2937", rotate: -18, x: -110, y: 10 },
  { rank: "K", suit: "♥", color: "#c0392b", rotate: -6, x: -55, y: -12 },
  { rank: "Q", suit: "♦", color: "#c0392b", rotate: 4, x: 0, y: 4 },
  { rank: "J", suit: "♣", color: "#1f2937", rotate: 14, x: 55, y: -8 },
  { rank: "10", suit: "♠", color: "#1f2937", rotate: 24, x: 110, y: 10 },
];

export default function Home() {
  const { isSignedIn } = useUser();
  const router = useRouter();

  useEffect(() => {
    if (isSignedIn) router.prefetch("/lobby");
  }, [isSignedIn, router]);

  return (
    <main className="relative min-h-screen flex flex-col items-center justify-center px-6 text-center overflow-hidden bg-white dark:bg-emerald-950">
      {/* Animated blobs */}
      <div className="hidden dark:block absolute inset-0 overflow-hidden pointer-events-none">
        <motion.div
          className="absolute top-[-250px] left-[-250px] w-[700px] h-[700px] rounded-full bg-emerald-900 opacity-40"
          animate={{ scale: [1, 1.3, 1], x: [0, 120, 0], y: [0, -80, 0] }}
          transition={{ duration: 25, repeat: Infinity, repeatType: "mirror" }}
        />
        <motion.div
          className="absolute bottom-[-300px] right-[-300px] w-[800px] h-[800px] rounded-full bg-teal-950 opacity-30"
          animate={{ scale: [1, 1.25, 1], x: [0, -100, 0], y: [0, 100, 0] }}
          transition={{ duration: 30, repeat: Infinity, repeatType: "mirror" }}
        />
      </div>

      {/* Floating demo cards */}
      <div className="relative h-52 w-full max-w-sm mb-10">
        {DEMO_CARDS.map((card, i) => (
          <motion.div
            key={i}
            className="absolute w-16 h-24 rounded-2xl shadow-xl border-2 border-gray-200 dark:border-white/20 bg-white flex items-center justify-center"
            style={{
              left: "50%",
              top: "50%",
              marginLeft: card.x - 32,
              marginTop: card.y - 48,
              rotate: card.rotate,
              zIndex: i,
            }}
            animate={{ y: [0, -10, 0] }}
            transition={{ duration: 3, delay: i * 0.4, repeat: Infinity, ease: "easeInOut" }}
          >
            <div style={{ color: card.color }} className="text-center">
              <div className="font-black text-xl leading-none">{card.rank}</div>
              <div className="text-2xl">{card.suit}</div>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Hero text */}
      <motion.h1
        className="text-5xl md:text-7xl font-bold tracking-tight max-w-4xl text-black dark:text-white drop-shadow-lg relative z-10"
        initial={{ opacity: 0, y: 40 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.7 }}
      >
        Play Poker Online
        <span className="block text-emerald-600 dark:text-emerald-400 mt-2">
          With Anyone, Anywhere
        </span>
      </motion.h1>

      <motion.p
        className="mt-5 text-gray-600 dark:text-emerald-200 text-lg max-w-xl relative z-10"
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2, duration: 0.7 }}
      >
        Real-time multiplayer Texas Hold&apos;em with global matchmaking, AI bots, and instant room sharing. No downloads required.
      </motion.p>

      {/* CTAs */}
      <motion.div
        className="mt-8 flex flex-wrap gap-4 justify-center relative z-10"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4, duration: 0.7 }}
      >
        {isSignedIn ? (
          <Button
            size="lg"
            className="text-lg px-10 py-6 bg-emerald-600 hover:bg-emerald-500 dark:bg-emerald-700 dark:hover:bg-emerald-600 text-white shadow-lg"
            onClick={() => router.push("/lobby")}
          >
            Enter Lobby →
          </Button>
        ) : (
          <>
            <SignInButton mode="modal" forceRedirectUrl="/lobby">
              <Button size="lg" className="text-lg px-10 py-6 bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg">
                Sign In to Play
              </Button>
            </SignInButton>
            <Link href="/sign-up">
              <Button variant="outline" size="lg"
                className="text-lg px-10 py-6 border-emerald-500 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-900/30">
                Create Account
              </Button>
            </Link>
          </>
        )}
      </motion.div>

      {/* Feature cards */}
      <motion.div
        className="grid md:grid-cols-3 gap-6 mt-20 max-w-5xl w-full relative z-10"
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true }}
        variants={{ hidden: {}, visible: { transition: { staggerChildren: 0.2 } } }}
      >
        {FEATURES.map((feature, index) => (
          <motion.div
            key={index}
            className="p-6 rounded-2xl border border-emerald-200 dark:border-emerald-800 bg-white/70 dark:bg-emerald-950/50 shadow-lg backdrop-blur-sm text-left"
            variants={{ hidden: { opacity: 0, y: 40 }, visible: { opacity: 1, y: 0 } }}
            transition={{ duration: 0.7 }}
          >
            <div className="text-4xl mb-3">{feature.icon}</div>
            <h3 className="text-lg font-semibold mb-2 text-emerald-700 dark:text-emerald-300">{feature.title}</h3>
            <p className="text-sm text-gray-600 dark:text-emerald-200">{feature.description}</p>
          </motion.div>
        ))}
      </motion.div>

      {/* Footer CTA */}
      <motion.div className="mt-20 mb-12 relative z-10" initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} transition={{ duration: 0.8 }}>
        <h2 className="text-3xl font-bold mb-4 text-black dark:text-white">Ready to Play?</h2>
        <Link href={isSignedIn ? "/lobby" : "/sign-up"}>
          <Button size="lg" className="bg-emerald-600 hover:bg-emerald-500 text-white px-12 py-6 text-lg shadow-xl">
            Start a Game →
          </Button>
        </Link>
      </motion.div>
    </main>
  );
}
