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
  ];

  const response = await gapi.client.sheets.spreadsheets.values.append({
    spreadsheetId: CONFIG.SPREADSHEET_ID,
    range: `${CONFIG.SHEET_NAME}!A:L`,
    valueInputOption: 'USER_ENTERED',
    insertDataOption: 'INSERT_ROWS',
    resource: { values: [values] },
  });

  return response;
}

async function getAllRows() {
  const response = await gapi.client.sheets.spreadsheets.values.get({
    spreadsheetId: CONFIG.SPREADSHEET_ID,
    range: `${CONFIG.SHEET_NAME}!A2:L`,
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
  ];

  const response = await gapi.client.sheets.spreadsheets.values.update({
    spreadsheetId: CONFIG.SPREADSHEET_ID,
    range: `${CONFIG.SHEET_NAME}!A${rowIndex}:L${rowIndex}`,
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
