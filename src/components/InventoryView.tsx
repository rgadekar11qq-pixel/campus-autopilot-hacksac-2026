"use client";

import React, { useMemo, useState } from "react";
import { useAutopilot } from "@/context/AutopilotContext";
import { formatCurrency, formatTimeRange } from "@/lib/utils";
import {
  Search,
  Filter,
  CheckCircle2,
  AlertTriangle,
  PackageCheck,
  Wrench,
  CalendarPlus,
  Recycle,
  Building2,
} from "lucide-react";

export function InventoryView() {
  const {
    state,
    selectedDate,
    updateAllocationStatus,
    updateResourceCondition,
    setBookingPrefill,
    setActiveSection,
  } = useAutopilot();

  const [searchQuery, setSearchQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("ALL");
  const [selectedResourceId, setSelectedResourceId] = useState<string>(
    state.resources[0]?.id ?? "res-ros-kit"
  );

  const filteredResources = useMemo(() => {
    return state.resources.filter((r) => {
      if (categoryFilter !== "ALL" && r.category !== categoryFilter) {
        return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        return (
          r.name.toLowerCase().includes(q) ||
          r.sku.toLowerCase().includes(q) ||
          r.ownerRole.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [state.resources, categoryFilter, searchQuery]);

  const focusedResource =
    state.resources.find((r) => r.id === selectedResourceId) ??
    filteredResources[0] ??
    null;

  const totalCatalogValueInr = state.resources.reduce(
    (sum, r) => sum + r.replacementCostInr * r.totalQuantity,
    0
  );

  const totalReusedValueInr = state.resourceAllocations
    .filter((a) => a.status !== "CANCELLED")
    .reduce((sum, a) => {
      const r = state.resources.find((res) => res.id === a.resourceId);
      return sum + (r?.replacementCostInr ?? 0) * a.quantity;
    }, 0);

  return (
    <div className="space-y-6">
      {/* Top Reuse & Catalog Summary Bar */}
      <div className="p-5 rounded-2xl ops-card border border-canvas-border flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 font-mono text-[10px] font-bold">
            CIRCULATING CAMPUS INVENTORY
          </span>
          <h1 className="text-xl font-bold text-slate-100 mt-1.5">
            Shared Equipment Pool & Return Ledger
          </h1>
        </div>

        <div className="flex flex-wrap items-center gap-3 font-mono text-xs">
          <div className="px-4 py-2.5 rounded-xl bg-canvas-surface border border-canvas-border">
            <div className="text-[10px] text-slate-400 uppercase">
              Catalog Value
            </div>
            <div className="text-base font-bold text-slate-100">
              {formatCurrency(totalCatalogValueInr)}
            </div>
          </div>
          <div className="px-4 py-2.5 rounded-xl bg-emerald-950/35 border border-emerald-500/40">
            <div className="text-[10px] text-emerald-300 uppercase flex items-center gap-1">
              <Recycle className="w-3 h-3" />
              Cost Avoided via Reuse
            </div>
            <div className="text-base font-bold text-emerald-300">
              {formatCurrency(totalReusedValueInr)}
            </div>
          </div>
        </div>
      </div>

      {/* Search & Category Filter */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="relative flex-1 min-w-[240px] max-w-md">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search SKU, equipment, or custodian..."
            className="w-full pl-9 pr-3 py-2 rounded-xl ops-card border border-canvas-border text-xs text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-accent-cyan"
          />
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          <Filter className="w-3.5 h-3.5 text-slate-400 mr-1" />
          {(
            [
              "ALL",
              "ROBOTICS",
              "AV_EQUIPMENT",
              "COMPUTE",
              "FABRICATION",
            ] as const
          ).map((cat) => (
            <button
              key={cat}
              onClick={() => setCategoryFilter(cat)}
              className={`px-3 py-1.5 rounded-xl text-xs font-medium border transition-colors ${
                categoryFilter === cat
                  ? "bg-accent-cyan text-slate-950 border-accent-cyan font-bold"
                  : "ops-card border-canvas-border text-slate-300 hover:text-slate-100"
              }`}
            >
              {cat.replace(/_/g, " ")}
            </button>
          ))}
        </div>
      </div>

      {/* Main Catalog Grid + Detailed Resource Inspector */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left 7 Columns: Visual Catalog Cards */}
        <div className="lg:col-span-7 grid grid-cols-1 sm:grid-cols-2 gap-3.5 content-start">
          {filteredResources.map((res) => {
            const isSelected = focusedResource?.id === res.id;
            const homeRoom = state.rooms.find(
              (rm) => rm.id === res.locationRoomId
            );
            const activeAllocs = state.resourceAllocations.filter(
              (a) =>
                a.resourceId === res.id &&
                (a.status === "RESERVED" || a.status === "CHECKED_OUT")
            );
            const opPct = Math.round(
              (res.operationalQuantity / Math.max(1, res.totalQuantity)) * 100
            );

            return (
              <div
                key={res.id}
                onClick={() => setSelectedResourceId(res.id)}
                className={`p-4 rounded-2xl border transition-all cursor-pointer flex flex-col justify-between ${
                  isSelected
                    ? "ops-card border-accent-cyan ops-glow-cyan"
                    : "ops-card border-canvas-border hover:border-canvas-borderStrong"
                }`}
              >
                <div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-mono text-[10px] px-2 py-0.5 rounded bg-canvas-surface border border-canvas-border text-accent-cyanBright">
                      {res.sku}
                    </span>
                    <span
                      className={`text-[10px] font-mono px-2 py-0.5 rounded-full font-semibold ${
                        res.condition === "OPTIMAL" || res.condition === "GOOD"
                          ? "bg-emerald-500/15 text-emerald-300"
                          : "bg-amber-500/20 text-amber-300"
                      }`}
                    >
                      {res.condition}
                    </span>
                  </div>

                  <h3 className="text-sm font-bold text-slate-100 mt-2">
                    {res.name}
                  </h3>
                </div>

                <div className="mt-4 space-y-2">
                  <div className="flex items-baseline justify-between font-mono">
                    <span className="text-xs text-slate-400">Active Pool</span>
                    <span className="text-base font-bold text-slate-100">
                      {res.operationalQuantity}
                      <span className="text-xs text-slate-500">
                        /{res.totalQuantity}
                      </span>
                    </span>
                  </div>

                  <div className="h-1.5 w-full rounded-full bg-canvas-surface overflow-hidden">
                    <div
                      className={`h-full rounded-full ${
                        opPct === 100 ? "bg-emerald-400" : "bg-amber-400"
                      }`}
                      style={{ width: `${opPct}%` }}
                    />
                  </div>

                  <div className="pt-2 border-t border-canvas-border/60 flex items-center justify-between text-[11px] font-mono text-slate-400">
                    <span className="flex items-center gap-1">
                      <Building2 className="w-3 h-3 text-slate-500" />
                      {homeRoom?.code ?? res.locationRoomId}
                    </span>
                    <span className="text-accent-cyanBright">
                      {activeAllocs.length} reservations
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Right 5 Columns: Selected Resource Detail & Return Verification */}
        <div className="lg:col-span-5">
          {focusedResource && (
            <div className="sticky top-28 rounded-2xl ops-card border border-canvas-border p-5 space-y-4">
              <div className="flex items-start justify-between border-b border-canvas-border pb-3.5">
                <div>
                  <span className="font-mono text-xs text-accent-cyanBright">
                    {focusedResource.sku} •{" "}
                    {formatCurrency(focusedResource.replacementCostInr)}/unit
                  </span>
                  <h2 className="text-base font-bold text-slate-100 mt-0.5">
                    {focusedResource.name}
                  </h2>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Custodian: {focusedResource.ownerRole}
                  </p>
                </div>
                <button
                  onClick={() => {
                    setBookingPrefill({
                      dateStr: selectedDate,
                      requiredResources: [
                        { resourceId: focusedResource.id, quantity: 2 },
                      ],
                    });
                    setActiveSection("SMART_BOOKING");
                  }}
                  className="px-3 py-2 rounded-xl bg-accent-cyan text-slate-950 font-bold text-xs flex items-center gap-1.5 hover:bg-accent-cyanBright transition-colors shrink-0"
                >
                  <CalendarPlus className="w-3.5 h-3.5" />
                  Allocate
                </button>
              </div>

              {/* Operational Pool Controls */}
              <div className="p-3.5 rounded-xl bg-canvas-surface/90 border border-canvas-border space-y-2.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-slate-200 flex items-center gap-1.5">
                    <Wrench className="w-3.5 h-3.5 text-amber-400" />
                    Pool Control
                  </span>
                  <span className="font-mono text-slate-300 font-bold">
                    {focusedResource.operationalQuantity}/
                    {focusedResource.totalQuantity} units
                  </span>
                </div>

                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={() =>
                      updateResourceCondition(
                        focusedResource.id,
                        "OPTIMAL",
                        focusedResource.totalQuantity,
                        "Full pool verified optimal by lab custodian"
                      )
                    }
                    className="px-2.5 py-1 rounded-lg bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/30 text-emerald-300 text-xs font-medium"
                  >
                    Restore Full Pool ({focusedResource.totalQuantity})
                  </button>
                  <button
                    onClick={() =>
                      updateResourceCondition(
                        focusedResource.id,
                        "MAINTENANCE",
                        Math.max(0, focusedResource.operationalQuantity - 1),
                        "1 unit moved to bench maintenance"
                      )
                    }
                    className="px-2.5 py-1 rounded-lg bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/30 text-amber-300 text-xs font-medium"
                  >
                    Quarantine 1 Unit
                  </button>
                </div>
              </div>

              {/* Reservations & Return Ledger */}
              <div className="space-y-2.5">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                  <PackageCheck className="w-3.5 h-3.5 text-accent-cyanBright" />
                  Checkouts & Return Verification
                </h3>

                {state.resourceAllocations
                  .filter((a) => a.resourceId === focusedResource.id)
                  .map((alloc) => {
                    const ev = state.events.find((e) => e.id === alloc.eventId);
                    const isActive =
                      alloc.status === "RESERVED" ||
                      alloc.status === "CHECKED_OUT";

                    return (
                      <div
                        key={alloc.id}
                        className="p-3 rounded-xl bg-canvas-surface/90 border border-canvas-border space-y-2 text-xs"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-semibold text-slate-100 truncate">
                            {ev?.title ?? alloc.eventId}
                          </span>
                          <span className="font-mono font-bold text-accent-cyanBright shrink-0">
                            ×{alloc.quantity}
                          </span>
                        </div>

                        <div className="flex items-center justify-between text-[11px] font-mono text-slate-400">
                          <span>
                            {formatTimeRange(alloc.startIso, alloc.endIso)}
                          </span>
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] ${
                              alloc.status === "RETURNED"
                                ? "bg-emerald-500/15 text-emerald-300"
                                : alloc.status === "DAMAGED_ON_RETURN" ||
                                  alloc.status === "MISSING_ON_RETURN"
                                ? "bg-red-500/20 text-red-300"
                                : "bg-accent-cyan/15 text-accent-cyanBright"
                            }`}
                          >
                            {alloc.status.replace(/_/g, " ")}
                          </span>
                        </div>

                        {isActive && (
                          <div className="pt-2 border-t border-canvas-border/60 flex flex-wrap items-center gap-1.5">
                            <button
                              onClick={() =>
                                updateAllocationStatus(
                                  alloc.id,
                                  "RETURNED",
                                  `All ${alloc.quantity} units returned optimal`
                                )
                              }
                              className="px-2 py-1 rounded-lg bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/30 text-emerald-300 text-[11px] font-medium flex items-center gap-1"
                            >
                              <CheckCircle2 className="w-3 h-3" />
                              Returned OK
                            </button>
                            <button
                              onClick={() =>
                                updateAllocationStatus(
                                  alloc.id,
                                  "DAMAGED_ON_RETURN",
                                  "1 unit returned damaged",
                                  1
                                )
                              }
                              className="px-2 py-1 rounded-lg bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/30 text-amber-300 text-[11px] font-medium flex items-center gap-1"
                            >
                              <AlertTriangle className="w-3 h-3" />1 Damaged
                            </button>
                            <button
                              onClick={() =>
                                updateAllocationStatus(
                                  alloc.id,
                                  "MISSING_ON_RETURN",
                                  "1 unit missing at check-in",
                                  1
                                )
                              }
                              className="px-2 py-1 rounded-lg bg-red-500/15 hover:bg-red-500/25 border border-red-500/30 text-red-300 text-[11px] font-medium"
                            >
                              1 Missing
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
