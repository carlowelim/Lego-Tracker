// App UI Logic

let scannedBarcode = '';

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
}

// Called by auth.js when auth state changes
function onAuthChange(signedIn) {
  document.getElementById('sign-in-btn').classList.toggle('hidden', signedIn);
  document.getElementById('sign-out-btn').classList.toggle('hidden', !signedIn);
  document.getElementById('add-set-section').classList.toggle('hidden', !signedIn);
  document.getElementById('inventory-section').classList.toggle('hidden', !signedIn);

  if (signedIn) {
    gapi.client.setToken({ access_token: getToken() });
    loadInventory();
  } else {
    document.getElementById('inventory-body').innerHTML = '';
    showStatus('Signed out. Sign in to view your inventory.');
  }
}

async function handleAddSet(e) {
  e.preventDefault();
  const form = e.target;
  const submitBtn = form.querySelector('button[type="submit"]');
  submitBtn.disabled = true;
  submitBtn.textContent = 'Saving...';

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
  };

  try {
    await appendRow(rowData);
    form.reset();
    scannedBarcode = '';
    hideScannerResult();
    showStatus('Set added successfully!');
    await loadInventory();
  } catch (err) {
    showError('Failed to add set: ' + err.message);
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = 'Add Set';
  }
}

async function loadInventory() {
  const tbody = document.getElementById('inventory-body');
  tbody.innerHTML = '<tr><td colspan="10" class="loading">Loading inventory...</td></tr>';

  try {
    const rows = await getAllRows();

    if (rows.length === 0) {
      tbody.innerHTML = '<tr><td colspan="10" class="loading">No sets in inventory. Add your first set above!</td></tr>';
      return;
    }

    tbody.innerHTML = rows
      .map(
        (row) => `
      <tr>
        <td data-label="Set #">${escapeHtml(row.setNumber)}</td>
        <td data-label="Name">${escapeHtml(row.setName)}</td>
        <td data-label="Theme">${escapeHtml(row.theme)}</td>
        <td data-label="Pieces">${escapeHtml(row.pieces)}</td>
        <td data-label="Retail">${row.retailPrice ? '$' + escapeHtml(row.retailPrice) : ''}</td>
        <td data-label="Paid">${row.purchasePrice ? '$' + escapeHtml(row.purchasePrice) : ''}</td>
        <td data-label="Store">${escapeHtml(row.store)}</td>
        <td data-label="Date Added">${escapeHtml(row.dateAdded)}</td>
        <td data-label="Built">
          <label class="built-toggle">
            <input type="checkbox" ${row.builtStatus === 'Yes' ? 'checked' : ''}
              onchange="toggleBuilt(${row.rowIndex}, this.checked)">
            <span class="built-label">${row.builtStatus === 'Yes' ? 'Built' : 'Unbuilt'}</span>
          </label>
        </td>
        <td data-label="Actions">
          <button class="btn-delete" onclick="handleDelete(${row.rowIndex})">Delete</button>
        </td>
      </tr>`
      )
      .join('');
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="10" class="loading error">Failed to load inventory: ${escapeHtml(err.message)}</td></tr>`;
  }
}

async function toggleBuilt(rowIndex, isBuilt) {
  try {
    await updateBuiltStatus(rowIndex, isBuilt ? 'Yes' : 'No');
    await loadInventory();
  } catch (err) {
    showError('Failed to update status: ' + err.message);
    await loadInventory(); // Reload to reset checkbox state
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

  // Step 1: Try UPC → set number mapping
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

  // Step 2: Fetch details from Rebrickable
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

    const priceInfo = setData.retailPrice ? ` — RRP $${setData.retailPrice}` : '';
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
