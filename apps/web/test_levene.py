import numpy as np
from scipy import stats
import traceback

def test():
    # Test 1: normal arrays
    g1 = [1, 2, 3, 4, 5]
    g2 = [1, 2, 3, 4, 5]
    print("Test 1:", stats.levene(g1, g2))
    
    # Test 2: 0 variance arrays
    g1 = [1, 1, 1, 1]
    g2 = [2, 2, 2, 2]
    try:
        print("Test 2:", stats.levene(g1, g2))
    except Exception as e:
        print("Test 2 Error:", e)

    # Test 3: Arrays with 1 element?
    # Our code filters out len < 3, so that's fine.

if __name__ == "__main__":
    test()
