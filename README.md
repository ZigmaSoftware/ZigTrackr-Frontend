# ZigTrackr frontend

React/Vite frontend for the ZigTrackr API. This directory is intended to be
its own Git repository; `.env`, `node_modules/`, and `dist/` are ignored.

```bash
npm ci
npm run dev
npm run lint
npm run test
npm run build
```

For production, serve `dist/` over HTTPS on the same browser origin as the
backend's `/api/` route. If a different API origin is required, set
`VITE_API_ROOT` at build time and configure Django CORS/CSRF origins and cookie
settings accordingly. The browser never connects directly to Redis.

## Login sessions

The backend supplies session deadlines with login and `/auth/me/`. Defaults:
30 minutes without interaction, a one-minute warning with Stay signed in, and
eight hours maximum before another login. Clicks, typing and scrolling send
throttled activity requests; API polling cannot keep the session alive.
Sleep/resume and hidden tabs check the original deadline rather than restarting
the timer. Same-origin tabs share activity (BroadcastChannel) and sign-out
(storage events); supported browsers serialize refresh rotation with Web Locks.

Manual logout redirects immediately, clears account queries, and revokes the
server session asynchronously. Failed server logout is reported, retried on
reconnect/reload, and a persistent signed-out flag prevents silent restoration.
No JWTs or account data are stored in browser storage. Deploy with the updated
backend and sign in again after restarting; old tokens require reauthentication.
The previous non-functional Remember me checkbox is replaced with an inactivity
sign-out notice; there is no longer an implied unlimited/persistent login option.

## Dashboard

The dashboard uses a compact, reference-inspired purple/teal design: four
ticket summary cards, a current-state signal strip, an animated bug trend
(7/14/30 days), an open-bug priority ring, tabbed My Work / Needs Attention
queues, module/workflow distributions, and recent ticket activity. Values come
from the API; there are no demo figures or invented growth percentages.

Summary cards and ticket queues cover bug, service and access requests. Bug
analytics remain explicitly labeled as bug-only; the time-window control
affects only the trend, not current summary counts. Recent activity uses the
Daily Updates API over the last seven days. Ticket rows open the existing
protected detail dialog without requiring navigation to an unrelated page.

Refresh reloads the active panels; queries have a 60-second stale time and do
not continuously poll. Links and queries respect the signed-in permissions.
Each panel has loading, empty, access-denied and error states. CSS/chart/count
animations respect reduced-motion preferences, with responsive light/dark
layouts. No extra dependencies or database migration are required.

## User Management

The Add/Edit user dialog contains username, email, full name, employee code,
phone, roles, and a password on creation. Designation, Department, Team, and
Site are not shown or sent, and their master-option requests are no longer
made by this page. Existing organization data remains available read-only
where it is used elsewhere (such as team visibility).

## Permission Management

The role matrix shows submodule names, not individual action rows. Ticket
Creation and Ticket Management are separate groups with independent page
checkboxes matching their sidebar entries (Create Ticket controls the header
button). Selecting a submodule grants its backend action bundle; workflow and
ownership restrictions remain in force. Mixed checkboxes indicate existing
partial access, which is preserved until explicitly changed. Only edited
bundles are submitted, so unrelated role grants are not overwritten.

Admin's Role Management and Permission Management checkboxes are protected;
view-only permission managers cannot edit the matrix. Search, group filtering,
collapsible groups and Reset are available. Saving refreshes the signed-in
user's permissions and sidebar. Apply backend migration
`accounts.0003_ticket_submodule_access` before deploying this frontend, then
refresh the browser. Ticket list requests include their `submodule` key for
backend page-gate and preset enforcement.

## Daily Updates

`/updates/today` uses the compact calendar approved in
`design-previews/daily-updates.html`, with real API data (not the preview's sample
records). Today is selected by default. The checkbox between Year and Today
switches to From–To selection: click the start date, then the end date. Both
dates are included; reversed selections are normalized. Today resets the
selection, category and search. Clear removes the selected dates.

All, Unassigned, Assigned, Rectified and Closed tabs show recorded ticket
activity across bug, service and access requests. Counts represent updates,
not distinct tickets or today's current statuses. Search and pagination apply
to the selected interval; clicking a ticket reference opens its details.
Dates and times use the backend's timezone, currently Asia/Kolkata. Access
requires both `bugs.update.view` and `tickets.ticket.view`.

## Unassigned Tickets

The centered three-dot row menu replaces the delete icon. **Not a Ticket** opens
a confirmation dialog: Cancel makes no change, and confirmation removes the
request without a deletion email. **Delete** opens a required-reason dialog;
confirmation removes the request and queues the reason for email to the sender.
Delivery uses the backend outbox; the UI distinguishes queued notices from
requests removed without an eligible address or enabled mail setting. Both
actions retain audit history and existing permissions/state restrictions.

The **Attachment** column follows Description. Its paperclip/count opens the
same requester-email file list used by ticket details, including original and
linked reply attachments. Internal uploads and rejected/unstored files are
excluded. Supported images, PDFs and text files can be previewed through the
protected backend endpoint; other document formats can be downloaded. Clicking
these controls does not open the row's assignment dialog.
