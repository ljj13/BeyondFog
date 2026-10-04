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
Final: fixed asset-first HTML missing security/privacy headers — static-header test RED→GREEN and public/_headers added; production HTTPS response verifies CSP, no-referrer and frame denial.
Final: Ruling: promote the reviewer capacity finding from Minor to Important — an enabled action caused an uncaught save failure at the stated collection boundary, so it requires visible prevention and error handling. Cost if wrong: two small UI guards and a regression test.

Final: Ruling: real WebDAV acceptance remains an external gate — mocks validate byte preservation and failure boundaries but cannot prove owner provider interoperability/slow transfer. Cost if wrong: provider issues could remain until the owner configures a real endpoint.
Final: Ruling: bootstrap and actual reset delivery require production checks — the owner successfully created fogpurification@gmail.com via hidden-input script; remote D1 shows the matching verified account. Production rejects a wrong password; the real reset-email request succeeded, but owner login, receipt and link consumption await owner confirmation. Cost if wrong: mail delivery or browser differences could block production auth until tested.
Final: Ruling: account billing cannot be inferred from configuration — OAuth subscription read returned 403; all operations so far create only free-compatible services and never request upgrades. Cost if wrong: if account already has an unrelated paid Workers subscription, free-allowance goals alone do not establish account billing status; owner must verify Workers plan in control panel.

Deployment progress: Cloudflare OAuth confirmed, D1 created/migrated, two Worker Secrets created without printing, free Email Routing enabled, Gmail destination verified, domain active and public NS match guy.ns.cloudflare.com / uma.ns.cloudflare.com. Production initial password was entered by owner, not sent to chat.

Final verification: 49 unit tests and 15 live Playwright tests passed after all review fixes. Type checking and production build passed before publication. All reviewer findings were fixed; no deferred minor findings. Production acceptance remains distinct from these local results.

Published: https://beyondfog.cc.cd — functional deployment ae7696be-7136-4225-9ad7-393a478477c7 at 2026-10-04T17:37:26Z (2026-10-05 in Singapore). Worker startup 28 ms; uploaded code 1666 KiB, gzip 365.55 KiB. Worker startup is not authentication request CPU usage.

Production smoke: HTTPS homepage and JS resource return 200; private owner email absent from client bundle; CSP/no-referrer/frame denial present; anonymous session is null; preferences and WebDAV connection/files return 401 with no-store; public signup returns 403; wrong owner password returns 401 (472 ms round trip, not CPU time). One actual reset-email request returned 200. No production password or WebDAV application password is known to this agent.

Production browser: Chromium loaded the custom domain and wallpaper on desktop (1440×900) and mobile (390×844), with zero page errors and no horizontal overflow. Inspected screenshots are in ignored .artifacts/production-desktop.png, production-settings.png and production-mobile.png.

Production metrics snapshot: Cloudflare GraphQL reported 10 Worker requests, 0 errors and CPU quantiles P50=914 µs/P99=1092 µs for the entry Worker. Durable Object datasets returned no records yet; these entry metrics do not establish password-hashing CPU usage. Confirm DO authentication CPU and streaming resource usage after real owner login/WebDAV activity. Metrics source: https://developers.cloudflare.com/durable-objects/observability/metrics-and-analytics/ and https://developers.cloudflare.com/analytics/graphql-api/tutorials/querying-workers-metrics/.

Remaining external acceptance: owner confirms login plus Gmail receipt/reset/reuse rejection; owner configures real WebDAV and verifies upload/selection/original byte fidelity/provider failures; owner confirms Workers Free in dashboard because subscription read is forbidden; check populated DO metrics and streamed image limits. Questions have been sent to the owner. Do not mark these gates passed merely because deployment or local tests succeeded.

Ruling: keep feat/beyondfog in the supplied repository, with no merge or push — there is no remote or pre-existing base branch and the requested deliverable is the deployed site. Cost if wrong: future collaboration needs a user-chosen remote/base branch.

Rollback baseline: ae7696be-7136-4225-9ad7-393a478477c7 is the first functional site version; earlier secret-bootstrap deployments contain an empty placeholder Worker. Retain this functional version for subsequent rollback. Cost if wrong: rolling back the first release to a placeholder would take the site offline rather than restore a working prior site.

## Engine dropdown correction — user-approved plan, 2026-10-05

Baseline: d7daab5. Owner now confirms real production login, Gmail receipt and password reset succeeded.
Tasks: test shared picker interactions; implement accessible glass picker in homepage/settings; verify regression suite and responsive rendering; one fresh review; deploy and inspect the live menu.
Pre-flight: both selectors read/write the same Preferences.engine through the existing edit/autosave path; browser tests must use visible interaction instead of native selectOption. Modal Escape listener is on document, so an open picker must consume Escape before it reaches that listener.
Ruling: continue in the existing feat/beyondfog checkout and use this ledger — it is the feature workspace already used for this personal deployment; preserve the current functional deployment for rollback. Cost if wrong: a future unrelated feature would need its own branch/worktree.
Ruling: implement the fixed three-option picker directly without new dependencies — matches the approved plan and existing React/Lucide stack. Cost if wrong: accessibility and popup positioning require explicit browser verification instead of relying on a component library.
Task 1: complete — the new visible-listbox test failed against the native select as expected. New browser coverage checks confirmation/cancellation, outside/toggle dismissal, no accidental search, first Escape consumption within Modal, touch targets and popup clipping boundaries.
Task 2: complete — shared EnginePicker wired to both existing preference editors; engine API/schema unchanged; inline listbox stays inside the modal for focus and accessibility. Menu measures the viewport and panel scrollport and flips above when required. Updated search/sync tests use visible selections rather than selectOption.
Task 3: complete — npm run typecheck and npm run build passed; npm test: 49/49; npm run test:e2e: 20/20. Screenshots inspected at desktop, mobile and compact 640×360 viewport; no horizontal overflow. Reduced-motion screenshots avoid capturing an intermediate opening-animation frame.
Final review: one fresh read-only reviewer checked d7daab5..c6cf6a4. One Important issue: clicking popup padding/scrollbar could blur the trigger and close the list. No Critical or Minor findings; no second review.
Final: fixed popup pointer interaction prematurely closing on trigger blur — compact-settings regression observed RED, then GREEN after preserving pointer interaction until release and restoring trigger focus without scrolling. Native scrollbar test additionally verifies actual scrollTop movement, selecting the hidden option, Escape and Tab. Headless Chromium hides scrollbars by default; this test file explicitly exposes native scrollbars, and the drag starts on the thumb rather than Windows' up-arrow button.
Final: Ruling: NVDA/VoiceOver, Safari touch and actual pinch zoom remain unverified — Chromium keyboard/touch/accessibility semantics plus compact/high-density viewport checks are evidence only for those tested environments; do not claim full assistive-technology/browser certification. Cost if wrong: platform-specific interaction differences would need a follow-up check on that device.
Final: Cloudflare deployment and rollback readiness will be checked directly after the local review, using the prior functional version ae7696be-7136-4225-9ad7-393a478477c7 as the preserved rollback target.
Final verification after the single fix pass: npm test 49/49; npm run test:e2e 21/21 (55.9 seconds), including actual native-scrollbar dragging with visible scroll movement. All review findings addressed, no deferred minors.
