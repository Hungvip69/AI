let classifier = null;
let video = null;
let flippedFrame = null;
let isRunning = false;
let currentLabel = 'Chưa có dữ liệu';
let currentConfidence = null;
let elStartBtn, elStopBtn, elThemeToggle;
let elModelStatus;
let elResultLabel, elResultConf;
let elConfBarFill;
function setup() {
  const canvas = createCanvas(640, 480);
  canvas.parent('video-container');
  video = createCapture(VIDEO);
  video.size(640, 480);
  video.hide();
  canvas.elt.id = 'video-canvas';
  background(14);
}

function draw() {
  background(14);
  if (isRunning && flippedFrame) {
    image(flippedFrame, 0, 0);
  } else {
    noStroke();
    fill(30);
    rect(0, 0, width, height, 12);
  }
}
document.addEventListener('DOMContentLoaded', () => {
  elStartBtn = document.getElementById('start-btn');
  elStopBtn = document.getElementById('stop-btn');
  elModelStatus = document.getElementById('model-status');
  elResultLabel = document.getElementById('result-label');
  elResultConf = document.getElementById('result-confidence');
  elThemeToggle = document.getElementById('theme-toggle');
  elConfBarFill = document.getElementById('confidence-bar-fill');
  elStartBtn.addEventListener('click', onStart);
  elStopBtn.addEventListener('click', onStop);
  if (elThemeToggle) elThemeToggle.addEventListener('click', toggleTheme);
  setModelStatus('Chưa tải mô hình');
  updateResults('Chưa có dữ liệu', null);
  applyTheme(getSavedTheme());
  onLoadModel();
  const elYear = document.getElementById('year');
  if (elYear) elYear.textContent = new Date().getFullYear();
});
function setModelStatus(text) {
  elModelStatus.textContent = text || '';
}
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
async function onStart() {
  if (!classifier) {
    setModelStatus('Bạn cần tải mô hình trước khi bắt đầu.');
    return;
  }
  try {
    elStartBtn.disabled = true;
    elStopBtn.disabled = false;
    try {
      await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' } });
    } catch (camErr) {
      setModelStatus('Không thể truy cập webcam. Hãy kiểm tra quyền truy cập camera trong trình duyệt.');
      elStartBtn.disabled = false;
      elStopBtn.disabled = true;
      return;
    }
    video = createCapture({ video: { facingMode: 'user' } });
    video.size(640, 480);
    video.hide();

    isRunning = true;
    runClassificationLoop();
  } catch (err) {
    console.error(err);
    setModelStatus('Đã xảy ra lỗi khi khởi động nhận diện.');
    elStartBtn.disabled = false;
    elStopBtn.disabled = true;
  }
}
function onStop() {
  isRunning = false;
  elStartBtn.disabled = false;
  elStopBtn.disabled = true;
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
async function runClassificationLoop() {
  while (isRunning) {
    try {
      flippedFrame = ml5.flipImage(video);
      const results = await classifier.classify(flippedFrame);
      const top = results && results[0] ? results[0] : null;
      if (top) {
        updateResults(top.label, top.confidence);
      }
    } catch (err) {
      console.error('Lỗi phân loại:', err);
      setModelStatus('Lỗi khi phân loại hình ảnh.');
    }
    await sleep(0);
  }
}
function sleep(ms) { return new Promise(res => setTimeout(res, ms)); }
