// Market Value Lookup
// 1. BrickEconomy search (for retired sets with New/Sealed value)
// 2. BrickOwl search page (for sets with active listings)
// All requests go through allorigins CORS proxy — no direct API calls.

async function lookupMarketValue(setNumber) {
  // Try BrickEconomy first (best for retired sets)
  try {
    const value = await lookupMarketBrickEconomy(setNumber);
    if (value !== null) return value;
  } catch {
    // Fall through
  }

  // Fallback: BrickOwl search page (works for sets still at retail)
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
  const html = await fetchViaProxy(searchUrl);
  if (!html) return null;

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
  const cleanNum = setNumber.replace(/-\d+$/, '');
  const searchUrl = `https://www.brickowl.com/search/catalog?query=${encodeURIComponent(cleanNum)}&cat=set`;
  const html = await fetchViaProxy(searchUrl);
  if (!html) return null;

  // "Available from $475.46" pattern on search results page
  const availMatch = html.match(/Available[^$]*\$([\d,.]+)/);
  if (availMatch) {
    return parseFloat(availMatch[1].replace(/,/g, ''));
  }

  return null;
}

// Shared helper: fetch a URL through allorigins CORS proxy with retry
async function fetchViaProxy(url) {
  const proxyUrl = `https://api.allorigins.win/get?url=${encodeURIComponent(url)}`;

  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const resp = await fetch(proxyUrl, { signal: AbortSignal.timeout(15000) });
      if (!resp.ok) return null;
      const text = await resp.text();
      const data = JSON.parse(text);
      return data.contents || '';
    } catch {
      if (attempt === 1) return null;
      await new Promise((r) => setTimeout(r, 2000));
    }
  }

  return null;
}
