# CropProof AI

CropProof AI is an independent, Telangana-focused crop-loss claim preparation tool. It helps farmers organize a crop-loss dossier before reporting through official channels; it is **not** a government, insurer, or claim-submission portal and does not determine coverage or guarantee compensation.

Farmers can describe an incident using Telugu or English voice and text intake, review extracted details, check daily rainfall against Open-Meteo (with clearly marked offline fallback estimates), organize field evidence, and download a SHA-256-stamped claim readiness PDF. Date-based 72-hour indicators are estimates when the exact incident time is unknown.

## Windows setup

Use two PowerShell terminals from the project root.

### Backend

```powershell
cd backend
py -3.12 -m venv .venv
.\.venv\Scripts\python.exe -m pip install --upgrade pip
.\.venv\Scripts\python.exe -m pip install -r requirements.txt
.\.venv\Scripts\Activate.ps1
uvicorn app.main:app --reload --port 8000
```

The backend API is available at `http://localhost:8000`. Open-Meteo rainfall lookup works without credentials. Gemini-powered extraction and audio transcription require a `GEMINI_API_KEY`; without it, deterministic intake parsing and the rest of the app remain available.

Optional Gemini setup for the current PowerShell session:

```powershell
$env:GEMINI_API_KEY = "your-key"
```

### Frontend

In the second terminal:

```powershell
cd frontend
npm.cmd install
npm.cmd run dev -- --host
```

Open the Vite URL printed in the terminal (typically `http://localhost:5173`). The development server proxies API requests to the backend on port `8000`.
If `VITE_API_URL` is not set, local development uses the Vite proxy; in a same-origin deployment, the frontend uses relative API URLs.

## 90-Second Demo Walkthrough

1. **Step 1 — Intake (0–20 seconds):** Select English or తెలుగు. Use a one-click Telangana sample scenario or enter a Telugu/English description; microphone access is optional. Review the provisional 72-hour status.
2. **Step 2 — Confirm (20–35 seconds):** Check the crop, incident, location, and date. Verify rainfall using GPS or the device location prompt. The panel labels readings as Open-Meteo verified or offline fallback.
3. **Step 3 — Guidance (35–50 seconds):** Review the suggested official reporting route, government portals, policy references, and PIB farmer examples. Past outcomes do not guarantee eligibility.
4. **Step 4 — Evidence (50–65 seconds):** Add field photos and supporting documents. Sample field photos can be used to exercise the upload flow.
5. **Step 5 — Dossier (65–90 seconds):** Review the dossier ID, generation time, and SHA-256 integrity hash; download the PDF. Use the bilingual next-steps checklist and copy/share the summary if useful.

## After the PDF

Report the loss promptly through PMFBY/your insurer and any applicable bank, CSC, or Agriculture Department channel. For eligible localized losses, the general PMFBY intimation window is 72 hours; confirm the applicable policy and event rules with official channels. Keep dated field photos, passbook/policy details, and supporting records ready, and record the official docket or acknowledgement number. If the date-based estimate shows that 72 hours have passed, report promptly and request review with supporting proof rather than treating this tool as an eligibility decision.

## Tests and production build

Run backend tests:

```powershell
cd backend
.\.venv\Scripts\python.exe -m pytest -v
```

Build the frontend:

```powershell
cd frontend
npm.cmd run build
```

## Render deployment

Deploy the backend as a **Web Service** and the frontend as a **Static Site**.

### FastAPI Web Service

- **Root Directory:** `backend`
- **Build Command:** `pip install -r requirements.txt`
- **Start Command:** `uvicorn app.main:app --host 0.0.0.0 --port $PORT`
- Equivalent build command when run from the repository root: `pip install -r backend/requirements.txt`.

Configure these environment variables in Render:

- `ALLOWED_ORIGINS`: the exact frontend origin, for example `https://cropproof-ai.onrender.com`. Multiple origins may be comma-separated. Use `*` only when intentionally allowing every origin.
- `GEMINI_API_KEY`: optional; required for Gemini-powered voice transcription and live extraction.
- `DATABASE_PATH`: optional. For persistence, attach a Render disk mounted at `/var/data` and set this to `/var/data/cropproof.db`. Without a persistent disk, SQLite data on the service filesystem may be lost on redeploy.

### Vite Static Site

- **Root Directory:** `frontend`
- **Build Command:** `npm ci && npm run build`
- **Publish Directory:** `dist`
- **Environment Variable:** `VITE_API_URL` set to the deployed backend origin, for example `https://cropproof-api.onrender.com` (no trailing slash).

Vite embeds `VITE_API_URL` at build time. The frontend falls back to relative URLs when it is unset, which works with the local Vite proxy or when frontend and backend are served from the same origin.
