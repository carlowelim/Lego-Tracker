// Market Value Lookup
// 1. BrickEconomy search (for retired sets with New/Sealed value)
// 2. BrickOwl search page (for sets with active listings)
// Requests go through multiple CORS proxies with fallback.

const CORS_PROXIES = [
  (url) => `https://corsproxy.io/?url=${encodeURIComponent(url)}`,
  (url) => `https://api.allorigins.win/get?url=${encodeURIComponent(url)}`,
  (url) => `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(url)}`,
];

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

// Shared helper: fetch a URL through CORS proxies with fallback
// Tries each proxy service in order until one succeeds
async function fetchViaProxy(url) {
  for (let p = 0; p < CORS_PROXIES.length; p++) {
    const proxyUrl = CORS_PROXIES[p](url);

    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const resp = await fetch(proxyUrl, { signal: AbortSignal.timeout(20000) });
        if (!resp.ok) {
          if (attempt === 1) break; // try next proxy
          await new Promise((r) => setTimeout(r, 2000));
          continue;
        }
        const text = await resp.text();

        // allorigins wraps response in JSON with a .contents field
        if (proxyUrl.includes('allorigins.win')) {
          try {
            const data = JSON.parse(text);
            return data.contents || '';
          } catch {
            return text;
          }
        }

        return text;
      } catch {
        if (attempt === 1) break; // try next proxy
        await new Promise((r) => setTimeout(r, 2000));
      }
    }
  }

  return null;
}
