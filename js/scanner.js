// Barcode Scanner using Html5-QRCode + OCR using Tesseract.js

let html5QrCode = null;
let ocrStream = null;
let ocrVideo = null;
let ocrCanvas = null;
let ocrCallback = null;

// --- Barcode Scanner ---

function startScanner(onDecoded) {
  const scannerContainer = document.getElementById('scanner-container');
  scannerContainer.classList.remove('hidden');
  document.getElementById('ocr-capture-btn').classList.add('hidden');

  html5QrCode = new Html5Qrcode('scanner-video');

  const config = {
    fps: 15,
    qrbox: function(viewfinderWidth, viewfinderHeight) {
      return {
        width: Math.floor(viewfinderWidth * 0.8),
        height: Math.floor(viewfinderHeight * 0.5),
      };
    },
    aspectRatio: 1.0,
    formatsToSupport: [
      Html5QrcodeSupportedFormats.EAN_13,
      Html5QrcodeSupportedFormats.EAN_8,
      Html5QrcodeSupportedFormats.UPC_A,
      Html5QrcodeSupportedFormats.UPC_E,
      Html5QrcodeSupportedFormats.CODE_128,
      Html5QrcodeSupportedFormats.CODE_39,
      Html5QrcodeSupportedFormats.ITF,
    ],
  };

  html5QrCode
    .start(
      { facingMode: 'environment' },
      config,
      (decodedText) => {
        stopScanner();
        onDecoded(decodedText);
      },
      () => {}
    )
    .catch((err) => {
      scannerContainer.classList.add('hidden');
      html5QrCode = null;

      if (err.toString().includes('NotAllowedError')) {
        showError('Camera permission denied. Please allow camera access and try again.');
      } else if (err.toString().includes('NotFoundError')) {
        showError('No camera found. Please use a device with a camera.');
      } else {
        showError('Could not start camera: ' + err);
      }
    });
}

function stopScanner() {
  const scannerContainer = document.getElementById('scanner-container');
  document.getElementById('ocr-capture-btn').classList.add('hidden');

  if (html5QrCode && html5QrCode.isScanning) {
    html5QrCode.stop().then(() => {
      html5QrCode.clear();
      html5QrCode = null;
      scannerContainer.classList.add('hidden');
    }).catch(() => {
      html5QrCode = null;
      scannerContainer.classList.add('hidden');
    });
  } else {
    scannerContainer.classList.add('hidden');
  }

  stopOcrScanner();
}

// --- OCR Scanner ---

function startOcrScanner(onSetNumberFound) {
  const scannerContainer = document.getElementById('scanner-container');
  const videoEl = document.getElementById('scanner-video');
  scannerContainer.classList.remove('hidden');

  ocrCallback = onSetNumberFound;

  // Clear any leftover content and create a video element
  videoEl.innerHTML = '';
  const video = document.createElement('video');
  video.setAttribute('autoplay', '');
  video.setAttribute('playsinline', '');
  video.style.width = '100%';
  video.style.borderRadius = '8px';
  videoEl.appendChild(video);
  ocrVideo = video;

  const canvas = document.createElement('canvas');
  canvas.style.display = 'none';
  videoEl.appendChild(canvas);
  ocrCanvas = canvas;

  // Show the capture button
  document.getElementById('ocr-capture-btn').classList.remove('hidden');

  navigator.mediaDevices.getUserMedia({
    video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } }
  }).then((stream) => {
    ocrStream = stream;
    video.srcObject = stream;
  }).catch((err) => {
    scannerContainer.classList.add('hidden');
    document.getElementById('ocr-capture-btn').classList.add('hidden');
    if (err.name === 'NotAllowedError') {
      showError('Camera permission denied. Please allow camera access and try again.');
    } else if (err.name === 'NotFoundError') {
      showError('No camera found. Please use a device with a camera.');
    } else {
      showError('Could not start camera: ' + err.message);
    }
  });
}

async function captureAndOcr() {
  if (!ocrStream || !ocrVideo || !ocrCanvas) return;

  const captureBtn = document.getElementById('ocr-capture-btn');
  captureBtn.disabled = true;
  captureBtn.textContent = 'Reading...';
  showScannerResult('Reading numbers from image...', 'loading');

  try {
    ocrCanvas.width = ocrVideo.videoWidth;
    ocrCanvas.height = ocrVideo.videoHeight;
    const ctx = ocrCanvas.getContext('2d');
    ctx.drawImage(ocrVideo, 0, 0);

    const result = await Tesseract.recognize(ocrCanvas, 'eng', {
      tessedit_char_whitelist: '0123456789- ',
    });

    const text = result.data.text.trim();
    // Find all 4-6 digit numbers (potential LEGO set numbers)
    const allMatches = text.match(/\d{4,6}/g);

    if (allMatches && allMatches.length > 0) {
      // Deduplicate
      const unique = [...new Set(allMatches)];
      showOcrChoices(unique);
    } else {
      showScannerResult('No numbers detected. Try moving closer to the set number and tap Capture again.', 'warning');
    }
  } catch {
    showScannerResult('OCR failed. Try again.', 'warning');
  }

  captureBtn.disabled = false;
  captureBtn.textContent = 'Capture';
}

function showOcrChoices(numbers) {
  const el = document.getElementById('scanner-result');
  el.className = 'scanner-result';
  el.classList.remove('hidden');
  el.innerHTML = '<span class="ocr-prompt">Which is the set number?</span> ';

  numbers.forEach((num) => {
    const btn = document.createElement('button');
    btn.className = 'btn btn-ocr-choice';
    btn.textContent = num;
    btn.addEventListener('click', () => {
      const cb = ocrCallback;
      stopScanner();
      if (cb) cb(num);
    });
    el.appendChild(btn);
  });

  const noneBtn = document.createElement('button');
  noneBtn.className = 'btn btn-ocr-choice btn-ocr-none';
  noneBtn.textContent = 'None of these';
  noneBtn.addEventListener('click', () => {
    showScannerResult('Try pointing the camera closer to the set number and tap Capture again.', 'warning');
  });
  el.appendChild(noneBtn);
}

function stopOcrScanner() {
  if (ocrStream) {
    ocrStream.getTracks().forEach(track => track.stop());
    ocrStream = null;
  }
  ocrVideo = null;
  ocrCanvas = null;
  ocrCallback = null;
  document.getElementById('ocr-capture-btn').classList.add('hidden');
}
