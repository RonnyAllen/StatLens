# Choosing Statistical Tests and Post Hoc Procedures: Extended with Diagnostic Plots and Niche Tools

> This version extends the core report with detailed guidance on variance plots, residual diagnostics, and niche methods that can feed into an app’s decision logic.

## 13. Assumption Diagnostics via Plots and Tests

For an intelligent assistant, it is useful to guide users not only to a test, but also through assumption checking via residuals and variance diagnostics.
These tools are especially important before choosing between standard ANOVA post hoc tests and robust/heteroscedastic alternatives.
[^1][^2][^3]

### 13.1 Residual plots (ANOVA and regression)

Residuals are the differences between observed values and model-predicted values.
Plotting residuals is a primary way to visually assess linearity, homoscedasticity, normality, outliers, and independence.
[^2][^4][^5]

Core plots your app can suggest:
- **Residuals vs fitted (predicted) values:** checks for non-constant variance and nonlinearity.
  - Ideal: random cloud around zero with roughly constant vertical spread.
  - Problem patterns: funnel shape (variance increases with mean), inverted funnel, or curved trends.
- **Residuals vs predictor or factor levels:** for ANOVA, plotting residuals by group can reveal model misfit or outliers in specific groups.
[^4][^5][^3]

**App logic example:**
- After fitting ANOVA or regression, compute standardized residuals.
- If residual vs fitted plot shows strong pattern or changing spread, flag potential heteroscedasticity and suggest variance-stabilizing transformation or heteroscedastic post hoc tests (Games–Howell, etc.).
[^3][^4]

### 13.2 Normal Q–Q plots for residuals

A normal Q–Q plot compares the distribution of residuals to the theoretical normal distribution.
If residual points lie approximately on a straight line, the normality assumption is plausible.
[^6][^5][^1]

**App handling:**
- If Q–Q plot is roughly linear with minor deviations in tails, treat normality as adequate (especially with moderate/large n).
- If there is pronounced S-shape or strong deviations, suggest transformations (e.g., log, square-root) or nonparametric tests.
[^1][^6]

### 13.3 Outlier and influence diagnostics (brief hooks)

Outliers and influential points can distort tests and post hoc conclusions.
Even if your first app version does not compute all influence metrics, you can expose hooks for advanced diagnostics.
[^5][^2]

Useful concepts:
- **Standardized / studentized residuals:** values beyond about ±3 may indicate outliers.
- **Leverage (hat values):** identifies points with extreme predictor values in regression; high leverage + large residual = influential.
- **Cook’s distance, DFFITS, DFBetas:** measure influence of points on fitted model.
[^5][^3]

**App extension idea:**
- If user chooses “advanced diagnostics,” compute and flag points with large standardized residuals or Cook’s distance above common thresholds, and warn that post hoc comparisons may be sensitive to these points.
[^5]

### 13.4 Testing homogeneity of variance

Some post hoc choices depend heavily on whether group variances can be considered equal.
Beyond visual residual plots, formal tests include Bartlett, Levene, and Brown–Forsythe.
[^7][^8][^9]

**Bartlett’s test:**
- Very powerful under normality but highly sensitive to non-normal data.
- Best when there is strong evidence of normality.
[^7]

**Levene’s test:**
- Tests equality of variance by computing absolute deviations from group means and performing ANOVA on these deviations.
- More robust than Bartlett to non-normality.
[^8][^7]

**Brown–Forsythe test:**
- Levene-type test using deviations from group medians instead of means.
- Even more robust to skewed and heavy-tailed distributions.
[^9][^10][^7]

**App rule for homogeneity testing:**
- If user wants a formal variance-equality check:
  - Default to Levene or Brown–Forsythe.
  - Reserve Bartlett for clearly normal data.
- Use result to steer post hoc selection:
  - If homogeneity not rejected → equal-variance post hoc (Tukey, Dunnett, etc.).
  - If homogeneity clearly violated → heteroscedastic options (Games–Howell, Dunnett T3, Tamhane T2, etc.).
[^8][^9][^7]

### 13.5 Spread–location and spread–level plots

Spread–location and spread–level plots are more specialized tools to diagnose variance–mean relationships.
They are especially useful when designing transformation suggestions.
[^11][^12]

- **Spread–location plot:** typically residuals’ absolute values against fitted values; a trend indicates heteroscedasticity.
- **Spread–level plot:** log of group spread (e.g., interquartile range or standard deviation) vs log of group means; slope indicates relationship between variance and mean.
[^12][^11][^7]

From spread–level plot, one can approximate a power transformation exponent:
- A slope around 1 suggests log or square-root transformations as variance-stabilizing.
- More generally, Box–Cox transformation can be recommended based on estimated slope.
[^11][^7]

**App implementation idea:**
- For ANOVA with continuous outcome, compute per-group means and spreads (IQR or SD) and automatically generate a spread–level plot.
- Estimate transformation parameter (e.g., via Box–Cox) and suggest "Apply transformation with λ ≈ X" or offer auto-transform.
[^7][^11]

***

## 14. Niche and Advanced Methods Worth Exposing

In a "super nerdy" app mode, you can optionally surface advanced methods and niche diagnostics with good documentation and clear caveats.
This gives expert users more control without overwhelming beginners.
[^13][^1][^5]

### 14.1 Variance-stabilizing transformations and Box–Cox

Many biological and count data exhibit variance that increases with the mean.
A variance-stabilizing transformation can make ANOVA assumptions more reasonable.
[^3][^7]

Common examples:
- Square-root for counts.
- Log for multiplicative effects and right-skewed data.
- Arcsine square-root for proportions near 0 or 1.
[^3][^7]

The **Box–Cox** framework systematically searches for a power \(\lambda\) that maximizes model fit or likelihood, suggesting a transformation \(y^{(\lambda)}\).
[^7]

**App suggestion:**
- After detecting heteroscedasticity, allow user to:
  - Try Box–Cox to select a transformation.
  - Refit model and re-run diagnostics, then optionally re-run post hoc tests on transformed scale.
[^7]

### 14.2 Robust tests for means and variances

When assumptions are badly violated or there are outliers, robust methods can provide more reliable inferences than classical tests.
[^2][^5]

Options include:
- **Welch’s ANOVA:** handles unequal variances and group sizes better than classical one-way ANOVA; pairs naturally with Games–Howell post hoc.
- **Trimmed-mean and M-estimator-based tests:** robust ANOVA-like procedures using trimmed means or down-weighted outliers.
[^14][^15][^5]

Your app can expose a “robust mode” where:
- If Levene/Brown–Forsythe reject homogeneity and outliers are present, suggest Welch ANOVA and heteroscedastic post hoc tests.
- Optionally mention robust ANOVA variants where supported by libraries.
[^15][^14]

### 14.3 Nonparametric effect sizes and confidence intervals

Classic tests often focus only on p-values, but effect sizes and intervals are increasingly emphasized.
For nonparametric tests, this may include rank-based effect sizes or median differences.
[^16][^13]

Examples:
- **Cliff’s delta**, **rank-biserial correlation** for Mann–Whitney.
- Hodges–Lehmann estimators for median differences with confidence intervals.
[^16][^13]

**App addition:**
- When recommending nonparametric tests, also return interpretable effect sizes and brief descriptions (e.g., “probability that a randomly chosen value from group A exceeds one from group B”).
[^13][^16]

### 14.4 Model-checking via residual-fit and residual–fit spread plots

Cleveland-type residual-fit and residual–fit spread plots compare the spread and shape of fitted values vs residuals to evaluate model adequacy.
[^17]

Key uses:
- Assess whether residuals have small spread compared to fits (good) or comparable spread (poor fit).
- Identify deviations from normality or clusters of residuals.
[^17]

Your app can:
- Generate such plots on demand and include a simple textual interpretation of key features.
[^17]

### 14.5 Time or sequence diagnostics (independence)

When data are collected over time or ordered in some way, plotting residuals vs time/sequence can reveal autocorrelation.
[^5][^3]

If structure is evident:
- Suggest time-series models or mixed models rather than simple ANOVA/regression.
[^3][^5]

***

## 15. Integrating Diagnostics into Post Hoc Selection

To connect all of this with post hoc logic:

1. **Fit base model (ANOVA / regression).**
2. **Compute residual diagnostics:** Q–Q plot, residual vs fitted, spread–level plot, and homogeneity tests (Levene/Brown–Forsythe).
3. **Classify assumption status:**
   - Normality: roughly OK vs strongly violated.
   - Variances: equal vs clearly unequal.
   - Outliers: none vs present.
4. **Pick omnibus test variant:**
   - Classical ANOVA vs Welch ANOVA vs nonparametric (Kruskal–Wallis / Friedman).
5. **Select post hoc procedure:**
   - Equal variances, balanced groups → Tukey / Dunnett / standard FWER methods.
   - Unequal variances, unbalanced groups → Games–Howell, Dunnett T3, Tamhane T2, etc.
   - Nonparametric omnibus → Dunn with Holm/Bonferroni.
   - Many tests across different endpoints → FDR (BH or BY).
[^18][^19][^20][^14][^15]

By explicitly modeling these diagnostic steps, your app can surface both mainstream and niche tools in a principled way, and always give users a rationale like: “Levene test suggests unequal variances, so Tukey is not ideal; recommending Games–Howell for robust pairwise comparisons.”

---

## References

1. [Residuals Tab - GraphPad Prism 11 Statistics Guide](https://www.graphpad.com/guides/prism/latest/statistics/stat_multifactor_anova_residuals_tab.htm) - The Residuals tab allows you to check the assumptions of ANOVA by examining residuals and creating d...

2. [Statistical notes for clinical researchers: simple linear regression 3](https://pmc.ncbi.nlm.nih.gov/articles/PMC6387894/) - In this session, we will discuss four basic assumptions of regression models for justification of th...

3. [Checking Model Assumptions](https://www.stat.purdue.edu/~zhanghao/STAT514/Lecture_Notes/LectureNotes07-Checking-Assumptions-.html) - Plot residuals versus fitted values. The most common pattern of non-constant variance is that the er...

4. [Residual Analysis - GeeksforGeeks](https://www.geeksforgeeks.org/maths/residual-analysis/) - ANOVA residuals are typically examined using residual plots or by conducting tests for homogeneity o...

5. [Residual Analysis in Regression Models | PDF - Scribd](https://www.scribd.com/document/734280786/FCDS-RA-ch3-Sp21) - If the residuals are spread evenly across the plot with no discernible pattern, then the variance is...

6. [Testing Assumptions of Normality of Residuals and Homoscedasticity](https://www.youtube.com/watch?v=E-pti2KsEJ0) - 00:00 Normality of Residuals 07:48 Homoscedasticity This video goes over how to test that the residu...

7. [[PDF] 2.12 Tests for Homogeneity of Variance • In an ANOVA, one ...](https://www.math.montana.edu/jobo/st541/sec2e.pdf) - They recommend Levene's Test (or the Brown-Forsythe Test) because these tests are not very sensitive...

8. [1.3.5.10. Levene Test for Equality of Variances](https://www.itl.nist.gov/div898/handbook/eda/section3/eda35a.htm) - Levene's test ( Levene 1960) is used to test if k samples have equal variances. Equal variances acro...

9. [Brown–Forsythe test - Wikipedia](https://en.wikipedia.org/wiki/Brown%E2%80%93Forsythe_test) - The Brown–Forsythe test is a statistical test for the equality of group variances based on performin...

10. [Statistical tests for homogeneity of variance for clinical trials ... - PMC](https://pmc.ncbi.nlm.nih.gov/articles/PMC10151260/) - Brown-Forsythe test is essentially Levene's test using medians instead of means from the various gro...

11. [Spread-Location and Spread-Level Plots - Manny Gimond](https://mgimond.github.io/ES218/sl_plot.html) - A variation of the spread-location plot is the spread-level plot which pits the log of the inter-qua...

12. [Spread-Level Plots - Search R-project.org](https://search.r-project.org/CRAN/refmans/car/html/spreadLevelPlot.html) - Creates plots for examining the possible dependence of spread on level, or an extension of these plo...

13. [Nonparametric statistics - Wikipedia](https://en.wikipedia.org/wiki/Nonparametric_statistics) - Nonparametric statistics is a type of statistical analysis that makes minimal assumptions about the ...

14. [GLM Post Hoc Comparisons - IBM](https://www.ibm.com/docs/en/spss-statistics/32.0.0?topic=analysis-glm-post-hoc-comparisons) - When the variances are unequal, use Tamhane's T2 (conservative pairwise comparisons test based on a ...

15. [Unplanned Comparisons - Real Statistics Using Excel](https://real-statistics.com/one-way-analysis-of-variance-anova/unplanned-comparisons/) - A tutorial that shows how to perform useful unplanned follow up tests to ANOVA in Excel, including T...

16. [Nonparametric statistical tests for the continuous data - PMC - NIH](https://pmc.ncbi.nlm.nih.gov/articles/PMC4754273/) - Conventional statistical tests are usually called parametric tests. Parametric tests are used more f...

17. [How to interpret a residual-fit spread plot - The DO Loop - SAS Blogs](https://blogs.sas.com/content/iml/2013/06/12/interpret-residual-fit-spread-plot.html) - The spread plot is a graph of the centered data versus the corresponding plotting position. Essentia...

18. [Post-Hoc Tests: Understanding the Tools to Control Type I Error](https://simplifyingstats.wordpress.com/2025/01/31/post-hoc-tests-understanding-the-tools-to-control-type-i-error/) - Tukey's HSD is one of the most commonly used post-hoc tests, particularly for balanced designs (equa...

19. [Selecting a Post Hoc test - Practical Statistics for Educators](https://practicalstats.labanca.net/index.php/Selecting_a_Post_Hoc_test) - On SPSS, find analyze and select univariate. Then, choose post hoc and move over your independent va...

20. [Navigating multiple comparison corrections in A/B Testing - Statsig](https://www.statsig.com/blog/multiple-comparison-corrections-in-a-b) - In this blog, we will dive into the various methods for addressing multiple comparisons and provide ...

