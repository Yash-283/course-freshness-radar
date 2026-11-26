# Course Freshness Radar – React dashboard

Source code of the dashboard UI. It is built into the project's `public/` folder,
which the existing Express server (`src/server.js`) serves. No server changes are needed.

## Build (after any UI change)
    cd dashboard-react
    npm install        # first time only
    npm run build      # writes the dashboard into ../public

Then start the dashboard as usual from the project folder: `npm run dashboard`.

## Develop with live reload (optional)
1. In one terminal (project folder): `npm run dashboard`   (API on port 3100)
2. In another terminal: `cd dashboard-react` then `npm run dev`
3. Open http://localhost:5173 – API calls are forwarded to port 3100.

## Structure
- `src/App.jsx` – layout (sidebar, top bar, Run now), page switching
- `src/RunPanel.jsx` – live pipeline tracker for "Run now"
- `src/pages/` – Overview, Flags, FlagDetail, News, Emails
- `src/ui.jsx` – shared pieces (score ring, badges, vendor icons)
- `src/api.js`, `src/useApi.js`, `src/router.js` – API calls, data loading, #/ routing
- `src/styles.css` – all styling
