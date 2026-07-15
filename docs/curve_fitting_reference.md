# Curve Fitting — Comprehensive Implementation Reference

A complete, implementation-oriented catalog of linear and nonlinear curve-fitting
methods for building a statistics program. Each entry includes the model form,
the parameters to estimate, the recommended fitting/estimation method, assumptions,
numerical caveats, and goodness-of-fit considerations.

> **Notation conventions used throughout**
> - `x` = independent variable(s), `y` = dependent variable, `n` = number of data points, `p` = number of parameters.
> - `*` = multiplication, `^` = exponent, `exp(z)` = e^z, `ln` = natural log.
> - Parameters to estimate are written as `a, b, c, ...` or named (e.g. `Vmax`, `Km`).
> - `r_i = y_i - f(x_i; θ)` is the *residual* for point i; `θ` is the parameter vector.
> - `SSR` = Σ r_i² (residual/error sum of squares); `SST` = Σ (y_i − ȳ)² (total sum of squares).
> - "Linear" below always means **linear in the parameters**, not linear in x. Polynomial regression is therefore a *linear* method.

---

## Table of Contents

1. [Core Concepts](#1-core-concepts)
2. [Objective / Loss Functions](#2-objective--loss-functions)
3. [Goodness-of-Fit & Model-Selection Metrics](#3-goodness-of-fit--model-selection-metrics)
4. [Linear-in-Parameters Models](#4-linear-in-parameters-models)
5. [Generalized Linear Models (GLMs)](#5-generalized-linear-models-glms)
6. [Nonlinear Regression — Framework & Optimizers](#6-nonlinear-regression--framework--optimizers)
7. [Nonlinear Model Catalog](#7-nonlinear-model-catalog)
8. [Nonparametric / Smoothing Methods](#8-nonparametric--smoothing-methods)
9. [Robust Regression](#9-robust-regression)
10. [Interpolation (Exact-Fit) Methods](#10-interpolation-exact-fit-methods)
11. [Implementation Details](#11-implementation-details)
12. [Library / Function Mapping](#12-library--function-mapping)
13. [Decision Guide & Suggested Architecture](#13-decision-guide--suggested-architecture)

---

## 1. Core Concepts

**Curve fitting** = finding a function that best describes the relationship between
variables. Two fundamentally different goals:

| Goal | Description | Passes through every point? |
|------|-------------|-----------------------------|
| **Interpolation** | Construct a curve passing *exactly* through known data points | Yes |
| **Regression / approximation** | Find the curve that best *approximates* noisy data by minimizing some error measure | No |
| **Smoothing** | Reduce noise while preserving structure, no fixed parametric form | No |

**Two classes of regression models:**

- **Linear in parameters** — the model is a linear combination of (possibly nonlinear) basis functions: `f(x) = Σ θ_j φ_j(x)`. Has a **closed-form solution** (normal equations / linear algebra). Fast, unique global optimum.
- **Nonlinear in parameters** — parameters enter nonlinearly (e.g. `a*exp(b*x)`). Requires **iterative optimization**, needs starting values, may have local minima.

**Key distinction for implementation:** decide early whether a requested model is
linear-in-parameters (solve directly) or nonlinear (iterate). Many "nonlinear-looking"
models (polynomial, exponential via log-transform) can be made linear.

---

## 2. Objective / Loss Functions

The objective function defines what "best fit" means. This is an independent axis
from the model form — most models can be paired with most loss functions.

### 2.1 Ordinary Least Squares (OLS)
- **Minimize:** `Σ r_i²`
- **Assumes:** errors are independent, zero-mean, **constant variance** (homoscedastic), and (for inference) Gaussian.
- Most common; closed form for linear models; sensitive to outliers (squaring amplifies them).

### 2.2 Weighted Least Squares (WLS)
- **Minimize:** `Σ w_i * r_i²`
- Weights `w_i` account for unequal error variance. Common choices:
  - `w_i = 1/σ_i²` (when measurement uncertainties σ_i are known) — *statistically optimal*.
  - `w_i = 1/y_i` or `1/y_i²` (Poisson-like or proportional error).
- **Use when:** heteroscedasticity is present or per-point uncertainties exist.

### 2.3 Generalized Least Squares (GLS)
- **Minimize:** `r^T Σ⁻¹ r` where Σ is the full error covariance matrix.
- Handles **both** heteroscedasticity *and* correlated errors (e.g. autocorrelated time series).
- Solution (linear case): `β = (Xᵀ Σ⁻¹ X)⁻¹ Xᵀ Σ⁻¹ y`.
- **Feasible GLS (FGLS):** estimate Σ from data iteratively.

### 2.4 Total Least Squares / Orthogonal Distance Regression (ODR)
- **Minimize:** perpendicular (orthogonal) distances, not vertical residuals.
- **Use when:** the *independent* variable also has measurement error ("errors-in-variables").
- See §4.12 (Deming, TLS, ODR).

### 2.5 Maximum Likelihood Estimation (MLE)
- **Maximize:** the likelihood `L(θ) = Π p(y_i | x_i, θ)` (or minimize `−ln L`).
- For Gaussian errors with constant variance, MLE ≡ OLS. For other error distributions (Poisson, binomial, gamma) → GLMs (§5).
- General, principled; enables AIC/BIC and likelihood-ratio tests.

### 2.6 Robust Loss Functions (outlier-resistant)
| Loss | Formula (of residual r) | Behavior |
|------|------------------------|----------|
| **L2 (squared)** | r² | Standard, outlier-sensitive |
| **L1 (absolute / LAD)** | \|r\| | Median-like, robust, non-smooth at 0 |
| **Huber** | r²/2 if \|r\|≤δ else δ(\|r\|−δ/2) | Quadratic near 0, linear in tails |
| **Tukey biweight (bisquare)** | bounded, redescending | Fully rejects gross outliers |
| **Cauchy / Lorentzian** | (c²/2)·ln(1+(r/c)²) | Soft rejection |
| **soft-L1** | 2(√(1+r²)−1) | Smooth approximation of L1 |
| **arctan** | bounded | Aggressive outlier suppression |

### 2.7 Regularized Objectives
Add a penalty on parameter magnitude to control overfitting / multicollinearity:
- **Ridge (L2):** `Σ r_i² + λ Σ θ_j²`
- **Lasso (L1):** `Σ r_i² + λ Σ |θ_j|` (induces sparsity → feature selection)
- **Elastic Net:** `Σ r_i² + λ₁ Σ |θ_j| + λ₂ Σ θ_j²`
- `λ` (regularization strength) chosen by cross-validation.

---

## 3. Goodness-of-Fit & Model-Selection Metrics

Implement these as a shared reporting module usable by all fitting methods.

### 3.1 Residual-based fit quality
- **R² (coefficient of determination):** `1 − SSR/SST`. Fraction of variance explained. *Caveat:* always increases with more parameters; can be misleading/negative for nonlinear models.
- **Adjusted R²:** `1 − (1−R²)·(n−1)/(n−p−1)`. Penalizes extra parameters.
- **RMSE (root mean squared error):** `sqrt(SSR/n)`. Same units as y.
- **MAE (mean absolute error):** `(1/n)Σ|r_i|`. Robust to outliers.
- **MAPE (mean absolute percentage error):** `(100/n)Σ|r_i/y_i|`. Scale-free; undefined at y=0.
- **MSE:** `SSR/n`.
- **Standard error of regression (residual std):** `s = sqrt(SSR/(n−p))`.

### 3.2 Statistical / likelihood-based
- **Chi-square (χ²):** `Σ (r_i/σ_i)²` — for fits with known uncertainties.
- **Reduced chi-square:** `χ²/(n−p)` — should be ≈ 1 for a good fit with correct error estimates.
- **Log-likelihood (ln L).**
- **AIC:** `2p − 2 ln L`; for Gaussian LS: `n·ln(SSR/n) + 2p`.
- **AICc (small-sample corrected):** `AIC + 2p(p+1)/(n−p−1)`. Use when n/p is small.
- **BIC (Schwarz):** `p·ln(n) − 2 ln L`; for Gaussian LS: `n·ln(SSR/n) + p·ln(n)`. Penalizes complexity more than AIC.
- Lower AIC/BIC = better. Differences (ΔAIC) matter, not absolute values.

### 3.3 Inference & uncertainty
- **Parameter standard errors:** from the covariance matrix `Cov(θ̂) ≈ s²·(JᵀJ)⁻¹` (J = Jacobian; for linear models J = X).
- **Confidence intervals on parameters:** `θ̂ ± t_{α/2, n−p} · SE(θ̂)`.
- **Prediction & confidence bands** for the fitted curve.
- **F-test** for comparing **nested** models: `F = [(SSR₁−SSR₂)/(p₂−p₁)] / [SSR₂/(n−p₂)]`.
- **Cross-validation** (k-fold, LOOCV) — model-agnostic generalization estimate.

### 3.4 Residual diagnostics (always recommend running these)
- Residuals vs fitted (check for structure/curvature → wrong model).
- Q–Q plot of residuals (check normality).
- Residual autocorrelation / Durbin–Watson (check independence).
- Scale-location plot (check homoscedasticity).
- Leverage & Cook's distance (identify influential points).
- Runs test (check for systematic sign patterns).

---

## 4. Linear-in-Parameters Models

All of these have **closed-form solutions** via the normal equations
`β = (XᵀX)⁻¹ Xᵀy` (or numerically via QR/SVD decomposition, which is preferred for
stability). Implement one core linear solver and feed it different **design matrices X**.

### 4.1 Simple Linear Regression
- **Model:** `y = a + b·x`
- **Parameters:** intercept `a`, slope `b`.
- **Closed form:**
  - `b = Σ((x_i−x̄)(y_i−ȳ)) / Σ((x_i−x̄)²)`
  - `a = ȳ − b·x̄`
- **Assumptions:** linearity, independent errors, homoscedasticity, normality (for inference).

### 4.2 Multiple Linear Regression
- **Model:** `y = β₀ + β₁x₁ + β₂x₂ + ... + β_k x_k`
- **Design matrix X:** columns = [1, x₁, x₂, ...]; rows = observations.
- **Solve:** `β = (XᵀX)⁻¹ Xᵀy` (use QR or SVD numerically; never invert directly for ill-conditioned X).
- **Watch for:** multicollinearity (check VIF / condition number).

### 4.3 Polynomial Regression
- **Model:** `y = a₀ + a₁x + a₂x² + ... + a_d x^d`
- **Design matrix:** Vandermonde matrix `[1, x, x², ..., x^d]`.
- **Caveat:** Vandermonde matrices become **severely ill-conditioned** for high degree d. **Center & scale x** (e.g. map to [−1,1]) before fitting, and prefer orthogonal polynomials (§4.4) for d ≳ 4.
- Degree selection via adjusted R², AIC/BIC, or CV.

### 4.4 Orthogonal Polynomial Regression
- **Model:** linear combination of orthogonal polynomials (Chebyshev, Legendre, Hermite, Laguerre) instead of raw powers.
- **Benefit:** orthogonal basis → well-conditioned, numerically stable, decoupled coefficients.
- Recommended substitute for plain polynomial regression at higher degrees.

### 4.5 General Linear Basis-Function Regression
- **Model:** `y = Σ_j θ_j φ_j(x)` for arbitrary fixed basis functions φ_j.
- **Examples of bases:**
  - **Radial basis functions (RBF):** `φ_j(x) = exp(−‖x−c_j‖²/(2σ²))` (Gaussian), multiquadric, thin-plate spline. Centers `c_j` fixed → linear fit.
  - **Fourier / trigonometric series:** `y = a₀ + Σ [a_k cos(kωx) + b_k sin(kωx)]` with **known** fundamental frequency ω → linear. (Unknown ω → nonlinear, see §7.8.)
  - **B-spline / wavelet bases.**
- Generic and powerful; just construct the design matrix from the chosen basis.

### 4.6 Spline Fitting (piecewise polynomials)
Splines join low-order polynomials at **knots** with continuity constraints.

| Type | Description |
|------|-------------|
| **Linear spline** | Connected line segments; C⁰ continuity. |
| **Cubic spline** | Piecewise cubics; C² continuity (continuous 2nd derivative); smooth. |
| **Natural cubic spline** | Cubic spline with 2nd derivative = 0 at endpoints (reduces edge oscillation). |
| **B-spline (basis spline)** | Numerically stable local basis; the standard for fitting. Control via knot vector & degree. |
| **Smoothing spline** | Penalized fit: minimize `Σ(y_i − f(x_i))² + λ∫ f''(x)² dx`. λ trades fit vs smoothness; λ→0 interpolates, λ→∞ → linear fit. |
| **P-spline (penalized B-spline)** | B-spline basis + difference penalty on coefficients; efficient smoothing-spline approximation. |
| **Regression spline** | B-spline basis with relatively few knots; ordinary linear least squares fit. |

- **Knot placement** (uniform, quantile-based, or adaptive) and **smoothing parameter λ** (via GCV / CV) are the key tuning choices.

### 4.7 Segmented / Piecewise / Broken-Stick Regression
- **Model:** different linear (or polynomial) pieces over x-intervals separated by **breakpoints**.
- If breakpoints are **known** → linear fit (with continuity constraints via basis functions like `(x − k)₊`).
- If breakpoints are **unknown** → nonlinear / specialized algorithm (iterative search, e.g. Muggeo's method).
- **Use for:** threshold effects, change points, regime shifts.

### 4.8 Weighted Linear Regression
- As §4.2 but minimize `Σ w_i r_i²`. **Solve:** `β = (Xᵀ W X)⁻¹ Xᵀ W y` with W = diag(w_i).

### 4.9 Generalized Least Squares (linear)
- `β = (Xᵀ Σ⁻¹ X)⁻¹ Xᵀ Σ⁻¹ y`. For correlated/heteroscedastic errors. (See §2.3.)

### 4.10 Regularized Linear Regression
- **Ridge (Tikhonov):** `β = (XᵀX + λI)⁻¹ Xᵀy`. Shrinks coefficients; handles multicollinearity & p>n; closed form.
- **Lasso:** no closed form; solve via coordinate descent or LARS. Produces sparse solutions.
- **Elastic Net:** blends ridge + lasso; solved by coordinate descent.
- All require choosing λ (and the L1/L2 mix for elastic net) by cross-validation. **Standardize features first.**

### 4.11 Dimensionality-Reduction Regression
- **Principal Component Regression (PCR):** PCA on predictors, regress y on leading components. Handles multicollinearity; components are chosen for X-variance (not necessarily y-relevance).
- **Partial Least Squares (PLS):** finds components maximizing covariance with y. Often better than PCR when predictors are many/collinear (chemometrics, spectroscopy).

### 4.12 Errors-in-Variables (orthogonal) Regression
When **x is also measured with error**, vertical-residual OLS is biased.
- **Total Least Squares (TLS):** minimize orthogonal distances; solved via SVD.
- **Deming regression:** accounts for a known **ratio** of error variances δ = σ_y²/σ_x². Special case (δ=1) = orthogonal regression. Common in method-comparison studies (clinical chemistry).
- **Orthogonal Distance Regression (ODR):** general framework (linear or nonlinear) minimizing orthogonal distances; weights for both axes.
- **Passing–Bablok:** nonparametric, robust method-comparison regression (median of pairwise slopes).

### 4.13 Linearizable Nonlinear Models (transform-then-fit)
Some nonlinear forms become linear after a transform → solvable in closed form.
**Important caveat:** transforming changes the error structure; the linearized fit
minimizes error in transformed space, *not* the original. For statistically correct
results, either use WLS with appropriate weights or refine with a true nonlinear fit
(use the linearized result as the **initial guess** — this is a very useful pattern).

| Original model | Transform | Linear form |
|----------------|-----------|-------------|
| `y = a·exp(b·x)` | take ln | `ln y = ln a + b·x` |
| `y = a·x^b` (power) | log–log | `ln y = ln a + b·ln x` |
| `y = a + b·ln x` | (already linear in params) | regress y on ln x |
| `y = a·b^x` | take ln | `ln y = ln a + (ln b)·x` |
| `y = 1/(a + b·x)` | reciprocal | `1/y = a + b·x` |
| `y = x/(a + b·x)` | reciprocal | `1/y = a·(1/x) + b` |
| `y = a·exp(b/x)` | take ln | `ln y = ln a + b·(1/x)` |
| Michaelis–Menten `v = Vmax·S/(Km+S)` | Lineweaver–Burk | `1/v = (Km/Vmax)(1/S) + 1/Vmax` |
| Michaelis–Menten | Eadie–Hofstee | `v = Vmax − Km·(v/S)` |
| Michaelis–Menten | Hanes–Woolf | `S/v = (1/Vmax)·S + Km/Vmax` |
| Logistic (proportion p) | logit | `ln(p/(1−p)) = a + b·x` |

---

## 5. Generalized Linear Models (GLMs)

Extend linear regression to non-Gaussian responses via a **link function** g and an
**exponential-family** error distribution. Model: `g(E[y]) = Xβ`. Fitted by
**Iteratively Reweighted Least Squares (IRLS)** maximizing the likelihood.

| Model | Response type | Distribution | Canonical link |
|-------|---------------|--------------|----------------|
| **Linear regression** | continuous | Gaussian | identity |
| **Logistic regression** | binary (0/1) | Binomial | logit `ln(p/(1−p))` |
| **Probit regression** | binary | Binomial | probit (inverse normal CDF) |
| **Multinomial logistic** | unordered categories | Multinomial | generalized logit |
| **Ordinal (proportional-odds)** | ordered categories | Multinomial | cumulative logit |
| **Poisson regression** | counts | Poisson | log |
| **Negative binomial** | over-dispersed counts | Neg. binomial | log |
| **Gamma regression** | positive continuous, skewed | Gamma | inverse or log |
| **Inverse Gaussian** | positive continuous | Inverse Gaussian | 1/μ² |
| **Tweedie** | continuous w/ point mass at 0 | Tweedie | power |

- **Extensions:** GAMs (generalized additive models — smooth nonlinear terms `Σ f_j(x_j)`), GLMMs (mixed effects), quasi-likelihood (for over/under-dispersion), zero-inflated & hurdle models (excess zeros).

---

## 6. Nonlinear Regression — Framework & Optimizers

For models nonlinear in parameters, minimize `SSR(θ) = Σ r_i(θ)²` (or any §2 loss)
iteratively. **Every nonlinear fit needs:** (1) the model function, (2) initial
parameter guesses, (3) an optimizer, (4) convergence criteria, optionally (5) the
analytic Jacobian and (6) parameter bounds.

### 6.1 Optimization algorithms

| Algorithm | Uses gradient? | Notes |
|-----------|---------------|-------|
| **Gauss–Newton** | Jacobian | `Δθ = (JᵀJ)⁻¹ Jᵀr`. Fast near solution; can diverge if far / JᵀJ singular. |
| **Levenberg–Marquardt (LM)** | Jacobian | **The workhorse for nonlinear least squares.** `(JᵀJ + λ·diag(JᵀJ)) Δθ = Jᵀr`. Damping λ interpolates between Gauss–Newton (small λ) and gradient descent (large λ). Robust, fast. Best for unconstrained, small/medium problems. |
| **Trust Region Reflective (TRF)** | Jacobian | Handles **bounds** on parameters; good for large/sparse problems. |
| **Dogleg / trust-region** | Jacobian/Hessian | Robust trust-region step control. |
| **Gradient descent / steepest descent** | gradient | Simple, slow; rarely used alone. |
| **(L-)BFGS / BFGS** | gradient (quasi-Hessian) | General-purpose; L-BFGS for many parameters. Good for non-LS losses. |
| **Conjugate gradient** | gradient | Memory-efficient for large problems. |
| **Nelder–Mead (simplex)** | **derivative-free** | No gradients needed; robust to non-smooth objectives; slower, can stall. |
| **Powell's method** | derivative-free | Directional minimization; no gradients. |
| **Newton / Gauss–Newton w/ Hessian** | 2nd order | Fast convergence when Hessian available. |

### 6.2 Global / multi-start optimizers (for multi-modal objectives)
Local methods can land in local minima. For difficult fits use:
- **Multi-start** (run local optimizer from many random initializations — simple & effective).
- **Differential Evolution** (population-based, derivative-free, robust global search).
- **Basin Hopping** (random perturbation + local minimization).
- **Simulated Annealing.**
- **Particle Swarm / Genetic Algorithms.**
- Common pattern: global search to get near the basin → polish with Levenberg–Marquardt.

### 6.3 Jacobian
- The matrix `J_ij = ∂r_i/∂θ_j`. Supply **analytically** when possible (faster, more accurate); otherwise compute by finite differences (default in most libraries). Some tools support automatic differentiation.

---

## 7. Nonlinear Model Catalog

For each: model form, parameters, and notes. Default fit = Levenberg–Marquardt /
TRF with WLS, good initial guesses, and (where relevant) parameter bounds.

### 7.1 Exponential Family
| Model | Form | Parameters / use |
|-------|------|------------------|
| Exponential growth | `y = a·exp(b·x)`, b>0 | a = initial value |
| Exponential decay | `y = a·exp(−b·x)`, b>0 | half-life = ln2/b |
| Exponential + offset | `y = a·exp(b·x) + c` | c = asymptote/baseline |
| Exponential association | `y = a·(1 − exp(−b·x))` | rises to plateau a |
| Two-phase (bi-exponential) | `y = a·exp(−b·x) + c·exp(−d·x)` | sum of two rates (PK, relaxation) |
| Multi-exponential | `y = Σ a_k·exp(−b_k·x)` | hard to fit — strongly correlated params |
| Stretched exponential (Kohlrausch) | `y = a·exp(−(x/τ)^β)`, 0<β≤1 | disordered/relaxation systems |
| Exponential rise to max + decay | `y = a·(exp(−b·x) − exp(−c·x))` | absorption/elimination |

- **Init tip:** estimate `b` from `ln y` vs `x` slope; `a` from intercept.
- Multi-exponential fits are **notoriously ill-conditioned** — constrain, regularize, or limit the number of terms.

### 7.2 Power & Allometric
- **Power law:** `y = a·x^b`. Init via log–log linear fit.
- **Power + offset:** `y = a·x^b + c`.
- **Allometric variants:** `y = a·x^b·exp(c·x)`, etc.

### 7.3 Logarithmic
- `y = a + b·ln(x)` (linear in params — closed form).
- `y = a + b·ln(x + c)` (nonlinear due to c).

### 7.4 Sigmoidal / Dose–Response / S-Curves
Critical family for biology, pharmacology, growth.

| Model | Form | Parameters |
|-------|------|-----------|
| **Logistic (standard)** | `y = L / (1 + exp(−k(x − x₀)))` | L = max, k = steepness, x₀ = midpoint |
| **4-parameter logistic (4PL)** | `y = d + (a − d)/(1 + (x/c)^b)` | a = bottom, d = top, c = EC50/IC50, b = Hill slope |
| **5-parameter logistic (5PL)** | `y = d + (a − d)/(1 + (x/c)^b)^g` | g = asymmetry factor (handles skewed curves) |
| **Gompertz** | `y = a·exp(−b·exp(−c·x))` | asymmetric sigmoid; a = asymptote |
| **Richards (generalized logistic)** | `y = A + (K−A)/(1 + Q·exp(−B(x−M)))^(1/ν)` | ν controls asymmetry |
| **Weibull sigmoid** | `y = a·(1 − exp(−(x/λ)^k))` | growth/CDF shape |
| **Hill equation** | `y = E_max·x^n / (K^n + x^n)` | n = Hill coefficient (cooperativity), K = half-max conc. |
| **Log-logistic** | `y = c / (1 + (x/e)^b)` | dose-response, survival |
| **Boltzmann sigmoid** | `y = A₂ + (A₁−A₂)/(1 + exp((x−x₀)/dx))` | physics/voltage curves |
| **Morgan–Mercer–Flodin (MMF)** | `y = (a·b + c·x^d)/(b + x^d)` | flexible growth |

- **Init tips:** bottom/top from min/max of y; midpoint/EC50 from x where y ≈ halfway; slope sign from data trend.
- For dose-response, x is often **log-transformed concentration**.

### 7.5 Enzyme Kinetics / Saturation
- **Michaelis–Menten:** `v = Vmax·S/(Km + S)`. Vmax = max rate, Km = half-saturation. (Linearizations in §4.13, but nonlinear fit is preferred.)
- **Substrate inhibition:** `v = Vmax·S/(Km + S + S²/Ki)`.
- **Hill (cooperative):** `v = Vmax·S^n/(Km^n + S^n)`.
- **Competitive/uncompetitive/noncompetitive inhibition** variants (add inhibitor terms).

### 7.6 Growth Models (population / biology / reliability)
| Model | Form |
|-------|------|
| Logistic growth | `N = K/(1 + ((K−N₀)/N₀)·exp(−r·t))` |
| Gompertz growth | `N = K·exp(−exp(−r(t − t₀)))` |
| Von Bertalanffy | `L = L∞·(1 − exp(−k(t − t₀)))` |
| Richards growth | generalized logistic (see 7.4) |
| Exponential (Malthusian) | `N = N₀·exp(r·t)` |
| Monomolecular | `y = a·(1 − b·exp(−k·x))` |
| Chapman–Richards | `y = a·(1 − exp(−b·x))^c` |

### 7.7 Peak / Bell-Shaped Functions (spectroscopy, chromatography)
Often fit as a **sum of K peaks** (deconvolution); supply per-peak initial centers/widths.

| Model | Form | Notes |
|-------|------|-------|
| **Gaussian** | `y = A·exp(−(x−μ)²/(2σ²))` | A = amplitude, μ = center, σ = width (FWHM = 2.355σ) |
| **Lorentzian (Cauchy)** | `y = A / (1 + ((x−x₀)/γ)²)` | heavier tails than Gaussian; γ = HWHM |
| **Voigt** | convolution of Gaussian ⊗ Lorentzian | spectral lines; no closed form (uses Faddeeva fn) |
| **Pseudo-Voigt** | `y = η·L(x) + (1−η)·G(x)` | linear blend, η ∈ [0,1]; cheap Voigt approximation |
| **Pearson VII** | `y = A·[1 + ((x−x₀)/γ)²·(2^(1/m)−1)]^(−m)` | tunable tail shape (m) |
| **Exponentially Modified Gaussian (EMG)** | Gaussian ⊗ exponential | asymmetric chromatographic peaks (tailing) |
| **Log-normal peak** | `y = A·exp(−(ln(x/x₀))²/(2σ²))` | skewed positive peaks |
| **Doniach–Šunjić** | asymmetric | XPS spectroscopy |
| **Sum of peaks** | `y = baseline(x) + Σ_k peak_k(x)` | multi-peak deconvolution; baseline often linear/polynomial |

### 7.8 Oscillatory / Periodic (parameters unknown)
- **Sinusoid:** `y = A·sin(ω·x + φ) + C`. Nonlinear when frequency ω is unknown. (Known ω → linear, §4.5.)
- **Damped sinusoid:** `y = A·exp(−λ·x)·sin(ω·x + φ) + C`.
- **Sum of sinusoids / harmonics.**
- **Init tip:** estimate ω from FFT / Lomb–Scargle periodogram before fitting.

### 7.9 Rational Functions / Padé
- **Rational:** `y = (a₀ + a₁x + ...) / (1 + b₁x + ...)`. Flexible; can capture asymptotes & poles. Watch for **poles in the data range** (denominator → 0) and parameter identifiability.
- **Padé approximant:** ratio of polynomials matching a function's series.

### 7.10 Decay / Survival / Reliability
- **Power-law decay:** `y = a·x^(−b)`.
- **Weibull (reliability):** survival `S(t) = exp(−(t/λ)^k)`; hazard, CDF forms.
- **Log-logistic, log-normal survival.**
- **Bi-exponential decay** (see 7.1).

### 7.11 Other Specialized
- **Arrhenius:** `k = A·exp(−Ea/(R·T))` (kinetics; linearize via ln k vs 1/T).
- **Logistic + linear / mixed empirical forms.**
- **Custom user-defined functions** — your program should accept an arbitrary callable `f(x, *params)` plus initial guesses and bounds (this is the most important "model" to support).

---

## 8. Nonparametric / Smoothing Methods

No fixed global parametric form — the curve is determined locally by the data.
Good for exploration and when no theoretical model exists.

| Method | Description | Key tuning |
|--------|-------------|-----------|
| **Moving average** | Mean of points in a sliding window | window size |
| **Savitzky–Golay filter** | Fit a low-order polynomial in each sliding window via local LS; great for smoothing while preserving peak shape & derivatives | window length, poly order |
| **LOWESS / LOESS** | Locally weighted regression: at each point, weighted (tricube) local linear/quadratic fit | span/bandwidth (fraction of points), degree |
| **Kernel regression (Nadaraya–Watson)** | `ŷ(x)=Σ K((x−x_i)/h)·y_i / Σ K((x−x_i)/h)` | kernel, bandwidth h |
| **Local polynomial regression** | Generalizes kernel regression to local polynomials | bandwidth, degree |
| **Smoothing / penalized splines** | See §4.6 | smoothing λ |
| **Gaussian Process Regression (Kriging)** | Bayesian nonparametric; gives mean + uncertainty bands; flexible via kernel choice (RBF, Matérn, periodic) | kernel + hyperparameters (via marginal likelihood) |
| **Binning / regressograms** | Piecewise-constant averages per bin | bin width |
| **Whittaker–Eilers smoother** | Penalized least squares smoothing on a grid | λ, penalty order |

- **Bandwidth/span selection** (CV, GCV, plug-in rules) is the central tuning problem.
- **Bias–variance tradeoff:** small bandwidth → wiggly (low bias, high variance); large → over-smoothed.

---

## 9. Robust Regression (outlier-resistant)

Pair these with any model when outliers or heavy-tailed errors are expected.

| Method | Idea |
|--------|------|
| **M-estimators** | Replace squared loss with a robust ρ-function (Huber, Tukey, Cauchy); solved by **IRLS** (down-weight large residuals iteratively). |
| **Least Absolute Deviations (LAD / L1)** | Minimize `Σ\|r_i\|`; solved via linear programming; resistant to y-outliers. |
| **RANSAC** | Random sample consensus: repeatedly fit on minimal random subsets, keep model with most inliers. Excellent with high outlier fractions. |
| **Theil–Sen estimator** | Slope = median of all pairwise slopes; very robust, nonparametric (linear models). |
| **Repeated median** | Robust extension of Theil–Sen. |
| **Least Trimmed Squares (LTS)** | Minimize sum of the smallest h squared residuals (ignore worst points). |
| **Least Median of Squares (LMS)** | Minimize the median squared residual. |
| **Huber / bisquare weighted fits** | Bounded influence; default robust choice for general curve fitting. |
| **Passing–Bablok / Deming** | Robust method-comparison regression (also handles errors-in-variables). |

---

## 10. Interpolation (Exact-Fit) Methods

Passes exactly through all data points — distinct from regression. Useful for
resampling, dense plotting, or noise-free data.

| Method | Description | Caveat |
|--------|-------------|--------|
| **Linear (piecewise)** | Straight segments between points | not smooth (kinks) |
| **Polynomial (Lagrange / Newton divided differences)** | Single degree-(n−1) polynomial through all n points | **Runge's phenomenon** — wild oscillation at edges for high n; avoid for many points |
| **Barycentric Lagrange** | Numerically stable polynomial interpolation evaluation | same Runge risk |
| **Cubic spline** | Piecewise cubics, C² continuous | standard smooth interpolant |
| **Natural / clamped / not-a-knot splines** | Different boundary conditions | choose per endpoint behavior |
| **Monotone cubic (PCHIP / Fritsch–Carlson)** | Shape-preserving; no overshoot between points | preserves monotonicity |
| **Akima spline** | Reduced oscillation near outliers/abrupt changes | local, robust |
| **Hermite interpolation** | Matches values **and** derivatives | needs derivative data |
| **Nearest-neighbor / step** | Piecewise constant | non-smooth |
| **Radial basis function interpolation** | Scattered/multivariate data | choose RBF & shape param |
| **Trigonometric / FFT interpolation** | For periodic data | assumes periodicity |
| **Multivariate: bilinear / bicubic / Kriging** | Grids & scattered N-D data | — |

---

## 11. Implementation Details

Practical concerns your program must handle for robust fitting.

### 11.1 Initial parameter estimation (critical for nonlinear fits)
Bad starting values are the #1 cause of nonlinear-fit failure. Strategies:
- **Linearize** the model (§4.13) and use the closed-form result as the seed.
- **Feature-based heuristics:** amplitude from data range; center/midpoint from
  where y crosses halfway; rate from initial slope or via FFT for frequencies;
  asymptotes from min/max or tail behavior.
- **Grid search** over a coarse parameter grid, then refine.
- **Multi-start** from several random seeds within bounds.
- Provide sensible **defaults per model** in your model registry.

### 11.2 Parameter bounds & constraints
- Support **box bounds** (lower/upper per parameter) — use a bounded optimizer (TRF, L-BFGS-B).
- Support **equality/inequality constraints** (e.g. monotonicity, positivity) via SLSQP / trust-constr.
- **Reparameterize** to enforce constraints naturally (e.g. fit `ln(k)` to keep k>0; fit angles via sin/cos to avoid wrapping).

### 11.3 Scaling & conditioning
- **Center and scale** x (and sometimes y) — dramatically improves conditioning, especially for polynomials and exponentials.
- Use **QR or SVD** for linear solves, not direct matrix inversion.
- Report and check the **condition number** of XᵀX / JᵀJ.

### 11.4 Weighting
- Allow per-point weights / known uncertainties σ_i; default `w_i = 1/σ_i²`.
- Offer preset weighting schemes: equal, 1/y, 1/y², 1/x, instrumental.

### 11.5 Convergence criteria
- Stop on: small change in parameters (`xtol`), small change in cost (`ftol`),
  small gradient (`gtol`), or max iterations / function evaluations.
- Report **convergence status**, iteration count, and final cost.

### 11.6 Uncertainty quantification
- **Covariance matrix:** `Cov(θ̂) = s²·(JᵀJ)⁻¹`, with `s² = SSR/(n−p)`. Parameter SEs = sqrt of diagonal.
- **Confidence intervals:** asymptotic (`θ̂ ± t·SE`), **profile likelihood** (more accurate for nonlinear), or **bootstrap** (resample residuals or cases).
- **Prediction intervals** for new x; **confidence bands** for the fitted curve (via the delta method / Jacobian).
- **Correlation matrix** of parameters — flag high correlations (|ρ|→1 ⇒ non-identifiable / over-parameterized model).

### 11.7 Model comparison & selection
- Nested models → **F-test**; general → **AIC / AICc / BIC**; predictive → **cross-validation**.
- Automatic model ranking: fit a library of candidate models, sort by AICc.

### 11.8 Data handling & robustness
- Handle **missing values / NaNs**, duplicate x, insufficient data (n ≤ p → under-determined), and degenerate cases (zero variance).
- **Outlier detection** (studentized residuals, Cook's distance) with option to switch to robust loss.
- Validate that requested transforms are defined on the data (e.g. log requires y>0).
- Guard against **divide-by-zero** in rational models and metrics (MAPE at y=0).

### 11.9 Reproducibility & reporting
- Fixed random seeds for stochastic optimizers/bootstrap.
- Standard fit report: parameters ± SE, CIs, R²/adj-R², RMSE, χ²/dof, AIC/BIC, convergence info, residual diagnostics, and the fitted curve for plotting.

---

## 12. Library / Function Mapping

If implementing in **Python** (the most common stack for a stats program), these
map directly to the methods above. Adapt to your chosen language as needed.

| Task | Library / function |
|------|--------------------|
| Linear / polynomial closed-form | `numpy.polynomial` (Polynomial, Chebyshev, Legendre, …), `numpy.linalg.lstsq` |
| OLS / WLS / GLS, GLMs, robust, diagnostics | `statsmodels` (`OLS`, `WLS`, `GLS`, `GLM`, `RLM`, `QuantReg`) |
| Ridge / Lasso / Elastic Net / PCR / PLS | `scikit-learn` (`Ridge`, `Lasso`, `ElasticNet`, `PLSRegression`, `Pipeline` + `PCA`) |
| General nonlinear least squares | `scipy.optimize.curve_fit` (LM/TRF), `scipy.optimize.least_squares` (LM / TRF / dogbox, bounds, robust `loss=`) |
| General-purpose minimization (any loss) | `scipy.optimize.minimize` (BFGS, L-BFGS-B, Nelder–Mead, Powell, SLSQP, trust-constr) |
| Global optimizers | `scipy.optimize.differential_evolution`, `basinhopping`, `dual_annealing`, `shgo` |
| Orthogonal distance / errors-in-variables | `scipy.odr` |
| Splines (interpolation & smoothing) | `scipy.interpolate` (`CubicSpline`, `PchipInterpolator`, `Akima1DInterpolator`, `UnivariateSpline`, `BSpline`, `splrep/splev`, `make_smoothing_spline`) |
| 1-D/N-D interpolation | `scipy.interpolate` (`interp1d`, `RBFInterpolator`, `griddata`) |
| LOWESS | `statsmodels.nonparametric.smoothers_lowess.lowess` |
| Kernel regression | `statsmodels.nonparametric.KernelReg` |
| Savitzky–Golay | `scipy.signal.savgol_filter` |
| Gaussian Process Regression | `scikit-learn.gaussian_process`, or `GPy`/`GPflow` |
| Robust / RANSAC / Theil–Sen | `scikit-learn` (`RANSACRegressor`, `TheilSenRegressor`, `HuberRegressor`) |
| Peak fitting / spectroscopy | `lmfit` (named params, bounds, composite models, CIs), `scipy.signal.find_peaks` |
| Flexible model building, profile CIs, model comparison | `lmfit` (excellent for a fitting-centric app) |
| Symbolic Jacobians / autodiff | `sympy`, `jax`, `autograd` |
| FFT / periodogram for frequency init | `numpy.fft`, `scipy.signal`, `astropy.timeseries.LombScargle` |

> **Recommendation:** `scipy.optimize.least_squares` + `lmfit` together cover the
> vast majority of nonlinear fitting needs (bounds, robust loss, parameter names,
> uncertainties), while `numpy`/`statsmodels`/`scikit-learn` cover the linear,
> regularized, GLM, and robust-linear cases in closed form.

---

## 13. Decision Guide & Suggested Architecture

### 13.1 Choosing a method (flow)
1. **Is the goal exact pass-through?** → Interpolation (§10).
2. **No theoretical model, just smooth/explore?** → Nonparametric smoothing (§8).
3. **Is the model linear in parameters?** (linear, polynomial, spline-basis, known-frequency Fourier, transformable) → Linear closed-form solver (§4). Add regularization (§4.10) if many/collinear predictors.
4. **Non-Gaussian response (counts, binary, rates)?** → GLM (§5).
5. **Parameters enter nonlinearly?** → Nonlinear regression (§6–7): pick a model from the catalog, get good initial values, use Levenberg–Marquardt (or TRF with bounds).
6. **Outliers / heavy tails?** → swap in robust loss / robust method (§9, §2.6).
7. **Error in x too?** → ODR / Deming / TLS (§4.12).
8. **Don't know which model?** → fit a candidate library, rank by AICc + CV (§3.2, §11.7).

### 13.2 Suggested modular architecture
- **Data layer:** load, validate, handle NaNs/weights, transforms, scaling.
- **Model registry:** each model = {name, function `f(x, *θ)`, parameter names,
  default-initial-guess function, default bounds, optional analytic Jacobian,
  linearizable? flag}. Make user-defined models first-class.
- **Loss module:** OLS / WLS / GLS / robust losses (§2).
- **Solver layer:** linear (QR/SVD closed form) and nonlinear (LM / TRF / global)
  back-ends behind one interface; auto-route linear-in-params models to the fast path.
- **Inference module:** covariance, SEs, CIs (asymptotic / profile / bootstrap),
  prediction bands.
- **Metrics module:** all of §3 (shared across methods).
- **Diagnostics module:** residual plots & tests (§3.4).
- **Model-selection module:** AIC/BIC/F-test/CV, candidate ranking.
- **Reporting/plotting layer:** standardized fit report + fitted-curve output.

### 13.3 Master taxonomy (summary)
```
Curve Fitting
├── Interpolation (exact)            → linear, polynomial, splines, PCHIP, Akima, RBF
├── Regression (approximate)
│   ├── Linear-in-parameters         → simple/multiple linear, polynomial,
│   │                                   orthogonal polys, basis/RBF/Fourier,
│   │                                   splines (regression/smoothing/P-spline),
│   │                                   segmented, weighted, GLS,
│   │                                   ridge/lasso/elastic-net, PCR/PLS,
│   │                                   TLS/Deming/ODR, linearizable transforms
│   ├── Generalized Linear (GLM)     → logistic, probit, multinomial, ordinal,
│   │                                   Poisson, neg-binomial, gamma, Tweedie; GAM
│   ├── Nonlinear-in-parameters      → exponential, power, log, sigmoid/4PL/5PL,
│   │                                   Hill, Michaelis–Menten, growth (Gompertz,
│   │                                   logistic, von Bertalanffy, Richards),
│   │                                   peaks (Gaussian/Lorentzian/Voigt/EMG/…),
│   │                                   rational/Padé, oscillatory, decay/Weibull,
│   │                                   custom
│   └── Robust                       → M-estimators, LAD, RANSAC, Theil–Sen,
│                                       LTS/LMS, Passing–Bablok
└── Nonparametric / Smoothing        → moving average, Savitzky–Golay, LOWESS/LOESS,
                                        kernel/local-poly, smoothing splines, GPR
```

---

*End of reference. Each model in §4–§7 and each method in §8–§10 is implementable
from the form + fitting method given; pair with the shared loss (§2), metrics (§3),
optimizers (§6), and implementation details (§11) modules.*
