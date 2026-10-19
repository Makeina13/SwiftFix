# SwiftFix – Meadow House Repairs

**Swift service, smarter solutions.** A browser app for reporting, tracking and completing repairs at the fictional Meadow House. Built for the Omega Digital hackathon (19 Oct 2026).

## Run it

No build step and no dependencies. Either:

- open `index.html` in a browser, or
- serve the folder, e.g. `python3 -m http.server 8000` and visit http://localhost:8000

## Using it

1. Pick **Care Staff** or **Maintenance Staff** and enter any fictional name (no password).
2. Care staff: **Report an Issue** → fill in description, reporter name, Normal/Urgent priority (photo is optional) → Submit.
3. Maintenance staff: open the job → **Start Work** (or **Accept Job** from New Jobs) → **Save Progress Update** → **Mark as Completed** (a non-blank completion note is required).
4. Settings → Help & Support has optional **Load demo data** and **Reset all data** buttons.

## How it works

- Plain HTML/CSS/JS (`index.html`, `styles.css`, `app.js`).
- All data is saved in the browser's **localStorage** (key `swiftfix_v1`). Care and maintenance portals share the same job store, so refreshing keeps everything.
- Every job has its own automatic ID (SF-1001, SF-1002…), date, fixed house "Meadow House", priority, status, notes and an append-only timestamped history.
- Typed text is always inserted as plain text (never as HTML), so `<b>check gate</b>` displays literally.
- No paid services, API keys or accounts. The chat helper is a scripted demo, not an AI service. All people and data are fictional.
