"use client";

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import {
  AllocationStatus,
  ApplicationState,
  ApprovalRecord,
  BookingDraftInput,
  CandidatePlan,
  Disruption,
  FeasibilityResult,
  ResourceCondition,
  ShockwaveSimulationResult,
} from "@/domain/types";
import { createInitialSeedState, DEMO_PRIMARY_DATE } from "@/domain/seedData";
import { createValidatedBooking } from "@/domain/engine";
import { approveCandidatePlan, simulateShockwave } from "@/domain/shockwave";
import {
  cancelBookingById,
  loadPersistedState,
  prepareUnbookedRoboticsDemo,
  resetDemoScenarioOnly,
  savePersistedState,
  updateAllocationReturnStatus,
  updateResourceConditionDirect,
} from "@/domain/operations";

export type NavSection =
  | "COMMAND_CENTER"
  | "TIMELINE"
  | "SMART_BOOKING"
  | "SHOCKWAVE"
  | "INVENTORY"
  | "IMPACT"
  | "AUDIT_LOG";

export interface ToastMessage {
  id: string;
  type: "SUCCESS" | "WARNING" | "ERROR" | "INFO";
  title: string;
  detail: string;
}

interface AutopilotContextValue {
  state: ApplicationState;
  isHydrated: boolean;
  activeSection: NavSection;
  setActiveSection: (section: NavSection) => void;
  selectedDate: string;
  setSelectedDate: (dateStr: string) => void;
  inspectedRoomId: string | null;
  setInspectedRoomId: (id: string | null) => void;
  inspectedEventId: string | null;
  setInspectedEventId: (id: string | null) => void;
  bookingPrefill: Partial<BookingDraftInput> | null;
  setBookingPrefill: (prefill: Partial<BookingDraftInput> | null) => void;
  shockwaveTargetEventId: string;
  setShockwaveTargetEventId: (eventId: string) => void;
  activeSimulation: ShockwaveSimulationResult | null;
  setActiveSimulation: (sim: ShockwaveSimulationResult | null) => void;
  latestApproval: ApprovalRecord | null;
  setLatestApproval: (appr: ApprovalRecord | null) => void;
  toasts: ToastMessage[];
  pushToast: (toast: Omit<ToastMessage, "id">) => void;
  dismissToast: (id: string) => void;
  // Domain Actions
  submitBooking: (
    draft: BookingDraftInput
  ) =>
    | { ok: true; bookingId: string; eventId: string }
    | { ok: false; feasibility: FeasibilityResult };
  cancelBooking: (bookingId: string, reason?: string) => void;
  updateAllocationStatus: (
    allocationId: string,
    status: AllocationStatus,
    note: string,
    damagedUnits?: number
  ) => void;
  updateResourceCondition: (
    resourceId: string,
    condition: ResourceCondition,
    operationalQty: number,
    reason: string
  ) => void;
  triggerShockwaveSimulation: (disruption: Disruption) => ShockwaveSimulationResult;
  commitCandidatePlan: (
    disruption: Disruption,
    candidate: CandidatePlan
  ) => { ok: true; approvalRecord: ApprovalRecord } | { ok: false; error: string };
  resetDemoScenario: () => void;
  startGuidedEndToEndDemo: () => void;
  launchInstantShockwaveDemo: () => void;
  factoryResetAll: () => void;
}

const AutopilotContext = createContext<AutopilotContextValue | null>(null);

export function AutopilotProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<ApplicationState>(() =>
    createInitialSeedState()
  );
  const [isHydrated, setIsHydrated] = useState(false);
  const [activeSection, setActiveSection] =
    useState<NavSection>("COMMAND_CENTER");
  const [selectedDate, setSelectedDate] = useState<string>(DEMO_PRIMARY_DATE);
  const [inspectedRoomId, setInspectedRoomId] = useState<string | null>(null);
  const [inspectedEventId, setInspectedEventId] = useState<string | null>(null);
  const [bookingPrefill, setBookingPrefill] =
    useState<Partial<BookingDraftInput> | null>(null);
  const [shockwaveTargetEventId, setShockwaveTargetEventId] = useState<string>(
    "evt-robotics-workshop"
  );
  const [activeSimulation, setActiveSimulation] =
    useState<ShockwaveSimulationResult | null>(null);
  const [latestApproval, setLatestApproval] = useState<ApprovalRecord | null>(
    null
  );
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  useEffect(() => {
    const loaded = loadPersistedState();
    setState(loaded);
    setIsHydrated(true);
  }, []);

  useEffect(() => {
    if (isHydrated) {
      savePersistedState(state);
    }
  }, [state, isHydrated]);

  const pushToast = useCallback((toast: Omit<ToastMessage, "id">) => {
    const id = `tst-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    setToasts((prev) => [{ ...toast, id }, ...prev.slice(0, 3)]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 5500);
  }, []);

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const submitBooking = useCallback(
    (draft: BookingDraftInput) => {
      const res = createValidatedBooking(state, draft);
      if (res.ok) {
        setState(res.nextState);
        pushToast({
          type: "SUCCESS",
          title: "Booking Confirmed & Resources Locked",
          detail: `"${draft.title}" scheduled in ${
            state.rooms.find((r) => r.id === draft.preferredRoomId)?.name ??
            draft.preferredRoomId
          } on ${draft.dateStr} at ${draft.startTimeStr}.`,
        });
        return {
          ok: true as const,
          bookingId: res.bookingId,
          eventId: res.eventId,
        };
      } else {
        pushToast({
          type: "ERROR",
          title: "Hard Constraint Validation Failed",
          detail:
            res.feasibility.violations[0]?.message ??
            "Selected configuration violates campus constraints.",
        });
        return { ok: false as const, feasibility: res.feasibility };
      }
    },
    [state, pushToast]
  );

  const cancelBooking = useCallback(
    (bookingId: string, reason = "Cancelled by organizer") => {
      const bkg = state.bookings.find((b) => b.id === bookingId);
      const ev = state.events.find((e) => e.id === bkg?.eventId);
      const next = cancelBookingById(state, bookingId, reason);
      setState(next);
      pushToast({
        type: "WARNING",
        title: "Booking Cancelled",
        detail: `Released room and equipment for "${ev?.title ?? bookingId}".`,
      });
    },
    [state, pushToast]
  );

  const updateAllocationStatus = useCallback(
    (
      allocationId: string,
      status: AllocationStatus,
      note: string,
      damagedUnits = 0
    ) => {
      const next = updateAllocationReturnStatus(
        state,
        allocationId,
        status,
        note,
        damagedUnits
      );
      setState(next);
      pushToast({
        type: status === "RETURNED" ? "SUCCESS" : "WARNING",
        title: `Inventory Return: ${status.replace(/_/g, " ")}`,
        detail: note,
      });
    },
    [state, pushToast]
  );

  const updateResourceCondition = useCallback(
    (
      resourceId: string,
      condition: ResourceCondition,
      operationalQty: number,
      reason: string
    ) => {
      const next = updateResourceConditionDirect(
        state,
        resourceId,
        condition,
        operationalQty,
        reason
      );
      setState(next);
      pushToast({
        type:
          condition === "OPTIMAL" || condition === "GOOD"
            ? "SUCCESS"
            : "WARNING",
        title: "Resource Condition Updated",
        detail: `${reason} (${operationalQty} operational units).`,
      });
    },
    [state, pushToast]
  );

  const triggerShockwaveSimulation = useCallback(
    (disruption: Disruption) => {
      const simResult = simulateShockwave(state, disruption);
      setActiveSimulation(simResult);
      setLatestApproval(null);
      return simResult;
    },
    [state]
  );

  const commitCandidatePlan = useCallback(
    (disruption: Disruption, candidate: CandidatePlan) => {
      const res = approveCandidatePlan(state, disruption, candidate);
      if (res.ok) {
        setState(res.nextState);
        setLatestApproval(res.approvalRecord);
        setActiveSimulation(null);
        pushToast({
          type: "SUCCESS",
          title: "Shockwave Recovery Plan Approved",
          detail: `Reallocated "${
            state.events.find((e) => e.id === candidate.targetEventId)?.title ??
            "Event"
          }" to ${res.approvalRecord.afterSnapshot.roomName} (${candidate.score.totalScore}/100).`,
        });
        return { ok: true as const, approvalRecord: res.approvalRecord };
      } else {
        pushToast({
          type: "ERROR",
          title: "Candidate Approval Rejected",
          detail: res.error,
        });
        return { ok: false as const, error: res.error };
      }
    },
    [state, pushToast]
  );

  const resetDemoScenario = useCallback(() => {
    const next = resetDemoScenarioOnly(state);
    setState(next);
    setActiveSimulation(null);
    setLatestApproval(null);
    setSelectedDate(DEMO_PRIMARY_DATE);
    setShockwaveTargetEventId("evt-robotics-workshop");
    pushToast({
      type: "INFO",
      title: "Demo Scenario Restored to Baseline",
      detail:
        "Autonomous Robotics Systems Workshop restored to INV-101 Turing Innovation Hall (11:00–12:30). Unrelated bookings preserved.",
    });
  }, [state, pushToast]);

  const startGuidedEndToEndDemo = useCallback(() => {
    const next = prepareUnbookedRoboticsDemo(state);
    setState(next);
    setActiveSimulation(null);
    setLatestApproval(null);
    setSelectedDate(DEMO_PRIMARY_DATE);
    setBookingPrefill({
      title: "Autonomous Robotics Systems Workshop",
      description:
        "Hands-on HackSAC flagship session on ROS2 navigation stacks, LiDAR SLAM mapping, and multi-agent path planning.",
      organizer: "Team STRATOS & METSAC Robotics Society",
      category: "WORKSHOP",
      priority: "CRITICAL",
      dateStr: DEMO_PRIMARY_DATE,
      startTimeStr: "11:00",
      durationMinutes: 90,
      expectedAttendance: 80,
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
    });
    setActiveSection("SMART_BOOKING");
    pushToast({
      type: "INFO",
      title: "Step 1: Smart Booking Ready",
      detail:
        "Loaded the Flagship Robotics Workshop (80 attendees, 8 ROS2 kits, 1 projector, 2 mentors). Verify constraints and confirm booking!",
    });
  }, [state, pushToast]);

  const launchInstantShockwaveDemo = useCallback(() => {
    const baselineReady = resetDemoScenarioOnly(state);
    setState(baselineReady);
    setSelectedDate(DEMO_PRIMARY_DATE);
    setShockwaveTargetEventId("evt-robotics-workshop");

    const demoDisruption: Disruption = {
      id: `disr-demo-${Date.now()}`,
      type: "ROOM_UNAVAILABLE",
      title: "Assigned Room Becomes Unavailable (INV-101 Breaker Trip)",
      description:
        "Turing Innovation Hall (INV-101) 3-phase power sub-panel tripped; room locked for safety inspection 10:30–14:00.",
      targetEventId: "evt-robotics-workshop",
      targetRoomId: "rm-turing-hall",
      unavailableStartIso: `${DEMO_PRIMARY_DATE}T10:30:00`,
      unavailableEndIso: `${DEMO_PRIMARY_DATE}T14:00:00`,
      createdAtIso: new Date().toISOString(),
    };

    const sim = simulateShockwave(baselineReady, demoDisruption);
    setActiveSimulation(sim);
    setLatestApproval(null);
    setActiveSection("SHOCKWAVE");
    pushToast({
      type: "INFO",
      title: `Shockwave Ready: ${sim.validCandidates.length} Recovery Plans Found`,
      detail:
        "Click 'Approve & Apply' on Rank #1 to relocate Autonomous Robotics Workshop.",
    });
  }, [state, pushToast]);

  const factoryResetAll = useCallback(() => {
    const fresh = createInitialSeedState();
    setState(fresh);
    setActiveSimulation(null);
    setLatestApproval(null);
    setSelectedDate(DEMO_PRIMARY_DATE);
    pushToast({
      type: "INFO",
      title: "Full Campus State Reset",
      detail: "Restored factory seed dataset for HackSAC 2026.",
    });
  }, [pushToast]);

  return (
    <AutopilotContext.Provider
      value={{
        state,
        isHydrated,
        activeSection,
        setActiveSection,
        selectedDate,
        setSelectedDate,
        inspectedRoomId,
        setInspectedRoomId,
        inspectedEventId,
        setInspectedEventId,
        bookingPrefill,
        setBookingPrefill,
        shockwaveTargetEventId,
        setShockwaveTargetEventId,
        activeSimulation,
        setActiveSimulation,
        latestApproval,
        setLatestApproval,
        toasts,
        pushToast,
        dismissToast,
        submitBooking,
        cancelBooking,
        updateAllocationStatus,
        updateResourceCondition,
        triggerShockwaveSimulation,
        commitCandidatePlan,
        resetDemoScenario,
        startGuidedEndToEndDemo,
        launchInstantShockwaveDemo,
        factoryResetAll,
      }}
    >
      {children}
    </AutopilotContext.Provider>
  );
}

export function useAutopilot() {
  const ctx = useContext(AutopilotContext);
  if (!ctx) {
    throw new Error("useAutopilot must be used inside AutopilotProvider");
  }
  return ctx;
}
