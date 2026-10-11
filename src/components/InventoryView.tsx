"use client";

import React, { useMemo, useState } from "react";
import { useAutopilot } from "@/context/AutopilotContext";
import { ResourceCategory, ResourceCondition } from "@/domain/types";
import { formatCurrency, formatTimeRange } from "@/lib/utils";
import {
  Search,
  Filter,
  Cpu,
  CheckCircle2,
  AlertTriangle,
  PackageCheck,
  Wrench,
  CalendarPlus,
  Recycle,
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
      <div className="p-4 rounded-xl bg-canvas-elevated border border-canvas-border flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 font-mono text-[11px]">
              CIRCULATING CAMPUS ASSETS
            </span>
          </div>
          <h1 className="text-lg font-bold text-slate-100 mt-1">
            Resource Inventory & Return Verification Ledger
          </h1>
          <p className="text-xs text-slate-400">
            Derived availability from active reservations, checkout tracking,
            damage/missing reporting, and documented procurement cost avoidance.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3 font-mono text-xs">
          <div className="px-3.5 py-2 rounded-lg bg-canvas-surface border border-canvas-border">
            <div className="text-[10px] text-slate-400 uppercase">
              Total Catalog Asset Value
            </div>
            <div className="text-sm font-bold text-slate-100">
              {formatCurrency(totalCatalogValueInr)}
            </div>
          </div>
          <div className="px-3.5 py-2 rounded-lg bg-emerald-950/30 border border-emerald-500/40">
            <div className="text-[10px] text-emerald-300 uppercase flex items-center gap-1">
              <Recycle className="w-3 h-3" />
              Purchase Cost Avoided via Reuse
            </div>
            <div className="text-sm font-bold text-emerald-300">
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
            placeholder="Search by SKU, equipment name, or custodian role..."
            className="w-full pl-9 pr-3 py-2 rounded-lg bg-canvas-elevated border border-canvas-border text-xs text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-accent-cyan"
          />
        </div>

        <div className="flex items-center gap-2">
          <Filter className="w-3.5 h-3.5 text-slate-400" />
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
              className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                categoryFilter === cat
                  ? "bg-accent-cyan text-slate-950 border-accent-cyan font-semibold"
                  : "bg-canvas-elevated border-canvas-border text-slate-300 hover:text-slate-100"
              }`}
            >
              {cat.replace(/_/g, " ")}
            </button>
          ))}
        </div>
      </div>

      {/* Main Catalog Grid + Detailed Resource Inspector & Return Ledger */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left 7 Columns: Catalog Cards */}
        <div className="lg:col-span-7 space-y-3">
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
            const committedUnits = activeAllocs.reduce(
              (s, a) => s + a.quantity,
              0
            );

            return (
              <div
                key={res.id}
                onClick={() => setSelectedResourceId(res.id)}
                className={`p-4 rounded-xl border transition-all cursor-pointer ${
                  isSelected
                    ? "bg-canvas-surface border-accent-cyan shadow-lg"
                    : "bg-canvas-elevated hover:bg-canvas-surface border-canvas-border"
                }`}
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-[11px] px-2 py-0.5 rounded bg-canvas-elevated border border-canvas-border text-accent-cyanBright">
                        {res.sku}
                      </span>
                      <span className="text-xs text-slate-400 uppercase font-mono">
                        {res.category.replace(/_/g, " ")}
                      </span>
                      <span
                        className={`text-[10px] font-mono px-2 py-0.5 rounded ${
                          res.condition === "OPTIMAL" ||
                          res.condition === "GOOD"
                            ? "bg-emerald-500/15 text-emerald-300"
                            : "bg-amber-500/20 text-amber-300"
                        }`}
                      >
                        {res.condition}
                      </span>
                    </div>
                    <h3 className="text-base font-semibold text-slate-100 mt-1">
                      {res.name}
                    </h3>
                  </div>

                  <div className="text-right font-mono">
                    <div className="text-lg font-bold text-slate-100">
                      {res.operationalQuantity}{" "}
                      <span className="text-xs font-normal text-slate-400">
                        / {res.totalQuantity} op
                      </span>
                    </div>
                    <div className="text-[11px] text-slate-400">
                      {formatCurrency(res.replacementCostInr)} / unit
                    </div>
                  </div>
                </div>

                <p className="text-xs text-slate-400 mt-2">{res.notes}</p>

                <div className="mt-3 pt-2.5 border-t border-canvas-border flex flex-wrap items-center justify-between gap-2 text-xs">
                  <div className="flex items-center gap-4 text-slate-300">
                    <span>
                      Base: <strong>{homeRoom?.code ?? res.locationRoomId}</strong>
                    </span>
                    <span>
                      Custodian: <strong>{res.ownerRole}</strong>
                    </span>
                    <span className="font-mono text-accent-cyanBright">
                      {activeAllocs.length} active reservations ({committedUnits}{" "}
                      units)
                    </span>
                  </div>

                  <span className="text-[11px] text-emerald-300 font-medium flex items-center gap-1">
                    <Recycle className="w-3.5 h-3.5" />
                    Reuse Ready (No Purchase Needed)
                  </span>
                </div>
              </div>
            );
          })}
        </div>

        {/* Right 5 Columns: Selected Resource Detail, Return Actions & Condition Control */}
        <div className="lg:col-span-5">
          {focusedResource && (
            <div className="sticky top-20 rounded-xl bg-canvas-elevated border border-canvas-border p-5 space-y-5">
              <div className="flex items-start justify-between border-b border-canvas-border pb-3.5">
                <div>
                  <span className="font-mono text-xs text-accent-cyanBright">
                    {focusedResource.sku}
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
                  className="px-3 py-1.5 rounded-lg bg-accent-cyan text-slate-950 font-bold text-xs flex items-center gap-1.5 hover:bg-accent-cyanBright transition-colors shrink-0"
                >
                  <CalendarPlus className="w-3.5 h-3.5" />
                  Request & Allocate
                </button>
              </div>

              {/* Operational Pool & Condition Controls */}
              <div className="p-3.5 rounded-lg bg-canvas-surface border border-canvas-border space-y-3">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-slate-200 flex items-center gap-1.5">
                    <Wrench className="w-3.5 h-3.5 text-amber-400" />
                    Custodian Pool & Condition Control
                  </span>
                  <span className="font-mono text-slate-300">
                    {focusedResource.operationalQuantity}/
                    {focusedResource.totalQuantity} units active
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
                    className="px-2.5 py-1 rounded bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/30 text-emerald-300 text-xs font-medium"
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
                    className="px-2.5 py-1 rounded bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/30 text-amber-300 text-xs font-medium"
                  >
                    Flag 1 Unit Maintenance
                  </button>
                </div>
              </div>

              {/* Reservations & Return / Damage Ledger */}
              <div className="space-y-2.5">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                  <PackageCheck className="w-3.5 h-3.5 text-accent-cyanBright" />
                  Reservations, Checkouts & Return History
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
                        className="p-3 rounded-lg bg-canvas-surface border border-canvas-border space-y-2 text-xs"
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-semibold text-slate-100">
                            {ev?.title ?? alloc.eventId}
                          </span>
                          <span className="font-mono font-bold text-accent-cyanBright">
                            ×{alloc.quantity} units
                          </span>
                        </div>

                        <div className="flex items-center justify-between text-[11px] font-mono text-slate-400">
                          <span>
                            {alloc.startIso.slice(0, 10)} •{" "}
                            {formatTimeRange(alloc.startIso, alloc.endIso)}
                          </span>
                          <span
                            className={`px-1.5 py-0.5 rounded ${
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

                        {alloc.conditionReport && (
                          <div className="text-[11px] text-slate-300 italic">
                            Note: &ldquo;{alloc.conditionReport}&rdquo;
                          </div>
                        )}

                        {isActive && (
                          <div className="pt-2 border-t border-canvas-border/60 flex flex-wrap items-center gap-1.5">
                            <button
                              onClick={() =>
                                updateAllocationStatus(
                                  alloc.id,
                                  "RETURNED",
                                  `All ${alloc.quantity} units returned in optimal working order`
                                )
                              }
                              className="px-2 py-1 rounded bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/30 text-emerald-300 text-[11px] font-medium flex items-center gap-1"
                            >
                              <CheckCircle2 className="w-3 h-3" />
                              Record Returned Optimal
                            </button>
                            <button
                              onClick={() =>
                                updateAllocationStatus(
                                  alloc.id,
                                  "DAMAGED_ON_RETURN",
                                  "1 unit returned with damaged connector; deducted from operational pool",
                                  1
                                )
                              }
                              className="px-2 py-1 rounded bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/30 text-amber-300 text-[11px] font-medium flex items-center gap-1"
                            >
                              <AlertTriangle className="w-3 h-3" />
                              Report 1 Damaged
                            </button>
                            <button
                              onClick={() =>
                                updateAllocationStatus(
                                  alloc.id,
                                  "MISSING_ON_RETURN",
                                  "1 unit missing at check-in; flagged for custodian audit",
                                  1
                                )
                              }
                              className="px-2 py-1 rounded bg-red-500/15 hover:bg-red-500/25 border border-red-500/30 text-red-300 text-[11px] font-medium"
                            >
                              Report 1 Missing
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
