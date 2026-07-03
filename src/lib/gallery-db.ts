import { randomUUID } from "node:crypto";
import type { RowDataPacket } from "mysql2/promise";
import { mysqlExecute, toMysqlDate } from "./mysql";
import type { GalleryRow } from "./gallery";

const SELECT_COLUMNS =
  "id,title,category,image_url,thumbnail_url,prompt,model,author_name,author_handle,source_platform,source_url,aspect_ratio,width,height,is_featured,published_at,created_at";

function mapRow(row: RowDataPacket) {
  return {
    ...row,
    is_featured: Boolean(row.is_featured)
  } as GalleryRow;
}

export async function listPublishedGalleryRows(options: {
  category?: string | null;
  sort?: string | null;
  query?: string | null;
  limit?: number;
  featuredFirst?: boolean;
} = {}) {
  const filters = ["is_published = 1"];
  const params: unknown[] = [];
  if (options.category) {
    filters.push("category = ?");
    params.push(options.category);
  }
  const query = options.query?.trim();
  if (query) {
    const like = `%${query}%`;
    filters.push("(title like ? or prompt like ? or author_name like ? or author_handle like ? or model like ?)");
    params.push(like, like, like, like, like);
  }
  const limit = Math.min(Math.max(Number(options.limit || 24), 1), 200);
  const order =
    options.featuredFirst === false || options.sort === "latest"
      ? "published_at desc, created_at desc"
      : "is_featured desc, published_at desc";
  const rows = await mysqlExecute<RowDataPacket[]>(
    `select ${SELECT_COLUMNS} from public_gallery_items where ${filters.join(" and ")} order by ${order} limit ?`,
    [...params, limit]
  );
  return rows.map(mapRow);
}

export async function getPublishedGalleryRow(id: string) {
  const rows = await mysqlExecute<RowDataPacket[]>(
    `select ${SELECT_COLUMNS} from public_gallery_items where id = ? and is_published = 1 limit 1`,
    [id]
  );
  return rows[0] ? mapRow(rows[0]) : null;
}

export async function listAdminGalleryRows() {
  const rows = await mysqlExecute<RowDataPacket[]>(
    `select ${SELECT_COLUMNS} from public_gallery_items order by created_at desc limit 12`
  );
  return rows.map(mapRow);
}

export async function findDuplicateGalleryRow(sourceUrl: unknown, imageUrl: unknown, excludeId?: string) {
  if (typeof sourceUrl !== "string" || typeof imageUrl !== "string") return null;
  const params: unknown[] = [sourceUrl, imageUrl];
  const exclude = excludeId ? " and id <> ?" : "";
  if (excludeId) params.push(excludeId);
  const rows = await mysqlExecute<RowDataPacket[]>(
    `select ${SELECT_COLUMNS} from public_gallery_items where source_url = ? and image_url = ?${exclude} limit 1`,
    params
  );
  return rows[0] ? mapRow(rows[0]) : null;
}

export async function insertAdminGalleryRow(data: Record<string, unknown>) {
  const id = typeof data.id === "string" && data.id ? data.id : randomUUID();
  const now = new Date();
  const row = {
    id,
    ...data,
    published_at: data.published_at || toMysqlDate(now),
    created_at: toMysqlDate(now)
  };
  const columns = Object.keys(row);
  await mysqlExecute(
    `insert into public_gallery_items (${columns.map((column) => `\`${column}\``).join(", ")}) values (${columns.map(() => "?").join(", ")})`,
    columns.map((column) => {
      const value = row[column as keyof typeof row];
      if (typeof value === "boolean") return value ? 1 : 0;
      return value;
    })
  );
  return getPublishedOrAnyGalleryRow(id);
}

export async function updateAdminGalleryRow(id: string, data: Record<string, unknown>) {
  const columns = Object.keys(data);
  if (!columns.length) return getPublishedOrAnyGalleryRow(id);
  await mysqlExecute(
    `update public_gallery_items set ${columns.map((column) => `\`${column}\` = ?`).join(", ")} where id = ?`,
    [
      ...columns.map((column) => {
        const value = data[column];
        if (typeof value === "boolean") return value ? 1 : 0;
        return column.endsWith("_at") ? toMysqlDate(value) : value;
      }),
      id
    ]
  );
  return getPublishedOrAnyGalleryRow(id);
}

export async function deleteAdminGalleryRow(id: string) {
  const row = await getPublishedOrAnyGalleryRow(id);
  await mysqlExecute("delete from public_gallery_items where id = ?", [id]);
  return row;
}

async function getPublishedOrAnyGalleryRow(id: string) {
  const rows = await mysqlExecute<RowDataPacket[]>(
    `select ${SELECT_COLUMNS} from public_gallery_items where id = ? limit 1`,
    [id]
  );
  return rows[0] ? mapRow(rows[0]) : null;
}
