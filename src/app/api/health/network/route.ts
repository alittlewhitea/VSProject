import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { fetchFal } from "../../../../lib/fal-fetch";
import { mysqlExecute } from "../../../../lib/mysql";
import { cronAuthorized } from "../../../../lib/cron-auth";
import { getAdminEmails } from "../../../../lib/admin-auth";
import { getSessionFromToken, SESSION_COOKIE_NAME } from "../../../../lib/server-auth";

export const dynamic = "force-dynamic";

type CheckResult = {
  target: string;
  ok: boolean;
  reachable: boolean;
  status: number | null;
  error: string | null;
  note?: string;
};

async function checkUrl(target: string, init?: RequestInit & { okStatuses?: number[]; note?: string }): Promise<CheckResult> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 6000);
    const { okStatuses, note, ...requestInit } = init || {};
    const res = await fetch(target, {
      method: "GET",
      cache: "no-store",
      signal: controller.signal,
      ...requestInit
    });
    clearTimeout(timer);
    const ok = okStatuses ? okStatuses.includes(res.status) : res.ok;
    return {
      target,
      ok,
      reachable: true,
      status: res.status,
      error: null,
      note
    };
  } catch (error) {
    return {
      target,
      ok: false,
      reachable: false,
      status: null,
      error: error instanceof Error ? error.message : "fetch failed"
    };
  }
}

async function checkFalUrl(target: string, init?: RequestInit & { okStatuses?: number[]; note?: string }): Promise<CheckResult> {
  try {
    const { okStatuses, note, ...requestInit } = init || {};
    const res = await fetchFal(target, {
      method: "GET",
      cache: "no-store",
      attempts: 2,
      timeoutMs: 9000,
      ...requestInit
    });
    const ok = okStatuses ? okStatuses.includes(res.status) : res.ok;
    return {
      target,
      ok,
      reachable: true,
      status: res.status,
      error: null,
      note
    };
  } catch (error) {
    return {
      target,
      ok: false,
      reachable: false,
      status: null,
      error: error instanceof Error ? error.message : "fetch failed"
    };
  }
}

async function checkMysql(): Promise<CheckResult> {
  try {
    await mysqlExecute("select 1 as ok");
    return {
      target: process.env.MYSQL_HOST ? `mysql:${process.env.MYSQL_HOST}` : "mysql-env-missing",
      ok: true,
      reachable: true,
      status: null,
      error: null
    };
  } catch (error) {
    return {
      target: process.env.MYSQL_HOST ? `mysql:${process.env.MYSQL_HOST}` : "mysql-env-missing",
      ok: false,
      reachable: false,
      status: null,
      error: error instanceof Error ? error.message : "MySQL check failed"
    };
  }
}

export async function GET(request: Request) {
  const session = await getSessionFromToken((await cookies()).get(SESSION_COOKIE_NAME)?.value);
  const email = session?.user.email?.trim().toLowerCase();
  const adminAuthorized = Boolean(email && getAdminEmails().includes(email));
  if (!adminAuthorized && !cronAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const falKey = process.env.FAL_KEY?.trim();
  const falModels = Array.from(
    new Set(
      [
        process.env.FAL_MODEL_IMAGE_DEFAULT,
        process.env.FAL_MODEL_IMAGE_CHATGPT,
        process.env.FAL_MODEL_IMAGE_FLUX,
        process.env.FAL_MODEL_IMAGE_FLUX_DEV,
        process.env.FAL_MODEL_IMAGE_RECRAFT,
        process.env.FAL_MODEL_VIDEO_DEFAULT,
        process.env.FAL_MODEL_VIDEO_SEEDANCE,
        process.env.FAL_MODEL_VIDEO_SEEDANCE_I2V,
        process.env.FAL_MODEL_VIDEO_SEEDANCE_MINI,
        process.env.FAL_MODEL_VIDEO_SEEDANCE_MINI_I2V,
        process.env.FAL_MODEL_VIDEO_HAPPY_HORSE,
        process.env.FAL_MODEL_VIDEO_HAPPY_HORSE_I2V,
        process.env.FAL_MODEL_VIDEO_KLING,
        process.env.FAL_MODEL_VIDEO_KLING_I2V,
        process.env.FAL_MODEL_VIDEO_VEO
      ]
        .map((model) => model?.trim())
        .filter((model): model is string => Boolean(model))
    )
  );

  const checks: Array<Promise<CheckResult> | CheckResult> = [];
  checks.push(checkMysql());

  if (falKey) {
    for (const model of falModels.length ? falModels : ["fal-ai/flux/schnell"]) {
      checks.push(
        checkFalUrl(`https://queue.fal.run/${model}`, {
          okStatuses: [405],
          note: "fal.ai model endpoint is reachable; GET returns 405 because generation uses POST.",
          headers: {
            Authorization: `Key ${falKey}`
          }
        })
      );
    }
  } else {
    checks.push(
      checkUrl("https://queue.fal.run", {
        okStatuses: [404],
        note: "fal.ai queue host is reachable; root returns 404 by design."
      })
    );
  }

  const results = await Promise.all(checks);

  return NextResponse.json({
    ok: results.every((x) => x.ok),
    checks: results
  });
}
