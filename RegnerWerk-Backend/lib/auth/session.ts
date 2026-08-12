import { createClient } from "@/lib/auth/server";
import { getSupabaseAdmin } from "@/lib/supabase";
import { NextResponse } from "next/server";

export type AuthUser = {
  id: string;
  email: string | null;
  displayName: string;
  roles: string[];
  permissions: string[];
};

export async function getSessionUser(): Promise<AuthUser | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const admin = getSupabaseAdmin();
  const { data: profile } = await admin
    .from("profiles")
    .select("display_name, active")
    .eq("id", user.id)
    .maybeSingle();

  if (profile && profile.active === false) return null;

  const { data: roleRows } = await admin
    .from("user_roles")
    .select("roles(code), revoked_at")
    .eq("user_id", user.id)
    .is("revoked_at", null);

  const roles = (roleRows ?? [])
    .map((r) => {
      const roles = r.roles as { code?: string } | { code?: string }[] | null;
      if (Array.isArray(roles)) return roles[0]?.code;
      return roles?.code;
    })
    .filter((c): c is string => Boolean(c));

  let permissions: string[] = [];
  if (roles.length) {
    const { data: roleIds } = await admin
      .from("roles")
      .select("id, code")
      .in("code", roles);
    const ids = (roleIds ?? []).map((r) => r.id);
    if (ids.length) {
      const { data: perms } = await admin
        .from("role_permissions")
        .select("permissions(key)")
        .in("role_id", ids);
      permissions = [
        ...new Set(
          (perms ?? [])
            .map((p) => {
              const permissions = p.permissions as
                | { key?: string }
                | { key?: string }[]
                | null;
              if (Array.isArray(permissions)) return permissions[0]?.key;
              return permissions?.key;
            })
            .filter((k): k is string => Boolean(k)),
        ),
      ];
    }
  }

  // Bootstrap: authenticated user with no roles yet gets owner if they are the first profile
  if (roles.length === 0) {
    const { count } = await admin
      .from("user_roles")
      .select("user_id", { count: "exact", head: true })
      .is("revoked_at", null);
    if ((count ?? 0) === 0) {
      const { data: ownerRole } = await admin
        .from("roles")
        .select("id")
        .eq("code", "owner")
        .maybeSingle();
      if (ownerRole) {
        await admin.from("user_roles").insert({
          user_id: user.id,
          role_id: ownerRole.id,
        });
        roles.push("owner");
        const { data: allPerms } = await admin.from("permissions").select("key");
        permissions = (allPerms ?? []).map((p) => p.key as string);
      }
    }
  }

  return {
    id: user.id,
    email: user.email ?? null,
    displayName:
      (profile?.display_name as string) ||
      user.email?.split("@")[0] ||
      "User",
    roles,
    permissions,
  };
}

export async function requireApiUser(permission?: string) {
  const user = await getSessionUser();
  if (!user) {
    return {
      user: null as AuthUser | null,
      error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    };
  }
  if (permission && !user.permissions.includes(permission) && !user.roles.includes("owner")) {
    return {
      user,
      error: NextResponse.json({ error: "Forbidden" }, { status: 403 }),
    };
  }
  return { user, error: null };
}
