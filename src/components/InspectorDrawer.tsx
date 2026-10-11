"use client";

import React from "react";
import { useAutopilot } from "@/context/AutopilotContext";
import { FACILITY_LABELS } from "@/domain/seedData";
import { evaluateRequestFeasibility } from "@/domain/engine";
import { formatCurrency, formatTimeRange } from "@/lib/utils";
import {
  X,
  Building2,
  Users,
  Clock,
  Cpu,
  CheckCircle2,
  AlertTriangle,
  Zap,
  CalendarPlus,
  Trash2,
  ShieldCheck,
  UserCheck,
} from "lucide-react";
import { Disruption } from "@/domain/types";

export function InspectorDrawer() {
  const {
    state,
    selectedDate,
    inspectedRoomId,
    setInspectedRoomId,
    inspectedEventId,
    setInspectedEventId,
    setActiveSection,
    setBookingPrefill,
    setShockwaveTargetEventId,
    triggerShockwaveSimulation,
    cancelBooking,
  } = useAutopilot();

  if (!inspectedRoomId && !inspectedEventId) return null;

  const room = inspectedRoomId
    ? state.rooms.find((r) => r.id === inspectedRoomId)
    : null;
  const event = inspectedEventId
    ? state.events.find((e) => e.id === inspectedEventId)
    : null;

  const closeDrawer = () => {
    setInspectedRoomId(null);
    setInspectedEventId(null);
  };

  if (room) {
    const building = state.buildings.find((b) => b.id === room.buildingId);
    const policy = state.bufferPolicies.find((p) => p.id === room.bufferPolicyId);
    const turnaroundMins =
      room.customTurnaroundMinutes ?? policy?.defaultTurnaroundMinutes ?? 15;
    const roomBookings = state.bookings
      .filter((b) => b.roomId === room.id && b.status !== "CANCELLED")
      .sort((a, b) => a.startIso.localeCompare(b.startIso));
    const roomWindows = state.availabilityWindows.filter(
      (w) => w.entityType === "ROOM" && w.entityId === room.id
    );
    const storedResources = state.resources.filter(
      (r) => r.locationRoomId === room.id
    );

    return (
      <aside
        aria-label="Room Inspector"
        className="fixed inset-y-0 right-0 z-40 w-full max-w-md border-l border-canvas-borderStrong bg-canvas-elevated/95 backdrop-blur-md shadow-2xl flex flex-col"
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-canvas-border">
          <div>
            <div className="flex items-center gap-2">
              <span className="font-mono text-xs px-2 py-0.5 rounded bg-accent-cyan/15 text-accent-cyanBright border border-accent-cyan/30">
                {room.code}
              </span>
              <span className="text-xs uppercase tracking-wider text-slate-400">
                {room.roomType.replace(/_/g, " ")}
              </span>
            </div>
            <h2 className="text-lg font-semibold text-slate-100 mt-1">
              {room.name}
            </h2>
          </div>
          <button
            onClick={closeDrawer}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-100 hover:bg-canvas-hover transition-colors"
            aria-label="Close inspector"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-6">
          <div className="grid grid-cols-3 gap-3">
            <div className="p-3 rounded-lg bg-canvas-surface border border-canvas-border">
              <div className="text-xs text-slate-400 flex items-center gap-1">
                <Users className="w-3.5 h-3.5 text-accent-cyanBright" />
                Capacity
              </div>
              <div className="text-lg font-mono font-semibold text-slate-100 mt-1">
                {room.capacity} seats
              </div>
            </div>
            <div className="p-3 rounded-lg bg-canvas-surface border border-canvas-border">
              <div className="text-xs text-slate-400 flex items-center gap-1">
                <Clock className="w-3.5 h-3.5 text-amber-400" />
                Turnaround
              </div>
              <div className="text-lg font-mono font-semibold text-slate-100 mt-1">
                {turnaroundMins} min
              </div>
            </div>
            <div className="p-3 rounded-lg bg-canvas-surface border border-canvas-border">
              <div className="text-xs text-slate-400 flex items-center gap-1">
                <Building2 className="w-3.5 h-3.5 text-slate-300" />
                Building
              </div>
              <div className="text-sm font-medium text-slate-100 mt-1 truncate">
                {building?.code ?? "CAMPUS"} Fl.{room.floor}
              </div>
            </div>
          </div>

          <p className="text-xs text-slate-300 leading-relaxed bg-canvas-surface/60 p-3 rounded-lg border border-canvas-border">
            {room.notes}
          </p>

          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2.5">
              Verified Room Facilities ({room.facilities.length})
            </h3>
            <div className="flex flex-wrap gap-1.5">
              {room.facilities.map((fac) => (
                <span
                  key={fac}
                  className="text-xs px-2.5 py-1 rounded bg-canvas-surface border border-canvas-border text-slate-200"
                >
                  {FACILITY_LABELS[fac] ?? fac}
                </span>
              ))}
            </div>
          </div>

          {roomWindows.length > 0 && (
            <div>
              <h3 className="text-xs font-semibold uppercase tracking-wider text-red-400 mb-2">
                Active Unavailability / Lock Windows
              </h3>
              <div className="space-y-2">
                {roomWindows.map((win) => (
                  <div
                    key={win.id}
                    className="p-3 rounded-lg bg-red-950/30 border border-red-500/30 text-xs"
                  >
                    <div className="flex items-center justify-between font-mono text-red-300">
                      <span>{win.status}</span>
                      <span>
                        {win.startIso.slice(0, 10)}{" "}
                        {formatTimeRange(win.startIso, win.endIso)}
                      </span>
                    </div>
                    <p className="text-slate-300 mt-1">{win.reason}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2.5">
              Scheduled Bookings ({roomBookings.length})
            </h3>
            {roomBookings.length === 0 ? (
              <div className="p-4 rounded-lg bg-canvas-surface border border-canvas-border text-xs text-slate-400">
                No active bookings assigned to {room.name}.
              </div>
            ) : (
              <div className="space-y-2.5">
                {roomBookings.map((b) => {
                  const ev = state.events.find((e) => e.id === b.eventId);
                  return (
                    <button
                      key={b.id}
                      onClick={() => {
                        setInspectedRoomId(null);
                        setInspectedEventId(b.eventId);
                      }}
                      className="w-full text-left p-3 rounded-lg bg-canvas-surface hover:bg-canvas-hover border border-canvas-border transition-colors"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-mono text-accent-cyanBright">
                          {b.startIso.slice(0, 10)} •{" "}
                          {formatTimeRange(b.startIso, b.endIso)}
                        </span>
                        <span className="text-[11px] font-mono px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-300">
                          {b.status}
                        </span>
                      </div>
                      <div className="text-sm font-medium text-slate-100 mt-1">
                        {ev?.title ?? b.eventId}
                      </div>
                      <div className="text-xs text-slate-400 mt-1 flex items-center gap-3">
                        <span>{ev?.expectedAttendance ?? 0} attendees</span>
                        <span>
                          Buffer: +{b.turnaroundMinutes}m until{" "}
                          {b.turnaroundEndIso.slice(11, 16)}
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {storedResources.length > 0 && (
            <div>
              <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2.5">
                Home Base Inventory Stored Here
              </h3>
              <div className="space-y-2">
                {storedResources.map((res) => (
                  <div
                    key={res.id}
                    className="p-2.5 rounded-lg bg-canvas-surface border border-canvas-border flex items-center justify-between text-xs"
                  >
                    <div>
                      <div className="text-slate-200 font-medium">{res.name}</div>
                      <div className="text-slate-400 font-mono text-[11px]">
                        {res.sku}
                      </div>
                    </div>
                    <span className="font-mono text-accent-cyanBright">
                      {res.operationalQuantity}/{res.totalQuantity} units
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="p-4 border-t border-canvas-border bg-canvas-surface/80 flex items-center gap-2.5">
          <button
            onClick={() => {
              setBookingPrefill({
                preferredRoomId: room.id,
                dateStr: selectedDate,
                expectedAttendance: Math.min(60, room.capacity),
                requiredFacilities: room.facilities.slice(0, 2),
              });
              closeDrawer();
              setActiveSection("SMART_BOOKING");
            }}
            className="flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-accent-cyan text-slate-950 font-semibold text-xs hover:bg-accent-cyanBright transition-colors"
          >
            <CalendarPlus className="w-4 h-4" />
            Book {room.code}
          </button>
          {roomBookings.length > 0 && (
            <button
              onClick={() => {
                const targetEvId = roomBookings[0].eventId;
                setShockwaveTargetEventId(targetEvId);
                const disr: Disruption = {
                  id: `disr-rm-${Date.now()}`,
                  type: "ROOM_UNAVAILABLE",
                  title: `${room.name} Facility Outage`,
                  description: `${room.name} (${room.code}) marked unavailable during scheduled operations.`,
                  targetEventId: targetEvId,
                  targetRoomId: room.id,
                  unavailableStartIso: roomBookings[0].setupStartIso,
                  unavailableEndIso: roomBookings[0].turnaroundEndIso,
                  createdAtIso: new Date().toISOString(),
                };
                triggerShockwaveSimulation(disr);
                closeDrawer();
                setActiveSection("SHOCKWAVE");
              }}
              className="flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-amber-500/15 border border-amber-500/40 text-amber-300 font-medium text-xs hover:bg-amber-500/25 transition-colors"
            >
              <Zap className="w-4 h-4" />
              Simulate Outage
            </button>
          )}
        </div>
      </aside>
    );
  }

  if (event) {
    const booking = state.bookings.find(
      (b) => b.eventId === event.id && b.status !== "CANCELLED"
    );
    const assignedRoom = state.rooms.find((r) => r.id === booking?.roomId);
    const feasibility = booking
      ? evaluateRequestFeasibility(
          state,
          {
            roomId: booking.roomId,
            startIso: booking.startIso,
            endIso: booking.endIso,
            setupMinutes: event.setupMinutes,
            cleanupMinutes: event.cleanupMinutes,
            expectedAttendance: event.expectedAttendance,
            requiredFacilities: event.requiredFacilities,
            requiredResources: event.requiredResources,
            requiredPeopleIds: event.requiredPeopleIds,
            requiresExtendedTurnaround: event.requiresExtendedTurnaround,
            overrideTurnaroundReason: booking.overrideReason,
            excludeBookingId: booking.id,
            excludeEventId: event.id,
          },
          false
        )
      : null;

    return (
      <aside
        aria-label="Event Inspector"
        className="fixed inset-y-0 right-0 z-40 w-full max-w-md border-l border-canvas-borderStrong bg-canvas-elevated/95 backdrop-blur-md shadow-2xl flex flex-col"
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-canvas-border">
          <div>
            <div className="flex items-center gap-2">
              <span className="font-mono text-xs px-2 py-0.5 rounded bg-accent-cyan/15 text-accent-cyanBright border border-accent-cyan/30">
                {event.priority}
              </span>
              <span className="text-xs uppercase tracking-wider text-slate-400">
                {event.category.replace(/_/g, " ")}
              </span>
            </div>
            <h2 className="text-lg font-semibold text-slate-100 mt-1">
              {event.title}
            </h2>
          </div>
          <button
            onClick={closeDrawer}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-100 hover:bg-canvas-hover transition-colors"
            aria-label="Close inspector"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          <p className="text-xs text-slate-300 leading-relaxed">
            {event.description}
          </p>

          {feasibility && (
            <div
              className={`p-3.5 rounded-lg border ${
                feasibility.isFeasible
                  ? "bg-emerald-950/25 border-emerald-500/30"
                  : "bg-red-950/30 border-red-500/40"
              }`}
            >
              <div className="flex items-center gap-2 text-xs font-semibold">
                {feasibility.isFeasible ? (
                  <>
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                    <span className="text-emerald-300">
                      ALL HARD CONSTRAINTS VERIFIED
                    </span>
                  </>
                ) : (
                  <>
                    <AlertTriangle className="w-4 h-4 text-red-400" />
                    <span className="text-red-300">
                      ACTIVE CONSTRAINT CONFLICT ({feasibility.violations.length})
                    </span>
                  </>
                )}
              </div>
              {!feasibility.isFeasible && (
                <ul className="mt-2 space-y-1 text-xs text-red-200">
                  {feasibility.violations.map((v, i) => (
                    <li key={i}>• {v.message}</li>
                  ))}
                </ul>
              )}
            </div>
          )}

          {booking && assignedRoom && (
            <div className="p-3.5 rounded-lg bg-canvas-surface border border-canvas-border space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-400">Assigned Venue</span>
                <button
                  onClick={() => {
                    setInspectedEventId(null);
                    setInspectedRoomId(assignedRoom.id);
                  }}
                  className="text-xs font-semibold text-accent-cyanBright hover:underline"
                >
                  {assignedRoom.name} ({assignedRoom.code})
                </button>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-400">Core Event Window</span>
                <span className="font-mono text-slate-100">
                  {booking.startIso.slice(0, 10)} •{" "}
                  {formatTimeRange(booking.startIso, booking.endIso)}
                </span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-400">Protected Setup / Cleanup</span>
                <span className="font-mono text-slate-300">
                  {booking.setupStartIso.slice(11, 16)} –{" "}
                  {booking.cleanupEndIso.slice(11, 16)}
                </span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-400">Mandatory Turnaround</span>
                <span className="font-mono text-amber-300">
                  +{booking.turnaroundMinutes}m (until{" "}
                  {booking.turnaroundEndIso.slice(11, 16)})
                </span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-400">Attendance / Room Cap</span>
                <span className="font-mono text-slate-200">
                  {event.expectedAttendance} / {assignedRoom.capacity} seats
                </span>
              </div>
            </div>
          )}

          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2 flex items-center gap-1.5">
              <Cpu className="w-3.5 h-3.5 text-accent-cyanBright" />
              Allocated Equipment ({event.requiredResources.length})
            </h3>
            {event.requiredResources.length === 0 ? (
              <p className="text-xs text-slate-400">
                No portable inventory required.
              </p>
            ) : (
              <div className="space-y-2">
                {event.requiredResources.map((req) => {
                  const res = state.resources.find(
                    (r) => r.id === req.resourceId
                  );
                  return (
                    <div
                      key={req.resourceId}
                      className="p-2.5 rounded-lg bg-canvas-surface border border-canvas-border flex items-center justify-between text-xs"
                    >
                      <div>
                        <div className="text-slate-200 font-medium">
                          {res?.name ?? req.resourceId}
                        </div>
                        <div className="text-slate-400 text-[11px]">
                          Reused Campus Asset • Value{" "}
                          {formatCurrency(
                            (res?.replacementCostInr ?? 0) * req.quantity
                          )}
                        </div>
                      </div>
                      <span className="font-mono font-semibold px-2 py-0.5 rounded bg-accent-cyan/15 text-accent-cyanBright">
                        ×{req.quantity}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2 flex items-center gap-1.5">
              <UserCheck className="w-3.5 h-3.5 text-accent-cyanBright" />
              Assigned Mentors & Roles ({event.requiredPeopleIds.length})
            </h3>
            <div className="space-y-2">
              {event.requiredPeopleIds.map((pid) => {
                const person = state.people.find((p) => p.id === pid);
                return (
                  <div
                    key={pid}
                    className="p-2.5 rounded-lg bg-canvas-surface border border-canvas-border flex items-center justify-between text-xs"
                  >
                    <div>
                      <div className="text-slate-200 font-medium">
                        {person?.name ?? pid}
                      </div>
                      <div className="text-slate-400 text-[11px]">
                        {person?.roleTitle} • {person?.department}
                      </div>
                    </div>
                    <ShieldCheck className="w-4 h-4 text-emerald-400" />
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        <div className="p-4 border-t border-canvas-border bg-canvas-surface/80 flex items-center gap-2.5">
          <button
            onClick={() => {
              setShockwaveTargetEventId(event.id);
              closeDrawer();
              setActiveSection("SHOCKWAVE");
            }}
            className="flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-accent-cyan text-slate-950 font-semibold text-xs hover:bg-accent-cyanBright transition-colors"
          >
            <Zap className="w-4 h-4" />
            Open in Shockwave
          </button>
          {booking && (
            <button
              onClick={() => {
                cancelBooking(booking.id, "Cancelled from Event Inspector");
                closeDrawer();
              }}
              className="px-3 py-2 rounded-lg bg-red-500/15 border border-red-500/30 text-red-300 hover:bg-red-500/25 text-xs font-medium flex items-center gap-1.5 transition-colors"
            >
              <Trash2 className="w-3.5 h-3.5" />
              Cancel
            </button>
          )}
        </div>
      </aside>
    );
  }

  return null;
}
