import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import type { NextFunction, Request, Response } from "express";
import { and, eq, gt } from "drizzle-orm";
import { db, rolesTable, sessionsTable, userRolesTable, usersTable } from "@workspace/db";

export const SESSION_COOKIE = "esg_session";

export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString("hex");
  const derived = scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${derived}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const [salt, expected] = stored.split(":");
  if (!salt || !expected) return false;
  const actual = scryptSync(password, salt, 64);
  const expectedBuffer = Buffer.from(expected, "hex");
  return actual.length === expectedBuffer.length && timingSafeEqual(actual, expectedBuffer);
}

export async function getUserFromSession(req: Request) {
  const sessionId = req.signedCookies?.[SESSION_COOKIE] as string | undefined;
  if (!sessionId) return null;
  const [row] = await db
    .select({ user: usersTable })
    .from(sessionsTable)
    .innerJoin(usersTable, eq(usersTable.id, sessionsTable.userId))
    .where(
      and(
        eq(sessionsTable.id, sessionId),
        gt(sessionsTable.expiresAt, new Date()),
        eq(usersTable.status, "ACTIVE"),
      ),
    )
    .limit(1);
  return row?.user ?? null;
}

export async function requireUser(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const user = await getUserFromSession(req);
    if (!user) {
      res.status(401).json({ error: "Authentication required" });
      return;
    }
    res.locals.user = user;
    next();
  } catch (error) {
    req.log.error({ err: error }, "Authentication lookup failed");
    res.status(500).json({ error: "Unable to verify session" });
  }
}

export async function getUserRoles(userId: string): Promise<string[]> {
  const rows = await db
    .select({ name: rolesTable.name })
    .from(userRolesTable)
    .innerJoin(rolesTable, eq(rolesTable.id, userRolesTable.roleId))
    .where(eq(userRolesTable.userId, userId));
  return rows.map((row) => row.name);
}

export function requireRole(...allowedRoles: string[]) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const user = res.locals.user as typeof usersTable.$inferSelect | undefined;
      if (!user) {
        res.status(401).json({ error: "Authentication required" });
        return;
      }
      const roles = await getUserRoles(user.id);
      if (!roles.some((role) => allowedRoles.includes(role))) {
        res.status(403).json({ error: "You do not have permission for this action" });
        return;
      }
      res.locals.roles = roles;
      next();
    } catch (error) {
      req.log.error({ err: error }, "Authorization lookup failed");
      res.status(500).json({ error: "Unable to verify authorization" });
    }
  };
}