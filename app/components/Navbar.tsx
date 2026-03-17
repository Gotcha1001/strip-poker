"use client";

import { SignedIn, SignedOut, UserButton } from "@clerk/nextjs";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { motion } from "framer-motion";
import { useUserContext } from "../context/UserContext";
import { ThemeToggle } from "./ThemeToggle";
import { SidebarTrigger } from "@/components/ui/sidebar";

export default function Navbar() {
  const user = useUserContext();

  return (
    <motion.nav
      className="flex items-center justify-between px-6 py-4 border-b bg-white dark:bg-gradient-to-r dark:from-emerald-900 dark:via-emerald-950 dark:to-teal-950 border-gray-200 dark:border-emerald-800 shadow-sm dark:shadow-emerald-900/50"
      initial={{ y: -40, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.4 }}
    >
      <SidebarTrigger className="md:hidden mr-2" />
      <Link href="/" className="text-xl font-bold text-black dark:text-white tracking-tight">
        ♠ Poker Arena
      </Link>

      <div className="flex items-center gap-3">
        <SignedOut>
          <Link href="/sign-in">
            <Button variant="ghost" className="text-gray-700 dark:text-emerald-200 hover:text-emerald-600 dark:hover:text-emerald-300">
              Sign In
            </Button>
          </Link>
          <Link href="/sign-up">
            <Button className="bg-emerald-600 dark:bg-emerald-700 text-white hover:bg-emerald-500 dark:hover:bg-emerald-600">
              Sign Up
            </Button>
          </Link>
        </SignedOut>
        <SignedIn>
          <Link href="/lobby">
            <Button variant="ghost" className="text-gray-700 dark:text-emerald-200 hover:text-emerald-600 dark:hover:text-emerald-300">
              Lobby
            </Button>
          </Link>
          <Link href="/dashboard">
            <Button variant="ghost" className="text-gray-700 dark:text-emerald-200 hover:text-emerald-600 dark:hover:text-emerald-300">
              Dashboard
            </Button>
          </Link>
          {user?.role === "admin" && (
            <Link href="/admin">
              <Button variant="ghost" className="text-gray-700 dark:text-emerald-200 hover:text-emerald-600 dark:hover:text-emerald-300">
                Admin
              </Button>
            </Link>
          )}
          <ThemeToggle />
          <UserButton afterSignOutUrl="/" />
        </SignedIn>
      </div>
    </motion.nav>
  );
}
