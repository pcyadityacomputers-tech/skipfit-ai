import {
  FilesetResolver,
  PoseLandmarker
} from "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.22/+esm";


/* =========================
   ELEMENTS
========================= */

const camera = document.getElementById("camera");
const videoPlayer = document.getElementById("videoFilePlayer");
const videoInput = document.getElementById("videoInput");
const canvas = document.getElementById("canvas");
const ctx = canvas.getContext("2d");

const status = document.getElementById("status");
const stage = document.getElementById("stage");
const count = document.getElementById("count");
const progress = document.getElementById("progress");

const startCamera = document.getElementById("startCamera");
const switchCamera = document.getElementById("switchCamera");
const stopCamera = document.getElementById("stopCamera");
const analyzeVideo = document.getElementById("analyzeVideo");

const cameraState = document.getElementById("cameraState");
const videoState = document.getElementById("videoState");
const aiState = document.getElementById("aiState");


/* =========================
   VARIABLES
========================= */

let stream = null;

let facing = "user";

let videoURL = null;

let landmarker = null;

let aiReady = false;

let cameraRunning = false;

let analysing = false;

let lastProcess = 0;

let videoTimestamp = 0;


/* =========================
   AI LOADING
========================= */

async function loadAI() {

  try {

    status.textContent = "Loading AI...";
    aiState.textContent = "AI ...";

    const vision =
      await FilesetResolver.forVisionTasks(
        "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.22/wasm"
      );

    landmarker =
      await PoseLandmarker.createFromOptions(
        vision,
        {
          baseOptions: {

            modelAssetPath:
              "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task",

            delegate: "CPU"
          },

          runningMode: "VIDEO",

          numPoses: 1,

          minPoseDetectionConfidence: 0.35,

          minPosePresenceConfidence: 0.35,

          minTrackingConfidence: 0.35
        }
      );

    aiReady = true;

    aiState.textContent = "AI ✓";

    status.textContent = "✅ AI READY";

    console.log("SkipFit AI ready");

  }

  catch (error) {

    console.error("AI ERROR:", error);

    aiReady = false;

    aiState.textContent = "AI ✕";

    status.textContent =
      "Camera/video ready — AI unavailable";
  }
}


/* =========================
   CAMERA
========================= */

startCamera.onclick =
  async function () {

    try {

      if (
        !navigator.mediaDevices ||
        !navigator.mediaDevices.getUserMedia
      ) {

        status.textContent =
          "Camera API unavailable";

        return;
      }


      /* Stop previous stream */

      if (stream) {

        stream.getTracks().forEach(
          track => track.stop()
        );

        stream = null;
      }


      status.textContent =
        "Requesting camera...";


      stream =
        await navigator.mediaDevices.getUserMedia({

          video: {

            facingMode: facing,

            width: {
              ideal: 640
            },

            height: {
              ideal: 480
            }
          },

          audio: false
        });


      camera.srcObject = stream;

      camera.style.display = "block";

      videoPlayer.style.display = "none";


      await camera.play();


      cameraRunning = true;


      cameraState.textContent =
        "CAMERA ✓";


      startCamera.disabled = true;

      switchCamera.disabled = false;

      stopCamera.disabled = false;


      stage.textContent =
        "CAMERA ACTIVE";


      status.textContent =
        "📷 CAMERA WORKING";


      resizeCanvas();

      cameraLoop();

    }

    catch (error) {

      console.error(
        "CAMERA ERROR:",
        error
      );

      status.textContent =
        "❌ CAMERA ERROR: " +
        error.name;

      stage.textContent =
        "CAMERA FAILED";
    }
  };


/* =========================
   SWITCH CAMERA
========================= */

switchCamera.onclick =
  async function () {

    facing =
      facing === "user"
        ? "environment"
        : "user";


    if (stream) {

      stream.getTracks().forEach(
        track => track.stop()
      );

      stream = null;
    }


    cameraRunning = false;

    startCamera.disabled = false;

    switchCamera.disabled = true;

    stopCamera.disabled = true;


    /* Start selected camera */

    startCamera.click();
  };


/* =========================
   STOP CAMERA
========================= */

stopCamera.onclick =
  function () {

    cameraRunning = false;


    if (stream) {

      stream.getTracks().forEach(
        track => track.stop()
      );

      stream = null;
    }


    camera.srcObject = null;

    camera.style.display = "none";


    ctx.clearRect(
      0,
      0,
      canvas.width,
      canvas.height
    );


    cameraState.textContent =
      "CAMERA ○";


    startCamera.disabled = false;

    switchCamera.disabled = true;

    stopCamera.disabled = true;


    stage.textContent =
      "STOPPED";


    status.textContent =
      "Camera stopped";
  };


/* =========================
   CANVAS SIZE
========================= */

function resizeCanvas() {

  if (camera.videoWidth) {

    canvas.width =
      camera.videoWidth;

    canvas.height =
      camera.videoHeight;

    return;
  }


  if (videoPlayer.videoWidth) {

    canvas.width =
      videoPlayer.videoWidth;

    canvas.height =
      videoPlayer.videoHeight;
  }
}


/* =========================
   CAMERA AI LOOP
========================= */

function cameraLoop() {

  if (!cameraRunning)
    return;


  requestAnimationFrame(
    cameraLoop
  );


  if (!aiReady)
    return;


  if (camera.readyState < 2)
    return;


  const now =
    performance.now();


  /* About 12.5 AI frames/second */

  if (
    now - lastProcess < 80
  )
    return;


  lastProcess = now;


  try {

    resizeCanvas();


    const result =
      landmarker.detectForVideo(
        camera,
        now
      );


    drawPose(result);

  }

  catch (error) {

    console.error(
      "Camera AI:",
      error
    );
  }
}


/* =========================
   DRAW BODY
========================= */

function drawPose(result) {

  ctx.clearRect(
    0,
    0,
    canvas.width,
    canvas.height
  );


  if (
    !result ||
    !result.landmarks ||
    !result.landmarks.length
  ) {

    stage.textContent =
      aiReady
        ? "BODY NOT FOUND"
        : "CAMERA ACTIVE";

    return;
  }


  const points =
    result.landmarks[0];


  stage.textContent =
    "BODY DETECTED";


  ctx.fillStyle =
    "#00ff88";


  for (const p of points) {

    if (
      p.visibility !== undefined &&
      p.visibility < 0.25
    ) {

      continue;
    }


    ctx.beginPath();


    ctx.arc(
      p.x * canvas.width,
      p.y * canvas.height,
      4,
      0,
      Math.PI * 2
    );


    ctx.fill();
  }
}


/* =========================
   VIDEO FILE SELECT
========================= */

videoInput.onchange =
  function () {

    const file =
      videoInput.files[0];


    if (!file)
      return;


    /* Remove previous object URL */

    if (videoURL) {

      URL.revokeObjectURL(
        videoURL
      );
    }


    videoURL =
      URL.createObjectURL(file);


    videoPlayer.src =
      videoURL;


    videoPlayer.load();


    videoPlayer.style.display =
      "block";


    camera.style.display =
      "none";


    /* Stop camera */

    cameraRunning = false;


    if (stream) {

      stream.getTracks().forEach(
        track => track.stop()
      );

      stream = null;
    }


    camera.srcObject = null;


    startCamera.disabled = false;

    switchCamera.disabled = true;

    stopCamera.disabled = true;


    videoState.textContent =
      "VIDEO ✓";


    analyzeVideo.disabled =
      false;


    stage.textContent =
      "VIDEO READY";


    status.textContent =
      "✅ VIDEO SELECTED";


    progress.value = 0;


    resizeCanvas();


    console.log(
      "Selected:",
      file.name
    );

    console.log(
      "Size:",
      file.size
    );

    console.log(
      "Type:",
      file.type
    );
  };


/* =========================
   WAIT FOR VIDEO SEEK
========================= */

function seekVideo(time) {

  return new Promise(
    resolve => {

      const target =
        Math.max(
          0,
          Math.min(
            time,
            videoPlayer.duration || time
          )
        );


      /* Already close enough */

      if (
        Math.abs(
          videoPlayer.currentTime - target
        ) < 0.001
      ) {

        resolve();

        return;
      }


      const onSeeked =
        () => {

          videoPlayer.removeEventListener(
            "seeked",
            onSeeked
          );

          resolve();
        };


      videoPlayer.addEventListener(
        "seeked",
        onSeeked
      );


      videoPlayer.currentTime =
        target;
    }
  );
}


/* =========================
   ANALYZE VIDEO
========================= */

analyzeVideo.onclick =
  async function () {

    if (!videoURL)
      return;


    /* FIXED:
       analysing, not analyzing
    */

    if (analysing)
      return;


    analysing = true;


    analyzeVideo.disabled =
      true;


    startCamera.disabled =
      true;


    status.textContent =
      aiReady
        ? "🧠 ANALYZING VIDEO..."
        : "Video loaded — AI unavailable";


    stage.textContent =
      aiReady
        ? "FRAME ANALYSIS"
        : "VIDEO READY";


    try {

      /* Wait for metadata */

      if (
        videoPlayer.readyState < 1
      ) {

        await new Promise(
          resolve => {

            videoPlayer.addEventListener(
              "loadedmetadata",
              resolve,
              { once: true }
            );
          }
        );
      }


      if (!aiReady) {

        status.textContent =
          "Video works, but AI did not load.";

        stage.textContent =
          "AI UNAVAILABLE";

        return;
      }


      const duration =
        videoPlayer.duration;


      if (
        !duration ||
        !isFinite(duration)
      ) {

        throw new Error(
          "Could not read video duration"
        );
      }


      /*

        Analyze approximately
        12 frames per second.

      */

      const fps = 12;

      const step =
        1 / fps;


      const total =
        Math.ceil(
          duration * fps
        );


      let frame = 0;


      videoTimestamp = 0;


      videoPlayer.pause();


      resizeCanvas();


      for (
        let time = 0;
        time < duration;
        time += step
      ) {

        await seekVideo(time);


        resizeCanvas();


        /*
          PoseLandmarker VIDEO mode
          requires increasing timestamps.
        */

        videoTimestamp += 1000 / fps;


        const result =
          landmarker.detectForVideo(
            videoPlayer,
            videoTimestamp
          );


        drawPose(result);


        frame++;


        progress.value =
          Math.round(
            frame / total * 100
          );


        stage.textContent =
          "ANALYZING " +
          progress.value +
          "%";


        /*
          Give the phone a tiny break
          during long videos.
        */

        if (
          frame % 8 === 0
        ) {

          await new Promise(
            resolve =>
              setTimeout(resolve, 0)
          );
        }
      }


      videoPlayer.pause();


      progress.value = 100;


      stage.textContent =
        "✓ VIDEO ANALYZED";


      status.textContent =
        "AI frame analysis complete";


    }

    catch (error) {

      console.error(
        "VIDEO ANALYSIS ERROR:",
        error
      );


      status.textContent =
        "❌ VIDEO ERROR";


      stage.textContent =
        error.message ||
        "Analysis failed";
    }


    finally {

      analysing = false;


      analyzeVideo.disabled =
        false;


      startCamera.disabled =
        false;
    }
  };


/* =========================
   START AI
========================= */

loadAI();