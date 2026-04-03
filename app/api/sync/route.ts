import { NextRequest, NextResponse } from "next/server";
import { syncArticles } from "@/lib/sync";

export async function GET(request: NextRequest) {
  // Verify cron secret for production security
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Optional limit parameter for testing (e.g. /api/sync?limit=3)
  const limit = parseInt(request.nextUrl.searchParams.get("limit") || "0") || 0;

  try {
    const result = await syncArticles(limit);
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { error: `Sync failed: ${error}` },
      { status: 500 }
    );
  }
}

export const maxDuration = 300; // 5 minutes for translation
