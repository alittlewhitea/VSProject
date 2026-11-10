import type { RowDataPacket } from "mysql2/promise";
import { mysqlExecute, toMysqlDate } from "./mysql";
export type GrowthRow = { landingPath: string; channel: string; visitors: number; workspaceClicks: number; signups: number; activated: number; payers: number };
export type GrowthReport = { generatedAt: string; start: string; end: string; days: number; rows: GrowthRow[]; coverage: { newUsers: number; attributedNewUsers: number; earlierTouchSignups: number }; totals: Omit<GrowthRow, "landingPath" | "channel"> };
type VisitRow = { landingPath: string; channel: string; visitors: number; workspaceClicks: number };
type SignupRow = { landingPath: string; channel: string; signups: number; activated: number; payers: number };

export function combineGrowthRows(visits: VisitRow[], signups: SignupRow[]): GrowthRow[] {
  const rows = new Map<string, GrowthRow>();
  function row(path: string, channel: string) {
    const key = JSON.stringify([path, channel]);
    if (!rows.has(key)) rows.set(key, { landingPath: path, channel, visitors: 0, workspaceClicks: 0, signups: 0, activated: 0, payers: 0 });
    return rows.get(key)!;
  }
  for (const visit of visits) Object.assign(row(visit.landingPath, visit.channel), { visitors: Number(visit.visitors), workspaceClicks: Number(visit.workspaceClicks) });
  for (const signup of signups) Object.assign(row(signup.landingPath, signup.channel), { signups: Number(signup.signups), activated: Number(signup.activated), payers: Number(signup.payers) });
  return [...rows.values()].sort((a, b) => b.payers - a.payers || b.activated - a.activated || b.signups - a.signups || b.visitors - a.visitors);
}

export async function readGrowthReport(days = 28, now = Date.now()): Promise<GrowthReport> {
  days = [7, 28, 90].includes(days) ? days : 28;
  const start = new Date(now - days * 86400000), end = new Date(now);
  const startSql = toMysqlDate(start), endSql = toMysqlDate(end), startIso = start.toISOString(), endIso = end.toISOString();
  const [visits, signups, coverage] = await Promise.all([
    mysqlExecute<RowDataPacket[]>(`select json_unquote(json_extract(properties, '$.first_landing_path')) as landingPath,
      json_unquote(json_extract(properties, '$.acquisition_channel')) as channel,
      count(distinct json_unquote(json_extract(properties, '$.attribution_id'))) as visitors,
      count(distinct case when event_name = 'landing_cta_clicked' then json_unquote(json_extract(properties, '$.attribution_id')) end) as workspaceClicks
      from analytics_events where event_name in ('landing_view', 'landing_cta_clicked') and created_at >= ? and created_at < ?
      and json_unquote(json_extract(properties, '$.first_seen_at')) >= ? and json_unquote(json_extract(properties, '$.first_seen_at')) < ?
      and json_unquote(json_extract(properties, '$.attribution_id')) like 'g_%'
      group by landingPath, channel`, [startSql, endSql, startIso, endIso]),
    mysqlExecute<RowDataPacket[]>(`select coalesce(json_unquote(json_extract(u.raw_user_meta_data, '$.growthAttribution.landingPath')), 'unknown') as landingPath,
      coalesce(json_unquote(json_extract(u.raw_user_meta_data, '$.growthAttribution.channel')), 'unknown') as channel,
      count(*) as signups,
      sum(exists(select 1 from generation_tasks t where t.user_id = u.id and t.transport = 'real' and t.status = 'completed' and t.output_url is not null and trim(t.output_url) <> '' and t.created_at >= u.created_at)) as activated,
      sum(exists(select 1 from credit_purchases p where p.user_id = u.id and p.status = 'completed' and p.amount_cents > 0 and p.created_at >= u.created_at)) as payers
      from users u where u.created_at >= ? and u.created_at < ?
      and (json_extract(u.raw_user_meta_data, '$.growthAttribution.id') is null or
        (json_unquote(json_extract(u.raw_user_meta_data, '$.growthAttribution.firstSeenAt')) >= ? and json_unquote(json_extract(u.raw_user_meta_data, '$.growthAttribution.firstSeenAt')) < ?))
      group by landingPath, channel`, [startSql, endSql, startIso, endIso]),
    mysqlExecute<RowDataPacket[]>(`select count(*) as newUsers,
      coalesce(sum(json_extract(raw_user_meta_data, '$.growthAttribution.id') is not null), 0) as attributedNewUsers,
      coalesce(sum(json_unquote(json_extract(raw_user_meta_data, '$.growthAttribution.firstSeenAt')) < ?), 0) as earlierTouchSignups
      from users where created_at >= ? and created_at < ?`, [startIso, startSql, endSql])
  ]);
  const rows = combineGrowthRows(visits as VisitRow[], signups as SignupRow[]);
  const totals = rows.reduce((total, item) => ({ visitors: total.visitors + item.visitors, workspaceClicks: total.workspaceClicks + item.workspaceClicks, signups: total.signups + item.signups, activated: total.activated + item.activated, payers: total.payers + item.payers }), { visitors: 0, workspaceClicks: 0, signups: 0, activated: 0, payers: 0 });
  const c = coverage[0] || {};
  return { generatedAt: endIso, start: startIso, end: endIso, days, rows, totals, coverage: { newUsers: Number(c.newUsers || 0), attributedNewUsers: Number(c.attributedNewUsers || 0), earlierTouchSignups: Number(c.earlierTouchSignups || 0) } };
}
