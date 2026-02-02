import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GUI } from 'three/addons/libs/lil-gui.module.min.js';
import { getRealProbabilityDensity } from './physics.js';
import { getElectronConfiguration, elementSymbols, elementNames } from './atom-data.js';
import { createLabel, createDetectionSprite, sampleOrbitals } from './utils.js';
import { getDisplayScale, formatScales, PHYSICAL_CONSTANTS, VISUALIZATION_SCALES } from './physics-constants.js';

// Time-based electron observation visualization
// Each glow represents a detected electron; density and persistence show electron distribution
// Physical accuracy: using Bohr radii and atomic timescales
const CONFIG = {
    glowSize: 5,
};

const ATOM_SPACING = 25;
const COLS = 5;

// Bohr radii per display unit
const BOHR_PER_DISPLAY = 1.0 / VISUALIZATION_SCALES.BOHR_TO_DISPLAY;

const ORBITAL_COLORS = {
    0: new THREE.Color(1, 0.2, 0.2),
    1: new THREE.Color(0.2, 1, 0.2),
    2: new THREE.Color(0.2, 0.5, 1),
    3: new THREE.Color(1, 1, 0.2)
};

let scene, camera, renderer, controls;
let detections = [];
let atomConfigs = []; // Store {Z, xPos, yPos, orbitals}
let lastDetectionTime = 0;

function init() {
    scene = new THREE.Scene();
    camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 1000);
    camera.position.set(50, 50, 100);

    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(window.devicePixelRatio);
    document.body.appendChild(renderer.domElement);

    controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;

    createAtomsGrid();
    initGUI();

    const gridHelper = new THREE.GridHelper(200, 20, 0x444444, 0x222222);
    gridHelper.rotation.x = Math.PI / 2;
    scene.add(gridHelper);

    window.addEventListener('resize', onWindowResize, false);

    animate();
}

// use `createDetectionSprite` and `sampleOrbitals` from utils.js

function createAtomsGrid() {
    atomConfigs = [];
    for (let Z = 1; Z <= 20; Z++) {
        const idx = Z - 1;
        const col = idx % COLS;
        const row = Math.floor(idx / COLS);
        const xPos = (col - (COLS - 1) / 2) * ATOM_SPACING;
        const yPos = - (row - 1.5) * ATOM_SPACING;

        atomConfigs.push({
            Z, xPos, yPos,
            orbitals: getElectronConfiguration(Z)
        });

        createLabel(scene, elementSymbols[Z-1], elementNames[Z-1], xPos, yPos - 8, { scaleX: 10, scaleY: 5 });
    }
}

const isMobile = window.innerWidth < 768;

function spawnElectronObservation() {
    const t = window.APP_STATE?.timeScale ?? 0.5;
    // Higher timeScale = more observations per spawn, longer persistence
    const densityFactor = isMobile ? 0.25 : 1.0;
    const obsPerSpawn = Math.max(1, Math.round((3 + 17 * t) * densityFactor));
    const life = 0.1 + 4.5 * t; // 0.1s at t=0, 4.6s at t=1
    const baseSize = 4.5 + t * 2.5; // Slightly larger glow at higher timeScale

    if (atomConfigs.length === 0) return;
    if (!(window.APP_STATE?.detectionEnabled ?? true)) return;
    
    // Pick a random atom
    const cfg = atomConfigs[Math.floor(Math.random() * atomConfigs.length)];
    
    // Sample electrons from this atom's orbitals
    const samples = sampleOrbitals(cfg.Z, obsPerSpawn);
    
    for (const sample of samples) {
        const sprite = createDetectionSprite('#ffff88');
        sprite.scale.set(baseSize, baseSize, 1);
        sprite.position.set(cfg.xPos + sample.pos.x, cfg.yPos + sample.pos.y, sample.pos.z);
        sprite.userData = { 
            start: performance.now() / 1000, 
            life,
            color: sample.color
        };
        scene.add(sprite);
        detections.push(sprite);
    }
}

function updateDetections() {
    const now = performance.now() / 1000;
    for (let i = detections.length - 1; i >= 0; i--) {
        const s = detections[i];
        const age = now - s.userData.start;
        const life = s.userData.life;
        const fade = Math.max(0, 1 - age / life);
        s.material.opacity = fade * (window.APP_STATE?.lowQuality ? 0.6 : 1);
        if (age > life) {
            scene.remove(s);
            detections.splice(i, 1);
        }
    }
}

function initGUI() {
    const gui = new GUI();
    gui.add(CONFIG, 'glowSize', 2, 15, 0.5).name('Glow Size');
    gui.add({ clear: () => { 
        detections.forEach(d => scene.remove(d)); 
        detections = []; 
    } }, 'clear').name('Clear Observations');
}

function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}

function animate() {
    requestAnimationFrame(animate);

    if (window.APP_STATE?.paused) {
        controls.update();
        renderer.render(scene, camera);
        return;
    }

    const now = performance.now() / 1000;
    const t = window.APP_STATE?.timeScale ?? 0.5;
    // timeScale controls spawn frequency: low=sparse, high=frequent
    const minInterval = 0.15; // At t=0: spawn every 0.15s
    const maxInterval = 0.01; // At t=1: spawn every 0.01s
    const interval = minInterval + (maxInterval - minInterval) * t;

    if ((window.APP_STATE?.detectionEnabled ?? true) && (now - lastDetectionTime > interval)) {
        spawnElectronObservation();
        lastDetectionTime = now;
    }

    updateDetections();

    controls.update();
    renderer.render(scene, camera);
}

init();
