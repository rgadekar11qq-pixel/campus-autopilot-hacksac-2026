"use client";

import React, { useMemo, useState } from "react";
import { useAutopilot } from "@/context/AutopilotContext";
import { Search, ShieldCheck, Activity, RotateCcw } from "lucide-react";

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
      <div className="p-4 rounded-xl bg-canvas-elevated border border-canvas-border flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2 py-0.5 rounded bg-accent-cyan/15 text-accent-cyanBright border border-accent-cyan/30 font-mono text-[11px]">
              IMMUTABLE SESSION AUDIT STREAM • SIMULATED CAMPUS ENVIRONMENT
            </span>
          </div>
          <h1 className="text-lg font-bold text-slate-100 mt-1">
            Activity & Operational Audit Log ({state.auditLog.length} Records)
          </h1>
          <p className="text-xs text-slate-400">
            Every booking confirmation, resource checkout/return, Shockwave
            simulation, and atomic plan approval is recorded with timestamp,
            actor, and constraint rationale.
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={resetDemoScenario}
            className="px-3 py-1.5 rounded-lg bg-canvas-surface hover:bg-canvas-hover border border-canvas-border text-xs text-slate-200 flex items-center gap-1.5"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Reset Demo Scenario
          </button>
          <button
            onClick={factoryResetAll}
            className="px-3 py-1.5 rounded-lg bg-red-500/15 hover:bg-red-500/25 border border-red-500/30 text-xs text-red-300"
          >
            Factory Reset All Data
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
            placeholder="Search audit entries by entity, action, or reason..."
            className="w-full pl-9 pr-3 py-2 rounded-lg bg-canvas-elevated border border-canvas-border text-xs text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-accent-cyan"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {(["ALL", "BOOKING", "RESOURCE", "SHOCKWAVE", "SYSTEM"] as const).map(
            (type) => (
              <button
                key={type}
                onClick={() => setEntityFilter(type)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                  entityFilter === type
                    ? "bg-accent-cyan text-slate-950 border-accent-cyan font-semibold"
                    : "bg-canvas-elevated border-canvas-border text-slate-300 hover:text-slate-100"
                }`}
              >
                {type}
              </button>
            )
          )}
        </div>
      </div>

      {/* Audit Table */}
      <div className="rounded-xl bg-canvas-elevated border border-canvas-border overflow-x-auto">
        <table className="w-full text-left border-collapse min-w-[780px]">
          <thead>
            <tr className="border-b border-canvas-border bg-canvas-surface/80 text-[11px] font-mono uppercase text-slate-400">
              <th className="p-3.5">Timestamp</th>
              <th className="p-3.5">Action</th>
              <th className="p-3.5">Affected Entity</th>
              <th className="p-3.5">Result</th>
              <th className="p-3.5">Operational Rationale</th>
              <th className="p-3.5">Actor / Mode</th>
            </tr>
          </thead>
          <tbody>
            {filteredEntries.map((entry) => (
              <tr
                key={entry.id}
                className="border-b border-canvas-border last:border-b-0 hover:bg-canvas-surface/40 text-xs transition-colors"
              >
                <td className="p-3.5 font-mono text-slate-400 whitespace-nowrap">
                  {entry.timestampIso.slice(0, 10)}{" "}
                  <span className="text-slate-200">
                    {entry.timestampIso.slice(11, 19)}
                  </span>
                </td>
                <td className="p-3.5 font-mono font-semibold text-accent-cyanBright whitespace-nowrap">
                  {entry.action.replace(/_/g, " ")}
                </td>
                <td className="p-3.5 font-medium text-slate-100">
                  <div>{entry.entityName}</div>
                  <div className="text-[10px] font-mono text-slate-500">
                    {entry.entityType} • {entry.entityId}
                  </div>
                </td>
                <td className="p-3.5 whitespace-nowrap">
                  <span
                    className={`font-mono text-[11px] px-2 py-0.5 rounded border ${
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
                <td className="p-3.5 text-slate-300 max-w-md leading-relaxed">
                  {entry.reason}
                </td>
                <td className="p-3.5 whitespace-nowrap">
                  <div className="text-slate-200 font-medium">{entry.actor}</div>
                  <span className="inline-flex items-center gap-1 text-[10px] font-mono text-slate-400">
                    <ShieldCheck className="w-3 h-3 text-accent-cyanBright" />
                    SIMULATED
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
