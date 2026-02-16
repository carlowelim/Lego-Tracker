// Google Apps Script — CORS Proxy
// Deploy this as a web app in Google Apps Script (script.google.com)
//
// Steps:
// 1. Go to https://script.google.com and create a new project
// 2. Replace the contents of Code.gs with this code
// 3. Click Deploy > New deployment
// 4. Select type: Web app
// 5. Execute as: Me
// 6. Who has access: Anyone
// 7. Click Deploy, authorize, and copy the Web app URL
// 8. Paste the URL into js/config.js as CORS_PROXY_URL

function doGet(e) {
  var url = e.parameter.url;
  if (!url) {
    return ContentService.createTextOutput(JSON.stringify({ error: 'Missing url parameter' }))
      .setMimeType(ContentService.MimeType.JSON);
  }

  try {
    var response = UrlFetchApp.fetch(url, {
      muteHttpExceptions: true,
      followRedirects: true,
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; LegoTracker/1.0)',
      },
    });

    var content = response.getContentText();
    return ContentService.createTextOutput(JSON.stringify({ contents: content }))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({ error: err.message }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}
