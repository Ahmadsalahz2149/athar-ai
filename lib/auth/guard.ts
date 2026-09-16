import "server-only";
import { currentContext } from "./current";
import { can, type Capability, type Role } from "./roles";

/**
 * The one place a server action asks "is this person allowed to do that?".
 *
 * Every guarded action calls this instead of re-deriving the answer, so adding
 * a role or moving a capability is one edit to lib/auth/roles.ts rather than a
 * hunt through twenty files. It returns a discriminated result rather than
 * throwing: a server action's job is to hand the UI a reason, and a thrown
 * error in a server action reaches the user as a generic failure.
 *
 * `forbidden` and `no_session` stay distinct on purpose — "sign in again" and
 * "your role cannot do this" are different instructions, and showing the wrong
 * one sends people round a loop that never fixes anything.
 */
export type Allowed = { ok: true; userId: string; orgId: string; brandId: string; role: Role };
export type Denied = { ok: false; error: "no_session" | "forbidden" };
export type GuardResult = Allowed | Denied;

export async function requireCap(cap: Capability): Promise<GuardResult> {
  const ctx = await currentContext();
  if (!ctx) return { ok: false, error: "no_session" };
  if (!can(ctx.role, cap)) return { ok: false, error: "forbidden" };
  return { ok: true, ...ctx };
}
