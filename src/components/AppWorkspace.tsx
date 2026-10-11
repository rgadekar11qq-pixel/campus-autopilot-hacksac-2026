"use client";

import React from "react";
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
} from "lucide-react";

const NAV_ITEMS: Array<{
  id: NavSection;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  highlight?: boolean;
}> = [
  { id: "COMMAND_CENTER", label: "Command Center", icon: LayoutDashboard },
  { id: "TIMELINE", label: "Campus Timeline", icon: CalendarRange },
  { id: "SMART_BOOKING", label: "Smart Booking", icon: CalendarPlus },
  {
    id: "SHOCKWAVE",
    label: "Campus Shockwave",
    icon: Zap,
    highlight: true,
  },
  { id: "INVENTORY", label: "Resource Inventory", icon: Boxes },
  { id: "IMPACT", label: "Impact & Utilization", icon: BarChart3 },
  { id: "AUDIT_LOG", label: "Audit Log", icon: ScrollText },
];

export function AppWorkspace() {
  const {
    state,
    activeSection,
    setActiveSection,
    launchInstantShockwaveDemo,
    resetDemoScenario,
    toasts,
    dismissToast,
  } = useAutopilot();

  const conflicts = detectGlobalConflicts(state);

  return (
    <div className="min-h-screen flex flex-col bg-canvas text-slate-100">
      {/* Top Precision Instrumentation Header */}
      <header className="sticky top-0 z-30 border-b border-canvas-border bg-canvas/95 backdrop-blur-md">
        <div className="max-w-[1440px] mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
          {/* Brand Identity */}
          <div className="flex items-center gap-3">
            <button
              onClick={() => setActiveSection("COMMAND_CENTER")}
              className="flex items-center gap-2.5 text-left group"
            >
              <div className="w-9 h-9 rounded-lg bg-accent-cyan/15 border border-accent-cyan/40 flex items-center justify-center text-accent-cyanBright group-hover:bg-accent-cyan group-hover:text-slate-950 transition-colors">
                <Zap className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-bold tracking-wider text-sm text-slate-100">
                    CAMPUS AUTOPILOT
                  </span>
                  <span className="hidden sm:inline-block font-mono text-[10px] px-1.5 py-0.5 rounded bg-canvas-surface border border-canvas-border text-accent-cyanBright">
                    STRATOS • HACKSAC 2026
                  </span>
                </div>
                <div className="text-[11px] text-slate-400 hidden sm:block">
                  Deterministic Operations & Shockwave Reconfiguration Engine
                </div>
              </div>
            </button>
          </div>

          {/* Right Operational Status & Quick Demo Controls */}
          <div className="flex items-center gap-2.5">
            <div className="hidden md:flex items-center gap-2 px-2.5 py-1 rounded-md bg-canvas-elevated border border-canvas-border text-[11px] font-mono text-slate-300">
              <Radio className="w-3.5 h-3.5 text-emerald-400 animate-pulse" />
              <span>SIMULATED DATA • STATE v{state.stateVersion}</span>
            </div>

            <button
              onClick={launchInstantShockwaveDemo}
              className="px-3 py-1.5 rounded-lg bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/40 text-amber-300 font-semibold text-xs flex items-center gap-1.5 transition-colors"
            >
              <Zap className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Live Demo:</span> Shockwave
            </button>

            <button
              onClick={resetDemoScenario}
              className="px-2.5 py-1.5 rounded-lg bg-canvas-surface hover:bg-canvas-hover border border-canvas-border text-slate-300 text-xs flex items-center gap-1.5 transition-colors"
              title="Reset Robotics Workshop Demo to Baseline"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Reset Demo</span>
            </button>
          </div>
        </div>

        {/* Secondary Navigation Bar */}
        <nav
          aria-label="Primary Operational Navigation"
          className="border-t border-canvas-border/70 bg-canvas-elevated/80 overflow-x-auto"
        >
          <div className="max-w-[1440px] mx-auto px-4 sm:px-6 flex items-center gap-1 py-1.5">
            {NAV_ITEMS.map((item) => {
              const Icon = item.icon;
              const isActive = activeSection === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => setActiveSection(item.id)}
                  className={`px-3 py-2 rounded-lg text-xs font-medium flex items-center gap-2 whitespace-nowrap transition-all ${
                    isActive
                      ? item.highlight
                        ? "bg-accent-cyan text-slate-950 font-bold shadow-sm"
                        : "bg-canvas-surface text-accent-cyanBright border border-accent-cyan/40 font-semibold"
                      : item.highlight
                      ? "text-amber-300 hover:bg-amber-500/10 border border-transparent"
                      : "text-slate-400 hover:text-slate-200 hover:bg-canvas-surface/60"
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
                    <span className="font-mono text-[10px] opacity-75">
                      ({state.auditLog.length})
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

      {/* Footer */}
      <footer className="border-t border-canvas-border bg-canvas-elevated py-4 px-4 sm:px-6 text-xs text-slate-500">
        <div className="max-w-[1440px] mx-auto flex flex-col sm:flex-row items-center justify-between gap-2">
          <div>
            <strong className="text-slate-300">CAMPUS AUTOPILOT</strong> • Built
            by Team <strong className="text-accent-cyanBright">STRATOS</strong>{" "}
            for METSAC HackSAC 2026
          </div>
          <div className="font-mono text-[11px]">
            Simulated Campus Dataset • Local Authoritative State Persistence (v
            {state.stateVersion})
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
