# BeyondFog implementation ledger — approved plan from this chat

Tasks: foundation and security tests; authentication and D1; WebDAV; frontend and sync; end-to-end verification; deployment preparation and review.

Pre-flight: frontend and API share preferences types and revision conflicts; WebDAV image paths are scoped to encrypted owner connection; authentication guards all private routes.

Ruling: initialize a new repository on feat/beyondfog directly in the empty user workspace — no pre-existing branch or files need isolation; a second worktree would hide the deliverable.

Ruling: deploy directly to Cloudflare, not Sites — user explicitly selected Cloudflare hosting.

Ruling: preserve uploaded original images in user WebDAV, no R2 or Cloudflare image storage — accepted scope correction.

Ruling: WebDAV destinations require an exact deployment allowlist (default Nutstore) in addition to saved connection/path validation — prevents DNS-based SSRF into infrastructure; custom public providers remain supported by adding their hostname. Cost if wrong: one deployment to permit another provider.

Ruling: pin compatibility date to 2026-10-01 — installed workerd rejects 2026-10-05 as unsupported. Cost if wrong: upgrade runtime and explicitly test newer compatibility semantics.

Task 1: complete — security/search/crypto stubs produced 8 expected failures, implementation passed 28 tests. Dependencies exactly pinned with package-lock.
Task 2: complete — D1 schema, native Better Auth and SQLite DO guards/limits; real SQLite auth verifies secure cookies, disabled signup, reset expiration, single consumption including simultaneous attempts, and revoked sessions. Live Worker verifies unauthorized access and version CAS.
Task 3: complete in code — listing/stream tests RED→GREEN; WebDAV mock integration verifies original bytes, unknown Content-Length, timeouts, auth errors, 429, manual redirects, unique uploads and scoped partial cleanup. Real owner provider pending.
Task 4: complete — responsive homepage and settings, auth forms, shortcut CRUD/drag/button ordering, preference autosave/focus refresh and conflict preservation. Desktop/mobile screenshots inspected in .artifacts.
Task 5: first full verification passed 48 unit tests + 10 live Playwright tests. A local simulator crash was traced to editing wrangler configuration during a running suite; unchanged-source suite passed all tests. Keep config/code writes separate from browser test runs.

Final review: one fresh read-only reviewer examined 463afd3..7fec126. No Critical issue; 3 Important issues and one capacity issue. No second reviewer.
Final: fixed delayed stale GET replacing newer saved data — delayed-focus-snapshot test RED→GREEN; fenced refresh order, edit sequence and accepted revision.
Final: fixed logout dropping debounced / in-flight newer edits — both logout-drain tests RED→GREEN; final save drains before signout; failures retain drafts and require explicit discard.
Final: fixed asset-first HTML missing security/privacy headers — static-header test RED→GREEN and public/_headers added; deployed response still to verify.
Final: Ruling: promote the reviewer capacity finding from Minor to Important — an enabled action caused an uncaught save failure at the stated collection boundary, so it requires visible prevention and error handling. Cost if wrong: two small UI guards and a regression test.

Final: Ruling: real WebDAV acceptance remains an external gate — mocks validate byte preservation and failure boundaries but cannot prove owner provider interoperability/slow transfer. Cost if wrong: provider issues could remain until the owner configures a real endpoint.
Final: Ruling: bootstrap and actual reset delivery require production checks — the owner has now successfully created fogpurification@gmail.com via hidden-input script; remote D1 shows the matching verified account. Real mail and login remain pending deployment. Cost if wrong: email/domain/runtime differences could block production auth until tested.
Final: Ruling: account billing cannot be inferred from configuration — OAuth subscription read returned 403; all operations so far create only free-compatible services and never request upgrades. Cost if wrong: if account already has an unrelated paid Workers subscription, free-allowance goals alone do not establish account billing status; owner must verify Workers plan in control panel.

Deployment progress: Cloudflare OAuth confirmed, D1 created/migrated, two Worker Secrets created without printing, free Email Routing enabled, Gmail destination verified, domain active and public NS match guy.ns.cloudflare.com / uma.ns.cloudflare.com. Production initial password was entered by owner, not sent to chat. Actual publish, document headers/HTTPS, reset email and real WebDAV acceptance remain to record.
