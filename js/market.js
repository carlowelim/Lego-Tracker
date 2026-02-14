// Market Value Lookup via BrickEconomy search results scraping

async function lookupMarketValue(setNumber) {
  const cleanNum = setNumber.replace(/-\d+$/, ''); // Strip -1 suffix if present
  const searchUrl = `https://www.brickeconomy.com/search?query=${encodeURIComponent(cleanNum)}`;
  const proxyUrl = `https://api.allorigins.win/get?url=${encodeURIComponent(searchUrl)}`;

  // Retry up to 2 times (proxy can be flaky)
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

  // Find the search results table
  const tableIdx = html.indexOf('GridViewSets');
  if (tableIdx === -1) return null;

  const tableEnd = html.indexOf('</table>', tableIdx);
  const tableHtml = html.substring(tableIdx, tableEnd + 10);

  // Extract the "New/Sealed" value (market value for new condition)
  // BrickEconomy shows "Value" section with "New/Sealed" and "Used" for retired sets
  const newSealedMatch = tableHtml.match(/New\/Sealed[^$]*\$([\d,.]+)/);
  if (newSealedMatch) {
    return parseFloat(newSealedMatch[1].replace(/,/g, ''));
  }

  // For sets still at retail, there's no secondary market value
  return null;
}
