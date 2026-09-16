// ==========================================
// SKIPFIT AI V3.1
// FRAME-BY-FRAME SKIPPING COUNTER
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
// UPDATE SCREEN
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

        if (!file) {
            return;
        }

        video.src = URL.createObjectURL(file);

        video.muted = true;
        video.playsInline = true;

        video.style.display = "block";

        statusBox.innerHTML =
            "✅ Video selected<br>" +
            file.name;
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
            "TensorFlow.js is missing."
        );
    }

    if (!window.poseDetection) {

        throw new Error(
            "MoveNet library is missing."
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
// MAIN ANALYSIS
// ==========================================

async function analyzeSkipping() {

    if (analyzing) {
        return;
    }

    if (
        !videoInput ||
        !videoInput.files ||
        !videoInput.files.length
    ) {

        statusBox.textContent =
            "❌ Select a skipping video first.";

        return;
    }

    analyzing = true;

    try {

        const ai =
            await loadMoveNet();

        statusBox.innerHTML =
            "🤖 AI loaded.<br>" +
            "Preparing video...";

        await waitForVideo();

        if (
            !video.duration ||
            !isFinite(video.duration)
        ) {

            throw new Error(
                "Video duration unavailable."
            );
        }

        video.pause();
        video.currentTime = 0;

        await waitForSeek();

        // ==================================
        // VARIABLES
        // ==================================

        let previousPosition = null;

        let previousTime = 0;

        let direction = 0;

        let upwardMovement = false;

        let videoSkips = 0;

        let frames = 0;

        let detectedFrames = 0;

        const duration =
            video.duration;

        // Process approximately 10 frames/sec.
        const frameStep = 0.10;


        // ==================================
        // PROCESS VIDEO FRAME BY FRAME
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

                    updateProgress(
                        time,
                        duration,
                        frames,
                        detectedFrames,
                        videoSkips
                    );

                    continue;
                }

                const pose =
                    poses[0];


                // ==============================
                // GET KEYPOINTS
                // ==============================

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


                // ==============================
                // BODY CENTER
                // ==============================

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


                /*
                 * IMPORTANT:
                 *
                 * Use shoulder-to-hip as the
                 * normalization distance.
                 *
                 * We DO NOT divide ankle-to-hip
                 * by itself.
                 */

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


                // Feet position relative to hips
                const relativePosition =
                    (ankleY - hipY) /
                    bodyScale;


                // ==============================
                // MOVEMENT DETECTION
                // ==============================

                if (
                    previousPosition !== null
                ) {

                    const movement =
                        relativePosition -
                        previousPosition;


                    /*
                     * Video coordinates:
                     *
                     * smaller Y = higher
                     * larger Y = lower
                     *
                     * Therefore negative movement
                     * means feet moving upward.
                     */


                    // UP
                    if (
                        movement < -0.08 &&
                        direction !== -1
                    ) {

                        direction = -1;

                        upwardMovement = true;
                    }


                    // DOWN
                    if (
                        movement > 0.08 &&
                        upwardMovement &&
                        direction !== 1
                    ) {

                        direction = 1;


                        /*
                         * Complete jump:
                         * UP → DOWN
                         */

                        if (
                            time - previousTime >
                            0.25
                        ) {

                            videoSkips++;

                            previousTime =
                                time;
                        }

                        upwardMovement = false;
                    }
                }


                previousPosition =
                    relativePosition;


                updateProgress(
                    time,
                    duration,
                    frames,
                    detectedFrames,
                    videoSkips
                );


            } catch (error) {

                console.log(
                    "Pose frame error:",
                    error
                );
            }
        }


        // ==================================
        // SAVE RESULT
        // ==================================

        totalSkips += videoSkips;

        localStorage.setItem(
            "skipCount",
            totalSkips
        );

        updateUI();


        statusBox.innerHTML =
            "✅ AI analysis finished!<br><br>" +

            "Frames analyzed: " +
            frames +
            "<br>" +

            "Body detected: " +
            detectedFrames +
            "<br>" +

            "Skips detected in this video: " +
            videoSkips +
            "<br><br>" +

            "Total SkipFit skips: " +
            totalSkips;


    } catch (error) {

        console.error(
            "SkipFit V3.1 ERROR:",
            error
        );

        statusBox.innerHTML =
            "❌ AI ERROR<br><br>" +
            error.message;

    } finally {

        analyzing = false;
    }
}


// ==========================================
// KEYPOINT
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
                "loadeddata",
                loaded,
                { once: true }
            );

            video.addEventListener(
                "error",
                failed,
                { once: true }
            );
        }
    );
}


// ==========================================
// SEEK READY
// ==========================================

function waitForSeek() {

    return new Promise(function (resolve) {

        if (
            Math.abs(
                video.currentTime
            ) < 0.05
        ) {

            resolve();
            return;
        }

        video.addEventListener(
            "seeked",
            resolve,
            { once: true }
        );
    });
}


// ==========================================
// PROGRESS
// ==========================================

function updateProgress(
    current,
    duration,
    frames,
    detected,
    skips
) {

    const percent =
        Math.round(
            (current / duration) * 100
        );

    statusBox.innerHTML =
        "🤖 AI analyzing frame-by-frame...<br><br>" +

        "Progress: " +
        percent +
        "%<br>" +

        "Frames analyzed: " +
        frames +
        "<br>" +

        "Body detected: " +
        detected +
        "<br>" +

        "Skips detected: " +
        skips;
}