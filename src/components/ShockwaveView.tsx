"use client";

import React, { useMemo, useState } from "react";
import { useAutopilot } from "@/context/AutopilotContext";
import { inspectEventDependencies } from "@/domain/shockwave";
import { DEMO_PRIMARY_DATE } from "@/domain/seedData";
import { CandidatePlan, Disruption, DisruptionType } from "@/domain/types";
import { formatCurrency, formatTimeRange } from "@/lib/utils";
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
} from "lucide-react";

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
        title: `Assigned Room Unavailable: ${room?.name ?? "Venue"} Outage`,
        description: `${
          room?.name ?? "Assigned room"
        } (${room?.code}) locked due to 3-phase power breaker trip during ${
          targetBkg?.setupStartIso.slice(11, 16) ?? "10:30"
        }–14:00.`,
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
        title: `Attendance Surge to ${surgeVal} Registered Participants`,
        description: `Expected attendance for "${targetEv.title}" increased from ${targetEv.expectedAttendance} to ${surgeVal}, exceeding ${room?.name} capacity (${room?.capacity}).`,
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
        title: `Lead Mentor Unavailable (${mentor?.name ?? leadMentorId})`,
        description: `${
          mentor?.name ?? "Assigned mentor"
        } called into emergency accreditation review during ${
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
        title: "Organizer Requests Schedule Shift to 13:30–15:00",
        description: `"${targetEv.title}" shifted to 13:30–15:00, colliding with afternoon mentor & equipment commitments.`,
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
        title: `Equipment Pool Reduction (${resObj?.name ?? targetResId})`,
        description: `5 units of ${
          resObj?.name ?? "Robotics Kits"
        } quarantined for battery firmware fault; operational pool reduced to 6 units (below required 8).`,
        targetEventId: targetEv.id,
        targetResourceId: targetResId,
        reducedResourceQty: 6,
        createdAtIso: new Date().toISOString(),
      };
    } else {
      disr = {
        id: `disr-can-${Date.now()}`,
        type: "BOOKING_CANCELLED",
        title: `Booking Cancellation: ${targetEv.title}`,
        description: `Simulating full cancellation of "${targetEv.title}" and immediate release of room, equipment, and mentors.`,
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
      {/* Top Signature Control Header */}
      <div className="p-5 rounded-xl bg-gradient-to-r from-canvas-elevated via-canvas-surface to-canvas-elevated border border-accent-cyan/40 shadow-xl flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="px-2 py-0.5 rounded bg-accent-cyan text-slate-950 font-mono text-[11px] font-bold">
              SIGNATURE ENGINE
            </span>
            <span className="text-xs font-mono text-accent-cyanBright">
              DETERMINISTIC CONSTRAINT SOLVER & RECONFIGURATION
            </span>
          </div>
          <h1 className="text-xl font-bold text-slate-100">
            Campus Shockwave — Disruption & Recovery Orchestrator
          </h1>
          <p className="text-xs text-slate-300 max-w-2xl">
            Inject real-world operational disruptions on a simulation clone of
            campus state, trace affected dependency networks, reject invalid
            options, compare ranked recovery plans, and commit changes
            atomically.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
          <button
            onClick={() => {
              setShockwaveTargetEventId("evt-robotics-workshop");
              buildAndRunDisruption("ROOM_UNAVAILABLE");
            }}
            className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-accent-cyan hover:bg-accent-cyanBright text-slate-950 font-bold text-xs shadow-lg shadow-accent-cyan/20 transition-all"
          >
            <Play className="w-4 h-4 fill-current" />
            1-Click Demo: Assigned Room Unavailable
          </button>

          <button
            onClick={() => {
              resetDemoScenario();
            }}
            className="flex items-center gap-1.5 px-3.5 py-2.5 rounded-lg bg-canvas-surface hover:bg-canvas-hover border border-canvas-border text-xs font-medium text-slate-200 transition-colors"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Reset Demo Baseline
          </button>
        </div>
      </div>

      {/* Before-vs-After Atomic Approval Confirmation Banner (Shown right after approval) */}
      {latestApproval && (
        <div className="p-5 rounded-xl bg-emerald-950/30 border-2 border-emerald-500/60 shadow-xl space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-emerald-500/30 pb-3">
            <div className="flex items-center gap-2.5">
              <CheckCircle2 className="w-6 h-6 text-emerald-400 shrink-0" />
              <div>
                <h2 className="text-base font-bold text-emerald-300">
                  Recovery Plan Approved & Atomically Applied to Campus State
                </h2>
                <p className="text-xs text-slate-300">
                  Approval ID:{" "}
                  <span className="font-mono">{latestApproval.id}</span> •
                  State Version{" "}
                  <span className="font-mono">v{state.stateVersion}</span> • All
                  hard constraints verified
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setActiveSection("TIMELINE")}
                className="px-3 py-1.5 rounded-lg bg-emerald-500 text-slate-950 font-bold text-xs hover:bg-emerald-400 transition-colors"
              >
                Inspect Updated Timeline →
              </button>
              <button
                onClick={() => setActiveSection("AUDIT_LOG")}
                className="px-3 py-1.5 rounded-lg bg-canvas-surface border border-canvas-border text-xs text-slate-200 hover:bg-canvas-hover"
              >
                View Audit Record
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-3.5 rounded-lg bg-canvas-elevated/90 border border-canvas-border">
              <div className="text-[11px] font-mono uppercase text-slate-400">
                Before Disruption
              </div>
              <div className="text-sm font-semibold text-slate-200 mt-1">
                {latestApproval.beforeSnapshot.roomName}
              </div>
              <div className="text-xs font-mono text-slate-400 mt-0.5">
                {formatTimeRange(
                  latestApproval.beforeSnapshot.startIso,
                  latestApproval.beforeSnapshot.endIso
                )}
              </div>
            </div>

            <div className="p-3.5 rounded-lg bg-emerald-950/40 border border-emerald-500/40">
              <div className="text-[11px] font-mono uppercase text-emerald-300">
                After Atomic Reallocation
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

            <div className="p-3.5 rounded-lg bg-canvas-elevated/90 border border-canvas-border space-y-1">
              <div className="text-[11px] font-mono uppercase text-slate-400">
                Committed Delta Summary
              </div>
              {latestApproval.deltas.map((d, i) => (
                <div key={i} className="text-xs text-slate-200">
                  <span className="text-slate-400">{d.label}:</span>{" "}
                  <span className="line-through text-slate-500 mr-1">
                    {d.before}
                  </span>
                  <span className="text-emerald-300 font-medium">
                    → {d.after}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Step 1 & Step 2 Grid: Target Event Dependency Network + Disruption Trigger Controls */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left 5 Columns: Event Selector & Live Dependency Network */}
        <div className="lg:col-span-5 rounded-xl bg-canvas-elevated border border-canvas-border p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-100 uppercase tracking-wider flex items-center gap-2">
              <Network className="w-4 h-4 text-accent-cyanBright" />
              1. Target Event & Dependency Graph
            </h2>
          </div>

          <div>
            <label className="block text-xs text-slate-400 mb-1">
              Select Active Campus Event to Inspect / Disrupt
            </label>
            <select
              value={shockwaveTargetEventId}
              onChange={(e) => {
                setShockwaveTargetEventId(e.target.value);
                setActiveSimulation(null);
              }}
              className="w-full px-3 py-2 rounded-lg bg-canvas-surface border border-canvas-border text-xs font-semibold text-slate-100 focus:outline-none focus:border-accent-cyan"
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
          </div>

          {dependencyGraph ? (
            <div className="space-y-3">
              {/* Venue & Schedule Node */}
              <div className="p-3.5 rounded-lg bg-canvas-surface border border-canvas-border space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-400 flex items-center gap-1.5">
                    <Building2 className="w-3.5 h-3.5 text-accent-cyanBright" />
                    Current Venue
                  </span>
                  <span className="font-semibold text-slate-100">
                    {dependencyGraph.roomName}
                  </span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-400 flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5 text-amber-400" />
                    Scheduled Slot
                  </span>
                  <span className="font-mono text-slate-200">
                    {dependencyGraph.timeRangeLabel}
                  </span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-400 flex items-center gap-1.5">
                    <Users className="w-3.5 h-3.5 text-emerald-400" />
                    Attendance Requirement
                  </span>
                  <span className="font-mono text-slate-200">
                    {dependencyGraph.event.expectedAttendance} participants
                  </span>
                </div>
              </div>

              {/* Equipment Dependencies */}
              <div className="p-3.5 rounded-lg bg-canvas-surface border border-canvas-border space-y-2">
                <div className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                  <Cpu className="w-3.5 h-3.5 text-accent-cyanBright" />
                  Connected Equipment Allocations (
                  {dependencyGraph.allocatedResources.length})
                </div>
                {dependencyGraph.allocatedResources.map((res) => (
                  <div
                    key={res.resourceId}
                    className="flex items-center justify-between text-xs pt-1 border-t border-canvas-border/60"
                  >
                    <span className="text-slate-300 truncate">{res.name}</span>
                    <span className="font-mono text-accent-cyanBright shrink-0 ml-2">
                      {res.quantity}/{res.operationalPool} units (
                      {formatCurrency(res.replacementValueInr)})
                    </span>
                  </div>
                ))}
              </div>

              {/* Mentor Dependencies */}
              <div className="p-3.5 rounded-lg bg-canvas-surface border border-canvas-border space-y-2">
                <div className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                  Assigned Mentors ({dependencyGraph.assignedPeople.length})
                </div>
                <div className="flex flex-wrap gap-2">
                  {dependencyGraph.assignedPeople.map((p) => (
                    <span
                      key={p.personId}
                      className="text-xs px-2.5 py-1 rounded bg-canvas-elevated border border-canvas-border text-slate-200"
                    >
                      {p.name} ({p.roleTitle})
                    </span>
                  ))}
                </div>
              </div>

              {/* Coupled Campus Events */}
              {dependencyGraph.connectedEvents.length > 0 && (
                <div className="p-3.5 rounded-lg bg-canvas-surface border border-canvas-border space-y-1.5">
                  <div className="text-xs font-semibold text-amber-300">
                    Coupled Same-Day Events Sharing Dependencies (
                    {dependencyGraph.connectedEvents.length})
                  </div>
                  {dependencyGraph.connectedEvents.slice(0, 4).map((ce, i) => (
                    <div
                      key={i}
                      className="text-[11px] text-slate-300 flex items-center justify-between gap-2"
                    >
                      <span className="truncate font-medium">{ce.title}</span>
                      <span className="text-slate-400 font-mono shrink-0">
                        {ce.detail}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div className="p-4 rounded-lg bg-canvas-surface text-xs text-slate-400">
              No active booking found for selected event.
            </div>
          )}
        </div>

        {/* Right 7 Columns: Interactive Disruption Matrix */}
        <div className="lg:col-span-7 rounded-xl bg-canvas-elevated border border-canvas-border p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-100 uppercase tracking-wider flex items-center gap-2">
              <SlidersHorizontal className="w-4 h-4 text-amber-400" />
              2. Select & Inject Operational Disruption
            </h2>
            <span className="text-[11px] font-mono text-slate-400">
              Runs on isolated simulation copy of v{state.stateVersion}
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* Disruption 1: Assigned Room Unavailable */}
            <button
              type="button"
              onClick={() => buildAndRunDisruption("ROOM_UNAVAILABLE")}
              className={`p-3.5 rounded-xl border text-left transition-all ${
                selectedDisruptionType === "ROOM_UNAVAILABLE" &&
                activeSimulation
                  ? "bg-amber-950/30 border-amber-400 text-slate-100 shadow-lg"
                  : "bg-canvas-surface hover:bg-canvas-hover border-canvas-border text-slate-200"
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-amber-300 uppercase font-mono">
                  1. Room Unavailable (Primary Demo)
                </span>
                <Zap className="w-4 h-4 text-amber-400" />
              </div>
              <div className="text-sm font-semibold mt-1">
                Assigned Venue Power / Facility Outage
              </div>
              <p className="text-xs text-slate-400 mt-1">
                Locks {dependencyGraph?.roomName ?? "assigned room"} during the
                scheduled interval and searches campus for valid alternatives.
              </p>
            </button>

            {/* Disruption 2: Attendance Surge */}
            <div
              className={`p-3.5 rounded-xl border text-left transition-all flex flex-col justify-between ${
                selectedDisruptionType === "ATTENDANCE_SURGE" &&
                activeSimulation
                  ? "bg-amber-950/30 border-amber-400 text-slate-100 shadow-lg"
                  : "bg-canvas-surface border-canvas-border text-slate-200"
              }`}
            >
              <div>
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-amber-300 uppercase font-mono">
                    2. Attendance Surge
                  </span>
                  <Users className="w-4 h-4 text-amber-400" />
                </div>
                <div className="text-sm font-semibold mt-1">
                  Participant Demand Exceeds Room Cap
                </div>
              </div>
              <div className="mt-2.5 flex items-center gap-2">
                <input
                  type="number"
                  min={50}
                  max={600}
                  value={customAttendance}
                  onChange={(e) => setCustomAttendance(Number(e.target.value))}
                  aria-label="New surged attendance count"
                  className="w-20 px-2 py-1 rounded bg-canvas-elevated border border-canvas-border text-xs font-mono text-slate-100"
                />
                <button
                  type="button"
                  onClick={() =>
                    buildAndRunDisruption("ATTENDANCE_SURGE", customAttendance)
                  }
                  className="px-2.5 py-1 rounded bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/40 text-amber-200 text-xs font-semibold"
                >
                  Simulate {customAttendance}p
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setCustomAttendance(500);
                    buildAndRunDisruption("ATTENDANCE_SURGE", 500);
                  }}
                  className="px-2 py-1 rounded bg-red-500/20 hover:bg-red-500/30 border border-red-500/40 text-red-200 text-[11px] font-mono"
                  title="Test impossible scenario (500 attendees > max 120 room cap)"
                >
                  500p (Infeasible)
                </button>
              </div>
            </div>

            {/* Disruption 3: Mentor Unavailable */}
            <button
              type="button"
              onClick={() => buildAndRunDisruption("MENTOR_UNAVAILABLE")}
              className={`p-3.5 rounded-xl border text-left transition-all ${
                selectedDisruptionType === "MENTOR_UNAVAILABLE" &&
                activeSimulation
                  ? "bg-amber-950/30 border-amber-400 text-slate-100 shadow-lg"
                  : "bg-canvas-surface hover:bg-canvas-hover border-canvas-border text-slate-200"
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-amber-300 uppercase font-mono">
                  3. Mentor Unavailable
                </span>
                <ShieldCheck className="w-4 h-4 text-amber-400" />
              </div>
              <div className="text-sm font-semibold mt-1">
                Lead Mentor Pulled to Emergency Duty
              </div>
              <p className="text-xs text-slate-400 mt-1">
                Evaluates qualified substitute mentors or time-shifted slots
                where original mentors are free.
              </p>
            </button>

            {/* Disruption 4: Time Shift Conflict */}
            <button
              type="button"
              onClick={() => buildAndRunDisruption("TIME_SHIFT")}
              className={`p-3.5 rounded-xl border text-left transition-all ${
                selectedDisruptionType === "TIME_SHIFT" && activeSimulation
                  ? "bg-amber-950/30 border-amber-400 text-slate-100 shadow-lg"
                  : "bg-canvas-surface hover:bg-canvas-hover border-canvas-border text-slate-200"
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-amber-300 uppercase font-mono">
                  4. Event Time Shift
                </span>
                <Clock className="w-4 h-4 text-amber-400" />
              </div>
              <div className="text-sm font-semibold mt-1">
                Event Shifts into Conflicting Afternoon Window
              </div>
              <p className="text-xs text-slate-400 mt-1">
                Tests shifting event to 13:30–15:00 where Dr. Arjun Mehta is
                committed to the UAV Telemetry Clinic.
              </p>
            </button>

            {/* Disruption 5: Equipment Unavailable */}
            <button
              type="button"
              onClick={() => buildAndRunDisruption("EQUIPMENT_UNAVAILABLE")}
              className={`p-3.5 rounded-xl border text-left transition-all ${
                selectedDisruptionType === "EQUIPMENT_UNAVAILABLE" &&
                activeSimulation
                  ? "bg-amber-950/30 border-amber-400 text-slate-100 shadow-lg"
                  : "bg-canvas-surface hover:bg-canvas-hover border-canvas-border text-slate-200"
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-amber-300 uppercase font-mono">
                  5. Equipment Shortage
                </span>
                <Cpu className="w-4 h-4 text-amber-400" />
              </div>
              <div className="text-sm font-semibold mt-1">
                5 ROS2 Kits Quarantined (Pool Drops to 6)
              </div>
              <p className="text-xs text-slate-400 mt-1">
                Demonstrates hard-constraint enforcement when available units
                drop below the required 8 kits.
              </p>
            </button>

            {/* Disruption 6: Booking Cancelled */}
            <button
              type="button"
              onClick={() => buildAndRunDisruption("BOOKING_CANCELLED")}
              className={`p-3.5 rounded-xl border text-left transition-all ${
                selectedDisruptionType === "BOOKING_CANCELLED" &&
                activeSimulation
                  ? "bg-amber-950/30 border-amber-400 text-slate-100 shadow-lg"
                  : "bg-canvas-surface hover:bg-canvas-hover border-canvas-border text-slate-200"
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-amber-300 uppercase font-mono">
                  6. Booking Cancelled
                </span>
                <XCircle className="w-4 h-4 text-amber-400" />
              </div>
              <div className="text-sm font-semibold mt-1">
                Simulate Event Cancellation & Asset Release
              </div>
              <p className="text-xs text-slate-400 mt-1">
                Traces immediate release of venue, 8× ROS2 kits, 4K projector,
                and mentors back to campus pool.
              </p>
            </button>
          </div>
        </div>
      </div>

      {/* Step 3: Shockwave Simulation Output, Rejected Attempts, and Ranked Candidate Comparison */}
      {activeSimulation && (
        <div className="space-y-6">
          {/* Impact Propagation Summary Bar */}
          <div className="p-5 rounded-xl bg-canvas-elevated border-2 border-amber-500/50 space-y-4">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <AlertTriangle className="w-5 h-5 text-amber-400" />
                  <span className="text-xs font-mono uppercase tracking-wider text-amber-300 font-bold">
                    SHOCKWAVE SIMULATION ACTIVE • STATE SNAPSHOT v
                    {activeSimulation.stateVersion}
                  </span>
                </div>
                <h3 className="text-lg font-bold text-slate-100 mt-1">
                  {activeSimulation.disruption.title}
                </h3>
                <p className="text-xs text-slate-300 mt-0.5">
                  {activeSimulation.summaryExplanation}
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-3 font-mono text-xs shrink-0">
                <div className="px-3 py-2 rounded-lg bg-red-950/40 border border-red-500/40 text-red-200">
                  Direct Conflicts:{" "}
                  <strong>
                    {activeSimulation.directlyAffectedEventIds.length}
                  </strong>
                </div>
                <div className="px-3 py-2 rounded-lg bg-amber-950/40 border border-amber-500/40 text-amber-200">
                  Coupled Events:{" "}
                  <strong>
                    {activeSimulation.indirectlyAffectedEventIds.length}
                  </strong>
                </div>
                <div className="px-3 py-2 rounded-lg bg-emerald-950/40 border border-emerald-500/40 text-emerald-200">
                  Valid Candidates:{" "}
                  <strong>{activeSimulation.validCandidates.length}</strong>
                </div>
                <button
                  type="button"
                  onClick={() => setActiveSimulation(null)}
                  className="px-3 py-2 rounded-lg bg-canvas-surface hover:bg-canvas-hover border border-canvas-border text-slate-300 hover:text-slate-100 font-sans font-medium"
                >
                  Reject / Dismiss Proposal
                </button>
              </div>
            </div>

            {/* Original Plan Hard Constraint Violations */}
            {activeSimulation.originalViolations.length > 0 && (
              <div className="p-3.5 rounded-lg bg-red-950/35 border border-red-500/40 space-y-1.5">
                <div className="text-xs font-semibold uppercase tracking-wider text-red-300">
                  Why the Original Plan Breaks Under This Disruption:
                </div>
                {activeSimulation.originalViolations.map((v, idx) => (
                  <div key={idx} className="text-xs text-red-100 flex items-center gap-2">
                    <span className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-red-500/30 text-red-200">
                      {v.code}
                    </span>
                    <span>{v.message}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Candidate Comparison & Rejected Options Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Left 7 Columns: Ranked Feasible Candidate Plans */}
            <div className="lg:col-span-7 space-y-4">
              <h3 className="text-sm font-semibold uppercase tracking-wider text-slate-200 flex items-center gap-2">
                <GitCompare className="w-4 h-4 text-accent-cyanBright" />
                Ranked Feasible Recovery Plans (
                {activeSimulation.validCandidates.length})
              </h3>

              {activeSimulation.validCandidates.length === 0 ? (
                <div className="p-6 rounded-xl bg-red-950/25 border border-red-500/40 space-y-3">
                  <div className="flex items-center gap-2 text-red-300 font-bold text-sm">
                    <XCircle className="w-5 h-5" />
                    NO FEASIBLE RECOVERY PLAN EXISTS
                  </div>
                  <p className="text-xs text-slate-300 leading-relaxed">
                    Every candidate room and time slot across campus violated at
                    least one hard constraint (see right column for exact
                    rejection diagnostics). Reduce attendance or restore
                    quarantined equipment in Resource Inventory to recover.
                  </p>
                </div>
              ) : (
                <div className="space-y-3.5">
                  {activeSimulation.validCandidates.map((cand, idx) => {
                    const isSelected = focusedCandidate?.id === cand.id;
                    const candRoom = state.rooms.find(
                      (r) => r.id === cand.proposedRoomId
                    );

                    return (
                      <div
                        key={cand.id}
                        onClick={() => setSelectedCandidateId(cand.id)}
                        className={`p-4 rounded-xl border-2 transition-all cursor-pointer ${
                          isSelected
                            ? "bg-canvas-surface border-accent-cyan shadow-lg"
                            : "bg-canvas-elevated hover:bg-canvas-surface border-canvas-border"
                        }`}
                      >
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                          <div className="flex items-center gap-2.5">
                            <span
                              className={`px-2 py-0.5 rounded font-mono text-xs font-bold ${
                                idx === 0
                                  ? "bg-accent-cyan text-slate-950"
                                  : "bg-canvas-elevated border border-canvas-border text-slate-300"
                              }`}
                            >
                              RANK #{idx + 1}
                            </span>
                            <h4 className="text-base font-bold text-slate-100">
                              {cand.label}
                            </h4>
                          </div>

                          <div className="flex items-center gap-2">
                            <span className="text-xs font-mono px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                              HARD CONSTRAINTS PASS
                            </span>
                            <span className="text-sm font-mono font-bold text-accent-cyanBright">
                              {cand.score.totalScore}/100
                            </span>
                          </div>
                        </div>

                        {/* Delta Pills */}
                        <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-2">
                          {cand.deltas.map((d, dIdx) => (
                            <div
                              key={dIdx}
                              className="p-2 rounded-lg bg-canvas-elevated border border-canvas-border text-xs"
                            >
                              <div className="text-[10px] font-mono uppercase text-slate-400">
                                {d.label}
                              </div>
                              <div className="mt-0.5 flex items-center gap-1.5 truncate">
                                <span className="text-slate-400 truncate">
                                  {d.before}
                                </span>
                                <ArrowRight className="w-3 h-3 text-accent-cyanBright shrink-0" />
                                <span className="text-slate-100 font-semibold truncate">
                                  {d.after}
                                </span>
                              </div>
                            </div>
                          ))}
                        </div>

                        {/* Transparent Score Bar */}
                        <div className="mt-3 pt-3 border-t border-canvas-border grid grid-cols-5 gap-2 text-center font-mono text-[11px]">
                          <div className="p-1.5 rounded bg-canvas-elevated">
                            <div className="text-slate-400">Time</div>
                            <div className="text-slate-200 font-semibold">
                              {cand.score.timePreservationScore}/30
                            </div>
                          </div>
                          <div className="p-1.5 rounded bg-canvas-elevated">
                            <div className="text-slate-400">Stability</div>
                            <div className="text-slate-200 font-semibold">
                              {cand.score.zeroDisplacementScore}/25
                            </div>
                          </div>
                          <div className="p-1.5 rounded bg-canvas-elevated">
                            <div className="text-slate-400">Cap Fit</div>
                            <div className="text-slate-200 font-semibold">
                              {cand.score.capacityFitScore}/15
                            </div>
                          </div>
                          <div className="p-1.5 rounded bg-canvas-elevated">
                            <div className="text-slate-400">Proximity</div>
                            <div className="text-slate-200 font-semibold">
                              {cand.score.proximityScore}/15
                            </div>
                          </div>
                          <div className="p-1.5 rounded bg-canvas-elevated">
                            <div className="text-slate-400">Reuse</div>
                            <div className="text-slate-200 font-semibold">
                              {cand.score.resourceReuseScore}/15
                            </div>
                          </div>
                        </div>

                        {/* Ranking Reasons & Tradeoffs */}
                        <div className="mt-3 space-y-1 text-xs">
                          {cand.score.rankingReasons.map((r, rIdx) => (
                            <div
                              key={rIdx}
                              className="text-emerald-300 flex items-center gap-1.5"
                            >
                              <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                              <span>{r}</span>
                            </div>
                          ))}
                          {cand.score.tradeoffs.map((t, tIdx) => (
                            <div
                              key={tIdx}
                              className="text-amber-300/90 flex items-center gap-1.5"
                            >
                              <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                              <span>Trade-off: {t}</span>
                            </div>
                          ))}
                        </div>

                        {/* Approve Button */}
                        <div className="mt-4 flex items-center justify-between pt-3 border-t border-canvas-border">
                          <span className="text-[11px] font-mono text-slate-400">
                            Turnaround: +{cand.proposedTurnaroundMinutes}m (until{" "}
                            {cand.proposedTurnaroundEndIso.slice(11, 16)}) •{" "}
                            {candRoom?.code}
                          </span>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              commitCandidatePlan(
                                activeSimulation.disruption,
                                cand
                              );
                            }}
                            className="px-4 py-2 rounded-lg bg-accent-cyan hover:bg-accent-cyanBright text-slate-950 font-bold text-xs flex items-center gap-1.5 shadow-md transition-all"
                          >
                            <CheckCircle2 className="w-4 h-4" />
                            Approve & Apply Plan #{idx + 1}
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Right 5 Columns: Rejected Candidates & Constraint Explanations */}
            <div className="lg:col-span-5 space-y-4">
              <h3 className="text-sm font-semibold uppercase tracking-wider text-slate-200 flex items-center gap-2">
                <XCircle className="w-4 h-4 text-red-400" />
                Why Other Candidates Were Rejected (
                {activeSimulation.rejectedAttempts.length})
              </h3>

              <div className="space-y-3">
                {activeSimulation.rejectedAttempts.map((rej) => (
                  <div
                    key={rej.id}
                    className="p-3.5 rounded-xl bg-canvas-elevated border border-red-500/30 space-y-2"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-slate-200">
                        {rej.attemptedLabel}
                      </span>
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-red-500/20 text-red-300 border border-red-500/30">
                        REJECTED
                      </span>
                    </div>
                    <ul className="space-y-1 text-xs text-red-200/90">
                      {rej.violations.map((v, i) => (
                        <li key={i} className="flex items-start gap-1.5">
                          <span className="font-mono text-[10px] text-red-400 shrink-0 mt-0.5">
                            [{v.code}]
                          </span>
                          <span>{v.message}</span>
                        </li>
                      ))}
                    </ul>
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
