require('dotenv').config();
const express = require('express');
const fetch = require('node-fetch');
const app = express();

app.use(express.static('public'));
app.use(express.json());

const SEESA_META_ACCOUNT = '1326328365076410';
const SEESA_HUBSPOT_PORTAL = '49403143';

// Helper: fetch Meta Ads data BY DATE RANGE using campaigns with time_range
async function fetchMetaCampaigns(startDate, endDate) {
  try {
    // Use campaigns endpoint with time_range for date filtering
    // Format: {"since":"YYYY-MM-DD","until":"YYYY-MM-DD"}
    const timeRange = JSON.stringify({since: startDate, until: endDate});
    const encodedRange = encodeURIComponent(timeRange);
    
    const url = `https://graph.facebook.com/v18.0/act_${SEESA_META_ACCOUNT}/campaigns?fields=id,name,amount_spent,impressions,reach,clicks,ctr,cpm,results,cost_per_result,objective,effective_status,status&time_range=${encodedRange}&access_token=${process.env.META_ACCESS_TOKEN}&limit=100`;
    
    console.log(`[META] Requesting campaigns with time_range: ${startDate} to ${endDate}`);
    const res = await fetch(url);
    const data = await res.json();
    
    console.log(`[META] Response status: ${res.status}`);
    
    if (!res.ok || data.error) {
      console.error('[META] API Error:', data.error?.message);
      return [];
    }
    
    const campaigns = (data.data || []).map(c => {
      const spend = parseFloat(c.amount_spent || 0);
      const impressions = parseInt(c.impressions || 0);
      const clicks = parseInt(c.clicks || 0);
      const results = c.results?.value ? parseInt(c.results.value.split(' ')[0]) : 0;
      
      return {
        id: c.id,
        name: c.name || 'Unknown',
        amount_spent: spend,
        impressions: impressions,
        clicks: clicks,
        reach: parseInt(c.reach || 0),
        results: results,
        effective_status: c.effective_status || 'PAUSED',
        ctr: impressions > 0 ? `${((clicks / impressions) * 100).toFixed(2)}%` : '—',
        cpm: impressions > 0 ? `R${(spend / (impressions / 1000)).toFixed(2)}` : '—',
        cost_per_result: results > 0 ? `R${(spend / results).toFixed(2)}` : '—'
      };
    });
    
    console.log(`[META] Fetched ${campaigns.length} campaigns for ${startDate} to ${endDate}`);
    return campaigns;
  } catch (err) {
    console.error('[META] Exception:', err.message);
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
      const spend = parseFloat((c.amount_spent || '0').toString().replace('ZAR', '').replace(/,/g, '')) || 0;
      totalMetaSpend += spend;
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
      const value = parseFloat(deal.properties.amount_in_home_currency) || 0;
      totalDealValue += value;
      
      const source = deal.properties.hs_analytics_source || 'Other';
      dealsBySource[source] = (dealsBySource[source] || 0) + 1;
      
      dealsByProduct[deal.properties.dealname] = (dealsByProduct[deal.properties.dealname] || 0) + 1;
    });

    const paidDeals = (dealsBySource['PAID_SOCIAL'] || 0) + (dealsBySource['PAID_SEARCH'] || 0);
    const paidDealValue = paidDeals * 1200; // Estimate ~R1,200 avg deal value
    
    res.json({
      dateRange: { startDate, endDate },
      meta: {
        totalSpend: (totalMetaSpend || 0).toFixed(2),
        totalLeads: totalMetaLeads || 0,
        totalImpressions: totalMetaImpressions || 0,
        campaigns: campaigns
      },
      hubspot: {
        totalDeals: totalDeals || 0,
        totalDealValue: (totalDealValue || 0).toFixed(2),
        paidDeals: paidDeals,
        paidDealValue: paidDealValue.toFixed(2),
        aiReferralDeals: dealsBySource['AI_REFERRALS'] || 0,
        dealsBySource: dealsBySource,
        dealsByProduct: dealsByProduct
      },
      googleAds: {
        spend: 20000,
        estimatedDeals: 6,
        estimatedDealValue: 7281,
        costPerDeal: 3333
      },
      microsoftAds: {
        spend: 5000,
        estimatedDeals: 1,
        estimatedDealValue: 1820,
        costPerDeal: 2500
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
