# Dungeon Ascension — Firestore Security Specification (Phase 0)

## 1. Data Invariants & Master Source of Truth

1. **Identity & Email Verification Gate**: Every write operation requires an authenticated user with a verified email (`request.auth != null && request.auth.token.email_verified == true`), matching `uid == request.auth.uid`.
2. **PII Isolation (Split Collection)**: Player email, auth provider, and role live exclusively in `/players/{uid}/private/account`, readable and writable ONLY by `isOwner(uid)`. Public profiles at `/players/{uid}` contain zero PII.
3. **Immutable Role & Privilege Lock**: `role` in `/players/{uid}/private/account` is strictly locked to `'player'` on create and forbidden from being modified on update. No user can self-elevate to admin.
4. **Atomic Unique Usernames**: `/usernames/{usernameLower}` maps lowercase usernames to owner `uid`. Updates are forbidden; changing a username requires deleting the old owned reservation and creating the new one atomically in a transaction alongside updating `/players/{uid}`. Listing `/usernames` is forbidden to prevent enumeration scraping.
5. **Versioned Anti-Overwrite Cloud Saves**: `/players/{uid}/private/save` enforces `incoming().saveVersion >= existing().saveVersion`, strict field allowlists, non-decreasing career totals (`totalKills`, `totalBossKills`, `totalRuns`, `totalPlayTimeSec`, `bestFloor`, `bestLevel`, `totalCrystalsEarned`), bounded upgrade tiers, and bounded list/map sizes.
6. **Immutable Single-Use Code Redemptions**: `/players/{uid}/redemptions/{codeId}` allows create once per `(uid, codeId)` when verified and forbids all updates and deletes.
7. **Immutable Run History**: `/players/{uid}/runs/{runId}` is append-only by the owner (`allow update, delete: if false`) with strict numeric bounds and server `request.time` timestamps.
8. **Temporal Integrity**: All `createdAt`, `updatedAt`, `lastLoginAt`, and `redeemedAt` timestamps MUST equal `request.time`.

## 2. The "Dirty Dozen" Adversarial Payloads (Must All Be Rejected)

1. **Cross-Owner Read on Private Account (PII Leak)**: User B attempts `get` on `/players/userA/private/account`. -> DENIED.
2. **Cross-Owner Read on Cloud Save**: User B attempts `get` on `/players/userA/private/save`. -> DENIED.
3. **Unverified Email Write**: Authenticated user with `email_verified: false` attempts `create` on `/players/userA`. -> DENIED.
4. **Privilege Escalation (Role Injection)**: User A attempts `create` on `/players/userA/private/account` with `role: "admin"`. -> DENIED.
5. **Shadow / Ghost Field Injection**: User A attempts `update` on `/players/userA` injecting `isAdmin: true` or `vip: true`. -> DENIED.
6. **Identity Spoofing in Username Reservation**: User A attempts `create` on `/usernames/hero` with `uid: "userB"`. -> DENIED.
7. **Username Hijacking**: User B attempts `delete` or `update` on `/usernames/hero` owned by User A. -> DENIED.
8. **Stale Save Overwrite (Rollback Attack)**: User A attempts `update` on `/players/userA/private/save` with `saveVersion: 2` when existing `saveVersion` is `5`. -> DENIED.
9. **Career Stat Tampering / Rollback**: User A attempts `update` on `/players/userA/private/save` lowering `bestFloor` from `25` to `1` or setting `crystals: 999999999`. -> DENIED.
10. **Client-Forged Timestamp**: User A attempts `create` on `/players/userA/redemptions/secret_slatt_monkeyslatt` with a client-fabricated timestamp instead of `request.time`. -> DENIED.
11. **Duplicate / Mutated Redemption Replay**: User A attempts `update` or `delete` on `/players/userA/redemptions/secret_slatt_monkeyslatt` to redeem twice. -> DENIED.
12. **Resource Poisoning (Oversized ID / String / Array)**: User A attempts `create` on `/players/userA/runs/<200-char-id>` or pushes > 64 entries into `redeemedCodes`. -> DENIED.
