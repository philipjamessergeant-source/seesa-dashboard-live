# SEESA Ads Dashboard — Live

A real-time SEESA ads dashboard with date filtering, pulling live data from Meta Ads and HubSpot.

## Features

- ✅ Date picker (filter data by any date range)
- ✅ Live Meta campaigns data (spend, leads, CTR, CPM)
- ✅ Live HubSpot closed-won deals (by source, by count)
- ✅ GA4 link to Looker Studio dashboard
- ✅ Deployed on Railway, updated in real-time

## Setup

### 1. Clone the repo

```bash
git clone https://github.com/philipjamessergeant-source/seesa-dashboard-live.git
cd seesa-dashboard-live
```

### 2. Install dependencies

```bash
npm install
```

### 3. Create `.env` file

Copy `.env.example` to `.env` and fill in your API keys:

```bash
cp .env.example .env
```

Edit `.env`:

```
META_ACCESS_TOKEN=your_meta_access_token
HUBSPOT_API_KEY=your_hubspot_api_key
PORT=3000
```

**Get your API keys:**

- **Meta Access Token**: https://developers.facebook.com/apps → Your App → Settings → Users and Roles → Get a User Access Token with `ads_management` scope
- **HubSpot API Key**: https://app.hubspot.com/l/settings/api-keys → Create new private app

### 4. Run locally

```bash
npm start
```

Visit `http://localhost:3000`

### 5. Deploy to Railway

1. Create a GitHub repo under `philipjamessergeant-source`
2. Push this code to GitHub
3. Go to https://railway.app
4. Create new project → Deploy from GitHub repo
5. Add environment variables in Railway settings (META_ACCESS_TOKEN, HUBSPOT_API_KEY)
6. Railway auto-deploys and gives you a live URL

## API Endpoints

### POST `/api/dashboard-data`

Request:
```json
{
  "startDate": "2026-07-01",
  "endDate": "2026-07-07"
}
```

Response:
```json
{
  "dateRange": {...},
  "meta": {
    "totalSpend": "16073.45",
    "totalLeads": 133,
    "totalImpressions": 251000,
    "campaigns": [...]
  },
  "hubspot": {
    "totalDeals": 64,
    "totalDealValue": "86342.00",
    "dealsBySource": {...}
  }
}
```

## Architecture

- **Backend**: Node.js + Express
- **APIs**: Meta Graph API + HubSpot CRM API
- **Frontend**: HTML/JS with date picker
- **Hosting**: Railway (auto-deploy from GitHub)

## Notes

- Data is filtered by date range selected in the UI
- Meta data filtered by `time_range` parameter
- HubSpot deals filtered by `closedate` property
- Active campaigns only (paused campaigns hidden)

---

**Live Dashboard URL:** (After deployment on Railway, you'll get a URL like `https://seesa-dashboard.up.railway.app`)
