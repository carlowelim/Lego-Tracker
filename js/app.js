// App UI Logic

let scannedBarcode = '';
let scannedImageUrl = '';
let inventoryData = [];
let wishlistData = [];
let currentSort = { column: null, ascending: true };
let activeTab = 'inventory';
let searchDebounceTimer = null;
let usdToPhp = CONFIG.USD_TO_PHP_FALLBACK;

// Fetch live exchange rate on load
fetch('https://api.exchangerate-api.com/v4/latest/USD')
  .then((r) => r.json())
  .then((d) => { if (d.rates && d.rates.PHP) usdToPhp = d.rates.PHP; })
  .catch(() => {});

function formatPHP(usdAmount) {
  const val = parseFloat(usdAmount);
  if (!val && val !== 0) return '';
  const php = val * usdToPhp;
  return CONFIG.CURRENCY_SYMBOL + php.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

document.addEventListener('DOMContentLoaded', () => {
  // Wait for Google API scripts to load, then initialize
  const checkGapi = setInterval(() => {
    if (typeof gapi !== 'undefined' && typeof google !== 'undefined') {
      clearInterval(checkGapi);
      startApp();
    }
  }, 100);
});

async function startApp() {
  try {
    await initGapi();
    await initAuth();
    showStatus('Ready. Please sign in to access your inventory.');
  } catch (err) {
    showError('Failed to initialize Google API: ' + err.message);
  }

  document.getElementById('sign-in-btn').addEventListener('click', signIn);
  document.getElementById('sign-out-btn').addEventListener('click', signOut);
  document.getElementById('add-set-form').addEventListener('submit', handleAddSet);
  document.getElementById('scan-btn').addEventListener('click', handleScanBarcode);
  document.getElementById('ocr-btn').addEventListener('click', handleOcrScan);
  document.getElementById('lookup-btn').addEventListener('click', handleLookup);

  // Tab navigation
  document.querySelectorAll('.tab-btn').forEach((btn) => {
    btn.addEventListener('click', () => switchTab(btn.dataset.tab));
  });

  // Search & filter
  document.getElementById('search-input').addEventListener('input', () => {
    clearTimeout(searchDebounceTimer);
    searchDebounceTimer = setTimeout(() => applyFiltersAndSort(), 200);
  });
  document.getElementById('theme-filter').addEventListener('change', () => applyFiltersAndSort());
  document.getElementById('built-filter').addEventListener('change', () => applyFiltersAndSort());

  // Sortable headers
  document.querySelectorAll('#inventory-section thead th[data-sort]').forEach((th) => {
    th.addEventListener('click', () => {
      const col = th.dataset.sort;
      if (currentSort.column === col) {
        currentSort.ascending = !currentSort.ascending;
      } else {
        currentSort.column = col;
        currentSort.ascending = true;
      }
      applyFiltersAndSort();
      updateSortIndicators();
    });
  });

  // Refresh prices button
  document.getElementById('refresh-prices-btn').addEventListener('click', refreshAllMarketValues);
}

function switchTab(tab) {
  activeTab = tab;
  document.querySelectorAll('.tab-btn').forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.tab === tab);
  });
  document.getElementById('inventory-section').classList.toggle('hidden', tab !== 'inventory');
  document.getElementById('wishlist-section').classList.toggle('hidden', tab !== 'wishlist');
  document.getElementById('dashboard-section').classList.toggle('hidden', tab !== 'inventory');
  document.getElementById('inventory-toolbar').classList.toggle('hidden', tab !== 'inventory');
}

// Called by auth.js when auth state changes
function onAuthChange(signedIn) {
  document.getElementById('sign-in-btn').classList.toggle('hidden', signedIn);
  document.getElementById('sign-out-btn').classList.toggle('hidden', !signedIn);
  document.getElementById('add-set-section').classList.toggle('hidden', !signedIn);
  document.getElementById('inventory-section').classList.toggle('hidden', !signedIn || activeTab !== 'inventory');
  document.getElementById('wishlist-section').classList.toggle('hidden', !signedIn || activeTab !== 'wishlist');
  document.getElementById('tab-navigation').classList.toggle('hidden', !signedIn);
  document.getElementById('dashboard-section').classList.toggle('hidden', !signedIn);
  document.getElementById('inventory-toolbar').classList.toggle('hidden', !signedIn || activeTab !== 'inventory');

  if (signedIn) {
    gapi.client.setToken({ access_token: getToken() });
    ensureWishlistSheet().catch(() => {});
    loadInventory();
    loadWishlist();
  } else {
    document.getElementById('inventory-body').innerHTML = '';
    document.getElementById('wishlist-body').innerHTML = '';
    inventoryData = [];
    wishlistData = [];
    showStatus('Signed out. Sign in to view your inventory.');
  }
}

async function handleAddSet(e) {
  e.preventDefault();
  const form = e.target;
  const submitBtn = form.querySelector('button[type="submit"]');
  submitBtn.disabled = true;
  submitBtn.textContent = 'Saving...';

  const addTarget = document.getElementById('add-target').value;

  const rowData = {
    setNumber: form.setNumber.value.trim(),
    setName: form.setName.value.trim(),
    theme: form.theme.value.trim(),
    pieces: form.pieces.value.trim(),
    purchaseDate: form.purchaseDate.value,
    purchasePrice: form.purchasePrice.value.trim(),
    store: form.store.value.trim(),
    builtStatus: 'No',
    notes: form.notes.value.trim(),
    barcode: scannedBarcode || '',
    retailPrice: form.retailPrice.value.trim(),
    imageUrl: scannedImageUrl || '',
  };

  try {
    if (addTarget === 'wishlist') {
      rowData.priority = document.getElementById('wishlist-priority') ?
        document.getElementById('wishlist-priority').value : 'Medium';
      await appendWishlistRow(rowData);
      showStatus('Set added to wishlist!');
      await loadWishlist();
    } else {
      await appendRow(rowData);
      showStatus('Set added successfully!');
      await loadInventory();
    }
    form.reset();
    document.getElementById('add-target').value = 'inventory';
    scannedBarcode = '';
    scannedImageUrl = '';
    hideScannerResult();
  } catch (err) {
    showError('Failed to add set: ' + err.message);
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = 'Add Set';
  }
}

async function loadInventory() {
  const tbody = document.getElementById('inventory-body');
  tbody.innerHTML = '<tr><td colspan="12" class="loading">Loading inventory...</td></tr>';

  try {
    inventoryData = await getAllRows();

    if (inventoryData.length === 0) {
      tbody.innerHTML = '<tr><td colspan="12" class="loading">No sets in inventory. Add your first set above!</td></tr>';
      updateDashboard();
      return;
    }

    populateThemeFilter();
    applyFiltersAndSort();
    updateDashboard();
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="12" class="loading error">Failed to load inventory: ${escapeHtml(err.message)}</td></tr>`;
  }
}

function renderInventory(rows) {
  const tbody = document.getElementById('inventory-body');

  if (rows.length === 0) {
    tbody.innerHTML = '<tr><td colspan="12" class="loading">No sets match your filters.</td></tr>';
    return;
  }

  tbody.innerHTML = rows
    .map(
      (row) => `
    <tr>
      <td data-label="Image">
        ${row.imageUrl ? `<img src="${escapeHtml(row.imageUrl)}" alt="${escapeHtml(row.setName)}" class="set-thumb" loading="lazy">` : '<span class="no-image">—</span>'}
      </td>
      <td data-label="Set #">${escapeHtml(row.setNumber)}</td>
      <td data-label="Name">${escapeHtml(row.setName)}</td>
      <td data-label="Theme">${escapeHtml(row.theme)}</td>
      <td data-label="Pieces">${escapeHtml(row.pieces)}</td>
      <td data-label="Retail">${row.retailPrice ? formatPHP(row.retailPrice) : ''}</td>
      <td data-label="Paid">${row.purchasePrice ? formatPHP(row.purchasePrice) : ''}</td>
      <td data-label="Store">${escapeHtml(row.store)}</td>
      <td data-label="Date Added">${escapeHtml(row.dateAdded)}</td>
      <td data-label="Built">
        <label class="built-toggle">
          <input type="checkbox" ${row.builtStatus === 'Yes' ? 'checked' : ''}
            onchange="toggleBuilt(${row.rowIndex}, this.checked)">
          <span class="built-label">${row.builtStatus === 'Yes' ? 'Built' : 'Unbuilt'}</span>
        </label>
      </td>
      <td data-label="Market" class="market-cell">
        ${renderMarketValue(row)}
      </td>
      <td data-label="Actions">
        <button class="btn-delete" onclick="handleDelete(${row.rowIndex})">Delete</button>
      </td>
    </tr>`
    )
    .join('');
}

function renderMarketValue(row) {
  if (!row.marketValue) return '<span class="no-market">—</span>';
  const market = parseFloat(row.marketValue);
  const retail = parseFloat(row.retailPrice);
  let indicator = '';
  if (retail && market) {
    const pct = ((market - retail) / retail * 100).toFixed(0);
    if (market > retail) {
      indicator = `<span class="appreciation up">+${pct}%</span>`;
    } else if (market < retail) {
      indicator = `<span class="appreciation down">${pct}%</span>`;
    }
  }
  return `${formatPHP(market)} ${indicator}`;
}

// --- Search, Sort & Filter ---

function applyFiltersAndSort() {
  let rows = [...inventoryData];

  // Search filter
  const search = document.getElementById('search-input').value.toLowerCase().trim();
  if (search) {
    rows = rows.filter((r) =>
      r.setNumber.toLowerCase().includes(search) ||
      r.setName.toLowerCase().includes(search) ||
      r.theme.toLowerCase().includes(search) ||
      r.store.toLowerCase().includes(search) ||
      r.notes.toLowerCase().includes(search)
    );
  }

  // Theme filter
  const themeFilter = document.getElementById('theme-filter').value;
  if (themeFilter) {
    rows = rows.filter((r) => r.theme === themeFilter);
  }

  // Built status filter
  const builtFilter = document.getElementById('built-filter').value;
  if (builtFilter) {
    rows = rows.filter((r) => r.builtStatus === builtFilter);
  }

  // Sort
  if (currentSort.column) {
    rows.sort((a, b) => {
      let valA = a[currentSort.column] || '';
      let valB = b[currentSort.column] || '';

      // Numeric sort for certain columns
      if (['pieces', 'purchasePrice', 'retailPrice', 'marketValue'].includes(currentSort.column)) {
        valA = parseFloat(valA) || 0;
        valB = parseFloat(valB) || 0;
      } else {
        valA = valA.toString().toLowerCase();
        valB = valB.toString().toLowerCase();
      }

      if (valA < valB) return currentSort.ascending ? -1 : 1;
      if (valA > valB) return currentSort.ascending ? 1 : -1;
      return 0;
    });
  }

  renderInventory(rows);
}

function populateThemeFilter() {
  const themes = [...new Set(inventoryData.map((r) => r.theme).filter(Boolean))].sort();
  const select = document.getElementById('theme-filter');
  const currentValue = select.value;
  select.innerHTML = '<option value="">All Themes</option>';
  themes.forEach((theme) => {
    const opt = document.createElement('option');
    opt.value = theme;
    opt.textContent = theme;
    select.appendChild(opt);
  });
  select.value = currentValue;
}

function updateSortIndicators() {
  document.querySelectorAll('#inventory-section thead th[data-sort]').forEach((th) => {
    th.classList.remove('sort-asc', 'sort-desc');
    if (th.dataset.sort === currentSort.column) {
      th.classList.add(currentSort.ascending ? 'sort-asc' : 'sort-desc');
    }
  });
}

// --- Wishlist ---

async function loadWishlist() {
  const tbody = document.getElementById('wishlist-body');
  tbody.innerHTML = '<tr><td colspan="8" class="loading">Loading wishlist...</td></tr>';

  try {
    wishlistData = await getAllWishlistRows();

    if (wishlistData.length === 0) {
      tbody.innerHTML = '<tr><td colspan="8" class="loading">Wishlist is empty. Add sets using "Add to: Wishlist" above!</td></tr>';
      return;
    }

    tbody.innerHTML = wishlistData
      .map(
        (row) => `
      <tr>
        <td data-label="Image">
          ${row.imageUrl ? `<img src="${escapeHtml(row.imageUrl)}" alt="${escapeHtml(row.setName)}" class="set-thumb" loading="lazy">` : '<span class="no-image">—</span>'}
        </td>
        <td data-label="Set #">${escapeHtml(row.setNumber)}</td>
        <td data-label="Name">${escapeHtml(row.setName)}</td>
        <td data-label="Theme">${escapeHtml(row.theme)}</td>
        <td data-label="Pieces">${escapeHtml(row.pieces)}</td>
        <td data-label="Retail">${row.retailPrice ? formatPHP(row.retailPrice) : ''}</td>
        <td data-label="Priority"><span class="priority-badge priority-${escapeHtml(row.priority.toLowerCase())}">${escapeHtml(row.priority)}</span></td>
        <td data-label="Actions">
          <div class="action-buttons">
            <button class="btn-move" onclick="handleMoveToInventory(${row.rowIndex})">Move to Inventory</button>
            <button class="btn-delete" onclick="handleDeleteWishlist(${row.rowIndex})">Delete</button>
          </div>
        </td>
      </tr>`
      )
      .join('');
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="8" class="loading error">Failed to load wishlist: ${escapeHtml(err.message)}</td></tr>`;
  }
}

async function handleMoveToInventory(rowIndex) {
  const row = wishlistData.find((r) => r.rowIndex === rowIndex);
  if (!row) return;

  const purchasePrice = prompt(`Purchase price for ${row.setName}? (leave blank to skip)`);
  const store = prompt('Store name? (leave blank to skip)');

  try {
    await appendRow({
      setNumber: row.setNumber,
      setName: row.setName,
      theme: row.theme,
      pieces: row.pieces,
      purchaseDate: new Date().toISOString().split('T')[0],
      purchasePrice: purchasePrice || '',
      store: store || '',
      builtStatus: 'No',
      notes: row.notes,
      barcode: '',
      retailPrice: row.retailPrice,
      imageUrl: row.imageUrl,
    });

    await deleteWishlistRow(rowIndex);
    showStatus('Set moved to inventory!');
    await loadInventory();
    await loadWishlist();
  } catch (err) {
    showError('Failed to move set: ' + err.message);
  }
}

async function handleDeleteWishlist(rowIndex) {
  if (!confirm('Remove this set from your wishlist?')) return;

  try {
    await deleteWishlistRow(rowIndex);
    showStatus('Removed from wishlist.');
    await loadWishlist();
  } catch (err) {
    showError('Failed to delete: ' + err.message);
  }
}

// --- Dashboard / Analytics ---

function updateDashboard() {
  const data = inventoryData;
  const totalSets = data.length;
  const totalPieces = data.reduce((sum, r) => sum + (parseInt(r.pieces) || 0), 0);
  const totalSpent = data.reduce((sum, r) => sum + (parseFloat(r.purchasePrice) || 0), 0);
  const totalRetail = data.reduce((sum, r) => sum + (parseFloat(r.retailPrice) || 0), 0);
  const savings = totalRetail - totalSpent;
  const builtCount = data.filter((r) => r.builtStatus === 'Yes').length;
  const totalMarket = data.reduce((sum, r) => sum + (parseFloat(r.marketValue) || 0), 0);

  document.getElementById('stat-total-sets').textContent = totalSets;
  document.getElementById('stat-total-pieces').textContent = totalPieces.toLocaleString();
  document.getElementById('stat-total-spent').textContent = formatPHP(totalSpent);
  document.getElementById('stat-total-retail').textContent = formatPHP(totalRetail);
  document.getElementById('stat-savings').textContent = (savings >= 0 ? '' : '-') + formatPHP(Math.abs(savings));
  document.getElementById('stat-savings').className = 'stat-value ' + (savings >= 0 ? 'positive' : 'negative');
  document.getElementById('stat-built').textContent = `${builtCount} / ${totalSets}`;
  document.getElementById('stat-market-value').textContent = totalMarket > 0 ? formatPHP(totalMarket) : '—';

  // Theme breakdown chart
  renderThemeChart(data);
}

function renderThemeChart(data) {
  const themeCounts = {};
  data.forEach((r) => {
    if (r.theme) {
      themeCounts[r.theme] = (themeCounts[r.theme] || 0) + 1;
    }
  });

  const sorted = Object.entries(themeCounts).sort((a, b) => b[1] - a[1]);
  const maxCount = sorted.length > 0 ? sorted[0][1] : 1;
  const container = document.getElementById('theme-chart');

  if (sorted.length === 0) {
    container.innerHTML = '<p class="chart-empty">No themes to display.</p>';
    return;
  }

  container.innerHTML = sorted
    .map(
      ([theme, count]) => `
    <div class="chart-row">
      <span class="chart-label">${escapeHtml(theme)}</span>
      <div class="chart-bar-wrapper">
        <div class="chart-bar" style="width: ${(count / maxCount) * 100}%">${count}</div>
      </div>
    </div>`
    )
    .join('');
}

// --- Market Value ---

async function refreshAllMarketValues() {
  const btn = document.getElementById('refresh-prices-btn');
  btn.disabled = true;
  const total = inventoryData.length;
  let successCount = 0;

  for (let i = 0; i < total; i++) {
    const row = inventoryData[i];
    btn.textContent = `Updating ${i + 1} of ${total}...`;

    try {
      const value = await lookupMarketValue(row.setNumber);
      if (value !== null) {
        const date = new Date().toISOString().split('T')[0];
        await updateMarketValue(row.rowIndex, value, date);
        row.marketValue = value.toString();
        row.valueDate = date;
        successCount++;
      }
    } catch {
      // Skip sets that fail
    }

    // Rate limit: 2 seconds between requests (BrickEconomy via proxy)
    if (i < total - 1) {
      await new Promise((resolve) => setTimeout(resolve, 2000));
    }
  }

  btn.textContent = 'Refresh Prices';
  btn.disabled = false;

  if (successCount > 0) {
    showStatus(`Market values updated for ${successCount} of ${total} sets. Sets still at retail have no secondary market value.`);
  } else {
    showStatus('No market values found. Sets still at retail don\'t have secondary market prices yet.');
  }
  applyFiltersAndSort();
  updateDashboard();
}

// --- Standard handlers ---

async function toggleBuilt(rowIndex, isBuilt) {
  try {
    await updateBuiltStatus(rowIndex, isBuilt ? 'Yes' : 'No');
    await loadInventory();
  } catch (err) {
    showError('Failed to update status: ' + err.message);
    await loadInventory();
  }
}

async function handleDelete(rowIndex) {
  if (!confirm('Are you sure you want to delete this set?')) return;

  try {
    await deleteRow(rowIndex);
    showStatus('Set deleted.');
    await loadInventory();
  } catch (err) {
    showError('Failed to delete set: ' + err.message);
  }
}

function showStatus(message) {
  const el = document.getElementById('status-message');
  el.textContent = message;
  el.className = 'status-message success';
  clearTimeout(el._timeout);
  el._timeout = setTimeout(() => (el.textContent = ''), 5000);
}

function showError(message) {
  const el = document.getElementById('status-message');
  el.textContent = message;
  el.className = 'status-message error';
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

// --- Barcode Scanning & Rebrickable Lookup ---

function handleScanBarcode() {
  if (!CONFIG.REBRICKABLE_API_KEY) {
    showError('Please set your REBRICKABLE_API_KEY in js/config.js first.');
    return;
  }
  showScannerResult('Starting camera...', 'loading');
  startScanner(onBarcodeDecoded);
}

async function onBarcodeDecoded(barcode) {
  scannedBarcode = barcode;
  showScannerResult(`Barcode: ${barcode} — Looking up set...`, 'loading');

  const upcResult = await lookupBarcode(barcode);

  let setNumber = null;
  if (upcResult && upcResult.setNumber) {
    setNumber = upcResult.setNumber;
    showScannerResult(
      `Barcode: ${barcode} — Found: "${upcResult.productName}". Looking up set ${setNumber}...`,
      'loading'
    );
  } else if (upcResult && upcResult.productName) {
    showScannerResult(
      `Barcode: ${barcode} — Product: "${upcResult.productName}". Could not extract set number. Enter it manually and click Lookup.`,
      'warning'
    );
    return;
  } else {
    showScannerResult(
      `Barcode: ${barcode} — Could not find matching set. Enter the set number manually and click Lookup.`,
      'warning'
    );
    return;
  }

  await fillFormFromRebrickable(setNumber);
}

function handleOcrScan() {
  if (!CONFIG.REBRICKABLE_API_KEY) {
    showError('Please set your REBRICKABLE_API_KEY in js/config.js first.');
    return;
  }
  showScannerResult('Loading OCR engine... Point camera at the set number on the box.', 'loading');
  startOcrScanner(onOcrSetNumberFound);
}

async function onOcrSetNumberFound(setNumber) {
  showScannerResult(`Detected set number: ${setNumber}. Looking up details...`, 'loading');
  document.getElementById('setNumber').value = setNumber;
  await fillFormFromRebrickable(setNumber);
}

async function handleLookup() {
  const setNumberInput = document.getElementById('setNumber').value.trim();
  if (!setNumberInput) {
    showError('Enter a set number to look up.');
    return;
  }
  if (!CONFIG.REBRICKABLE_API_KEY) {
    showError('Please set your REBRICKABLE_API_KEY in js/config.js first.');
    return;
  }

  showScannerResult(`Looking up set ${setNumberInput}...`, 'loading');
  await fillFormFromRebrickable(setNumberInput);
}

async function fillFormFromRebrickable(setNumber) {
  try {
    const setData = await lookupSet(setNumber);
    document.getElementById('setNumber').value = setData.setNumber;
    document.getElementById('setName').value = setData.setName;
    document.getElementById('theme').value = setData.theme;
    document.getElementById('pieces').value = setData.pieces;
    if (setData.retailPrice) {
      document.getElementById('retailPrice').value = setData.retailPrice;
    }

    // Store image URL for inclusion in row data
    scannedImageUrl = setData.imageUrl || '';

    const priceInfo = setData.retailPrice ? ` — RRP ${formatPHP(setData.retailPrice)}` : '';
    const info = `${setData.setNumber} — ${setData.setName} (${setData.pieces} pieces${priceInfo})`;
    showScannerResult(info, 'success');
  } catch (err) {
    showScannerResult(
      `Could not find set "${setNumber}": ${err.message}. Try a different set number.`,
      'warning'
    );
  }
}

function showScannerResult(message, type) {
  const el = document.getElementById('scanner-result');
  el.textContent = message;
  el.className = 'scanner-result ' + (type || '');
  el.classList.remove('hidden');
}

function hideScannerResult() {
  const el = document.getElementById('scanner-result');
  el.classList.add('hidden');
  el.textContent = '';
}
