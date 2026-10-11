"use client";

import React, { useMemo, useState } from "react";
import { useAutopilot } from "@/context/AutopilotContext";
import { detectGlobalConflicts } from "@/domain/engine";
import { EventCategory } from "@/domain/types";
import { DEMO_PRIMARY_DATE } from "@/domain/seedData";
import { formatShortDate, formatTimeRange } from "@/lib/utils";
import {
  ChevronLeft,
  ChevronRight,
  Search,
  Filter,
  CalendarPlus,
  Users,
  AlertTriangle,
  Clock,
  Layers,
} from "lucide-react";

const TIMELINE_START_HOUR = 8; // 08:00
const TIMELINE_END_HOUR = 19;  // 19:00
const TOTAL_MINUTES = (TIMELINE_END_HOUR - TIMELINE_START_HOUR) * 60; // 660 mins

function isoToOffsetPercent(iso: string): number {
  const d = new Date(iso);
  const minsFromStart =
    (d.getHours() - TIMELINE_START_HOUR) * 60 + d.getMinutes();
  const clamped = Math.max(0, Math.min(TOTAL_MINUTES, minsFromStart));
  return (clamped / TOTAL_MINUTES) * 100;
}

function spanToWidthPercent(startIso: string, endIso: string): number {
  const left = isoToOffsetPercent(startIso);
  const right = isoToOffsetPercent(endIso);
  return Math.max(0.8, right - left);
}

const WEEK_DATES = [
  "2026-10-14",
  "2026-10-15",
  "2026-10-16",
  "2026-10-17",
];

export function TimelineView() {
  const {
    state,
    selectedDate,
    setSelectedDate,
    setInspectedRoomId,
    setInspectedEventId,
    setBookingPrefill,
    setActiveSection,
  } = useAutopilot();

  const [viewMode, setViewMode] = useState<"DAY" | "WEEK">("DAY");
  const [buildingFilter, setBuildingFilter] = useState<string>("ALL");
  const [categoryFilter, setCategoryFilter] = useState<string>("ALL");
  const [searchQuery, setSearchQuery] = useState<string>("");

  const globalConflicts = useMemo(() => detectGlobalConflicts(state), [state]);

  const filteredRooms = useMemo(() => {
    return state.rooms.filter((room) => {
      if (buildingFilter !== "ALL" && room.buildingId !== buildingFilter) {
        return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesRoom =
          room.name.toLowerCase().includes(q) ||
          room.code.toLowerCase().includes(q);
        const matchesBookingOnDay = state.bookings.some((b) => {
          if (b.roomId !== room.id || b.status === "CANCELLED") return false;
          const ev = state.events.find((e) => e.id === b.eventId);
          return ev?.title.toLowerCase().includes(q);
        });
        if (!matchesRoom && !matchesBookingOnDay) return false;
      }
      return true;
    });
  }, [state.rooms, state.bookings, state.events, buildingFilter, searchQuery]);

  const shiftDate = (deltaDays: number) => {
    const d = new Date(`${selectedDate}T12:00:00`);
    d.setDate(d.getDate() + deltaDays);
    const pad = (n: number) => String(n).padStart(2, "0");
    setSelectedDate(
      `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
    );
  };

  const hours = Array.from(
    { length: TIMELINE_END_HOUR - TIMELINE_START_HOUR + 1 },
    (_, i) => TIMELINE_START_HOUR + i
  );

  return (
    <div className="space-y-5">
      {/* Top Toolbar: View Switcher, Date Controls, Filters, and Search */}
      <div className="p-4 rounded-xl bg-canvas-elevated border border-canvas-border flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-3">
          {/* Day / Week toggle */}
          <div className="inline-flex rounded-lg bg-canvas-surface p-1 border border-canvas-border">
            <button
              onClick={() => setViewMode("DAY")}
              className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-colors ${
                viewMode === "DAY"
                  ? "bg-accent-cyan text-slate-950"
                  : "text-slate-300 hover:text-slate-100"
              }`}
            >
              Day Precision View
            </button>
            <button
              onClick={() => setViewMode("WEEK")}
              className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-colors ${
                viewMode === "WEEK"
                  ? "bg-accent-cyan text-slate-950"
                  : "text-slate-300 hover:text-slate-100"
              }`}
            >
              Week Matrix View
            </button>
          </div>

          {/* Date Navigation */}
          <div className="flex items-center gap-1.5 bg-canvas-surface px-2 py-1 rounded-lg border border-canvas-border">
            <button
              onClick={() => shiftDate(-1)}
              className="p-1 rounded hover:bg-canvas-hover text-slate-300"
              aria-label="Previous Day"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="font-mono text-xs font-semibold text-slate-100 px-2">
              {selectedDate} ({formatShortDate(`${selectedDate}T12:00:00`)})
            </span>
            <button
              onClick={() => shiftDate(1)}
              className="p-1 rounded hover:bg-canvas-hover text-slate-300"
              aria-label="Next Day"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
            {selectedDate !== DEMO_PRIMARY_DATE && (
              <button
                onClick={() => setSelectedDate(DEMO_PRIMARY_DATE)}
                className="text-[11px] font-mono px-2 py-0.5 rounded bg-accent-cyan/15 text-accent-cyanBright hover:bg-accent-cyan/25 ml-1"
              >
                HackSAC Day
              </button>
            )}
          </div>
        </div>

        {/* Filters & Search */}
        <div className="flex flex-wrap items-center gap-2.5">
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search room, code, or session..."
              className="pl-8 pr-3 py-1.5 rounded-lg bg-canvas-surface border border-canvas-border text-xs text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-accent-cyan"
            />
          </div>

          <div className="flex items-center gap-1.5 bg-canvas-surface px-2.5 py-1.5 rounded-lg border border-canvas-border text-xs">
            <Filter className="w-3.5 h-3.5 text-slate-400" />
            <select
              value={buildingFilter}
              onChange={(e) => setBuildingFilter(e.target.value)}
              aria-label="Filter by Building"
              className="bg-transparent text-slate-200 focus:outline-none"
            >
              <option value="ALL" className="bg-canvas-elevated">
                All Buildings
              </option>
              {state.buildings.map((b) => (
                <option
                  key={b.id}
                  value={b.id}
                  className="bg-canvas-elevated"
                >
                  {b.code} — {b.name}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-1.5 bg-canvas-surface px-2.5 py-1.5 rounded-lg border border-canvas-border text-xs">
            <Layers className="w-3.5 h-3.5 text-slate-400" />
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              aria-label="Filter by Event Type"
              className="bg-transparent text-slate-200 focus:outline-none"
            >
              <option value="ALL" className="bg-canvas-elevated">
                All Event Types
              </option>
              {(
                [
                  "WORKSHOP",
                  "HACKATHON_SESSION",
                  "LECTURE",
                  "LAB_PRACTICAL",
                  "CLUB_MEET",
                  "COMPETITION",
                ] as EventCategory[]
              ).map((cat) => (
                <option key={cat} value={cat} className="bg-canvas-elevated">
                  {cat.replace(/_/g, " ")}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Legend Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-2.5 rounded-lg bg-canvas-surface/70 border border-canvas-border text-xs text-slate-300">
        <div className="flex flex-wrap items-center gap-5">
          <span className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-sm bg-accent-cyan/30 border border-accent-cyan inline-block" />
            Confirmed Session
          </span>
          <span className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-sm bg-slate-700/70 border border-slate-500 inline-block" />
            Protected Setup / Cleanup
          </span>
          <span className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-sm bg-stripe-amber border border-amber-500/50 inline-block" />
            Mandatory Turnaround Gap (15m / 30m)
          </span>
          <span className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-sm bg-stripe-red border border-red-500/60 inline-block" />
            Room Unavailable / Outage Lock
          </span>
        </div>
        <span className="text-slate-400 font-mono text-[11px]">
          Click any free hour slot in a room row to launch Smart Booking
        </span>
      </div>

      {viewMode === "DAY" ? (
        /* DAY TIMELINE GRID */
        <div className="rounded-xl bg-canvas-elevated border border-canvas-border overflow-x-auto">
          <div className="min-w-[920px]">
            {/* Time Ruler Header */}
            <div className="grid grid-cols-12 border-b border-canvas-border bg-canvas-surface/80">
              <div className="col-span-3 px-4 py-3 text-xs font-semibold uppercase tracking-wider text-slate-400 border-r border-canvas-border">
                Campus Space / Capacity / Policy
              </div>
              <div className="col-span-9 relative h-10 flex items-center">
                {hours.slice(0, -1).map((hr, idx) => (
                  <div
                    key={hr}
                    style={{
                      width: `${100 / (hours.length - 1)}%`,
                    }}
                    className={`h-full flex items-center pl-2 font-mono text-[11px] text-slate-400 ${
                      idx > 0 ? "border-l border-canvas-border/60" : ""
                    }`}
                  >
                    {String(hr).padStart(2, "0")}:00
                  </div>
                ))}
              </div>
            </div>

            {/* Room Rows */}
            {filteredRooms.map((room) => {
              const building = state.buildings.find(
                (b) => b.id === room.buildingId
              );
              const turnaround = room.customTurnaroundMinutes ?? 15;

              const roomBookings = state.bookings.filter((b) => {
                if (
                  b.roomId !== room.id ||
                  b.status === "CANCELLED" ||
                  !b.startIso.startsWith(selectedDate)
                ) {
                  return false;
                }
                if (categoryFilter !== "ALL") {
                  const ev = state.events.find((e) => e.id === b.eventId);
                  if (ev?.category !== categoryFilter) return false;
                }
                return true;
              });

              const roomLocks = state.availabilityWindows.filter(
                (w) =>
                  w.entityType === "ROOM" &&
                  w.entityId === room.id &&
                  w.startIso.startsWith(selectedDate)
              );

              return (
                <div
                  key={room.id}
                  className="grid grid-cols-12 border-b border-canvas-border last:border-b-0 hover:bg-canvas-surface/30 transition-colors"
                >
                  {/* Left Room Info Column */}
                  <div className="col-span-3 p-3.5 border-r border-canvas-border flex flex-col justify-between">
                    <div>
                      <div className="flex items-center justify-between gap-2">
                        <button
                          onClick={() => setInspectedRoomId(room.id)}
                          className="text-sm font-semibold text-slate-100 hover:text-accent-cyanBright text-left transition-colors"
                        >
                          {room.name}
                        </button>
                        <span className="font-mono text-[11px] px-1.5 py-0.5 rounded bg-canvas-surface border border-canvas-border text-slate-300">
                          {room.code}
                        </span>
                      </div>
                      <div className="mt-1 flex items-center gap-3 text-xs text-slate-400">
                        <span className="flex items-center gap-1">
                          <Users className="w-3 h-3 text-accent-cyanBright" />
                          {room.capacity}
                        </span>
                        <span className="flex items-center gap-1 font-mono text-amber-300/90">
                          <Clock className="w-3 h-3" />
                          {turnaround}m gap
                        </span>
                        <span>{building?.code}</span>
                      </div>
                    </div>

                    <div className="mt-2.5 flex items-center justify-between">
                      <button
                        onClick={() => setInspectedRoomId(room.id)}
                        className="text-[11px] text-slate-400 hover:text-slate-200 underline"
                      >
                        Inspect Specs ({room.facilities.length})
                      </button>
                      <button
                        onClick={() => {
                          setBookingPrefill({
                            preferredRoomId: room.id,
                            dateStr: selectedDate,
                            startTimeStr: "14:00",
                            expectedAttendance: Math.min(60, room.capacity),
                          });
                          setActiveSection("SMART_BOOKING");
                        }}
                        className="inline-flex items-center gap-1 text-[11px] font-medium text-accent-cyanBright hover:underline"
                      >
                        <CalendarPlus className="w-3 h-3" />
                        Book Slot
                      </button>
                    </div>
                  </div>

                  {/* Right Interactive Timeline Track */}
                  <div className="col-span-9 relative h-24 bg-ops-grid">
                    {/* Clickable Free Hour Slots */}
                    <div className="absolute inset-0 flex">
                      {hours.slice(0, -1).map((hr) => {
                        const slotStr = `${String(hr).padStart(2, "0")}:00`;
                        return (
                          <button
                            key={hr}
                            onClick={() => {
                              setBookingPrefill({
                                preferredRoomId: room.id,
                                dateStr: selectedDate,
                                startTimeStr: slotStr,
                                durationMinutes: 60,
                                expectedAttendance: Math.min(50, room.capacity),
                              });
                              setActiveSection("SMART_BOOKING");
                            }}
                            title={`Click to book ${room.name} starting at ${slotStr}`}
                            className="h-full border-l border-canvas-border/40 first:border-l-0 hover:bg-accent-cyan/5 group relative transition-colors"
                            style={{
                              width: `${100 / (hours.length - 1)}%`,
                            }}
                          >
                            <span className="opacity-0 group-hover:opacity-100 absolute bottom-1 left-1.5 text-[10px] font-mono text-accent-cyanBright pointer-events-none">
                              +{slotStr}
                            </span>
                          </button>
                        );
                      })}
                    </div>

                    {/* Unavailability / Maintenance Lock Windows */}
                    {roomLocks.map((lock) => {
                      const left = isoToOffsetPercent(lock.startIso);
                      const width = spanToWidthPercent(
                        lock.startIso,
                        lock.endIso
                      );
                      return (
                        <div
                          key={lock.id}
                          onClick={() => setInspectedRoomId(room.id)}
                          style={{ left: `${left}%`, width: `${width}%` }}
                          className="absolute top-2 bottom-2 z-10 rounded-md bg-stripe-red border border-red-500/60 px-2 py-1 flex flex-col justify-center cursor-pointer shadow-sm"
                          title={`${lock.status}: ${lock.reason}`}
                        >
                          <div className="text-[10px] font-mono font-bold text-red-300 uppercase truncate">
                            {lock.status} LOCK
                          </div>
                          <div className="text-[10px] text-red-200 truncate">
                            {lock.reason}
                          </div>
                        </div>
                      );
                    })}

                    {/* Bookings with Setup, Core Event, Cleanup, and Turnaround Blocks */}
                    {roomBookings.map((bkg) => {
                      const ev = state.events.find((e) => e.id === bkg.eventId);
                      const hasConflict = globalConflicts.some(
                        (c) => c.bookingId === bkg.id
                      );

                      const setupLeft = isoToOffsetPercent(bkg.setupStartIso);
                      const setupWidth = spanToWidthPercent(
                        bkg.setupStartIso,
                        bkg.startIso
                      );

                      const coreLeft = isoToOffsetPercent(bkg.startIso);
                      const coreWidth = spanToWidthPercent(
                        bkg.startIso,
                        bkg.endIso
                      );

                      const cleanupLeft = isoToOffsetPercent(bkg.endIso);
                      const cleanupWidth = spanToWidthPercent(
                        bkg.endIso,
                        bkg.cleanupEndIso
                      );

                      const turnLeft = isoToOffsetPercent(bkg.cleanupEndIso);
                      const turnWidth = spanToWidthPercent(
                        bkg.cleanupEndIso,
                        bkg.turnaroundEndIso
                      );

                      return (
                        <React.Fragment key={bkg.id}>
                          {/* Setup Block */}
                          {setupWidth > 0.5 && (
                            <div
                              style={{
                                left: `${setupLeft}%`,
                                width: `${setupWidth}%`,
                              }}
                              title={`Protected Setup (${bkg.setupStartIso.slice(
                                11,
                                16
                              )}–${bkg.startIso.slice(11, 16)})`}
                              className="absolute top-4 bottom-4 z-10 rounded-l bg-slate-800/90 border-y border-l border-slate-500/60 flex items-center justify-center overflow-hidden"
                            >
                              <span className="text-[9px] font-mono text-slate-300">
                                SET
                              </span>
                            </div>
                          )}

                          {/* Core Event Block */}
                          <div
                            onClick={() => setInspectedEventId(bkg.eventId)}
                            role="button"
                            tabIndex={0}
                            onKeyDown={(e) => {
                              if (e.key === "Enter" || e.key === " ") {
                                setInspectedEventId(bkg.eventId);
                              }
                            }}
                            style={{
                              left: `${coreLeft}%`,
                              width: `${coreWidth}%`,
                            }}
                            className={`absolute top-2.5 bottom-2.5 z-20 rounded-md px-2.5 py-1.5 flex flex-col justify-between cursor-pointer transition-transform hover:scale-[1.01] shadow-md ${
                              hasConflict
                                ? "bg-red-950/90 border-2 border-red-400 text-red-100"
                                : ev?.isDemoTarget
                                ? "bg-teal-950/95 border-2 border-accent-cyanBright text-slate-100"
                                : "bg-slate-900/95 border border-accent-cyan/60 text-slate-100"
                            }`}
                          >
                            <div className="flex items-center justify-between gap-1">
                              <span className="text-xs font-semibold truncate">
                                {ev?.title ?? bkg.eventId}
                              </span>
                              {hasConflict && (
                                <AlertTriangle className="w-3.5 h-3.5 text-red-300 shrink-0" />
                              )}
                            </div>
                            <div className="flex items-center justify-between text-[10px] font-mono text-slate-300">
                              <span>
                                {formatTimeRange(bkg.startIso, bkg.endIso)}
                              </span>
                              <span>{ev?.expectedAttendance}p</span>
                            </div>
                          </div>

                          {/* Cleanup Block */}
                          {cleanupWidth > 0.5 && (
                            <div
                              style={{
                                left: `${cleanupLeft}%`,
                                width: `${cleanupWidth}%`,
                              }}
                              title={`Protected Cleanup (${bkg.endIso.slice(
                                11,
                                16
                              )}–${bkg.cleanupEndIso.slice(11, 16)})`}
                              className="absolute top-4 bottom-4 z-10 bg-slate-800/90 border-y border-r border-slate-500/60 flex items-center justify-center overflow-hidden"
                            >
                              <span className="text-[9px] font-mono text-slate-300">
                                CLN
                              </span>
                            </div>
                          )}

                          {/* Mandatory Turnaround Buffer Block */}
                          {bkg.turnaroundMinutes > 0 && (
                            <div
                              style={{
                                left: `${turnLeft}%`,
                                width: `${turnWidth}%`,
                              }}
                              title={`Mandatory ${
                                bkg.turnaroundMinutes
                              }m Turnaround Gap (${bkg.cleanupEndIso.slice(
                                11,
                                16
                              )}–${bkg.turnaroundEndIso.slice(11, 16)})`}
                              className="absolute top-4 bottom-4 z-10 rounded-r bg-stripe-amber border border-amber-500/50 flex items-center justify-center overflow-hidden"
                            >
                              <span className="text-[9px] font-mono text-amber-300 font-semibold">
                                +{bkg.turnaroundMinutes}m
                              </span>
                            </div>
                          )}
                        </React.Fragment>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        /* WEEK MATRIX VIEW */
        <div className="rounded-xl bg-canvas-elevated border border-canvas-border overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[780px]">
            <thead>
              <tr className="border-b border-canvas-border bg-canvas-surface/80 text-xs font-mono text-slate-400">
                <th className="p-3.5 border-r border-canvas-border w-64">
                  Room / Space
                </th>
                {WEEK_DATES.map((dStr) => (
                  <th
                    key={dStr}
                    className={`p-3.5 border-r border-canvas-border last:border-r-0 ${
                      dStr === selectedDate
                        ? "text-accent-cyanBright bg-accent-cyan/5"
                        : ""
                    }`}
                  >
                    <button
                      onClick={() => {
                        setSelectedDate(dStr);
                        setViewMode("DAY");
                      }}
                      className="hover:underline text-left"
                    >
                      <div>{formatShortDate(`${dStr}T12:00:00`)}</div>
                      <div className="text-[11px] text-slate-500">{dStr}</div>
                    </button>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filteredRooms.map((room) => (
                <tr
                  key={room.id}
                  className="border-b border-canvas-border last:border-b-0"
                >
                  <td className="p-3.5 border-r border-canvas-border align-top">
                    <button
                      onClick={() => setInspectedRoomId(room.id)}
                      className="font-semibold text-sm text-slate-100 hover:text-accent-cyanBright"
                    >
                      {room.name}
                    </button>
                    <div className="text-xs text-slate-400 mt-1 font-mono">
                      {room.code} • Cap {room.capacity} •{" "}
                      {room.customTurnaroundMinutes ?? 15}m gap
                    </div>
                  </td>
                  {WEEK_DATES.map((dStr) => {
                    const cellBookings = state.bookings
                      .filter(
                        (b) =>
                          b.roomId === room.id &&
                          b.status !== "CANCELLED" &&
                          b.startIso.startsWith(dStr)
                      )
                      .sort((a, b) => a.startIso.localeCompare(b.startIso));

                    return (
                      <td
                        key={dStr}
                        className="p-2.5 border-r border-canvas-border last:border-r-0 align-top space-y-2"
                      >
                        {cellBookings.map((b) => {
                          const ev = state.events.find(
                            (e) => e.id === b.eventId
                          );
                          return (
                            <button
                              key={b.id}
                              onClick={() => setInspectedEventId(b.eventId)}
                              className="w-full text-left p-2 rounded bg-canvas-surface hover:bg-canvas-hover border border-canvas-border text-xs transition-colors"
                            >
                              <div className="font-mono text-[11px] text-accent-cyanBright">
                                {formatTimeRange(b.startIso, b.endIso)}
                              </div>
                              <div className="font-medium text-slate-100 truncate mt-0.5">
                                {ev?.title}
                              </div>
                            </button>
                          );
                        })}
                        <button
                          onClick={() => {
                            setBookingPrefill({
                              preferredRoomId: room.id,
                              dateStr: dStr,
                              startTimeStr: "14:00",
                            });
                            setActiveSection("SMART_BOOKING");
                          }}
                          className="w-full py-1 rounded border border-dashed border-canvas-border text-[11px] text-slate-400 hover:text-accent-cyanBright hover:border-accent-cyan/40 transition-colors"
                        >
                          + Book Slot
                        </button>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
