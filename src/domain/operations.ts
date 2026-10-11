import {
  ApplicationState,
  AllocationStatus,
  ResourceCondition,
} from "./types";
import { createInitialSeedState } from "./seedData";

export const STORAGE_KEY = "campus_autopilot_state_v2";

export function loadPersistedState(
  storage?: Pick<Storage, "getItem" | "setItem">
): ApplicationState {
  const store =
    storage ?? (typeof window !== "undefined" ? window.localStorage : undefined);
  if (!store) return createInitialSeedState();

  try {
    const raw = store.getItem(STORAGE_KEY);
    if (!raw) return createInitialSeedState();
    const parsed = JSON.parse(raw) as Partial<ApplicationState>;
    if (
      !parsed ||
      parsed.schemaVersion !== 2 ||
      !Array.isArray(parsed.rooms) ||
      !Array.isArray(parsed.bookings) ||
      !Array.isArray(parsed.events) ||
      !Array.isArray(parsed.resources)
    ) {
      return createInitialSeedState();
    }
    return parsed as ApplicationState;
  } catch {
    return createInitialSeedState();
  }
}

export function savePersistedState(
  state: ApplicationState,
  storage?: Pick<Storage, "setItem">
): boolean {
  const store =
    storage ?? (typeof window !== "undefined" ? window.localStorage : undefined);
  if (!store) return false;
  try {
    store.setItem(STORAGE_KEY, JSON.stringify(state));
    return true;
  } catch {
    return false;
  }
}

/**
 * Resets the Robotics Workshop demo scenario back to its exact baseline booking in Turing Innovation Hall
 * without wiping unrelated user-created bookings or custom inventory records.
 */
export function resetDemoScenarioOnly(
  currentState: ApplicationState
): ApplicationState {
  const baseline = createInitialSeedState();
  const next = structuredClone(currentState);
  const nowIso = new Date().toISOString();

  // Remove any disruption availability windows
  next.availabilityWindows = next.availabilityWindows.filter(
    (w) => !w.createdByDisruptionId
  );

  // Restore baseline operational quantities for demo resources
  for (const baseRes of baseline.resources) {
    const targetRes = next.resources.find((r) => r.id === baseRes.id);
    if (targetRes) {
      targetRes.operationalQuantity = baseRes.operationalQuantity;
      targetRes.condition = baseRes.condition;
    }
  }

  // Restore evt-robotics-workshop
  const baseWorkshopEvent = baseline.events.find(
    (e) => e.id === "evt-robotics-workshop"
  )!;
  const existingEvIdx = next.events.findIndex(
    (e) => e.id === "evt-robotics-workshop"
  );
  if (existingEvIdx >= 0) {
    next.events[existingEvIdx] = structuredClone(baseWorkshopEvent);
  } else {
    next.events.unshift(structuredClone(baseWorkshopEvent));
  }

  // Restore bkg-robotics-workshop
  const baseWorkshopBkg = baseline.bookings.find(
    (b) => b.id === "bkg-robotics-workshop"
  )!;
  const existingBkgIdx = next.bookings.findIndex(
    (b) =>
      b.id === "bkg-robotics-workshop" ||
      b.eventId === "evt-robotics-workshop"
  );
  if (existingBkgIdx >= 0) {
    next.bookings[existingBkgIdx] = structuredClone(baseWorkshopBkg);
  } else {
    next.bookings.push(structuredClone(baseWorkshopBkg));
  }

  // Restore allocations for bkg-robotics-workshop
  next.resourceAllocations = next.resourceAllocations.filter(
    (a) =>
      a.bookingId !== "bkg-robotics-workshop" &&
      a.eventId !== "evt-robotics-workshop"
  );
  const baseAllocs = baseline.resourceAllocations.filter(
    (a) => a.bookingId === "bkg-robotics-workshop"
  );
  next.resourceAllocations.push(...structuredClone(baseAllocs));

  // Restore person commitments for bkg-robotics-workshop
  next.personCommitments = next.personCommitments.filter(
    (p) =>
      p.bookingId !== "bkg-robotics-workshop" &&
      p.eventId !== "evt-robotics-workshop"
  );
  const baseCommitments = baseline.personCommitments.filter(
    (p) => p.bookingId === "bkg-robotics-workshop"
  );
  next.personCommitments.push(...structuredClone(baseCommitments));

  next.stateVersion = currentState.stateVersion + 1;
  next.auditLog = [
    {
      id: `aud-reset-${next.stateVersion}`,
      timestampIso: nowIso,
      action: "DEMO_SCENARIO_RESET",
      entityType: "SYSTEM",
      entityId: "evt-robotics-workshop",
      entityName: "Autonomous Robotics Systems Workshop Baseline",
      result: "SUCCESS",
      reason:
        "Restored Robotics Workshop to INV-101 Turing Innovation Hall (11:00–12:30) and cleared simulated disruption locks while preserving unrelated campus records.",
      actor: "Demo Presenter",
      isSimulatedEnvironment: true,
    },
    ...next.auditLog,
  ];

  return next;
}

/**
 * Clears only the Robotics Workshop booking so the presenter can demonstrate creating & validating it live from Step 1,
 * while keeping all other campus bookings intact.
 */
export function prepareUnbookedRoboticsDemo(
  currentState: ApplicationState
): ApplicationState {
  const next = resetDemoScenarioOnly(currentState);
  next.bookings = next.bookings.filter(
    (b) => b.eventId !== "evt-robotics-workshop"
  );
  next.resourceAllocations = next.resourceAllocations.filter(
    (a) => a.eventId !== "evt-robotics-workshop"
  );
  next.personCommitments = next.personCommitments.filter(
    (p) => p.eventId !== "evt-robotics-workshop"
  );
  next.events = next.events.filter(
    (e) => e.id !== "evt-robotics-workshop"
  );
  next.stateVersion = currentState.stateVersion + 1;
  return next;
}

export function cancelBookingById(
  state: ApplicationState,
  bookingId: string,
  reason = "Cancelled by organizer",
  actor = "Campus Organizer"
): ApplicationState {
  const bkgCheck = state.bookings.find((b) => b.id === bookingId);
  if (!bkgCheck || bkgCheck.status === "CANCELLED") {
    return state;
  }

  const next = structuredClone(state);
  const bkg = next.bookings.find((b) => b.id === bookingId)!;
  const ev = next.events.find((e) => e.id === bkg.eventId);
  const nowIso = new Date().toISOString();

  bkg.status = "CANCELLED";
  bkg.updatedAtIso = nowIso;

  for (const alloc of next.resourceAllocations) {
    if (alloc.bookingId === bookingId && alloc.status !== "RETURNED") {
      alloc.status = "CANCELLED";
      alloc.updatedAtIso = nowIso;
    }
  }
  for (const pcm of next.personCommitments) {
    if (pcm.bookingId === bookingId) {
      pcm.status = "CANCELLED";
    }
  }

  next.stateVersion = state.stateVersion + 1;
  next.auditLog = [
    {
      id: `aud-cancel-${next.stateVersion}`,
      timestampIso: nowIso,
      action: "BOOKING_CANCELLED",
      entityType: "BOOKING",
      entityId: bookingId,
      entityName: ev?.title ?? bookingId,
      result: "SUCCESS",
      reason: `${reason}. Released room and associated equipment/mentor allocations.`,
      actor,
      isSimulatedEnvironment: true,
    },
    ...next.auditLog,
  ];

  return next;
}

export function updateAllocationReturnStatus(
  state: ApplicationState,
  allocationId: string,
  newStatus: AllocationStatus,
  conditionNote: string,
  damagedOrMissingUnits = 0,
  actor = "Lab Custodian"
): ApplicationState {
  const existingAlloc = state.resourceAllocations.find(
    (a) => a.id === allocationId
  );
  if (!existingAlloc) return state;

  // Guard against returning an already returned/closed/cancelled allocation
  const parentBooking = state.bookings.find(
    (b) => b.id === existingAlloc.bookingId
  );
  if (
    existingAlloc.status === "RETURNED" ||
    existingAlloc.status === "DAMAGED_ON_RETURN" ||
    existingAlloc.status === "MISSING_ON_RETURN" ||
    existingAlloc.status === "CANCELLED" ||
    parentBooking?.status === "CANCELLED"
  ) {
    return state;
  }

  // Only allow valid return/checkout transition targets
  if (
    newStatus !== "RETURNED" &&
    newStatus !== "DAMAGED_ON_RETURN" &&
    newStatus !== "MISSING_ON_RETURN" &&
    newStatus !== "CHECKED_OUT"
  ) {
    return state;
  }

  const next = structuredClone(state);
  const alloc = next.resourceAllocations.find((a) => a.id === allocationId)!;
  const resource = next.resources.find((r) => r.id === alloc.resourceId);
  const nowIso = new Date().toISOString();

  alloc.status = newStatus;
  alloc.conditionReport = conditionNote;
  alloc.updatedAtIso = nowIso;

  if (newStatus === "RETURNED") {
    alloc.returnedQuantity = alloc.quantity;
  } else if (
    (newStatus === "DAMAGED_ON_RETURN" || newStatus === "MISSING_ON_RETURN") &&
    resource
  ) {
    const affected = Math.max(
      1,
      Math.min(alloc.quantity, Math.floor(damagedOrMissingUnits || 1))
    );
    alloc.returnedQuantity = Math.max(0, alloc.quantity - affected);
    resource.operationalQuantity = Math.max(
      0,
      resource.operationalQuantity - affected
    );
    if (resource.operationalQuantity === 0) {
      resource.condition =
        newStatus === "DAMAGED_ON_RETURN" ? "DAMAGED" : "MISSING";
    }
  }

  next.stateVersion = state.stateVersion + 1;
  next.auditLog = [
    {
      id: `aud-alloc-${next.stateVersion}`,
      timestampIso: nowIso,
      action:
        newStatus === "RETURNED"
          ? "RESOURCE_RETURNED"
          : "RESOURCE_CONDITION_UPDATED",
      entityType: "RESOURCE",
      entityId: resource?.id ?? alloc.resourceId,
      entityName: `${resource?.name ?? alloc.resourceId} (×${alloc.quantity})`,
      result: newStatus === "RETURNED" ? "SUCCESS" : "WARNING",
      reason: `${newStatus.replace(/_/g, " ")}: ${conditionNote}`,
      actor,
      isSimulatedEnvironment: true,
    },
    ...next.auditLog,
  ];

  return next;
}

export function updateResourceConditionDirect(
  state: ApplicationState,
  resourceId: string,
  condition: ResourceCondition,
  operationalQuantity: number,
  reason: string,
  actor = "Inventory Manager"
): ApplicationState {
  if (!Number.isFinite(operationalQuantity)) return state;
  const next = structuredClone(state);
  const resource = next.resources.find((r) => r.id === resourceId);
  if (!resource) return state;

  const clampedQty = Math.max(
    0,
    Math.min(resource.totalQuantity, Math.floor(operationalQuantity))
  );
  resource.condition = condition;
  resource.operationalQuantity = clampedQty;

  const nowIso = new Date().toISOString();
  next.stateVersion = state.stateVersion + 1;
  next.auditLog = [
    {
      id: `aud-res-${next.stateVersion}`,
      timestampIso: nowIso,
      action: "RESOURCE_CONDITION_UPDATED",
      entityType: "RESOURCE",
      entityId: resource.id,
      entityName: resource.name,
      result: condition === "OPTIMAL" || condition === "GOOD" ? "SUCCESS" : "WARNING",
      reason: `Updated status to ${condition} (${clampedQty}/${resource.totalQuantity} operational): ${reason}`,
      actor,
      isSimulatedEnvironment: true,
    },
    ...next.auditLog,
  ];

  return next;
}
