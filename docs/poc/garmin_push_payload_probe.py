"""Offline design-only Garmin Push sample-size probe; no API, tokens, DB or production writes.
Run: python3 docs/poc/garmin_push_payload_probe.py
"""
import json
import sys
import time
import tracemalloc

COUNT = 12561
def fixture(n=COUNT):
    return {"activityDetails": [{
        "userId": "synthetic-user",
        "summaryId": "synthetic-20261108",
        "activityId": "synthetic-id",
        "summary": {
            "activityType": "RUNNING", "startTimeInSeconds": 1794090000,
            "distanceInMeters": 42397.15, "activityName": "SYNTHETIC"
        },
        "samples": [{
            "startTimeInSeconds": 1794090000 + i,
            "totalDistanceInMeters": 42397.15 * i / (n - 1),
            "latitudeInDegree": 36.4 + i / 100000,
            "longitudeInDegree": 139.1 + i / 100000,
            "heartRate": 150 + i % 15,
            "stepsPerMinute": 88 + i % 6,
            "powerInWatts": 320 + i % 40,
            "speedMetersPerSecond": 3.3,
            "elevationInMeters": 110.0
        } for i in range(n)]
    }]}

def probe():
    tracemalloc.start()
    start = time.perf_counter()
    body = json.dumps(fixture(), separators=(',', ':')).encode()
    build_seconds = time.perf_counter() - start
    peak = tracemalloc.get_traced_memory()[1]
    tracemalloc.stop()
    parsed = json.loads(body)
    assert len(parsed["activityDetails"][0]["samples"]) == COUNT
    result = {"fixture":"synthetic, not live Garmin Push",
              "sample_count":COUNT,"json_bytes":len(body),
              "above_current_8mb_guard":len(body)>8000000,
              "build_seconds":round(build_seconds,3),
              "python_tracemalloc_peak_bytes":peak,
              "caveat":"local Python allocation peak, NOT Supabase Deno runtime"}
    print(json.dumps(result,indent=2))
    return result

if __name__ == "__main__":
    probe()
