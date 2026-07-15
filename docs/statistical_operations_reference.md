# Statistical Operations — Comprehensive Implementation Reference (Part 2)

Implementation-oriented specifications for eight analysis operations. Companion to
`curve_fitting_reference.md` — where a curve-fitting model or optimizer is needed,
this document references that file (e.g. §"Nonlinear Model Catalog", §"Optimizers")
rather than repeating it.

> **Notation:** `x`, `y` = variables; `n` = sample size; `x̄`, `ȳ` = means;
> `s_x`, `s_y` = standard deviations; `*` = multiply, `^` = power, `ln` = natural log,
> `exp(z)` = e^z, `sqrt` = square root. Per-operation parameters are named inline.

Each operation is specified with: **Purpose · Use cases · Inputs/Outputs ·
Mathematical foundation · Algorithm (step-by-step) · Options/variants · Assumptions ·
Edge cases & numerics · Reporting · Library mapping.**

---

## Table of Contents
1. [Simple Logistic Regression](#1-simple-logistic-regression)
2. [Fit Spline / LOWESS](#2-fit-spline--lowess)
3. [Smooth, Differentiate or Integrate a Curve](#3-smooth-differentiate-or-integrate-a-curve)
4. [Area Under the Curve (AUC)](#4-area-under-the-curve-auc)
5. [Deming (Model II) Linear Regression](#5-deming-model-ii-linear-regression)
6. [Row Statistics](#6-row-statistics)
7. [Correlation](#7-correlation)
8. [Interpolate a Standard Curve](#8-interpolate-a-standard-curve)
9. [Shared Components](#9-shared-components)

---

## 1. Simple Logistic Regression

### Purpose
Model the probability of a **binary outcome** (0/1, yes/no, success/failure) as a
function of a **single continuous or categorical predictor** `x`. Unlike linear
regression, the response is a probability bounded in [0, 1].

### Use cases
- Dose–response with a **binary endpoint** (dead/alive, responded/not) → estimate the dose giving 50% response.
- Diagnostic-test / biomarker thresholds (does marker level predict disease?).
- Risk modeling (does age predict event occurrence?).
- Determining the x value at which an event becomes more likely than not.

### Inputs / Outputs
- **Input:** vector `x` (predictor), vector `y` ∈ {0, 1}. Optionally grouped data (counts of successes/trials per x).
- **Output:** coefficients `β₀, β₁`; standard errors; odds ratio; the x value at p = 0.5 (midpoint/"EC50"); fit statistics; fitted probability curve.

### Mathematical foundation
Model the **log-odds (logit)** as linear in x:
```
logit(p) = ln( p / (1 − p) ) = β₀ + β₁·x
```
Solving for probability gives the logistic (sigmoid) function:
```
p(x) = 1 / (1 + exp( −(β₀ + β₁·x) ))
```
- **Odds ratio** for a one-unit increase in x: `OR = exp(β₁)`.
- **Midpoint** (x where p = 0.5): `x₅₀ = −β₀ / β₁` (the "EC50/IC50" when x is log-dose).
- **Slope at midpoint** ∝ `β₁` (steepness).

### Estimation — Maximum Likelihood via IRLS
There is **no closed-form solution**. Maximize the log-likelihood:
```
ℓ(β) = Σ [ y_i·ln(p_i) + (1 − y_i)·ln(1 − p_i) ]
```
Solved by **Iteratively Reweighted Least Squares (IRLS)** = Newton–Raphson /
Fisher scoring (identical here, canonical link).

**Algorithm (IRLS):**
1. Build design matrix `X = [1, x]`. Initialize `β = 0` (or β₀ = logit of overall mean rate, β₁ = 0).
2. Repeat until convergence:
   1. Compute linear predictor `η = Xβ` and probabilities `p = 1/(1+exp(−η))`.
   2. Compute weights `W = diag( p_i·(1 − p_i) )`.
   3. Form the working response `z = η + (y − p) / (p·(1 − p))`.
   4. Update `β = (Xᵀ W X)⁻¹ Xᵀ W z` (a weighted least-squares solve).
3. Stop when the change in `β`, the change in deviance, or the gradient is below tolerance.
4. **Covariance:** `Cov(β̂) = (Xᵀ W X)⁻¹` at the solution → standard errors = sqrt of diagonal.

### Inference & fit statistics (report all)
- **Wald test** per coefficient: `z = β̂ⱼ / SE(β̂ⱼ)`, p-value from normal; CI `β̂ⱼ ± z_{α/2}·SE`.
- **Odds ratio CI:** `exp(β̂₁ ± z·SE(β̂₁))`.
- **Deviance** `D = −2ℓ`; **null deviance** (intercept-only model).
- **Likelihood-ratio test** (model vs null): `χ² = D_null − D_model`, df = 1.
- **Pseudo-R²:** McFadden `1 − ℓ_model/ℓ_null`; Cox–Snell `1 − (L_null/L_model)^(2/n)`; Nagelkerke (scaled Cox–Snell).
- **AIC / BIC** (see Part 2 §9 / Part 1 §3).
- **Classification metrics:** confusion matrix at a probability cutoff (default 0.5), sensitivity, specificity, accuracy.
- **ROC curve & AUC** (discrimination), and **Hosmer–Lemeshow** goodness-of-fit test (calibration: group by predicted-probability deciles, χ² of observed vs expected).

### Options / variants
- **Grouped (binomial) input:** successes/trials per x instead of individual 0/1 rows.
- **Predictor transform:** often fit against `log(dose)` for dose–response.
- **Multiple logistic regression** (>1 predictor) — same IRLS with wider X (see Part 1 §5 GLMs).
- **Probit** link as an alternative to logit.
- **Penalized (Firth) logistic regression** — bias-reduced; **use when separation occurs**.

### Assumptions
- Independent observations; binary (Bernoulli) response.
- Linearity of the logit in x.
- No perfect **separation** (a predictor that perfectly splits classes → coefficients diverge to ±∞).
- Adequate sample size / events per predictor.

### Edge cases & numerics
- **Complete/quasi-complete separation:** detect non-convergence / exploding β; fall back to Firth penalization or report a warning.
- Probabilities clamped away from exactly 0/1 to avoid `ln(0)`.
- Singular `Xᵀ W X` (constant predictor, collinearity) → guard the solve.
- Very imbalanced classes → ROC/AUC and class weights more informative than accuracy.

### Library mapping
`statsmodels.Logit` / `GLM(family=Binomial())`; `sklearn.LogisticRegression`
(set `penalty=None` for pure MLE); Firth via `firthlogist` or custom IRLS.

---

## 2. Fit Spline / LOWESS

### Purpose
Draw a **smooth nonparametric curve** through data **without assuming any model**.
Used to reveal trends, smooth noise, or create an interpolatable curve when no
theoretical equation applies. (See Part 1 §8 for the broader smoothing family.)

### Use cases
- Visualizing the general trend/shape of scattered data.
- Smoothing before peak-finding, differentiation, or AUC.
- Building an empirical standard curve when no parametric model fits (combine with §8).
- Baseline estimation.

### Inputs / Outputs
- **Input:** `x`, `y` (sorted by x internally), plus a smoothing control (number of knots, or LOWESS span).
- **Output:** dense smoothed curve (x_grid, ŷ); optionally interpolated values at requested x.

### A. Cubic Spline
Piecewise cubic polynomials joined at **knots** with continuous value, 1st, and 2nd
derivatives (C²). A spline through *every* data point is an interpolating spline
(§10 of Part 1 / §8 here); a spline with **fewer knots** smooths.

**Algorithm (natural cubic interpolating spline):**
1. Sort points by x; require strictly increasing x.
2. Set up the tridiagonal system relating the unknown second derivatives `M_i` at knots, derived from continuity of first derivatives.
3. Apply boundary conditions (natural: `M₀ = M_n = 0`; or clamped/not-a-knot).
4. Solve the tridiagonal system (Thomas algorithm, O(n)).
5. Evaluate each cubic segment between knots to produce the dense curve.

- **Smoothing spline** variant: minimize `Σ(y_i − f(x_i))² + λ∫f''(x)²dx`; λ controls smoothness (λ→0 interpolates; λ→∞ → straight line). Choose λ by GCV/CV.
- **Knot count:** more knots = closer to data (less smoothing); fewer = smoother.

### B. LOWESS / LOESS (Locally Weighted Scatterplot Smoothing)
At each target x, fit a **local weighted regression** using only nearby points.

**Algorithm:**
1. Choose **span** `f` ∈ (0, 1] = fraction of points used in each local fit (e.g. 0.3). Local window size `k = round(f·n)`.
2. For each target point x₀:
   1. Find the `k` nearest neighbors in x.
   2. Compute distances `d_i = |x_i − x₀|`; let `d_max` = largest among the k.
   3. Weight neighbors with the **tricube** kernel: `w_i = (1 − (d_i/d_max)³)³` for `d_i < d_max`, else 0.
   4. Fit a weighted **linear** (degree 1) or **quadratic** (degree 2) least-squares regression of y on x using these weights.
   5. The smoothed value `ŷ(x₀)` = the local fit evaluated at x₀.
3. **(Optional) robustness iterations:** compute residuals, derive bisquare robustness weights from them, multiply into the kernel weights, and refit — repeat ~2–3 times to resist outliers.

### Options / variants
- LOWESS degree (1 vs 2), span, robustness iterations.
- Spline type (natural / clamped / not-a-knot), knot count, smoothing λ.
- Output resolution (points in the dense curve).

### Assumptions
- None parametric — data-driven. Assumes the underlying function is smooth.
- Requires reasonably dense, well-ordered data.

### Edge cases & numerics
- **No extrapolation:** results outside the data range are unreliable/undefined.
- **No parameters/equation** → cannot report coefficients, ECx, or mechanistic meaning.
- Duplicate x values: aggregate or jitter before spline interpolation.
- Over-smoothing (large span) hides real features; under-smoothing (small span/many knots) tracks noise — expose the control to the user.
- Sparse regions → unstable local fits.

### Library mapping
Cubic/smoothing splines: `scipy.interpolate.CubicSpline`, `UnivariateSpline`,
`make_smoothing_spline`. LOWESS: `statsmodels.nonparametric.smoothers_lowess.lowess`.
Kernel/local-poly: `statsmodels.nonparametric.KernelReg`.

---

## 3. Smooth, Differentiate or Integrate a Curve

### Purpose
Transform a curve defined by `(x, y)` points into (a) a **smoothed** version,
(b) its **derivative** (1st or 2nd), or (c) its **running integral**. Three related
numerical operations on sampled data.

### Use cases
- **Smooth:** reduce measurement noise while preserving peak shape.
- **Differentiate:** find rates of change, maximum slope, inflection points, or the velocity from a position curve.
- **Integrate:** obtain a cumulative/running total (e.g. cumulative drug exposure, total signal); the endpoint equals the total AUC (§4).

### Inputs / Outputs
- **Input:** `(x, y)` (ideally evenly spaced for smoothing/derivatives; handle uneven x for integration), operation choice, and parameters (window size, polynomial order, derivative order).
- **Output:** a new curve `(x, y_transformed)`.

### A. Smoothing — Savitzky–Golay (recommended)
Slide a window of `2m+1` points; within each window fit a polynomial of degree `p`
by least squares; replace the center value with the fitted value. Equivalent to
convolving y with **precomputed coefficients**, so it's fast and preserves peak
height/width far better than a moving average.

**Algorithm:**
1. Choose window length `2m+1` (odd) and polynomial order `p` (`p < 2m+1`, commonly 2–4).
2. Precompute the Savitzky–Golay convolution coefficients (from the local least-squares design matrix `(AᵀA)⁻¹Aᵀ`, A = Vandermonde of window offsets).
3. Convolve y with the coefficients; handle boundaries (mirror/pad or use asymmetric coefficients near the ends).

- **Moving average** is a simpler alternative (mean over a window) but blurs peaks.

### B. Differentiation — Numerical Derivative
Noise is amplified by differentiation, so **smooth first** (or use the SG derivative,
which smooths and differentiates in one step).

**Algorithm (finite differences):**
1. (Recommended) Smooth y first, or use Savitzky–Golay derivative coefficients (set the SG `deriv` order).
2. First derivative via **central differences**: `y'_i ≈ (y_{i+1} − y_{i−1}) / (x_{i+1} − x_{i−1})`; forward/backward at the ends.
3. Second derivative: `y''_i ≈ (y_{i+1} − 2y_i + y_{i−1}) / h²` for spacing h (general non-uniform formula otherwise).
- Locate **inflection points** where y'' = 0 (sign change); **max slope** where y' is extremal.

### C. Integration — Running Integral
Cumulative integral of the curve from the first x.

**Algorithm (cumulative trapezoidal):**
1. For each interval, area `A_i = (x_{i+1} − x_i)·(y_i + y_{i+1}) / 2`.
2. Running integral `Y_i = Σ_{j<i} A_j` (cumulative sum); `Y₀ = 0` (or a user baseline/initial value).
- The final value = total AUC (§4). Optionally subtract a baseline before integrating.

### Options / variants
- SG window length & polynomial order; derivative order (1 or 2); moving-average alternative.
- Integration constant / initial value; baseline subtraction.
- Higher-order integration (Simpson's rule) for smooth, evenly spaced data.

### Assumptions
- Smoothing/derivative formulas assume (approximately) **evenly spaced x** for the simplest forms; use general spacing-aware formulas otherwise.
- Data sampled densely enough to resolve the features of interest.

### Edge cases & numerics
- **Noise amplification** in derivatives — always smooth first; report the smoothing used.
- **Boundary handling** at the first/last points (one-sided formulas, padding).
- Unequal spacing: use spacing-aware difference formulas.
- Over-smoothing distorts peak height and shifts inflection points.

### Library mapping
`scipy.signal.savgol_filter` (smoothing and derivatives via `deriv=`);
`numpy.gradient` (finite-difference derivative, handles non-uniform x);
`scipy.integrate.cumulative_trapezoid` / `simpson`.

---

## 4. Area Under the Curve (AUC)

### Purpose
Compute the **area between a sampled curve and a baseline** by numerical integration.
Distinct from "ROC AUC" (a classifier metric). This is geometric integration of
`(x, y)` data, typically with peak detection.

### Use cases
- **Pharmacokinetics:** drug exposure (AUC of concentration vs time).
- **Chromatography / spectroscopy:** peak areas (proportional to amount).
- **Dose–response, calcium imaging, GTT/OGTT** (glucose tolerance), enzyme assays.
- Any total-quantity-from-a-curve calculation.

### Inputs / Outputs
- **Input:** `(x, y)`, baseline definition, peak-detection settings, optional x-range.
- **Output:** total area; per-peak results (area, height, x-position of peak, start/end x, % of total area); optionally area above vs below baseline.

### Mathematical foundation — Trapezoidal Rule
Approximate the integral by summing trapezoids between consecutive points:
```
AUC = Σ_i  (x_{i+1} − x_i) · (y_i + y_{i+1}) / 2
```
Area is measured **relative to a baseline** `y = b(x)`; replace `y_i` with `(y_i − b_i)`.

### Algorithm
1. **Define baseline:** options — `y = 0`; a user constant; a line connecting the first and last points; the mean of the first/last *k* points; or a fitted baseline (§2 spline). Subtract baseline from y.
2. **Determine integration range** (full data or `[x_min, x_max]`); if bounds fall between points, interpolate the endpoints.
3. **(Optional) Peak detection:** a "peak" is a contiguous region where the baseline-subtracted curve rises above (or falls below) the baseline by more than a threshold. For each peak, find where it crosses the baseline (start/end via linear interpolation of the crossing) and its apex.
4. **Integrate** each peak (and/or the whole range) with the trapezoidal rule.
5. **Report** total area, and per-peak area, height, position, width, and fraction of total.

### Options / variants
- **Baseline:** zero / constant / endpoints line / fitted.
- **Separate** positive (above baseline) and negative (below baseline) areas, or net area.
- **Peak threshold** (minimum height/prominence) to ignore noise.
- **Partial AUC** between specified x bounds (e.g. AUC₀–₂₄ in PK).
- **Log-linear trapezoidal** method (PK): use log interpolation on the declining phase for exponential decay segments.
- **Higher-order:** Simpson's rule or spline-based area for smooth, dense data.
- **Uncertainty:** if replicate curves exist, compute SE/CI of the AUC across replicates.

### Assumptions
- Linear interpolation between points (trapezoidal) — accurate when sampling is dense relative to curvature.
- Baseline is correctly specified (dominant source of error).

### Edge cases & numerics
- **Sparse sampling** on curved regions → trapezoidal underestimates peaks (concave) or overestimates (convex); densify or use Simpson's/spline.
- **Negative regions** — decide net vs separate accounting; document it.
- **Unequal spacing** is handled naturally by the formula (uses actual Δx).
- **Noise** creates spurious peaks → smooth first (§3) and/or set a prominence threshold.
- Baseline drift → fitted/endpoint baseline rather than zero.

### Library mapping
`numpy.trapz` / `scipy.integrate.trapezoid`, `scipy.integrate.simpson`;
peak detection via `scipy.signal.find_peaks` (with `prominence`, `width`).

---

## 5. Deming (Model II) Linear Regression

### Purpose
Fit a straight line when **both x and y are measured with error** ("errors-in-variables").
Standard (Model I / OLS) regression assumes x is error-free and minimizes only
*vertical* residuals, which **biases the slope** when x is noisy. Deming minimizes a
combination of x- and y-errors. (See Part 1 §4.12 for the broader errors-in-variables
family: TLS, ODR, Passing–Bablok.)

### Use cases
- **Method comparison** in clinical chemistry / lab medicine: comparing two assays or instruments measuring the same quantity, where **neither** is a gold-standard "true" x.
- Calibration cross-checks; any "X vs Y measured the same thing two ways" scenario.

### Inputs / Outputs
- **Input:** paired `(x, y)`; the **error variance ratio** `λ` (and optionally a weighting choice for proportional errors).
- **Output:** slope, intercept, their confidence intervals, and a fitted line. Ideally a Bland–Altman / residual summary alongside.

### Mathematical foundation
Define `λ = σ²(error in Y) / σ²(error in X)` (the ratio of measurement-error variances;
**λ = 1** ⇒ orthogonal/total least squares; if X is essentially error-free, λ→∞ ⇒ OLS).
Deming minimizes the weighted sum of squared **oblique** distances. With sums of squares
```
S_xx = Σ(x_i − x̄)²,   S_yy = Σ(y_i − ȳ)²,   S_xy = Σ(x_i − x̄)(y_i − ȳ)
```
the closed-form estimates are:
```
slope  b = [ S_yy − λ·S_xx + sqrt( (S_yy − λ·S_xx)² + 4λ·S_xy² ) ] / ( 2·S_xy )
intercept a = ȳ − b·x̄
```

### Algorithm
1. Obtain the error-variance ratio `λ`:
   - If known from assay imprecision (CVs/SDs of each method), use it.
   - If unknown, a common default is `λ = 1` (orthogonal regression) or estimate from duplicate measurements of each method.
2. Compute `x̄, ȳ, S_xx, S_yy, S_xy`.
3. Compute slope `b` and intercept `a` with the formulas above.
4. **Confidence intervals:** use the **jackknife** (leave-one-out: refit n times, take the SD of the leave-one-out estimates) or analytic/bootstrap CIs.
5. (Recommended) Report agreement diagnostics: residuals about the fitted line, and a Bland–Altman plot of differences vs means.

### Options / variants
- **Simple (unweighted) Deming** — constant error across the range.
- **Weighted Deming** — error proportional to magnitude (constant CV); weight points by `1/x²` or `1/y²`. Preferred when measurement error grows with concentration.
- **Orthogonal regression** — the special case `λ = 1`.
- **Passing–Bablok** — nonparametric, robust alternative (median of pairwise slopes); use when error ratio is unknown and outliers/non-normality are a concern (Part 1 §9).

### Assumptions
- Linear relationship between the two methods.
- Measurement errors are normally distributed and **independent**.
- The **error ratio λ is known/estimated** correctly (the result depends on it).
- Errors are constant (simple) or proportional (weighted) across the range.

### Edge cases & numerics
- `S_xy ≈ 0` (no association) → slope formula degenerate; handle/guard.
- Wrong λ biases the slope — document the assumed value and offer sensitivity checks.
- Outliers strongly affect Deming → consider Passing–Bablok or robust variants.
- Heteroscedastic error with unweighted Deming → use weighted Deming.

### Library mapping
`scipy.odr` (orthogonal distance regression — general errors-in-variables, set per-axis
weights); dedicated implementations: `deming` packages, or a direct implementation of the
closed-form + jackknife above. Passing–Bablok via `scikit-bio`/`methcomp`-style packages.

---

## 6. Row Statistics

### Purpose
Compute **descriptive statistics across the replicate values within each row** of a
data table (each row = one subject/condition; columns = replicate measurements).
Distinct from column statistics (down a column). Used to summarize replicates before
plotting or further analysis.

### Use cases
- Summarize technical/biological replicates per condition into **mean ± SEM/SD** for plotting.
- Quality control via **%CV** across replicates.
- Reduce a wide replicate table to a tidy summary table.

### Inputs / Outputs
- **Input:** a 2-D table; for each **row**, the set of replicate values (handle missing entries).
- **Output:** one row of summary statistics per input row.

### Statistics to compute (per row)
For row values `{v₁, …, v_k}` (after dropping missing), with `k` = count present:

| Statistic | Formula |
|-----------|---------|
| **n (count)** | number of non-missing values |
| **Sum** | Σ vᵢ |
| **Mean** | `x̄ = (1/k) Σ vᵢ` |
| **Median** | middle value (mean of two middles if k even) |
| **Min / Max / Range** | min, max, max − min |
| **Variance (sample)** | `s² = Σ(vᵢ − x̄)² / (k − 1)` |
| **SD (sample)** | `s = sqrt(s²)` |
| **SEM** | `SEM = s / sqrt(k)` |
| **%CV (coeff. of variation)** | `100 · s / x̄` |
| **95% CI of mean** | `x̄ ± t_{0.975, k−1} · SEM` |
| **Geometric mean** | `exp( (1/k) Σ ln vᵢ )`  (requires all vᵢ > 0) |
| **Geometric SD factor** | `exp( SD of ln vᵢ )` |
| **Quartiles / IQR** | Q1, Q3, IQR = Q3 − Q1 |

### Algorithm
1. For each row: collect values, **drop missing** (track k).
2. If `k = 0` → all outputs missing. If `k = 1` → mean = value; SD/SEM/CI undefined (report blank/NaN).
3. Compute the requested statistics using the formulas above.
4. Assemble a results table (one row per input row).

### Options / variants
- Choose which statistics to output.
- Sample vs population SD/variance (divisor `k−1` vs `k`).
- Skip vs error on rows with too few values.
- Geometric statistics only when all values are positive.

### Assumptions
- For the **95% CI**, approximate normality of the row values (small k → wide, uncertain CI).
- Replicates within a row are exchangeable measurements of the same quantity.

### Edge cases & numerics
- **Missing values:** exclude pairwise; recompute k per row.
- **k < 2:** SD/SEM/variance/CI undefined.
- **Geometric mean / %CV:** undefined or misleading with zeros or negatives → guard.
- **Mean ≈ 0:** %CV explodes → flag.
- Use a numerically stable variance algorithm (Welford) for long rows.

### Library mapping
`numpy`/`pandas` row-wise (`df.mean(axis=1)`, `.std(axis=1, ddof=1)`, `.sem(axis=1)`,
`.median(axis=1)`); `scipy.stats.gmean`, `scipy.stats.variation` (CV);
`scipy.stats.t.ppf` for the CI multiplier.

---

## 7. Correlation

### Purpose
Quantify the **strength and direction of association** between two variables — with
**no distinction between dependent and independent** (unlike regression). Extendable
to a correlation matrix across many variables.

### Use cases
- Assess whether two measurements move together (without implying causation).
- Screen many variables for relationships (correlation matrix / heatmap).
- Choose between linear (Pearson) and monotonic/rank (Spearman/Kendall) association.

### Inputs / Outputs
- **Input:** two paired vectors `x`, `y` (or a matrix of variables); choice of coefficient.
- **Output:** correlation coefficient, p-value, confidence interval, n; for matrices, full coefficient + p-value matrices.

### Coefficients

**A. Pearson r (linear association):**
```
r = Σ(x_i − x̄)(y_i − ȳ) / sqrt( Σ(x_i − x̄)² · Σ(y_i − ȳ)² )  =  cov(x,y) / (s_x·s_y)
```
- Range [−1, 1]; `r²` = fraction of shared variance.
- **Significance:** `t = r·sqrt(n − 2) / sqrt(1 − r²)`, df = n − 2.
- **Confidence interval (Fisher z-transform):** `z = atanh(r) = 0.5·ln((1+r)/(1−r))`, `SE_z = 1/sqrt(n − 3)`; CI in z = `z ± z_{α/2}·SE_z`; back-transform with `tanh`.

**B. Spearman ρ (monotonic, rank-based):**
- Convert x and y to ranks; compute **Pearson r on the ranks**.
- Robust to outliers and monotonic nonlinearity; no normality assumption.
- Significance via t-approximation (as Pearson, on ranks) or exact/permutation for small n; handle ties with the tie-corrected formula.

**C. Kendall τ (ordinal concordance):**
```
τ = (number of concordant pairs − number of discordant pairs) / [ n(n − 1)/2 ]   (τ-a)
```
- τ-b corrects for ties. More robust and interpretable for small samples / many ties; lower values than Spearman for the same data.

### Algorithm
1. Drop pairs with missing x or y (pairwise deletion); record n.
2. Compute the chosen coefficient with the formula above.
3. Compute the p-value (two- or one-sided) and the confidence interval.
4. For a **matrix**, repeat for every variable pair → coefficient matrix + p-value matrix (optionally adjust p-values for multiple comparisons).

### Options / variants
- **Coefficient:** Pearson / Spearman / Kendall.
- **Partial correlation** (association between x and y controlling for other variables) via residualization or the inverse covariance (precision) matrix.
- **Point-biserial** (one binary, one continuous) = Pearson special case.
- One- vs two-tailed test; CI method.
- Multiple-comparison correction for matrices (Bonferroni, FDR).

### Assumptions
- **Pearson:** approximately bivariate normal, **linear** relationship, no extreme outliers, homoscedasticity.
- **Spearman/Kendall:** only require ordinal data / monotonic relationship; distribution-free.
- Independent observations.

### Edge cases & numerics
- **Nonlinearity:** Pearson can be ~0 for a strong but non-monotonic relationship → always inspect a scatterplot; prefer Spearman for monotonic-but-curved.
- **Outliers** inflate/deflate Pearson → consider rank methods.
- **Restricted range** attenuates r.
- **Ties** require tie-corrected Spearman/Kendall.
- `n < 3` → CI undefined; near-zero variance → r undefined.
- **Correlation ≠ causation**; report this caveat.

### Library mapping
`scipy.stats.pearsonr`, `spearmanr`, `kendalltau`; `numpy.corrcoef` /
`pandas.DataFrame.corr` for matrices; `pingouin.partial_corr` for partial correlation;
`statsmodels.stats.multitest` for p-value adjustment.

---

## 8. Interpolate a Standard Curve

### Purpose
Fit a **calibration (standard) curve** to standards of known concentration, then use
it to **interpolate unknown samples**: given a measured signal `y`, read off the
concentration `x` (or vice versa). The core workflow of quantitative assays.

### Use cases
- **ELISA, RIA, Luminex** immunoassays; **qPCR** standard curves; enzyme/protein assays; any instrument where signal must be converted to concentration via standards.

### Inputs / Outputs
- **Input:** standards `(x_std, y_std)` (x = known concentration, often log-spaced; y = signal, possibly replicated); the calibration **model**; unknown signals `y_unknown` to convert; optional dilution factors.
- **Output:** interpolated concentrations for unknowns, with confidence intervals; the fitted curve and its fit statistics; flags for out-of-range values.

### Calibration models (choose per assay)
Fit using the methods in **Part 1** (linear §4.1, polynomial §4.3, 4PL/5PL & sigmoids
§7.4, splines §4.6). Common choices:
- **Linear** `y = a + b·x` (simple, narrow dynamic range).
- **Semi-log / log-linear** (x or y log-transformed).
- **4-parameter logistic (4PL)** — the immunoassay standard (sigmoidal).
- **5-parameter logistic (5PL)** — asymmetric sigmoids.
- **Polynomial / cubic spline** — empirical, when no model fits (note: splines can't extrapolate and may be non-monotonic).

### Algorithm
1. **Fit** the chosen model to the standards (least squares, usually **weighted** — assay error often grows with signal, so `1/y²` weighting is common). Validate the fit (R², residuals, back-calculated recovery of standards).
2. **Invert** the model to solve x from y (analytically when possible):
   - Linear: `x = (y − a) / b`.
   - 4PL `y = d + (a−d)/(1+(x/c)^b)` → `x = c · ((a − y)/(y − d))^(1/b)`.
   - Sigmoid/other invertible forms: algebraic inverse.
   - Non-invertible / spline / polynomial: solve `f(x) − y = 0` numerically (root-finding, e.g. bisection/Brent within the curve's monotonic range).
3. For each unknown, compute the interpolated x; **average replicates** (interpolate each, then summarize, or interpolate the mean — be consistent).
4. **Apply dilution factors** to recover the original concentration.
5. **Uncertainty:** propagate the curve-fit uncertainty into x — via **Fieller's theorem** (for ratio-form inverses, the rigorous approach), the **delta method**, or **bootstrap**; report CIs on interpolated concentrations.
6. **Range checks:** flag unknowns whose y falls **outside the standards' y-range** (extrapolation) or in the curve's flat asymptotic regions (poorly determined x).

### Options / variants
- Model selection (linear / 4PL / 5PL / spline) — pick by fit quality + recovery of standards.
- Weighting scheme (`1`, `1/y`, `1/y²`, `1/x²`).
- Interpolate Y-from-X or X-from-Y.
- Replicate handling; dilution-factor multiplication; blank subtraction.
- Lower/upper limit of quantification (LLOQ/ULOQ) from the usable curve region.

### Assumptions
- The standard curve model adequately describes the assay response.
- Unknowns are measured under the same conditions as standards.
- Within the validated (monotonic, well-determined) range of the curve.

### Edge cases & numerics
- **Out-of-range unknowns** (signal above the top or below the bottom standard) → unreliable; flag, don't silently extrapolate.
- **Flat regions** of a sigmoid (near asymptotes) → tiny signal changes map to huge concentration changes → large CIs; warn.
- **Non-monotonic** empirical fits (polynomial/spline) → a given y may map to multiple x; restrict to the monotonic region.
- **Log transforms** require positive values (concentrations, signals).
- Always **back-calculate the standards** through the inverse as a QC step (recovery should be ~80–120%).

### Library mapping
Fit with `scipy.optimize.curve_fit` / `lmfit` (4PL/5PL) or `numpy.polyfit`/linear solvers;
invert analytically or with `scipy.optimize.brentq` (root finding); CIs via `lmfit`
uncertainty propagation, the delta method, or bootstrap.

---

## 9. Shared Components

Reusable modules these eight operations should draw from (overlaps with Part 1 §3, §11).

### 9.1 Descriptive stats primitives
Numerically stable mean/variance (Welford), median/quantiles, geometric mean, SEM,
%CV, CI multipliers (`t`-distribution). Used by Row Statistics, AUC replicates,
Correlation, Standard Curve QC.

### 9.2 Significance & CI toolkit
t-distribution, normal, χ² quantiles; Fisher z-transform; jackknife and bootstrap
resamplers; Fieller's theorem for ratio CIs; multiple-comparison correction
(Bonferroni, Benjamini–Hochberg FDR).

### 9.3 Numerical routines
Tridiagonal (Thomas) solver for splines; Savitzky–Golay coefficient generator;
trapezoidal/Simpson integrators and cumulative integrators; finite-difference
derivatives; root finding (Brent/bisection) for curve inversion; weighted/IRLS
least-squares solver (logistic, GLMs, local LOWESS fits).

### 9.4 Data hygiene
Missing-value handling (pairwise/listwise), sorting by x, duplicate-x handling,
positivity checks for log/geometric operations, range/monotonicity checks,
divide-by-zero guards, and clear warnings (separation, out-of-range interpolation,
sparse sampling, wrong error ratio).

### 9.5 Standardized reporting
Each operation returns: the primary result(s), uncertainty (SE/CI), fit/quality
statistics (R²/recovery/χ² where relevant), diagnostics (residual structure,
out-of-range flags), and a dense output curve for plotting.

---

*End of Part 2. Operations 2, 3, 4, 5, and 8 reuse curve-fitting models and optimizers
specified in `curve_fitting_reference.md`; build the shared components in §9 once and
call them from each operation.*
