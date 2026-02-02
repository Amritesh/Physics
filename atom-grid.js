import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GUI } from 'three/addons/libs/lil-gui.module.min.js';
import { getRealProbabilityDensity } from './physics.js';
import { getElectronConfiguration, elementSymbols, elementNames } from './atom-data.js';
import { generateOrbitalPoints, createLabel } from './utils.js';

// Configuration
const CONFIG = {
    pointsPerElectron: 2000,
    sharpness: 2.0, // Exponent for sampling probability (1 = standard |psi|^2)
    pointSize: 0.15,
    opacity: 0.5
};

const ATOM_SPACING = 25;
const COLS = 5;

// Colors for Orbitals (l)
const ORBITAL_COLORS = {
    0: new THREE.Color(1, 0.2, 0.2), // s: Red
    1: new THREE.Color(0.2, 1, 0.2), // p: Green
    2: new THREE.Color(0.2, 0.5, 1), // d: Blue
    3: new THREE.Color(1, 1, 0.2)    // f: Yellow
};

let scene, camera, renderer, controls;
let FRAME_COUNTER = 0;

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
    
    // Create Grid of Atoms
    createAtomsGrid();
    initGUI();

    // Add Grid Helper
    const gridHelper = new THREE.GridHelper(200, 20, 0x444444, 0x222222);
    gridHelper.rotation.x = Math.PI / 2; // Rotate to match the atomic grid plane (xy)
    scene.add(gridHelper);

    window.addEventListener('resize', onWindowResize, false);
    
    animate();
}

// generateOrbitalPoints moved to utils.js

let atomMeshes = [];

function createAtomsGrid() {
    // Clear existing
    atomMeshes.forEach(mesh => scene.remove(mesh));
    atomMeshes = [];
    
    // Cleanup sprites? We'll leave labels for now or clear them too if we want full regen.
    // Ideally we should group them.
    // For now, let's just regen the Points.

    for (let Z = 1; Z <= 20; Z++) {
        const orbitals = getElectronConfiguration(Z);
        
        // Collect all points and colors for this atom
        const allPositions = [];
        const allColors = [];

        for (const orb of orbitals) {
            const orbPoints = generateOrbitalPoints(orb.n, orb.l, orb.m, orb.Zeff || 1, CONFIG.pointsPerElectron);
            const color = ORBITAL_COLORS[orb.l] || new THREE.Color(1,1,1);
            
            for (let i = 0; i < orbPoints.length; i+=3) {
                allPositions.push(orbPoints[i], orbPoints[i+1], orbPoints[i+2]);
                allColors.push(color.r, color.g, color.b);
            }
        }

        const geometry = new THREE.BufferGeometry();
        geometry.setAttribute('position', new THREE.Float32BufferAttribute(allPositions, 3));
        geometry.setAttribute('color', new THREE.Float32BufferAttribute(allColors, 3));

        const material = new THREE.PointsMaterial({
            size: CONFIG.pointSize,
            vertexColors: true,
            transparent: true,
            opacity: CONFIG.opacity,
            blending: THREE.AdditiveBlending,
            depthWrite: false,
        });

        const atomPoints = new THREE.Points(geometry, material);
        atomMeshes.push(atomPoints);

        // Position in Grid
        // 0-based index
        const idx = Z - 1;
        const col = idx % COLS;
        const row = Math.floor(idx / COLS);

        // Centering: 5 cols -> -2, -1, 0, 1, 2 ?
        // Or just positive.
        // Let's center the whole block.
        // width = (COLS-1)*ATOM_SPACING
        // height = (ROWS-1)*ATOM_SPACING
        
        const xPos = (col - (COLS - 1) / 2) * ATOM_SPACING;
        const yPos = - (row - 1.5) * ATOM_SPACING; // Flip row so Hydrogen is top
        
        atomPoints.position.set(xPos, yPos, 0);
        
        // Add Label (only once ideally, but simple check)
        // If we regen, we don't want duplicate labels.
        // We'll rely on the user not spamming regen or we should manage labels.
        // Let's assume labels are static and we only remove atomPoints from scene.
        
           if (scene.children.filter(c => c.isSprite && c.position.x === xPos && c.position.y === yPos - 8).length === 0) {
               createLabel(scene, elementSymbols[Z-1], elementNames[Z-1], xPos, yPos - 8, { scaleX: 10, scaleY: 5 });
           }

        scene.add(atomPoints);
    }
}

function updateVisualization() {
    createAtomsGrid();
}

function initGUI() {
    const gui = new GUI();
    gui.add(CONFIG, 'pointsPerElectron', 500, 5000, 100).name('Points/Electron');
    gui.add(CONFIG, 'sharpness', 1, 5, 0.1).name('Sharpness').onChange(() => {
        // Debounce?
    });
    gui.add(CONFIG, 'pointSize', 0.05, 0.5, 0.01).name('Point Size').onChange(v => {
        atomMeshes.forEach(m => m.material.size = v);
    });
    gui.add(CONFIG, 'opacity', 0.1, 1, 0.05).name('Opacity').onChange(v => {
        atomMeshes.forEach(m => m.material.opacity = v);
    });
    
    gui.add({ regen: updateVisualization }, 'regen').name('Re-Generate');
}

// Label creation moved to utils.createLabel

function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}

function animate() {
    requestAnimationFrame(animate);

    FRAME_COUNTER++;
    if (window.APP_STATE?.paused) {
        controls.update();
        renderer.render(scene, camera);
        return;
    }

    if (window.APP_STATE?.lowQuality && (FRAME_COUNTER % 2 === 1)) {
        // Skip half frames in low quality mode
        controls.update();
        renderer.render(scene, camera);
        return;
    }

    // Rotate atoms slowly
    scene.children.forEach(child => {
        if (child.isPoints) {
            child.rotation.y += 0.005 * (window.APP_STATE?.lowQuality ? 0.5 : 1);
        }
    });

    controls.update();
    renderer.render(scene, camera);
}

init();
