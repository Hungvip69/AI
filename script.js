/*
  script.js
  - Tách logic JavaScript khỏi HTML, dùng async/await
  - Thêm nhập URL mô hình, nút Tải mô hình, Bắt đầu/Dừng
  - Hiển thị nhãn, emoji và điểm tin cậy; xử lý lỗi thân thiện
*/

// Biến toàn cục p5/ml5
let classifier = null;          // Bộ phân loại ml5
let video = null;               // p5.MediaElement cho webcam
let flippedFrame = null;        // Khung hình đã lật để hiển thị & phân loại
let isRunning = false;          // Trạng thái đang phân loại

// Trạng thái kết quả
let currentLabel = 'Chưa có dữ liệu';
let currentConfidence = null;

// Tham chiếu DOM
let elModelUrl, elLoadBtn, elStartBtn, elStopBtn, elThemeToggle;
let elModelStatus, elLoader, elErrorArea;
let elResultLabel, elResultConf, elEmoji;

// Ghi chú: Các hàm p5 (setup/draw) cần ở scope toàn cục.
function setup() {
  // Tạo canvas với kích thước lớn hơn
  const canvas = createCanvas(640, 480);
  canvas.parent('video-container');
  
  // Khởi tạo webcam
  video = createCapture(VIDEO);
  video.size(640, 480);
  video.hide();
  // Đặt id để CSS có thể target nếu cần
  canvas.elt.id = 'video-canvas';
  background(14);
}

function draw() {
  background(14);
  // Chỉ vẽ video nếu đang chạy và có frame lật
  if (isRunning && flippedFrame) {
    image(flippedFrame, 0, 0);
  } else {
    // Placeholder nhẹ khi chưa chạy
    noStroke();
    fill(30);
    rect(0, 0, width, height, 12);
  }
}

// Khởi tạo sau khi DOM sẵn sàng
document.addEventListener('DOMContentLoaded', () => {
  // Lấy tham chiếu phần tử
  elModelUrl = document.getElementById('model-url');
  elLoadBtn = document.getElementById('load-model');
  elStartBtn = document.getElementById('start-btn');
  elStopBtn = document.getElementById('stop-btn');
  elThemeToggle = document.getElementById('theme-toggle');
  elModelStatus = document.getElementById('model-status');
  elLoader = document.getElementById('loader');
  elErrorArea = document.getElementById('error-area');
  elResultLabel = document.getElementById('result-label');
  elResultConf = document.getElementById('result-confidence');
  elEmoji = document.getElementById('emoji');

  // Sự kiện
  elLoadBtn.addEventListener('click', onLoadModel);
  elStartBtn.addEventListener('click', onStart);
  elStopBtn.addEventListener('click', onStop);
  elThemeToggle.addEventListener('click', toggleTheme);

  // Trạng thái ban đầu
  setModelStatus('Chưa tải mô hình');
  updateResults('Chưa có dữ liệu', null);
  setEmoji('');

  // Khởi tạo theme từ localStorage
  applyTheme(getSavedTheme());

  // Đặt model mặc định và tự tải
  const defaultModel = 'https://teachablemachine.withgoogle.com/models/wWLK3CJ0v/';
  if (!elModelUrl.value) elModelUrl.value = defaultModel;
  // Tự động tải mô hình mặc định (có thể bỏ nếu muốn thủ công)
  onLoadModel();

  // Năm bản quyền động
  const elYear = document.getElementById('year');
  if (elYear) {
    elYear.textContent = new Date().getFullYear();
  }
});

// --------- UI helpers ---------
function setModelStatus(text) {
  elModelStatus.textContent = text || '';
}
function showLoader(show) {
  elLoader.classList.toggle('hidden', !show);
  elLoader.setAttribute('aria-busy', show ? 'true' : 'false');
}
function showError(message) {
  elErrorArea.textContent = message || '';
  elErrorArea.classList.toggle('show', Boolean(message));
}
function updateResults(label, confidence) {
  currentLabel = label;
  currentConfidence = confidence;
  elResultLabel.textContent = label;
  if (typeof confidence === 'number') {
    const pct = Math.round(confidence * 100);
    elResultConf.textContent = `(${pct}%)`;
  } else {
    elResultConf.textContent = '';
  }
  updateEmoji(label);
}
function setEmoji(char) {
  const show = Boolean(char);
  elEmoji.textContent = char || '';
  elEmoji.classList.toggle('hidden', !show);
}

// --------- Theme toggle ---------
function getSavedTheme() {
  const t = localStorage.getItem('theme');
  return t === 'light' || t === 'dark' ? t : 'dark';
}
function applyTheme(theme) {
  document.body.setAttribute('data-theme', theme);
  if (elThemeToggle) {
    elThemeToggle.textContent = theme === 'light' ? '☀️ Chế độ sáng' : '🌙 Chế độ tối';
  }
  localStorage.setItem('theme', theme);
}
function toggleTheme() {
  const current = document.body.getAttribute('data-theme') || 'dark';
  applyTheme(current === 'dark' ? 'light' : 'dark');
}

// --------- Nút Tải mô hình ---------
async function onLoadModel() {
  showError('');
  const url = (elModelUrl.value || '').trim();
  if (!url) {
    showError('Vui lòng nhập URL mô hình Teachable Machine.');
    return;
  }
  try {
    elLoadBtn.disabled = true;
    setModelStatus('Đang tải mô hình...');
    showLoader(true);

    const modelJson = normalizeModelUrl(url);
    // ml5.imageClassifier hỗ trợ Promise, dùng await cho mã sạch
    classifier = await ml5.imageClassifier(modelJson);

    setModelStatus('Mô hình đã sẵn sàng ✔');
    elStartBtn.disabled = false; // Cho phép bắt đầu sau khi tải mô hình thành công
  } catch (err) {
    console.error(err);
    showError('Không thể tải mô hình. Vui lòng kiểm tra URL và thử lại.');
    setModelStatus('Lỗi khi tải mô hình');
  } finally {
    showLoader(false);
    elLoadBtn.disabled = false;
  }
}

function normalizeModelUrl(url) {
  // Teachable Machine thường có dạng .../models/XXXXXX/
  // Cần nối thêm 'model.json' ở cuối.
  const withSlash = url.endsWith('/') ? url : url + '/';
  return withSlash + 'model.json';
}

// --------- Nút Bắt đầu ---------
async function onStart() {
  showError('');
  if (!classifier) {
    showError('Bạn cần tải mô hình trước khi bắt đầu.');
    return;
  }
  try {
    elStartBtn.disabled = true;
    elStopBtn.disabled = false;

    // Kiểm tra quyền truy cập webcam trước để xử lý lỗi thân thiện
    try {
      await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' } });
    } catch (camErr) {
      showError('Không thể truy cập webcam. Hãy kiểm tra quyền truy cập camera trong trình duyệt.');
      elStartBtn.disabled = false;
      elStopBtn.disabled = true;
      return;
    }

    // Tạo video với p5
    video = createCapture({ video: { facingMode: 'user' } });
    video.size(640, 480); // Tăng kích thước video để khớp với canvas
    video.hide(); // Chỉ dùng canvas để hiển thị

    isRunning = true;
    // Vòng lặp phân loại async/await
    runClassificationLoop();
  } catch (err) {
    console.error(err);
    showError('Đã xảy ra lỗi khi khởi động nhận diện.');
    elStartBtn.disabled = false;
    elStopBtn.disabled = true;
  }
}

// --------- Nút Dừng ---------
function onStop() {
  isRunning = false;
  elStartBtn.disabled = false;
  elStopBtn.disabled = true;

  // Dừng webcam nếu đang hoạt động
  if (video && video.elt && video.elt.srcObject) {
    try {
      const tracks = video.elt.srcObject.getTracks();
      tracks.forEach(t => t.stop());
    } catch (e) { /* bỏ qua */ }
  }
  if (video) {
    try { video.remove(); } catch (e) { /* bỏ qua */ }
    video = null;
  }
  flippedFrame = null;
  updateResults('Đã dừng', null);
}

// --------- Vòng lặp phân loại ---------
async function runClassificationLoop() {
  // Lặp cho đến khi isRunning = false
  while (isRunning) {
    try {
      // Lật khung hình để giống gương soi
      flippedFrame = ml5.flipImage(video);
      // Phân loại với await để mã dễ đọc
      const results = await classifier.classify(flippedFrame);
      const top = results && results[0] ? results[0] : null;
      if (top) {
        updateResults(top.label, top.confidence);
      }
    } catch (err) {
      console.error('Lỗi phân loại:', err);
      showError('Lỗi khi phân loại hình ảnh.');
      // Nếu lỗi nhiều lần, có thể dừng vòng lặp để tránh treo
      // isRunning = false; (tuỳ yêu cầu)
    }
    // Nhường vòng lặp event để UI phản hồi tốt
    await sleep(0);
  }
}

// --------- Emoji theo nhãn ---------
function updateEmoji(label) {
  // Ánh xạ cứng cho các nhãn phổ biến. 
  // Để linh hoạt với mô hình khác, có thể:
  // - Đổi sang cấu hình JSON từ server; hoặc
  // - Duyệt toàn bộ labels của mô hình và gán emoji theo từ khoá.
  const m = {
    // Tiếng Việt
    'vui': '😃',
    'buồn': '😢',
    'ngạc nhiên': '😮',
    'bình thường': '😐',
    'tức giận': '😠',
    'sợ hãi': '😨',
    'ghê tởm': '🤢',
    // Tiếng Anh
    'happy': '😃',
    'sad': '😢',
    'surprised': '😮',
    'neutral': '😐',
    'angry': '😠',
    'fear': '😨',
    'disgust': '🤢'
  };
  const key = (label || '').toLowerCase();
  setEmoji(m[key] || '');
}

// --------- Utils ---------
function sleep(ms) { return new Promise(res => setTimeout(res, ms)); }