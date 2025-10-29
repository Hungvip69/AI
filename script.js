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
let elStartBtn, elStopBtn, elThemeToggle;
let elModelStatus;
let elResultLabel, elResultConf;
let elConfBarFill;

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
  elStartBtn = document.getElementById('start-btn');
  elStopBtn = document.getElementById('stop-btn');
  elModelStatus = document.getElementById('model-status');
  elResultLabel = document.getElementById('result-label');
  elResultConf = document.getElementById('result-confidence');
  elThemeToggle = document.getElementById('theme-toggle');
  elConfBarFill = document.getElementById('confidence-bar-fill');

  // Sự kiện
  elStartBtn.addEventListener('click', onStart);
  elStopBtn.addEventListener('click', onStop);
  if (elThemeToggle) elThemeToggle.addEventListener('click', toggleTheme);

  // Trạng thái ban đầu
  setModelStatus('Chưa tải mô hình');
  updateResults('Chưa có dữ liệu', null);

  // Áp dụng theme đã lưu
  applyTheme(getSavedTheme());

  // Tự động tải mô hình cục bộ
  onLoadModel();

  // Năm bản quyền động
  const elYear = document.getElementById('year');
  if (elYear) elYear.textContent = new Date().getFullYear();
});

// --------- UI helpers ---------
function setModelStatus(text) {
  elModelStatus.textContent = text || '';
}
// Bỏ loader và hiển thị lỗi phức tạp
function updateResults(label, confidence) {
  currentLabel = label;
  currentConfidence = confidence;
  elResultLabel.textContent = label;
  if (typeof confidence === 'number') {
    const pct = Math.round(confidence * 100);
    elResultConf.textContent = `(${pct}%)`;
    if (elConfBarFill) {
      elConfBarFill.style.width = `${pct}%`;
    }
  } else {
    elResultConf.textContent = '';
    if (elConfBarFill) {
      elConfBarFill.style.width = '0%';
    }
  }
}
// Bỏ emoji

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
  setModelStatus('Đang tải mô hình...');
  try {
    classifier = await ml5.imageClassifier('./model/model.json');
    setModelStatus('Mô hình đã sẵn sàng ✔');
    elStartBtn.disabled = false;
  } catch (err) {
    console.error(err);
    setModelStatus('Không thể tải mô hình cục bộ');
  }
}



// --------- Nút Bắt đầu ---------
async function onStart() {
  if (!classifier) {
    setModelStatus('Bạn cần tải mô hình trước khi bắt đầu.');
    return;
  }
  try {
    elStartBtn.disabled = true;
    elStopBtn.disabled = false;

    // Kiểm tra quyền truy cập webcam trước để xử lý lỗi thân thiện
    try {
      await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' } });
    } catch (camErr) {
      setModelStatus('Không thể truy cập webcam. Hãy kiểm tra quyền truy cập camera trong trình duyệt.');
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
    setModelStatus('Đã xảy ra lỗi khi khởi động nhận diện.');
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
      setModelStatus('Lỗi khi phân loại hình ảnh.');
      // Nếu lỗi nhiều lần, có thể dừng vòng lặp để tránh treo
      // isRunning = false; (tuỳ yêu cầu)
    }
    // Nhường vòng lặp event để UI phản hồi tốt
    await sleep(0);
  }
}

// --------- Emoji theo nhãn ---------
// Bỏ ánh xạ emoji

// --------- Utils ---------
function sleep(ms) { return new Promise(res => setTimeout(res, ms)); }