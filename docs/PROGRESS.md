# BeyondFog implementation ledger — approved plan from this chat

Tasks: foundation and security tests; authentication and D1; WebDAV; frontend and sync; end-to-end verification; deployment preparation and review.

Pre-flight: frontend and API share preferences types and revision conflicts; WebDAV image paths are scoped to encrypted owner connection; authentication guards all private routes.

Ruling: initialize a new repository on feat/beyondfog directly in the empty user workspace — no pre-existing branch or files need isolation; a second worktree would hide the deliverable.

Ruling: deploy directly to Cloudflare, not Sites — user explicitly selected Cloudflare hosting.

Ruling: preserve uploaded original images in user WebDAV, no R2 or Cloudflare image storage — accepted scope correction.

External prerequisites: Cloudflare authorization, exact Gmail address and verified email destination, DNSHE nameserver update, and user WebDAV connection. Local work continues independently.
