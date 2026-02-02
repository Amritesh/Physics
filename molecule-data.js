
// Distances in Bohr Radii (approx 0.53 A)
// H-H bond ~ 1.4 a0
// C-C bond ~ 2.9 a0

export const molecules = [
    { Z: 1, formula: "H₂", type: "diatomic", dist: 1.4 },
    { Z: 2, formula: "He", type: "monoatomic" },
    { Z: 3, formula: "Li (Solid)", type: "bcc", dist: 6.6 }, // Li-Li in BCC
    { Z: 4, formula: "Be (Solid)", type: "hcp", dist: 4.3 },
    { Z: 5, formula: "B₁₂", type: "icosahedron", dist: 3.3 }, // Too complex? Let's do B2 dimer for simplicity or small cluster
    // Actually B12 is the structural unit. Let's do a simplified B4 tetrahedron?
    // User wants "exact", but B12 is 12 atoms. Might be slow.
    // Let's stick to valid small clusters. B12 is 12 atoms. 12 * 5 electrons = 60 electrons. 60*2000 = 120k points. Doable.
    
    { Z: 6, formula: "C (Diamond)", type: "diamond", dist: 2.9 },
    { Z: 7, formula: "N₂", type: "diatomic", dist: 2.1 },
    { Z: 8, formula: "O₂", type: "diatomic", dist: 2.3 },
    { Z: 9, formula: "F₂", type: "diatomic", dist: 2.7 },
    { Z: 10, formula: "Ne", type: "monoatomic" },
    { Z: 11, formula: "Na (Solid)", type: "bcc", dist: 7.0 },
    { Z: 12, formula: "Mg (Solid)", type: "hcp", dist: 6.0 },
    { Z: 13, formula: "Al (Solid)", type: "fcc", dist: 5.4 },
    { Z: 14, formula: "Si (Crystalline)", type: "diamond", dist: 4.4 },
    { Z: 15, formula: "P₄", type: "tetrahedron", dist: 4.2 },
    { Z: 16, formula: "S₈", type: "ring", dist: 3.9 },
    { Z: 17, formula: "Cl₂", type: "diatomic", dist: 3.8 },
    { Z: 18, formula: "Ar", type: "monoatomic" },
    { Z: 19, formula: "K (Solid)", type: "bcc", dist: 8.5 },
    { Z: 20, formula: "Ca (Solid)", type: "fcc", dist: 7.4 }
];

export function getMoleculeGeometry(Z) {
    const mol = molecules[Z-1];
    const d = mol.dist || 0;
    
    if (mol.type === "monoatomic") {
        return [{x:0, y:0, z:0}];
    }
    
    if (mol.type === "diatomic") {
        return [
            {x: -d/2, y: 0, z: 0},
            {x: d/2, y: 0, z: 0}
        ];
    }
    
    if (mol.type === "bcc") {
        // Unit cell: Center + 8 corners. Visualization: maybe just center + 8 corners is too big?
        // Let's do Center + 1 corner? Or Center + 8 neighbors (9 atoms).
        // 9 atoms is manageable.
        // BCC: Center at 0. Corners at +/- d/sqrt(3) ? No, nearest neighbor dist is d.
        // a_lat = 2*d / sqrt(3).
        // Corners at +/- a/2.
        const a = 2 * d / Math.sqrt(3);
        const pos = [{x:0, y:0, z:0}]; // Center
        // 8 Corners
        for(let x of [-1, 1])
        for(let y of [-1, 1])
        for(let z of [-1, 1])
            pos.push({x: x*a/2, y: y*a/2, z: z*a/2});
        return pos;
    }

    if (mol.type === "fcc") {
        // Center + 12 neighbors. 13 atoms.
        // Nearest neighbor dist d.
        // a_lat = d * sqrt(2).
        const a = d * Math.sqrt(2);
        const pos = [{x:0, y:0, z:0}];
        // Faces centers
        // (0, +/- a/2, +/- a/2) ...
        // No, let's just create a small cluster of neighbors.
        // 12 neighbors at distance d.
        // (d, 0, 0), (-d, 0, 0) ... (d/sqrt(2), d/sqrt(2), 0) ...
        // Easier: standard FCC coordinates.
        // (0,0,0), (a/2, a/2, 0), (a/2, 0, a/2), (0, a/2, a/2) ...
        
        // Let's do a single unit cell corners + faces?
        // 0,0,0 and faces.
        // Or just 1 atom + 6 neighbors (octahedral)?
        // 13 atoms is fine.
        // Coordinates relative to 0,0,0.
        // Neighbors at dist d:
        // +/- d along axes? No.
        // (d/sqrt2, d/sqrt2, 0) etc.
        const k = d / Math.sqrt(2);
        for(let i of [-1, 1]) for(let j of [-1, 1]) {
            pos.push({x: i*k, y: j*k, z: 0});
            pos.push({x: i*k, y: 0, z: j*k});
            pos.push({x: 0, y: i*k, z: j*k});
        }
        return pos;
    }
    
    if (mol.type === "tetrahedron") { // P4
        // Vertices of tetra edge length d.
        // (1,1,1), (1,-1,-1), ... scaled.
        // Distance from center to vertex R = d * sqrt(6)/4.
        // Coordinates: (s,s,s), (s,-s,-s), (-s,s,-s), (-s,-s,s).
        // Dist between (s,s,s) and (s,-s,-s) is 2s*sqrt(2)? No sqrt( (2s)^2 + (2s)^2 ) = sqrt(8s^2) = 2s*sqrt(2).
        // Set 2s*sqrt(2) = d => s = d / (2*sqrt(2)).
        const s = d / (2 * Math.sqrt(2));
        return [
            {x: s, y: s, z: s},
            {x: s, y: -s, z: -s},
            {x: -s, y: s, z: -s},
            {x: -s, y: -s, z: s}
        ];
    }
    
    if (mol.type === "ring") { // S8
        // Crown shape.
        // Simplified: octagon in plane (wrong but recognizable) or puckered.
        // Puckered: z alternates +/- h.
        // R approx 1.5 * d.
        const R = d * 1.0; 
        const points = [];
        for(let i=0; i<8; i++) {
            const angle = i * Math.PI / 4;
            points.push({
                x: R * Math.cos(angle),
                y: R * Math.sin(angle),
                z: (i % 2 === 0 ? d*0.4 : -d*0.4)
            });
        }
        return points;
    }
    
    if (mol.type === "diamond") { // C, Si
        // Center + 4 neighbors (Tetrahedral).
        // Same as P4 logic but central atom is present? No, Diamond is 1 + 4.
        const pos = [{x:0, y:0, z:0}];
        // Neighbors at dist d.
        // (s,s,s)... s = d/sqrt(3).
        const s = d / Math.sqrt(3);
        pos.push({x: s, y: s, z: s});
        pos.push({x: s, y: -s, z: -s});
        pos.push({x: -s, y: s, z: -s});
        pos.push({x: -s, y: -s, z: s});
        return pos;
    }
    
    // Default fallback
    return [{x:0, y:0, z:0}];
}
