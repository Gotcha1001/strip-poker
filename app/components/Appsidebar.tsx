"use client";

import * as React from "react";
import {
  Home,
  Users,
  Play,
  Trophy,
  History,
  Gamepad2,
  Settings,
  MonitorSpeaker,
  BookOpen,
} from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarHeader,
  SidebarFooter,
  useSidebar,
} from "@/components/ui/sidebar";
import { Badge } from "@/components/ui/badge";
import { UserButton } from "@clerk/nextjs";
import { motion } from "framer-motion";

const NAV_ITEMS = [
  { label: "Dashboard", path: "/dashboard", icon: Home },
  { label: "Lobby", path: "/lobby", icon: Users },
  { label: "Play vs Bot", path: "/play", icon: Gamepad2 },
  { label: "Play Locally", path: "/local", icon: MonitorSpeaker, badge: "🏠" },
  { label: "Game History", path: "/history", icon: History },
  { label: "Leaderboard", path: "/leaderboard", icon: Trophy, badge: "🔥" },
  { label: "How to Play", path: "/rules",        icon: BookOpen,       badge: "📖" },
  { label: "Settings", path: "/settings", icon: Settings },
];

export function AppSidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { setOpenMobile } = useSidebar();

  const handleNav = (path: string) => {
    router.push(path);
    setOpenMobile(false);
  };

  return (
    <Sidebar className="relative w-64 bg-white dark:bg-emerald-950">
      {/* Animated dark background (dark mode only) */}
      <div className="hidden dark:block absolute inset-0 z-0 overflow-hidden">
        <motion.div
          className="absolute top-[-200px] left-[-200px] w-[600px] h-[600px] rounded-full bg-emerald-900 opacity-60"
          animate={{ scale: [1, 1.3, 1], x: [0, 50, 0], y: [0, -50, 0] }}
          transition={{ duration: 20, repeat: Infinity, repeatType: "mirror" }}
        />
        <motion.div
          className="absolute bottom-[-250px] right-[-250px] w-[700px] h-[700px] rounded-full bg-teal-950 opacity-50"
          animate={{ scale: [1, 1.25, 1], x: [0, -50, 0], y: [0, 50, 0] }}
          transition={{ duration: 25, repeat: Infinity, repeatType: "mirror" }}
        />
      </div>

      {/* Header */}
      <SidebarHeader className="border-b border-gray-200 dark:border-emerald-800 p-4 relative z-10">
        <Link href="/" className="flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-600 dark:bg-emerald-700 shadow-lg">
            <Play className="h-5 w-5 text-white" />
          </div>
          <div className="flex flex-col">
            <span className="text-base font-bold leading-none tracking-tight text-black dark:text-white">
              Poker Arena
            </span>
            <span className="text-[10px] text-gray-500 dark:text-emerald-300 uppercase tracking-widest">
              Texas Hold&apos;em
            </span>
          </div>
        </Link>
      </SidebarHeader>

      {/* Navigation */}
      <SidebarContent className="relative z-10">
        <SidebarGroup>
          <SidebarGroupLabel className="text-gray-500 dark:text-emerald-300">
            Navigation
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {NAV_ITEMS.map(({ label, path, icon: Icon, badge }) => (
                <SidebarMenuItem key={path}>
                  <SidebarMenuButton
                    onClick={() => handleNav(path)}
                    isActive={pathname === path}
                    className="cursor-pointer text-gray-700 dark:text-emerald-200 hover:text-emerald-600 dark:hover:text-emerald-300 rounded-md"
                  >
                    <Icon className="h-4 w-4" />
                    <span className="flex-1">{label}</span>
                    {badge && (
                      <Badge
                        variant="secondary"
                        className="ml-auto text-[10px] px-1.5 py-0"
                      >
                        {badge}
                      </Badge>
                    )}
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      {/* Footer */}
      <SidebarFooter className="border-t border-gray-200 dark:border-emerald-800 p-4 relative z-10">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-gray-700 dark:text-emerald-200">
            My Account
          </span>
          <UserButton />
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
