// Physical constants in SI units
export const PHYSICAL_CONSTANTS = {
    // Fundamental constants
    HBAR: 1.054571817e-34,           // ℏ (reduced Planck constant) in J·s
    ELECTRON_MASS: 9.1093837015e-31, // m_e in kg
    ELECTRON_CHARGE: 1.602176634e-19, // e in C
    PERMITTIVITY_0: 8.8541878128e-12, // ε₀ in F/m
    PI: Math.PI,

    // Derived atomic units
    BOHR_RADIUS: 0.529177210903e-10,  // a₀ in meters (≈ 0.53 Angstrom)
    RYDBERG_ENERGY: 13.605693122994,  // Ry in eV (hydrogen ground state)
    HARTREE_ENERGY: 27.211386245988,  // E_h in eV (2 × Rydberg)
};

// Timescales
export const TIMESCALES = {
    // Atomic unit of time (τ)
    ATOMIC_TIME_UNIT: PHYSICAL_CONSTANTS.HBAR / PHYSICAL_CONSTANTS.HARTREE_ENERGY / PHYSICAL_CONSTANTS.ELECTRON_CHARGE,
    
    // Electron orbital periods
    HYDROGEN_1S_PERIOD: 2.419e-17,   // seconds (≈ 24 attoseconds)
    HYDROGEN_2P_PERIOD: 5.267e-16,   // seconds (≈ 527 attoseconds)
    
    // Natural timescales
    FEMTOSECOND: 1e-15,
    ATTOSECOND: 1e-18,
    ZEPTOSECOND: 1e-21,
};

// Length scales  
export const LENGTHSCALES = {
    ANGSTROM: 1e-10,
    PICOMETER: 1e-12,
    FEMTOMETER: 1e-15,
    
    BOHR_RADIUS: PHYSICAL_CONSTANTS.BOHR_RADIUS,
    HYDROGEN_IONIZATION_RADIUS: 2.0 * PHYSICAL_CONSTANTS.BOHR_RADIUS, // 2a₀ typical extent
};

// Visualization scaling (map physics to screen units)
// In the visualization:
// - Physical distance in Bohr radii → display coordinates
// - Physical time → animation speed
export const VISUALIZATION_SCALES = {
    // Length scaling: 1 Bohr radius = N display units
    // Typical hydrogen 1s orbital has extent ~2-3 Bohr radii
    BOHR_TO_DISPLAY: 8.0, // 1 a₀ = 8 display units
    
    // Time scaling factor for animation
    // Maps real atomic timescale to observable animation
    // High timeScale = slower animation (more observations accumulate)
    // Low timeScale = faster "observation" (sparse glimpses)
};

// Compute display scales dynamically
export function getDisplayScale(timeScale) {
    // timeScale ranges from 0 to 1
    // Maps to observation timescale:
    // 0 = ultra-fast snapshots (10 fs apart)
    // 1 = slow accumulation (1 ps apart)
    
    const minObsTime = 0.1e-15;  // 0.1 fs
    const maxObsTime = 4.6e-15;  // 4.6 fs
    const obsTime = minObsTime + (maxObsTime - minObsTime) * timeScale;
    
    // Electron orbital periods for reference
    const typicalPeriod = TIMESCALES.HYDROGEN_1S_PERIOD; // ~24 as
    
    return {
        observationTimeFS: obsTime / 1e-15,           // in femtoseconds
        observationTimeAS: obsTime / 1e-18,           // in attoseconds
        orbitalPeriodsPerObs: obsTime / typicalPeriod,
        bohrPerDisplay: VISUALIZATION_SCALES.BOHR_TO_DISPLAY,
        displayToBohr: 1.0 / VISUALIZATION_SCALES.BOHR_TO_DISPLAY,
    };
}

// Get orbital extent for visualization
export function getOrbitalExtent(n, l) {
    // Approximate radial extent (in Bohr radii) for hydrogen-like atoms
    // Most probability density is within r_max
    const a0 = 1; // in units of Bohr radii
    
    // For hydrogen: <r> ≈ (3n²/2 - l(l+1)/2) × a₀
    const expectedRadius = (3 * n * n / 2 - l * (l + 1) / 2) * a0;
    
    // Approximate extent (contains ~95% of density)
    const extent = expectedRadius * 1.5;
    
    return {
        expectedRadius,
        maxExtent: extent,
        inBohr: extent,
        inAngstrom: extent * PHYSICAL_CONSTANTS.BOHR_RADIUS * 1e10,
        inMeters: extent * PHYSICAL_CONSTANTS.BOHR_RADIUS,
    };
}

// Format scales for display
export function formatScales(timeScale) {
    const scales = getDisplayScale(timeScale);
    return {
        time: `${scales.observationTimeFS.toFixed(2)} fs (${scales.observationTimeAS.toFixed(1)} as)`,
        orbitalPeriods: `${scales.orbitalPeriodsPerObs.toFixed(3)} orbital periods`,
        lengthPerBohr: `${(1 / scales.bohrPerDisplay).toFixed(2)} a₀`,
        lengthPerAngstrom: `${(PHYSICAL_CONSTANTS.BOHR_RADIUS * 1e10 / scales.bohrPerDisplay).toFixed(3)} Å`,
    };
}
