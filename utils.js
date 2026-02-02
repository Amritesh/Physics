import { getRealProbabilityDensity } from './physics.js';
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
