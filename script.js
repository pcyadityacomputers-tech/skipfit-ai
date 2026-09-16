const skipVideo = document.getElementById("skipVideo");
const skipPreview = document.getElementById("skipVideoPreview");
const skipStatus = document.getElementById("skipStatus");

let skipCount = Number(localStorage.getItem("skipCount") || 0);

function updateScreen() {
    const counter = document.getElementById("skipCount");
    const total = document.getElementById("totalSkips");

    if (counter) counter.textContent = skipCount;
    if (total) total.textContent = skipCount;
}

updateScreen();

if (skipVideo) {
    skipVideo.addEventListener("change", function () {

        const file = this.files[0];

        if (!file) return;

        skipPreview.src = URL.createObjectURL(file);
        skipPreview.style.display = "block";

        skipStatus.textContent =
            "Video selected: " + file.name;
    });
}

async function analyzeSkipping() {

    if (!skipVideo.files.length) {
        skipStatus.textContent =
            "Please choose a video first.";
        return;
    }

    const video = skipPreview;

    try {

        if (video.readyState < 1) {
            await new Promise(function(resolve) {
                video.addEventListener(
                    "loadedmetadata",
                    resolve,
                    { once: true }
                );
            });
        }

        skipStatus.innerHTML =
            "Video loaded successfully.<br>" +
            "Duration: " +
            video.duration.toFixed(1) +
            " seconds.<br><br>" +
            "Frame-by-frame system is ready.";

    } catch (error) {

        skipStatus.innerHTML =
            "AI ERROR: " +
            error.message;
    }
}