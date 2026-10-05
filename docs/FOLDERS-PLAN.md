# BeyondFog 文件夹捷径模式

Approved 2026-10-05 in chat. Default flat, optional folder mode in settings/shortcuts; max100 websites,20 single-level folders. Custom folder CRUD, explicit delete confirmation moves sites to virtual unclassified; membership editor; folder/site drag and button ordering. One hovering popup:120ms open/250ms leave,180ms in/120ms out, reduced motion; down then up fallback, viewport clamp, desktop4/mobile3 columns. Keyboard disclosure/Tab/Escape and mobile taps. Close when settings opens, mode changes, identity changes. Preserve URLs/icons/order and cross-device versioned sync.

Task1: schema compatibility and legacy PUT409 guard, tests RED/GREEN, deploy flat bridge and record compatible rollback version. No D1 table migration.
Task2: extract shortcut settings and homepage folders, unit/browser regressions for CRUD/order/hover/focus/touch/edges/capacity and sync/conflict/clear; full checks and fresh review.
Task3: deploy final, real live acceptance and bridge rollback/redeploy verification. Stay on existing feature branch and free Cloudflare resources.
