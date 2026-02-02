import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GUI } from 'three/addons/libs/lil-gui.module.min.js';
import { getRealProbabilityDensity } from './physics.js';
import { getElectronConfiguration, elementSymbols, elementNames } from './atom-data.js';
import { getMoleculeGeometry, molecules } from './molecule-data.js';
import { generateOrbitalPoints, createLabel } from './utils.js';

// Configuration
const CONFIG = {
    pointsPerElectron: 2000,
    sharpness: 2.0, // Exponent for sampling probability
    pointSize: 0.2,
    opacity: 0.4
};

const ATOM_SPACING = 35; // Wider spacing for molecules
const COLS = 5;

// Colors for Orbitals (l)
const ORBITAL_COLORS = {
    0: new THREE.Color(1, 0.2, 0.2), // s: Red
    1: new THREE.Color(0.2, 1, 0.2), // p: Green
    2: new THREE.Color(0.2, 0.5, 1), // d: Blue
    3: new THREE.Color(1, 1, 0.2)    // f: Yellow
};

let scene, camera, renderer, controls;
let atomMeshes = [];
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
    
    createMoleculesGrid();
    initGUI();

    // Add Grid Helper
    const gridHelper = new THREE.GridHelper(250, 25, 0x444444, 0x222222);
    gridHelper.rotation.x = Math.PI / 2;
    scene.add(gridHelper);

    window.addEventListener('resize', onWindowResize, false);
    
    animate();
}

// generateOrbitalPoints moved to utils.js

function createMoleculesGrid() {
    atomMeshes.forEach(mesh => scene.remove(mesh));
    atomMeshes = [];

    for (let Z = 1; Z <= 20; Z++) {
        const geometryPositions = getMoleculeGeometry(Z); // Array of {x,y,z}
        const orbitals = getElectronConfiguration(Z); // One atom's config
        
        const allPositions = [];
        const allColors = [];

        // For each orbital type in the atom
        for (const orb of orbitals) {
            // Generate points for ONE atom
            const basePoints = generateOrbitalPoints(orb.n, orb.l, orb.m, orb.Zeff || 1, CONFIG.pointsPerElectron);
            const color = ORBITAL_COLORS[orb.l] || new THREE.Color(1,1,1);
            
            // Replicate for each atom in the molecule
            for (const atomPos of geometryPositions) {
                for (let i = 0; i < basePoints.length; i+=3) {
                    allPositions.push(basePoints[i] + atomPos.x, basePoints[i+1] + atomPos.y, basePoints[i+2] + atomPos.z);
                    allColors.push(color.r, color.g, color.b);
                }
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

        const pointsMesh = new THREE.Points(geometry, material);
        atomMeshes.push(pointsMesh);

        // Position in Grid
        const idx = Z - 1;
        const col = idx % COLS;
        const row = Math.floor(idx / COLS);
        
        const xPos = (col - (COLS - 1) / 2) * ATOM_SPACING;
        const yPos = - (row - 1.5) * ATOM_SPACING;
        
        pointsMesh.position.set(xPos, yPos, 0);
        
        // Label with Formula
        const molInfo = molecules[Z-1];
           if (scene.children.filter(c => c.isSprite && c.position.x === xPos && c.position.y === yPos - 12).length === 0) {
               createLabel(scene, molInfo.formula, elementNames[Z-1], xPos, yPos - 12, { scaleX: 12, scaleY: 6 });
           }

        scene.add(pointsMesh);
    }
}

// Label creation moved to utils.createLabel

function updateVisualization() {
    createMoleculesGrid();
}

function initGUI() {
    const gui = new GUI();
    gui.add(CONFIG, 'pointsPerElectron', 500, 5000, 100).name('Points/Electron');
    gui.add(CONFIG, 'sharpness', 1, 5, 0.1).name('Sharpness');
    gui.add(CONFIG, 'pointSize', 0.05, 0.5, 0.01).name('Point Size').onChange(v => {
        atomMeshes.forEach(m => m.material.size = v);
    });
    gui.add(CONFIG, 'opacity', 0.1, 1, 0.05).name('Opacity').onChange(v => {
        atomMeshes.forEach(m => m.material.opacity = v);
    });
    
    gui.add({ regen: updateVisualization }, 'regen').name('Re-Generate');
}

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
        controls.update();
        renderer.render(scene, camera);
        return;
    }

    controls.update();
    renderer.render(scene, camera);
}

init();
