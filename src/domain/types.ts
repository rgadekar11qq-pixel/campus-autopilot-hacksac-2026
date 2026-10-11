export type FacilityType =
  | "PROJECTOR_4K"
  | "WORKBENCHES"
  | "POWER_GRID_HIGH"
  | "PA_AUDIO"
  | "WHITEBOARD_WALL"
  | "RECORDING_RIG"
  | "GPU_WORKSTATIONS"
  | "ACCESSIBLE_STAGE"
  | "HVAC_HEAVY";

export type EventCategory =
  | "WORKSHOP"
  | "HACKATHON_SESSION"
  | "LECTURE"
  | "COMPETITION"
  | "CLUB_MEET"
  | "LAB_PRACTICAL";

export type EventPriority = "CRITICAL" | "HIGH" | "STANDARD" | "LOW";

export type BookingStatus =
  | "DRAFT"
  | "PENDING"
  | "CONFIRMED"
  | "DISRUPTED"
  | "CANCELLED"
  | "COMPLETED";

export type ResourceCondition = "OPTIMAL" | "GOOD" | "MAINTENANCE" | "DAMAGED" | "MISSING";

export type ResourceCategory =
  | "ROBOTICS"
  | "AV_EQUIPMENT"
  | "COMPUTE"
  | "FABRICATION"
  | "INFRASTRUCTURE";

export type AllocationStatus =
  | "RESERVED"
  | "CHECKED_OUT"
  | "RETURNED"
  | "DAMAGED_ON_RETURN"
  | "MISSING_ON_RETURN"
  | "CANCELLED";

export interface Building {
  id: string;
  code: string;
  name: string;
  zone: "NORTH_QUAD" | "CENTRAL_CORE" | "ENGINEERING_WING" | "INNOVATION_HUB";
  walkingMinutesByZone: Record<string, number>;
}

export interface BufferPolicy {
  id: string;
  name: string;
  defaultTurnaroundMinutes: 15 | 30;
  requiresExplicitCleanupCheck: boolean;
  allowAuthorizedOverride: boolean;
}

export interface AvailabilityWindow {
  id: string;
  entityType: "ROOM" | "PERSON" | "RESOURCE";
  entityId: string;
  startIso: string; // ISO string in local campus day representation
  endIso: string;
  status: "UNAVAILABLE" | "MAINTENANCE" | "LOCKED";
  reason: string;
  createdByDisruptionId?: string;
}

export interface Room {
  id: string;
  code: string;
  name: string;
  buildingId: string;
  floor: number;
  capacity: number;
  facilities: FacilityType[];
  bufferPolicyId: string;
  customTurnaroundMinutes?: 15 | 30;
  roomType: "AUDITORIUM" | "MAKER_LAB" | "SEMINAR_HALL" | "LECTURE_THEATER" | "STUDIO";
  notes: string;
}

export interface Resource {
  id: string;
  sku: string;
  name: string;
  category: ResourceCategory;
  totalQuantity: number;
  operationalQuantity: number; // Excludes damaged/missing/maintenance units
  locationRoomId: string;
  condition: ResourceCondition;
  ownerRole: string;
  replacementCostInr: number;
  isExclusiveSingleUnit: boolean;
  notes: string;
}

export interface PersonOrRole {
  id: string;
  name: string;
  roleTitle: string;
  department: string;
  skills: string[];
  email: string;
}

export interface ResourceRequirement {
  resourceId: string;
  quantity: number;
}

export interface EventEntity {
  id: string;
  title: string;
  description: string;
  organizer: string;
  category: EventCategory;
  priority: EventPriority;
  expectedAttendance: number;
  requiredFacilities: FacilityType[];
  requiredResources: ResourceRequirement[];
  requiredPeopleIds: string[];
  setupMinutes: number;
  cleanupMinutes: number;
  requiresExtendedTurnaround?: boolean; // Forces 30-min turnaround
  verifiedAttendance?: number;
  isDemoTarget?: boolean;
}

export interface Booking {
  id: string;
  eventId: string;
  roomId: string;
  /** Event core start time (ISO) */
  startIso: string;
  /** Event core end time (ISO) */
  endIso: string;
  /** Setup start = startIso - setupMinutes */
  setupStartIso: string;
  /** Cleanup end = endIso + cleanupMinutes */
  cleanupEndIso: string;
  /** Effective turnaround end = cleanupEndIso + turnaroundMinutes */
  turnaroundEndIso: string;
  turnaroundMinutes: number;
  status: BookingStatus;
  overrideReason?: string;
  overrideAuthorizedBy?: string;
  createdAtIso: string;
  updatedAtIso: string;
}

export interface ResourceAllocation {
  id: string;
  bookingId: string;
  eventId: string;
  resourceId: string;
  quantity: number;
  startIso: string; // Includes setupStartIso
  endIso: string;   // Includes cleanupEndIso
  status: AllocationStatus;
  returnedQuantity?: number;
  conditionReport?: string;
  updatedAtIso: string;
}

export interface PersonCommitment {
  id: string;
  bookingId: string;
  eventId: string;
  personId: string;
  startIso: string; // Includes setupStartIso
  endIso: string;   // Includes cleanupEndIso
  status: "ASSIGNED" | "CANCELLED";
}

export type DisruptionType =
  | "ROOM_UNAVAILABLE"
  | "ATTENDANCE_SURGE"
  | "EQUIPMENT_UNAVAILABLE"
  | "MENTOR_UNAVAILABLE"
  | "TIME_SHIFT"
  | "BOOKING_CANCELLED";

export interface Disruption {
  id: string;
  type: DisruptionType;
  title: string;
  description: string;
  targetEventId?: string;
  targetRoomId?: string;
  targetResourceId?: string;
  targetPersonId?: string;
  unavailableStartIso?: string;
  unavailableEndIso?: string;
  newAttendance?: number;
  reducedResourceQty?: number;
  shiftedStartIso?: string;
  shiftedEndIso?: string;
  createdAtIso: string;
}

export interface ConstraintViolation {
  code:
    | "ROOM_UNAVAILABLE_WINDOW"
    | "ROOM_OVERLAP_CONFLICT"
    | "TURNAROUND_BUFFER_VIOLATION"
    | "SETUP_CLEANUP_CONFLICT"
    | "CAPACITY_INSUFFICIENT"
    | "MISSING_FACILITY"
    | "RESOURCE_INSUFFICIENT"
    | "RESOURCE_UNAVAILABLE"
    | "PERSON_OVERLAP"
    | "PERSON_UNAVAILABLE"
    | "INVALID_INTERVAL";
  severity: "HARD";
  entityId: string;
  entityName: string;
  message: string;
}

export interface FeasibilityResult {
  status: "FEASIBLE" | "ALTERNATIVES_AVAILABLE" | "NO_FEASIBLE_PLAN";
  isFeasible: boolean;
  violations: ConstraintViolation[];
  suitabilityReasons: string[];
  computedIntervals: {
    setupStartIso: string;
    startIso: string;
    endIso: string;
    cleanupEndIso: string;
    turnaroundEndIso: string;
    turnaroundMinutes: number;
  };
}

export interface PlanDeltaChange {
  field: "ROOM" | "TIME" | "MENTORS" | "RESOURCES" | "DISPLACED_BOOKING";
  label: string;
  before: string;
  after: string;
  impactSeverity: "NONE" | "LOW" | "MODERATE";
}

export interface ScoreBreakdown {
  totalScore: number; // 0 - 100
  timePreservationScore: number; // Max 30
  zeroDisplacementScore: number; // Max 25
  capacityFitScore: number;      // Max 15
  proximityScore: number;        // Max 15
  resourceReuseScore: number;    // Max 15
  rankingReasons: string[];
  tradeoffs: string[];
}

export interface SecondaryBookingRelocation {
  bookingId: string;
  eventId: string;
  eventTitle: string;
  fromRoomId: string;
  toRoomId: string;
  fromStartIso: string;
  fromEndIso: string;
  toStartIso: string;
  toEndIso: string;
}

export interface CandidatePlan {
  id: string;
  disruptionId: string;
  targetEventId: string;
  targetBookingId: string;
  label: string;
  strategyType:
    | "SAME_TIME_ALT_ROOM"
    | "SAME_TIME_ALT_ROOM_WITH_MENTOR_SWAP"
    | "TIME_SHIFT_SAME_OR_ALT_ROOM"
    | "CASCADE_RELOCATION";
  proposedRoomId: string;
  proposedStartIso: string;
  proposedEndIso: string;
  proposedSetupStartIso: string;
  proposedCleanupEndIso: string;
  proposedTurnaroundEndIso: string;
  proposedTurnaroundMinutes: number;
  proposedPeopleIds: string[];
  proposedResources: ResourceRequirement[];
  secondaryRelocations: SecondaryBookingRelocation[];
  hardConstraintPassed: boolean;
  score: ScoreBreakdown;
  deltas: PlanDeltaChange[];
  estimatedCostAvoidedInr: number;
  stateVersionAtGeneration: number;
}

export interface RejectedCandidateExplanation {
  id: string;
  attemptedLabel: string;
  roomId: string;
  roomName: string;
  startIso: string;
  endIso: string;
  violations: ConstraintViolation[];
}

export interface ShockwaveSimulationResult {
  disruption: Disruption;
  stateVersion: number;
  directlyAffectedEventIds: string[];
  indirectlyAffectedEventIds: string[];
  affectedResourceIds: string[];
  affectedPeopleIds: string[];
  originalViolations: ConstraintViolation[];
  validCandidates: CandidatePlan[];
  rejectedAttempts: RejectedCandidateExplanation[];
  summaryExplanation: string;
}

export interface ApprovalRecord {
  id: string;
  disruptionId: string;
  candidatePlanId: string;
  approvedBy: string;
  approvedAtIso: string;
  targetEventId: string;
  beforeSnapshot: {
    roomId: string;
    roomName: string;
    startIso: string;
    endIso: string;
    peopleIds: string[];
  };
  afterSnapshot: {
    roomId: string;
    roomName: string;
    startIso: string;
    endIso: string;
    peopleIds: string[];
  };
  deltas: PlanDeltaChange[];
  secondaryRelocations: SecondaryBookingRelocation[];
}

export type AuditActionType =
  | "BOOKING_CREATED"
  | "BOOKING_CONFIRMED"
  | "BOOKING_CANCELLED"
  | "RESOURCE_ALLOCATED"
  | "RESOURCE_RETURNED"
  | "RESOURCE_CONDITION_UPDATED"
  | "DISRUPTION_SIMULATED"
  | "PLAN_APPROVED"
  | "ALLOCATION_CHANGED"
  | "VALIDATION_FAILED"
  | "DEMO_SCENARIO_RESET"
  | "DEMO_WORKSHOP_BOOKED";

export interface AuditLogEntry {
  id: string;
  timestampIso: string;
  action: AuditActionType;
  entityType: "EVENT" | "BOOKING" | "ROOM" | "RESOURCE" | "SHOCKWAVE" | "SYSTEM";
  entityId: string;
  entityName: string;
  result: "SUCCESS" | "REJECTED" | "WARNING" | "SIMULATED";
  reason: string;
  actor: string;
  isSimulatedEnvironment: true;
}

export interface BookingDraftInput {
  title: string;
  description: string;
  organizer: string;
  category: EventCategory;
  priority: EventPriority;
  dateStr: string; // YYYY-MM-DD
  startTimeStr: string; // HH:mm
  durationMinutes: number;
  expectedAttendance: number;
  preferredRoomId: string;
  requiredFacilities: FacilityType[];
  requiredResources: ResourceRequirement[];
  requiredPeopleIds: string[];
  setupMinutes: number;
  cleanupMinutes: number;
  requiresExtendedTurnaround: boolean;
  overrideTurnaroundReason?: string;
}

export interface ApplicationState {
  schemaVersion: number;
  stateVersion: number;
  campusDate: string; // Primary operational date YYYY-MM-DD
  buildings: Building[];
  bufferPolicies: BufferPolicy[];
  rooms: Room[];
  resources: Resource[];
  people: PersonOrRole[];
  events: EventEntity[];
  bookings: Booking[];
  resourceAllocations: ResourceAllocation[];
  personCommitments: PersonCommitment[];
  availabilityWindows: AvailabilityWindow[];
  approvals: ApprovalRecord[];
  auditLog: AuditLogEntry[];
}
