import sys
import subprocess
try:
    import lifelines
except:
    subprocess.check_call([sys.executable, '-m', 'pip', 'install', 'lifelines'])
    import lifelines

from lifelines.statistics import logrank_test, multivariate_logrank_test

T1=[1,2,3]
E1=[1,0,1]
T2=[2,3,4]
E2=[1,1,0]
res = logrank_test(T1, T2, E1, E2)
print("dir(res):", dir(res))
try:
    print("res.test_statistic:", res.test_statistic)
    print("res.p_value:", res.p_value)
    print("res.summary:", res.summary)
except Exception as e:
    print("Error:", e)
