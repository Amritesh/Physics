import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GUI } from 'three/addons/libs/lil-gui.module.min.js';
import { getProbabilityDensity } from './physics.js';


// --- Main Application ---

const isMobile = window.innerWidth < 768;

const config = {
    n: 2,
    l: 1,
    m: 0,
    pointCount: isMobile ? 25000 : 100000, // Reduced for mobile
    baseOpacity: 0.3,
    pointSize: 0.15,
    color: '#0088ff',
    scale: 5, // Visual scale factor
    samplingEfficiency: 1000 // Points to try per frame? Or just generate all at once.
};

let scene, camera, renderer, points, material, geometry;
let orbitControls;

function init() {
    scene = new THREE.Scene();
    
    camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    camera.position.z = 20;

    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(window.devicePixelRatio);
    document.body.appendChild(renderer.domElement);

    orbitControls = new OrbitControls(camera, renderer.domElement);
    orbitControls.enableDamping = true;

    // Setup Points
    geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(config.pointCount * 3);
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));

    material = new THREE.PointsMaterial({
        color: config.color,
        size: config.pointSize,
        transparent: true,
        opacity: config.baseOpacity,
        sizeAttenuation: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false
    });

    points = new THREE.Points(geometry, material);
    scene.add(points);

    // GUI
    const gui = new GUI();
    const folderParams = gui.addFolder('Quantum Numbers');
    folderParams.add(config, 'n', 1, 7, 1).name('n').onChange(updateCloud);
    folderParams.add(config, 'l', 0, 6, 1).name('l').onChange(() => {
        // Enforce l < n
        if (config.l >= config.n) config.l = config.n - 1;
        updateCloud();
    });
    folderParams.add(config, 'm', -6, 6, 1).name('m').onChange(() => {
        // Enforce |m| <= l
        if (Math.abs(config.m) > config.l) config.m = Math.sign(config.m) * config.l;
        updateCloud();
    });
    folderParams.close();

    const folderVis = gui.addFolder('Visualization');
    folderVis.add(config, 'pointCount', 1000, 500000, 1000).onFinishChange(reinitBuffer);
    folderVis.addColor(config, 'color').onChange(v => material.color.set(v));
    folderVis.add(config, 'baseOpacity', 0.01, 1).onChange(v => material.opacity = v);
    folderVis.add(config, 'pointSize', 0.01, 1).onChange(v => material.size = v);
    folderVis.close();

    // Auto-close on mobile
    if (window.innerWidth < 768) {
        gui.close();
    }

    window.addEventListener('resize', onWindowResize, false);

    // Initial Generation
    generatePoints();
    
    animate();
}

function reinitBuffer() {
    scene.remove(points);
    geometry.dispose();
    geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(config.pointCount * 3);
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    points = new THREE.Points(geometry, material);
    scene.add(points);
    updateCloud();
}

function updateCloud() {
    // Validate quantum numbers
    if (config.l >= config.n) config.l = config.n - 1;
    if (Math.abs(config.m) > config.l) config.m = Math.sign(config.m) * config.l;
    
    generatePoints();
}

function generatePoints() {
    const positions = points.geometry.attributes.position.array;
    let count = 0;
    
    // Metropolis-Hastings Algorithm
    // This is much more efficient than rejection sampling for high dimensions/sparse volumes
    
    let x = 1, y = 1, z = 1; // Start somewhere away from 0
    let currentProb = getProbabilityDensity(x, y, z, config.n, config.l, config.m);
    
    // Auto-scale step size based on n
    // Size of orbital is roughly n^2
    const stepSize = config.n * 1.5; 
    
    // Burn-in (find a good starting spot)
    for(let i=0; i<1000; i++) {
        const dx = (Math.random() - 0.5) * stepSize;
        const dy = (Math.random() - 0.5) * stepSize;
        const dz = (Math.random() - 0.5) * stepSize;
        
        const nextX = x + dx;
        const nextY = y + dy;
        const nextZ = z + dz;
        
        const nextProb = getProbabilityDensity(nextX, nextY, nextZ, config.n, config.l, config.m);
        
        if (nextProb > currentProb || Math.random() < nextProb / currentProb) {
            x = nextX; y = nextY; z = nextZ;
            currentProb = nextProb;
        }
    }

    // Sampling
    // To fill the array, we just keep walking.
    // Note: This creates correlated samples. For static visualization, it's usually fine.
    // To reduce correlation, we could take a sample every K steps, but that's expensive.
    
    for (let i = 0; i < config.pointCount; i++) {
        // Propose new step
        const dx = (Math.random() - 0.5) * stepSize;
        const dy = (Math.random() - 0.5) * stepSize;
        const dz = (Math.random() - 0.5) * stepSize;
        
        const nextX = x + dx;
        const nextY = y + dy;
        const nextZ = z + dz;
        
        const nextProb = getProbabilityDensity(nextX, nextY, nextZ, config.n, config.l, config.m);
        
        // Metropolis Acceptance Criterion
        // If nextProb > currentProb, accept (ratio > 1)
        // If nextProb < currentProb, accept with probability ratio
        
        // Handle case where currentProb is 0 (should be rare after burn-in)
        let accept = false;
        if (currentProb === 0) {
            accept = true; 
        } else {
             if (Math.random() < nextProb / currentProb) {
                 accept = true;
             }
        }
        
        if (accept) {
            x = nextX;
            y = nextY;
            z = nextZ;
            currentProb = nextProb;
        }
        
        // Store point (even if we didn't move, we add the current position to represent density)
        // Actually, for better visuals, maybe only add if we moved? 
        // No, standard M-H says add the current state (old or new). 
        // Adding the same point creates a bright spot, which is correct for density.
        
        // Visual Scaling
        positions[i * 3] = x;
        positions[i * 3 + 1] = y;
        positions[i * 3 + 2] = z;
    }
    
    points.geometry.attributes.position.needsUpdate = true;
    
    // Adjust camera roughly? No, let user control it.
}

function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}

let frameCount = 0;
function animate() {
    requestAnimationFrame(animate);
    
    frameCount++;
    if (window.APP_STATE?.paused) {
        orbitControls.update();
        renderer.render(scene, camera);
        return;
    }

    if (window.APP_STATE?.lowQuality && frameCount % 2 !== 0) {
        return;
    }
    
    // Slowly rotate the cloud for effect
    // Compensate rotation speed if skipping frames?
    // Ideally use delta time, but for simplicity we'll just rotate.
    points.rotation.y += 0.001 * (window.APP_STATE?.lowQuality ? 2 : 1);
    
    orbitControls.update();
    renderer.render(scene, camera);
}

init();
