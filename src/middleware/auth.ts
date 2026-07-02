import type { Context, Next } from "hono";

import { ERR } from "@/utils/http";

export async function authMiddleware(c: Context<{ Bindings: CloudflareBindings }>, next: Next) {
	const authHeader = c.req.header("Authorization");

	const headerToken = authHeader?.startsWith("Bearer ") ? authHeader.slice(7).trim() : "";

	const queryToken = (c.req.query("token") || c.req.query("key") || "").trim();

	const token = headerToken || queryToken;

	if (!token) {
		return c.json(ERR("UNAUTHORIZED", "Missing API token"), 401);
	}

	if (token !== c.env.API_TOKEN) {
		return c.json(ERR("UNAUTHORIZED", "Invalid API token"), 401);
	}

	await next();
}
