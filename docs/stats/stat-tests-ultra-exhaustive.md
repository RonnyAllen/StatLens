# Statistical Tests and Post Hoc Procedures: Exhaustive Guide for Automated Selection

> **Purpose of this document**  
> This document is designed as a machine‑readable knowledge base for an app that recommends statistical tests and post hoc procedures based on study design, data type, and assumption checks.
> It is written for an audience comfortable with statistical terminology (PhD‑level experimental biology / biostatistics) and is structured so that each test can be mapped to decision rules in code.

---

## 1. Global Decision Logic for Choosing a Test

At the highest level, any hypothesis test in your app will be determined by four questions:

1. **What is the outcome variable’s scale and structure?**
   - Continuous (metric): approximately interval/ratio.
   - Ordinal: ordered categories without equal spacing.
   - Nominal: categorical without order.
   - Count / time‑to‑event / time‑series.
2. **How many groups or conditions are compared, and are they independent or paired?**
   - One sample vs a constant.
   - Two independent samples.
   - Two paired/related samples.
   - K ≥ 3 independent groups.
   - K ≥ 3 repeated‑measures / blocked conditions.
3. **What distributional assumptions are acceptable?**
   - Parametric: approximate normality, homoscedasticity, independent errors.
   - Nonparametric (rank‑based or permutation): fewer assumptions.
   - Special structures: survival with censoring, time‑series dependence, high‑dimensional omics.
4. **What exact question is being asked?**
   - Difference in means/medians.
   - Difference in proportions.
   - Association/correlation.
   - Difference in survival curves.
   - Trend/ordinal dose–response.
   - Goodness‑of‑fit / independence.

Your selection logic can be implemented as a hierarchical decision tree: scale → groups/pairedness → assumptions → test family → specific test.[web:12][web:13]

---

## 2. One‑Sample Tests

### 2.1 Parametric tests

#### 2.1.1 One‑sample z‑test (mean)

- **Use when**
  - Outcome is continuous.
  - Comparing sample mean to a known population mean \(\mu_0\).
  - Population variance is known *or* sample size is large (often n ≥ 30 so CLT is reasonable).[web:22]
- **Assumptions**
  - Independent observations.
  - Underlying population approximately normal, or n large.
- **Typical use cases**
  - Quality control: checking if a process mean differs from a target.

#### 2.1.2 One‑sample t‑test (mean)

- **Use when**
  - As above, but population variance is unknown and n is small or moderate.[web:22][web:13]
- **Assumptions**
  - Independent observations.
  - Approximate normality of the outcome.
- **When to avoid**
  - Strong skew/outliers with small n; consider nonparametric one‑sample tests.

### 2.2 Nonparametric one‑sample tests

#### 2.2.1 One‑sample sign test

- **Use when**
  - Outcome is at least ordinal.
  - Comparing median to a hypothesized value, or testing whether the distribution is centered at a reference value.[web:21][web:8]
- **Assumptions**
  - Independent observations.
  - Symmetry *not* required (unlike Wilcoxon signed rank).
- **Pros/cons**
  - Very robust but low power.

#### 2.2.2 One‑sample Wilcoxon signed rank test

- **Use when**
  - Outcome is continuous or ordinal with many levels.
  - Want to test whether the median differs from a reference value, with assumption of symmetric distribution.[web:21][web:8]
- **Assumptions**
  - Independent observations.
  - Symmetric continuous distribution around the median.
- **When to recommend**
  - Non‑normal but roughly symmetric data; or when n is small and normality is doubtful.

#### 2.2.3 One‑sample proportion tests (binomial)

- **Use when**
  - Binary outcome, want to compare observed proportion \(p\) to \(p_0\).
- **Variants**
  - Exact binomial test: small n.
  - Normal approximation (one‑sample z for proportion): large n with at least ≈10 successes and 10 failures.[web:22]

---

## 3. Two‑Sample Tests: Independent Groups

### 3.1 Parametric tests for means

#### 3.1.1 Two‑sample z‑test (independent means)

- **Use when**
  - Two independent groups.
  - Outcome continuous.
  - Population variances known or both n large (≥ 30).[web:22]

#### 3.1.2 Student’s independent‑samples t‑test (pooled‑variance)

- **Use when**
  - Two independent groups.
  - Outcome continuous.
  - Approximate normality within each group.
  - Equal variances (homoscedasticity) and reasonably balanced n.[web:13]
- **Assumptions**
  - Independent observations.
  - Homogeneity of variance (check with Levene/Bartlett etc.).[web:21][web:34]
- **When to avoid**
  - Strong variance differences or highly unbalanced design; use Welch t‑test.

#### 3.1.3 Welch’s t‑test (unequal variances)

- **Use when**
  - As above but variances differ significantly or group sizes are unbalanced.[web:22]
- **Assumptions**
  - Independent observations.
  - Approximate normality within groups.
  - Variances can differ.

### 3.2 Nonparametric tests for two independent groups

#### 3.2.1 Mann–Whitney U / Wilcoxon rank‑sum test

- **Use when**
  - Two independent groups, ordinal or continuous outcome.
  - Non‑normal distributions or strong outliers.[web:10][web:13]
- **Hypothesis**
  - Tests whether the distributions are identical; under some conditions interpreted as a test of median difference.
- **Assumptions**
  - Independent observations.
  - Similar shapes if aiming to interpret as shift in central tendency.

#### 3.2.2 Kolmogorov–Smirnov two‑sample test

- **Use when**
  - Comparing full distributions of two independent samples, continuous or ordinal with many levels.[web:8][web:10]
- **Pros/cons**
  - Sensitive to differences in both location and shape; less power than Mann–Whitney when the main difference is a location shift.

#### 3.2.3 Mood’s median test

- **Use when**
  - Comparing medians of two or more independent groups via counts above/below pooled median.[web:21]
- **Assumptions**
  - Independent observations.
  - Very robust but low power; rarely first choice.

### 3.3 Tests for proportions (two independent groups)

#### 3.3.1 Two‑sample z‑test for proportions

- **Use when**
  - Binary outcome, independent groups, n large enough for normal approximation.[web:22]

#### 3.3.2 Fisher’s exact test (2×2 table)

- **Use when**
  - Binary outcome, small sample sizes or expected counts < 5 in any cell.[web:33]
- **Assumptions**
  - Fixed margins; hypergeometric model.
- **Note**
  - Recommended over chi‑square for small tables.[web:33]

#### 3.3.3 Chi‑square test of independence (2×2 or larger)

- **Use when**
  - Two categorical variables (e.g., treatment × response) and want to test independence.[web:22]
- **Assumptions**
  - Expected counts usually ≥ 5 in each cell.

#### 3.3.4 Barnard’s and Boschloo’s exact tests

- **Use when**
  - Alternative exact tests for 2×2 tables with more power than Fisher in some situations.
- **Note**
  - Often implemented in specialized software; conceptually similar to Fisher but condition on fewer margins.

### 3.4 Tests for variances (two independent groups)

#### 3.4.1 F‑test for equality of variance

- **Use when**
  - Two independent normal groups, want to compare variances directly.[web:22]
- **Assumptions**
  - Normality is critical; very sensitive to departures.

#### 3.4.2 Levene’s test / Brown–Forsythe test

- **Use when**
  - General test for equal variances across ≥ 2 groups; robust to non‑normality.[web:34]
- **Variants**
  - Classic Levene uses deviations from group mean.
  - Brown–Forsythe uses deviations from group median for more robustness.[web:34]

#### 3.4.3 Fligner–Killeen test

- **Use when**
  - Nonparametric test for homogeneity of variances, robust under skewed distributions.[web:34]

---

## 4. Paired / Matched Two‑Sample Tests

### 4.1 Paired t‑test

- **Use when**
  - Two measurements on the same subject (pre/post) or matched pairs.
  - Outcome continuous; approximate normality of within‑pair differences.[web:13]

### 4.2 Wilcoxon signed rank test (paired)

- **Use when**
  - Paired/blocked design with ordinal or continuous outcome, non‑normal differences.
  - Tests whether median difference is zero.[web:10][web:21]

### 4.3 Sign test for paired data

- **Use when**
  - Paired data but only sign of change is reliable (ignoring magnitude).
  - Very robust but low power.[web:21]

### 4.4 McNemar’s test (paired binary)

- **Use when**
  - 2×2 table with paired binary outcomes (e.g., before/after classification).
  - Tests symmetry of discordant pairs.[web:10]

### 4.5 Cochran’s Q test (≥ 3 related binary conditions)

- **Use when**
  - Extension of McNemar to k related treatments with binary outcomes.[web:10]

---

## 5. K ≥ 3 Independent Groups: ANOVA and Alternatives

### 5.1 One‑way ANOVA (fixed effects)

- **Use when**
  - One categorical factor with k ≥ 3 independent groups.
  - Continuous outcome.
  - Aim: test if at least one group mean differs.[web:13][web:14]
- **Assumptions**
  - Independent observations.
  - Approximate normality within each group.
  - Homogeneity of variances (Levene/Bartlett/Fligner–Killeen).
- **If assumptions violated**
  - Consider transforming data or using Kruskal–Wallis, Welch ANOVA, or robust methods.

### 5.2 Welch’s one‑way ANOVA (heteroscedastic)

- **Use when**
  - One‑way layout with unequal variances and/or unbalanced n.[web:22]
- **Assumptions**
  - Approximate normality.
  - Variances allowed to differ.

### 5.3 Nonparametric analogs

#### 5.3.1 Kruskal–Wallis test

- **Use when**
  - One independent factor, k ≥ 3 groups, ordinal/continuous outcome.
  - Non‑normal distributions.[web:8][web:21]
- **Assumptions**
  - Independent observations.
  - Distributions have similar shapes.

#### 5.3.2 Jonckheere–Terpstra test

- **Use when**
  - Ordered factor levels (e.g., dose levels) and a monotonic trend is hypothesized.
  - Nonparametric test of ordered alternatives.[web:8][web:19]

#### 5.3.3 Median test (Mood’s) for k groups

- **Use when**
  - Testing equality of medians in multiple groups using contingency of above/below pooled median.[web:21]

### 5.4 Factorial and multi‑factor ANOVA

#### 5.4.1 Two‑way ANOVA without interaction

- **Use when**
  - Two categorical factors (A, B) and interest primarily in main effects.
- **Assumptions**
  - As for one‑way ANOVA, plus additivity of effects.

#### 5.4.2 Two‑way ANOVA with interaction

- **Use when**
  - Two factors and interest in interaction (effect of A depends on level of B).[web:14]
- **Assumptions**
  - Same as one‑way; interpret carefully when interaction is significant.

#### 5.4.3 Higher‑way ANOVA (three‑way, etc.)

- **Use when**
  - More than two factors; rarely needed outside large designed experiments.

### 5.5 ANCOVA, MANOVA, MANCOVA

#### 5.5.1 ANCOVA (analysis of covariance)

- **Use when**
  - Compare group means while adjusting for continuous covariates (e.g., baseline, body size).
  - Model: categorical factor(s) + continuous covariate(s).[web:14]
- **Assumptions**
  - Linear relationship between covariate and outcome.
  - Homogeneity of regression slopes across groups.

#### 5.5.2 MANOVA (multivariate ANOVA)

- **Use when**
  - Two or more continuous outcomes measured on each subject; want to test group differences in multivariate mean vector.[web:14][web:12]
- **Assumptions**
  - Multivariate normality.
  - Equality of covariance matrices (Box’s M test).

#### 5.5.3 MANCOVA

- **Use when**
  - MANOVA with covariates.
  - Same assumptions plus linear effect of covariates.

---

## 6. Repeated‑Measures and Blocked Designs

### 6.1 Repeated‑measures ANOVA (within‑subjects)

- **Use when**
  - Same subjects measured at k ≥ 3 time points or conditions.
  - Outcome continuous, interest in within‑subject factor(s).
- **Assumptions**
  - Multivariate normality of responses.
  - Sphericity (equal variances of differences between all pairs of conditions); check with Mauchly’s test.
- **If sphericity violated**
  - Use Greenhouse–Geisser or Huynh–Feldt corrections.

### 6.2 Mixed‑effects ANOVA (split‑plot / mixed models)

- **Use when**
  - Combination of fixed and random factors, e.g., treatments (fixed) within individual fish/tanks (random), repeated measurements.[web:29]
- **Implementation**
  - Use linear mixed models (e.g., lme4, nlme) rather than classical ANOVA when design is complex.

### 6.3 Friedman test (nonparametric repeated‑measures)

- **Use when**
  - Repeated‑measures or randomized block design with k ≥ 3 conditions, ordinal/continuous outcome, non‑normality.[web:10][web:21]

### 6.4 Kendall’s W (coefficient of concordance)

- **Use when**
  - Quantify agreement between raters (or repeated rankings) of items; related to Friedman test.[web:10]

---

## 7. Correlation and Association Tests

### 7.1 Pearson correlation

- **Use when**
  - Two continuous variables, interest in linear association.[web:31][web:12]
- **Assumptions**
  - Bivariate normality.
  - Linear relationship.
  - No strong outliers.

### 7.2 Spearman’s rank correlation

- **Use when**
  - Monotonic but not necessarily linear relationship; ordinal or continuous variables.
  - Robust to non‑normality and outliers.[web:12][web:31]

### 7.3 Kendall’s tau

- **Use when**
  - Similar to Spearman but based on concordant/discordant pairs; better for small samples or many ties.[web:10][web:31]

### 7.4 Point‑biserial and biserial correlations

- **Use when**
  - One binary and one continuous variable (point‑biserial) or underlying continuous latent variable dichotomized (biserial).[web:13]

### 7.5 Phi coefficient and Cramer’s V

- **Use when**
  - Association between two binary variables (phi) or general r×c tables (Cramer’s V).
- **Note**
  - Phi is special case of Pearson correlation for 2×2 tables.

### 7.6 Distance correlation, mutual information and others

- **Use when**
  - Capture nonlinear and nonmonotonic dependence.
  - Distance correlation equals zero iff variables are independent.[web:20]

---

## 8. Regression Models and Related Tests

### 8.1 Simple and multiple linear regression

- **Use when**
  - Continuous outcome, continuous and/or categorical predictors, interest in conditional mean structure.
- **Key tests**
  - t‑tests for individual regression coefficients.
  - F‑test for overall model (all slopes = 0).
- **Assumptions**
  - Linearity, independence, homoscedasticity, normality of residuals.

### 8.2 Generalized linear models (GLMs)

- **Use when**
  - Outcome non‑Gaussian: binary, counts, proportions, etc.
- **Examples**
  - Logistic regression (binary outcomes).
  - Poisson/negative binomial regression (counts).
  - Binomial logistic models for proportions.
- **Key tests**
  - Wald tests, likelihood‑ratio tests, and score tests for coefficients.

### 8.3 Mixed‑effects models

- **Use when**
  - Hierarchical or clustered data (e.g., larvae within clutch, tanks within batch).
- **Tests**
  - Wald and likelihood‑ratio tests for fixed‑effects; variance component tests for random‑effects.[web:29]

### 8.4 Nonlinear regression

- **Use when**
  - Known nonlinear model (e.g., logistic growth, Michaelis–Menten); parameters estimated by nonlinear least squares or maximum likelihood.

### 8.5 Nonparametric and semiparametric regression

- **Use when**
  - Flexible modeling when form of relationship is unknown: splines, GAMs, kernel smoothing.

---

## 9. Survival Analysis and Time‑to‑Event Tests

### 9.1 Kaplan–Meier estimator

- **Purpose**
  - Nonparametric estimation of survival function with censoring.[web:10]

### 9.2 Log‑rank test

- **Use when**
  - Compare survival curves of two or more groups.
  - Assumes proportional hazards; equal weight to events over time.[web:27][web:36]

### 9.3 Gehan–Breslow–Wilcoxon test

- **Use when**
  - Similar to log‑rank but weights earlier failures more heavily (risk set weighting).[web:27][web:36]

### 9.4 Tarone–Ware test

- **Use when**
  - Compromise between log‑rank and Gehan; intermediate weighting of early vs late events.[web:17][web:27]

### 9.5 Peto–Peto–Prentice test

- **Use when**
  - More robust when proportional hazards assumption may not hold or event rate is low.[web:27][web:36]

### 9.6 Fleming–Harrington tests

- **Use when**
  - Flexible family of weighted log‑rank tests with parameters to emphasize early or late events.[web:36]

### 9.7 Cox proportional hazards model

- **Use when**
  - Semi‑parametric regression of hazard on covariates; tests via likelihood‑ratio/Wald/score.
- **Assumptions**
  - Proportional hazards; assess via Schoenfeld residuals.

### 9.8 Parametric survival models

- **Use when**
  - Assume specific baseline distribution (exponential, Weibull, log‑normal, Gompertz, etc.).
- **Tests**
  - Likelihood‑ratio tests between nested parametric models.

---

## 10. Categorical Data and Contingency‑Table Tests

### 10.1 Chi‑square tests

- **Goodness‑of‑fit**
  - One categorical variable; compare observed frequencies to specified probabilities.[web:22]
- **Independence**
  - Two categorical variables; test independence in r×c tables.

### 10.2 Exact and small‑sample tests

- **Fisher’s exact test**
  - Exact p‑values for 2×2 tables; prefer when expected counts are small.[web:33]
- **Barnard’s and Boschloo’s tests**
  - Exact tests for 2×2 with more power in some configurations.

### 10.3 Trend tests in contingency tables

- **Cochran–Armitage trend test**
  - Test for linear trend in proportions across ordered categories (e.g., genotype dosage vs disease status).[web:29][web:19]
- **Mantel–Haenszel test**
  - Pooled association across stratified 2×2 tables (control for confounder strata).

### 10.4 Agreement and reliability

- **Cohen’s kappa**
  - Agreement beyond chance for two raters on categorical scale.[web:10]
- **Weighted kappa**
  - For ordinal categories; penalize larger disagreements more.

---

## 11. Goodness‑of‑Fit and Normality Tests

### 11.1 Goodness‑of‑fit

- **Chi‑square goodness‑of‑fit**
  - Compare observed counts in categories to expected under hypothesized distribution.[web:22]
- **Kolmogorov–Smirnov (one‑sample)**
  - Compare empirical CDF to specified continuous distribution.[web:10][web:8]
- **Anderson–Darling, Cramér–von Mises, Kuiper tests**
  - EDF‑based tests, often more sensitive in tails (Anderson–Darling) or cyclic patterns (Kuiper).[web:10][web:28]

### 11.2 Normality tests

- **Shapiro–Wilk**
  - Powerful general normality test; preferred for small to moderate n.[web:18][web:28]
- **Kolmogorov–Smirnov with Lilliefors correction**
  - Normality test with corrected critical values when parameters estimated from sample.[web:28]
- **Anderson–Darling, Cramér–von Mises**
  - Often more powerful for deviation in tails.[web:28]
- **D’Agostino–Pearson, Jarque–Bera**
  - Combine skewness and kurtosis into omnibus normality tests.[web:28]

### 11.3 Tests for stationarity and time‑series properties

- **Augmented Dickey–Fuller (ADF) test**
  - Null: unit root (non‑stationary). Alternative: stationary.[web:32]
- **Phillips–Perron (PP) test**
  - Similar purpose to ADF with nonparametric correction.
- **KPSS test**
  - Null: stationary; alternative: unit root.[web:32]
- **Ljung–Box test**
  - Test for remaining autocorrelation in residuals.

---

## 12. Trend, Order, and Time‑Series Tests

### 12.1 Nonparametric trend tests

- **Mann–Kendall trend test**
  - Detects monotonic trend in time‑series; nonparametric, robust to non‑normality.[web:21][web:29]
- **Cochran–Armitage trend test**
  - For increasing/decreasing risk across ordered categories (see above).[web:29]
- **Jonckheere–Terpstra test**
  - Ordered alternatives across k groups with ordinal outcome.[web:10][web:19]

### 12.2 Parametric time‑series tests

- **Tests for autocorrelation**
  - Durbin–Watson: first‑order autocorrelation in regression residuals.
  - Breusch–Godfrey: higher‑order serial correlation.
- **ARCH effects**
  - Engle’s ARCH test: heteroscedasticity in time‑series (finance).

---

## 13. Multiple‑Comparison and Post Hoc Procedures

This section is designed to plug directly into your app’s post hoc selection logic.
Assume a global step: (1) run appropriate omnibus test (ANOVA/Kruskal–Wallis etc.), (2) if significant, use these rules.

### 13.1 Family‑wise error rate (FWER) vs false discovery rate (FDR)

- **FWER‑controlling methods**
  - Keep probability of ≥1 type‑I error in family below \(\alpha\).
  - Examples: Bonferroni, Holm, Šidák, Tukey HSD, Scheffé, Dunnett.[web:24][web:16]
- **FDR‑controlling methods**
  - Control expected proportion of false positives among rejected hypotheses.
  - Examples: Benjamini–Hochberg, Benjamini–Yekutieli.[web:26]

### 13.2 Post hoc tests after parametric one‑way ANOVA

#### 13.2.1 Tukey’s Honest Significant Difference (HSD)

- **Use when**
  - All pairwise comparisons among k group means.
  - Equal or near‑equal group sizes and homogeneous variances.[web:14][web:16]
- **Pros**
  - Controls FWER; good balance of power and type‑I error for all pairwise comparisons.
- **When to default**
  - Exploratory all‑pairs comparison with reasonably balanced design.

#### 13.2.2 Bonferroni and Šidák corrections

- **Use when**
  - Small number of planned comparisons (not necessarily all pairs).
  - Can be applied to any individual test (t‑tests, correlations, etc.).[web:24][web:16]
- **Mechanism**
  - Adjust \(\alpha\) or p by multiplying by number of comparisons.
- **Pros/cons**
  - Simple, very conservative with many tests.

#### 13.2.3 Holm–Bonferroni (step‑down) procedure

- **Use when**
  - Want more power than Bonferroni while controlling FWER.
- **Mechanism**
  - Order p‑values from smallest to largest; compare sequentially with adjusted thresholds.

#### 13.2.4 Hochberg, Hochberg GT2, Gabriel, etc.

- **Use when**
  - Variants of step‑up/step‑down FWER controls; some tuned for different group sizes.[web:24][web:25]

#### 13.2.5 Scheffé’s method

- **Use when**
  - Need to test any possible linear contrast (including complex combinations of group means), not only pairwise.[web:24][web:35]
- **Pros/cons**
  - Very flexible but conservative; useful when contrasts are data‑driven.

#### 13.2.6 Dunnett’s test (vs control)

- **Use when**
  - Comparing each treatment group to one control group, not to each other.[web:16][web:25]
- **Variants**
  - Dunnett’s T3, Dunnett’s C for unequal variances.

#### 13.2.7 Newman–Keuls, Duncan, REGW, Waller–Duncan

- **Use when**
  - Historically common stepwise range tests; weaker FWER control; not recommended in strict confirmatory settings.[web:25][web:26]

### 13.3 Post hoc tests under heteroscedasticity

#### 13.3.1 Games–Howell test

- **Use when**
  - All pairwise comparisons.
  - Unequal variances and/or unbalanced group sizes.[web:16][web:25]
- **Pros**
  - Does not assume equal variances; uses Welch‑type t and separate df.

#### 13.3.2 Tamhane’s T2 (and related tests)

- **Use when**
  - Post hoc pairwise comparisons under unequal variances (similar role to Games–Howell).[web:25]

### 13.4 Post hoc tests for nonparametric omnibus tests

#### 13.4.1 Dunn’s test

- **Use when**
  - Post hoc for Kruskal–Wallis (or other rank‑based omnibus), with Bonferroni/Holm adjustments.[web:26][web:29]

#### 13.4.2 Conover–Iman, Nemenyi tests

- **Use when**
  - Multiple comparisons of rank sums after nonparametric omnibus.
  - Nemenyi often used after Friedman for all pairwise comparisons among conditions.

### 13.5 False discovery rate methods

#### 13.5.1 Benjamini–Hochberg (BH)

- **Use when**
  - Many parallel tests (e.g., gene expression, metabolomics), where some false positives are acceptable if controlled proportionally.[web:26]

#### 13.5.2 Benjamini–Yekutieli (BY)

- **Use when**
  - FDR control under arbitrary dependence among tests; more conservative than BH.[web:26]

### 13.6 Decision skeleton for your app (post hoc)

Pseudocode logic:

1. **If only vs‑control comparisons requested**  
   - If parametric, equal variances → Dunnett.  
   - If unequal variances → Dunnett variants or Games–Howell restricted to vs‑control.
2. **If all pairwise comparisons requested**  
   - If parametric, equal variances and roughly balanced → Tukey HSD.  
   - If parametric, unequal variances or strongly unbalanced → Games–Howell or Tamhane.  
   - If nonparametric (Kruskal–Wallis, Friedman) → Dunn / Nemenyi / Conover–Iman with Holm or BH.
3. **If custom contrasts requested**  
   - Few pre‑planned contrasts → Bonferroni or Holm.  
   - Many data‑driven contrasts → Scheffé.
4. **If high‑dimensional omics‑style testing**  
   - Use BH/BY (FDR) rather than FWER methods.

---

## 14. Robust and Specialized Tests

### 14.1 Robust tests for location

- **Trimmed‑mean tests (Yuen’s test)**
  - Use when distributions have heavy tails/outliers; trim fixed proportion from each tail.
- **Bootstrap‑based tests**
  - Use resampling to obtain empirical p‑values; robust to non‑normality and small samples.[web:10]

### 14.2 Tests for scale and dispersion

- **Brown–Forsythe and Fligner–Killeen (already noted)**
  - Prefer when variance equality is of interest under non‑normality.[web:34]
- **Siegel–Tukey test, squared ranks tests**
  - Nonparametric tests for differences in variability between groups.[web:10]

### 14.3 Permutation and randomization tests

- **Use when**
  - Distribution‑free inference by shuffling labels; flexible for complex statistics.[web:10]

### 14.4 Omics‑specific and rare‑variant tests

- **C‑alpha, SKAT, burden tests**
  - Used in genetics to test association of sets of rare variants with disease.[web:30]

---

## 15. How to Encode This in an App

For an automated assistant like your Antigravity‑based app, each test can be defined as a structure with:

- **Name**
- **Test family** (mean, proportion, variance, correlation, survival, etc.)
- **Input requirements**
  - Outcome scale, number of groups, independence/pairedness, presence of censoring/time, etc.
- **Assumptions flags**
  - Normality required? Equal variances? Proportional hazards? Stationarity? etc.
- **Pre‑checks**
  - Which diagnostics to run (Shapiro–Wilk, Levene, stationarity tests, residual plots, etc.).[web:18][web:34][web:32]
- **When‑to‑use**
  - Text blocks and machine‑readable criteria.
- **When‑to‑avoid**
  - Conditions that invalidate test.
- **Related post hoc / follow‑up tests**
  - For omnibus tests, list default and alternative procedures.

You can then implement a decision engine that:

1. Reads user design (scale, n, groups, pairedness, special structures).
2. Runs assumption checks and stores flags.
3. Filters the list of tests to those whose requirements and assumptions match.
4. Ranks candidates by power, robustness, and interpretability.
5. Returns a recommendation plus a short explanation string per test.

This document is intended as the underlying knowledge layer for such a system and can be extended with additional domain‑specific tests as your app evolves.[web:12][web:13]