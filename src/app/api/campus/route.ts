import { NextRequest, NextResponse } from "next/server";
import { globalCampusStore } from "@/domain/serverStore";
import { DEMO_PRIMARY_DATE } from "@/domain/seedData";

export async function GET(request: NextRequest) {
  const dateParam =
    request.nextUrl.searchParams.get("date") ?? DEMO_PRIMARY_DATE;
  const snapshot = globalCampusStore.getSnapshotWithMetrics(dateParam);
  return NextResponse.json(snapshot, { status: 200 });
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const result = globalCampusStore.executeAction(body);
    return NextResponse.json(result.body, { status: result.status });
  } catch {
    return NextResponse.json(
      {
        ok: false,
        errorCode: "INVALID_JSON",
        message: "Request body could not be parsed as valid JSON.",
      },
      { status: 400 }
    );
  }
}
