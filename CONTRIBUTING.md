# Contributing

Use Node.js 24, `npm ci`, then `npm run check`. Tests use in-memory SQLite and synthetic upstream responses and never require a Zotero account. A PDF test exercises the real parser against a generated one-page fixture.

## Two entry points, one tool registry

The same 82 tools serve two hosts:

- `src/stdio.ts` — the default local experience. One process per MCP client, credentials from
  `ZOTERO_API_KEY`, `server.ts` and the whole auth layer uninvolved.
- `src/server.ts` — an optional multi-tenant HTTP service with tokens, sessions and OAuth.

`src/mcp.ts` owns the MCP surface (tool listing, invocation, resources, prompts) and is imported by
both. **Never duplicate tool wiring into an entry point** — add it to `mcp.ts` or fix it there, or the
two modes drift apart.

`Plans` depends on the `PlanStore` interface (`src/plans.ts`), not on SQLite. `MemoryPlanStore` backs
stdio; `Store.planStore()` adapts the hosted database. Keep new persistence behind that interface.

Keep all Zotero traffic inside `src/zotero.ts`, scoped by the authenticated principal and explicit library. Never add local Zotero filesystem/database access. New tools need schema validation, honest pagination/coverage metadata, and bounded outputs. Add meaningful tests for new routes, failure modes, and any credential or tenancy boundary.

All Zotero writes must return an immutable preview through `Plans.prepare`. Only `execute_write` may submit a prepared mutation. Preserve version checks and do not automatically retry uncertain writes. Document any unavoidable lack of atomicity.

Register tools in `src/tools.ts` (Zotero core) or `src/extensions.ts` (metadata/import/PDF/semantic). Run `npm run docs:tools` to regenerate the tool catalog. Update the feature matrix when capabilities or limits change.

Do not submit keys, user data, `.env`, SQLite databases, request dumps or signed URLs. Keep third-party license notices when adapting source. Use a focused pull request describing the behavior and validation. No live-library write tests run in CI.
