import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GUI } from 'three/addons/libs/lil-gui.module.min.js';
import { getRealProbabilityDensity } from './physics.js';
import { getElectronConfiguration, elementSymbols, elementNames } from './atom-data.js';
import { getMoleculeGeometry, molecules } from './molecule-data.js';
import { createLabel } from './utils.js';

// Time-based electron observation visualization for molecules
const CONFIG = {
    glowSize: 6,
};

const ATOM_SPACING = 35;
const COLS = 5;

const ORBITAL_COLORS = {
    0: new THREE.Color(1, 0.2, 0.2),
    1: new THREE.Color(0.2, 1, 0.2),
    2: new THREE.Color(0.2, 0.5, 1),
    3: new THREE.Color(1, 1, 0.2)
};

let scene, camera, renderer, controls;
let detections = [];
let moleculeConfigs = [];
let lastDetectionTime = 0;

function createDetectionSprite(color = '#ffdca8') {
    const size = 128;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    const grad = ctx.createRadialGradient(size/2, size/2, 0, size/2, size/2, size/2);
    grad.addColorStop(0, color);
    grad.addColorStop(0.3, color);
    grad.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0,0,size,size);
    const tex = new THREE.CanvasTexture(canvas);
    const mat = new THREE.SpriteMaterial({ map: tex, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true });
    const sprite = new THREE.Sprite(mat);
    return sprite;
}

function sampleOrbitalsMolecule(Z, atomPositions, count = 1) {
    // Sample electron positions from atomic orbitals, replicated at molecule atom positions
    const orbitals = getElectronConfiguration(Z);
    const samples = [];
    
    for (const orb of orbitals) {
        let x = 0.5, y = 0.5, z = 0.5;
        let currentProb = getRealProbabilityDensity(x, y, z, orb.n, orb.l, orb.m, orb.Zeff || 1);
        const stepSize = (orb.n * 1.5) / (orb.Zeff || 1);

        // Quick burn-in
        for (let i = 0; i < 50; i++) {
            const dx = (Math.random() - 0.5) * stepSize;
            const dy = (Math.random() - 0.5) * stepSize;
            const dz = (Math.random() - 0.5) * stepSize;
            const nextX = x + dx, nextY = y + dy, nextZ = z + dz;
            const nextProb = getRealProbabilityDensity(nextX, nextY, nextZ, orb.n, orb.l, orb.m, orb.Zeff || 1);
            const ratio = currentProb === 0 ? 1 : nextProb / currentProb;
            if (ratio >= 1 || Math.random() < ratio) {
                x = nextX; y = nextY; z = nextZ; currentProb = nextProb;
            }
        }

        // Sample 'count' positions, replicate across atoms
        for (let i = 0; i < count; i++) {
            const dx = (Math.random() - 0.5) * stepSize;
            const dy = (Math.random() - 0.5) * stepSize;
            const dz = (Math.random() - 0.5) * stepSize;
            const nextX = x + dx, nextY = y + dy, nextZ = z + dz;
            const nextProb = getRealProbabilityDensity(nextX, nextY, nextZ, orb.n, orb.l, orb.m, orb.Zeff || 1);
            const ratio = currentProb === 0 ? 1 : nextProb / currentProb;
            if (ratio >= 1 || Math.random() < ratio) {
                x = nextX; y = nextY; z = nextZ; currentProb = nextProb;
            }
            
            // Add sample at each atomic position in molecule
            for (const atomPos of atomPositions) {
                samples.push({ 
                    pos: new THREE.Vector3(x + atomPos.x, y + atomPos.y, z + atomPos.z), 
                    color: ORBITAL_COLORS[orb.l] || new THREE.Color(1,1,1) 
                });
            }
        }
    }
    return samples;
}

function init() {
    scene = new THREE.Scene();
    camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 1000);
    camera.position.set(60, 60, 140);
    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(window.devicePixelRatio);
    document.body.appendChild(renderer.domElement);

    controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;

    createMoleculesGrid();
    initGUI();

    const gridHelper = new THREE.GridHelper(250, 25, 0x444444, 0x222222);
    gridHelper.rotation.x = Math.PI / 2;
    scene.add(gridHelper);

    window.addEventListener('resize', onWindowResize, false);
    animate();
}

function createMoleculesGrid() {
    moleculeConfigs = [];
    for (let Z = 1; Z <= 20; Z++) {
        const geometryPositions = getMoleculeGeometry(Z);
        const idx = Z - 1;
        const col = idx % COLS;
        const row = Math.floor(idx / COLS);
        const xPos = (col - (COLS - 1) / 2) * ATOM_SPACING;
        const yPos = - (row - 1.5) * ATOM_SPACING;

        moleculeConfigs.push({
            Z, xPos, yPos,
            atomPositions: geometryPositions,
            molInfo: molecules[Z-1]
        });

        createLabel(scene, molecules[Z-1].formula, elementNames[Z-1], xPos, yPos - 12, { scaleX: 12, scaleY: 6 });
    }
}

function spawnElectronObservation() {
    const t = window.APP_STATE?.timeScale ?? 0.5;
    const obsPerSpawn = Math.max(1, Math.round(3 + 17 * t));
    const life = 0.1 + 4.5 * t;
    const baseSize = 5.5 + t * 3;

    if (moleculeConfigs.length === 0) return;
    if (!(window.APP_STATE?.detectionEnabled ?? true)) return;
    
    const cfg = moleculeConfigs[Math.floor(Math.random() * moleculeConfigs.length)];
    const samples = sampleOrbitalsMolecule(cfg.Z, cfg.atomPositions, obsPerSpawn);
    
    for (const sample of samples) {
        const sprite = createDetectionSprite('#ffdca8');
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
    const minInterval = 0.15;
    const maxInterval = 0.01;
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
