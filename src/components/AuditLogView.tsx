"use client";

import React, { useMemo, useState } from "react";
import { useAutopilot } from "@/context/AutopilotContext";
import { Search, ShieldCheck, RotateCcw } from "lucide-react";

export function AuditLogView() {
  const { state, resetDemoScenario, factoryResetAll } = useAutopilot();
  const [searchQuery, setSearchQuery] = useState("");
  const [entityFilter, setEntityFilter] = useState<string>("ALL");

  const filteredEntries = useMemo(() => {
    return state.auditLog.filter((entry) => {
      if (entityFilter !== "ALL" && entry.entityType !== entityFilter) {
        return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        return (
          entry.entityName.toLowerCase().includes(q) ||
          entry.reason.toLowerCase().includes(q) ||
          entry.action.toLowerCase().includes(q) ||
          entry.actor.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [state.auditLog, entityFilter, searchQuery]);

  return (
    <div className="space-y-5">
      {/* Header Banner */}
      <div className="p-5 rounded-2xl ops-card border border-canvas-border flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <span className="px-2.5 py-0.5 rounded-full bg-accent-cyan/15 text-accent-cyanBright border border-accent-cyan/30 font-mono text-[10px] font-bold">
            IMMUTABLE LEDGER • STATE v{state.stateVersion}
          </span>
          <h1 className="text-xl font-bold text-slate-100 mt-1.5">
            Operational Audit Stream ({state.auditLog.length})
          </h1>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={resetDemoScenario}
            className="px-3 py-2 rounded-xl bg-canvas-surface hover:bg-canvas-hover border border-canvas-border text-xs font-medium text-slate-200 flex items-center gap-1.5"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Reset Demo
          </button>
          <button
            onClick={factoryResetAll}
            className="px-3 py-2 rounded-xl bg-red-500/15 hover:bg-red-500/25 border border-red-500/30 text-xs font-medium text-red-300"
          >
            Factory Reset
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="relative flex-1 min-w-[240px] max-w-md">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Filter by entity, action, or reason..."
            className="w-full pl-9 pr-3 py-2 rounded-xl ops-card border border-canvas-border text-xs text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-accent-cyan"
          />
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          {(["ALL", "BOOKING", "RESOURCE", "SHOCKWAVE", "SYSTEM"] as const).map(
            (type) => (
              <button
                key={type}
                onClick={() => setEntityFilter(type)}
                className={`px-3 py-1.5 rounded-xl text-xs font-medium border transition-colors ${
                  entityFilter === type
                    ? "bg-accent-cyan text-slate-950 border-accent-cyan font-bold"
                    : "ops-card border-canvas-border text-slate-300 hover:text-slate-100"
                }`}
              >
                {type}
              </button>
            )
          )}
        </div>
      </div>

      {/* Audit Table */}
      <div className="rounded-2xl ops-card border border-canvas-border overflow-x-auto">
        <table className="w-full text-left border-collapse min-w-[760px]">
          <thead>
            <tr className="border-b border-canvas-border bg-canvas-surface/80 text-[10px] font-mono uppercase text-slate-400">
              <th className="p-3.5">Time</th>
              <th className="p-3.5">Action</th>
              <th className="p-3.5">Entity</th>
              <th className="p-3.5">Status</th>
              <th className="p-3.5">Summary</th>
              <th className="p-3.5">Actor</th>
            </tr>
          </thead>
          <tbody>
            {filteredEntries.map((entry) => (
              <tr
                key={entry.id}
                className="border-b border-canvas-border last:border-b-0 hover:bg-canvas-surface/40 text-xs transition-colors"
              >
                <td className="p-3.5 font-mono text-slate-400 whitespace-nowrap">
                  <span className="text-slate-200 font-semibold">
                    {entry.timestampIso.slice(11, 19)}
                  </span>
                </td>
                <td className="p-3.5 font-mono font-bold text-accent-cyanBright whitespace-nowrap">
                  {entry.action.replace(/_/g, " ")}
                </td>
                <td className="p-3.5 font-semibold text-slate-100">
                  <div>{entry.entityName}</div>
                  <div className="text-[10px] font-mono text-slate-500">
                    {entry.entityType}
                  </div>
                </td>
                <td className="p-3.5 whitespace-nowrap">
                  <span
                    className={`font-mono text-[10px] px-2 py-0.5 rounded-full border font-semibold ${
                      entry.result === "SUCCESS"
                        ? "bg-emerald-500/15 text-emerald-300 border-emerald-500/30"
                        : entry.result === "SIMULATED"
                        ? "bg-amber-500/15 text-amber-300 border-amber-500/30"
                        : "bg-red-500/15 text-red-300 border-red-500/30"
                    }`}
                  >
                    {entry.result}
                  </span>
                </td>
                <td className="p-3.5 text-slate-300 max-w-md truncate">
                  {entry.reason}
                </td>
                <td className="p-3.5 whitespace-nowrap">
                  <span className="inline-flex items-center gap-1 text-[11px] font-mono text-slate-300">
                    <ShieldCheck className="w-3.5 h-3.5 text-accent-cyanBright" />
                    {entry.actor}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
