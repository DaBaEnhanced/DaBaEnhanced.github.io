#!/usr/bin/env bash
set -e
cd rcc_phase2

# ── 1. STRAIN: the γ scan (run this first — it's the potential §13.4 kill result)
# critical matter (delta 0, pattern none) vs gapped (delta 0.8, stagger)
for side in 24 32 48; do
  for eps in 0.05 0.1 0.2 0.3; do
    for lr in 2 3 5; do
      python run.py --exp strain --devices 6 --graph lat2d \
        --side $side --eps $eps --load_r $lr --cell 4 \
        --delta 0.0 --pattern none \
        --out out/strain_L${side}_e${eps}_r${lr}_crit
      python run.py --exp strain --devices 6 --graph lat2d \
        --side $side --eps $eps --load_r $lr --cell 4 \
        --delta 0.8 --pattern stagger \
        --out out/strain_L${side}_e${eps}_r${lr}_gap
    done
  done
done

# ── 2. METRIC: dimension flow, curvature, covariance, shortcuts, area law
for side in 32 48 64; do            # 2D: 1024–4096 nodes
  for pat in "none 0.0" "stagger 0.8"; do
    set -- $pat
    python run.py --exp metric --devices 6 --graph lat2d --side $side \
      --cell 4 --pattern $1 --delta $2 --out out/metric_2d_L${side}_$1
  done
done
for side in 10 14 18; do            # 3D: side^3 = 1000–5832 nodes
  python run.py --exp metric --devices 6 --graph lat3d --side $side \
    --cell 4 --pattern none --delta 0.0 --out out/metric_3d_L${side}
done
for side in 32 48; do               # random regular control: side^2 nodes
  for pat in "none 0.0" "random 0.8"; do
    set -- $pat
    python run.py --exp metric --devices 6 --graph randreg --side $side --z 6 \
      --cell 4 --pattern $1 --delta $2 --out out/metric_rr_L${side}_$1
  done
done

# ── 3. CONE: geodesic propagation; t_max must scale with system size
for side in 32 48 64; do
  python run.py --exp cone --devices 6 --graph lat2d --side $side \
    --cell 4 --n_sources 8 --n_t 32 --t_max $side \
    --out out/cone_2d_L${side}
done
for side in 10 14; do
  python run.py --exp cone --devices 6 --graph lat3d --side $side \
    --cell 4 --n_sources 8 --n_t 32 --t_max $((3*side)) \
    --out out/cone_3d_L${side}
done

# ── 4. ANNEAL: 6 ranks = one 6-rung parallel-tempering ladder per launch
# pure graph dynamics (fast, larger):
python run.py --exp anneal --devices 6 --side 32 --z 6 \
  --steps 50000 --tri 0.1 --lam 0.05 --out out/anneal_nomatter
# with fermionic matter (one eigh per MC step; keep n = side^2 ≤ ~1024):
python run.py --exp anneal --devices 6 --side 24 --z 6 --matter \
  --delta 0.5 --steps 20000 --tri 0.1 --lam 0.05 --cell 4 \
  --out out/anneal_matter


#When it's done, everything I need for the v0.5 analysis is out/**/*_results.json plus the anneal JSONL logs — the checkpoints (ckpt_rank*.pt) are only needed if a run looks strange and we want to inspect the final graphs.