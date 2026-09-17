---
title: "The Recurrent Causal Code"
subtitle: "A speculative framework with designated falsifiable branches, for emergent spacetime, matter, gravity, and quantum measurement"
version: "0.9"
date: "2026-09-17"
status: "Research programme, not an established physical theory"
---

# The Recurrent Causal Code

A semi-serious attempt at a weird theory of everything. *Very semi-serious.* **Very.**

This serves as the basis for my upcoming sci-fi novel, *The Recovery Horizon*, and for more to come. Do not take it as actual research. I am mostly using AI to come up with a weird theory that could still describe our real world coherently, including the Standard Model and general relativity, all that for my sci-fi novels only.
## A speculative framework with designated falsifiable branches, for emergent spacetime, matter, gravity, and quantum measurement

> **Core claim:** The universe is a self-correcting recurrent quantum network. Spacetime is the geometry of reliable information transfer through that network. Matter is made of persistent recurrent defects. Gauge fields compare local code frames. Gravity is the universal deformation of decoding capacity produced by energy and information flow. [W, decomposed and tagged claim by claim below and in Appendix F]

This document develops that claim as far as it can honestly be developed without pretending that an attractive idea is already a complete theory.

Some results below are exact theorems inside explicitly defined toy models. Some are conditional recovery results, meaning that general relativity or the Born rule follows once additional assumptions are imposed. Some are phenomenological conjectures. And some are simply open problems.

That separation matters, so from v0.2 onward every substantive claim carries an explicit tag.

## Claim tags

| Tag | Meaning |
|---|---|
| [E] | Established. Derived, checked, load-bearing. Disagreeing requires overturning published, replicated work. For toy-model theorems, [E] certifies the mathematics, not the physics. |
| [S] | Solid but conjectural. A serious research literature exists, competent people defend it, it is not settled. |
| [W] | Wild. An extrapolation. A direction to push, not a claim to believe. |
| [P] | Promissory. A place where "emergent" or "should follow" appears without a mechanism. Physics is littered with unpaid promissory notes; the honest thing is to stamp them as they are written. |

## Changes in v0.9

1. Added Appendix K, opening Phase 4: **the first $\gamma$ realization with the gravitational sign — and $\gamma\to1$ at a distinguished point.** The probe lives entirely in the code layer: a toric-code $\mathbb{Z}_2$ syndrome cellular automaton with thermal noise set by local stabiliser couplings and a local recurrent decoder. Clock = emergent syndrome autocorrelation time; metric = G.9 cost of the *measured* anyon exposure. No correlational proxy, no inserted functional forms (K.1).
2. Sign result: a capacity load slows the local clock AND lengthens code distances, at every parameter tested — the first realization in the programme with both signs right, where all four matter-correlation realizations (v0.5-v0.8) gave metric contraction (K.2).
3. Magnitude result: $\gamma$ is generically $O(1)$ (1-8, no tuning needed for order unity) and falls monotonically with vacuum defect density; the linearized $\gamma$ **crosses 1 at $\bar n\approx0.22$**, coinciding within resolution with the knee of the decoder's capacity curve ($\bar n_{\max}\approx0.29$): $\gamma=1$ at marginal repair utilization. Postulate 6 independently places the vacuum at the critical coding point — the first structural, rather than tuned, route to $\gamma=1$ the programme has exhibited (K.3). Tagged honestly: coincidence-of-scale at present, not a theorem (K.4).
4. Exhibited gaps: the crossing point is metric-definition dependent at $O(1)$ precision (linearized vs compounded cost differ); and the response has **no far field** — geodesic $\gamma$ decays within a few ball radii, as it must while nothing propagates the strain. A $1/r$ potential requires dynamical capacity (a field equation), which is the Phase 5 object (K.4).
5. Companion code: `code_layer.py` (bitwise GPU CA, gauge-invariant syndrome-sector observables, common-random-number variance reduction), `--exp gamma5`, validation suite `tests/smoke3.py`. Two instructive bugs are recorded: the raw error field is gauge-variant (observables must be syndrome-sector), and anyon residence time is decoder-blind (the honest clock is the autocorrelation time).
6. Kill-criterion 15 status updated: the scoped exclusion of v0.7-v0.8 stands, but "no working mechanism" no longer describes the situation — the code layer supplies sign, magnitude, and a candidate selection principle. What it does not yet supply: definition-independence of the crossing, and a far field.

## Changes in v0.8

1. **Successor requirement 1 of §13.4 — interacting matter — tested at the mean-field level, and closed negative (J.3c).** Self-consistent Hartree-Fock for spinless fermions with nearest-neighbour interaction $V$ adds the two backreaction channels the free theory lacked (Fock bond renormalisation, Hartree density potentials). Repulsive $V$ amplifies the metric response roughly tenfold — through the same wrong-sign channel ($\gamma_{\mathrm{mi}}\to-0.14$ at $V=1.5$, distances still shrink), while the canonical proxy moves small-positive: the proxies now disagree on sign, both far from $+1$. Attractive $V$ destabilises the HF iteration near phase separation with no coherent trend. $V=0$ reproduces the static probe exactly.
2. Scope: mean-field interacting matter is excluded; genuinely correlated vacua (beyond-HF, e.g. DMRG-class) remain open but are no longer the natural next step — three independent realizations have now failed through the same symptom (capacity load shortens correlational distances). The remaining §13.4 successors — strain on the code layer, operational code-subspace geometry — are Phase-4 objects and are now the *only* open routes.
3. Companion code: `hf_state` (Anderson-accelerated HF with per-step chemical-potential solve, CDW order parameter reported — the half-filled model orders for $V\gtrsim0.5$ as it must), `gamma_probe_hf`, `--exp gamma4`; validation suite extended to 14 groups.

## Changes in v0.7

1. **The variational backreaction $\gamma$ probe — the last structural exit of J.3 — was run, and it failed. Kill criterion 15 fires for the free-fermion capacity-strain realization.** Both states relaxed as true equilibria of $F(w)=\Omega_{\mathrm{matter}}(w;T)+\tfrac{\kappa}{2}\sum_e(w_e-w^{\mathrm{load}}_e)^2$ (Anderson-accelerated stationarity solve, residuals $10^{-8}$; $\kappa\to\infty$ reproduces the static probe exactly). Across $L=24,32,48$, both sectors, the stable regime $\kappa\ge1$ gives $|\gamma_{\mathrm{mi}}|\le0.05$ — the static blindness persists at genuine backreacted equilibria — and the soft regime $\kappa\approx0.5$, just above capacity collapse, gives converged fixed points with $\gamma_{\mathrm{mi}}=-1.4$ to $-1.7$: order unity, **wrong sign** (distances shrink under load). No $\kappa$ yields $\gamma\approx+1$ (J.3b).
2. Scope of the kill, stated precisely: what is excluded is the conjunction {free-fermion matter, link-capacity scalar strain, correlational reconstruction metrics}. §13.4's mechanism survives, if at all, only in realizations with interacting matter, strain acting on the code layer rather than hopping amplitudes, or genuinely operational (code-subspace) geometry — each a Phase 4-5 object, none currently exhibited (§13.4, §26).
3. Solver delivered and validated: `variational_weights` (smeared grand potential, Anderson mixing, honest converged/stalled/collapsed classification), `gamma_probe_var`, `--exp gamma3` κ-ladder runner; smoke tests extended to 13 groups, including exact $\kappa\to\infty$ equivalence at matched smearing. A methods note: at criticality the $T=0$ ground state is discontinuous in the weights through zero-mode reshuffling; relaxation and measurement must share the same small smearing $T$.
4. Pointers updated in §13.4, §22.4, §26; Appendix F ledger extended; J.8 table updated.

## Changes in v0.6

1. Added Appendix J, delivering the Phase-2.5 remainder tests of Appendix I: the two $\gamma$ exits, the gapless binding tail, the 3D cone rerun, shortcut certification, and annealing with degree-preserving moves. Companion code extended (`petz.py`, `strain2.py`, upgraded `cone.py`, `geometry.py`, `anneal.py`); every claim is backed by the validation suite `tests/smoke2.py`.
2. **$\gamma$ exit 1 closed, negative:** the proxy is not the culprit. Three independent recoverability proxies — mutual information, canonical-correlation transport, and exact many-body Petz recovery fidelity — all measure $|\gamma_{\mathrm{proxy}}|\le0.08$ under a static load (J.2). The static free-fermion realization genuinely lacks the metric response.
3. **$\gamma$ exit 2 tested: backreaction produces an instability, not $\gamma=1$.** The self-consistent capacity-follows-flux map has no stable intermediate fixed point: subcritical coupling returns to small negative $\gamma$; supercritical coupling collapses the *entire lattice* to minimum capacity (a Jeans-like runaway with no restoring term). $|\gamma|$ crosses unity only on unconverged transients (J.3). The designed successor probe is variational: minimise $E_{\mathrm{matter}}(w)+\tfrac{\kappa}{2}\sum_e(w_e-w^{\mathrm{load}}_e)^2$, restoring the quadratic strain cost of §24.4 that the flux map omitted.
4. **Correction to I.9:** the defect-defect force is not uniformly attractive. The exact $O(\varepsilon^2)$ polarization measurement resolves a strict parity alternation (repulsive at even, attractive at odd separations on the bipartite half-filled lattice); the v0.5 scan sampled odd $r$ only. Critical mediator: power-law envelope $|V|\sim r^{-6.0\pm0.3}$ ($R^2=0.99$, size-independent); gapped: exponential $\xi\approx0.65a$ (J.4). Consequence: the matter-mediated force is Casimir/RKKY-grade, not gravity-grade — §12's gravity must live in the capacity sector, not in matter-mediated dispersion forces.
5. 3D cone delivered: with the saturation-bracketing time grid the 3D fronts are ballistic in the emergent metric, $v=7.04\to6.88$ and anisotropy $4.5\%\to3.1\%$ over $L=14\to18$ — the isotropizing-cone trend now holds in three dimensions; the 2D rerun cross-validates the method against the fixed grid to $0.3\%$ (J.5).
6. Shortcut certification delivered: the flagged far pairs decompose into metric-inflation artifacts (graph-close pairs the cell metric mislabels far; they carry every extreme MI ratio, dominant in gapped vacua) and the fat tail of critical correlations just above the lenient nearest-neighbour-median threshold. No wormhole class: the §7.2 no-shortcut condition passes once thresholds are gap-scaled (J.6).
7. Annealing with degree-preserving swaps: acceptance unfroze, deeper minima found — and they are *less* geometric ($d_{\mathrm{eff}}\approx0.0$-$0.24$ at the cold rungs). The sampler is exonerated; the §24.5 action itself has a non-geometric ground state. Kill criterion 5 is now engaged for this action family; Phase 3 requires action redesign, not more compute (J.7).
8. Pointers updated in §13.4, §22.4, §25, §26; Appendix F ledger extended; Appendix I subsections annotated with their J resolutions.

## Changes in v0.5

1. Added Appendix I, delivering Phase 2 of the roadmap: reconstruction geometry at scale, measured on exact free-fermion (Gaussian) vacua. All numbers are reproducible with the companion package `rcc_phase2/` and the driver script `rcc_phase2_cmds.sh` distributed alongside this document; every quoted value is the mean over four independent replicas in fp64.
2. Emergent metric delivered: the MI-proxy reconstruction metric on two-dimensional lattice vacua measures $d_{\mathrm{eff}}=2.06\pm0.01$ with curvature proxy $\to0$ as $L$ grows; three-dimensional vacua flow $2.19\to2.92\to3.18$ toward $3$; a degree-6 expander control correctly *fails* to look geometric — the estimators do not hallucinate geometry (I.2, I.3).
3. Partition covariance measured: the G.9 scaling-window promissory note is now a trend, Pearson $0.960\to0.978\to0.987$ and stress $0.099\to0.073\to0.055$ over $L=32\to64$ (I.4).
4. Area law scoped: gapped sectors obey a clean area law, $S/|\partial A|=0.184$ stable across sizes; critical sectors show the known logarithmic violation [62, 63] — §15's area-law language presumes a gapped sector (I.5).
5. Geodesic propagation delivered in two dimensions: influence fronts are linear in the *emergent* metric with anisotropy $3.8\%\to3.1\%\to1.9\%$ over $L=32\to64$, falling roughly as $1/L$; the correlational and dynamical faces of Postulate 5 agree in-model (I.7). The 3D cone runs were instrumentally invalid (front saturation) and are a rerun item.
6. **Key negative finding: the §13.4 $\gamma$ mechanism fails in this realization.** Under a capacity load the clock proxy responds at $O(\varepsilon)$ while the MI-metric response is two to three orders smaller and of the opposite sign: $\gamma_{\mathrm{proxy}}\in[-0.08,0]$ across all 72 (size, load, radius, sector) runs, with no drift toward 1 as $L$ grows. Kill criterion 15 is not formally triggered — the proxy-to-PPN mapping is [P] — but the first in-model test of the structural mechanism is failed, converting §13.4 from hopeful to exhibited-unpaid (I.8).
7. Goal-4 attraction probe positive: two capacity loads attract through the fermionic vacuum, $V(r)<0$ with magnitude $\propto\varepsilon^2$ and exponential range under a gapped mediator — an induced, universal, short-range attraction, Casimir/RKKY-like (I.9).
8. Goal-1 annealing bridge negative so far: the pure graph action anneals into non-geometric clumps ($d_{\mathrm{eff}}\approx-4.9$); adding fermionic matter pushes cold rungs toward geometry ($d_{\mathrm{eff}}\approx0.2$–$1.0$) but the chains freeze before any two-dimensional phase forms. Kill criterion 5 untested, not triggered (I.10).
9. Shortcut certification incomplete: the §7.2 no-shortcut condition is passed cleanly at $L=32$ but the far-pair MI count and ratio grow with $L$; partition-artifact versus genuine-outlier is unresolved and needs a node-level operational check (I.6).
10. Phase 2 of §25 marked delivered-with-remainders; pointers in §7.2, §7.3, §13.4, §15.1, §22.1, §22.4, §26; references 62-64; Appendix F ledger extended.

## Changes in v0.4

1. Added Appendix H, delivering Phase 1 of the roadmap: fixed-graph recurrent matter, with analytical results and numerical measurements. All numbers are reproducible with the companion script `rcc_phase1.py` distributed alongside this document.
2. Dirac limit extended: a position-dependent recurrence angle is a scalar mass background, link phases are minimal $U(1)$ coupling; the full real-space spectrum matches the analytic dispersion at the $10^{-14}$ level (H.2).
3. New exact two-dimensional dispersion, $\cos\omega\tau=\cos k_xa\,\cos k_ya\,\cos\theta-\sin k_xa\,\sin k_ya\,\sin\theta$, with derived and numerically confirmed anisotropy coefficients: the exact massless cone of $1+1$D does not survive in two dimensions (H.2).
4. Defect stability delivered: a kink in the recurrence angle binds a Jackiw-Rebbi mode at quasienergy zero ($|\varepsilon|<3\times10^{-15}$), with localisation length $\hbar/mc$, pinned under chiral-preserving disorder and displaced by $O(\delta)$ under chiral breaking (H.5).
5. Scattering delivered: mass-step transmission matches the continuum Dirac prediction to $0.3\%$; two interacting walkers form molecule bound states (H.6).
6. Key finding: composite defects have relativistic-form dispersion with a renormalised limiting velocity $c^\ast\approx0.897\,c$. Cone universality across species fails in-model, converting the §6.3/§23.3 worry from generic to exhibited: the vacuum must enforce a universal cone, it does not get one for free (H.6).
7. Finite-speed bounds exact: strict cone with zero measured leakage, and maximal group velocity $v_{\max}=c\cos\theta$ in closed form — mass costs cone speed (H.3).
8. Kill criterion 4 partially tested and survived: the recurrence-mass relation persists for interacting composites through the rest quasienergy.
9. Phase 1 of §25 marked delivered-with-remainders; pointers in §6.3, §8.3, §9.5, §21.3, §22.2; references 57-61; Appendix F ledger extended.

## Changes in v0.3

1. Added Appendix G, delivering Phase 0 of the roadmap: formal foundations.
2. Exact definitions of system, event, memory, code, decoder, and emergent geometry (G.1, G.3, G.4).
3. Causal consistency proved rather than sketched: schedule-independence of the global circuit (Theorem G.1), no-signalling with a complete proof upgrading Theorem 1 (Corollary G.2), and causality of adaptive syndrome-controlled settling (Proposition G.3).
4. Decoder freedom eliminated: the canonical Petz decoder is adopted throughout, near-optimal by the Barnum-Knill bound (G.7), closing one instance of §23.5's "too much freedom".
5. Parameter counting delivered: the minimal model carries six continuous dimensionless couplings plus finitely many discrete choices (G.5); kill criterion 14 becomes checkable.
6. Continuum limit defined as a four-layer procedure — criticality, measured Gromov-Hausdorff convergence of reconstruction geometry, faithful Lorentzian embedding, convergence of logical correlation functions — with the free sector verified to pass (G.6, Theorem G.4).
7. Proper-time concentration identified as a hygiene requirement tying worldline-depth fluctuations to clock stability (G.6, Layer 4).
8. Phase 0 of §25 marked delivered-with-remainders; pointers added in Postulate 6, §5, §6.1, §7.1, §23.5; references 52-56; Appendix F ledger extended.

## Changes in v0.2

1. Corrected the dispersion phenomenology (§21.3): the exhibited walk has an exactly Lorentz-invariant massless sector, and the leading deviation is a $p^2m^2$ cross term, not $p^4$.
2. Repaired the event/memory ontology (Postulates 2-3) with a two-sorted formulation: systems with worldlines, events as their updates.
3. Made explicit the antichain construction and the no-shortcut condition behind reconstruction geometry (§7).
4. Promoted $\Phi=\Psi$ (PPN $\gamma=1$) to the leading gravitational target (§13.4, §22.4, §26).
5. Confronted radiative percolation of Lorentz violation (§23.3) and Marolf's kinematic-nonlocality no-go (§23.1).
6. Recalibrated the novelty claim of §9: the dispersion mathematics is established quantum-walk theory; RCC's claim is the recurrence-latency interpretation.
7. Sharpened the dark-energy ansatz into a kill criterion: it cannot cross $w=-1$ while current DESI-era fits prefer a crossing (§18, §26).
8. Grounded the dark-sector signatures in existing constraints: microlensing bounds on quantised defect masses, and the quantitative deadness of purely gravitational clock transients (§17.5, §21.5-21.7).
9. Added the missing neighbourhood: Kitaev, Wen, Cao-Carroll-Michalakis, Zurek, Harlow-Hayden, Derevianko-Pospelov, Rosi, Busch, Masanes-Galley-Müller, and others [31-51].
10. Replaced Appendix F with a complete tagged claim ledger, and added inline tags throughout.

A theory of quantum gravity does not become serious because it uses advanced vocabulary. It becomes serious when it states its variables, gives equations, reproduces known physics, identifies where assumptions enter, and offers experiments capable of killing it.

---

# Contents

1. [Executive summary](#1-executive-summary)  
2. [What the theory is trying to explain](#2-what-the-theory-is-trying-to-explain)  
3. [Relationship to existing ideas](#3-relationship-to-existing-ideas)  
4. [Foundational postulates](#4-foundational-postulates)  
5. [The mathematical substrate](#5-the-mathematical-substrate)  
6. [Causality and emergent light cones](#6-causality-and-emergent-light-cones)  
7. [Geometry as reconstruction cost](#7-geometry-as-reconstruction-cost)  
8. [Matter as recurrent topological defects](#8-matter-as-recurrent-topological-defects)  
9. [Mass as recurrence latency](#9-mass-as-recurrence-latency)  
10. [Gauge symmetry as code-frame redundancy](#10-gauge-symmetry-as-code-frame-redundancy)  
11. [The Standard Model problem](#11-the-standard-model-problem)  
12. [Gravity as code strain](#12-gravity-as-code-strain)  
13. [The Newtonian limit](#13-the-newtonian-limit)  
14. [Conditional recovery of Einstein gravity](#14-conditional-recovery-of-einstein-gravity)  
15. [Black holes and the area law](#15-black-holes-and-the-area-law)  
16. [Quantum measurement and the Born rule](#16-quantum-measurement-and-the-born-rule)  
17. [Dark matter](#17-dark-matter)  
18. [Dark energy and cosmology](#18-dark-energy-and-cosmology)  
19. [Neutrinos, baryon number, and possible strong predictions](#19-neutrinos-baryon-number-and-possible-strong-predictions)  
20. [What the framework can already reproduce](#20-what-the-framework-can-already-reproduce)  
21. [Predictions and experimental tests](#21-predictions-and-experimental-tests)  
22. [Numerical research programme](#22-numerical-research-programme)  
23. [No-go theorems and failure modes](#23-no-go-theorems-and-failure-modes)  
24. [A minimal toy action](#24-a-minimal-toy-action)  
25. [Development roadmap](#25-development-roadmap)  
26. [Criteria that would kill the theory](#26-criteria-that-would-kill-the-theory)  
27. [Conclusion](#27-conclusion)  
28. [Appendix A: discrete Dirac derivation](#appendix-a-discrete-dirac-derivation)  
29. [Appendix B: causal influence bound](#appendix-b-causal-influence-bound)  
30. [Appendix C: gauge covariance](#appendix-c-gauge-covariance)  
31. [Appendix D: Newtonian code-strain functional](#appendix-d-newtonian-code-strain-functional)  
32. [Appendix E: simulation pseudocode](#appendix-e-simulation-pseudocode)  
33. [Appendix F: tagged claim ledger](#appendix-f-tagged-claim-ledger)  
34. [Appendix G: formal foundations (Phase 0)](#appendix-g-formal-foundations-phase-0)  
35. [Appendix H: Phase 1 — fixed-graph recurrent matter](#appendix-h-phase-1--fixed-graph-recurrent-matter)  
36. [Appendix I: Phase 2 — reconstruction geometry at scale](#appendix-i-phase-2--reconstruction-geometry-at-scale)  
37. [Appendix J: Phase 2.5 — remainder tests](#appendix-j-phase-25--remainder-tests)  
38. [Appendix K: Phase 4 opening — the code-layer gamma](#appendix-k-phase-4-opening--the-code-layer-gamma)  
39. [References](#references)  

---

# 1. Executive summary

The Recurrent Causal Code, abbreviated **RCC**, begins with five bets.

1. **Quantum theory is more fundamental than spacetime.** [S]
2. **The microscopic substrate is locally finite and relational.** [S]
3. **Its dynamics is recurrent and self-correcting rather than a single pass from one universal time slice to the next.** [W]
4. **Observed particles are stable logical excitations of a quantum code.** [W]
5. **Gravity is the long-wavelength response of the code's communication and error-correction capacity to excitation load.** [W]

The word *code* is literal. Physical information is redundantly represented. Local microscopic degrees of freedom are not directly identical to observed particles or fields. Observable objects are logical patterns that can survive replacement, noise, local rewiring, and partial loss of microscopic constituents.

The word *recurrent* is also literal. Each microscopic region contains memory. A local update may need multiple internal cycles before it produces a stable outgoing state. The number and phase structure of those cycles affect propagation. In the simplest toy model, a recurrent internal rotation generates the relativistic mass term.

The word *causal* means that information transfer is constrained by a directed local network. There is no fundamental background metric. A light cone emerges because bounded local quantum interactions transmit influence at a finite effective speed. This is related to Lieb-Robinson bounds in many-body systems, though RCC treats the network and its effective geometry as dynamical rather than fixed [3, 4].

The theory proposes the following dictionary.

| Observed concept | RCC interpretation |
|---|---|
| Spatial distance | Minimum reconstruction or communication cost |
| Time | Partial order and accumulated local update depth |
| Speed of light | Maximum stable information-propagation velocity |
| Particle | Persistent logical or topological defect |
| Mass | Internal recurrence frequency or propagation latency |
| Gauge freedom | Freedom to choose local logical encoding frames |
| Gauge field | Comparison map between neighbouring code frames |
| Curvature | Spatial variation of causal and reconstruction capacity |
| Gravity | Universal code strain generated by energy and information load |
| Horizon | Boundary beyond which low-depth reconstruction fails |
| Black-hole entropy | Number of independent logical channels crossing a cut |
| Dark matter | Stable code defects without visible gauge interfaces |
| Dark energy | Large-scale redundancy or repair pressure of the code |
| Measurement | Formation of a stable, redundantly recoverable record |

The framework is deliberately not string theory. It does not assume strings, branes, supersymmetry, compactified dimensions, an asymptotic holographic boundary, or a preselected ultraviolet particle spectrum.

It does borrow useful mathematics wherever it works: quantum error correction, causal networks, quantum cellular automata, topological phases, entanglement thermodynamics, gauge connections, information geometry, and discrete quantum walks.

The most important honest statement is this:

> RCC does not currently derive the Standard Model, nonlinear general relativity, the observed dark-matter abundance, or the measured cosmological parameters from a unique microscopic model.

It does provide a route by which those derivations might be attempted, several exact toy results, and a set of predictions that can be sharpened into experimental targets.

---

# 2. What the theory is trying to explain

Any beyond-Standard-Model framework must start from the actual situation rather than from aesthetic disappointment.

## 2.1 The Standard Model works extremely well

The Standard Model of particle physics is a remarkably accurate effective theory. Any replacement must recover:

- relativistic quantum field theory,
- the gauge group $SU(3)\times SU(2)\times U(1)$,
- chiral fermions,
- anomaly cancellation,
- spontaneous electroweak symmetry breaking,
- the observed masses and mixing matrices,
- perturbative scattering amplitudes,
- nonperturbative QCD,
- and the observed absence of many theoretically allowed processes.

RCC therefore treats the Standard Model as an infrared fixed point or logical sector, not as something to discard casually.

## 2.2 General relativity also works extremely well

The weak equivalence principle has survived extremely precise tests. The MICROSCOPE mission found no differential free-fall violation between titanium and platinum, constraining the Eötvös parameter to

$$
\eta(\mathrm{Ti},\mathrm{Pt})
=
[-1.5\pm2.3_{\mathrm{stat}}\pm1.5_{\mathrm{syst}}]\times10^{-15}.
$$

Any emergent-gravity model must explain why composition dependence is so strongly suppressed [19].

## 2.3 Yet the combined picture is incomplete

At minimum, we still need to understand:

- quantum gravity,
- black-hole information,
- the origin of spacetime locality,
- neutrino mass,
- dark matter,
- cosmic acceleration,
- the baryon asymmetry,
- the values and pattern of Standard Model parameters,
- and the quantum measurement problem.

Neutrino oscillations require nonzero neutrino mass. Direct kinematic measurements currently bound the effective electron-neutrino mass rather than determining it. KATRIN reports

$$
m_\nu < 0.45\ \mathrm{eV}
\quad
\text{at 90\% confidence}.
$$

That is direct evidence that the minimal massless-neutrino Standard Model is incomplete, while still giving very little guidance about the underlying mechanism [20].

## 2.4 The silence of new sectors is information

There is no logical rule saying new physics must appear as a large zoo of weak-scale particles. The absence of decisive direct evidence for such a zoo suggests taking seriously the possibility that the deepest missing structure is not another ordinary field living in spacetime.

RCC makes that bet.

---

# 3. Relationship to existing ideas

RCC is not created from nothing. Several established research programmes contain pieces of the same puzzle.

## 3.1 Causal sets

Causal-set theory proposes that fundamental spacetime is a locally finite partial order. Its slogan is often summarised as “order plus number gives geometry” [5, 6].

RCC keeps:

- local finiteness,
- relational causal order,
- the rejection of a fixed continuum background.

RCC changes:

- each event carries finite quantum memory,
- local evolution is a quantum channel,
- the causal substrate is also an error-correcting code,
- effective distance is tied to reconstruction cost,
- recurrence latency participates in particle mass.

## 3.2 Quantum cellular automata and quantum walks

Quantum cellular automata can recover Weyl, Dirac, and Maxwell-like dynamics in appropriate continuum limits [9, 10].

RCC keeps:

- finite local Hilbert spaces,
- causal unitary updates,
- emergent relativistic dispersion.

RCC changes:

- the graph is not assumed fixed,
- the internal update is recurrent,
- geometry is reconstructed from influence and recoverability,
- matter and geometry backreact through code strain.

## 3.3 Quantum graphity

Quantum graphity treats graph connectivity itself as a quantum degree of freedom and explores emergent locality [7].

RCC adds:

- explicit logical code spaces,
- reconstruction-based geometry,
- local code frames as gauge structure,
- recurrent defect dynamics,
- an information-capacity interpretation of gravity.

## 3.4 Entanglement and emergent geometry

There are strong hints that entanglement structure can encode geometry. In holographic models, quantum error correction explains why one bulk operator may be reconstructed in multiple boundary regions [13, 14]. Van Raamsdonk argued that reducing entanglement can geometrically pull regions apart [8].

RCC does not assume AdS/CFT, a conformal boundary, or string theory. It takes only the more general lesson:

> Redundant quantum reconstruction can behave geometrically.

## 3.5 Thermodynamic gravity

Jacobson derived the Einstein equation from horizon entropy proportional to area and the local thermodynamic relation $\delta Q=T\,dS$ [11]. A later entanglement-equilibrium argument connected vacuum entanglement stationarity to the semiclassical Einstein equation under additional assumptions [12]. Those assumptions have known limitations, especially for general nonconformal matter [15].

RCC interprets these results as clues that the Einstein equation may be a constitutive relation of a deeper quantum substrate.

## 3.6 What is intended to be new

The distinctive RCC conjunction is:

1. **A dynamical quantum causal network**
2. **with recurrent local memory**
3. **that implements a distributed quantum error-correcting code**
4. **whose reconstruction geometry is physical space**
5. **whose recurrent defects are matter**
6. **whose code-frame transitions are gauge fields**
7. **and whose capacity strain is gravity**

Each ingredient has relatives in the literature, several closer than v0.1 acknowledged. Particles as logical defects of a code is realised exactly in the toric code [31]. Emergent gauge bosons and emergent fermions from bosonic qudit models is Wen's programme [32, 33]. Geometry from the entanglement structure of a quantum state is the construction of Cao, Carroll, and Michalakis [34]. The mathematics of mass from a coin rotation is established quantum-walk theory [9, 10, 35].

What is intended to be distinctively RCC is the conjunction, plus one interpretive move: the identification of **mass, proper time, and decoding latency as the same resource** of a recurrent self-correcting substrate, with geometry, particle identity, gauge structure, gravity, dark sectors, and measurement derived from that single code-dynamical substrate [W].

---

# 4. Foundational postulates

## Postulate 1: Finite local quantum capacity [S]

Every fundamental event or processing element $v$ carries a finite-dimensional Hilbert space

$$
\mathcal H_v \cong \mathbb C^{d_v},
\qquad
2\le d_v<\infty.
$$

No individual node contains an infinite continuum of physical degrees of freedom.

## Postulate 2: Systems, events, and relational causality [S]

There is a countable set of *systems*. Each system participates in a locally finite sequence of *events*: its worldline. The events form a locally finite directed structure

$$
\mathcal C=(V,E,\prec),
$$

where $\prec$ is an acyclic causal order on completed events. Edges are of two kinds: **message edges** between events of different systems, and **memory edges** between consecutive events of the same system.

There is no fundamental spatial coordinate $x$, metric $g_{\mu\nu}$, or external time parameter with direct observable meaning.

The two-sorted formulation matters. An event is completed and cannot persist; a system persists and cannot recur without violating acyclicity. Version 0.1 conflated the two by giving events persistent memory. Memory belongs to the worldline, not to the event.

## Postulate 3: Local recurrent memory [W]

The memory edge carries a finite-dimensional state $\mathcal M_v$ of a system between its own consecutive events. A local update is an isometry or completely positive trace-preserving map of the form

$$
\Phi_v:
\mathcal B\!\left(
\mathcal H^{\mathrm{in}}_v\otimes\mathcal M_v
\right)
\rightarrow
\mathcal B\!\left(
\mathcal H^{\mathrm{out}}_v\otimes\mathcal M_v
\right).
$$

A *recurrent settling* of depth $L$ is the worldline segment of $L$ consecutive events of one system between accepting an input and emitting a stable logical output. The iteration label $r$ of §5.2 enumerates events along the worldline, so recurrence is unrolled into the causal order and acyclicity is preserved.

Physical time is reconstructed from causal ordering and accumulated proper worldline depth, not from the bookkeeping label.

## Postulate 4: Logical rather than microscopic ontology [W]

Observable particles and fields inhabit protected logical subspaces

$$
\mathcal H_{\mathrm{logical}}
\subset
\bigotimes_{v\in R}\mathcal H_v
$$

for suitable regions $R$.

Microscopic degrees of freedom are analogous to physical qubits. Observable matter is analogous to encoded logical information.

## Postulate 5: Geometry from recoverability and influence [W]

The effective geometry of a low-energy state is determined by:

- which regions can causally influence which others,
- how rapidly influence propagates,
- how accurately logical information can be reconstructed across the network,
- and how these properties change under excitation load.

## Postulate 6: Stable vacuum as a coding phase [P]

The observed vacuum is a stable, approximately homogeneous critical phase of the network. Lorentz symmetry, locality, and smooth dimensionality are infrared properties of that phase.

This postulate is made precise in v0.3: the vacuum trajectory must approach a second-order critical fixed point of the coupling flow — continuum limits live only there — whose relevant boost-violating operators all vanish (Appendix G.6, Layer 0).

## Postulate 7: Universal backreaction [W]

All persistent logical excitations consume or redirect finite network capacity. The resulting change in causal and reconstruction structure is universal. Its long-wavelength description is gravity.

## Postulate 8: Global consistency of records [W]

A macroscopic measurement outcome is a logical record redundantly reconstructable from many subsystems. Allowed physical histories are globally consistent assignments of such records to the causal network.

This postulate does not by itself derive the Born rule. That problem is treated separately.

---

# 5. The mathematical substrate

This section gives working definitions. Appendix G, added in v0.3, gives the exact ones: it proves causal consistency, fixes the canonical decoder, counts parameters, and defines the continuum-limit procedure.

## 5.1 Quantum causal network

Let $V$ be a countable set of events. For each directed edge $e:u\to v$, associate a finite-dimensional message Hilbert space $\mathcal H_e$.

Each event $v$ has incoming and outgoing spaces

$$
\mathcal H^{\mathrm{in}}_v
=
\bigotimes_{e=(u,v)\in E}\mathcal H_e,
\qquad
\mathcal H^{\mathrm{out}}_v
=
\bigotimes_{e=(v,w)\in E}\mathcal H_e.
$$

A local update is an isometry

$$
V_v:
\mathcal H^{\mathrm{in}}_v\otimes\mathcal M_v
\rightarrow
\mathcal H^{\mathrm{out}}_v\otimes\mathcal M_v\otimes\mathcal E_v,
$$

where $\mathcal E_v$ is an environment or syndrome space.

If $\mathcal E_v$ is retained as part of the global state, evolution is unitary. If it is ignored, the effective local map is a quantum channel.

## 5.2 Recurrent update

Let $r\in\mathbb N$ label internal recurrence steps. A local recurrent update can be written

$$
\rho^{(r+1)}_v
=
\Phi_v\!\left(
\rho^{(r)}_v,
\{\rho^{(r)}_u:u\in N^-(v)\}
\right).
$$

A stable logical output is reached when a chosen logical observable changes by less than a tolerance:

$$
\left\|
\mathcal D_v(\rho^{(r+1)}_v)
-
\mathcal D_v(\rho^{(r)}_v)
\right\|_1
<\varepsilon,
$$

where $\mathcal D_v$ is a decoder.

The number of recurrence steps required,

$$
L_v(\varepsilon)
=
\min
\left\{
r:
\left\|
\mathcal D_v(\rho^{(r+1)}_v)
-
\mathcal D_v(\rho^{(r)}_v)
\right\|_1
<\varepsilon
\right\},
$$

is the **local decoding latency**.

RCC identifies variations in this latency with proper-time and mass effects in suitable limits.

The two settling regimes — fixed unrolling versus adaptive, syndrome-controlled halting — are distinguished exactly in Definition G.4, and both are causally consistent (Proposition G.3).

## 5.3 Code subspace

For a region $R\subset V$, define stabiliser-like constraints

$$
S_a|\psi\rangle=|\psi\rangle,
\qquad
a\in\mathcal A_R.
$$

The local code space is

$$
\mathcal C_R
=
\left\{
|\psi\rangle\in\bigotimes_{v\in R}\mathcal H_v:
S_a|\psi\rangle=|\psi\rangle\ \forall a
\right\}.
$$

This need not be a Pauli stabiliser code. The notation simply makes explicit that physical states occupy a constrained subspace.

## 5.4 Logical reconstruction

Let $\mathcal A_L$ be a logical operator algebra. A region $R$ reconstructs $\mathcal A_L$ if there exists a channel

$$
\mathcal R_R:
\mathcal B(\mathcal H_R)\rightarrow\mathcal A_L
$$

whose reconstruction error is small.

One useful error measure is entanglement infidelity:

$$
\epsilon_R(L)
=
1-F_e(\mathcal R_R\circ\mathcal N_R,\mathrm{id}_L),
$$

where $\mathcal N_R$ is the effective encoding and noise channel into $R$.

Geometry will be built from the costs and errors of such reconstructions.

Throughout the document, the decoder is the canonical Petz decoder of Definition G.7, which is within a factor of two of optimal [52] and removes decoder choice as a free functional parameter of the theory.

---

# 6. Causality and emergent light cones

A discrete substrate must explain why relativistic causal cones emerge rather than producing obvious lattice signalling.

## 6.1 Exact no-signalling without a causal path

### Theorem 1: Network no-signalling [E]

Let $A$ and $B$ be disjoint regions of an acyclic quantum causal network. Assume there is no directed path from $A$ to $B$. Then replacing any trace-preserving local operation in $A$ by another trace-preserving local operation cannot alter the reduced output state in $B$.

### Proof sketch

Write the global channel as a composition of local channels in any topological ordering compatible with $\prec$. Since no output descending from $A$ enters the causal past of $B$, every tensor factor affected by the choice in $A$ is traced out before the reduced state of $B$ is formed. Trace preservation gives

$$
\mathrm{Tr}_A\!\left[\Phi_A(\rho_{AB})\right]
=
\mathrm{Tr}_A(\rho_{AB}).
$$

Repeated application through the network leaves the marginal at $B$ unchanged.

$\square$

This is an exact theorem of the network architecture. It does not require a continuum spacetime.

A complete proof — replacing the sketch above, and covering adaptive syndrome-controlled updates — is given in Appendix G (Theorem G.1, Corollary G.2, Proposition G.3) [E].

## 6.2 Approximate light cone on a local graph

Suppose the effective microscopic interaction graph has maximum degree $z$, and a single update transmits at most a factor $\lambda$ of operator influence through one edge.

Let $d(u,v)$ be graph distance. An influence measure can be defined by

$$
\mathcal I_{u\to v}(n)
=
\sup_{\substack{O_u,O_v\\\|O_u\|,\|O_v\|\le1}}
\left\|
[O_u(0),O_v(n)]
\right\|.
$$

For local bounded dynamics, path counting gives an effective finite propagation speed.

### Theorem 2: Discrete causal influence bound [E]

Under bounded finite-range updates,

$$
\mathcal I_{u\to v}(n)
\le
C
\sum_{m=d(u,v)}^\infty
\frac{(z\lambda n)^m}{m!}.
$$

Consequently, for suitable constants $C,\mu,v_{\mathrm{LR}}>0$,

$$
\mathcal I_{u\to v}(n)
\le
C\exp\left[
-\mu\left(
d(u,v)-v_{\mathrm{LR}}n
\right)
\right].
$$

### Meaning

Outside the effective cone

$$
d(u,v)\gtrsim v_{\mathrm{LR}}n,
$$

influence is exponentially suppressed.

This is the discrete analogue of a Lieb-Robinson bound [3, 4]. The emergent limiting velocity becomes the low-energy speed of light if all stable massless logical excitations share the same fixed-point cone.

Two regimes deserve separation [E]:

1. **Strictly local discrete circuits have an exact cone.** A depth-$n$ circuit of range-one gates has identically zero influence beyond graph distance $n$. No exponential tail is needed. This is the regime of the bare update layers.
2. **The Lieb-Robinson form is what survives coarse-graining.** Hamiltonian or Trotterised dynamics, and the coarse-grained logical time in which one logical tick comprises a fluctuating number $L_v$ of microscopic layers, produce only the exponential bound of Theorem 2.

The exact statement is stronger and free; the asymptotic one is the version that translates into logical time.

## 6.3 Why Lorentz symmetry can emerge

A microscopic network may have a preferred update description while its infrared excitations obey Lorentz symmetry. This is no stranger than rotational symmetry emerging from a crystal or relativistic Dirac cones emerging in condensed-matter systems.

But approximate Lorentz symmetry is not enough. Observations strongly constrain energy-dependent photon propagation and many other forms of Lorentz violation [25].

RCC therefore requires:

1. a vacuum fixed point with one universal causal velocity,
2. suppression of all relevant Lorentz-violating operators,
3. no generic linear correction proportional to $E/E_\ast$,
4. at most higher-order corrections such as

$$
E^2
=
p^2c^2+m^2c^4
+
\xi_2\frac{p^4c^4}{E_\ast^2}
+
O(E_\ast^{-4}).
$$

The coefficient $\xi_2$ must be small, species constrained, or protected by an exact emergent symmetry.

Requirement 2 is where this class of models most often dies quietly. Radiative corrections generically transport Planck-scale Lorentz violation into unsuppressed low-dimension operators unless a symmetry of the fixed point forbids it [47]; see §23.3. And the exhibited toy model is sharper than the generic template above: its massless sector is exactly Lorentz invariant (§21.3), so the burden is to determine which of its properties survive in $3+1$ dimensions [P].

Phase 1 sharpened this burden twice over (Appendix H). In two dimensions the exact massless cone is already lost: anisotropic dispersion appears at $O((ka)^2)$ with coefficients derived in H.2. And requirement 1 — one universal causal velocity — fails in-model once interactions bind composites: the two-walker molecule of H.6 propagates on a renormalised cone $c^\ast\approx0.897\,c$. Cone universality is therefore a property the vacuum must enforce, not inherit [E in-model].

---

# 7. Geometry as reconstruction cost

Mutual information alone is not generally a metric. RCC therefore defines geometry through a path construction. The nearest published relative is the construction of Cao, Carroll, and Michalakis, which recovers spatial geometry from the mutual-information graph of a vacuum state [34]; RCC differs exactly where that construction is weakest, replacing raw mutual information by operational reconstruction cost [W].

## 7.1 One-hop recoverability

For neighbouring regions $i,j$, define a symmetric recoverability score

$$
q_{ij}\in(0,1],
$$

where larger $q_{ij}$ means that logical information can be transported or reconstructed more reliably between the two regions.

Possible choices include:

- optimised entanglement fidelity,
- channel capacity,
- inverse decoding error,
- a function of conditional mutual information,
- or a task-specific recovery probability.

Define an edge cost

$$
\ell_{ij}
=
-\ell_\ast\log q_{ij}.
$$

Perfect one-hop recovery has zero cost. Poor recovery has large cost.

One point v0.1 left silent: the substrate is *directed*, and a symmetric $q_{ij}$ is not defined on causal edges. It is defined on pairs of causally unrelated regions — elements of a maximal antichain, the discrete analogue of a Cauchy slice — via two-way logical reconstruction through their common causal past and future. Constructing spatial geometry from causal order is known to be delicate: naive causal-set distance estimators fail [36]. The existence of antichains on which $d_R$ stabilises and is foliation-covariant is therefore a nontrivial property of the vacuum phase, not a definition [P]. The numerical programme (§22.1) must test foliation-independence explicitly. The exact construction — cuts, cells, symmetrised transport fidelity at a stated scale — is Definitions G.8-G.10.

## 7.2 Path distance

For a path $\gamma:i=v_0\to v_1\to\cdots\to v_n=j$, define

$$
L(\gamma)
=
\sum_{k=0}^{n-1}\ell_{v_kv_{k+1}}.
$$

Then define

$$
d_R(i,j)
=
\inf_{\gamma:i\to j}L(\gamma).
$$

### Theorem 3: Reconstruction path metric [E]

If $\ell_{ij}=\ell_{ji}\ge0$, the graph is connected, and zero-distance nodes are identified, then $d_R$ is a metric on the quotient space.

### Proof

Non-negativity follows from $\ell_{ij}\ge0$. Symmetry follows from $\ell_{ij}=\ell_{ji}$. Identity of indiscernibles holds after identifying zero-distance nodes. For any $i,j,k$, concatenating an approximately shortest path from $i$ to $j$ with one from $j$ to $k$ gives

$$
d_R(i,k)
\le
d_R(i,j)+d_R(j,k).
$$

$\square$

The theorem is elementary. Its physical value comes from what is inserted into $q_{ij}$.

A second caveat: chained decoders make the path construction an *achievability* bound. Small infidelities compose subadditively, so a path of good hops certifies that the true reconstruction cost obeys $d_{\mathrm{true}}(i,j)\le L(\gamma)$. Nothing forbids a direct reconstruction cheaper than every path: long-range entanglement is a nonlocal shortcut. So $d_R$ equals the operational cost only if the vacuum admits no shortcuts, and absence of shortcuts is part of the definition of a geometric phase [P]. Conversely, controlled shortcuts sourced by shared entanglement are not a bug: they are the RCC face of the ER=EPR intuition, expected to behave as geometric handles rather than metric violations [W].

Status after v0.5: the shortcut scan on free-fermion lattice vacua is clean at $L=32$ but the number of far pairs with anomalously high mutual information grows with system size, and whether they are partition artifacts or genuine metric outliers is unresolved (Appendix I.6). The no-shortcut condition is measured, not yet certified.

## 7.3 Effective dimension

Choose a reference region $i$ and define the reconstruction ball

$$
B_R(i,r)
=
\{j:d_R(i,j)\le r\}.
$$

If

$$
|B_R(i,r)|
\propto r^{d_{\mathrm{eff}}}
$$

over a scale range, define

$$
d_{\mathrm{eff}}(r)
=
\frac{d\log |B_R(i,r)|}{d\log r}.
$$

A viable vacuum phase should produce

$$
d_{\mathrm{eff}}(r)\rightarrow3
$$

for large spatial scales while possibly flowing to another value near the microscopic scale.

Status after v0.5: measured with the MI-proxy metric on free-fermion vacua. Two-dimensional lattices reconstruct $d_{\mathrm{eff}}=2.06\pm0.01$ with a flat running-dimension plateau; three-dimensional lattices flow $2.19\to2.92\to3.18$ toward $3$ as the side grows; a random-regular control graph correctly fails to yield any stable dimension (Appendix I.2, I.3).

## 7.4 Curvature from reconstruction geometry

Once $d_R$ approximates a smooth metric space, curvature may be estimated from:

- volume growth,
- geodesic deviation,
- graph Ricci curvature,
- spectral dimension,
- diffusion kernels,
- or small-ball entropy deficits.

For example, in a smooth $d$-dimensional Riemannian space,

$$
\mathrm{Vol}(B_r)
=
\omega_dr^d
\left[
1-\frac{R}{6(d+2)}r^2+O(r^4)
\right].
$$

An RCC simulation can measure the analogous deviation in reconstruction balls and infer an effective scalar curvature.

---

# 8. Matter as recurrent topological defects

A physical particle is not identified with one node. It is a stable equivalence class of patterns across many possible microscopic realisations.

This is not hypothetical as mathematics. The toric code realises particles as logical defects of a quantum code with exactly conserved topological charges [31], and string-net condensation produces emergent gauge bosons and emergent fermions from purely bosonic qudits [32, 33]. What those systems lack, and RCC demands, is dynamical reconstruction geometry and gravitational backreaction [S].

## 8.1 Logical defect

Let the vacuum code be defined by local constraints

$$
S_a|\Omega\rangle=|\Omega\rangle.
$$

A defect state violates or twists a finite set of constraints:

$$
S_a|\Psi_Q\rangle
=
e^{i\theta_a(Q)}|\Psi_Q\rangle.
$$

The label $Q$ is a conserved logical charge if local admissible updates cannot change it.

## 8.2 Topological charge

Suppose an order parameter takes values in a manifold $\mathcal M$. Around a closed loop $\gamma$ enclosing a defect,

$$
Q[\gamma]
\in
\pi_n(\mathcal M)
$$

classifies the defect.

### Proposition 4: Topological stability [E]

If local updates are continuous in the order parameter, the protecting gap remains open, and the loop $\gamma$ does not cross another defect or a boundary, then $Q[\gamma]$ is invariant.

### Proof sketch

A continuous local update deforms the map $\gamma\to\mathcal M$ by a homotopy. Homotopic maps define the same element of $\pi_n(\mathcal M)$. Changing $Q$ requires a singular configuration, gap closure, boundary crossing, or collision with an oppositely charged defect.

$\square$

This gives a concrete route to exact charge conservation without requiring a fundamental point particle.

## 8.3 Particle identity

Two excitations are the same particle species if they belong to the same stable defect class and transform identically under the local code-frame automorphism group.

Particle identity is therefore exact even though the microscopic qudits supporting the excitation continually change.

That resembles a wave in water only superficially. A water wave is not protected against arbitrary microscopic disturbance. A logical defect can be protected by redundancy and topology.

Phase 1 realises this exactly in the fixed-graph model: a domain wall in the recurrence angle binds a logical mode pinned to quasienergy zero, immune to symmetry-preserving disorder at the $10^{-16}$ level (Appendix H.5) [E in-model].

## 8.4 Antiparticles and annihilation

If the charge group admits inverses, an antiparticle carries

$$
Q_{\bar p}=-Q_p.
$$

A particle-antiparticle pair may annihilate because

$$
Q_p+Q_{\bar p}=0,
$$

allowing the combined defect to unwind into vacuum excitations while conserving energy and all other logical charges.

---

# 9. Mass as recurrence latency

The mathematics of this section is established quantum-walk theory [E]: the mass term of the Dirac quantum cellular automaton is a coin-rotation angle [9, 10, 35], and the rest period derived in §9.3 is de Broglie's internal clock of 1924. What RCC adds is an interpretation with consequences: the coin rotation is identified with the settling cycle of a recurrent error-correcting update (§5.2), so that mass, proper time, and decoding latency become the same resource [W]. That identification — not the dispersion relation — is the distinctive claim, and the interacting extension of §9.5 is what must vindicate or kill it.

The central idea is that a massive excitation must rotate through an internal logical state while propagating. A massless excitation does not require that internal mixing.

## 9.1 Minimal one-dimensional model

Consider a two-component state on a one-dimensional lattice. Let

$$
\Psi_n(t)
=
\begin{pmatrix}
\psi_R(n,t)\\
\psi_L(n,t)
\end{pmatrix}.
$$

One microscopic step applies:

1. an internal recurrent rotation,
2. a conditional shift.

The coin rotation is

$$
C(\theta)
=
e^{-i\theta\sigma_x}.
$$

The shift in momentum space is

$$
S(k)
=
e^{-ika\sigma_z}.
$$

The one-step unitary is

$$
U(k)
=
S(k)C(\theta).
$$

Let its eigenvalues be

$$
e^{\mp i\omega(k)\tau}.
$$

Since $U(k)\in SU(2)$,

$$
\cos(\omega\tau)
=
\frac12\mathrm{Tr}\,U(k)
=
\cos(ka)\cos\theta.
$$

This relation is exact.

## 9.2 Continuum dispersion

For $|ka|\ll1$ and $|\theta|\ll1$,

$$
\cos(\omega\tau)
\approx
1-\frac12(\omega\tau)^2,
$$

and

$$
\cos(ka)\cos\theta
\approx
1-\frac12(ka)^2-\frac12\theta^2.
$$

Therefore

$$
\omega^2
\approx
\frac{a^2}{\tau^2}k^2
+
\frac{\theta^2}{\tau^2}.
$$

Using

$$
E=\hbar\omega,
\qquad
p=\hbar k,
\qquad
c=\frac{a}{\tau},
$$

we obtain

$$
E^2
\approx
p^2c^2
+
\left(
\frac{\hbar\theta}{\tau}
\right)^2.
$$

Identifying

$$
mc^2
=
\frac{\hbar|\theta|}{\tau},
$$

gives

$$
E^2
=
p^2c^2+m^2c^4
$$

to leading order.

### Theorem 5: Mass-latency Dirac limit [E]

The unitary walk

$$
U(k)=e^{-ika\sigma_z}e^{-i\theta\sigma_x}
$$

has exact dispersion

$$
\cos(\omega\tau)=\cos(ka)\cos\theta.
$$

In the long-wavelength, small-$\theta$ limit, its evolution converges to a $1+1$-dimensional Dirac equation with effective mass

$$
m
=
\frac{\hbar|\theta|}{c^2\tau}.
$$

This is a theorem of the toy model, not yet a theorem of nature.

## 9.3 Recurrence period

The rest-energy frequency is

$$
\omega_0
=
\frac{mc^2}{\hbar}
=
\frac{|\theta|}{\tau}.
$$

The corresponding internal period is

$$
T_{\mathrm{rec}}
=
\frac{2\pi}{\omega_0}
=
\frac{h}{mc^2}.
$$

Thus

$$
mc^2
=
\frac{h}{T_{\mathrm{rec}}}.
$$

In RCC language:

> Mass is the energy cost of a logical excitation repeatedly cycling through its hidden internal code states.

The identity $T_{\mathrm{rec}}=h/mc^2$ is de Broglie's internal-clock hypothesis of 1924. One electron-channeling experiment reported a resonance near this frequency [51]; the result is disputed and unreplicated, and is cited here as a curiosity rather than evidence [S/W].

## 9.4 Group velocity

Differentiating the exact dispersion gives

$$
v_g
=
\frac{d\omega}{dk}
=
\frac{a}{\tau}
\frac{\sin(ka)\cos\theta}
{\sin(\omega\tau)}.
$$

The exact identity

$$
\sin^2(\omega\tau)
=
\sin^2(ka)\cos^2\theta+\sin^2\theta,
$$

which follows directly from the dispersion relation, makes the velocity bound a one-line proof:

$$
|v_g|\le c,
$$

with equality if and only if $\theta=0$ [E]. Massive excitations propagate more slowly because part of each update is spent in internal recurrence rather than net translation.

## 9.5 What still has to be proved

A realistic theory must show:

- how this mechanism works in $3+1$ dimensions,
- how spin-$\tfrac12$ and Lorentz representations emerge,
- how interactions renormalise the recurrence frequency,
- why observed masses take their measured values,
- why chiral fermions avoid doubling,
- and how unstable particles acquire widths.

The toy calculation proves that the slogan is mathematically possible. It does not derive the electron mass.

Two of these items now have partial in-model answers (v0.4): interactions renormalise not only the recurrence frequency but the limiting velocity of composites (Appendix H.6), and the mechanism extends to two dimensions with computable anisotropy in both sectors (Appendix H.2).

---

# 10. Gauge symmetry as code-frame redundancy

## 10.1 Local logical frames

Suppose each region $v$ represents the same logical state in a local basis. A frame choice is

$$
g_v\in G,
$$

where $G$ is an automorphism group of the code.

The local state transforms as

$$
\psi_v\rightarrow g_v\psi_v.
$$

To compare states at neighbouring regions, introduce a link variable

$$
\Gamma_{uv}\in G.
$$

## 10.2 Covariant transport

Define

$$
D_{uv}\psi
=
\psi_u-\Gamma_{uv}\psi_v.
$$

For this to transform locally at $u$, require

$$
\Gamma_{uv}
\rightarrow
g_u\Gamma_{uv}g_v^{-1}.
$$

Then

$$
D_{uv}\psi
\rightarrow
g_uD_{uv}\psi.
$$

### Theorem 6: Code-frame gauge covariance [E]

Any local energy or transition probability constructed from gauge-invariant combinations such as

$$
\|D_{uv}\psi\|^2
$$

is independent of the arbitrary local code-frame choice.

### Proof

Under the local transformation,

$$
D_{uv}\psi\rightarrow g_uD_{uv}\psi.
$$

If the representation is unitary,

$$
\|g_uD_{uv}\psi\|^2
=
\|D_{uv}\psi\|^2.
$$

$\square$

## 10.3 Curvature as holonomy

For a loop

$$
p=(v_0v_1\cdots v_nv_0),
$$

define the holonomy

$$
W_p
=
\Gamma_{v_0v_1}
\Gamma_{v_1v_2}
\cdots
\Gamma_{v_nv_0}.
$$

Under a frame change,

$$
W_p\rightarrow g_{v_0}W_pg_{v_0}^{-1}.
$$

Therefore

$$
\mathrm{Tr}(W_p)
$$

is gauge invariant.

In the continuum limit,

$$
W_p
\approx
\exp\left(
iF_{\mu\nu}\Delta\Sigma^{\mu\nu}
\right),
$$

so gauge curvature measures the failure of local code frames to return unchanged around a loop.

## 10.4 Physical interpretation

Gauge redundancy is usually introduced as a freedom in field description. RCC gives it an operational meaning:

> A gauge transformation changes the local microscopic representation of a logical state without changing what can be decoded.

Gauge bosons are propagating disturbances of the frame-matching structure.

---

# 11. The Standard Model problem

This is the hardest section and the place where speculative theories most often cheat.

RCC has not derived

$$
SU(3)\times SU(2)\times U(1)
$$

or the observed chiral matter content.

It proposes a research target:

> The Standard Model should arise as the automorphism and defect algebra of the smallest stable, anomaly-free, chiral quantum code phase capable of supporting persistent matter in an emergent $3+1$-dimensional geometry.

## 11.1 Candidate mathematical statement

Let $\mathcal C$ be a local code category with:

- finite local Hilbert dimension,
- a gapped vacuum sector,
- topological defect classes,
- local frame automorphism group $G$,
- chiral long-wavelength excitations,
- anomaly-free gauging,
- and a stable three-dimensional reconstruction geometry.

The classification problem is to find all such $\mathcal C$.

The ambitious conjecture is that the minimal phenomenologically viable solution has

$$
G_{\mathrm{IR}}
=
SU(3)\times SU(2)\times U(1)
$$

with three stable recurrence classes corresponding to generations.

## 11.2 Nielsen-Ninomiya obstruction

A simple local, translationally invariant lattice Hamiltonian with standard assumptions cannot produce an unpaired chiral fermion spectrum. This is the Nielsen-Ninomiya obstruction [17].

RCC must evade at least one assumption. Possible routes include:

- no fixed translationally invariant lattice,
- dynamical graph connectivity,
- interacting rather than free microscopic fermions,
- fundamental bosonic qudits with emergent fermionic defects,
- non-ultralocal reconstruction maps,
- topological boundary or anomaly-inflow mechanisms,
- symmetric mass generation, which gaps the mirror sector by interactions rather than by a quadratic term and is the currently active front of lattice chiral gauge theory [50],
- or quantum cellular automata outside the Hamiltonian assumptions of the theorem.

This is not optional. Any claimed RCC Standard Model construction that ignores fermion doubling is incomplete.

## 11.3 Anomaly cancellation

Gauge anomalies must cancel exactly. In RCC, that should follow from consistency of the global code rather than from an arbitrary selection of fields.

One possible condition is that the product of local defect transport maps around any closed four-dimensional code cycle has trivial obstruction class.

Schematically,

$$
\mathcal A_{\mathrm{gauge}}
=
\sum_f
\mathrm{Tr}
\left[
T_f^a\{T_f^b,T_f^c\}
\right]
=
0.
$$

The goal is to derive this as a code-consistency theorem.

## 11.4 Fermion generations

A speculative mechanism is that three generations correspond to three stable recurrence windings:

$$
\nu_{\mathrm{rec}}\in\{1,2,3\},
$$

with masses determined by different internal cycle lengths, tunnelling amplitudes, or overlap with the Higgs-like code-order parameter.

That is attractive but presently unconstrained. A real model must output approximate mass ratios and mixing matrices rather than merely naming the number three.

---

# 12. Gravity as code strain

## 12.1 Capacity field

Let $\chi(x)$ denote the coarse-grained logical transmission capacity per unit reconstruction area.

In a homogeneous vacuum,

$$
\chi(x)=\chi_0.
$$

A local excitation consumes routing, syndrome, and recovery resources, producing

$$
\delta\chi(x)<0
$$

near positive energy density.

Define the dimensionless strain field

$$
\varphi(x)
=
-\frac{\delta\chi(x)}{\chi_0}.
$$

In the weak-field limit, identify

$$
\varphi
\approx
\frac{\Phi}{c^2},
$$

where $\Phi$ is the Newtonian potential.

## 12.2 Proper time as local processing depth

Let $N$ be a coarse-grained update count. The locally accumulated proper time is

$$
d\tau
=
\alpha(x)\,dN,
$$

where $\alpha(x)$ is the amount of stable logical evolution completed per global bookkeeping step.

In a strained region, more recurrence and correction are required, so

$$
\alpha(x)<\alpha_0.
$$

For weak strain,

$$
\frac{d\tau}{dt}
\approx
1+\frac{\Phi}{c^2}.
$$

This reproduces gravitational time dilation if the capacity strain field obeys the correct field equation.

## 12.3 Spatial curvature

Routing paths also change. If the effective transfer cost is anisotropic,

$$
d\ell^2
=
h_{ij}(x)\,dx^idx^j,
$$

where $h_{ij}$ is derived from the local reconstruction metric.

The spacetime metric is then a combined description of:

- local clock-rate deformation,
- causal-cone deformation,
- and reconstruction-path deformation.

## 12.4 Universal coupling

Why should every particle fall the same way?

Because every particle is a logical excitation transported by the same network. Gravity does not couple to a species-specific charge. It changes the substrate on which every code defect propagates.

This offers a structural explanation for universality, but the precision of MICROSCOPE means that any species-dependent correction must be suppressed below roughly the $10^{-15}$ level for the tested compositions [19].

A generic emergent model would fail this immediately. RCC requires an exact or extremely accurate common fixed point.

---

# 13. The Newtonian limit

A useful theory should recover Poisson's equation without simply declaring it.

## 13.1 Code-strain free energy

Let

$$
\varphi=\frac{\Phi}{c^2}
$$

be a dimensionless strain potential. Assume the leading static, isotropic, long-wavelength free-energy functional is

$$
\mathcal F[\varphi]
=
\int d^3x
\left[
\frac{c^4}{8\pi G}
|\nabla\varphi|^2
+
\rho c^2\varphi
\right].
$$

The first term penalises gradients of reconstruction capacity. The second expresses universal loading by mass-energy density $\rho c^2$.

### Proposition 7: Newtonian field equation [E, given the functional]

Stationarity of $\mathcal F$ gives

$$
\nabla^2\Phi=4\pi G\rho.
$$

### Proof

Varying $\varphi$,

$$
\delta\mathcal F
=
\int d^3x
\left[
\frac{c^4}{4\pi G}
\nabla\varphi\cdot\nabla\delta\varphi
+
\rho c^2\delta\varphi
\right].
$$

Integrating by parts and discarding the boundary term,

$$
\delta\mathcal F
=
\int d^3x
\left[
-\frac{c^4}{4\pi G}\nabla^2\varphi
+
\rho c^2
\right]\delta\varphi.
$$

Stationarity for arbitrary $\delta\varphi$ gives

$$
\nabla^2\varphi
=
\frac{4\pi G}{c^2}\rho.
$$

Since $\Phi=c^2\varphi$,

$$
\nabla^2\Phi=4\pi G\rho.
$$

$\square$

### A structural check the functional passes

The on-shell value of the functional is worth recording. Integrating the gradient term by parts on a solution gives

$$
\int d^3x\,
\frac{c^4}{8\pi G}|\nabla\varphi|^2
=
-\frac12\int d^3x\,\rho c^2\varphi,
$$

so

$$
\mathcal F_{\mathrm{on\text{-}shell}}
=
\frac12\int d^3x\,\rho\,\Phi
<0,
$$

which is exactly the Newtonian interaction energy — obtained from a *positive-definite* stiffness term, since $\delta^2\mathcal F=\int (c^4/4\pi G)|\nabla\delta\varphi|^2>0$ makes the solution a genuine minimum. The usual field-theoretic action requires a wrong-sign kinetic term for $\Phi$; a static free-energy formulation with positive stiffness that still yields the correct sign of gravitational binding energy is a small but real structural point in favour of the strain picture [E].

## 13.2 Motion of a slow defect

Let the weak-field metric be

$$
ds^2
=
-\left(1+\frac{2\Phi}{c^2}\right)c^2dt^2
+
\left(1-\frac{2\Psi}{c^2}\right)d\mathbf x^2.
$$

For slow motion,

$$
\frac{d^2\mathbf x}{dt^2}
=
-\nabla\Phi.
$$

Thus a universal code-strain potential reproduces Newtonian free fall.

## 13.3 What this derivation does and does not prove

It proves that if the coarse-grained strain energy has the stated universal gradient form, Newtonian gravity follows [E, given the functional].

It does not derive:

- the coefficient $c^4/(8\pi G)$ [P],
- why the source is precisely total stress-energy [P],
- post-Newtonian corrections, gravitational waves, or nonlinear diffeomorphism invariance [P].

Those belong to the deeper emergence problem. One former list item is promoted to its own section, because it is not one problem among six.

## 13.4 The first nontrivial test is $\gamma$

A pure scalar strain field coupled universally to rest energy reproduces Newtonian free fall and predicts **no light deflection**. This is what killed Nordström's scalar gravity in 1919. RCC's escape route is the spatial reconstruction metric $h_{ij}$ of §12.3, but then everything hinges on deriving $\Psi=\Phi$, that is, PPN $\gamma=1$, which the Cassini conjunction experiment constrains to

$$
|\gamma-1|<2.3\times10^{-5}
$$

[42]. A capacity-strain model that deforms clock rates ($g_{00}$) without an equally derived deformation of reconstruction distances ($g_{ij}$) is excluded at that level [E].

A candidate mechanism worth developing: if the same channel-capacity reduction that slows settling (time dilation) also lengthens reconstruction paths (spatial strain) with equal coefficient — plausible if both are controlled by a single capacity field — then $\gamma=1$ follows structurally rather than by tuning [P].

Deriving or refuting this equality in the Goal-4 simulations (§22.4) is re-ranked in v0.2 as the top gravitational priority, ahead of the area coefficient. It is where scalar-flavoured emergent-gravity models historically die, and it is cheaper to test numerically than $1/4G\hbar$.

**Status after v0.5: the test was run, and the candidate mechanism fails in the realization tested.** In the free-fermion, MI-proxy realization of Appendix I.8, a capacity load of strength $\varepsilon$ reduces the local clock proxy at $O(\varepsilon)$ but changes emergent reconstruction distances by only $10^{-4}$-$10^{-2}$ fractionally — and in the *shortening* direction. The measured ratio is $\gamma_{\mathrm{proxy}}\in[-0.08,0]$ across all 72 parameter combinations, with no drift toward 1 with system size. "Both controlled by a single capacity field" is therefore not something a static correlational metric does for free: either the operational (Petz) reconstruction cost departs from the MI proxy exactly here, or the mechanism needs genuine dynamical backreaction (the load must deform the state the geometry is read from, self-consistently), or the mechanism is wrong. This is now the framework's most urgent exhibited failure, of the same epistemic grade as the Phase-1 cone-universality failure (H.6).

**Status after v0.6 (Appendix J.2-J.3): the first two exits are closed, both negative.** The operational proxies (canonical-correlation transport, exact Petz recovery) are as blind as mutual information under a static load — the proxy was not the culprit. And the first dynamical-backreaction realization (capacity follows bond flux) exhibits an instability rather than $\gamma=1$: no stable fixed point exists between "metric barely responds" and "the whole lattice collapses to minimum capacity." What survives is precise: a *stabilized* backreaction — the quadratic strain cost of §24.4, which the flux map omitted — is now the only remaining structural route to $\gamma=1$ in this model class. If the variational probe (J.3) also fails, criterion 15 fires for the free-fermion realization.

**Status after v0.7 (Appendix J.3b): the third exit is closed, and criterion 15 has fired for this realization.** The variational probe — true equilibria of matter plus quadratic capacity strain at every stiffness $\kappa$ — gives either negligible spatial response (stiff), or order-unity response of the wrong sign just above capacity collapse (soft), never $\gamma\approx+1$. Free-fermion matter with scalar link-capacity strain and correlational geometry is excluded as a mechanism for gravity. Any successor realization must exhibit at least one of: interacting matter whose loaded vacuum *lengthens* reconstruction distances; strain acting on the code layer (stabiliser weights, decoder depth) rather than on hopping amplitudes; or a genuinely operational code-subspace geometry that responds where correlational metrics do not. Those are Phase 4-5 objects. Until one is exhibited, the gravitational sector of RCC has no working mechanism — stated plainly because the kill-criterion framework exists for exactly this.

**Status after v0.8 (Appendix J.3c): successor 1 — interacting matter — is closed at the mean-field level.** Hartree-Fock interactions amplify the metric response tenfold through the same wrong-sign channel. Three independent realizations now fail identically: a capacity load shortens correlational distances, because weakening a region's couplings weakens its correlations globally, which $-\log q$ metrics read as contraction. The surviving routes — code-layer strain and operational code-subspace geometry — both require an actual code (Phase 4). The gravitational sector is now formally blocked on Phase 4.

**Status after v0.9 (Appendix K): the code-layer realization works where every matter realization failed.** With clock and metric both read from the syndrome dynamics of an actual code, a capacity load slows clocks AND lengthens operational distances — the gravitational sign, structurally, because degrading repair capacity makes a region genuinely harder to transport logical information through. $\gamma$ is $O(1)$ without tuning and crosses $1$ where the decoder runs at marginal capacity — the critical coding point where Postulate 6 independently places the vacuum. The candidate mechanism of this section is, for the first time, *exhibited rather than hoped for*, in one realization, at coincidence-of-scale precision. Still owed: definition-independence of the crossing, and a far field (Appendix K.4).

---

# 14. Conditional recovery of Einstein gravity

## 14.1 Local entropy balance

Consider a small causal diamond or geodesic ball $B$. Define a generalised entropy

$$
S_{\mathrm{gen}}(B)
=
S_{\mathrm{code}}(\partial B)
+
S_{\mathrm{matter}}(B).
$$

Assume the code contribution is proportional to boundary area:

$$
S_{\mathrm{code}}
=
\frac{A}{4G\hbar}.
$$

Assume the matter entanglement first law:

$$
\delta S_{\mathrm{matter}}
=
\delta\langle K_B\rangle,
$$

where $K_B$ is the modular Hamiltonian in suitable units.

For conformal matter in a small ball, $\delta\langle K_B\rangle$ is related locally to $\delta\langle T_{\mu\nu}\rangle$.

## 14.2 Entanglement equilibrium condition

Impose

$$
\delta S_{\mathrm{gen}}
\big|_{V}
=
0
$$

for all sufficiently small balls at fixed volume.

### Conditional Theorem 8: Linearised Einstein limit [S]

Assume:

1. a smooth Lorentzian continuum limit,
2. boundary code entropy $A/(4G\hbar)$,
3. the matter entanglement first law,
4. local vacuum entanglement stationarity at fixed volume,
5. and the required modular-energy relation.

Then the linearised semiclassical Einstein equation follows:

$$
\delta G_{\mu\nu}
+
\Lambda\,\delta g_{\mu\nu}
=
8\pi G\,
\delta\langle T_{\mu\nu}\rangle.
$$

### Status

This is a conditional recovery result in the spirit of Jacobson's entanglement-equilibrium argument [12]. It is not a new independent proof.

Known caveats include the treatment of nonconformal fields and the step from linearised to fully nonlinear dynamics [15].

## 14.3 RCC interpretation of the area term

The central RCC claim is that

$$
\frac{A}{4G\hbar}
$$

counts the effective number of independent logical channels crossing the boundary.

In a network with edge capacities $q_e$,

$$
S_{\mathrm{cut}}
\lesssim
\sum_{e\in\partial B}\log q_e.
$$

The gravitational constant then measures the density of recoverable quantum information per unit emergent area:

$$
\frac{1}{4G\hbar}
\sim
\frac{\text{logical channel entropy}}
{\text{emergent area}}.
$$

## 14.4 Cosmological constant

The equilibrium condition permits an integration constant $\Lambda$. RCC interprets it not as a naive sum of all microscopic zero-point energies, but as a macroscopic code-pressure parameter.

That could help explain why an absolute local energy offset need not gravitate in the same way as changes in logical stress.

This is a possible mechanism, not a solved cosmological-constant problem.

---

# 15. Black holes and the area law

## 15.1 Entropy across a cut

Divide the network into regions $A$ and $\bar A$. Let $E_{\partial A}$ be the set of independent links crossing the cut, with dimensions $q_e$.

### Theorem 9: Boundary entropy bound [E]

For any pure tensor-network state whose only connections between $A$ and $\bar A$ cross $E_{\partial A}$,

$$
S(A)
\le
\sum_{e\in E_{\partial A}}\log q_e.
$$

If all crossing links have dimension $q$,

$$
S(A)
\le
N_{\partial A}\log q.
$$

### Proof

The Schmidt rank across the cut cannot exceed

$$
\prod_{e\in E_{\partial A}}q_e.
$$

The von Neumann entropy is bounded by the logarithm of the Schmidt rank:

$$
S(A)
\le
\log
\left(
\prod_eq_e
\right)
=
\sum_e\log q_e.
$$

$\square$

If the number of crossing channels scales with emergent area, entropy obeys an area law.

Status after v0.5: measured on free-fermion vacua (Appendix I.5). Gapped sectors obey a clean area law, $S/|\partial A|=0.184$ nats per boundary link, stable across system sizes. Critical (gapless) sectors violate it logarithmically, exactly as the Gioev-Klich-Widom analysis requires [62, 63]. The area-law language of this section therefore presumes a gapped vacuum sector; whether the physical vacuum is such a sector is part of Postulate 6 [P].

## 15.2 Horizon as decoding transition

Define the minimum reconstruction depth for an interior logical operator $O_X$ from an exterior region $R$:

$$
D_R(O_X)
=
\min
\{\text{circuit depth of a decoder reconstructing }O_X\}.
$$

A horizon forms when, for ordinary exterior regions,

$$
D_R(O_X)
$$

grows beyond any physically available low-depth process.

The interior is not absent. It is encoded in correlations inaccessible to shallow local reconstruction.

This framing is not private to RCC. Harlow and Hayden showed that decoding information from Hawking radiation is generically computationally hard [37], and the complexity-geometry programme develops the continuum version of depth-as-geometry [38]. RCC adopts that lesson and conjectures it is constitutive rather than emergent [W].

## 15.3 Singularity

A singularity is interpreted as failure of the smooth reconstruction geometry. Quantities such as curvature diverge because the continuum decoder is being extrapolated beyond its domain.

The microscopic network need not contain an infinite-density point.

## 15.4 Evaporation

A unitary microscopic network can preserve information while the semiclassical exterior appears thermal.

Hawking radiation is then a gradual redistribution of logical information from high-depth interior encodings into exterior reconstructable degrees of freedom.

A real RCC model must calculate:

- the Hawking temperature,
- greybody factors,
- Page-curve behaviour,
- scrambling time,
- and the endpoint of evaporation.

The area bound alone does not solve the information problem.

---

# 16. Quantum measurement and the Born rule

## 16.1 Stable records

A microscopic interaction becomes a measurement when an outcome label $i$ is copied into many approximately independent fragments:

$$
|i\rangle_S|0\rangle_{E_1}\cdots|0\rangle_{E_N}
\rightarrow
|i\rangle_S|i\rangle_{E_1}\cdots|i\rangle_{E_N}.
$$

The record is objective in the operational sense that many observers can reconstruct $i$ from different environmental fragments.

RCC describes this as growth of a logical record code.

This is quantum Darwinism [40]: redundant proliferation of records into environmental fragments is what makes an outcome operationally objective. RCC adopts the mechanism and adds the code language [E for the mechanism, W for the addition].

## 16.2 Global code completion

An admissible history $H$ assigns quantum events and macroscopic records across the full causal network.

Let

$$
\mathcal W(H)
$$

be its consistency weight. Observable probability is obtained by summing over histories containing outcome $i$:

$$
P(i)
=
\frac{
\sum_{H\ni i}\mathcal W(H)
}{
\sum_H\mathcal W(H)
}.
$$

This is only a framework. The central problem is to show why

$$
P(i)=|\psi_i|^2.
$$

## 16.3 Gleason-type uniqueness

### Conditional Theorem 10: Born-form probability [E as mathematics]

Let $\mu(P)$ assign probabilities to projection operators on a Hilbert space of dimension at least three, independently of the measurement context in which a projector appears. Assume:

1. $\mu(P)\ge0$,
2. $\mu(I)=1$,
3. for mutually orthogonal projectors $P_i$,

$$
\mu\left(\sum_iP_i\right)=\sum_i\mu(P_i).
$$

Noncontextuality is not a fourth assumption. Defining $\mu$ on projectors, with additivity over orthogonal decompositions regardless of context, *is* the noncontextuality assumption. Version 0.1 listed it separately, which suggested an extra hypothesis that is not there.

Then there exists a density operator $\rho$ such that

$$
\mu(P)=\mathrm{Tr}(\rho P).
$$

For a pure state $\rho=|\psi\rangle\langle\psi|$,

$$
\mu(P_i)
=
\langle\psi|P_i|\psi\rangle.
$$

This is the content of Gleason's theorem and its extensions [18].

Gleason's theorem fails in dimension two, but the POVM generalisation restores the Born form in all dimensions from a weaker and arguably more operational additivity assumption [41]. Since realistic records are POVM-valued, the POVM version is the one RCC actually owes [E as mathematics].

## 16.4 What remains unresolved

Gleason's theorem does not derive:

- why one outcome is experienced,
- why the relevant measure is noncontextual,
- why global history weights satisfy the theorem's assumptions,
- or whether collapse is physical, effective, or absent.

RCC's intended contribution is to derive noncontextual additivity from the consistency of redundant logical records [P].

That intended derivation must locate itself relative to the existing attempts: Zurek's envariance argument, the Deutsch-Wallace decision-theoretic derivation, and the operational derivation of the measurement postulates by Masanes, Galley, and Müller [40, 43]. A record-consistency derivation that silently reproduces one of these has rediscovered it, not extended it.

Until that derivation exists, the measurement sector is incomplete.

## 16.5 Relation to superdeterminism

RCC does not need measurement settings to be locally pre-correlated with hidden variables at the source.

Cosmic Bell tests have pushed ordinary local common-cause explanations of setting correlations billions of years into the past, while leaving fully superdeterministic theories logically possible [2].

RCC instead uses global consistency of quantum histories plus operational no-signalling. It is closer to an all-at-once constraint theory than to a local deterministic conspiracy.

A valid formulation must preserve the empirically observed freedom to vary measurement settings while reproducing Bell violations.

---

# 17. Dark matter

## 17.1 Hidden logical sectors

Let the visible gauge algebra be

$$
\mathcal A_{\mathrm{vis}}.
$$

A dark defect carries topological charge $Q_D$ but transforms trivially under visible gauge reconstruction:

$$
[T,Q_D]=0
\qquad
\forall T\in\mathcal A_{\mathrm{vis}}.
$$

It still alters network capacity, so it contributes to gravity.

## 17.2 Effective stress-energy

At long wavelengths, a cold gas of stable dark defects has

$$
T_D^{\mu\nu}
\approx
\rho_Du^\mu u^\nu,
$$

with small pressure.

The gravitational field equation becomes

$$
G_{\mu\nu}+\Lambda g_{\mu\nu}
=
8\pi G
\left(
T_{\mu\nu}^{\mathrm{vis}}
+
T_{\mu\nu}^{D}
+
T_{\mu\nu}^{\mathrm{code}}
\right).
$$

To leading order, this can reproduce ordinary cold-dark-matter phenomenology.

## 17.3 Why it is dark

Visible detectors interact through the Standard Model code-frame interfaces. A dark defect has no compatible interface, so ordinary local operators have exponentially small matrix elements:

$$
\left|
\langle D'|O_{\mathrm{vis}}|D\rangle
\right|
\lesssim
e^{-L/\xi}.
$$

Gravitational coupling remains because both sectors deform the same substrate.

## 17.4 Possible distinctive signatures

A microscopic RCC dark sector could predict:

- quantised defect masses,
- a minimum defect size,
- finite-density cores,
- weak but nonzero topological self-interactions,
- lensing granularity,
- suppressed annihilation,
- no conventional nuclear recoil,
- rare conversion near code-phase boundaries,
- or dark acoustic modes in the early universe.

At present these are options, not firm predictions.

## 17.5 Required cosmological fit

The dark sector must reproduce:

- CMB acoustic peaks,
- matter power spectrum,
- galaxy and cluster lensing,
- cluster collisions,
- halo abundance,
- Lyman-$\alpha$ constraints,
- and structure formation over cosmic time.

A dark-sector story that only fits galaxy rotation curves is not enough.

One constraint already binds. If defect masses are quantised at macroscopic values, existing microlensing surveys — EROS-2, OGLE, and Subaru HSC — jointly exclude compact objects as the dominant dark-matter component over roughly $10^{-11}$ to $10\,M_\odot$ [44, 45]. Any RCC defect spectrum with $M_D$ in that window is already dead as the main component [E]. A viable spectrum must sit far below it, behaving as a fluid on lensing scales, or in the sparse surviving windows.

---

# 18. Dark energy and cosmology

## 18.1 Redundancy pressure

Let

$$
\mathcal R(a)
$$

be the average physical redundancy per logical cosmological degree of freedom at scale factor $a$.

Maintaining recoverability in an expanding, increasingly structured universe may require a background energy density

$$
\rho_R(a).
$$

Its effective equation of state is fixed by energy conservation:

$$
\frac{d\rho_R}{d\ln a}
=
-3(1+w_R)\rho_R.
$$

Therefore

$$
w_R(a)
=
-1
-
\frac13
\frac{d\ln\rho_R}{d\ln a}.
$$

## 18.2 A falsifiable one-parameter ansatz

Let $f_{\mathrm{nl}}(a)$ be the fraction of matter in nonlinear collapsed structures above a specified physical threshold.

Postulate

$$
\rho_R(a)
=
\rho_{\Lambda0}
\exp
\left[
\beta
\left(
f_{\mathrm{nl}}(a)-f_{\mathrm{nl}}(1)
\right)
\right].
$$

Then

$$
w_R(a)
=
-1
-
\frac{\beta}{3}
\frac{df_{\mathrm{nl}}}{d\ln a}.
$$

This links dark-energy evolution to structure formation.

It cannot choose an arbitrary $w(z)$. Once $\beta$, the collapse threshold, and the initial spectrum are specified, the background expansion and growth history are jointly constrained.

### 18.2.1 The ansatz cannot cross the phantom divide

Since structure grows, $df_{\mathrm{nl}}/d\ln a\ge0$ over cosmic history, so the sign of $1+w_R$ is fixed for all time by the sign of $\beta$: $\beta>0$ gives permanently phantom behaviour, $\beta<0$ permanently quintessence-like behaviour [E, given the ansatz]. The ansatz cannot cross $w=-1$.

Current DESI DR2 combined fits prefer exactly such a crossing near $z\approx0.5$, a feature shared by a wide range of reconstructions of the preferred equation of state, though its statistical robustness remains debated [23] [S]. This makes the ansatz more falsifiable than generic $w(z)$ parameterisations — and already under pressure. Version 0.2 adopts the braver reading: **no phantom crossing, ever** is a designated near-term kill criterion (§26). If the crossing survives DR3-class data, this simplest redundancy-pressure model is excluded, and the sector must either add an explicit interaction term $Q$ in the continuity equation — turning $w_R$ into an effective, crossable parameter, as in interacting dark-energy models — or die.

Two further honesty notes. First, $f_{\mathrm{nl}}(a)$ is a global functional; a local field realisation of redundancy pressure must specify a response kernel, and retarded or massive-kernel versions generically predict scale-dependent $w$ — an additional signature and an additional way to fail [P]. Second, if redundancy pressure responds to structure, energy is exchanged with the matter sector, so the honest continuity equation carries an interaction term, and the "fixed by energy conservation" step of §18.1 then defines only an effective equation of state [E].

## 18.3 Observational status

DESI DR2 combinations have increased interest in time-evolving dark energy, but the significance and inferred behaviour depend on the combination of BAO, CMB, and supernova data and on systematic assumptions [23].

RCC should not be retrofitted to one preferred dataset. The ansatz must be tested against:

- BAO,
- Type Ia supernovae,
- CMB,
- redshift-space distortions,
- weak lensing,
- cluster counts,
- standard sirens,
- and cosmic chronometers.

## 18.4 Vacuum-energy problem

RCC distinguishes between:

1. microscopic energy offsets inside the code Hamiltonian,
2. changes in logical capacity and code strain,
3. macroscopic redundancy pressure.

Only the latter two necessarily gravitate.

This offers a possible sequestering mechanism:

$$
H\rightarrow H+C I
$$

changes an unobservable global phase but need not change any code-strain observable.

The real cosmological-constant problem remains: interactions and phase changes can alter relative energies, and a complete theory must calculate why the residual curvature is so small.

## 18.5 Early universe

A speculative RCC cosmology replaces the initial singularity with a code-phase transition.

Possible stages are:

1. a nongeometric highly connected quantum phase,
2. spontaneous formation of a low-dimensional local code,
3. rapid growth of effective reconstruction volume,
4. defect freeze-out,
5. emergence of semiclassical spacetime,
6. later redundancy-pressure acceleration.

Inflation might emerge as a period in which the number of reconstructable logical cells grows nearly exponentially:

$$
N_{\mathrm{geom}}(t)
\propto
e^{3H_{\mathrm{eff}}t}.
$$

This is not yet an inflation model. It must produce the observed nearly scale-invariant, adiabatic, Gaussian perturbations and their measured deviations.

---

# 19. Neutrinos, baryon number, and possible strong predictions

These are optional strong branches of the framework. They are useful because they make the theory easier to falsify.

## 19.1 Neutrinos as interface defects

Neutrinos may be logical defects near the interface between the visible code sector and a dark sector.

That could qualitatively explain:

- electrical neutrality,
- small masses,
- long coherence lengths,
- and large flavour mixing.

A recurrence mass matrix would have the form

$$
(M_\nu)_{\alpha\beta}c^2
=
\frac{\hbar}{\tau}
\Theta_{\alpha\beta},
$$

where $\Theta$ is the internal recurrence generator in flavour space.

Diagonalising,

$$
U_\nu^\dagger M_\nu U_\nu
=
\mathrm{diag}(m_1,m_2,m_3).
$$

Oscillation phases follow normally:

$$
\Delta\phi_{ij}
\approx
\frac{\Delta m_{ij}^2c^3L}{2\hbar E}.
$$

## 19.2 Dirac-neutrino conjecture

A strong RCC completion might identify lepton number with an exact topological charge. Then neutrinos are Dirac particles and neutrinoless double-beta decay is forbidden:

$$
(A,Z)\not\rightarrow(A,Z+2)+2e^-.
$$

Observation of convincing light-Majorana-mediated neutrinoless double-beta decay would kill that branch.

## 19.3 Exact baryon topology

If baryon number is a topological defect invariant,

$$
B\in\mathbb Z,
$$

then an isolated proton cannot decay under any local admissible update.

The prediction is stronger than a very long lifetime:

$$
\tau_p=\infty
$$

within the exact low-energy code.

Current proton-decay searches continue to find no significant evidence, with mode-dependent partial lifetime limits reaching roughly $10^{34}$ years [24]. A confirmed proton-decay event would falsify exact topological baryon conservation.

## 19.4 Baryogenesis

Exact baryon conservation appears to conflict with cosmic baryogenesis unless the net topological charge was set during the code-phase transition or balanced by inaccessible opposite charge.

Possible mechanisms include:

- defect separation across disconnected code sectors,
- topological charge stored behind primordial horizons,
- spontaneous selection of a nonzero winding sector,
- or baryon-number emergence only after the early transition.

This is an open consistency problem.

---

# 20. What the framework can already reproduce

The word *reproduce* needs levels.

## Level A: Exact inside a toy model

RCC toy models can exactly provide:

- no-signalling without a causal path,
- a finite effective influence cone,
- a metric from shortest reconstruction cost,
- gauge covariance from local frame redundancy,
- holonomy and Wilson-loop invariants,
- an area upper bound on entanglement entropy,
- stable topological charges,
- an exactly Lorentz-invariant massless sector in the $1+1$D walk (§21.3),
- and the exact discrete-walk dispersion

$$
\cos(\omega\tau)=\cos(ka)\cos\theta.
$$

## Level B: Controlled continuum recovery

In suitable limits they can recover:

- the relativistic energy-momentum relation,
- a Dirac equation in $1+1$ dimensions,
- finite propagation speed,
- conventional gauge-covariant derivatives,
- and Newtonian gravity from a code-strain functional.

## Level C: Conditional recovery

Under additional assumptions, they can recover:

- the linearised semiclassical Einstein equation from entanglement equilibrium,
- Born-form probabilities from Gleason-type assumptions,
- cold-dark-matter stress-energy from a gas of hidden defects.

## Level D: Phenomenological proposal

RCC offers testable ansätze for:

- dark-energy evolution tied to nonlinear structure,
- dark-matter core or granularity scales,
- higher-order Lorentz-violating dispersion,
- quantum-gravity noise,
- and state-dependent gravitational response.

## Level E: Not yet derived

The following remain unsolved:

- the full Standard Model,
- exact chiral matter content,
- three generations,
- particle masses and mixings,
- nonlinear general relativity from microscopic dynamics,
- the value of $G$,
- the value and sign of $\Lambda$,
- a quantitative dark-matter model,
- a quantitative early-universe model,
- and the physical origin of Born weights.

---

# 21. Predictions and experimental tests

A speculative theory earns attention only through risk.

## 21.1 Gravity-mediated entanglement

### RCC expectation

Gravity is the effective response of a quantum substrate, so it should be capable of transmitting noncommuting quantum information.

Experiments proposed by Bose and by Marletto and Vedral place mesoscopic masses into spatial superpositions and test whether gravitational interaction generates entanglement [21].

RCC expects a positive result in a regime where:

- electromagnetic and Casimir backgrounds are controlled,
- the interaction is demonstrably gravitational,
- and no hidden direct quantum channel links the masses.

### Caveat

The inference from observed entanglement to a quantised gravitational field depends on assumptions about locality and allowed classical-quantum hybrid models [22].

### Falsification value

A clean positive result supports a nonclassical mediator, though not RCC specifically.

A clean negative result at a sensitivity where standard quantum gravity predicts observable entanglement would strongly constrain RCC's universal quantum-substrate claim.

## 21.2 Quantum equivalence principle

Ordinary composition-dependent violations should be absent to very high precision.

RCC instead allows a more unusual signal: dependence on the **logical quantum state** rather than chemical composition.

Consider two systems with equal mean stress-energy but different internal entanglement or code complexity. Parameterise

$$
\frac{\Delta g}{g}
=
\alpha_Q
\frac{\Delta S_{\mathrm{int}}}{S_\ast}.
$$

RCC requires

$$
\alpha_Q\rightarrow0
$$

for incoherent macroscopic matter, consistent with MICROSCOPE [19], but a coherent state could in principle retain a tiny correction.

Candidate experiments:

- atom interferometry with different entangled internal states,
- clocks using separable versus entangled ensembles,
- matter-wave interferometry with controlled internal entropy,
- tests comparing coherent superpositions with corresponding mixtures.

No value of $\alpha_Q$ is currently predicted. Deriving it is necessary before this becomes a real test.

The experimental neighbourhood already exists. Free fall of atoms in coherent superpositions of internal states has been tested to about the $10^{-9}$ level with no violation [46], and the quantum formulation of the equivalence principle that such experiments probe has been made precise [48]. Those results bound $\alpha_Q$-type effects six orders of magnitude more weakly than MICROSCOPE bounds composition dependence; that gap defines the open window an RCC calculation must land in to be interesting rather than excluded [E].

## 21.3 Recurrence dispersion

Version 0.1 claimed the toy dispersion produces corrections $\delta E\sim p^4/E_\ast^2$. That was wrong, and the correct statement is sharper and less convenient.

Expanding the exact relation

$$
\cos(\omega\tau)
=
\cos(ka)\cos\theta
$$

to fourth order gives

$$
(\omega\tau)^2
=
(ka)^2+\theta^2-\frac{(ka)^2\theta^2}{3}
+O\!\left((ka,\theta)^6\right),
$$

that is, with $E_\ast=\hbar/\tau$,

$$
E^2
=
p^2c^2+m^2c^4
-
\frac{p^2c^2\,(mc^2)^2}{3E_\ast^2}
+O(E_\ast^{-4}).
$$

Three consequences [E, toy]:

1. **The massless sector is exactly Lorentz invariant.** For $\theta=0$, $\cos(\omega\tau)=\cos(ka)$ gives $\omega\tau=\pm ka$ identically within the Brillouin zone. The $1+1$-dimensional two-component walk predicts zero energy-dependent photon velocity at any order. There is no photon-sector $\xi_2p^4/E_\ast^2$ term to constrain with gamma-ray bursts in this model.
2. **The leading correction is a mass-momentum cross term**, negative, vanishing for massless species. For an electron at $p=1\,\mathrm{TeV}/c$ with Planckian $E_\ast$, $\delta E^2/E^2\sim10^{-50}$: unobservable, and honesty requires saying so.
3. Genuine quartic and rotation-breaking anisotropic corrections are instead the generic expectation of $3+1$-dimensional automaton constructions [9], where the massless cone is not exactly linear and isotropic [S]. Current photon bounds constrain quadratic-order Lorentz violation only up to $E_{\mathrm{QG},2}\sim10^{10}$-$10^{11}\,\mathrm{GeV}$, roughly eight orders below the Planck scale, so a Planck-lattice quadratic coefficient of order one is presently unconstrained by time of flight [25] [E].

The dangerous operators are not these. They are the lower-dimension Lorentz-violating operators radiatively induced from the lattice scale unless a symmetry forbids them [47]; see §23.3. Appendix H exhibits both phenomena in two dimensions: derived anisotropic dispersion coefficients in the massless sector (H.2), and a renormalised composite cone $c^\ast<c$ from interactions (H.6).

Tests relevant to the $3+1$-dimensional case include:

- gamma-ray burst arrival times,
- high-energy neutrino timing,
- synchrotron constraints,
- threshold reactions,
- and precision laboratory tests of species-dependent dispersion.

Existing astrophysical constraints already strongly restrict simple energy-dependent photon speeds [25].

## 21.4 Lorentz symmetry in entangled many-body states

RCC suggests that the microscopic substrate may be revealed more readily by highly coherent, high-complexity states than by a single ultra-high-energy particle.

A phenomenological correction could depend on a nonlocal coherence measure $\mathcal Q$:

$$
E^2
=
p^2c^2+m^2c^4
+
\xi_Q
\mathcal Q
\frac{p^4c^4}{E_\ast^2}.
$$

Possible probes:

- large entangled atomic ensembles,
- macroscopic mechanical superpositions,
- long-baseline entangled clocks,
- high-finesse optomechanical networks.

This is exploratory. The theory must define $\mathcal Q$ operationally and preserve no-signalling.

## 21.5 Clock-correlation noise

If proper time is accumulated local decoding depth, microscopic strain fluctuations could produce correlated clock noise.

A simple stationary model is

$$
\langle
\delta y_A(t)\delta y_B(0)
\rangle
=
\alpha_T
K(d_{AB})
e^{-|t|/\tau_c},
$$

where $y=\delta\nu/\nu$, $K(d)$ is a spatial kernel, and $\tau_c$ is a correlation time.

Unlike conventional environmental noise, a code-strain signal might:

- correlate separated clocks,
- depend weakly on intervening geometry,
- remain common-mode across different clock species,
- and scale with entanglement or gravitational potential.

Candidate platforms:

- optical clock networks,
- atom interferometer arrays,
- pulsar timing arrays,
- satellite clock links.

Again, no credible amplitude is yet derived. The main value is to define what calculation the microscopic theory owes us.

The programme of hunting transient defects with clock networks is not hypothetical: it was proposed by Derevianko and Pospelov and executed on optical-clock and GPS networks [39]. Crucially, those searches constrain defects with scalar couplings to Standard Model constants. A defect coupled only gravitationally shifts a clock by $\Delta\Phi/c^2\sim GM_D/(bc^2)\sim10^{-40}$ for microgram masses at kilometre impact parameters: quantitatively hopeless [E]. Purely gravitational light defects therefore produce no observable clock transients. Either the dark sector has a small scalar portal, in which case the existing bounds bite, or this signature must be dropped for light defects.

## 21.6 Dark matter direct detection

If dark defects have no visible code interface, conventional nuclear recoil may remain absent.

Positive predictions could instead include:

- gravitational decoherence from passing defects,
- transient clock correlations,
- lensing by compact or granular defect concentrations,
- changes in resonant mechanical systems,
- rare topology-changing events near strong fields.

The clock and decoherence items inherit the caveat of §21.5: for purely gravitational coupling the amplitudes are of order $10^{-40}$ and dead [E]. They become live signatures only if a portal exists.

A persistent null result in conventional weakly interacting particle searches would be compatible with RCC but would not confirm it.

## 21.7 Dark-matter lensing granularity

Suppose dark defects have a minimum logical mass $M_D$. Then convergence maps have an irreducible shot-noise contribution

$$
P_\kappa^{\mathrm{shot}}
\propto
\frac{M_D}{\Sigma_{\mathrm{crit}}^2}
\int d\chi\,
\frac{n_D(\chi)}{a^2(\chi)}.
$$

Strong-lensing flux anomalies, astrometric lensing, pulsar timing, and gravitational-wave lensing could constrain $M_D$.

A smooth continuum limit corresponds to extremely small $M_D$.

Existing microlensing surveys already constrain this parameter directly: EROS-2, OGLE, and Subaru HSC exclude compact objects as the dominant component over roughly $10^{-11}$ to $10\,M_\odot$ [44, 45]. Those are current bounds on $M_D$, not future ones [E].

## 21.8 Dark energy tied to structure

The ansatz

$$
w_R(a)
=
-1
-
\frac{\beta}{3}
\frac{df_{\mathrm{nl}}}{d\ln a}
$$

predicts a relation between expansion and nonlinear growth.

Tests should perform a joint fit to:

- $H(z)$,
- $D_A(z)$,
- $f\sigma_8(z)$,
- weak-lensing shear,
- cluster abundance,
- and halo mass function.

A measured $w(z)$ varying independently of any physically reasonable structure measure would reject this simple RCC cosmology.

## 21.9 Proton stability

The exact-topology branch predicts no proton decay.

Searches at Hyper-Kamiokande, DUNE, and other detectors therefore have sharp falsification value.

One confirmed, background-resistant proton-decay event would kill exact baryon topology.

## 21.10 Neutrinoless double-beta decay

The exact-lepton-topology branch predicts no light-Majorana neutrinoless double-beta decay.

A positive signal with isotope cross-checks and consistent nuclear matrix elements would kill that branch.

## 21.11 Black-hole ringdown

RCC should reproduce classical general-relativistic ringdown at ordinary precision.

Possible deviations would arise only when the horizon approaches a reconstruction transition. Parameterise a correction

$$
\omega_{n\ell m}
=
\omega_{n\ell m}^{\mathrm{GR}}
\left[
1+
\alpha_H
\left(
\frac{\ell_\ast}{r_H}
\right)^p
\right].
$$

For astrophysical black holes and Planckian $\ell_\ast$, this is tiny.

The theory does not generically predict large echoes. A model that adds visible echoes without a microscopic calculation is probably fitting noise.

## 21.12 Collider predictions

RCC does not generically predict weak-scale supersymmetry or a large elementary scalar sector.

Possible collider signatures are instead:

- form-factor deviations,
- contact operators,

$$
\mathcal L_{\mathrm{eff}}
\supset
\frac{c_i}{E_\ast^2}\mathcal O_i^{(6)},
$$

- unusual topological states,
- or no accessible ultraviolet signal at all.

The absence of a TeV particle zoo is compatible with RCC but not distinctive.

---

# 22. Numerical research programme

The first serious work should be computational.

## 22.1 Goal 1: spontaneous geometric phase

Construct a quantum graph with:

- $N$ finite-dimensional nodes,
- dynamical links,
- local recurrent channels,
- a code-stability reward,
- and a routing-cost penalty.

Measure whether the ground or steady phase develops:

- bounded degree,
- approximate locality,
- dimension near three,
- a universal influence cone,
- area-law entanglement,
- foliation-covariance of $d_R$ across maximal antichains (§7.1),
- and absence of nonlocal reconstruction shortcuts (§7.2).

Status after v0.5 (Appendix I): the *static* half of this checklist is measured on fixed-graph free-fermion vacua — dimension near the target value, curvature proxy → 0, partition covariance trending to 1, area law in gapped sectors, cone anisotropy falling as $1/L$; the shortcut certification is incomplete (I.6). The *dynamical* half — a spontaneous geometric phase from graph annealing — has not been achieved: the pure graph action of §24.5 anneals into non-geometric clumps, and coupling fermionic matter improves but does not geometrise the cold rungs (I.10).

## 22.2 Goal 2: defect propagation

Insert a protected defect and measure:

- dispersion $E(k)$,
- recurrence phase,
- group velocity,
- stability under local noise,
- particle-antiparticle annihilation,
- and defect-defect scattering.

Test whether

$$
m c^2
\propto
\hbar\omega_{\mathrm{rec}}
$$

survives interactions.

Status after v0.4 (Appendix H.6): partially tested. The composite's rest quasienergy defines its mass and its dispersion takes the relativistic form, but its limiting velocity is renormalised, $c^\ast\approx0.897\,c$. The surviving open item is the mechanism that enforces a universal cone across species.

## 22.3 Goal 3: emergent gauge connection

Give each node a local code-frame basis and train or minimise a cost function invariant under

$$
\psi_v\to g_v\psi_v.
$$

Measure:

- link holonomy,
- Wilson loops,
- confinement or deconfinement,
- gauge-boson dispersion,
- and anomaly indicators.

## 22.4 Goal 4: capacity backreaction

Increase logical excitation density in a region and measure whether:

- reconstruction distances increase,
- local recurrence latency rises,
- propagation paths bend,
- clock rates redshift,
- and a universal potential emerges.

Fit the effective field equation:

$$
\nabla^2\Phi
=
4\pi G_{\mathrm{eff}}\rho
+
\alpha\nabla^4\Phi
+
\cdots.
$$

The priority measurement in this goal is $\gamma$: extract the clock-rate deformation and the spatial reconstruction-metric deformation produced by the same load, and test whether their ratio is unity (§13.4). A ratio away from one at the continuum fixed point kills the strain picture against Cassini [42].

Status after v0.5 (Appendix I.8, I.9): the $\gamma$ measurement was performed in the free-fermion MI-proxy realization and **failed** — $\gamma_{\mathrm{proxy}}\in[-0.08,0]$, clock side at $O(\varepsilon)$, metric side two to three orders smaller and of opposite sign, no drift toward 1 with size (§13.4). Two items on the list above did pass: local recurrence-latency proxies rise under load, and a universal attractive potential between two capacity loads is measured, $V(r)\propto-\varepsilon^2 e^{-r/\xi}$ with $\xi$ set by the mediator gap. The attraction exists; the metric response does not, in this realization.

Status after v0.6 (Appendix J): the failure is now known to be neither the proxy (J.2) nor curable by flux-coupled backreaction (J.3, unstable); and the "universal attraction" is corrected to a parity-alternating RKKY force with a $r^{-6}$ critical envelope (J.4) — not a gravity precursor. The Goal-4 burden now rests entirely on the stabilized variational backreaction probe.

## 22.5 Goal 5: equivalence principle

Create multiple defect species with different internal structure but equal energy.

Measure

$$
\eta_{AB}
=
2\frac{|a_A-a_B|}{|a_A+a_B|}.
$$

A good model should drive

$$
\eta_{AB}\to0
$$

as the continuum fixed point is approached.

## 22.6 Goal 6: black-hole analogue

Create a region whose outgoing channel capacity falls below incoming logical flux.

Measure:

- horizon-like causal trapping,
- cut entropy,
- scrambling,
- recovery depth,
- approximate thermal emission,
- and information return.

## 22.7 Goal 7: cosmological growth

Allow the network size and connectivity to evolve from a high-connectivity phase.

Measure whether it naturally produces:

- rapid geometric expansion,
- dimensional stabilisation,
- scale-invariant fluctuations,
- defect freeze-out,
- and late-time redundancy pressure.

---

# 23. No-go theorems and failure modes

A serious proposal should confront the arguments most likely to destroy it.

## 23.1 Weinberg-Witten theorem

The Weinberg-Witten theorem constrains composite massless particles of spin greater than one in theories with a Lorentz-covariant conserved stress-energy tensor [16].

An emergent graviton is therefore not automatically allowed.

RCC attempts to evade the theorem because:

- Lorentz covariance is emergent rather than microscopic,
- there may be no local gauge-invariant microscopic stress tensor corresponding to the emergent spacetime,
- and the graviton may be a collective geometric mode rather than a composite particle in an ordinary Lorentz-covariant QFT.

This is a possible evasion, not a proof. A concrete model must show exactly which theorem hypothesis fails.

### Marolf's kinematic-nonlocality argument

A related no-go: Marolf argued that theories whose kinematics is exactly local — whose observable algebras factorise over regions of a fixed background structure — cannot yield emergent gravity with the correct constraint structure, so emergent gravity requires kinematic nonlocality [49].

RCC plausibly evades the hypotheses because its kinematics is not fixed: the graph, and with it the factorisation of the observable algebra into regions, is itself dynamical, and logical observables are nonlocally supported relative to the microscopic qudits. As with Weinberg-Witten, the evasion must be located precisely in a concrete model, not asserted [P].

## 23.2 Nielsen-Ninomiya theorem

As discussed earlier, chiral fermions cannot simply be placed on an ordinary local translationally invariant lattice.

A fixed cubic RCC lattice with naive fermions is therefore dead on arrival.

## 23.3 Generic Lorentz violation and radiative percolation

Most discrete models produce preferred-frame effects.

The strongest published form of this objection is quantitative. Collins, Perez, Sudarsky, Urrutia, and Vucetich showed that radiative corrections generically transport Planck-scale Lorentz violation into *unsuppressed* operators of dimension four and below at accessible energies, unless a symmetry — supersymmetry, or an exact emergent boost invariance of the fixed point — protects the theory [47]. "Higher-order corrections only" (§6.3) is therefore not something the infrared does for free. It must be a theorem about the fixed point.

If RCC cannot demonstrate such a protected fixed point, it fails. This is arguably the single strongest published argument against the entire lattice-emergence class, and the framework owns it rather than footnoting it.

## 23.4 Species-dependent gravity

If different logical defects experience measurably different code strain, the framework conflicts with equivalence-principle tests.

Universality must emerge as a theorem or protected symmetry, not an approximate coincidence.

## 23.5 Too much freedom

A network model can fit anything if every link, channel, graph rule, and decoder is arbitrary.

RCC must reduce to a small action or update law with few dimensionless parameters.

Otherwise it is a language, not a theory.

Version 0.3 begins this reduction. The decoder is canonical (G.7), the code is the ground space of $H_{\mathrm{code}}$ rather than an independent choice, and the minimal model carries six continuous dimensionless couplings plus finitely many discrete choices (G.5).

## 23.6 Born-rule circularity

If the code-completion measure is simply chosen to be $|\psi|^2$, nothing has been explained.

The measure must follow from a deeper counting, symmetry, decision, or consistency principle without assuming the result.

## 23.7 Cosmological flexibility

If $\rho_R(a)$ can be any function, the dark-energy sector predicts nothing.

A microscopic model must determine it.

## 23.8 Black-hole hand-waving

“Information is encoded nonlocally” is not enough. The theory must calculate entropy, temperature, evaporation, and recovery.

## 23.9 Computational intractability

The exact network may be impossible to simulate classically. That is not fatal, but there must be:

- tensor-network truncations,
- stabiliser limits,
- quantum-simulator implementations,
- or controlled effective theories.

---

# 24. A minimal toy action

RCC is naturally expressed through quantum channels, but a Hamiltonian toy model is useful.

Let $G=(V,E)$ be a dynamical graph. Each node carries matter qudits and code memory. Each link carries a frame variable $\Gamma_e\in G_{\mathrm{gauge}}$.

Define

$$
H_{\mathrm{RCC}}
=
H_{\mathrm{code}}
+
H_{\mathrm{route}}
+
H_{\mathrm{frame}}
+
H_{\mathrm{strain}}
+
H_{\mathrm{graph}}.
$$

## 24.1 Code term

$$
H_{\mathrm{code}}
=
\Delta
\sum_a
\left(
I-S_a
\right).
$$

The vacuum is the common $+1$ eigenspace of the constraints.

## 24.2 Routing term

$$
H_{\mathrm{route}}
=
-J
\sum_{\langle uv\rangle}
\left(
\psi_u^\dagger\Gamma_{uv}\psi_v
+
\psi_v^\dagger\Gamma_{uv}^\dagger\psi_u
\right).
$$

This transports logical excitations while respecting local code frames.

## 24.3 Frame curvature term

$$
H_{\mathrm{frame}}
=
\frac{1}{g^2}
\sum_p
\left[
1-
\frac{1}{d_G}
\mathrm{Re\,Tr}(W_p)
\right].
$$

This is the familiar lattice-gauge structure, reinterpreted as code-frame mismatch.

## 24.4 Strain term

Let $n_e$ be logical channel load and $c_e$ available capacity.

$$
H_{\mathrm{strain}}
=
\frac{\kappa}{2}
\sum_e
\left(
n_e-c_e
\right)^2.
$$

Excitations increase $n_e$, changing preferred routing and effective distance.

## 24.5 Graph term

Let $A_{uv}\in\{0,1\}$ be link occupation.

$$
H_{\mathrm{graph}}
=
\mu
\sum_v
(\deg v-z_0)^2
-
\lambda
\sum_{\triangle}
A_{uv}A_{vw}A_{wu}
+
\cdots.
$$

The coefficients should favour a sparse local phase rather than a complete graph.

## 24.6 Recurrent Floquet update

A recurrent quantum update is

$$
U_F
=
e^{-i\tau H_{\mathrm{graph}}}
e^{-i\tau H_{\mathrm{strain}}}
e^{-i\tau H_{\mathrm{frame}}}
e^{-i\tau H_{\mathrm{route}}}
e^{-i\tau H_{\mathrm{code}}}.
$$

A logical particle may be a quasienergy eigenstate:

$$
U_F|\Psi_\alpha\rangle
=
e^{-i\omega_\alpha\tau}
|\Psi_\alpha\rangle.
$$

Its rest mass is conjectured to satisfy

$$
m_\alpha c^2
=
\hbar|\omega_\alpha(0)|,
$$

with one caveat: quasienergy is defined only modulo $2\pi/\tau$, so the identification requires $|\omega_\alpha|\tau\ll\pi$ and adiabatic continuation from a reference branch. Without this, the mass of a heavy defect is folding-ambiguous [E].

This gives a concrete simulation target.

---

# 25. Development roadmap

## Phase 0: mathematical hygiene — delivered in v0.3 (Appendix G), with remainders

Deliverables and status:

- exact definitions of event, memory, code, decoder, and geometry — **delivered** (G.1, G.3, G.4) [E],
- proof of causal consistency — **delivered**, including the adaptive case (G.2, G.3) [E],
- parameter counting — **delivered** for the minimal model: six continuous dimensionless couplings plus finitely many discrete choices (G.5) [E],
- a clear continuum-limit procedure — **delivered as a definition**, with the free sector verified to pass; existence for the interacting, geometry-coupled case is the open problem (G.6) [E as procedure, P as existence].

Remainders assigned to later phases: foliation covariance of $d_R$ (Phase 2), existence of a boost-protected critical point (Phase 3), interacting continuum limits (Phases 4-5).

## Phase 1: fixed-graph recurrent matter — delivered in v0.4 (Appendix H), with remainders

Fixed one- and two-dimensional graphs. Deliverables and status:

- Dirac limit — **delivered**: $1+1$D including scalar-mass and $U(1)$ backgrounds, and the exact two-dimensional dispersion with anisotropy coefficients (H.2) [E],
- defect stability — **delivered**: recurrence-angle kink binds a symmetry-protected zero mode; protection quantified under disorder and symmetry breaking (H.5) [E],
- scattering — **delivered**: Dirac-step transmission to $0.3\%$; interacting two-walker molecules with binding energies (H.6) [E],
- recurrence-mass relation — **verified** for free particles and, via rest quasienergy, for interacting composites (H.4, H.6) [E],
- finite-speed bounds — **delivered exactly**: strict cone and $v_{\max}=c\cos\theta$ (H.3) [E].

Remainders assigned onward: particle-antiparticle annihilation, two-dimensional defects with genuine topological charge (beyond symmetry protection), dynamical gauge fields (Phase 4), and — promoted by H.6 — a mechanism enforcing cone universality across composites (Phase 3).

## Phase 2: reconstruction geometry — delivered in v0.5 (Appendix I), with remainders

Exact free-fermion vacua on fixed graphs; geometry read out through the MI-proxy metric of G.9. Deliverables and status:

- emergent metric — **delivered**: metric reconstruction succeeds on lattice vacua and correctly refuses an expander control (I.2, I.3) [E, in-model, MI-proxy],
- dimension flow — **delivered**: $d_{\mathrm{eff}}=2.06\pm0.01$ in 2D; 3D flowing to $3$ with visible finite-size bias (I.2) [E, in-model],
- curvature estimators — **delivered as proxies**: ball-volume curvature → 0 on flat vacua with the correct size trend (I.2) [E, in-model],
- geodesic propagation — **delivered in 2D**: influence fronts linear in the emergent metric, anisotropy falling as $\sim1/L$ (I.7) [E, in-model]; 3D rerun needed.

Beyond the four listed deliverables, Phase 2 also produced: the G.9 covariance trend (I.4), the gapped-sector area law with the known critical violation (I.5), the failed $\gamma$ probe (I.8) — the phase's most consequential output — and the measured defect-defect attraction (I.9).

Remainders assigned onward: node-level operational (Petz) shortcut and $\gamma$ checks against the MI proxy; a dynamical-backreaction $\gamma$ probe in which the load and the geometry respond self-consistently (Phase 5 prerequisite); 3D cone rerun with a corrected time grid; state-dependent link capacity as a dynamical variable rather than a static perturbation.

Phase-2.5 update (v0.6, Appendix J): all four remainders were executed. Operational $\gamma$ checks — done, negative (J.2); dynamical-backreaction $\gamma$ — done, unstable rather than $\gamma=1$ (J.3); 3D cone — done, cone isotropizes in 3D (J.5); shortcut certification — done, no wormhole class (J.6). New remainder: the variational (strain-cost) backreaction probe.

## Phase 3: dynamical graph vacuum

Allow graph rewiring.

Deliverables:

- spontaneous low-dimensional locality,
- stable Lorentz-like cone,
- suppression of preferred-frame operators,
- and phase diagram.

First contact made in v0.5: parallel-tempering annealing of the §24.5 graph action, with and without fermionic matter (I.10). Result so far negative — no geometric phase; matter coupling moves the cold rungs in the geometric direction but the Monte Carlo freezes. The phase needs better moves (cluster or worm updates), longer ladders, and a matter term whose backreaction is computed rather than annealed against.

Second contact in v0.6 (J.7): degree-preserving swap moves unfroze the sampler, which then found *deeper and less geometric* minima. The obstruction is the action, not the sampling. Phase 3 begins from action redesign: candidate ingredients are a matter term with genuine backreaction weight, a locality reward tied to the emergent metric at shorter refresh intervals, and suppression of the triangle term's clique attractor.

## Phase 4: gauge and chirality

Deliverables:

- non-Abelian frame group,
- chiral defect spectrum,
- anomaly cancellation,
- and explicit evasion of Nielsen-Ninomiya assumptions.

## Phase 5: gravity

Deliverables:

- universal coupling,
- Newtonian limit from microscopic parameters,
- post-Newtonian coefficients,
- gravitational waves,
- and a derivation of the area coefficient.

## Phase 6: black holes

Deliverables:

- horizon formation,
- temperature,
- entropy,
- unitary evaporation,
- and recovery dynamics.

## Phase 7: cosmology

Deliverables:

- early code-phase transition,
- primordial perturbations,
- dark-defect abundance,
- expansion history,
- and structure-linked dark energy.

## Phase 8: experimental forecasts

Deliverables:

- numerical values for Lorentz-violation coefficients,
- clock-noise spectra,
- quantum-equivalence parameters,
- dark-defect masses and cross sections,
- and cosmological parameter posteriors.

---

# 26. Criteria that would kill the theory

The framework should be abandoned or radically revised if any of the following occur.

1. **No viable chiral continuum limit exists.**

2. **Universal Lorentz symmetry requires uncontrolled fine tuning.**

3. **The microscopic model predicts equivalence-principle violation above experimental limits.**

4. **The recurrence-mass mechanism fails beyond free $1+1$-dimensional toys.**

5. **No dynamical graph phase produces stable $3+1$-dimensional locality.** Status after v0.6: engaged for the §24.5 action family — with unfrozen sampling, its deeper minima are *less* geometric (Appendix J.7). Not yet a trigger: the criterion quantifies over actions, and only one family is excluded. Phase 3 must now exhibit a better action or start conceding this point.

6. **The area coefficient cannot be related to $G$ without inserting it by hand.**

7. **The model cannot recover nonlinear general relativity or produces excluded post-Newtonian parameters.**

8. **The dark sector cannot fit the CMB and large-scale structure simultaneously.**

9. **The cosmological sector becomes an arbitrary function-fitting device.**

10. **The Born rule must simply be postulated with no deeper justification.**

11. **A confirmed proton-decay event occurs, if exact baryon topology is retained.**

12. **A confirmed light-Majorana neutrinoless double-beta signal occurs, if exact lepton topology is retained.**

13. **A sufficiently clean gravity-mediated-entanglement experiment contradicts the predicted quantum-substrate behaviour.**

14. **The complete model requires more arbitrary parameters than the theories it is meant to explain.**

15. **The microscopic model produces $\Phi\neq\Psi$, that is PPN $\gamma\neq1$, above the $10^{-5}$ level without a protective mechanism.** Status after v0.5: the first in-model test (free-fermion, MI-proxy, static load) produced $\gamma_{\mathrm{proxy}}\approx0$, far from 1 (Appendix I.8). Not a formal trigger — the proxy-to-PPN mapping is [P] — but the burden of proof has shifted: some realization must now exhibit $\gamma\to1$, or this criterion fires. Status after v0.6: two of the three exits are closed negative (operational proxies equally blind; flux-coupled backreaction unstable, Appendix J.2-J.3). One structural route remains — the stabilized variational backreaction — before this criterion fires for the model class. **Status after v0.7: the third exit is closed negative (Appendix J.3b), and the criterion FIRES, scoped: free-fermion matter with scalar link-capacity strain and correlational reconstruction geometry is excluded.** The framework survives only through realizations not yet exhibited (§13.4). Status after v0.9: such a realization is now exhibited — the code-layer probe has the right sign everywhere and $\gamma_{\mathrm{lin}}=1$ at marginal decoder utilization (Appendix K). The scoped exclusion stands; the criterion's pressure on the framework is relieved but not resolved until the crossing is definition-independent and a far field exists.

16. **DR3-class cosmological data confirm a robust phantom crossing of $w(z)$, if the rigid redundancy-pressure ansatz of §18.2 is retained.**

---

# 27. Conclusion

The Recurrent Causal Code is built around a simple reversal.

Ordinary physics begins with spacetime and places quantum fields inside it.

RCC begins with a recurrent quantum information process and asks what kind of observers inside that process would call spacetime, particles, mass, gauge fields, and gravity.

Its strongest verified mathematics is borrowed and modest: the discrete quantum walk that generates a relativistic mass term from an internal rotation is established theory [9, 10, 35]. What RCC stakes on it is an identification — mass, proper time, and decoding latency as one resource of a self-correcting substrate — together with a fact worth taking seriously: the simplest such model has an exactly Lorentz-invariant massless sector, which turns "can Lorentz symmetry emerge?" into the sharper question of how much of that exactness survives in three spatial dimensions.

Its broader claims are more ambitious:

$$
\text{geometry}
\leftrightarrow
\text{recoverability},
$$

$$
\text{matter}
\leftrightarrow
\text{protected recurrent defects},
$$

$$
\text{gauge fields}
\leftrightarrow
\text{code-frame transport},
$$

$$
\text{gravity}
\leftrightarrow
\text{universal capacity strain}.
$$

These identifications are compatible with several known hints:

- finite-speed information propagation in local quantum systems,
- quantum cellular automata with relativistic continuum limits,
- geometry encoded by entanglement and recovery,
- area-law entropy,
- and thermodynamic or entanglement-based recovery of Einstein equations.

They are not yet a theory of nature.

The right next move is not to add more philosophical language. It is to build the smallest recurrent code model that supports a stable defect, lets that defect backreact on reconstruction geometry, and then checks whether universality and relativistic dynamics appear without being forced.

If that fails, the idea dies usefully.

If it works, even in a stripped-down model, it would suggest that the universe is not a collection of objects moving through a pre-existing arena.

It would be a code continually repairing the arena and the objects together.

---

# Appendix A: discrete Dirac derivation

Start with

$$
U(k)
=
e^{-ika\sigma_z}
e^{-i\theta\sigma_x}.
$$

Using

$$
e^{-i\alpha\sigma_j}
=
\cos\alpha\,I
-
i\sin\alpha\,\sigma_j,
$$

we get

$$
U(k)
=
(\cos ka\,I-i\sin ka\,\sigma_z)
(\cos\theta\,I-i\sin\theta\,\sigma_x).
$$

Multiplying,

$$
U(k)
=
\cos ka\cos\theta\,I
-i\cos ka\sin\theta\,\sigma_x
-i\sin ka\cos\theta\,\sigma_z
-i\sin ka\sin\theta\,\sigma_y,
$$

up to the sign convention from

$$
\sigma_z\sigma_x=i\sigma_y.
$$

The eigenvalues of an $SU(2)$ matrix are

$$
e^{\pm i\omega\tau}.
$$

Since

$$
\mathrm{Tr}\,U
=
2\cos ka\cos\theta,
$$

we obtain

$$
\cos(\omega\tau)
=
\cos ka\cos\theta.
$$

For small $ka,\theta$,

$$
\omega
=
\frac{1}{\tau}
\sqrt{(ka)^2+\theta^2}
+
O(k^4,\theta^4,k^2\theta^2).
$$

Hence

$$
H_{\mathrm{eff}}
\approx
\hbar ck\,\sigma_z
+
mc^2\sigma_x,
$$

where

$$
c=\frac a\tau,
\qquad
mc^2=\frac{\hbar\theta}{\tau}.
$$

In position space,

$$
i\hbar\partial_t\Psi
=
\left(
-i\hbar c\sigma_z\partial_x
+
mc^2\sigma_x
\right)\Psi.
$$

This is a representation of the $1+1$-dimensional Dirac equation.

---

# Appendix B: causal influence bound

Let $A$ be the graph adjacency matrix. Suppose one update transmits operator influence with norm at most $\lambda$ through each edge.

After $n$ infinitesimal or Trotterised update intervals, the influence matrix is bounded entrywise, using non-negativity of $A$, by

$$
M(n)
\preceq
(I+\lambda A)^n
\preceq
e^{\lambda nA}.
$$

Expanding,

$$
(e^{\lambda nA})_{uv}
=
\sum_{m=0}^{\infty}
\frac{(\lambda n)^m}{m!}
(A^m)_{uv}.
$$

If graph distance is $d=d(u,v)$, then

$$
(A^m)_{uv}=0
\qquad
\text{for }m<d.
$$

If the maximum degree is $z$,

$$
(A^m)_{uv}\le z^m.
$$

Therefore

$$
M_{uv}(n)
\le
\sum_{m=d}^\infty
\frac{(z\lambda n)^m}{m!}.
$$

Standard exponential-tail bounds give

$$
M_{uv}(n)
\le
C e^{-\mu(d-vn)}
$$

for suitable $C,\mu,v$.

The physical light cone appears if the low-energy reconstruction metric is proportional to the graph metric over the relevant scale.

For strictly local discrete circuits the stronger exact statement holds: after $n$ range-one layers, influence beyond graph distance $n$ is identically zero. The exponential bound above is what remains after Trotterisation or coarse-graining into logical time (§6.2).

---

# Appendix C: gauge covariance

Let

$$
\psi_v\to g_v\psi_v
$$

and

$$
\Gamma_{uv}\to g_u\Gamma_{uv}g_v^{-1}.
$$

Then

$$
D_{uv}\psi
=
\psi_u-\Gamma_{uv}\psi_v
$$

transforms as

$$
D_{uv}\psi
\to
g_u\psi_u
-
g_u\Gamma_{uv}g_v^{-1}g_v\psi_v
=
g_uD_{uv}\psi.
$$

For unitary $g_u$,

$$
(D_{uv}\psi)^\dagger(D_{uv}\psi)
$$

is invariant.

For a loop,

$$
W_p
=
\Gamma_{01}\Gamma_{12}\cdots\Gamma_{n0},
$$

and

$$
W_p\to g_0W_pg_0^{-1}.
$$

Therefore any class function, including

$$
\mathrm{Tr}(W_p),
$$

is gauge invariant.

---

# Appendix D: Newtonian code-strain functional

Take

$$
\mathcal F[\varphi]
=
\int
\left[
A|\nabla\varphi|^2+B\rho\varphi
\right]d^3x.
$$

Variation gives

$$
-2A\nabla^2\varphi+B\rho=0.
$$

To reproduce

$$
\nabla^2\Phi=4\pi G\rho,
\qquad
\Phi=c^2\varphi,
$$

we require

$$
\frac{B}{2A}
=
\frac{4\pi G}{c^2}.
$$

Choosing

$$
A=\frac{c^4}{8\pi G},
\qquad
B=c^2
$$

gives the functional used in the main text.

A microscopic derivation must calculate $A$ from:

- channel capacity,
- local Hilbert dimension,
- code distance,
- recurrence scale,
- and the density of independent cut channels.

One possible dimensional relation is

$$
G
\sim
\frac{c^3\ell_\ast^2}{\hbar}
\frac{1}{\gamma_{\mathrm{code}}},
$$

where $\gamma_{\mathrm{code}}$ is a dimensionless code-density factor.

For $\gamma_{\mathrm{code}}\sim1$, this resembles the Planck relation

$$
\ell_P^2=\frac{\hbar G}{c^3}.
$$

The coefficient must be derived, not guessed.

---

# Appendix E: simulation pseudocode

```python
# Conceptual pseudocode, not a production implementation.

initialise_graph(num_nodes=N, target_degree=z0)
initialise_node_qudits(local_dim=d)
initialise_memory_qudits(memory_dim=m)
initialise_link_frames(group=G)
initialise_code_constraints(stabilisers=S)

for epoch in range(num_epochs):

    # 1. Recurrent local update
    for recurrence_step in range(R):
        messages = route_quantum_messages(graph, link_frames)
        memories, outputs = local_recurrent_channels(
            node_states,
            memories,
            messages
        )
        syndromes = measure_or_coherently_extract_syndromes(
            outputs,
            code_constraints
        )
        node_states = coherent_recovery(outputs, syndromes)

    # 2. Estimate logical recoverability
    q = estimate_pairwise_reconstruction_fidelity(
        node_states,
        decoders
    )

    # 3. Construct emergent metric
    edge_lengths = -ell_star * log(q)
    reconstruction_metric = all_pairs_shortest_paths(edge_lengths)

    # 4. Measure effective geometry
    dimension = estimate_volume_growth_dimension(
        reconstruction_metric
    )
    curvature = estimate_small_ball_curvature(
        reconstruction_metric
    )
    causal_velocity = estimate_influence_cone(
        update_history
    )

    # 5. Insert or evolve defects
    defect_states = propagate_logical_defects(
        graph,
        node_states,
        link_frames
    )
    dispersion = measure_defect_dispersion(defect_states)
    recurrence_phase = measure_internal_cycle(defect_states)

    # 6. Capacity backreaction
    loads = estimate_channel_load(defect_states, messages)
    graph, link_capacities = update_graph_and_capacity(
        graph,
        loads,
        code_stability_reward=True,
        locality_penalty=True
    )

    # 7. Optimisation target
    loss = (
        lambda_code * syndrome_rate
        + lambda_dim * (dimension - 3.0)**2
        + lambda_lorentz * cone_anisotropy
        + lambda_sparse * graph_density_penalty
        + lambda_universal * species_acceleration_variance
    )

    optimise_parameters(loss)
```

A first implementation should use stabiliser circuits or low-bond-dimension tensor networks. Full generic quantum simulation will scale exponentially.

---

# Appendix F: tagged claim ledger

Every substantive claim of the framework, tagged. [E] certifies mathematics or replicated observation; for toy theorems it does not certify physics. Bracketed section numbers locate the claim.

## Postulates

| Claim | Tag | Notes / upgrade path |
|---|---|---|
| Finite local Hilbert dimension (P1) | [S] | Standard discreteness bet; no direct evidence |
| Relational acyclic causal order over events (P2) | [S] | Causal-set lineage [5, 6]; v0.2 two-sorted systems/events fix |
| Recurrent worldline memory (P3) | [W] | RCC-distinctive; upgrade via interacting models (§9.5) |
| Observables live in protected logical subspaces (P4) | [W] | Established in the holographic context [13, 14]; wild as a claim about our vacuum |
| Geometry from recoverability and influence (P5) | [W] | Nearest relative [34]; upgrade via §22.1 |
| Vacuum as a Lorentz-symmetric coding phase (P6) | [P] | The central unpaid note; the creditor is [47] |
| Universal capacity backreaction is gravity (P7) | [W] | First test is $\gamma$ (§13.4) |
| Histories as globally consistent record assignments (P8) | [W] | Mechanism owed (§16) |

## Causality and geometry

| Claim | Tag | Notes / upgrade path |
|---|---|---|
| No signalling without a causal path (Thm 1) | [E] | Extend to indefinite causal structures if desired |
| Finite influence cone (Thm 2) | [E] | Exact for discrete circuits, Lieb-Robinson after coarse-graining (§6.2); derive a universal physical $c$ [P] |
| Emergent infrared Lorentz invariance (§6.3) | [P] | Must be a fixed-point theorem; radiative percolation [47] is the obstacle |
| $d_R$ is a metric (Thm 3) | [E] | Physical content depends on $q_{ij}$; antichain covariance [P]; no-shortcut condition [P] (§7.1-7.2) |
| $d_{\mathrm{eff}}\rightarrow3$ in the vacuum phase (§7.3) | [P] | Goal 1 of §22 |
| Curvature from reconstruction-ball deficits (§7.4) | [S] | Standard metric geometry once a metric exists |

## Matter

| Claim | Tag | Notes / upgrade path |
|---|---|---|
| Homotopy protection of topological charge (Prop 4) | [E] | Existence of a suitable order-parameter manifold in the RCC vacuum [P] |
| Particles as logical defect classes (§8) | [S] | Exact in the toric code and string-nets [31-33]; [W] as a claim about electrons |
| Walk dispersion, Dirac limit, $m=\hbar\theta/(c^2\tau)$ (Thm 5) | [E] | Established quantum-walk theory [9, 10, 35], not RCC-original |
| Exactly Lorentz-invariant massless sector of the $1+1$D walk (§21.3) | [E] | Survival in interacting $3+1$D models [P] |
| Mass = recurrence latency, as interpretation (§9) | [W] | Upgrade: interacting $3+1$D chiral extension (§9.5) |
| Leading dispersion correction $\propto p^2m^2/E_\ast^2$ (§21.3) | [E] | Unobservable for Planckian $E_\ast$; stated honestly |

## Gauge structure and the Standard Model

| Claim | Tag | Notes / upgrade path |
|---|---|---|
| Gauge covariance from local frames (Thm 6) | [E] | Standard lattice-gauge mathematics; derive the Standard Model group [P] |
| Gauge bosons as frame-comparison disturbances (§10.4) | [W] | Nearest existing evidence: [32, 33] |
| Standard Model as the minimal chiral code phase (§11) | [W] | Classification problem well posed, unsolved |
| Nielsen-Ninomiya evasion routes (§11.2) | [S] | Routes are real, including symmetric mass generation [50]; no RCC construction exists [P] |
| Anomaly cancellation as code consistency (§11.3) | [P] | Schematic only |
| Generations as recurrence windings (§11.4) | [W] | Unconstrained, as admitted |

## Gravity

| Claim | Tag | Notes / upgrade path |
|---|---|---|
| Strain field $\varphi$, time dilation from settling depth (§12) | [W] | Microscopic mechanism [P]; signs verified consistent |
| Universality of free fall from substrate universality (§12.4) | [P] | Must clear $10^{-15}$ [19] and $\gamma$ [42] |
| Poisson equation from the strain functional (Prop 7) | [E, given the functional] | Coefficients reverse-engineered (App. D) [P]; on-shell binding-energy check passes (§13.1) [E] |
| $\Phi=\Psi$, PPN $\gamma=1$ (§13.4) | [P] | Top gravitational priority; Cassini is the creditor [42] |
| Linearised Einstein from entanglement equilibrium (Thm 8) | [S] | Conditional on [12]; caveats [15] |
| $A/4G\hbar$ counts logical cut channels (§14.3) | [W] | Coefficient derivation [P] |
| $\Lambda$ as macroscopic code-pressure constant (§14.4) | [W] | Sequestering mechanism [P] |

## Black holes

| Claim | Tag | Notes / upgrade path |
|---|---|---|
| Cut entropy bound (Thm 9) | [E] | Area law and saturation require min-cut $\propto$ emergent area [P] |
| Horizon as a decoding-depth transition (§15.2) | [S] | [37, 38] make the framing respectable; the RCC realisation [P] |
| Singularity as decoder-domain failure (§15.3) | [W] | |
| Unitary evaporation, temperature, Page curve (§15.4) | [P] | Explicitly owed |

## Measurement

| Claim | Tag | Notes / upgrade path |
|---|---|---|
| Records via redundant copying (§16.1) | [E] | Quantum Darwinism [40] |
| History-weight framework $P(i)$ (§16.2) | [W] | |
| Born form from Gleason/Busch assumptions (Thm 10) | [E as mathematics] | POVM version closes dimension two [41] |
| Noncontextual additivity from record consistency (§16.4) | [P] | Must engage [40, 43] or risk rediscovery |
| No superdeterminism required (§16.5) | [S] | Consistent with [2] |

## Dark sector and cosmology

| Claim | Tag | Notes / upgrade path |
|---|---|---|
| Dark matter as gauge-blind stable defects (§17.1) | [W] | Cold-dark-matter stress-energy at leading order [S] as an effective claim |
| Exponentially small visible couplings (§17.3) | [W] | Plausible for topological sectors; no calculation |
| Quantised defect masses (§17.4, §21.7) | [W] | Already excluded as the dominant component over $10^{-11}$-$10\,M_\odot$ [44, 45] |
| Purely gravitational clock transients (§21.5-21.6) | dead [E] | Amplitude $\sim10^{-40}$; needs a scalar portal, and then [39] bites |
| $w_R$ algebra of §18.1-18.2 | [E, given the ansatz] | Cannot cross $w=-1$; kill criterion 16 |
| Redundancy-pressure mechanism (§18.1) | [W] | Local kernel realisation [P] |
| Vacuum-energy sequestering (§18.4) | [P] | Honestly stamped |
| Cosmogenesis as a code-phase transition; inflation as reconstruction growth (§18.5) | [W]/[P] | No perturbation spectrum yet |

## Strong branches

| Claim | Tag | Notes / upgrade path |
|---|---|---|
| Dirac neutrinos, no $0\nu\beta\beta$ (§19.2) | [W] | Genuinely falsifiable branch — the framework's best risk |
| Exact baryon topology, $\tau_p=\infty$ (§19.3) | [W] | Falsifiable; baryogenesis tension open [P] |
| Neutrino recurrence mass matrix (§19.1) | [W] | Dimensional bookkeeping verified [E] |

## Predictions

| Claim | Tag | Notes / upgrade path |
|---|---|---|
| Gravity-mediated entanglement expected positive (§21.1) | [S] | Mainstream expectation, non-distinctive; caveats [22] |
| $\alpha_Q$ state dependence of free fall (§21.2) | [W] | Value [P]; window bounded by [46] against [19] |
| Coherence-dependent dispersion $\xi_Q\mathcal Q$ (§21.4) | [W] | $\mathcal Q$ operationally undefined [P] |
| Clock-correlation noise (§21.5) | [W] | Amplitude [P]; compare [39] |
| Lensing shot noise $\propto M_D$ (§21.7) | [E] as scaling | Current bounds [44, 45] |
| Ringdown deviations Planck-suppressed, no generic echoes (§21.11) | [S] | Consistent with current gravitational-wave constraints |
| No generic weak-scale zoo (§21.12) | [S] | Compatible, non-distinctive |

## Open structural problems

| Claim | Tag | Notes / upgrade path |
|---|---|---|
| Weinberg-Witten evasion (§23.1) | [P] | Locate the failing hypothesis; likewise for Marolf [49] |
| Protected Lorentz fixed point (§23.3) | [P] | The framework's largest single debt [47] |
| Full Standard Model | [P] | Explicit anomaly-free chiral code |
| Nonlinear general relativity | [P] | Controlled continuum derivation |
| Unique microscopic theory | [P] | Classification and parameter reduction |

## Phase 0 formal foundations (v0.3)

| Claim | Tag | Notes / upgrade path |
|---|---|---|
| Global circuit well defined and schedule independent (Thm G.1) | [E] | Poset transposition / tensor-contraction argument, proved |
| No-signalling with complete proof (Cor G.2) | [E] | Upgrades the sketch of Theorem 1; locates the role of trace preservation |
| Adaptive syndrome-controlled settling is causal (Prop G.3) | [E] | Instruments with feed-forward along the causal order |
| Canonical Petz decoder within factor two of optimal (G.7) | [E] | Barnum-Knill [52]; removes decoder freedom (§23.5) |
| Minimal model has six continuous dimensionless couplings (G.5) | [E] | Counting only; predictivity not implied |
| Continuum limit as four-layer convergence (G.6) | [E] as definition | Existence beyond the free sector [P] |
| Free $1+1$D sector passes all layers (Thm G.4) | [E] | [10, 55] |
| Proper-time concentration requirement (G.6, Layer 4) | [E] as requirement | Guaranteeing mechanism [P]; links to §21.5 |
| Scaling window where $d_R$ stabilises exists (G.9) | [P] | Vacuum-phase property; Phase 2 target |
| Boost-protected critical point exists (G.6, Layer 0) | [P] | Phase 3 target; the debt to [47] |

## Phase 1 fixed-graph matter (v0.4)

| Claim | Tag | Notes / upgrade path |
|---|---|---|
| 1D spectrum matches analytic dispersion at $10^{-14}$ (H.2) | [E] | Measured, $N=256$ |
| Exact 2D dispersion $\cos\omega=c_xc_yc_\theta-s_xs_ys_\theta$ (H.2) | [E] | Verified to $2\times10^{-16}$ |
| 2D massless anisotropy $-(ka)^2\sin^2(2\phi)/24$; massive diagonal anisotropy $\pm\theta$ (H.2) | [E] | Coefficients derived and confirmed; exact 1D cone does not survive |
| Strict cone, zero leakage; $v_{\max}=c\cos(mc^2\tau/\hbar)$ (H.3) | [E] | Closed form; mass costs cone speed |
| Recurrence-mass and zitterbewegung verified (H.4) | [E] | $\omega_0=\theta/\tau$; beat at $2\omega_0$ measured |
| Recurrence-angle kink binds a protected zero mode (H.5) | [E] | $|\varepsilon|<3\times10^{-15}$; $\xi=3.28a$ vs $\hbar/mc=3.33a$; Jackiw-Rebbi [60], Kitagawa [57, 58] |
| Protection is chiral/SPT-grade, quantified (H.5) | [E] | Disorder-pinned; breaks by $O(\delta)$ under chiral breaking; full topological order [P] |
| Mass-step transmission = Dirac to $0.3\%$ (H.6a) | [E] | Lattice residue $O(k_0a)$ |
| Interacting walkers form molecules (H.6b) | [E] | Ahlbrecht mechanism [59]; binding $0.0573$ at $\varphi=\pi$ |
| Composite dispersion relativistic with $c^\ast=0.897c$ (H.6c) | [E] | Residual $1.2\times10^{-4}$; rest quasienergy defines composite mass |
| Cone universality fails in-model; vacuum must enforce it | [E] as finding | Repair mechanism [P]; Phase 3 target |

## Phase 2 reconstruction geometry (v0.5)

| Claim | Tag | Notes / upgrade path |
|---|---|---|
| 2D vacua reconstruct $d_{\mathrm{eff}}=2.06\pm0.01$, curvature proxy $\to0$ (I.2) | [E, in-model, MI-proxy] | Positive control; residual $+0.06$ is finite-window bias |
| 3D dimension flow $2.19\to2.92\to3.18$ toward 3 (I.2) | [E, in-model, MI-proxy] | Finite-size still strong at $n=5832$ |
| Expander control: reconstruction correctly fails (I.3) | [E, in-model] | Estimators do not hallucinate geometry; supports Postulate 5 tooling |
| Partition covariance: Pearson $0.960\to0.987$, stress $0.099\to0.055$ over $L=32\to64$ (I.4) | [E, in-model] | G.9 window trend; exact limit and circuit-picture cut-covariance remain [P] |
| Gapped area law $S/\lvert\partial A\rvert=0.184$, size-stable (I.5) | [E, in-model] | Critical sectors violate logarithmically, as known [62, 63] |
| Shortcut certification incomplete at $L=64$ (I.6) | [E] as finding | Partition artifact vs genuine outlier unresolved; needs node-level Petz check |
| Influence cone linear in emergent metric; anisotropy $1.9\%$ at $L=64$, $\sim1/L$ (I.7) | [E, in-model] | Dynamical and correlational proxies of Postulate 5 agree |
| $\gamma_{\mathrm{proxy}}\in[-0.08,0]\ll1$ in all 72 runs (I.8) | [E] as finding | §13.4 mechanism fails in this realization; PPN mapping still [P]; kill criterion 15 burden shifted |
| Capacity loads attract: $V\propto-\varepsilon^2e^{-r/\xi}$ (I.9) | corrected in v0.6 | Parity-alternating RKKY force, $r^{-6}$ critical envelope (J.4) |
| Annealing: no geometric phase; matter helps but chains freeze (I.10) | [E] as finding | Kill criterion 5 untested, not triggered; Phase 3 needs better sampling |

## Phase 2.5 remainder tests (v0.6)

| Claim | Tag | Notes / upgrade path |
|---|---|---|
| All three proxies blind under static load: $\lvert\gamma\rvert\le0.08$ for MI, canonical, Petz (J.2) | [E, in-model] | Exit 1 of I.8 closed negative; the proxy is not the failure |
| Flux-coupled backreaction has no stable intermediate fixed point (J.3) | [E, in-model] | Jeans-like collapse above $\kappa_c$; $\gamma$ crosses 1 only on unconverged transients |
| Stabilized variational backreaction is the last structural route to $\gamma=1$ (J.3) | [P] | Designed; criterion 15 fires for this class if it fails |
| Defect force parity-alternates; critical envelope $\lvert V\rvert\sim r^{-6.0\pm0.3}$, gapped $\xi\approx0.65a$ (J.4) | [E, in-model] | Corrects I.9; RKKY-grade, not gravity-grade |
| 3D cone ballistic and isotropizing: $4.5\%\to3.1\%$ over $L=14\to18$ (J.5) | [E, in-model] | Auto grid cross-validated in 2D to $0.3\%$ |
| No wormhole class among flagged far pairs (J.6) | [E, in-model] | Metric-inflation artifacts + critical MI tail; §7.2 condition passes with gap-scaled thresholds |
| §24.5 action's deeper minima are less geometric (J.7) | [E, in-model] | Sampler exonerated; kill criterion 5 engaged for this action family |
| Variational-equilibrium $\gamma$: stiff $\Rightarrow$ blind, soft $\Rightarrow$ wrong sign, never $+1$ (J.3b, v0.7) | [E, in-model] | **Criterion 15 fired, scoped to the free-fermion capacity-strain realization**; successor requirements listed in §13.4 |

## Phase 4 opening: code-layer gamma (v0.9)

| Claim | Tag | Notes / upgrade path |
|---|---|---|
| Capacity load slows code clocks and lengthens code distances, everywhere tested (K.2) | [E, in-model] | First gravitational-sign realization; structural, not tuned |
| $\gamma_{\mathrm{lin}}$ monotone in vacuum density, crosses 1 at $\bar n\approx0.22$ (K.3) | [E, in-model] | Coincides with the decoder capacity knee at current precision |
| $\gamma=1$ at the critical coding point, meshing with Postulate 6 (K.3) | [S]/[P] | Coincidence of scales, not a theorem; needs operational metric + decoder universality |
| Static capacity has no far field (K.4) | [E, in-model] | Newtonian tail requires dynamical capacity — the Phase 5 object |

---

# Appendix G: formal foundations (Phase 0)

This appendix delivers the four Phase-0 items of §25: exact definitions (G.1, G.3, G.4), a proof of causal consistency (G.2), parameter counting (G.5), and a continuum-limit procedure (G.6). Everything proved here is [E]; every place where existence rather than definition is at stake is stamped [P].

## G.1 The causal substrate: exact definitions

### Definition G.1 (quantum causal network)

A **quantum causal network** is a tuple $\mathcal N=(S,V,\iota,E,d)$ in which:

1. $S$ is a countable set of **systems** and $V$ a countable set of **events**;
2. $\iota:V\rightarrow S$ assigns each event to the system it updates; the events $\iota^{-1}(s)$ of each system carry a total order, the **worldline order**, with locally finite intervals;
3. $E\subset V\times V$ is a set of directed edges, partitioned as $E=E_{\mathrm{mem}}\sqcup E_{\mathrm{msg}}$:
   a **memory edge** joins consecutive events of the same system; a **message edge** joins events of distinct systems;
4. the reachability relation $\prec$ (transitive closure of $E$) is a strict partial order — no directed cycles — and is **locally finite**: every event has finitely many incident edges, and every causal interval $[u,v]=\{w:u\preceq w\preceq v\}$ is finite;
5. $d:E\rightarrow\{1,2,3,\dots\}$ assigns each edge $e$ a Hilbert space $\mathcal H_e\cong\mathbb C^{d_e}$; all memory edges of a system $s$ carry the same **memory dimension** $m_s$. Edges with $d_e=1$ are trivial and may be omitted.

Terminology, fixing the words of Postulates 2-3 exactly: an **event** is an element of $V$; the **memory** of a system between two of its consecutive events is the state carried by the corresponding memory edge. Edges with no source carry initial data; edges with no target carry final data. Physical statements depend only on the isomorphism class of $\mathcal N$ together with its dynamics and state — there is no background structure to break this relabeling invariance [E].

### Definition G.2 (local dynamics)

For an event $v$, set

$$
\mathcal H^{\mathrm{in}}_v=\bigotimes_{e:\ \mathrm{tgt}(e)=v}\mathcal H_e,
\qquad
\mathcal H^{\mathrm{out}}_v=\bigotimes_{e:\ \mathrm{src}(e)=v}\mathcal H_e.
$$

A **dynamics** assigns to each event an isometry

$$
V_v:\mathcal H^{\mathrm{in}}_v\rightarrow\mathcal H^{\mathrm{out}}_v\otimes\mathcal H_{\mathcal E_v},
$$

with $\mathcal E_v$ an optional environment or syndrome factor; discarding $\mathcal E_v$ yields the local channel $\Phi_v$. A nontrivial memory in-edge and out-edge at every event of a system implements Postulate 3, and the recurrence label $r$ of §5.2 is the worldline index. The working formalism of §5 is recovered verbatim [E].

### Definition G.3 (down-sets, boundaries, circuits)

A **down-set** $F\subseteq V$ satisfies: $u\in F$ and $w\prec u$ imply $w\in F$. For finite $F$, the **in-boundary** $\partial_{\mathrm{in}}F$ is the set of edges with target in $F$ and no source in $F$; the **out-boundary** $\partial_{\mathrm{out}}F$ is the set of edges with source in $F$ and no target in $F$.

A **schedule** for $F$ is a linear extension $\pi=(v_1,\dots,v_n)$ of $\prec|_F$. Define the circuit $U_\pi:\mathcal H(\partial_{\mathrm{in}}F)\rightarrow\mathcal H(\partial_{\mathrm{out}}F)\otimes\mathcal H(\mathcal E_F)$ by applying $V_{v_1},\dots,V_{v_n}$ in order, each tensored with the identity on all edge factors not incident to the event being applied. The composition is well typed: in a linear extension, every in-edge of $v_k$ is either an in-boundary edge or was produced by an earlier event, because the source of an in-edge precedes its target.

## G.2 Causal consistency: proofs

### Theorem G.1 (well-definedness and compositionality) [E]

For every finite down-set $F$, all schedules give the same isometry: $U_\pi=U_{\pi'}=:U_F$. Moreover, if $F\subseteq F'$ are down-sets, then $U_{F'}$ factorises as $U_{F'\setminus F}$ applied after $U_F$ on the matching edge factors.

**Proof.** (i) *Incomparable events commute.* If $u,v\in F$ are incomparable under $\prec$, no edge joins them, since an edge would make them comparable. Hence $V_u\otimes\mathrm{id}$ and $V_v\otimes\mathrm{id}$ act on disjoint sets of edge factors and commute.

(ii) *Schedules are connected by admissible swaps.* Any two linear extensions of a finite poset are connected by a sequence of transpositions of adjacent elements that are incomparable in the poset; each intermediate sequence is again a linear extension. This is a standard combinatorial fact.

(iii) Each swap exchanges two commuting operators and leaves the composition unchanged. Hence $U_\pi$ is schedule independent.

Compositionality: a schedule for $F$ followed by a schedule for $F'\setminus F$ is a schedule for $F'$ — $F$ being a down-set of $F'$ guarantees the concatenation respects $\prec$ — and schedule independence does the rest. $U_F$ is an isometry as a composition of isometries. $\square$

Equivalently: regard each $V_v$ as a tensor with one index per incident edge plus the environment index; $U_F$ is the contraction of the resulting tensor network over the internal edges of $F$, and contraction of a fixed finite network is order independent by multilinearity. The operator proof above additionally certifies that every $\prec$-compatible order is a valid contraction schedule.

### Lemma G.2a (down-sets have free inputs) [E]

Every in-boundary edge of a down-set $F$ is an initial edge of the network (it has no source event at all). For suppose $e$ has source $u\notin F$ and target $f\in F$; then $u\prec f$, so $u\in F$ — a contradiction. $\square$

### Corollary G.2 (no-signalling; complete proof of Theorem 1) [E]

Let $A,C\subset V$ with $A\cap J^-(C)=\varnothing$, where $J^-(C)$ is the causal past of $C$ including $C$. Then the state on $\partial_{\mathrm{out}}J^-(C)$ — in particular the reduced output state on the out-edges of $C$ at emission — is independent of the choice of trace-preserving local operations at the events of $A$.

**Proof.** $G:=J^-(C)$ is a down-set containing no event of $A$. By Lemma G.2a all in-boundary edges of $G$ are initial edges, so the state on $\partial_{\mathrm{out}}G$, namely

$$
\rho_{\partial_{\mathrm{out}}G}
=
\mathrm{Tr}_{\mathcal E_G}
\left[
U_G\,\rho_{\mathrm{init}}\,U_G^\dagger
\right],
$$

is a functional of the initial data and of the channels at events of $G$ only. No channel of $A$ appears in it.

It remains to check that this emission-time assignment is consistent with any larger computation: for down-sets $G\subseteq F'$, the marginal on any subset of $\partial_{\mathrm{out}}G$ not consumed within $F'$ computed from $U_{F'}$ equals the one computed from $U_G$, and the marginal on consumed edges is well defined at the stage before consumption. Both follow from Theorem G.1 compositionality together with trace preservation of every channel applied after $G$: tracing the outputs of a trace-preserving map is the same as tracing its inputs. Operationally: any measurement whose causal past excludes $A$ has statistics independent of $A$. $\square$

This upgrades the proof sketch of Theorem 1 to a complete argument and makes explicit exactly where trace preservation is used: not to remove $A$ — $A$ simply never enters the past of $C$ — but to make the stage-wise assignment of marginals consistent.

### Proposition G.3 (adaptive updates remain causal) [E]

Allow each event a quantum instrument $\{V_v^x\}_x$ with classical outcome $x$, where $x$ may control the isometries at events in the causal future of $v$ only, the classical record being carried forward as a decohered subfactor of the out-edges. Averaging over outcomes, each event still implements a single local channel; channels at incomparable events act on disjoint factors and commute; Theorem G.1 and Corollary G.2 hold verbatim at the channel level. Hence syndrome measurement with conditioned recovery — adaptive recurrent settling — cannot break causal consistency, whatever the halting rule. $\square$

### Definition G.4 (settling and decoding latency, well typed)

Let $s$ be a system and $v_1,\dots,v_L$ consecutive events on its worldline, with a logical input accepted at $v_1$. Writing $\rho^{(r)}$ for the memory state after event $v_r$, the decoding latency $L_s(\varepsilon)$ is exactly the quantity of §5.2, now well typed: the label $r$ enumerates worldline events, not an extra time.

Two regimes must be distinguished, which v0.1-0.2 did not:

- **Fixed unrolling**: the model fixes a depth $R_{\mathrm{max}}$ per logical tick; $L_s(\varepsilon)$ is a diagnostic quantity, and the circuit geometry is state independent.
- **Adaptive settling**: an instrument-controlled halting rule ends the segment; the circuit geometry is outcome dependent, but the causal order is not, and causality holds by Proposition G.3.

Either regime is admissible. Statements about proper time as accumulated settling depth (§12.2) must declare which regime they use; the concentration requirement of G.6, Layer 4 applies to both [E].

## G.3 Code and decoder: exact definitions

### Definition G.5 (code)

A **code** on a finite edge set $R$ — typically a subset of a cut in the sense of G.8 — is an isometry $W:\mathcal H_L\rightarrow\mathcal H_R$; the code space is $\mathcal C_R=\mathrm{im}\,W$ and the **logical algebra** is $\mathcal A_L=W\mathcal B(\mathcal H_L)W^\dagger$. When $\mathcal C_R$ is the joint $+1$ eigenspace of commuting projectors $\{S_a\}$, the code is stabiliser-like and §5.3 is recovered. In the Hamiltonian models of §24 the code is not an independent choice: it is the ground space of $H_{\mathrm{code}}$.

### Definition G.6 (decoder, reconstruction error, correctability)

For an access channel $\mathcal N:\mathcal B(\mathcal H_R)\rightarrow\mathcal B(\mathcal H_{R'})$, a **decoder** is a channel $\mathcal D:\mathcal B(\mathcal H_{R'})\rightarrow\mathcal B(\mathcal H_L)$, with reconstruction error

$$
\varepsilon(\mathcal D)
=
1-F_e\!\left(\mathcal D\circ\mathcal N\circ\mathcal W,\ \mathrm{id}_L\right),
\qquad
\mathcal W(\rho)=W\rho W^\dagger,
$$

$F_e$ the entanglement fidelity, and optimal error $\varepsilon_{\mathrm{opt}}=\inf_{\mathcal D}\varepsilon(\mathcal D)$. Exact correctability is characterised by the Knill-Laflamme conditions $PE_i^\dagger E_jP=\lambda_{ij}P$ for the Kraus operators of $\mathcal N$ [56]; the operator-algebra generalisation covers reconstruction of subalgebras, which is what §5.4 implicitly uses. Fuchs-van-de-Graaf-type inequalities make the entanglement-infidelity and diamond-norm formulations equivalent up to square roots [29], so no conclusion in this document depends on which is used [E].

### Definition G.7 (canonical decoder; decoder freedom eliminated) [E]

The **canonical decoder** is the Petz transpose channel of $\mathcal N\circ\mathcal W$ with respect to the maximally mixed code state [53]. By the Barnum-Knill bound, its entanglement fidelity satisfies $F_{\mathrm{Petz}}\ge F_{\mathrm{opt}}^2$, hence

$$
\varepsilon_{\mathrm{Petz}}
\le
2\varepsilon_{\mathrm{opt}}-\varepsilon_{\mathrm{opt}}^2
\le
2\varepsilon_{\mathrm{opt}}
$$

[52]. Fixing the decoder to be the Petz channel therefore costs at most a factor of two in error and removes the decoder as a free functional parameter of the theory. From v0.3 onward, every decoder-dependent quantity in this document — $q_{ij}$ of §7.1, $\epsilon_R(L)$ of §5.4, the reconstruction depth $D_R(O_X)$ of §15.2 — is defined with the canonical decoder unless explicitly stated. This closes one instance of the "too much freedom" failure mode of §23.5.

## G.4 Geometry: exact definitions

### Definition G.8 (cut, cells, coarse-graining)

A **cut** is a maximal antichain $A$ of edges: no two edges of $A$ are causally comparable, and every maximal chain of the network crosses $A$. A **coarse-graining** at $A$ is a partition of the systems whose worldlines cross $A$ into finite, interaction-connected cells $\{S_i\}$; the edge set of cell $R_i$ consists of the memory edges of its systems crossing $A$, together with the message edges of $A$ whose source system lies in $S_i$. Because cells are sets of persistent systems, their identification across successive cuts is canonical, by worldline continuity — no extra matching data are needed.

### Definition G.9 (one-hop recoverability, symmetric by construction, at a stated scale)

Fix a cut $A$, a later cut $A'$, and a test logical qudit of dimension two. For cells $R_i,R_j$ at $A$, the directed transport fidelity $q_{i\to j}$ is the entanglement fidelity of the canonical decoder acting at the descendant cell $R_j'\subset A'$, for the test qudit encoded at $R_i$ (optimised over encodings) and transported by the network dynamics of the causal interval between $A$ and $A'$. Define

$$
q_{ij}
=
\left(q_{i\to j}\,q_{j\to i}\right)^{1/2}
\in(0,1],
\qquad
\ell_{ij}=-\ell_\ast\log q_{ij}
$$

for neighbouring cells, and $d_R$ as the shortest-path metric of Theorem 3. The construction depends on the pair $(A,A')$: reconstruction geometry carries a resolution scale, and the emergent metric is defined on the scaling window over which $d_R$ stabilises. That such a window exists in the vacuum phase is a property to be established, not a definition [P].

### Definition G.10 (emergent geometry of a state)

The **emergent geometry** of $(\mathcal N,\text{dynamics},\rho)$ at cut $A$, coarse-graining $\{S_i\}$, and scale $(A,A')$ is the metric measure space

$$
\left(X_A,\ d_R,\ \mu\right),
\qquad
\mu(R_i)=\sum_{e\in R_i}\log d_e,
$$

with $X_A$ the set of cells and $\mu$ the capacity measure. Every geometric estimator of §7.3-7.4 is a functional of this object. The geometry is state and scale dependent by construction; that is precisely how backreaction enters (§12). Foliation covariance across cuts remains the vacuum-phase property flagged in §7.1 [P].

## G.5 Parameter counting

Counting happens at two levels, and honesty requires both.

**Framework level.** Left unconstrained, the framework's defining data are function valued: a graph rule, a code family, and a decoder family. That is a language, not a theory — the §23.5 failure mode. Phase 0 adopts three constraints that collapse the function-valued freedom:

1. the decoder is canonical (G.7): eliminated as a parameter;
2. the code is the ground space of $H_{\mathrm{code}}$: determined by the dynamics, not chosen independently (G.5);
3. the graph rule is the Hamiltonian or Floquet dynamics of §24: determined by finitely many couplings.

**Minimal model level.** The Floquet model of §24 then carries:

- *discrete structural choices*: local qudit dimension $d$, memory dimension $m$, gauge group $G_{\mathrm{gauge}}$, target degree $z_0$, and the stabiliser generator type — a finite set once $d$ and an interaction radius are fixed;
- *continuous parameters*: $(\Delta,J,g^{-2},\kappa,\mu,\lambda)$ and the step $\tau$, with $\hbar=1$ and $(a,\tau)$ fixing the units of length and time.

The dimensionless continuous parameters are

$$
\left\{
\Delta\tau,\ J\tau,\ g^{-2}\tau,\ \kappa\tau,\ \mu\tau,\ \lambda\tau
\right\}:
$$

**six continuous dimensionless couplings**, plus finitely many discrete choices [E]. For comparison, the Standard Model carries nineteen (twenty-six with massive neutrinos), and classical gravity adds $G$ and $\Lambda$. Kill criterion 14 is thereby made checkable in principle: the model may not grow its parameter set beyond what it is meant to explain.

Two honesty notes. The discrete stabiliser-type choice ranges over a large finite set, and the selection of an infrared fixed point may reintroduce effective parameters; counting is a bookkeeping discipline, not a proof of predictivity. And that six couplings *suffice* for anything physical is not claimed here — it is the [W] of the whole programme, made countable.

## G.6 The continuum limit: an exact procedure

What "taking the continuum limit" means, in four layers plus a zeroth. The procedure itself is a definition [E]. Existence for RCC beyond the free sector is the open problem, and the honest tag for existence is [P].

**Layer 0 (scaling family and criticality).** A continuum candidate is a sequence of models $\{\mathcal N_n,\ \text{dynamics}_n,\ \rho_n\}$ with couplings on a trajectory $\lambda(n)$ and unit rescalings $a_n=a/n$, $\tau_n=\tau/n$; equivalently, a fixed lattice whose correlation length diverges, $\xi_n/a\rightarrow\infty$. Continuum limits of lattice theories live at second-order critical points of the coupling flow; Postulate 6 is hereby made precise — the vacuum trajectory must approach such a fixed point — and by §23.3 the fixed point must additionally have no relevant boost-violating operators [47]. Existence of a boost-protected critical point is the framework's largest single debt [P].

**Layer 1 (kinematic, spatial).** The emergent geometries $(X_{A_n},d_R^{(n)},\mu_n)$ of Definition G.10, rescaled by $\ell_{\ast,n}$ and suitably normalised, converge in the pointed measured Gromov-Hausdorff sense [54] to a smooth Riemannian metric measure space $(\Sigma,g_\Sigma,\mathrm{vol})$ with $d_{\mathrm{eff}}=3$. This is the exact meaning of "space emerges".

**Layer 2 (causal, Lorentzian).** The rescaled influence relation converges to the causal order of a Lorentzian manifold $(M,g)$ admitting $\Sigma$ as a Cauchy slice: beyond some scale, the pair (causal order, reconstruction metric on cuts) is $(\epsilon_n,\delta_n)$-faithfully embeddable in $(M,g)$ with $\epsilon_n,\delta_n\rightarrow0$ — the causal-set faithful-embedding criterion [5, 6], upgraded by the availability of the reconstruction metric. The empirical cone velocity extracted via Theorem 2 must converge to a direction- and species-independent $c$.

**Layer 3 (dynamical, field-theoretic).** For each stable defect species $\alpha$, smeared logical operators $O_\alpha^{(n)}(f)$ are defined by transporting test functions $f$ on $M$ through the embedding of Layer 2, and all $k$-point functions of these operators in $\rho_n$ must converge to the correlation functions of a relativistic quantum field theory on $(M,g)$. Mass renormalisation is part of the trajectory: $\theta_n$ is chosen so that $m_\alpha=\hbar\theta_n/(c^2\tau_n)$ is held fixed, i.e. $\theta_n\sim1/n$.

### Theorem G.4 (the free sector passes) [E]

In the $1+1$-dimensional walk of §9 with $a_n=a/n$, $\tau_n=\tau/n$, $\theta_n=\theta/n$, the discrete evolution converges to the Dirac evolution with mass $m=\hbar\theta/(c^2\tau)$ on smooth initial data; convergence, with explicit rates, is established for Weyl and Dirac automata in one and three dimensions in the quantum-walk literature [10, 55]. Layers 0-3 are therefore simultaneously satisfiable in the free sector. The RCC-specific burden is interaction plus dynamical geometry, not the limit procedure itself.

**Layer 4 (proper-time concentration).** Proper time along a worldline is $\tau_N=\sum_{k\le N}\alpha_k$ (§12.2), a sum over settling efficiencies. For this to define a classical clock in the continuum limit, the accumulated depth must concentrate:

$$
\frac{\mathrm{Var}(\tau_N)}{\langle\tau_N\rangle^2}
\longrightarrow0
$$

along worldlines — a law of large numbers for settling depths. The requirement is necessary [E]: its failure is intrinsic clock decoherence, and state-of-the-art optical-clock stability already bounds the admissible fluctuation amplitude at laboratory scales, connecting this hygiene condition directly to the clock-noise phenomenology of §21.5. Which microscopic conditions guarantee concentration is open [P].

### Phase-0 delivery table

| Deliverable (§25, Phase 0) | Status |
|---|---|
| Exact definitions: event, memory, code, decoder, geometry | Delivered — G.1, G.3, G.4 [E] |
| Proof of causal consistency | Delivered — Theorem G.1, Corollary G.2, Proposition G.3, including the adaptive case [E] |
| Parameter counting | Delivered for the minimal model — six continuous dimensionless couplings plus finite discrete data (G.5) [E] |
| Continuum-limit procedure | Delivered as a definition, free sector verified (G.6, Theorem G.4) [E]; existence beyond the free sector [P] |

---

# Appendix H: Phase 1 — fixed-graph recurrent matter

This appendix delivers Phase 1 of §25 on fixed one- and two-dimensional graphs: the Dirac limit with backgrounds, defect stability, scattering, the recurrence-mass relation, and finite-speed bounds. Results marked *measured* were produced by the companion script `rcc_phase1.py`, distributed with this document; every number below is reproducible from it. Units: $\hbar=a=\tau=1$, so $c=1$ and quasienergies are angles.

## H.1 The model family

- **1D walk.** $U=S\,C(\theta(x))$ with $C(\theta)=e^{-i\theta\sigma_x}$ and $S$ shifting the $\sigma_z$-up component right and the down component left; momentum symbol $U(k)=e^{-ik\sigma_z}e^{-i\theta\sigma_x}$ as in §9. The **symmetrised walk** $U'=C(\theta/2)\,S\,C(\theta/2)$ has the same spectrum (it is similar to $U$) and an exact chiral symmetry $\Gamma=\sigma_y$ with $\Gamma U'\Gamma=U'^\dagger$, which the plain ordering lacks.
- **Backgrounds.** A position-dependent recurrence angle $\theta(x)$ is a scalar mass background $m(x)=\hbar\theta(x)/(c^2\tau)$; a phase $e^{i\alpha_e}$ attached to each shift link is a $U(1)$ frame field in the sense of §10, entering exactly as a lattice gauge potential (cf. electric quantum walks [61]).
- **2D walk.** $U(\mathbf k)=e^{-ik_y\sigma_y}\,e^{-ik_x\sigma_z}\,C(\theta)$, the minimal two-dimensional recurrent protocol.
- **Two interacting walkers.** Two independent 1D walkers with a collision phase $e^{i\varphi}$ applied whenever they coincide — the interacting quantum walk of Ahlbrecht et al. [59]. At fixed total momentum $K$ this reduces to an effective walk in the relative coordinate with a four-dimensional coin, which is diagonalised exactly.

## H.2 Dirac limit, with backgrounds and in two dimensions

**One dimension** [E]. Theorem 5 and Appendix A give the free Dirac limit. With slowly varying $\theta(x)$ the continuum limit is the Dirac equation in a scalar mass background; with link phases it acquires the covariant derivative, gauge covariance being Theorem 6. *Measured*: the full $2N\times2N$ real-space spectrum at $N=256$, $\theta=0.2$ matches the analytic dispersion $\cos\omega=\cos k\cos\theta$ with maximum deviation $8.4\times10^{-15}$.

**Two dimensions — exact dispersion (new in v0.4)** [E]. A direct $SU(2)$ trace computation gives

$$
\cos(\omega\tau)
=
\cos(k_xa)\cos(k_ya)\cos\theta
-
\sin(k_xa)\sin(k_ya)\sin\theta,
$$

*measured* to hold at the $2\times10^{-16}$ level over random $(k_x,k_y,\theta)$. Its expansions:

- **Massless sector.** $\theta=0$ gives $\omega^2=k^2-k_x^2k_y^2/3+O(k^6)$, i.e. with $k_x=k\cos\phi$,

$$
\omega
\approx
k\left[1-\frac{(ka)^2\sin^2(2\phi)}{24}\right]:
$$

a cubic, anisotropic correction, vanishing along the lattice axes and maximal along the diagonals. *Measured*: the coefficient ratio to this prediction is $1.000\pm0.000$ across directions at $ka=0.05$. **The exact massless cone of $1+1$D does not survive in two dimensions.**

- **Massive sector.** To leading orders $\omega^2=\theta^2+k^2+2k_xk_y\theta+\dots$; in diagonal coordinates the effective speeds are $c_\pm^2=1\pm\theta$, a fractional diagonal anisotropy $\approx\theta=mc^2\tau/\hbar$, Planck-suppressed for light species. *Measured*: the anisotropy ratio to prediction is $1.000$.

Protocols with better isotropy exist and converge to the isotropic Dirac equation [9, 55]; residual anisotropy at some order is generic. This makes point 3 of §21.3 concrete: in this model family the quartic and anisotropic coefficients are not free phenomenology — they are computable functions of the protocol [E in-model].

## H.3 Finite-speed bounds: exact cone and exact front speed

**Strict cone** [E]. Each step displaces support by at most one site, so after $n$ steps nothing lies beyond $|x-x_0|=n$. *Measured*: probability outside the cone is $0$ to machine precision over 400 steps.

**Exact maximal group velocity** [E]. From the identity $\sin^2(\omega\tau)=\sin^2(ka)\cos^2\theta+\sin^2\theta$ (§9.4),

$$
v_g^2
=
\frac{u\cos^2\theta}{u\cos^2\theta+\sin^2\theta},
\qquad
u=\sin^2(ka)\in[0,1],
$$

which is monotone in $u$; hence

$$
v_{\max}
=
c\cos\theta
=
c\cos\!\left(\frac{mc^2\tau}{\hbar}\right).
$$

Mass costs cone speed, in closed form: the fraction of each update spent in internal recurrence is unavailable for translation. *Measured*: numerical maximisation gives $0.955336=\cos(0.3)$ to six digits; the tracked wavefront at tail threshold $10^{-3}$ moves at slope $0.958$, the $+0.3\%$ excess being the standard $t^{1/3}$ Airy broadening of a discrete front.

## H.4 Recurrence-mass relation, verified

At $k=0$ the branch phases are $\pm\theta$ per step, so $\omega_0=\theta/\tau=mc^2/\hbar$ exactly (spectral check above). A $k=0$ superposition of the two branches makes internal observables beat at the zitterbewegung frequency $2\omega_0=2mc^2/\hbar$: *measured* $0.40037$ against $0.4$ at $\theta=0.2$. Bookkeeping worth stating once: the single-branch phase period is $T_{\mathrm{rec}}=h/mc^2$ (§9.3, the de Broglie clock); branch superpositions beat at twice that frequency. Both are aspects of the same recurrence [E].

## H.5 Defect stability: the recurrence-angle kink

Take the symmetrised walk with a **domain wall in the recurrence angle**: $\theta(x)=+\theta_0$ on half the ring, $-\theta_0$ on the other half (a kink and an antikink; $N=400$, $\theta_0=0.3$). In the continuum this is the Jackiw-Rebbi mass kink [60], and in walk language it is the topological quantum walk of Kitagawa et al. [57], whose protected wall states have been observed photonically [58].

*Measured*:

- two quasienergy-zero modes, $|\varepsilon|<3\times10^{-15}$, one localised at each wall;
- amplitude localisation length $3.28\,a$ against the continuum prediction $\hbar/mc=a/\theta_0=3.33\,a$;
- bulk gap $0.300=\theta_0$, as it must be;
- **chiral-preserving disorder** $\delta\theta(x)\in[-0.05,0.05]$: the modes stay pinned, $|\varepsilon|<6\times10^{-16}$;
- **chiral-breaking perturbation** (a uniform $\sigma_y$ coin rotation $\delta=0.02$): the modes move to $\varepsilon=\pm0.0191\approx\pm\delta$.

Interpretation. This is the first exact in-model realisation of §8's slogan: the recurrence angle is the order parameter, the defect is its sign wall, and the bound logical excitation is protected — pinned to the symmetric quasienergy — by chiral symmetry plus the winding mismatch [E in-model]. Honesty note: this protection is symmetry-based (SPT-grade). The full §8.2 target — charges immune to *arbitrary* local perturbations — requires genuinely topologically ordered codes in two or more dimensions, and remains a Phase 2/4 deliverable [P].

## H.6 Scattering: single-particle, and interacting composites

**(a) Mass step** [E]. A wavepacket incident on $\theta(x):0.05\rightarrow0.2$ transmits with probability matching the continuum Dirac step formula:

| $k_0$ | $T$ measured | $T$ Dirac |
|---|---|---|
| 0.30 | 0.9063 | 0.9089 |
| 0.45 | 0.9655 | 0.9677 |
| 0.60 | 0.9809 | 0.9830 |

Agreement to $0.3\%$, the residue being $O(k_0a)$ lattice corrections: the walk scatters like a Dirac particle.

**(b) Molecules** [E]. Two walkers ($\theta=0.4$) with collision phase $\varphi$ bind. *Measured* at total momentum $K=0$: for $\varphi=\pi$, a pair of molecule states at $\varepsilon=\pm0.7427$, lying $0.0573$ below the two-particle band edge $2\theta=0.8$, with spread $2.5$ sites; for $\varphi=\pi/2$, deeper and tighter states ($\varepsilon=0.4253$ and $-0.4786$, spread $1.3$).

**(c) The composite cone — Phase 1's key finding** [E in-model]. The molecule's dispersion was measured at $K\in\{0,0.3,0.45,0.6\}$:

$$
\varepsilon_{\mathrm{mol}}(K)
=
\{0.74270,\ 0.79014,\ 0.84556,\ 0.91728\}.
$$

The relativistic form fits with striking precision:

$$
\varepsilon_{\mathrm{mol}}(K)
=
\sqrt{M^2+c^{\ast2}K^2},
\qquad
M=0.7428,
\quad
c^\ast=0.8972,
$$

with maximum residual $1.2\times10^{-4}$ — twenty times better than the best nonrelativistic (quadratic) fit over the same window. The composite defect is a *bona fide* relativistic particle of the lattice, with its own rest quasienergy — the recurrence-mass identification survives interactions in exactly the conjectured sense (§22.2, §24.6) — **but its limiting velocity is renormalised**: $c^\ast\approx0.897\,c$.

Consequences. Cone universality across species is false in this model: free walkers saturate $c\cos\theta$ while their bound states propagate on a strictly smaller cone. What §6.3 requires of the vacuum — one universal causal velocity for all stable excitations — is therefore not inherited from the substrate; it must be *enforced*, presumably by the interacting fixed point of the continuum limit (G.6, Layer 0). Phase 1 thereby converts the Lorentz-universality worry of §23.3 from a generic expectation into an exhibited, quantified phenomenon, and hands Phase 3 its sharpest target [E in-model; the repair mechanism is [P]].

## H.7 Phase-1 delivery table

| Deliverable (§25, Phase 1) | Status |
|---|---|
| Dirac limit | Delivered — $1+1$D with scalar and $U(1)$ backgrounds; exact 2D dispersion with anisotropy coefficients (H.2) [E] |
| Defect stability | Delivered — protected kink mode, protection quantified under disorder and symmetry breaking (H.5) [E]; full topological-order protection remains [P] |
| Scattering | Delivered — Dirac-step agreement to $0.3\%$; molecule formation and binding energies (H.6) [E] |
| Recurrence-mass relation | Verified free and, via rest quasienergy, for composites (H.4, H.6) [E] |
| Finite-speed bounds | Delivered exactly — strict cone, $v_{\max}=c\cos\theta$ (H.3) [E] |

Remainders: particle-antiparticle annihilation; $\ge2$D defects with genuine topological charge; dynamical gauge fields (Phase 4); a cone-universality mechanism (Phase 3, promoted by H.6).

---

# Appendix I: Phase 2 — reconstruction geometry at scale

This appendix delivers Phase 2 of §25: the emergent metric, dimension flow, curvature estimators, and geodesic propagation, plus the Goal-1 static checklist (§22.1), the Goal-4 $\gamma$ probe and attraction probe (§22.4, §13.4), and a first annealing bridge to Phase 3. All results are produced by the companion package `rcc_phase2/` driven by `rcc_phase2_cmds.sh`; every quoted number is the mean over four independent replicas (seeds), computed in fp64.

## I.1 The measured system, and what the numbers can honestly mean

The matter sector is free fermions on a fixed graph: nearest-neighbour hopping $H_{ij}=-A_{ij}$, optionally with a staggered on-site mass $\pm\delta$ that opens a gap. Gaussian ground states are the largest system class in which subsystem entropies, mutual informations, and propagators are *exact* [64], so every geometric quantity below is a controlled measurement rather than a variational estimate. Sizes run to $n=4096$ sites (2D), $n=5832$ (3D).

Geometry is read out at the cell level: the graph is partitioned into BFS cells of $\sim16$ sites, and neighbouring cells $i,j$ get the edge cost of G.9 with the correlational proxy

$$
q_{ij}=\frac{I(i\!:\!j)}{2\min(S_i,S_j)}\in(0,1],
\qquad
\ell_{ij}=-\log q_{ij},
$$

followed by all-pairs shortest paths. Honesty ledger, fixed before the runs and unchanged after them:

- $q_{ij}$ is the mutual-information proxy for Petz recoverability. Its equivalence to the operational $q$ of G.9 is [P]. Every number below carries the implicit tag **[E, in-model, MI-proxy]**.
- The influence cone (I.7) is the *independent dynamical* proxy of Postulate 5; agreement between the two proxies is itself a measurement, not an assumption.
- "Foliation covariance" is tested as partition covariance of $d_R$ in a Hamiltonian ground state; true cut-covariance in the circuit picture remains [P] (G.10).
- The curvature number is the ball-volume proxy of §7.4, not a theorem.
- $\gamma_{\mathrm{proxy}}$ maps onto PPN $\gamma$ only through the strain dictionary of §12-13, which is [P]. What is measured is the in-model ratio §13.4 asks for.

## I.2 Emergent metric, dimension flow, curvature

Two-dimensional lattice vacua, critical ($\delta=0$) and gapped ($\delta=0.8$, staggered), sides $L=32,48,64$:

| $L$ | $d_{\mathrm{eff}}$ (crit / gap) | curvature proxy (crit) | spectral-dimension tail |
|---|---|---|---|
| 32 | 1.995 / 2.005 | $+9.6\times10^{-4}$ | 2.06 |
| 48 | 2.071 / 2.063 | $-1.1\times10^{-4}$ | 2.03 |
| 64 | 2.065 / 2.056 | $-5.0\times10^{-5}$ | 2.02 |

The running dimension $d(r)$ is flat across the fitting window at $2.05\pm0.03$ (no dimensional flow between the cell scale and the system scale, as it should be for a flat vacuum), and the ball-volume curvature proxy decays toward zero with size: the reconstruction geometry of a flat lattice vacuum is flat, in both the volume-growth and heat-kernel senses. The residual $+0.06$ in $d_{\mathrm{eff}}$ is finite-window bias, visible because the gapped and critical values share it.

Three-dimensional lattices, sides $L=10,14,18$ ($n=1000$-$5832$): $d_{\mathrm{eff}}=2.19\to2.92\to3.18$ and spectral-dimension tail $3.77\to3.50\to3.30$. Both estimators are converging toward 3 from opposite sides, but three-dimensional reconstruction is visibly harder: at $n\approx6000$ the window bias is an order of magnitude larger than in 2D at comparable node count. Extracting continuum 3D geometry will need either larger systems or better estimators — a known cost item for Phases 3 and 5.

## I.3 The negative control: an expander is not geometric

The same pipeline applied to random 6-regular graphs ($n=1024, 2304$) returns $d_{\mathrm{eff}}$ fit failures (negative slopes), partition Pearson $\approx0.19$-$0.23$, and curvature proxies $0.4$-$0.8$ — two orders above the lattice values. The diagnostics refuse to see geometry where there is none. This matters: a reconstruction-geometry programme whose estimators returned "dimension $\approx3$" for an expander would be fitting noise. Postulate 5's tooling passes both its positive and negative controls.

## I.4 Partition covariance: the G.9 window test

Rebuilding the metric from an independently seeded partition and correlating the two node-level distance matrices gives, in 2D:

$$
\text{Pearson}=0.960,\ 0.978,\ 0.987,
\qquad
\text{stress}=0.099,\ 0.073,\ 0.055
\qquad
(L=32, 48, 64),
$$

and in 3D Pearson $0.78\to0.88\to0.92$ over $L=10\to18$. The trend is monotone toward covariance in the large-size limit, consistent with the existence of the G.9 scaling window on which $d_R$ stabilises. The promissory note of G.9 is now a measured trend; the limit itself, and cut-covariance in the circuit picture, remain [P].

## I.5 Area law, scoped

Ball-boundary entropy scans give, for the gapped sector, $S/|\partial A|=0.1842,\ 0.1838,\ 0.1837$ nats per boundary link at $L=32,48,64$: a clean, size-stable area law, matching Theorem 9's mechanism. For the critical sector the fitted slope *grows* with size ($0.447\to0.483\to0.508$) with a large compensating logarithmic term: the known Gioev-Klich-Widom multiplicative logarithm of gapless fermions [62, 63], reproduced rather than discovered. Consequence for §15: the area-law statements presume a gapped vacuum sector, and gaplessness of any sector shows up directly as an area-law violation in reconstruction geometry.

## I.6 Shortcut scan: measured, not certified

*(Resolved in v0.6: Appendix J.6 — no wormhole class; the flags decompose into metric-inflation artifacts and the critical MI tail.)*

At $L=32$ the scan is clean (0.2 far pairs per replica above the median nearest-neighbour MI, max far-MI ratio 0.75). But both the count and the ratio grow with size: 3.2 and 7.0 pairs (of 400 sampled), ratios 1.9 and 6.3 (critical) and up to 13.2 (gapped) at $L=48,64$. Two readings are consistent with the data: BFS-partition artifacts (straggly cells misplaced by the cell metric) or genuine metric outliers of the MI proxy. The saved outputs do not retain the offending pairs, so the discrimination — are the high-MI far pairs graph-adjacent? — is a rerun item requiring node-level bookkeeping. Until then the §7.2 no-shortcut condition is *measured but not certified* at the largest sizes. Recorded as a remainder, not smoothed over.

## I.7 Geodesic propagation: the cone in the emergent metric

Single-particle propagator fronts $|G_{j,\mathrm{src}}(t)|^2$, with front radius measured in the *emergent* distance $d_R$ rather than graph hops, eight sources per replica:

| $L$ | $v_{\mathrm{mean}}$ | anisotropy $v_{\mathrm{std}}/v_{\mathrm{mean}}$ |
|---|---|---|
| 32 | 3.537 | 0.038 |
| 48 | 3.384 | 0.031 |
| 64 | 3.311 | 0.019 |

Fronts are linear in $t$ until saturation at the system diameter — ballistic propagation with a well-defined speed *in the reconstructed metric*. The anisotropy falls roughly as $1/L$, and a $1/L$ extrapolation of the speed gives $v_\infty\approx3.1$ (emergent units). This is the promised consistency check of Postulate 5: the correlational metric (MI) and the dynamical metric (influence) agree to within 2% at the largest size, with the residual shrinking. The three-dimensional cone runs are excluded: their fronts saturate at the graph diameter by the second time sample (the time grid outran the small systems), so the fitted speeds are artifacts. Rerun with an earlier, denser grid at $L\ge14$. *(Done in v0.6: Appendix J.5 — the 3D cone is ballistic and isotropizing.)*

## I.8 The $\gamma$ probe: performed, and failed in this realization

The §13.4 test, as specified in §22.4: weaken all hoppings inside a ball of radius $r$ hops by $(1-\varepsilon)$ — a capacity load — and measure two fractional responses in the ground state. The clock proxy $d_\alpha$ is the fractional drop of the local energy scale $\alpha_i=\sqrt{\langle i|H^2|i\rangle}$ inside the ball (the $g_{00}$ side). The spatial proxy $d_\ell$ is the fractional lengthening of emergent distances between anchor pairs whose baseline geodesics cross the ball (the $g_{ij}$ side). The scan: $L\in\{24,32,48\}$, $\varepsilon\in\{0.05,0.1,0.2,0.3\}$, $r\in\{2,3,5\}$, critical and gapped — 72 runs, four replicas each.

Result:

- $d_\alpha=O(\varepsilon)$, linear across the whole range (e.g. $0.14$ at $\varepsilon=0.2$, $r=3$): the clock side responds at first order, as the strain picture requires.
- $d_\ell$ is **two to three orders of magnitude smaller** ($10^{-4}$-$10^{-2}$) and **negative**: emergent distances through the loaded region very slightly *shrink*.
- $\gamma_{\mathrm{proxy}}=d_\ell/d_\alpha\in[-0.08,0]$ over all 72 runs. At the largest size, critical sector: $-0.001$ to $-0.007$; gapped: $-0.02$ to $-0.04$. No trend toward 1 with size (critical trends toward 0), no trend with $\varepsilon$ (pure linear response), no trend with load radius.

The candidate mechanism of §13.4 — one capacity field controlling both responses with equal coefficient — is therefore *not* what this realization does. The static MI metric of a loaded free-fermion vacuum is nearly blind to the load that the clocks see at first order, and what little it sees has the wrong sign (plausibly geodesic rerouting around the degraded region plus MI redistribution, though the saved data cannot fully resolve this).

Three exits, in decreasing order of comfort for the framework, all testable:

1. **The proxy is the failure.** The operational reconstruction cost (Petz transport fidelity, G.9) may respond at $O(\varepsilon)$ where raw mutual information does not. Direct node-level Petz measurement under load is the immediate follow-up.
2. **Staticity is the failure.** In GR the spatial metric response is sourced dynamically; a static ground-state comparison may simply be the wrong observable, and a self-consistent backreacting load (capacity that responds to the state it deforms) is required. This is the Phase 5 route.
3. **The mechanism is the failure.** Scalar-flavoured strain gravity dies exactly here, historically (§13.4). If exits 1 and 2 also fail, criterion 15 fires and the gravitational sector of RCC as currently formulated is dead.

Tagged honestly: the finding is [E, in-model]; which exit is correct is open. What is no longer available is the unexamined hope that $\gamma=1$ comes for free.

## I.9 Two loads attract: the Goal-4 attraction probe

> **Correction (v0.6, Appendix J.4):** the claim of uniform attraction below is an artifact of sampling odd separations only. The exact $O(\varepsilon^2)$ measurement shows a strict parity alternation — repulsive at even, attractive at odd $r$ — with a power-law envelope $|V|\sim r^{-6}$ for gapless mediators. The interaction is RKKY/Casimir-grade, not gravity-grade.

The interaction potential between two capacity loads, $V(r)=E_{12}(r)-E_1-E_2+E_0$ from exact fermionic ground energies (gapped mediator, $\delta\ge0.5$):

- $V(r)<0$ at short range, always: capacity defects **attract** through the matter vacuum, with no sign choice anywhere in the construction.
- Magnitude scales as $\varepsilon^2$ (measured $-1.9\times10^{-6},\ -8.1\times10^{-6},\ -3.8\times10^{-5},\ -9.8\times10^{-5}$ at $\varepsilon=0.05$-$0.3$, $r=3$): a second-order induced interaction, of Casimir/RKKY type.
- Range is exponential with $\xi\lesssim1$ lattice spacing — a Yukawa-like force, as it must be with a gapped mediator.
- Values are independent of system size from $L=24$ up: converged.

This is the correct qualitative skeleton for §12's claim that capacity consumption sources universal attraction — existence and sign are now measured, not asserted. What is missing for gravity is the long-range tail: a $1/r$-type potential requires a gapless mediator, and the critical-matter binding measurement runs into the fp64 energy-difference floor ($\sim10^{-13}$) beyond $r\approx15$. A dedicated high-precision or perturbative treatment is the follow-up. Note the tension with I.8: the *energetic* response to paired loads is robustly present while the *metric* response to a single load is not — whatever gravity is in this framework, its potential side is currently easier to exhibit than its geometric side.

## I.10 Annealing: no spontaneous geometric phase yet

Parallel-tempering Monte Carlo on the graph action of §24.5 (degree term $z_0=6$, triangle reward, sparsity penalty), four temperature rungs, starting from random regular graphs.

- **Without matter** ($n=1024$, $5\times10^4$ steps): the cold rungs anneal into configurations with $d_{\mathrm{eff}}\approx-4.5$ to $-4.9$ and curvature proxy $\approx0.8$ — non-geometric clumps, further from geometry than the random start.
- **With fermionic matter** ($n=576$, $2\times10^4$ steps, one exact diagonalisation per step): the cold rungs reach $d_{\mathrm{eff}}\approx0.16$-$0.98$, curvature proxy $\approx0.2$-$0.3$ — a large move in the geometric direction, to roughly one-dimensional structures, but nowhere near a 2D or 3D phase. Cold-rung acceptance rates of $0.2\%$-$1.5\%$ show the chains freeze long before equilibrium.

Two honest readings. Encouraging: matter backreaction demonstrably pushes graph configurations toward geometry, consistent with the RCC position that geometry and matter must stabilise each other rather than geometry standing alone. Sobering: the §24.5 action, as written, does not have a geometric ground state that this sampler can find, and kill criterion 5 has not yet been *tested*, only approached. Phase 3 needs cluster-grade Monte Carlo moves, longer ladders, and possibly a modified action before the criterion means anything.

## I.11 Phase-2 delivery table

| Deliverable (§25, Phase 2) | Status |
|---|---|
| Emergent metric | Delivered — lattice vacua reconstruct correctly; expander control correctly fails (I.2, I.3) [E, in-model, MI-proxy] |
| Dimension flow | Delivered — 2D: $2.06\pm0.01$, flat plateau; 3D: converging to 3 with strong finite-size bias (I.2) [E, in-model] |
| Curvature estimators | Delivered as proxies — flat-vacuum curvature $\to0$ with size (I.2) [E, in-model] |
| Geodesic propagation | Delivered in 2D — ballistic front in the emergent metric, anisotropy $\sim1/L$ (I.7) [E, in-model]; 3D rerun needed |
| §22.1 static checklist | Covariance trend, area law (gapped), cone isotropy delivered; shortcut certification incomplete (I.4-I.7) |
| §13.4 $\gamma$ probe | **Performed and failed in this realization** — $\gamma_{\mathrm{proxy}}\approx0$, wrong sign (I.8) [E, in-model] |
| Goal-4 attraction | Delivered — universal $\varepsilon^2$ attraction, gapped range (I.9) [E, in-model] |
| Goal-1 annealing bridge | Negative so far — no geometric phase; matter helps; sampler freezes (I.10) [E as finding] |

Remainders: node-level Petz measurements of shortcuts and of $\gamma$ (the proxy-vs-operational discrimination); self-consistent backreacting $\gamma$ probe; gapless-mediator binding tail; 3D cone rerun; cluster-move annealing. The most consequential single item carried forward is the failed $\gamma$ probe: it is now the framework's second exhibited failure, alongside Phase 1's cone-universality failure, and both must be repaired by the same object — a vacuum that *enforces* universality instead of hoping for it. *(All five remainders executed in v0.6: Appendix J.)*

---

# Appendix J: Phase 2.5 — remainder tests

This appendix executes the remainders of Appendix I. Companion code: `petz.py` (dense fermionic states, Petz recovery, canonical-correlation transport), `strain2.py` (multi-proxy and self-consistent $\gamma$, exact second-order binding), upgraded `cone.py` (saturation-bracketing time grids), `geometry.py` (shortcut certification), `anneal.py` (degree-preserving swaps). Every new physics path is validated against an exact reference in `tests/smoke2.py` (dense reduced density matrices agree with Gaussian entropies and correlations at $10^{-7}$; the perturbative binding agrees with exact differencing at $0.2$–$2\%$). Four replicas per point, fp64 throughout.

## J.1 What the two new proxies are

The MI proxy of G.9 was joined by two *operational* recoverability measures.

**Canonical-correlation transport.** For number-conserving Gaussian states the singular values of the cross-correlation block $C_{ij}$ are invariant under local mode rotations on either cell; $q_{\mathrm{can}}=2\sigma_{\max}\in(0,1]$ is the best single-mode correlation transferable between the cells by local Gaussian operations. Scales to $L=64$.

**Exact Petz recovery.** The many-body reduced state $\rho_{ij}$ is built exactly from the Gaussian correlations via the entanglement Hamiltonian [64]; cell $i$ is kicked by a weak parity-even unitary, erased, and Petz-recovered from $j$ with the vacuum prior; $q_{\mathrm{petz}}$ is the Uhlmann fidelity of the recovery, minimised over directions. This is a *redundancy* measure: by monogamy a pure Bell-type pair has $q_{\mathrm{can}}=1$ but low $q_{\mathrm{petz}}$ (a phase kick on one half is invisible to the other). The two are complementary faces of G.9's recoverability, and the discrimination below does not depend on which face is "right."

## J.2 Exit 1 closed: the proxy is not the failure

Static-load $\gamma$ with all three proxies on shared anchor pairs ($L=24,32,48$, critical and gapped, $\varepsilon=0.2$, $r=3$):

| vacuum | $\gamma_{\mathrm{mi}}$ | $\gamma_{\mathrm{can}}$ | $\gamma_{\mathrm{petz}}$ ($L\le32$) |
|---|---|---|---|
| critical | $-0.001$ to $-0.009$ | $-0.008$ to $+0.003$ | $+0.015$ to $+0.024$ |
| gapped | $-0.027$ to $-0.044$ | $+0.032$ to $+0.049$ | $+0.064$ to $+0.075$ |

All three measures agree: $|\gamma_{\mathrm{proxy}}|\le0.08$, two orders below unity, signs scattered around zero. The static free-fermion vacuum genuinely lacks the spatial response — the v0.5 hope that the operational cost responds where raw mutual information does not (I.8, exit 1) is now closed, negative. [E, in-model]

## J.3 Exit 2 tested: backreaction gives an instability, not $\gamma=1$

The first dynamical realization couples capacity to the flux it carries: $w_e = w^{\mathrm{load}}_e(1+\kappa\,\Delta b_e)$, iterated to a fixed point (damped, warm-started along the $\kappa$ ladder, outcomes classified as converged / collapsed / stalled). The measured ladder (critical, $L=24$–$48$):

- $\kappa\lesssim0.5$: iteration stalls while $|\gamma|$ grows through unity ($-0.3$ at $\kappa=0.25$, $-1.4$ at $\kappa=0.5$) with *shrinking* distances — transients, not fixed points;
- $\kappa\gtrsim1$: the fixed point is global capacity collapse — essentially **every** edge of the lattice pins at the minimum weight (e.g. 3455 of 4608 edges at $L=48$), the clock proxy inverts sign, and the $\gamma$ values ($+1.2$ to $+16$, replica spread of the same order) are ratios of meaningless quantities.

Interpretation: amplifying local feedback with no restoring term is a Jeans-type instability. Attraction-like response exists, but there is no stable intermediate regime in which $\gamma$ could settle at 1. This closes exit 2 *as realized*. [E, in-model]

What it does not close: the §24.4 strain term is a **quadratic cost** $\tfrac{\kappa}{2}\sum_e(n_e-c_e)^2$, i.e. precisely the restoring term this map omitted. The designed successor probe is variational — minimise $E_{\mathrm{matter}}(w)+\tfrac{\kappa}{2}\sum_e(w_e-w^{\mathrm{load}}_e)^2$ over weights, which is bounded and always converges — and is the last structural route to $\gamma=1$ in this model class [P]. If it too fails, criterion 15 fires for free-fermion capacity strain.

## J.3b The variational probe: run in v0.7, and failed

The successor probe was executed (`gamma3`; both the baseline and the loaded state are relaxed to converged stationary points of $F$ at the same $\kappa$, warm-started down a $\kappa$ ladder; stationarity residuals $\lesssim10^{-8}$; the $\kappa\to\infty$ limit reproduces the static probe exactly at matched smearing $T=0.02$). Results over $L=24,32,48$, critical and gapped, two seeds:

| regime | outcome |
|---|---|
| $\kappa\in[1,16]$ (stiff capacity; all points converged) | $|\gamma_{\mathrm{mi}}|\le0.05$, $|\gamma_{\mathrm{can}}|\le0.13$, signs scattered about zero — the static blindness persists at genuine backreacted equilibria |
| $\kappa\approx0.5$ (soft capacity, just above collapse; converged points at $L=32,48$) | $\gamma_{\mathrm{mi}}=-1.44$ ($L=32$), $-1.68$ ($L=48$); $d_\ell<0$ throughout — order-unity response of the **wrong sign** |
| $\kappa\lesssim0.3$ | capacity collapse (edges pinned at the floor), as in J.3 |

There is no $\kappa$, in either sector, at any size tested, where the spatial response approaches $+1$ times the clock response. The capacity field interpolates smoothly between "too stiff to see" and "soft enough to see — with inverted sign — then collapse." A $\gamma=+1$ point would require the load to *lengthen* reconstruction distances; in this realization relaxation systematically *shortens* them (the uplifted equilibrium weights overcompensate around the loaded ball).

**Consequence: kill criterion 15 fires for this realization.** The conjunction {free-fermion matter + scalar link-capacity strain + correlational reconstruction metric} cannot reproduce $\Phi=\Psi$ and is excluded as a mechanism for gravity, by the framework's own standard. This is the first formal firing of a kill criterion in the programme; it is scoped to the realization, not the framework, and §13.4 records what any successor must now exhibit. [E, in-model]

## J.3c Successor 1 tested: interacting matter at mean field, closed

The first §13.4 successor requirement — interacting matter whose loaded vacuum lengthens reconstruction distances — was tested in the largest tractable class: self-consistent Hartree-Fock for spinless fermions with nearest-neighbour interaction $V\sum_{\langle ij\rangle}n_in_j$ at half filling (`gamma4`; Anderson-accelerated, chemical potential re-solved each step, residuals $10^{-10}$; $V=0$ reproduces the static probe exactly). The interaction provides exactly the two channels the free theory lacked: the Fock term renormalises bonds by $V\chi_{ij}$, the Hartree term converts density redistribution into potentials.

Results ($L=24,32$, critical bare matter, two seeds, both interaction signs):

| $V$ | outcome |
|---|---|
| $0\to+1.5$ (converged; CDW order $0\to0.38$, as perfect nesting requires) | $\gamma_{\mathrm{mi}}$: $-0.01\to-0.14$ — amplified an order of magnitude, sign unchanged (distances shrink); $\gamma_{\mathrm{can}}$: $+0.1$-$+0.27$ — opposite sign, also far from 1 |
| $-0.25\to-1$ | HF stalls near phase separation; responses small and incoherent; at $V=-1$ even the clock proxy loses its sign |

Mean-field interaction therefore *amplifies the failure* rather than curing it: the new backreaction channels feed the same wrong-sign metric response, and the two operational proxies part ways on sign — neither approaching $+1$. With three independent realizations now failing through the identical symptom (a capacity load *shortens* correlational reconstruction distances), the evidence points at something structural: in fermionic vacua, weakening a region's couplings weakens its correlations with everything, which the $-\log q$ metric reads as the region *contracting*, not lengthening. A realization that inverts this — load lengthens operational distance — plausibly requires geometry read from the code layer itself (stabiliser weights, decoder depth), not from matter correlations. That is the surviving §13.4 route, and it is a Phase-4 object. [E, in-model]

## J.4 The binding tail, and a correction to I.9

The exact $O(\varepsilon^2)$ polarization formula (validated against differencing; $T$-sequence stable at the $10^{-3}$ level from $T=0.02$ down) resolves what energy differencing could not:

- **Correction:** the force is not uniformly attractive. It alternates strictly with parity — repulsive at even, attractive at odd separations ($V(2)=+6.9\times10^{-5}$, $V(3)=-7.6\times10^{-6}$, $V(4)=+1.5\times10^{-6}$, ...): a $2k_F$ commensurate oscillation on the bipartite half-filled lattice. The v0.5 scan sampled odd $r$ only and reported "universal attraction"; the claim ledger is amended (Appendix F).
- Critical mediator: **power-law envelope** $|V|\sim r^{-6.0\pm0.3}$ ($R^2=0.99$ on the even branch; even/odd branches and $L=48/64$ agree; power law beats exponential decisively). Gapped mediator: exponential, $\xi\approx0.65a$, measured cleanly down to $|V|\sim10^{-22}$.
- Values are size-converged at $L=48$.

Consequence: the matter-vacuum-mediated interaction between capacity defects is an RKKY/Casimir-type dispersion force — sign-alternating, $r^{-6}$ — and cannot be the Newtonian sector. If RCC gravity exists it lives in the capacity/strain sector of §12, not in matter exchange. This sharpens Goal 4 rather than merely failing it. [E, in-model]

## J.5 The 3D cone, delivered

With the saturation-bracketing time grid (the fit no longer sees saturated fronts):

| lattice | $v_{\mathrm{mean}}$ | anisotropy |
|---|---|---|
| 3D, $L=14$ | 7.04 | 4.5% |
| 3D, $L=18$ | 6.88 | 3.1% |
| 2D, $L=64$ (rerun) | 3.32 | 1.9% |

The 3D fronts are ballistic in the emergent metric with a well-defined speed, and the anisotropy falls with size — the isotropizing-cone trend of I.7 now holds in three dimensions. The 2D rerun agrees with the fixed-grid v0.5 value to $0.3\%$, cross-validating the method. [E, in-model]

## J.6 Shortcut certification: no wormholes

Node-level certification of every flagged far pair (graph-hop distance between the cells, cell-straggliness radii, hop-versus-metric consistency score $h/2d_R$, which is $\approx1$ when the cell metric is faithful):

- **Metric-inflation artifacts** (score $\le0.75$: graph-close pairs the metric mislabels as far): carry essentially all extreme MI ratios (up to 67), dominate the gapped vacua (58 of 62 flags at $L=48$) — these are poorly-correlated contact edges inflating $d_R$ locally, a cell-partition pathology, not physics.
- **Faithful far pairs** (score $>0.75$): modest ratios (median 1.3–2.1), more numerous at criticality — the fat tail of critical correlations sitting just above the deliberately lenient nearest-neighbour-median threshold. Expected physics, not shortcuts.

No third population exists: nothing is simultaneously metric-far, graph-far, and strongly correlated. The §7.2 no-shortcut condition passes once the flag threshold is scaled to the vacuum's correlation decay, and the I.6 growth-with-$L$ is explained (both populations grow with sample size). Remainder: fixing the cell-metric inflation (better partitions or edge-cost regularisation) is engineering, not physics. [E, in-model]

## J.7 Annealing: the action is the obstruction

With degree-preserving double-edge swaps the cold rungs unfroze (acceptance $0.008$–$0.10$ at low $T$ versus $0.002$ before; replica-exchange acceptance now nonzero) and the sampler found **deeper** minima — at $L=24$ with matter, $E=-491$ versus $-411$ in v0.5 — which are **less geometric**: $d_{\mathrm{eff}}\approx0.0$–$0.24$ at the cold rungs, curvature proxy $\approx0.3$. The pure graph action still clumps ($d_{\mathrm{eff}}<0$).

This inverts the v0.5 diagnosis. The sampler was the suspect; it is now exonerated: the §24.5 action family, as written, has a non-geometric ground state, and matter as an annealed spectator does not fix it. Kill criterion 5 is engaged for this family. Phase 3 therefore begins from action redesign — matter with real backreaction weight, a locality term refreshed against the emergent metric, and taming of the triangle term's clique attractor — with the honest possibility that no local graph action in this class produces geometry. [E, in-model]

## J.8 Phase-2.5 delivery table

| Remainder (I.11) | Status |
|---|---|
| Operational $\gamma$ (Petz + canonical) | Done — all proxies blind; exit 1 closed negative (J.2) [E, in-model] |
| Self-consistent backreaction $\gamma$ | Done — instability, not $\gamma=1$; variational successor designed (J.3) [E / P] |
| Variational backreaction $\gamma$ (v0.7) | **Done — failed; criterion 15 fires for this realization** (J.3b) [E, in-model] |
| Interacting-matter $\gamma$, mean field (v0.8) | **Done — failed; amplifies the wrong-sign response** (J.3c) [E, in-model] |
| Gapless binding tail | Done — parity-alternating, $r^{-6}$ envelope; corrects I.9 (J.4) [E, in-model] |
| 3D cone rerun | Done — ballistic, isotropizing (J.5) [E, in-model] |
| Shortcut certification | Done — no wormhole class (J.6) [E, in-model] |
| Unfrozen annealing | Done — action, not sampler, is the obstruction (J.7) [E, in-model] |

The state of the gravitational sector after Phase 2.5, stated plainly: matter-mediated forces are RKKY-grade and cannot be gravity; static reconstruction metrics do not respond to capacity load under any proxy; naive amplifying backreaction collapses. Everything now rides on whether a *stabilized* capacity field — the actual §24.4 term — deforms clocks and distances with equal coefficient. That is a single, sharply posed, cheap computation, and it is the next thing to run.

---

# Appendix K: Phase 4 opening — the code-layer gamma

Appendix J closed every matter-correlation route to $\gamma=1$ and diagnosed the common failure: weakening a region's couplings weakens its correlations with everything, which any $-\log q$ correlational metric reads as *contraction*. The surviving §13.4 route was strain on the code layer itself. This appendix opens Phase 4 by realizing it in the smallest honest model, and it produces the programme's first positive gravitational result.

## K.1 The model, and why nothing is inserted

The $\mathbb{Z}_2$ (bit-flip) sector of a toric code on an $L\times L$ torus. Edge qubits carry stabiliser couplings $J_e$; thermal noise flips edge $e$ with probability $\mathrm{sig}(-2\beta J_e)$ per step; a *local recurrent decoder* — anyons hop toward the strongest nearby syndrome density, sublattice-alternating — runs continuously, exactly the always-on repair dynamics of Postulate 3. A capacity load weakens $J_e$ inside a ball of radius $r$.

Both sides of $\gamma$ are then measured from the same stochastic steady state, entirely in the *syndrome sector* (the raw error field is gauge-variant: error plus correction accumulates harmless closed loops, driving raw edge occupation to $1/2$ while the syndrome stays sparse — the validation suite caught precisely this):

- **clock** $(g_{00})$: the integrated autocorrelation time $\tau_v$ of the local syndrome field — an emergent settling time, congestion-dressed by the decoder. (Anyon residence time is *not* usable: the decoder relocates defects every other step, making residence constant and load-blind — the second bug the suite caught.)
- **metric** $(g_{ij})$: the G.9 cost $\ell_e=-\log(1-2p_e)$ with $p_e$ the *measured* steady-state anyon exposure of the edge — transporting logical information along a path is degraded by the defects adjacent to it.

The dressing is real, not tautological: the measured density gain under load is $0.35$–$0.93\times$ the bare Boltzmann gain depending on load strength (decoder congestion is nonlinear). Common random numbers make base and loaded runs agree replica-by-replica to three digits. `code_layer.py`, `--exp gamma5`, `tests/smoke3.py`; $L=48$, $M=32$ replicas, $3\times10^4$ measurement steps per point.

## K.2 The sign result

At every parameter tested ($J_0=1.0$–$3.0$, $\varepsilon=0.05$–$0.5$):

$$
d_\alpha>0
\quad\text{and}\quad
d_\ell>0.
$$

A capacity load slows the local clock **and lengthens operational distances** — locally and along geodesics through the ball, with geodesic rerouting (lensing-like avoidance) visible at larger impact parameter. This is the first realization in the programme with the gravitational sign, and the reason is structural, not accidental: degrading repair capacity makes a region genuinely harder to transport logical information through. Correlational metrics could not see this because they measure what the region *knows about its neighbours*, not what it *can carry*. [E, in-model]

## K.3 The magnitude result: $\gamma\to1$ at marginal decoder utilization

The linearized $\gamma$ (density-based metric response over clock response, in the linear-response window $\varepsilon\le0.1$) falls monotonically with the vacuum defect density $\bar n$:

| $J_0$ | vacuum $\bar n$ | $\gamma_{\mathrm{lin}}$ |
|---|---|---|
| 3.0 | 0.024 | 6.9 |
| 2.5 | 0.056 | 2.8 |
| 2.25 | 0.081 | 2.2 |
| 2.0 | 0.112 | 1.73 |
| 1.8 | 0.139 | 1.49 |
| 1.6 | 0.167 | 1.26 |
| 1.4 | 0.196 | 1.13 |
| 1.2 | 0.224 | **1.01** |
| 1.0 | 0.248 | 0.92 |

$\gamma_{\mathrm{lin}}$ **crosses 1 at $\bar n\approx0.22$**. Independently, the homogeneous capacity curve of this decoder saturates at $\bar n_{\max}\approx0.29$, with its knee — the onset of marginal repair utilization — in the $0.20$–$0.25$ range. The crossing sits on the knee.

The mechanism is legible: in a congested repair medium, the settling time is proportional to the defect load, so the clock and the (density-built) metric become *the same field* — the literal content of §13.4's "one capacity field controls both." In the dilute limit the decoder is idle, defects are independent, and the metric outresponds the clock ($\gamma>1$); at saturation the clock outresponds ($\gamma<1$); equality is the marginal point. And the marginal point is where Postulate 6 already places the physical vacuum: at the critical coding threshold. This is the first *structural* — as opposed to tuned — route to $\gamma=1$ the programme has exhibited. [E, in-model, at coincidence-of-scale precision]

## K.4 What this does and does not establish

Does: sign (universal in this realization); magnitude $O(1)$ with no tuning; a candidate selection principle ($\gamma=1$ at the critical coding point) that meshes with an independent postulate.

Does not, yet:

1. **Definition-independence.** The compounded-cost $\gamma_{\mathrm{loc}}$ crosses 1 at a different density than $\gamma_{\mathrm{lin}}$ (the two metrics differ at $O(\bar n)$). At the current precision the selection principle is a coincidence of scales. Sharpening it requires the operational metric (logical failure rates of actual test strings, not exposure proxies) and a decoder-robustness scan — if the crossing tracks the capacity knee across decoders, it is a principle; if not, an accident.
2. **A far field.** The geodesic response dies within a few ball radii: static capacity does not propagate. Newtonian $1/r$ requires the capacity field to be dynamical — a relaxation/field equation for $J_e$ sourced by defect load, which is precisely the §24.4 strain term promoted from penalty to dynamics. That is the Phase 5 object, and it now has a concrete substrate to be built on.
3. **Universality.** One decoder, one code, one noise model. The claim worth testing is that $\gamma=1$-at-criticality is a property of *any* self-correcting phase at marginal utilization.

## K.5 Delivery table

| Item | Status |
|---|---|
| Code-layer realization of §13.4 | Delivered — toric-code CA, syndrome-sector observables (K.1) [E, in-model] |
| Sign of $\gamma$ | **Positive, both responses, everywhere tested** (K.2) [E, in-model] |
| Magnitude of $\gamma$ | $O(1)$ untuned; monotone in vacuum density (K.3) [E, in-model] |
| $\gamma=1$ selection principle | Crossing at marginal decoder utilization $\approx$ capacity knee; meshes with Postulate 6 (K.3) | 
| Remainders | Definition-independence; operational string-failure metric; decoder universality; dynamical capacity (far field) — Phase 5 (K.4) [P] |

---

# References

1. J. S. Bell, “On the Einstein Podolsky Rosen Paradox,” *Physics Physique Fizika* **1**, 195–200 (1964).

2. D. Rauch et al., “Cosmic Bell Test Using Random Measurement Settings from High-Redshift Quasars,” *Physical Review Letters* **121**, 080403 (2018), arXiv:1808.05966.

3. E. H. Lieb and D. W. Robinson, “The Finite Group Velocity of Quantum Spin Systems,” *Communications in Mathematical Physics* **28**, 251–257 (1972).

4. S. Bravyi, M. B. Hastings, and F. Verstraete, “Lieb-Robinson Bounds and the Generation of Correlations and Topological Quantum Order,” *Physical Review Letters* **97**, 050401 (2006), arXiv:quant-ph/0603121.

5. L. Bombelli, J. Lee, D. Meyer, and R. D. Sorkin, “Space-Time as a Causal Set,” *Physical Review Letters* **59**, 521–524 (1987).

6. J. Henson, “The Causal Set Approach to Quantum Gravity,” in *Approaches to Quantum Gravity* (2009), arXiv:gr-qc/0601121.

7. T. Konopka, F. Markopoulou, and S. Severini, “Quantum Graphity: A Model of Emergent Locality,” *Physical Review D* **77**, 104029 (2008), arXiv:0801.0861.

8. M. Van Raamsdonk, “Building Up Spacetime with Quantum Entanglement,” *General Relativity and Gravitation* **42**, 2323–2329 (2010), arXiv:1005.3035.

9. G. M. D'Ariano and P. Perinotti, “Quantum Cellular Automata and Free Quantum Field Theory,” *Frontiers of Physics* **12**, 120301 (2017), arXiv:1608.02004.

10. A. Bisio, G. M. D'Ariano, and A. Tosini, “Quantum Field as a Quantum Cellular Automaton: The Dirac Free Evolution in One Dimension,” *Annals of Physics* **354**, 244–264 (2015), arXiv:1212.2839.

11. T. Jacobson, “Thermodynamics of Spacetime: The Einstein Equation of State,” *Physical Review Letters* **75**, 1260–1263 (1995), arXiv:gr-qc/9504004.

12. T. Jacobson, “Entanglement Equilibrium and the Einstein Equation,” *Physical Review Letters* **116**, 201101 (2016), arXiv:1505.04753.

13. A. Almheiri, X. Dong, and D. Harlow, “Bulk Locality and Quantum Error Correction in AdS/CFT,” *Journal of High Energy Physics* **04**, 163 (2015), arXiv:1411.7041.

14. F. Pastawski, B. Yoshida, D. Harlow, and J. Preskill, “Holographic Quantum Error-Correcting Codes: Toy Models for the Bulk/Boundary Correspondence,” *Journal of High Energy Physics* **06**, 149 (2015), arXiv:1503.06237.

15. H. Casini, D. A. Galante, and R. C. Myers, “Comments on Jacobson's ‘Entanglement Equilibrium and the Einstein Equation’,” *Journal of High Energy Physics* **03**, 194 (2016), arXiv:1601.00528.

16. S. Weinberg and E. Witten, “Limits on Massless Particles,” *Physics Letters B* **96**, 59–62 (1980).

17. H. B. Nielsen and M. Ninomiya, “A No-Go Theorem for Regularizing Chiral Fermions,” *Physics Letters B* **105**, 219–223 (1981).

18. A. M. Gleason, “Measures on the Closed Subspaces of a Hilbert Space,” *Journal of Mathematics and Mechanics* **6**, 885–893 (1957).

19. P. Touboul et al., “MICROSCOPE Mission: Final Results of the Test of the Equivalence Principle,” *Physical Review Letters* **129**, 121102 (2022), arXiv:2209.15487.

20. KATRIN Collaboration, “Direct Neutrino-Mass Measurement Based on 259 Days of KATRIN Data,” *Science* **388**, 180–185 (2025), arXiv:2406.13516.

21. C. Marletto and V. Vedral, “Gravitationally Induced Entanglement between Two Massive Particles Is Sufficient Evidence of Quantum Effects in Gravity,” *Physical Review Letters* **119**, 240402 (2017), arXiv:1707.06036. See also S. Bose et al., *Physical Review Letters* **119**, 240401 (2017).

22. E. Martín-Martínez and T. R. Perche, “What Gravity-Mediated Entanglement Can Really Tell Us about Quantum Gravity,” *Physical Review D* **108**, L101702 (2023), arXiv:2208.09489.

23. DESI Collaboration, “DESI DR2 Results II: Measurements of Baryon Acoustic Oscillations and Cosmological Constraints,” arXiv:2503.14738 (2025).

24. Super-Kamiokande Collaboration, “Search for Proton Decay via $p\rightarrow e^+\eta$ and $p\rightarrow\mu^+\eta$ with a 0.37 Mton-Year Exposure,” arXiv:2409.19633 (2024).

25. V. Vasileiou et al., “Constraints on Lorentz Invariance Violation from Fermi-Large Area Telescope Observations of Gamma-Ray Bursts,” *Physical Review D* **87**, 122001 (2013), arXiv:1305.3463.

26. R. Bousso, “The Holographic Principle,” *Reviews of Modern Physics* **74**, 825–874 (2002), arXiv:hep-th/0203101.

27. J. D. Bekenstein, “Black Holes and Entropy,” *Physical Review D* **7**, 2333–2346 (1973).

28. S. W. Hawking, “Particle Creation by Black Holes,” *Communications in Mathematical Physics* **43**, 199–220 (1975).

29. M. A. Nielsen and I. L. Chuang, *Quantum Computation and Quantum Information*, Cambridge University Press (2000).

30. J. Preskill, “Quantum Shannon Theory,” arXiv:1604.07450 (2016).

31. A. Yu. Kitaev, “Fault-Tolerant Quantum Computation by Anyons,” *Annals of Physics* **303**, 2–30 (2003), arXiv:quant-ph/9707021.

32. M. A. Levin and X.-G. Wen, “String-Net Condensation: A Physical Mechanism for Topological Phases,” *Physical Review B* **71**, 045110 (2005), arXiv:cond-mat/0404617.

33. X.-G. Wen, “Quantum Order from String-Net Condensations and the Origin of Light and Massless Fermions,” *Physical Review D* **68**, 065003 (2003), arXiv:hep-th/0302201.

34. C. Cao, S. M. Carroll, and S. Michalakis, “Space from Hilbert Space: Recovering Geometry from Bulk Entanglement,” *Physical Review D* **95**, 024031 (2017), arXiv:1606.08444.

35. D. A. Meyer, “From Quantum Cellular Automata to Quantum Lattice Gases,” *Journal of Statistical Physics* **85**, 551–574 (1996), arXiv:quant-ph/9604003.

36. D. Rideout and P. Wallden, “Spacelike Distance from Discrete Causal Order,” *Classical and Quantum Gravity* **26**, 155013 (2009), arXiv:0810.1768.

37. D. Harlow and P. Hayden, “Quantum Computation vs. Firewalls,” *Journal of High Energy Physics* **06**, 085 (2013), arXiv:1301.4504.

38. L. Susskind, “Computational Complexity and Black Hole Horizons,” *Fortschritte der Physik* **64**, 24–43 (2016), arXiv:1403.5695.

39. A. Derevianko and M. Pospelov, “Hunting for Topological Dark Matter with Atomic Clocks,” *Nature Physics* **10**, 933–936 (2014), arXiv:1311.1244. See also B. M. Roberts et al., “Search for Domain Wall Dark Matter with Atomic Clocks on Board Global Positioning System Satellites,” *Nature Communications* **8**, 1195 (2017).

40. W. H. Zurek, “Quantum Darwinism,” *Nature Physics* **5**, 181–188 (2009), arXiv:0903.5082. See also W. H. Zurek, *Physical Review Letters* **90**, 120404 (2003) (envariance), and D. Wallace, *The Emergent Multiverse*, Oxford University Press (2012).

41. P. Busch, “Quantum States and Generalized Observables: A Simple Proof of Gleason's Theorem,” *Physical Review Letters* **91**, 120403 (2003), arXiv:quant-ph/9909073.

42. B. Bertotti, L. Iess, and P. Tortora, “A Test of General Relativity Using Radio Links with the Cassini Spacecraft,” *Nature* **425**, 374–376 (2003).

43. L. Masanes, T. D. Galley, and M. P. Müller, “The Measurement Postulates of Quantum Mechanics Are Operationally Redundant,” *Nature Communications* **10**, 1361 (2019), arXiv:1811.11060.

44. P. Tisserand et al. (EROS-2), “Limits on the Macho Content of the Galactic Halo from the EROS-2 Survey of the Magellanic Clouds,” *Astronomy & Astrophysics* **469**, 387–404 (2007), arXiv:astro-ph/0607207.

45. H. Niikura et al., “Microlensing Constraints on Primordial Black Holes with Subaru/HSC Andromeda Observations,” *Nature Astronomy* **3**, 524–534 (2019), arXiv:1701.02151.

46. G. Rosi et al., “Quantum Test of the Equivalence Principle for Atoms in Coherent Superposition of Internal Energy States,” *Nature Communications* **8**, 15529 (2017), arXiv:1704.02296.

47. J. Collins, A. Perez, D. Sudarsky, L. Urrutia, and H. Vucetich, “Lorentz Invariance and Quantum Gravity: An Additional Fine-Tuning Problem?” *Physical Review Letters* **93**, 191301 (2004), arXiv:gr-qc/0403053.

48. M. Zych and Č. Brukner, “Quantum Formulation of the Einstein Equivalence Principle,” *Nature Physics* **14**, 1027–1031 (2018), arXiv:1502.00971.

49. D. Marolf, “Emergent Gravity Requires Kinematic Nonlocality,” *Physical Review Letters* **114**, 031104 (2015), arXiv:1409.2509.

50. J. Wang and Y.-Z. You, “Symmetric Mass Generation,” *Symmetry* **14**, 1475 (2022), arXiv:2204.14271. See also E. Eichten and J. Preskill, *Nuclear Physics B* **268**, 179–208 (1986).

51. M. Gouanère et al., “A Search for the de Broglie Particle Internal Clock by Means of Electron Channeling,” *Foundations of Physics* **38**, 659–664 (2008). Disputed and unreplicated; cited as a curiosity.

52. H. Barnum and E. Knill, “Reversing Quantum Dynamics with Near-Optimal Quantum and Classical Fidelity,” *Journal of Mathematical Physics* **43**, 2097–2106 (2002), arXiv:quant-ph/0004088.

53. D. Petz, “Sufficient Subalgebras and the Relative Entropy of States of a von Neumann Algebra,” *Communications in Mathematical Physics* **105**, 123–131 (1986).

54. D. Burago, Y. Burago, and S. Ivanov, *A Course in Metric Geometry*, Graduate Studies in Mathematics **33**, American Mathematical Society (2001).

55. P. Arrighi, V. Nesme, and M. Forets, “The Dirac Equation as a Quantum Walk: Higher Dimensions, Observational Convergence,” *Journal of Physics A* **47**, 465302 (2014), arXiv:1307.3524.

56. E. Knill and R. Laflamme, “Theory of Quantum Error-Correcting Codes,” *Physical Review A* **55**, 900–911 (1997), arXiv:quant-ph/9604034.

57. T. Kitagawa, M. S. Rudner, E. Berg, and E. Demler, “Exploring Topological Phases with Quantum Walks,” *Physical Review A* **82**, 033429 (2010), arXiv:1003.1729.

58. T. Kitagawa et al., “Observation of Topologically Protected Bound States in Photonic Quantum Walks,” *Nature Communications* **3**, 882 (2012), arXiv:1105.5334.

59. A. Ahlbrecht, A. Alberti, D. Meschede, V. B. Scholz, A. H. Werner, and R. F. Werner, “Molecular Binding in Interacting Quantum Walks,” *New Journal of Physics* **14**, 073050 (2012), arXiv:1105.1051.

60. R. Jackiw and C. Rebbi, “Solitons with Fermion Number 1/2,” *Physical Review D* **13**, 3398–3409 (1976).

61. C. Cedzich, T. Rybár, A. H. Werner, A. Alberti, M. Genske, and R. F. Werner, “Propagation of Quantum Walks in Electric Fields,” *Physical Review Letters* **111**, 160601 (2013), arXiv:1302.2081.

62. D. Gioev and I. Klich, “Entanglement Entropy of Fermions in Any Dimension and the Widom Conjecture,” *Physical Review Letters* **96**, 100503 (2006), arXiv:quant-ph/0504151.

63. M. M. Wolf, “Violation of the Entropic Area Law for Fermions,” *Physical Review Letters* **96**, 010404 (2006), arXiv:quant-ph/0507188.

64. I. Peschel, “Calculation of Reduced Density Matrices from Correlation Functions,” *Journal of Physics A* **36**, L205 (2003), arXiv:cond-mat/0212631.
