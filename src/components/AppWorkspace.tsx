"use client";

import React, { useEffect, useState } from "react";
import { NavSection, useAutopilot } from "@/context/AutopilotContext";
import { detectGlobalConflicts } from "@/domain/engine";
import { CommandCenterView } from "./CommandCenterView";
import { TimelineView } from "./TimelineView";
import { SmartBookingView } from "./SmartBookingView";
import { ShockwaveView } from "./ShockwaveView";
import { InventoryView } from "./InventoryView";
import { ImpactView } from "./ImpactView";
import { AuditLogView } from "./AuditLogView";
import { InspectorDrawer } from "./InspectorDrawer";
import {
  LayoutDashboard,
  CalendarRange,
  CalendarPlus,
  Zap,
  Boxes,
  BarChart3,
  ScrollText,
  RotateCcw,
  Radio,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Info,
  X,
  Play,
  ArrowRight,
  Palette,
} from "lucide-react";

export type CampusThemeId =
  | "stratos"
  | "crimson"
  | "violet"
  | "gold"
  | "emerald";

const THEMES: Array<{
  id: CampusThemeId;
  name: string;
  shortLabel: string;
  swatchBg: string;
  swatchRing: string;
}> = [
  {
    id: "crimson",
    name: "Crimson & Black",
    shortLabel: "Red/Black",
    swatchBg: "bg-[#e11d48]",
    swatchRing: "ring-[#ff3860]",
  },
  {
    id: "stratos",
    name: "Stratos Teal",
    shortLabel: "Teal",
    swatchBg: "bg-[#14b8a6]",
    swatchRing: "ring-[#2dd4bf]",
  },
  {
    id: "violet",
    name: "Quantum Violet",
    shortLabel: "Violet",
    swatchBg: "bg-[#8b5cf6]",
    swatchRing: "ring-[#a78bfa]",
  },
  {
    id: "gold",
    name: "Solaris Gold",
    shortLabel: "Gold",
    swatchBg: "bg-[#f59e0b]",
    swatchRing: "ring-[#fbbf24]",
  },
  {
    id: "emerald",
    name: "Bio-Matrix",
    shortLabel: "Emerald",
    swatchBg: "bg-[#10b981]",
    swatchRing: "ring-[#34d399]",
  },
];

const THEME_STORAGE_KEY = "campus_autopilot_theme_v1";

const NAV_ITEMS: Array<{
  id: NavSection;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  highlight?: boolean;
}> = [
  { id: "COMMAND_CENTER", label: "Mission Control", icon: LayoutDashboard },
  { id: "TIMELINE", label: "Timeline", icon: CalendarRange },
  { id: "SMART_BOOKING", label: "Smart Booking", icon: CalendarPlus },
  {
    id: "SHOCKWAVE",
    label: "Shockwave Engine",
    icon: Zap,
    highlight: true,
  },
  { id: "INVENTORY", label: "Inventory", icon: Boxes },
  { id: "IMPACT", label: "Impact", icon: BarChart3 },
  { id: "AUDIT_LOG", label: "Audit", icon: ScrollText },
];

export function AppWorkspace() {
  const {
    state,
    activeSection,
    setActiveSection,
    activeSimulation,
    latestApproval,
    startGuidedEndToEndDemo,
    launchInstantShockwaveDemo,
    resetDemoScenario,
    toasts,
    dismissToast,
  } = useAutopilot();

  const [activeTheme, setActiveTheme] = useState<CampusThemeId>("crimson");

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(
        THEME_STORAGE_KEY
      ) as CampusThemeId | null;
      if (saved && THEMES.some((t) => t.id === saved)) {
        setActiveTheme(saved);
        document.documentElement.setAttribute("data-theme", saved);
      } else {
        document.documentElement.setAttribute("data-theme", "crimson");
      }
    } catch {
      document.documentElement.setAttribute("data-theme", "crimson");
    }
  }, []);

  const handleSelectTheme = (themeId: CampusThemeId) => {
    setActiveTheme(themeId);
    document.documentElement.setAttribute("data-theme", themeId);
    try {
      window.localStorage.setItem(THEME_STORAGE_KEY, themeId);
    } catch {
      // ignore storage errors
    }
  };

  const conflicts = detectGlobalConflicts(state);
  const roboticsBooking = state.bookings.find(
    (b) => b.eventId === "evt-robotics-workshop" && b.status !== "CANCELLED"
  );

  const demoStep = latestApproval
    ? 3
    : activeSimulation
    ? 2
    : roboticsBooking
    ? 1
    : 0;

  return (
    <div className="min-h-screen flex flex-col text-slate-100">
      {/* Top Precision Instrumentation Header */}
      <header className="sticky top-0 z-30 border-b border-canvas-border bg-canvas/85 backdrop-blur-xl">
        <div className="max-w-[1440px] mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-3">
          {/* Brand Identity */}
          <button
            onClick={() => setActiveSection("COMMAND_CENTER")}
            className="flex items-center gap-3 text-left group shrink-0"
          >
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-accent-cyan/25 to-accent-cyan/5 border border-accent-cyan/50 flex items-center justify-center text-accent-cyanBright group-hover:bg-accent-cyan group-hover:text-slate-950 transition-all shadow-sm">
              <Zap className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold tracking-wider text-sm text-slate-100">
                  CAMPUS AUTOPILOT
                </span>
                <span className="hidden sm:inline-block font-mono text-[10px] px-2 py-0.5 rounded-full bg-accent-cyan/10 border border-accent-cyan/30 text-accent-cyanBright font-semibold">
                  STRATOS
                </span>
              </div>
              <div className="text-[11px] text-slate-400 hidden sm:block">
                Resource Orchestration & Shockwave Recovery
              </div>
            </div>
          </button>

          {/* Center Interactive 3-Step Presentation Flow Pill (Desktop) */}
          <div className="hidden xl:flex items-center gap-1.5 px-2.5 py-1.5 rounded-full bg-canvas-elevated/90 border border-canvas-border text-xs">
            <button
              onClick={startGuidedEndToEndDemo}
              className={`px-2.5 py-1 rounded-full flex items-center gap-1.5 transition-all ${
                demoStep === 0
                  ? "bg-accent-cyan/20 text-accent-cyanBright font-semibold border border-accent-cyan/40"
                  : "text-emerald-400 hover:bg-canvas-surface"
              }`}
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>1. Book Plan</span>
            </button>
            <ArrowRight className="w-3 h-3 text-slate-600" />
            <button
              onClick={launchInstantShockwaveDemo}
              className={`px-2.5 py-1 rounded-full flex items-center gap-1.5 transition-all ${
                demoStep === 2
                  ? "bg-amber-500/20 text-amber-300 font-semibold border border-amber-500/40"
                  : "text-slate-300 hover:text-amber-300 hover:bg-canvas-surface"
              }`}
            >
              <Zap className="w-3.5 h-3.5 text-amber-400" />
              <span>2. Trigger Outage</span>
            </button>
            <ArrowRight className="w-3 h-3 text-slate-600" />
            <button
              onClick={() => setActiveSection("SHOCKWAVE")}
              className={`px-2.5 py-1 rounded-full flex items-center gap-1.5 transition-all ${
                demoStep === 3
                  ? "bg-emerald-500/20 text-emerald-300 font-semibold border border-emerald-500/40"
                  : "text-slate-400 hover:text-slate-200 hover:bg-canvas-surface"
              }`}
            >
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
              <span>3. Atomic Recovery</span>
            </button>
          </div>

          {/* Right: 5-Theme Switcher + Status + Quick Demo Controls */}
          <div className="flex items-center gap-2">
            {/* 5-Theme Selector Bar */}
            <div
              role="group"
              aria-label="Select Interface Theme"
              className="flex items-center gap-1 px-2 py-1 rounded-full bg-canvas-elevated border border-canvas-border"
            >
              <Palette className="w-3.5 h-3.5 text-accent-cyanBright mr-0.5 hidden sm:inline" />
              {THEMES.map((t) => {
                const isSelected = activeTheme === t.id;
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => handleSelectTheme(t.id)}
                    title={`Theme: ${t.name}`}
                    className={`flex items-center gap-1.5 px-2 py-1 rounded-full text-[11px] font-medium transition-all ${
                      isSelected
                        ? "bg-canvas-surface text-slate-100 border border-accent-cyan/50 shadow-sm"
                        : "text-slate-400 hover:text-slate-200"
                    }`}
                  >
                    <span
                      className={`w-2.5 h-2.5 rounded-full ${t.swatchBg} ${
                        isSelected ? `ring-2 ${t.swatchRing}` : ""
                      }`}
                    />
                    <span className="hidden md:inline">{t.shortLabel}</span>
                  </button>
                );
              })}
            </div>

            <div className="hidden lg:flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-canvas-elevated border border-canvas-border text-[11px] font-mono text-slate-300">
              <Radio className="w-3 h-3 text-emerald-400 animate-pulse" />
              <span>v{state.stateVersion}</span>
            </div>

            <button
              onClick={launchInstantShockwaveDemo}
              className="px-3.5 py-1.5 rounded-lg bg-accent-cyan hover:bg-accent-cyanBright text-slate-950 font-bold text-xs flex items-center gap-1.5 shadow-md shadow-accent-cyan/15 transition-all"
            >
              <Play className="w-3.5 h-3.5 fill-current" />
              <span className="hidden sm:inline">Run Shockwave</span>
            </button>

            <button
              onClick={resetDemoScenario}
              className="p-2 sm:px-2.5 sm:py-1.5 rounded-lg bg-canvas-surface hover:bg-canvas-hover border border-canvas-border text-slate-300 text-xs flex items-center gap-1.5 transition-colors"
              title="Reset Demo to Baseline"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Reset</span>
            </button>
          </div>
        </div>

        {/* Secondary Navigation Bar */}
        <nav
          aria-label="Primary Operational Navigation"
          className="border-t border-canvas-border/60 bg-canvas-elevated/60 overflow-x-auto"
        >
          <div className="max-w-[1440px] mx-auto px-4 sm:px-6 flex items-center gap-1.5 py-1.5">
            {NAV_ITEMS.map((item) => {
              const Icon = item.icon;
              const isActive = activeSection === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => setActiveSection(item.id)}
                  className={`px-3.5 py-1.5 rounded-lg text-xs font-medium flex items-center gap-2 whitespace-nowrap transition-all ${
                    isActive
                      ? item.highlight
                        ? "bg-accent-cyan text-slate-950 font-bold shadow-sm"
                        : "bg-canvas-surface text-accent-cyanBright border border-accent-cyan/40 font-semibold shadow-sm"
                      : item.highlight
                      ? "text-amber-300 hover:bg-amber-500/10 border border-amber-500/20"
                      : "text-slate-400 hover:text-slate-100 hover:bg-canvas-surface/60"
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  <span>{item.label}</span>
                  {item.id === "SHOCKWAVE" && conflicts.length > 0 && (
                    <span className="px-1.5 py-0.2 rounded-full bg-red-500 text-white font-mono text-[10px] font-bold">
                      {conflicts.length}
                    </span>
                  )}
                  {item.id === "AUDIT_LOG" && (
                    <span className="font-mono text-[10px] px-1.5 rounded bg-canvas-elevated text-slate-400">
                      {state.auditLog.length}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </nav>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 max-w-[1440px] w-full mx-auto px-4 sm:px-6 py-6">
        {activeSection === "COMMAND_CENTER" && <CommandCenterView />}
        {activeSection === "TIMELINE" && <TimelineView />}
        {activeSection === "SMART_BOOKING" && <SmartBookingView />}
        {activeSection === "SHOCKWAVE" && <ShockwaveView />}
        {activeSection === "INVENTORY" && <InventoryView />}
        {activeSection === "IMPACT" && <ImpactView />}
        {activeSection === "AUDIT_LOG" && <AuditLogView />}
      </main>

      {/* Compact Footer */}
      <footer className="border-t border-canvas-border/60 bg-canvas-elevated/60 py-3 px-4 sm:px-6 text-xs text-slate-500">
        <div className="max-w-[1440px] mx-auto flex flex-col sm:flex-row items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <strong className="text-slate-300">CAMPUS AUTOPILOT</strong>
            <span>•</span>
            <span>
              Team <strong className="text-accent-cyanBright">STRATOS</strong>{" "}
              (METSAC HackSAC 2026)
            </span>
          </div>
          <div className="font-mono text-[11px] text-slate-400">
            5 Live Themes ({THEMES.find((t) => t.id === activeTheme)?.name}) •
            State v{state.stateVersion}
          </div>
        </div>
      </footer>

      {/* Contextual Side Inspector Drawer */}
      <InspectorDrawer />

      {/* Toast Notification Stack */}
      {toasts.length > 0 && (
        <div
          aria-live="polite"
          className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 max-w-sm w-full pointer-events-none"
        >
          {toasts.map((t) => (
            <div
              key={t.id}
              className={`pointer-events-auto p-3.5 rounded-xl border shadow-2xl backdrop-blur-md flex items-start justify-between gap-3 ${
                t.type === "SUCCESS"
                  ? "bg-emerald-950/95 border-emerald-500/50 text-emerald-100"
                  : t.type === "WARNING"
                  ? "bg-amber-950/95 border-amber-500/50 text-amber-100"
                  : t.type === "ERROR"
                  ? "bg-red-950/95 border-red-500/50 text-red-100"
                  : "bg-canvas-elevated/95 border-accent-cyan/50 text-slate-100"
              }`}
            >
              <div className="flex items-start gap-2.5">
                {t.type === "SUCCESS" && (
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                )}
                {t.type === "WARNING" && (
                  <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                )}
                {t.type === "ERROR" && (
                  <XCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                )}
                {t.type === "INFO" && (
                  <Info className="w-4 h-4 text-accent-cyanBright shrink-0 mt-0.5" />
                )}
                <div>
                  <div className="text-xs font-bold">{t.title}</div>
                  <div className="text-[11px] opacity-90 mt-0.5 leading-snug">
                    {t.detail}
                  </div>
                </div>
              </div>
              <button
                onClick={() => dismissToast(t.id)}
                className="text-slate-400 hover:text-slate-100"
                aria-label="Dismiss notification"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
