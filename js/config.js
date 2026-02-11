// Google API Configuration
// Fill in your own values from Google Cloud Console and Google Sheets

const CONFIG = {
  CLIENT_ID: '1032725379633-0qcrjqag4dci0b6u32afubbdl4ecba8u.apps.googleusercontent.com',
  SPREADSHEET_ID: '1BVButSBeQpQiY2GrmA0GmBV6FKcdbiaeSlXGcULEbb0',
  SHEET_NAME: 'Sheet1',
  SCOPES: 'https://www.googleapis.com/auth/spreadsheets',
  DISCOVERY_DOC: 'https://sheets.googleapis.com/$discovery/rest?version=v4',
  REBRICKABLE_API_KEY: 'c9fbaf5ef76f2efb744c9f95f8274853',
  BRICKOWL_API_KEY: '5b7463a92b7e511ca2a4ec18889359055c080b3e3d619ccbe44c79f1292ac289',
};

// Column headers matching the sheet
const COLUMNS = [
  'Set Number',
  'Set Name',
  'Theme',
  'Pieces',
  'Purchase Date',
  'Purchase Price',
  'Store',
  'Built Status',
  'Notes',
  'Date Added',
  'Barcode',
  'Retail Price',
];
