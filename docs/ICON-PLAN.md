# BeyondFog 网站图标修正

Approved in-chat plan, 2026-10-05. All shortcuts use a shared component in the homepage and settings. Browser reads HTTPS original-site /favicon.ico with no-referrer; no third-party service, page scraping, upload, new dependency, API, schema or migration. Original colors, fixed size, existing glass tiles. Initials during loading, errors and for HTTP shortcuts; changing URL resets image state and changing title updates initials. Static and Worker CSP allow HTTPS images only, other restrictions unchanged.

Task 1: Write browser regressions and observe RED; implement shared icon and CSP; verify default/random-ID/JD, URL and title edits, pending/failing images, HTTP and mobile. Run typecheck, unit suite, full browser suite and build. Fresh review of this change. Deploy Cloudflare, verify actual live favicon loading and preserve prior deployment 2b53c607-1edb-4fb1-af3b-e99c53ea786a.

No separate spec file: approved user message is the binding spec. Scope does not include arbitrary favicon discovery; websites without a usable root favicon show initials.
