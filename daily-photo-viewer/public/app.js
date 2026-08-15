const CONFIG = {
  API_KEY: 'AIzaSyD-OT81VKp_MvfXZsW0lPyMyGLWSnqAVxA',
  FOLDER_ID: '1L29gVsvLXZQ_M6A1_ultd_2JYSkF9UnO'
};

async function fetchLatestPhoto() {
  const loadingEl = document.getElementById('loading');
  const errorEl = document.getElementById('error');
  const errorMsg = document.getElementById('error-message');
  const imgContainer = document.getElementById('image-container');
  const photoImg = document.getElementById('photo-display');
  const photoDate = document.getElementById('photo-date');

  // Query Google Drive API v3 (PRD F-01)
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

      // Format tanggal unggah
      const dateObj = new Date(createdTime);
      photoDate.textContent = `Diunggah: ${dateObj.toLocaleDateString('id-ID', {
        day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit'
      })}`;

      // URL Media Google Drive API v3 (Direct Stream via API Key)
      const directImageUrl = `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media&key=${CONFIG.API_KEY}`;
      
      // Fallback URL jika butuh thumbnail
      const fallbackUrl = `https://lh3.googleusercontent.com/d/${fileId}`;

      // Pasang handler sebelum merubah src
      photoImg.onload = () => {
        loadingEl.classList.add('hidden');
        errorEl.classList.add('hidden');
        imgContainer.classList.remove('hidden');
      };

      photoImg.onerror = () => {
        // Jika link API gagal, coba fallback CDN
        if (photoImg.src !== fallbackUrl) {
          photoImg.src = fallbackUrl;
        } else {
          loadingEl.classList.add('hidden');
          errorMsg.textContent = 'Gagal memuat file gambar.';
          errorEl.classList.remove('hidden');
        }
      };

      photoImg.src = directImageUrl;

    } else {
      loadingEl.classList.add('hidden');
      errorMsg.textContent = 'Belum ada foto yang diunggah di folder Google Drive.';
      errorEl.classList.remove('hidden');
    }
  } catch (err) {
    loadingEl.classList.add('hidden');
    errorMsg.textContent = `Error: ${err.message}`;
    errorEl.classList.remove('hidden');
    console.error('Drive API Error:', err);
  }
}

document.addEventListener('DOMContentLoaded', fetchLatestPhoto);