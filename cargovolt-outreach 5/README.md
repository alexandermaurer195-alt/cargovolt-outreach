# CargoVolt — Carrier Outreach App

Carrier outreach tool for flatbed, step deck, and last-mile freight. Compose email blasts, manage carrier lists, track replies, and configure auto-replies.

---

## Deploy to Vercel (5 minutes)

1. Go to [vercel.com](https://vercel.com) and sign up (free — use Google or GitHub)
2. Click **Add New Project**
3. Choose **"Deploy from file upload"** or drag this folder in
4. Click **Deploy**

You'll get a live URL like `cargovolt-outreach.vercel.app` in about 60 seconds.

To use a custom domain (e.g. `outreach.cargovolt.com`), go to your project settings in Vercel → Domains → Add.

---

## Connect Outlook (Microsoft Graph API)

This unlocks real email sends, reply tracking, and auto-reply.

### Step 1 — Register an Azure app

1. Go to [portal.azure.com](https://portal.azure.com) and sign in with your Microsoft 365 account
2. Search for **"App registrations"** → click **New registration**
3. Name it `CargoVolt Outreach`
4. Under **Redirect URI**, choose **Single-page application (SPA)** and enter your Vercel URL (e.g. `https://cargovolt-outreach.vercel.app`)
5. Click **Register** and copy the **Application (client) ID**

### Step 2 — Add permissions

1. Go to **API permissions** → **Add a permission** → **Microsoft Graph**
2. Add **Delegated permissions**:
   - `Mail.Send`
   - `Mail.Read`
   - `User.Read`
3. Click **Grant admin consent**

### Step 3 — Add your Client ID to the app

In `app.js`, find the `connectOutlook()` function and replace the placeholder with your MSAL.js integration:

```js
const msalConfig = {
  auth: {
    clientId: "YOUR_CLIENT_ID_HERE",
    authority: "https://login.microsoftonline.com/common",
    redirectUri: "https://your-vercel-url.vercel.app"
  }
};
```

Then use `@azure/msal-browser` to authenticate and call:
```
POST https://graph.microsoft.com/v1.0/me/sendMail
```

---

## CSV format

Your carrier list should have these columns (header names are flexible):

| carrier_name | email | market |
|---|---|---|
| J&T Trucking | dispatch@jt-trucking.com | Atlanta |
| Blue Ridge Carriers | ops@blueridgecarriers.com | Charlotte |

- `email` column is required
- `carrier_name` and `market` are optional but recommended
- Save as `.csv` (UTF-8) for best compatibility

---

## Files

```
index.html   — app shell and markup
style.css    — all styling (CargoVolt navy/gold palette)
app.js       — all logic (tab nav, file parsing, send simulation, settings)
README.md    — this file
```
