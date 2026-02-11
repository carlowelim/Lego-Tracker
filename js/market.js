// BrickOwl Market Value Lookup

async function lookupMarketValue(setNumber) {
  // Search BrickOwl for the set
  const searchUrl = `${BRICKOWL_BASE}/catalog/search?key=${CONFIG.BRICKOWL_API_KEY}&query=${encodeURIComponent(setNumber)}&type=Set`;

  const searchResp = await fetch(searchUrl);
  if (!searchResp.ok) return null;

  const searchData = await searchResp.json();
  const rows = searchData.rows || searchData;

  if (!Array.isArray(rows) || rows.length === 0) return null;

  // Find the best match
  const item = rows[0];
  const boid = item.boid;

  if (!boid) return null;

  // Get price guide
  const priceUrl = `${BRICKOWL_BASE}/catalog/price_guide?key=${CONFIG.BRICKOWL_API_KEY}&boid=${boid}&new_or_used=N`;

  const priceResp = await fetch(priceUrl);
  if (!priceResp.ok) return null;

  const priceData = await priceResp.json();

  // Use average price if available, otherwise median
  const avg = parseFloat(priceData.avg) || parseFloat(priceData.median) || null;
  return avg;
}
