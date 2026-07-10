import { createMiddleware } from "hono/factory";
import type { AuthedStaff, Env, Variables } from "../types";
import type { StaffRole } from "@school-harness/shared";

export const requireAuth = createMiddleware<{ Bindings: Env; Variables: Variables }>(
  async (c, next) => {
    const apiKey = c.req.header("X-API-Key");
    if (!apiKey) {
      return c.json({ error: "API key required" }, 401);
    }
    const staff = await c.env.DB.prepare(
      "SELECT id, name, role FROM staff WHERE api_key = ?"
    )
      .bind(apiKey)
      .first<AuthedStaff>();
    if (!staff) {
      return c.json({ error: "Invalid API key" }, 401);
    }
    c.set("staff", staff);
    await next();
  }
);

export function requireRole(...roles: StaffRole[]) {
  return createMiddleware<{ Bindings: Env; Variables: Variables }>(async (c, next) => {
    const staff = c.get("staff");
    if (!roles.includes(staff.role)) {
      return c.json({ error: "Forbidden" }, 403);
    }
    await next();
  });
}
