import type { SupabaseClient, UserResponse } from "@supabase/supabase-js";

// Team logins: someone helping Jasmine signs in with their own email but
// works in HER CRM. Everywhere the app uses `user.id` as "whose data this
// is" (owner_id on inserts, filters, Gmail/Calendar lookups...), a team
// member must act as the CRM owner. So auth.getUser() is wrapped: for a
// team member, user.id becomes the owner's id (crm_owner_id() in the
// database, migration 0089); their real id and email stay on
// user.user_metadata.crm_member_id / crm_member_email. The database's
// access rules check the real sign-in separately, so this can't be used
// to reach anyone else's data.

const WRAPPED = Symbol.for("crm.teamIdentity");

export function actAsCrmOwner<T extends SupabaseClient>(client: T, { cache }: { cache: boolean }): T {
  const auth = client.auth as T["auth"] & { [WRAPPED]?: true };
  if (auth[WRAPPED]) return client;
  const realGetUser = auth.getUser.bind(auth);
  let cached: Promise<UserResponse> | null = null;

  const resolve = async (): Promise<UserResponse> => {
    const res = await realGetUser();
    const user = res.data.user;
    if (!user) return res;
    // Before migration 0089 runs this function doesn't exist: fall back
    // to the plain sign-in (exactly the old behavior).
    const { data: ownerId, error } = await client.rpc("crm_owner_id");
    if (error || typeof ownerId !== "string" || ownerId === user.id) return res;
    return {
      ...res,
      data: { user: { ...user, id: ownerId, user_metadata: { ...user.user_metadata, crm_member_id: user.id, crm_member_email: user.email } } },
    } as UserResponse;
  };

  auth.getUser = ((jwt?: string) => {
    if (jwt) return realGetUser(jwt);
    if (!cache) return resolve();
    cached ??= resolve();
    return cached;
  }) as typeof auth.getUser;
  auth[WRAPPED] = true;
  return client;
}

// True when the signed-in person is a team member (not the CRM owner).
export function isTeamMember(user: { user_metadata?: Record<string, unknown> } | null | undefined): boolean {
  return typeof user?.user_metadata?.crm_member_id === "string";
}
