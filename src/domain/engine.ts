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

const ISO_LOCAL_REGEX = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?$/;
const DATE_STR_REGEX = /^\d{4}-\d{2}-\d{2}$/;
const TIME_STR_REGEX = /^([01]\d|2[0-3]):[0-5]\d$/;

export function isValidIsoDateTime(iso: string): boolean {
  if (!iso || typeof iso !== "string" || !ISO_LOCAL_REGEX.test(iso)) {
    return false;
  }
  const ms = new Date(iso).getTime();
  return Number.isFinite(ms);
}

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
  if (
    !Number.isFinite(a0) ||
    !Number.isFinite(a1) ||
    !Number.isFinite(b0) ||
    !Number.isFinite(b1)
  ) {
    return false;
  }
  return a0 < b1 && b0 < a1;
}

export function addMinutesToIso(iso: string, minutes: number): string {
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime()) || !Number.isFinite(minutes)) {
    return iso;
  }
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
  const safeSetup = Math.max(0, Number.isFinite(setupMinutes) ? setupMinutes : 0);
  const safeCleanup = Math.max(
    0,
    Number.isFinite(cleanupMinutes) ? cleanupMinutes : 0
  );
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

  const setupStartIso = addMinutesToIso(startIso, -safeSetup);
  const cleanupEndIso = addMinutesToIso(endIso, safeCleanup);
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
 * Normalizes and aggregates duplicate resource requirements by resourceId.
 */
export function normalizeResourceRequirements(
  reqs: ResourceRequirement[]
): {
  aggregated: ResourceRequirement[];
  hasInvalidQuantity: boolean;
} {
  const map = new Map<string, number>();
  let hasInvalidQuantity = false;

  for (const r of reqs) {
    if (!r || typeof r.resourceId !== "string" || !r.resourceId.trim()) {
      hasInvalidQuantity = true;
      continue;
    }
    if (
      typeof r.quantity !== "number" ||
      !Number.isFinite(r.quantity) ||
      !Number.isInteger(r.quantity) ||
      r.quantity < 0
    ) {
      hasInvalidQuantity = true;
      continue;
    }
    if (r.quantity === 0) continue;
    map.set(r.resourceId, (map.get(r.resourceId) ?? 0) + r.quantity);
  }

  const aggregated: ResourceRequirement[] = [];
  for (const [resourceId, quantity] of map.entries()) {
    aggregated.push({ resourceId, quantity });
  }
  return { aggregated, hasInvalidQuantity };
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
  const startMs = new Date(startIso).getTime();
  const endMs = new Date(endIso).getTime();
  const checkPoints = new Set<number>([startMs]);
  for (const a of overlappingAllocations) {
    const t = new Date(a.startIso).getTime();
    if (t >= startMs && t < endMs) {
      checkPoints.add(t);
    }
  }

  let peakAllocated = 0;
  for (const pt of checkPoints) {
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
          entityId: req.roomId || "unknown",
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

  // Validate date/time strings and numeric interval parameters
  if (!isValidIsoDateTime(req.startIso) || !isValidIsoDateTime(req.endIso)) {
    violations.push({
      code: "INVALID_INTERVAL",
      severity: "HARD",
      entityId: room.id,
      entityName: room.name,
      message: "Start time or end time is missing or has an invalid ISO format.",
    });
  } else if (
    new Date(req.endIso).getTime() <= new Date(req.startIso).getTime()
  ) {
    violations.push({
      code: "INVALID_INTERVAL",
      severity: "HARD",
      entityId: room.id,
      entityName: room.name,
      message: "Event end time must be strictly after start time.",
    });
  }

  if (
    typeof req.setupMinutes !== "number" ||
    !Number.isFinite(req.setupMinutes) ||
    req.setupMinutes < 0 ||
    typeof req.cleanupMinutes !== "number" ||
    !Number.isFinite(req.cleanupMinutes) ||
    req.cleanupMinutes < 0
  ) {
    violations.push({
      code: "INVALID_INTERVAL",
      severity: "HARD",
      entityId: room.id,
      entityName: room.name,
      message: "Setup and cleanup durations must be non-negative numbers.",
    });
  }

  if (
    typeof req.expectedAttendance !== "number" ||
    !Number.isFinite(req.expectedAttendance) ||
    !Number.isInteger(req.expectedAttendance) ||
    req.expectedAttendance <= 0
  ) {
    violations.push({
      code: "CAPACITY_INSUFFICIENT",
      severity: "HARD",
      entityId: room.id,
      entityName: room.name,
      message: "Expected attendance must be a positive integer greater than zero.",
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
  if (
    typeof req.expectedAttendance === "number" &&
    req.expectedAttendance > 0 &&
    room.capacity < req.expectedAttendance
  ) {
    violations.push({
      code: "CAPACITY_INSUFFICIENT",
      severity: "HARD",
      entityId: room.id,
      entityName: room.name,
      message: `${room.name} is unsuitable because its capacity is ${room.capacity}, below the required ${req.expectedAttendance}.`,
    });
  } else if (req.expectedAttendance > 0) {
    const headroom = room.capacity - req.expectedAttendance;
    suitabilityReasons.push(
      `Capacity verified (${room.capacity} seats supports ${req.expectedAttendance} attendees with ${headroom} buffer seats).`
    );
  }

  // 2. Facility check
  const missingFacilities = (req.requiredFacilities ?? []).filter(
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
  } else if ((req.requiredFacilities ?? []).length > 0) {
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
        v.code === "TURNAROUND_BUFFER_VIOLATION" ||
        v.code === "INVALID_INTERVAL"
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

  // 5. Resource quantity and availability checks (with duplicate aggregation)
  const { aggregated: normalizedResources, hasInvalidQuantity } =
    normalizeResourceRequirements(req.requiredResources ?? []);

  if (hasInvalidQuantity) {
    violations.push({
      code: "RESOURCE_INSUFFICIENT",
      severity: "HARD",
      entityId: "invalid-resource-qty",
      entityName: "Equipment Request",
      message:
        "Equipment quantities must be non-negative integers with valid resource IDs.",
    });
  }

  for (const reqRes of normalizedResources) {
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

  // 6. Required Mentors / People availability checks (deduplicated)
  const uniquePeopleIds = Array.from(new Set(req.requiredPeopleIds ?? []));
  for (const personId of uniquePeopleIds) {
    const person = state.people.find((p) => p.id === personId);
    if (!person) {
      violations.push({
        code: "PERSON_UNAVAILABLE",
        severity: "HARD",
        entityId: personId,
        entityName: personId,
        message: `Requested mentor or role "${personId}" does not exist in campus directory.`,
      });
      continue;
    }
    const personName = `${person.name} (${person.roleTitle})`;

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
      suitabilityReasons.push(`Mentor ${person.name} is available.`);
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
  const hasFatalInputViolation = violations.some(
    (v) => v.code === "INVALID_INTERVAL" || hasInvalidQuantity
  );

  if (checkAlternativesIfInfeasible && !hasFatalInputViolation) {
    const durationMs =
      new Date(req.endIso).getTime() - new Date(req.startIso).getTime();
    if (durationMs > 0) {
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
 * Authoritative calculation of dashboard and inventory metrics for a given operational date.
 * Eliminates any ambiguity between point-in-time operational pool capacity (e.g., 50 units),
 * active day unit-reservations (e.g., 37 unit-allocations), and cumulative reused asset value.
 */
export function computeOperationalMetrics(
  state: ApplicationState,
  selectedDate: string
) {
  const dayBookings = state.bookings
    .filter(
      (b) => b.startIso.startsWith(selectedDate) && b.status !== "CANCELLED"
    )
    .sort((a, b) => a.startIso.localeCompare(b.startIso));

  const globalConflicts = detectGlobalConflicts(state);
  const occupiedRoomIds = new Set(dayBookings.map((b) => b.roomId));
  const unavailableRoomIds = new Set(
    state.availabilityWindows
      .filter(
        (w) => w.entityType === "ROOM" && w.startIso.startsWith(selectedDate)
      )
      .map((w) => w.entityId)
  );

  const totalCatalogUnits = state.resources.reduce(
    (sum, r) => sum + r.totalQuantity,
    0
  );
  const totalOperationalUnits = state.resources.reduce(
    (sum, r) => sum + r.operationalQuantity,
    0
  );

  // Active (RESERVED / CHECKED_OUT) allocations on selectedDate
  const activeDayAllocations = state.resourceAllocations.filter((a) => {
    if (!a.startIso.startsWith(selectedDate)) return false;
    if (a.status !== "RESERVED" && a.status !== "CHECKED_OUT") return false;
    const bkg = state.bookings.find((b) => b.id === a.bookingId);
    return !bkg || bkg.status !== "CANCELLED";
  });

  // All non-cancelled allocations on selectedDate (including RETURNED from earlier today)
  const allDayNonCancelledAllocations = state.resourceAllocations.filter((a) => {
    if (!a.startIso.startsWith(selectedDate)) return false;
    if (a.status === "CANCELLED") return false;
    const bkg = state.bookings.find((b) => b.id === a.bookingId);
    return !bkg || bkg.status !== "CANCELLED";
  });

  // All non-cancelled allocations across all dates in state
  const allNonCancelledAllocations = state.resourceAllocations.filter((a) => {
    if (a.status === "CANCELLED") return false;
    const bkg = state.bookings.find((b) => b.id === a.bookingId);
    return !bkg || bkg.status !== "CANCELLED";
  });

  const activeDayUnitAllocations = activeDayAllocations.reduce(
    (sum, a) => sum + a.quantity,
    0
  );

  const allDayUnitAllocations = allDayNonCancelledAllocations.reduce(
    (sum, a) => sum + a.quantity,
    0
  );

  // Compute true peak simultaneous units in use across the entire campus on selectedDate
  const timePoints = new Set<number>();
  for (const a of activeDayAllocations) {
    timePoints.add(new Date(a.startIso).getTime());
  }
  let peakConcurrentUnitsOnDate = 0;
  for (const pt of timePoints) {
    let sum = 0;
    for (const a of activeDayAllocations) {
      const a0 = new Date(a.startIso).getTime();
      const a1 = new Date(a.endIso).getTime();
      if (pt >= a0 && pt < a1) {
        sum += a.quantity;
      }
    }
    if (sum > peakConcurrentUnitsOnDate) {
      peakConcurrentUnitsOnDate = sum;
    }
  }

  const activeDayReusedValueInr = activeDayAllocations.reduce((sum, a) => {
    const res = state.resources.find((r) => r.id === a.resourceId);
    return sum + (res?.replacementCostInr ?? 0) * a.quantity;
  }, 0);

  const totalSessionReusedValueInr = allNonCancelledAllocations.reduce(
    (sum, a) => {
      const res = state.resources.find((r) => r.id === a.resourceId);
      return sum + (res?.replacementCostInr ?? 0) * a.quantity;
    },
    0
  );

  return {
    dayBookings,
    globalConflicts,
    occupiedRoomCount: occupiedRoomIds.size,
    unavailableRoomCount: unavailableRoomIds.size,
    operationalRoomCount: state.rooms.length - unavailableRoomIds.size,
    totalRoomCount: state.rooms.length,
    totalCatalogUnits,
    totalOperationalUnits,
    activeDayUnitAllocations,
    allDayUnitAllocations,
    peakConcurrentUnitsOnDate,
    activeDayReusedValueInr,
    totalSessionReusedValueInr,
  };
}

/**
 * Creates and commits a validated booking and its resource/person allocations atomically.
 * Rejects if hard constraints or input validations fail.
 */
export function createValidatedBooking(
  state: ApplicationState,
  draft: BookingDraftInput,
  actor = "Campus Organizer"
):
  | { ok: true; nextState: ApplicationState; bookingId: string; eventId: string }
  | { ok: false; feasibility: FeasibilityResult } {
  if (
    !draft ||
    typeof draft.title !== "string" ||
    draft.title.trim().length === 0 ||
    !DATE_STR_REGEX.test(draft.dateStr ?? "") ||
    !TIME_STR_REGEX.test(draft.startTimeStr ?? "") ||
    typeof draft.durationMinutes !== "number" ||
    !Number.isFinite(draft.durationMinutes) ||
    draft.durationMinutes <= 0
  ) {
    return {
      ok: false,
      feasibility: {
        status: "NO_FEASIBLE_PLAN",
        isFeasible: false,
        violations: [
          {
            code: "INVALID_INTERVAL",
            severity: "HARD",
            entityId: draft?.preferredRoomId ?? "unknown",
            entityName: draft?.title || "Invalid Booking Request",
            message:
              "Invalid booking input: title, valid date (YYYY-MM-DD), valid start time (HH:mm), and positive duration are required.",
          },
        ],
        suitabilityReasons: [],
        computedIntervals: {
          setupStartIso: "",
          startIso: "",
          endIso: "",
          cleanupEndIso: "",
          turnaroundEndIso: "",
          turnaroundMinutes: 15,
        },
      },
    };
  }

  const startIso = `${draft.dateStr}T${draft.startTimeStr}:00`;
  const endIso = addMinutesToIso(startIso, draft.durationMinutes);

  // Prevent duplicate submission (same title and start time)
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

  const { aggregated: normalizedResources } = normalizeResourceRequirements(
    draft.requiredResources ?? []
  );
  const uniquePeopleIds = Array.from(new Set(draft.requiredPeopleIds ?? []));

  const nowIso = new Date().toISOString();
  const suffix = `${state.stateVersion + 1}-${Math.floor(Math.random() * 900 + 100)}`;
  const eventId = `evt-${suffix}`;
  const bookingId = `bkg-${suffix}`;

  const newEvent: EventEntity = {
    id: eventId,
    title: draft.title.trim(),
    description: (draft.description ?? "").trim(),
    organizer: (draft.organizer ?? "").trim() || "Campus Organizer",
    category: draft.category,
    priority: draft.priority,
    expectedAttendance: draft.expectedAttendance,
    requiredFacilities: [...(draft.requiredFacilities ?? [])],
    requiredResources: normalizedResources,
    requiredPeopleIds: uniquePeopleIds,
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
