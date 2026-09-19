const status = document.getElementById("status");

const startBtn = document.getElementById("startBtn");
const backCameraBtn = document.getElementById("backCameraBtn");
const stopBtn = document.getElementById("stopBtn");
const resetBtn = document.getElementById("resetBtn");

const camera = document.getElementById("camera");

let stream = null;


/* =========================
   CHECK LIBRARIES
========================= */

async function checkAI() {

  status.textContent = "Checking AI...";

  try {

    if (typeof tf === "undefined") {

      throw new Error(
        "TensorFlow.js did not load"
      );

    }

    status.textContent =
      "TensorFlow loaded ✓";

    await tf.ready();


    if (
      typeof poseDetection ===
      "undefined"
    ) {

      throw new Error(
        "MoveNet library did not load"
      );

    }

    status.textContent =
      "MoveNet library loaded ✓";


    status.textContent =
      "Loading MoveNet model...";


    const detector =
      await poseDetection.createDetector(

        poseDetection.SupportedModels.MoveNet,

        {
          modelType:
            poseDetection.movenet.modelType.SINGLEPOSE_LIGHTNING
        }

      );


    window.skipDetector =
      detector;


    status.textContent =
      "✅ AI READY — START CAMERA";


  } catch (error) {

    console.error(
      "AI START ERROR:",
      error
    );

    status.textContent =
      "❌ " + error.message;

  }

}


/* =========================
   CAMERA
========================= */

async function startCamera(
  back = false
) {

  try {

    if (stream) {

      stream.getTracks().forEach(
        track => track.stop()
      );

    }


    status.textContent =
      back
        ? "Opening back camera..."
        : "Opening camera...";


    const constraints = {

      video: back
        ? {
            facingMode: {
              ideal: "environment"
            }
          }
        : true,

      audio: false

    };


    stream =
      await navigator.mediaDevices
        .getUserMedia(
          constraints
        );


    camera.srcObject =
      stream;

    camera.style.display =
      "block";


    await camera.play();


    status.textContent =
      back
        ? "📷 BACK CAMERA WORKING"
        : "📷 CAMERA WORKING";

  } catch (error) {

    console.error(error);

    status.textContent =
      "❌ CAMERA ERROR: " +
      error.name;

  }

}


/* =========================
   STOP
========================= */

function stopCamera() {

  if (stream) {

    stream.getTracks().forEach(
      track => track.stop()
    );

    stream = null;

  }

  camera.srcObject = null;

  camera.style.display =
    "none";

  status.textContent =
    "Camera stopped";

}


/* =========================
   RESET
========================= */

function resetCounter() {

  const count =
    document.getElementById("count");

  if (count) {

    count.textContent = "0";

  }

  status.textContent =
    "Counter reset";

}


/* =========================
   BUTTONS
========================= */

startBtn.onclick = () => {

  startCamera(false);

};


backCameraBtn.onclick = () => {

  startCamera(true);

};


stopBtn.onclick = () => {

  stopCamera();

};


resetBtn.onclick = () => {

  resetCounter();

};


/* =========================
   START
========================= */

checkAI();