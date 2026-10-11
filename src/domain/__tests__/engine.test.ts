import { describe, it, expect } from "vitest";
import { createInitialSeedState, DEMO_PRIMARY_DATE } from "../seedData";
import {
  createValidatedBooking,
  evaluateRequestFeasibility,
} from "../engine";
import {
  approveCandidatePlan,
  simulateShockwave,
} from "../shockwave";
import {
  loadPersistedState,
  resetDemoScenarioOnly,
  savePersistedState,
} from "../operations";
import { BookingDraftInput, Disruption } from "../types";

function makeValidDraft(overrides: Partial<BookingDraftInput> = {}): BookingDraftInput {
  return {
    title: "Autonomous Rover Calibration Session",
    description: "Testing LiDAR SLAM loop closure",
    organizer: "STRATOS Team",
    category: "WORKSHOP",
    priority: "HIGH",
    dateStr: DEMO_PRIMARY_DATE,
    startTimeStr: "15:00",
    durationMinutes: 60,
    expectedAttendance: 50,
    preferredRoomId: "rm-turing-hall",
    requiredFacilities: ["PROJECTOR_4K", "WORKBENCHES"],
    requiredResources: [{ resourceId: "res-ros-kit", quantity: 4 }],
    requiredPeopleIds: ["per-kavya"],
    setupMinutes: 15,
    cleanupMinutes: 15,
    requiresExtendedTurnaround: false,
    ...overrides,
  };
}

describe("Campus Autopilot & Shockwave Engine — 17 Core Verification Tests", () => {
  it("1. A valid event can be booked", () => {
    const state = createInitialSeedState();
    const draft = makeValidDraft();
    const res = createValidatedBooking(state, draft);
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.nextState.bookings.some((b) => b.id === res.bookingId)).toBe(true);
      expect(res.nextState.events.some((e) => e.id === res.eventId)).toBe(true);
    }
  });

  it("2. A room with insufficient capacity is rejected", () => {
    const state = createInitialSeedState();
    // rm-lovelace-lab has capacity 60, requesting 80
    const draft = makeValidDraft({
      preferredRoomId: "rm-lovelace-lab",
      expectedAttendance: 80,
      startTimeStr: "14:00",
    });
    const res = createValidatedBooking(state, draft);
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(
        res.feasibility.violations.some((v) => v.code === "CAPACITY_INSUFFICIENT")
      ).toBe(true);
    }
  });

  it("3. An unavailable room is rejected", () => {
    const state = createInitialSeedState();
    // rm-shannon-studio has maintenance window 08:00 - 10:30 on 2026-10-15
    const draft = makeValidDraft({
      preferredRoomId: "rm-shannon-studio",
      expectedAttendance: 30,
      startTimeStr: "09:00",
      requiredFacilities: ["PROJECTOR_4K"],
      requiredResources: [],
      requiredPeopleIds: [],
    });
    const res = createValidatedBooking(state, draft);
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(
        res.feasibility.violations.some((v) => v.code === "ROOM_UNAVAILABLE_WINDOW")
      ).toBe(true);
    }
  });

  it("4. Two events cannot book the same exclusive room at overlapping times", () => {
    const state = createInitialSeedState();
    // rm-turing-hall is booked 11:00 - 12:30 for Autonomous Robotics Systems Workshop
    const draft = makeValidDraft({
      preferredRoomId: "rm-turing-hall",
      startTimeStr: "11:30",
      durationMinutes: 60,
      requiredResources: [],
      requiredPeopleIds: [],
    });
    const res = createValidatedBooking(state, draft);
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(
        res.feasibility.violations.some((v) => v.code === "ROOM_OVERLAP_CONFLICT")
      ).toBe(true);
    }
  });

  it("5. The 15-minute default turnaround is enforced", () => {
    const state = createInitialSeedState();
    // bkg-robotics-workshop in rm-turing-hall ends at 12:30, cleanup ends 12:45, 15m turnaround ends 13:00.
    // If a new event has setupMinutes=15 and starts at 13:05, its setupStart is 12:50, which violates turnaroundEnd 13:00!
    const draft = makeValidDraft({
      preferredRoomId: "rm-turing-hall",
      startTimeStr: "13:05",
      setupMinutes: 15,
      requiredResources: [],
      requiredPeopleIds: [],
    });
    const res = createValidatedBooking(state, draft);
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(
        res.feasibility.violations.some(
          (v) => v.code === "TURNAROUND_BUFFER_VIOLATION"
        )
      ).toBe(true);
    }
  });

  it("6. The 30-minute policy is enforced where configured", () => {
    const state = createInitialSeedState();
    // rm-tesla-arena has customTurnaroundMinutes: 30.
    // bkg-drone-calib is 13:30-15:00, cleanup ends 15:15, 30m turnaround ends 15:45.
    // Attempting an event starting at 15:40 (with 0 setup) overlaps the 15:45 turnaround boundary!
    const check = evaluateRequestFeasibility(state, {
      roomId: "rm-tesla-arena",
      startIso: `${DEMO_PRIMARY_DATE}T15:40:00`,
      endIso: `${DEMO_PRIMARY_DATE}T16:30:00`,
      setupMinutes: 0,
      cleanupMinutes: 10,
      expectedAttendance: 40,
      requiredFacilities: ["WORKBENCHES"],
      requiredResources: [],
      requiredPeopleIds: [],
    });
    expect(check.isFeasible).toBe(false);
    expect(
      check.violations.some((v) => v.code === "TURNAROUND_BUFFER_VIOLATION")
    ).toBe(true);
  });

  it("7. Setup and cleanup intervals are respected", () => {
    const state = createInitialSeedState();
    // bkg-robotics-workshop in rm-turing-hall ends at 12:30, cleanup is 12:30-12:45.
    // A new booking starting at 12:45 with 10m setup has setupStart at 12:35, overlapping cleanup!
    const check = evaluateRequestFeasibility(state, {
      roomId: "rm-turing-hall",
      startIso: `${DEMO_PRIMARY_DATE}T12:45:00`,
      endIso: `${DEMO_PRIMARY_DATE}T13:45:00`,
      setupMinutes: 10,
      cleanupMinutes: 10,
      expectedAttendance: 40,
      requiredFacilities: [],
      requiredResources: [],
      requiredPeopleIds: [],
    });
    expect(check.isFeasible).toBe(false);
    expect(
      check.violations.some((v) => v.code === "SETUP_CLEANUP_CONFLICT")
    ).toBe(true);
  });

  it("8. Equipment cannot be double-allocated across overlapping intervals", () => {
    const state = createInitialSeedState();
    // res-ros-kit has 11 operational units; 8 are allocated to bkg-robotics-workshop (10:45-12:45).
    // Requesting another 5 units during 11:00-12:00 requires 8 + 5 = 13 > 11 operational units.
    const check = evaluateRequestFeasibility(state, {
      roomId: "rm-hopper-aud",
      startIso: `${DEMO_PRIMARY_DATE}T11:00:00`,
      endIso: `${DEMO_PRIMARY_DATE}T12:00:00`,
      setupMinutes: 10,
      cleanupMinutes: 10,
      expectedAttendance: 50,
      requiredFacilities: [],
      requiredResources: [{ resourceId: "res-ros-kit", quantity: 5 }],
      requiredPeopleIds: [],
    });
    expect(check.isFeasible).toBe(false);
    expect(
      check.violations.some((v) => v.code === "RESOURCE_INSUFFICIENT")
    ).toBe(true);
  });

  it("9. Equipment quantity cannot be exceeded even when no other event is running", () => {
    const state = createInitialSeedState();
    // res-laser-proj has 4 total/operational units. Requesting 6 at 18:00 must fail.
    const check = evaluateRequestFeasibility(state, {
      roomId: "rm-hopper-aud",
      startIso: `${DEMO_PRIMARY_DATE}T18:00:00`,
      endIso: `${DEMO_PRIMARY_DATE}T19:00:00`,
      setupMinutes: 10,
      cleanupMinutes: 10,
      expectedAttendance: 50,
      requiredFacilities: [],
      requiredResources: [{ resourceId: "res-laser-proj", quantity: 6 }],
      requiredPeopleIds: [],
    });
    expect(check.isFeasible).toBe(false);
    expect(
      check.violations.some((v) => v.code === "RESOURCE_INSUFFICIENT")
    ).toBe(true);
  });

  it("10. A mentor cannot be double-booked", () => {
    const state = createInitialSeedState();
    // per-arjun is assigned to bkg-robotics-workshop (10:45 - 12:45)
    const check = evaluateRequestFeasibility(state, {
      roomId: "rm-hopper-aud",
      startIso: `${DEMO_PRIMARY_DATE}T11:15:00`,
      endIso: `${DEMO_PRIMARY_DATE}T12:15:00`,
      setupMinutes: 10,
      cleanupMinutes: 10,
      expectedAttendance: 50,
      requiredFacilities: [],
      requiredResources: [],
      requiredPeopleIds: ["per-arjun"],
    });
    expect(check.isFeasible).toBe(false);
    expect(check.violations.some((v) => v.code === "PERSON_OVERLAP")).toBe(true);
  });

  it("11. A disruption produces feasible candidates when alternatives exist", () => {
    const state = createInitialSeedState();
    const disruption: Disruption = {
      id: "disr-test-room",
      type: "ROOM_UNAVAILABLE",
      title: "Turing Innovation Hall Breaker Trip",
      description: "INV-101 unavailable 10:30–14:00 due to sub-panel trip",
      targetEventId: "evt-robotics-workshop",
      targetRoomId: "rm-turing-hall",
      unavailableStartIso: `${DEMO_PRIMARY_DATE}T10:30:00`,
      unavailableEndIso: `${DEMO_PRIMARY_DATE}T14:00:00`,
      createdAtIso: new Date().toISOString(),
    };

    const sim = simulateShockwave(state, disruption);
    expect(sim.originalViolations.length).toBeGreaterThan(0);
    expect(sim.validCandidates.length).toBeGreaterThanOrEqual(2);
    // Both Grace Hopper Auditorium (rm-hopper-aud) and Nikola Tesla Mechatronics Arena (rm-tesla-arena) should be found at same time
    const candidateRoomIds = sim.validCandidates.map((c) => c.proposedRoomId);
    expect(candidateRoomIds).toContain("rm-hopper-aud");
    expect(candidateRoomIds).toContain("rm-tesla-arena");
  });

  it("12. An impossible disruption returns a clear infeasibility result", () => {
    const state = createInitialSeedState();
    // Surge attendance to 500 (exceeds every room on campus, max is 120)
    const disruption: Disruption = {
      id: "disr-impossible",
      type: "ATTENDANCE_SURGE",
      title: "Massive Attendance Surge to 500",
      description: "Attendance surged to 500, exceeding all campus halls",
      targetEventId: "evt-robotics-workshop",
      newAttendance: 500,
      createdAtIso: new Date().toISOString(),
    };

    const sim = simulateShockwave(state, disruption);
    expect(sim.validCandidates.length).toBe(0);
    expect(sim.originalViolations.some((v) => v.code === "CAPACITY_INSUFFICIENT")).toBe(true);
    expect(sim.summaryExplanation).toContain("No feasible recovery plan exists");
  });

  it("13. Candidate plans are ranked deterministically", () => {
    const state = createInitialSeedState();
    const disruption: Disruption = {
      id: "disr-rank",
      type: "ROOM_UNAVAILABLE",
      title: "Turing Hall Outage",
      description: "INV-101 unavailable",
      targetEventId: "evt-robotics-workshop",
      targetRoomId: "rm-turing-hall",
      createdAtIso: "2026-10-15T10:00:00Z",
    };

    const run1 = simulateShockwave(state, disruption);
    const run2 = simulateShockwave(state, disruption);
    expect(run1.validCandidates.map((c) => c.id)).toEqual(
      run2.validCandidates.map((c) => c.id)
    );
    expect(run1.validCandidates[0].score.totalScore).toBeGreaterThanOrEqual(
      run1.validCandidates[1].score.totalScore
    );
  });

  it("14. Approving a candidate updates all relevant allocations consistently", () => {
    const state = createInitialSeedState();
    const disruption: Disruption = {
      id: "disr-approve",
      type: "ROOM_UNAVAILABLE",
      title: "Turing Hall Outage",
      description: "INV-101 unavailable",
      targetEventId: "evt-robotics-workshop",
      targetRoomId: "rm-turing-hall",
      createdAtIso: "2026-10-15T10:00:00Z",
    };

    const sim = simulateShockwave(state, disruption);
    const bestCandidate = sim.validCandidates[0];
    const approval = approveCandidatePlan(state, disruption, bestCandidate);
    expect(approval.ok).toBe(true);
    if (approval.ok) {
      const updatedBooking = approval.nextState.bookings.find(
        (b) => b.id === "bkg-robotics-workshop"
      )!;
      expect(updatedBooking.roomId).toBe(bestCandidate.proposedRoomId);
      expect(approval.nextState.approvals.length).toBe(1);
      expect(approval.nextState.auditLog[0].action).toBe("PLAN_APPROVED");
    }
  });

  it("15. A stale candidate cannot overwrite newer bookings", () => {
    const state = createInitialSeedState();
    const disruption: Disruption = {
      id: "disr-stale",
      type: "ROOM_UNAVAILABLE",
      title: "Turing Hall Outage",
      description: "INV-101 unavailable",
      targetEventId: "evt-robotics-workshop",
      targetRoomId: "rm-turing-hall",
      createdAtIso: "2026-10-15T10:00:00Z",
    };

    const sim = simulateShockwave(state, disruption);
    const candidate = sim.validCandidates[0];

    // Advance stateVersion by booking another valid event before approving candidate
    const newerState = {
      ...state,
      stateVersion: state.stateVersion + 1,
    };

    const res = approveCandidatePlan(newerState, disruption, candidate);
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.error).toContain("Stale candidate plan rejected");
    }
  });

  it("16. Resetting the demo restores the intended baseline without corrupting unrelated bookings", () => {
    const state = createInitialSeedState();
    // Create an unrelated custom booking first
    const customBookingRes = createValidatedBooking(
      state,
      makeValidDraft({
        title: "Custom Evening Seminar",
        startTimeStr: "17:00",
        preferredRoomId: "rm-babbage-sem",
        requiredFacilities: ["PROJECTOR_4K"],
        requiredResources: [],
        requiredPeopleIds: [],
      })
    );
    expect(customBookingRes.ok).toBe(true);
    if (!customBookingRes.ok) return;

    // Now disrupt and approve a change to the Robotics Workshop
    const disruption: Disruption = {
      id: "disr-reset-test",
      type: "ROOM_UNAVAILABLE",
      title: "Turing Hall Outage",
      description: "INV-101 unavailable",
      targetEventId: "evt-robotics-workshop",
      targetRoomId: "rm-turing-hall",
      createdAtIso: "2026-10-15T10:00:00Z",
    };
    const sim = simulateShockwave(customBookingRes.nextState, disruption);
    const approved = approveCandidatePlan(
      customBookingRes.nextState,
      disruption,
      sim.validCandidates[0]
    );
    expect(approved.ok).toBe(true);
    if (!approved.ok) return;

    // Now reset the demo scenario
    const restored = resetDemoScenarioOnly(approved.nextState);
    const workshopBkg = restored.bookings.find(
      (b) => b.id === "bkg-robotics-workshop"
    )!;
    expect(workshopBkg.roomId).toBe("rm-turing-hall");
    // Unrelated custom booking is preserved!
    expect(
      restored.bookings.some((b) => b.id === customBookingRes.bookingId)
    ).toBe(true);
  });

  it("17. Data persists correctly across refreshes using the persistence mechanism", () => {
    const memoryMap = new Map<string, string>();
    const mockStorage = {
      getItem: (key: string) => memoryMap.get(key) ?? null,
      setItem: (key: string, val: string) => {
        memoryMap.set(key, val);
      },
    };

    const initial = createInitialSeedState();
    const booked = createValidatedBooking(initial, makeValidDraft());
    expect(booked.ok).toBe(true);
    if (!booked.ok) return;

    const saved = savePersistedState(booked.nextState, mockStorage);
    expect(saved).toBe(true);

    const reloaded = loadPersistedState(mockStorage);
    expect(reloaded.stateVersion).toBe(booked.nextState.stateVersion);
    expect(
      reloaded.bookings.some((b) => b.id === booked.bookingId)
    ).toBe(true);
  });
});
