const CONFIG = {
  API_KEY: 'AIzaSyD-OT81VKp_MvfXZsW0lPyMyGLWSnqAVxA',
  FOLDER_ID: '1A7S0gcPylw5F2V9OrtVsUn8gxBoKtQxM'
};

// Database Angka Gizi Default (4 Porsi + Serat)
let currentNutrition = {
  balita: { kalori: '556,5 kkal', protein: '21,8 g', karbo: '62,9 g', lemak: '24 g', serat: '4,7 g' },
  kecil:  { kalori: '556,5 kkal', protein: '21,8 g', karbo: '62,9 g', lemak: '24 g', serat: '4,7 g' },
  besar:  { kalori: '695,4 kkal', protein: '27,5 g', karbo: '85,5 g', lemak: '26,9 g', serat: '5 g' },
  bumil:  { kalori: '862,4 kkal', protein: '35,3 g', karbo: '105,9 g', lemak: '32,4 g', serat: '5,1 g' }
};

async function fetchLatestPhoto() {
  const loadingEl = document.getElementById('loading');
  const errorEl = document.getElementById('error');
  const errorMsg = document.getElementById('error-message');
  const imgContainer = document.getElementById('image-container');
  const photoImg = document.getElementById('photo-display');
  const photoDate = document.getElementById('photo-date');

  const query = encodeURIComponent(`'${CONFIG.FOLDER_ID}' in parents and mimeType contains 'image/' and trashed = false`);
  const url = `https://www.googleapis.com/drive/v3/files?q=${query}&orderBy=createdTime desc&pageSize=1&fields=files(id,name,createdTime)&key=${CONFIG.API_KEY}`;

  try {
    const response = await fetch(url);
    if (!response.ok) {
      const errData = await response.json();
      throw new Error(errData.error?.message || 'Gagal terhubung ke Google Drive API');
    }
    
    const data = await response.json();

    if (data.files && data.files.length > 0) {
      const fileId = data.files[0].id;
      const createdTime = data.files[0].createdTime;

      if (photoDate) {
        const dateObj = new Date(createdTime);
        photoDate.textContent = `Diunggah: ${dateObj.toLocaleDateString('id-ID', {
          day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit'
        })}`;
      }

      const directImageUrl = `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media&key=${CONFIG.API_KEY}`;
      const fallbackUrl = `https://lh3.googleusercontent.com/d/${fileId}`;

      photoImg.onload = () => {
        if (loadingEl) loadingEl.classList.add('hidden');
        if (errorEl) errorEl.classList.add('hidden');
        if (imgContainer) imgContainer.classList.remove('hidden');

        // Jalankan OCR Cloud Vision API
        runGoogleVisionOCR(directImageUrl);
      };

      photoImg.onerror = () => {
        if (photoImg.src !== fallbackUrl) {
          photoImg.src = fallbackUrl;
        } else {
          if (loadingEl) loadingEl.classList.add('hidden');
          if (errorMsg) errorMsg.textContent = 'Gagal memuat file gambar.';
          if (errorEl) errorEl.classList.remove('hidden');
        }
      };

      photoImg.crossOrigin = 'Anonymous';
      photoImg.src = directImageUrl;

    } else {
      if (loadingEl) loadingEl.classList.add('hidden');
      if (errorMsg) errorMsg.textContent = 'Belum ada foto yang diunggah di folder Google Drive.';
      if (errorEl) errorEl.classList.remove('hidden');
    }
  } catch (err) {
    if (loadingEl) loadingEl.classList.add('hidden');
    if (errorMsg) errorMsg.textContent = `Error: ${err.message}`;
    if (errorEl) errorEl.classList.remove('hidden');
    console.error('Drive API Error:', err);
  }
}

// 🔍 PEMINDAIAN MENGGUNAKAN GOOGLE CLOUD VISION API (DOCUMENT_TEXT_DETECTION)
async function runGoogleVisionOCR(imageUrl) {
  const menuTitleEl = document.getElementById('menu-title');
  const originalTitle = menuTitleEl ? menuTitleEl.textContent : '';

  try {
    if (menuTitleEl) menuTitleEl.textContent = '🔍 Memindai poster dengan Google Vision AI...';

    const visionApiUrl = `https://vision.googleapis.com/v1/images:annotate?key=${CONFIG.API_KEY}`;
    
    const requestBody = {
      requests: [
        {
          image: { source: { imageUri: imageUrl } },
          features: [ { type: "DOCUMENT_TEXT_DETECTION" } ] // Khusus dokumen/tabel
        }
      ]
    };

    const res = await fetch(visionApiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestBody)
    });

    const visionData = await res.json();
    
    if (visionData.responses && visionData.responses[0]?.fullTextAnnotation) {
      const extractedText = visionData.responses[0].fullTextAnnotation.text;
      console.log("--- TEKS HASIL GOOGLE VISION API ---");
      console.log(extractedText);

      parseVisionOCRText(extractedText);
    }

    if (menuTitleEl) menuTitleEl.textContent = originalTitle;

  } catch (err) {
    console.warn("Google Vision API Error/Fallback:", err);
    if (menuTitleEl) menuTitleEl.textContent = originalTitle;
  }
}

// 🧪 PARSER TABEL POSTER DENGAN PEMBERSIHAN HURUF 'g' SAMAR
function parseVisionOCRText(text) {
  const lines = text.split('\n');

  lines.forEach(line => {
    // 1. Bersihkan huruf 'g' yang keliru dibaca angka '9' di akhir angka (misal: "21,8 9" -> "21,8 g")
    let cleanedLine = line.replace(/(\d+[\.,]?\d*)\s*9\b/g, '$1 g');

    // 2. Ekstraksi deretan angka desimal
    const numbers = cleanedLine.match(/(\d+[\.,]\d+|\d+)/g);

    if (numbers && numbers.length >= 5) {
      const porsiData = {
        kalori: `${numbers[0]} kkal`,
        protein: `${numbers[1]} g`,
        lemak: `${numbers[2]} g`,
        karbo: `${numbers[3]} g`,
        serat: `${numbers[4]} g`
      };

      if (/kecil/i.test(line)) {
        currentNutrition.kecil = porsiData;
      } else if (/besar/i.test(line)) {
        currentNutrition.besar = porsiData;
      } else if (/balita/i.test(line)) {
        currentNutrition.balita = porsiData;
      } else if (/bumil|busui/i.test(line)) {
        currentNutrition.bumil = porsiData;
      }
    }
  });

  const activeBtn = document.querySelector('.btn-porsi.active');
  const porsiType = activeBtn ? activeBtn.getAttribute('data-porsi') : 'kecil';
  applyNutritionToUI(porsiType);
}

function applyNutritionToUI(porsiType) {
  const data = currentNutrition[porsiType];
  if (data) {
    const elKalori = document.getElementById('val-kalori');
    const elProtein = document.getElementById('val-protein');
    const elKarbo = document.getElementById('val-karbo');
    const elLemak = document.getElementById('val-lemak');
    const elSerat = document.getElementById('val-serat');

    if (elKalori) elKalori.textContent = data.kalori;
    if (elProtein) elProtein.textContent = data.protein;
    if (elKarbo) elKarbo.textContent = data.karbo;
    if (elLemak) elLemak.textContent = data.lemak;
    if (elSerat) elSerat.textContent = data.serat || '-';
  }
}

document.addEventListener('DOMContentLoaded', () => {
  fetchLatestPhoto();

  const porsiButtons = document.querySelectorAll('.btn-porsi');

  porsiButtons.forEach(button => {
    button.addEventListener('click', (e) => {
      const porsiType = e.currentTarget.getAttribute('data-porsi');

      porsiButtons.forEach(btn => btn.classList.remove('active'));
      e.currentTarget.classList.add('active');

      applyNutritionToUI(porsiType);
    });
  });
});