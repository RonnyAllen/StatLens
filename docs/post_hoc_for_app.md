# Choosing and Explaining Post Hoc Tests for an App

This document is structured so you can directly translate each test into **app logic** and **tooltips/help text**.
For each family/test you get:
- Purpose
- Assumptions your app should check
- When to recommend it
- When to avoid it
- Short explanation text (for UI)

It is written with **GraphPad Prism–style workflows** in mind but is software-agnostic.

---
## 1. Global logic: when to offer post hoc tests

Your app should only offer/post-run post hoc tests when **all** of the following are true:

1. A global omnibus test has been run (e.g., one-way ANOVA, Welch’s ANOVA, Kruskal–Wallis) **and** the p-value is below the chosen alpha.
2. The user has **more than two groups**.
3. The user has declared which type of design and comparison family they care about:
   - “Compare every group with every other group” (all pairwise comparisons)
   - “Compare each treatment to a single control group”
   - “Compare only a few pre-specified pairs or linear contrasts”

Your app can implement this as a decision tree:

1. Identify omnibus test (ANOVA / Welch / Kruskal–Wallis).
2. Check assumptions (normality, equal variance) and group sizes.
3. Ask user which comparison family they want.
4. Based on these, present a **recommended test** and optional alternatives.

---
## 2. Parametric post hoc tests (equal-variance ANOVA)

These tests are used when you have run a **standard parametric ANOVA** with reasonably normal residuals and **homogeneous variances**.

### 2.1 Tukey’s HSD (Tukey / Tukey–Kramer)

**Purpose**  
Multiple comparisons after one-way ANOVA to test **all pairwise differences between group means** while controlling family-wise error.

**Assumptions your app should check**
- Dependent variable: continuous.
- Groups: independent.
- Omnibus: ordinary one-way ANOVA is significant.
- Variances: approximately equal (via Levene/Bartlett or user declaration).
- Group sizes: equal or not too different (Tukey–Kramer handles mild imbalance).

**When your app should recommend Tukey HSD**
- User chooses “compare every group with every other group”.
- One-way ANOVA with equal variances passed.
- Number of groups is modest (e.g., 3–10) and sample sizes per group not extremely small.

**When to avoid or de-prioritize**
- Clear heteroscedasticity (unequal variances) or very unbalanced n.
- Non-normal data with small n where ANOVA is dubious.

**Short explanation for UI**
> *Tukey’s HSD compares all pairs of group means after a significant ANOVA, while controlling the chance of at least one false positive across all comparisons. Recommended when variances are similar and all pairwise differences are of interest.*

---
### 2.2 Bonferroni / Holm / Šidák (pairwise t-tests with correction)

**Purpose**  
Provide a **flexible, assumption-agnostic multiple-comparison correction** for a **small, pre-specified set of comparisons** (not necessarily all pairs).

**Assumptions**
- Whatever assumptions apply to the underlying tests (usually t-tests or ANOVA residuals).
- Independence of observations.

**Variants**
- **Bonferroni**: multiply each p by m (number of tests) or compare to alpha/m.
- **Holm**: step-down improvement, more powerful but still controls FWER.
- **Šidák/ Holm–Šidák**: slightly less conservative under independence.

**When to recommend (Bonferroni/Holm)**
- User selects “only a few planned comparisons”.
- Researcher has defined explicit pairs or contrasts ahead of time.
- You want a robust “default” correction that works even outside ANOVA.

**When to avoid**
- User wants all pairwise comparisons among many groups (Tukey or Games–Howell is more standard and often more powerful).
- Very large number of comparisons where FDR methods may be preferable.

**Short explanation for UI**
> *Bonferroni-type procedures adjust p-values for a set of planned comparisons to keep the overall chance of any false positive below alpha. They are simple and robust but can be conservative when many tests are done.*

---
### 2.3 Dunnett’s test (treatments vs control)

**Purpose**  
Compare **multiple treatment groups to a single control group**, not treatment vs treatment.

**Assumptions**
- Same as one-way ANOVA with equal variances.
- A single group is explicitly labelled as “control”.

**When to recommend**
- User chooses “compare each treatment to one control only”.
- One-way ANOVA is significant and equal-variance assumption holds.

**When to avoid**
- User also wants treatment vs treatment comparisons (then Tukey or Bonferroni may be more appropriate).
- No clear control group.

**Short explanation for UI**
> *Dunnett’s test compares each treatment group with a designated control while controlling the overall Type I error rate. It is more powerful than all-pairs tests when only control comparisons matter.*

---
### 2.4 Scheffé’s test

**Purpose**  
Very flexible method that can test **any linear contrast** (not just pairwise mean differences) after ANOVA while strictly controlling family-wise error.

**Assumptions**
- Same as ANOVA: normal residuals, equal variances, independent observations.
- Usually used with general linear models.

**When to recommend**
- User wants to test **complex contrasts**, e.g., (mean of groups A and B) vs (mean of groups C and D).
- User chooses a “data exploration / complex contrasts” mode.

**When to avoid**
- Only simple pairwise comparisons are needed (Tukey or Bonferroni/Holm is more powerful).

**Short explanation for UI**
> *Scheffé’s test is a very conservative post hoc procedure that allows you to test any combination of group means, not only pairs. It is useful for complex, exploratory comparisons but has lower power for simple pairwise tests.*

---
### 2.5 Fisher’s LSD and legacy range tests (Newman–Keuls, Duncan)

**Purpose**  
Older, more liberal procedures for pairwise comparisons.

**Assumptions**
- Same as ANOVA with equal variances.

**When to recommend**
- In modern practice, usually **do not recommend by default**; offer only under an “advanced/legacy methods” toggle with warnings.

**When to avoid**
- Many groups or many comparisons: these methods can seriously inflate family-wise error.

**Short explanation for UI**
> *Fisher’s LSD and some older range tests are powerful but can produce too many false positives when many groups are compared. They are generally not recommended as default post hoc options.*

---
## 3. Parametric post hoc tests for unequal variances (heteroscedastic ANOVA)

These are used when **Levene/Bartlett tests or plots show unequal variances** or group sizes are strongly unbalanced.

Your app should:
1. Detect heteroscedasticity.
2. Suggest a **Welch’s ANOVA** as the omnibus test.
3. Then offer heteroscedastic post hoc tests.

### 3.1 Games–Howell

**Purpose**  
All pairwise comparisons when variances are unequal and/or group sizes differ.

**Assumptions**
- Dependent variable: continuous.
- Groups: independent.
- Variances: allowed to be unequal; each group has its own variance.
- Sample sizes can be unequal.
- Works best with moderate or larger n per group.

**When to recommend**
- User chooses “all pairwise comparisons”.
- Heteroscedasticity is detected.
- Sample sizes per group are not extremely small.

**When to avoid**
- Very small n in some groups (you might instead recommend Dunnett T3 or Tamhane T2, which are more conservative).

**Short explanation for UI**
> *Games–Howell compares all pairs of group means when group variances and sample sizes are unequal. It adjusts both the standard errors and degrees of freedom to maintain a reasonable error rate in heteroscedastic data.*

---
### 3.2 Dunnett T3

**Purpose**  
All pairwise comparisons under unequal variances, most often recommended when sample sizes are **small**.

**Assumptions**
- Same as Games–Howell (heteroscedastic, independent groups).

**When to recommend**
- Heteroscedasticity detected.
- Some groups have **small n** (e.g., < 20–50 depending on your app’s preset).

**Short explanation for UI**
> *Dunnett T3 is a conservative post hoc test for all pairwise comparisons when variances are unequal and sample sizes are small. It prioritizes control of Type I error over power.*

---
### 3.3 Tamhane T2 and Dunnett C

**Purpose**  
Alternative unequal-variance post hoc tests; generally conservative.

**Assumptions**
- Heteroscedasticity allowed; independent groups.

**When to recommend**
- Advanced/alternative options when user wants stricter control in unequal-variance situations.
- When software/library implements them and the user requests a more conservative choice.

**Short explanation for UI**
> *Tamhane T2 and Dunnett C are conservative tests for pairwise comparisons under unequal variances. They are suitable when you want stronger protection against false positives at the expense of sensitivity.*

---
### 3.4 Welch pairwise t-tests + correction

**Purpose**  
Generic heteroscedastic strategy: do **Welch t-tests** for each requested pair, then apply Bonferroni / Holm / FDR correction.

**Assumptions**
- Same as Welch t-test: unequal variances allowed, independent samples.

**When to recommend**
- When a specialized heteroscedastic post hoc (Games–Howell, Dunnett T3) is not available in the underlying engine.
- For custom subset comparisons in unequal-variance settings.

**Short explanation for UI**
> *Welch-adjusted pairwise tests compare groups without assuming equal variances. Multiplicity-corrected p-values keep the overall error rate under control for the set of comparisons you choose.*

---
## 4. Non-parametric post hoc tests (Kruskal–Wallis and similar)

Use these when:
- Data are ordinal or strongly non-normal.
- Sample sizes are small and parametric assumptions are not plausible.
- Omnibus test: Kruskal–Wallis or another rank-based test is significant.

### 4.1 Dunn’s test (after Kruskal–Wallis)

**Purpose**  
Pairwise comparisons using the **same ranks and pooled variance** as Kruskal–Wallis.

**Assumptions**
- Independent groups.
- Ordinal or continuous data.

**When to recommend**
- Kruskal–Wallis test is significant.
- User wants all or selected pairwise comparisons.

**Short explanation for UI**
> *Dunn’s test is the standard post hoc procedure after a significant Kruskal–Wallis test. It compares group rank sums using the same pooled variance and adjusts p-values for multiple comparisons.*

---
### 4.2 Pairwise Mann–Whitney (Wilcoxon rank-sum) + correction

**Purpose**  
Simple non-parametric strategy when Dunn’s test is not available.

**Assumptions**
- Same as Mann–Whitney U test.

**When to recommend**
- Kruskal–Wallis is significant.
- Your library provides pairwise rank-sum tests and multiplicity corrections but not Dunn/Conover.

**Short explanation for UI**
> *This option runs pairwise Mann–Whitney tests between groups and adjusts the resulting p-values for multiple testing. It is a pragmatic alternative when dedicated post hoc tests are not available.*

---
### 4.3 Conover–Iman, Nemenyi, Steel–Dwass

**Purpose**  
More specialized rank-based multiple comparison procedures.

**When to recommend**
- User explicitly selects them under “advanced non-parametric options”.
- Your app targets users familiar with these methods (e.g., biostatisticians).

**Short explanation for UI**
> *These are advanced rank-based multiple comparison procedures used in specific non-parametric designs. They provide alternatives to Dunn’s test when different error-control properties or designs are required.*

---
## 5. General multiple-comparison corrections (for any p-value set)

These procedures operate on **sets of p-values** regardless of the underlying test.

### 5.1 Bonferroni, Holm, Hochberg (FWER control)

**Purpose**  
Control the probability of **at least one Type I error** in a family of tests (strong family-wise error rate control).

**When to expose**
- As a selectable “correction method” any time the user runs multiple pairwise or contrast tests.
- As the default option for small-to-moderate numbers of comparisons when reviewers expect strict control.

**Short explanation for UI**
> *These corrections adjust p-values for a family of tests so that the chance of at least one false positive remains below the chosen alpha level. Holm is often preferred over simple Bonferroni because it is less conservative but equally strict.*

---
### 5.2 Benjamini–Hochberg (BH) and other FDR methods

**Purpose**  
Control the **false discovery rate** (expected proportion of false positives among all rejected tests) instead of FWER.

**When to recommend**
- User runs a **large number of comparisons** (e.g., omics-scale, many endpoints) and wants higher power.
- Field norms accept FDR control.

**Short explanation for UI**
> *Benjamini–Hochberg controls the expected fraction of false discoveries among all significant results, making it more powerful than strict family-wise error methods when many tests are performed.*

---
## 6. High-level decision tree for your app

You can implement the following simplified decision logic:

1. **Check omnibus test**
   - If not significant: show “No post hoc tests run (no overall difference detected).”

2. **Ask comparison family**
   - All pairwise comparisons
   - Only treatments vs control
   - A few planned comparisons
   - Complex contrasts

3. **Check assumptions**
   - Data type/normality
   - Equal vs unequal variances
   - Balanced vs unbalanced n

4. **Recommend**
   - Parametric, equal variance, all pairs → **Tukey HSD**.
   - Parametric, equal variance, treatments vs control → **Dunnett**.
   - Parametric, equal variance, few planned comparisons → **pairwise t-tests + Holm/Bonferroni**.
   - Parametric, equal variance, complex contrasts → **Scheffé**.
   - Parametric, unequal variances, all pairs → **Games–Howell** (or **Dunnett T3 / Tamhane T2** when n is small).
   - Parametric, unequal variances, few planned comparisons → **Welch pairwise tests + Holm/Bonferroni**.
   - Non-parametric (Kruskal–Wallis) → **Dunn’s test** (or **pairwise Mann–Whitney + correction**).
   - Many tests (omics-scale) → offer **FDR (Benjamini–Hochberg)** as an alternative.

Exposing this structure as declarative rules in your “Google antigravity” app will let you auto-suggest a sensible default post hoc method and generate context-aware explanations for users.
