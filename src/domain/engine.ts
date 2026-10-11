import {
  ApplicationState,
  Booking,
  BookingDraftInput,
  ConstraintViolation,
  EventEntity,
  FacilityType,
  FeasibilityResult,
  ResourceAllocation,
  ResourceRequirement,
  Room,
} from "./types";
import { FACILITY_LABELS } from "./seedData";

/**
 * Half-open interval intersection check: [startA, endA) intersects [startB, endB)
 * Using epoch milliseconds for deterministic comparison.
 */
export function intervalsOverlap(
  startAIso: string,
  endAIso: string,
  startBIso: string,
  endBIso: string
): boolean {
  const a0 = new Date(startAIso).getTime();
  const a1 = new Date(endAIso).getTime();
  const b0 = new Date(startBIso).getTime();
  const b1 = new Date(endBIso).getTime();
  return a0 < b1 && b0 < a1;
}

export function addMinutesToIso(iso: string, minutes: number): string {
  const d = new Date(iso);
  const target = new Date(d.getTime() + minutes * 60_000);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${target.getFullYear()}-${pad(target.getMonth() + 1)}-${pad(
    target.getDate()
  )}T${pad(target.getHours())}:${pad(target.getMinutes())}:00`;
}

export function resolveTurnaroundMinutes(
  state: ApplicationState,
  room: Room,
  requiresExtendedTurnaround?: boolean
): 15 | 30 {
  if (requiresExtendedTurnaround) return 30;
  if (room.customTurnaroundMinutes) return room.customTurnaroundMinutes;
  const policy = state.bufferPolicies.find((p) => p.id === room.bufferPolicyId);
  return policy?.defaultTurnaroundMinutes ?? 15;
}

export function computeBookingIntervals(
  state: ApplicationState,
  room: Room,
  startIso: string,
  endIso: string,
  setupMinutes: number,
  cleanupMinutes: number,
  requiresExtendedTurnaround?: boolean,
  overrideTurnaroundReason?: string
) {
  const baseTurnaround = resolveTurnaroundMinutes(
    state,
    room,
    requiresExtendedTurnaround
  );
  const policy = state.bufferPolicies.find((p) => p.id === room.bufferPolicyId);
  const effectiveTurnaround =
    overrideTurnaroundReason &&
    overrideTurnaroundReason.trim().length > 0 &&
    policy?.allowAuthorizedOverride
      ? 0
      : baseTurnaround;

  const setupStartIso = addMinutesToIso(startIso, -setupMinutes);
  const cleanupEndIso = addMinutesToIso(endIso, cleanupMinutes);
  const turnaroundEndIso = addMinutesToIso(cleanupEndIso, effectiveTurnaround);

  return {
    setupStartIso,
    startIso,
    endIso,
    cleanupEndIso,
    turnaroundEndIso,
    turnaroundMinutes: effectiveTurnaround,
    policyTurnaroundMinutes: baseTurnaround,
  };
}

export interface ValidationRequest {
  roomId: string;
  startIso: string;
  endIso: string;
  setupMinutes: number;
  cleanupMinutes: number;
  expectedAttendance: number;
  requiredFacilities: FacilityType[];
  requiredResources: ResourceRequirement[];
  requiredPeopleIds: string[];
  requiresExtendedTurnaround?: boolean;
  overrideTurnaroundReason?: string;
  excludeBookingId?: string;
  excludeEventId?: string;
}

/**
 * Computes available quantity of a given resource across a target interval [startIso, endIso)
 * by inspecting all active allocations and unavailability windows.
 */
export function getAvailableResourceQuantity(
  state: ApplicationState,
  resourceId: string,
  startIso: string,
  endIso: string,
  excludeBookingId?: string
): {
  available: number;
  operational: number;
  allocatedPeak: number;
  isBlockedByWindow: boolean;
  windowReason?: string;
} {
  const resource = state.resources.find((r) => r.id === resourceId);
  if (!resource) {
    return {
      available: 0,
      operational: 0,
      allocatedPeak: 0,
      isBlockedByWindow: true,
      windowReason: "Resource does not exist in catalog.",
    };
  }

  if (
    resource.condition === "DAMAGED" ||
    resource.condition === "MISSING" ||
    resource.operationalQuantity <= 0
  ) {
    return {
      available: 0,
      operational: 0,
      allocatedPeak: 0,
      isBlockedByWindow: true,
      windowReason: `Resource ${resource.name} is currently marked ${resource.condition}.`,
    };
  }

  const blockingWindow = state.availabilityWindows.find(
    (w) =>
      w.entityType === "RESOURCE" &&
      w.entityId === resourceId &&
      intervalsOverlap(startIso, endIso, w.startIso, w.endIso)
  );

  if (blockingWindow) {
    return {
      available: 0,
      operational: resource.operationalQuantity,
      allocatedPeak: 0,
      isBlockedByWindow: true,
      windowReason: blockingWindow.reason,
    };
  }

  const overlappingAllocations = state.resourceAllocations.filter((alloc) => {
    if (alloc.resourceId !== resourceId) return false;
    if (excludeBookingId && alloc.bookingId === excludeBookingId) return false;
    if (
      alloc.status === "CANCELLED" ||
      alloc.status === "RETURNED"
    ) {
      return false;
    }
    // Check if parent booking is cancelled
    const bkg = state.bookings.find((b) => b.id === alloc.bookingId);
    if (bkg && bkg.status === "CANCELLED") return false;

    return intervalsOverlap(startIso, endIso, alloc.startIso, alloc.endIso);
  });

  if (overlappingAllocations.length === 0) {
    return {
      available: resource.operationalQuantity,
      operational: resource.operationalQuantity,
      allocatedPeak: 0,
      isBlockedByWindow: false,
    };
  }

  // Evaluate peak concurrent usage at all interval start boundaries within [startIso, endIso)
  const checkPoints = new Set<number>([new Date(startIso).getTime()]);
  for (const a of overlappingAllocations) {
    const t = new Date(a.startIso).getTime();
    if (t >= new Date(startIso).getTime() && t < new Date(endIso).getTime()) {
      checkPoints.add(t);
    }
  }

  let peakAllocated = 0;
  for (const pt of checkPoints) {
    const ptIso = new Date(pt).toISOString();
    let sumAtPt = 0;
    for (const a of overlappingAllocations) {
      const a0 = new Date(a.startIso).getTime();
      const a1 = new Date(a.endIso).getTime();
      if (pt >= a0 && pt < a1) {
        sumAtPt += a.quantity;
      }
    }
    if (sumAtPt > peakAllocated) {
      peakAllocated = sumAtPt;
    }
    void ptIso;
  }

  const available = Math.max(0, resource.operationalQuantity - peakAllocated);
  return {
    available,
    operational: resource.operationalQuantity,
    allocatedPeak: peakAllocated,
    isBlockedByWindow: false,
  };
}

/**
 * Validates a complete event/booking request against all hard constraints in ApplicationState.
 */
export function evaluateRequestFeasibility(
  state: ApplicationState,
  req: ValidationRequest,
  checkAlternativesIfInfeasible = true
): FeasibilityResult {
  const violations: ConstraintViolation[] = [];
  const suitabilityReasons: string[] = [];

  const room = state.rooms.find((r) => r.id === req.roomId);
  if (!room) {
    return {
      status: "NO_FEASIBLE_PLAN",
      isFeasible: false,
      violations: [
        {
          code: "ROOM_UNAVAILABLE_WINDOW",
          severity: "HARD",
          entityId: req.roomId,
          entityName: "Unknown Room",
          message: "Selected room does not exist.",
        },
      ],
      suitabilityReasons: [],
      computedIntervals: {
        setupStartIso: req.startIso,
        startIso: req.startIso,
        endIso: req.endIso,
        cleanupEndIso: req.endIso,
        turnaroundEndIso: req.endIso,
        turnaroundMinutes: 15,
      },
    };
  }

  if (new Date(req.endIso).getTime() <= new Date(req.startIso).getTime()) {
    violations.push({
      code: "INVALID_INTERVAL",
      severity: "HARD",
      entityId: room.id,
      entityName: room.name,
      message: "Event end time must be strictly after start time.",
    });
  }

  const intervals = computeBookingIntervals(
    state,
    room,
    req.startIso,
    req.endIso,
    req.setupMinutes,
    req.cleanupMinutes,
    req.requiresExtendedTurnaround,
    req.overrideTurnaroundReason
  );

  // 1. Capacity check
  if (room.capacity < req.expectedAttendance) {
    violations.push({
      code: "CAPACITY_INSUFFICIENT",
      severity: "HARD",
      entityId: room.id,
      entityName: room.name,
      message: `${room.name} is unsuitable because its capacity is ${room.capacity}, below the required ${req.expectedAttendance}.`,
    });
  } else {
    const headroom = room.capacity - req.expectedAttendance;
    suitabilityReasons.push(
      `Capacity verified (${room.capacity} seats supports ${req.expectedAttendance} attendees with ${headroom} buffer seats).`
    );
  }

  // 2. Facility check
  const missingFacilities = req.requiredFacilities.filter(
    (f) => !room.facilities.includes(f)
  );
  if (missingFacilities.length > 0) {
    const names = missingFacilities.map((f) => FACILITY_LABELS[f] || f).join(", ");
    violations.push({
      code: "MISSING_FACILITY",
      severity: "HARD",
      entityId: room.id,
      entityName: room.name,
      message: `${room.name} is missing required facility infrastructure: ${names}.`,
    });
  } else if (req.requiredFacilities.length > 0) {
    suitabilityReasons.push(
      `All ${req.requiredFacilities.length} required room facilities present (${req.requiredFacilities
        .map((f) => FACILITY_LABELS[f])
        .join(", ")}).`
    );
  }

  // 3. Room unavailability window check (covers setup through cleanup)
  const roomWindows = state.availabilityWindows.filter(
    (w) =>
      w.entityType === "ROOM" &&
      w.entityId === room.id &&
      intervalsOverlap(
        intervals.setupStartIso,
        intervals.cleanupEndIso,
        w.startIso,
        w.endIso
      )
  );
  for (const win of roomWindows) {
    violations.push({
      code: "ROOM_UNAVAILABLE_WINDOW",
      severity: "HARD",
      entityId: room.id,
      entityName: room.name,
      message: `${room.name} is unavailable (${win.status}) from ${win.startIso.slice(
        11,
        16
      )} to ${win.endIso.slice(11, 16)}: ${win.reason}.`,
    });
  }

  // 4. Room booking overlap, setup/cleanup, and turnaround checks
  const otherRoomBookings = state.bookings.filter(
    (b) =>
      b.roomId === room.id &&
      b.status !== "CANCELLED" &&
      b.id !== req.excludeBookingId
  );

  for (const existing of otherRoomBookings) {
    const existingEvent = state.events.find((e) => e.id === existing.eventId);
    const evTitle = existingEvent?.title ?? existing.id;

    // Core event overlap
    if (
      intervalsOverlap(
        intervals.startIso,
        intervals.endIso,
        existing.startIso,
        existing.endIso
      )
    ) {
      violations.push({
        code: "ROOM_OVERLAP_CONFLICT",
        severity: "HARD",
        entityId: room.id,
        entityName: room.name,
        message: `${room.name} is already booked for "${evTitle}" (${existing.startIso.slice(
          11,
          16
        )}–${existing.endIso.slice(11, 16)}).`,
      });
      continue;
    }

    // Setup / Cleanup protected interval overlap
    if (
      intervalsOverlap(
        intervals.setupStartIso,
        intervals.cleanupEndIso,
        existing.setupStartIso,
        existing.cleanupEndIso
      )
    ) {
      violations.push({
        code: "SETUP_CLEANUP_CONFLICT",
        severity: "HARD",
        entityId: room.id,
        entityName: room.name,
        message: `Setup/cleanup interval (${intervals.setupStartIso.slice(
          11,
          16
        )}–${intervals.cleanupEndIso.slice(
          11,
          16
        )}) overlaps protected prep/teardown window of "${evTitle}" (${existing.setupStartIso.slice(
          11,
          16
        )}–${existing.cleanupEndIso.slice(11, 16)}).`,
      });
      continue;
    }

    // Turnaround buffer violation check:
    // Case A: New booking's [setupStart, turnaroundEnd) overlaps existing's [setupStart, cleanupEnd)
    // Case B: Existing booking's [setupStart, turnaroundEnd) overlaps new booking's [setupStart, cleanupEnd)
    const violatesNewTurnaround = intervalsOverlap(
      intervals.setupStartIso,
      intervals.turnaroundEndIso,
      existing.setupStartIso,
      existing.cleanupEndIso
    );
    const violatesExistingTurnaround =
      !req.overrideTurnaroundReason &&
      intervalsOverlap(
        existing.setupStartIso,
        existing.turnaroundEndIso,
        intervals.setupStartIso,
        intervals.cleanupEndIso
      );

    if (violatesNewTurnaround || violatesExistingTurnaround) {
      const reqGap = Math.max(
        intervals.policyTurnaroundMinutes,
        existing.turnaroundMinutes
      );
      violations.push({
        code: "TURNAROUND_BUFFER_VIOLATION",
        severity: "HARD",
        entityId: room.id,
        entityName: room.name,
        message: `Violates mandatory ${reqGap}-minute room turnaround policy in ${room.name} adjacent to "${evTitle}" (protected until ${existing.turnaroundEndIso.slice(
          11,
          16
        )}).`,
      });
    }
  }

  if (
    roomWindows.length === 0 &&
    !violations.some(
      (v) =>
        v.code === "ROOM_OVERLAP_CONFLICT" ||
        v.code === "SETUP_CLEANUP_CONFLICT" ||
        v.code === "TURNAROUND_BUFFER_VIOLATION"
    )
  ) {
    suitabilityReasons.push(
      `Room schedule clear across setup (${intervals.setupStartIso.slice(
        11,
        16
      )}), event, cleanup, and ${intervals.turnaroundMinutes}m turnaround (${intervals.turnaroundEndIso.slice(
        11,
        16
      )}).`
    );
  }

  // 5. Resource quantity and availability checks
  for (const reqRes of req.requiredResources) {
    if (reqRes.quantity <= 0) continue;
    const resource = state.resources.find((r) => r.id === reqRes.resourceId);
    if (!resource) {
      violations.push({
        code: "RESOURCE_UNAVAILABLE",
        severity: "HARD",
        entityId: reqRes.resourceId,
        entityName: reqRes.resourceId,
        message: `Requested equipment ${reqRes.resourceId} does not exist in inventory.`,
      });
      continue;
    }

    const availInfo = getAvailableResourceQuantity(
      state,
      reqRes.resourceId,
      intervals.setupStartIso,
      intervals.cleanupEndIso,
      req.excludeBookingId
    );

    if (availInfo.isBlockedByWindow) {
      violations.push({
        code: "RESOURCE_UNAVAILABLE",
        severity: "HARD",
        entityId: resource.id,
        entityName: resource.name,
        message: `${resource.name} cannot be allocated: ${availInfo.windowReason}`,
      });
    } else if (availInfo.available < reqRes.quantity) {
      violations.push({
        code: "RESOURCE_INSUFFICIENT",
        severity: "HARD",
        entityId: resource.id,
        entityName: resource.name,
        message: `Insufficient ${resource.name}: requested ${reqRes.quantity}, but only ${availInfo.available} of ${availInfo.operational} operational units are available for ${intervals.setupStartIso.slice(
          11,
          16
        )}–${intervals.cleanupEndIso.slice(11, 16)}.`,
      });
    } else {
      suitabilityReasons.push(
        `Equipment verified: ${reqRes.quantity}× ${resource.name} available (${availInfo.available} free in pool).`
      );
    }
  }

  // 6. Required Mentors / People availability checks
  for (const personId of req.requiredPeopleIds) {
    const person = state.people.find((p) => p.id === personId);
    const personName = person ? `${person.name} (${person.roleTitle})` : personId;

    const personWindow = state.availabilityWindows.find(
      (w) =>
        w.entityType === "PERSON" &&
        w.entityId === personId &&
        intervalsOverlap(
          intervals.setupStartIso,
          intervals.cleanupEndIso,
          w.startIso,
          w.endIso
        )
    );

    if (personWindow) {
      violations.push({
        code: "PERSON_UNAVAILABLE",
        severity: "HARD",
        entityId: personId,
        entityName: personName,
        message: `${personName} is unavailable during ${personWindow.startIso.slice(
          11,
          16
        )}–${personWindow.endIso.slice(11, 16)}: ${personWindow.reason}.`,
      });
      continue;
    }

    const overlappingCommitments = state.personCommitments.filter((c) => {
      if (c.personId !== personId || c.status === "CANCELLED") return false;
      if (req.excludeBookingId && c.bookingId === req.excludeBookingId) return false;
      const bkg = state.bookings.find((b) => b.id === c.bookingId);
      if (bkg && bkg.status === "CANCELLED") return false;
      return intervalsOverlap(
        intervals.setupStartIso,
        intervals.cleanupEndIso,
        c.startIso,
        c.endIso
      );
    });

    if (overlappingCommitments.length > 0) {
      const conflictEvent = state.events.find(
        (e) => e.id === overlappingCommitments[0].eventId
      );
      violations.push({
        code: "PERSON_OVERLAP",
        severity: "HARD",
        entityId: personId,
        entityName: personName,
        message: `${personName} is already assigned to "${
          conflictEvent?.title ?? "another event"
        }" (${overlappingCommitments[0].startIso.slice(
          11,
          16
        )}–${overlappingCommitments[0].endIso.slice(11, 16)}).`,
      });
    } else {
      suitabilityReasons.push(`Mentor ${person?.name ?? personId} is available.`);
    }
  }

  if (violations.length === 0) {
    return {
      status: "FEASIBLE",
      isFeasible: true,
      violations: [],
      suitabilityReasons,
      computedIntervals: intervals,
    };
  }

  // If infeasible and checkAlternativesIfInfeasible is true, check whether another room or slot on that date is feasible
  let hasAlternative = false;
  if (checkAlternativesIfInfeasible) {
    const durationMs =
      new Date(req.endIso).getTime() - new Date(req.startIso).getTime();
    if (durationMs > 0) {
      // Check other rooms at the same time
      for (const altRoom of state.rooms) {
        if (altRoom.id === req.roomId) continue;
        const altCheck = evaluateRequestFeasibility(
          state,
          { ...req, roomId: altRoom.id },
          false
        );
        if (altCheck.isFeasible) {
          hasAlternative = true;
          break;
        }
      }

      // If no room at same time, check standard time slots on the same day
      if (!hasAlternative) {
        const datePrefix = req.startIso.slice(0, 10);
        const candidateHours = ["09:00", "11:00", "13:30", "14:30", "16:00"];
        outer: for (const hr of candidateHours) {
          const candStart = `${datePrefix}T${hr}:00`;
          const candEnd = addMinutesToIso(
            candStart,
            Math.round(durationMs / 60_000)
          );
          for (const altRoom of state.rooms) {
            const altCheck = evaluateRequestFeasibility(
              state,
              {
                ...req,
                roomId: altRoom.id,
                startIso: candStart,
                endIso: candEnd,
              },
              false
            );
            if (altCheck.isFeasible) {
              hasAlternative = true;
              break outer;
            }
          }
        }
      }
    }
  }

  return {
    status: hasAlternative ? "ALTERNATIVES_AVAILABLE" : "NO_FEASIBLE_PLAN",
    isFeasible: false,
    violations,
    suitabilityReasons,
    computedIntervals: intervals,
  };
}

/**
 * Finds all active conflicts across the entire state (useful for Command Center and Timeline).
 */
export function detectGlobalConflicts(
  state: ApplicationState
): Array<{
  bookingId: string;
  eventId: string;
  eventTitle: string;
  roomId: string;
  roomName: string;
  violations: ConstraintViolation[];
}> {
  const results: Array<{
    bookingId: string;
    eventId: string;
    eventTitle: string;
    roomId: string;
    roomName: string;
    violations: ConstraintViolation[];
  }> = [];

  for (const booking of state.bookings) {
    if (booking.status === "CANCELLED" || booking.status === "COMPLETED") {
      continue;
    }
    const event = state.events.find((e) => e.id === booking.eventId);
    if (!event) continue;
    const room = state.rooms.find((r) => r.id === booking.roomId);

    const check = evaluateRequestFeasibility(
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
    );

    if (!check.isFeasible) {
      results.push({
        bookingId: booking.id,
        eventId: event.id,
        eventTitle: event.title,
        roomId: booking.roomId,
        roomName: room?.name ?? booking.roomId,
        violations: check.violations,
      });
    }
  }

  return results;
}

/**
 * Creates and commits a validated booking and its resource/person allocations atomically.
 * Rejects if hard constraints fail.
 */
export function createValidatedBooking(
  state: ApplicationState,
  draft: BookingDraftInput,
  actor = "Campus Organizer"
):
  | { ok: true; nextState: ApplicationState; bookingId: string; eventId: string }
  | { ok: false; feasibility: FeasibilityResult } {
  const startIso = `${draft.dateStr}T${draft.startTimeStr}:00`;
  const endIso = addMinutesToIso(startIso, draft.durationMinutes);

  // Prevent duplicate submission (same title, room, and start time)
  const duplicate = state.bookings.find((b) => {
    if (b.status === "CANCELLED") return false;
    const ev = state.events.find((e) => e.id === b.eventId);
    return (
      ev &&
      ev.title.trim().toLowerCase() === draft.title.trim().toLowerCase() &&
      b.startIso === startIso
    );
  });

  if (duplicate) {
    return {
      ok: false,
      feasibility: {
        status: "NO_FEASIBLE_PLAN",
        isFeasible: false,
        violations: [
          {
            code: "ROOM_OVERLAP_CONFLICT",
            severity: "HARD",
            entityId: draft.preferredRoomId,
            entityName: draft.title,
            message: `Duplicate booking prevented: "${draft.title}" is already scheduled at ${draft.startTimeStr}.`,
          },
        ],
        suitabilityReasons: [],
        computedIntervals: {
          setupStartIso: startIso,
          startIso,
          endIso,
          cleanupEndIso: endIso,
          turnaroundEndIso: endIso,
          turnaroundMinutes: 15,
        },
      },
    };
  }

  const feasibility = evaluateRequestFeasibility(
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

  if (!feasibility.isFeasible) {
    return { ok: false, feasibility };
  }

  const nowIso = new Date().toISOString();
  const suffix = `${state.stateVersion + 1}-${Math.floor(Math.random() * 900 + 100)}`;
  const eventId = `evt-${suffix}`;
  const bookingId = `bkg-${suffix}`;

  const newEvent: EventEntity = {
    id: eventId,
    title: draft.title.trim(),
    description: draft.description.trim(),
    organizer: draft.organizer.trim() || "Campus Organizer",
    category: draft.category,
    priority: draft.priority,
    expectedAttendance: draft.expectedAttendance,
    requiredFacilities: [...draft.requiredFacilities],
    requiredResources: draft.requiredResources.filter((r) => r.quantity > 0),
    requiredPeopleIds: [...draft.requiredPeopleIds],
    setupMinutes: draft.setupMinutes,
    cleanupMinutes: draft.cleanupMinutes,
    requiresExtendedTurnaround: draft.requiresExtendedTurnaround,
  };

  const newBooking: Booking = {
    id: bookingId,
    eventId,
    roomId: draft.preferredRoomId,
    setupStartIso: feasibility.computedIntervals.setupStartIso,
    startIso: feasibility.computedIntervals.startIso,
    endIso: feasibility.computedIntervals.endIso,
    cleanupEndIso: feasibility.computedIntervals.cleanupEndIso,
    turnaroundEndIso: feasibility.computedIntervals.turnaroundEndIso,
    turnaroundMinutes: feasibility.computedIntervals.turnaroundMinutes,
    status: "CONFIRMED",
    overrideReason: draft.overrideTurnaroundReason,
    overrideAuthorizedBy: draft.overrideTurnaroundReason ? actor : undefined,
    createdAtIso: nowIso,
    updatedAtIso: nowIso,
  };

  const newAllocations: ResourceAllocation[] = newEvent.requiredResources.map(
    (reqRes, idx) => ({
      id: `alloc-${suffix}-${idx}`,
      bookingId,
      eventId,
      resourceId: reqRes.resourceId,
      quantity: reqRes.quantity,
      startIso: newBooking.setupStartIso,
      endIso: newBooking.cleanupEndIso,
      status: "RESERVED",
      updatedAtIso: nowIso,
    })
  );

  const newCommitments = newEvent.requiredPeopleIds.map((personId, idx) => ({
    id: `pcm-${suffix}-${idx}`,
    bookingId,
    eventId,
    personId,
    startIso: newBooking.setupStartIso,
    endIso: newBooking.cleanupEndIso,
    status: "ASSIGNED" as const,
  }));

  const room = state.rooms.find((r) => r.id === draft.preferredRoomId);

  const nextState: ApplicationState = {
    ...state,
    stateVersion: state.stateVersion + 1,
    events: [...state.events, newEvent],
    bookings: [...state.bookings, newBooking],
    resourceAllocations: [...state.resourceAllocations, ...newAllocations],
    personCommitments: [...state.personCommitments, ...newCommitments],
    auditLog: [
      {
        id: `aud-${suffix}`,
        timestampIso: nowIso,
        action: "BOOKING_CONFIRMED",
        entityType: "BOOKING",
        entityId: bookingId,
        entityName: newEvent.title,
        result: "SUCCESS",
        reason: `Confirmed in ${room?.name ?? draft.preferredRoomId} (${draft.startTimeStr}, ${draft.durationMinutes}m + ${newBooking.turnaroundMinutes}m turnaround). All hard constraints satisfied.`,
        actor,
        isSimulatedEnvironment: true,
      },
      ...state.auditLog,
    ],
  };

  return { ok: true, nextState, bookingId, eventId };
}
