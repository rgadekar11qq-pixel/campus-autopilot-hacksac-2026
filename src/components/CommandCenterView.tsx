"use client";

import React from "react";
import { useAutopilot } from "@/context/AutopilotContext";
import { detectGlobalConflicts } from "@/domain/engine";
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

  const dayBookings = state.bookings
    .filter(
      (b) => b.startIso.startsWith(selectedDate) && b.status !== "CANCELLED"
    )
    .sort((a, b) => a.startIso.localeCompare(b.startIso));

  const globalConflicts = detectGlobalConflicts(state);
  const occupiedRoomIds = new Set(dayBookings.map((b) => b.roomId));
  const unavailableRoomIds = new Set(
    state.availabilityWindows
      .filter(
        (w) => w.entityType === "ROOM" && w.startIso.startsWith(selectedDate)
      )
      .map((w) => w.entityId)
  );

  const totalOperationalUnits = state.resources.reduce(
    (sum, r) => sum + r.operationalQuantity,
    0
  );
  const activeResourceAllocations = state.resourceAllocations.filter(
    (a) =>
      a.startIso.startsWith(selectedDate) &&
      (a.status === "RESERVED" || a.status === "CHECKED_OUT")
  );
  const allocatedUnitCount = activeResourceAllocations.reduce(
    (sum, a) => sum + a.quantity,
    0
  );
  const reusedValueInr = activeResourceAllocations.reduce((sum, a) => {
    const res = state.resources.find((r) => r.id === a.resourceId);
    return sum + (res?.replacementCostInr ?? 0) * a.quantity;
  }, 0);

  const roboticsBooking = state.bookings.find(
    (b) => b.eventId === "evt-robotics-workshop" && b.status !== "CANCELLED"
  );
  const roboticsRoom = state.rooms.find(
    (r) => r.id === roboticsBooking?.roomId
  );

  return (
    <div className="space-y-6">
      {/* Top Hero Banner: Campus Shockwave Live Demo & Mission Control */}
      <div className="relative overflow-hidden rounded-xl border border-accent-cyan/30 bg-gradient-to-r from-canvas-elevated via-canvas-surface to-canvas-elevated p-5 shadow-xl">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-5">
          <div className="space-y-2 max-w-3xl">
            <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-accent-cyan/15 border border-accent-cyan/30 text-accent-cyanBright text-xs font-mono">
              <Sparkles className="w-3.5 h-3.5" />
              HACKSAC 2026 • TEAM STRATOS • SIMULATED CAMPUS ENVIRONMENT
            </div>
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-100">
              Campus Autopilot doesn&apos;t just show availability — it finds a
              feasible plan and recovers when that plan breaks.
            </h1>
            <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
              Flagship Scenario:{" "}
              <strong className="text-slate-100">
                Autonomous Robotics Systems Workshop
              </strong>{" "}
              (80 attendees, 8× ROS2 Kits, 1× 4K Laser Projector, 2 Mentors, 90m
              + 15m turnaround). Currently{" "}
              {roboticsBooking ? (
                <span className="text-emerald-300 font-medium">
                  confirmed in {roboticsRoom?.name ?? roboticsBooking.roomId} (
                  {formatTimeRange(
                    roboticsBooking.startIso,
                    roboticsBooking.endIso
                  )}
                  )
                </span>
              ) : (
                <span className="text-amber-300 font-medium">
                  ready to be booked in Step 1
                </span>
              )}
              .
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 shrink-0">
            <button
              onClick={startGuidedEndToEndDemo}
              className="flex items-center gap-2 px-3.5 py-2.5 rounded-lg bg-canvas-hover hover:bg-slate-800 text-slate-100 border border-canvas-borderStrong text-xs font-semibold transition-colors"
            >
              <PlusCircle className="w-4 h-4 text-accent-cyanBright" />
              Step 1: Book Robotics Workshop
            </button>
            <button
              onClick={launchInstantShockwaveDemo}
              className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-accent-cyan hover:bg-accent-cyanBright text-slate-950 text-xs font-bold shadow-lg shadow-accent-cyan/20 transition-all"
            >
              <Play className="w-4 h-4 fill-current" />
              Trigger Shockwave: Room Unavailable
            </button>
            <button
              onClick={resetDemoScenario}
              className="flex items-center gap-1.5 px-3 py-2.5 rounded-lg bg-canvas-surface hover:bg-canvas-hover text-slate-300 border border-canvas-border text-xs font-medium transition-colors"
              title="Reset Robotics Workshop Demo Scenario to Baseline"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              Reset Demo
            </button>
          </div>
        </div>
      </div>

      {/* 4 Actionable Telemetry Metric Cards (Every card navigates on click) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <button
          onClick={() => setActiveSection("TIMELINE")}
          className="text-left p-4 rounded-xl bg-canvas-elevated hover:bg-canvas-surface border border-canvas-border hover:border-accent-cyan/40 transition-all group"
        >
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span className="uppercase tracking-wider font-semibold">
              Active Day Schedule
            </span>
            <CalendarClock className="w-4 h-4 text-accent-cyanBright group-hover:scale-110 transition-transform" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-mono font-bold text-slate-100">
              {dayBookings.length}
            </span>
            <span className="text-xs text-slate-400">
              confirmed sessions on {selectedDate}
            </span>
          </div>
          <div className="mt-3 flex items-center justify-between text-xs text-accent-cyanBright">
            <span>Inspect interactive room timeline</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </div>
        </button>

        <button
          onClick={() => setActiveSection("TIMELINE")}
          className="text-left p-4 rounded-xl bg-canvas-elevated hover:bg-canvas-surface border border-canvas-border hover:border-accent-cyan/40 transition-all group"
        >
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span className="uppercase tracking-wider font-semibold">
              Campus Spaces & Buffers
            </span>
            <Building2 className="w-4 h-4 text-emerald-400 group-hover:scale-110 transition-transform" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-mono font-bold text-slate-100">
              {state.rooms.length - unavailableRoomIds.size}/
              {state.rooms.length}
            </span>
            <span className="text-xs text-slate-400">
              operational ({occupiedRoomIds.size} with bookings)
            </span>
          </div>
          <div className="mt-3 flex items-center justify-between text-xs text-emerald-400">
            <span>15m / 30m turnaround policies active</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </div>
        </button>

        <button
          onClick={() => setActiveSection("INVENTORY")}
          className="text-left p-4 rounded-xl bg-canvas-elevated hover:bg-canvas-surface border border-canvas-border hover:border-accent-cyan/40 transition-all group"
        >
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span className="uppercase tracking-wider font-semibold">
              Equipment Pool & Reuse
            </span>
            <Cpu className="w-4 h-4 text-amber-400 group-hover:scale-110 transition-transform" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-mono font-bold text-slate-100">
              {allocatedUnitCount}/{totalOperationalUnits}
            </span>
            <span className="text-xs text-slate-400">
              units allocated ({formatCurrency(reusedValueInr)} reused)
            </span>
          </div>
          <div className="mt-3 flex items-center justify-between text-xs text-amber-300">
            <span>Inspect inventory & returns</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </div>
        </button>

        <button
          onClick={() => setActiveSection("SHOCKWAVE")}
          className={`text-left p-4 rounded-xl border transition-all group ${
            globalConflicts.length > 0
              ? "bg-red-950/25 border-red-500/40 hover:bg-red-950/40"
              : "bg-canvas-elevated hover:bg-canvas-surface border-canvas-border hover:border-accent-cyan/40"
          }`}
        >
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span className="uppercase tracking-wider font-semibold">
              Constraint & Conflict Monitor
            </span>
            {globalConflicts.length > 0 ? (
              <ShieldAlert className="w-4 h-4 text-red-400 animate-pulse" />
            ) : (
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            )}
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span
              className={`text-2xl font-mono font-bold ${
                globalConflicts.length > 0 ? "text-red-400" : "text-emerald-400"
              }`}
            >
              {globalConflicts.length === 0
                ? "0 CONFLICTS"
                : `${globalConflicts.length} ACTIVE`}
            </span>
          </div>
          <div className="mt-3 flex items-center justify-between text-xs text-slate-300">
            <span>
              {globalConflicts.length > 0
                ? "Resolve in Campus Shockwave"
                : "Simulate disruption in Shockwave"}
            </span>
            <ArrowRight className="w-3.5 h-3.5" />
          </div>
        </button>
      </div>

      {/* Main 3-Column Operational Grid: Live Schedule | Room Matrix | Activity & Quick Actions */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Column 1: Upcoming & Active Schedule (5 cols) */}
        <div className="lg:col-span-5 rounded-xl bg-canvas-elevated border border-canvas-border flex flex-col">
          <div className="px-4 py-3.5 border-b border-canvas-border flex items-center justify-between">
            <div>
              <h2 className="text-sm font-semibold text-slate-100">
                What Is Happening ({selectedDate})
              </h2>
              <p className="text-xs text-slate-400">
                Click any session to inspect dependencies, resources, and buffer
                windows
              </p>
            </div>
            <button
              onClick={() => setActiveSection("SMART_BOOKING")}
              className="px-2.5 py-1.5 rounded-lg bg-accent-cyan/15 text-accent-cyanBright border border-accent-cyan/30 text-xs font-medium hover:bg-accent-cyan/25 transition-colors"
            >
              + New Booking
            </button>
          </div>

          <div className="p-4 space-y-2.5 flex-1">
            {dayBookings.length === 0 ? (
              <div className="p-6 text-center text-xs text-slate-400">
                No sessions scheduled on {selectedDate}.
              </div>
            ) : (
              dayBookings.map((bkg) => {
                const ev = state.events.find((e) => e.id === bkg.eventId);
                const rm = state.rooms.find((r) => r.id === bkg.roomId);
                const hasConflict = globalConflicts.some(
                  (c) => c.bookingId === bkg.id
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
                    className={`p-3.5 rounded-lg border transition-all cursor-pointer ${
                      hasConflict
                        ? "bg-red-950/30 border-red-500/40 hover:bg-red-950/40"
                        : ev?.isDemoTarget
                        ? "bg-accent-cyan/10 border-accent-cyan/40 hover:bg-accent-cyan/15"
                        : "bg-canvas-surface hover:bg-canvas-hover border-canvas-border"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs font-semibold text-accent-cyanBright">
                          {formatTimeRange(bkg.startIso, bkg.endIso)}
                        </span>
                        {ev?.isDemoTarget && (
                          <span className="text-[10px] font-mono uppercase px-1.5 py-0.5 rounded bg-accent-cyan text-slate-950 font-bold">
                            DEMO TARGET
                          </span>
                        )}
                      </div>
                      <span className="text-xs font-mono text-slate-300 bg-canvas-elevated px-2 py-0.5 rounded border border-canvas-border">
                        {rm?.code ?? bkg.roomId}
                      </span>
                    </div>

                    <div className="mt-1.5 text-sm font-semibold text-slate-100 flex items-center justify-between">
                      <span>{ev?.title ?? bkg.eventId}</span>
                      {hasConflict && (
                        <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />
                      )}
                    </div>

                    <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-400">
                      <span>Venue: {rm?.name}</span>
                      <span>
                        Attendance: {ev?.expectedAttendance}/{rm?.capacity}
                      </span>
                      <span className="text-amber-300/90 font-mono">
                        +{bkg.turnaroundMinutes}m buffer
                      </span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Column 2: Campus Space Matrix & Availability (4 cols) */}
        <div className="lg:col-span-4 rounded-xl bg-canvas-elevated border border-canvas-border flex flex-col">
          <div className="px-4 py-3.5 border-b border-canvas-border flex items-center justify-between">
            <div>
              <h2 className="text-sm font-semibold text-slate-100">
                What Is Available (Space Matrix)
              </h2>
              <p className="text-xs text-slate-400">
                Real-time derived room status & turnaround policies
              </p>
            </div>
            <button
              onClick={() => setActiveSection("TIMELINE")}
              className="text-xs text-accent-cyanBright hover:underline"
            >
              Timeline →
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
                  className="p-3 rounded-lg bg-canvas-surface hover:bg-canvas-hover border border-canvas-border transition-colors cursor-pointer"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs px-1.5 py-0.5 rounded bg-canvas-elevated border border-canvas-border text-slate-200">
                        {room.code}
                      </span>
                      <span className="text-sm font-medium text-slate-100">
                        {room.name}
                      </span>
                    </div>
                    {lockWins.length > 0 ? (
                      <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-red-500/20 text-red-300 border border-red-500/30">
                        {lockWins[0].status}
                      </span>
                    ) : roomDayBookings.length > 0 ? (
                      <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-accent-cyan/15 text-accent-cyanBright">
                        {roomDayBookings.length} BOOKED
                      </span>
                    ) : (
                      <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-300">
                        ALL DAY FREE
                      </span>
                    )}
                  </div>

                  <div className="mt-2 flex items-center justify-between text-xs text-slate-400">
                    <span>
                      Cap <strong className="text-slate-200">{room.capacity}</strong>{" "}
                      • {room.facilities.length} facilities •{" "}
                      <span className="font-mono text-amber-300">
                        {turnaround}m gap
                      </span>
                    </span>
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
                      className="text-accent-cyanBright hover:underline font-medium"
                    >
                      Reserve
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Column 3: What Needs Attention & Live Audit Stream (3 cols) */}
        <div className="lg:col-span-3 space-y-4 flex flex-col">
          {/* Attention / Quick Orchestration Panel */}
          <div className="rounded-xl bg-canvas-elevated border border-canvas-border p-4 space-y-3">
            <h2 className="text-sm font-semibold text-slate-100 flex items-center gap-2">
              <Zap className="w-4 h-4 text-amber-400" />
              What Needs Attention
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
                        className="p-2.5 rounded-lg bg-amber-950/25 border border-amber-500/30 text-xs"
                      >
                        <div className="font-semibold text-amber-300">
                          {rm?.name ?? win.entityId} ({win.status})
                        </div>
                        <div className="text-slate-300 mt-0.5">
                          {formatTimeRange(win.startIso, win.endIso)}:{" "}
                          {win.reason}
                        </div>
                      </div>
                    );
                  })}
              </div>
            ) : (
              <p className="text-xs text-slate-400">
                No active room lockouts. All scheduled sessions respect 15m/30m
                turnaround buffers.
              </p>
            )}

            <div className="pt-2 border-t border-canvas-border grid grid-cols-1 gap-2">
              <button
                onClick={() => setActiveSection("SHOCKWAVE")}
                className="w-full flex items-center justify-between px-3 py-2 rounded-lg bg-canvas-surface hover:bg-canvas-hover border border-canvas-border text-xs font-medium text-slate-200 transition-colors"
              >
                <span>Open Campus Shockwave Simulator</span>
                <ArrowRight className="w-3.5 h-3.5 text-accent-cyanBright" />
              </button>
              <button
                onClick={() => setActiveSection("INVENTORY")}
                className="w-full flex items-center justify-between px-3 py-2 rounded-lg bg-canvas-surface hover:bg-canvas-hover border border-canvas-border text-xs font-medium text-slate-200 transition-colors"
              >
                <span>Record Equipment Check-In / Return</span>
                <ArrowRight className="w-3.5 h-3.5 text-accent-cyanBright" />
              </button>
            </div>
          </div>

          {/* Compact Operational Activity Feed */}
          <div className="rounded-xl bg-canvas-elevated border border-canvas-border p-4 flex-1 flex flex-col">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold text-slate-100 flex items-center gap-1.5">
                <Activity className="w-4 h-4 text-accent-cyanBright" />
                Operational Audit Feed
              </h2>
              <button
                onClick={() => setActiveSection("AUDIT_LOG")}
                className="text-xs text-accent-cyanBright hover:underline"
              >
                Full Log →
              </button>
            </div>

            <div className="space-y-2.5 flex-1">
              {state.auditLog.slice(0, 4).map((entry) => (
                <div
                  key={entry.id}
                  className="p-2.5 rounded-lg bg-canvas-surface border border-canvas-border text-xs"
                >
                  <div className="flex items-center justify-between text-[11px] font-mono text-slate-400">
                    <span
                      className={
                        entry.result === "SUCCESS"
                          ? "text-emerald-400"
                          : entry.result === "SIMULATED"
                          ? "text-amber-300"
                          : "text-red-400"
                      }
                    >
                      {entry.action.replace(/_/g, " ")}
                    </span>
                    <span>{entry.timestampIso.slice(11, 19)}</span>
                  </div>
                  <div className="font-medium text-slate-200 mt-0.5 truncate">
                    {entry.entityName}
                  </div>
                  <p className="text-slate-400 text-[11px] mt-0.5 line-clamp-2">
                    {entry.reason}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
