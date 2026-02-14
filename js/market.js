// Market Value Lookup via BrickOwl API
// Requires a BrickOwl store-level API key with "Access Brick Owl Catalog" permission.
// To get this: create a BrickOwl seller store, list some inventory, and request catalog access.

async function lookupMarketValue(setNumber) {
  if (!CONFIG.BRICKOWL_API_KEY) return null;

  const setNum = setNumber.includes('-') ? setNumber : setNumber + '-1';

  // Step 1: Get BOID via id_lookup
  const lookupUrl = `${BRICKOWL_BASE}/catalog/id_lookup?key=${CONFIG.BRICKOWL_API_KEY}&id=${setNum}&type=Set`;
  const lookupResp = await fetch(lookupUrl);
  if (!lookupResp.ok) return null;

  const lookupData = await lookupResp.json();
  const boids = lookupData.boids || [];
  if (boids.length === 0) return null;

  const boid = boids[0];

  // Step 2: Get price guide (requires catalog access permission)
  const priceUrl = `${BRICKOWL_BASE}/catalog/price_guide?key=${CONFIG.BRICKOWL_API_KEY}&boid=${boid}&new_or_used=N`;
  const priceResp = await fetch(priceUrl);
  if (!priceResp.ok) return null;

  const priceData = await priceResp.json();
  if (priceData.error) return null;

  return parseFloat(priceData.avg) || parseFloat(priceData.median) || null;
}
