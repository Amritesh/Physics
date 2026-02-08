import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GUI } from 'three/addons/libs/lil-gui.module.min.js';
import { getProbabilityDensity, getRealProbabilityDensity } from './physics.js';

// Override wrapper for correct scaling with Real Orbitals
function getRealProbabilityDensityWrapper(x, y, z, n, l, m, Z, hScale) {
    // Rescale coordinates to standard Bohr units
    // If hScale is 1, we pass x,y,z.
    // If hScale is 0.1 (collapse), the atom is small.
    // At x=0.1, it should act like x=1.
    // So we pass x/hScale.
    
    const xs = x / hScale;
    const ys = y / hScale;
    const zs = z / hScale;
    
    // Get density in standard units
    // For l=0 we can use the complex one which supports hScale internally (but we might as well be consistent)
    // Actually getProbabilityDensity in physics.js supports hScale.
    // getRealProbabilityDensity does NOT.
    
    let prob = 0;
    if (l === 0) {
        // S orbitals are spherical, complex vs real doesn't matter much (except phase).
        // Let's use the standard one that has hScale support.
        prob = getProbabilityDensity(x, y, z, n, l, m, Z, hScale);
    } else {
        // Use Real orbitals for lobes (p, d, f)
        // We manually scale inputs to the function which expects standard units
        prob = getRealProbabilityDensity(xs, ys, zs, n, l, m, Z);
        // Probability density scales as 1/V ~ 1/L^3.
        // So if space scales by hScale, density scales by 1/hScale^3.
        prob = prob / (hScale * hScale * hScale);
    }
    
    return prob;
}

// --- Configuration & Physics Constants ---

const config = {
Z: 6,                 // Atomic Number (Default to Carbon for visualization check)
alphaScale: 1.0,      // Multiplier for fine-structure constant (alpha)
baseAlpha: 1/137.036, // ~0.007297

// Visualization settings
pointCount: 1000, // Fixed points per electron
baseOpacity: 0.4,   // Slightly higher opacity for smaller points
pointSize: 0.05,    // Reduced point size for sharpness (was 0.15)
nucleusScale: 0.05, // Small non-zero default so user knows it's there, but tiny
color: '#0088ff',
autoRotate: true,
visibility: {}      // Stores toggle state for orbitals (e.g., "1s": true)
};

// Physics thresholds
const CRITICAL_Z_ALPHA = 1.0; // Point source Dirac equation limit
// const MIN_BINDING_ALPHA = 0.0001; // Arbitrary low limit for "no binding"

let scene, camera, renderer, points, material, geometry;
let nucleusGroup; // Group to hold protons and neutrons
let orbitControls;
let gui;

// Cache for electron configuration
let currentOrbitals = [];

// --- Element Data (Simplified up to Z=92) ---
// We'll generate configuration on the fly using Madelung rule
function getOrbitalsForZ(Z) {
    const orbitals = [];
    let electronsRemaining = Z;
    
    // Order: 1s, 2s, 2p, 3s, 3p, 4s, 3d, 4p, 5s, 4d, 5p, 6s, 4f, 5d, 6p, 7s, 5f, 6d, 7p
    const subshells = [
        {n:1, l:0, cap:2},
        {n:2, l:0, cap:2}, {n:2, l:1, cap:6},
        {n:3, l:0, cap:2}, {n:3, l:1, cap:6},
        {n:4, l:0, cap:2}, {n:3, l:2, cap:10}, {n:4, l:1, cap:6},
        {n:5, l:0, cap:2}, {n:4, l:2, cap:10}, {n:5, l:1, cap:6},
        {n:6, l:0, cap:2}, {n:4, l:3, cap:14}, {n:5, l:2, cap:10}, {n:6, l:1, cap:6},
        {n:7, l:0, cap:2}, {n:5, l:3, cap:14}, {n:6, l:2, cap:10}
    ];

    for (const sub of subshells) {
        if (electronsRemaining <= 0) break;
        const count = Math.min(electronsRemaining, sub.cap);
        electronsRemaining -= count;
        
        // Store all subshells to visualize full electron cloud
        orbitals.push({ ...sub, count });
    }
    return orbitals;
}

function init() {
    scene = new THREE.Scene();
    
    camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 100000);
    camera.position.z = 20; // Move closer to see nucleus initially

    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(window.devicePixelRatio);
    document.body.appendChild(renderer.domElement);

    orbitControls = new OrbitControls(camera, renderer.domElement);
    orbitControls.enableDamping = true;

    // Add Lights for Nucleus 3D effect
    const ambientLight = new THREE.AmbientLight(0x404040); // Soft white light
    scene.add(ambientLight);
    const directionalLight = new THREE.DirectionalLight(0xffffff, 1);
    directionalLight.position.set(1, 1, 1).normalize();
    scene.add(directionalLight);

    // Setup Points
    // Initial allocation logic same as reinitBuffer
    geometry = new THREE.BufferGeometry();
    const maxElectrons = 120;
    const totalPoints = config.pointCount * maxElectrons;
    
    const positions = new Float32Array(totalPoints * 3);
    const colors = new Float32Array(totalPoints * 3);
    const opacities = new Float32Array(totalPoints); // Custom attribute for opacity
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geometry.setAttribute('aOpacity', new THREE.BufferAttribute(opacities, 1));

    // Crisp visualization material
    material = new THREE.PointsMaterial({
        size: config.pointSize,
        vertexColors: true,
        transparent: true,
        opacity: config.baseOpacity,
        sizeAttenuation: true,
        blending: THREE.AdditiveBlending, // Match script.js glow
        depthWrite: false
    });

    points = new THREE.Points(geometry, material);
    scene.add(points);

    // Setup Nucleus Group
    nucleusGroup = new THREE.Group();
    scene.add(nucleusGroup);

    setupGUI();
    updateOrbitalVisibilityGUI(); // Initialize visibility controls
    
    window.addEventListener('resize', onWindowResize, false);

    updateSimulation();
    animate();
}

// --- Nucleus Generation ---
function createNucleus(Z) {
    if (nucleusGroup) {
        // Clear previous nucleus
        while(nucleusGroup.children.length > 0){
            const child = nucleusGroup.children[0];
            if(child.geometry) child.geometry.dispose();
            if(child.material) child.material.dispose();
            nucleusGroup.remove(child);
        }
    } else {
        nucleusGroup = new THREE.Group();
        scene.add(nucleusGroup);
    }
    
    // Estimate Neutron count (Stability line approximation)
    // Light elements N ~ Z. Heavy elements N ~ 1.5 Z.
    // Carbon (Z=6) -> N=6. Uranium (Z=92) -> N=146.
    let N = Math.round(Z * (1 + 0.005 * Z));
    if (Z === 1) N = 0; // Hydrogen-1
    if (Z === 6) N = 6; // Carbon-12 explicit

    // Scale nucleons so they are visible but small compared to electron cloud
    // Real scale: Nucleus is 1e-5 smaller. We need artistic license.
    // Let's make the nucleus roughly 0.5 units in radius for Carbon.
    const nucleonRadius = 0.15;
    
    const protonMaterial = new THREE.MeshPhongMaterial({ color: 0xff0000, shininess: 100 });
    const neutronMaterial = new THREE.MeshPhongMaterial({ color: 0x8888ff, shininess: 100 }); // Blueish/Grey
    const protonGeo = new THREE.SphereGeometry(nucleonRadius, 16, 16);
    const neutronGeo = new THREE.SphereGeometry(nucleonRadius, 16, 16);

    const nucleons = [];
    for (let i = 0; i < Z; i++) nucleons.push({ type: 'proton' });
    for (let i = 0; i < N; i++) nucleons.push({ type: 'neutron' });

    // Simple random packing in a sphere
    // Shuffle
    for (let i = nucleons.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [nucleons[i], nucleons[j]] = [nucleons[j], nucleons[i]];
    }

    const phi = Math.PI * (3 - Math.sqrt(5)); // Golden angle

    nucleons.forEach((nucleon, i) => {
        // Fibonacci sphere distribution for packing
        const y = 1 - (i / (nucleons.length - 1)) * 2; // y goes from 1 to -1
        if (!isFinite(y)) { // Handle single nucleon case
             const mesh = new THREE.Mesh(
                nucleon.type === 'proton' ? protonMaterial : neutronMaterial,
                nucleon.type === 'proton' ? protonGeo : neutronGeo
            );
            nucleusGroup.add(mesh);
            return;
        }

        const radiusAtY = Math.sqrt(1 - y * y);
        const theta = phi * i;

        const x = Math.cos(theta) * radiusAtY;
        const z = Math.sin(theta) * radiusAtY;

        // Scale by nucleus size (approx A^(1/3))
        const A = Z + N;
        const nucleusRadius = 0.3 * Math.pow(A, 1/3);
        
        // Random jitter to make it look less perfect and more like a cluster
        const r = nucleusRadius * Math.pow(Math.random(), 1/3); // Uniform distribution in sphere
        
        const mesh = new THREE.Mesh(
            nucleon.type === 'proton' ? protonMaterial : neutronMaterial,
            nucleon.type === 'proton' ? protonGeo : neutronGeo
        );
        
        // Position on the surface of the growing sphere? No, pack them.
        // Simple heuristic: Place at (x,y,z) scaled by A^(1/3) is too hollow.
        // Let's just use the fibonacci points as centers.
        // Distance between points on unit sphere is ~ 3.6/sqrt(N).
        // We want distance ~ 2*nucleonRadius.
        // Scale factor S so that S * 3.6/sqrt(A) = 2*r0.
        // S = 2*r0 * sqrt(A) / 3.6.
        
        // Simpler: Just random position inside a sphere of radius R_nuc
        // R_nuc = r0 * A^(1/3)
        // Check collision? Too expensive.
        // Just use the fibonacci lattice scaled.
        
        const packScale = 0.25 * Math.pow(A, 1/3);
        
        mesh.position.set(x * packScale, y * packScale, z * packScale);
        nucleusGroup.add(mesh);
    });
}

function setupGUI() {
    gui = new GUI();
    
    gui.add(config, 'Z', 1, 92, 1).name('Atomic Number (Z)').onChange(updateSimulation);

    // Use a custom object to proxy the alpha scale for non-linear slider behavior
    const alphaControl = {
        get scale() {
            // Logarithmic-like behavior:
            // We want fine control near 0-1, and coarser control > 1.
            // Let's map slider 0..1 to alpha 0..1, and slider 1..10 to alpha 1..200
            // Actually, user asked for smoother ranges 1 and below.
            // Let's just use a large range but maybe change step size?
            // Or better: Use two sliders or a non-linear mapping.
            // Let's implement a non-linear mapping on a single slider 0-100.
            return config.alphaScale;
        },
        set scale(v) {
            config.alphaScale = v;
            updateSimulation();
        },
        // Display value for the slider
        get sliderValue() {
             if (config.alphaScale <= 1) return config.alphaScale;
             // Map 1..200 to 1..10
             return 1 + Math.log10(config.alphaScale) * 4.0; // Just an example
        },
        set sliderValue(v) {
             // Inverse map
             if (v <= 1) config.alphaScale = v;
             else config.alphaScale = Math.pow(10, (v - 1) / 4.0);
             updateSimulation();
        }
    };
    
    // Actually, simpler approach: Just use a custom mapping function in the onChange
    // Let the slider go from 0 to 200.
    // But that makes 0.1 impossible to hit.
    // User request: "Scale alpha slider needs to be smother on ranges 1 and below as smoothly as i am scaling for above 1 use proportianl scale"
    // Interpretation: The region 0..1 should take up significant slider space.
    // Maybe slider -2 to +2 (log10)?
    // 10^-2 = 0.01
    // 10^2 = 100
    // 10^0 = 1
    
    config.logAlpha = 0; // log10(alphaScale)
    
    gui.add(config, 'logAlpha', -2, 2.5, 0.01)
        .name('Log10(Scale α)')
        .onChange(v => {
            config.alphaScale = Math.pow(10, v);
            updateSimulation();
        });

    config.folderOrbitals = gui.addFolder('Orbitals');

    const folderVis = gui.addFolder('Visualization');
    folderVis.add(config, 'pointCount', 1000, 50000, 1000).name('Points per Electron').onFinishChange(reinitBuffer);
    folderVis.add(config, 'pointSize', 0.01, 0.5, 0.01).name('Point Size').onChange(v => material.size = v);
    folderVis.add(config, 'baseOpacity', 0.01, 1.0, 0.01).name('Opacity').onChange(v => material.opacity = v);
    folderVis.add(config, 'nucleusScale', 0.05, 1.0, 0.05).name('Nucleus Scale').onChange(generateNucleus);
    folderVis.addColor(config, 'color').onChange(v => material.color.set(v));
    folderVis.add(config, 'autoRotate');
    
    // Presets
    const folderPresets = gui.addFolder('Scenarios');
    const presets = {
        'Normal': () => {
            config.alphaScale = 1.0;
            config.logAlpha = 0;
            updateSimulation();
            gui.controllers.forEach(c => c.updateDisplay());
        },
        'Strong Force (Collapse)': () => {
            config.alphaScale = 150;
            config.logAlpha = Math.log10(150);
            updateSimulation();
            gui.controllers.forEach(c => c.updateDisplay());
        },
        'Weak Force (Unbound)': () => {
            config.alphaScale = 0.05;
            config.logAlpha = Math.log10(0.05);
            updateSimulation();
            gui.controllers.forEach(c => c.updateDisplay());
        }
    };
    folderPresets.add(presets, 'Normal');
    folderPresets.add(presets, 'Strong Force (Collapse)');
    folderPresets.add(presets, 'Weak Force (Unbound)');
}

function updateOrbitalVisibilityGUI() {
    if (!config.folderOrbitals) return;
    
    // Clear existing controllers
    // lil-gui doesn't have a clear() method for folders easily exposed,
    // but we can destroy and recreate or remove children.
    // simpler to remove children if possible.
    const controllers = [...config.folderOrbitals.controllers];
    controllers.forEach(c => c.destroy());

    // Get current orbitals
    const subshells = getOrbitalsForZ(config.Z);
    const orbitalNames = [];

    subshells.forEach(sub => {
        const lNames = ['s', 'p', 'd', 'f', 'g'];
        const name = `${sub.n}${lNames[sub.l]}`;
        orbitalNames.push(name);

        // Initialize visibility state if not present
        if (config.visibility[name] === undefined) {
            config.visibility[name] = true;
        }

        config.folderOrbitals.add(config.visibility, name)
            .name(name)
            .onChange(() => {
                // Just regenerate the cloud without recalculating physics/nucleus
                // We need to pass the current alpha params
                const currentAlpha = config.baseAlpha * config.alphaScale;
                const zAlpha = config.Z * currentAlpha;
                generateCloud(zAlpha, currentAlpha);
            });
    });
    
    // Clean up visibility keys that are no longer active?
    // Maybe keep them to remember preferences if user scrolls Z back and forth.
}

function reinitBuffer() {
    scene.remove(points);
    geometry.dispose();
    geometry = new THREE.BufferGeometry();
    
    // Allocate buffer large enough for max Z (92) * pointsPerElectron
    // This prevents need for constant reallocation.
    // If config.pointCount is "points per electron", we need space for ~100 electrons max.
    // Let's allocate for 100 * config.pointCount.
    const maxElectrons = 120; // Safe margin
    const totalPoints = config.pointCount * maxElectrons;
    
    const positions = new Float32Array(totalPoints * 3);
    const colors = new Float32Array(totalPoints * 3);
    const opacities = new Float32Array(totalPoints);
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geometry.setAttribute('aOpacity', new THREE.BufferAttribute(opacities, 1));
    points = new THREE.Points(geometry, material);
    scene.add(points);
    updateSimulation();
}

function updateSimulation() {
    // 1. Calculate Physics State
    const currentAlpha = config.baseAlpha * config.alphaScale;
    const zAlpha = config.Z * currentAlpha;

    // Update GUI for orbitals if Z changed
    // We can just call it safely every time or check if Z changed.
    updateOrbitalVisibilityGUI();
    
    const statusEl = document.getElementById('stability-status');
    const valZ = document.getElementById('val-z');
    const valAlpha = document.getElementById('val-alpha');
    const valZAlpha = document.getElementById('val-zalpha');
    const valE = document.getElementById('val-e');

    valZ.textContent = config.Z;
    valAlpha.textContent = currentAlpha.toExponential(2);
    valZAlpha.textContent = zAlpha.toFixed(3);

    // Estimate Ground State Binding Energy (Bohr model approximation with Z)
    // E = -13.6 eV * Z^2 * (alpha/alpha0)^2 ??
    // Actually E_n = - (m c^2 alpha^2 Z^2) / (2 n^2)
    // So Energy scales with alpha^2.
    // If alpha scales by S, Energy scales by S^2.
    const E_scale = config.alphaScale * config.alphaScale;
    const E_ground = 13.6 * config.Z * config.Z * E_scale; 
    valE.textContent = E_ground > 1e6 ? (E_ground/1e6).toFixed(2) + ' M' : (E_ground > 1e3 ? (E_ground/1e3).toFixed(2) + ' k' : E_ground.toFixed(1));

    // Determine Status - purely informational now, no mode switching
    if (zAlpha > CRITICAL_Z_ALPHA) {
        statusEl.textContent = "RELATIVISTIC COLLAPSE (Simulation failing)";
        statusEl.className = "status-collapse";
    } else if (currentAlpha < 0.0001) {
         statusEl.textContent = "NO BINDING (Thermal Disassociation)";
         statusEl.className = "status-unbound";
    } else {
        statusEl.textContent = "STABLE";
        statusEl.className = "status-stable";
    }

    // 2. Generate Cloud
    generateCloud(zAlpha, currentAlpha);

    // 3. Generate Nucleus
    generateNucleus();
}

function generateNucleus() {
    // Clear previous nucleus
    while(nucleusGroup.children.length > 0){
        const obj = nucleusGroup.children[0];
        obj.geometry.dispose();
        obj.material.dispose();
        nucleusGroup.remove(obj);
    }
    
    // User requested removal of nucleus or negligible scale.
    // If scale is 0, we just return.
    if (config.nucleusScale <= 0.001) return;

    const Z = config.Z;
    // Estimate Mass Number A. Roughly A ~ 2Z for light elements, A > 2Z for heavy.
    // A simple approximation: A = Z + N. N approx Z for light, N approx 1.5Z for heavy.
    // Let's use A = 2*Z for Z<20, and slowly increase ratio.
    const N = Math.round(Z * (1 + 0.005 * Z));
    const A = Z + N;
    
    // Scale nucleon size by config.nucleusScale
    // Realistic: Nucleus is 1/10000 of atom. Visual: make it small but visible dot.
    // User requested "tiny (realistic scale) or remove it if negligible".
    // We'll make it much smaller than before.
    const nucleonRadius = 0.05 * config.nucleusScale;
    
    // Pack nucleons into a sphere.
    // Radius of nucleus ~ A^(1/3).
    const nucleusRadius = nucleonRadius * Math.pow(A, 1/3) * 1.0;

    const protonColor = new THREE.Color(0xff4444);
    const neutronColor = new THREE.Color(0xaaaaaa);

    const sphereGeo = new THREE.SphereGeometry(nucleonRadius, 8, 8);
    const protonMat = new THREE.MeshStandardMaterial({ color: protonColor, roughness: 0.5, metalness: 0.1 });
    const neutronMat = new THREE.MeshStandardMaterial({ color: neutronColor, roughness: 0.5, metalness: 0.1 });

    // Use a golden spiral sphere distribution for packing
    const phi = Math.PI * (3 - Math.sqrt(5)); // Golden angle

    for (let i = 0; i < A; i++) {
        const y = 1 - (i / (A - 1)) * 2; // y goes from 1 to -1
        const radiusAtY = Math.sqrt(1 - y * y); // Radius at y

        const theta = phi * i; // Golden angle increment

        const x = Math.cos(theta) * radiusAtY;
        const z = Math.sin(theta) * radiusAtY;

        // Scale by nucleus radius (add some jitter for realism)
        const r = nucleusRadius * Math.pow(Math.random(), 1/3); // Uniform distribution in sphere if random
        // Actually, spiral gives surface. We want volume.
        // Let's just pack them somewhat randomly but avoiding overlap is hard without physics.
        // Simple random packing in a sphere volume is easier.
        
        // Re-calculate simpler random position inside sphere
        const u = Math.random();
        const v = Math.random();
        const th = 2 * Math.PI * u;
        const ph = Math.acos(2 * v - 1);
        const rad = nucleusRadius * Math.cbrt(Math.random());

        const px = rad * Math.sin(ph) * Math.cos(th);
        const py = rad * Math.sin(ph) * Math.sin(th);
        const pz = rad * Math.cos(ph);

        // Decide if proton or neutron
        // We need exactly Z protons.
        // Let's assign based on i < Z ?
        // Random shuffle is better, but simple is okay.
        const isProton = i < Z;
        
        const mesh = new THREE.Mesh(sphereGeo, isProton ? protonMat : neutronMat);
        mesh.position.set(px, py, pz);
        nucleusGroup.add(mesh);
    }
    
    // Add a light to the nucleus if scene doesn't have one (it doesn't yet)
    // We need lights for MeshStandardMaterial
    if (!scene.getObjectByName("nucleusLight")) {
        const light = new THREE.PointLight(0xffffff, 2, 100);
        light.name = "nucleusLight";
        light.position.set(10, 10, 10);
        scene.add(light);
        const ambient = new THREE.AmbientLight(0x404040);
        scene.add(ambient);
    }
}

function generateCloud(zAlpha, currentAlpha) {
    const positions = points.geometry.attributes.position.array;
    const colors = points.geometry.attributes.color.array;
    const opacities = points.geometry.attributes.aOpacity.array;
    
    // Get orbitals for current Z
    const subshells = getOrbitalsForZ(config.Z);
    
    // Effective Scaling Logic:
    // 1. hScale (from alpha) shrinks/expands everything uniformly.
    // 2. But Atom size naturally grows with n^2 and shrinks with Z.
    //    Radius ~ n^2 / Z_eff.
    //    Our probability functions take (Z, n) as inputs, so they naturally produce
    //    the correct relative sizes (inner shells small, outer shells big).
    //    BUT, for visualization, if we just plot raw coordinates, a Uranium atom (Z=92, n=7)
    //    might have inner shells at 0.01 and outer shells at 10.
    //    Ideally, we want to see the atom grow.
    //    Currently, our camera is fixed at z=15.
    //    If the physics functions are correct, n=7 shell is 49x bigger than n=1 (roughly, ignoring shielding).
    //    Actually with shielding, Z_eff for outer shell is small (~1), so r ~ n^2.
    //    For inner shell, Z_eff ~ Z, so r ~ 1/Z.
    //    So inner shells shrink MASSIVELY as Z increases, while outer shells grow with n.
    //    If the user doesn't see growth, maybe Z is shielding too much in our calc?
    //    We are passing raw Z to getProbabilityDensity!
    //    That means we are simulating Hydrogen-like ions with charge Z.
    //    For Carbon (Z=6), the 2p electron feels Z=6? NO! It feels Z_eff ~ 3.25 (Slater's rules).
    //    If we use raw Z=20 for Calcium 4s, it feels Z=20. Radius ~ 4^2/20 = 0.8.
    //    Real Calcium 4s feels Z_eff ~ 2. Radius ~ 4^2/2 = 8.
    //    So our atoms are SHRINKING because we use bare Z instead of screened Z_eff.
    
    // Fix: Estimate Z_eff for each subshell using Slater's Rules (simplified)
    // or just a rough approximation: Z_eff = Z - shielding.
    // Inner electrons shield fully (1.0). Same shell shield partially (0.35).
    // This is computationally complex to do perfectly for every shell.
    // Simple approx:
    // Z_eff(n) ~ n (very rough, keeps size proportional to n).
    // Or just: Z_eff = Z - (total_inner_electrons).
    
    // Let's implement a quick Z_eff estimator attached to the subshell object.
    
    const hScale = 1.0 / config.alphaScale;

    // Distribute total points among subshells weighted by electron count
    let totalElectrons = 0;
    const lNames = ['s', 'p', 'd', 'f', 'g'];
    
    // Filter active subshells based on visibility
    const activeSubshells = subshells.filter(s => {
        const name = `${s.n}${lNames[s.l]}`;
        return config.visibility[name] !== false; // Default true if undefined
    });

    activeSubshells.forEach(s => totalElectrons += s.count);

    // Scale total points by electron count to show density increase
    // User request: "Set it at 10000" per electron.
    // So total points = 10000 * totalElectrons.
    const effectiveTotalPoints = config.pointCount * totalElectrons;
    
    // Check if we need to resize buffer if it's too small
    if (effectiveTotalPoints > points.geometry.attributes.position.count) {
        // We need to reallocate the buffer to fit the new points
        // The safest way is to call reinitBuffer, but that might cause recursion if not careful.
        // Or we can just expand the geometry here if we had access to it easily.
        // For now, let's just use the maximum available in the current buffer or trigger a reinit if we can.
        // But reinitBuffer uses config.pointCount to init.
        // We should probably change reinitBuffer to allocate enough for max Z.
        // Or just let the user know they need to increase the buffer size via slider?
        // Actually, let's just ensure the buffer is large enough for Z=92 * 10000 ~ 1M points.
        // The original buffer was 100k.
        // Let's not resize dynamically here to avoid flicker/complexity, but we should make sure the initial buffer is big enough.
        // We will update pointCount in config to be the "per electron" count, but the buffer needs to be big.
    }

    // Clear points initially (set to 0,0,0 or just rely on overwriting)
    // If we have fewer active subshells, we might not overwrite all points.
    // So we should zero out the remaining points.
    // Or better: re-initialize buffer if point count significantly changes?
    // For now, let's just zero out unused points at the end.

    let offset = 0;
    
    // Define a palette for different shells (n) and subshells (l)
    // As per user request: "2s green, 2p blue and yellow"
    // We also want to distinguish m-states for p/d orbitals (lobes)
    function getOrbitalColor(n, l, m) {
        // n=1, l=0 (1s) -> white/bright (spherically symmetric)
        if (n === 1 && l === 0) return new THREE.Color(0xffffff);

        // n=2, l=0 (2s) -> green (spherically symmetric)
        if (n === 2 && l === 0) return new THREE.Color(0x00ff00);
        
        // n=2, l=1 (2p) -> distinguish lobes
        if (n === 2 && l === 1) {
             // m=0 (pz) -> Yellow
             // m=1 (px) -> Cyan
             // m=-1 (py) -> Blue
             // Note: Mapping of m to x,y,z depends on convention in getRealWavefunction.
             // In physics.js: m=0 is z, m=1 is x, m=-1 is y.
             if (m === 0) return new THREE.Color(0xffff00); // Yellow (z-axis)
             if (m === 1) return new THREE.Color(0x00ffff); // Cyan (x-axis)
             if (m === -1) return new THREE.Color(0x0000ff); // Blue (y-axis)
        }
        
        // General fallback logic for higher shells
        // Base hue on n and l
        let hue = (n * 0.13 + l * 0.07) % 1.0;
        
        // Shift hue slightly for different m to distinguish lobes in higher orbitals too
        // But keep them related.
        if (l > 0) {
            const mShift = (m / (2 * l + 1)) * 0.1;
            hue = (hue + mShift + 1.0) % 1.0;
        }

        const color = new THREE.Color();
        // Saturation 1.0, Lightness 0.6 for visibility
        color.setHSL(hue, 0.9, 0.6);
        return color;
    }

    // Maintain global state of walkers to enable smooth animation
    // If Z changes, we reset. If not, we continue walking.
    if (!window.simulationState || window.simulationState.Z !== config.Z) {
        window.simulationState = {
            Z: config.Z,
            walkers: {} // map key "n,l,m" -> walker state
        };
    }
    
    // Check if we need to regenerate
    // Since this is expensive (200k points), only do it if Z changed or forced.
    // In this architecture, generateCloud is called by updateSimulation, which is called by GUI.
    // So it's fine to regenerate fully.
    
    activeSubshells.forEach(sub => {
        const n = sub.n;
        const l = sub.l;
        const electronsInSubshell = sub.count;
        
        // Calculate Z_eff using Slater's Rules
        let shielding = 0;
        // 1. Electrons in the same group (same n,l - simplified to same n)
        // actually Slater's rules group (1s) (2s,2p) (3s,3p) (3d) (4s,4p) (4d) (4f) (5s,5p) etc.
        // Simplified:
        // Electrons in same shell n shield 0.35 each.
        // Electrons in n-1 shield 0.85 each (for s,p) or 1.0 (for d,f).
        // Electrons in n-2 or lower shield 1.0.
        
        for (const other of subshells) {
            if (other === sub) {
                 shielding += (other.count - 1) * 0.35;
            } else if (other.n === n) {
                 // Simplified: same shell
                 shielding += other.count * 0.35;
            } else if (other.n === n - 1) {
                 shielding += other.count * 0.85;
            } else if (other.n < n - 1) {
                 shielding += other.count * 1.0;
            }
        }
        
        let Zeff = Math.max(0.1, config.Z - shielding);

        // Calculate visual scale
        // In physics, r ~ n^2/Zeff.
        const orbitalScale = (n * n) / Zeff;
        
        // Step size for Metropolis
        const stepSize = orbitalScale * 2.5;

        // --- Handling m-states correctly (Hund's Rule / Pauli Exclusion) ---
        // Instead of randomizing m per point (spherical average), we assign points to specific m-orbitals.
        // For subshell with 'electronsInSubshell' electrons:
        // 1. Fill unique m states first (Hund's rule maximizes spin, so different orbitals).
        // 2. If electrons > number of m states (2l+1), double up.
        // For visualization, we just need to know WHICH spatial orbitals (m values) are occupied.
        // m goes from -l to +l.
        // Order of filling (standard convention for p): usually pz(0), then px, py (or -1, +1).
        // Let's iterate available m's.
        
        // Determine which m-orbitals are active
        const mStates = [];
        // Standard filling order for visualization clarity: 0, 1, -1, 2, -2...
        // This ensures pz (z-axis) fills first, then x/y axes.
        const mOrder = [0];
        for (let k = 1; k <= l; k++) {
            mOrder.push(k);
            mOrder.push(-k);
        }
        
        let occupiedCount = 0;
        // Count how many spatial orbitals are occupied (1 or 2 electrons doesn't change shape, just density/phase,
        // but here we just want to show the shape exists).
        // If we have 1 electron, we show 1 lobe pair.
        // If we have 2 electrons (p2 like Carbon), we show 2 lobe pairs (orthogonal).
        // If we have 3 electrons (p3 like Nitrogen), we show 3 lobe pairs.
        // If we have 4 electrons (p4 like Oxygen), we still show 3 spatial orbitals (one is doubly occupied).
        
        const numSpatialOrbitals = Math.min(electronsInSubshell, 2*l + 1);
        
        // Distribute points among the active m-states
        // effectiveTotalPoints is scaled by Z.
        // pointsPerM = (Total * (electronsInSub / TotalElectrons)) / Spatial
        //            = (Base * TotalElectrons * electronsInSub / TotalElectrons) / Spatial
        //            = (Base * electronsInSub) / Spatial
        // This gives constant density per electron!
        const pointsPerM = Math.floor((effectiveTotalPoints * (electronsInSubshell / totalElectrons)) / numSpatialOrbitals);
        
        if (pointsPerM === 0) return;

        for (let k = 0; k < numSpatialOrbitals; k++) {
            const m = mOrder[k];
            
            // Initialize Walker for this specific m
            // Randomize start position better to find the lobes
            let x, y, z;
            let currentProb = 0;
            
            // Burn-in: Try to find a high probability region to start
            // For p/d orbitals, 0,0,0 has 0 probability. We need to be careful.
            let attempts = 0;
            const range = orbitalScale * 5.0; // Search wider
            
            while(currentProb < 1e-4 && attempts < 500) {
                x = (Math.random()-0.5) * range;
                y = (Math.random()-0.5) * range;
                z = (Math.random()-0.5) * range;
                currentProb = getRealProbabilityDensityWrapper(x, y, z, n, l, m, Zeff, hScale);
                attempts++;
            }

            // If we failed to find a good spot, just pick a random one and hope the walker finds it
            if (currentProb < 1e-9) {
                 x = orbitalScale; y = orbitalScale; z = orbitalScale;
                 currentProb = getRealProbabilityDensityWrapper(x, y, z, n, l, m, Zeff, hScale);
            }
            
            // Walk
            for (let i = 0; i < pointsPerM; i++) {
                const idx = offset + i;
                // removed break config.pointCount
                
                // M-H Step
                for(let j=0; j<5; j++) {
                    const dx = (Math.random()-0.5)*stepSize;
                    const dy = (Math.random()-0.5)*stepSize;
                    const dz = (Math.random()-0.5)*stepSize;
                    const nx=x+dx, ny=y+dy, nz=z+dz;
                    
                    const np = getRealProbabilityDensityWrapper(nx, ny, nz, n, l, m, Zeff, hScale);
                    
                    if (np > currentProb || Math.random() < np/currentProb) {
                        x=nx; y=ny; z=nz; currentProb=np;
                    }
                }
                
                positions[idx*3] = x;
                positions[idx*3+1] = y;
                positions[idx*3+2] = z;
                
                // Color coding by m-state for p/d orbitals to distinguish lobes
                let ptColor;
                if (l > 0) {
                     // Use specific colors for axes/orientations if requested, or just keep shell color
                     // User said: "Two orthogonal dumbbell shapes". Different colors help distinguish.
                     // Let's vary lightness or hue slightly based on m.
                     const baseC = getOrbitalColor(n, l, m);
                     ptColor = baseC;
                } else {
                     ptColor = getOrbitalColor(n, l, m);
                }

                colors[idx*3] = ptColor.r;
                colors[idx*3+1] = ptColor.g;
                colors[idx*3+2] = ptColor.b;
            }
            offset += pointsPerM;
        }
    });
    
    // Zero out remaining points to hide them
    // We allocated for maxElectrons * pointCount, but only used 'offset' points.
    const maxPoints = points.geometry.attributes.position.count;
    for (let i = offset; i < maxPoints; i++) {
        positions[i*3] = 0;
        positions[i*3+1] = 0;
        positions[i*3+2] = 0;
    }

    points.geometry.attributes.position.needsUpdate = true;
    points.geometry.attributes.color.needsUpdate = true;
    points.geometry.attributes.aOpacity.needsUpdate = true;
    
    // Adjust camera to fit the cloud roughly
    // The cloud size scales with hScale^2
    const maxN = subshells.length > 0 ? subshells[subshells.length-1].n : 1;
    const expectedRadius = maxN * maxN * hScale * hScale;
    
    // Auto-adjust camera dist if needed, but smooth
    // For now, keep it manual via OrbitControls
}

function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}

function animate() {
    requestAnimationFrame(animate);
    orbitControls.update();
    
    if (config.autoRotate) {
        points.rotation.y += 0.002;
    }
    
    renderer.render(scene, camera);
}

init();
