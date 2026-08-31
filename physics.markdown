---
title: "Physics"
subtitle: "A speculative framework with designated falsifiable branches, for emergent spacetime, matter, gravity, and quantum measurement"
version: "0.4"
date: "2026-07-26"
status: "Research programme, not an established physical theory"
layout: page
permalink: /physics
---

# The Recurrent Causal Code

A semi-serious attempt at a weird theory of everything. *Very semi-serious.* **Very.**

This serves as the basis for my upcoming sci-fi novel, *The Recovery Horizon*, and for more to come. Do not take it as actual research. I am mostly using AI to come up with a weird theory that could still describe our real world coherently, including the Standard Model and general relativity.

<a href="../assets/physic/rcc_phase1.py" target="_blank" rel="noopener">RCC Phase 1 python sims</a>
<a href="../assets/physic/rcc_phase2.zip" target="_blank" rel="noopener">RCC Phase 2 python sims</a>
<a href="../assets/physic/rcc_phase2_cmds.sh" target="_blank" rel="noopener">RCC Phase 2 launch commands</a>

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
36. [References](#references)  

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

## Phase 2: reconstruction geometry

Make link capacity state dependent.

Deliverables:

- emergent metric,
- dimension flow,
- curvature estimators,
- and geodesic propagation.

## Phase 3: dynamical graph vacuum

Allow graph rewiring.

Deliverables:

- spontaneous low-dimensional locality,
- stable Lorentz-like cone,
- suppression of preferred-frame operators,
- and phase diagram.

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

5. **No dynamical graph phase produces stable $3+1$-dimensional locality.**

6. **The area coefficient cannot be related to $G$ without inserting it by hand.**

7. **The model cannot recover nonlinear general relativity or produces excluded post-Newtonian parameters.**

8. **The dark sector cannot fit the CMB and large-scale structure simultaneously.**

9. **The cosmological sector becomes an arbitrary function-fitting device.**

10. **The Born rule must simply be postulated with no deeper justification.**

11. **A confirmed proton-decay event occurs, if exact baryon topology is retained.**

12. **A confirmed light-Majorana neutrinoless double-beta signal occurs, if exact lepton topology is retained.**

13. **A sufficiently clean gravity-mediated-entanglement experiment contradicts the predicted quantum-substrate behaviour.**

14. **The complete model requires more arbitrary parameters than the theories it is meant to explain.**

15. **The microscopic model produces $\Phi\neq\Psi$, that is PPN $\gamma\neq1$, above the $10^{-5}$ level without a protective mechanism.**

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
