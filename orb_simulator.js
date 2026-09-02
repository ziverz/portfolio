(() => {
    const stage = document.getElementById('orb-stage');
    const launchOverlay = document.getElementById('launch-overlay');
    const launchButton = document.getElementById('launch-orb');
    const resetButton = document.getElementById('reset-orb');
    const status = document.getElementById('live-status');
    const mode = document.getElementById('orb-mode');
    const finishOverlay = document.getElementById('finish-overlay');
    const finishTime = document.getElementById('finish-time');
    const scoreForm = document.getElementById('score-form');
    const playerName = document.getElementById('player-name');
    const saveScore = document.getElementById('save-score');
    const scoreMessage = document.getElementById('score-message');
    const playAgain = document.getElementById('play-again');
    const leaderboardList = document.getElementById('leaderboard-list');
    const wheelLabels = [
        document.getElementById('wheel-a'),
        document.getElementById('wheel-b'),
        document.getElementById('wheel-c')
    ];
    const controlButtons = [...document.querySelectorAll('[data-control]')];
    const courseProgress = document.getElementById('course-progress');
    const heartBonusLabel = document.getElementById('heart-bonus');
    const courseTime = document.getElementById('course-time');

    if (!window.THREE) {
        status.textContent = 'The virtual ORB could not load. It is probably hiding under a couch.';
        return;
    }

    const { THREE } = window;
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(36, 1, 0.1, 100);
    camera.position.set(20, 16.5, 22);
    camera.lookAt(0, 0, 0);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    stage.prepend(renderer.domElement);

    scene.add(new THREE.HemisphereLight(0xfff7e9, 0x534234, 2.3));
    const keyLight = new THREE.DirectionalLight(0xffe4b0, 3.6);
    keyLight.position.set(5, 8, 5);
    keyLight.castShadow = true;
    scene.add(keyLight);
    const fillLight = new THREE.PointLight(0x4fa89b, 2.2, 18);
    fillLight.position.set(-4, 3, -3);
    scene.add(fillLight);

    const floor = new THREE.Mesh(
        new THREE.CircleGeometry(18.5, 96),
        new THREE.MeshStandardMaterial({ color: 0xcdbb9d, roughness: 0.96 })
    );
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    scene.add(floor);

    const grid = new THREE.GridHelper(35, 70, 0x9a7355, 0xb99e7c);
    grid.position.y = 0.012;
    grid.material.transparent = true;
    grid.material.opacity = 0.38;
    scene.add(grid);

    const course = new THREE.Group();
    // The ORB is a 3.36-unit ball, so this course is deliberately built at
    // full robot scale rather than at tiny tabletop-prop scale.
    const courseScale = 2;
    course.scale.setScalar(courseScale);
    scene.add(course);
    const obstacleColliders = [];
    const checkpoints = [];
    const movingHazards = [];
    const heartPickups = [];
    const boundary = 7.15 * courseScale;
    // A forgiving driving hitbox keeps the visual gaps playable on a phone or keyboard.
    const orbRadius = 0.38;
    const checkpointMaterial = new THREE.MeshStandardMaterial({ color: 0xe2a83b, emissive: 0x8a4d00, emissiveIntensity: 0.5, roughness: 0.42 });
    const collectedMaterial = new THREE.MeshStandardMaterial({ color: 0x5cc9a7, emissive: 0x1f9b73, emissiveIntensity: 1.25, roughness: 0.3 });

    function addBarrier(x, z, width, depth, height = 0.62) {
        const barrier = new THREE.Group();
        const body = new THREE.Mesh(
            new THREE.BoxGeometry(width, height, depth),
            new THREE.MeshStandardMaterial({ color: 0xa96f43, roughness: 0.72 })
        );
        body.position.y = height / 2;
        body.castShadow = true;
        body.receiveShadow = true;
        barrier.add(body);
        const stripe = new THREE.Mesh(
            new THREE.BoxGeometry(width + 0.02, 0.1, depth + 0.025),
            new THREE.MeshStandardMaterial({ color: 0xf1c65c, roughness: 0.55 })
        );
        stripe.position.y = height * 0.72;
        barrier.add(stripe);
        barrier.position.set(x, 0, z);
        course.add(barrier);
        obstacleColliders.push({ type: 'box', x: x * courseScale, z: z * courseScale, width: width * courseScale, depth: depth * courseScale });
    }

    function addCone(x, z) {
        const cone = new THREE.Group();
        const base = new THREE.Mesh(new THREE.CylinderGeometry(0.27, 0.31, 0.08, 16), new THREE.MeshStandardMaterial({ color: 0xd65a31, roughness: 0.58 }));
        base.position.y = 0.04;
        const top = new THREE.Mesh(new THREE.ConeGeometry(0.18, 0.55, 18), new THREE.MeshStandardMaterial({ color: 0xe77533, roughness: 0.5 }));
        top.position.y = 0.33;
        const band = new THREE.Mesh(new THREE.CylinderGeometry(0.145, 0.165, 0.09, 18), new THREE.MeshStandardMaterial({ color: 0xf8eee0, roughness: 0.55 }));
        band.position.y = 0.37;
        cone.add(base, top, band);
        cone.position.set(x, 0, z);
        course.add(cone);
        obstacleColliders.push({ type: 'circle', x: x * courseScale, z: z * courseScale, radius: 0.3 * courseScale });
    }

    function addCheckpoint(x, z, number) {
        const checkpoint = new THREE.Group();
        const ring = new THREE.Mesh(new THREE.TorusGeometry(0.9, 0.09, 10, 36), checkpointMaterial.clone());
        ring.rotation.x = -Math.PI / 2;
        ring.position.y = 0.09;
        ring.castShadow = true;
        checkpoint.add(ring);
        const marker = new THREE.Mesh(
            new THREE.CircleGeometry(0.62, 24),
            new THREE.MeshBasicMaterial({ color: 0xf3c96a, transparent: true, opacity: 0.3, side: THREE.DoubleSide })
        );
        marker.rotation.x = -Math.PI / 2;
        marker.position.y = 0.025;
        checkpoint.add(marker);
        checkpoint.position.set(x, 0, z);
        course.add(checkpoint);
        checkpoints.push({ checkpoint, ring, marker, x: x * courseScale, z: z * courseScale, number, collected: false });
    }

    function addFinishGate(x, z) {
        const gate = new THREE.Group();
        const green = new THREE.MeshStandardMaterial({ color: 0x2d8b68, emissive: 0x0d482f, emissiveIntensity: 0.5, roughness: 0.43 });
        [-1.1, 1.1].forEach((offset) => {
            const post = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.13, 1.35, 14), green);
            post.position.set(offset, 0.675, 0);
            post.castShadow = true;
            gate.add(post);
        });
        const beam = new THREE.Mesh(new THREE.BoxGeometry(2.55, 0.25, 0.24), green);
        beam.position.y = 1.3;
        gate.add(beam);
        const finishGlow = new THREE.PointLight(0x58d6a3, 1.4, 4);
        finishGlow.position.y = 1.05;
        gate.add(finishGlow);
        gate.position.set(x, 0, z);
        course.add(gate);
    }

    function addMovingBumper(x, z, axis, travel, speed, phase) {
        const bumper = new THREE.Group();
        const red = new THREE.MeshStandardMaterial({ color: 0xc84c48, emissive: 0x5f1314, emissiveIntensity: 0.55, roughness: 0.45 });
        const warning = new THREE.MeshStandardMaterial({ color: 0xf3c453, emissive: 0x7d4b00, emissiveIntensity: 0.35, roughness: 0.42 });
        const base = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.36, 0.18, 18), red);
        base.position.y = 0.1;
        const body = new THREE.Mesh(new THREE.SphereGeometry(0.32, 20, 14), red);
        body.position.y = 0.42;
        const band = new THREE.Mesh(new THREE.TorusGeometry(0.24, 0.055, 8, 20), warning);
        band.rotation.x = Math.PI / 2;
        band.position.y = 0.42;
        const antenna = new THREE.Mesh(new THREE.ConeGeometry(0.1, 0.3, 12), warning);
        antenna.position.y = 0.86;
        bumper.add(base, body, band, antenna);
        const glow = new THREE.PointLight(0xff5b55, 0.9, 2.5);
        glow.position.y = 0.6;
        bumper.add(glow);
        bumper.position.set(x, 0, z);
        course.add(bumper);
        movingHazards.push({ bumper, x, z, axis, travel, speed, phase, radius: 0.42 * courseScale });
    }

    function addHeart(x, z) {
        const heart = new THREE.Group();
        const pink = new THREE.MeshStandardMaterial({ color: 0xe66486, emissive: 0x81223f, emissiveIntensity: 0.55, roughness: 0.38 });
        const leftLobe = new THREE.Mesh(new THREE.SphereGeometry(0.23, 18, 14), pink);
        leftLobe.position.set(-0.19, 0.56, 0);
        const rightLobe = leftLobe.clone();
        rightLobe.position.x = 0.19;
        const point = new THREE.Mesh(new THREE.ConeGeometry(0.38, 0.62, 4), pink);
        point.rotation.z = Math.PI;
        point.position.y = 0.3;
        heart.add(leftLobe, rightLobe, point);
        const glow = new THREE.PointLight(0xff7fa3, 0.7, 2.2);
        glow.position.y = 0.48;
        heart.add(glow);
        heart.position.set(x, 0.1, z);
        course.add(heart);
        heartPickups.push({ heart, x: x * courseScale, z: z * courseScale, collected: false, phase: x + z });
    }

    // A small, intentionally overbuilt training course for a tiny, very determined robot.
    addBarrier(-4.8, -5.25, 3.3, 0.28);
    addBarrier(-0.4, -5.25, 3.8, 0.28);
    addBarrier(4.8, -5.15, 2.7, 0.28);
    addBarrier(-5.55, -1.25, 0.35, 3.2);
    addBarrier(1.05, -1.05, 2.55, 0.3);
    addBarrier(4.45, 0.55, 0.3, 2.75);
    addBarrier(-1.85, 3.15, 3.2, 0.3);
    addBarrier(2.55, 4.3, 2.4, 0.3);
    addCone(-2.8, -2.35);
    addCone(-1.7, -3.15);
    addCone(-0.6, -2.3);
    addCone(2.6, -3.7);
    addCone(3.45, -2.85);
    addCone(2.55, -2.0);
    addCone(-3.75, 1.35);
    addCone(-2.95, 2.1);
    addCone(0.55, 1.45);
    addCone(1.45, 2.25);
    addBarrier(-3.45, 0.95, 0.3, 1.55);
    addBarrier(-4.25, 2.7, 1.35, 0.28);
    addBarrier(0.9, 2.0, 1.45, 0.28);
    addBarrier(2.5, 1.1, 0.28, 1.35);
    addMovingBumper(-2.1, -0.25, 'x', 1.5, 0.0013, 0.2);
    addMovingBumper(1.15, -3.55, 'z', 0.95, 0.0017, 1.9);
    addMovingBumper(3.35, 1.55, 'x', 0.85, 0.0021, 3.5);
    addHeart(-4.1, -0.75);
    addHeart(0.35, -4.25);
    addHeart(3.75, 3.45);
    addCheckpoint(-3.7, -3.7, 1);
    addCheckpoint(2.55, -3.0, 2);
    addCheckpoint(3.1, 2.55, 3);
    addFinishGate(-4.9, 4.85);

    const orbRoot = new THREE.Group();
    // Keep the complete ORB exactly half-size while still resting on the course floor.
    orbRoot.scale.setScalar(0.5);
    orbRoot.position.y = 0.84;
    scene.add(orbRoot);

    const shell = new THREE.Group();
    orbRoot.add(shell);
    const shellMaterial = new THREE.MeshPhysicalMaterial({
        color: 0xd8f1ee,
        transparent: true,
        opacity: 0.2,
        roughness: 0.08,
        metalness: 0.02,
        transmission: 0.18,
        depthWrite: false
    });
    const shellSphere = new THREE.Mesh(new THREE.SphereGeometry(1.68, 64, 40), shellMaterial);
    shellSphere.castShadow = true;
    shell.add(shellSphere);
    const shellLines = new THREE.Mesh(
        new THREE.SphereGeometry(1.69, 32, 20),
        new THREE.MeshBasicMaterial({ color: 0x9db9b2, wireframe: true, transparent: true, opacity: 0.12 })
    );
    shell.add(shellLines);

    const chassis = new THREE.Group();
    chassis.position.y = -0.22;
    orbRoot.add(chassis);
    const whitePlastic = new THREE.MeshStandardMaterial({ color: 0xe8e0d2, roughness: 0.62 });
    const darkPlastic = new THREE.MeshStandardMaterial({ color: 0x2c302d, roughness: 0.75 });
    const greenBoard = new THREE.MeshStandardMaterial({ color: 0x236b53, roughness: 0.52 });
    const metal = new THREE.MeshStandardMaterial({ color: 0x9da19d, metalness: 0.7, roughness: 0.32 });

    const chassisBase = new THREE.Mesh(new THREE.CylinderGeometry(1.08, 0.82, 0.2, 40), whitePlastic);
    chassisBase.castShadow = true;
    chassisBase.receiveShadow = true;
    chassis.add(chassisBase);
    const chassisTop = new THREE.Mesh(new THREE.CylinderGeometry(0.82, 0.82, 0.11, 40), whitePlastic);
    chassisTop.position.y = 0.15;
    chassis.add(chassisTop);

    const pi = new THREE.Mesh(new THREE.BoxGeometry(0.72, 0.1, 0.52), greenBoard);
    pi.position.set(-0.14, 0.28, -0.08);
    pi.castShadow = true;
    chassis.add(pi);
    const chip = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.07, 0.2), darkPlastic);
    chip.position.set(-0.14, 0.37, -0.08);
    chassis.add(chip);

    const battery = new THREE.Mesh(new THREE.BoxGeometry(0.52, 0.25, 0.75), darkPlastic);
    battery.position.set(0.35, 0.29, 0.14);
    battery.castShadow = true;
    chassis.add(battery);
    const batteryStripe = new THREE.Mesh(new THREE.BoxGeometry(0.54, 0.03, 0.12), new THREE.MeshStandardMaterial({ color: 0xd4a33d }));
    batteryStripe.position.set(0.35, 0.43, 0.14);
    chassis.add(batteryStripe);

    const cameraMount = new THREE.Group();
    cameraMount.position.set(0, 0.35, 0.92);
    const cameraBody = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.22, 0.26), darkPlastic);
    cameraMount.add(cameraBody);
    const cameraLens = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.06, 20), metal);
    cameraLens.rotation.x = Math.PI / 2;
    cameraLens.position.z = 0.16;
    cameraMount.add(cameraLens);
    chassis.add(cameraMount);

    const wireColors = [0xf0b423, 0x176bb2, 0xbf3f47, 0x27302d];
    for (let index = 0; index < 8; index += 1) {
        const start = new THREE.Vector3(-0.12 + (index % 3) * 0.1, 0.36, -0.08 + Math.floor(index / 3) * 0.07);
        const end = new THREE.Vector3(Math.cos(index * 0.78) * 0.92, 0.02, Math.sin(index * 0.78) * 0.92);
        const middle = start.clone().lerp(end, 0.5).add(new THREE.Vector3(0, 0.35 + (index % 2) * 0.12, 0));
        const curve = new THREE.QuadraticBezierCurve3(start, middle, end);
        const wire = new THREE.Mesh(
            new THREE.TubeGeometry(curve, 20, 0.024, 6, false),
            new THREE.MeshStandardMaterial({ color: wireColors[index % wireColors.length], roughness: 0.45 })
        );
        chassis.add(wire);
    }

    const wheels = [];
    // Three wheel locations form an equilateral triangle around the chassis.
    // Each wheel points tangentially around the center, as in a kiwi-drive layout.
    const wheelAngles = [Math.PI / 6, (Math.PI / 6) + (Math.PI * 2) / 3, (Math.PI / 6) + (Math.PI * 4) / 3];
    wheelAngles.forEach((angle, index) => {
        const wheelMount = new THREE.Group();
        wheelMount.position.set(Math.sin(angle) * 1.02, -0.12, Math.cos(angle) * 1.02);
        wheelMount.rotation.y = angle;
        chassis.add(wheelMount);

        const arm = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.2, 0.66), whitePlastic);
        arm.position.z = 0.25;
        wheelMount.add(arm);

        // Rotate the wheel frame sideways on its X axis so the omni wheels
        // sit like real side-facing rollers instead of looking outward.
        const wheelFrame = new THREE.Group();
        wheelFrame.position.z = 0.58;
        wheelFrame.rotation.x = Math.PI / 2;
        wheelMount.add(wheelFrame);

        const spinGroup = new THREE.Group();
        wheelFrame.add(spinGroup);

        const tire = new THREE.Mesh(new THREE.CylinderGeometry(0.36, 0.36, 0.22, 24), whitePlastic);
        tire.castShadow = true;
        spinGroup.add(tire);
        const tireBand = new THREE.Mesh(new THREE.TorusGeometry(0.29, 0.065, 8, 24), darkPlastic);
        tireBand.rotation.x = Math.PI / 2;
        spinGroup.add(tireBand);

        for (let roller = 0; roller < 8; roller += 1) {
            const rollerAngle = (roller / 8) * Math.PI * 2;
            const rollerMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.043, 0.043, 0.27, 8), darkPlastic);
            rollerMesh.position.set(Math.cos(rollerAngle) * 0.33, Math.sin(rollerAngle) * 0.33, 0);
            rollerMesh.rotation.y = Math.PI / 2;
            rollerMesh.rotation.z = rollerAngle;
            spinGroup.add(rollerMesh);
        }

        wheels.push({ angle, spinGroup, index });
    });

    const pointer = new THREE.ArrowHelper(new THREE.Vector3(0, 0, -1), new THREE.Vector3(0, 1.18, 0), 0.62, 0x8b5e3c, 0.18, 0.1);
    pointer.visible = false;
    scene.add(pointer);

    const keys = new Set();
    const pressedControls = new Set();
    let active = false;
    let lastTime = performance.now();
    let lastMotionAt = 0;
    let lastBoundaryAt = 0;
    let lastCollisionAt = 0;
    let runStartedAt = null;
    let elapsedBeforeCompletion = 0;
    let completed = false;
    let scoreSaved = false;
    let heartBonusSeconds = 0;
    let hazardPenaltySeconds = 0;
    let lastHazardHitAt = 0;
    const lastSafePosition = new THREE.Vector2(0, 0);
    const tempDirection = new THREE.Vector3();

    function setStatus(message) {
        status.textContent = message;
    }

    function inputValue() {
        const up = keys.has('arrowup') || keys.has('w') || pressedControls.has('up');
        const down = keys.has('arrowdown') || keys.has('s') || pressedControls.has('down');
        const left = keys.has('arrowleft') || keys.has('a') || pressedControls.has('left');
        const right = keys.has('arrowright') || keys.has('d') || pressedControls.has('right');
        const turnLeft = keys.has('q') || pressedControls.has('turn-left');
        const turnRight = keys.has('e') || pressedControls.has('turn-right');
        return {
            x: (right ? 1 : 0) - (left ? 1 : 0),
            z: (down ? 1 : 0) - (up ? 1 : 0),
            turn: (turnRight ? 1 : 0) - (turnLeft ? 1 : 0)
        };
    }

    function updateTelemetry(input) {
        const wheelSpeed = wheels.map(({ angle }) => -Math.sin(angle) * input.x + Math.cos(angle) * input.z + input.turn * 0.78);
        wheelSpeed.forEach((speed, index) => {
            wheelLabels[index].textContent = `${Math.round(speed * 100)}%`;
        });
        return wheelSpeed;
    }

    function formatTime(timeInSeconds) {
        const minutes = Math.floor(timeInSeconds / 60);
        const seconds = (timeInSeconds % 60).toFixed(1).padStart(4, '0');
        return `${String(minutes).padStart(2, '0')}:${seconds}`;
    }

    function currentRunTime(now = performance.now()) {
        if (completed) return elapsedBeforeCompletion;
        const rawTime = runStartedAt ? (now - runStartedAt) / 1000 : 0;
        return Math.max(0.1, rawTime + hazardPenaltySeconds - heartBonusSeconds);
    }

    function updateMovingCoursePieces(now) {
        movingHazards.forEach((hazard) => {
            const offset = Math.sin(now * hazard.speed + hazard.phase) * hazard.travel;
            hazard.bumper.position.x = hazard.x + (hazard.axis === 'x' ? offset : 0);
            hazard.bumper.position.z = hazard.z + (hazard.axis === 'z' ? offset : 0);
            hazard.bumper.rotation.y += 0.045;
        });
        heartPickups.forEach((pickup) => {
            if (pickup.collected) return;
            pickup.heart.position.y = 0.15 + Math.sin(now * 0.004 + pickup.phase) * 0.08;
            pickup.heart.rotation.y += 0.025;
        });
    }

    function checkTimeTrialPieces(now) {
        heartPickups.forEach((pickup) => {
            if (pickup.collected || Math.hypot(orbRoot.position.x - pickup.x, orbRoot.position.z - pickup.z) > 1.55) return;
            pickup.collected = true;
            pickup.heart.visible = false;
            heartBonusSeconds += 1.2;
            setStatus(`HEART GRABBED! The ORB found a ${formatTime(1.2)} time bonus.`);
        });

        if (now - lastHazardHitAt < 1100) return;
        const hit = movingHazards.some((hazard) => {
            const x = hazard.bumper.position.x * courseScale;
            const z = hazard.bumper.position.z * courseScale;
            return Math.hypot(orbRoot.position.x - x, orbRoot.position.z - z) < orbRadius + hazard.radius;
        });
        if (!hit) return;

        hazardPenaltySeconds += 2.5;
        lastHazardHitAt = now;
        orbRoot.position.x = lastSafePosition.x;
        orbRoot.position.z = lastSafePosition.y;
        pointer.visible = false;
        setStatus('BUMPER BONK! +2.5 seconds. The moving cone is feeling way too powerful.');
    }

    function renderLeaderboard(entries) {
        leaderboardList.replaceChildren();
        if (!entries.length) {
            const empty = document.createElement('li');
            empty.className = 'leaderboard-empty';
            empty.textContent = 'No runs yet. The ORB demands a first legend.';
            leaderboardList.append(empty);
            return;
        }

        entries.forEach((entry, index) => {
            const item = document.createElement('li');
            const rank = document.createElement('span');
            rank.className = 'leaderboard-rank';
            rank.textContent = `#${index + 1}`;
            const name = document.createElement('span');
            name.className = 'leaderboard-name';
            name.textContent = entry.name;
            const time = document.createElement('span');
            time.className = 'leaderboard-time';
            time.textContent = formatTime(Number(entry.time));
            item.append(rank, name, time);
            leaderboardList.append(item);
        });
    }

    async function loadLeaderboard() {
        try {
            const response = await fetch('/api/orb-leaderboard');
            const contentType = response.headers.get('content-type') || '';
            if (!contentType.includes('application/json')) {
                throw new Error('The shared scoreboard is not connected to this site yet.');
            }
            const data = await response.json();
            if (!response.ok) throw new Error(data.error || 'Could not load the leaderboard.');
            renderLeaderboard(data.entries || []);
        } catch (error) {
            leaderboardList.replaceChildren();
            const empty = document.createElement('li');
            empty.className = 'leaderboard-empty';
            empty.textContent = 'Shared scoreboard is being wired up. The ORB is keeping its tiny trophies safe.';
            leaderboardList.append(empty);
        }
    }

    function updateCourseUi(now = performance.now()) {
        const collected = checkpoints.filter(({ collected: isCollected }) => isCollected).length;
        courseProgress.textContent = `${collected} / ${checkpoints.length}`;
        heartBonusLabel.textContent = heartBonusSeconds ? `-${heartBonusSeconds.toFixed(1)}s` : '0.0s';
        courseTime.textContent = formatTime(currentRunTime(now));
    }

    function resetCourse() {
        completed = false;
        scoreSaved = false;
        elapsedBeforeCompletion = 0;
        heartBonusSeconds = 0;
        hazardPenaltySeconds = 0;
        lastSafePosition.set(0, 0);
        runStartedAt = active ? performance.now() : null;
        finishOverlay.hidden = true;
        scoreForm.reset();
        scoreMessage.textContent = '';
        saveScore.disabled = false;
        checkpoints.forEach((checkpoint) => {
            checkpoint.collected = false;
            checkpoint.ring.material.copy(checkpointMaterial);
            checkpoint.marker.material.color.set(0xf3c96a);
            checkpoint.marker.material.opacity = 0.3;
        });
        heartPickups.forEach((pickup) => {
            pickup.collected = false;
            pickup.heart.visible = true;
        });
        updateCourseUi();
    }

    function collidesAt(x, z) {
        if (x < -boundary || x > boundary || z < -boundary || z > boundary) return 'boundary';
        const obstacle = obstacleColliders.find((item) => {
            if (item.type === 'circle') return Math.hypot(x - item.x, z - item.z) < item.radius + orbRadius;
            const nearestX = THREE.MathUtils.clamp(x, item.x - item.width / 2, item.x + item.width / 2);
            const nearestZ = THREE.MathUtils.clamp(z, item.z - item.depth / 2, item.z + item.depth / 2);
            return Math.hypot(x - nearestX, z - nearestZ) < orbRadius;
        });
        return obstacle ? 'obstacle' : '';
    }

    function checkCourseProgress(now) {
        checkpoints.forEach((checkpoint) => {
            if (checkpoint.collected || Math.hypot(orbRoot.position.x - checkpoint.x, orbRoot.position.z - checkpoint.z) > 1.7) return;
            checkpoint.collected = true;
            checkpoint.ring.material.copy(collectedMaterial);
            checkpoint.marker.material.color.set(0x52d3a0);
            checkpoint.marker.material.opacity = 0.48;
            const current = checkpoints.filter(({ collected: isCollected }) => isCollected).length;
            lastSafePosition.set(orbRoot.position.x, orbRoot.position.z);
            setStatus(`BEACON ${checkpoint.number} ACQUIRED. ${current}/${checkpoints.length} shiny rings collected.`);
        });

        const allCollected = checkpoints.every(({ collected: isCollected }) => isCollected);
        if (allCollected && !completed) {
            elapsedBeforeCompletion = currentRunTime(now);
            completed = true;
            mode.textContent = 'COURSE CLEAR';
            finishTime.textContent = formatTime(elapsedBeforeCompletion);
            finishOverlay.hidden = false;
            setStatus('COURSE CLEAR! The timer is frozen. Put your name in the Hall of Roll.');
        }
        updateCourseUi(now);
    }

    function resetOrb() {
        orbRoot.position.set(0, 0.84, 0);
        shell.rotation.set(0, 0, 0);
        chassis.rotation.set(0, 0, 0);
        pointer.visible = false;
        resetCourse();
        if (active) mode.textContent = 'COURSE LIVE';
        setStatus('ORB returned to the middle. It missed you for exactly 0.2 seconds.');
    }

    function setControlEnabled(enabled) {
        [...controlButtons, resetButton].forEach((button) => {
            button.disabled = !enabled;
        });
    }

    function activateOrb() {
        active = true;
        launchOverlay.classList.add('is-hidden');
        setControlEnabled(true);
        resetCourse();
        mode.textContent = 'COURSE LIVE';
        setStatus('Time trial online. Grab hearts, dodge moving bumpers, collect 3 beacons, then claim your Hall of Roll spot.');
    }

    launchButton.addEventListener('click', activateOrb);
    resetButton.addEventListener('click', resetOrb);
    playAgain.addEventListener('click', resetOrb);
    scoreForm.addEventListener('submit', async (event) => {
        event.preventDefault();
        if (!completed || scoreSaved) return;

        const name = playerName.value.trim();
        if (!name) {
            scoreMessage.textContent = 'The Hall of Roll needs a name.';
            return;
        }

        saveScore.disabled = true;
        scoreMessage.textContent = 'Checking the official tiny-robot records…';
        try {
            const response = await fetch('/api/orb-leaderboard', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name, time: elapsedBeforeCompletion })
            });
            const contentType = response.headers.get('content-type') || '';
            if (!contentType.includes('application/json')) {
                throw new Error('Shared score saving is not connected to zivcohen.org yet.');
            }
            const data = await response.json();
            if (!response.ok) throw new Error(data.error || 'Could not save that run.');
            scoreSaved = true;
            scoreMessage.textContent = 'Saved! The ORB is quietly impressed.';
            renderLeaderboard(data.entries || []);
        } catch (error) {
            scoreMessage.textContent = error.message || 'Could not save that run.';
            saveScore.disabled = false;
        }
    });
    setControlEnabled(false);
    loadLeaderboard();

    controlButtons.forEach((button) => {
        const control = button.dataset.control;
        const setPressed = (pressed) => {
            if (!active) return;
            button.classList.toggle('is-pressed', pressed);
            if (pressed) pressedControls.add(control);
            else pressedControls.delete(control);
        };
        button.addEventListener('pointerdown', (event) => {
            event.preventDefault();
            button.setPointerCapture?.(event.pointerId);
            setPressed(true);
        });
        ['pointerup', 'pointercancel', 'pointerleave'].forEach((eventName) => {
            button.addEventListener(eventName, () => setPressed(false));
        });
    });

    window.addEventListener('keydown', (event) => {
        const key = event.key.toLowerCase();
        if (!['w', 'a', 's', 'd', 'q', 'e', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright'].includes(key)) return;
        const target = event.target;
        if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement || target instanceof HTMLSelectElement || target?.isContentEditable) return;
        if (active) {
            event.preventDefault();
            keys.add(key);
        }
    });

    window.addEventListener('keyup', (event) => {
        keys.delete(event.key.toLowerCase());
    });

    function resizeRenderer() {
        const { clientWidth, clientHeight } = stage;
        renderer.setSize(clientWidth, clientHeight, false);
        camera.aspect = clientWidth / clientHeight;
        camera.updateProjectionMatrix();
    }

    new ResizeObserver(resizeRenderer).observe(stage);
    resizeRenderer();

    function animate(now) {
        const delta = Math.min((now - lastTime) / 1000, 0.05);
        lastTime = now;
        updateMovingCoursePieces(now);
        const input = active && !completed ? inputValue() : { x: 0, z: 0, turn: 0 };
        const moving = Math.abs(input.x) + Math.abs(input.z) + Math.abs(input.turn) > 0;
        const wheelSpeeds = updateTelemetry(input);

        if (moving) {
            const length = Math.hypot(input.x, input.z) || 1;
            const speed = 2.35 * delta;
            const nextX = orbRoot.position.x + (input.x / length) * speed;
            const nextZ = orbRoot.position.z + (input.z / length) * speed;
            const collision = collidesAt(nextX, nextZ);
            if (!collision) {
                orbRoot.position.x = nextX;
                orbRoot.position.z = nextZ;
                shell.rotation.z += (input.x / length) * speed * 0.82;
                shell.rotation.x -= (input.z / length) * speed * 0.82;
            } else if (now - lastCollisionAt > 900) {
                setStatus(collision === 'boundary'
                    ? 'Virtual wall reached. No drywall was harmed.'
                    : 'ORB bonked the obstacle. The obstacle is acting very smug.');
                lastCollisionAt = now;
            }
            shell.rotation.y += input.turn * delta * 1.7;
            tempDirection.set(input.x, 0, input.z).normalize();
            pointer.position.set(orbRoot.position.x, 1.18, orbRoot.position.z);
            pointer.setDirection(tempDirection);
            pointer.visible = Math.abs(input.x) + Math.abs(input.z) > 0;
            wheelSpeeds.forEach((speedValue, index) => {
                wheels[index].spinGroup.rotation.y += speedValue * delta * 13;
            });

            if (now - lastMotionAt > 1700) {
                const messages = input.turn !== 0 && input.x === 0 && input.z === 0
                    ? ['Elegant spin. Please clap.', 'ORB is showing off.', 'This is what engineers call a tactical twirl.']
                    : ['The omni wheels are doing their little dance.', 'ORB is rolling with purpose. Probably.', 'Look at that sideways motion. Extremely legal.'];
                setStatus(messages[Math.floor(Math.random() * messages.length)]);
                lastMotionAt = now;
            }

        } else {
            shell.rotation.y += delta * (active ? 0.08 : 0.17);
            pointer.visible = false;
        }

        chassis.position.y = -0.22 + Math.sin(now * 0.0022) * 0.025;
        chassis.rotation.z = THREE.MathUtils.lerp(chassis.rotation.z, input.x * -0.08, 0.05);
        chassis.rotation.x = THREE.MathUtils.lerp(chassis.rotation.x, input.z * 0.08, 0.05);
        if (active && !completed) checkTimeTrialPieces(now);
        if (active) checkCourseProgress(now);
        renderer.render(scene, camera);
        requestAnimationFrame(animate);
    }

    requestAnimationFrame(animate);
})();
