# 4. Refresh token rotation is one atomic write, with a grace period before reuse ends other sessions

Date: 2026-09-12

## Status

Accepted

## Context

The access cookie lives 15 minutes; the `RefreshToken` behind it lives 30 days and rotates on
every use — issue it, revoke it, issue a successor, repeat (see `RefreshTokenService.rotate`).
Rotation existed to detect theft: if a stolen token is replayed after the legitimate client has
already rotated it, the server can tell, because the presented token comes back already
revoked.

Investigating #156 (users logged out mid-workout) found rotation broken in three independent
ways, each one a straightforward read-then-write race or an over-broad response to it:

1. **Two refreshes, one winner, but no lock.** `rotate` read the token, checked it was
   unrevoked, then wrote the revoke and the successor in a later statement. Requests arriving
   at the same instant all passed the read before either wrote — five concurrent refreshes with
   one cookie produced five independently "valid" successors (#159). The client-side half of
   this (#158) already collapses concurrent 401s into one refresh call per tab, but the server
   still had to hold under a genuine race — another tab, another device, a retried request.
2. **Fixing (1) naively reintroduced (1).** Making the revoke an atomic
   `UPDATE ... WHERE revokedAt IS NULL` stops two rows from ever sharing a successor, but the
   losing requests still need an answer. The first attempt decided reuse-vs-collision from the
   token's *pre-race* read — which is always "still unrevoked" for every simultaneous caller,
   so nothing distinguished a benign loser from a replayed token, and both existing branches
   were wrong for a loser: award it nothing while looking clean would still work, but treating
   it as reuse (see 3) revoked the very session the winner had just created (#160's tests
   caught this while adding rejection logging, before it reached production).
3. **Reuse detection revoked too much.** The theft response — revoke every live session for
   the user — could not distinguish "a session descended from the compromised token" from "a
   session the user started five minutes later from somewhere else." A late, stale refresh
   carrying an old cookie would end a sign-in that had nothing to do with it. Production
   confirmed this on 2026-09-11 13:03:25: a sign-in at `.756` was ended at `.765`, and the next
   at `.766` was ended at `.772` (#161).

## Decision

**Rotation is one conditional write.** `rotate` attempts
`UPDATE refresh_tokens SET revokedAt = now, replacedByTokenHash = next WHERE id = ? AND
revokedAt IS NULL AND expiresAt > now` inside a transaction, and only creates the successor row
if that update actually affected one row. A token can never end up with two live successors,
because at most one caller's `UPDATE` can win the row lock.

**A loser is classified after a fresh re-read, not the stale pre-race one.** Losing the
conditional update means either the token was already expired, or something else revoked it —
and "something else" is looked up again, after the loss, not assumed from what was read before
attempting the write.

**A five-second grace period separates a collision from reuse.** If the token was revoked
within the last 5 seconds, the loser is just rejected (`Refresh token already rotated`) — this
is what a genuine simultaneous race looks like, and the winner's brand-new session must survive
it. Only a token revoked *longer* ago is treated as reuse: a real client rotates and moves on
within milliseconds, so a presentation that old is someone replaying a token they should no
longer have.

**Reuse only ends sessions that predate the compromise.** When reuse is confirmed, every
session with `createdAt <= (the moment the reused token was revoked)` is ended — not every
session the user has. A sign-in that happened *after* that moment is unrelated to whoever is
now replaying the old token and is left alone. The successor created by the original,
legitimate rotation gets its own `createdAt` pinned to the exact instant used for the
predecessor's `revokedAt` (rather than a database-side default), so this comparison cannot be
thrown off by clock or round-trip skew between the two writes.

**Changing the password is unaffected.** `revokeAllForUser` — a deliberate, unconditional
"end every session" — is a separate method, used only when the password changes. Reuse
detection no longer calls it.

## Consequences

- A stale request racing a legitimate rotation by less than 5 seconds is now silently absorbed
  instead of destroying the session it raced. This is the fix for #156.
- Reuse detected after the grace period still forces re-authentication everywhere the
  compromised token's lineage could reach, so theft response is intact — it is just no longer
  collateral damage for unrelated, later sign-ins.
- The grace period is a heuristic, not a guarantee: an attacker who replays a stolen token
  within 5 seconds of the legitimate client's own rotation is indistinguishable from that
  legitimate race and is let through as a collision rather than flagged as theft. 5 seconds was
  chosen as comfortably above realistic network/processing race windows and comfortably below
  a plausible attacker reaction time; it is not derived from a measurement.
- Every rejection — unknown, expired, superseded, or reused — logs one line naming the reason
  and the user (never the raw token, only a short hash prefix), so a session incident can be
  read from `docker logs` instead of the `RefreshToken` table (#160).

## Rejected alternatives

- **Read-then-write rotation (the original code).** Never atomic; rejected as the root cause
  of #159.
- **Atomic write, but treat every loser as reuse.** Simplest fix for the atomicity bug alone,
  but revokes the winner's session on every race — trades one flavor of #156 for another,
  discovered while writing the #160 logging tests.
- **No grace period; any revoked-token presentation is reuse.** Same failure as above by a
  different route: a token revoked one millisecond ago is not distinguishable from one revoked
  a month ago without some notion of "recently," so this collapses back to "every loser is
  theft."
- **Scope reuse revocation by walking the `replacedByTokenHash` chain instead of by time.**
  Would only reach direct descendants of the compromised token, not sessions independently
  started elsewhere with the same credentials — the time cutoff covers both without needing a
  chain walk.

## Related

[ADR-0001](0001-active-workout-lives-in-a-persistent-overlay.md) is the other ADR in this repo
that separates a "what happened" read from the write that acts on it. See `CONTEXT.md`'s
Anmeldung section for the vocabulary (Zugriffs-Cookie, Refresh-Token, Rotation,
Wiederverwendungserkennung) this decision is written in.
