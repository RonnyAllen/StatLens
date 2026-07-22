# StatLens Runtime Audit Matrix (tests)

| Test ID | Runtime status | Payload | Recommended | Golden | Engine path |
|---|---|---|---|---|---|
| ART ANOVA | ✅ Runs | Grouped (golden) | ❌ | ✅ | ❌ |
| ART ANOVA (Non-parametric) | ✅ Runs | Grouped | ✅ | ❌ | ✅ |
| Area Under Curve | ✅ Runs | XY (golden) | ✅ | ✅ | ✅ |
| Binomial test | ✅ Runs | PartsOfWhole (golden) | ✅ | ✅ | ✅ |
| Brown-Forsythe ANOVA | ✅ Runs | Column (golden) | ✅ | ✅ | ✅ |
| Chi-Square Test | ✅ Runs | Contingency | ✅ | ❌ | ✅ |
| Chi-Square Test (with Yates' correction) | ✅ Runs | Contingency | ✅ | ❌ | ✅ |
| Chi-Square goodness of fit | ✅ Runs | PartsOfWhole (golden) | ✅ | ✅ | ✅ |
| Chi-square | ✅ Runs | Contingency (golden) | ❌ | ✅ | ❌ |
| Chi-square Yates | ✅ Runs | Contingency (golden) | ❌ | ✅ | ❌ |
| Correlation (Pearson) | ✅ Runs | XY (golden) | ✅ | ✅ | ✅ |
| Correlation (Spearman) | ✅ Runs | XY (golden) | ✅ | ✅ | ✅ |
| Correlation Matrix | ✅ Runs | MultipleVariables (golden) | ✅ | ✅ | ✅ |
| Deming Regression | ✅ Runs | XY (golden) | ✅ | ✅ | ✅ |
| Diagnostic (Sens/Spec) | ✅ Runs | Contingency (golden) | ❌ | ✅ | ❌ |
| Diagnostic Test (Sensitivity/Specificity) | ✅ Runs | Contingency | ✅ | ❌ | ✅ |
| Differentiate | ✅ Runs | XY | ✅ | ❌ | ✅ |
| Dunnett's T3 | ✅ Runs | Column (golden) | ❌ | ✅ | ❌ |
| Fisher's Exact Test | ✅ Runs | Contingency | ✅ | ❌ | ✅ |
| Fit Spline | ✅ Runs | XY | ✅ | ❌ | ✅ |
| Friedman test | ✅ Runs | Column (golden) | ✅ | ✅ | ✅ |
| Gehan-Breslow-Wilcoxon test | ✅ Runs | Survival | ✅ | ❌ | ❌ |
| Hazard Ratios | ✅ Runs | Survival | ✅ | ❌ | ❌ |
| Integrate | ✅ Runs | XY | ✅ | ❌ | ✅ |
| Kaplan-Meier Survival Analysis | ✅ Runs | Survival | ✅ | ❌ | ✅ |
| Kolmogorov-Smirnov (2-sample) | ✅ Runs | Column (golden) | ❌ | ✅ | ❌ |
| Kolmogorov-Smirnov test | ✅ Runs | Column | ✅ | ❌ | ✅ |
| Kruskal-Wallis test | ✅ Runs | Column (golden) | ✅ | ✅ | ✅ |
| LOWESS | ✅ Runs | XY | ✅ | ❌ | ✅ |
| Log-rank (Mantel-Cox) test | ✅ Runs | Survival | ✅ | ❌ | ❌ |
| Mann-Whitney test | ✅ Runs | Column (golden) | ✅ | ✅ | ✅ |
| McNemar's Test | ✅ Runs | Contingency (golden) | ✅ | ✅ | ✅ |
| Mixed-effects ANOVA | ✅ Runs | Grouped (golden) | ✅ | ✅ | ✅ |
| Multiple Linear Regression | ✅ Runs | MultipleVariables (golden) | ✅ | ✅ | ✅ |
| Multiple Logistic Regression | ✅ Runs | MultipleVariables (golden) | ✅ | ✅ | ✅ |
| Firth's Penalized Logistic Regression | ❌ Pending | MultipleVariables | ❌ | ❌ | ❌ |
| Nested ANOVA | ✅ Runs | Grouped (golden) | ❌ | ✅ | ❌ |
| Nested t-test / ANOVA | ✅ Runs | Grouped | ✅ | ❌ | ✅ |
| Nonlinear Curve Fitting | ✅ Runs | XY (golden) | ✅ | ✅ | ✅ |
| Odds Ratio Haldane | ✅ Runs | Contingency (golden) | ❌ | ✅ | ❌ |
| One-Sample Sign test | ✅ Runs | Column (golden) | ✅ | ✅ | ✅ |
| One-Sample Wilcoxon | ✅ Runs | Column (golden) | ❌ | ✅ | ❌ |
| One-Sample Wilcoxon signed-rank test | ✅ Runs | Column | ✅ | ❌ | ✅ |
| One-Sample t-test | ✅ Runs | Column (golden) | ✅ | ✅ | ✅ |
| Ordinary One-way ANOVA | ✅ Runs | Column (golden) | ✅ | ✅ | ✅ |
| Paired Sign test | ✅ Runs | Column (golden) | ✅ | ✅ | ✅ |
| Paired t-test | ✅ Runs | Column (golden) | ✅ | ✅ | ✅ |
| Pairwise log-rank with Bonferroni/Šidák | ✅ Runs | Survival | ✅ | ❌ | ❌ |
| Poisson Regression | ✅ Runs | MultipleVariables (golden) | ✅ | ✅ | ✅ |
| Principal Component Analysis (PCA) | ✅ Runs | MultipleVariables (golden) | ✅ | ✅ | ✅ |
| Repeated Measures ANOVA | ✅ Runs | Column (golden) | ✅ | ✅ | ✅ |
| Repeated Measures Two-way ANOVA | ✅ Runs | Grouped | ❌ | ❌ | ✅ |
| Row Statistics | ✅ Runs | XY (golden) | ✅ | ✅ | ✅ |
| Simple Linear Regression | ✅ Runs | XY (golden) | ✅ | ✅ | ✅ |
| Simple Logistic Regression | ✅ Runs | XY (golden) | ✅ | ✅ | ✅ |
| Smooth | ✅ Runs | XY | ✅ | ❌ | ✅ |
| Survival Analysis | ✅ Runs | Survival | ✅ | ❌ | ✅ |
| Survival Hazard Ratio | ✅ Runs | Survival (golden) | ❌ | ✅ | ❌ |
| Three-way ANOVA | ✅ Runs | MultipleVariables (golden) | ✅ | ✅ | ✅ |
| Tukey HSD | ✅ Runs | Column (golden) | ❌ | ✅ | ❌ |
| Two-way ANOVA | ✅ Runs | Grouped | ✅ | ❌ | ✅ |
| Two-way ANOVA Type III Unbalanced | ✅ Runs | Grouped (golden) | ❌ | ✅ | ❌ |
| Two-way RM ANOVA | ✅ Runs | Grouped | ❌ | ❌ | ✅ |
| Unpaired t test | ✅ Runs | Column (golden) | ❌ | ✅ | ✅ |
| Unpaired t-test | ✅ Runs | Column | ✅ | ❌ | ✅ |
| Welch and Brown-Forsythe ANOVA (Combinatory) | ✅ Runs | Column | ✅ | ❌ | ✅ |
| Welch's ANOVA | ✅ Runs | Column (golden) | ✅ | ✅ | ✅ |
| Welch's t-test | ✅ Runs | Column (golden) | ✅ | ✅ | ✅ |
| Wilcoxon matched-pairs signed rank test | ✅ Runs | Column (golden) | ✅ | ✅ | ✅ |
| chi-square test | ✅ Runs | Contingency | ❌ | ❌ | ✅ |
| chi-square test (with yates' correction) | ✅ Runs | Contingency | ❌ | ❌ | ✅ |
