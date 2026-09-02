(() => {
    const stage = document.getElementById('orb-stage');
    const launchOverlay = document.getElementById('launch-overlay');
    const launchButton = document.getElementById('launch-orb');
    const resetButton = document.getElementById('reset-orb');
    const status = document.getElementById('live-status');
    const mode = document.getElementById('orb-mode');
    const wheelLabels = [
        document.getElementById('wheel-a'),
        document.getElementById('wheel-b'),
        document.getElementById('wheel-c')
    ];
    const controlButtons = [...document.querySelectorAll('[data-control]')];

    if (!window.THREE) {
        status.textContent = 'The virtual ORB could not load. It is probably hiding under a couch.';
        return;
    }

    const { THREE } = window;
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 100);
    camera.position.set(7.5, 6.2, 9);
    camera.lookAt(0, 0.2, 0);

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
        new THREE.CircleGeometry(5.7, 80),
        new THREE.MeshStandardMaterial({ color: 0xcdbb9d, roughness: 0.96 })
    );
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    scene.add(floor);

    const grid = new THREE.GridHelper(10, 20, 0x9a7355, 0xb99e7c);
    grid.position.y = 0.012;
    grid.material.transparent = true;
    grid.material.opacity = 0.38;
    scene.add(grid);

    const orbRoot = new THREE.Group();
    orbRoot.position.y = 1.72;
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

        // The frame aims the axle tangent to the triangle. The inner group is
        // deliberately separate so only the wheel rolls, instead of the entire
        // assembly pirouetting around the chassis.
        const wheelFrame = new THREE.Group();
        wheelFrame.position.z = 0.58;
        wheelFrame.rotation.z = Math.PI / 2;
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

    const pointer = new THREE.ArrowHelper(new THREE.Vector3(0, 0, -1), new THREE.Vector3(0, 2.25, 0), 0.62, 0x8b5e3c, 0.18, 0.1);
    pointer.visible = false;
    scene.add(pointer);

    const keys = new Set();
    const pressedControls = new Set();
    let active = false;
    let lastTime = performance.now();
    let lastMotionAt = 0;
    let lastBoundaryAt = 0;
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

    function resetOrb() {
        orbRoot.position.set(0, 1.72, 0);
        shell.rotation.set(0, 0, 0);
        chassis.rotation.set(0, 0, 0);
        pointer.visible = false;
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
        mode.textContent = 'ROLLING';
        setStatus('ORB online. It has not asked for snacks yet. Drive responsibly-ish.');
    }

    launchButton.addEventListener('click', activateOrb);
    resetButton.addEventListener('click', resetOrb);
    setControlEnabled(false);

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
        const input = active ? inputValue() : { x: 0, z: 0, turn: 0 };
        const moving = Math.abs(input.x) + Math.abs(input.z) + Math.abs(input.turn) > 0;
        const wheelSpeeds = updateTelemetry(input);

        if (moving) {
            const length = Math.hypot(input.x, input.z) || 1;
            const speed = 1.3 * delta;
            orbRoot.position.x += (input.x / length) * speed;
            orbRoot.position.z += (input.z / length) * speed;
            orbRoot.position.x = THREE.MathUtils.clamp(orbRoot.position.x, -3.75, 3.75);
            orbRoot.position.z = THREE.MathUtils.clamp(orbRoot.position.z, -3.75, 3.75);
            shell.rotation.z += (input.x / length) * speed * 0.82;
            shell.rotation.x -= (input.z / length) * speed * 0.82;
            shell.rotation.y += input.turn * delta * 1.7;
            tempDirection.set(input.x, 0, input.z).normalize();
            pointer.position.set(orbRoot.position.x, 2.25, orbRoot.position.z);
            pointer.setDirection(tempDirection);
            pointer.visible = Math.abs(input.x) + Math.abs(input.z) > 0;
            wheelSpeeds.forEach((speedValue, index) => {
                wheels[index].spinGroup.rotation.y += speedValue * delta * 8;
            });

            if (now - lastMotionAt > 1700) {
                const messages = input.turn !== 0 && input.x === 0 && input.z === 0
                    ? ['Elegant spin. Please clap.', 'ORB is showing off.', 'This is what engineers call a tactical twirl.']
                    : ['The omni wheels are doing their little dance.', 'ORB is rolling with purpose. Probably.', 'Look at that sideways motion. Extremely legal.'];
                setStatus(messages[Math.floor(Math.random() * messages.length)]);
                lastMotionAt = now;
            }

            if ((Math.abs(orbRoot.position.x) >= 3.74 || Math.abs(orbRoot.position.z) >= 3.74) && now - lastBoundaryAt > 1800) {
                setStatus('Virtual wall reached. No drywall was harmed.');
                lastBoundaryAt = now;
            }
        } else {
            shell.rotation.y += delta * (active ? 0.08 : 0.17);
            pointer.visible = false;
        }

        chassis.position.y = -0.22 + Math.sin(now * 0.0022) * 0.025;
        chassis.rotation.z = THREE.MathUtils.lerp(chassis.rotation.z, input.x * -0.08, 0.05);
        chassis.rotation.x = THREE.MathUtils.lerp(chassis.rotation.x, input.z * 0.08, 0.05);
        renderer.render(scene, camera);
        requestAnimationFrame(animate);
    }

    requestAnimationFrame(animate);
})();
