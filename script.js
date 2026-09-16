let skipCount = Number(localStorage.getItem("skipCount")) || 0;
let pushCount = Number(localStorage.getItem("pushCount")) || 0;

let skipVideo = document.getElementById("skipVideo");
let pushVideo = document.getElementById("pushVideo");

const skipPreview = document.getElementById("skipVideoPreview");
const pushPreview = document.getElementById("pushVideoPreview");

const skipStatus = document.getElementById("skipStatus");
const pushStatus = document.getElementById("pushStatus");


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


/* VIDEO PREVIEW */

skipVideo.addEventListener("change", function () {

    if (!this.files || !this.files[0]) {
        skipStatus.textContent = "No video selected.";
        return;
    }

    const file = this.files[0];

    skipPreview.src = URL.createObjectURL(file);
    skipPreview.style.display = "block";

    skipStatus.textContent =
        "Video selected: " + file.name;
});


pushVideo.addEventListener("change", function () {

    if (!this.files || !this.files[0]) {
        pushStatus.textContent = "No video selected.";
        return;
    }

    const file = this.files[0];

    pushPreview.src = URL.createObjectURL(file);
    pushPreview.style.display = "block";

    pushStatus.textContent =
        "Video selected: " + file.name;
});


/* SKIPPING ANALYSIS */

async function analyzeSkipping() {

    if (!skipVideo.files || !skipVideo.files[0]) {

        skipStatus.textContent =
            "❌ Please choose a video first.";

        return;
    }

    skipStatus.textContent =
        "⏳ Preparing video for AI analysis...";

    const video = skipPreview;

    try {

        await video.play();

        skipStatus.textContent =
            "🧠 Tracking body movement...";

        /*
        V2.1 diagnostic mode.

        We first measure the video correctly.
        The actual pose model will be connected
        after this pipeline is confirmed working.
        */

        const duration = video.duration;

        video.pause();

        if (!duration || !isFinite(duration)) {

            skipStatus.textContent =
                "❌ Video duration could not be read.";

            return;
        }

        skipStatus.textContent =
            "✅ Video loaded successfully. Duration: " +
            duration.toFixed(1) +
            " seconds. Ready for body-tracking AI.";

    } catch (error) {

        console.error(error);

        skipStatus.textContent =
            "❌ Video could not be analyzed. Try another MP4 video.";
    }
}


/* PUSH-UP ANALYSIS */

async function analyzePushups() {

    if (!pushVideo.files || !pushVideo.files[0]) {

        pushStatus.textContent =
            "❌ Please choose a video first.";

        return;
    }

    pushStatus.textContent =
        "⏳ Preparing push-up video...";

    const video = pushPreview;

    try {

        await video.play();

        pushStatus.textContent =
            "🧠 Preparing body-movement tracking...";

        const duration = video.duration;

        video.pause();

        if (!duration || !isFinite(duration)) {

            pushStatus.textContent =
                "❌ Video duration could not be read.";

            return;
        }

        pushStatus.textContent =
            "✅ Video loaded successfully. Duration: " +
            duration.toFixed(1) +
            " seconds. Ready for body-tracking AI.";

    } catch (error) {

        console.error(error);

        pushStatus.textContent =
            "❌ Video could not be analyzed.";
    }
}


updateScreen();