// Google OAuth 2.0 Authentication

let tokenClient;
let accessToken = null;

function initAuth() {
  return new Promise((resolve) => {
    tokenClient = google.accounts.oauth2.initTokenClient({
      client_id: CONFIG.CLIENT_ID,
      scope: CONFIG.SCOPES,
      callback: (response) => {
        if (response.error) {
          console.error('Auth error:', response.error);
          onAuthChange(false);
          return;
        }
        accessToken = response.access_token;
        onAuthChange(true);
      },
    });
    resolve();
  });
}

function initGapi() {
  return new Promise((resolve, reject) => {
    gapi.load('client', async () => {
      try {
        await gapi.client.init({
          discoveryDocs: [CONFIG.DISCOVERY_DOC],
        });
        resolve();
      } catch (err) {
        reject(err);
      }
    });
  });
}

function signIn() {
  if (accessToken) {
    // Already have a token, just refresh
    tokenClient.requestAccessToken({ prompt: '' });
  } else {
    tokenClient.requestAccessToken({ prompt: 'consent' });
  }
}

function signOut() {
  if (accessToken) {
    google.accounts.oauth2.revoke(accessToken, () => {
      accessToken = null;
      gapi.client.setToken(null);
      onAuthChange(false);
    });
  }
}

function isSignedIn() {
  return accessToken !== null;
}

function getToken() {
  return accessToken;
}
