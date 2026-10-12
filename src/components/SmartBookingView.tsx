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
import {
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Sparkles,
  Clock,
  Users,
  Cpu,
  UserCheck,
  ArrowRight,
  RotateCcw,
  BookmarkCheck,
  Minus,
  Plus,
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

  const concreteAlternatives = useMemo(() => {
    if (feasibility.isFeasible) return [];
    const results: Array<{
      roomId: string;
      roomName: string;
      roomCap: number;
      startTimeStr: string;
      reason: string;
    }> = [];

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
          reason: `Same time (${draft.startTimeStr}) • Cap ${altRoom.capacity}`,
        });
      }
    }

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
            reason: `Slot ${tStr} • Cap ${altRoom.capacity}`,
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

  // Derive visual 6-gate status badges
  const hasViolation = (codes: string[]) =>
    feasibility.violations.some((v) => codes.includes(v.code));

  const gateChecks = [
    {
      label: "Room Capacity",
      passed: !hasViolation(["CAPACITY_INSUFFICIENT"]),
    },
    {
      label: "Facilities",
      passed: !hasViolation(["MISSING_FACILITY"]),
    },
    {
      label: "Venue Slot",
      passed: !hasViolation([
        "ROOM_UNAVAILABLE_WINDOW",
        "ROOM_OVERLAP_CONFLICT",
      ]),
    },
    {
      label: "Buffer Policy",
      passed: !hasViolation([
        "SETUP_CLEANUP_CONFLICT",
        "TURNAROUND_BUFFER_VIOLATION",
      ]),
    },
    {
      label: "Equipment Pool",
      passed: !hasViolation(["RESOURCE_UNAVAILABLE", "RESOURCE_INSUFFICIENT"]),
    },
    {
      label: "Mentors",
      passed: !hasViolation(["PERSON_UNAVAILABLE", "PERSON_OVERLAP"]),
    },
  ];

  return (
    <div className="space-y-6">
      {/* Top Scenario Preset Bar — Crisp 1-Click Test Pills */}
      <div className="p-4 rounded-2xl ops-card border border-canvas-border flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h1 className="text-lg font-bold text-slate-100">
            Smart Booking & Constraint Configurator
          </h1>
          <p className="text-xs text-slate-400">
            Live verification across capacity, facilities, equipment, mentors,
            and turnaround buffers.
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
            className="px-3 py-1.5 rounded-xl bg-accent-cyan/15 border border-accent-cyan/40 text-accent-cyanBright text-xs font-semibold hover:bg-accent-cyan/25 transition-colors flex items-center gap-1.5"
          >
            <Sparkles className="w-3.5 h-3.5" />
            Preset: Feasible Robotics (80p)
          </button>

          <button
            type="button"
            onClick={() =>
              setDraft((prev) => ({
                ...prev,
                preferredRoomId: "rm-lovelace-lab",
                expectedAttendance: 80,
                startTimeStr: "14:00",
              }))
            }
            className="px-3 py-1.5 rounded-xl bg-canvas-surface hover:bg-canvas-hover border border-amber-500/30 text-xs text-amber-300 transition-colors"
          >
            Test: Over Capacity (80p &gt; 60)
          </button>

          <button
            type="button"
            onClick={() =>
              setDraft((prev) => ({
                ...prev,
                preferredRoomId: "rm-turing-hall",
                dateStr: DEMO_PRIMARY_DATE,
                startTimeStr: "13:05",
                setupMinutes: 15,
              }))
            }
            className="px-3 py-1.5 rounded-xl bg-canvas-surface hover:bg-canvas-hover border border-red-500/30 text-xs text-red-300 transition-colors"
          >
            Test: 15m Buffer Clash
          </button>
        </div>
      </div>

      <form
        onSubmit={handleConfirm}
        className="grid grid-cols-1 lg:grid-cols-12 gap-6"
      >
        {/* Left 7 Columns: Clean Visual Inputs */}
        <div className="lg:col-span-7 space-y-5">
          {/* 1. Event Identity */}
          <div className="p-5 rounded-2xl ops-card border border-canvas-border space-y-4">
            <h2 className="text-xs font-bold text-slate-200 uppercase tracking-wider">
              1. Event Identity
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
              <div className="sm:col-span-2">
                <label className="block text-[11px] font-mono uppercase text-slate-400 mb-1">
                  Event Title
                </label>
                <input
                  type="text"
                  required
                  value={draft.title}
                  onChange={(e) =>
                    setDraft((p) => ({ ...p, title: e.target.value }))
                  }
                  className="w-full px-3 py-2 rounded-xl bg-canvas-surface border border-canvas-border text-sm font-medium text-slate-100 focus:outline-none focus:border-accent-cyan"
                />
              </div>

              <div>
                <label className="block text-[11px] font-mono uppercase text-slate-400 mb-1">
                  Priority
                </label>
                <select
                  value={draft.priority}
                  onChange={(e) =>
                    setDraft((p) => ({
                      ...p,
                      priority: e.target.value as EventPriority,
                    }))
                  }
                  className="w-full px-3 py-2 rounded-xl bg-canvas-surface border border-canvas-border text-sm font-mono text-slate-100 focus:outline-none focus:border-accent-cyan"
                >
                  <option value="CRITICAL">CRITICAL</option>
                  <option value="HIGH">HIGH</option>
                  <option value="STANDARD">STANDARD</option>
                  <option value="LOW">LOW</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <div>
                <label className="block text-[11px] font-mono uppercase text-slate-400 mb-1">
                  Organizer
                </label>
                <input
                  type="text"
                  value={draft.organizer}
                  onChange={(e) =>
                    setDraft((p) => ({ ...p, organizer: e.target.value }))
                  }
                  className="w-full px-3 py-2 rounded-xl bg-canvas-surface border border-canvas-border text-xs text-slate-200 focus:outline-none focus:border-accent-cyan"
                />
              </div>
              <div>
                <label className="block text-[11px] font-mono uppercase text-slate-400 mb-1">
                  Category
                </label>
                <select
                  value={draft.category}
                  onChange={(e) =>
                    setDraft((p) => ({
                      ...p,
                      category: e.target.value as EventCategory,
                    }))
                  }
                  className="w-full px-3 py-2 rounded-xl bg-canvas-surface border border-canvas-border text-xs font-mono text-slate-200 focus:outline-none focus:border-accent-cyan"
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
          </div>

          {/* 2. Schedule, Venue & Buffers */}
          <div className="p-5 rounded-2xl ops-card border border-canvas-border space-y-4">
            <h2 className="text-xs font-bold text-slate-200 uppercase tracking-wider flex items-center gap-2">
              <Clock className="w-4 h-4 text-accent-cyanBright" />
              2. Schedule, Venue & Buffers
            </h2>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div>
                <label className="block text-[11px] font-mono uppercase text-slate-400 mb-1">
                  Date
                </label>
                <input
                  type="date"
                  value={draft.dateStr}
                  onChange={(e) =>
                    setDraft((p) => ({ ...p, dateStr: e.target.value }))
                  }
                  className="w-full px-2.5 py-2 rounded-xl bg-canvas-surface border border-canvas-border text-xs font-mono text-slate-100"
                />
              </div>
              <div>
                <label className="block text-[11px] font-mono uppercase text-slate-400 mb-1">
                  Start
                </label>
                <input
                  type="time"
                  value={draft.startTimeStr}
                  onChange={(e) =>
                    setDraft((p) => ({ ...p, startTimeStr: e.target.value }))
                  }
                  className="w-full px-2.5 py-2 rounded-xl bg-canvas-surface border border-canvas-border text-xs font-mono text-slate-100"
                />
              </div>
              <div>
                <label className="block text-[11px] font-mono uppercase text-slate-400 mb-1">
                  Duration
                </label>
                <select
                  value={draft.durationMinutes}
                  onChange={(e) =>
                    setDraft((p) => ({
                      ...p,
                      durationMinutes: Number(e.target.value),
                    }))
                  }
                  className="w-full px-2.5 py-2 rounded-xl bg-canvas-surface border border-canvas-border text-xs font-mono text-slate-100"
                >
                  <option value={45}>45m</option>
                  <option value={60}>60m</option>
                  <option value={90}>90m</option>
                  <option value={120}>120m</option>
                  <option value={180}>180m</option>
                </select>
              </div>
              <div>
                <label className="block text-[11px] font-mono uppercase text-slate-400 mb-1">
                  Seats Needed
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
                  className="w-full px-2.5 py-2 rounded-xl bg-canvas-surface border border-canvas-border text-xs font-mono font-bold text-slate-100"
                />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="block text-[11px] font-mono uppercase text-slate-400 mb-1">
                  Setup
                </label>
                <select
                  value={draft.setupMinutes}
                  onChange={(e) =>
                    setDraft((p) => ({
                      ...p,
                      setupMinutes: Number(e.target.value),
                    }))
                  }
                  className="w-full px-2.5 py-1.5 rounded-xl bg-canvas-surface border border-canvas-border text-xs font-mono text-slate-100"
                >
                  <option value={0}>0m</option>
                  <option value={10}>10m</option>
                  <option value={15}>15m</option>
                  <option value={30}>30m</option>
                </select>
              </div>
              <div>
                <label className="block text-[11px] font-mono uppercase text-slate-400 mb-1">
                  Cleanup
                </label>
                <select
                  value={draft.cleanupMinutes}
                  onChange={(e) =>
                    setDraft((p) => ({
                      ...p,
                      cleanupMinutes: Number(e.target.value),
                    }))
                  }
                  className="w-full px-2.5 py-1.5 rounded-xl bg-canvas-surface border border-canvas-border text-xs font-mono text-slate-100"
                >
                  <option value={0}>0m</option>
                  <option value={10}>10m</option>
                  <option value={15}>15m</option>
                  <option value={30}>30m</option>
                </select>
              </div>
              <div className="flex items-end">
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
                  <span>30m Heavy Gap</span>
                </label>
              </div>
            </div>

            {/* Visual Venue Selector Cards */}
            <div>
              <label className="block text-[11px] font-mono uppercase text-slate-400 mb-2">
                Select Campus Venue
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
                {state.rooms.map((rm) => {
                  const selected = draft.preferredRoomId === rm.id;
                  const capOk = rm.capacity >= draft.expectedAttendance;
                  const fillPct = Math.min(
                    100,
                    Math.round((draft.expectedAttendance / rm.capacity) * 100)
                  );
                  return (
                    <button
                      type="button"
                      key={rm.id}
                      onClick={() =>
                        setDraft((p) => ({ ...p, preferredRoomId: rm.id }))
                      }
                      className={`p-3 rounded-xl border text-left transition-all ${
                        selected
                          ? "bg-accent-cyan/15 border-accent-cyan text-slate-100 shadow-md"
                          : "bg-canvas-surface/80 hover:bg-canvas-hover border-canvas-border text-slate-300"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-canvas-elevated text-accent-cyanBright">
                          {rm.code}
                        </span>
                        <span
                          className={`font-mono text-[11px] font-bold ${
                            capOk ? "text-emerald-400" : "text-red-400"
                          }`}
                        >
                          {draft.expectedAttendance}/{rm.capacity}
                        </span>
                      </div>
                      <div className="text-xs font-bold text-slate-100 mt-1.5 truncate">
                        {rm.name}
                      </div>
                      <div className="mt-2 h-1 w-full rounded-full bg-canvas-elevated overflow-hidden">
                        <div
                          className={`h-full rounded-full ${
                            capOk ? "bg-emerald-400" : "bg-red-500"
                          }`}
                          style={{ width: `${fillPct}%` }}
                        />
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Facility Chips */}
            <div>
              <label className="block text-[11px] font-mono uppercase text-slate-400 mb-2">
                Required Room Facilities
              </label>
              <div className="flex flex-wrap gap-1.5">
                {ALL_FACILITIES.map((fac) => {
                  const active = draft.requiredFacilities.includes(fac);
                  return (
                    <button
                      type="button"
                      key={fac}
                      onClick={() => toggleFacility(fac)}
                      className={`px-2.5 py-1 rounded-lg text-xs border transition-colors ${
                        active
                          ? "bg-accent-cyan/20 border-accent-cyan text-accent-cyanBright font-semibold"
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

          {/* 3. Equipment Steppers & Mentor Pills */}
          <div className="p-5 rounded-2xl ops-card border border-canvas-border space-y-4">
            <h2 className="text-xs font-bold text-slate-200 uppercase tracking-wider flex items-center gap-2">
              <Cpu className="w-4 h-4 text-accent-cyanBright" />
              3. Shared Equipment & Mentors
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
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
                const isEnough = availInfo.available >= qty;

                return (
                  <div
                    key={res.id}
                    className={`p-3 rounded-xl border flex items-center justify-between gap-2 ${
                      qty > 0
                        ? "bg-accent-cyan/10 border-accent-cyan/40"
                        : "bg-canvas-surface/80 border-canvas-border"
                    }`}
                  >
                    <div className="min-w-0">
                      <div className="text-xs font-bold text-slate-100 truncate">
                        {res.name}
                      </div>
                      <div
                        className={`text-[11px] font-mono mt-0.5 ${
                          isEnough ? "text-emerald-400" : "text-red-400"
                        }`}
                      >
                        {availInfo.available}/{res.operationalQuantity} free
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        type="button"
                        onClick={() =>
                          updateResourceQuantity(res.id, Math.max(0, qty - 1))
                        }
                        className="w-7 h-7 rounded-lg bg-canvas-elevated border border-canvas-border flex items-center justify-center text-slate-300 hover:text-slate-100"
                        aria-label={`Decrease ${res.name}`}
                      >
                        <Minus className="w-3 h-3" />
                      </button>
                      <span className="w-7 text-center font-mono text-xs font-bold text-slate-100">
                        {qty}
                      </span>
                      <button
                        type="button"
                        onClick={() => updateResourceQuantity(res.id, qty + 1)}
                        className="w-7 h-7 rounded-lg bg-canvas-elevated border border-canvas-border flex items-center justify-center text-slate-300 hover:text-slate-100"
                        aria-label={`Increase ${res.name}`}
                      >
                        <Plus className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

            <div>
              <label className="block text-[11px] font-mono uppercase text-slate-400 mb-2 flex items-center gap-1.5">
                <UserCheck className="w-3.5 h-3.5 text-accent-cyanBright" />
                Assign Mentors
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {state.people.map((person) => {
                  const selected = draft.requiredPeopleIds.includes(person.id);
                  return (
                    <button
                      type="button"
                      key={person.id}
                      onClick={() => togglePerson(person.id)}
                      className={`p-2.5 rounded-xl border text-left text-xs transition-all flex items-center justify-between ${
                        selected
                          ? "bg-accent-cyan/15 border-accent-cyan text-slate-100"
                          : "bg-canvas-surface/80 border-canvas-border text-slate-400 hover:text-slate-200"
                      }`}
                    >
                      <div className="truncate">
                        <div className="font-bold text-slate-200 truncate">
                          {person.name}
                        </div>
                        <div className="text-[11px] text-slate-400 truncate">
                          {person.roleTitle}
                        </div>
                      </div>
                      {selected && (
                        <CheckCircle2 className="w-4 h-4 text-accent-cyanBright shrink-0" />
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>

        {/* Right 5 Columns: Live Visual Verdict & 6-Gate Matrix */}
        <div className="lg:col-span-5">
          <div className="sticky top-28 space-y-4">
            <div
              className={`p-5 rounded-2xl border-2 shadow-2xl space-y-4 ${
                feasibility.status === "FEASIBLE"
                  ? "ops-card border-emerald-500/60 ops-glow-emerald"
                  : feasibility.status === "ALTERNATIVES_AVAILABLE"
                  ? "ops-card border-amber-500/60 ops-glow-amber"
                  : "ops-card border-red-500/60"
              }`}
            >
              {/* Status Header */}
              <div className="flex items-center gap-3">
                {feasibility.status === "FEASIBLE" && (
                  <div className="w-11 h-11 rounded-xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400 shrink-0">
                    <CheckCircle2 className="w-6 h-6" />
                  </div>
                )}
                {feasibility.status === "ALTERNATIVES_AVAILABLE" && (
                  <div className="w-11 h-11 rounded-xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400 shrink-0">
                    <AlertTriangle className="w-6 h-6" />
                  </div>
                )}
                {feasibility.status === "NO_FEASIBLE_PLAN" && (
                  <div className="w-11 h-11 rounded-xl bg-red-500/20 border border-red-500/40 flex items-center justify-center text-red-400 shrink-0">
                    <XCircle className="w-6 h-6" />
                  </div>
                )}

                <div>
                  <div className="text-[10px] font-mono uppercase tracking-wider text-slate-400">
                    Live Feasibility Verdict
                  </div>
                  <div
                    className={`text-lg font-bold font-mono ${
                      feasibility.status === "FEASIBLE"
                        ? "text-emerald-300"
                        : feasibility.status === "ALTERNATIVES_AVAILABLE"
                        ? "text-amber-300"
                        : "text-red-300"
                    }`}
                  >
                    {feasibility.status.replace(/_/g, " ")}
                  </div>
                </div>
              </div>

              {/* Visual 6-Constraint Check Grid */}
              <div className="grid grid-cols-2 gap-2">
                {gateChecks.map((g) => (
                  <div
                    key={g.label}
                    className={`px-3 py-2 rounded-xl border text-xs flex items-center justify-between ${
                      g.passed
                        ? "bg-emerald-950/25 border-emerald-500/30 text-emerald-200"
                        : "bg-red-950/40 border-red-500/40 text-red-200 font-semibold"
                    }`}
                  >
                    <span>{g.label}</span>
                    {g.passed ? (
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                    ) : (
                      <XCircle className="w-3.5 h-3.5 text-red-400" />
                    )}
                  </div>
                ))}
              </div>

              {/* Visual 4-Segment Timeline Envelope */}
              <div className="p-3 rounded-xl bg-canvas-surface/90 border border-canvas-border space-y-2">
                <div className="flex items-center justify-between text-[10px] font-mono text-slate-400 uppercase">
                  <span>Protected Envelope</span>
                  <span className="text-slate-200">
                    {feasibility.computedIntervals.setupStartIso.slice(11, 16)}{" "}
                    –{" "}
                    {feasibility.computedIntervals.turnaroundEndIso.slice(
                      11,
                      16
                    )}
                  </span>
                </div>
                <div className="grid grid-cols-4 gap-1.5 text-center font-mono text-[11px]">
                  <div className="p-1.5 rounded-lg bg-canvas-elevated border border-canvas-border">
                    <div className="text-[9px] text-slate-400">SETUP</div>
                    <div className="text-slate-200 font-bold">
                      {feasibility.computedIntervals.setupStartIso.slice(
                        11,
                        16
                      )}
                    </div>
                  </div>
                  <div className="p-1.5 rounded-lg bg-accent-cyan/15 border border-accent-cyan/40">
                    <div className="text-[9px] text-accent-cyanBright">
                      EVENT
                    </div>
                    <div className="text-slate-100 font-bold">
                      {feasibility.computedIntervals.startIso.slice(11, 16)}–
                      {feasibility.computedIntervals.endIso.slice(11, 16)}
                    </div>
                  </div>
                  <div className="p-1.5 rounded-lg bg-canvas-elevated border border-canvas-border">
                    <div className="text-[9px] text-slate-400">CLEAN</div>
                    <div className="text-slate-200 font-bold">
                      {feasibility.computedIntervals.cleanupEndIso.slice(
                        11,
                        16
                      )}
                    </div>
                  </div>
                  <div className="p-1.5 rounded-lg bg-amber-500/15 border border-amber-500/30">
                    <div className="text-[9px] text-amber-300">
                      +{feasibility.computedIntervals.turnaroundMinutes}m GAP
                    </div>
                    <div className="text-amber-200 font-bold">
                      {feasibility.computedIntervals.turnaroundEndIso.slice(
                        11,
                        16
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Blocking Violations */}
              {feasibility.violations.length > 0 && (
                <div className="space-y-1.5">
                  {feasibility.violations.map((v, i) => (
                    <div
                      key={i}
                      className="p-2.5 rounded-xl bg-red-950/50 border border-red-500/40 text-xs text-red-100 flex items-start gap-2"
                    >
                      <span className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-red-500/30 text-red-200 shrink-0 mt-0.5">
                        {v.code}
                      </span>
                      <span className="leading-snug">{v.message}</span>
                    </div>
                  ))}
                </div>
              )}

              {/* One-Click Feasible Alternatives */}
              {concreteAlternatives.length > 0 && (
                <div className="space-y-2">
                  <div className="text-[11px] font-mono uppercase tracking-wider text-amber-300 font-semibold">
                    1-Click Feasible Fixes
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
                      className="w-full p-2.5 rounded-xl bg-canvas-surface hover:bg-canvas-hover border border-amber-500/40 text-left text-xs transition-colors flex items-center justify-between gap-2"
                    >
                      <div>
                        <div className="font-bold text-slate-100">
                          {alt.roomName}
                        </div>
                        <div className="text-[11px] font-mono text-slate-400">
                          {alt.reason}
                        </div>
                      </div>
                      <span className="px-2.5 py-1 rounded-lg bg-amber-500/20 text-amber-200 font-mono text-[11px] font-bold flex items-center gap-1 shrink-0">
                        Apply <ArrowRight className="w-3 h-3" />
                      </span>
                    </button>
                  ))}
                </div>
              )}

              {/* Primary Action Buttons */}
              <div className="pt-2 flex items-center gap-2">
                <button
                  type="submit"
                  disabled={!feasibility.isFeasible}
                  className={`flex-1 py-3 px-4 rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition-all ${
                    feasibility.isFeasible
                      ? "bg-accent-cyan hover:bg-accent-cyanBright text-slate-950 shadow-lg shadow-accent-cyan/25 cursor-pointer"
                      : "bg-slate-800/80 text-slate-500 border border-slate-700 cursor-not-allowed"
                  }`}
                >
                  <CheckCircle2 className="w-4 h-4" />
                  {feasibility.isFeasible
                    ? "Confirm & Lock Allocation"
                    : "Locked — Resolve Conflict"}
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setSavedDraftNote(
                      `Saved at ${new Date().toLocaleTimeString()}`
                    );
                    pushToast({
                      type: "INFO",
                      title: "Draft Saved",
                      detail: `"${draft.title}" stored locally.`,
                    });
                  }}
                  className="p-3 rounded-xl bg-canvas-surface hover:bg-canvas-hover border border-canvas-border text-accent-cyanBright"
                  title="Save Draft"
                >
                  <BookmarkCheck className="w-4 h-4" />
                </button>

                <button
                  type="button"
                  onClick={() => setDraft(createDefaultDraft(selectedDate))}
                  className="p-3 rounded-xl bg-canvas-surface hover:bg-canvas-hover border border-canvas-border text-slate-400 hover:text-slate-200"
                  title="Reset Form"
                >
                  <RotateCcw className="w-4 h-4" />
                </button>
              </div>

              {savedDraftNote && (
                <div className="text-[11px] font-mono text-accent-cyanBright text-center">
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
