(function () {
    async function initScene() {
        
        if (typeof THREE === 'undefined') {
            document.getElementById('loading').textContent = 'Error: THREE.js failed to load';
            return;
        }
        if (typeof noise === 'undefined') {
            document.getElementById('loading').textContent = 'Error: Noise library failed to load';
            return;
        }

        document.getElementById('loading').style.display = 'none';
        noise.seed(Math.random());

        const container = document.getElementById('canvas-container');
        const width = container.clientWidth;
        const height = container.clientHeight;
        const dpr = window.devicePixelRatio || 1;


        // Animation variables
        let speed = 0;
        let acce = 0;
        let k = 0.6;
        const r = 2;
        let b1 = 0.1;
        const time_speed = 0.0005;
        const k_strength = 0.01;

        // Scene
        const scene = new THREE.Scene();

        const ambientLight = new THREE.AmbientLight(0xffffff, 10);
        scene.add(ambientLight);
        
        const directionalLight = new THREE.DirectionalLight(0xffffff, 10);
        directionalLight.position.set(0, 10, 10);
        scene.add(directionalLight);

        //const directionalLighthelper = new THREE.DirectionalLightHelper(directionalLight, 1);
        //scene.add(directionalLighthelper);

        const directionalLight2 = new THREE.DirectionalLight(0xffffff, 8);
        directionalLight2.position.set( 0, -5, 10);
        scene.add(directionalLight2);

        //const directionalLighthelper2 = new THREE.DirectionalLightHelper(directionalLight2, 1);
        //scene.add(directionalLighthelper2);


        const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 100);
        camera.position.set(0, 5, 10);
        camera.lookAt(0, 0, 0);

        const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
        renderer.setSize(width, height);
        renderer.setPixelRatio(dpr);
        renderer.outputEncoding = THREE.sRGBEncoding;
        renderer.physicallyCorrectLights = true;
        renderer.toneMapping = THREE.ACESFilmicToneMapping;
        renderer.toneMappingExposure = 1.2;
        container.appendChild(renderer.domElement);

        const controls = new THREE.OrbitControls(camera, renderer.domElement);
        controls.minPolarAngle = Math.PI / 4;
        controls.maxPolarAngle = Math.PI / 2;
        controls.minDistance = 5;
        controls.maxDistance = 30;
        controls.enableDamping = true;


        // ─── Geometry: MorphTarget不使用 ───────────────────────────
        const size = (2 * r) / Math.sqrt(3);
        const segments = 32;
        const geometry = new THREE.BoxGeometry(size, size, size, segments, segments, segments);

        const rawPositions = geometry.attributes.position.array;
        const vertexCount = geometry.attributes.position.count;
        console.log('Vertex Count: %d', vertexCount);

        // Cube の元頂点を保存
        const cubePositions = new Float32Array(rawPositions);

        // Sphere の対応頂点を計算して保存
        const spherePositions = new Float32Array(rawPositions.length);
        for (let i = 0; i < vertexCount; i++) {
            const x = cubePositions[i * 3];
            const y = cubePositions[i * 3 + 1];
            const z = cubePositions[i * 3 + 2];
            const p = new THREE.Vector3(x, y, z).normalize().multiplyScalar(r);
            spherePositions[i * 3]     = p.x;
            spherePositions[i * 3 + 1] = p.y;
            spherePositions[i * 3 + 2] = p.z;
        }

        const material = new THREE.MeshPhysicalMaterial({
            color: 0x000000,
            roughness: 0.7,
            metalness: 1.0,
            envMapIntensity: 1.0,
            iridescence: 0.3,
            iridescenceIOR: 1.0,
            iridescenceThicknessRange: [100, 800],
        });

        const object = new THREE.Mesh(geometry, material);
        scene.add(object);
        directionalLight.target  = object;
        directionalLight2.target = object;


        //---------アリアスのモデルを配置----------
        const glbloader = new THREE.GLTFLoader();
        
        const arias = await glbloader.loadAsync('https://raw.githubusercontent.com/I-H-coder/port_code/main/assets/arias_lowpoli.glb');
        
        const model = arias.scene;
        model.traverse((child) => {

            if (child.isMesh) {

                const geometry = child.geometry;

                const positions = geometry.attributes.position.array;

                console.log(positions.length/3);

            }

        });
        model.scale.set(0.2, 0.2, 0.2);
        
        model.traverse((child) => {
            if (child.isMesh) {
                child.material = material;
            }
        });

        //scene.add(model);

        /*const axesHelper = new THREE.AxesHelper( 1000 );
            scene.add( axesHelper );
        // Morph値（JS管理）*/
        let morph_val = 0;

        // ─── JS側でLERP → Noise適用 ────────────────────────────────
        function positionNoise(time, strength = 1.0) {
            const positions = object.geometry.attributes.position.array;

            const morph_pace = Math.abs(Math.sin(morph_val));
            for (let i = 0; i < vertexCount; i++) {
                // ① CPU側でCube↔SphereをLERP（MorphTargetの代替）
                const lx = cubePositions[i * 3]     + (spherePositions[i * 3]     - cubePositions[i * 3])     * morph_pace;
                const ly = cubePositions[i * 3 + 1] + (spherePositions[i * 3 + 1] - cubePositions[i * 3 + 1]) * morph_pace;
                const lz = cubePositions[i * 3 + 2] + (spherePositions[i * 3 + 2] - cubePositions[i * 3 + 2]) * morph_pace;

                const p = new THREE.Vector3(lx, ly, lz);

                // ② LERPされた位置にNoiseを適用（morph後でも有効）
                const v_size = p.length();
                const noiseValue = noise.perlin3(
                    p.x * k + time,
                    p.y * k + time,
                    p.z * k + time
                );
                p.normalize().multiplyScalar(v_size + b1 * noiseValue * strength);

                positions[i * 3]     = p.x;
                positions[i * 3 + 1] = p.y;
                positions[i * 3 + 2] = p.z;
            }
        }

        // Mouse
        function onMouseMove() {
            morph_val += 0.02;
            acce = 0.02;
            k += k_strength;
        }

        // Animation
        function animate() {
            requestAnimationFrame(animate);

            const time = performance.now() * time_speed;
            b1 = 0.1 + noise.perlin2(10, time / 0.8);

            speed += acce - 0.1 * speed;
            speed = Math.max(speed, 0);
            b1 += speed * 10;
            acce = 0;

            k -= k_strength * 0.8;
            k = Math.min(Math.max(k, 0.6), 1.5);
            positionNoise(time);
            
            object.rotation.y += 0.005;
            object.geometry.attributes.position.needsUpdate = true;
            object.geometry.computeVertexNormals();

            controls.update();
            renderer.render(scene, camera);
        }

        function onWindowResize() {
            const w = container.clientWidth;
            const h = container.clientHeight;
            camera.aspect = w / h;
            camera.updateProjectionMatrix();
            renderer.setSize(w, h);
        }

        document.addEventListener('mousemove', onMouseMove);
        window.addEventListener('resize', onWindowResize);
        animate();
    }

    let checkCount = 0;
    function checkLibrariesLoaded() {
        if (typeof THREE !== 'undefined' && typeof noise !== 'undefined') {
            initScene();
        } else if (++checkCount < 100) {
            setTimeout(checkLibrariesLoaded, 100);
        } else {
            document.getElementById('loading').textContent = 'Error: Libraries failed to load';
        }
    }
    checkLibrariesLoaded();
})();