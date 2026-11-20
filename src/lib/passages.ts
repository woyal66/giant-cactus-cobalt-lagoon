import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { getSql } from "@/lib/db";
import { authMiddleware } from "@/lib/auth/middleware";

export type PassageKind = "passage" | "anchorage";

export type Waypoint = {
  lat: number;
  lng: number;
  label?: string;
};

export type Passage = {
  id: number;
  userId: string;
  authorName: string;
  title: string;
  region: string;
  notes: string;
  kind: PassageKind;
  published: boolean;
  waypoints: Waypoint[];
  createdAt: string;
};

const waypointSchema = z.object({
  lat: z.number().gte(-90).lte(90),
  lng: z.number().gte(-180).lte(180),
  label: z.string().max(48).optional(),
});

const saveSchema = z.object({
  title: z.string().trim().min(2).max(80),
  region: z.string().trim().max(80).default(""),
  notes: z.string().trim().max(600).default(""),
  kind: z.enum(["passage", "anchorage"]),
  published: z.boolean(),
  waypoints: z.array(waypointSchema).min(1).max(200),
  authorName: z.string().trim().min(1).max(48),
});

type PassageRow = {
  id: number;
  user_id: string;
  author_name: string;
  title: string;
  region: string;
  notes: string;
  kind: string;
  published: boolean;
  waypoints: unknown;
  created_at: string;
};

function parseWaypoints(raw: unknown): Waypoint[] {
  if (typeof raw === "string") {
    try {
      raw = JSON.parse(raw);
    } catch {
      return [];
    }
  }
  if (!Array.isArray(raw)) return [];
  return raw.flatMap((w) => {
    if (
      w &&
      typeof w === "object" &&
      typeof (w as Waypoint).lat === "number" &&
      typeof (w as Waypoint).lng === "number"
    ) {
      const label = (w as Waypoint).label;
      return [
        {
          lat: (w as Waypoint).lat,
          lng: (w as Waypoint).lng,
          ...(typeof label === "string" && label ? { label } : {}),
        },
      ];
    }
    return [];
  });
}

function toPassage(row: PassageRow): Passage {
  return {
    id: Number(row.id),
    userId: row.user_id,
    authorName: row.author_name,
    title: row.title,
    region: row.region,
    notes: row.notes,
    kind: row.kind === "anchorage" ? "anchorage" : "passage",
    published: Boolean(row.published),
    waypoints: parseWaypoints(row.waypoints),
    createdAt:
      typeof row.created_at === "string"
        ? row.created_at
        : new Date(row.created_at).toISOString(),
  };
}

export const listPublicPassages = createServerFn({ method: "GET" }).handler(
  async () => {
    const sql = await getSql();
    const rows = await sql<PassageRow>`
      select id, user_id, author_name, title, region, notes, kind, published, waypoints, created_at
      from passages
      where published = true
      order by (user_id = 'reefpilot-atlas') desc, created_at desc
      limit 80
    `;
    return rows.map(toPassage);
  },
);

export const getPublicPassage = createServerFn({ method: "GET" })
  .validator(z.object({ id: z.number().int().positive() }))
  .handler(async ({ data }) => {
    const sql = await getSql();
    const rows = await sql<PassageRow>`
      select id, user_id, author_name, title, region, notes, kind, published, waypoints, created_at
      from passages
      where id = ${data.id} and published = true
      limit 1
    `;
    return rows[0] ? toPassage(rows[0]) : null;
  });

export const listMyPassages = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const sql = await getSql();
    const rows = await sql<PassageRow>`
      select id, user_id, author_name, title, region, notes, kind, published, waypoints, created_at
      from passages
      where user_id = ${context.userId}
      order by created_at desc
      limit 80
    `;
    return rows.map(toPassage);
  });

export const savePassage = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(saveSchema)
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    const rows = await sql.query<{ id: number }>(
      `insert into passages
        (user_id, author_name, title, region, notes, kind, published, waypoints)
       values ($1,$2,$3,$4,$5,$6,$7,$8::jsonb)
       returning id`,
      [
        context.userId,
        data.authorName,
        data.title,
        data.region,
        data.notes,
        data.kind,
        data.published,
        JSON.stringify(data.waypoints),
      ],
    );
    return { id: Number(rows[0]!.id) };
  });

export const setPublished = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(
    z.object({
      id: z.number().int().positive(),
      published: z.boolean(),
    }),
  )
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    await sql`
      update passages
      set published = ${data.published}
      where id = ${data.id} and user_id = ${context.userId}
    `;
    return { ok: true as const };
  });

export const deletePassage = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(z.object({ id: z.number().int().positive() }))
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    await sql`
      delete from passages
      where id = ${data.id} and user_id = ${context.userId}
        and user_id <> 'reefpilot-atlas'
    `;
    return { ok: true as const };
  });
