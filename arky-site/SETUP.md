# Arky Creator Hub: setup guide

## What's in this folder

```
index.html        the website (open with #edit at the end of the address to customize)
api/twitch.js     gets live status, the latest broadcast and top clips from Twitch
api/youtube.js    gets the newest YouTube uploads (no key needed)
SETUP.md          this guide
```

The `api` folder only runs on **Vercel**. On other hosts the site still works, but it falls back to the basic YouTube playlist and a "Browse clips" button.

---

## 1. Put the files on GitHub

1. Create a new repository at github.com, e.g. `arky-site`.
2. **On a computer:** unzip the folder and drag everything (including the `api` folder) into **Add file → Upload files**.
3. **On a phone:**
   - Upload `index.html` and `SETUP.md` with **Add file → Upload files**.
   - For each API file, tap **Add file → Create new file**. Type `api/twitch.js` as the name (the slash makes the folder), paste in the file's contents, and commit.
   - Do the same for `api/youtube.js`.

## 2. Deploy on Vercel

1. Sign in at vercel.com with GitHub.
2. Choose **Add New → Project**, pick `arky-site`, and select **Deploy**. You don't need to change any settings.

The YouTube previews start working right away.

## 3. Connect Twitch (needed for clips and live status)

1. Go to https://dev.twitch.tv/console/apps and sign in. Twitch requires two-factor authentication to be on for this.
2. Select **Register Your Application** and fill it in:
   - **Name:** anything unique, e.g. `arky-site-hub`
   - **OAuth Redirect URLs:** `http://localhost` (it isn't used)
   - **Category:** Website Integration
   - **Client type:** Confidential
3. Open the app with **Manage**. Copy the **Client ID**, then select **New Secret** and copy the secret.
4. In Vercel, open your project and go to **Settings → Environment Variables**. Add:
   - `TWITCH_CLIENT_ID` = the Client ID
   - `TWITCH_CLIENT_SECRET` = the secret
5. Go to **Deployments**, open the menu (⋯) on the latest one, and select **Redeploy**.

Keep the secret private. It only lives in Vercel, never in index.html, so visitors can't see it.

## 4. Check it

Open `your-site.vercel.app/#edit`, then go to the **Media** tab. Both lines should be green:

- **Twitch:** "✓ Connected — 6 clips found"
- **YouTube:** "✓ Connected — latest: …"

## Updating later

- **Clips, live status and new videos update on their own.** Twitch data refreshes every couple of minutes and YouTube every 10 minutes.
- **To change anything else,** open `/#edit`, customize, select **Download site**, then upload the new `index.html` over the old one on GitHub. Vercel redeploys within a minute.
- **Custom domain:** in Vercel, go to **Settings → Domains**.
