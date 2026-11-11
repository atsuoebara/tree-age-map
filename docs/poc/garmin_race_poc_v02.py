"""Offline Garmin race interval proof of concept. No network, DB, Garmin access or writes.

Input format: list of dictionaries with d (cumulative meters), time (UNIX seconds),
hr, cadence_raw, power, elevation. TCX extraction is deliberately optional and local.
The raw TCX is private and is NOT committed to this repository.
"""
import bisect
import math

FIELDS = ("hr", "cadence_raw", "power")

def lerp(a, b, t):
    return a + (b - a) * t

def compute(points):
    clean = []
    flags = set()
    dropped = 0
    for p in points:
        if p.get("d") is None or p.get("time") is None or not all(
            math.isfinite(v) for v in (p["d"], p["time"])
        ):
            dropped += 1
            continue
        if clean and (p["d"] < clean[-1]["d"] or p["time"] < clean[-1]["time"]):
            flags.add("nonmonotonic_samples")
            dropped += 1
            continue
        if clean and (p["d"] == clean[-1]["d"] or p["time"] == clean[-1]["time"]):
            flags.add("plateau_or_equal_time")
            dropped += 1
            continue
        clean.append(p)
    if len(clean) < 2:
        raise ValueError("insufficient valid data")
    base, end = clean[0]["d"], clean[-1]["d"]
    edges = [base]
    while edges[-1] + 1000 < end:
        edges.append(edges[-1] + 1000)
    edges.append(end)
    distances = [p["d"] for p in clean]
    def time_at(d):
        j = bisect.bisect_left(distances, d)
        if j == 0:
            return clean[0]["time"]
        if j >= len(clean):
            return clean[-1]["time"]
        l, r = clean[j - 1], clean[j]
        return lerp(l["time"], r["time"], (d - l["d"]) / (r["d"] - l["d"]))

    segments = []
    for i, (lo, hi) in enumerate(zip(edges, edges[1:])):
        readings = {k: [] for k in FIELDS}
        weights = {k: [] for k in FIELDS}
        for l, r in zip(clean, clean[1:]):
            o0, o1 = max(lo, l["d"]), min(hi, r["d"])
            if o1 <= o0:
                continue
            for k in FIELDS:
                a, b = l.get(k), r.get(k)
                if a is not None and b is not None and all(math.isfinite(v) for v in (a, b)):
                    frac0 = (o0 - l["d"]) / (r["d"] - l["d"])
                    frac1 = (o1 - l["d"]) / (r["d"] - l["d"])
                    readings[k].append(
                        (lerp(a, b, frac0) + lerp(a, b, frac1)) / 2 * (o1 - o0)
                    )
                    weights[k].append(o1 - o0)
        vals = {
            k: round(sum(readings[k]) / sum(weights[k]), 2) if sum(weights[k]) else None
            for k in FIELDS
        }
        dur = time_at(hi) - time_at(lo)
        fs = []
        if any(v is None for v in vals.values()):
            fs.append("sensor_missing")
        if hi - lo < 1000:
            fs.append("partial_segment")
        segments.append({
            "segment_index": i + 1,
            "start_m": round(lo - base, 2),
            "end_m": round(hi - base, 2),
            "distance_m": round(hi - lo, 2),
            "clock_elapsed_s": round(dur, 3),
            "pace_s_per_km": round(dur * 1000 / (hi - lo), 2),
            "mean_hr_bpm": vals["hr"],
            "mean_cadence_raw_tcx_spm": vals["cadence_raw"],
            "mean_power_w": vals["power"],
            "quality_flags": fs,
        })
    return {
        "schema_version": "poc-v0.2",
        "input": "TCX-derived or synthetic samples; never Garmin Push proof",
        "cadence_unit": "raw TCX RunCadence; no doubling assumed",
        "time_basis": "clock_elapsed_seconds; not moving/timer time",
        "method": "distance/time interpolation; distance-weighted sensor average",
        "samples_total": len(points),
        "samples_accepted": len(clean),
        "samples_excluded": dropped,
        "total_distance_m": round(end - base, 2),
        "total_clock_elapsed_s": round(clean[-1]["time"] - clean[0]["time"], 3),
        "global_quality_flags": sorted(flags),
        "segments": segments,
    }
