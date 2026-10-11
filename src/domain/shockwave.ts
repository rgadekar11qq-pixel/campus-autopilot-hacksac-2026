import {
  ApplicationState,
  ApprovalRecord,
  AvailabilityWindow,
  CandidatePlan,
  ConstraintViolation,
  Disruption,
  EventEntity,
  PlanDeltaChange,
  RejectedCandidateExplanation,
  ScoreBreakdown,
  SecondaryBookingRelocation,
  ShockwaveSimulationResult,
} from "./types";
import {
  addMinutesToIso,
  computeBookingIntervals,
  evaluateRequestFeasibility,
  intervalsOverlap,
} from "./engine";
import { formatTimeRange } from "@/lib/utils";

export interface EventDependencyGraph {
  event: EventEntity;
  bookingId: string;
  roomId: string;
  roomName: string;
  buildingName: string;
  timeRangeLabel: string;
  allocatedResources: Array<{
    resourceId: string;
    name: string;
    quantity: number;
    operationalPool: number;
    replacementValueInr: number;
  }>;
  assignedPeople: Array<{
    personId: string;
    name: string;
    roleTitle: string;
  }>;
  connectedEvents: Array<{
    eventId: string;
    title: string;
    connectionType: "SAME_ROOM" | "SHARED_RESOURCE" | "SHARED_MENTOR";
    detail: string;
  }>;
}

export function inspectEventDependencies(
  state: ApplicationState,
  eventId: string
): EventDependencyGraph | null {
  const event = state.events.find((e) => e.id === eventId);
  if (!event) return null;
  const booking = state.bookings.find(
    (b) => b.eventId === eventId && b.status !== "CANCELLED"
  );
  if (!booking) return null;

  const room = state.rooms.find((r) => r.id === booking.roomId);
  const building = state.buildings.find((b) => b.id === room?.buildingId);

  const allocatedResources = event.requiredResources.map((req) => {
    const res = state.resources.find((r) => r.id === req.resourceId);
    return {
      resourceId: req.resourceId,
      name: res?.name ?? req.resourceId,
      quantity: req.quantity,
      operationalPool: res?.operationalQuantity ?? 0,
      replacementValueInr: (res?.replacementCostInr ?? 0) * req.quantity,
    };
  });

  const assignedPeople = event.requiredPeopleIds.map((pid) => {
    const p = state.people.find((per) => per.id === pid);
    return {
      personId: pid,
      name: p?.name ?? pid,
      roleTitle: p?.roleTitle ?? "Mentor",
    };
  });

  const connectedEvents: EventDependencyGraph["connectedEvents"] = [];
  const sameDayPrefix = booking.startIso.slice(0, 10);

  for (const otherBkg of state.bookings) {
    if (
      otherBkg.id === booking.id ||
      otherBkg.status === "CANCELLED" ||
      !otherBkg.startIso.startsWith(sameDayPrefix)
    ) {
      continue;
    }
    const otherEv = state.events.find((e) => e.id === otherBkg.eventId);
    if (!otherEv) continue;

    if (otherBkg.roomId === booking.roomId) {
      connectedEvents.push({
        eventId: otherEv.id,
        title: otherEv.title,
        connectionType: "SAME_ROOM",
        detail: `Shares ${room?.name ?? booking.roomId} (${formatTimeRange(
          otherBkg.startIso,
          otherBkg.endIso
        )})`,
      });
    }

    for (const reqRes of event.requiredResources) {
      const otherUses = otherEv.requiredResources.find(
        (r) => r.resourceId === reqRes.resourceId
      );
      if (otherUses) {
        const resObj = state.resources.find((r) => r.id === reqRes.resourceId);
        connectedEvents.push({
          eventId: otherEv.id,
          title: otherEv.title,
          connectionType: "SHARED_RESOURCE",
          detail: `Draws ${otherUses.quantity}× ${resObj?.name ?? reqRes.resourceId}`,
        });
      }
    }

    for (const pid of event.requiredPeopleIds) {
      if (otherEv.requiredPeopleIds.includes(pid)) {
        const pObj = state.people.find((p) => p.id === pid);
        connectedEvents.push({
          eventId: otherEv.id,
          title: otherEv.title,
          connectionType: "SHARED_MENTOR",
          detail: `Shares mentor ${pObj?.name ?? pid} (${formatTimeRange(
            otherBkg.startIso,
            otherBkg.endIso
          )})`,
        });
      }
    }
  }

  return {
    event,
    bookingId: booking.id,
    roomId: booking.roomId,
    roomName: room?.name ?? booking.roomId,
    buildingName: building?.name ?? "Campus Block",
    timeRangeLabel: formatTimeRange(booking.startIso, booking.endIso),
    allocatedResources,
    assignedPeople,
    connectedEvents,
  };
}

/**
 * Applies a Disruption mutation onto a cloned simulation state.
 */
export function applyDisruptionToState(
  baseState: ApplicationState,
  disruption: Disruption
): ApplicationState {
  const sim: ApplicationState = structuredClone(baseState);

  const targetEventId =
    disruption.targetEventId ?? "evt-robotics-workshop";
  const targetEvent = sim.events.find((e) => e.id === targetEventId);
  const targetBooking = sim.bookings.find(
    (b) => b.eventId === targetEventId && b.status !== "CANCELLED"
  );

  if (disruption.type === "ROOM_UNAVAILABLE") {
    const roomId = disruption.targetRoomId ?? targetBooking?.roomId ?? "rm-turing-hall";
    const startIso =
      disruption.unavailableStartIso ??
      targetBooking?.setupStartIso ??
      `${sim.campusDate}T10:30:00`;
    const endIso =
      disruption.unavailableEndIso ??
      targetBooking?.turnaroundEndIso ??
      `${sim.campusDate}T14:00:00`;

    const newWin: AvailabilityWindow = {
      id: `win-disrupt-${disruption.id}`,
      entityType: "ROOM",
      entityId: roomId,
      startIso,
      endIso,
      status: "UNAVAILABLE",
      reason: disruption.description || "Emergency facility shutdown / breaker trip",
      createdByDisruptionId: disruption.id,
    };
    sim.availabilityWindows.push(newWin);
  } else if (disruption.type === "ATTENDANCE_SURGE") {
    if (targetEvent) {
      targetEvent.expectedAttendance =
        disruption.newAttendance ?? Math.max(targetEvent.expectedAttendance + 25, 105);
    }
  } else if (disruption.type === "EQUIPMENT_UNAVAILABLE") {
    const resId = disruption.targetResourceId ?? "res-ros-kit";
    const res = sim.resources.find((r) => r.id === resId);
    if (res) {
      if (typeof disruption.reducedResourceQty === "number") {
        res.operationalQuantity = Math.max(0, disruption.reducedResourceQty);
      } else {
        // Reduce operational pool so current booking exceeds available pool unless re-allocated or time-shifted
        res.operationalQuantity = Math.max(0, res.operationalQuantity - 5);
      }
    }
  } else if (disruption.type === "MENTOR_UNAVAILABLE") {
    const personId =
      disruption.targetPersonId ??
      targetEvent?.requiredPeopleIds[0] ??
      "per-arjun";
    const startIso =
      disruption.unavailableStartIso ??
      targetBooking?.setupStartIso ??
      `${sim.campusDate}T10:30:00`;
    const endIso =
      disruption.unavailableEndIso ??
      targetBooking?.cleanupEndIso ??
      `${sim.campusDate}T13:00:00`;

    sim.availabilityWindows.push({
      id: `win-person-${disruption.id}`,
      entityType: "PERSON",
      entityId: personId,
      startIso,
      endIso,
      status: "UNAVAILABLE",
      reason: disruption.description || "Mentor called into emergency academic senate review",
      createdByDisruptionId: disruption.id,
    });
  } else if (disruption.type === "TIME_SHIFT") {
    if (targetBooking && targetEvent) {
      const room = sim.rooms.find((r) => r.id === targetBooking.roomId);
      const newStart =
        disruption.shiftedStartIso ?? `${sim.campusDate}T13:30:00`;
      const durationMinutes = Math.round(
        (new Date(targetBooking.endIso).getTime() -
          new Date(targetBooking.startIso).getTime()) /
          60_000
      );
      const newEnd =
        disruption.shiftedEndIso ?? addMinutesToIso(newStart, durationMinutes);

      if (room) {
        const intervals = computeBookingIntervals(
          sim,
          room,
          newStart,
          newEnd,
          targetEvent.setupMinutes,
          targetEvent.cleanupMinutes,
          targetEvent.requiresExtendedTurnaround
        );
        targetBooking.startIso = intervals.startIso;
        targetBooking.endIso = intervals.endIso;
        targetBooking.setupStartIso = intervals.setupStartIso;
        targetBooking.cleanupEndIso = intervals.cleanupEndIso;
        targetBooking.turnaroundEndIso = intervals.turnaroundEndIso;

        for (const alloc of sim.resourceAllocations) {
          if (alloc.bookingId === targetBooking.id) {
            alloc.startIso = intervals.setupStartIso;
            alloc.endIso = intervals.cleanupEndIso;
          }
        }
        for (const pcm of sim.personCommitments) {
          if (pcm.bookingId === targetBooking.id) {
            pcm.startIso = intervals.setupStartIso;
            pcm.endIso = intervals.cleanupEndIso;
          }
        }
      }
    }
  } else if (disruption.type === "BOOKING_CANCELLED") {
    if (targetBooking) {
      targetBooking.status = "CANCELLED";
      for (const alloc of sim.resourceAllocations) {
        if (alloc.bookingId === targetBooking.id) {
          alloc.status = "CANCELLED";
        }
      }
      for (const pcm of sim.personCommitments) {
        if (pcm.bookingId === targetBooking.id) {
          pcm.status = "CANCELLED";
        }
      }
    }
  }

  return sim;
}

function scoreCandidate(
  state: ApplicationState,
  event: EventEntity,
  origRoomId: string,
  origStartIso: string,
  origEndIso: string,
  origPeopleIds: string[],
  candRoomId: string,
  candStartIso: string,
  candEndIso: string,
  candPeopleIds: string[],
  secondaryRelocations: SecondaryBookingRelocation[]
): ScoreBreakdown {
  const rankingReasons: string[] = [];
  const tradeoffs: string[] = [];

  const origRoom = state.rooms.find((r) => r.id === origRoomId);
  const candRoom = state.rooms.find((r) => r.id === candRoomId)!;
  const origBldg = state.buildings.find((b) => b.id === origRoom?.buildingId);
  const candBldg = state.buildings.find((b) => b.id === candRoom.buildingId);

  // 1. Time preservation (Max 30)
  const shiftMinutes = Math.abs(
    Math.round(
      (new Date(candStartIso).getTime() - new Date(origStartIso).getTime()) /
        60_000
    )
  );
  let timePreservationScore = 30;
  if (shiftMinutes === 0) {
    timePreservationScore = 30;
    rankingReasons.push(
      `Preserves exact original schedule (${formatTimeRange(
        origStartIso,
        origEndIso
      )}) with zero attendee schedule drift.`
    );
  } else if (shiftMinutes <= 90) {
    timePreservationScore = 20;
    tradeoffs.push(`Shifts event start time by ${shiftMinutes} minutes.`);
  } else if (shiftMinutes <= 180) {
    timePreservationScore = 14;
    tradeoffs.push(`Shifts event schedule by ${Math.round(shiftMinutes / 60 * 10) / 10} hours.`);
  } else {
    timePreservationScore = 8;
    tradeoffs.push(`Significant schedule shift (${Math.round(shiftMinutes / 60)}h).`);
  }

  // 2. Zero displacement & commitment stability (Max 25)
  const sameMentors =
    origPeopleIds.length === candPeopleIds.length &&
    origPeopleIds.every((id) => candPeopleIds.includes(id));

  let zeroDisplacementScore = 25;
  if (secondaryRelocations.length === 0 && sameMentors) {
    zeroDisplacementScore = 25;
    rankingReasons.push(
      "Zero displacement of unrelated confirmed bookings and preserves original mentor assignments."
    );
  } else if (secondaryRelocations.length === 0 && !sameMentors) {
    zeroDisplacementScore = 19;
    tradeoffs.push("Substitutes an available qualified mentor to resolve commitment conflict.");
  } else {
    zeroDisplacementScore = 12;
    tradeoffs.push(
      `Requires cascading relocation of ${secondaryRelocations.length} smaller booking (${secondaryRelocations[0].eventTitle}).`
    );
  }

  // 3. Capacity & Turnaround Fit (Max 15)
  const headroomRatio =
    (candRoom.capacity - event.expectedAttendance) /
    Math.max(1, event.expectedAttendance);
  let capacityFitScore = 15;
  if (headroomRatio >= 0.08 && headroomRatio <= 0.55) {
    capacityFitScore = 15;
    rankingReasons.push(
      `Optimal seating headroom in ${candRoom.name} (${candRoom.capacity} cap for ${event.expectedAttendance} attendees).`
    );
  } else if (headroomRatio < 0.08) {
    capacityFitScore = 11;
    tradeoffs.push(
      `Tight capacity margin in ${candRoom.name} (${candRoom.capacity} cap for ${event.expectedAttendance} attendees).`
    );
  } else {
    capacityFitScore = 12;
    tradeoffs.push(
      `Uses high-capacity hall (${candRoom.capacity} seats for ${event.expectedAttendance} attendees).`
    );
  }

  // Penalize 30m turnaround requirement slightly if 15m room is available
  if (candRoom.customTurnaroundMinutes === 30 && !event.requiresExtendedTurnaround) {
    capacityFitScore = Math.max(8, capacityFitScore - 2);
    tradeoffs.push(
      `${candRoom.name} enforces a stricter 30-minute heavy safety turnaround window.`
    );
  }

  // 4. Campus Proximity / Travel Burden (Max 15)
  let proximityScore = 15;
  if (candRoomId === origRoomId) {
    proximityScore = 15;
    rankingReasons.push(`Retains original venue (${candRoom.name}).`);
  } else if (origBldg && candBldg) {
    const walkMins = origBldg.walkingMinutesByZone[candBldg.zone] ?? 5;
    proximityScore = Math.max(6, Math.round(15 - walkMins * 1.2));
    if (walkMins <= 4) {
      rankingReasons.push(
        `Low transit overhead: ${walkMins}-min walk to ${candBldg.name}.`
      );
    } else {
      tradeoffs.push(
        `Equipment & attendees relocate to ${candBldg.name} (~${walkMins}-min walk).`
      );
    }
  }

  // 5. Resource Reuse (Max 15)
  const resourceReuseScore = 15;
  if (event.requiredResources.length > 0) {
    rankingReasons.push(
      "100% equipment fulfillment from existing campus inventory (zero external rental cost)."
    );
  }

  const totalScore = Math.min(
    100,
    timePreservationScore +
      zeroDisplacementScore +
      capacityFitScore +
      proximityScore +
      resourceReuseScore
  );

  if (tradeoffs.length === 0) {
    tradeoffs.push("Minimal operational friction; direct drop-in replacement.");
  }

  return {
    totalScore,
    timePreservationScore,
    zeroDisplacementScore,
    capacityFitScore,
    proximityScore,
    resourceReuseScore,
    rankingReasons,
    tradeoffs,
  };
}

/**
 * Runs the full deterministic Campus Shockwave simulation and candidate search.
 */
export function simulateShockwave(
  baseState: ApplicationState,
  disruption: Disruption
): ShockwaveSimulationResult {
  const simState = applyDisruptionToState(baseState, disruption);

  const targetEventId =
    disruption.targetEventId ?? "evt-robotics-workshop";
  const targetEvent = simState.events.find((e) => e.id === targetEventId);
  const origBooking = baseState.bookings.find(
    (b) => b.eventId === targetEventId && b.status !== "CANCELLED"
  );
  const simBooking = simState.bookings.find(
    (b) => b.eventId === targetEventId
  );

  if (!targetEvent || !origBooking || !simBooking) {
    return {
      disruption,
      stateVersion: baseState.stateVersion,
      directlyAffectedEventIds: [],
      indirectlyAffectedEventIds: [],
      affectedResourceIds: [],
      affectedPeopleIds: [],
      originalViolations: [],
      validCandidates: [],
      rejectedAttempts: [],
      summaryExplanation: "Target event or active booking not found in schedule.",
    };
  }

  // Special handling if the disruption is BOOKING_CANCELLED
  if (disruption.type === "BOOKING_CANCELLED") {
    const freedResources = targetEvent.requiredResources.map((r) => r.resourceId);
    return {
      disruption,
      stateVersion: baseState.stateVersion,
      directlyAffectedEventIds: [targetEvent.id],
      indirectlyAffectedEventIds: [],
      affectedResourceIds: freedResources,
      affectedPeopleIds: targetEvent.requiredPeopleIds,
      originalViolations: [],
      validCandidates: [],
      rejectedAttempts: [],
      summaryExplanation: `Booking for "${targetEvent.title}" cancelled in simulation. ${freedResources.length} equipment pools and ${targetEvent.requiredPeopleIds.length} mentors are released back to campus inventory.`,
    };
  }

  // Evaluate the target booking in the disrupted simulation state
  const currentCheck = evaluateRequestFeasibility(
    simState,
    {
      roomId: simBooking.roomId,
      startIso: simBooking.startIso,
      endIso: simBooking.endIso,
      setupMinutes: targetEvent.setupMinutes,
      cleanupMinutes: targetEvent.cleanupMinutes,
      expectedAttendance: targetEvent.expectedAttendance,
      requiredFacilities: targetEvent.requiredFacilities,
      requiredResources: targetEvent.requiredResources,
      requiredPeopleIds: targetEvent.requiredPeopleIds,
      requiresExtendedTurnaround: targetEvent.requiresExtendedTurnaround,
      excludeBookingId: simBooking.id,
      excludeEventId: targetEvent.id,
    },
    false
  );

  // Identify directly and indirectly affected events
  const directlyAffectedEventIds: string[] = [targetEvent.id];
  const indirectlyAffectedEventIds: string[] = [];

  for (const bkg of simState.bookings) {
    if (bkg.id === simBooking.id || bkg.status === "CANCELLED") continue;
    const ev = simState.events.find((e) => e.id === bkg.eventId);
    if (!ev) continue;
    const check = evaluateRequestFeasibility(
      simState,
      {
        roomId: bkg.roomId,
        startIso: bkg.startIso,
        endIso: bkg.endIso,
        setupMinutes: ev.setupMinutes,
        cleanupMinutes: ev.cleanupMinutes,
        expectedAttendance: ev.expectedAttendance,
        requiredFacilities: ev.requiredFacilities,
        requiredResources: ev.requiredResources,
        requiredPeopleIds: ev.requiredPeopleIds,
        requiresExtendedTurnaround: ev.requiresExtendedTurnaround,
        excludeBookingId: bkg.id,
        excludeEventId: ev.id,
      },
      false
    );
    if (!check.isFeasible) {
      directlyAffectedEventIds.push(ev.id);
    } else if (
      ev.requiredResources.some((r) =>
        targetEvent.requiredResources.some((tr) => tr.resourceId === r.resourceId)
      ) ||
      ev.requiredPeopleIds.some((p) => targetEvent.requiredPeopleIds.includes(p))
    ) {
      indirectlyAffectedEventIds.push(ev.id);
    }
  }

  const affectedResourceIds = targetEvent.requiredResources.map(
    (r) => r.resourceId
  );
  const affectedPeopleIds = [...targetEvent.requiredPeopleIds];

  const durationMinutes = Math.round(
    (new Date(origBooking.endIso).getTime() -
      new Date(origBooking.startIso).getTime()) /
      60_000
  );

  const validCandidates: CandidatePlan[] = [];
  const rejectedAttempts: RejectedCandidateExplanation[] = [];

  const origRoom = baseState.rooms.find((r) => r.id === origBooking.roomId);
  const estimatedCostAvoidedInr = targetEvent.requiredResources.reduce(
    (acc, req) => {
      const res = baseState.resources.find((r) => r.id === req.resourceId);
      return acc + (res?.replacementCostInr ?? 0) * req.quantity;
    },
    0
  );

  // Helper to build delta summary
  const buildDeltas = (
    candRoomId: string,
    candStartIso: string,
    candEndIso: string,
    candPeopleIds: string[],
    secondaryRelocations: SecondaryBookingRelocation[]
  ): PlanDeltaChange[] => {
    const deltas: PlanDeltaChange[] = [];
    const candRoom = simState.rooms.find((r) => r.id === candRoomId);
    if (candRoomId !== origBooking.roomId) {
      deltas.push({
        field: "ROOM",
        label: "Assigned Venue",
        before: `${origRoom?.name ?? origBooking.roomId} (Cap ${origRoom?.capacity ?? 0})`,
        after: `${candRoom?.name ?? candRoomId} (Cap ${candRoom?.capacity ?? 0})`,
        impactSeverity: "LOW",
      });
    } else {
      deltas.push({
        field: "ROOM",
        label: "Assigned Venue",
        before: `${origRoom?.name ?? origBooking.roomId}`,
        after: `${candRoom?.name ?? candRoomId} (Unchanged)`,
        impactSeverity: "NONE",
      });
    }

    if (
      candStartIso !== origBooking.startIso ||
      candEndIso !== origBooking.endIso
    ) {
      deltas.push({
        field: "TIME",
        label: "Scheduled Interval",
        before: formatTimeRange(origBooking.startIso, origBooking.endIso),
        after: formatTimeRange(candStartIso, candEndIso),
        impactSeverity: "MODERATE",
      });
    } else {
      deltas.push({
        field: "TIME",
        label: "Scheduled Interval",
        before: formatTimeRange(origBooking.startIso, origBooking.endIso),
        after: `${formatTimeRange(candStartIso, candEndIso)} (Preserved)`,
        impactSeverity: "NONE",
      });
    }

    const origMentorNames = targetEvent.requiredPeopleIds
      .map((id) => baseState.people.find((p) => p.id === id)?.name ?? id)
      .join(", ");
    const candMentorNames = candPeopleIds
      .map((id) => baseState.people.find((p) => p.id === id)?.name ?? id)
      .join(", ");

    if (origMentorNames !== candMentorNames) {
      deltas.push({
        field: "MENTORS",
        label: "Assigned Mentors",
        before: origMentorNames,
        after: candMentorNames,
        impactSeverity: "LOW",
      });
    }

    for (const rel of secondaryRelocations) {
      const fromR = simState.rooms.find((r) => r.id === rel.fromRoomId);
      const toR = simState.rooms.find((r) => r.id === rel.toRoomId);
      deltas.push({
        field: "DISPLACED_BOOKING",
        label: `Relocate "${rel.eventTitle}"`,
        before: fromR?.name ?? rel.fromRoomId,
        after: toR?.name ?? rel.toRoomId,
        impactSeverity: "MODERATE",
      });
    }

    return deltas;
  };

  // Determine mentor sets to try:
  // 1) Original required mentors
  // 2) If any original mentor has a PERSON_UNAVAILABLE or PERSON_OVERLAP, try substituting with another mentor who shares ROS2/technical skills
  const mentorCombinations: string[][] = [[...targetEvent.requiredPeopleIds]];
  for (let i = 0; i < targetEvent.requiredPeopleIds.length; i++) {
    const unavailablePid = targetEvent.requiredPeopleIds[i];
    const substitutes = simState.people.filter(
      (p) =>
        p.id !== unavailablePid &&
        !targetEvent.requiredPeopleIds.includes(p.id)
    );
    for (const sub of substitutes) {
      const copy = [...targetEvent.requiredPeopleIds];
      copy[i] = sub.id;
      mentorCombinations.push(copy);
    }
  }

  // Phase A: Search all rooms at the ORIGINAL time slot [origBooking.startIso, origBooking.endIso)
  for (const room of simState.rooms) {
    let matchedInRoomAtOrigTime = false;

    for (const peopleCombo of mentorCombinations) {
      const isSwappedMentors =
        peopleCombo.join(",") !== targetEvent.requiredPeopleIds.join(",");

      // Only try swapped mentors if original mentors had a person violation
      if (isSwappedMentors && matchedInRoomAtOrigTime) continue;

      const check = evaluateRequestFeasibility(
        simState,
        {
          roomId: room.id,
          startIso: origBooking.startIso,
          endIso: origBooking.endIso,
          setupMinutes: targetEvent.setupMinutes,
          cleanupMinutes: targetEvent.cleanupMinutes,
          expectedAttendance: targetEvent.expectedAttendance,
          requiredFacilities: targetEvent.requiredFacilities,
          requiredResources: targetEvent.requiredResources,
          requiredPeopleIds: peopleCombo,
          requiresExtendedTurnaround: targetEvent.requiresExtendedTurnaround,
          excludeBookingId: simBooking.id,
          excludeEventId: targetEvent.id,
        },
        false
      );

      if (check.isFeasible) {
        matchedInRoomAtOrigTime = true;
        const score = scoreCandidate(
          simState,
          targetEvent,
          origBooking.roomId,
          origBooking.startIso,
          origBooking.endIso,
          targetEvent.requiredPeopleIds,
          room.id,
          origBooking.startIso,
          origBooking.endIso,
          peopleCombo,
          []
        );

        validCandidates.push({
          id: `cand-same-${room.id}-${isSwappedMentors ? "swap" : "orig"}`,
          disruptionId: disruption.id,
          targetEventId: targetEvent.id,
          targetBookingId: simBooking.id,
          label: isSwappedMentors
            ? `Reassign to ${room.name} + Substitute Mentor`
            : `Relocate to ${room.name} (Same Time)`,
          strategyType: isSwappedMentors
            ? "SAME_TIME_ALT_ROOM_WITH_MENTOR_SWAP"
            : "SAME_TIME_ALT_ROOM",
          proposedRoomId: room.id,
          proposedStartIso: origBooking.startIso,
          proposedEndIso: origBooking.endIso,
          proposedSetupStartIso: check.computedIntervals.setupStartIso,
          proposedCleanupEndIso: check.computedIntervals.cleanupEndIso,
          proposedTurnaroundEndIso: check.computedIntervals.turnaroundEndIso,
          proposedTurnaroundMinutes: check.computedIntervals.turnaroundMinutes,
          proposedPeopleIds: peopleCombo,
          proposedResources: targetEvent.requiredResources,
          secondaryRelocations: [],
          hardConstraintPassed: true,
          score,
          deltas: buildDeltas(
            room.id,
            origBooking.startIso,
            origBooking.endIso,
            peopleCombo,
            []
          ),
          estimatedCostAvoidedInr,
          stateVersionAtGeneration: baseState.stateVersion,
        });
      } else if (!isSwappedMentors) {
        rejectedAttempts.push({
          id: `rej-${room.id}-orig`,
          attemptedLabel: `${room.name} @ ${formatTimeRange(
            origBooking.startIso,
            origBooking.endIso
          )}`,
          roomId: room.id,
          roomName: room.name,
          startIso: origBooking.startIso,
          endIso: origBooking.endIso,
          violations: check.violations,
        });
      }
    }
  }

  // Phase B: Search alternative time slots on the same date across suitable rooms
  const datePrefix = origBooking.startIso.slice(0, 10);
  const candidateStartTimes = [
    `${datePrefix}T09:00:00`,
    `${datePrefix}T11:00:00`,
    `${datePrefix}T13:00:00`,
    `${datePrefix}T14:30:00`,
    `${datePrefix}T15:00:00`,
    `${datePrefix}T16:00:00`,
  ];

  for (const slotStart of candidateStartTimes) {
    if (slotStart === origBooking.startIso) continue;
    const slotEnd = addMinutesToIso(slotStart, durationMinutes);

    for (const room of simState.rooms) {
      // Quick pre-filter on capacity & facilities so we only record meaningful time-slot attempts
      if (room.capacity < targetEvent.expectedAttendance) continue;
      if (
        !targetEvent.requiredFacilities.every((f) =>
          room.facilities.includes(f)
        )
      ) {
        continue;
      }

      const check = evaluateRequestFeasibility(
        simState,
        {
          roomId: room.id,
          startIso: slotStart,
          endIso: slotEnd,
          setupMinutes: targetEvent.setupMinutes,
          cleanupMinutes: targetEvent.cleanupMinutes,
          expectedAttendance: targetEvent.expectedAttendance,
          requiredFacilities: targetEvent.requiredFacilities,
          requiredResources: targetEvent.requiredResources,
          requiredPeopleIds: targetEvent.requiredPeopleIds,
          requiresExtendedTurnaround: targetEvent.requiresExtendedTurnaround,
          excludeBookingId: simBooking.id,
          excludeEventId: targetEvent.id,
        },
        false
      );

      if (check.isFeasible) {
        const score = scoreCandidate(
          simState,
          targetEvent,
          origBooking.roomId,
          origBooking.startIso,
          origBooking.endIso,
          targetEvent.requiredPeopleIds,
          room.id,
          slotStart,
          slotEnd,
          targetEvent.requiredPeopleIds,
          []
        );

        validCandidates.push({
          id: `cand-shift-${room.id}-${slotStart.slice(11, 13)}${slotStart.slice(
            14,
            16
          )}`,
          disruptionId: disruption.id,
          targetEventId: targetEvent.id,
          targetBookingId: simBooking.id,
          label: `${room.name} @ ${formatTimeRange(slotStart, slotEnd)}`,
          strategyType: "TIME_SHIFT_SAME_OR_ALT_ROOM",
          proposedRoomId: room.id,
          proposedStartIso: slotStart,
          proposedEndIso: slotEnd,
          proposedSetupStartIso: check.computedIntervals.setupStartIso,
          proposedCleanupEndIso: check.computedIntervals.cleanupEndIso,
          proposedTurnaroundEndIso: check.computedIntervals.turnaroundEndIso,
          proposedTurnaroundMinutes: check.computedIntervals.turnaroundMinutes,
          proposedPeopleIds: targetEvent.requiredPeopleIds,
          proposedResources: targetEvent.requiredResources,
          secondaryRelocations: [],
          hardConstraintPassed: true,
          score,
          deltas: buildDeltas(
            room.id,
            slotStart,
            slotEnd,
            targetEvent.requiredPeopleIds,
            []
          ),
          estimatedCostAvoidedInr,
          stateVersionAtGeneration: baseState.stateVersion,
        });
      } else {
        rejectedAttempts.push({
          id: `rej-${room.id}-${slotStart.slice(11, 16)}`,
          attemptedLabel: `${room.name} @ ${formatTimeRange(slotStart, slotEnd)}`,
          roomId: room.id,
          roomName: room.name,
          startIso: slotStart,
          endIso: slotEnd,
          violations: check.violations,
        });
      }
    }
  }

  // Deterministic ranking: sort by totalScore DESC, then proposedStartIso ASC, then proposedRoomId ASC
  validCandidates.sort((a, b) => {
    if (b.score.totalScore !== a.score.totalScore) {
      return b.score.totalScore - a.score.totalScore;
    }
    if (a.proposedStartIso !== b.proposedStartIso) {
      return a.proposedStartIso.localeCompare(b.proposedStartIso);
    }
    return a.proposedRoomId.localeCompare(b.proposedRoomId);
  });

  // Keep top 5 valid candidates so the comparison workspace is focused and high-signal
  const topCandidates = validCandidates.slice(0, 5);

  const summaryExplanation =
    topCandidates.length > 0
      ? `Shockwave evaluated ${
          topCandidates.length + rejectedAttempts.length
        } room/time/mentor configurations across campus. ${
          rejectedAttempts.length
        } invalid options were rejected by hard constraints; ${
          topCandidates.length
        } verified feasible recovery plans were ranked.`
      : `No feasible recovery plan exists under current hard constraints (${currentCheck.violations
          .map((v) => v.message)
          .join(" ")}).`;

  return {
    disruption,
    stateVersion: baseState.stateVersion,
    directlyAffectedEventIds: Array.from(new Set(directlyAffectedEventIds)),
    indirectlyAffectedEventIds: Array.from(new Set(indirectlyAffectedEventIds)),
    affectedResourceIds,
    affectedPeopleIds,
    originalViolations: currentCheck.violations,
    validCandidates: topCandidates,
    rejectedAttempts: rejectedAttempts.slice(0, 6),
    summaryExplanation,
  };
}

/**
 * Atomically validates and applies an approved CandidatePlan to the authoritative ApplicationState.
 * Rejects stale approvals if stateVersion has changed since the candidate was generated.
 */
export function approveCandidatePlan(
  currentState: ApplicationState,
  disruption: Disruption,
  candidate: CandidatePlan,
  approvedBy = "STRATOS Operations Director"
):
  | {
      ok: true;
      nextState: ApplicationState;
      approvalRecord: ApprovalRecord;
    }
  | {
      ok: false;
      error: string;
    } {
  if (candidate.stateVersionAtGeneration !== currentState.stateVersion) {
    return {
      ok: false,
      error: `Stale candidate plan rejected: application state changed from v${candidate.stateVersionAtGeneration} to v${currentState.stateVersion} since simulation. Please re-run Shockwave simulation.`,
    };
  }

  if (
    currentState.approvals.some(
      (a) =>
        a.disruptionId === disruption.id || a.candidatePlanId === candidate.id
    )
  ) {
    return {
      ok: false,
      error:
        "Duplicate approval rejected: this recovery plan or disruption has already been committed.",
    };
  }

  if (!candidate.hardConstraintPassed) {
    return {
      ok: false,
      error: "Cannot approve a candidate plan that violates hard constraints.",
    };
  }

  const origBooking = currentState.bookings.find(
    (b) => b.id === candidate.targetBookingId
  );
  const origEvent = currentState.events.find(
    (e) => e.id === candidate.targetEventId
  );

  if (!origBooking || !origEvent) {
    return {
      ok: false,
      error: "Target booking or event no longer exists in application state.",
    };
  }

  if (origBooking.status === "CANCELLED") {
    return {
      ok: false,
      error:
        "Cannot approve recovery plan: target booking has already been cancelled.",
    };
  }

  const origRoom = currentState.rooms.find((r) => r.id === origBooking.roomId);

  // Apply the disruption first on a working copy
  const nextState = applyDisruptionToState(currentState, disruption);

  // Re-validate candidate against the working copy before mutating bookings
  const revalidation = evaluateRequestFeasibility(
    nextState,
    {
      roomId: candidate.proposedRoomId,
      startIso: candidate.proposedStartIso,
      endIso: candidate.proposedEndIso,
      setupMinutes: origEvent.setupMinutes,
      cleanupMinutes: origEvent.cleanupMinutes,
      expectedAttendance:
        nextState.events.find((e) => e.id === origEvent.id)
          ?.expectedAttendance ?? origEvent.expectedAttendance,
      requiredFacilities: origEvent.requiredFacilities,
      requiredResources: candidate.proposedResources,
      requiredPeopleIds: candidate.proposedPeopleIds,
      requiresExtendedTurnaround: origEvent.requiresExtendedTurnaround,
      excludeBookingId: candidate.targetBookingId,
      excludeEventId: candidate.targetEventId,
    },
    false
  );

  if (!revalidation.isFeasible) {
    return {
      ok: false,
      error: `Candidate failed atomic commit validation: ${revalidation.violations
        .map((v) => v.message)
        .join("; ")}`,
    };
  }

  const nowIso = new Date().toISOString();
  const targetBooking = nextState.bookings.find(
    (b) => b.id === candidate.targetBookingId
  )!;
  const targetEvent = nextState.events.find(
    (e) => e.id === candidate.targetEventId
  )!;

  targetBooking.roomId = candidate.proposedRoomId;
  targetBooking.startIso = candidate.proposedStartIso;
  targetBooking.endIso = candidate.proposedEndIso;
  targetBooking.setupStartIso = candidate.proposedSetupStartIso;
  targetBooking.cleanupEndIso = candidate.proposedCleanupEndIso;
  targetBooking.turnaroundEndIso = candidate.proposedTurnaroundEndIso;
  targetBooking.turnaroundMinutes = candidate.proposedTurnaroundMinutes;
  targetBooking.status = "CONFIRMED";
  targetBooking.updatedAtIso = nowIso;

  targetEvent.requiredPeopleIds = [...candidate.proposedPeopleIds];

  // Update resource allocations for this booking
  for (const alloc of nextState.resourceAllocations) {
    if (alloc.bookingId === targetBooking.id && alloc.status !== "CANCELLED") {
      alloc.startIso = candidate.proposedSetupStartIso;
      alloc.endIso = candidate.proposedCleanupEndIso;
      alloc.updatedAtIso = nowIso;
    }
  }

  // Replace person commitments for this booking
  nextState.personCommitments = nextState.personCommitments.filter(
    (pcm) => pcm.bookingId !== targetBooking.id
  );
  for (let i = 0; i < candidate.proposedPeopleIds.length; i++) {
    nextState.personCommitments.push({
      id: `pcm-reassigned-${nextState.stateVersion + 1}-${i}`,
      bookingId: targetBooking.id,
      eventId: targetEvent.id,
      personId: candidate.proposedPeopleIds[i],
      startIso: candidate.proposedSetupStartIso,
      endIso: candidate.proposedCleanupEndIso,
      status: "ASSIGNED",
    });
  }

  const newRoom = nextState.rooms.find(
    (r) => r.id === candidate.proposedRoomId
  );

  const approvalRecord: ApprovalRecord = {
    id: `appr-${nextState.stateVersion + 1}`,
    disruptionId: disruption.id,
    candidatePlanId: candidate.id,
    approvedBy,
    approvedAtIso: nowIso,
    targetEventId: targetEvent.id,
    beforeSnapshot: {
      roomId: origBooking.roomId,
      roomName: origRoom?.name ?? origBooking.roomId,
      startIso: origBooking.startIso,
      endIso: origBooking.endIso,
      peopleIds: [...origEvent.requiredPeopleIds],
    },
    afterSnapshot: {
      roomId: candidate.proposedRoomId,
      roomName: newRoom?.name ?? candidate.proposedRoomId,
      startIso: candidate.proposedStartIso,
      endIso: candidate.proposedEndIso,
      peopleIds: [...candidate.proposedPeopleIds],
    },
    deltas: candidate.deltas,
    secondaryRelocations: candidate.secondaryRelocations,
  };

  nextState.stateVersion = currentState.stateVersion + 1;
  nextState.approvals = [approvalRecord, ...nextState.approvals];

  nextState.auditLog = [
    {
      id: `aud-appr-${nextState.stateVersion}`,
      timestampIso: nowIso,
      action: "PLAN_APPROVED",
      entityType: "SHOCKWAVE",
      entityId: approvalRecord.id,
      entityName: `${targetEvent.title} → ${newRoom?.name ?? candidate.proposedRoomId}`,
      result: "SUCCESS",
      reason: `Approved "${candidate.label}" (Score ${candidate.score.totalScore}/100) recovering from "${disruption.title}". Reallocated room, ${targetEvent.requiredResources.length} equipment pools, and ${candidate.proposedPeopleIds.length} mentors atomically.`,
      actor: approvedBy,
      isSimulatedEnvironment: true,
    },
    {
      id: `aud-disr-${nextState.stateVersion}`,
      timestampIso: nowIso,
      action: "DISRUPTION_SIMULATED",
      entityType: "SHOCKWAVE",
      entityId: disruption.id,
      entityName: disruption.title,
      result: "SIMULATED",
      reason: disruption.description,
      actor: approvedBy,
      isSimulatedEnvironment: true,
    },
    ...nextState.auditLog,
  ];

  void intervalsOverlap;
  return {
    ok: true,
    nextState,
    approvalRecord,
  };
}

/**
 * Explicitly rejects/dismisses a proposed Shockwave simulation without mutating any bookings,
 * rooms, equipment allocations, or mentor commitments.
 */
export function rejectShockwaveProposal(
  currentState: ApplicationState,
  disruption: Disruption
): {
  ok: true;
  nextState: ApplicationState;
  rejectedDisruptionId: string;
} {
  return {
    ok: true,
    nextState: currentState,
    rejectedDisruptionId: disruption.id,
  };
}

