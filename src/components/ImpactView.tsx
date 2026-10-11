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
} from "lucide-react";

export function ImpactView() {
  const { state, selectedDate } = useAutopilot();

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

  // Compute room utilization on selectedDate (out of 11 operational hours = 660 mins per room)
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
      <div className="p-4 rounded-xl bg-canvas-elevated border border-canvas-border flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2 py-0.5 rounded bg-accent-cyan/15 text-accent-cyanBright border border-accent-cyan/30 font-mono text-[11px]">
              VERIFIED TELEMETRY VS DOCUMENTED ESTIMATES
            </span>
          </div>
          <h1 className="text-lg font-bold text-slate-100 mt-1">
            Campus Impact, Resource Circulation & Space Utilization
          </h1>
          <p className="text-xs text-slate-400">
            All metrics are computed directly from authoritative state records (
            v{state.stateVersion}) in the simulated HackSAC 2026 environment.
          </p>
        </div>
      </div>

      {/* Top 4 Telemetry Cards with Explicit Measurement vs Estimate Labels */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-4 rounded-xl bg-canvas-elevated border border-canvas-border">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-mono uppercase px-1.5 py-0.5 rounded bg-accent-cyan/15 text-accent-cyanBright">
              RECORDED IN STATE
            </span>
            <Building2 className="w-4 h-4 text-accent-cyanBright" />
          </div>
          <div className="mt-2 text-2xl font-mono font-bold text-slate-100">
            {confirmedBookings.length} Active / {cancelledBookings.length}{" "}
            Cancelled
          </div>
          <div className="text-xs text-slate-400 mt-1">
            Total campus bookings tracked ({conflicts.length} active conflicts)
          </div>
        </div>

        <div className="p-4 rounded-xl bg-canvas-elevated border border-canvas-border">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-mono uppercase px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-300">
              DOCUMENTED ESTIMATE
            </span>
            <Recycle className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="mt-2 text-2xl font-mono font-bold text-emerald-300">
            {formatCurrency(estimatedCostAvoidedInr)}
          </div>
          <div className="text-xs text-slate-400 mt-1">
            Estimated procurement avoided via {totalUnitsReused} reused asset
            units
          </div>
        </div>

        <div className="p-4 rounded-xl bg-canvas-elevated border border-canvas-border">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-mono uppercase px-1.5 py-0.5 rounded bg-accent-cyan/15 text-accent-cyanBright">
              RECORDED IN STATE
            </span>
            <Users className="w-4 h-4 text-accent-cyanBright" />
          </div>
          <div className="mt-2 text-2xl font-mono font-bold text-slate-100">
            {totalVerified} / {totalExpected}
          </div>
          <div className="text-xs text-slate-400 mt-1">
            Verified vs expected attendance across {verifiedEvents.length}{" "}
            audited sessions
          </div>
        </div>

        <div className="p-4 rounded-xl bg-canvas-elevated border border-canvas-border">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-mono uppercase px-1.5 py-0.5 rounded bg-accent-cyan/15 text-accent-cyanBright">
              RECORDED IN STATE
            </span>
            <Zap className="w-4 h-4 text-amber-400" />
          </div>
          <div className="mt-2 text-2xl font-mono font-bold text-slate-100">
            {state.approvals.length} Recoveries
          </div>
          <div className="text-xs text-slate-400 mt-1">
            Approved Shockwave reconfiguration plans committed in session
          </div>
        </div>
      </div>

      {/* 2-Column Analytical Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Room Slot Utilization Bars (7 cols) */}
        <div className="lg:col-span-7 rounded-xl bg-canvas-elevated border border-canvas-border p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-sm font-semibold text-slate-100 flex items-center gap-2">
                <BarChart3 className="w-4 h-4 text-accent-cyanBright" />
                Space Slot Utilization ({selectedDate} • 08:00–19:00 Window)
              </h2>
              <p className="text-xs text-slate-400">
                Includes setup, core event, cleanup, and mandatory 15m/30m
                turnaround buffers
              </p>
            </div>
          </div>

          <div className="space-y-3.5">
            {roomUtilization.map((item) => (
              <div key={item.room.id} className="space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-medium text-slate-200">
                    {item.room.name}{" "}
                    <span className="font-mono text-slate-400">
                      ({item.room.code} • Cap {item.room.capacity})
                    </span>
                  </span>
                  <span className="font-mono text-slate-300">
                    {item.occupiedMinutes}m booked ({item.pct}%)
                    {item.lockMins > 0 ? ` • ${item.lockMins}m locked` : ""}
                  </span>
                </div>
                <div className="h-3 w-full rounded-full bg-canvas-surface border border-canvas-border overflow-hidden flex">
                  <div
                    style={{ width: `${item.pct}%` }}
                    className="h-full bg-accent-cyan transition-all"
                    title={`Booked + Turnaround: ${item.pct}%`}
                  />
                  {item.lockPct > 0 && (
                    <div
                      style={{ width: `${item.lockPct}%` }}
                      className="h-full bg-red-500/70 transition-all"
                      title={`Unavailable Lock: ${item.lockPct}%`}
                    />
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Shockwave Recovery History & Reuse Breakdown (5 cols) */}
        <div className="lg:col-span-5 rounded-xl bg-canvas-elevated border border-canvas-border p-5 space-y-4">
          <h2 className="text-sm font-semibold text-slate-100 flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            Disruption Recovery Ledger ({state.approvals.length})
          </h2>

          {state.approvals.length === 0 ? (
            <div className="p-4 rounded-lg bg-canvas-surface border border-canvas-border text-xs text-slate-400 flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
              <span>
                No Shockwave recovery approvals recorded yet in this session.
                Trigger a disruption in{" "}
                <strong className="text-slate-200">Campus Shockwave</strong> and
                approve a candidate plan to measure reconfiguration deltas here.
              </span>
            </div>
          ) : (
            <div className="space-y-3">
              {state.approvals.map((appr) => {
                const ev = state.events.find(
                  (e) => e.id === appr.targetEventId
                );
                return (
                  <div
                    key={appr.id}
                    className="p-3.5 rounded-lg bg-canvas-surface border border-emerald-500/30 space-y-2 text-xs"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-emerald-300">
                        {ev?.title ?? appr.targetEventId}
                      </span>
                      <span className="font-mono text-[11px] text-slate-400">
                        {appr.deltas.length} changes applied
                      </span>
                    </div>
                    <div className="text-slate-300">
                      Relocated from{" "}
                      <strong>{appr.beforeSnapshot.roomName}</strong> (
                      {formatTimeRange(
                        appr.beforeSnapshot.startIso,
                        appr.beforeSnapshot.endIso
                      )}
                      ) to <strong>{appr.afterSnapshot.roomName}</strong> (
                      {formatTimeRange(
                        appr.afterSnapshot.startIso,
                        appr.afterSnapshot.endIso
                      )}
                      ).
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          <div className="pt-3 border-t border-canvas-border space-y-2">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              Documented Asset Reuse Valuation
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
                  className="flex items-center justify-between text-xs py-1 border-b border-canvas-border/50 last:border-b-0"
                >
                  <span className="text-slate-300 truncate">
                    {res.name} (×{units})
                  </span>
                  <span className="font-mono text-emerald-300 shrink-0 ml-2">
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
