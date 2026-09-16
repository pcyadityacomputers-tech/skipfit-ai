// ==========================================
// SKIPFIT AI V6
// CAMERA + FILE + ACTUAL SKIP COUNTING
// ==========================================

const camera =
  document.getElementById("camera");

const cameraCanvas =
  document.getElementById("cameraCanvas");

const cameraCtx =
  cameraCanvas.getContext("2d");

const openCameraBtn =
  document.getElementById("openCameraBtn");

const recordBtn =
  document.getElementById("recordBtn");

const cameraStatus =
  document.getElementById("cameraStatus");

const liveCount =
  document.getElementById("liveCount");

const videoFile =
  document.getElementById("videoFile");

const fileVideo =
  document.getElementById("fileVideo");

const analyzeFileBtn =
  document.getElementById("analyzeFileBtn");

const fileCount =
  document.getElementById("fileCount");

const fileStatus =
  document.getElementById("fileStatus");

const recordedVideo =
  document.getElementById("recordedVideo");

const recordStatus =
  document.getElementById("recordStatus");

const totalSkipsBox =
  document.getElementById("totalSkips");

const taskBox =
  document.getElementById("skipTask");

const progressBar =
  document.getElementById("skipProgress");


// ==========================================
// DATA
// ==========================================

let totalSkips =
  Number(localStorage.getItem("skipCount") || 0);

let sessionSkips = 0;

let cameraStream = null;

let recorder = null;

let chunks = [];

let recording = false;

let pose = null;

let cameraRunning = false;

let processingFile = false;


// ==========================================
// SKIP DETECTOR
// ==========================================

class SkipDetector {

  constructor() {

    this.values = [];

    this.lastCountTime = 0;

    this.state = "down";

    this.count = 0;

  }


  reset() {

    this.values = [];

    this.lastCountTime = 0;

    this.state = "down";

    this.count = 0;

  }


  add(value, time) {

    this.values.push({
      value: value,
      time: time
    });


    if (this.values.length > 7) {
      this.values.shift();
    }


    if (this.values.length < 5) {
      return false;
    }


    const n =
      this.values.length;


    const a =
      this.values[n - 5].value;

    const b =
      this.values[n - 4].value;

    const c =
      this.values[n - 3].value;

    const d =
      this.values[n - 2].value;

    const e =
      this.values[n - 1].value;


    /*
     * Normalize movement.
     *
     * During a jump the feet move
     * upward relative to the hips.
     *
     * We look for:
     *
     * DOWN → UP → DOWN
     */


    const rising =
      a > b &&
      b > c;


    const falling =
      c < d &&
      d < e;


    if (
      rising &&
      this.state === "down"
    ) {

      this.state = "up";

    }


    if (
      falling &&
      this.state === "up"
    ) {

      if (
        time -
        this.lastCountTime >
        0.25
      ) {

        this.count++;

        this.lastCountTime =
          time;

        this.state =
          "down";

        return true;
      }

      this.state =
        "down";
    }


    return false;
  }
}


// ==========================================
// BODY VALUE
// ==========================================

function getBodyValue(results) {

  if (
    !results ||
    !results.poseLandmarks ||
    !results.poseLandmarks.length
  ) {
    return null;
  }


  const p =
    results.poseLandmarks;


  const leftHip =
    p[23];

  const rightHip =
    p[24];

  const leftAnkle =
    p[27];

  const rightAnkle =
    p[28];

  const leftKnee =
    p[25];

  const rightKnee =
    p[26];


  if (
    !leftHip ||
    !rightHip ||
    !leftAnkle ||
    !rightAnkle
  ) {
    return null;
  }


  const hipY =
    (
      leftHip.y +
      rightHip.y
    ) / 2;


  const ankleY =
    (
      leftAnkle.y +
      rightAnkle.y
    ) / 2;


  /*
   * Add knee information to make
   * the measurement more stable.
   */

  let kneeY =
    (
      leftKnee.y +
      rightKnee.y
    ) / 2;


  /*
   * Feet relative to hips.
   *
   * Smaller value = feet are higher.
   */

  const footHip =
    ankleY - hipY;


  /*
   * Knee angle contribution.
   *
   * This helps distinguish actual
   * jumping from small tracking noise.
   */

  const kneeHip =
    kneeY - hipY;


  return {
    footHip: footHip,
    kneeHip: kneeHip
  };
}


// ==========================================
// COMBINED MOVEMENT SIGNAL
// ==========================================

function movementSignal(body) {

  /*
   * Foot movement is the main signal.
   * Knee movement is secondary.
   */

  return (
    body.footHip * 0.75 +
    body.kneeHip * 0.25
  );
}


// ==========================================
// UI
// ==========================================

function updateUI() {

  liveCount.textContent =
    sessionSkips;

  totalSkipsBox.textContent =
    totalSkips;

  taskBox.textContent =
    Math.min(totalSkips, 1000)
    + " / 1000";

  progressBar.style.width =
    Math.min(totalSkips / 10, 100)
    + "%";
}


updateUI();


// ==========================================
// MEDIAPIPE
// ==========================================

pose = new Pose({

  locateFile: function(file) {

    return (
      "https://cdn.jsdelivr.net/npm/@mediapipe/pose@0.5/" +
      file
    );

  }

});


pose.setOptions({

  modelComplexity: 2,

  smoothLandmarks: true,

  enableSegmentation: false,

  smoothSegmentation: false,

  minDetectionConfidence: 0.55,

  minTrackingConfidence: 0.55

});


let activeDetector = null;


// ==========================================
// CAMERA RESULT
// ==========================================

const liveDetector =
  new SkipDetector();


pose.onResults(function(results) {

  if (!cameraRunning) {
    return;
  }


  drawPose(results);


  const body =
    getBodyValue(results);


  if (!body) {

    cameraStatus.textContent =
      "🟡 Looking for complete body...";

    return;
  }


  const value =
    movementSignal(body);


  const now =
    performance.now() / 1000;


  if (
    liveDetector.add(
      value,
      now
    )
  ) {

    sessionSkips++;

    updateUI();
  }


  cameraStatus.innerHTML =
    "🟢 Body detected<br>" +
    "🦴 Advanced pose tracking active";

});


// ==========================================
// DRAW SKELETON
// ==========================================

function drawPose(results) {

  if (
    !results.poseLandmarks
  ) {
    return;
  }


  cameraCtx.clearRect(
    0,
    0,
    cameraCanvas.width,
    cameraCanvas.height
  );


  const points =
    results.poseLandmarks;


  const lines = [

    [11, 12],

    [11, 13],
    [13, 15],

    [12, 14],
    [14, 16],

    [11, 23],
    [12, 24],

    [23, 24],

    [23, 25],
    [25, 27],

    [24, 26],
    [26, 28]

  ];


  cameraCtx.lineWidth = 3;


  for (
    const line of lines
  ) {

    const a =
      points[line[0]];

    const b =
      points[line[1]];


    if (!a || !b) {
      continue;
    }


    cameraCtx.beginPath();

    cameraCtx.moveTo(
      a.x * cameraCanvas.width,
      a.y * cameraCanvas.height
    );

    cameraCtx.lineTo(
      b.x * cameraCanvas.width,
      b.y * cameraCanvas.height
    );

    cameraCtx.stroke();
  }


  for (
    const p of points
  ) {

    cameraCtx.beginPath();

    cameraCtx.arc(
      p.x * cameraCanvas.width,
      p.y * cameraCanvas.height,
      4,
      0,
      Math.PI * 2
    );

    cameraCtx.fill();
  }
}


// ==========================================
// CAMERA
// ==========================================

openCameraBtn.onclick =
  async function() {

    try {

      cameraStatus.textContent =
        "📷 Opening camera...";


      cameraStream =
        await navigator.mediaDevices.getUserMedia({

          video: {
            facingMode: "user",
            width: {
              ideal: 720
            },
            height: {
              ideal: 1280
            }
          },

          audio: true

        });


      camera.srcObject =
        cameraStream;


      await camera.play();


      cameraCanvas.width =
        camera.videoWidth;

      cameraCanvas.height =
        camera.videoHeight;


      cameraRunning =
        true;


      recordBtn.disabled =
        false;


      openCameraBtn.textContent =
        "🟢 Camera Active";


      cameraStatus.textContent =
        "🟢 Camera ready. Keep your complete body visible.";


      processCamera();


    }
    catch (error) {

      cameraStatus.innerHTML =
        "❌ Camera error<br><br>" +
        error.message;

    }

  };


// ==========================================
// CAMERA LOOP
// ==========================================

async function processCamera() {

  if (!cameraRunning) {
    return;
  }


  try {

    if (
      camera.readyState >= 2
    ) {

      await pose.send({
        image: camera
      });

    }

  }
  catch (error) {

    console.log(
      "Camera AI error:",
      error
    );

  }


  requestAnimationFrame(
    processCamera
  );
}


// ==========================================
// RECORDING
// ==========================================

recordBtn.onclick =
  function() {

    if (!cameraStream) {
      return;
    }


    if (!recording) {

      chunks = [];


      recorder =
        new MediaRecorder(
          cameraStream
        );


      recorder.ondataavailable =
        function(event) {

          if (
            event.data.size > 0
          ) {

            chunks.push(
              event.data
            );

          }

        };


      recorder.onstop =
        function() {

          const blob =
            new Blob(
              chunks,
              {
                type:
                  "video/webm"
              }
            );


          recordedVideo.src =
            URL.createObjectURL(
              blob
            );


          recordedVideo.style.display =
            "block";


          recordStatus.textContent =
            "✅ Recording ready.";

        };


      recorder.start();


      recording =
        true;


      recordBtn.textContent =
        "⏹ Stop Recording";


    }
    else {

      recorder.stop();

      recording =
        false;


      recordBtn.textContent =
        "🔴 Start Recording";

    }

  };


// ==========================================
// CHOOSE FILE
// ==========================================

videoFile.onchange =
  function() {

    const file =
      this.files[0];


    if (!file) {
      return;
    }


    fileVideo.src =
      URL.createObjectURL(
        file
      );


    fileVideo.style.display =
      "block";


    analyzeFileBtn.disabled =
      false;


    fileStatus.innerHTML =
      "✅ Video loaded.<br>" +
      file.name;

  };


// ==========================================
// FILE VIDEO ANALYSIS
// ==========================================

analyzeFileBtn.onclick =
  async function() {

    if (
      processingFile
    ) {
      return;
    }


    processingFile =
      true;


    analyzeFileBtn.disabled =
      true;


    const detector =
      new SkipDetector();


    fileCount.textContent =
      "0";


    try {

      fileVideo.pause();

      fileVideo.currentTime =
        0;


      await waitForVideo(
        fileVideo
      );


      const duration =
        fileVideo.duration;


      const step =
        0.08;


      let frames =
        0;


      fileStatus.innerHTML =
        "🤖 Analyzing video...";


      for (
        let time = 0;
        time < duration;
        time += step
      ) {

        await seekVideo(
          fileVideo,
          time
        );


        try {

          await pose.send({
            image: fileVideo
          });


          /*
           * pose.onResults handles
           * live camera only.
           *
           * For file processing we
           * call the detector directly
           * below instead.
           */

          const body =
            await detectFileFrame(
              fileVideo
            );


          if (body) {

            const value =
              movementSignal(body);


            detector.add(
              value,
              time
            );

          }


          frames++;


          fileCount.textContent =
            detector.count;


          const percent =
            Math.round(
              (time / duration) * 100
            );


          fileStatus.innerHTML =
            "🤖 AI analyzing...<br><br>" +
            "Progress: " +
            percent +
            "%<br>" +
            "Frames: " +
            frames +
            "<br>" +
            "Skips: " +
            detector.count;

        }
        catch (error) {

          console.log(
            "File frame error:",
            error
          );

        }

      }


      const detected =
        detector.count;


      fileCount.textContent =
        detected;


      /*
       * Do not add the same result
       * automatically to total.
       *
       * User can test repeatedly without
       * corrupting their total.
       */

      fileStatus.innerHTML =
        "✅ Analysis complete!<br><br>" +
        "🪢 Skips detected: " +
        detected +
        "<br>" +
        "Frames analyzed: " +
        frames;


    }
    catch (error) {

      fileStatus.innerHTML =
        "❌ Analysis error<br><br>" +
        error.message;

    }
    finally {

      processingFile =
        false;

      analyzeFileBtn.disabled =
        false;

    }

  };


// ==========================================
// FILE FRAME DETECTION
// ==========================================

async function detectFileFrame(
  videoElement
) {

  /*
   * MediaPipe's async send() returns
   * through onResults.
   *
   * We capture the next result.
   */

  return new Promise(
    function(resolve) {

      const oldHandler =
        pose.onResults;


      pose.onResults =
        function(results) {

          pose.onResults =
            oldHandler;


          if (
            !results.poseLandmarks
          ) {

            resolve(null);

            return;
          }


          resolve(
            getBodyValue(
              results
            )
          );

        };


      pose.send({
        image:
          videoElement
      });

    }
  );
}


// ==========================================
// WAIT VIDEO
// ==========================================

function waitForVideo(videoElement) {

  return new Promise(
    function(resolve, reject) {

      if (
        videoElement.readyState >= 2 &&
        isFinite(videoElement.duration)
      ) {

        resolve();

        return;
      }


      videoElement.onloadeddata =
        function() {

          resolve();

        };


      videoElement.onerror =
        function() {

          reject(
            new Error(
              "Video could not be loaded."
            )
          );

        };

    }
  );

}


// ==========================================
// SEEK VIDEO
// ==========================================

function seekVideo(
  videoElement,
  time
) {

  return new Promise(
    function(resolve) {

      function done() {

        videoElement.removeEventListener(
          "seeked",
          done
        );

        resolve();

      }


      videoElement.addEventListener(
        "seeked",
        done
      );


      videoElement.currentTime =
        Math.min(
          time,
          videoElement.duration - 0.01
        );

    }
  );

}