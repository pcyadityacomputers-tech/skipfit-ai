import {
  FilesetResolver,
  PoseLandmarker
} from "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.22/+esm";

const MODEL =
  "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task";

const WASM =
  "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.22/wasm";

const statusEl =
  document.getElementById("status");

const camera =
  document.getElementById("camera");

const canvas =
  document.getElementById("overlay");

const ctx =
  canvas.getContext("2d");

const startBtn =
  document.getElementById("startBtn");

const calibrateBtn =
  document.getElementById("calibrateBtn");

const stopBtn =
  document.getElementById("stopBtn");

const stageEl =
  document.getElementById("stage");

const calibrationEl =
  document.getElementById("calibrationCount");

const barFill =
  document.getElementById("barFill");

const skipEl =
  document.getElementById("skipCount");

const headEl =
  document.getElementById("head");

const handsEl =
  document.getElementById("hands");

const legsEl =
  document.getElementById("legs");


/* =========================
   AI + APP STATE
========================= */

let landmarker = null;
let stream = null;

let running = false;
let calibrating = false;
let confirmed = false;

let animationId = null;

let calibrationJumps = 0;
let skips = 0;

let lastJumpTime = 0;

let previousSignal = null;
let previousVelocity = 0;

let jumpState = "GROUND";

let calibrationSamples = [];

let calibratedAmplitude = 0;
let calibratedPeriod = 0;

let signalHistory = [];
let handHistory = [];
let headHistory = [];
let legHistory = [];

let lastDetectionTime = 0;


/* =========================
   LOAD AI
========================= */

async function loadAI() {

  try {

    statusEl.textContent =
      "STEP 1/3: JavaScript loaded";

    stageEl.textContent =
      "LOADING";


    /* STEP 2
       Load MediaPipe WASM
    */

    statusEl.textContent =
      "STEP 2/3: Loading MediaPipe...";

    const vision =
      await FilesetResolver.forVisionTasks(WASM);


    /* STEP 3
       Load actual pose model
    */

    statusEl.textContent =
      "STEP 3/3: Loading AI model...";


    landmarker =
      await PoseLandmarker.createFromOptions(
        vision,
        {
          baseOptions: {

            modelAssetPath: MODEL,

            /* CPU used for reliable initialization */
            delegate: "CPU"
          },

          runningMode: "VIDEO",

          numPoses: 1,

          minPoseDetectionConfidence: 0.5,

          minPosePresenceConfidence: 0.5,

          minTrackingConfidence: 0.5
        }
      );


    /* AI SUCCESS */

    statusEl.textContent =
      "AI READY — Start camera";

    stageEl.textContent =
      "READY";


    startBtn.disabled = false;

    calibrateBtn.disabled = true;

    stopBtn.disabled = true;


    console.log(
      "SkipFit AI initialized successfully."
    );


  } catch (error) {

    console.error(
      "SKIPFIT AI ERROR:",
      error
    );


    landmarker = null;


    statusEl.textContent =
      "AI ERROR: " +
      (error.message || "Unknown error");


    stageEl.textContent =
      "AI FAILED";


    startBtn.disabled = true;

    calibrateBtn.disabled = true;

  }
}


/* Start AI immediately */

loadAI();


/* =========================
   START CAMERA
========================= */

async function startCamera() {

  if (!landmarker) {

    statusEl.textContent =
      "AI is not ready yet.";

    return;
  }


  if (
    !navigator.mediaDevices ||
    !navigator.mediaDevices.getUserMedia
  ) {

    statusEl.textContent =
      "Camera is not supported by this browser.";

    return;
  }


  try {

    statusEl.textContent =
      "Opening camera...";


    stream =
      await navigator.mediaDevices.getUserMedia({

        video: {

          facingMode: "user",

          width: {
            ideal: 720
          },

          height: {
            ideal: 960
          }
        },

        audio