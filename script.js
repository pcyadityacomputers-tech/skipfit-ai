const camera = document.getElementById("camera");
const status = document.getElementById("status");

const startBtn = document.getElementById("startBtn");
const backCameraBtn = document.getElementById("backCameraBtn");
const stopBtn = document.getElementById("stopBtn");

let stream = null;
let detector = null;
let running = false;
let processing = false;


/* =========================
   LOAD MOVENET
========================= */

async function loadAI() {

  try {

    status.textContent =
      "Loading MoveNet AI...";

    await tf.ready();

    detector =
      await poseDetection.createDetector(
        poseDetection.SupportedModels.MoveNet,
        {
          modelType:
            poseDetection.movenet.modelType.SINGLEPOSE_LIGHTNING
        }
      );

    status.textContent =
      "✅ AI READY — START CAMERA";

  } catch (error) {

    console.error(error);

    status.textContent =
      "❌ AI ERROR: " + error.message;

  }

}


/* =========================
   STOP CAMERA
========================= */

function stopCamera() {

  running = false;
  processing = false;

  if (stream) {

    stream.getTracks().forEach(
      track => track.stop()
    );

    stream = null;

  }

  camera.srcObject = null;

  camera.style.display = "none";

  status.textContent =
    "Camera stopped";

}


/* =========================
   START NORMAL CAMERA
========================= */

async function startCamera() {

  try {

    stopCamera();

    status.textContent =
      "Opening camera...";

    stream =
      await navigator.mediaDevices.getUserMedia({

        video: {
          width: { ideal: 640 },
          height: { ideal: 480 }
        },

        audio: false

      });

    camera.srcObject =
      stream;

    camera.style.display =
      "block";

    await camera.play();

    running = true;

    processing = false;

    status.textContent =
      "📷 CAMERA + AI WORKING";

    processFrame();

  } catch (error) {

    console.error(error);

    status.textContent =
      "❌ CAMERA ERROR: " +
      error.name;

  }

}


/* =========================
   START BACK CAMERA
========================= */

async function startBackCamera() {

  try {

    stopCamera();

    status.textContent =
      "Opening back camera...";

    stream =
      await navigator.mediaDevices.getUserMedia({

        video: {

          facingMode: {
            ideal: "environment"
          },

          width: {
            ideal: 640
          },

          height: {
            ideal: 480
          }

        },

        audio: false

      });

    camera.srcObject =
      stream;

    camera.style.display =
      "block";

    await camera.play();

    running = true;

    processing = false;

    status.textContent =
      "📷 BACK CAMERA + AI WORKING";

    processFrame();

  } catch (error) {

    console.error(error);

    status.textContent =
      "❌ BACK CAMERA ERROR: " +
      error.name;

  }

}


/* =========================
   AI FRAME PROCESSING
========================= */

async function processFrame() {

  if (!running) {
    return;
  }

  if (processing) {

    requestAnimationFrame(
      processFrame
    );

    return;

  }

  if (!detector) {

    requestAnimationFrame(
      processFrame
    );

    return;

  }

  processing = true;

  try {

    const poses =
      await detector.estimatePoses(
        camera
      );

    if (poses.length > 0) {

      const keypoints =
        poses[0].keypoints;

      console.log(
        "BODY DETECTED:",
        keypoints.length,
        "keypoints"
      );

      status.textContent =
        "🟢 AI BODY DETECTED";

    } else {

      status.textContent =
        "🟡 AI: NO BODY";

    }

  } catch (error) {

    console.error(
      "AI FRAME ERROR:",
      error
    );

  }

  processing = false;

  if (running) {

    requestAnimationFrame(
      processFrame
    );

  }

}


/* =========================
   BUTTONS
========================= */

startBtn.onclick =
  startCamera;

backCameraBtn.onclick =
  startBackCamera;

stopBtn.onclick =
  stopCamera;


/* =========================
   LOAD AI
========================= */

loadAI();