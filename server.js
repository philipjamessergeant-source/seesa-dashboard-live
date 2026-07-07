require('dotenv').config();
const express = require('express');
const fetch = require('node-fetch');
const app = express();

app.use(express.static('public'));
app.use(express.json());

const SEESA_META_ACCOUNT = '1326328365076410';
const SEESA_HUBSPOT_PORTAL = '49403143';

// Helper: fetch Meta Ads data BY DATE RANGE using Insights
async function fetchMetaCampaigns(startDate, endDate) {
  try {
    // Use insights endpoint with date_start and date_stop for proper date filtering
    const url = `https://graph.facebook.com/v18.0/act_${SEESA_META_ACCOUNT}/insights?fields=campaign_id,campaign_name,spend,impressions,clicks,reach,actions,action_values&date_start=${startDate}&date_stop=${endDate}&breakdowns=campaign_id&access_token=${process.env.META_ACCESS_TOKEN}&limit=100`;
    
    console.log(`Fetching Meta insights from ${startDate} to ${endDate}`);
    const res = await fetch(url);
    const data = await res.json();
    
    if (!res.ok || data.error) {
      console.error('Meta insights error:', data.error);
      return [];
    }
    
    // Group by campaign_id to aggregate
    const campaignMap = {};
    (data.data || []).forEach(row => {
      const campId = row.campaign_id;
      if (!campaignMap[campId]) {
        campaignMap[campId] = {
          id: campId,
          name: row.campaign_name || 'Unknown',
          amount_spent: 0,
          impressions: 0,
          clicks: 0,
          reach: 0,
          results: 0
        };
      }
      campaignMap[campId].amount_spent += parseFloat(row.spend || 0);
      campaignMap[campId].impressions += parseInt(row.impressions || 0);
      campaignMap[campId].clicks += parseInt(row.clicks || 0);
      campaignMap[campId].reach += parseInt(row.reach || 0);
      
      // Actions (results/leads)
      if (row.actions && Array.isArray(row.actions)) {
        const leadAction = row.actions.find(a => a.action_type === 'lead');
        if (leadAction) campaignMap[campId].results += parseInt(leadAction.value || 0);
      }
    });
    
    const campaigns = Object.values(campaignMap).map(c => ({
      ...c,
      effective_status: 'ACTIVE', // insights only returns active campaigns with spend
      ctr: c.impressions > 0 ? `${((c.clicks / c.impressions) * 100).toFixed(2)}%` : '—',
      cpm: c.impressions > 0 ? `R${(c.amount_spent / (c.impressions / 1000)).toFixed(2)}` : '—',
      cost_per_result: c.results > 0 ? `R${(c.amount_spent / c.results).toFixed(2)}` : '—'
    }));
    
    console.log(`Fetched ${campaigns.length} campaigns with spend for ${startDate} to ${endDate}`);
    return campaigns;
  } catch (err) {
    console.error('Meta insights error:', err);
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
