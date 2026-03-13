async function postJson(url, body) {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || 'Request failed');
  }
  return data;
}

export function getOverviewAnalysis(payload) {
  return postJson('/api/overview-analysis', payload);
}

export function getPortfolioAnalysis(payload) {
  return postJson('/api/portfolio-analysis', payload);
}

export function extractPortfolioScreenshot(payload) {
  return postJson('/api/extract-portfolio-screenshot', payload);
}
