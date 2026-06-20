/**
 * Centralized role / access model for Pluribus.
 *
 * Roles (8 total):
 *  admin          — full access; can manage members, edit any resource, export
 *  editor         — can generate, review, tag, approve outputs; no member management
 *  viewer         — read-only; can see outputs but not approve/export
 *  reviewer       — external stakeholder; view + status-mark via review link only
 *  subject        — the athlete/talent; uploads references + approves own likeness
 *  subject_manager— agent/manager of a subject; same as subject but on their behalf
 *  legal          — read-only + can flag outputs for legal review
 *  guest          — unauthenticated; no access to internal data
 */

export type UserRole =
  | "admin"
  | "editor"
  | "viewer"
  | "reviewer"
  | "subject"
  | "subject_manager"
  | "legal"
  | "guest";

export type Permission =
  // Generation
  | "generate:images"
  | "generate:packs"
  // Output management
  | "outputs:view"
  | "outputs:approve"
  | "outputs:reject"
  | "outputs:flag"
  | "outputs:tag"
  | "outputs:comment"
  | "outputs:export"
  | "outputs:delete"
  // Subject / likeness
  | "subject:view"
  | "subject:edit"
  | "subject:upload_references"
  | "subject:approve_likeness"
  | "subject:reject_likeness"
  // Campaigns
  | "campaigns:view"
  | "campaigns:create"
  | "campaigns:edit"
  | "campaigns:archive"
  // Members / workspace
  | "members:view"
  | "members:invite"
  | "members:remove"
  | "members:change_role"
  // Settings
  | "settings:view"
  | "settings:edit";

const ROLE_PERMISSIONS: Record<UserRole, Set<Permission>> = {
  admin: new Set([
    "generate:images", "generate:packs",
    "outputs:view", "outputs:approve", "outputs:reject", "outputs:flag", "outputs:tag", "outputs:comment", "outputs:export", "outputs:delete",
    "subject:view", "subject:edit", "subject:upload_references", "subject:approve_likeness", "subject:reject_likeness",
    "campaigns:view", "campaigns:create", "campaigns:edit", "campaigns:archive",
    "members:view", "members:invite", "members:remove", "members:change_role",
    "settings:view", "settings:edit",
  ]),
  editor: new Set([
    "generate:images", "generate:packs",
    "outputs:view", "outputs:approve", "outputs:reject", "outputs:flag", "outputs:tag", "outputs:comment", "outputs:export",
    "subject:view", "subject:edit", "subject:upload_references",
    "campaigns:view", "campaigns:create", "campaigns:edit",
    "members:view",
    "settings:view",
  ]),
  viewer: new Set([
    "outputs:view", "outputs:comment",
    "subject:view",
    "campaigns:view",
    "members:view",
    "settings:view",
  ]),
  reviewer: new Set([
    "outputs:view", "outputs:approve", "outputs:reject", "outputs:flag", "outputs:comment",
  ]),
  subject: new Set([
    "subject:view", "subject:upload_references", "subject:approve_likeness", "subject:reject_likeness",
    "outputs:view",
  ]),
  subject_manager: new Set([
    "subject:view", "subject:upload_references", "subject:approve_likeness", "subject:reject_likeness",
    "outputs:view", "outputs:comment",
  ]),
  legal: new Set([
    "outputs:view", "outputs:flag", "outputs:comment",
    "subject:view",
    "campaigns:view",
  ]),
  guest: new Set(),
};

export function can(role: UserRole, permission: Permission): boolean {
  return ROLE_PERMISSIONS[role]?.has(permission) ?? false;
}

export function canAll(role: UserRole, permissions: Permission[]): boolean {
  return permissions.every(p => can(role, p));
}

export function canAny(role: UserRole, permissions: Permission[]): boolean {
  return permissions.some(p => can(role, p));
}

/** Returns all permissions granted to a role — useful for debugging / audit UI. */
export function getPermissions(role: UserRole): Permission[] {
  return Array.from(ROLE_PERMISSIONS[role] ?? []);
}

export function isInternalRole(role: UserRole): boolean {
  return role === "admin" || role === "editor" || role === "viewer" || role === "legal";
}

export function isSubjectRole(role: UserRole): boolean {
  return role === "subject" || role === "subject_manager";
}
