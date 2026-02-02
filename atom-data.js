
export const elementNames = [
    "Hydrogen", "Helium", "Lithium", "Beryllium", "Boron", "Carbon", "Nitrogen", "Oxygen", "Fluorine", "Neon",
    "Sodium", "Magnesium", "Aluminium", "Silicon", "Phosphorus", "Sulfur", "Chlorine", "Argon", "Potassium", "Calcium"
];

export const elementSymbols = [
    "H", "He", "Li", "Be", "B", "C", "N", "O", "F", "Ne",
    "Na", "Mg", "Al", "Si", "P", "S", "Cl", "Ar", "K", "Ca"
];

export function getElectronConfiguration(Z) {
    const orbitals = [];
    let electronsLeft = Z;

    // Subshells in order of filling (Aufbau principle)
    // n, l, capacity
    const subshells = [
        { n: 1, l: 0, cap: 2 }, // 1s
        { n: 2, l: 0, cap: 2 }, // 2s
        { n: 2, l: 1, cap: 6 }, // 2p
        { n: 3, l: 0, cap: 2 }, // 3s
        { n: 3, l: 1, cap: 6 }, // 3p
        { n: 4, l: 0, cap: 2 }, // 4s
        { n: 3, l: 2, cap: 10 }, // 3d - not needed for Z<=20
    ];

    for (const sub of subshells) {
        if (electronsLeft <= 0) break;

        const count = Math.min(electronsLeft, sub.cap);
        electronsLeft -= count;

        const mValues = [];
        // Map logical indices to Cartesian directions for p-orbitals
        // l=1: 0->z, 1->x, -1->y. 
        // We want to fill distinct axes first.
        if (sub.l === 1) {
             // Order: 0(z), 1(x), -1(y) is arbitrary but distinct.
             mValues.push(0, 1, -1);
        } else {
            for (let m = -sub.l; m <= sub.l; m++) {
                mValues.push(m);
            }
        }

        let spatialOrbitals = []; 
        for (let i = 0; i < count; i++) {
             const mIndex = i % (2 * sub.l + 1);
             spatialOrbitals.push(mValues[mIndex]);
        }
        
        for (const m of spatialOrbitals) {
            orbitals.push({ n: sub.n, l: sub.l, m: m });
        }
    }
    
    // Calculate Zeff for each electron using Slater's Rules
    // Grouping: (1s) (2s,2p) (3s,3p) (3d) (4s,4p)
    
    orbitals.forEach((orb, index) => {
        let S = 0;
        
        // Iterate over all other electrons
        orbitals.forEach((other, otherIndex) => {
            if (index === otherIndex) return;
            
            // Rules depend on the group of the TARGET electron (orb)
            // Rules for s, p electrons:
            
            // 1. Determine Groups
            // Groups based on n? For s/p, yes. (ns, np) is a group.
            const orbGroup = orb.n; // Simplified group ID
            const otherGroup = other.n;
            
            if (otherGroup > orbGroup) {
                // Higher groups don't shield
                S += 0;
            } else if (otherGroup === orbGroup) {
                // Same group: 0.35 (exception 1s is 0.30)
                if (orb.n === 1) S += 0.30;
                else S += 0.35;
            } else if (otherGroup === orbGroup - 1) {
                // n-1 group: 0.85
                S += 0.85;
            } else {
                // n-2 or lower: 1.00
                S += 1.00;
            }
        });
        
        orb.Zeff = Math.max(Z - S, 0.1); // Ensure positive
    });
    
    return orbitals;
}
