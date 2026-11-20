# Saving builder problems in Google Drive

The builder keeps every problem on the device (browser storage) and, once Drive is connected, also as
`<title>.mrs-problem.json` files in the Google Drive folder **Mine Rescue Problems** (found by that exact name in
My Drive; created if it is missing). The app talks to Drive straight from the browser, so it needs a Google OAuth
client ID. This is a one-time setup.

## 1. Create the client ID (Google Cloud console)

1. Go to <https://console.cloud.google.com/>, create a project (any name, e.g. "Mine Rescue App").
2. APIs & Services → Library → enable **Google Drive API**.
3. APIs & Services → OAuth consent screen → External. Fill in the app name and your email. Add the scope
   `https://www.googleapis.com/auth/drive`. Under **Test users** add the Google account(s) that will use the app.
   (While the app is in "Testing" only those accounts can sign in; that is fine for personal use.)
4. APIs & Services → Credentials → Create credentials → **OAuth client ID** → type **Web application**.
   Under **Authorized JavaScript origins** add every place the app runs from, for example:
   - `http://localhost:5173` (npm run dev)
   - `http://localhost:4173` (npm run preview)
   - `https://osmit2002-cmd.github.io` (the hosted site)
5. Copy the client ID (it ends in `.apps.googleusercontent.com`). It is not a secret.

## 2. Give it to the app

Either:

- In the builder, open **Drive → Google client ID…** and paste it (kept in that browser only), or
- Build it in: put `VITE_GOOGLE_CLIENT_ID=<the id>` in a `.env.local` file for local runs, and/or add a repository
  variable of the same name for the Pages build.

Then **Drive → Connect and sync**. Google shows its sign-in and consent screen (with an "unverified app" notice
while the app is in Testing: choose Continue).

## How syncing works

- **Connect and sync / Sync now**: reads every problem file in the folder, merges it with the problems on this
  device (the copy with the newer `updated` time wins) and uploads what Drive is missing or has older.
- While connected, an edited problem is written to Drive a few seconds after the last change.
- **Save** names an unnamed problem and writes it to Drive at once.
- **Delete** removes the problem here and moves its Drive file to the Drive trash (recoverable for 30 days).
- Files in the folder that are not problem files are ignored. The full `drive` scope is used so the app can also
  read problem files that were put in the folder by hand.
