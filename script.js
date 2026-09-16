// SkipFit AI V2.2
// Body-movement skipping counter

const skipVideo = document.getElementById("skipVideo");
const pushVideo = document.getElementById("pushVideo");

const skipPreview = document.getElementById("skipVideoPreview");
const pushPreview = document.getElementById("pushVideoPreview");

const skipStatus = document.getElementById("skipStatus");
const pushStatus = document.getElementById("pushStatus");

const skipCountEl = document.getElementById("skipCount");
const pushCountEl = document.getElementById("pushCount");

const totalSkipsEl = document.getElementById("totalSkips");
const totalPushupsEl = document.getElementById("totalPushups");

const skipTask = document.getElementById("skipTask");
const pushTask = document.getElementById("pushTask");

const skipProgress = document.getElementById("skipProgress");
const pushProgress = document.getElementById("pushProgress");

let skipCount = Number(localStorage.getItem("skipCount") || 0);
let pushCount = Number(localStorage.getItem("pushCount") || 0);

function updateScreen() {
    if (skipCountEl) skipCountEl.textContent = skipCount;
    if (pushCountEl) pushCountEl.textContent = pushCount;

    if (totalSkipsEl) totalSkipsEl.textContent = skipCount;
    if (totalPushupsEl) totalPushupsEl.textContent = pushCount;

    if (skipTask) skipTask.textContent = `${Math.min(skipCount, 1000)}/1000`;
    if (pushTask) pushTask.textContent = `${Math.min(pushCount, 50)}/50`;

    if (skipProgress) {
        skipProgress.style.width =
            Math.min((skipCount / 1000) * 100, 100) + "%";
    }

    if (pushProgress) {
        pushProgress.style.width =
            Math.min((pushCount / 50) * 100, 100) + "%";
    }
}

updateScreen();


// -----------------------------
// VIDEO PREVIEW
// -----------------------------

if (skipVideo) {
    skipVideo.addEventListener("change", function () {
        const file = this.files[0];

        if (!file) return;

        skipPreview.src = URL.createObjectURL(file);
        skipPreview.style.display = "block";

        skipStatus.textContent =
            "Video selected. Tap Analyze Skipping Video.";
    });
}

if (pushVideo) {
    pushVideo.addEventListener("change", function () {
        const file = this.files[0];

        if (!file) return;

        pushPreview.src = URL.createObjectURL(file);
        pushPreview.style.display = "block";

       