// Market Value Lookup
// 1. BrickEconomy search (for retired sets with New/Sealed value)
// 2. BrickOwl search page (for sets with active listings)
// Uses Google Apps Script CORS proxy (configured in config.js)

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

// Shared helper: fetch a URL through the Google Apps Script CORS proxy
async function fetchViaProxy(url) {
  if (!CONFIG.CORS_PROXY_URL) {
    console.warn('CORS_PROXY_URL not set in config.js. See gas-proxy.js for setup instructions.');
    return null;
  }

  const proxyUrl = `${CONFIG.CORS_PROXY_URL}?url=${encodeURIComponent(url)}`;

  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const resp = await fetch(proxyUrl, {
        signal: AbortSignal.timeout(30000),
        redirect: 'follow',
      });
      console.log(`Proxy response for ${url}: status=${resp.status}, type=${resp.type}`);
      if (!resp.ok) {
        console.warn(`Proxy HTTP error: ${resp.status} ${resp.statusText}`);
        if (attempt === 1) return null;
        await new Promise((r) => setTimeout(r, 2000));
        continue;
      }
      const text = await resp.text();
      console.log(`Proxy response length: ${text.length}, preview: ${text.substring(0, 100)}`);
      // GAS returns JSON: {"contents": "...html..."}
      try {
        const data = JSON.parse(text);
        if (data.error) {
          console.warn('Proxy error:', data.error);
          return null;
        }
        return data.contents || '';
      } catch {
        // If not JSON, return raw text (might be the HTML directly)
        return text;
      }
    } catch (err) {
      console.warn(`Proxy fetch error (attempt ${attempt + 1}):`, err.message || err);
      if (attempt === 1) return null;
      await new Promise((r) => setTimeout(r, 2000));
    }
  }

  return null;
}
