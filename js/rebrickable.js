// Rebrickable API + BrickOwl Barcode Lookup

const REBRICKABLE_BASE = 'https://rebrickable.com/api/v3/lego';
const BRICKOWL_BASE = 'https://api.brickowl.com/v1';

async function lookupSet(setNumber) {
  // Rebrickable expects format like "75192-1"
  const setNum = setNumber.includes('-') ? setNumber : setNumber + '-1';

  const response = await fetch(`${REBRICKABLE_BASE}/sets/${setNum}/`, {
    headers: { Authorization: `key ${CONFIG.REBRICKABLE_API_KEY}` },
  });

  if (response.status === 404) {
    throw new Error(`Set ${setNumber} not found on Rebrickable.`);
  }
  if (!response.ok) {
    throw new Error(`Rebrickable API error: ${response.status}`);
  }

  const data = await response.json();

  // Fetch theme name (API returns theme_id, not name)
  let themeName = '';
  if (data.theme_id) {
    try {
      const themeResp = await fetch(`${REBRICKABLE_BASE}/themes/${data.theme_id}/`, {
        headers: { Authorization: `key ${CONFIG.REBRICKABLE_API_KEY}` },
      });
      if (themeResp.ok) {
        const themeData = await themeResp.json();
        themeName = themeData.name || '';
      }
    } catch {
      // Non-critical, leave theme empty
    }
  }

  // Fetch retail price from Brickset
  let retailPrice = '';
  try {
    retailPrice = await lookupRetailPrice(setNum);
  } catch {
    // Non-critical
  }

  return {
    setNumber: data.set_num.replace(/-1$/, ''),
    setName: data.name,
    theme: themeName,
    pieces: data.num_parts || '',
    year: data.year || '',
    imageUrl: data.set_img_url || '',
    retailPrice,
  };
}

async function searchSets(query) {
  const response = await fetch(
    `${REBRICKABLE_BASE}/sets/?search=${encodeURIComponent(query)}&page_size=5`,
    { headers: { Authorization: `key ${CONFIG.REBRICKABLE_API_KEY}` } }
  );

  if (!response.ok) {
    throw new Error(`Rebrickable search failed: ${response.status}`);
  }

  const data = await response.json();
  return (data.results || []).map((s) => ({
    setNumber: s.set_num.replace(/-1$/, ''),
    setName: s.name,
    year: s.year,
    pieces: s.num_parts,
  }));
}

async function lookupRetailPrice(setNum) {
  // Fetch Brickset set page and extract USD RRP
  // setNum should be in format "75375-1"
  const bricksetUrl = `https://brickset.com/sets/${setNum}`;
  const proxyUrl = `https://api.allorigins.win/get?url=${encodeURIComponent(bricksetUrl)}`;
  const response = await fetch(proxyUrl);

  if (!response.ok) return '';

  const data = await response.json();
  const html = data.contents || '';
  // RRP line looks like: <dd>£74.99/$84.99/€84.99</dd>
  const rrpMatch = html.match(/RRP<\/dt>\s*<dd>[^<]*\$([\d.]+)/);
  if (rrpMatch) {
    return rrpMatch[1];
  }
  return '';
}

async function lookupBarcode(barcode) {
  // Search Brickset website for the EAN/UPC (via CORS proxy)
  // Brickset has the most complete LEGO barcode database
  try {
    const bricksetUrl = `https://brickset.com/sets?query=${encodeURIComponent(barcode)}`;
    const proxyUrl = `https://api.allorigins.win/get?url=${encodeURIComponent(bricksetUrl)}`;
    const response = await fetch(proxyUrl);

    if (response.ok) {
      const data = await response.json();
      const html = data.contents || '';
      // Extract set number from Brickset search results page
      // Links look like: /sets/75375-1/Millennium-Falcon
      const match = html.match(/\/sets\/(\d+)-\d+\/([^'"]+)/);
      if (match) {
        const setNumber = match[1];
        const name = match[2].replace(/-/g, ' ');
        return { setNumber, productName: name };
      }
    }
  } catch {
    // Brickset lookup failed, continue to fallback
  }

  // Fallback: try UPCitemdb
  try {
    const response = await fetch(
      `https://api.upcitemdb.com/prod/trial/lookup?upc=${encodeURIComponent(barcode)}`
    );

    if (response.ok) {
      const data = await response.json();
      if (data.items && data.items.length > 0) {
        const title = data.items[0].title || '';
        const match = title.match(/\b(\d{4,6})\b/);
        if (match) {
          return { setNumber: match[1], productName: title };
        }
        return { setNumber: null, productName: title };
      }
    }
  } catch {
    // UPCitemdb failed too
  }

  return null;
}
