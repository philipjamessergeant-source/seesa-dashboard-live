# SEESA Live Dashboard — Setup Instructions

## Step 1: Create GitHub Repository

1. Go to https://github.com/new
2. Create a new repository called `seesa-dashboard-live`
3. Under "Owner", select **philipjamessergeant-source**
4. Description: "SEESA live ads dashboard with date filtering"
5. Select **Public** (so Railway can access it)
6. Click **Create repository**

## Step 2: Clone & Add Files

On your computer (in Terminal):

```bash
# Clone the empty repo
git clone https://github.com/philipjamessergeant-source/seesa-dashboard-live.git
cd seesa-dashboard-live

# Copy all the files from the provided project into this directory
# (You'll get these files from Claude)

# Add all files to git
git add .

# Commit
git commit -m "Initial commit: SEESA live dashboard"

# Push to GitHub
git push origin main
```

## Step 3: Get Your API Keys

### Meta Access Token

1. Go to https://developers.facebook.com/apps
2. Select your SEESA app (or create one if needed)
3. Go to **Settings** → **Users and Roles**
4. Click **Get User Access Token**
5. Select permissions: `ads_management`, `business_management`
6. Copy the token (starts with `EAAB...`)

### HubSpot API Key

1. Go to https://app.hubspot.com/l/settings/api-keys
2. Click **Create new private app**
3. Give it a name: "SEESA Dashboard"
4. Under **Scopes**, enable:
   - `crm.objects.deals.read`
   - `crm.objects.line_items.read`
5. Click **Create app**
6. Go to the **Auth** tab
7. Copy the **Private App Access Token** (starts with `pat-...`)

## Step 4: Deploy to Railway

1. Go to https://railway.app
2. Click **Create New Project**
3. Select **Deploy from GitHub repo**
4. Authorize GitHub (if first time)
5. Select the `seesa-dashboard-live` repo
6. Click **Deploy**

Railway will start deploying. Once done:

7. Click on your project
8. Go to **Settings** → **Environment**
9. Add these variables:
   - **META_ACCESS_TOKEN**: Paste your Meta token from Step 3
   - **HUBSPOT_API_KEY**: Paste your HubSpot key from Step 3

Railway will auto-restart with the new environment variables.

## Step 5: Access Your Live Dashboard

In Railway, go to **Deployments** tab. You'll see your live URL, something like:

```
https://seesa-dashboard-xxxxx.up.railway.app
```

**That's your live dashboard!**

Open it in your browser. You should see:
- ✅ Date filter (Start Date / End Date)
- ✅ "Last 7 Days" / "Last Month" quick buttons
- ✅ "Load Data" button
- ✅ KPIs showing Meta spend, leads, closed deals
- ✅ Campaign table with live data
- ✅ Deals by source table
- ✅ GA4 Looker Studio link

## Step 6: Test It

1. Click **Last 7 Days** (or select dates manually)
2. Click **Load Data**
3. Dashboard should populate with live data from Meta & HubSpot
4. Try different date ranges

## Troubleshooting

**"No data available"?**
- Check API keys are correct in Railway settings
- Make sure Meta account ID is 1326328365076410
- Make sure HubSpot portal is 49403143

**Dashboard not loading?**
- Go to Railway → Logs tab
- Check for error messages
- Verify API tokens have not expired

**Need to update code?**
- Make changes locally
- `git add . && git commit -m "message"`
- `git push origin main`
- Railway auto-deploys (watch the Logs tab)

## Ongoing Use

Every time you visit the live URL:
1. Select a date range (or use quick buttons)
2. Click "Load Data"
3. Dashboard pulls live Meta + HubSpot data for that range
4. Results display instantly

---

**Questions?** Check the README.md for more details or review the code in server.js (backend) and public/index.html (frontend).
