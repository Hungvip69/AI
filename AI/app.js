const MODEL_BASE_PATH = "./assets/model/";
const LOW_CONFIDENCE_THRESHOLD = 0.6;
const TOP_K = 3;
const THEME_STORAGE_KEY = "leader-portrait-theme";

const ACCEPTED_MIME_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const ACCEPTED_EXTENSIONS = [".jpg", ".jpeg", ".png", ".webp"];

const PERIOD_CATEGORIES = {
  CAN_VUONG_YEN_THE: "Phong trào Cần Vương & Khởi nghĩa Yên Thế (Cuối thế kỉ XIX)",
  YEU_NUOC_DAU_THE_KY_XX: "Phong trào Yêu nước đầu thế kỉ XX",
};

const LABEL_PROFILES = {
  "Nguyễn Tất Thành": {
    leadershipStyle:
      "Phong cách thiên về tầm nhìn dài hạn, kiên định mục tiêu độc lập dân tộc và chú trọng tổ chức lực lượng quần chúng.",
    movementRole:
      "Người thanh niên yêu nước tiêu biểu, ra đi tìm đường cứu nước tại bến cảng Nhà Rồng năm 1911.",
    birthYear: "1890",
    deathYear: "1969",
    period: PERIOD_CATEGORIES.YEU_NUOC_DAU_THE_KY_XX,
  },
  "Phan Châu Trinh": {
    leadershipStyle:
      "Phong cách nhấn mạnh cải cách xã hội, nâng cao dân trí, đề cao con đường canh tân để đổi mới đất nước.",
    movementRole: "Lãnh đạo cuộc vận động Duy Tân ở Trung Kì.",
    birthYear: "1872",
    deathYear: "1926",
    period: PERIOD_CATEGORIES.YEU_NUOC_DAU_THE_KY_XX,
  },
  "Phan Bội Châu": {
    leadershipStyle:
      "Phong cách thiên về tinh thần hành động quyết liệt, truyền cảm hứng yêu nước và vận động lực lượng trong lẫn ngoài nước.",
    movementRole: "Lãnh đạo phong trào Đông Du (đưa thanh niên sang Nhật học tập).",
    birthYear: "1867",
    deathYear: "1940",
    period: PERIOD_CATEGORIES.YEU_NUOC_DAU_THE_KY_XX,
  },
  "Hoàng Hoa Thám": {
    leadershipStyle:
      "Phong cách gắn với kháng chiến bền bỉ, linh hoạt chiến thuật và duy trì tinh thần tự chủ trong đấu tranh lâu dài.",
    movementRole: "Thủ lĩnh kiệt xuất của phong trào nông dân Yên Thế.",
    birthYear: "1858",
    deathYear: "1913",
    period: PERIOD_CATEGORIES.CAN_VUONG_YEN_THE,
  },
  "Vua Hàm Nghi": {
    leadershipStyle:
      "Phong cách thể hiện biểu tượng chính danh và tinh thần hiệu triệu, khơi dậy ý chí kháng chiến qua vai trò quy tụ lực lượng.",
    movementRole: "Người hạ chiếu Cần Vương, lãnh đạo cao trào Cần Vương trên toàn quốc.",
    birthYear: "1871",
    deathYear: "1944",
    period: PERIOD_CATEGORIES.CAN_VUONG_YEN_THE,
  },
  "Phan Đình Phùng": {
    leadershipStyle:
      "Phong cách nổi bật ở ý chí kiên cường, giữ vững chính nghĩa và tổ chức kháng chiến bền bỉ trước sức ép kéo dài.",
    movementRole:
      "Lãnh đạo khởi nghĩa Hương Khê, cuộc khởi nghĩa tiêu biểu nhất của phong trào Cần Vương.",
    birthYear: "1847",
    deathYear: "1895",
    period: PERIOD_CATEGORIES.CAN_VUONG_YEN_THE,
  },
};

const state = {
  model: null,
  labels: [],
  currentObjectUrl: null,
  activeRequestId: 0,
};

const elements = {
  fileInput: document.getElementById("fileInput"),
  themeToggle: document.getElementById("themeToggle"),
  themeToggleIcon: document.getElementById("themeToggleIcon"),
  themeToggleLabel: document.getElementById("themeToggleLabel"),
  fileHint: document.getElementById("fileHint"),
  modelState: document.getElementById("modelState"),
  previewImage: document.getElementById("previewImage"),
  previewPlaceholder: document.getElementById("previewPlaceholder"),
  confidenceBadge: document.getElementById("confidenceBadge"),
  predictionList: document.getElementById("predictionList"),
  insightTitle: document.getElementById("insightTitle"),
  insightText: document.getElementById("insightText"),
};

window.addEventListener("DOMContentLoaded", () => {
  initTheme();
  elements.themeToggle?.addEventListener("click", onThemeToggleClick);
  elements.fileInput.addEventListener("change", onFileInputChange);
  void initModel();
});

function initTheme() {
  let savedTheme = null;
  try {
    savedTheme = localStorage.getItem(THEME_STORAGE_KEY);
  } catch (error) {
    console.warn("Cannot read theme from localStorage", error);
  }

  const prefersDark =
    window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches;
  const theme =
    savedTheme === "dark" || savedTheme === "light"
      ? savedTheme
      : prefersDark
      ? "dark"
      : "light";
  applyTheme(theme);
}

function onThemeToggleClick() {
  const currentTheme = document.documentElement.dataset.theme === "dark" ? "dark" : "light";
  const nextTheme = currentTheme === "dark" ? "light" : "dark";
  applyTheme(nextTheme);
  try {
    localStorage.setItem(THEME_STORAGE_KEY, nextTheme);
  } catch (error) {
    console.warn("Cannot save theme to localStorage", error);
  }
}

function applyTheme(theme) {
  document.documentElement.dataset.theme = theme;
  updateThemeToggle(theme);
}

function updateThemeToggle(theme) {
  if (!elements.themeToggle) {
    return;
  }
  const isDark = theme === "dark";
  const icon = isDark ? "☀" : "☾";
  const label = isDark ? "Chế độ sáng" : "Chế độ tối";
  if (elements.themeToggleIcon) {
    elements.themeToggleIcon.textContent = icon;
  }
  if (elements.themeToggleLabel) {
    elements.themeToggleLabel.textContent = label;
  }
  elements.themeToggle.setAttribute("aria-pressed", String(isDark));
  elements.themeToggle.setAttribute(
    "aria-label",
    isDark ? "Bật chế độ sáng" : "Bật chế độ tối"
  );
}

async function initModel() {
  if (!window.tmImage) {
    setModelState("Thiếu thư viện Teachable Machine. Vui lòng tải lại trang.", "error");
    setBadge("Lỗi khởi tạo", "error");
    return;
  }

  setModelState("Đang tải model...", "loading");

  try {
    const modelURL = `${MODEL_BASE_PATH}model.json`;
    const metadataURL = `${MODEL_BASE_PATH}metadata.json`;
    state.model = await window.tmImage.load(modelURL, metadataURL);
    state.labels = state.model.getClassLabels();

    setModelState(`Model sẵn sàng (${state.labels.length} lớp).`, "ready");
    setBadge("Sẵn sàng nhận diện", "idle");

    const labelsText = state.labels.length > 0 ? `Lớp hiện có: ${state.labels.join(", ")}.` : "";
    elements.fileHint.textContent = `Hỗ trợ định dạng JPG, PNG, WEBP. ${labelsText}`.trim();
  } catch (error) {
    const localServerHint =
      window.location.protocol === "file:"
        ? " Hãy mở bằng local server (ví dụ: python -m http.server)."
        : "";
    setModelState(`Không tải được model.${localServerHint}`, "error");
    setBadge("Model lỗi", "error");
    setPredictionPlaceholder("Không thể khởi tạo model. Kiểm tra lại đường dẫn model và kết nối mạng.");
    setInsight(
      "Model chưa sẵn sàng",
      "Kiểm tra thư mục assets/model có đủ model.json, weights.bin, metadata.json."
    );
    console.error(error);
  }
}

function onFileInputChange(event) {
  const file = event.target.files?.[0];
  if (!file) {
    return;
  }
  void handleImageFile(file);
}

async function handleImageFile(file) {
  if (!isValidImageFile(file)) {
    showError("File không hợp lệ. Chỉ chấp nhận JPG, PNG hoặc WEBP.");
    return;
  }

  if (!state.model) {
    showError("Model chưa tải xong. Vui lòng đợi thêm vài giây.");
    return;
  }

  const requestId = ++state.activeRequestId;

  setBadge("Đang phân tích ảnh...", "idle");
  setPredictionPlaceholder("Đang dự đoán kết quả...");
  setInsight("Đang xử lý", "Mô hình đang phân tích ảnh bạn vừa tải lên.");

  try {
    const imageEl = await loadPreviewImage(file);
    if (requestId !== state.activeRequestId) {
      return;
    }

    const predictions = await state.model.predict(imageEl, false);
    if (requestId !== state.activeRequestId) {
      return;
    }

    renderPredictions(predictions);
  } catch (error) {
    showError("Không thể phân tích ảnh này. Hãy thử ảnh khác rõ mặt hơn.");
    console.error(error);
  }
}

function loadPreviewImage(file) {
  return new Promise((resolve, reject) => {
    if (state.currentObjectUrl) {
      URL.revokeObjectURL(state.currentObjectUrl);
      state.currentObjectUrl = null;
    }

    const objectUrl = URL.createObjectURL(file);
    state.currentObjectUrl = objectUrl;

    const img = elements.previewImage;
    img.onload = () => {
      img.onload = null;
      img.onerror = null;
      elements.previewPlaceholder.classList.add("is-hidden");
      img.classList.add("is-visible");
      resolve(img);
    };
    img.onerror = () => {
      img.onload = null;
      img.onerror = null;
      reject(new Error("Cannot load uploaded image"));
    };
    img.src = objectUrl;
  });
}

function renderPredictions(predictions) {
  if (!Array.isArray(predictions) || predictions.length === 0) {
    showError("Model không trả về kết quả dự đoán.");
    return;
  }

  const sorted = [...predictions].sort((a, b) => b.probability - a.probability);
  const topPredictions = sorted.slice(0, Math.min(TOP_K, sorted.length));

  elements.predictionList.innerHTML = "";

  topPredictions.forEach((prediction, index) => {
    const item = document.createElement("li");
    item.className = "prediction-item";
    item.style.animationDelay = `${index * 0.07}s`;

    const row = document.createElement("div");
    row.className = "prediction-row";

    const name = document.createElement("span");
    name.textContent = prediction.className;

    const value = document.createElement("span");
    value.className = "prediction-value";
    value.textContent = formatPercent(prediction.probability);

    row.appendChild(name);
    row.appendChild(value);

    const track = document.createElement("div");
    track.className = "bar-track";
    const fill = document.createElement("div");
    fill.className = "bar-fill";
    track.appendChild(fill);

    item.appendChild(row);
    item.appendChild(track);
    elements.predictionList.appendChild(item);

    requestAnimationFrame(() => {
      fill.style.width = `${Math.max(0, Math.min(100, prediction.probability * 100)).toFixed(2)}%`;
    });
  });

  const best = topPredictions[0];

  if (best.probability < LOW_CONFIDENCE_THRESHOLD) {
    setBadge(`Không chắc chắn (${formatPercent(best.probability)})`, "warn");
    setInsight(
      "Kết quả chưa đủ tin cậy",
      "Ảnh đầu vào có thể chưa rõ hoặc chưa đúng phạm vi dữ liệu huấn luyện. Hãy thử ảnh chân dung rõ nét hơn."
    );
    return;
  }

  setBadge(`Khả năng cao: ${best.className} (${formatPercent(best.probability)})`, "success");
  setInsight(best.className, getLabelInsight(best.className));
}

function getLabelInsight(label) {
  const profile = LABEL_PROFILES[label];
  if (!profile) {
    return [
      `Mô hình đang nhận diện vào nhãn "${label}".`,
      "Bạn có thể bổ sung hồ sơ nhân vật riêng trong LABEL_PROFILES.",
    ].join("\n");
  }

  return [
    profile.leadershipStyle,
    `Vai trò phong trào: ${profile.movementRole}`,
    `Năm sinh: ${profile.birthYear}`,
    `Năm mất: ${profile.deathYear}`,
    `Thời kỳ: ${profile.period}`,
  ].join("\n");
}

function setPredictionPlaceholder(message) {
  elements.predictionList.innerHTML = "";
  const item = document.createElement("li");
  item.className = "prediction-empty";
  item.textContent = message;
  elements.predictionList.appendChild(item);
}

function setModelState(message, status) {
  elements.modelState.textContent = message;
  elements.modelState.className = `model-state model-state--${status}`;
}

function setBadge(message, type) {
  elements.confidenceBadge.textContent = message;
  elements.confidenceBadge.className = `badge badge--${type}`;
}

function setInsight(title, text) {
  elements.insightTitle.textContent = title;
  elements.insightText.textContent = text;
}

function showError(message) {
  setBadge("Không thể nhận diện", "error");
  setInsight("Đã xảy ra lỗi", message);
  setPredictionPlaceholder(message);
}

function isValidImageFile(file) {
  const mimeType = (file.type || "").toLowerCase();
  const fileName = (file.name || "").toLowerCase();
  const validMime = ACCEPTED_MIME_TYPES.has(mimeType);
  const validExt = ACCEPTED_EXTENSIONS.some((ext) => fileName.endsWith(ext));
  return validMime || validExt;
}

function formatPercent(value) {
  return `${(value * 100).toFixed(2)}%`;
}
