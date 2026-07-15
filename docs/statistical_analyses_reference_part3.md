# Statistical Analyses — Comprehensive Implementation Reference (Part 3)

Completes the analysis menu. Companion to `curve_fitting_reference.md` (Part 1) and
`statistical_operations_reference.md` (Part 2). The list contains many duplicates and
cross-listed items; the **Coverage Map** below deduplicates everything and shows where
each analysis is specified. Items already in Part 1/2 get a pointer here; genuinely new
analyses get the full template:

**Purpose · Use cases · Inputs/Outputs · Mathematical foundation · Algorithm · Options/variants · Assumptions · Edge cases & numerics · Reporting · Library mapping.**

> **Notation:** `n`/`N` = counts; `x̄`,`ȳ` = means; `s` = sample SD; `*` multiply, `^` power, `ln` natural log, `Σ`/`Π` sum/product, `Φ⁻¹` inverse normal CDF. Per-analysis symbols defined inline.

---

## Coverage Map (deduplicated)

| Analysis | Where specified |
|----------|-----------------|
| Nonlinear regression (curve fit) | **Part 1** §6–§7 |
| Simple linear regression | **Part 1** §4.1 |
| Multiple linear regression | **Part 1** §4.2 (full treatment **here** §A.1) |
| Simple logistic regression | **Part 2** §1 |
| Multiple logistic regression | **here** §A.2 |
| Deming (Model II) regression | **Part 2** §5 |
| Cox proportional hazards | **here** §A.3 |
| One-way ANOVA (+ nonparametric / RM) | **here** §B.1 |
| Two-way ANOVA (or mixed) | **here** §B.2 |
| Three-way ANOVA (or mixed) | **here** §B.3 |
| Nested one-way ANOVA | **here** §B.4 |
| t tests (unpaired/paired + nonparametric) | **here** §C.1 |
| One-sample t / Wilcoxon | **here** §C.2 |
| Nested t test | **here** §C.3 |
| Multiple t tests (+ nonparametric) | **here** §C.4 |
| Descriptive statistics (column) | **here** §D.1 |
| Normality & lognormality tests | **here** §D.2 |
| Frequency distribution | **here** §D.3 |
| Fraction of total | **here** §D.4 |
| Compare observed vs expected distribution | **here** §D.5 |
| Identify outliers | **here** §E.1 |
| Row statistics | **Part 2** §6 |
| Prune rows | **here** §E.2 |
| Remove baseline and column math | **here** §E.3 |
| Simple survival (Kaplan–Meier) | **here** §F.1 |
| Hierarchical clustering | **here** §G.1 |
| K-means clustering | **here** §G.2 |
| Principal Component Analysis | **here** §G.3 |
| Correlation | **Part 2** §7 |
| Correlation matrix | **here** §H.1 |
| ROC curve | **here** §H.2 |
| Bland–Altman method comparison | **here** §H.3 |
| Extract and rearrange | **here** §I.1 |
| Select and transform | **here** §I.2 |
| Transform | **here** §I.3 |
| Transform concentrations (X) | **here** §I.4 |
| Normalize | **here** §I.5 |
| Transpose X and Y | **here** §I.6 |
| Fit spline / LOWESS | **Part 2** §2 |
| Smooth / differentiate / integrate | **Part 2** §3 |
| Area under curve | **Part 2** §4 |
| Interpolate a standard curve | **Part 2** §8 |
| Analyze a stack of P values | **here** §K.1 |
| **Shared:** post-hoc tests, multiple-comparison correction, effect sizes, assumption checks | **here** §L |

---

# A. Regression Analyses

### A.1 Multiple Linear Regression
(Core solver in Part 1 §4.2; full analysis spec here.)
- **Purpose:** model a continuous outcome as a linear function of **several** predictors: `y = β₀ + β₁x₁ + … + β_k x_k + ε`.
- **Use cases:** adjust for confounders; quantify each predictor's independent effect; prediction.
- **Inputs/Outputs:** design matrix X (continuous + dummy-coded categorical predictors), response y → coefficients, SEs, t/p, R²/adjusted R², F-test of overall model, ANOVA table, VIF, residual diagnostics, predictions with intervals.
- **Math/Algorithm:** OLS `β = (XᵀX)⁻¹Xᵀy` via **QR/SVD** (not direct inverse). `s² = SSR/(n−k−1)`, `Cov(β̂)=s²(XᵀX)⁻¹`. Per-coef `t = β̂ⱼ/SE`, df = n−k−1. Overall `F = (SSR_reg/k)/(SSR/(n−k−1))`.
- **Options:** interaction & polynomial terms; categorical encoding (dummy/effect); weighted/robust; regularized (ridge/lasso/elastic-net, Part 1 §4.10); stepwise/best-subset selection (use cautiously); standardized coefficients.
- **Assumptions:** linearity, independent errors, homoscedasticity, normal residuals (inference), no perfect multicollinearity.
- **Edge cases:** multicollinearity (**check VIF / condition number**); n ≤ k (under-determined → regularize); influential points (Cook's distance, leverage); categorical with rare levels.
- **Library:** `statsmodels.OLS`, `sklearn.LinearRegression`, `numpy.linalg.lstsq`.

### A.2 Multiple Logistic Regression
- **Purpose:** binary outcome as a function of **multiple** predictors: `logit(p) = β₀ + Σβⱼxⱼ`.
- **Use cases:** adjusted risk modeling; multivariable diagnostic/prognostic models; effect of one factor controlling for others.
- **Inputs/Outputs:** X (continuous + categorical), binary y → coefficients, **adjusted odds ratios** `exp(βⱼ)` + CIs, Wald/LR tests, pseudo-R², AIC/BIC, classification table, ROC/AUC, Hosmer–Lemeshow.
- **Math/Algorithm:** MLE via **IRLS** exactly as Part 2 §1 but with a wider design matrix (see that section's algorithm). `Cov(β̂)=(XᵀWX)⁻¹`.
- **Options:** interactions; categorical encoding; penalized (Firth for separation, ridge/lasso for many predictors); multinomial/ordinal extensions (Part 1 §5); probit link.
- **Assumptions:** independence, linearity of the logit in continuous predictors, no separation, low multicollinearity, sufficient **events per variable** (rule of thumb ≥ 10).
- **Edge cases:** separation → Firth; sparse cells; collinearity; class imbalance (favor AUC over accuracy).
- **Library:** `statsmodels.Logit`/`GLM(Binomial)`, `sklearn.LogisticRegression`.

### A.3 Cox Proportional Hazards Regression
- **Purpose:** relate covariates to **time-to-event** (survival) data with right-censoring, without specifying the baseline hazard shape (semi-parametric).
- **Use cases:** clinical survival with covariates (treatment, age, biomarkers); reliability; any censored time-to-event modeling.
- **Inputs/Outputs:** per subject: follow-up time `t`, event indicator (1 = event, 0 = censored), covariates `x`. → coefficients `β`, **hazard ratios** `HR = exp(β)` + CIs, Wald/LR/score tests, concordance (**C-index**), baseline cumulative hazard/survival, Schoenfeld-residual PH check, adjusted survival curves.
- **Math:** hazard `h(t|x) = h₀(t)·exp(βᵀx)`; the baseline `h₀(t)` cancels in the **partial likelihood**:
  ```
  PL(β) = Π_{events i} [ exp(βᵀx_i) / Σ_{j ∈ R(t_i)} exp(βᵀx_j) ]
  ```
  where `R(t_i)` = risk set (subjects still at risk at event time tᵢ).
- **Algorithm:**
  1. Sort by time; build risk sets.
  2. Maximize the **log partial likelihood** by Newton–Raphson (compute score vector and observed information from the risk-set sums); iterate to convergence.
  3. Handle tied event times: **Efron** (default, accurate), Breslow (fast), or exact.
  4. SEs from the inverse information matrix; HR CIs = `exp(β̂ ± z·SE)`.
  5. Estimate baseline survival via **Breslow estimator**; check PH via **Schoenfeld residuals** (correlation of scaled residuals with time should be ~0).
- **Options:** stratified Cox (different baseline per stratum); time-dependent covariates; frailty (random effects); penalized Cox (ridge/lasso for high-dimensional); competing risks (Fine–Gray).
- **Assumptions:** **proportional hazards** (HR constant over time), independent censoring (non-informative), correct functional form, no severe collinearity.
- **Edge cases:** PH violation → stratify or add time-interaction; few events per covariate → overfitting; complete separation; all-censored covariate levels.
- **Library:** `lifelines.CoxPHFitter`, `statsmodels` PHReg, `scikit-survival`.

---

# B. ANOVA & Mixed-Model Analyses

General reporting for all ANOVAs: source table (SS, df, MS, F, p), effect sizes
(η², partial η², ω²), assumption checks (§L.4), and post-hoc multiple comparisons (§L.1–L.2).

### B.1 One-Way ANOVA (and nonparametric / repeated-measures / mixed)
- **Purpose:** compare the means of **3+ groups** defined by one categorical factor.
- **Use cases:** several treatments vs control; dose levels; multiple conditions.
- **Inputs/Outputs:** grouped values → F, p, SS partition, group means/CIs, effect size, post-hoc comparisons.
- **Math (ordinary):** `SS_between = Σ nᵢ(x̄ᵢ − x̄)²` (df = k−1); `SS_within = ΣΣ(xᵢⱼ − x̄ᵢ)²` (df = N−k); `F = MS_between / MS_within`.
- **Algorithm:** compute group/grand means → SS_between, SS_within → MS → F → p from F-distribution → if significant, run post-hoc.
- **Variants:**
  - **Welch's ANOVA** — unequal variances (recommended default when variances differ).
  - **Brown–Forsythe** — robust to variance heterogeneity.
  - **Repeated-measures ANOVA** — same subjects across conditions (within-subject factor); requires **sphericity** (Mauchly's test; Greenhouse–Geisser / Huynh–Feldt corrections).
  - **Nonparametric:** **Kruskal–Wallis** (independent groups, ranks): `H = [12/(N(N+1))]·Σ(Rᵢ²/nᵢ) − 3(N+1)`, ~χ²(k−1); post-hoc **Dunn's test**. **Friedman test** (repeated measures, ranks); post-hoc Nemenyi/Dunn.
  - **Mixed model** — unbalanced/missing data, random effects (better than RM-ANOVA when data are missing).
- **Post-hoc:** Tukey HSD (all pairs), Dunnett (vs control), Šidák/Bonferroni/Holm, Dunn's (nonparametric). See §L.
- **Assumptions:** independence; normality of residuals; homogeneity of variance (Levene/Brown–Forsythe); (RM) sphericity.
- **Edge cases:** unequal n (use Welch/Type III); variance heterogeneity → Welch/nonparametric; non-normal small samples → Kruskal–Wallis; missing RM data → mixed model.
- **Library:** `scipy.stats.f_oneway`/`kruskal`/`friedmanchisquare`, `statsmodels` (`anova_lm`, `MixedLM`, `AnovaRM`), `pingouin` (`anova`, `welch_anova`, `rm_anova`, post-hocs), `scikit-posthocs` (Dunn/Nemenyi).

### B.2 Two-Way ANOVA (or mixed model)
- **Purpose:** effects of **two** categorical factors (A, B) and their **interaction** on a continuous outcome.
- **Use cases:** treatment × time; genotype × diet; any 2-factor design.
- **Math:** partition total SS into `SS_A`, `SS_B`, `SS_AB` (interaction), `SS_error`; F-test each effect against the error MS (or appropriate term in mixed designs).
- **Algorithm:** fit the cell-means / factorial linear model; compute SS per term; F = MS_term/MS_error; p from F.
- **Options/variants:** **balanced vs unbalanced** → choose Type I/II/III sums of squares (Type III for unbalanced with interaction); **repeated measures** on one or both factors (within-subject) → mixed model; random vs fixed factors; marginal means (EMMs) and interaction plots.
- **Post-hoc:** comparisons of main-effect means and **simple effects** within interaction (Tukey/Šidák/Bonferroni); test interaction first to decide interpretation.
- **Assumptions:** as one-way, per cell; plus correct SS type for unbalanced data; (RM) sphericity.
- **Edge cases:** empty/sparse cells; unbalanced design (SS type matters); significant interaction → interpret simple effects, not main effects alone.
- **Library:** `statsmodels` (`ols` + `anova_lm(typ=2/3)`, `MixedLM`), `pingouin.anova`/`mixed_anova`.

### B.3 Three-Way ANOVA (or mixed model)
- **Purpose:** three factors (A, B, C) plus all two-way (AB, AC, BC) and the **three-way** (ABC) interactions.
- **Use cases:** complex factorial experiments (e.g., drug × dose × time).
- **Math/Algorithm:** factorial linear model with 7 effect terms + error; SS/df/MS/F per term; same Type I/II/III considerations.
- **Options:** repeated measures / mixed; collapse higher-order interactions if non-significant; EMMs.
- **Assumptions/Edge cases:** same as two-way; **interpretation complexity** rises sharply (start from the highest-order significant interaction); needs adequate n per cell; high risk of empty cells.
- **Library:** `statsmodels` (`ols` + `anova_lm`), `pingouin`.

### B.4 Nested (Hierarchical) One-Way ANOVA
- **Purpose:** factor of interest with **subgroups nested within** each level (e.g., animals within treatment, wells within animal). Avoids **pseudoreplication** by treating subgroups as a (usually random) nested factor.
- **Use cases:** technical replicates within biological replicates; multi-level sampling.
- **Math:** partition variance: **between groups**, **between subgroups within groups**, **within subgroups (residual)**. The main-factor F uses the **subgroup MS as the error term** (not residual MS): `F = MS_group / MS_subgroup(group)`.
- **Algorithm:** fit a mixed model with the nested factor as a random effect (or compute the nested SS partition and form F with the correct error MS); estimate variance components (REML).
- **Options:** balanced vs unbalanced (use REML mixed model); multiple nesting levels.
- **Assumptions:** normality, independence at each level; correctly specified nesting; (random effects) normal random effects.
- **Edge cases:** using residual instead of subgroup MS = the classic pseudoreplication error; few subgroups → low power for the main factor.
- **Library:** `statsmodels.MixedLM`, `pingouin`, R-style `lme4` if available.

---

# C. t Tests & Nonparametric Tests

Shared reporting: test statistic, df, p (one/two-tailed), CI of the difference,
**effect size** (Cohen's d / rank-biserial), and an assumption/normality note (§L.4).

### C.1 t Tests (two groups) and Nonparametric Equivalents
- **Purpose:** compare a continuous outcome between **two** groups (independent or paired).
- **Use cases:** treatment vs control; before vs after.
- **Variants & math:**
  - **Unpaired (Student's, pooled):** `t = (x̄₁−x̄₂) / (s_p·sqrt(1/n₁+1/n₂))`, `s_p² = [(n₁−1)s₁²+(n₂−1)s₂²]/(n₁+n₂−2)`, df = n₁+n₂−2.
  - **Welch's unpaired (unequal variances, recommended default):** `t = (x̄₁−x̄₂)/sqrt(s₁²/n₁+s₂²/n₂)`, Welch–Satterthwaite df.
  - **Paired:** apply one-sample t to the differences `d`: `t = d̄/(s_d/sqrt(n))`, df = n−1.
  - **Mann–Whitney U** (unpaired nonparametric): rank all values, `U` from rank sums; tests distribution/median shift.
  - **Wilcoxon matched-pairs signed-rank** (paired nonparametric): rank `|differences|`, sum signed ranks.
- **Algorithm:** check normality/variance (§L.4) → choose parametric vs nonparametric, pooled vs Welch → compute statistic, df, p, CI, effect size.
- **Options:** one- vs two-tailed; equal-variance vs Welch; exact vs normal-approximation p for rank tests (ties correction); Hodges–Lehmann estimator for nonparametric location shift.
- **Assumptions:** independence; (parametric) approximate normality of each group / of differences; Student's adds equal variances; rank tests need only ordinal data.
- **Edge cases:** unequal variances → Welch; small non-normal samples → rank tests; many ties → tie-corrected rank stats; paired data analyzed as unpaired (wrong) inflates error.
- **Library:** `scipy.stats.ttest_ind` (`equal_var=False` for Welch), `ttest_rel`, `mannwhitneyu`, `wilcoxon`; `pingouin.ttest` (gives CI + effect size).

### C.2 One-Sample t and Wilcoxon Test
- **Purpose:** test whether a single sample's **mean (t)** or **median (Wilcoxon)** equals a hypothesized value `μ₀`.
- **Use cases:** compare to a known standard, theoretical value, or zero change.
- **Math:** **t:** `t = (x̄ − μ₀)/(s/sqrt(n))`, df = n−1, CI = `x̄ ± t_{α/2}·s/sqrt(n)`. **Wilcoxon signed-rank:** rank `|xᵢ − μ₀|`, sum ranks by sign of deviation; compare to its null distribution.
- **Algorithm:** (t) compute t, df, p, CI. (Wilcoxon) compute signed-rank statistic, exact/approx p; report Hodges–Lehmann median estimate.
- **Options:** one/two-tailed; exact vs approximate (Wilcoxon); normality check to choose between them.
- **Assumptions:** (t) approximate normality; (Wilcoxon) symmetric distribution about the median.
- **Edge cases:** values equal to μ₀ (zeros) in Wilcoxon → drop or use a zero-handling method; small n; heavy skew → Wilcoxon.
- **Library:** `scipy.stats.ttest_1samp`, `wilcoxon`; `pingouin.ttest`.

### C.3 Nested t Test
- **Purpose:** compare **two groups** when observations are **nested** in subgroups (e.g., cells within animals across two treatments). Two-group analog of nested ANOVA.
- **Use cases:** technical replicates within subjects; avoids pseudoreplication for two-group comparisons.
- **Math/Algorithm:** fit a **mixed model** with the subgroup as a random effect and the two-level group as a fixed effect; the group effect is tested using **subgroup-level variation** as the error (equivalently, nested ANOVA with k=2).
- **Assumptions:** normality at each level; correct nesting; normal random effects.
- **Edge cases:** treating replicates as independent (pseudoreplication) overstates significance; few subgroups → low power.
- **Library:** `statsmodels.MixedLM`, `pingouin`.

### C.4 Multiple t Tests (and nonparametric)
- **Purpose:** run **many two-group comparisons** at once (e.g., one per row/variable/gene) and **correct for multiplicity**.
- **Use cases:** screening high-dimensional data (omics), many endpoints.
- **Algorithm:**
  1. For each row/variable, run the chosen test (Welch/Student t, paired t, or Mann–Whitney) → raw p-value and effect size.
  2. **Adjust p-values across the whole stack** for multiplicity (§L.2): **Benjamini–Hochberg FDR** (default for discovery), Holm–Šidák, or Bonferroni (strict FWER).
  3. Report per-row statistic, raw p, adjusted p / q-value, effect size; flag the significant set.
- **Options:** test type; correction method; FDR vs FWER; volcano-plot outputs (effect size vs −log₁₀ p).
- **Assumptions:** per-test assumptions (C.1); independence or known dependence structure for the correction.
- **Edge cases:** rows with too few values → skip/flag; consistent test choice across rows; very small p underflow → work in log space.
- **Library:** loop `scipy.stats` tests + `statsmodels.stats.multitest.multipletests`; `pingouin.multicomp`.

---

# D. Descriptive, Distribution & Normality

### D.1 Descriptive Statistics (Column)
- **Purpose:** summarize each **column** (variable). (Row analog = Part 2 §6.)
- **Use cases:** data overview, reporting tables, QC.
- **Statistics:** n, missing count, mean, median, mode, SD, variance, SEM, 95% CI of mean, min, max, range, sum, sum of squares, quartiles (Q1/Q3), IQR, percentiles, **%CV**, **geometric mean** + geometric SD (positive data), harmonic mean, **skewness** `g₁ = (1/n)Σ(xᵢ−x̄)³ / s³`, **kurtosis** (excess) `g₂ = (1/n)Σ(xᵢ−x̄)⁴ / s⁴ − 3`.
- **Algorithm:** drop missing per column → compute (use Welford for stable mean/variance) → assemble summary table. Optionally attach a normality test (D.2).
- **Options:** sample vs population SD; which stats to show; per-group descriptives.
- **Edge cases:** n<2 (SD/SEM undefined); geometric/harmonic require positive values; skew/kurtosis unstable for small n; multimodal → mode ambiguous.
- **Library:** `pandas.describe`, `scipy.stats` (`skew`, `kurtosis`, `gmean`, `variation`, `iqr`, `sem`).

### D.2 Normality & Lognormality Tests
- **Purpose:** assess whether data plausibly come from a normal (or, after log, lognormal) distribution — to justify parametric tests.
- **Use cases:** assumption checking before t/ANOVA/regression.
- **Tests (compute several):**
  - **Shapiro–Wilk** — powerful general test (best for small–moderate n).
  - **D'Agostino–Pearson omnibus (K²)** — combines skewness and kurtosis z-scores: `K² = Z(skew)² + Z(kurt)²`, ~χ²(2). (GraphPad default.)
  - **Anderson–Darling** — emphasizes tails.
  - **Kolmogorov–Smirnov / Lilliefors** — CDF distance (Lilliefors corrects for estimated parameters).
  - **Shapiro–Francia** — for larger n.
- **Lognormality:** apply the same tests to `ln(data)` (requires positive values); compare which fits better.
- **Algorithm:** run the chosen test(s) → statistic + p (H₀ = normal; small p ⇒ reject normality); also produce a **Q–Q plot** (most informative diagnostic).
- **Options:** test selection; normal vs lognormal comparison; per-group testing.
- **Edge cases:** **large n** → trivial deviations become "significant" (rely on Q–Q plot + effect size); very small n → low power (can't confirm normality); ties; non-positive values block lognormal test.
- **Library:** `scipy.stats` (`shapiro`, `normaltest` = D'Agostino, `anderson`, `kstest`), `statsmodels` (`lilliefors`), `scipy.stats.probplot` for Q–Q.

### D.3 Frequency Distribution
- **Purpose:** tabulate how values fall into **bins** (histogram); the basis for distribution visualization.
- **Use cases:** see data shape; histograms; compare distributions.
- **Algorithm:**
  1. Choose bin width / count: **Sturges** `ceil(log₂ n + 1)`, **Scott** width `3.49·s·n^(−1/3)`, **Freedman–Diaconis** width `2·IQR·n^(−1/3)`, or user-specified.
  2. Define bin edges; assign each value to a bin (handle edge inclusivity consistently).
  3. Count per bin → optionally **relative frequency** (count/n), **cumulative**, **cumulative %**.
- **Options:** bin rule/width/anchor; absolute vs relative vs cumulative; density normalization; overlay a fitted normal/curve.
- **Edge cases:** outliers create long empty tails; too few/many bins mislead; values exactly on edges; open-ended first/last bins.
- **Library:** `numpy.histogram` (with `bins='fd'/'scott'/'sturges'`), `pandas.cut`.

### D.4 Fraction of Total
- **Purpose:** express each value as a **fraction or percentage of a total** (row total, column total, grand total, or a selected subset).
- **Use cases:** compositional data, proportions, stacked-bar inputs, normalizing to a sum.
- **Algorithm:** choose the denominator scope (row/column/grand) → `fraction = value / total`; optionally ×100 for %; optionally running/cumulative fraction.
- **Options:** scope of total; fraction vs percent; cumulative.
- **Edge cases:** total = 0 → undefined (guard); negative values make "fraction of total" ambiguous; missing values in the sum.
- **Library:** `pandas` (`df.div(df.sum(axis=...), axis=...)`).

### D.5 Compare Observed Distribution with Expected (Goodness-of-Fit)
- **Purpose:** test whether observed **categorical counts** match an expected distribution/proportions.
- **Use cases:** Mendelian ratios; expected vs observed category frequencies; fair-die / equal-proportion tests; distribution fit.
- **Tests & math:**
  - **Chi-square goodness-of-fit:** `χ² = Σ (Oᵢ − Eᵢ)² / Eᵢ`, df = (categories − 1 − #estimated params); needs expected counts (rule of thumb Eᵢ ≥ 5).
  - **G-test (likelihood-ratio):** `G = 2·Σ Oᵢ·ln(Oᵢ/Eᵢ)`.
  - **Binomial / multinomial exact test** — small samples, two/several categories.
  - **Kolmogorov–Smirnov (one-sample)** — continuous data vs a theoretical CDF.
- **Algorithm:** specify expected proportions → expected counts `Eᵢ = N·pᵢ` → compute statistic → p from χ²/exact distribution.
- **Options:** chi-square vs G-test vs exact; continuity correction (2 categories); KS for continuous.
- **Edge cases:** small expected counts (use exact/G-test, or pool categories); df adjustment when parameters are estimated from the data; zero observed counts.
- **Library:** `scipy.stats.chisquare`, `power_divergence` (G-test via `lambda_='log-likelihood'`), `binomtest`, `multinomial`, `kstest`.

---

# E. Outliers & Row/Column Operations

### E.1 Identify Outliers
- **Purpose:** detect (and optionally remove) values inconsistent with the rest.
- **Use cases:** clean assay data, QC, pre-analysis screening.
- **Methods & math:**
  - **Grubbs' test** (assumes normality): `G = max|xᵢ − x̄| / s`; compare to a critical value; **iterative** Grubbs removes one at a time. Variants for one/two-sided and for both extremes.
  - **Generalized ESD (Rosner)** — multiple outliers, controls for masking.
  - **ROUT** (GraphPad's method) — fit by robust regression, then identify outliers via an **FDR (Q) threshold** on residuals; good for curve data and multiple outliers.
  - **Dixon's Q test** — small samples (n ≤ ~30).
  - **Tukey's fences (IQR):** outside `[Q1 − 1.5·IQR, Q3 + 1.5·IQR]` (3×IQR for "far out"). Distribution-free.
  - **Z-score / modified z-score (MAD-based):** `Mᵢ = 0.6745·(xᵢ − median)/MAD`, flag |Mᵢ| > 3.5 (robust).
- **Algorithm:** pick method → compute statistic/threshold → flag (and optionally exclude, with logging) → re-report with/without outliers.
- **Options:** method; significance/Q level; one vs two extremes; remove vs flag-only.
- **Edge cases:** outlier removal is consequential — **always log and report**; masking/swamping with multiple outliers (use ESD/ROUT); small n (Grubbs/Dixon); non-normal data (use IQR/MAD); don't remove just because a value is inconvenient.
- **Library:** `scipy.stats` (`zscore`), `statsmodels`/`outlier_utils` for Grubbs/ESD, custom ROUT, `numpy` for IQR/MAD.

### E.2 Prune Rows
- **Purpose:** reduce/clean a dataset by **removing rows** by rule.
- **Use cases:** thin dense time series, drop incomplete rows, subsample, deduplicate.
- **Operations:** keep every Nth row; remove rows with any/all missing values; remove rows outside an x/value range; remove duplicates; random subsample (seeded); average groups of adjacent rows (smoothing/decimation).
- **Algorithm:** apply the selected predicate/rule to the row index → produce the reduced table; record what was removed.
- **Edge cases:** preserve column alignment; reproducible random seed; don't silently drop data (report counts).
- **Library:** `pandas` (`iloc[::N]`, `dropna`, `drop_duplicates`, `sample`, boolean masks).

### E.3 Remove Baseline and Column Math
- **Purpose:** (a) **baseline/background subtraction** and (b) **arithmetic between columns**.
- **Use cases:** subtract blank/control; background correction; compute ratios/differences; unit conversions.
- **Operations:**
  - **Baseline:** subtract a constant, a baseline **column**, the mean of selected baseline rows/region, or a fitted baseline (spline, Part 2 §2). Optional: subtract then take % of baseline.
  - **Column math:** `A−B`, `A+B`, `A×B`, `A/B`, `(A−B)/C`, log/ratio of columns, normalize one column by another, row-wise operations across selected columns.
- **Algorithm:** define operands and operator → element-wise computation → output new column(s).
- **Edge cases:** divide-by-zero (guard); mismatched lengths/missing values (pairwise); subtracting noisy single-point baselines (prefer averaged/fitted baseline).
- **Library:** `pandas`/`numpy` vectorized arithmetic.

---

# F. Survival Analyses

### F.1 Simple Survival Analysis (Kaplan–Meier)
- **Purpose:** estimate the **survival function** `S(t)` (probability of surviving past t) from right-censored time-to-event data, and compare survival between groups.
- **Use cases:** clinical trials (overall/progression-free survival), reliability/time-to-failure, churn.
- **Inputs/Outputs:** per subject: time `t`, status (1 = event, 0 = censored), optional group. → KM survival curve (step function with censoring ticks), median survival + CI, survival at chosen times, group comparison test (log-rank), hazard ratio.
- **Math (KM estimator):**
  ```
  S(t) = Π_{t_i ≤ t} ( 1 − d_i / n_i )
  ```
  where at each event time `t_i`: `d_i` = events, `n_i` = number still at risk. **Greenwood's formula** for variance:
  ```
  Var(S(t)) = S(t)² · Σ_{t_i ≤ t} d_i / [ n_i (n_i − d_i) ]
  ```
- **Algorithm:**
  1. Sort distinct event times; at each, count `d_i` (events) and `n_i` (at risk = not yet failed/censored).
  2. Multiply survival factors cumulatively → `S(t)` step function; censored subjects reduce `n_i` but don't drop S.
  3. CIs via Greenwood (often log–log transform for valid [0,1] bounds).
  4. **Median survival** = smallest t with `S(t) ≤ 0.5`.
- **Group comparison:**
  - **Log-rank (Mantel–Cox)** test: compare observed vs expected events across groups at each event time → `χ² = (O−E)²/V`, df = groups−1. Weights all times equally.
  - **Gehan–Breslow–Wilcoxon:** weights early time points more.
  - **Hazard ratio** estimate (or fit Cox §A.3 for adjusted HR).
- **Options:** survival vs cumulative-incidence display; CI method; log-rank vs Wilcoxon-type; trend test for ordered groups; competing risks (cumulative incidence function).
- **Assumptions:** **non-informative (independent) censoring**; consistent event definition; (log-rank for group comparison shares Cox's proportional-hazards premise for interpretation).
- **Edge cases:** heavy censoring → unstable tails / undefined median; ties in time; very small risk sets at late times; crossing survival curves → log-rank underpowered (use Wilcoxon-type or restricted mean survival time).
- **Library:** `lifelines` (`KaplanMeierFitter`, `logrank_test`), `scikit-survival`.

---

# G. Clustering & Dimensionality Reduction

Pre-step for G.1–G.3: **standardize/scale** variables (z-score) so no variable dominates by units; choose a distance metric appropriate to the data.

### G.1 Hierarchical Clustering
- **Purpose:** build a **tree (dendrogram)** of nested clusters by iteratively merging the closest groups (agglomerative).
- **Use cases:** gene-expression heatmaps, sample/feature grouping, exploratory structure.
- **Inputs/Outputs:** data matrix (or precomputed distance matrix), distance metric, linkage → dendrogram + linkage matrix; flat clusters by cutting the tree at a height or target count.
- **Algorithm (agglomerative):**
  1. Start: each object is its own cluster.
  2. Compute the pairwise **distance matrix** (Euclidean, Manhattan, correlation/1−r, cosine, etc.).
  3. Repeatedly merge the two closest clusters; update distances via the **Lance–Williams** update according to the chosen linkage.
  4. Record merges and heights → dendrogram. Cut to obtain flat clusters.
- **Linkage methods:** single (min; chaining-prone), complete (max; compact), **average (UPGMA)**, **Ward's** (minimizes within-cluster variance; popular), centroid/median.
- **Options:** metric × linkage combination; number of clusters / cut height; row & column clustering for heatmaps; cophenetic correlation to assess fidelity.
- **Assumptions:** meaningful distance metric; scaling done; (Ward/centroid) Euclidean-type distances.
- **Edge cases:** sensitive to metric/linkage choice; single-linkage chaining; O(n²) memory for the distance matrix (large n); mixed-type variables need a suitable metric (e.g., Gower).
- **Library:** `scipy.cluster.hierarchy` (`linkage`, `dendrogram`, `fcluster`), `seaborn.clustermap`.

### G.2 K-Means Clustering
- **Purpose:** partition data into **k** clusters minimizing within-cluster sum of squares (WCSS).
- **Use cases:** segment data into a fixed number of groups; vector quantization.
- **Algorithm (Lloyd's):**
  1. Choose `k`; initialize centroids with **k-means++** (spreads initial centers; more reliable than random).
  2. **Assign** each point to its nearest centroid (Euclidean).
  3. **Update** each centroid to the mean of its assigned points.
  4. Repeat 2–3 until assignments/centroids stabilize (or max iterations); run **multiple restarts**, keep the lowest WCSS.
- **Choosing k:** **elbow** (WCSS vs k), **silhouette** score, gap statistic.
- **Options:** k; init method; n_init restarts; distance (variants: k-medoids/PAM for robustness, k-medians for L1).
- **Assumptions:** roughly spherical, similarly-sized clusters; scaled features; Euclidean geometry.
- **Edge cases:** sensitive to scaling and init; struggles with non-globular/varying-density clusters (use DBSCAN/GMM); empty clusters; outliers pull centroids (consider k-medoids); k must be chosen a priori.
- **Library:** `sklearn.cluster.KMeans` (with `init='k-means++'`, `n_init`), `sklearn.metrics.silhouette_score`.

### G.3 Principal Component Analysis (PCA)
- **Purpose:** reduce dimensionality by finding orthogonal directions (**principal components**) capturing maximal variance; for visualization, denoising, and as a preprocessing step.
- **Use cases:** explore multivariate structure, reduce correlated predictors (→ PCR, Part 1 §4.11), 2-D/3-D projection of high-dimensional data.
- **Inputs/Outputs:** numeric data matrix → eigenvalues (variance per PC), **loadings** (eigenvectors), **scores** (projected data), proportion/cumulative variance explained, scree plot, biplot.
- **Algorithm:**
  1. **Center** each variable (subtract mean); **scale** to unit variance if variables have different units (→ correlation-matrix PCA).
  2. Compute the covariance (or correlation) matrix **or** apply **SVD** to the centered/scaled data (SVD is the numerically preferred route).
  3. Eigen-decomposition → eigenvalues (sorted descending) and eigenvectors.
  4. **Scores** = data projected onto the leading eigenvectors; **variance explained** = eigenvalue / Σeigenvalues.
  5. Retain components by cumulative variance (e.g., ≥ 80–90%), scree-plot elbow, or eigenvalue > 1 (Kaiser).
- **Options:** covariance vs correlation PCA (scale or not); number of components; rotation (varimax) for interpretability; robust/sparse PCA variants.
- **Assumptions:** linear relationships; variance = importance; large-variance directions are meaningful; (interpretation) approximately continuous data.
- **Edge cases:** **must scale** when units differ; sensitive to outliers (robust PCA); sign of components is arbitrary; not ideal for nonlinear structure (consider t-SNE/UMAP for visualization only); missing values need imputation first.
- **Library:** `sklearn.decomposition.PCA`, `numpy.linalg.svd`, `statsmodels` PCA.

---

# H. Correlation & Multivariate Relationships

(Pairwise correlation between two variables = Part 2 §7.)

### H.1 Correlation Matrix
- **Purpose:** compute **all pairwise correlations** among many variables, with significance.
- **Use cases:** screen relationships across many variables; correlation heatmaps; multicollinearity check.
- **Algorithm:** choose coefficient (Pearson/Spearman/Kendall, Part 2 §7) → for every variable pair compute coefficient + p-value (pairwise-complete observations) → assemble coefficient matrix and p-value matrix → **adjust p-values for multiple comparisons** (§L.2) → visualize as heatmap.
- **Options:** coefficient type; pairwise vs listwise deletion; correction method; ordering (cluster the matrix); partial-correlation matrix (precision matrix).
- **Assumptions/Edge cases:** per-pair assumptions of the chosen coefficient; many pairs ⇒ multiplicity (correct p-values); differing n per pair under pairwise deletion; near-constant variables → undefined correlations.
- **Library:** `pandas.DataFrame.corr`, `numpy.corrcoef`, `scipy.stats` per pair, `pingouin.pairwise_corr` (includes p-values + correction).

### H.2 ROC Curve
- **Purpose:** evaluate a **continuous test/score** for classifying a **binary outcome** across all thresholds; summarize discrimination by **AUC**.
- **Use cases:** diagnostic-test accuracy, biomarker evaluation, classifier assessment, optimal-cutoff selection.
- **Inputs/Outputs:** test values + true binary labels → ROC curve (sensitivity vs 1−specificity), **AUC** + CI, optimal cutoff, sensitivity/specificity/PPV/NPV/likelihood ratios at chosen cutoffs.
- **Math/Algorithm:**
  1. Sort observations by test value; sweep the decision **threshold** from high to low.
  2. At each threshold compute **TPR (sensitivity)** = TP/(TP+FN) and **FPR (1−specificity)** = FP/(FP+TN).
  3. Plot TPR vs FPR → ROC curve; **AUC** = area under it (trapezoidal). AUC = probability the test ranks a random positive above a random negative (equals the Mann–Whitney statistic / n₁n₂).
  4. **Optimal cutoff:** maximize **Youden's J = sensitivity + specificity − 1** (or closest-to-(0,1)); report the corresponding metrics.
- **Options:** AUC CI method (**DeLong**, bootstrap); compare two ROC curves (DeLong test); partial AUC; cost-weighted cutoff; precision–recall curve for imbalanced data.
- **Assumptions:** meaningful ordinal/continuous score; correct labels; (single test) one value per subject.
- **Edge cases:** ties in scores (step handling); class imbalance (AUC can look good while PPV is poor → also report PR curve); very small samples → wide AUC CI; cutoff chosen on the same data is optimistic (validate).
- **Library:** `sklearn.metrics` (`roc_curve`, `roc_auc_score`), `scipy.stats.mannwhitneyu` (AUC link), DeLong via `pingouin`/custom.

### H.3 Bland–Altman Method Comparison
- **Purpose:** assess **agreement** between two measurement methods (not correlation — agreement). Complements Deming (Part 2 §5).
- **Use cases:** does a new assay/instrument agree with a reference? Interchangeability of methods.
- **Inputs/Outputs:** paired measurements `A`, `B` → bias, **limits of agreement (LoA)**, Bland–Altman plot, proportional-bias check.
- **Math/Algorithm:**
  1. For each pair compute **difference** `d = A − B` and **mean** `m = (A + B)/2`.
  2. **Bias** = mean of differences `d̄`; **SD** of differences `s_d`.
  3. **Limits of agreement** = `d̄ ± 1.96·s_d` (95% of differences expected within).
  4. Plot `d` vs `m`; add bias and LoA lines; report CIs for bias and LoA.
  5. **Proportional bias:** regress `d` on `m`; a nonzero slope indicates bias that varies with magnitude.
- **Options:** absolute vs **percentage** differences (when variability scales with magnitude); log-transform before analysis; repeated-measures version; CI on LoA.
- **Assumptions:** differences approximately normal and constant across the range (else use %/log version); paired measurements of the same quantity.
- **Edge cases:** proportional bias (use ratio/log); few points → unstable LoA; outliers widen LoA; correlation/r² is **not** a measure of agreement (don't substitute).
- **Library:** `statsmodels` / `pingouin` (`plot_blandaltman`), or compute directly with `numpy`.

---

# I. Data Extraction, Selection & Transformation

These are data-shaping utilities (not inferential tests) but essential plumbing for the program. Keep them as composable operations producing new tables.

### I.1 Extract and Rearrange
- **Purpose:** pull a **subset** of data and/or **reshape** the table (rearrange columns, groups, replicates; wide↔long).
- **Use cases:** restructure for a specific analysis; pull selected groups/columns; reshape replicate layouts.
- **Operations:** select columns/groups/ranges; reorder; **pivot/melt** between wide and long; split/combine subcolumns; extract by index or label.
- **Edge cases:** preserve labels and pairing; handle ragged/missing entries; duplicate keys on pivot.
- **Library:** `pandas` (`loc/iloc`, `pivot`, `melt`, `stack/unstack`, `reindex`).

### I.2 Select and Transform
- **Purpose:** **filter** rows/columns by criteria, then apply a transform to the selection.
- **Use cases:** transform only a subset (e.g., log only positive values; rescale one group).
- **Algorithm:** build a selection mask (by value, range, label, missingness) → apply the chosen transform (I.3) to the selected cells → output.
- **Edge cases:** selection that excludes all data; transform invalid on some selected values (e.g., log of ≤0).
- **Library:** `pandas` boolean indexing + `apply`/vectorized functions.

### I.3 Transform
- **Purpose:** apply a **mathematical function** to data (column- or cell-wise) to linearize, stabilize variance, or change units.
- **Common transforms:** `log10`, `ln`, `log2`, `sqrt`, reciprocal `1/Y`, square `Y²`, power `Y^k`, `exp`, antilog (`10^Y`, `e^Y`), z-score `(Y−mean)/SD`, logit, Box–Cox / Yeo–Johnson, trig (sin/cos/tan), absolute value, add/multiply by a constant, custom `Y' = f(Y)`.
- **Algorithm:** validate domain (e.g., positivity for log/sqrt) → apply element-wise → output transformed column; optionally remember the transform for back-transformation/interpolation.
- **Use cases:** make data normal/homoscedastic before parametric tests; linearize relationships (Part 1 §4.13); unit conversion.
- **Edge cases:** domain errors (log/sqrt of ≤0, reciprocal of 0) → guard/flag; transforming changes interpretation and error structure; keep an inverse transform for reporting on the original scale.
- **Library:** `numpy` ufuncs, `scipy.stats.boxcox`/`yeojohnson`.

### I.4 Transform Concentrations (X)
- **Purpose:** specialized **X-axis transforms for dose–response** setup.
- **Use cases:** convert concentration to **log(concentration)** (the usual x for sigmoidal dose–response, Part 1 §7.4 / Part 2 §8); convert to **−log** units (e.g., pIC50/pEC50/pH = −log₁₀[concentration]); antilog back to linear.
- **Operations:** `log10(X)`, `ln(X)`, `−log10(X)` (p-scale), `X = 10^(−value)` (from p-scale back to concentration), unit scaling (e.g., M↔nM via multiply), handle `X = 0` (log undefined — drop, offset, or treat as a separate "no-drug" point).
- **Algorithm:** apply chosen X transform; carry units; record it so interpolated/EC50 results can be reported on the desired scale.
- **Edge cases:** **X = 0** cannot be log-transformed (common pitfall) — exclude or special-case; consistent log base; mixing molar/mass units.
- **Library:** `numpy` log/exp; custom unit handling.

### I.5 Normalize
- **Purpose:** rescale data to a common scale for comparison across datasets/runs.
- **Use cases:** express as **% of control/max**; put assays on 0–100%; standardize before clustering/PCA.
- **Methods:**
  - **Min–max to [0,1] or 0–100%:** `(Y − min)/(max − min)`; or define **0%** and **100%** from chosen control values/rows.
  - **Percent of a control/reference** value or column.
  - **Percent of row/column sum** (= Fraction of Total ×100, D.4).
  - **Z-score standardization:** `(Y − mean)/SD`.
  - **Divide by a baseline/first value** (fold-change).
- **Algorithm:** choose reference (min/max, control, sum, mean/SD) → apply formula per the chosen scope (row/column/whole) → output normalized data.
- **Edge cases:** define what 0% and 100% mean explicitly; max = min → divide-by-zero; outliers distort min–max (z-score more robust); control value missing/zero.
- **Library:** `sklearn.preprocessing` (`MinMaxScaler`, `StandardScaler`), `pandas` arithmetic.

### I.6 Transpose X and Y
- **Purpose:** **swap rows and columns** of a table, or swap which variable is treated as X vs Y.
- **Use cases:** reorient data for an analysis expecting a particular layout; flip independent/dependent roles (e.g., to interpolate Y-from-X instead of X-from-Y).
- **Algorithm:** matrix transpose (rows↔columns), carrying headers/labels appropriately; or relabel X/Y roles for downstream fitting.
- **Edge cases:** label/group metadata must follow the transpose; ragged tables; mixed data types per row after transpose.
- **Library:** `pandas.DataFrame.T`, `numpy.transpose`.

---

# K. Miscellaneous / P-Value Stacks

### K.1 Analyze a Stack of P Values
- **Purpose:** take a **collection of p-values** from independent analyses and either **combine** them (meta-analytic evidence) or **correct** them for multiplicity.
- **Use cases:** combine evidence across independent studies/tests; apply FDR/FWER across many results; summarize a screen.
- **Methods & math:**
  - **Combine (meta-analysis of p-values):**
    - **Fisher's method:** `X² = −2·Σ ln(pᵢ)`, ~χ²(2k) under the global null.
    - **Stouffer's Z:** `Z = Σ Φ⁻¹(1 − pᵢ) / sqrt(k)` (supports weights).
    - Also: Tippett (min-p), Brown's method (dependent p-values).
  - **Correct (multiplicity):** **Bonferroni** (FWER, strict), **Holm** (FWER, uniformly more powerful), **Šidák**, **Benjamini–Hochberg FDR** (discovery; reports q-values), Benjamini–Yekutieli (dependent).
- **Algorithm:** choose **combine vs correct** → apply the selected formula across the stack → report combined statistic + global p, or the table of adjusted p/q-values with the rejected set and chosen α/FDR.
- **Options:** combination method; weights; correction method; FDR level; one/two-sided inputs.
- **Assumptions:** (combination) typically independent p-values, valid under each null (use Brown/BY for dependence); (correction) dependence structure dictates BH vs BY.
- **Edge cases:** p = 0 or 1 (clamp; `ln(0)` blows up Fisher); very small p underflow → log space; mixing one- and two-sided p-values; p-values not uniform under null (invalid inputs).
- **Library:** `scipy.stats.combine_pvalues` (Fisher/Stouffer/Tippett), `statsmodels.stats.multitest.multipletests` (all corrections).

---

# L. Shared Components (build once, reuse everywhere)

These back the ANOVA, t-test, regression, and correlation modules. Implement as a
common library (extends Part 2 §9).

### L.1 Post-Hoc Multiple-Comparison Procedures (after ANOVA / Kruskal–Wallis)
- **Tukey HSD** — all pairwise comparisons, controls family-wise error; uses the studentized range.
- **Dunnett** — compare every group to a single **control** (more powerful than all-pairs when that's the question).
- **Bonferroni / Holm / Šidák** — general pairwise FWER control.
- **Dunn's test** — pairwise after Kruskal–Wallis (rank-based) with correction.
- **Nemenyi / Conover** — pairwise after Friedman.
- **Games–Howell** — pairwise under unequal variances.
- **Test for trend** (e.g., post-test for linear trend across ordered groups).
- Report: each comparison's mean difference, CI, adjusted p, significance.

### L.2 Multiple-Comparison / FWER & FDR Correction (general)
- **FWER:** Bonferroni, Holm, Šidák, Holm–Šidák.
- **FDR:** Benjamini–Hochberg (independent/positively dependent), Benjamini–Yekutieli (arbitrary dependence).
- Inputs: vector of raw p-values + α/Q → adjusted p-values/q-values + reject flags. (`statsmodels.multipletests`.)

### L.3 Effect Sizes & Confidence Intervals
- **Mean differences:** Cohen's d `(x̄₁−x̄₂)/s_pooled`, Hedges' g (small-n corrected), Glass's Δ; CI of the difference.
- **ANOVA:** η², partial η², ω², Cohen's f.
- **Nonparametric:** rank-biserial correlation, Cliff's delta.
- **Association:** r, r², Spearman ρ, Kendall τ; odds ratio / risk ratio (categorical); Cramér's V (χ²); hazard ratio (survival).
- Always pair p-values with an effect size + CI in reports.

### L.4 Assumption-Checking Toolkit
- **Normality:** Shapiro–Wilk, D'Agostino–Pearson, Q–Q plots (D.2) — to choose parametric vs nonparametric.
- **Homogeneity of variance:** Levene's test, Brown–Forsythe, Bartlett (Bartlett assumes normality).
- **Sphericity (RM-ANOVA):** Mauchly's test → Greenhouse–Geisser / Huynh–Feldt corrections.
- **Independence/autocorrelation:** Durbin–Watson, residual ACF.
- **Linearity/influence (regression):** residual plots, leverage, Cook's distance.
- A central "preflight" routine that runs the relevant checks and **recommends** the appropriate test variant (e.g., Welch vs Student, parametric vs rank-based).

### L.5 Inference Primitives
- Distribution quantiles/CDFs: normal, t, χ², F, studentized range; exact distributions for small-sample rank tests.
- Resampling: bootstrap CIs, permutation tests (model-agnostic p-values).
- Stable summary stats (Welford), rank/tie handling, weighted least squares / IRLS solver (shared by GLMs, logistic, local regression).

---

*End of Part 3. Together, Parts 1–3 specify the full menu. Recommended build order:
shared components (Part 2 §9 + Part 3 §L) → descriptive/transform/data-shaping utilities
(§D, §I, §E) → core inferential tests (§C, §B, §A) → specialized analyses
(§F survival, §G multivariate, §H ROC/agreement) → curve fitting (Part 1) and
curve operations (Part 2). Each analysis returns: primary result(s), uncertainty
(SE/CI), effect size, assumption/diagnostic flags, and any curve/table needed for plotting.*
