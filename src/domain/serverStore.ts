import {
  AllocationStatus,
  ApplicationState,
  BookingDraftInput,
  CandidatePlan,
  Disruption,
} from "./types";
import { createInitialSeedState, DEMO_PRIMARY_DATE } from "./seedData";
import {
  computeOperationalMetrics,
  createValidatedBooking,
} from "./engine";
import {
  approveCandidatePlan,
  rejectShockwaveProposal,
  simulateShockwave,
} from "./shockwave";
import {
  cancelBookingById,
  resetDemoScenarioOnly,
  updateAllocationReturnStatus,
} from "./operations";

export interface ApiActionResponse {
  status: number;
  body: Record<string, unknown>;
}

/**
 * Isolated, transactional in-memory state store with optimistic concurrency control (stateVersion).
 * Can be instantiated per test or shared as a singleton by the Next.js API route.
 */
export class TransactionalCampusStore {
  private state: ApplicationState;

  constructor(initialState?: ApplicationState) {
    this.state = initialState
      ? structuredClone(initialState)
      : createInitialSeedState();
  }

  public getState(): ApplicationState {
    return structuredClone(this.state);
  }

  public executeAction(payload: unknown): ApiActionResponse {
    if (!payload || typeof payload !== "object") {
      return {
        status: 400,
        body: {
          ok: false,
          errorCode: "MALFORMED_PAYLOAD",
          message: "Request body must be a valid JSON object.",
        },
      };
    }

    const req = payload as Record<string, unknown>;
    const action = req.action;

    if (typeof action !== "string" || !action.trim()) {
      return {
        status: 400,
        body: {
          ok: false,
          errorCode: "MISSING_ACTION",
          message: "A valid 'action' string is required.",
        },
      };
    }

    // Optimistic concurrency check if expectedStateVersion is provided
    if (typeof req.expectedStateVersion === "number") {
      if (req.expectedStateVersion !== this.state.stateVersion) {
        return {
          status: 409,
          body: {
            ok: false,
            errorCode: "CONCURRENCY_CONFLICT",
            message: `State version mismatch: expected v${req.expectedStateVersion}, but authoritative state is at v${this.state.stateVersion}. Competing request modified state first.`,
            currentStateVersion: this.state.stateVersion,
          },
        };
      }
    }

    switch (action) {
      case "CREATE_BOOKING": {
        const draft = req.draft as BookingDraftInput | undefined;
        if (!draft || typeof draft !== "object") {
          return {
            status: 400,
            body: {
              ok: false,
              errorCode: "INVALID_DRAFT",
              message: "Missing or malformed 'draft' object for CREATE_BOOKING.",
            },
          };
        }

        const res = createValidatedBooking(
          this.state,
          draft,
          typeof req.actor === "string" ? req.actor : "API Client"
        );

        if (!res.ok) {
          return {
            status: 422,
            body: {
              ok: false,
              errorCode: "CONSTRAINT_VIOLATION",
              feasibility: res.feasibility,
              message:
                res.feasibility.violations[0]?.message ??
                "Booking violates hard constraints.",
            },
          };
        }

        this.state = res.nextState;
        return {
          status: 201,
          body: {
            ok: true,
            bookingId: res.bookingId,
            eventId: res.eventId,
            stateVersion: this.state.stateVersion,
            state: this.getState(),
          },
        };
      }

      case "CANCEL_BOOKING": {
        const bookingId = req.bookingId;
        if (typeof bookingId !== "string" || !bookingId.trim()) {
          return {
            status: 400,
            body: {
              ok: false,
              errorCode: "INVALID_BOOKING_ID",
              message: "Valid 'bookingId' string is required.",
            },
          };
        }

        const existing = this.state.bookings.find((b) => b.id === bookingId);
        if (!existing) {
          return {
            status: 404,
            body: {
              ok: false,
              errorCode: "BOOKING_NOT_FOUND",
              message: `Booking '${bookingId}' does not exist.`,
            },
          };
        }

        if (existing.status === "CANCELLED") {
          return {
            status: 409,
            body: {
              ok: false,
              errorCode: "ALREADY_CANCELLED",
              message: `Booking '${bookingId}' is already cancelled.`,
            },
          };
        }

        this.state = cancelBookingById(
          this.state,
          bookingId,
          typeof req.reason === "string" ? req.reason : "Cancelled via API"
        );
        return {
          status: 200,
          body: {
            ok: true,
            stateVersion: this.state.stateVersion,
            state: this.getState(),
          },
        };
      }

      case "SIMULATE_SHOCKWAVE": {
        const disruption = req.disruption as Disruption | undefined;
        if (
          !disruption ||
          typeof disruption !== "object" ||
          typeof disruption.id !== "string" ||
          typeof disruption.type !== "string"
        ) {
          return {
            status: 400,
            body: {
              ok: false,
              errorCode: "INVALID_DISRUPTION",
              message: "Valid 'disruption' object with id and type is required.",
            },
          };
        }

        // Simulation NEVER mutates this.state
        const simResult = simulateShockwave(this.state, disruption);
        return {
          status: 200,
          body: {
            ok: true,
            simulation: simResult,
            stateVersion: this.state.stateVersion,
          },
        };
      }

      case "APPROVE_CANDIDATE": {
        const disruption = req.disruption as Disruption | undefined;
        const candidate = req.candidate as CandidatePlan | undefined;
        if (!disruption || !candidate) {
          return {
            status: 400,
            body: {
              ok: false,
              errorCode: "MISSING_APPROVAL_INPUT",
              message: "Both 'disruption' and 'candidate' objects are required.",
            },
          };
        }

        const res = approveCandidatePlan(
          this.state,
          disruption,
          candidate,
          typeof req.approvedBy === "string"
            ? req.approvedBy
            : "STRATOS Operations Director"
        );

        if (!res.ok) {
          const isStaleOrDup =
            res.error.includes("Stale") || res.error.includes("Duplicate");
          return {
            status: isStaleOrDup ? 409 : 422,
            body: {
              ok: false,
              errorCode: isStaleOrDup
                ? "STALE_OR_DUPLICATE_APPROVAL"
                : "APPROVAL_VALIDATION_FAILED",
              message: res.error,
            },
          };
        }

        this.state = res.nextState;
        return {
          status: 200,
          body: {
            ok: true,
            approvalRecord: res.approvalRecord,
            stateVersion: this.state.stateVersion,
            state: this.getState(),
          },
        };
      }

      case "REJECT_SHOCKWAVE": {
        const disruption = req.disruption as Disruption | undefined;
        if (!disruption || typeof disruption.id !== "string") {
          return {
            status: 400,
            body: {
              ok: false,
              errorCode: "INVALID_DISRUPTION",
              message: "Valid 'disruption' object is required.",
            },
          };
        }

        const res = rejectShockwaveProposal(this.state, disruption);
        return {
          status: 200,
          body: {
            ok: true,
            rejectedDisruptionId: res.rejectedDisruptionId,
            stateVersion: this.state.stateVersion,
          },
        };
      }

      case "UPDATE_ALLOCATION_RETURN": {
        const allocationId = req.allocationId;
        const newStatus = req.newStatus as AllocationStatus | undefined;
        if (
          typeof allocationId !== "string" ||
          typeof newStatus !== "string"
        ) {
          return {
            status: 400,
            body: {
              ok: false,
              errorCode: "INVALID_RETURN_INPUT",
              message: "'allocationId' and 'newStatus' are required.",
            },
          };
        }

        const alloc = this.state.resourceAllocations.find(
          (a) => a.id === allocationId
        );
        if (!alloc) {
          return {
            status: 404,
            body: {
              ok: false,
              errorCode: "ALLOCATION_NOT_FOUND",
              message: `Allocation '${allocationId}' does not exist.`,
            },
          };
        }

        const prevVersion = this.state.stateVersion;
        const nextState = updateAllocationReturnStatus(
          this.state,
          allocationId,
          newStatus,
          typeof req.conditionNote === "string"
            ? req.conditionNote
            : "Updated via API",
          typeof req.damagedOrMissingUnits === "number"
            ? req.damagedOrMissingUnits
            : 0
        );

        if (nextState.stateVersion === prevVersion) {
          return {
            status: 409,
            body: {
              ok: false,
              errorCode: "INVALID_ALLOCATION_TRANSITION",
              message: `Allocation '${allocationId}' cannot transition from '${alloc.status}' to '${newStatus}'.`,
            },
          };
        }

        this.state = nextState;
        return {
          status: 200,
          body: {
            ok: true,
            stateVersion: this.state.stateVersion,
            state: this.getState(),
          },
        };
      }

      case "RESET_DEMO": {
        this.state = resetDemoScenarioOnly(this.state);
        return {
          status: 200,
          body: {
            ok: true,
            stateVersion: this.state.stateVersion,
            state: this.getState(),
          },
        };
      }

      case "FACTORY_RESET": {
        this.state = createInitialSeedState();
        return {
          status: 200,
          body: {
            ok: true,
            stateVersion: this.state.stateVersion,
            state: this.getState(),
          },
        };
      }

      default:
        return {
          status: 400,
          body: {
            ok: false,
            errorCode: "UNKNOWN_ACTION",
            message: `Unsupported action '${action}'.`,
          },
        };
    }
  }

  public getSnapshotWithMetrics(dateStr = DEMO_PRIMARY_DATE) {
    const current = this.getState();
    return {
      ok: true,
      stateVersion: current.stateVersion,
      metrics: computeOperationalMetrics(current, dateStr),
      state: current,
    };
  }
}

export const globalCampusStore = new TransactionalCampusStore();
