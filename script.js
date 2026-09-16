let skipCount = Number(localStorage.getItem("skipCount")) || 0;
let pushCount = Number(localStorage.getItem("pushCount")) || 0;

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

  let skipPercent = Math.min((skipCount / 1000) * 100, 100);
  let pushPercent = Math.min((pushCount / 50) * 100, 100);

  document.getElementById("skipProgress").style.width =
    skipPercent + "%";

  document.getElementById("pushProgress").style.width =
    pushPercent + "%";
}


function addSkip() {

  if (skipCount < 10000) {
    skipCount++;
  }

  localStorage.setItem("skipCount", skipCount);
  updateScreen();
}


function resetSkip() {

  skipCount = 0;

  localStorage.setItem("skipCount", skipCount);
  updateScreen();
}


function addPush() {

  if (pushCount < 10000) {
    pushCount++;
  }

  localStorage.setItem("pushCount", pushCount);
  updateScreen();
}


function resetPush() {

  pushCount = 0;

  localStorage.setItem("pushCount", pushCount);
  updateScreen();
}


function analyzeVideo() {

  const video = document.getElementById("skipVideo");
  const status = document.getElementById("videoStatus");

  if (!video.files.length) {
    status.textContent = "Please select a skipping video first.";
    return;
  }

  status.textContent =
    "Video loaded. AI body-movement analysis will be added in the next version.";
}


function analyzePushVideo() {

  const video = document.getElementById("pushVideo");
  const status = document.getElementById("pushStatus");

  if (!video.files.length) {
    status.textContent = "Please select a push-up video first.";
    return;
  }

  status.textContent =
    "Video loaded. AI body-movement analysis will be added in the next version.";
}


updateScreen();