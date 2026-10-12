"use client";

import React, { useMemo, useState } from "react";
import { useAutopilot } from "@/context/AutopilotContext";
import { inspectEventDependencies } from "@/domain/shockwave";
import { DEMO_PRIMARY_DATE } from "@/domain/seedData";
import { CandidatePlan, Disruption, DisruptionType } from "@/domain/types";
import { formatTimeRange } from "@/lib/utils";
import {
  Zap,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  ArrowRight,
  RotateCcw,
  Building2,
  Cpu,
  Users,
  Clock,
  ShieldCheck,
  Network,
  Play,
  SlidersHorizontal,
  GitCompare,
  Link2,
} from "lucide-react";

function ScoreRing({ score }: { score: number }) {
  const radius = 18;
  const circumference = 2 * Math.PI * radius;
  const clamped = Math.max(0, Math.min(100, score));
  const offset = circumference - (clamped / 100) * circumference;

  return (
    <div className="relative w-12 h-12 flex items-center justify-center shrink-0">
      <svg className="w-12 h-12 -rotate-90" viewBox="0 0 44 44">
        <circle
          cx="22"
          cy="22"
          r={radius}
          fill="none"
          stroke="rgb(var(--c-border))"
          strokeWidth="4"
        />
        <circle
          cx="22"
          cy="22"
          r={radius}
          fill="none"
          stroke="rgb(var(--c-accent))"
          strokeWidth="4"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
        />
      </svg>
      <span className="absolute font-mono text-xs font-bold text-slate-100">
        {clamped}
      </span>
    </div>
  );
}

export function ShockwaveView() {
  const {
    state,
    shockwaveTargetEventId,
    setShockwaveTargetEventId,
    activeSimulation,
    setActiveSimulation,
    latestApproval,
    triggerShockwaveSimulation,
    commitCandidatePlan,
    resetDemoScenario,
    setActiveSection,
  } = useAutopilot();

  const [selectedDisruptionType, setSelectedDisruptionType] =
    useState<DisruptionType>("ROOM_UNAVAILABLE");
  const [customAttendance, setCustomAttendance] = useState<number>(105);
  const [selectedCandidateId, setSelectedCandidateId] = useState<string | null>(
    null
  );

  const dependencyGraph = useMemo(
    () => inspectEventDependencies(state, shockwaveTargetEventId),
    [state, shockwaveTargetEventId]
  );

  const buildAndRunDisruption = (
    type: DisruptionType,
    overrideAttendance?: number
  ) => {
    setSelectedDisruptionType(type);
    const targetEv =
      state.events.find((e) => e.id === shockwaveTargetEventId) ??
      state.events[0];
    const targetBkg = state.bookings.find(
      (b) => b.eventId === targetEv.id && b.status !== "CANCELLED"
    );
    const room = state.rooms.find((r) => r.id === targetBkg?.roomId);

    let disr: Disruption;

    if (type === "ROOM_UNAVAILABLE") {
      disr = {
        id: `disr-room-${Date.now()}`,
        type: "ROOM_UNAVAILABLE",
        title: `Venue Outage: ${room?.name ?? "Assigned Room"}`,
        description: `${room?.name ?? "Venue"} (${
          room?.code
        }) locked due to power breaker trip (${
          targetBkg?.setupStartIso.slice(11, 16) ?? "10:30"
        }–14:00).`,
        targetEventId: targetEv.id,
        targetRoomId: targetBkg?.roomId,
        unavailableStartIso:
          targetBkg?.setupStartIso ?? `${DEMO_PRIMARY_DATE}T10:30:00`,
        unavailableEndIso: `${DEMO_PRIMARY_DATE}T14:00:00`,
        createdAtIso: new Date().toISOString(),
      };
    } else if (type === "ATTENDANCE_SURGE") {
      const surgeVal = overrideAttendance ?? customAttendance;
      disr = {
        id: `disr-att-${Date.now()}`,
        type: "ATTENDANCE_SURGE",
        title: `Attendance Surge (${targetEv.expectedAttendance} → ${surgeVal}p)`,
        description: `Demand surged to ${surgeVal} seats, exceeding ${room?.name} capacity (${room?.capacity}).`,
        targetEventId: targetEv.id,
        newAttendance: surgeVal,
        createdAtIso: new Date().toISOString(),
      };
    } else if (type === "MENTOR_UNAVAILABLE") {
      const leadMentorId = targetEv.requiredPeopleIds[0] ?? "per-arjun";
      const mentor = state.people.find((p) => p.id === leadMentorId);
      disr = {
        id: `disr-men-${Date.now()}`,
        type: "MENTOR_UNAVAILABLE",
        title: `Mentor Pulled: ${mentor?.name ?? leadMentorId}`,
        description: `${
          mentor?.name ?? "Assigned mentor"
        } unavailable during ${
          targetBkg?.setupStartIso.slice(11, 16) ?? "10:45"
        }–${targetBkg?.cleanupEndIso.slice(11, 16) ?? "12:45"}.`,
        targetEventId: targetEv.id,
        targetPersonId: leadMentorId,
        unavailableStartIso: targetBkg?.setupStartIso,
        unavailableEndIso: targetBkg?.cleanupEndIso,
        createdAtIso: new Date().toISOString(),
      };
    } else if (type === "TIME_SHIFT") {
      disr = {
        id: `disr-shift-${Date.now()}`,
        type: "TIME_SHIFT",
        title: "Schedule Shift to 13:30–15:00",
        description: `"${targetEv.title}" shifted into conflicting afternoon window (13:30–15:00).`,
        targetEventId: targetEv.id,
        shiftedStartIso: `${DEMO_PRIMARY_DATE}T13:30:00`,
        shiftedEndIso: `${DEMO_PRIMARY_DATE}T15:00:00`,
        createdAtIso: new Date().toISOString(),
      };
    } else if (type === "EQUIPMENT_UNAVAILABLE") {
      const targetResId =
        targetEv.requiredResources[0]?.resourceId ?? "res-ros-kit";
      const resObj = state.resources.find((r) => r.id === targetResId);
      disr = {
        id: `disr-eq-${Date.now()}`,
        type: "EQUIPMENT_UNAVAILABLE",
        title: `Equipment Quarantine: ${resObj?.name ?? targetResId}`,
        description: `Operational pool reduced to 6 units (below required 8 units).`,
        targetEventId: targetEv.id,
        targetResourceId: targetResId,
        reducedResourceQty: 6,
        createdAtIso: new Date().toISOString(),
      };
    } else {
      disr = {
        id: `disr-can-${Date.now()}`,
        type: "BOOKING_CANCELLED",
        title: `Event Cancellation: ${targetEv.title}`,
        description: `Full cancellation and immediate release of room, equipment, and mentors.`,
        targetEventId: targetEv.id,
        createdAtIso: new Date().toISOString(),
      };
    }

    const sim = triggerShockwaveSimulation(disr);
    if (sim.validCandidates.length > 0) {
      setSelectedCandidateId(sim.validCandidates[0].id);
    } else {
      setSelectedCandidateId(null);
    }
  };

  const activeCandidates = activeSimulation?.validCandidates ?? [];
  const focusedCandidate: CandidatePlan | null =
    activeCandidates.find((c) => c.id === selectedCandidateId) ??
    activeCandidates[0] ??
    null;

  return (
    <div className="space-y-6">
      {/* Top Signature Control Header — Clean & High-Impact */}
      <div className="p-5 rounded-2xl ops-card ops-glow-cyan border border-accent-cyan/40 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-full bg-accent-cyan text-slate-950 font-mono text-[10px] font-bold">
              SHOCKWAVE ENGINE
            </span>
            <span className="text-xs font-mono text-accent-cyanBright">
              ISOLATED SIMULATION CLONE • STATE v{state.stateVersion}
            </span>
          </div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-100">
            Disruption & Autonomous Recovery Orchestrator
          </h1>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
          <button
            onClick={() => {
              setShockwaveTargetEventId("evt-robotics-workshop");
              buildAndRunDisruption("ROOM_UNAVAILABLE");
            }}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-accent-cyan hover:bg-accent-cyanBright text-slate-950 font-bold text-xs shadow-lg shadow-accent-cyan/25 transition-all"
          >
            <Play className="w-4 h-4 fill-current" />
            1-Click Demo: Room Outage
          </button>

          <button
            onClick={resetDemoScenario}
            className="flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl bg-canvas-surface hover:bg-canvas-hover border border-canvas-border text-xs font-medium text-slate-200 transition-colors"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Reset Baseline
          </button>
        </div>
      </div>

      {/* Atomic Approval Confirmation Banner (Before vs After Diff) */}
      {latestApproval && (
        <div className="p-5 rounded-2xl bg-emerald-950/30 border-2 border-emerald-500/60 ops-glow-emerald space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-emerald-500/30 pb-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400 shrink-0">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <div>
                <h2 className="text-base font-bold text-emerald-300">
                  Recovery Committed Atomically • State v{state.stateVersion}
                </h2>
                <p className="text-xs font-mono text-slate-300">
                  ID: {latestApproval.id} • 0 Unresolved Conflicts
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setActiveSection("TIMELINE")}
                className="px-3.5 py-2 rounded-xl bg-emerald-500 text-slate-950 font-bold text-xs hover:bg-emerald-400 transition-colors"
              >
                View Timeline →
              </button>
              <button
                onClick={() => setActiveSection("AUDIT_LOG")}
                className="px-3 py-2 rounded-xl bg-canvas-surface border border-canvas-border text-xs text-slate-200 hover:bg-canvas-hover"
              >
                Audit Log
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="p-3.5 rounded-xl bg-canvas-elevated/90 border border-canvas-border">
              <div className="text-[10px] font-mono uppercase text-slate-400">
                Before Outage
              </div>
              <div className="text-sm font-semibold text-slate-300 line-through mt-1">
                {latestApproval.beforeSnapshot.roomName}
              </div>
              <div className="text-xs font-mono text-slate-400 mt-0.5">
                {formatTimeRange(
                  latestApproval.beforeSnapshot.startIso,
                  latestApproval.beforeSnapshot.endIso
                )}
              </div>
            </div>

            <div className="p-3.5 rounded-xl bg-emerald-950/40 border border-emerald-500/40">
              <div className="text-[10px] font-mono uppercase text-emerald-300">
                Committed Recovery
              </div>
              <div className="text-sm font-bold text-slate-100 mt-1">
                {latestApproval.afterSnapshot.roomName}
              </div>
              <div className="text-xs font-mono text-emerald-300 mt-0.5">
                {formatTimeRange(
                  latestApproval.afterSnapshot.startIso,
                  latestApproval.afterSnapshot.endIso
                )}
              </div>
            </div>

            <div className="p-3.5 rounded-xl bg-canvas-elevated/90 border border-canvas-border flex flex-col justify-center space-y-1">
              <div className="text-[10px] font-mono uppercase text-slate-400">
                Applied Deltas
              </div>
              {latestApproval.deltas.map((d, i) => (
                <div key={i} className="text-xs flex items-center gap-1.5 truncate">
                  <span className="text-slate-400">{d.label}:</span>
                  <span className="text-emerald-300 font-semibold truncate">
                    {d.after}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Step 1 & Step 2 Grid: Visual Dependency Map + Icon-Driven Disruption Deck */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left 5 Columns: Visual Dependency Node Map */}
        <div className="lg:col-span-5 rounded-2xl ops-card border border-canvas-border p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-bold text-slate-200 uppercase tracking-wider flex items-center gap-2">
              <Network className="w-4 h-4 text-accent-cyanBright" />
              1. Target Event & Dependency Graph
            </h2>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-canvas-surface border border-canvas-border text-slate-400">
              LIVE GRAPH
            </span>
          </div>

          <select
            value={shockwaveTargetEventId}
            onChange={(e) => {
              setShockwaveTargetEventId(e.target.value);
              setActiveSimulation(null);
            }}
            aria-label="Select Active Campus Event"
            className="w-full px-3.5 py-2.5 rounded-xl bg-canvas-surface border border-canvas-border text-xs font-semibold text-slate-100 focus:outline-none focus:border-accent-cyan"
          >
            {state.events
              .filter((ev) =>
                state.bookings.some(
                  (b) => b.eventId === ev.id && b.status !== "CANCELLED"
                )
              )
              .map((ev) => {
                const b = state.bookings.find(
                  (bk) => bk.eventId === ev.id && bk.status !== "CANCELLED"
                );
                const rm = state.rooms.find((r) => r.id === b?.roomId);
                return (
                  <option
                    key={ev.id}
                    value={ev.id}
                    className="bg-canvas-elevated"
                  >
                    {ev.title} ({rm?.code} •{" "}
                    {b ? formatTimeRange(b.startIso, b.endIso) : ""})
                  </option>
                );
              })}
          </select>

          {dependencyGraph ? (
            <div className="grid grid-cols-2 gap-3 pt-1">
              {/* Node 1: Venue */}
              <div className="p-3 rounded-xl bg-canvas-surface/90 border border-canvas-border space-y-1">
                <div className="flex items-center gap-1.5 text-[11px] font-mono text-accent-cyanBright">
                  <Building2 className="w-3.5 h-3.5" />
                  VENUE NODE
                </div>
                <div className="text-sm font-bold text-slate-100 truncate">
                  {dependencyGraph.roomName}
                </div>
                <div className="text-[11px] font-mono text-slate-400">
                  {dependencyGraph.timeRangeLabel}
                </div>
              </div>

              {/* Node 2: Attendance & Cap */}
              <div className="p-3 rounded-xl bg-canvas-surface/90 border border-canvas-border space-y-1">
                <div className="flex items-center gap-1.5 text-[11px] font-mono text-emerald-400">
                  <Users className="w-3.5 h-3.5" />
                  CAPACITY NODE
                </div>
                <div className="text-sm font-bold text-slate-100">
                  {dependencyGraph.event.expectedAttendance} Participants
                </div>
                <div className="text-[11px] font-mono text-slate-400">
                  {dependencyGraph.buildingName}
                </div>
              </div>

              {/* Node 3: Equipment Pool */}
              <div className="col-span-2 p-3 rounded-xl bg-canvas-surface/90 border border-canvas-border space-y-2">
                <div className="flex items-center justify-between text-[11px] font-mono text-amber-300">
                  <span className="flex items-center gap-1.5">
                    <Cpu className="w-3.5 h-3.5" />
                    EQUIPMENT NODES ({dependencyGraph.allocatedResources.length})
                  </span>
                </div>
                <div className="flex flex-wrap gap-2">
                  {dependencyGraph.allocatedResources.map((res) => (
                    <span
                      key={res.resourceId}
                      className="text-xs px-2.5 py-1 rounded-lg bg-canvas-elevated border border-canvas-border text-slate-200 flex items-center gap-2"
                    >
                      <span className="truncate max-w-[150px]">{res.name}</span>
                      <span className="font-mono text-accent-cyanBright font-bold">
                        {res.quantity}/{res.operationalPool}
                      </span>
                    </span>
                  ))}
                </div>
              </div>

              {/* Node 4: Mentors & Coupled Sessions */}
              <div className="col-span-2 p-3 rounded-xl bg-canvas-surface/90 border border-canvas-border space-y-2">
                <div className="flex items-center justify-between text-[11px] font-mono text-slate-300">
                  <span className="flex items-center gap-1.5">
                    <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                    MENTORS ({dependencyGraph.assignedPeople.length})
                  </span>
                  {dependencyGraph.connectedEvents.length > 0 && (
                    <span className="flex items-center gap-1 text-amber-300">
                      <Link2 className="w-3 h-3" />
                      {dependencyGraph.connectedEvents.length} coupled events
                    </span>
                  )}
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {dependencyGraph.assignedPeople.map((p) => (
                    <span
                      key={p.personId}
                      className="text-xs px-2.5 py-1 rounded-lg bg-canvas-elevated border border-canvas-border text-slate-200 font-medium"
                    >
                      {p.name}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div className="p-4 rounded-xl bg-canvas-surface text-xs text-slate-400">
              No active booking for selected event.
            </div>
          )}
        </div>

        {/* Right 7 Columns: Concise 6-Tile Disruption Trigger Deck */}
        <div className="lg:col-span-7 rounded-2xl ops-card border border-canvas-border p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-bold text-slate-200 uppercase tracking-wider flex items-center gap-2">
              <SlidersHorizontal className="w-4 h-4 text-amber-400" />
              2. Inject Operational Disruption
            </h2>
            <span className="text-[11px] font-mono text-slate-400">
              Zero side-effects until approved
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {/* Tile 1: Room Outage */}
            <button
              type="button"
              onClick={() => buildAndRunDisruption("ROOM_UNAVAILABLE")}
              className={`p-3.5 rounded-xl border text-left transition-all flex flex-col justify-between ${
                selectedDisruptionType === "ROOM_UNAVAILABLE" &&
                activeSimulation
                  ? "bg-amber-950/35 border-amber-400 ops-glow-amber"
                  : "bg-canvas-surface/80 hover:bg-canvas-hover border-canvas-border"
              }`}
            >
              <div>
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold text-amber-300 uppercase font-mono px-2 py-0.5 rounded bg-amber-500/15">
                    PRIMARY DEMO
                  </span>
                  <Zap className="w-4 h-4 text-amber-400" />
                </div>
                <div className="text-sm font-bold text-slate-100 mt-2.5">
                  1. Venue Outage
                </div>
              </div>
              <div className="mt-3 text-[11px] font-mono text-slate-400 pt-2 border-t border-canvas-border/60">
                Locks {dependencyGraph?.roomName ?? "assigned room"}
              </div>
            </button>

            {/* Tile 2: Attendance Surge */}
            <div
              className={`p-3.5 rounded-xl border text-left transition-all flex flex-col justify-between ${
                selectedDisruptionType === "ATTENDANCE_SURGE" &&
                activeSimulation
                  ? "bg-amber-950/35 border-amber-400 ops-glow-amber"
                  : "bg-canvas-surface/80 border-canvas-border"
              }`}
            >
              <div>
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold text-amber-300 uppercase font-mono px-2 py-0.5 rounded bg-amber-500/15">
                    CAPACITY
                  </span>
                  <Users className="w-4 h-4 text-amber-400" />
                </div>
                <div className="text-sm font-bold text-slate-100 mt-2.5">
                  2. Attendance Surge
                </div>
              </div>
              <div className="mt-3 pt-2 border-t border-canvas-border/60 flex items-center gap-1.5">
                <input
                  type="number"
                  min={50}
                  max={600}
                  value={customAttendance}
                  onChange={(e) => setCustomAttendance(Number(e.target.value))}
                  aria-label="New surged attendance count"
                  className="w-16 px-2 py-1 rounded bg-canvas-elevated border border-canvas-border text-xs font-mono text-slate-100"
                />
                <button
                  type="button"
                  onClick={() =>
                    buildAndRunDisruption("ATTENDANCE_SURGE", customAttendance)
                  }
                  className="px-2 py-1 rounded bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/40 text-amber-200 text-[11px] font-semibold"
                >
                  Run
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setCustomAttendance(500);
                    buildAndRunDisruption("ATTENDANCE_SURGE", 500);
                  }}
                  className="px-1.5 py-1 rounded bg-red-500/20 hover:bg-red-500/30 border border-red-500/40 text-red-200 text-[10px] font-mono"
                  title="Test 500p Infeasible Surge"
                >
                  500p
                </button>
              </div>
            </div>

            {/* Tile 3: Mentor Unavailable */}
            <button
              type="button"
              onClick={() => buildAndRunDisruption("MENTOR_UNAVAILABLE")}
              className={`p-3.5 rounded-xl border text-left transition-all flex flex-col justify-between ${
                selectedDisruptionType === "MENTOR_UNAVAILABLE" &&
                activeSimulation
                  ? "bg-amber-950/35 border-amber-400 ops-glow-amber"
                  : "bg-canvas-surface/80 hover:bg-canvas-hover border-canvas-border"
              }`}
            >
              <div>
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold text-amber-300 uppercase font-mono px-2 py-0.5 rounded bg-amber-500/15">
                    PERSONNEL
                  </span>
                  <ShieldCheck className="w-4 h-4 text-amber-400" />
                </div>
                <div className="text-sm font-bold text-slate-100 mt-2.5">
                  3. Mentor Pulled
                </div>
              </div>
              <div className="mt-3 text-[11px] font-mono text-slate-400 pt-2 border-t border-canvas-border/60">
                Blocks lead mentor slot
              </div>
            </button>

            {/* Tile 4: Time Shift */}
            <button
              type="button"
              onClick={() => buildAndRunDisruption("TIME_SHIFT")}
              className={`p-3.5 rounded-xl border text-left transition-all flex flex-col justify-between ${
                selectedDisruptionType === "TIME_SHIFT" && activeSimulation
                  ? "bg-amber-950/35 border-amber-400 ops-glow-amber"
                  : "bg-canvas-surface/80 hover:bg-canvas-hover border-canvas-border"
              }`}
            >
              <div>
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold text-amber-300 uppercase font-mono px-2 py-0.5 rounded bg-amber-500/15">
                    SCHEDULE
                  </span>
                  <Clock className="w-4 h-4 text-amber-400" />
                </div>
                <div className="text-sm font-bold text-slate-100 mt-2.5">
                  4. Time Collision
                </div>
              </div>
              <div className="mt-3 text-[11px] font-mono text-slate-400 pt-2 border-t border-canvas-border/60">
                Shifts to 13:30–15:00
              </div>
            </button>

            {/* Tile 5: Equipment Shortage */}
            <button
              type="button"
              onClick={() => buildAndRunDisruption("EQUIPMENT_UNAVAILABLE")}
              className={`p-3.5 rounded-xl border text-left transition-all flex flex-col justify-between ${
                selectedDisruptionType === "EQUIPMENT_UNAVAILABLE" &&
                activeSimulation
                  ? "bg-amber-950/35 border-amber-400 ops-glow-amber"
                  : "bg-canvas-surface/80 hover:bg-canvas-hover border-canvas-border"
              }`}
            >
              <div>
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold text-amber-300 uppercase font-mono px-2 py-0.5 rounded bg-amber-500/15">
                    INVENTORY
                  </span>
                  <Cpu className="w-4 h-4 text-amber-400" />
                </div>
                <div className="text-sm font-bold text-slate-100 mt-2.5">
                  5. Kit Quarantine
                </div>
              </div>
              <div className="mt-3 text-[11px] font-mono text-slate-400 pt-2 border-t border-canvas-border/60">
                Pool drops 11 → 6 units
              </div>
            </button>

            {/* Tile 6: Booking Cancelled */}
            <button
              type="button"
              onClick={() => buildAndRunDisruption("BOOKING_CANCELLED")}
              className={`p-3.5 rounded-xl border text-left transition-all flex flex-col justify-between ${
                selectedDisruptionType === "BOOKING_CANCELLED" &&
                activeSimulation
                  ? "bg-amber-950/35 border-amber-400 ops-glow-amber"
                  : "bg-canvas-surface/80 hover:bg-canvas-hover border-canvas-border"
              }`}
            >
              <div>
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold text-amber-300 uppercase font-mono px-2 py-0.5 rounded bg-amber-500/15">
                    RELEASE
                  </span>
                  <XCircle className="w-4 h-4 text-amber-400" />
                </div>
                <div className="text-sm font-bold text-slate-100 mt-2.5">
                  6. Cancel & Release
                </div>
              </div>
              <div className="mt-3 text-[11px] font-mono text-slate-400 pt-2 border-t border-canvas-border/60">
                Frees room & 8 kits
              </div>
            </button>
          </div>
        </div>
      </div>

      {/* Step 3: Shockwave Simulation Results & Candidate Comparison */}
      {activeSimulation && (
        <div className="space-y-6">
          {/* Compact Visual Impact Propagation Bar */}
          <div className="p-5 rounded-2xl ops-card border-2 border-amber-500/50 ops-glow-amber space-y-4">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
              <div>
                <div className="flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-amber-400" />
                  <span className="text-[11px] font-mono uppercase tracking-wider text-amber-300 font-bold">
                    SIMULATION SNAPSHOT v{activeSimulation.stateVersion}
                  </span>
                </div>
                <h3 className="text-lg font-bold text-slate-100 mt-1">
                  {activeSimulation.disruption.title}
                </h3>
              </div>

              <div className="flex flex-wrap items-center gap-2.5 font-mono text-xs shrink-0">
                <div className="px-3 py-2 rounded-xl bg-red-950/40 border border-red-500/40 text-red-200">
                  Direct:{" "}
                  <strong className="text-sm">
                    {activeSimulation.directlyAffectedEventIds.length}
                  </strong>
                </div>
                <div className="px-3 py-2 rounded-xl bg-amber-950/40 border border-amber-500/40 text-amber-200">
                  Coupled:{" "}
                  <strong className="text-sm">
                    {activeSimulation.indirectlyAffectedEventIds.length}
                  </strong>
                </div>
                <div className="px-3 py-2 rounded-xl bg-emerald-950/40 border border-emerald-500/40 text-emerald-200">
                  Feasible Plans:{" "}
                  <strong className="text-sm">
                    {activeSimulation.validCandidates.length}
                  </strong>
                </div>
                <button
                  type="button"
                  onClick={() => setActiveSimulation(null)}
                  className="px-3 py-2 rounded-xl bg-canvas-surface hover:bg-canvas-hover border border-canvas-border text-slate-300 hover:text-slate-100 font-sans font-medium"
                >
                  Dismiss
                </button>
              </div>
            </div>

            {/* Broken Constraint Pills */}
            {activeSimulation.originalViolations.length > 0 && (
              <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-amber-500/20">
                <span className="text-[11px] font-mono uppercase text-red-300 font-semibold">
                  Broken Constraints:
                </span>
                {activeSimulation.originalViolations.map((v, idx) => (
                  <div
                    key={idx}
                    className="px-2.5 py-1 rounded-lg bg-red-950/50 border border-red-500/40 text-xs text-red-100 flex items-center gap-2"
                  >
                    <span className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-red-500/30 text-red-200 font-bold">
                      {v.code}
                    </span>
                    <span className="truncate max-w-md">{v.message}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Candidate Comparison & Rejected Options Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Left 7 Columns: Ranked Feasible Candidate Plans */}
            <div className="lg:col-span-7 space-y-4">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-200 flex items-center gap-2">
                <GitCompare className="w-4 h-4 text-accent-cyanBright" />
                Ranked Feasible Recovery Plans (
                {activeSimulation.validCandidates.length})
              </h3>

              {activeSimulation.validCandidates.length === 0 ? (
                <div className="p-6 rounded-2xl bg-red-950/25 border border-red-500/40 space-y-2">
                  <div className="flex items-center gap-2 text-red-300 font-bold text-sm">
                    <XCircle className="w-5 h-5" />
                    NO FEASIBLE RECOVERY PLAN EXISTS
                  </div>
                  <p className="text-xs text-slate-300">
                    Every room and time slot violated hard constraints. Adjust
                    attendance or restore equipment in Inventory.
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {activeSimulation.validCandidates.map((cand, idx) => {
                    const isSelected = focusedCandidate?.id === cand.id;
                    const candRoom = state.rooms.find(
                      (r) => r.id === cand.proposedRoomId
                    );

                    const scoreBars = [
                      {
                        label: "Time",
                        val: cand.score.timePreservationScore,
                        max: 30,
                      },
                      {
                        label: "Stability",
                        val: cand.score.zeroDisplacementScore,
                        max: 25,
                      },
                      {
                        label: "Cap Fit",
                        val: cand.score.capacityFitScore,
                        max: 15,
                      },
                      {
                        label: "Proximity",
                        val: cand.score.proximityScore,
                        max: 15,
                      },
                      {
                        label: "Reuse",
                        val: cand.score.resourceReuseScore,
                        max: 15,
                      },
                    ];

                    return (
                      <div
                        key={cand.id}
                        onClick={() => setSelectedCandidateId(cand.id)}
                        className={`p-5 rounded-2xl border-2 transition-all cursor-pointer ${
                          isSelected
                            ? "ops-card border-accent-cyan ops-glow-cyan"
                            : "ops-card border-canvas-border hover:border-canvas-borderStrong"
                        }`}
                      >
                        <div className="flex items-center justify-between gap-3">
                          <div className="flex items-center gap-3">
                            <ScoreRing score={cand.score.totalScore} />
                            <div>
                              <div className="flex items-center gap-2">
                                <span
                                  className={`px-2 py-0.5 rounded font-mono text-[10px] font-bold ${
                                    idx === 0
                                      ? "bg-accent-cyan text-slate-950"
                                      : "bg-canvas-surface border border-canvas-border text-slate-300"
                                  }`}
                                >
                                  RANK #{idx + 1}
                                </span>
                                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                                  ALL CONSTRAINTS PASS
                                </span>
                              </div>
                              <h4 className="text-base font-bold text-slate-100 mt-1">
                                {cand.label}
                              </h4>
                            </div>
                          </div>

                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              commitCandidatePlan(
                                activeSimulation.disruption,
                                cand
                              );
                            }}
                            className="px-4 py-2.5 rounded-xl bg-accent-cyan hover:bg-accent-cyanBright text-slate-950 font-bold text-xs flex items-center gap-1.5 shadow-lg shadow-accent-cyan/20 transition-all shrink-0"
                          >
                            <CheckCircle2 className="w-4 h-4" />
                            Approve & Apply
                          </button>
                        </div>

                        {/* Visual Diff Pills */}
                        <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                          {cand.deltas.map((d, dIdx) => (
                            <div
                              key={dIdx}
                              className="p-2.5 rounded-xl bg-canvas-surface/90 border border-canvas-border text-xs flex items-center justify-between gap-2"
                            >
                              <span className="text-[10px] font-mono uppercase text-slate-400 shrink-0">
                                {d.label}
                              </span>
                              <div className="flex items-center gap-1.5 truncate font-mono text-[11px]">
                                <span className="text-slate-400 truncate">
                                  {d.before}
                                </span>
                                <ArrowRight className="w-3 h-3 text-accent-cyanBright shrink-0" />
                                <span className="text-emerald-300 font-bold truncate">
                                  {d.after}
                                </span>
                              </div>
                            </div>
                          ))}
                        </div>

                        {/* 5 Visual Score Progress Bars */}
                        <div className="mt-4 pt-3 border-t border-canvas-border grid grid-cols-5 gap-2.5 text-center font-mono text-[11px]">
                          {scoreBars.map((sb) => (
                            <div
                              key={sb.label}
                              className="p-2 rounded-lg bg-canvas-surface/70 border border-canvas-border/60"
                            >
                              <div className="flex items-center justify-between text-[10px] text-slate-400 mb-1">
                                <span>{sb.label}</span>
                                <span className="text-slate-200 font-bold">
                                  {sb.val}/{sb.max}
                                </span>
                              </div>
                              <div className="h-1.5 w-full rounded-full bg-canvas-elevated overflow-hidden">
                                <div
                                  className="h-full bg-accent-cyan rounded-full"
                                  style={{
                                    width: `${Math.round(
                                      (sb.val / sb.max) * 100
                                    )}%`,
                                  }}
                                />
                              </div>
                            </div>
                          ))}
                        </div>

                        {/* Concise Pros & Trade-offs Chips */}
                        <div className="mt-3 flex flex-wrap items-center gap-2 text-[11px]">
                          {cand.score.rankingReasons.slice(0, 2).map((r, rIdx) => (
                            <span
                              key={rIdx}
                              className="px-2.5 py-1 rounded-lg bg-emerald-500/10 border border-emerald-500/25 text-emerald-300 flex items-center gap-1.5"
                            >
                              <CheckCircle2 className="w-3 h-3 shrink-0" />
                              {r}
                            </span>
                          ))}
                          {cand.score.tradeoffs.map((t, tIdx) => (
                            <span
                              key={tIdx}
                              className="px-2.5 py-1 rounded-lg bg-amber-500/10 border border-amber-500/25 text-amber-300 flex items-center gap-1.5"
                            >
                              <AlertTriangle className="w-3 h-3 shrink-0" />
                              {t}
                            </span>
                          ))}
                          <span className="ml-auto font-mono text-slate-400">
                            {candRoom?.code} • +{cand.proposedTurnaroundMinutes}m
                            buffer
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Right 5 Columns: Compact Rejected Candidates List */}
            <div className="lg:col-span-5 space-y-4">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-200 flex items-center gap-2">
                <XCircle className="w-4 h-4 text-red-400" />
                Filtered Invalid Options ({activeSimulation.rejectedAttempts.length})
              </h3>

              <div className="space-y-2.5">
                {activeSimulation.rejectedAttempts.map((rej) => (
                  <div
                    key={rej.id}
                    className="p-3.5 rounded-xl ops-card border border-red-500/30 space-y-2"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-bold text-slate-200 truncate">
                        {rej.attemptedLabel}
                      </span>
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-red-500/20 text-red-300 border border-red-500/30 shrink-0">
                        REJECTED
                      </span>
                    </div>
                    <div className="space-y-1">
                      {rej.violations.map((v, i) => (
                        <div
                          key={i}
                          className="flex items-center gap-2 text-[11px] text-red-200/90"
                        >
                          <span className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-red-950 text-red-300 border border-red-500/30 shrink-0">
                            {v.code}
                          </span>
                          <span className="truncate">{v.message}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
