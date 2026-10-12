"use client";

import React from "react";
import { useAutopilot } from "@/context/AutopilotContext";
import { detectGlobalConflicts } from "@/domain/engine";
import { formatCurrency, formatTimeRange } from "@/lib/utils";
import {
  BarChart3,
  CheckCircle2,
  Recycle,
  Building2,
  Users,
  Zap,
  AlertCircle,
  ArrowRight,
} from "lucide-react";

export function ImpactView() {
  const { state, selectedDate, setActiveSection } = useAutopilot();

  const confirmedBookings = state.bookings.filter(
    (b) => b.status === "CONFIRMED" || b.status === "COMPLETED"
  );
  const cancelledBookings = state.bookings.filter(
    (b) => b.status === "CANCELLED"
  );
  const conflicts = detectGlobalConflicts(state);

  const verifiedEvents = state.events.filter(
    (e) => typeof e.verifiedAttendance === "number"
  );
  const totalExpected = verifiedEvents.reduce(
    (s, e) => s + e.expectedAttendance,
    0
  );
  const totalVerified = verifiedEvents.reduce(
    (s, e) => s + (e.verifiedAttendance ?? 0),
    0
  );

  const activeAllocations = state.resourceAllocations.filter(
    (a) => a.status !== "CANCELLED"
  );
  const totalUnitsReused = activeAllocations.reduce(
    (s, a) => s + a.quantity,
    0
  );
  const estimatedCostAvoidedInr = activeAllocations.reduce((sum, a) => {
    const res = state.resources.find((r) => r.id === a.resourceId);
    return sum + (res?.replacementCostInr ?? 0) * a.quantity;
  }, 0);

  const roomUtilization = state.rooms.map((rm) => {
    const dayBkgs = state.bookings.filter(
      (b) =>
        b.roomId === rm.id &&
        b.status !== "CANCELLED" &&
        b.startIso.startsWith(selectedDate)
    );
    const occupiedMinutes = dayBkgs.reduce((acc, b) => {
      const m =
        (new Date(b.turnaroundEndIso).getTime() -
          new Date(b.setupStartIso).getTime()) /
        60_000;
      return acc + Math.max(0, m);
    }, 0);
    const lockMins = state.availabilityWindows
      .filter(
        (w) =>
          w.entityType === "ROOM" &&
          w.entityId === rm.id &&
          w.startIso.startsWith(selectedDate)
      )
      .reduce((acc, w) => {
        const m =
          (new Date(w.endIso).getTime() - new Date(w.startIso).getTime()) /
          60_000;
        return acc + Math.max(0, m);
      }, 0);

    const pct = Math.min(100, Math.round((occupiedMinutes / 660) * 100));
    const lockPct = Math.min(100 - pct, Math.round((lockMins / 660) * 100));
    return {
      room: rm,
      bookingsCount: dayBkgs.length,
      occupiedMinutes,
      lockMins,
      pct,
      lockPct,
    };
  });

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="p-5 rounded-2xl ops-card border border-canvas-border flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <span className="px-2.5 py-0.5 rounded-full bg-accent-cyan/15 text-accent-cyanBright border border-accent-cyan/30 font-mono text-[10px] font-bold">
            VERIFIED TELEMETRY • STATE v{state.stateVersion}
          </span>
          <h1 className="text-xl font-bold text-slate-100 mt-1.5">
            Campus Impact & Space Utilization
          </h1>
        </div>
      </div>

      {/* Top 4 Telemetry Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-4 rounded-2xl ops-card border border-canvas-border">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded-full bg-accent-cyan/15 text-accent-cyanBright">
              BOOKINGS
            </span>
            <Building2 className="w-4 h-4 text-accent-cyanBright" />
          </div>
          <div className="mt-2.5 text-3xl font-mono font-bold text-slate-100">
            {confirmedBookings.length}
            <span className="text-sm text-slate-400 font-normal ml-1.5">
              active ({cancelledBookings.length} cancelled)
            </span>
          </div>
          <div className="text-xs text-slate-400 mt-1">
            {conflicts.length} unresolved conflicts
          </div>
        </div>

        <div className="p-4 rounded-2xl ops-card border border-canvas-border">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-300">
              COST AVOIDED
            </span>
            <Recycle className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="mt-2.5 text-3xl font-mono font-bold text-emerald-300">
            {formatCurrency(estimatedCostAvoidedInr)}
          </div>
          <div className="text-xs text-slate-400 mt-1">
            {totalUnitsReused} asset units circulated
          </div>
        </div>

        <div className="p-4 rounded-2xl ops-card border border-canvas-border">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded-full bg-accent-cyan/15 text-accent-cyanBright">
              ATTENDANCE
            </span>
            <Users className="w-4 h-4 text-accent-cyanBright" />
          </div>
          <div className="mt-2.5 text-3xl font-mono font-bold text-slate-100">
            {totalVerified}
            <span className="text-base text-slate-500">/{totalExpected}</span>
          </div>
          <div className="text-xs text-slate-400 mt-1">
            Verified across {verifiedEvents.length} completed sessions
          </div>
        </div>

        <div className="p-4 rounded-2xl ops-card border border-canvas-border">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-300">
              RECOVERIES
            </span>
            <Zap className="w-4 h-4 text-amber-400" />
          </div>
          <div className="mt-2.5 text-3xl font-mono font-bold text-slate-100">
            {state.approvals.length}
          </div>
          <div className="text-xs text-slate-400 mt-1">
            Approved Shockwave reconfigurations
          </div>
        </div>
      </div>

      {/* 2-Column Analytical Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Room Slot Utilization Bars (7 cols) */}
        <div className="lg:col-span-7 rounded-2xl ops-card border border-canvas-border p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-slate-100 flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-accent-cyanBright" />
              Venue Utilization ({selectedDate} • 08:00–19:00)
            </h2>
            <span className="text-[11px] font-mono text-slate-400">
              Includes buffers
            </span>
          </div>

          <div className="space-y-3.5">
            {roomUtilization.map((item) => (
              <div key={item.room.id} className="space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-slate-200 flex items-center gap-2">
                    <span className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-canvas-surface border border-canvas-border text-accent-cyanBright">
                      {item.room.code}
                    </span>
                    {item.room.name}
                  </span>
                  <span className="font-mono text-slate-300">
                    {item.pct}% booked
                    {item.lockMins > 0 ? ` • ${item.lockPct}% outage` : ""}
                  </span>
                </div>
                <div className="h-2.5 w-full rounded-full bg-canvas-surface border border-canvas-border overflow-hidden flex">
                  <div
                    style={{ width: `${item.pct}%` }}
                    className="h-full bg-accent-cyan transition-all"
                  />
                  {item.lockPct > 0 && (
                    <div
                      style={{ width: `${item.lockPct}%` }}
                      className="h-full bg-red-500/80 transition-all"
                    />
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Shockwave Recovery History & Reuse Breakdown (5 cols) */}
        <div className="lg:col-span-5 rounded-2xl ops-card border border-canvas-border p-5 space-y-4">
          <h2 className="text-sm font-bold text-slate-100 flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            Shockwave Recovery Ledger ({state.approvals.length})
          </h2>

          {state.approvals.length === 0 ? (
            <div className="p-4 rounded-xl bg-canvas-surface/80 border border-canvas-border text-xs text-slate-400 flex items-center justify-between gap-2.5">
              <div className="flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-amber-400 shrink-0" />
                <span>No recoveries committed yet.</span>
              </div>
              <button
                onClick={() => setActiveSection("SHOCKWAVE")}
                className="text-accent-cyanBright font-semibold hover:underline shrink-0"
              >
                Open Shockwave →
              </button>
            </div>
          ) : (
            <div className="space-y-2.5">
              {state.approvals.map((appr) => {
                const ev = state.events.find(
                  (e) => e.id === appr.targetEventId
                );
                return (
                  <div
                    key={appr.id}
                    className="p-3.5 rounded-xl bg-canvas-surface/90 border border-emerald-500/30 space-y-1.5 text-xs"
                  >
                    <div className="font-bold text-emerald-300 truncate">
                      {ev?.title ?? appr.targetEventId}
                    </div>
                    <div className="flex items-center gap-2 font-mono text-[11px] text-slate-300">
                      <span className="line-through text-slate-500">
                        {appr.beforeSnapshot.roomName}
                      </span>
                      <ArrowRight className="w-3 h-3 text-accent-cyanBright" />
                      <span className="text-emerald-300 font-semibold">
                        {appr.afterSnapshot.roomName} (
                        {formatTimeRange(
                          appr.afterSnapshot.startIso,
                          appr.afterSnapshot.endIso
                        )}
                        )
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          <div className="pt-3 border-t border-canvas-border space-y-2">
            <h3 className="text-[11px] font-mono uppercase tracking-wider text-slate-400">
              Asset Reuse Breakdown
            </h3>
            {state.resources.map((res) => {
              const allocs = activeAllocations.filter(
                (a) => a.resourceId === res.id
              );
              const units = allocs.reduce((s, a) => s + a.quantity, 0);
              if (units === 0) return null;
              return (
                <div
                  key={res.id}
                  className="flex items-center justify-between text-xs py-1.5 border-b border-canvas-border/50 last:border-b-0"
                >
                  <span className="text-slate-200 truncate">
                    {res.name}{" "}
                    <span className="font-mono text-slate-400">×{units}</span>
                  </span>
                  <span className="font-mono text-emerald-300 font-semibold shrink-0 ml-2">
                    {formatCurrency(units * res.replacementCostInr)}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
