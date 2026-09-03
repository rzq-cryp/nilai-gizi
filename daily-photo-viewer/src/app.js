const CONFIG = {
  DRIVE_API_KEY: import.meta.env.VITE_DRIVE_API_KEY,
  FOLDER_ID: import.meta.env.VITE_FOLDER_ID,
  GEMINI_API_KEY: import.meta.env.VITE_GEMINI_API_KEY,
};

// Database Angka Gizi Default
let currentNutrition = {
  balita: { kalori: '439,3 kkal', protein: '23,3 g', karbo: '64 g', lemak: '9,8 g', serat: '1,6 g' },
  kecil:  { kalori: '439,3 kkal', protein: '23,3 g', karbo: '64 g', lemak: '9,8 g', serat: '1,6 g' },
  besar:  { kalori: '606,5 kkal', protein: '27,8 g', karbo: '85,1 g', lemak: '17,1 g', serat: '1,8 g' },
  bumil:  { kalori: '773,5 kkal', protein: '35,5 g', karbo: '105,5 g', lemak: '22,5 g', serat: '1,9 g' }
};

async function fetchLatestPhoto() {
  const loadingEl = document.getElementById('loading');
  const errorEl = document.getElementById('error');
  const errorMsg = document.getElementById('error-message');
  const imgContainer = document.getElementById('image-container');
  const photoImg = document.getElementById('photo-display');
  const photoDate = document.getElementById('photo-date');

  // Pengecekan awal ketersediaan API Key
  if (!CONFIG.DRIVE_API_KEY || !CONFIG.GEMINI_API_KEY) {
    if (loadingEl) loadingEl.classList.add('hidden');
    if (errorMsg) errorMsg.textContent = 'API Key belum dikonfigurasi. Periksa file .env lokal atau Environment Variables Vercel.';
    if (errorEl) errorEl.classList.remove('hidden');
    console.error('Environment variables missing:', CONFIG);
    return;
  }

  const query = encodeURIComponent(`'${CONFIG.FOLDER_ID}' in parents and mimeType contains 'image/' and trashed = false`);
  const url = `https://www.googleapis.com/drive/v3/files?q=${query}&orderBy=createdTime desc&pageSize=1&fields=files(id,name,createdTime)&key=${CONFIG.DRIVE_API_KEY}`;

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

      // URL foto langsung dan fallback Googleusercontent
      const directImageUrl = `https://lh3.googleusercontent.com/d/${fileId}`;

      photoImg.onload = () => {
        if (loadingEl) loadingEl.classList.add('hidden');
        if (errorEl) errorEl.classList.add('hidden');
        if (imgContainer) imgContainer.classList.remove('hidden');

        // Cek localStorage
        const cacheKey = `nutrition_data_${fileId}`;
        const cachedData = localStorage.getItem(cacheKey);

        if (cachedData) {
          console.log("⚡ Data gizi dimuat langsung dari localStorage!");
          currentNutrition = JSON.parse(cachedData);
          
          const activeBtn = document.querySelector('.btn-porsi.active');
          const porsiType = activeBtn ? activeBtn.getAttribute('data-porsi') : 'kecil';
          applyNutritionToUI(porsiType);
        } else {
          runGeminiVisionAI(photoImg, fileId);
        }
      };

      photoImg.onerror = () => {
        if (loadingEl) loadingEl.classList.add('hidden');
        if (errorMsg) errorMsg.textContent = 'Gagal memuat file gambar dari Google Drive.';
        if (errorEl) errorEl.classList.remove('hidden');
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

// 📸 HELPER KONVERSI GAMBAR KE BASE64
function getBase64Image(imgEl) {
  const canvas = document.createElement('canvas');
  canvas.width = imgEl.naturalWidth || imgEl.width;
  canvas.height = imgEl.naturalHeight || imgEl.height;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(imgEl, 0, 0);
  const dataURL = canvas.toDataURL('image/jpeg');
  return dataURL.replace(/^data:image\/(png|jpg|jpeg);base64,/, '');
}

// 🤖 PROSES PEMBACAAN DENGAN GEMINI AI
async function runGeminiVisionAI(imgElement, fileId) {
  const menuTitleEl = document.getElementById('menu-title');
  const originalTitle = menuTitleEl ? menuTitleEl.textContent : '';

  try {
    if (menuTitleEl) menuTitleEl.textContent = '🤖 Gemini AI sedang menganalisis tabel gizi...';

    const base64Data = getBase64Image(imgElement);

    const promptText = `
    Anda adalah sistem ekstraksi OCR data presisi tinggi. 
    Tugas: Analisis tabel gizi pada gambar poster ini dengan sangat teliti.

    ATURAN EKSTRAKSI:
    1. Ekstrak data gizi persis sesuai angka yang tertera pada tabel poster (Energi/Kalori, Protein, Lemak, Karbohidrat, Serat).
    2. Kategori Porsi:
       - "kecil": Porsi Kecil
       - "besar": Porsi Besar
       - "balita": Porsi Balita
       - "bumil": Porsi Bumil & Busui
    3. Sertakan satuan (kkal atau g) pada setiap nilai.
    4. HANYA hasilkan JSON valid sesuai struktur persis berikut:

    {
      "kecil": {"kalori": "... kkal", "protein": "... g", "lemak": "... g", "karbo": "... g", "serat": "... g"},
      "besar": {"kalori": "... kkal", "protein": "... g", "lemak": "... g", "karbo": "... g", "serat": "... g"},
      "balita": {"kalori": "... kkal", "protein": "... g", "lemak": "... g", "karbo": "... g", "serat": "... g"},
      "bumil": {"kalori": "... kkal", "protein": "... g", "lemak": "... g", "karbo": "... g", "serat": "... g"}
    }
    `;

    const geminiEndpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${CONFIG.GEMINI_API_KEY}`;

    const requestBody = {
      contents: [
        {
          parts: [
            { text: promptText },
            {
              inline_data: {
                mime_type: "image/jpeg",
                data: base64Data
              }
            }
          ]
        }
      ],
      generationConfig: {
        temperature: 0,
        response_mime_type: "application/json"
      }
    };

    const res = await fetch(geminiEndpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestBody)
    });

    const result = await res.json();

    if (result.error) {
      throw new Error(result.error.message || 'Gemini API Error');
    }

    if (result.candidates && result.candidates[0].content.parts[0].text) {
      let rawText = result.candidates[0].content.parts[0].text.trim();
      console.log("--- HASIL EKSTRAKSI GEMINI AI ---", rawText);

      const parsedJSON = JSON.parse(rawText);
      currentNutrition = { ...currentNutrition, ...parsedJSON };

      if (fileId) {
        const cacheKey = `nutrition_data_${fileId}`;
        localStorage.setItem(cacheKey, JSON.stringify(currentNutrition));
      }
    }

    if (menuTitleEl) menuTitleEl.textContent = originalTitle;

    const activeBtn = document.querySelector('.btn-porsi.active');
    const porsiType = activeBtn ? activeBtn.getAttribute('data-porsi') : 'kecil';
    applyNutritionToUI(porsiType);

  } catch (err) {
    console.warn("Gemini AI Error/Fallback:", err);
    if (menuTitleEl) menuTitleEl.textContent = originalTitle;
  }
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