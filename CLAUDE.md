# LEGO Inventory Tracker

## Overview

A Progressive Web App (PWA) for tracking a personal LEGO collection. Uses Google Sheets as the backend database, with barcode/OCR scanning, set lookups via Rebrickable API, and market value tracking via web scraping. All prices are stored and displayed in Philippine Pesos (PHP).

**Live URL**: https://carlowelim.github.io/Lego-Tracker/

## Tech Stack

- **Frontend**: Vanilla JavaScript, HTML5, CSS3 (no frameworks)
- **Backend**: Google Sheets API v4 (OAuth 2.0)
- **Libraries (CDN)**: html5-qrcode (barcode scanning), Tesseract.js (OCR)
- **CORS Proxy**: Google Apps Script web app (deployed separately)

## File Structure

```
├── index.html              Main UI (tabs, forms, tables, dashboard)
├── manifest.json           PWA manifest
├── sw.js                   Service worker (cache v12)
├── gas-proxy.js            Google Apps Script CORS proxy (deploy template)
├── css/style.css           All styles (~809 lines, responsive)
├── js/
│   ├── config.js           API keys, spreadsheet ID, column definitions
│   ├── auth.js             Google OAuth 2.0 sign-in/sign-out
│   ├── sheets.js           Google Sheets CRUD (inventory + wishlist)
│   ├── scanner.js          Barcode scanner + OCR (camera-based)
│   ├── market.js           Market value lookups (BrickEconomy, BrickOwl)
│   ├── rebrickable.js      Set data lookups (Rebrickable API, Brickset scraping)
│   └── app.js              Main UI logic, event handlers, dashboard
└── icons/                  PWA icons (192px, 512px)
```

**Script load order matters**: config → auth → sheets → scanner → market → rebrickable → app. rebrickable.js depends on `fetchViaProxy()` from market.js.

## Google Sheets Schema

### Sheet1 (Inventory) — Columns A through O

| Col | Header         | Type   | Notes                                  |
|-----|----------------|--------|----------------------------------------|
| A   | Set Number     | Text   | e.g. "75192"                           |
| B   | Set Name       | Text   | Official name from Rebrickable         |
| C   | Theme          | Text   | e.g. "Star Wars"                       |
| D   | Pieces         | Number | Part count                             |
| E   | Purchase Date  | Date   | User-entered                           |
| F   | Purchase Price | Number | PHP — user-entered                     |
| G   | Store          | Text   | Where purchased                        |
| H   | Built Status   | Text   | "Yes" or "No"                          |
| I   | Notes          | Text   | Free text                              |
| J   | Date Added     | Date   | Auto-generated on add                  |
| K   | Barcode        | Text   | Scanned EAN/UPC                        |
| L   | Retail Price   | Number | PHP — converted from USD at lookup     |
| M   | Image URL      | Text   | Thumbnail from Rebrickable             |
| N   | Market Value   | Number | PHP — converted from USD at refresh    |
| O   | Value Date     | Date   | When market value was last updated     |

### Wishlist sheet — 9 columns

Set Number, Set Name, Theme, Pieces, Retail Price, Image URL, Priority (High/Medium/Low), Notes, Date Added

## External Services

| Service             | Purpose                    | Access Method          |
|---------------------|----------------------------|------------------------|
| Google Sheets API   | Data storage (CRUD)        | OAuth 2.0 REST         |
| Rebrickable API v3  | Set details (name, pieces) | API key in header      |
| Brickset            | Retail price (USD RRP)     | Scraping via proxy     |
| BrickEconomy        | Market value (retired sets)| Scraping via proxy     |
| BrickOwl            | Market value (retail sets) | Scraping via proxy     |
| UPCitemdb           | Barcode → product lookup   | Public REST (no key)   |
| ExchangeRate-API    | Live USD→PHP rate          | Public REST (no key)   |
| Google Apps Script  | CORS proxy for scraping    | Custom web app         |

## Currency Handling

- All prices stored in PHP (Philippine Pesos)
- USD prices from Brickset/BrickEconomy/BrickOwl are converted using live exchange rate from ExchangeRate-API
- Fallback rate: 58 PHP/USD (if API is down)
- `usdToPhpConvert(usd)` — converts USD to PHP
- `formatPHP(php)` — formats as "₱XX,XXX.XX" (no conversion, just display)

## Key Architecture Patterns

- **CORS Proxy**: All web scraping (Brickset, BrickEconomy, BrickOwl) goes through a Google Apps Script web app configured via `CONFIG.CORS_PROXY_URL`. The proxy returns `{"contents": "...html..."}`.
- **`fetchViaProxy(url)`** in market.js is the shared proxy helper used by both market.js and rebrickable.js.
- **Service Worker**: Cache-first for local assets, network pass-through for all API domains (Google, Rebrickable, proxy, etc). Bump `CACHE_NAME` version in sw.js whenever changing local files.
- **Client-side filtering**: `inventoryData` array cached in memory, `applyFiltersAndSort()` filters/sorts and re-renders.
- **Tab navigation**: Inventory and Wishlist tabs toggle section visibility.
- **Market value refresh**: Iterates all sets with 2-second delay between requests to avoid rate limiting.

## Config (js/config.js)

Contains sensitive values — API keys, spreadsheet ID, OAuth client ID, and the CORS proxy URL. The `COLUMNS` array defines the 15 sheet column headers and must match the actual sheet headers in row 1.

## Common Tasks

**Bumping the service worker cache**: Change `CACHE_NAME` in sw.js (e.g. `'lego-tracker-v13'`). Required after any change to local files, otherwise GitHub Pages will serve stale cached versions.

**Adding a new sheet column**: Update `COLUMNS` array in config.js, update range strings in sheets.js (e.g. `A:O` → `A:P`), update `getAllRows()` field mapping, update table HTML in app.js.

**Changing the CORS proxy**: Update `CONFIG.CORS_PROXY_URL` in config.js. The proxy must accept `?url=` parameter and return JSON `{"contents": "..."}`.

**Testing locally**: `npm start` runs http-server on port 3000.
