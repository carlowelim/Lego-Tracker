// Market Value Lookup
// 1. BrickEconomy search (for retired sets with New/Sealed value)
// 2. BrickOwl catalog page (for sets with active listings)

async function lookupMarketValue(setNumber) {
  // Try BrickEconomy first (best for retired sets)
  try {
    const value = await lookupMarketBrickEconomy(setNumber);
    if (value !== null) return value;
  } catch {
    // Fall through
  }

  // Fallback: BrickOwl catalog page (works for sets still at retail)
  try {
    const value = await lookupMarketBrickOwl(setNumber);
    if (value !== null) return value;
  } catch {
    // No market data available
  }

  return null;
}

async function lookupMarketBrickEconomy(setNumber) {
  const cleanNum = setNumber.replace(/-\d+$/, '');
  const searchUrl = `https://www.brickeconomy.com/search?query=${encodeURIComponent(cleanNum)}`;
  const proxyUrl = `https://api.allorigins.win/get?url=${encodeURIComponent(searchUrl)}`;

  let html = '';
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const resp = await fetch(proxyUrl, { signal: AbortSignal.timeout(15000) });
      if (!resp.ok) return null;
      const text = await resp.text();
      const data = JSON.parse(text);
      html = data.contents || '';
      break;
    } catch {
      if (attempt === 1) return null;
      await new Promise((r) => setTimeout(r, 2000));
    }
  }

  const tableIdx = html.indexOf('GridViewSets');
  if (tableIdx === -1) return null;

  const tableEnd = html.indexOf('</table>', tableIdx);
  const tableHtml = html.substring(tableIdx, tableEnd + 10);

  const newSealedMatch = tableHtml.match(/New\/Sealed[^$]*\$([\d,.]+)/);
  if (newSealedMatch) {
    return parseFloat(newSealedMatch[1].replace(/,/g, ''));
  }

  return null;
}

async function lookupMarketBrickOwl(setNumber) {
  const setNum = setNumber.includes('-') ? setNumber : setNumber + '-1';

  // Step 1: Get BOID via API (proxied — BrickOwl API has no CORS headers)
  const apiUrl = `${BRICKOWL_BASE}/catalog/id_lookup?key=${CONFIG.BRICKOWL_API_KEY}&id=${setNum}&type=Set`;
  const lookupProxy = `https://api.allorigins.win/get?url=${encodeURIComponent(apiUrl)}`;

  let boid = null;
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const lookupResp = await fetch(lookupProxy, { signal: AbortSignal.timeout(10000) });
      if (!lookupResp.ok) return null;
      const lookupText = await lookupResp.text();
      const lookupWrapper = JSON.parse(lookupText);
      const lookupData = JSON.parse(lookupWrapper.contents || '{}');
      const boids = lookupData.boids || [];
      if (boids.length === 0) return null;
      boid = boids[0];
      break;
    } catch {
      if (attempt === 1) return null;
      await new Promise((r) => setTimeout(r, 2000));
    }
  }

  // Step 2: Scrape the catalog page for "Available from $X" price
  const catalogUrl = `https://www.brickowl.com/catalog/${boid}`;
  const proxyUrl = `https://api.allorigins.win/get?url=${encodeURIComponent(catalogUrl)}`;

  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const resp = await fetch(proxyUrl, { signal: AbortSignal.timeout(15000) });
      if (!resp.ok) return null;
      const text = await resp.text();
      const data = JSON.parse(text);
      const html = data.contents || '';

      // Pattern: "Available from $475.46"
      const availMatch = html.match(/Available[^$]*\$([\d,.]+)/);
      if (availMatch) {
        return parseFloat(availMatch[1].replace(/,/g, ''));
      }

      // Fallback: JSON-LD schema.org price
      const schemaMatch = html.match(/"price":"([\d.]+)","priceCurrency":"USD"/);
      if (schemaMatch) {
        return parseFloat(schemaMatch[1]);
      }

      return null;
    } catch {
      if (attempt === 1) return null;
      await new Promise((r) => setTimeout(r, 2000));
    }
  }

  return null;
}
