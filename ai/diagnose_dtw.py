"""Read-only diagnostic for DTW similarity discriminability.

Measures compute_dtw_similarity() (imported from hand_tracking, unmodified
here) on three patient_buf scenarios against the full_fist guide:
  (a) full_fist's own consecutive 30 frames (should score high)
  (b) tapping's consecutive 30 frames, rescaled (different motion, should score low)
  (c) random coordinates (unrelated, should score lowest)

Also reports the best-matching window's dtw[m,n] / (m+n) (avg distance) and
its start position, to assess MAX_DTW_DIST calibration against the new
windowed search.

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
    """coords (N,21,3) wrist-relative -> rescaled per-frame to guide_scale,
    same ratio formula as normalize_to_guide_scale (computation only)."""
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
    with open(os.path.join(BASE, "guide_data", "full_fist.json")) as f:
        guide_np = np.array(json.load(f), dtype=np.float32)
    with open(os.path.join(BASE, "guide_data", "tapping.json")) as f:
        tapping_np = np.array(json.load(f), dtype=np.float32)

    guide_scale = compute_guide_scale(guide_np)
    print(f"guide (full_fist): {guide_np.shape[0]} frames, guide_scale={guide_scale:.6f}")
    print(f"tapping: {tapping_np.shape[0]} frames")
    print(f"MAX_DTW_DIST = {MAX_DTW_DIST}, WINDOW_STRETCH = {WINDOW_STRETCH}, WINDOW_STRIDE = {WINDOW_STRIDE}\n")

    cases = {}

    # (a) full_fist's own consecutive 30 frames (mid-sequence window)
    k = 100
    cases["(a) full_fist self (frames %d-%d)" % (k, k+30)] = guide_np[k:k+30]

    # (b) tapping's consecutive 30 frames, rescaled into guide's coordinate space
    k2 = 100
    tap_window = tapping_np[k2:k2+30]
    cases["(b) tapping (frames %d-%d), rescaled" % (k2, k2+30)] = rescale_to_guide(tap_window, guide_scale)

    # (c) random coordinates, same magnitude range as guide data
    rng = np.random.default_rng(42)
    lo, hi = guide_np.min(), guide_np.max()
    random_seq = rng.uniform(lo, hi, size=(30, 21, 3)).astype(np.float32)
    cases["(c) random coords (uniform in guide range)"] = random_seq

    for label, patient_buf in cases.items():
        seq1 = np.array(patient_buf, dtype=np.float32)
        sim = compute_dtw_similarity(list(patient_buf), guide_np)
        avg, start, window_len, n_starts = best_window_stats(seq1, guide_np)
        m, n = len(seq1), window_len
        print(f"{label}")
        print(f"  similarity        = {sim:.2f}%")
        print(f"  best window       = start={start}, len={window_len} (m={m}, n={n}), "
              f"{n_starts} candidates searched")
        print(f"  dtw[m,n]/(m+n)    = {avg:.5f}")
        print(f"  (similarity hits 0 when avg >= MAX_DTW_DIST = {MAX_DTW_DIST})")
        print()


if __name__ == "__main__":
    main()
