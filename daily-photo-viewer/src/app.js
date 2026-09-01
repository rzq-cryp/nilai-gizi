const CONFIG = {
  API_KEY: 'AIzaSyD-OT81VKp_MvfXZsW0lPyMyGLWSnqAVxA',
  FOLDER_ID: '1A7S0gcPylw5F2V9OrtVsUn8gxBoKtQxM'
};

// Database Angka Gizi Default (4 Porsi + Serat)
let currentNutrition = {
  balita: { kalori: '452,6 kkal', protein: '15,8 g', karbo: '62,8 g', lemak: '15,6 g', serat: '0,5 g' },
  kecil:  { kalori: '452,6 kkal', protein: '15,8 g', karbo: '62,8 g', lemak: '15,6 g', serat: '0,5 g' },
  besar:  { kalori: '637,9 kkal', protein: '23,7 g', karbo: '83,4 g', lemak: '23,4 g', serat: '0,8 g' },
  bumil:  { kalori: '804,9 kkal', protein: '31,5 g', karbo: '103,9 g', lemak: '28,9 g', serat: '0,9 g' }
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

        runOCRProcessing(photoImg);
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

// 🔍 PEMINDAIAN TEKS OCR
async function runOCRProcessing(imageElement) {
  const menuTitleEl = document.getElementById('menu-title');
  const originalTitle = menuTitleEl ? menuTitleEl.textContent : '';

  try {
    if (menuTitleEl) menuTitleEl.textContent = '🔍 Memindai teks gizi dari poster...';

    const worker = await Tesseract.createWorker('ind');
    const result = await worker.recognize(imageElement);
    await worker.terminate();

    const extractedText = result.data.text;
    console.log("--- TEKS POSTER TERSEDIA ---");
    console.log(extractedText);

    parsePosterOCR(extractedText);

    if (menuTitleEl) menuTitleEl.textContent = originalTitle;

  } catch (ocrError) {
    console.warn("OCR Error/Skipped:", ocrError);
    if (menuTitleEl) menuTitleEl.textContent = originalTitle;
  }
}

// 🧪 PARSER MATRIKS TABEL POSTER
function parsePosterOCR(text) {
  const lines = text.split('\n');

  lines.forEach(line => {
    // Cari baris porsi dan ekstrak deretan angkanya (misal: 452,6 kkal 15,8 g 15,6 g 62,8 g 0,5 g)
    const numbers = line.match(/(\d+[\.,]?\d*)/g);

    if (numbers && numbers.length >= 4) {
      const porsiData = {
        kalori: `${numbers[0]} kkal`,
        protein: `${numbers[1]} g`,
        lemak: `${numbers[2]} g`,
        karbo: `${numbers[3]} g`,
        serat: numbers[4] ? `${numbers[4]} g` : '-'
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