// Google Sheets CRUD Operations

async function appendRow(rowData) {
  const values = [
    rowData.setNumber,
    rowData.setName,
    rowData.theme,
    rowData.pieces,
    rowData.purchaseDate,
    rowData.purchasePrice,
    rowData.store,
    rowData.builtStatus || 'No',
    rowData.notes,
    new Date().toISOString().split('T')[0], // Date Added
    rowData.barcode || '',
    rowData.retailPrice || '',
    rowData.imageUrl || '',
  ];

  const response = await gapi.client.sheets.spreadsheets.values.append({
    spreadsheetId: CONFIG.SPREADSHEET_ID,
    range: `${CONFIG.SHEET_NAME}!A:O`,
    valueInputOption: 'USER_ENTERED',
    insertDataOption: 'INSERT_ROWS',
    resource: { values: [values] },
  });

  return response;
}

async function getAllRows() {
  const response = await gapi.client.sheets.spreadsheets.values.get({
    spreadsheetId: CONFIG.SPREADSHEET_ID,
    range: `${CONFIG.SHEET_NAME}!A2:O`,
  });

  const rows = response.result.values || [];
  return rows.map((row, index) => ({
    rowIndex: index + 2, // +2 because row 1 is headers, API is 1-indexed
    setNumber: row[0] || '',
    setName: row[1] || '',
    theme: row[2] || '',
    pieces: row[3] || '',
    purchaseDate: row[4] || '',
    purchasePrice: row[5] || '',
    store: row[6] || '',
    builtStatus: row[7] || 'No',
    notes: row[8] || '',
    dateAdded: row[9] || '',
    barcode: row[10] || '',
    retailPrice: row[11] || '',
    imageUrl: row[12] || '',
    marketValue: row[13] || '',
    valueDate: row[14] || '',
  }));
}

async function updateRow(rowIndex, data) {
  const values = [
    data.setNumber,
    data.setName,
    data.theme,
    data.pieces,
    data.purchaseDate,
    data.purchasePrice,
    data.store,
    data.builtStatus,
    data.notes,
    data.dateAdded,
    data.barcode || '',
    data.retailPrice || '',
    data.imageUrl || '',
    data.marketValue || '',
    data.valueDate || '',
  ];

  const response = await gapi.client.sheets.spreadsheets.values.update({
    spreadsheetId: CONFIG.SPREADSHEET_ID,
    range: `${CONFIG.SHEET_NAME}!A${rowIndex}:O${rowIndex}`,
    valueInputOption: 'USER_ENTERED',
    resource: { values: [values] },
  });

  return response;
}

async function deleteRow(rowIndex) {
  // Get the sheet's gid (sheetId) first
  const sheetMeta = await gapi.client.sheets.spreadsheets.get({
    spreadsheetId: CONFIG.SPREADSHEET_ID,
  });

  const sheet = sheetMeta.result.sheets.find(
    (s) => s.properties.title === CONFIG.SHEET_NAME
  );
  const sheetId = sheet.properties.sheetId;

  const response = await gapi.client.sheets.spreadsheets.batchUpdate({
    spreadsheetId: CONFIG.SPREADSHEET_ID,
    resource: {
      requests: [
        {
          deleteDimension: {
            range: {
              sheetId: sheetId,
              dimension: 'ROWS',
              startIndex: rowIndex - 1, // 0-indexed
              endIndex: rowIndex,
            },
          },
        },
      ],
    },
  });

  return response;
}

async function updateBuiltStatus(rowIndex, builtStatus) {
  const response = await gapi.client.sheets.spreadsheets.values.update({
    spreadsheetId: CONFIG.SPREADSHEET_ID,
    range: `${CONFIG.SHEET_NAME}!H${rowIndex}`,
    valueInputOption: 'USER_ENTERED',
    resource: { values: [[builtStatus]] },
  });

  return response;
}

// --- Wishlist Sheet Operations ---

const WISHLIST_SHEET_NAME = 'Wishlist';

async function appendWishlistRow(rowData) {
  const values = [
    rowData.setNumber,
    rowData.setName,
    rowData.theme,
    rowData.pieces,
    rowData.retailPrice || '',
    rowData.imageUrl || '',
    rowData.priority || 'Medium',
    rowData.notes || '',
    new Date().toISOString().split('T')[0], // Date Added
  ];

  const response = await gapi.client.sheets.spreadsheets.values.append({
    spreadsheetId: CONFIG.SPREADSHEET_ID,
    range: `${WISHLIST_SHEET_NAME}!A:I`,
    valueInputOption: 'USER_ENTERED',
    insertDataOption: 'INSERT_ROWS',
    resource: { values: [values] },
  });

  return response;
}

async function getAllWishlistRows() {
  try {
    const response = await gapi.client.sheets.spreadsheets.values.get({
      spreadsheetId: CONFIG.SPREADSHEET_ID,
      range: `${WISHLIST_SHEET_NAME}!A2:I`,
    });

    const rows = response.result.values || [];
    return rows.map((row, index) => ({
      rowIndex: index + 2,
      setNumber: row[0] || '',
      setName: row[1] || '',
      theme: row[2] || '',
      pieces: row[3] || '',
      retailPrice: row[4] || '',
      imageUrl: row[5] || '',
      priority: row[6] || 'Medium',
      notes: row[7] || '',
      dateAdded: row[8] || '',
    }));
  } catch (err) {
    // Sheet may not exist yet
    if (err.result && err.result.error && err.result.error.code === 400) {
      return [];
    }
    throw err;
  }
}

async function deleteWishlistRow(rowIndex) {
  const sheetMeta = await gapi.client.sheets.spreadsheets.get({
    spreadsheetId: CONFIG.SPREADSHEET_ID,
  });

  const sheet = sheetMeta.result.sheets.find(
    (s) => s.properties.title === WISHLIST_SHEET_NAME
  );

  if (!sheet) return;

  const sheetId = sheet.properties.sheetId;

  const response = await gapi.client.sheets.spreadsheets.batchUpdate({
    spreadsheetId: CONFIG.SPREADSHEET_ID,
    resource: {
      requests: [
        {
          deleteDimension: {
            range: {
              sheetId: sheetId,
              dimension: 'ROWS',
              startIndex: rowIndex - 1,
              endIndex: rowIndex,
            },
          },
        },
      ],
    },
  });

  return response;
}

async function ensureWishlistSheet() {
  const sheetMeta = await gapi.client.sheets.spreadsheets.get({
    spreadsheetId: CONFIG.SPREADSHEET_ID,
  });

  const exists = sheetMeta.result.sheets.some(
    (s) => s.properties.title === WISHLIST_SHEET_NAME
  );

  if (!exists) {
    await gapi.client.sheets.spreadsheets.batchUpdate({
      spreadsheetId: CONFIG.SPREADSHEET_ID,
      resource: {
        requests: [
          {
            addSheet: {
              properties: { title: WISHLIST_SHEET_NAME },
            },
          },
        ],
      },
    });

    // Add headers
    await gapi.client.sheets.spreadsheets.values.update({
      spreadsheetId: CONFIG.SPREADSHEET_ID,
      range: `${WISHLIST_SHEET_NAME}!A1:I1`,
      valueInputOption: 'USER_ENTERED',
      resource: {
        values: [['Set Number', 'Set Name', 'Theme', 'Pieces', 'Retail Price', 'Image URL', 'Priority', 'Notes', 'Date Added']],
      },
    });
  }
}

// --- Market Value Operations ---

async function updateMarketValue(rowIndex, value, date) {
  const response = await gapi.client.sheets.spreadsheets.values.update({
    spreadsheetId: CONFIG.SPREADSHEET_ID,
    range: `${CONFIG.SHEET_NAME}!N${rowIndex}:O${rowIndex}`,
    valueInputOption: 'USER_ENTERED',
    resource: { values: [[value, date]] },
  });

  return response;
}
