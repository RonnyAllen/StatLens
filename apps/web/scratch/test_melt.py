import pandas as pd
df = pd.DataFrame({'rowTitle': [1,2], 'Subject': [0,1], 'A': [3,4]})
try:
    df_long = pd.melt(df, id_vars=['rowTitle', 'Subject'], value_vars=['rowTitle', 'A'], var_name='Factor2', value_name='Value')
    print("Melt succeeded:")
    print(df_long)
except Exception as e:
    print("Melt failed:", e)
