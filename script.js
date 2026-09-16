import {
  FilesetResolver,
  PoseLandmarker
} from "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.22/+esm";

const MODEL =
"https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task";

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

async function loadAI(){

  try{

    statusEl.textContent =
      "Loading body-tracking AI...";

    const vision =
      await FilesetResolver.forVisionTasks(
        "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.22/wasm"
      );

    landmarker =
      await PoseLandmarker.createFromOptions(
        vision,
        {
          baseOptions:{
            modelAssetPath:MODEL,
            delegate:"GPU"
          },

          runningMode:"VIDEO",

          numPoses:1,

          minPoseDetectionConfidence:.55,
          minPosePresenceConfidence:.55,
          minTrackingConfidence:.55
        }
      );

    statusEl.textContent =
      "AI ready. Start camera.";

    stageEl.textContent =
      "READY";

  }catch(error){

    console.error(error);

    statusEl.textContent =
      "AI failed to load. Refresh the page.";

    stageEl.textContent =
      "ERROR";
  }
}

loadAI();


async function startCamera(){

  if(!landmarker){
    statusEl.textContent =
      "AI is still loading...";
    return;
  }

  try{

    stream =
      await navigator.mediaDevices.getUserMedia({
        video:{
          facingMode:"user",
          width:{ideal:720},
          height:{ideal:960}
        },
        audio:false
      });

    camera.srcObject = stream;

    await camera.play();

    running = true;
    calibrating = false;
    confirmed = false;

    calibrationJumps = 0;
    skips = 0;

    skipEl.textContent = "0";

    calibrationEl.textContent = "0 / 5";

    barFill.style.width = "0%";

    signalHistory = [];
    handHistory = [];
    headHistory = [];
    legHistory = [];

    previousSignal = null;
    previousVelocity = 0;

    jumpState = "GROUND";

    startBtn.disabled = true;
    calibrateBtn.disabled = false;
    stopBtn.disabled = false;

    stageEl.textContent =
      "BODY DETECTION";

    statusEl.textContent =
      "Stand back so your full body is visible.";

    resizeCanvas();

    detectLoop();

  }catch(error){

    console.error(error);

    statusEl.textContent =
      "Camera permission was denied or unavailable.";
  }
}


function stopCamera(){

  running = false;
  calibrating = false;

  if(animationId){
    cancelAnimationFrame(animationId);
    animationId = null;
  }

  if(stream){

    stream.getTracks().forEach(
      track => track.stop()
    );

    stream = null;
  }

  camera.srcObject = null;

  startBtn.disabled = false;
  calibrateBtn.disabled = true;
  stopBtn.disabled = true;

  stageEl.textContent = "STOPPED";

  statusEl.textContent =
    "Camera stopped.";
}


function resizeCanvas(){

  if(camera.videoWidth){

    canvas.width =
      camera.videoWidth;

    canvas.height =
      camera.videoHeight;
  }
}


function pointVisible(p){

  return p &&
    typeof p.x === "number" &&
    typeof p.y === "number" &&
    (p.visibility === undefined ||
     p.visibility > .45);
}


function detectBody(parts){

  const nose = parts[0];

  const leftWrist = parts[15];
  const rightWrist = parts[16];

  const leftKnee = parts[25];
  const rightKnee = parts[26];

  const leftAnkle = parts[27];
  const rightAnkle = parts[28];

  const head =
    pointVisible(nose);

  const hands =
    pointVisible(leftWrist) &&
    pointVisible(rightWrist);

  const legs =
    pointVisible(leftAnkle) &&
    pointVisible(rightAnkle) &&
    pointVisible(leftKnee) &&
    pointVisible(rightKnee);

  headEl.textContent =
    head ? "HEAD ✓" : "HEAD ○";

  handsEl.textContent =
    hands ? "HANDS ✓" : "HANDS ○";

  legsEl.textContent =
    legs ? "LEGS ✓" : "LEGS ○";

  return {
    head,
    hands,
    legs
  };
}


function calculateSignal(p){

  const leftAnkle = p[27];
  const rightAnkle = p[28];

  const leftHip = p[23];
  const rightHip = p[24];

  const leftKnee = p[25];
  const rightKnee = p[26];

  if(
    !pointVisible(leftAnkle) ||
    !pointVisible(rightAnkle) ||
    !pointVisible(leftHip) ||
    !pointVisible(rightHip)
  ){
    return null;
  }

  const ankleY =
    (leftAnkle.y + rightAnkle.y) / 2;

  const hipY =
    (leftHip.y + rightHip.y) / 2;

  const kneeY =
    (leftKnee.y + rightKnee.y) / 2;

  /*
    Main signal:
    ankle-to-hip distance.

    Additional knee information helps reject
    random body movement.
  */

  const ankleHip =
    ankleY - hipY;

  const kneeHip =
    kneeY - hipY;

  return {
    main:ankleHip,
    knee:kneeHip,

    wristY:
      (
        p[15].y +
        p[16].y
      ) / 2,

    headY:p[0].y
  };
}


function smooth(array){

  if(array.length === 0)
    return 0;

  const n =
    Math.min(array.length,7);

  let total = 0;

  for(
    let i=array.length-n;
    i<array.length;
    i++
  ){
    total += array[i];
  }

  return total/n;
}


function analyzeJump(signal, now){

  signalHistory.push(signal.main);

  if(signalHistory.length > 20)
    signalHistory.shift();

  if(signalHistory.length < 8)
    return;

  const current =
    smooth(signalHistory);

  if(previousSignal === null){

    previousSignal = current;
    return;
  }

  const velocity =
    current - previousSignal;

  /*
    Detect a change from downward movement
    to upward movement and back.

    The jump is therefore a complete movement,
    not just one noisy frame.
  */

  const rising =
    velocity < -0.002;

  const falling =
    velocity > 0.002;

  /*
    Need sufficient movement amplitude.
  */

  let localMin =
    Math.min(...signalHistory);

  let localMax =
    Math.max(...signalHistory);

  const amplitude =
    localMax-localMin;

  const requiredAmplitude =
    calibrating
      ? 0.025
      : Math.max(
          .025,
          calibratedAmplitude * .35
        );

  if(
    jumpState === "GROUND" &&
    rising &&
    amplitude > requiredAmplitude
  ){

    jumpState = "UP";
  }

  if(
    jumpState === "UP" &&
    falling
  ){

    /*
      Complete jump.
    */

    if(
      now-lastJumpTime > 280
    ){

      registerJump(now);
    }

    jumpState = "GROUND";
  }

  previousSignal = current;
  previousVelocity = velocity;
}


function registerJump(now){

  lastJumpTime = now;

  if(calibrating){

    calibrationSamples.push({
      time:now,
      signal:smooth(signalHistory)
    });

    calibrationJumps++;

    calibrationEl.textContent =
      calibrationJumps + " / 5";

    barFill.style.width =
      (calibrationJumps/5*100) + "%";

    stageEl.textContent =
      "CALIBRATING • " +
      calibrationJumps +
      " / 5";

    if(calibrationJumps >= 5){

      finishCalibration();
    }

    return;
  }

  if(!confirmed)
    return;

  skips++;

  skipEl.textContent =
    skips.toLocaleString();

  stageEl.textContent =
    "SKIPPING • " +
    skips.toLocaleString();
}


function finishCalibration(){

  calibrating = false;

  /*
    Calculate the typical movement amplitude
    and approximate timing from the five jumps.
  */

  const values =
    calibrationSamples.map(
      x => x.signal
    );

  if(values.length){

    const max =
      Math.max(...values);

    const min =
      Math.min(...values);

    calibratedAmplitude =
      Math.max(
        .04,
        max-min
      );
  }

  if(calibrationSamples.length >= 2){

    let total = 0;

    for(
      let i=1;
      i<calibrationSamples.length;
      i++
    ){

      total +=
        calibrationSamples[i].time -
        calibrationSamples[i-1].time;
    }

    calibratedPeriod =
      total /
      (calibrationSamples.length-1);
  }

  confirmed = true;

  stageEl.textContent =
    "✓ PATTERN CONFIRMED";

  statusEl.textContent =
    "Your jump pattern is calibrated. Keep skipping.";

  calibrateBtn.disabled = true;
}


function drawSkeleton(points){

  ctx.clearRect(
    0,
    0,
    canvas.width,
    canvas.height
  );

  const connections = [

    [11,12],

    [11,13],
    [13,15],

    [12,14],
    [14,16],

    [11,23],
    [12,24],

    [23,24],

    [23,25],
    [25,27],

    [24,26],
    [26,28],

    [27,29],
    [29,31],

    [28,30],
    [30,32]
  ];

  ctx.lineWidth = 3;
  ctx.strokeStyle = "#36a9ff";

  for(const [a,b] of connections){

    if(
      !pointVisible(points[a]) ||
      !pointVisible(points[b])
    )
      continue;

    ctx.beginPath();

    ctx.moveTo(
      points[a].x*canvas.width,
      points[a].y*canvas.height
    );

    ctx.lineTo(
      points[b].x*canvas.width,
      points[b].y*canvas.height
    );

    ctx.stroke();
  }

  ctx.fillStyle = "#ffffff";

  for(const p of points){

    if(!pointVisible(p))
      continue;

    ctx.beginPath();

    ctx.arc(
      p.x*canvas.width,
      p.y*canvas.height,
      4,
      0,
      Math.PI*2
    );

    ctx.fill();
  }
}


function detectLoop(){

  if(!running)
    return;

  if(camera.readyState >= 2){

    resizeCanvas();

    try{

      const result =
        landmarker.detectForVideo(
          camera,
          performance.now()
        );

      if(
        result.landmarks &&
        result.landmarks.length
      ){

        const points =
          result.landmarks[0];

        drawSkeleton(points);

        const body =
          detectBody(points);

        if(
          !body.head ||
          !body.hands ||
          !body.legs
        ){

          if(!calibrating && !confirmed){

            stageEl.textContent =
              "FULL BODY REQUIRED";
          }

        }else{

          if(
            !calibrating &&
            !confirmed
          ){

            stageEl.textContent =
              "BODY DETECTED ✓";
          }

          const signal =
            calculateSignal(points);

          if(signal){

            analyzeJump(
              signal,
              performance.now()
            );
          }
        }

      }else{

        headEl.textContent = "HEAD ○";
        handsEl.textContent = "HANDS ○";
        legsEl.textContent = "LEGS ○";

        stageEl.textContent =
          "NO BODY DETECTED";
      }

    }catch(error){

      console.error(error);
    }
  }

  animationId =
    requestAnimationFrame(
      detectLoop
    );
}


startBtn.addEventListener(
  "click",
  startCamera
);


stopBtn.addEventListener(
  "click",
  stopCamera
);


calibrateBtn.addEventListener(
  "click",
  ()=>{

    if(!running)
      return;

    calibrating = true;
    confirmed = false;

    calibrationJumps = 0;
    calibrationSamples = [];

    calibrationEl.textContent =
      "0 / 5";

    barFill.style.width = "0%";

    previousSignal = null;
    jumpState = "GROUND";

    stageEl.textContent =
      "JUMP 5 TIMES";

    statusEl.textContent =
      "Make five normal, controlled jumps.";
  }
);