const CONFIG = {
  DRIVE_API_KEY: 'AIzaSyD-OT81VKp_MvfXZsW0lPyMyGLWSnqAVxA',
  FOLDER_ID: '1A7S0gcPylw5F2V9OrtVsUn8gxBoKtQxM',
  GEMINI_API_KEY: 'AQ.Ab8RN6IJipjRcqMkL77seSDSr1SrHnwD97nkFj0ozHwa_A-jxQ' // <-- Masukkan API Key Gemini di sini
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

      const directImageUrl = `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media&key=${CONFIG.DRIVE_API_KEY}`;
      const fallbackUrl = `https://lh3.googleusercontent.com/d/${fileId}`;

      photoImg.onload = () => {
        if (loadingEl) loadingEl.classList.add('hidden');
        if (errorEl) errorEl.classList.add('hidden');
        if (imgContainer) imgContainer.classList.remove('hidden');

        // Panggil Gemini AI untuk mengekstrak data dari gambar
        runGeminiVisionAI(photoImg);
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
async function runGeminiVisionAI(imgElement) {
  const menuTitleEl = document.getElementById('menu-title');
  const originalTitle = menuTitleEl ? menuTitleEl.textContent : '';

  try {
    if (menuTitleEl) menuTitleEl.textContent = '🤖 Gemini AI sedang membaca data gizi dari poster...';

    const base64Data = getBase64Image(imgElement);

    // Prompt khusus agar Gemini mengembalikan JSON murni
    const promptText = `
    Analisis tabel gizi pada poster ini. Ekstrak data gizi untuk 4 kategori porsi: "kecil", "besar", "balita", dan "bumil" (Bumil & Busui).
    Berikan output HANYA dalam format JSON valid tanpa teks atau markdown tambahan seperti ini:
    {
      "kecil": {"kalori": "439,3 kkal", "protein": "23,3 g", "lemak": "9,8 g", "karbo": "64 g", "serat": "1,6 g"},
      "besar": {"kalori": "606,5 kkal", "protein": "27,8 g", "lemak": "17,1 g", "karbo": "85,1 g", "serat": "1,8 g"},
      "balita": {"kalori": "439,3 kkal", "protein": "23,3 g", "lemak": "9,8 g", "karbo": "64 g", "serat": "1,6 g"},
      "bumil": {"kalori": "773,5 kkal", "protein": "35,5 g", "lemak": "22,5 g", "karbo": "105,5 g", "serat": "1,9 g"}
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
      ]
    };

    const res = await fetch(geminiEndpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestBody)
    });

    const result = await res.json();

    if (result.candidates && result.candidates[0].content.parts[0].text) {
      let rawText = result.candidates[0].content.parts[0].text;
      console.log("--- RAW GEMINI AI RESPONSE ---", rawText);

      // Bersihkan karakter markdown ```json jika ada
      rawText = rawText.replace(/```json/g, '').replace(/```/g, '').trim();

      const parsedJSON = JSON.parse(rawText);
      currentNutrition = { ...currentNutrition, ...parsedJSON };

      console.log("--- HASIL PARSE GEMINI AI ---", currentNutrition);
    }

    if (menuTitleEl) menuTitleEl.textContent = originalTitle;

    // Refresh Tampilan UI
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