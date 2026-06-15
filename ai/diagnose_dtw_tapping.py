"""Read-only diagnostic for the tapping guide (730 frames), mirroring
diagnose_dtw_1cycle.py.

Measures compute_dtw_similarity() (imported from hand_tracking, unmodified
here) on:
  (a) tapping self window (should score high)
  (b) full_fist window, rescaled (different motion, should score low)
  (c) random coordinates (unrelated, should score lowest)
  (d) static held GRIP pose from full_fist, rescaled (completely wrong
      static pose - should score low)
  (e) static held OPEN/rest pose from tapping itself (idle, not tapping -
      should score low)

Also reports, for the tapping-self case, what MAX_DTW_DIST would need to be
for similarity to land at 85/88/90%, via T_new = self_avg / (1 - target/100).

Not part of the app; run manually and discard.
"""
import json
import os

import numpy as np

from landmark_utils import compute_guide_scale, palm_scale, _MIN_SCALE
from hand_tracking import (
    compute_dtw_similarity, _dtw_avg_dist,
    MAX_DTW_DIST, WINDOW_STRETCH, WINDOW_STRIDE,
)

BASE = os.path.dirname(__file__)


def rescale_to_guide(coords_seq, guide_scale):
    out = np.empty_like(coords_seq)
    for i, frame in enumerate(coords_seq):
        s = max(float(palm_scale(frame)), _MIN_SCALE)
        out[i] = frame * (guide_scale / s)
    return out


def best_window_stats(seq1, guide_np):
    m = len(seq1)
    n_total = len(guide_np)
    window_len = min(n_total, m * WINDOW_STRETCH)
    if window_len >= n_total:
        starts = [0]
    else:
        starts = list(range(0, n_total - window_len + 1, WINDOW_STRIDE))
        if starts[-1] != n_total - window_len:
            starts.append(n_total - window_len)

    best = None
    for s in starts:
        avg = _dtw_avg_dist(seq1, guide_np[s:s + window_len])
        if best is None or avg < best[0]:
            best = (avg, s)
    return best[0], best[1], window_len, len(starts)


def main():
    with open(os.path.join(BASE, "guide_data", "tapping.json")) as f:
        tapping_np = np.array(json.load(f), dtype=np.float32)
    with open(os.path.join(BASE, "guide_data", "full_fist.json")) as f:
        full_fist_np = np.array(json.load(f), dtype=np.float32)

    guide_scale = compute_guide_scale(tapping_np)
    n_total = tapping_np.shape[0]
    window_len = min(n_total, 30 * WINDOW_STRETCH)
    print(f"guide (tapping): {n_total} frames, guide_scale={guide_scale:.6f}")
    print(f"full_fist: {full_fist_np.shape[0]} frames")
    print(f"MAX_DTW_DIST = {MAX_DTW_DIST}, WINDOW_STRETCH = {WINDOW_STRETCH}, WINDOW_STRIDE = {WINDOW_STRIDE}")
    print(f"window_len for m=30: {window_len} ({window_len / n_total * 100:.1f}% of guide)\n")

    cases = {}

    # (a) tapping self window (mid-sequence)
    cases["(a) tapping self (frames 350-380)"] = tapping_np[350:380]

    # (b) full_fist window, rescaled into tapping's coordinate space
    ff_window = full_fist_np[20:50]
    cases["(b) full_fist (frames 20-50), rescaled"] = rescale_to_guide(ff_window, guide_scale)

    # (c) random coordinates, same magnitude range as tapping guide
    rng = np.random.default_rng(42)
    lo, hi = tapping_np.min(), tapping_np.max()
    random_seq = rng.uniform(lo, hi, size=(30, 21, 3)).astype(np.float32)
    cases["(c) random coords (uniform in tapping range)"] = random_seq

    # (d) static held GRIP pose from full_fist (frame 60), rescaled, repeated 30x
    grip_frame = rescale_to_guide(full_fist_np[60:61], guide_scale)[0]
    cases["(d) static GRIP pose (full_fist frame 60 x30, rescaled)"] = np.tile(grip_frame, (30, 1, 1))

    # (e) static held OPEN/rest pose from tapping itself (frame 0), rescaled, repeated 30x
    open_frame = rescale_to_guide(tapping_np[0:1], guide_scale)[0]
    cases["(e) static OPEN/rest pose (tapping frame 0 x30, rescaled)"] = np.tile(open_frame, (30, 1, 1))

    self_avg = None
    for label, patient_buf in cases.items():
        seq1 = np.array(patient_buf, dtype=np.float32)
        sim = compute_dtw_similarity(list(patient_buf), tapping_np)
        avg, start, win_len, n_starts = best_window_stats(seq1, tapping_np)
        m, n = len(seq1), win_len
        print(f"{label}")
        print(f"  similarity        = {sim:.2f}%")
        print(f"  best window       = start={start}, len={win_len} (m={m}, n={n}), "
              f"{n_starts} candidates searched")
        print(f"  dtw[m,n]/(m+n)    = {avg:.5f}")
        print(f"  (similarity hits 0 when avg >= MAX_DTW_DIST = {MAX_DTW_DIST})")
        print()
        if label.startswith("(a)"):
            self_avg = avg

    print(f"tapping self avg_dist = {self_avg:.5f}")
    print("MAX_DTW_DIST needed for self similarity = target%  (T = self_avg / (1 - target/100)):")
    for target in (85, 88, 90):
        t_new = self_avg / (1 - target / 100)
        print(f"  target {target}% -> T = {t_new:.5f}")


if __name__ == "__main__":
    main()
