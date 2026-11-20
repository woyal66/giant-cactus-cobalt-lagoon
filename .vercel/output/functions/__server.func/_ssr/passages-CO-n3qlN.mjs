import { r as createServerFn } from "./ssr.mjs";
import { t as createServerRpc } from "./createServerRpc-CcvdN_gc.mjs";
import { cn as _enum, dn as boolean, gn as object, hn as number, un as array, yn as string } from "../_libs/@better-auth/core+[...].mjs";
import { r as getSql } from "./db-CI1EJjjn.mjs";
import { t as authMiddleware } from "./middleware-DhUlioyT.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/passages-CO-n3qlN.js
var waypointSchema = object({
	lat: number().gte(-90).lte(90),
	lng: number().gte(-180).lte(180),
	label: string().max(48).optional()
});
var saveSchema = object({
	title: string().trim().min(2).max(80),
	region: string().trim().max(80).default(""),
	notes: string().trim().max(600).default(""),
	kind: _enum(["passage", "anchorage"]),
	published: boolean(),
	waypoints: array(waypointSchema).min(1).max(200),
	authorName: string().trim().min(1).max(48)
});
function parseWaypoints(raw) {
	if (typeof raw === "string") try {
		raw = JSON.parse(raw);
	} catch {
		return [];
	}
	if (!Array.isArray(raw)) return [];
	return raw.flatMap((w) => {
		if (w && typeof w === "object" && typeof w.lat === "number" && typeof w.lng === "number") {
			const label = w.label;
			return [{
				lat: w.lat,
				lng: w.lng,
				...typeof label === "string" && label ? { label } : {}
			}];
		}
		return [];
	});
}
function toPassage(row) {
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
		createdAt: typeof row.created_at === "string" ? row.created_at : new Date(row.created_at).toISOString()
	};
}
var listPublicPassages_createServerFn_handler = createServerRpc({
	id: "917833e6c7e1510ba5ce3b096fbb266796d2eacfe68f76ff22ae3ed3ddebcc69",
	name: "listPublicPassages",
	filename: "src/lib/passages.ts"
}, (opts) => listPublicPassages.__executeServer(opts));
var listPublicPassages = createServerFn({ method: "GET" }).handler(listPublicPassages_createServerFn_handler, async () => {
	return (await (await getSql())`
      select id, user_id, author_name, title, region, notes, kind, published, waypoints, created_at
      from passages
      where published = true
      order by (user_id = 'reefpilot-atlas') desc, created_at desc
      limit 80
    `).map(toPassage);
});
var getPublicPassage_createServerFn_handler = createServerRpc({
	id: "5ad2f883ad140e35b2ae25fe6397048cb6529994bfe84129f66cc9a94c008c2c",
	name: "getPublicPassage",
	filename: "src/lib/passages.ts"
}, (opts) => getPublicPassage.__executeServer(opts));
var getPublicPassage = createServerFn({ method: "GET" }).validator(object({ id: number().int().positive() })).handler(getPublicPassage_createServerFn_handler, async ({ data }) => {
	const rows = await (await getSql())`
      select id, user_id, author_name, title, region, notes, kind, published, waypoints, created_at
      from passages
      where id = ${data.id} and published = true
      limit 1
    `;
	return rows[0] ? toPassage(rows[0]) : null;
});
var listMyPassages_createServerFn_handler = createServerRpc({
	id: "2d32e78a295e4782e60b6a50131b28856f9d9bbaa11eadc6925a94d5be2a395e",
	name: "listMyPassages",
	filename: "src/lib/passages.ts"
}, (opts) => listMyPassages.__executeServer(opts));
var listMyPassages = createServerFn({ method: "GET" }).middleware([authMiddleware]).handler(listMyPassages_createServerFn_handler, async ({ context }) => {
	return (await (await getSql())`
      select id, user_id, author_name, title, region, notes, kind, published, waypoints, created_at
      from passages
      where user_id = ${context.userId}
      order by created_at desc
      limit 80
    `).map(toPassage);
});
var savePassage_createServerFn_handler = createServerRpc({
	id: "518e0dce2d38a263f2e3432f0ca55d0dc284f609e3db1246f1457699bd938f98",
	name: "savePassage",
	filename: "src/lib/passages.ts"
}, (opts) => savePassage.__executeServer(opts));
var savePassage = createServerFn({ method: "POST" }).middleware([authMiddleware]).validator(saveSchema).handler(savePassage_createServerFn_handler, async ({ context, data }) => {
	const rows = await (await getSql()).query(`insert into passages
        (user_id, author_name, title, region, notes, kind, published, waypoints)
       values ($1,$2,$3,$4,$5,$6,$7,$8::jsonb)
       returning id`, [
		context.userId,
		data.authorName,
		data.title,
		data.region,
		data.notes,
		data.kind,
		data.published,
		JSON.stringify(data.waypoints)
	]);
	return { id: Number(rows[0].id) };
});
var setPublished_createServerFn_handler = createServerRpc({
	id: "7286ffce45e4fd60e6128f6531c7c263a7dc046e87272173582404023676438e",
	name: "setPublished",
	filename: "src/lib/passages.ts"
}, (opts) => setPublished.__executeServer(opts));
var setPublished = createServerFn({ method: "POST" }).middleware([authMiddleware]).validator(object({
	id: number().int().positive(),
	published: boolean()
})).handler(setPublished_createServerFn_handler, async ({ context, data }) => {
	await (await getSql())`
      update passages
      set published = ${data.published}
      where id = ${data.id} and user_id = ${context.userId}
    `;
	return { ok: true };
});
var deletePassage_createServerFn_handler = createServerRpc({
	id: "e34249cc90045619ca66c78320657674454f9f203a09fdaeeec817e4ca92c0aa",
	name: "deletePassage",
	filename: "src/lib/passages.ts"
}, (opts) => deletePassage.__executeServer(opts));
var deletePassage = createServerFn({ method: "POST" }).middleware([authMiddleware]).validator(object({ id: number().int().positive() })).handler(deletePassage_createServerFn_handler, async ({ context, data }) => {
	await (await getSql())`
      delete from passages
      where id = ${data.id} and user_id = ${context.userId}
        and user_id <> 'reefpilot-atlas'
    `;
	return { ok: true };
});
//#endregion
export { deletePassage_createServerFn_handler, getPublicPassage_createServerFn_handler, listMyPassages_createServerFn_handler, listPublicPassages_createServerFn_handler, savePassage_createServerFn_handler, setPublished_createServerFn_handler };
