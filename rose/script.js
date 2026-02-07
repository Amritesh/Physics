import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

// Configuration
const config = {
    opening: 2,
    vDensity: 8,
    pAlign: 3.6,
    curve1: 2,
    curve2: 1.3,
    rows: 60,
    cols: 700,
    color: 0xaa0000, 
    color2: 0xff0000, 
    roughness: 0.5, 
    metalness: 0.0,
    clearcoat: 0.2, 
    sheen: 1.0,
    sheenColor: 0xff3333,
    bloomStrength: 0.3, // Reduced
    bloomRadius: 0.2, // Reduced
    bloomThreshold: 0.2
};

// Presets
const presets = {
    red: { color: 0xaa0000, color2: 0xff0000, sheenColor: 0xff3333, bg: 0x87CEEB },
    pink: { color: 0xcc0066, color2: 0xff66aa, sheenColor: 0xffcccc, bg: 0xffe6ea },
    white: { color: 0xdddddd, color2: 0xffffff, sheenColor: 0xffffff, bg: 0x87CEEB },
    yellow: { color: 0xffaa00, color2: 0xffdd00, sheenColor: 0xffffaa, bg: 0x87CEEB },
    blue: { color: 0x0000aa, color2: 0x0088ff, sheenColor: 0x88ccff, bg: 0x001133 },
    black: { color: 0x111111, color2: 0x333333, sheenColor: 0x555555, bg: 0x220000 }
};

// Scene Setup
const scene = new THREE.Scene();
const skyColor = 0x87CEEB; 
scene.background = new THREE.Color(skyColor); 
scene.fog = new THREE.Fog(skyColor, 3000, 6000); 

const camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 5000);

const renderer = new THREE.WebGLRenderer({ antialias: false, alpha: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2)); 
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.0;

// Post-Processing
const renderScene = new RenderPass(scene, camera);

const bloomPass = new UnrealBloomPass(new THREE.Vector2(window.innerWidth, window.innerHeight), 1.5, 0.4, 0.85);
bloomPass.threshold = config.bloomThreshold;
bloomPass.strength = config.bloomStrength;
bloomPass.radius = config.bloomRadius;

const outputPass = new OutputPass();

const composer = new EffectComposer(renderer);
composer.addPass(renderScene);
composer.addPass(bloomPass);
composer.addPass(outputPass);

// Controls
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.05;
controls.autoRotate = true;
controls.autoRotateSpeed = 0.5;
controls.maxPolarAngle = Math.PI / 2 - 0.1;
controls.minDistance = 100;
controls.maxDistance = 3000;

function updateCameraPosition() {
    const aspect = window.innerWidth / window.innerHeight;
    const isMobile = aspect < 1;
    const baseDistance = 700;
    const distance = isMobile ? baseDistance / (aspect * 0.8) : baseDistance;
    
    // Calculate offset to center rose in upper half
    // Reduced offset as per user feedback (panel is smaller)
    const vHeight = 2 * distance * Math.tan((camera.fov * Math.PI / 180) / 2);
    const offset = isMobile ? vHeight * 0.12 : 0; 

    camera.position.set(0, (distance * 0.8) - offset, distance);
    controls.target.set(0, -offset, 0); 
}

// Lighting
const ambientLight = new THREE.AmbientLight(0xffffff, 0.6); 
scene.add(ambientLight);

const hemiLight = new THREE.HemisphereLight(0xffffff, 0x444444, 0.6); 
hemiLight.position.set(0, 200, 0);
scene.add(hemiLight);

const dirLight = new THREE.DirectionalLight(0xffeedd, 2.0); 
dirLight.position.set(150, 300, 200);
dirLight.castShadow = true;
dirLight.shadow.mapSize.width = 2048;
dirLight.shadow.mapSize.height = 2048;
dirLight.shadow.camera.near = 0.5;
dirLight.shadow.camera.far = 2000;
dirLight.shadow.bias = -0.0001;
const d = 400;
dirLight.shadow.camera.left = -d;
dirLight.shadow.camera.right = d;
dirLight.shadow.camera.top = d;
dirLight.shadow.camera.bottom = -d;
scene.add(dirLight);

const innerLight = new THREE.PointLight(0xff3333, 1.0, 500); 
innerLight.position.set(0, 50, 0);
scene.add(innerLight);

const spotLight = new THREE.SpotLight(0xffaaaa, 5);
spotLight.position.set(0, 200, -400);
spotLight.lookAt(0, 0, 0);
spotLight.angle = Math.PI / 4;
spotLight.penumbra = 1;
scene.add(spotLight);

// Ground
const planeGeometry = new THREE.PlaneGeometry(10000, 10000);
const planeMaterial = new THREE.MeshStandardMaterial({ 
    color: 0x5a8f5a, 
    roughness: 0.8,
    metalness: 0.0 
});
const plane = new THREE.Mesh(planeGeometry, planeMaterial);
plane.rotation.x = -Math.PI / 2;
plane.position.y = -150; 
plane.receiveShadow = true;
scene.add(plane);

// Rose Geometry
let geometry;
let material;
let mesh;

function createRose() {
    if (mesh) {
        scene.remove(mesh);
        geometry.dispose();
        material.dispose();
    }

    const { rows, cols, opening, vDensity, pAlign, curve1, curve2, color, color2, roughness, metalness, clearcoat, sheen, sheenColor } = config;
    
    const vertices = [];
    const colors = [];
    const indices = [];

    const t_D = 180 * 15 / cols;
    const r_D = 1 / rows;
    
    const c1 = new THREE.Color(color);
    const c2 = new THREE.Color(color2);

    for (let r = 0; r <= rows; r++) {
        for (let theta = 0; theta <= cols; theta++) {
            const phi = (180 / opening) * Math.exp(-theta * t_D / (vDensity * 180)) * (Math.PI / 180);
            const thetaAngle = theta * t_D;
            const thetaRad = thetaAngle * (Math.PI / 180);

            const petalCutRaw = (pAlign * thetaAngle) % 360;
            const petalCutInner = 1 - (petalCutRaw / 180);
            const petalCutTerm = (5/4) * Math.pow(petalCutInner, 2) - 1/4;
            const petalCut = 1 - (1/2) * Math.pow(petalCutTerm, 2);

            const hangDown = curve1 * Math.pow(r * r_D, 2) * Math.pow(curve2 * r * r_D - 1, 2) * Math.sin(phi);

            const pX = 260 * petalCut * (r * r_D * Math.sin(phi) + hangDown * Math.cos(phi)) * Math.sin(thetaRad);
            const pY = -260 * petalCut * (r * r_D * Math.cos(phi) - hangDown * Math.sin(phi));
            const pZ = 260 * petalCut * (r * r_D * Math.sin(phi) + hangDown * Math.cos(phi)) * Math.cos(thetaRad);

            vertices.push(pX, pY, pZ);
            
            const mixRatio = Math.pow(r / rows, 0.8); 
            const rCol = THREE.MathUtils.lerp(c1.r, c2.r, mixRatio);
            const gCol = THREE.MathUtils.lerp(c1.g, c2.g, mixRatio);
            const bCol = THREE.MathUtils.lerp(c1.b, c2.b, mixRatio);
            
            colors.push(rCol, gCol, bCol);
        }
    }

    const rowLength = cols + 1;
    for (let r = 0; r < rows; r++) {
        for (let theta = 0; theta < cols; theta++) {
            const a = r * rowLength + theta;
            const b = (r + 1) * rowLength + theta;
            const c = (r + 1) * rowLength + (theta + 1);
            const d = r * rowLength + (theta + 1);

            indices.push(a, b, d);
            indices.push(b, c, d);
        }
    }

    geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
    geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    geometry.setIndex(indices);
    geometry.computeVertexNormals();

    material = new THREE.MeshPhysicalMaterial({
        vertexColors: true,
        side: THREE.DoubleSide,
        roughness: roughness,
        metalness: metalness,
        clearcoat: clearcoat,
        clearcoatRoughness: 0.1,
        sheen: sheen,
        sheenColor: new THREE.Color(sheenColor),
        flatShading: false,
    });

    mesh = new THREE.Mesh(geometry, material);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.rotation.x = Math.PI; 
    
    scene.add(mesh);
}

// Initialization and Event Listeners
function init() {
    const container = document.getElementById('canvas-container');
    if (container) {
        container.appendChild(renderer.domElement);
    }
    
    updateCameraPosition();
    createRose();
    
    // Set default message
    const msgOverlay = document.getElementById('message-overlay');
    if(msgOverlay) msgOverlay.innerText = "I Love You";

    // UI Elements
    const toggleBtn = document.getElementById('toggle-controls');
    const panel = document.getElementById('controls-panel');
    const colorBtns = document.querySelectorAll('.color-btn');
    
    const openingSlider = document.getElementById('opening');
    const densitySlider = document.getElementById('density');
    const curvatureSlider = document.getElementById('curvature');
    const glowSlider = document.getElementById('glow');
    
    const msgInput = document.getElementById('message-input');
    const msgBtn = document.getElementById('set-message-btn');
    const randBtn = document.getElementById('randomize-btn');

    // Toggle Panel
    if (toggleBtn && panel) {
        toggleBtn.addEventListener('click', () => {
            panel.classList.toggle('active');
            toggleBtn.classList.toggle('active');
        });
    }

    // Color Presets
    colorBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            // UI Update
            colorBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            
            // Logic Update
            const presetKey = btn.dataset.preset;
            const p = presets[presetKey];
            if (p) {
                config.color = p.color;
                config.color2 = p.color2;
                config.sheenColor = p.sheenColor;
                
                // Update background if needed (optional)
                if (p.bg) {
                     scene.background.setHex(p.bg);
                     scene.fog.color.setHex(p.bg);
                }
                
                // Update inner light color too to match
                innerLight.color.setHex(p.sheenColor);
                
                createRose();
            }
        });
    });

    // Sliders
    if (openingSlider) openingSlider.addEventListener('input', (e) => {
        config.opening = parseFloat(e.target.value);
        createRose();
    });
    
    if (densitySlider) densitySlider.addEventListener('input', (e) => {
        config.vDensity = parseFloat(e.target.value);
        createRose();
    });
    
    if (curvatureSlider) curvatureSlider.addEventListener('input', (e) => {
        config.curve1 = parseFloat(e.target.value);
        createRose();
    });
    
    if (glowSlider) glowSlider.addEventListener('input', (e) => {
        const val = parseFloat(e.target.value);
        config.bloomStrength = val;
        bloomPass.strength = val;
    });

    // Message Logic
    if (msgBtn && msgInput && msgOverlay) {
        const updateMsg = () => {
            const text = msgInput.value; // Allow empty
            msgOverlay.innerText = text;
            msgOverlay.style.opacity = text ? 1 : 0; // Hide if empty so it doesn't block clicks
            msgInput.value = '';
        };
        msgBtn.addEventListener('click', updateMsg);
        msgInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') updateMsg();
        });
    }

    // Randomize Logic
    if (randBtn) {
        randBtn.addEventListener('click', () => {
            // Random parameters within safe aesthetic ranges
            config.opening = 1.5 + Math.random() * 3; // 1.5 to 4.5
            config.vDensity = 5 + Math.random() * 10; // 5 to 15
            config.curve1 = -2 + Math.random() * 4; // -2 to 2
            config.pAlign = 1 + Math.random() * 4; // 1 to 5
            
            // Update sliders UI
            if(openingSlider) openingSlider.value = config.opening;
            if(densitySlider) densitySlider.value = config.vDensity;
            if(curvatureSlider) curvatureSlider.value = config.curve1;
            
            createRose();
        });
    }
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}

function animate() {
    requestAnimationFrame(animate);
    controls.update();
    composer.render();
}

window.addEventListener('resize', () => {
    const aspect = window.innerWidth / window.innerHeight;
    camera.aspect = aspect;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
    composer.setSize(window.innerWidth, window.innerHeight);
    updateCameraPosition();
});

animate();
