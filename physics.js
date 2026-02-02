// --- Math Helpers ---

const factorialCache = [1, 1];
export function factorial(n) {
    if (n < 0) return 1; // Should not happen
    if (factorialCache[n]) return factorialCache[n];
    let res = factorialCache[factorialCache.length - 1];
    for (let i = factorialCache.length; i <= n; i++) {
        res *= i;
        factorialCache[i] = res;
    }
    return res;
}

// Generalized Laguerre Polynomial L_n^alpha(x)
// Computed using recurrence
export function laguerre(n, alpha, x) {
    if (n === 0) return 1;
    if (n === 1) return 1 + alpha - x;
    
    let L_k_minus_1 = 1;
    let L_k = 1 + alpha - x;
    
    for (let k = 1; k < n; k++) {
        const L_k_plus_1 = ((2 * k + 1 + alpha - x) * L_k - (k + alpha) * L_k_minus_1) / (k + 1);
        L_k_minus_1 = L_k;
        L_k = L_k_plus_1;
    }
    return L_k;
}

// Associated Legendre Polynomial P_l^m(x)
// Computed using recurrence relations
// x is cos(theta)
export function legendre(l, m, x) {
    const absM = Math.abs(m);
    if (absM > l) return 0;

    // 1. Compute P_m^m(x)
    // P_m^m(x) = (-1)^m * (2m-1)!! * (1-x^2)^(m/2)
    let pmm = 1.0;
    if (absM > 0) {
        const somx2 = Math.sqrt((1.0 - x) * (1.0 + x));
        let fact = 1.0;
        for (let i = 1; i <= absM; i++) {
            pmm *= -fact * somx2;
            fact += 2.0;
        }
    }

    if (l === absM) return pmm;

    // 2. Compute P_{m+1}^m(x)
    // P_{m+1}^m(x) = x * (2m+1) * P_m^m(x)
    let pmmp1 = x * (2 * absM + 1) * pmm;
    if (l === absM + 1) return pmmp1;

    // 3. Compute P_l^m(x)
    // (l-m)P_l^m = x(2l-1)P_{l-1}^m - (l+m-1)P_{l-2}^m
    let pll = 0;
    for (let ll = absM + 2; ll <= l; ll++) {
        pll = (x * (2 * ll - 1) * pmmp1 - (ll + absM - 1) * pmm) / (ll - absM);
        pmm = pmmp1;
        pmmp1 = pll;
    }

    return pll;
}

// --- Wavefunction Physics ---

// Returns |Psi|^2 density for Standard Quantum Numbers (Complex Eigenstates)
// Zeff is the effective nuclear charge (default 1 for Hydrogen)
export function getProbabilityDensity(x, y, z, n, l, m, Zeff = 1) {
    // Convert to spherical
    const r = Math.sqrt(x*x + y*y + z*z);
    
    // Avoid singularity at r=0 for numerical stability
    if (r < 1e-6) return 0;

    const theta = Math.acos(z / r); // 0 to PI
    
    // Hydrogen-like radial wavefunction with Zeff
    // rho = 2 * Z * r / n
    const rho = (2 * Zeff * r) / n;
    const prefactor = Math.sqrt(
        Math.pow(2 * Zeff / n, 3) *
        factorial(n - l - 1) /
        (2 * n * factorial(n + l))
    );
    
    const L = laguerre(n - l - 1, 2 * l + 1, rho);
    const R = prefactor * Math.exp(-rho / 2) * Math.pow(rho, l) * L;

    const absM = Math.abs(m);
    
    const normY = Math.sqrt(
        ((2 * l + 1) / (4 * Math.PI)) * 
        (factorial(l - absM) / factorial(l + absM))
    );
    
    const P = legendre(l, absM, Math.cos(theta));
    const Y_mag = normY * P; // Magnitude of spherical harmonic

    // Probability Density
    const psi_mag = R * Y_mag;
    return psi_mag * psi_mag;
}

// Returns the Real Wavefunction Amplitude Psi(x,y,z)
// Can be negative.
export function getRealWavefunction(x, y, z, n, l, m, Zeff = 1) {
    const r = Math.sqrt(x*x + y*y + z*z);
    if (r < 1e-6) return 0;
    
    // Radial Part R(r)
    const rho = (2 * Zeff * r) / n;
    const prefactor = Math.sqrt(
        Math.pow(2 * Zeff / n, 3) *
        factorial(n - l - 1) /
        (2 * n * factorial(n + l))
    );
    const L = laguerre(n - l - 1, 2 * l + 1, rho);
    const R = prefactor * Math.exp(-rho / 2) * Math.pow(rho, l) * L;

    // Angular Part Y_real(theta, phi)
    const dx = x/r;
    const dy = y/r;
    const dz = z/r;
    
    let Y = 0;
    
    if (l === 0) { // s
        Y = 1 / Math.sqrt(4 * Math.PI);
    }
    else if (l === 1) { // p
        const N = Math.sqrt(3 / (4 * Math.PI));
        if (m === 0) Y = N * dz;         // pz
        else if (m === 1) Y = N * dx;    // px
        else if (m === -1) Y = N * dy;   // py
    }
    else if (l === 2) { // d
        const N = Math.sqrt(5 / (16 * Math.PI));
        if (m === 0) Y = N * (3*dz*dz - 1); // dz^2
        else if (m === 1) Y = Math.sqrt(15/(4*Math.PI)) * dx * dz; // dxz
        else if (m === -1) Y = Math.sqrt(15/(4*Math.PI)) * dy * dz; // dyz
        else if (m === 2) Y = Math.sqrt(15/(16*Math.PI)) * (dx*dx - dy*dy); // dx2-y2
        else if (m === -2) Y = Math.sqrt(15/(4*Math.PI)) * dx * dy; // dxy
    }
    else {
        Y = 1 / Math.sqrt(4 * Math.PI);
    }
    
    return R * Y;
}

// Wrapper for backwards compatibility
export function getRealProbabilityDensity(x, y, z, n, l, m, Zeff = 1) {
    const psi = getRealWavefunction(x, y, z, n, l, m, Zeff);
    return psi * psi;
}
