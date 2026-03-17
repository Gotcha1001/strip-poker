"use client";

import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

// Card string format: "AS" = Ace of Spades, "KH" = King of Hearts, etc.
// Ranks: 2-9, T, J, Q, K, A
// Suits: S (♠), H (♥), D (♦), C (♣)

const SUIT_SYMBOL: Record<string, string> = {
  S: "♠",
  H: "♥",
  D: "♦",
  C: "♣",
};

const RANK_DISPLAY: Record<string, string> = {
  T: "10",
  J: "J",
  Q: "Q",
  K: "K",
  A: "A",
};

function getRankDisplay(rank: string): string {
  return RANK_DISPLAY[rank] ?? rank;
}

function isRedSuit(suit: string): boolean {
  return suit === "H" || suit === "D";
}

export function parseCardString(card: string): { rank: string; suit: string } {
  return { rank: card.slice(0, -1), suit: card.slice(-1) };
}

interface PokerCardProps {
  card?: string; // e.g. "AS", "KH" — undefined = face-down
  size?: "sm" | "md" | "lg" | "xl";
  isPlayable?: boolean;
  isSelected?: boolean;
  onClick?: () => void;
  className?: string;
  index?: number;
  faceDown?: boolean;
}

const SIZE_CLASSES = {
  sm: {
    outer: "w-10 h-[3.6rem]",
    corner: "text-[0.52rem]",
    suit: "text-[0.6rem]",
    center: "text-[0.9rem]",
    radius: "rounded-xl",
    padding: "p-[3px]",
  },
  md: {
    outer: "w-14 h-20",
    corner: "text-[0.65rem]",
    suit: "text-[0.75rem]",
    center: "text-[1.1rem]",
    radius: "rounded-2xl",
    padding: "p-1",
  },
  lg: {
    outer: "w-16 h-[5.5rem]",
    corner: "text-[0.75rem]",
    suit: "text-[0.85rem]",
    center: "text-[1.3rem]",
    radius: "rounded-2xl",
    padding: "p-1",
  },
  xl: {
    outer: "w-[4.8rem] h-[6.8rem]",
    corner: "text-[0.85rem]",
    suit: "text-[1rem]",
    center: "text-[1.6rem]",
    radius: "rounded-2xl",
    padding: "p-[5px]",
  },
};

export function PokerCard({
  card,
  size = "md",
  isPlayable = false,
  isSelected = false,
  onClick,
  className,
  index = 0,
  faceDown = false,
}: PokerCardProps) {
  const s = SIZE_CLASSES[size];
  const faceDownCard = faceDown || !card;

  if (faceDownCard) {
    return (
      <motion.div
        className={cn(
          "relative select-none flex-shrink-0",
          s.outer,
          s.radius,
          className
        )}
        style={{ boxShadow: "0 4px 14px rgba(0,0,0,0.5)" }}
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: index * 0.04, type: "spring", stiffness: 300, damping: 22 }}
      >
        <div
          className={cn("absolute inset-0 overflow-hidden", s.radius)}
          style={{
            background:
              "radial-gradient(ellipse at 38% 32%, #1e3a7b 0%, #0d1f5c 40%, #07113a 70%, #030a22 100%)",
          }}
        >
          {/* Card back diamond pattern */}
          <div
            className="absolute inset-[4px] rounded-lg"
            style={{
              border: "1px solid rgba(100,130,220,0.3)",
              background:
                "repeating-linear-gradient(45deg, transparent, transparent 4px, rgba(80,110,200,0.08) 4px, rgba(80,110,200,0.08) 8px)",
            }}
          />
          <div className="absolute inset-0 flex items-center justify-center">
            <span
              className="font-black text-white/20 tracking-[0.15em]"
              style={{ fontSize: size === "sm" ? "0.45rem" : "0.6rem" }}
            >
              POKER
            </span>
          </div>
        </div>
      </motion.div>
    );
  }

  const { rank, suit } = parseCardString(card!);
  const isRed = isRedSuit(suit);
  const rankDisplay = getRankDisplay(rank);
  const suitSymbol = SUIT_SYMBOL[suit] ?? suit;
  const textColor = isRed ? "#c0392b" : "#111827";

  return (
    <motion.div
      className={cn(
        "relative select-none flex-shrink-0",
        s.outer,
        s.radius,
        isPlayable ? "cursor-pointer" : "cursor-default",
        className
      )}
      style={{
        boxShadow: isSelected
          ? `0 0 0 3px white, 0 0 0 5px ${isRed ? "#ef4444" : "#1f2937"}, 0 0 32px ${isRed ? "rgba(239,68,68,0.6)" : "rgba(0,0,0,0.4)"}, 0 12px 28px rgba(0,0,0,0.55)`
          : isPlayable
          ? "0 0 0 2px rgba(245,158,11,0.8), 0 0 18px rgba(245,158,11,0.5), 0 6px 16px rgba(0,0,0,0.4)"
          : "0 4px 14px rgba(0,0,0,0.4), 0 1px 4px rgba(0,0,0,0.2)",
      }}
      initial={{ opacity: 0, y: -12, rotateY: -20 }}
      animate={{ opacity: 1, y: 0, rotateY: 0 }}
      transition={{ delay: index * 0.04, type: "spring", stiffness: 300, damping: 22 }}
      whileHover={isPlayable ? { y: -14, scale: 1.1, rotateZ: -1 } : undefined}
      whileTap={isPlayable ? { scale: 0.93 } : undefined}
      onClick={isPlayable ? onClick : undefined}
    >
      <div
        className={cn("absolute inset-0 overflow-hidden", s.radius)}
        style={{
          background: "linear-gradient(160deg, #ffffff 0%, #f3f4f6 100%)",
        }}
      >
        {/* Subtle inner border */}
        <div
          className={cn("absolute inset-[2px] pointer-events-none", s.radius)}
          style={{ border: "0.5px solid rgba(0,0,0,0.07)" }}
        />
        {/* Top-left corner */}
        <div
          className={`absolute top-[3px] left-[4px] leading-tight`}
          style={{ color: textColor }}
        >
          <div className={cn("font-black leading-none", s.corner)}>{rankDisplay}</div>
          <div className={cn("leading-none", s.suit)}>{suitSymbol}</div>
        </div>
        {/* Center suit */}
        <div
          className="absolute inset-0 flex items-center justify-center"
          style={{ color: textColor }}
        >
          <span className={cn("font-black", s.center)}>{suitSymbol}</span>
        </div>
        {/* Bottom-right corner (rotated) */}
        <div
          className={`absolute bottom-[3px] right-[4px] leading-tight rotate-180`}
          style={{ color: textColor }}
        >
          <div className={cn("font-black leading-none", s.corner)}>{rankDisplay}</div>
          <div className={cn("leading-none", s.suit)}>{suitSymbol}</div>
        </div>
        {/* Playable glow overlay */}
        {isPlayable && (
          <motion.div
            className={cn("absolute inset-0 pointer-events-none", s.radius)}
            animate={{ opacity: [0, 0.4, 0] }}
            transition={{ duration: 1.8, repeat: Infinity, ease: "easeInOut" }}
            style={{
              background:
                "radial-gradient(ellipse at 50% 50%, rgba(245,158,11,0.35) 0%, transparent 70%)",
            }}
          />
        )}
      </div>
    </motion.div>
  );
}

// Convenience: render multiple community cards with placeholders
export function CommunityCards({
  cards,
  total = 5,
}: {
  cards: string[];
  total?: number;
}) {
  return (
    <div className="flex items-center gap-2 flex-wrap justify-center">
      {Array.from({ length: total }).map((_, i) => (
        <PokerCard
          key={i}
          card={cards[i]}
          faceDown={!cards[i]}
          size="lg"
          index={i}
          className={cn(!cards[i] && "opacity-30")}
        />
      ))}
    </div>
  );
}
