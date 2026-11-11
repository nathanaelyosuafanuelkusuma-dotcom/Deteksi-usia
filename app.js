const MODEL_URL = "https://cdn.jsdelivr.net/npm/@vladmandic/face-api/model/";

const video = document.getElementById("video");
const canvas = document.getElementById("overlay");
const statusEl = document.getElementById("status");
const countEl = document.getElementById("count");
const startBtn = document.getElementById("startBtn");
const flipBtn = document.getElementById("flipBtn");

let facing = "user";
let stream = null;
let running = false;
const ageHistory = []; // untuk menghaluskan estimasi usia

async function loadModels() {
  await Promise.all([
    faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
    faceapi.nets.ageGenderNet.loadFromUri(MODEL_URL),
  ]);
  statusEl.textContent = "Model siap. Tekan “Mulai Kamera”.";
  startBtn.disabled = false;
}

async function startCamera() {
  if (stream) stream.getTracks().forEach(t => t.stop());
  try {
    stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: facing, width: { ideal: 640 }, height: { ideal: 480 } },
      audio: false,
    });
  } catch (err) {
    statusEl.textContent = "Kamera tidak bisa diakses: " + err.message;
    return;
  }
  video.srcObject = stream;
  video.style.transform = facing === "user" ? "scaleX(-1)" : "none";
  canvas.style.transform = video.style.transform;
  await video.play();
  flipBtn.disabled = false;
  statusEl.textContent = "Mendeteksi…";
  if (!running) { running = true; detectLoop(); }
}

function smoothAge(age) {
  ageHistory.push(age);
  if (ageHistory.length > 10) ageHistory.shift();
  return ageHistory.reduce((a, b) => a + b, 0) / ageHistory.length;
}

async function detectLoop() {
  if (!running) return;
  if (video.readyState >= 2 && video.videoWidth) {
    const opts = new faceapi.TinyFaceDetectorOptions({ inputSize: 320, scoreThreshold: 0.5 });
    const results = await faceapi.detectAllFaces(video, opts).withAgeAndGender();

    const dims = { width: video.videoWidth, height: video.videoHeight };
    canvas.width = dims.width;
    canvas.height = dims.height;
    const ctx = canvas.getContext("2d");
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const resized = faceapi.resizeResults(results, dims);
    resized.forEach(r => {
      const { x, y, width, height } = r.detection.box;
      const age = results.length === 1 ? smoothAge(r.age) : r.age;
      const gender = r.gender === "male" ? "Pria" : "Wanita";
      const label = `${gender}, ~${Math.round(age)} thn`;

      ctx.lineWidth = 3;
      ctx.strokeStyle = "#4f8cff";
      ctx.strokeRect(x, y, width, height);

      ctx.font = "bold 20px system-ui, sans-serif";
      const tw = ctx.measureText(label).width + 14;
      const ly = y > 30 ? y - 30 : y + height;
      ctx.fillStyle = "#4f8cff";
      ctx.fillRect(x, ly, tw, 28);
      ctx.fillStyle = "#fff";
      // Teks dibalik agar tetap terbaca saat kamera depan (mirror)
      if (facing === "user") {
        ctx.save();
        ctx.translate(x + tw, ly);
        ctx.scale(-1, 1);
        ctx.fillText(label, 7, 21);
        ctx.restore();
      } else {
        ctx.fillText(label, x + 7, ly + 21);
      }
    });

    if (results.length !== 1) ageHistory.length = 0;
    countEl.textContent = results.length;
    statusEl.textContent = results.length ? "Wajah terdeteksi" : "Arahkan kamera ke wajah";
  }
  requestAnimationFrame(detectLoop);
}

startBtn.addEventListener("click", startCamera);
flipBtn.addEventListener("click", () => {
  facing = facing === "user" ? "environment" : "user";
  ageHistory.length = 0;
  startCamera();
});

loadModels().catch(e => {
  statusEl.textContent = "Gagal memuat model: " + e.message;
});
