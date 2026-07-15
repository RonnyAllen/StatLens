# Choosing Post Hoc Tests: A Detailed Guide for Biological and Experimental Research

## Executive overview

Post hoc tests are multiple-comparison procedures used after a global test (typically ANOVA or Kruskal–Wallis) shows a significant overall effect, to identify which specific group means differ while controlling the family‑wise error rate or false discovery rate. The choice of post hoc depends mainly on: (1) parametric vs non‑parametric setting, (2) equal vs unequal variances and sample sizes, (3) whether you want all pairwise comparisons or only comparisons versus a control, and (4) how strict you want to be about Type I error versus power.[^1][^2][^3][^4]

This guide organizes the most commonly used post hoc procedures into parametric, non‑parametric, and general multiple‑comparison corrections, explains what each assumes, and gives practical decision rules for when each is preferred in typical biological experiments.


## Conceptual background: what post hoc tests do

A one‑way or factorial ANOVA tests the null hypothesis that all group means are equal. A significant F statistic tells you that at least one mean differs, but not which ones differ; post hoc tests decompose this overall effect into interpretable pairwise or contrast‑based comparisons while adjusting for the inflated Type I error that arises from doing many tests simultaneously.[^2][^4][^5]

Post hoc procedures differ in what family of comparisons they protect (all pairwise vs a pre‑specified subset), how strongly they control family‑wise error (FWER) versus false discovery rate (FDR), and how much power they retain to detect real differences. In practice, the key trade‑off is that more conservative procedures reduce false positives at the cost of power, whereas more liberal procedures increase sensitivity but at a greater risk of spurious findings.[^6][^3][^5]


## Big‑picture decision framework

For practical use, it is helpful to think in three layers: (1) what omnibus test you ran, (2) what family of comparisons you care about, and (3) whether assumptions such as homoscedasticity and normality are acceptable.[^3][^4]

1. **Omnibus test and data type**
   - Parametric ANOVA with approximately normal residuals and independent groups → parametric post hoc tests such as Tukey HSD, Dunnett, Scheffé, Games–Howell (for unequal variances), or t‑tests with p‑value corrections.[^7][^2][^3]
   - Welch’s ANOVA for unequal variances → post hoc tests designed for heteroscedastic data, such as Games–Howell, Dunnett T3, or Tamhane T2.[^8][^9][^3]
   - Kruskal–Wallis or other rank‑based omnibus tests → non‑parametric post hoc tests such as Dunn’s test, Conover–Iman, or pairwise Mann–Whitney with multiplicity correction.[^10][^11][^12]

2. **Comparison family**
   - All pairwise comparisons among k groups → use Tukey‑type procedures (Tukey HSD / Tukey–Kramer) under equal variances, or Games–Howell / Dunnett T3 / Tamhane T2 when variances are unequal.[^7][^8][^3]
   - Each treatment vs a single control only → use Dunnett’s test (parametric) or non‑parametric analogues.[^4][^6][^3]
   - Complex contrasts (e.g., average of two treatments vs another) → use Scheffé or planned contrasts with appropriate correction.[^2][^3]
   - A small, pre‑specified set of comparisons (not all pairs) → use Bonferroni, Holm, or similar stepwise corrections on a set of t‑tests.[^5][^6][^3]

3. **Assumptions about variances and sample sizes**
   - Variances roughly equal and group sizes similar → classical ANOVA post hoc tests such as Tukey HSD, Dunnett, Scheffé perform well.[^3][^4][^7]
   - Variances clearly unequal and/or sample sizes very different → heteroscedastic procedures like Games–Howell, Tamhane T2, or Dunnett T3 are recommended because standard Tukey is sensitive to variance inequality.[^9][^8][^3]

The sections below detail major families of post hoc tests, with emphasis on when they are preferred and what to watch out for.


## Parametric post hoc tests for equal variances

### Tukey’s HSD (Tukey’s range test)

Tukey’s Honest Significant Difference (HSD) is one of the most widely used single‑step procedures for all pairwise comparisons following a one‑way ANOVA. It is based on the studentized range distribution and maintains the family‑wise error rate across all pairwise mean differences, providing a good balance between error control and power when ANOVA assumptions hold.[^4][^2][^7][^3]

**When to choose Tukey HSD**
- You ran a standard one‑way ANOVA with approximately equal group sizes and no strong evidence of heteroscedasticity.
- Your primary interest is in all pairwise comparisons among k groups (every mean vs every other mean).
- You want simultaneous confidence intervals for mean differences as well as p‑values.

**GraphPad Prism context**
Prism offers Tukey’s multiple comparisons following ordinary one‑way ANOVA and uses the Tukey–Kramer variant when group sizes differ, which adjusts for unbalanced designs while still assuming equal variances. For factorial ANOVA, Prism typically offers Tukey‑type or Šidák‑type corrections on simple main‑effect or interaction slices.[^4]


### Bonferroni‑corrected pairwise t‑tests

The Bonferroni correction is a simple multiplicity adjustment that multiplies each raw p‑value by the number of comparisons m (or equivalently tests against \\(\alpha/m\\)). It can be applied to any collection of hypothesis tests, including pairwise t‑tests after ANOVA, and strongly controls the family‑wise error rate but is often conservative, especially when m is large.[^6][^5]

**When to choose Bonferroni**
- You have a small, pre‑specified set of comparisons of biological interest rather than all pairwise combinations.
- You want a straightforward, widely recognized control of family‑wise error that reviewers will accept without controversy.
- You are less concerned about reduced power and more concerned about minimizing false positives.

**Holm–Bonferroni and Šidák variants**
The Holm procedure is a step‑down improvement over Bonferroni that adjusts p‑values sequentially from smallest to largest, often providing higher power while still controlling FWER. Šidák‑adjusted comparisons use an adjustment based on \\(1-(1-\alpha)^{1/m}\\), which is slightly less conservative than standard Bonferroni under independence assumptions. Many software packages, including Prism, offer Holm or Šidák as options for multiple t‑tests.[^13][^5][^6]


### Dunnett’s test: treatments vs control

Dunnett’s test is a focused post hoc procedure designed for comparing multiple treatment groups to a single control while controlling the overall Type I error rate. Unlike Tukey HSD, Dunnett’s test does not test all pairwise treatment‑to‑treatment comparisons, which gives it more power for the specific control‑focused family of hypotheses.[^6][^3][^4]

**When to choose Dunnett**
- Your design includes one designated control group and one or more treatment groups, and the scientific question is whether each treatment differs from control.
- You are not interested in differences among treatment groups themselves.
- Variances are reasonably equal and data are approximately normal.

In Prism, Dunnett’s post hoc test can be selected after one‑way ANOVA when specifying the control group, and the software reports adjusted p‑values for each treatment‑versus‑control comparison.


### Scheffé’s test for complex contrasts

Scheffé’s method is a flexible post hoc procedure that allows testing any linear contrast (not just simple pairwise differences) while controlling the family‑wise error rate. Because it protects a very broad family of contrasts, Scheffé’s test is conservative for pairwise comparisons but is particularly useful when researchers want to explore more complex hypotheses, such as averaging several groups and comparing them to another average.[^2][^3]

**When to choose Scheffé**
- You anticipate or discover complex patterns (e.g., “average of high‑dose and medium‑dose vs low‑dose”) and want one procedure that validly covers such contrasts.
- You are willing to trade power for the flexibility of testing many possible contrasts post hoc.

Scheffé’s method is more commonly implemented in general linear model procedures (e.g., in R or SPSS) than in point‑and‑click biology‑focused interfaces, but the underlying idea is often accessible via contrast‑coding options with Scheffé‑adjusted critical values.[^3][^2]


### Fisher’s LSD and related liberal procedures

Fisher’s Least Significant Difference (LSD) compares pairs of means using the pooled variance from an initial ANOVA and does not adjust for multiple comparisons beyond requiring a significant omnibus F. As a result, it has good power when the number of groups is small but does not adequately control family‑wise error when many comparisons are made.[^1][^6]

**When to avoid or cautiously use Fisher’s LSD**
- With more than three groups, Fisher’s LSD can inflate Type I error substantially; many methodologists advise against its use as a routine post hoc test.[^1][^6]
- It may be acceptable in very focused, small comparisons (e.g., three groups with strong a priori hypotheses), but more modern alternatives like Holm or Tukey are usually preferred.

Other classical stepwise procedures, such as Newman–Keuls or Duncan’s multiple range test, share similar concerns about error‑rate control and are now less commonly recommended in rigorous biological statistics.[^6][^1]


## Parametric post hoc tests for unequal variances or unbalanced designs

When the homogeneity of variance assumption is violated (as indicated by Levene’s or Bartlett’s tests) or group sizes differ substantially, standard ANOVA post hoc tests like Tukey HSD can become liberal or otherwise invalid. Several procedures have been developed for this heteroscedastic setting, often used after Welch’s ANOVA.[^8][^3]


### Games–Howell test

Games–Howell is a widely recommended post hoc procedure for all pairwise comparisons when group variances are unequal and sample sizes may differ. It uses separate variance estimates for each group and a t‑distribution with adjusted degrees of freedom, providing approximate control of the Type I error rate across all pairwise tests.[^8][^3]

**When to choose Games–Howell**
- Levene’s or Bartlett’s test suggests unequal variances, or exploratory plots show strong heteroscedasticity.
- Sample sizes differ markedly across groups.
- You want to compare all pairs of groups in a one‑way layout.

Simulation work suggests that Games–Howell maintains good Type I error control under many unequal‑variance scenarios and is less conservative than some alternatives, making it a popular choice in modern practice.[^8][^3]


### Dunnett T3, Tamhane T2, and Dunnett C

Other post hoc procedures for unequal variances include Dunnett T3, Tamhane T2, and Dunnett C, which are generally more conservative than Games–Howell. These methods rely on approximations similar to Welch‑type t‑tests and are designed for all pairwise comparisons in heteroscedastic settings.[^9][^8]

**When to choose these tests**
- You are working with small sample sizes per group (e.g., n < 50), where some software vendors recommend Dunnett T3 as more appropriate.[^9]
- You prefer a more conservative procedure (accepting fewer significant findings) in exchange for stronger protection against Type I error in unequal‑variance contexts.[^8]

GraphPad Prism’s documentation, for example, advises using Dunnett T3 for small sample sizes and Games–Howell for larger samples when unequal variances are suspected, reflecting this power‑conservatism trade‑off.[^9]


### Welch‑type pairwise comparisons with multiplicity correction

An alternative to specialized heteroscedastic post hoc procedures is to perform pairwise Welch t‑tests between groups (which do not assume equal variances) and then apply a multiple‑comparison correction such as Holm, Benjamini–Hochberg, or Bonferroni to the resulting p‑values. This approach is flexible and widely implemented, although the overall error properties depend on the chosen correction.[^5][^3][^6]

**When to choose Welch + correction**
- Software does not provide Games–Howell or Tamhane‑type tests, but does offer Welch t‑tests and p‑value adjustment.
- You are comfortable explicitly specifying the set of comparisons and the correction method.


## Non‑parametric post hoc tests

When the data are ordinal, strongly non‑normal with small sample sizes, or contain outliers that make parametric ANOVA questionable, non‑parametric omnibus tests and corresponding post hoc procedures are appropriate.[^11][^12][^10]


### Dunn’s test after Kruskal–Wallis

The Kruskal–Wallis test is a rank‑based analogue of one‑way ANOVA, testing whether at least one group distribution differs from the others. To identify which groups differ, Dunn’s test is commonly used as a post hoc procedure, computing pairwise comparisons based on the same rank information and applying a multiple‑comparison correction.[^12][^10][^11]

**When to choose Dunn’s test**
- You used Kruskal–Wallis because assumptions for parametric ANOVA were not met.
- The outcome is ordinal or strongly skewed and cannot be satisfactorily transformed.
- You want pairwise comparisons among all groups using the same ranks as the omnibus test.

Many implementations allow users to select Bonferroni, Holm, or Benjamini–Hochberg corrections within Dunn’s framework, balancing strictness and power.[^11][^12]


### Pairwise Mann–Whitney tests with correction

Another pragmatic strategy after a significant Kruskal–Wallis test is to perform pairwise Mann–Whitney U tests (Wilcoxon rank‑sum) between all groups and adjust p‑values using Bonferroni, Holm, or other procedures. This is simple to implement but does not reuse the pooled variance structure of Kruskal–Wallis as elegantly as Dunn’s test.[^12]

**When to choose this approach**
- Dunn’s test is not available in your software, but pairwise Mann–Whitney tests with multiplicity correction are.
- Sample sizes are moderate and you accept that the approach is somewhat ad hoc compared with Dunn or Conover–Iman.


### Conover–Iman and other non‑parametric multiple comparisons

The Conover–Iman test is a more powerful but less widely known multiple‑comparison method for rank‑based data, sometimes recommended as an alternative to Dunn’s test. Other procedures, such as Nemenyi or Steel–Dwass, address particular designs (e.g., all pairwise comparisons after Friedman or Kruskal–Wallis, or comparisons of several treatments to a control in non‑parametric settings).[^10][^11][^12]

**When to consider these tests**
- You are working in a non‑parametric framework (Kruskal–Wallis, Friedman) and your field’s statistical literature or software defaults suggest Nemenyi, Conover–Iman, or Steel–Dwass.
- You need non‑parametric analogues of Dunnett‑type or Tukey‑type comparisons.


## General multiple‑comparison correction procedures

Beyond specific ANOVA‑linked post hoc tests, there is a broad family of multiple‑comparison corrections that can be applied to collections of p‑values arising from any set of tests. These include classical family‑wise error methods (Bonferroni, Holm, Hochberg) and modern false discovery rate methods (Benjamini–Hochberg, Benjamini–Yekutieli).[^5][^6]


### Bonferroni, Holm, Hochberg

As noted above, Bonferroni, Holm, and related procedures adjust individual p‑values to control the chance of making one or more Type I errors across a family of tests. Holm’s method, for example, sorts p‑values and multiplies each by a decreasing factor, yielding uniformly greater or equal power relative to simple Bonferroni while preserving strong FWER control.[^5][^6]

These methods are agnostic to the underlying test; they can be used to adjust collections of t‑tests, non‑parametric tests, or other statistics, making them useful when no dedicated post hoc procedure exists for a specific design.[^6][^5]


### Benjamini–Hochberg and FDR‑based methods

In contexts with many comparisons (e.g., omics, imaging, high‑throughput screens), strongly controlling family‑wise error can be overly conservative, motivating procedures that instead control the expected proportion of false discoveries among rejected hypotheses. The Benjamini–Hochberg (BH) procedure is a widely used step‑up method that controls FDR under certain dependence conditions and is more powerful than FWER‑based methods, especially when many null hypotheses are false.[^5][^6]

**When to choose BH or related FDR methods**
- You are testing tens to thousands of hypotheses (e.g., gene expression contrasts, metabolite levels) and want to maintain reasonable power.
- Your field accepts FDR control as an appropriate standard for multiple comparisons.

For small‑scale ANOVA‑type experiments with few groups and comparisons, FWER‑controlling post hoc tests (Tukey, Dunnett, Bonferroni, Games–Howell) remain the standard in most biological research.[^3][^4][^6]


## Practical decision table

The following table summarizes common choices in terms of design and assumptions.

| Situation | Recommended post hoc options | Notes |
|----------|------------------------------|-------|
| One‑way ANOVA, equal variances, interest in all pairwise comparisons | Tukey HSD / Tukey–Kramer | Good balance of FWER control and power, gives CIs.[^2][^7][^4] |
| One‑way ANOVA, equal variances, only comparisons vs control | Dunnett’s test | More power than Tukey for control‑focused questions.[^3][^4] |
| One‑way ANOVA, equal variances, few pre‑planned comparisons | Pairwise t‑tests with Bonferroni or Holm | Simple and flexible; conservative if many comparisons.[^6][^5] |
| Factorial ANOVA, complex contrasts of means | Scheffé or planned contrasts with correction | Very flexible but conservative for pairwise comparisons.[^2][^3] |
| One‑way, unequal variances and/or unbalanced groups | Games–Howell; Dunnett T3; Tamhane T2 | Designed for heteroscedastic data; Games–Howell typically less conservative.[^8][^3][^9] |
| Welch’s ANOVA significant | Games–Howell; Dunnett T3; Welch‑t + Holm/Bonferroni | Match heteroscedastic omnibus test with heteroscedastic post hoc.[^8][^4] |
| Kruskal–Wallis significant | Dunn’s test with Bonferroni/Holm; pairwise Mann–Whitney with correction | Non‑parametric rank‑based comparisons.[^11][^12] |
| Very many parallel tests (omics‑scale) | Benjamini–Hochberg FDR or related | Controls expected false discovery proportion.[^6][^5] |


## How to choose in typical biological experiments

In small to medium‑sized lab experiments (e.g., 3–8 groups, n ≈ 6–20 per group), a pragmatic workflow is:

1. Choose an appropriate omnibus test (ordinary ANOVA, Welch’s ANOVA, or Kruskal–Wallis) based on normality and variance diagnostics.
2. Decide whether the scientific question involves all pairwise comparisons, only treatments vs a control, or specific planned contrasts.
3. If parametric assumptions are acceptable and variances are homogeneous, use Tukey HSD for all pairwise comparisons, Dunnett for control‑focused questions, or Holm/Bonferroni for a small set of a priori comparisons.[^2][^4][^3]
4. If variances are clearly unequal or group sizes differ strongly, prefer Games–Howell or Dunnett T3/Tamhane T2 as implemented in your software, or pairwise Welch t‑tests with Holm/BH correction.[^3][^9][^8]
5. If a rank‑based omnibus test was used, apply Dunn’s test or similar non‑parametric multiple‑comparison procedures with appropriate p‑value correction.[^11][^12]

Following this structured approach ensures that post hoc inferences are aligned with the design, assumptions, and scientific questions, rather than being chosen solely by software defaults.

---

## References

1. [Post hoc analysis - Wikipedia](https://en.wikipedia.org/wiki/Post_hoc_analysis) - Common post hoc tests · Fisher's least significant difference · Holm-Bonferroni Procedure · Newman-K...

2. [Exploring Post-Hoc Tests in ANOVA: A Guide to Analyzing Variance ...](https://hospitality.institute/mha1002/post-hoc-tests-anova-guide/) - Learn about post-hoc tests in ANOVA: types (Tukey's HSD, Bonferroni), when to use them, and how to i...

3. [Which Post-Hoc Test After ANOVA? - MetricGate](https://metricgate.com/blogs/which-post-hoc-test/) - Check equal variance assumption (Levene's test or Bartlett's test). If variances are unequal → use G...

4. [Using Post Hoc Tests with ANOVA - Statistics By Jim](https://statisticsbyjim.com/anova/post-hoc-tests-anova/) - Use post hoc tests to explore differences between multiple group means while controlling the experim...

5. [14.6: Multiple Comparisons and Post Hoc Tests - Statistics LibreTexts](https://stats.libretexts.org/Bookshelves/Applied_Statistics/Learning_Statistics_with_R_-_A_tutorial_for_Psychology_Students_and_other_Beginners_(Navarro)/14:_Comparing_Several_Means_(One-way_ANOVA)/14.06:_Multiple_Comparisons_and_Post_Hoc_Tests) - Holm corrections. Although the Bonferroni correction is the simplest adjustment out there, it's not ...

6. [Post Hoc Definition and Types of Tests - Statistics How To](https://www.statisticshowto.com/probability-and-statistics/statistics-definitions/post-hoc/) - The most common post hoc tests are: Bonferroni Procedure Duncan's new multiple range test (MRT) Dunn...

7. [Tukey's range test - Wikipedia](https://en.wikipedia.org/wiki/Tukey's_range_test) - It can be used to correctly interpret the statistical significance of the difference between means t...

8. [[PDF] Comparison of Post Hoc Tests for Unequal Variance](https://www.ijntse.com/upload/1447070311130.pdf) - Dunnett C, Dunnett T3 and Tamhane T2 procedures are found to be always conservative. Games Howell pr...

9. [Dunnett T3、Games-Howell 与Tamhane T2 检验的工作原理](https://www.graphpad-prism.cn/guides/prism/11/statistics/stat_multiple-comparisons-without-a.htm) - 若选择统计假设检验方法，Prism 提供三种检验：Dunnett T3、Games 和Howell 以及Tamhane T2。当样本量较小（每组<50）时，建议使用Dunnett T3；当样本量较大时...

10. [On the use of post-hoc tests in environmental and biological sciences](https://www.sciencedirect.com/science/article/pii/S2405844024011629) - Non-parametric post-hoc tests include the Dunn, Steel, Nemenyi, and Steel-Dwass tests [2]. For param...

11. [Kruskal-Wallis-Test simply explained - Statistics Calculator](https://numiqo.com/tutorial/kruskal-wallis-test) - Post-hoc-Test The Kruskal-Wallis test can be used to determine whether at least two groups differ fr...

12. [Kruskal–Wallis test - Wikipedia](https://en.wikipedia.org/wiki/Kruskal%E2%80%93Wallis_test) - Kruskal–Wallis test indicates that at least one sample stochastically dominates one other sample. Fo...

13. [Post hoc test | Holm - Explained - YouTube](https://www.youtube.com/watch?v=l4yVt_Dht4U) - ... Holm vs Bonferroni (05:28) 4. Holm Sidak test (06:17)

