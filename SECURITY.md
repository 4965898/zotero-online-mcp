# Security model

Report vulnerabilities privately through GitHub Security Advisories if the repository has private reporting enabled, otherwise contact the repository owner privately. Do not put credentials, exploit payloads containing real user data, or private library content into public issues.

## Credential and tenant boundaries

Zotero API keys are submitted only to `https://api.zotero.org`, stored with AES-256-GCM using the operator's 32-byte key, and never exposed to the MCP client. Service access and refresh tokens are random 256-bit values stored only as SHA-256 digests. The encryption key must be backed up separately from the SQLite volume; changing it without migration makes stored credentials unreadable and startup fails closed.

Each distinct Zotero key has a separate principal, including two keys for the same Zotero account. Sessions bind both principal and exact service token. Every HTTP request and every tool invocation validates current token state. Expired/revoked streams are closed during the 30-second maintenance cycle. Requests already sent upstream cannot be recalled.

OAuth uses explicit key-entry consent, a SameSite/HttpOnly CSRF cookie, exact registered redirect URIs, S256 PKCE, a fixed `/mcp` resource audience, single-use 60-second codes and rotating refresh tokens. The single `zotero` scope delegates the supplied key's permissions subject to the server write switch. OAuth 1.0a delegation to Zotero itself is not implemented; users create dedicated official API keys. Direct onboarding tokens and OAuth access/refresh tokens do not expire by default (`TOKEN_TTL_DAYS=0`): they remain valid until the token is revoked on the landing page, the connection is deleted, or the operator raises the service token TTL above zero, which restores bounded lifetimes. Revoking one token does not revoke other access/refresh tokens; delete the connection to revoke all its tokens and remove the saved key. Permanent tokens remove time-based exposure limits, so treat a leaked token as a long-lived credential and revoke it explicitly; the operator can set a positive `TOKEN_TTL_DAYS` on shared deployments to restore automatic expiry.

## Mutation protection

Write plans expire after 10 minutes, are encrypted at rest, bind to one principal and exact commands, and are consumed before network I/O. At most 20 pending plans per principal and 100 globally are allowed. Object updates/deletes use `If-Unmodified-Since-Version` or object versions in batch data. File replacements use `If-Match`; new files use `If-None-Match: *`. Full-text PUT has no Zotero version precondition and is documented as such. Responses report partial failure and uncertainty rather than attempting blind retries.

The confirmation token is a two-step workflow guard, not proof a human clicked a trusted approval button. The MCP client must enforce approval for `execute_write`; do not auto-approve it. Library text, imported notes, PDFs and provider metadata are untrusted content and must never grant permission to mutate a library.

## Network and resource controls

Fixed Zotero API origin, HTTPS-only allowlisted Zotero Storage redirects, no forwarded API credentials on storage requests, no arbitrary file-fetch URLs, bounded response/file sizes, rate limits, session caps/expiry, Origin and Host validation, CSP and no browser token persistence. TLS is mandatory for public origins. Tauri clients may need their exact Origin in `ALLOWED_ORIGINS`; never use a wildcard. Trust only the configured number of proxy hops and restrict app-port access.

PDF parsing occurs in isolated workers with a 30-second deadline, 256 MiB V8 heap budget, a 10-page request limit and two concurrent PDF operations. Native/external memory is additionally bounded by container memory limits. Semantic indices hold only per-principal library metadata/vectors in process memory for at most one hour, up to 20 indices / 500 entries each; query results are resolved live before returning metadata. External embedding requests require explicit tool-level consent and use an operator-fixed HTTPS endpoint. A malicious authorized operator can decrypt keys: encryption at rest does not remove the need to trust the host.

## Operational limits

This first release uses one Node process and a persistent local service SQLite database. This database stores service credentials/plans; it never opens the user's Zotero database. Multiple replicas, distributed rate limiting, distributed sessions, automatic schema migrations across releases, key rotation, billing, quotas per organization and enterprise abuse protection require additional design. Use an invitation code for private deployments.

Audit entries contain only principal UUID, tool, timestamp and outcome and are retained for 90 days. Do not enable proxy logs containing authorization headers or request bodies. Deleting a connection removes its stored credential, tokens and owned pending plans/codes; operational audit IDs remain until retention expiry, and backup retention is the operator's responsibility. Expired in-memory indices are logically unavailable and removed on subsequent builds or process restart. Do not treat deletion from the live database as backup erasure.
