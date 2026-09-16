// ==========================================
// SKIPFIT AI V4
// REAL SKIPPING MOVEMENT COUNTER
// ==========================================

const videoInput = document.getElementById("skipVideo");
const video = document.getElementById("skipVideoPreview");
const statusBox = document.getElementById("skipStatus");

const countBox = document.getElementById("skipCount");
const totalBox = document.getElementById("totalSkips");
const taskBox = document.getElementById("skipTask");
const progressBar = document.getElementById("skipProgress");

let detector = null;
let analyzing = false;

let totalSkips =
    Number(localStorage.getItem("skipCount") || 0);


// ==========================================
// UI
// ==========================================

function updateUI() {

    if (countBox) {
        countBox.textContent = totalSkips;
    }

    if (totalBox) {
        totalBox.textContent = totalSkips;
    }

    if (taskBox) {
        taskBox.textContent =
            Math.min(totalSkips, 1000) + " / 1000";
    }

    if (progressBar) {
        progressBar.style.width =
            Math.min(totalSkips / 10, 100) + "%";
    }
}

updateUI();


// ==========================================
// VIDEO SELECT
// ==========================================

if (videoInput) {

    videoInput.addEventListener("change", function () {

        const file = this.files[0];

        if (!file) return;

        video.src = URL.createObjectURL(file);

        video.muted = true;
        video.playsInline = true;
        video.style.display = "block";

        video.onloadedmetadata = function () {

            statusBox.innerHTML =
                "✅ Video loaded successfully.<br><br>" +
                "Duration: " +
                video.duration.toFixed(1) +
                " seconds.<br><br>" +
                "Ready for AI skipping analysis.";
        };
    });
}


// ==========================================
// LOAD MOVENET
// ==========================================

async function loadMoveNet() {

    if (detector) {
        return detector;
    }

    statusBox.innerHTML =
        "🤖 Loading MoveNet AI...";

    if (!window.tf) {
        throw new Error(
            "TensorFlow.js did not load."
        );
    }

    if (!window.poseDetection) {
        throw new Error(
            "MoveNet library did not load."
        );
    }

    await tf.ready();

    detector =
        await poseDetection.createDetector(
            poseDetection.SupportedModels.MoveNet,
            {
                modelType:
                    poseDetection.movenet.modelType.SINGLEPOSE_LIGHTNING
            }
        );

    return detector;
}


// ==========================================
// MAIN COUNTER
// ==========================================

async function analyzeSkipping() {

    if (analyzing) return;

    if (
        !videoInput ||
        !videoInput.files ||
        !videoInput.files.length
    ) {

        statusBox.innerHTML =
            "❌ Select a skipping video first.";

        return;
    }

    analyzing = true;

    try {

        const ai = await loadMoveNet();

        statusBox.innerHTML =
            "🤖 AI loaded.<br><br>" +
            "Preparing video...";

        await waitForVideo();

        video.pause();

        video.currentTime = 0;

        await waitForSeek();


        // ==================================
        // MOVEMENT DATA
        // ==================================

        let samples = [];

        let frames = 0;
        let detectedFrames = 0;

        const duration = video.duration;

        // Analyze about 8 frames per second.
        const frameStep = 0.12;


        // ==================================
        // ANALYZE VIDEO
        // ==================================

        for (
            let time = 0;
            time < duration;
            time += frameStep
        ) {

            await seekTo(time);

            frames++;

            try {

                const poses =
                    await ai.estimatePoses(video);

                if (
                    !poses ||
                    poses.length === 0
                ) {
                    continue;
                }

                const pose = poses[0];

                const leftAnkle =
                    getPoint(
                        pose,
                        "left_ankle"
                    );

                const rightAnkle =
                    getPoint(
                        pose,
                        "right_ankle"
                    );

                const leftHip =
                    getPoint(
                        pose,
                        "left_hip"
                    );

                const rightHip =
                    getPoint(
                        pose,
                        "right_hip"
                    );

                const leftShoulder =
                    getPoint(
                        pose,
                        "left_shoulder"
                    );

                const rightShoulder =
                    getPoint(
                        pose,
                        "right_shoulder"
                    );

                if (
                    !leftAnkle ||
                    !rightAnkle ||
                    !leftHip ||
                    !rightHip
                ) {
                    continue;
                }

                detectedFrames++;


                // ==================================
                // BODY POSITION
                // ==================================

                const ankleY =
                    (
                        leftAnkle.y +
                        rightAnkle.y
                    ) / 2;

                const hipY =
                    (
                        leftHip.y +
                        rightHip.y
                    ) / 2;

                let bodyScale = 100;

                if (
                    leftShoulder &&
                    rightShoulder
                ) {

                    const shoulderY =
                        (
                            leftShoulder.y +
                            rightShoulder.y
                        ) / 2;

                    bodyScale =
                        Math.max(
                            Math.abs(
                                hipY -
                                shoulderY
                            ),
                            20
                        );
                }


                // Normalize ankle movement
                const position =
                    (ankleY - hipY) /
                    bodyScale;


                samples.push({
                    time: time,
                    position: position
                });


                // ==================================
                // LIVE STATUS
                // ==================================

                const percent =
                    Math.round(
                        (time / duration) * 100
                    );

                statusBox.innerHTML =
                    "🤖 AI analyzing...<br><br>" +
                    "Progress: " +
                    percent +
                    "%<br>" +
                    "Frames: " +
                    frames +
                    "<br>" +
                    "Body detected: " +
                    detectedFrames;
            }
            catch (error) {

                console.log(
                    "Frame error:",
                    error
                );
            }
        }


        // ==================================
        // SMOOTH MOVEMENT
        // ==================================

        const positions =
            samples.map(
                function (item) {
                    return item.position;
                }
            );


        if (positions.length < 10) {

            throw new Error(
                "Not enough body movement detected."
            );
        }


        // ==================================
        // SMOOTH DATA
        // ==================================

        const smooth = [];

        const windowSize = 3;

        for (
            let i = 0;
            i < positions.length;
            i++
        ) {

            let sum = 0;
            let count = 0;

            for (
                let j = -windowSize;
                j <= windowSize;
                j++
            ) {

                const index = i + j;

                if (
                    index >= 0 &&
                    index < positions.length
                ) {

                    sum += positions[index];
                    count++;
                }
            }

            smooth.push(
                sum / count
            );
        }


        // ==================================
        // FIND LOCAL PEAKS
        // ==================================

        let jumps = 0;

        let lastJumpTime = -10;

        const minJumpInterval = 0.28;

        for (
            let i = 2;
            i < smooth.length - 2;
            i++
        ) {

            const current =
                smooth[i];

            const previous =
                smooth[i - 1];

            const next =
                smooth[i + 1];


            /*
             * A jump produces a higher
             * foot position followed by
             * a lower position.
             *
             * Because screen Y increases
             * downward, the highest point
             * has the smallest value.
             */

            const isTop =
                current < previous &&
                current <= next;


            if (!isTop) {
                continue;
            }


            // Local movement size
            const leftDifference =
                previous - current;

            const rightDifference =
                next - current;

            const movement =
                leftDifference +
                rightDifference;


            /*
             * Threshold prevents tiny
             * tracking noise from becoming
             * a skip.
             */

            if (movement < 0.025) {
                continue;
            }


            const currentTime =
                samples[i].time;


            // Prevent double counting
            if (
                currentTime -
                lastJumpTime <
                minJumpInterval
            ) {
                continue;
            }


            jumps++;

            lastJumpTime =
                currentTime;
        }


        // ==================================
        // RESULT
        // ==================================

        totalSkips += jumps;

        localStorage.setItem(
            "skipCount",
            totalSkips
        );

        updateUI();


        statusBox.innerHTML =
            "✅ AI ANALYSIS COMPLETE!<br><br>" +

            "Frames analyzed: " +
            frames +
            "<br>" +

            "Body detected: " +
            detectedFrames +
            "<br><br>" +

            "🪢 Skips detected: " +
            jumps +
            "<br><br>" +

            "Total SkipFit skips: " +
            totalSkips;


    }
    catch (error) {

        console.error(
            "SkipFit V4 ERROR:",
            error
        );

        statusBox.innerHTML =
            "❌ AI ERROR<br><br>" +
            error.message;
    }
    finally {

        analyzing = false;
    }
}


// ==========================================
// GET KEYPOINT
// ==========================================

function getPoint(pose, name) {

    if (
        !pose ||
        !pose.keypoints
    ) {
        return null;
    }

    const point =
        pose.keypoints.find(
            function (p) {
                return p.name === name;
            }
        );

    if (!point) {
        return null;
    }

    if (
        typeof point.score === "number" &&
        point.score < 0.30
    ) {
        return null;
    }

    return point;
}


// ==========================================
// SEEK
// ==========================================

function seekTo(time) {

    return new Promise(function (resolve) {

        function finished() {

            video.removeEventListener(
                "seeked",
                finished
            );

            resolve();
        }

        video.addEventListener(
            "seeked",
            finished
        );

        video.currentTime =
            Math.min(
                time,
                Math.max(
                    0,
                    video.duration - 0.01
                )
            );
    });
}


// ==========================================
// VIDEO READY
// ==========================================

function waitForVideo() {

    return new Promise(
        function (resolve, reject) {

            if (
                video.readyState >= 2 &&
                video.duration
            ) {

                resolve();
                return;
            }

            function loaded() {
                resolve();
            }

            function failed() {

                reject(
                    new Error(
                        "Video could not be loaded."
                    )
                );
            }

            video.addEventListener(
                "loaded