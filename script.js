import {
  PoseLandmarker,
  FilesetResolver
} from "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.22/+esm";

const statusText = document.getElementById("status");
const camera = document.getElementById("camera");
const liveCountText = document.getElementById("liveCount");

const fileInput = document.getElementById("videoFile");
const fileVideo = document.getElementById("fileVideo");
const analyzeBtn = document.getElementById("analyzeBtn");
const fileCountText = document.getElementById("fileCount");
const fileStatus = document.getElementById("fileStatus");

let poseLandmarker;
let stream = null;
let animationId = null;
let recording = null;
let recordedChunks = [];

let liveCount = 0;
let lastJump = false;
let lastCountTime = 0;

const MODEL_URL =
"https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task";

async function loadAI(){

  try{

    statusText.textContent = "Loading AI body tracker...";

    const vision = await FilesetResolver.forVisionTasks(
      "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.22/wasm"
    );

    poseLandmarker = await PoseLandmarker.createFromOptions(
      vision,
      {
        baseOptions:{
          modelAssetPath:MODEL_URL,
          delegate:"GPU"
        },

        runningMode:"VIDEO",

        numPoses:1,

        minPoseDetectionConfidence:0.5,
        minPosePresenceConfidence:0.5,
        minTrackingConfidence:0.5
      }
    );

    statusText.textContent = "✅ AI ready";

  }catch(error){

    console.error(error);

    statusText.textContent =
      "❌ AI failed to load. Refresh the page.";
  }
}

loadAI();

async function startCamera(mode){

  stopCamera();

  try{

    stream = await navigator.mediaDevices.getUserMedia({
      video:{
        facingMode:mode,
        width:{ideal:640},
        height:{ideal:480}
      },
      audio:false
    });

    camera.srcObject = stream;

    await camera.play();

    statusText.textContent =
      "🟢 Camera running — start skipping";

    liveCount = 0;
    liveCountText.textContent = "0";

    lastJump = false;
    lastCountTime = 0;

    detectCamera();

  }catch(error){

    console.error(error);

    statusText.textContent =
      "❌ Camera permission/error.";
  }
}

function stopCamera(){

  if(animationId){
    cancelAnimationFrame(animationId);
    animationId = null;
  }

  if(stream){

    stream.getTracks().forEach(track=>{
      track.stop();
    });

    stream = null;
  }

  camera.srcObject = null;
}

function getSignal(landmarks){

  if(!landmarks) return null;

  const leftAnkle = landmarks[27];
  const rightAnkle = landmarks[28];

  const leftHip = landmarks[23];
  const rightHip = landmarks[24];

  if(
    !leftAnkle ||
    !rightAnkle ||
    !leftHip ||
    !rightHip
  ){
    return null;
  }

  const ankleY =
    (leftAnkle.y + rightAnkle.y) / 2;

  const hipY =
    (leftHip.y + rightHip.y) / 2;

  return ankleY - hipY;
}

let signalHistory = [];

function processSignal(signal){

  if(signal === null) return;

  signalHistory.push(signal);

  if(signalHistory.length > 15){
    signalHistory.shift();
  }

  if(signalHistory.length < 8){
    return;
  }

  const avg =
    signalHistory.reduce((a,b)=>a+b,0) /
    signalHistory.length;

  const current = signalHistory[
    signalHistory.length - 1
  ];

  const now = performance.now();

  /*
    Smaller ankle-to-hip distance means
    feet are higher relative to the body.
  */

  const jumpThreshold = 0.42;

  const isJump =
    current < avg - 0.025 &&
    current < jumpThreshold;

  if(
    isJump &&
    !lastJump &&
    now - lastCountTime > 250
  ){

    liveCount++;

    liveCountText.textContent =
      liveCount.toLocaleString();

    lastCountTime = now;
  }

  lastJump = isJump;
}

function detectCamera(){

  if(!stream || !poseLandmarker) return;

  if(camera.readyState < 2){

    animationId =
      requestAnimationFrame(detectCamera);

    return;
  }

  const timestamp =
    performance.now();

  const result =
    poseLandmarker.detectForVideo(
      camera,
      timestamp
    );

  if(
    result.landmarks &&
    result.landmarks.length
  ){

    const signal =
      getSignal(result.landmarks[0]);

    processSignal(signal);

  }else{

    statusText.textContent =
      "⚠️ Body not clearly visible";
  }

  animationId =
    requestAnimationFrame(detectCamera);
}

document
.getElementById("frontBtn")
.addEventListener("click",()=>{
  startCamera("user");
});

document
.getElementById("rearBtn")
.addEventListener("click",()=>{
  startCamera("environment");
});

document
.getElementById("openCamera")
.addEventListener("click",()=>{
  startCamera("user");
});

document
.getElementById("stopCamera")
.addEventListener("click",()=>{
  stopCamera();
  statusText.textContent =
    "Camera stopped";
});

document
.getElementById("recordBtn")
.addEventListener("click",()=>{

  if(!stream){

    alert("Open the camera first.");
    return;
  }

  if(recording && recording.state === "recording"){

    recording.stop();

    document.getElementById("recordBtn")
      .textContent = "🔴 Start Recording";

    return;
  }

  recordedChunks = [];

  let mime = "video/webm";

  if(
    MediaRecorder.isTypeSupported(
      "video/webm;codecs=vp9"
    )
  ){
    mime = "video/webm;codecs=vp9";
  }

  recording = new MediaRecorder(
    stream,
    {mimeType:mime}
  );

  recording.ondataavailable = e => {

    if(e.data.size > 0){
      recordedChunks.push(e.data);
    }
  };

  recording.onstop = ()=>{

    const blob =
      new Blob(recordedChunks,{
        type:mime
      });

    const url =
      URL.createObjectURL(blob);

    const video =
      document.getElementById("recordedVideo");

    video.src = url;
    video.hidden = false;

  };

  recording.start();

  document.getElementById("recordBtn")
    .textContent = "⏹ Stop Recording";
});

/* FILE ANALYSIS */

fileInput.addEventListener("change",()=>{

  const file = fileInput.files[0];

  if(!file) return;

  const url =
    URL.createObjectURL(file);

  fileVideo.src = url;
  fileVideo.hidden = false;

  fileStatus.textContent =
    "Video loaded. Press Analyze Video.";

  fileCountText.textContent = "0";
});

function analyzeVideo(){

  return new Promise(resolve=>{

    const samples = [];

    const duration =
      fileVideo.duration;

    const fps = 15;

    const totalFrames =
      Math.floor(duration * fps);

    let frame = 0;

    function nextFrame(){

      if(frame >= totalFrames){

        resolve(samples);
        return;
      }

      const time =
        frame / fps;

      fileVideo.currentTime = time;

      const waitForSeek = ()=>{

        fileVideo.removeEventListener(
          "seeked",
          waitForSeek
        );

        try{

          const result =
            poseLandmarker.detectForVideo(
              fileVideo,
              Math.round(time * 1000000)
            );

          if(
            result.landmarks &&
            result.landmarks.length
          ){

            const signal =
              getSignal(
                result.landmarks[0]
              );

            if(signal !== null){
              samples.push(signal);
            }
          }

        }catch(error){
          console.error(error);
        }

        frame++;

        setTimeout(nextFrame,20);
      };

      fileVideo.addEventListener(
        "seeked",
        waitForSeek
      );
    }

    nextFrame();
  });
}

function countFromSamples(samples){

  if(samples.length < 10){
    return 0;
  }

  /*
    Smooth the signal.
  */

  const smooth = [];

  const windowSize = 5;

  for(let i=0;i<samples.length;i++){

    let sum = 0;
    let count = 0;

    for(
      let j=i-windowSize;
      j<=i+windowSize;
      j++
    ){

      if(j>=0 && j<samples.length){

        sum += samples[j];
        count++;
      }
    }

    smooth.push(sum/count);
  }

  let min =
    Math.min(...smooth);

  let max =
    Math.max(...smooth);

  const range = max-min;

  if(range < 0.04){
    return 0;
  }

  /*
    Count alternating movement cycles.
  */

  const threshold =
    range * 0.22;

  let count = 0;

  let state = "low";

  let lastTime = -100;

  for(let i=2;i<smooth.length-2;i++){

    const prev = smooth[i-1];
    const current = smooth[i];
    const next = smooth[i+1];

    /*
      Local minimum = feet higher.
    */

    const isPeak =
      current < prev &&
      current < next &&
      min + threshold > current;

    if(
      isPeak &&
      state !== "peak" &&
      i-lastTime >= 4
    ){

      count++;

      state = "peak";
      lastTime = i;
    }

    /*
      Return toward lower position
      before another skip can be counted.
    */

    if(
      state === "peak" &&
      current > min + threshold
    ){

      state = "low";
    }
  }

  return count;
}

analyzeBtn.addEventListener("click",async()=>{

  if(!poseLandmarker){

    fileStatus.textContent =
      "AI is still loading. Wait a moment.";

    return;
  }

  if(!fileVideo.src){

    fileStatus.textContent =
      "Choose a video first.";

    return;
  }

  analyzeBtn.disabled = true;

  fileStatus.textContent =
    "🧠 AI analyzing your video...";

  try{

    const samples =
      await analyzeVideo();

    const count =
      countFromSamples(samples);

    fileCountText.textContent =
      count.toLocaleString();

    fileStatus.textContent =
      `✅ Analysis complete. ${count} skips detected.`;

  }catch(error){

    console.error(error);

    fileStatus.textContent =
      "❌ Video analysis failed.";

  }finally{

    analyzeBtn.disabled = false;
  }
});

/* PROGRESS */

const totalSkipsText =
  document.getElementById("totalSkips");

let savedTotal =
  Number(localStorage.getItem("skipfitTotal") || 0);

totalSkipsText.textContent =
  savedTotal.toLocaleString();

document
.getElementById("saveBtn")
.addEventListener("click",()=>{

  savedTotal += liveCount;

  localStorage.setItem(
    "skipfitTotal",
    savedTotal
  );

  totalSkipsText.textContent =
    savedTotal.toLocaleString();

  alert(
    `${liveCount} skips saved!`
  );
});

document
.getElementById("resetBtn")
.addEventListener("click",()=>{

  savedTotal = 0;

  localStorage.setItem(
    "skipfitTotal",
    "0"
  );

  totalSkipsText.textContent = "0";
});