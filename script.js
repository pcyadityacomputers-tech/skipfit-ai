let skipCount = Number(localStorage.getItem("skipCount")) || 0;
let pushCount = Number(localStorage.getItem("pushCount")) || 0;

let detector = null;


/* ---------------------------
   SCREEN
---------------------------- */

function updateScreen() {

  document.getElementById("skipCount").textContent =
    skipCount.toLocaleString();

  document.getElementById("pushCount").textContent =
    pushCount.toLocaleString();

  document.getElementById("totalSkips").textContent =
    skipCount.toLocaleString();

  document.getElementById("totalPushups").textContent =
    pushCount.toLocaleString();

  document.getElementById("skipTask").textContent =
    skipCount.toLocaleString() + " / 1000";

  document.getElementById("pushTask").textContent =
    pushCount.toLocaleString() + " / 50";

  document.getElementById("skipProgress").style.width =
    Math.min(skipCount / 1000 * 100, 100) + "%";

  document.getElementById("pushProgress").style.width =
    Math.min(pushCount / 50 * 100, 100) + "%";
}


/* ---------------------------
   AI MODEL
---------------------------- */

async function loadAI() {

  if (detector) return detector;

  const statusElements = [
    document.getElementById("skipStatus"),
    document.getElementById("pushStatus")
  ];

  statusElements.forEach(el => {
    el.textContent = "Loading AI movement model...";
  });

  await tf.ready();

  detector = await poseDetection.createDetector(
    poseDetection.SupportedModels.MoveNet,
    {
      modelType:
        poseDetection.movenet.modelType.SINGLEPOSE_LIGHTNING
    }
  );

  statusElements.forEach(el => {
    el.textContent = "AI model ready.";
  });

  return detector;
}


/* ---------------------------
   VIDEO PREVIEW
---------------------------- */

function setupPreview(inputId, videoId) {

  const input = document.getElementById(inputId);
  const video = document.getElementById(videoId);

  input.addEventListener("change", () => {

    if (!input.files.length) return;

    const file = input.files[0];

    video.src = URL.createObjectURL(file);
    video.style.display = "block";
    video.load();
  });
}

setupPreview("skipVideo", "skipVideoPreview");
setupPreview("pushVideo", "pushVideoPreview");


/* ---------------------------
   KEYPOINT HELPERS
---------------------------- */

function getPoint(pose, name) {

  const point = pose.keypoints.find(
    p => p.name === name
  );

  if (!point || point.score < 0.3) {
    return null;
  }

  return point;
}


function averageY(points) {

  const valid = points.filter(Boolean);

  if (!valid.length) return null;

  return valid.reduce(
    (sum, p) => sum + p.y,
    0
  ) / valid.length;
}


/* ---------------------------
   SKIPPING ANALYSIS
---------------------------- */

async function analyzeSkipping() {

  const input = document.getElementById("skipVideo");
  const status = document.getElementById("skipStatus");
  const video = document.getElementById("skipVideoPreview");

  if (!input.files.length) {

    status.textContent =
      "Please choose a skipping video first.";

    return;
  }

  try {

    status.textContent =
      "Loading AI body-tracking model...";

    const model = await loadAI();

    status.textContent =
      "Analyzing your skipping movement...";

    await video.play();

    let samples = [];
    let frameCount = 0;

    while (!video.ended) {

      const poses = await model.estimatePoses(video);

      if (poses.length) {

        const pose = poses[0];

        const leftAnkle =
          getPoint(pose, "left_ankle");

        const rightAnkle =
          getPoint(pose, "right_ankle");

        const leftHip =
          getPoint(pose, "left_hip");

        const rightHip =
          getPoint(pose, "right_hip");

        const ankleY = averageY([
          leftAnkle,
          rightAnkle
        ]);

        const hipY = averageY([
          leftHip,
          rightHip
        ]);

        if (ankleY !== null && hipY !== null) {

          samples.push({
            ankle: ankleY,
            hip: hipY
          });

        }
      }

      frameCount++;

      video.currentTime += 0.10;

      if (video.currentTime >= video.duration) {
        break;
      }

      await new Promise(
        resolve => setTimeout(resolve, 15)
      );
    }

    video.pause();

    const detected =
      countSkippingCycles(samples);

    skipCount += detected;

    if (skipCount > 10000) {
      skipCount = 10000;
    }

    localStorage.setItem(
      "skipCount",
      skipCount
    );

    updateScreen();

    status.textContent =
      "Analysis complete. Estimated skips: " +
      detected;

  } catch (error) {

    console.error(error);

    status.textContent =
      "Could not analyze this video. Try a clearer full-body recording.";
  }
}


/* ---------------------------
   SKIP CYCLE DETECTOR
---------------------------- */

function countSkippingCycles(samples) {

  if (samples.length < 10) {
    return 0;
  }

  const signal = samples.map(
    s => s.ankle - s.hip
  );

  let smoothed = [];

  const windowSize = 3;

  for (let i = 0; i < signal.length; i++) {

    let total = 0;
    let count = 0;

    for (
      let j = Math.max(0, i - windowSize);
      j <= Math.min(signal.length - 1, i + windowSize);
      j++
    ) {

      total += signal[j];
      count++;
    }

    smoothed.push(total / count);
  }

  let jumps = 0;
  let rising = false;

  for (let i = 1; i < smoothed.length; i++) {

    const difference =
      smoothed[i] - smoothed[i - 1];

    if (difference < -2) {
      rising = true;
    }

    if (
      rising &&
      difference > 2
    ) {

      jumps++;
      rising = false;
    }
  }

  return Math.min(jumps, 10000);
}


/* ---------------------------
   PUSH-UP ANALYSIS
---------------------------- */

async function analyzePushups() {

  const input =
    document.getElementById("pushVideo");

  const status =
    document.getElementById("pushStatus");

  const video =
    document.getElementById("pushVideoPreview");

  if (!input.files.length) {

    status.textContent =
      "Please choose a push-up video first.";

    return;
  }

  try {

    status.textContent =
      "Loading AI body-tracking model...";

    const model = await loadAI();

    status.textContent =
      "Analyzing push-up movement...";

    await video.play();

    let samples = [];

    while (!video.ended) {

      const poses =
        await model.estimatePoses(video);

      if (poses.length) {

        const pose = poses[0];

        const shoulder =
          averageY([
            getPoint(pose, "left_shoulder"),
            getPoint(pose, "right_shoulder")
          ]);

        const hip =
          averageY([
            getPoint(pose, "left_hip"),
            getPoint(pose, "right_hip")
          ]);

        if (
          shoulder !== null &&
          hip !== null
        ) {

          samples.push({
            shoulder,
            hip
          });
        }
      }

      video.currentTime += 0.10;

      if (video.currentTime >= video.duration) {
        break;
      }

      await new Promise(
        resolve => setTimeout(resolve, 15)
      );
    }

    video.pause();

    const detected =
      countPushupCycles(samples);

    pushCount += detected;

    if (pushCount > 10000) {
      pushCount = 10000;
    }

    localStorage.setItem(
      "pushCount",
      pushCount
    );

    updateScreen();

    status.textContent =
      "Analysis complete. Estimated push-ups: " +
      detected;

  } catch (error) {

    console.error(error);

    status.textContent =
      "Could not analyze this video. Try a clear side-view recording.";
  }
}


/* ---------------------------
   PUSH-UP CYCLE DETECTOR
---------------------------- */

function countPushupCycles(samples) {

  if (samples.length < 10) {
    return 0;
  }

  const signal = samples.map(
    s => s.shoulder - s.hip
  );

  let down = false;
  let count = 0;

  for (let i = 1; i < signal.length; i++) {

    const change =
      signal[i] - signal[i - 1];

    if (change > 1.5) {
      down = true;
    }

    if (
      down &&
      change < -1.5
    ) {

      count++;
      down = false;
    }
  }

  return Math.min(count, 10000);
}


/* ---------------------------
   START
---------------------------- */

updateScreen();