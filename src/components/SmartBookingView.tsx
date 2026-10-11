"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useAutopilot } from "@/context/AutopilotContext";
import {
  addMinutesToIso,
  evaluateRequestFeasibility,
  getAvailableResourceQuantity,
} from "@/domain/engine";
import { DEMO_PRIMARY_DATE, FACILITY_LABELS } from "@/domain/seedData";
import {
  BookingDraftInput,
  EventCategory,
  EventPriority,
  FacilityType,
} from "@/domain/types";
import { formatCurrency } from "@/lib/utils";
import {
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Sparkles,
  Clock,
  Users,
  Cpu,
  UserCheck,
  Building2,
  ArrowRight,
  RotateCcw,
  BookmarkCheck,
} from "lucide-react";

const ALL_FACILITIES: FacilityType[] = [
  "PROJECTOR_4K",
  "WORKBENCHES",
  "POWER_GRID_HIGH",
  "PA_AUDIO",
  "WHITEBOARD_WALL",
  "RECORDING_RIG",
  "GPU_WORKSTATIONS",
  "ACCESSIBLE_STAGE",
  "HVAC_HEAVY",
];

function createDefaultDraft(dateStr: string): BookingDraftInput {
  return {
    title: "Autonomous Swarm Navigation & Sensor Fusion Lab",
    description:
      "Practical workshop on multi-robot ROS2 Humble coordination, RPLiDAR mapping, and onboard telemetry.",
    organizer: "STRATOS Robotics & METSAC Technical Council",
    category: "WORKSHOP",
    priority: "HIGH",
    dateStr,
    startTimeStr: "14:00",
    durationMinutes: 90,
    expectedAttendance: 75,
    preferredRoomId: "rm-turing-hall",
    requiredFacilities: ["PROJECTOR_4K", "WORKBENCHES", "POWER_GRID_HIGH"],
    requiredResources: [
      { resourceId: "res-ros-kit", quantity: 8 },
      { resourceId: "res-laser-proj", quantity: 1 },
    ],
    requiredPeopleIds: ["per-arjun", "per-kavya"],
    setupMinutes: 15,
    cleanupMinutes: 15,
    requiresExtendedTurnaround: false,
    overrideTurnaroundReason: "",
  };
}

export function SmartBookingView() {
  const {
    state,
    selectedDate,
    bookingPrefill,
    setBookingPrefill,
    submitBooking,
    setActiveSection,
    pushToast,
  } = useAutopilot();

  const [draft, setDraft] = useState<BookingDraftInput>(() =>
    createDefaultDraft(selectedDate)
  );
  const [savedDraftNote, setSavedDraftNote] = useState<string | null>(null);

  useEffect(() => {
    if (bookingPrefill) {
      setDraft((prev) => ({
        ...prev,
        ...bookingPrefill,
      }));
      setBookingPrefill(null);
    }
  }, [bookingPrefill, setBookingPrefill]);

  const startIso = `${draft.dateStr}T${draft.startTimeStr}:00`;
  const endIso = addMinutesToIso(startIso, draft.durationMinutes);

  const feasibility = useMemo(() => {
    return evaluateRequestFeasibility(
      state,
      {
        roomId: draft.preferredRoomId,
        startIso,
        endIso,
        setupMinutes: draft.setupMinutes,
        cleanupMinutes: draft.cleanupMinutes,
        expectedAttendance: draft.expectedAttendance,
        requiredFacilities: draft.requiredFacilities,
        requiredResources: draft.requiredResources,
        requiredPeopleIds: draft.requiredPeopleIds,
        requiresExtendedTurnaround: draft.requiresExtendedTurnaround,
        overrideTurnaroundReason: draft.overrideTurnaroundReason,
      },
      true
    );
  }, [state, draft, startIso, endIso]);

  // Compute concrete alternative rooms/slots when current selection is infeasible
  const concreteAlternatives = useMemo(() => {
    if (feasibility.isFeasible) return [];
    const results: Array<{
      roomId: string;
      roomName: string;
      roomCap: number;
      startTimeStr: string;
      reason: string;
    }> = [];

    // 1. Check other rooms at the exact requested time
    for (const altRoom of state.rooms) {
      if (altRoom.id === draft.preferredRoomId) continue;
      const check = evaluateRequestFeasibility(
        state,
        {
          roomId: altRoom.id,
          startIso,
          endIso,
          setupMinutes: draft.setupMinutes,
          cleanupMinutes: draft.cleanupMinutes,
          expectedAttendance: draft.expectedAttendance,
          requiredFacilities: draft.requiredFacilities,
          requiredResources: draft.requiredResources,
          requiredPeopleIds: draft.requiredPeopleIds,
          requiresExtendedTurnaround: draft.requiresExtendedTurnaround,
        },
        false
      );
      if (check.isFeasible) {
        results.push({
          roomId: altRoom.id,
          roomName: altRoom.name,
          roomCap: altRoom.capacity,
          startTimeStr: draft.startTimeStr,
          reason: `Same time (${draft.startTimeStr}), satisfies ${draft.expectedAttendance} seats & all ${draft.requiredFacilities.length} facilities`,
        });
      }
    }

    // 2. Check other time slots on the same day
    const candidateTimes = ["09:00", "11:00", "13:30", "14:30", "16:00"];
    for (const tStr of candidateTimes) {
      if (tStr === draft.startTimeStr) continue;
      const sIso = `${draft.dateStr}T${tStr}:00`;
      const eIso = addMinutesToIso(sIso, draft.durationMinutes);
      for (const altRoom of state.rooms) {
        const check = evaluateRequestFeasibility(
          state,
          {
            roomId: altRoom.id,
            startIso: sIso,
            endIso: eIso,
            setupMinutes: draft.setupMinutes,
            cleanupMinutes: draft.cleanupMinutes,
            expectedAttendance: draft.expectedAttendance,
            requiredFacilities: draft.requiredFacilities,
            requiredResources: draft.requiredResources,
            requiredPeopleIds: draft.requiredPeopleIds,
            requiresExtendedTurnaround: draft.requiresExtendedTurnaround,
          },
          false
        );
        if (check.isFeasible) {
          results.push({
            roomId: altRoom.id,
            roomName: altRoom.name,
            roomCap: altRoom.capacity,
            startTimeStr: tStr,
            reason: `Available at ${tStr} in ${altRoom.name} (Cap ${altRoom.capacity})`,
          });
          if (results.length >= 4) return results;
        }
      }
    }
    return results.slice(0, 4);
  }, [state, draft, feasibility.isFeasible, startIso, endIso]);

  const toggleFacility = (fac: FacilityType) => {
    setDraft((prev) => ({
      ...prev,
      requiredFacilities: prev.requiredFacilities.includes(fac)
        ? prev.requiredFacilities.filter((f) => f !== fac)
        : [...prev.requiredFacilities, fac],
    }));
  };

  const togglePerson = (personId: string) => {
    setDraft((prev) => ({
      ...prev,
      requiredPeopleIds: prev.requiredPeopleIds.includes(personId)
        ? prev.requiredPeopleIds.filter((id) => id !== personId)
        : [...prev.requiredPeopleIds, personId],
    }));
  };

  const updateResourceQuantity = (resourceId: string, qty: number) => {
    setDraft((prev) => {
      const filtered = prev.requiredResources.filter(
        (r) => r.resourceId !== resourceId
      );
      if (qty > 0) {
        filtered.push({ resourceId, quantity: qty });
      }
      return { ...prev, requiredResources: filtered };
    });
  };

  const handleConfirm = (e: React.FormEvent) => {
    e.preventDefault();
    const res = submitBooking(draft);
    if (res.ok) {
      setActiveSection("TIMELINE");
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Scenario Preset Bar for Instant Validation Testing */}
      <div className="p-4 rounded-xl bg-canvas-elevated border border-canvas-border flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h1 className="text-lg font-bold text-slate-100">
            Smart Booking & Constraint Verification Engine
          </h1>
          <p className="text-xs text-slate-400">
            Every change evaluates room capacity, facility infrastructure,
            equipment pools, mentor commitments, setup/cleanup, and turnaround
            buffers in real time.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() =>
              setDraft({
                title: "Autonomous Robotics Systems Workshop",
                description:
                  "Hands-on HackSAC flagship session on ROS2 navigation stacks, LiDAR SLAM mapping, and multi-agent path planning.",
                organizer: "Team STRATOS & METSAC Robotics Society",
                category: "WORKSHOP",
                priority: "CRITICAL",
                dateStr: DEMO_PRIMARY_DATE,
                startTimeStr: "15:00",
                durationMinutes: 90,
                expectedAttendance: 80,
                preferredRoomId: "rm-turing-hall",
                requiredFacilities: [
                  "PROJECTOR_4K",
                  "WORKBENCHES",
                  "POWER_GRID_HIGH",
                ],
                requiredResources: [
                  { resourceId: "res-ros-kit", quantity: 8 },
                  { resourceId: "res-laser-proj", quantity: 1 },
                ],
                requiredPeopleIds: ["per-arjun", "per-kavya"],
                setupMinutes: 15,
                cleanupMinutes: 15,
                requiresExtendedTurnaround: false,
                overrideTurnaroundReason: "",
              })
            }
            className="px-3 py-1.5 rounded-lg bg-accent-cyan/15 border border-accent-cyan/40 text-accent-cyanBright text-xs font-semibold hover:bg-accent-cyan/25 transition-colors flex items-center gap-1.5"
          >
            <Sparkles className="w-3.5 h-3.5" />
            Preset: Feasible Robotics Workshop (80p, 8 Kits)
          </button>

          <button
            type="button"
            onClick={() =>
              setDraft((prev) => ({
                ...prev,
                preferredRoomId: "rm-lovelace-lab", // Cap 60
                expectedAttendance: 80,
                startTimeStr: "14:00",
              }))
            }
            className="px-3 py-1.5 rounded-lg bg-canvas-surface hover:bg-canvas-hover border border-canvas-border text-xs text-amber-300 transition-colors"
          >
            Test: Insufficient Capacity (80p in Cap 60)
          </button>

          <button
            type="button"
            onClick={() =>
              setDraft((prev) => ({
                ...prev,
                preferredRoomId: "rm-turing-hall",
                dateStr: DEMO_PRIMARY_DATE,
                startTimeStr: "13:05", // setupStart 12:50 overlaps 13:00 turnaround of 11:00-12:30 workshop
                setupMinutes: 15,
              }))
            }
            className="px-3 py-1.5 rounded-lg bg-canvas-surface hover:bg-canvas-hover border border-canvas-border text-xs text-red-300 transition-colors"
          >
            Test: 15m Turnaround Violation
          </button>
        </div>
      </div>

      <form
        onSubmit={handleConfirm}
        className="grid grid-cols-1 lg:grid-cols-12 gap-6"
      >
        {/* Left 7 Columns: Guided Specification Inputs */}
        <div className="lg:col-span-7 space-y-5">
          {/* 1. Event Identity & Priority */}
          <div className="p-5 rounded-xl bg-canvas-elevated border border-canvas-border space-y-4">
            <h2 className="text-sm font-semibold text-slate-100 uppercase tracking-wider">
              1. Event Identity & Priority
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="sm:col-span-2">
                <label className="block text-xs text-slate-400 mb-1">
                  Event Title *
                </label>
                <input
                  type="text"
                  required
                  value={draft.title}
                  onChange={(e) =>
                    setDraft((p) => ({ ...p, title: e.target.value }))
                  }
                  className="w-full px-3 py-2 rounded-lg bg-canvas-surface border border-canvas-border text-sm text-slate-100 focus:outline-none focus:border-accent-cyan"
                />
              </div>

              <div>
                <label className="block text-xs text-slate-400 mb-1">
                  Priority Level
                </label>
                <select
                  value={draft.priority}
                  onChange={(e) =>
                    setDraft((p) => ({
                      ...p,
                      priority: e.target.value as EventPriority,
                    }))
                  }
                  className="w-full px-3 py-2 rounded-lg bg-canvas-surface border border-canvas-border text-sm text-slate-100 focus:outline-none focus:border-accent-cyan"
                >
                  <option value="CRITICAL">CRITICAL</option>
                  <option value="HIGH">HIGH</option>
                  <option value="STANDARD">STANDARD</option>
                  <option value="LOW">LOW</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs text-slate-400 mb-1">
                  Organizer / Club
                </label>
                <input
                  type="text"
                  value={draft.organizer}
                  onChange={(e) =>
                    setDraft((p) => ({ ...p, organizer: e.target.value }))
                  }
                  className="w-full px-3 py-2 rounded-lg bg-canvas-surface border border-canvas-border text-sm text-slate-100 focus:outline-none focus:border-accent-cyan"
                />
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1">
                  Event Category
                </label>
                <select
                  value={draft.category}
                  onChange={(e) =>
                    setDraft((p) => ({
                      ...p,
                      category: e.target.value as EventCategory,
                    }))
                  }
                  className="w-full px-3 py-2 rounded-lg bg-canvas-surface border border-canvas-border text-sm text-slate-100 focus:outline-none focus:border-accent-cyan"
                >
                  <option value="WORKSHOP">WORKSHOP</option>
                  <option value="HACKATHON_SESSION">HACKATHON SESSION</option>
                  <option value="LECTURE">LECTURE</option>
                  <option value="LAB_PRACTICAL">LAB PRACTICAL</option>
                  <option value="COMPETITION">COMPETITION</option>
                  <option value="CLUB_MEET">CLUB MEET</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-xs text-slate-400 mb-1">
                Operational Description
              </label>
              <textarea
                rows={2}
                value={draft.description}
                onChange={(e) =>
                  setDraft((p) => ({ ...p, description: e.target.value }))
                }
                className="w-full px-3 py-2 rounded-lg bg-canvas-surface border border-canvas-border text-xs text-slate-200 focus:outline-none focus:border-accent-cyan"
              />
            </div>
          </div>

          {/* 2. Schedule, Buffers & Room Selection */}
          <div className="p-5 rounded-xl bg-canvas-elevated border border-canvas-border space-y-4">
            <h2 className="text-sm font-semibold text-slate-100 uppercase tracking-wider flex items-center gap-2">
              <Clock className="w-4 h-4 text-accent-cyanBright" />
              2. Schedule, Venue & Buffer Policy
            </h2>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div>
                <label className="block text-xs text-slate-400 mb-1">Date</label>
                <input
                  type="date"
                  value={draft.dateStr}
                  onChange={(e) =>
                    setDraft((p) => ({ ...p, dateStr: e.target.value }))
                  }
                  className="w-full px-2.5 py-2 rounded-lg bg-canvas-surface border border-canvas-border text-xs font-mono text-slate-100"
                />
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1">
                  Start Time
                </label>
                <input
                  type="time"
                  value={draft.startTimeStr}
                  onChange={(e) =>
                    setDraft((p) => ({ ...p, startTimeStr: e.target.value }))
                  }
                  className="w-full px-2.5 py-2 rounded-lg bg-canvas-surface border border-canvas-border text-xs font-mono text-slate-100"
                />
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1">
                  Duration (min)
                </label>
                <select
                  value={draft.durationMinutes}
                  onChange={(e) =>
                    setDraft((p) => ({
                      ...p,
                      durationMinutes: Number(e.target.value),
                    }))
                  }
                  className="w-full px-2.5 py-2 rounded-lg bg-canvas-surface border border-canvas-border text-xs font-mono text-slate-100"
                >
                  <option value={45}>45 min</option>
                  <option value={60}>60 min</option>
                  <option value={90}>90 min</option>
                  <option value={120}>120 min</option>
                  <option value={180}>180 min</option>
                </select>
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1">
                  Attendance
                </label>
                <input
                  type="number"
                  min={5}
                  max={500}
                  value={draft.expectedAttendance}
                  onChange={(e) =>
                    setDraft((p) => ({
                      ...p,
                      expectedAttendance: Math.max(1, Number(e.target.value)),
                    }))
                  }
                  className="w-full px-2.5 py-2 rounded-lg bg-canvas-surface border border-canvas-border text-xs font-mono text-slate-100"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="sm:col-span-1">
                <label className="block text-xs text-slate-400 mb-1">
                  Setup Prep (min)
                </label>
                <select
                  value={draft.setupMinutes}
                  onChange={(e) =>
                    setDraft((p) => ({
                      ...p,
                      setupMinutes: Number(e.target.value),
                    }))
                  }
                  className="w-full px-2.5 py-2 rounded-lg bg-canvas-surface border border-canvas-border text-xs font-mono text-slate-100"
                >
                  <option value={0}>0 min</option>
                  <option value={10}>10 min</option>
                  <option value={15}>15 min</option>
                  <option value={30}>30 min</option>
                </select>
              </div>
              <div className="sm:col-span-1">
                <label className="block text-xs text-slate-400 mb-1">
                  Cleanup Teardown (min)
                </label>
                <select
                  value={draft.cleanupMinutes}
                  onChange={(e) =>
                    setDraft((p) => ({
                      ...p,
                      cleanupMinutes: Number(e.target.value),
                    }))
                  }
                  className="w-full px-2.5 py-2 rounded-lg bg-canvas-surface border border-canvas-border text-xs font-mono text-slate-100"
                >
                  <option value={0}>0 min</option>
                  <option value={10}>10 min</option>
                  <option value={15}>15 min</option>
                  <option value={30}>30 min</option>
                </select>
              </div>
              <div className="sm:col-span-1 flex items-end">
                <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer pb-2">
                  <input
                    type="checkbox"
                    checked={draft.requiresExtendedTurnaround}
                    onChange={(e) =>
                      setDraft((p) => ({
                        ...p,
                        requiresExtendedTurnaround: e.target.checked,
                      }))
                    }
                    className="rounded border-canvas-border text-accent-cyan"
                  />
                  Force 30m Heavy Turnaround
                </label>
              </div>
            </div>

            <div>
              <label className="block text-xs text-slate-400 mb-1.5">
                Preferred Campus Venue
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {state.rooms.map((rm) => {
                  const selected = draft.preferredRoomId === rm.id;
                  const capOk = rm.capacity >= draft.expectedAttendance;
                  return (
                    <button
                      type="button"
                      key={rm.id}
                      onClick={() =>
                        setDraft((p) => ({ ...p, preferredRoomId: rm.id }))
                      }
                      className={`p-3 rounded-lg border text-left transition-all ${
                        selected
                          ? "bg-accent-cyan/15 border-accent-cyan text-slate-100"
                          : "bg-canvas-surface hover:bg-canvas-hover border-canvas-border text-slate-300"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold">{rm.name}</span>
                        <span className="font-mono text-[11px] text-slate-400">
                          {rm.code}
                        </span>
                      </div>
                      <div className="mt-1 flex items-center justify-between text-[11px]">
                        <span
                          className={
                            capOk ? "text-emerald-400" : "text-red-400"
                          }
                        >
                          Cap {rm.capacity}
                        </span>
                        <span className="text-slate-400 font-mono">
                          {rm.customTurnaroundMinutes ?? 15}m policy
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Required Room Facilities */}
            <div>
              <label className="block text-xs text-slate-400 mb-1.5">
                Required Room Facilities
              </label>
              <div className="flex flex-wrap gap-2">
                {ALL_FACILITIES.map((fac) => {
                  const active = draft.requiredFacilities.includes(fac);
                  return (
                    <button
                      type="button"
                      key={fac}
                      onClick={() => toggleFacility(fac)}
                      className={`px-2.5 py-1 rounded-md text-xs border transition-colors ${
                        active
                          ? "bg-accent-cyan/20 border-accent-cyan text-accent-cyanBright font-medium"
                          : "bg-canvas-surface border-canvas-border text-slate-400 hover:text-slate-200"
                      }`}
                    >
                      {FACILITY_LABELS[fac]}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* 3. Equipment & Mentors */}
          <div className="p-5 rounded-xl bg-canvas-elevated border border-canvas-border space-y-4">
            <h2 className="text-sm font-semibold text-slate-100 uppercase tracking-wider flex items-center gap-2">
              <Cpu className="w-4 h-4 text-accent-cyanBright" />
              3. Required Equipment & Mentors
            </h2>

            <div className="space-y-2.5">
              {state.resources.map((res) => {
                const reqEntry = draft.requiredResources.find(
                  (r) => r.resourceId === res.id
                );
                const qty = reqEntry?.quantity ?? 0;
                const availInfo = getAvailableResourceQuantity(
                  state,
                  res.id,
                  feasibility.computedIntervals.setupStartIso,
                  feasibility.computedIntervals.cleanupEndIso
                );

                return (
                  <div
                    key={res.id}
                    className="p-3 rounded-lg bg-canvas-surface border border-canvas-border flex items-center justify-between gap-3"
                  >
                    <div>
                      <div className="text-xs font-semibold text-slate-100">
                        {res.name}
                      </div>
                      <div className="text-[11px] text-slate-400 font-mono mt-0.5">
                        {res.sku} •{" "}
                        <span
                          className={
                            availInfo.available >= qty
                              ? "text-emerald-400"
                              : "text-red-400"
                          }
                        >
                          {availInfo.available} of {res.operationalQuantity}{" "}
                          available for window
                        </span>{" "}
                        • {formatCurrency(res.replacementCostInr)}/unit
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        min={0}
                        max={res.totalQuantity + 5}
                        value={qty}
                        onChange={(e) =>
                          updateResourceQuantity(
                            res.id,
                            Math.max(0, Number(e.target.value))
                          )
                        }
                        aria-label={`Quantity for ${res.name}`}
                        className="w-16 px-2 py-1 rounded bg-canvas-elevated border border-canvas-border text-xs font-mono text-center text-slate-100"
                      />
                      <span className="text-xs text-slate-400">units</span>
                    </div>
                  </div>
                );
              })}
            </div>

            <div>
              <label className="block text-xs text-slate-400 mb-2 flex items-center gap-1.5">
                <UserCheck className="w-3.5 h-3.5 text-accent-cyanBright" />
                Required Mentors / Responsible Roles
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {state.people.map((person) => {
                  const selected = draft.requiredPeopleIds.includes(person.id);
                  return (
                    <button
                      type="button"
                      key={person.id}
                      onClick={() => togglePerson(person.id)}
                      className={`p-2.5 rounded-lg border text-left text-xs transition-colors ${
                        selected
                          ? "bg-accent-cyan/15 border-accent-cyan text-slate-100"
                          : "bg-canvas-surface border-canvas-border text-slate-400 hover:text-slate-200"
                      }`}
                    >
                      <div className="font-semibold text-slate-200">
                        {person.name}
                      </div>
                      <div className="text-[11px] text-slate-400">
                        {person.roleTitle}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>

        {/* Right 5 Columns: Real-Time Deterministic Feasibility Verdict & Confirmation */}
        <div className="lg:col-span-5 space-y-5">
          <div className="sticky top-20 space-y-5">
            {/* Explicit 3-State Verdict Banner */}
            <div
              className={`p-5 rounded-xl border-2 shadow-xl ${
                feasibility.status === "FEASIBLE"
                  ? "bg-emerald-950/25 border-emerald-500/60"
                  : feasibility.status === "ALTERNATIVES_AVAILABLE"
                  ? "bg-amber-950/25 border-amber-500/60"
                  : "bg-red-950/30 border-red-500/60"
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-mono uppercase tracking-wider text-slate-400">
                  Deterministic Engine State
                </span>
                <span className="font-mono text-xs text-slate-300">
                  {feasibility.computedIntervals.setupStartIso.slice(11, 16)} –{" "}
                  {feasibility.computedIntervals.turnaroundEndIso.slice(11, 16)}
                </span>
              </div>

              <div className="mt-2 flex items-center gap-2.5">
                {feasibility.status === "FEASIBLE" && (
                  <>
                    <CheckCircle2 className="w-6 h-6 text-emerald-400 shrink-0" />
                    <div>
                      <div className="text-base font-bold text-emerald-300 font-mono">
                        1. FEASIBLE
                      </div>
                      <div className="text-xs text-slate-300">
                        All hard constraints satisfied. Ready to lock booking.
                      </div>
                    </div>
                  </>
                )}

                {feasibility.status === "ALTERNATIVES_AVAILABLE" && (
                  <>
                    <AlertTriangle className="w-6 h-6 text-amber-400 shrink-0" />
                    <div>
                      <div className="text-base font-bold text-amber-300 font-mono">
                        2. ALTERNATIVES AVAILABLE
                      </div>
                      <div className="text-xs text-slate-300">
                        Requested slot violates hard constraints, but valid
                        alternatives exist below.
                      </div>
                    </div>
                  </>
                )}

                {feasibility.status === "NO_FEASIBLE_PLAN" && (
                  <>
                    <XCircle className="w-6 h-6 text-red-400 shrink-0" />
                    <div>
                      <div className="text-base font-bold text-red-300 font-mono">
                        3. NO FEASIBLE PLAN
                      </div>
                      <div className="text-xs text-slate-300">
                        Blocking hard constraints prevent any valid allocation
                        on this date.
                      </div>
                    </div>
                  </>
                )}
              </div>

              {/* Interval Envelope Breakdown */}
              <div className="mt-4 p-3 rounded-lg bg-canvas-elevated/90 border border-canvas-border grid grid-cols-4 gap-2 text-center font-mono text-[11px]">
                <div>
                  <div className="text-slate-400">Setup</div>
                  <div className="text-slate-200 font-semibold">
                    {feasibility.computedIntervals.setupStartIso.slice(11, 16)}
                  </div>
                </div>
                <div>
                  <div className="text-accent-cyanBright">Event</div>
                  <div className="text-slate-100 font-bold">
                    {feasibility.computedIntervals.startIso.slice(11, 16)}–
                    {feasibility.computedIntervals.endIso.slice(11, 16)}
                  </div>
                </div>
                <div>
                  <div className="text-slate-400">Cleanup</div>
                  <div className="text-slate-200 font-semibold">
                    {feasibility.computedIntervals.cleanupEndIso.slice(11, 16)}
                  </div>
                </div>
                <div>
                  <div className="text-amber-300">
                    +{feasibility.computedIntervals.turnaroundMinutes}m Gap
                  </div>
                  <div className="text-amber-200 font-semibold">
                    {feasibility.computedIntervals.turnaroundEndIso.slice(
                      11,
                      16
                    )}
                  </div>
                </div>
              </div>

              {/* Blocking Hard Constraint Violations */}
              {feasibility.violations.length > 0 && (
                <div className="mt-4 space-y-2">
                  <div className="text-xs font-semibold uppercase tracking-wider text-red-300">
                    Blocking Hard Constraints ({feasibility.violations.length})
                  </div>
                  {feasibility.violations.map((v, i) => (
                    <div
                      key={i}
                      className="p-2.5 rounded-lg bg-red-950/50 border border-red-500/40 text-xs text-red-200"
                    >
                      <span className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-red-500/20 text-red-300 mr-1.5">
                        {v.code}
                      </span>
                      {v.message}
                    </div>
                  ))}
                </div>
              )}

              {/* Concrete One-Click Valid Alternatives */}
              {concreteAlternatives.length > 0 && (
                <div className="mt-4 space-y-2">
                  <div className="text-xs font-semibold uppercase tracking-wider text-amber-300">
                    Verified Feasible Alternatives (Click to Apply)
                  </div>
                  {concreteAlternatives.map((alt, idx) => (
                    <button
                      type="button"
                      key={idx}
                      onClick={() =>
                        setDraft((p) => ({
                          ...p,
                          preferredRoomId: alt.roomId,
                          startTimeStr: alt.startTimeStr,
                        }))
                      }
                      className="w-full p-2.5 rounded-lg bg-canvas-elevated hover:bg-canvas-hover border border-amber-500/40 text-left text-xs transition-colors flex items-center justify-between gap-2"
                    >
                      <div>
                        <div className="font-semibold text-slate-100">
                          {alt.roomName} @ {alt.startTimeStr}
                        </div>
                        <div className="text-[11px] text-slate-300">
                          {alt.reason}
                        </div>
                      </div>
                      <span className="text-xs font-mono text-accent-cyanBright shrink-0 flex items-center gap-1">
                        Apply <ArrowRight className="w-3 h-3" />
                      </span>
                    </button>
                  ))}
                </div>
              )}

              {/* Suitability Verification Reasons */}
              {feasibility.suitabilityReasons.length > 0 && (
                <div className="mt-4 space-y-1.5">
                  <div className="text-xs font-semibold uppercase tracking-wider text-emerald-300">
                    Verified Suitability Checks
                  </div>
                  {feasibility.suitabilityReasons.map((reason, idx) => (
                    <div
                      key={idx}
                      className="text-xs text-slate-300 flex items-start gap-2"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
                      <span>{reason}</span>
                    </div>
                  ))}
                </div>
              )}

              {/* Action Buttons */}
              <div className="mt-5 pt-4 border-t border-canvas-border flex flex-col sm:flex-row items-center gap-2.5">
                <button
                  type="submit"
                  disabled={!feasibility.isFeasible}
                  className={`w-full py-2.5 px-4 rounded-lg font-bold text-xs flex items-center justify-center gap-2 transition-all ${
                    feasibility.isFeasible
                      ? "bg-accent-cyan hover:bg-accent-cyanBright text-slate-950 shadow-lg shadow-accent-cyan/20 cursor-pointer"
                      : "bg-slate-800 text-slate-500 border border-slate-700 cursor-not-allowed"
                  }`}
                >
                  <CheckCircle2 className="w-4 h-4" />
                  {feasibility.isFeasible
                    ? "Confirm & Allocate Feasible Plan"
                    : "Confirmation Locked (Hard Constraint Violation)"}
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setSavedDraftNote(
                      `Draft "${draft.title}" saved locally at ${new Date().toLocaleTimeString()}.`
                    );
                    pushToast({
                      type: "INFO",
                      title: "Draft Request Saved",
                      detail: `"${draft.title}" stored in session draft state.`,
                    });
                  }}
                  className="w-full sm:w-auto px-3.5 py-2.5 rounded-lg bg-canvas-surface hover:bg-canvas-hover border border-canvas-border text-xs font-medium text-slate-200 flex items-center justify-center gap-1.5 shrink-0"
                >
                  <BookmarkCheck className="w-4 h-4 text-accent-cyanBright" />
                  Save Draft
                </button>

                <button
                  type="button"
                  onClick={() => setDraft(createDefaultDraft(selectedDate))}
                  className="p-2.5 rounded-lg bg-canvas-surface hover:bg-canvas-hover border border-canvas-border text-slate-400 hover:text-slate-200"
                  title="Reset Form"
                >
                  <RotateCcw className="w-4 h-4" />
                </button>
              </div>

              {savedDraftNote && (
                <div className="mt-2 text-[11px] font-mono text-accent-cyanBright">
                  {savedDraftNote}
                </div>
              )}
            </div>
          </div>
        </div>
      </form>
    </div>
  );
}
