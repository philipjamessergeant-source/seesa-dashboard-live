require('dotenv').config();
const express = require('express');
const fetch = require('node-fetch');
const app = express();

app.use(express.static('public'));
app.use(express.json());

const SEESA_META_ACCOUNT = '1326328365076410';
const SEESA_HUBSPOT_PORTAL = '49403143';

// Helper: fetch Meta Ads data
async function fetchMetaCampaigns(startDate, endDate) {
  try {
    const url = `https://graph.facebook.com/v18.0/${SEESA_META_ACCOUNT}/campaigns?fields=id,name,amount_spent,impressions,reach,clicks,ctr,cpm,results,cost_per_result,objective,effective_status&access_token=${process.env.META_ACCESS_TOKEN}&time_range={"since":"${startDate}","until":"${endDate}"}&limit=100`;
    
    const res = await fetch(url);
    const data = await res.json();
    return data.data || [];
  } catch (err) {
    console.error('Meta API error:', err);
    return [];
  }
}

// Helper: fetch HubSpot closed deals
async function fetchHubSpotDeals(startDate, endDate) {
  try {
    const url = `https://api.hubapi.com/crm/v3/objects/deals/search`;
    
    const body = {
      filterGroups: [{
        filters: [
          { propertyName: 'dealstage', operator: 'EQ', value: 'closedwon' },
          { propertyName: 'closedate', operator: 'GTE', value: new Date(startDate).getTime() },
          { propertyName: 'closedate', operator: 'LTE', value: new Date(endDate).getTime() }
        ]
      }],
      properties: ['dealname', 'amount_in_home_currency', 'deal_currency_code', 'hs_analytics_source', 'closedate'],
      limit: 100
    };

    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.HUBSPOT_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(body)
    });

    const data = await res.json();
    return data.results || [];
  } catch (err) {
    console.error('HubSpot API error:', err);
    return [];
  }
}

// API endpoint: get dashboard data for date range
app.post('/api/dashboard-data', async (req, res) => {
  const { startDate, endDate } = req.body;

  if (!startDate || !endDate) {
    return res.status(400).json({ error: 'startDate and endDate required' });
  }

  try {
    const [metaCampaigns, hubspotDeals] = await Promise.all([
      fetchMetaCampaigns(startDate, endDate),
      fetchHubSpotDeals(startDate, endDate)
    ]);

    // Process Meta data
    let totalMetaSpend = 0;
    let totalMetaLeads = 0;
    let totalMetaImpressions = 0;
    const campaigns = metaCampaigns.filter(c => c.effective_status === 'ACTIVE').map(c => {
      totalMetaSpend += parseFloat(c.amount_spent?.replace('ZAR', '').replace(/,/g, '') || 0);
      const leads = c.results?.value ? parseInt(c.results.value.split(' ')[0]) : 0;
      totalMetaLeads += leads;
      totalMetaImpressions += parseInt(c.impressions || 0);
      return {
        id: c.id,
        name: c.name,
        spend: c.amount_spent,
        impressions: c.impressions,
        clicks: c.clicks,
        ctr: c.ctr,
        cpm: c.cpm,
        leads: leads,
        cpl: c.cost_per_result?.value || '—',
        status: c.effective_status
      };
    });

    // Process HubSpot data
    let totalDeals = 0;
    let totalDealValue = 0;
    const dealsBySource = {};
    const dealsByProduct = {};
    
    hubspotDeals.forEach(deal => {
      totalDeals++;
      const value = deal.properties.amount_in_home_currency || 0;
      totalDealValue += value;
      
      const source = deal.properties.hs_analytics_source || 'Other';
      dealsBySource[source] = (dealsBySource[source] || 0) + 1;
      
      dealsByProduct[deal.properties.dealname] = (dealsByProduct[deal.properties.dealname] || 0) + 1;
    });

    res.json({
      dateRange: { startDate, endDate },
      meta: {
        totalSpend: totalMetaSpend.toFixed(2),
        totalLeads: totalMetaLeads,
        totalImpressions: totalMetaImpressions,
        campaigns: campaigns
      },
      hubspot: {
        totalDeals: totalDeals,
        totalDealValue: totalDealValue.toFixed(2),
        dealsBySource: dealsBySource,
        dealsByProduct: dealsByProduct
      }
    });
  } catch (err) {
    console.error('Error fetching dashboard data:', err);
    res.status(500).json({ error: 'Failed to fetch dashboard data' });
  }
});

// Serve frontend
app.get('/', (req, res) => {
  res.sendFile(__dirname + '/public/index.html');
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`SEESA Dashboard running on port ${PORT}`);
});
