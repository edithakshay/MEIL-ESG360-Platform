import { Router, type IRouter } from "express";
import { and, eq } from "drizzle-orm";
import { db, sessionsTable, usersTable, userRolesTable, rolesTable } from "@workspace/db";
import { LoginBody, LoginResponse, GetCurrentUserResponse } from "@workspace/api-zod";
import { getUserFromSession, hashPassword, requireUser, SESSION_COOKIE, verifyPassword } from "../lib/auth";

const router: IRouter = Router();

router.post("/auth/login", async (req, res): Promise<void> => {
  const parsed = LoginBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [user] = await db.select().from(usersTable).where(eq(usersTable.email, parsed.data.email)).limit(1);
  if (!user || user.status !== "ACTIVE" || !verifyPassword(parsed.data.password, user.passwordHash)) {
    res.status(401).json({ error: "Invalid email or password" });
    return;
  }
  const [session] = await db
    .insert(sessionsTable)
    .values({ userId: user.id, expiresAt: new Date(Date.now() + 8 * 60 * 60 * 1000) })
    .returning();
  if (!session) {
    res.status(500).json({ error: "Unable to create session" });
    return;
  }
  res.cookie(SESSION_COOKIE, session.id, {
    signed: true,
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 8 * 60 * 60 * 1000,
  });
  const roles = await db
    .select({ name: rolesTable.name })
    .from(userRolesTable)
    .innerJoin(rolesTable, eq(rolesTable.id, userRolesTable.roleId))
    .where(eq(userRolesTable.userId, user.id));
  res.json(LoginResponse.parse({ user: { id: user.id, email: user.email, displayName: user.displayName }, roles: roles.map((role) => role.name) }));
});

router.post("/auth/logout", async (req, res): Promise<void> => {
  const sessionId = req.signedCookies?.[SESSION_COOKIE] as string | undefined;
  if (sessionId) await db.delete(sessionsTable).where(eq(sessionsTable.id, sessionId));
  res.clearCookie(SESSION_COOKIE);
  res.status(204).send();
});

router.get("/auth/me", requireUser, async (req, res): Promise<void> => {
  const user = res.locals.user as typeof usersTable.$inferSelect;
  const roles = await db
    .select({ name: rolesTable.name })
    .from(userRolesTable)
    .innerJoin(rolesTable, eq(rolesTable.id, userRolesTable.roleId))
    .where(eq(userRolesTable.userId, user.id));
  res.json(GetCurrentUserResponse.parse({ user: { id: user.id, email: user.email, displayName: user.displayName }, roles: roles.map((role) => role.name) }));
});

export default router;