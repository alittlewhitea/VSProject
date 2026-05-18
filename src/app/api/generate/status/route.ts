import { NextResponse } from "next/server";
import { getUserFromBearerToken } from "../../../../lib/server-auth";
import { createSupabaseAdminClient } from "../../../../lib/supabase-admin";
import { fetchFal } from "../../../../lib/fal-fetch";
import { refundCredits } from "../../../../lib/credits";

function isAllowedFalUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.protocol === "https:" && parsed.hostname === "queue.fal.run";
  } catch {
    return false;
  }
}

export async function GET(request: Request) {
  try {
    const user = await getUserFromBearerToken(request.headers.get("authorization"));
    if (!user) {
      return NextResponse.json({ error: "Unauthorized. Invalid or missing Supabase access token." }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const statusUrl = searchParams.get("statusUrl");
    const responseUrl = searchParams.get("responseUrl");
    const taskId = searchParams.get("taskId");
    const mockStatus = searchParams.get("mockStatus");

    if (mockStatus) {
      if (!taskId) {
        return NextResponse.json({ error: "taskId is required for mock status updates." }, { status: 400 });
      }
      if (mockStatus !== "completed" && mockStatus !== "failed") {
        return NextResponse.json({ error: "Invalid mockStatus." }, { status: 400 });
      }

      const admin = createSupabaseAdminClient();
      if (!admin) {
        return NextResponse.json({ error: "Storage is not configured." }, { status: 500 });
      }

      const { data: task, error: taskError } = await admin
        .from("generation_tasks")
        .select("estimated_credits, transport")
        .eq("id", taskId)
        .eq("user_id", user.id)
        .maybeSingle();

      if (taskError) {
        return NextResponse.json({ error: taskError.message }, { status: 500 });
      }
      if (!task) {
        return NextResponse.json({ error: "Task not found." }, { status: 404 });
      }
      if ((task as { transport?: string }).transport !== "mock") {
        return NextResponse.json({ error: "mockStatus can only update mock tasks." }, { status: 400 });
      }

      let balance: number | null = null;
      const estimatedCredits =
        typeof (task as { estimated_credits?: unknown }).estimated_credits === "number"
          ? (task as { estimated_credits: number }).estimated_credits
          : 0;

      if (mockStatus === "failed" && estimatedCredits > 0) {
        balance = await refundCredits(admin, user.id, estimatedCredits, "generation_refund", taskId);
      }

      await admin
        .from("generation_tasks")
        .update({
          status: mockStatus,
          updated_at: new Date().toISOString(),
          raw_result: {
            transport: "mock",
            status: mockStatus
          }
        })
        .eq("id", taskId)
        .eq("user_id", user.id)
        .throwOnError();

      return NextResponse.json({
        status: mockStatus.toUpperCase(),
        result: null,
        balance
      });
    }

    const falKey = process.env.FAL_KEY;
    if (!falKey) {
      return NextResponse.json({ error: "FAL_KEY is not configured." }, { status: 400 });
    }

    if (!statusUrl || !isAllowedFalUrl(statusUrl)) {
      return NextResponse.json({ error: "Invalid statusUrl." }, { status: 400 });
    }

    const statusRes = await fetchFal(statusUrl, {
      attempts: 2,
      timeoutMs: 15000,
      headers: {
        Authorization: `Key ${falKey}`
      },
      cache: "no-store"
    });

    if (!statusRes.ok) {
      return NextResponse.json({ error: `Status check failed (${statusRes.status}).` }, { status: 502 });
    }

    const statusPayload = (await statusRes.json()) as {
      status?: string;
    };
    const upperStatus = (statusPayload.status || "IN_QUEUE").toUpperCase();

    let result: unknown = null;
    if (upperStatus === "COMPLETED" && responseUrl && isAllowedFalUrl(responseUrl)) {
      const resultRes = await fetchFal(responseUrl, {
        attempts: 2,
        timeoutMs: 20000,
        headers: {
          Authorization: `Key ${falKey}`
        },
        cache: "no-store"
      });
      if (resultRes.ok) {
        result = await resultRes.json();
      }
    }

    if (taskId) {
      const admin = createSupabaseAdminClient();
      if (admin) {
        const mediaUrl = extractMediaUrl(result);
        const normalized =
          upperStatus === "IN_QUEUE"
            ? "queued"
            : upperStatus === "IN_PROGRESS"
              ? "running"
              : upperStatus === "COMPLETED"
                ? "completed"
                : "failed";

        try {
          if (normalized === "failed") {
            const { data: task } = await admin
              .from("generation_tasks")
              .select("estimated_credits")
              .eq("id", taskId)
              .eq("user_id", user.id)
              .maybeSingle();
            const estimatedCredits =
              task && typeof task === "object" && typeof (task as { estimated_credits?: unknown }).estimated_credits === "number"
                ? (task as { estimated_credits: number }).estimated_credits
                : 0;
            if (estimatedCredits > 0) {
              await refundCredits(admin, user.id, estimatedCredits, "generation_refund", taskId);
            }
          }

          await admin
            .from("generation_tasks")
            .update({
              status: normalized,
              output_url: mediaUrl,
              raw_result: result,
              updated_at: new Date().toISOString()
            })
            .eq("id", taskId)
            .eq("user_id", user.id)
            .throwOnError();
        } catch {
          // The provider result is still useful even if local task history cannot be updated.
        }
      }
    }

    return NextResponse.json({
      status: upperStatus,
      result
    });
  } catch {
    return NextResponse.json({ error: "Unable to fetch fal.ai task status." }, { status: 500 });
  }
}

function extractMediaUrl(result: unknown): string | null {
  if (!result || typeof result !== "object") return null;
  const payload = result as Record<string, unknown>;
  if (typeof payload.url === "string") return payload.url;
  if (Array.isArray(payload.images) && payload.images[0] && typeof payload.images[0] === "object") {
    const first = payload.images[0] as Record<string, unknown>;
    if (typeof first.url === "string") return first.url;
  }
  if (payload.video && typeof payload.video === "object") {
    const video = payload.video as Record<string, unknown>;
    if (typeof video.url === "string") return video.url;
  }
  if (Array.isArray(payload.videos) && payload.videos[0] && typeof payload.videos[0] === "object") {
    const first = payload.videos[0] as Record<string, unknown>;
    if (typeof first.url === "string") return first.url;
  }
  return null;
}

