const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: CORS });
    }

    if (url.pathname === '/api/health') {
      return json({ ok: true, app: env.APP_NAME || 'Finance Dashboard' });
    }

    if (request.method !== 'POST') {
      return json({ error: 'Not found' }, 404);
    }

    const body = await request.json().catch(() => ({}));

    if (url.pathname === '/api/overview-analysis') {
      const prompt = buildOverviewPrompt(body);
      const analysis = env.ANTHROPIC_API_KEY
        ? await askAnthropic(env.ANTHROPIC_API_KEY, prompt)
        : fallbackOverview(body);
      return json({ analysis });
    }

    if (url.pathname === '/api/portfolio-analysis') {
      const prompt = buildPortfolioPrompt(body);
      const analysis = env.ANTHROPIC_API_KEY
        ? await askAnthropic(env.ANTHROPIC_API_KEY, prompt)
        : fallbackPortfolio(body);
      return json({ analysis });
    }

    if (url.pathname === '/api/extract-portfolio-screenshot') {
      if (!env.ANTHROPIC_API_KEY) {
        return json({ error: 'Add the ANTHROPIC_API_KEY secret before using screenshot import.' }, 400);
      }
      const holdings = await extractScreenshot(env.ANTHROPIC_API_KEY, body.imageBase64, body.mediaType);
      return json({ holdings });
    }

    return json({ error: 'Not found' }, 404);
  },
};

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...CORS },
  });
}

async function askAnthropic(apiKey, prompt) {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-5-20250929',
      max_tokens: 700,
      system:
        'You are a practical personal finance coach for an Irish user. Use euro, short paragraphs, no hype, no markdown tables. Mention risks clearly and be specific.',
      messages: [{ role: 'user', content: prompt }],
    }),
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data?.error?.message || 'Anthropic request failed');
  }
  return (data.content || []).map((part) => part.text || '').join('').trim();
}

async function extractScreenshot(apiKey, imageBase64, mediaType = 'image/jpeg') {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-5-20250929',
      max_tokens: 700,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'image',
              source: { type: 'base64', media_type: mediaType, data: imageBase64 },
            },
            {
              type: 'text',
              text:
                'Read this DeGiro portfolio screenshot. Return JSON only. For each ETF holding provide fund, units and price. Use only these fund names when relevant: VWCE, VWRD, S&P 500 Acc, S&P 500 Dis, Dev World, Dev World ex-US, EM Acc.',
            },
          ],
        },
      ],
    }),
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data?.error?.message || 'Screenshot extraction failed');
  }
  const text = (data.content || []).map((part) => part.text || '').join('').replace(/```json|```/g, '').trim();
  return JSON.parse(text);
}

function buildOverviewPrompt(body) {
  return `Here is my financial snapshot.
Date: ${body.snapshotDate}
Accounts: ${JSON.stringify(body.accounts)}
Total: ${body.total}
Liquid: ${body.liquid}
Invested: ${body.invested}
History: ${JSON.stringify(body.history?.slice(-6) || [])}
Upcoming: ${JSON.stringify(body.upcoming || [])}
Notes: ${body.notes || ''}
Give me a concise health check, major watch-outs, emergency fund view assuming monthly expenses around €2,200, and 3 practical next actions. Keep it under 260 words.`;
}

function buildPortfolioPrompt(body) {
  return `Here is my ETF portfolio.
Holdings: ${JSON.stringify(body.portfolioData || [])}
Total value: ${body.totalValue}
Total cost: ${body.totalCost}
Monthly invest: ${body.monthlyInvest}
Target allocation: ${JSON.stringify(body.targetAlloc || {})}
Please explain allocation gaps, concentration issues, where the next few monthly contributions should go, and any concerns from an Irish long-term investor angle. Keep it under 320 words.`;
}

function fallbackOverview(body) {
  const next90 = (body.upcoming || []).reduce((sum, item) => {
    const days = item.dueDate ? Math.floor((new Date(item.dueDate) - new Date()) / 86400000) : 9999;
    return days >= 0 && days <= 90 ? sum + Number(item.amount || 0) : sum;
  }, 0);
  const emergencyMonths = body.liquid / 2200;
  const warnings = [];
  if (emergencyMonths < 3) warnings.push(`Your liquid cash covers about ${emergencyMonths.toFixed(1)} months of spending, which is on the thin side.`);
  if (next90 > body.liquid * 0.4) warnings.push(`Known bills in the next 90 days are material at roughly €${next90.toFixed(0)}.`);
  if (body.invested > body.liquid * 5) warnings.push('Your balance sheet is investment-heavy relative to cash, so big near-term costs could force awkward withdrawals.');
  return [
    `Snapshot: total net worth is about €${Number(body.total || 0).toFixed(0)}, with €${Number(body.liquid || 0).toFixed(0)} liquid and €${Number(body.invested || 0).toFixed(0)} invested.`,
    warnings[0] || `Your liquid cash covers about ${emergencyMonths.toFixed(1)} months of €2,200 spending, which is broadly workable if upcoming costs are modest.`,
    warnings[1] || 'Your next step is to keep a clear 90-day expense list so annual bills stop sneaking up on cashflow.',
    warnings[2] || 'If you have spare cash after known costs, direct new money intentionally rather than letting it drift across accounts.',
  ].join('\n\n');
}

function fallbackPortfolio(body) {
  const rows = body.portfolioData || [];
  const total = Number(body.totalValue || 0);
  const sorted = rows.filter((r) => r.value > 0).sort((a, b) => b.value - a.value);
  const top = sorted[0];
  const topWeight = top && total ? (top.value / total) * 100 : 0;
  const gaps = Object.entries(body.targetAlloc || {})
    .map(([fund, target]) => {
      const row = rows.find((r) => r.fund === fund);
      const current = total ? ((row?.value || 0) / total) * 100 : 0;
      return { fund, gap: Number(target) - current };
    })
    .filter((x) => x.gap > 0)
    .sort((a, b) => b.gap - a.gap)
    .slice(0, 3);

  return [
    `Portfolio value is about €${total.toFixed(0)}. Your largest holding is ${top?.fund || 'n/a'} at roughly ${topWeight.toFixed(1)}% of the portfolio.`,
    topWeight > 55 ? 'That top holding is carrying a lot of the portfolio, so future contributions should probably diversify rather than reinforce it.' : 'Concentration does not look extreme from the top line, but check for overlap between world and US-heavy funds.',
    gaps.length ? `Based on your target weights, the next contributions should lean toward ${gaps.map((g) => g.fund).join(', ')}.` : 'Your current allocation is already fairly close to your targets.',
    'As an Irish investor, keep the deemed disposal timeline visible and think about building a future tax reserve rather than treating every gain as spendable.',
  ].join('\n\n');
}
