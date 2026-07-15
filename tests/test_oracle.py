import sys
import os
import unittest
import numpy as np
import pandas as pd

sys.path.append(r"c:\Users\rohan\.gemini\antigravity\brain\c9f20356-a72d-45a9-8745-88d6e818e1f6\scratch")
import engine_core

class TestOracle(unittest.TestCase):
    def test_nested_anova(self):
        engine_core.sheet_data = {
            "type": "Grouped",
            "columnGroups": [
                {"id": "G1", "name": "Treatment A"},
                {"id": "G2", "name": "Treatment B"}
            ],
            "data": [
                {"rowTitle": "Sub1", "G1_1": 1.1, "G1_2": 1.2, "G1_3": 1.3, "G2_1": 2.1, "G2_2": 2.2, "G2_3": 2.3},
                {"rowTitle": "Sub2", "G1_1": 1.2, "G1_2": 1.4, "G1_3": 1.1, "G2_1": 2.4, "G2_2": 2.5, "G2_3": 2.1},
                {"rowTitle": "Sub3", "G1_1": 1.5, "G1_2": 1.6, "G1_3": 1.4, "G2_1": 2.8, "G2_2": 2.7, "G2_3": 2.6}
            ],
            "config": {"replicates": 3}
        }
        engine_core.options = {
            "testId": "Nested t-test / ANOVA",
            "postHocFamily": "none"
        }
        
        try:
            res = engine_core.run()
            print("Full result:", res)
        except Exception as e:
            print("Exception:", e)

if __name__ == '__main__':
    unittest.main()
