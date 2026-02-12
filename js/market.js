// Market Value Lookup

async function lookupMarketValue(setNumber) {
  // Try BrickOwl first (requires store-level API key for price_guide)
  try {
    const value = await lookupMarketBrickOwl(setNumber);
    if (value !== null) return value;
  } catch {
    // Fall through to Brickset
  }

  // Fallback: scrape BrickEconomy search for pricing
  try {
    const value = await lookupMarketBrickEconomy(setNumber);
    if (value !== null) return value;
  } catch {
    // No market data available
  }

  return null;
}

async function lookupMarketBrickOwl(setNumber) {
  const setNum = setNumber.includes('-') ? setNumber : setNumber + '-1';

  // Step 1: Get BOID via id_lookup
  const lookupUrl = `${BRICKOWL_BASE}/catalog/id_lookup?key=${CONFIG.BRICKOWL_API_KEY}&id=${setNum}&type=Set`;
  const lookupResp = await fetch(lookupUrl);
  if (!lookupResp.ok) return null;

  const lookupData = await lookupResp.json();
  const boids = lookupData.boids || [];
  if (boids.length === 0) return null;

  const boid = boids[0];

  // Step 2: Get price guide
  const priceUrl = `${BRICKOWL_BASE}/catalog/price_guide?key=${CONFIG.BRICKOWL_API_KEY}&boid=${boid}&new_or_used=N`;
  const priceResp = await fetch(priceUrl);
  if (!priceResp.ok) return null;

  const priceData = await priceResp.json();
  if (priceData.error) return null;

  return parseFloat(priceData.avg) || parseFloat(priceData.median) || null;
}

async function lookupMarketBrickEconomy(setNumber) {
  const setNum = setNumber.includes('-') ? setNumber : setNumber + '-1';
  const searchUrl = `https://www.brickeconomy.com/search?query=${encodeURIComponent(setNumber)}`;
  const proxyUrl = `https://api.allorigins.win/get?url=${encodeURIComponent(searchUrl)}`;

  const resp = await fetch(proxyUrl, { signal: AbortSignal.timeout(10000) });
  if (!resp.ok) return null;

  const data = await resp.json();
  const html = data.contents || '';

  // BrickEconomy search results contain set cards with pricing
  // Look for "Value" or current market price near the set number
  // The search page shows retail and sometimes current value
  const valueMatch = html.match(/(?:Value|Current)[^<]*?[\s:]*\$([\d,.]+)/i);
  if (valueMatch) {
    return parseFloat(valueMatch[1].replace(',', ''));
  }

  // If we can find the set detail page link, try to load it
  const linkMatch = html.match(/href=["']\/set\/[^"']*/);
  if (linkMatch) {
    const setPageUrl = `https://www.brickeconomy.com${linkMatch[0].replace('href="', '').replace("href='", '')}`;
    try {
      const pageProxy = `https://api.allorigins.win/get?url=${encodeURIComponent(setPageUrl)}`;
      const pageResp = await fetch(pageProxy, { signal: AbortSignal.timeout(10000) });
      if (pageResp.ok) {
        const pageData = await pageResp.json();
        const pageHtml = pageData.contents || '';
        const newValMatch = pageHtml.match(/New[\s\S]{0,100}\$([\d,.]+)/);
        if (newValMatch) return parseFloat(newValMatch[1].replace(',', ''));
      }
    } catch {
      // Timeout or failure, skip
    }
  }

  return null;
}
