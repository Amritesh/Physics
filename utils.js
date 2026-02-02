import { getRealProbabilityDensity } from './physics.js';
import { getElectronConfiguration } from './atom-data.js';
import * as THREE from 'three';

export function generateOrbitalPoints(n, l, m, Zeff, count, sharpness = 2.0) {
    const points = [];
    let x = 1, y = 1, z = 1;
    let currentProb = getRealProbabilityDensity(x, y, z, n, l, m, Zeff);
    const stepSize = (n * 1.5) / Zeff;

    for (let i = 0; i < 500; i++) {
        const dx = (Math.random() - 0.5) * stepSize;
        const dy = (Math.random() - 0.5) * stepSize;
        const dz = (Math.random() - 0.5) * stepSize;
        const nextX = x + dx;
        const nextY = y + dy;
        const nextZ = z + dz;
        const nextProb = getRealProbabilityDensity(nextX, nextY, nextZ, n, l, m, Zeff);
        const ratio = currentProb === 0 ? 1 : nextProb / currentProb;
        const acceptance = Math.pow(ratio, sharpness);
        if (nextProb > currentProb || Math.random() < acceptance) {
            x = nextX; y = nextY; z = nextZ;
            currentProb = nextProb;
        }
    }

    for (let i = 0; i < count; i++) {
        const dx = (Math.random() - 0.5) * stepSize;
        const dy = (Math.random() - 0.5) * stepSize;
        const dz = (Math.random() - 0.5) * stepSize;
        const nextX = x + dx;
        const nextY = y + dy;
        const nextZ = z + dz;
        const nextProb = getRealProbabilityDensity(nextX, nextY, nextZ, n, l, m, Zeff);
        const ratio = currentProb === 0 ? 1 : nextProb / currentProb;
        const acceptance = Math.pow(ratio, sharpness);
        if (ratio >= 1 || Math.random() < acceptance) {
            x = nextX; y = nextY; z = nextZ;
            currentProb = nextProb;
        }
        points.push(x, y, z);
    }
    return points;
}

export function createLabel(scene, mainText, subText = '', x = 0, y = 0, opts = {}) {
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 128;
    const context = canvas.getContext('2d');

    context.clearRect(0, 0, canvas.width, canvas.height);
    context.font = 'Bold 40px Arial';
    context.fillStyle = 'white';
    context.textAlign = 'center';
    context.fillText(mainText, 128, 50);

    if (subText) {
        context.font = '24px Arial';
        context.fillStyle = '#ccc';
        context.fillText(subText, 128, 90);
    }

    const texture = new THREE.CanvasTexture(canvas);
    const spriteMaterial = new THREE.SpriteMaterial({ map: texture });
    const sprite = new THREE.Sprite(spriteMaterial);

    const sx = opts.scaleX || 10;
    const sy = opts.scaleY || 5;
    const yOffset = opts.yOffset || 0;

    sprite.position.set(x, y + yOffset, 0);
    sprite.scale.set(sx, sy, 1);
    scene.add(sprite);
    return sprite;
}

export function createDetectionSprite(color = '#ffdca8', size = 128) {
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    const grad = ctx.createRadialGradient(size/2, size/2, 0, size/2, size/2, size/2);
    grad.addColorStop(0, color);
    grad.addColorStop(0.3, color);
    grad.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, size, size);
    const tex = new THREE.CanvasTexture(canvas);
    const mat = new THREE.SpriteMaterial({ map: tex, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true });
    return new THREE.Sprite(mat);
}

export function sampleOrbitals(Z, count = 1) {
    const ORBITAL_COLORS = {
        0: new THREE.Color(1, 0.2, 0.2),
        1: new THREE.Color(0.2, 1, 0.2),
        2: new THREE.Color(0.2, 0.5, 1),
        3: new THREE.Color(1, 1, 0.2)
    };

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
            samples.push({ pos: new THREE.Vector3(x, y, z), color: ORBITAL_COLORS[orb.l] || new THREE.Color(1,1,1) });
        }
    }
    return samples;
}
