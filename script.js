import {
  FilesetResolver,
  PoseLandmarker
} from "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.22/+esm";


/* =========================
   ELEMENTS
========================= */

const camera =
  document.getElementById("camera");

const videoPlayer =
  document.getElementById("videoFilePlayer");

const videoInput =
  document.getElementById("videoInput");

const canvas =
  document.getElementById("canvas");

const ctx =
  canvas.getContext("2d");

const status =
  document.getElementById("status");

const stage =
  document.getElementById("stage");

const count =
  document.getElementById("count");

const progress =
  document.getElementById("progress");

const startCamera =
  document.getElementById("startCamera");

const switchCamera =
  document.getElementById("switchCamera");

const stopCamera =
  document.getElementById("stopCamera");

const analyzeVideo =
  document.getElementById("analyzeVideo");

const cameraState =
  document.getElementById("cameraState");

const videoState =
  document.getElementById("videoState");

const aiState =
  document.getElementById("aiState");


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


/* =========================
   AI LOADING
   IMPORTANT:
   AI DOES NOT BLOCK CAMERA
========================= */

async function loadAI(){

  try{

    status.textContent =
      "Loading AI...";

    const vision =
      await FilesetResolver.forVisionTasks(
        "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.22/wasm"
      );

    landmarker =
      await PoseLandmarker.createFromOptions(
        vision,
        {
          baseOptions:{
            modelAssetPath:
              "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task",

            delegate:"CPU"
          },

          runningMode:"VIDEO",

          numPoses:1,

          minPoseDetectionConfidence:.35,

          minPosePresenceConfidence:.35,

          minTrackingConfidence:.35
        }
      );

    aiReady = true;

    aiState.textContent =
      "AI ✓";

    status.textContent =
      "✅ AI READY";

    console.log(
      "SkipFit AI ready"
    );

  }catch(error){

    console.error(
      "AI ERROR:",
      error
    );

    aiState.textContent =
      "AI ✕";

    /*
      IMPORTANT:
      Camera and video upload
      still work even if AI fails.
    */

    status.textContent =
      "Camera/video ready — AI unavailable";

  }
}


/* =========================
   CAMERA
========================= */

startCamera.onclick =
  async function(){

    try{

      if(!navigator.mediaDevices ||
         !navigator.mediaDevices.getUserMedia){

        status.textContent =
          "Camera API unavailable";

        return;
      }

      if(stream){

        stream.getTracks()
          .forEach(
            track => track.stop()
          );
      }

      status.textContent =
        "Requesting camera...";

      stream =
        await navigator.mediaDevices.getUserMedia({

          video:{
            facingMode:facing,

            width:{
              ideal:640
            },

            height:{
              ideal:480
            }
          },

          audio:false
        });

      camera.srcObject =
        stream;

      camera.style.display =
        "block";

      videoPlayer.style.display =
        "none";

      await camera.play();

      cameraRunning = true;

      cameraState.textContent =
        "CAMERA ✓";

      startCamera.disabled =
        true;

      switchCamera.disabled =
        false;

      stopCamera.disabled =
        false;

      stage.textContent =
        "CAMERA ACTIVE";

      status.textContent =
        "📷 CAMERA WORKING";

      resizeCanvas();

      cameraLoop();

    }catch(error){

      console.error(error);

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
  async function(){

    facing =
      facing === "user"
        ? "environment"
        : "user";

    if(stream){

      stream.getTracks()
        .forEach(
          track => track.stop()
        );
    }

    stream = null;

    startCamera.disabled =
      false;

    startCamera.click();
  };


/* =========================
   STOP CAMERA
========================= */

stopCamera.onclick =
  function(){

    cameraRunning = false;

    if(stream){

      stream.getTracks()
        .forEach(
          track => track.stop()
        );

      stream = null;
    }

    camera.srcObject = null;

    camera.style.display =
      "none";

    cameraState.textContent =
      "CAMERA ○";

    startCamera.disabled =
      false;

    switchCamera.disabled =
      true;

    stopCamera.disabled =
      true;

    stage.textContent =
      "STOPPED";

    status.textContent =
      "Camera stopped";
  };


/* =========================
   CANVAS
========================= */

function resizeCanvas(){

  if(camera.videoWidth){

    canvas.width =
      camera.videoWidth;

    canvas.height =
      camera.videoHeight;
  }

  else if(videoPlayer.videoWidth){

    canvas.width =
      videoPlayer.videoWidth;

    canvas.height =
      videoPlayer.videoHeight;
  }
}


/* =========================
   CAMERA AI LOOP
========================= */

let lastProcess = 0;


function cameraLoop(){

  if(!cameraRunning)
    return;

  requestAnimationFrame(
    cameraLoop
  );

  if(!aiReady)
    return;

  if(camera.readyState < 2)
    return;

  const now =
    performance.now();

  if(now-lastProcess < 80)
    return;

  lastProcess = now;

  try{

    resizeCanvas();

    const result =
      landmarker.detectForVideo(
        camera,
        now
      );

    drawPose(
      result
    );

  }catch(error){

    console.error(
      "Camera AI:",
      error
    );
  }
}


/* =========================
   DRAW BODY
========================= */

function drawPose(result){

  ctx.clearRect(
    0,
    0,
    canvas.width,
    canvas.height
  );

  if(
    !result ||
    !result.landmarks ||
    !result.landmarks.length
  ){

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

  for(
    const p of points
  ){

    if(
      p.visibility !== undefined &&
      p.visibility < .25
    )
      continue;

    ctx.beginPath();

    ctx.arc(
      p.x * canvas.width,
      p.y * canvas.height,
      4,
      0,
      Math.PI*2
    );

    ctx.fill();
  }
}


/* =========================
   VIDEO FILE
========================= */

videoInput.onchange =
  function(){

    const file =
      videoInput.files[0];

    if(!file)
      return;

    if(videoURL){

      URL.revokeObjectURL(
        videoURL
      );
    }

    videoURL =
      URL.createObjectURL(
        file
      );

    videoPlayer.src =
      videoURL;

    videoPlayer.load();

    videoPlayer.style.display =
      "block";

    camera.style.display =
      "none";

    videoState.textContent =
      "VIDEO ✓";

    analyzeVideo.disabled =
      false;

    stage.textContent =
      "VIDEO READY";

    status.textContent =
      "✅ VIDEO SELECTED";

    progress.value = 0;

    console.log(
      "Selected:",
      file.name,
      file.size,
      file.type
    );
  };


/* =========================
   ANALYZE VIDEO
========================= */

analyzeVideo.onclick =
  async function(){

    if(!videoURL)
      return;

    if(analyzing)
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

    try{

      await new Promise(
        resolve => {

          if(
            videoPlayer.readyState >= 1
          ){

            resolve();

          }else{

            videoPlayer.addEventListener(
              "loadedmetadata",
              resolve,
              {once:true}
            );
          }
        }
      );


      if(!aiReady){

        status.textContent =
          "Video works, but AI did not load.";

        stage.textContent =
          "AI UNAVAILABLE";

        return;
      }


      const duration =
        videoPlayer.duration;

      if(
        !duration ||
        !isFinite(duration)
      ){

        throw new Error(
          "Could not read video duration"
        );
      }


      const fps = 12;

      const step =
        1 / fps;

      let frame = 0;

      const total =
        Math.ceil(
          duration * fps
        );


      for(
        let time=0;
        time<duration;
        time+=step
      ){

        videoPlayer.currentTime =
          time;


        await new Promise(
          resolve => {

            if(
              !videoPlayer.seeking
            ){

              resolve();

            }else{

              videoPlayer.addEventListener(
                "seeked",
                resolve,
                {once:true}
              );
            }
          }
        );


        const result =
          landmarker.detectForVideo(
            videoPlayer,
            performance.now()
          );


        drawPose(
          result
        );


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
          Let the phone breathe.
        */

        if(frame % 8 === 0){

          await new Promise(
            r => setTimeout(r,0)
          );
        }
      }


      videoPlayer.pause();

      stage.textContent =
        "✓ VIDEO ANALYZED";

      status.textContent =
        "AI frame analysis complete";

    }catch(error){

      console.error(error);

      status.textContent =
        "❌ VIDEO ERROR";

      stage.textContent =
        error.message;
    }

    finally{

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