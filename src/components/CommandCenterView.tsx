"use client";

import React from "react";
import { useAutopilot } from "@/context/AutopilotContext";
import { computeOperationalMetrics } from "@/domain/engine";
import { formatCurrency, formatTimeRange } from "@/lib/utils";
import {
  Zap,
  CalendarClock,
  Building2,
  Cpu,
  AlertTriangle,
  CheckCircle2,
  ArrowRight,
  PlusCircle,
  RotateCcw,
  Activity,
  ShieldAlert,
  Play,
  Sparkles,
  Users,
  Clock,
  UserCheck,
} from "lucide-react";

export function CommandCenterView() {
  const {
    state,
    selectedDate,
    setActiveSection,
    setInspectedRoomId,
    setInspectedEventId,
    setBookingPrefill,
    launchInstantShockwaveDemo,
    startGuidedEndToEndDemo,
    resetDemoScenario,
  } = useAutopilot();

  const metrics = computeOperationalMetrics(state, selectedDate);
  const {
    dayBookings,
    globalConflicts,
    occupiedRoomCount,
    operationalRoomCount,
    totalRoomCount,
    totalOperationalUnits,
    peakConcurrentUnitsOnDate,
    activeDayReusedValueInr,
  } = metrics;

  const roboticsBooking = state.bookings.find(
    (b) => b.eventId === "evt-robotics-workshop" && b.status !== "CANCELLED"
  );
  const roboticsRoom = state.rooms.find(
    (r) => r.id === roboticsBooking?.roomId
  );

  const roomUtilPct = Math.round(
    (operationalRoomCount / Math.max(1, totalRoomCount)) * 100
  );
  const equipUtilPct = Math.round(
    (peakConcurrentUnitsOnDate / Math.max(1, totalOperationalUnits)) * 100
  );

  return (
    <div className="space-y-6">
      {/* Presentation Hero Banner — Visual & Concise */}
      <div className="relative overflow-hidden rounded-2xl border border-accent-cyan/35 ops-card ops-glow-cyan p-6">
        <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-6">
          <div className="space-y-3">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-accent-cyan/15 border border-accent-cyan/30 text-accent-cyanBright text-[11px] font-mono font-semibold">
              <Sparkles className="w-3.5 h-3.5" />
              HACKSAC 2026 • LIVE ORCHESTRATION WORKSPACE
            </div>

            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-100">
              Find a feasible plan.{" "}
              <span className="text-accent-cyanBright">
                Recover instantly when it breaks.
              </span>
            </h1>

            {/* Visual Flagship Spec Chips (Replaces dense paragraph) */}
            <div className="flex flex-wrap items-center gap-2 pt-1">
              <span className="text-xs font-semibold text-slate-200 bg-canvas-surface/90 border border-canvas-border px-3 py-1.5 rounded-lg flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-accent-cyanBright animate-pulse" />
                Autonomous Robotics Workshop
              </span>
              <span className="text-xs font-mono text-slate-300 bg-canvas-surface/70 border border-canvas-border px-2.5 py-1.5 rounded-lg flex items-center gap-1.5">
                <Users className="w-3.5 h-3.5 text-accent-cyanBright" />
                80 Seats
              </span>
              <span className="text-xs font-mono text-slate-300 bg-canvas-surface/70 border border-canvas-border px-2.5 py-1.5 rounded-lg flex items-center gap-1.5">
                <Cpu className="w-3.5 h-3.5 text-amber-400" />
                8× ROS2 Kits + 4K Proj
              </span>
              <span className="text-xs font-mono text-slate-300 bg-canvas-surface/70 border border-canvas-border px-2.5 py-1.5 rounded-lg flex items-center gap-1.5">
                <UserCheck className="w-3.5 h-3.5 text-emerald-400" />2 Mentors
              </span>
              {roboticsBooking ? (
                <button
                  onClick={() => setInspectedEventId("evt-robotics-workshop")}
                  className="text-xs font-mono font-semibold text-emerald-300 bg-emerald-950/50 border border-emerald-500/40 px-3 py-1.5 rounded-lg flex items-center gap-1.5 hover:bg-emerald-950/80 transition-colors"
                >
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                  {roboticsRoom?.code ?? roboticsBooking.roomId} •{" "}
                  {formatTimeRange(
                    roboticsBooking.startIso,
                    roboticsBooking.endIso
                  )}
                </button>
              ) : (
                <span className="text-xs font-mono text-amber-300 bg-amber-950/40 border border-amber-500/40 px-3 py-1.5 rounded-lg">
                  Unbooked — Ready for Step 1
                </span>
              )}
            </div>
          </div>

          {/* Primary Presentation CTA Deck */}
          <div className="flex flex-wrap items-center gap-2.5 shrink-0">
            <button
              onClick={startGuidedEndToEndDemo}
              className="flex items-center gap-2 px-4 py-3 rounded-xl bg-canvas-surface hover:bg-canvas-hover text-slate-100 border border-canvas-borderStrong text-xs font-semibold transition-all"
            >
              <PlusCircle className="w-4 h-4 text-accent-cyanBright" />
              1. Book Workshop
            </button>
            <button
              onClick={launchInstantShockwaveDemo}
              className="flex items-center gap-2 px-5 py-3 rounded-xl bg-accent-cyan hover:bg-accent-cyanBright text-slate-950 text-xs font-bold shadow-lg shadow-accent-cyan/25 transition-all"
            >
              <Play className="w-4 h-4 fill-current" />
              2. Trigger Shockwave
            </button>
            <button
              onClick={resetDemoScenario}
              className="p-3 rounded-xl bg-canvas-surface hover:bg-canvas-hover text-slate-300 border border-canvas-border text-xs transition-colors"
              title="Reset Demo to Baseline"
            >
              <RotateCcw className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* 4 Visual Telemetry Cards with Mini Gauges */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Active Sessions */}
        <button
          onClick={() => setActiveSection("TIMELINE")}
          className="text-left p-4 rounded-xl ops-card border border-canvas-border hover:border-accent-cyan/50 transition-all group"
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] uppercase tracking-wider font-mono text-slate-400">
              Active Schedule
            </span>
            <div className="w-8 h-8 rounded-lg bg-accent-cyan/10 border border-accent-cyan/25 flex items-center justify-center text-accent-cyanBright group-hover:scale-110 transition-transform">
              <CalendarClock className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-3xl font-mono font-bold text-slate-100">
              {dayBookings.length}
            </span>
            <span className="text-xs text-slate-400">sessions today</span>
          </div>
          <div className="mt-3 h-1.5 w-full rounded-full bg-canvas-surface overflow-hidden">
            <div
              className="h-full bg-accent-cyan rounded-full"
              style={{ width: `${Math.min(100, dayBookings.length * 16)}%` }}
            />
          </div>
          <div className="mt-2.5 flex items-center justify-between text-[11px] font-medium text-accent-cyanBright">
            <span>{occupiedRoomCount} rooms active</span>
            <span className="flex items-center gap-1">
              Timeline <ArrowRight className="w-3 h-3" />
            </span>
          </div>
        </button>

        {/* Card 2: Campus Spaces */}
        <button
          onClick={() => setActiveSection("TIMELINE")}
          className="text-left p-4 rounded-xl ops-card border border-canvas-border hover:border-emerald-500/50 transition-all group"
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] uppercase tracking-wider font-mono text-slate-400">
              Campus Venues
            </span>
            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/25 flex items-center justify-center text-emerald-400 group-hover:scale-110 transition-transform">
              <Building2 className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-3xl font-mono font-bold text-slate-100">
              {operationalRoomCount}
              <span className="text-lg text-slate-500">/{totalRoomCount}</span>
            </span>
            <span className="text-xs text-slate-400">operational</span>
          </div>
          <div className="mt-3 h-1.5 w-full rounded-full bg-canvas-surface overflow-hidden">
            <div
              className="h-full bg-emerald-400 rounded-full"
              style={{ width: `${roomUtilPct}%` }}
            />
          </div>
          <div className="mt-2.5 flex items-center justify-between text-[11px] font-medium text-emerald-400">
            <span>15m / 30m buffers</span>
            <span className="flex items-center gap-1">
              Inspect <ArrowRight className="w-3 h-3" />
            </span>
          </div>
        </button>

        {/* Card 3: Equipment Pool & Reuse */}
        <button
          onClick={() => setActiveSection("INVENTORY")}
          className="text-left p-4 rounded-xl ops-card border border-canvas-border hover:border-amber-500/50 transition-all group"
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] uppercase tracking-wider font-mono text-slate-400">
              Asset Circulation
            </span>
            <div className="w-8 h-8 rounded-lg bg-amber-500/10 border border-amber-500/25 flex items-center justify-center text-amber-400 group-hover:scale-110 transition-transform">
              <Cpu className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-3xl font-mono font-bold text-slate-100">
              {formatCurrency(activeDayReusedValueInr)}
            </span>
            <span className="text-xs text-slate-400">reused</span>
          </div>
          <div className="mt-3 h-1.5 w-full rounded-full bg-canvas-surface overflow-hidden">
            <div
              className="h-full bg-amber-400 rounded-full"
              style={{ width: `${equipUtilPct}%` }}
            />
          </div>
          <div className="mt-2.5 flex items-center justify-between text-[11px] font-medium text-amber-300">
            <span>
              {peakConcurrentUnitsOnDate}/{totalOperationalUnits} peak units
            </span>
            <span className="flex items-center gap-1">
              Inventory <ArrowRight className="w-3 h-3" />
            </span>
          </div>
        </button>

        {/* Card 4: Constraint Monitor */}
        <button
          onClick={() => setActiveSection("SHOCKWAVE")}
          className={`text-left p-4 rounded-xl border transition-all group ${
            globalConflicts.length > 0
              ? "bg-red-950/30 border-red-500/50 hover:bg-red-950/40"
              : "ops-card border-canvas-border hover:border-accent-cyan/50"
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] uppercase tracking-wider font-mono text-slate-400">
              System Health
            </span>
            <div
              className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                globalConflicts.length > 0
                  ? "bg-red-500/20 text-red-400"
                  : "bg-emerald-500/15 text-emerald-400"
              }`}
            >
              {globalConflicts.length > 0 ? (
                <ShieldAlert className="w-4 h-4 animate-pulse" />
              ) : (
                <CheckCircle2 className="w-4 h-4" />
              )}
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span
              className={`text-3xl font-mono font-bold ${
                globalConflicts.length > 0 ? "text-red-400" : "text-emerald-400"
              }`}
            >
              {globalConflicts.length === 0
                ? "ALL CLEAR"
                : `${globalConflicts.length} ALERT`}
            </span>
          </div>
          <div className="mt-3 h-1.5 w-full rounded-full bg-canvas-surface overflow-hidden">
            <div
              className={`h-full rounded-full ${
                globalConflicts.length > 0 ? "bg-red-500" : "bg-emerald-400"
              }`}
              style={{ width: "100%" }}
            />
          </div>
          <div className="mt-2.5 flex items-center justify-between text-[11px] font-medium text-slate-300">
            <span>6 hard constraints active</span>
            <span className="flex items-center gap-1 text-accent-cyanBright">
              Shockwave <ArrowRight className="w-3 h-3" />
            </span>
          </div>
        </button>
      </div>

      {/* Main 3-Column Operational Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Column 1: Live Schedule (5 cols) */}
        <div className="lg:col-span-5 rounded-2xl ops-card border border-canvas-border flex flex-col">
          <div className="px-5 py-4 border-b border-canvas-border flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CalendarClock className="w-4 h-4 text-accent-cyanBright" />
              <h2 className="text-sm font-bold text-slate-100">
                Today&apos;s Schedule
              </h2>
              <span className="text-[11px] font-mono text-slate-400">
                {selectedDate}
              </span>
            </div>
            <button
              onClick={() => setActiveSection("SMART_BOOKING")}
              className="px-3 py-1 rounded-lg bg-accent-cyan/15 text-accent-cyanBright border border-accent-cyan/30 text-xs font-semibold hover:bg-accent-cyan/25 transition-colors"
            >
              + Book
            </button>
          </div>

          <div className="p-4 space-y-2.5 flex-1">
            {dayBookings.length === 0 ? (
              <div className="p-8 text-center text-xs text-slate-400">
                No sessions on {selectedDate}.
              </div>
            ) : (
              dayBookings.map((bkg) => {
                const ev = state.events.find((e) => e.id === bkg.eventId);
                const rm = state.rooms.find((r) => r.id === bkg.roomId);
                const hasConflict = globalConflicts.some(
                  (c) => c.bookingId === bkg.id
                );
                const capPct = Math.min(
                  100,
                  Math.round(
                    ((ev?.expectedAttendance ?? 0) /
                      Math.max(1, rm?.capacity ?? 100)) *
                      100
                  )
                );

                return (
                  <div
                    key={bkg.id}
                    onClick={() => setInspectedEventId(bkg.eventId)}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        setInspectedEventId(bkg.eventId);
                      }
                    }}
                    className={`p-3.5 rounded-xl border transition-all cursor-pointer ${
                      hasConflict
                        ? "bg-red-950/30 border-red-500/40 hover:bg-red-950/40"
                        : ev?.isDemoTarget
                        ? "bg-accent-cyan/10 border-accent-cyan/40 hover:bg-accent-cyan/15"
                        : "bg-canvas-surface/80 hover:bg-canvas-hover border-canvas-border"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs font-bold text-accent-cyanBright">
                          {formatTimeRange(bkg.startIso, bkg.endIso)}
                        </span>
                        {ev?.isDemoTarget && (
                          <span className="text-[10px] font-mono uppercase px-1.5 py-0.5 rounded bg-accent-cyan text-slate-950 font-bold">
                            FLAGSHIP
                          </span>
                        )}
                      </div>
                      <span className="text-xs font-mono font-semibold text-slate-200 bg-canvas-elevated px-2 py-0.5 rounded border border-canvas-border">
                        {rm?.code ?? bkg.roomId}
                      </span>
                    </div>

                    <div className="mt-1.5 text-sm font-semibold text-slate-100 flex items-center justify-between gap-2">
                      <span className="truncate">{ev?.title ?? bkg.eventId}</span>
                      {hasConflict && (
                        <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />
                      )}
                    </div>

                    {/* Visual Capacity Bar & Compact Chips */}
                    <div className="mt-2.5 flex items-center justify-between gap-3 text-[11px] font-mono text-slate-400">
                      <div className="flex items-center gap-2 flex-1 max-w-[160px]">
                        <Users className="w-3 h-3 text-slate-400 shrink-0" />
                        <div className="h-1.5 flex-1 rounded-full bg-canvas-elevated overflow-hidden">
                          <div
                            className="h-full bg-accent-cyan rounded-full"
                            style={{ width: `${capPct}%` }}
                          />
                        </div>
                        <span className="text-slate-300">
                          {ev?.expectedAttendance}/{rm?.capacity}
                        </span>
                      </div>

                      <div className="flex items-center gap-2">
                        {ev && ev.requiredResources.length > 0 && (
                          <span className="px-1.5 py-0.5 rounded bg-canvas-elevated text-slate-300">
                            {ev.requiredResources.reduce(
                              (s, r) => s + r.quantity,
                              0
                            )}{" "}
                            assets
                          </span>
                        )}
                        <span className="px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-300 border border-amber-500/20">
                          +{bkg.turnaroundMinutes}m
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Column 2: Campus Space Matrix (4 cols) */}
        <div className="lg:col-span-4 rounded-2xl ops-card border border-canvas-border flex flex-col">
          <div className="px-5 py-4 border-b border-canvas-border flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Building2 className="w-4 h-4 text-emerald-400" />
              <h2 className="text-sm font-bold text-slate-100">Space Matrix</h2>
            </div>
            <button
              onClick={() => setActiveSection("TIMELINE")}
              className="text-xs font-medium text-accent-cyanBright hover:underline"
            >
              Full Grid →
            </button>
          </div>

          <div className="p-4 space-y-2.5 flex-1">
            {state.rooms.map((room) => {
              const roomDayBookings = dayBookings.filter(
                (b) => b.roomId === room.id
              );
              const lockWins = state.availabilityWindows.filter(
                (w) =>
                  w.entityType === "ROOM" &&
                  w.entityId === room.id &&
                  w.startIso.startsWith(selectedDate)
              );
              const turnaround = room.customTurnaroundMinutes ?? 15;

              return (
                <div
                  key={room.id}
                  onClick={() => setInspectedRoomId(room.id)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      setInspectedRoomId(room.id);
                    }
                  }}
                  className="p-3 rounded-xl bg-canvas-surface/80 hover:bg-canvas-hover border border-canvas-border transition-colors cursor-pointer"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="font-mono text-xs font-semibold px-2 py-0.5 rounded bg-canvas-elevated border border-canvas-border text-accent-cyanBright shrink-0">
                        {room.code}
                      </span>
                      <span className="text-sm font-semibold text-slate-100 truncate">
                        {room.name}
                      </span>
                    </div>
                    {lockWins.length > 0 ? (
                      <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-red-500/20 text-red-300 border border-red-500/30 shrink-0">
                        OUTAGE
                      </span>
                    ) : roomDayBookings.length > 0 ? (
                      <span className="text-[10px] font-mono font-semibold px-2 py-0.5 rounded-full bg-accent-cyan/15 text-accent-cyanBright shrink-0">
                        {roomDayBookings.length} ACTIVE
                      </span>
                    ) : (
                      <span className="text-[10px] font-mono font-semibold px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-300 shrink-0">
                        FREE
                      </span>
                    )}
                  </div>

                  <div className="mt-2 flex items-center justify-between text-xs text-slate-400">
                    <div className="flex items-center gap-3 font-mono text-[11px]">
                      <span className="flex items-center gap-1 text-slate-300">
                        <Users className="w-3 h-3 text-slate-400" />
                        {room.capacity}
                      </span>
                      <span className="flex items-center gap-1 text-amber-300/90">
                        <Clock className="w-3 h-3" />
                        {turnaround}m
                      </span>
                      <span>{room.facilities.length} specs</span>
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setBookingPrefill({
                          preferredRoomId: room.id,
                          dateStr: selectedDate,
                          expectedAttendance: Math.min(60, room.capacity),
                        });
                        setActiveSection("SMART_BOOKING");
                      }}
                      className="text-xs text-accent-cyanBright hover:underline font-semibold"
                    >
                      Book →
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Column 3: Alerts & Live Audit Stream (3 cols) */}
        <div className="lg:col-span-3 space-y-4 flex flex-col">
          {/* Quick Status & Action Card */}
          <div className="rounded-2xl ops-card border border-canvas-border p-4 space-y-3">
            <h2 className="text-sm font-bold text-slate-100 flex items-center gap-2">
              <Zap className="w-4 h-4 text-amber-400" />
              System Pulse
            </h2>

            {state.availabilityWindows.filter((w) =>
              w.startIso.startsWith(selectedDate)
            ).length > 0 ? (
              <div className="space-y-2">
                {state.availabilityWindows
                  .filter((w) => w.startIso.startsWith(selectedDate))
                  .map((win) => {
                    const rm = state.rooms.find((r) => r.id === win.entityId);
                    return (
                      <div
                        key={win.id}
                        className="p-2.5 rounded-xl bg-amber-950/30 border border-amber-500/30 text-xs"
                      >
                        <div className="flex items-center justify-between font-semibold text-amber-300">
                          <span>{rm?.code ?? win.entityId}</span>
                          <span className="font-mono text-[10px]">
                            {formatTimeRange(win.startIso, win.endIso)}
                          </span>
                        </div>
                        <div className="text-slate-300 text-[11px] mt-0.5 truncate">
                          {win.reason}
                        </div>
                      </div>
                    );
                  })}
              </div>
            ) : (
              <div className="p-3 rounded-xl bg-emerald-950/20 border border-emerald-500/25 flex items-center gap-2 text-xs text-emerald-300">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                <span>All venues & buffers nominal</span>
              </div>
            )}

            <div className="grid grid-cols-1 gap-2 pt-1">
              <button
                onClick={() => setActiveSection("SHOCKWAVE")}
                className="w-full flex items-center justify-between px-3 py-2 rounded-xl bg-canvas-surface hover:bg-canvas-hover border border-canvas-border text-xs font-medium text-slate-200 transition-colors"
              >
                <span>Shockwave Simulator</span>
                <ArrowRight className="w-3.5 h-3.5 text-accent-cyanBright" />
              </button>
              <button
                onClick={() => setActiveSection("INVENTORY")}
                className="w-full flex items-center justify-between px-3 py-2 rounded-xl bg-canvas-surface hover:bg-canvas-hover border border-canvas-border text-xs font-medium text-slate-200 transition-colors"
              >
                <span>Equipment Check-In</span>
                <ArrowRight className="w-3.5 h-3.5 text-accent-cyanBright" />
              </button>
            </div>
          </div>

          {/* Compact Visual Audit Stream */}
          <div className="rounded-2xl ops-card border border-canvas-border p-4 flex-1 flex flex-col">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-bold text-slate-100 flex items-center gap-1.5">
                <Activity className="w-4 h-4 text-accent-cyanBright" />
                Audit Stream
              </h2>
              <button
                onClick={() => setActiveSection("AUDIT_LOG")}
                className="text-xs text-accent-cyanBright hover:underline"
              >
                All ({state.auditLog.length}) →
              </button>
            </div>

            <div className="space-y-2.5 flex-1">
              {state.auditLog.slice(0, 4).map((entry) => (
                <div
                  key={entry.id}
                  className="p-2.5 rounded-xl bg-canvas-surface/80 border border-canvas-border text-xs"
                >
                  <div className="flex items-center justify-between text-[10px] font-mono">
                    <span
                      className={`px-1.5 py-0.5 rounded font-semibold ${
                        entry.result === "SUCCESS"
                          ? "bg-emerald-500/15 text-emerald-300"
                          : entry.result === "SIMULATED"
                          ? "bg-amber-500/15 text-amber-300"
                          : "bg-red-500/15 text-red-300"
                      }`}
                    >
                      {entry.action.replace(/_/g, " ")}
                    </span>
                    <span className="text-slate-500">
                      {entry.timestampIso.slice(11, 19)}
                    </span>
                  </div>
                  <div className="font-semibold text-slate-200 mt-1 truncate">
                    {entry.entityName}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
