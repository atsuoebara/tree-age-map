"""Reproducible synthetic-only tests. Execute: python3 -m unittest discover -s docs/poc -p 'test_garmin_race_poc_v02.py' -v"""
import math
import unittest
from garmin_race_poc_v02 import compute

def pt(d, t, hr=150, cadence=85, power=300):
    return {"d": float(d), "time": float(t), "hr": hr, "cadence_raw": cadence, "power": power, "elevation": None}

class Tests(unittest.TestCase):
    def test_one_km_exact(self):
        o = compute([pt(0, 0), pt(500, 150), pt(1000, 300)])
        self.assertEqual(len(o["segments"]), 1)
        self.assertAlmostEqual(o["segments"][0]["clock_elapsed_s"], 300)
        self.assertAlmostEqual(o["segments"][0]["pace_s_per_km"], 300)

    def test_interpolation_and_partial(self):
        o = compute([pt(0, 0), pt(750, 300), pt(1250, 500)])
        self.assertEqual(len(o["segments"]), 2)
        self.assertAlmostEqual(o["segments"][0]["clock_elapsed_s"], 400)
        self.assertAlmostEqual(o["segments"][1]["clock_elapsed_s"], 100)
        self.assertEqual(o["segments"][1]["distance_m"], 250)
        self.assertIn("partial_segment", o["segments"][1]["quality_flags"])

    def test_missing_sensor_is_not_zero(self):
        o = compute([pt(0, 0, hr=None, power=None), pt(1000, 250, hr=None, power=None)])
        self.assertIsNone(o["segments"][0]["mean_hr_bpm"])
        self.assertIsNone(o["segments"][0]["mean_power_w"])
        self.assertIn("sensor_missing", o["segments"][0]["quality_flags"])

    def test_out_of_order_is_discarded(self):
        o = compute([pt(0, 0), pt(200, 50), pt(100, 60), pt(1000, 250)])
        self.assertEqual(o["samples_excluded"], 1)
        self.assertIn("nonmonotonic_samples", o["global_quality_flags"])

    def test_duplicate_distance_is_discarded(self):
        o = compute([pt(0, 0), pt(500, 100), pt(500, 120), pt(1000, 240)])
        self.assertEqual(o["samples_excluded"], 1)
        self.assertIn("plateau_or_equal_time", o["global_quality_flags"])

    def test_too_few_samples_rejected(self):
        with self.assertRaises(ValueError):
            compute([pt(0, 0)])

    def test_synthetic_marathon_conservation(self):
        points = [pt(i * 42397.15 / 12560, i * 12518 / 12560) for i in range(12561)]
        o = compute(points)
        self.assertEqual(len(o["segments"]), math.ceil(o["total_distance_m"] / 1000))
        self.assertAlmostEqual(sum(s["distance_m"] for s in o["segments"]), o["total_distance_m"], places=1)
        self.assertAlmostEqual(sum(s["clock_elapsed_s"] for s in o["segments"]), o["total_clock_elapsed_s"], places=1)

if __name__ == "__main__":
    unittest.main(verbosity=2)
