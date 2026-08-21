"""
RCC Phase 1: fixed-graph recurrent matter — numerical experiments.
Companion to Appendix H of "The Recurrent Causal Code" v0.4.

Model conventions (hbar = a = tau = 1, so c = 1):
  1D coined walk   U = S C(theta),  C(theta) = exp(-i theta sigma_x),
                   S: spin-up component shifts x -> x+1, spin-down x -> x-1
                   (momentum symbol S(k) = exp(-i k sigma_z)).
  Symmetrised walk U' = C(theta/2) S C(theta/2): same spectrum as U,
                   chiral symmetry Gamma = sigma_y with Gamma U' Gamma = U'^dagger.
  Exact dispersion: cos(omega) = cos(k) cos(theta).
"""
import numpy as np

rng = np.random.default_rng(7)
SX = np.array([[0, 1], [1, 0]], dtype=complex)
SY = np.array([[0, -1j], [1j, 0]], dtype=complex)
SZ = np.array([[1, 0], [0, -1]], dtype=complex)
I2 = np.eye(2, dtype=complex)


def coin(theta, axis=SX):
    return np.cos(theta) * I2 - 1j * np.sin(theta) * axis


# ----------------------------------------------------------------------
# Real-space walk operators (state shape (N, 2): psi[x, s], s=0 up, s=1 down)
# ----------------------------------------------------------------------
def step(psi, thetas, phase_up=None, symmetric=False, chiral_break=0.0):
    """One step of U = S C(theta(x)) (or symmetrised). Periodic boundaries.
    phase_up: optional per-link U(1) phase applied with the up-shift (gauge field).
    chiral_break: small extra sigma_y coin rotation (breaks Gamma = sigma_y)."""
    def apply_coin(p, ang):
        c, s = np.cos(ang), np.sin(ang)
        up = c * p[:, 0] - 1j * s * p[:, 1]
        dn = -1j * s * p[:, 0] + c * p[:, 1]
        return np.stack([up, dn], axis=1)

    if symmetric:
        psi = apply_coin(psi, thetas / 2)
    else:
        psi = apply_coin(psi, thetas)
    if chiral_break:
        c, s = np.cos(chiral_break), np.sin(chiral_break)
        up = c * psi[:, 0] - s * psi[:, 1]
        dn = s * psi[:, 0] + c * psi[:, 1]
        psi = np.stack([up, dn], axis=1)
    up = np.roll(psi[:, 0], 1)          # up moves right
    if phase_up is not None:
        up = up * np.roll(phase_up, 1)
    dn = np.roll(psi[:, 1], -1)         # down moves left
    psi = np.stack([up, dn], axis=1)
    if symmetric:
        psi = apply_coin(psi, thetas / 2)
    return psi


def walk_matrix(N, thetas, symmetric=False, chiral_break=0.0):
    """Dense 2N x 2N matrix of one step (for exact diagonalisation)."""
    U = np.zeros((2 * N, 2 * N), dtype=complex)
    for x in range(N):
        for s in range(2):
            psi = np.zeros((N, 2), dtype=complex)
            psi[x, s] = 1.0
            out = step(psi, thetas, symmetric=symmetric, chiral_break=chiral_break)
            U[:, 2 * x + s] = out.reshape(-1)
    return U


# ----------------------------------------------------------------------
# Experiment 1: dispersion and recurrence-mass relation
# ----------------------------------------------------------------------
def exp1_dispersion(N=256, theta=0.2):
    thetas = np.full(N, theta)
    U = walk_matrix(N, thetas)
    ev = np.linalg.eigvals(U)
    eps = np.sort(np.angle(ev))
    ks = 2 * np.pi * np.arange(N) / N
    pred = np.concatenate([np.arccos(np.clip(np.cos(ks) * np.cos(theta), -1, 1)),
                           -np.arccos(np.clip(np.cos(ks) * np.cos(theta), -1, 1))])
    pred = np.sort(pred)
    err = np.max(np.abs(eps - pred))
    # rest-frame: k=0 branch phase = +/- theta; zitterbewegung of <sigma_z> at 2 theta
    psi = np.array([1.0, 0.0], dtype=complex)
    Uk0 = coin(theta)
    sz = []
    for _ in range(4000):
        psi = Uk0 @ psi
        sz.append(np.real(np.conj(psi) @ SZ @ psi))
    sz = np.array(sz)
    # fit frequency via FFT peak with parabolic interpolation
    f = np.fft.rfftfreq(len(sz))
    amp = np.abs(np.fft.rfft(sz - sz.mean()))
    i = int(np.argmax(amp))
    d = (amp[i - 1] - amp[i + 1]) / (2 * (amp[i - 1] - 2 * amp[i] + amp[i + 1]))
    zitter = 2 * np.pi * (f[i] + d * (f[1] - f[0]))
    return err, zitter, 2 * theta


# ----------------------------------------------------------------------
# Experiment 2: strict cone and front velocity  (claim: v_front = cos(theta))
# ----------------------------------------------------------------------
def exp2_cone(N=1201, T=400, theta=0.3, tail=1e-3):
    thetas = np.full(N, theta)
    psi = np.zeros((N, 2), dtype=complex)
    x0 = N // 2
    psi[x0] = np.array([1.0, 1j]) / np.sqrt(2)
    leak_max = 0.0
    fronts = []
    for t in range(1, T + 1):
        psi = step(psi, thetas)
        p = np.abs(psi[:, 0]) ** 2 + np.abs(psi[:, 1]) ** 2
        x = np.arange(N) - x0
        outside = p[np.abs(x) > t].sum()
        leak_max = max(leak_max, outside)
        # front: largest |x| such that mass beyond it >= tail
        order = np.argsort(-np.abs(x))
        csum = np.cumsum(p[order])
        idx = np.searchsorted(csum, tail)
        fronts.append(np.abs(x[order][idx]))
    fronts = np.array(fronts, dtype=float)
    t = np.arange(1, T + 1)
    sl = np.polyfit(t[T // 2:], fronts[T // 2:], 1)[0]
    # analytic max group velocity
    ks = np.linspace(1e-4, np.pi - 1e-4, 20001)
    om = np.arccos(np.clip(np.cos(ks) * np.cos(theta), -1, 1))
    vg = np.sin(ks) * np.cos(theta) / np.sin(om)
    return leak_max, sl, np.cos(theta), np.max(np.abs(vg))


# ----------------------------------------------------------------------
# Experiment 3: mass-kink defect (Jackiw-Rebbi), chiral protection
# ----------------------------------------------------------------------
def exp3_kink(N=400, theta0=0.3, disorder=0.0, chiral_break=0.0, seed=0):
    """theta(x): kink at x=0 and antikink at x=N/2 (periodic)."""
    x = np.arange(N)
    thetas = np.where((x >= N // 4) & (x < 3 * N // 4), theta0, -theta0).astype(float)
    if disorder:
        r = np.random.default_rng(seed)
        thetas = thetas + r.uniform(-disorder, disorder, N)
    U = walk_matrix(N, thetas, symmetric=True, chiral_break=chiral_break)
    ev, V = np.linalg.eig(U)
    eps = np.angle(ev)
    idx = np.argsort(np.abs(eps))[:2]           # two states nearest quasienergy 0
    modes = []
    for i in idx:
        v = V[:, i].reshape(N, 2)
        p = (np.abs(v) ** 2).sum(axis=1)
        p = p / p.sum()
        xc = np.argmax(p)
        # exponential fit of decay away from the wall (use 20 sites)
        w = 20
        seg = p[(xc + 2) % N: (xc + 2 + w) % N] if xc + 2 + w < N else p[xc - w - 2: xc - 2][::-1]
        seg = seg[seg > 1e-14]
        xi = -2.0 / np.polyfit(np.arange(len(seg)), np.log(seg), 1)[0]  # amplitude loc length
        modes.append((eps[i], xc, xi))
    # bulk gap check: nearest non-defect quasienergy
    eps_sorted = np.sort(np.abs(eps))
    return modes, eps_sorted[2]


# ----------------------------------------------------------------------
# Experiment 4: scattering off a mass step, vs continuum Dirac
# ----------------------------------------------------------------------
def dirac_step_T(E, m1, m2):
    """Continuum 1+1D Dirac transmission across a mass step m1 -> m2 at energy E."""
    if E <= abs(m2) or E <= abs(m1):
        return 0.0
    k1, k2 = np.sqrt(E * E - m1 * m1), np.sqrt(E * E - m2 * m2)
    b1, b1p, b2 = (E - k1) / m1, (E + k1) / m1, (E - k2) / m2
    tt = (b1p - b1) / (b1p - b2)
    T = abs(tt) ** 2 * (1 - b2 * b2) / (1 - b1 * b1)
    return float(T)


def exp4_step(N=4000, theta1=0.05, theta2=0.2, k0=0.4, sigma=60.0, T=1600):
    x = np.arange(N)
    xs = N // 2
    thetas = np.where(x < xs, theta1, theta2).astype(float)
    x0 = xs - 6 * int(sigma)
    env = np.exp(-((x - x0) ** 2) / (4 * sigma ** 2)) * np.exp(1j * k0 * x)
    # positive-energy right-moving spinor of the left region at k0
    om = np.arccos(np.cos(k0) * np.cos(theta1))
    # eigenvector of H_eff ~ sin(k)cos(th) sz + cos(k) sin(th) sx + sin(k) sin(th) sy (from App A)
    n = np.array([np.cos(k0) * np.sin(theta1),
                  np.sin(k0) * np.sin(theta1),
                  np.sin(k0) * np.cos(theta1)])
    n = n / np.linalg.norm(n)
    H = n[0] * SX + n[1] * SY + n[2] * SZ
    w, V = np.linalg.eigh(H)
    sp = V[:, 1]  # +1 eigenvector: positive branch
    psi = np.zeros((N, 2), dtype=complex)
    psi[:, 0] = env * sp[0]
    psi[:, 1] = env * sp[1]
    psi /= np.sqrt((np.abs(psi) ** 2).sum())
    for _ in range(T):
        psi = step(psi, thetas)
    p = (np.abs(psi) ** 2).sum(axis=1)
    T_meas = p[x > xs + 3 * int(sigma) // 2].sum() / p.sum()
    E = om
    T_pred = dirac_step_T(E, theta1, theta2)
    return T_meas, T_pred


# ----------------------------------------------------------------------
# Experiment 5: two interacting walkers -> molecule bound states
# ----------------------------------------------------------------------
def two_particle_WK(Nr, K, theta, phi):
    """Fixed total momentum K. Relative coordinate r = x1 - x2 on the even
    sublattice r = 2*rho, rho in [-Nr//2, Nr//2). Coin space 4-dim (s1,s2).
    Step: (C x C), then conditional shift with CoM phase, then collision
    phase exp(i phi) on r = 0."""
    dim = Nr * 4
    C = coin(theta)
    CC = np.kron(C, C)
    W = np.zeros((dim, dim), dtype=complex)
    half = Nr // 2
    for rho in range(Nr):
        for a in range(4):
            v = np.zeros(dim, dtype=complex)
            v[rho * 4 + a] = 1.0
            # coin
            out = np.zeros(dim, dtype=complex)
            block = CC[:, a]
            for b in range(4):
                out[rho * 4 + b] = block[b]
            # shift: s1,s2 from index b = 2*s1 + s2 (s=0 up:+1, s=1 down:-1)
            out2 = np.zeros(dim, dtype=complex)
            for b in range(4):
                amp = out[rho * 4 + b]
                if amp == 0:
                    continue
                s1 = +1 if (b // 2) == 0 else -1
                s2 = +1 if (b % 2) == 0 else -1
                drho = (s1 - s2) // 2          # r changes by s1-s2 -> rho by (s1-s2)/2
                ph = np.exp(-1j * K * (s1 + s2) / 2.0)
                rho2 = (rho + drho) % Nr
                out2[rho2 * 4 + b] += amp * ph
            # collision phase at r = 0 (rho index of r=0)
            r0 = half
            out2[r0 * 4: r0 * 4 + 4] *= np.exp(1j * phi)
            W[:, rho * 4 + a] = out2
    return W


def exp5_molecule(Nr=151, theta=0.4, phi=np.pi, K=0.0):
    W = two_particle_WK(Nr, K, theta, phi)
    ev, V = np.linalg.eig(W)
    eps = np.angle(ev)
    # two-particle continuum at this K: eps_band = s1*om(k) + s2*om(K-k) mod 2pi
    ks = np.linspace(-np.pi, np.pi, 4001)

    def om(k):
        return np.arccos(np.clip(np.cos(k) * np.cos(theta), -1, 1))
    band = []
    for s1 in (1, -1):
        for s2 in (1, -1):
            band.append(s1 * om(ks) + s2 * om(K - ks))
    band = np.mod(np.concatenate(band) + np.pi, 2 * np.pi) - np.pi
    band = np.sort(band)
    molecules = []
    half = Nr // 2
    rho = np.arange(Nr) - half
    for i in range(len(eps)):
        d = np.min(np.abs(np.angle(np.exp(1j * (band - eps[i])))))
        if d > 0.02:
            v = V[:, i].reshape(Nr, 4)
            p = (np.abs(v) ** 2).sum(axis=1)
            p /= p.sum()
            spread = np.sqrt((p * rho ** 2).sum())
            if spread < Nr / 8:
                molecules.append((eps[i], d, spread))
    molecules.sort(key=lambda m: -m[1])
    return molecules[:4]


# ----------------------------------------------------------------------
# Experiment 6: 2D walk — exact dispersion and anisotropy
# ----------------------------------------------------------------------
def omega2d(kx, ky, theta):
    Uk = (np.cos(ky) * I2 - 1j * np.sin(ky) * SY) @ \
         (np.cos(kx) * I2 - 1j * np.sin(kx) * SZ) @ coin(theta)
    tr = np.trace(Uk).real / 2
    return np.arccos(np.clip(tr, -1, 1))


def exp6_2d():
    # verify trace formula cos(om) = cx cy cos(th) - sx sy sin(th)
    errs = []
    for _ in range(200):
        kx, ky, th = rng.uniform(-np.pi, np.pi, 3)
        pred = np.cos(kx) * np.cos(ky) * np.cos(th) - np.sin(kx) * np.sin(ky) * np.sin(th)
        errs.append(abs(np.cos(omega2d(kx, ky, th)) - pred))
    err_formula = max(errs)
    # massless anisotropy: omega ~ k (1 - k^2 sin^2(2 phi)/24)
    k = 0.05
    phis = np.linspace(0, np.pi / 2, 25)
    coefs = []
    for ph in phis[1:-1]:
        om = omega2d(k * np.cos(ph), k * np.sin(ph), 0.0)
        deficit = 1 - om / k
        pred = k * k * np.sin(2 * ph) ** 2 / 24
        if pred > 1e-12:
            coefs.append(deficit / pred)
    # massive O(theta) diagonal anisotropy: om^2 ~ th^2 + k^2 + 2 kx ky th
    th, k = 0.05, 0.05
    om_d1 = omega2d(k / np.sqrt(2), k / np.sqrt(2), th)      # kx ky = k^2/2
    om_d2 = omega2d(k / np.sqrt(2), -k / np.sqrt(2), th)     # kx ky = -k^2/2
    aniso = (om_d1 ** 2 - om_d2 ** 2) / (2 * k * k * th)      # should -> 1
    return err_formula, np.mean(coefs), np.std(coefs), aniso


if __name__ == "__main__":
    np.set_printoptions(precision=6, suppress=True)

    err, zit, zit_pred = exp1_dispersion()
    print(f"[1] dispersion max|eps - analytic| = {err:.2e}; "
          f"zitter freq = {zit:.4f} (pred {zit_pred:.4f})")

    leak, vf, vpred, vgmax = exp2_cone()
    print(f"[2] cone leakage max = {leak:.2e}; front slope = {vf:.4f}; "
          f"cos(theta) = {vpred:.4f}; max|v_g| = {vgmax:.6f}")

    modes, gap = exp3_kink()
    print(f"[3a] clean kink modes (eps, x, xi): {[(f'{e:.2e}', x, f'{xi:.2f}') for e, x, xi in modes]}; "
          f"next |eps| = {gap:.4f}; xi_pred = {1/0.3:.2f}")
    modes_d, _ = exp3_kink(disorder=0.05, seed=1)
    print(f"[3b] with theta-disorder 0.05: eps = {[f'{e:.2e}' for e, _, _ in modes_d]}")
    modes_b, _ = exp3_kink(chiral_break=0.02)
    print(f"[3c] with chiral-breaking 0.02: eps = {[f'{e:.2e}' for e, _, _ in modes_b]}")

    for k0 in (0.3, 0.45, 0.6):
        Tm, Tp = exp4_step(k0=k0)
        print(f"[4] mass step k0={k0}: T_measured = {Tm:.4f}, T_Dirac = {Tp:.4f}")

    for phi in (np.pi / 2, np.pi):
        mols = exp5_molecule(phi=phi)
        s = [(f"eps={e:.4f}", f"gap={d:.4f}", f"spread={sp:.1f}") for e, d, sp in mols]
        print(f"[5] molecules theta=0.4 K=0 phi={phi:.3f}: {s}")
    Ks = np.array([0.0, 0.3, 0.45, 0.6])
    eps_mol = []
    for K in Ks:
        mols = exp5_molecule(phi=np.pi, K=K)
        eps_mol.append(max(m[0] for m in mols))
    eps_mol = np.array(eps_mol)
    A = np.vstack([np.ones_like(Ks), Ks ** 2]).T
    coef, *_ = np.linalg.lstsq(A, eps_mol ** 2, rcond=None)
    M, cstar = np.sqrt(coef[0]), np.sqrt(coef[1])
    resid = np.max(np.abs(np.sqrt(A @ coef) - eps_mol))
    print(f"[5] molecule dispersion eps(K): {dict(zip(Ks, np.round(eps_mol, 5)))}")
    print(f"[5] relativistic fit eps^2 = M^2 + c*^2 K^2: M = {M:.4f}, "
          f"c* = {cstar:.4f}, max resid = {resid:.1e}  (free walkers: c = 1)")

    ef, cmean, cstd, aniso = exp6_2d()
    print(f"[6] 2D formula max err = {ef:.2e}; massless anisotropy coeff ratio = "
          f"{cmean:.3f} +/- {cstd:.3f} (pred 1); massive diag anisotropy ratio = {aniso:.3f} (pred 1)")
