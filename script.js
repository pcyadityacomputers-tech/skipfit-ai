const camera =
  document.getElementById("camera");

const status =
  document.getElementById("status");

const startBtn =
  document.getElementById("startBtn");

const backCameraBtn =
  document.getElementById("backCameraBtn");

const stopBtn =
  document.getElementById("stopBtn");


let stream = null;


/* =========================
   STOP CAMERA
========================= */

function stopCamera() {

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


    status.textContent =
      "✅ CAMERA WORKING";


  } catch (error) {

    console.error(error);

    status.textContent =
      "❌ CAMERA ERROR: " +
      error.name;

  }

}


/* =========================
   BACK CAMERA
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


    status.textContent =
      "✅ BACK CAMERA WORKING";


  } catch (error) {

    console.error(error);

    status.textContent =
      "❌ BACK CAMERA ERROR: " +
      error.name;

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