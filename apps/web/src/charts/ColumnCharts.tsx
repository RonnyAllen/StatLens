import React from "react";
import { scaleBand, scaleLinear } from "@visx/scale";
import { Bar, Circle, Line } from "@visx/shape";
import { BaseChartLayout } from "./BaseChartLayout";
import { SignificanceLayer } from "./SignificanceLayer";
import { getPValueStar, assignBracketTiers } from "./geometry/significance";
import { getErrorBarBounds } from "./geometry/errorBars";
import { getBoxStats, getNotchBounds } from "./geometry/boxStats";
import { computeBeeswarm } from "./geometry/beeswarm";
import { getViolinDensity } from "./geometry/violinDensity";
import { area, curveBasis } from "d3-shape";
import { getJitterOffset } from "./geometry/jitter";
import { getAutoAxisRange } from "./geometry/axis";
import type { DataSheet, GraphConfig } from "@/types/workbook";
import { computeChartLayout } from "./geometry/layout";

export interface ColumnChartsProps {
  sheet: DataSheet;
  analysisResults?: any;
  config: GraphConfig;
  width: number;
  height: number;
}


export function parseSheetData(sheet: DataSheet) {
  const dataMap = new Map<string, number[]>();
  const allYValues: number[] = [];
  
  sheet.columnGroups.forEach(g => {
    const groupName = g.name || g.id;
    const vals = (g as any).columns ? (g as any).columns.flatMap((col: any) => {
      return sheet.data
        .map(row => {
          const v = row[col.id];
          if (v === "" || v === null || v === undefined) return NaN;
          const num = Number(v);
          if (typeof v === 'string' && v.trim() === "") return NaN;
          return num;
        })
        .filter(v => !isNaN(v));
    }) : sheet.data.map(row => {
          const v = row[g.id];
          if (v === "" || v === null || v === undefined) return NaN;
          const num = Number(v);
          if (typeof v === 'string' && v.trim() === "") return NaN;
          return num;
    }).filter(v => !isNaN(v));
    dataMap.set(groupName, vals);
    allYValues.push(...vals);
  });
  
  const groups = sheet.columnGroups.map(g => g.name || g.id).filter(g => (dataMap.get(g) || []).length > 0);
  return { dataMap, allYValues, groups };
}

export const PALETTES: Record<string, string[]> = {
  "okabe-ito": ["#E69F00", "#56B4E9", "#009E73", "#F0E442", "#0072B2", "#D55E00", "#CC79A7", "#000000"],
  "viridis":   ["#440154", "#414487", "#2A788E", "#22A884", "#7AD151", "#FDE725"],
  "tableau":   ["#4E79A7", "#F28E2B", "#E15759", "#76B7B2", "#59A14F", "#EDC949", "#AF7AA1", "#FF9DA7", "#9C755F", "#BAB0AB"],
  "brewer-bold": ["#E41A1C", "#377EB8", "#4DAF4A", "#984EA3", "#FF7F00", "#FFFF33", "#A65628", "#F781BF"],
  "forest-dusk": ["#1B9E77", "#D95F02", "#7570B3", "#E7298A", "#66A61E", "#E6AB02", "#A6761D", "#666666"],
  "duo-tone":  ["#A6CEE3", "#1F78B4", "#B2DF8A", "#33A02C", "#FB9A99", "#E31A1C", "#FDBF6F", "#FF7F00"],
  "nature":    ["#E64B35", "#4DBBD5", "#00A087", "#3C5488", "#F39B7F", "#8491B4", "#91D1C2", "#DC0000"],
  "lancet":    ["#00468B", "#ED0000", "#42B540", "#0099B4", "#925E9F", "#FDAF91", "#AD002A", "#ADB6B6"],
  "jama":      ["#374E55", "#DF8F44", "#00A1D5", "#B24745", "#79AF97", "#6A6599", "#80796B"],
  "grayscale": ["#000000", "#404040", "#666666", "#8C8C8C", "#B3B3B3", "#D9D9D9"],
  "magma":     ["#000004", "#3B0F70", "#8C2981", "#DE4968", "#FE9F6D", "#FCFDBF"],
  "cividis":   ["#00204D", "#31446B", "#666970", "#958F78", "#CAB969", "#FFEA46"],
  "ocean":     ["#023E8A", "#0077B6", "#0096C7", "#00B4D8", "#48CAE4", "#90E0EF", "#ADE8F4", "#CAF0F8"],
  "pastel":    ["#FFB3BA", "#FFDFBA", "#FFFFBA", "#BAFFC9", "#BAE1FF", "#E8BAFF", "#FFD1DC", "#C4E0F9"],
  "neon":      ["#FF006E", "#FB5607", "#FFBE0B", "#8338EC", "#3A86FF", "#06D6A0", "#FFD166", "#EF476F"],
  "earth":     ["#8B4513", "#CD853F", "#DEB887", "#556B2F", "#6B8E23", "#808000", "#BC8F8F", "#A0522D"],
  "retro":     ["#264653", "#2A9D8F", "#E9C46A", "#F4A261", "#E76F51", "#606C38", "#DDA15E", "#BC6C25"],
};

export function BarErrorChart({ sheet, analysisResults, config, width, height }: ColumnChartsProps) {
  // We'll calculate top margin dynamically based on significance tiers later
  // 1. Data Prep
  const { dataMap, allYValues, groups } = parseSheetData(sheet);

  // Extract descriptive stats from engine output or compute basic fallbacks
  const statsMap = new Map<string, any>();
  
  if (analysisResults?.descriptives) {
    analysisResults.descriptives.forEach((stat: any) => {
      statsMap.set(stat.group, stat);
    });
  } else {
    // Compute fallback stats so bars render even without an engine result
    groups.forEach(g => {
      const vals = dataMap.get(g) || [];
      if (vals.length > 0) {
        const n = vals.length;
        const mean = vals.reduce((sum, v) => sum + v, 0) / n;
        const variance = n > 1 ? vals.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / (n - 1) : 0;
        const std = Math.sqrt(variance);
        const sem = std / Math.sqrt(n);
        
        // 95% CI fallback using approx 1.96 * SEM
        const ci_lower = mean - (1.96 * sem);
        const ci_upper = mean + (1.96 * sem);

        statsMap.set(g, { group: g, n, mean, std, sem, ci_lower, ci_upper });
      }
    });
  }

  // Calculate dynamic top margin based on tiers
  const comparisons = analysisResults?.post_hocs?.comparisons || [];
  const activeComparisons = (config.showNsBrackets ?? true) 
    ? comparisons 
    : comparisons.filter((c: any) => c.p_value <= 0.05);

  let maxTier = 0;
  if (activeComparisons.length > 0) {
    const tiered = assignBracketTiers(activeComparisons, groups);
    maxTier = tiered.length > 0 ? Math.max(...tiered.map(t => t.tier)) : 0;
  }
  const omnibusP = analysisResults?.omnibus?.p_value ?? analysisResults?.omnibus?.p;
  const colors = PALETTES[config.palette || "okabe-ito"] || PALETTES["okabe-ito"];

  const yRange = getAutoAxisRange(allYValues, 0.05, true);
  const yDomainMin = config.yAxisMin ?? yRange.min;
  const yDomainMax = config.yAxisMax ?? yRange.max;

  const tempYScale = scaleLinear<number>({
    domain: [yDomainMin, yDomainMax],
    nice: config.yAxisMin === undefined && config.yAxisMax === undefined,
  });
  const yTickValues = tempYScale.ticks();
  const tickFormat = (v: any) => {
    if (typeof v === 'number') {
      if (v === 0) return "0";
      if (Math.abs(v) > 1e4 || Math.abs(v) < 1e-3) return v.toExponential(1);
      return v.toString();
    }
    return v;
  };
  const yTickLabels = yTickValues.map(tickFormat);
  const legendItems = groups.map((g, i) => ({ label: g, color: colors[i % colors.length] }));

  const layout = computeChartLayout({
    width,
    height,
    config,
    xTickLabels: groups,
    yTickLabels,
    legendItems: config.showLegend ? legendItems : [],
    maxBracketTier: activeComparisons.length > 0 ? maxTier : -1,
    hasOmnibus: omnibusP !== undefined && (config as any).showOmnibus !== false
  });

  const { margin, innerWidth, innerHeight } = layout;

  const xScale = scaleBand<string>({
    domain: groups,
    range: [0, innerWidth],
    padding: 0.3,
  });

  const yScale = scaleLinear<number>({
    domain: [yDomainMin, yDomainMax],
    range: [innerHeight, 0],
    nice: config.yAxisMin === undefined && config.yAxisMax === undefined,
  });
  return (
    <BaseChartLayout
      yTickValues={yTickValues}
      xAxisTitleY={layout.xAxisTitleY}
      yAxisTitleX={layout.yAxisTitleX}
      legend={layout.legend}
      width={width}
      height={height}
      margin={margin}
      xScale={xScale}
      yScale={yScale}
      yLabel={config.showYAxisTitle !== false ? (config.yAxisTitle ?? "Value") : undefined}
      xLabel={config.showXAxisTitle !== false ? (config.xAxisTitle ?? "Group") : undefined}
      fontFamily={config.fontFamily}
      fontSize={config.fontSize}
      axisTitleFontSize={config.axisTitleFontSize}
      axisLabelFontSize={config.axisLabelFontSize}
      legendFontSize={config.legendFontSize}
    >
      {/* Bars & Error Bars */}
      {groups.map((g, i) => {
        const stat = statsMap.get(g);
        if (!stat) return null;

        const barWidth = xScale.bandwidth();
        const xPos = xScale(g) ?? 0;
        
        const yZero = yScale(Math.max(yDomainMin, 0));
        const yPos = stat.mean >= 0 ? yScale(stat.mean) : yZero;
        const barHeight = Math.max(0, stat.mean >= 0 ? yZero - yPos : yScale(stat.mean) - yZero);
        
        const color = colors[i % colors.length];

        const bounds = getErrorBarBounds(stat, config.errorBarType);
        const y1 = yScale(bounds.y2); // Upper bound (SVG Y is inverted)
        const y2 = yScale(bounds.y1); // Lower bound
        const midX = xPos + barWidth / 2;

        return (
          <React.Fragment key={`bar-${g}`}>
            <Bar
              x={xPos}
              y={yPos}
              width={barWidth}
              height={barHeight}
              fill={color}
              stroke="black"
              strokeWidth={1}
            />
            <Line
              from={{ x: midX, y: y1 }}
              to={{ x: midX, y: y2 }}
              stroke="black"
              strokeWidth={1.5}
            />
            <Line
              from={{ x: midX - 5, y: y1 }}
              to={{ x: midX + 5, y: y1 }}
              stroke="black"
              strokeWidth={1.5}
            />
            <Line
              from={{ x: midX - 5, y: y2 }}
              to={{ x: midX + 5, y: y2 }}
              stroke="black"
              strokeWidth={1.5}
            />
          </React.Fragment>
        );
      })}

      {/* Raw Data Points (Jitter) */}
      {config.showPoints !== false && groups.map((g, i) => {
        const vals = dataMap.get(g) || [];
        const barWidth = xScale.bandwidth();
        const xPos = xScale(g) ?? 0;
        const midX = xPos + barWidth / 2;
        const color = colors[i % colors.length];
        
        return vals.map((val, idx) => {
          const jitter = getJitterOffset(config.jitterSeed, idx, barWidth * 0.4);
          return (
            <Circle
              key={`point-${g}-${idx}`}
              cx={midX + jitter}
              cy={yScale(val)}
              r={config.pointSize ?? 3}
                fill={color}
                fillOpacity={0.6}
                stroke="black"
                strokeWidth={1}
              />
          );
        });
      })}

      {/* Significance Layer or Omnibus P-Value */}
      {comparisons.length > 0 ? (
        <SignificanceLayer
          comparisons={comparisons}
          groupOrder={groups}
          xScale={(group) => (xScale(group) ?? 0) + xScale.bandwidth() / 2}
          yScale={yScale}
          dataMax={yRange.max}
          scale={config.significanceScale}
          showNs={config.showNsBrackets}
          fontFamily={config.fontFamily}
          fontSize={config.fontSize}
          pValueFontSize={config.pValueFontSize}
        />
      ) : omnibusP !== undefined ? (
        <text
          x={innerWidth / 2}
          y={yScale(yRange.max) - 20}
          textAnchor="middle"
          fontSize={config.fontSize}
          fontFamily={config.fontFamily}
          fill="#333"
          fontStyle={config.significanceScale === "raw" ? "italic" : "normal"}
        >
          Omnibus {getPValueStar(omnibusP, config.significanceScale)}
        </text>
      ) : null}
    </BaseChartLayout>
  );
}

export function BoxChart({ sheet, analysisResults, config, width, height }: ColumnChartsProps) {
  // 1. Data Prep
  const { dataMap, allYValues, groups } = parseSheetData(sheet);

  const statsMap = new Map<string, ReturnType<typeof getBoxStats>>();
  
  groups.forEach(g => {
    const vals = dataMap.get(g) || [];
    if (vals.length > 0) {
      statsMap.set(g, getBoxStats(vals));
    }
  });

  const comparisons = analysisResults?.post_hocs?.comparisons || [];
  const activeComparisons = (config.showNsBrackets ?? true) 
    ? comparisons 
    : comparisons.filter((c: any) => c.p_value <= 0.05);

  let maxTier = 0;
  if (activeComparisons.length > 0) {
    const tiered = assignBracketTiers(activeComparisons, groups);
    maxTier = tiered.length > 0 ? Math.max(...tiered.map(t => t.tier)) : 0;
  }
  const omnibusP = analysisResults?.omnibus?.p_value ?? analysisResults?.omnibus?.p;
  const colors = PALETTES[config.palette || "okabe-ito"] || PALETTES["okabe-ito"];

  const yRange = getAutoAxisRange(allYValues, 0.05, true);
  const yDomainMin = config.yAxisMin ?? yRange.min;
  const yDomainMax = config.yAxisMax ?? yRange.max;

  const tempYScale = scaleLinear<number>({
    domain: [yDomainMin, yDomainMax],
    nice: config.yAxisMin === undefined && config.yAxisMax === undefined,
  });
  const yTickValues = tempYScale.ticks();
  const tickFormat = (v: any) => {
    if (typeof v === 'number') {
      if (v === 0) return "0";
      if (Math.abs(v) > 1e4 || Math.abs(v) < 1e-3) return v.toExponential(1);
      return v.toString();
    }
    return v;
  };
  const yTickLabels = yTickValues.map(tickFormat);
  const legendItems = groups.map((g, i) => ({ label: g, color: colors[i % colors.length] }));

  const layout = computeChartLayout({
    width,
    height,
    config,
    xTickLabels: groups,
    yTickLabels,
    legendItems: config.showLegend ? legendItems : [],
    maxBracketTier: activeComparisons.length > 0 ? maxTier : -1,
    hasOmnibus: omnibusP !== undefined && (config as any).showOmnibus !== false
  });

  const { margin, innerWidth, innerHeight } = layout;

  const xScale = scaleBand<string>({
    domain: groups,
    range: [0, innerWidth],
    padding: 0.3,
  });

  const yScale = scaleLinear<number>({
    domain: [yDomainMin, yDomainMax],
    range: [innerHeight, 0],
    nice: config.yAxisMin === undefined && config.yAxisMax === undefined,
  });
  return (
    <BaseChartLayout
      yTickValues={yTickValues}
      xAxisTitleY={layout.xAxisTitleY}
      yAxisTitleX={layout.yAxisTitleX}
      legend={layout.legend}
      width={width}
      height={height}
      margin={margin}
      xScale={xScale}
      yScale={yScale}
      yLabel={config.showYAxisTitle !== false ? (config.yAxisTitle ?? "Value") : undefined}
      xLabel={config.showXAxisTitle !== false ? (config.xAxisTitle ?? "Group") : undefined}
      fontFamily={config.fontFamily}
      fontSize={config.fontSize}
      axisTitleFontSize={config.axisTitleFontSize}
      axisLabelFontSize={config.axisLabelFontSize}
      legendFontSize={config.legendFontSize}
    >
      {/* Box and Whiskers */}
      {groups.map((g, i) => {
        const stats = statsMap.get(g);
        const vals = dataMap.get(g) || [];
        if (!stats) return null;

        const boxWidth = xScale.bandwidth();
        const xPos = xScale(g) ?? 0;
        const midX = xPos + boxWidth / 2;
        const color = colors[i % colors.length];

        const yMin = yScale(stats.lowerWhisker);
        const yMax = yScale(stats.upperWhisker);
        const yQ1 = yScale(stats.q1);
        const yQ3 = yScale(stats.q3);
        const yMed = yScale(stats.median);

        return (
          <React.Fragment key={`box-${g}`}>
            {/* Whiskers */}
            <Line
              from={{ x: midX, y: yMax }}
              to={{ x: midX, y: yQ3 }}
              stroke="black"
              strokeWidth={1.5}
            />
            <Line
              from={{ x: midX, y: yMin }}
              to={{ x: midX, y: yQ1 }}
              stroke="black"
              strokeWidth={1.5}
            />
            {/* Whisker Caps */}
            <Line
              from={{ x: midX - boxWidth * 0.2, y: yMax }}
              to={{ x: midX + boxWidth * 0.2, y: yMax }}
              stroke="black"
              strokeWidth={1.5}
            />
            <Line
              from={{ x: midX - boxWidth * 0.2, y: yMin }}
              to={{ x: midX + boxWidth * 0.2, y: yMin }}
              stroke="black"
              strokeWidth={1.5}
            />
            {/* Box */}
            {config.notched ? (
              <path
                d={`
                  M ${xPos} ${yQ3}
                  L ${xPos + boxWidth} ${yQ3}
                  L ${xPos + boxWidth} ${Math.max(yScale(getNotchBounds(stats.median, stats.q1, stats.q3, vals.length).notchHigh), yQ3)}
                  L ${xPos + boxWidth * 0.75} ${yMed}
                  L ${xPos + boxWidth} ${Math.min(yScale(getNotchBounds(stats.median, stats.q1, stats.q3, vals.length).notchLow), yQ1)}
                  L ${xPos + boxWidth} ${yQ1}
                  L ${xPos} ${yQ1}
                  L ${xPos} ${Math.min(yScale(getNotchBounds(stats.median, stats.q1, stats.q3, vals.length).notchLow), yQ1)}
                  L ${xPos + boxWidth * 0.25} ${yMed}
                  L ${xPos} ${Math.max(yScale(getNotchBounds(stats.median, stats.q1, stats.q3, vals.length).notchHigh), yQ3)}
                  Z
                `}
                fill={color}
                stroke="black"
                strokeWidth={1.5}
              />
            ) : (
              <Bar
                x={xPos}
                y={yQ3}
                width={boxWidth}
                height={Math.max(0, yQ1 - yQ3)}
                fill={color}
                stroke="black"
                strokeWidth={1.5}
              />
            )}
            {/* Median Line */}
            <Line
              from={{ x: xPos, y: yMed }}
              to={{ x: xPos + boxWidth, y: yMed }}
              stroke="black"
              strokeWidth={1.5}
            />
          </React.Fragment>
        );
      })}

      {/* Raw Data Points (Jitter) */}
      {config.showPoints !== false && groups.map((g, i) => {
        const vals = dataMap.get(g) || [];
        const boxWidth = xScale.bandwidth();
        const xPos = xScale(g) ?? 0;
        const midX = xPos + boxWidth / 2;
        const color = colors[i % colors.length];
        
        return vals.map((val, idx) => {
          const jitter = getJitterOffset(config.jitterSeed, idx, boxWidth * 0.4);
          return (
            <Circle
              key={`point-${g}-${idx}`}
              cx={midX + jitter}
              cy={yScale(val)}
              r={config.pointSize ?? 3}
                fill={color}
                fillOpacity={0.6}
                stroke="black"
                strokeWidth={1}
              />
          );
        });
      })}

      {/* Significance Layer or Omnibus P-Value */}
      {comparisons.length > 0 ? (
        <SignificanceLayer
          comparisons={comparisons}
          groupOrder={groups}
          xScale={(group) => (xScale(group) ?? 0) + xScale.bandwidth() / 2}
          yScale={yScale}
          dataMax={yRange.max}
          scale={config.significanceScale}
          showNs={config.showNsBrackets}
          fontFamily={config.fontFamily}
          fontSize={config.fontSize}
          pValueFontSize={config.pValueFontSize}
        />
      ) : omnibusP !== undefined ? (
        <text
          x={innerWidth / 2}
          y={yScale(yRange.max) - 20}
          textAnchor="middle"
          fontSize={config.fontSize}
          fontFamily={config.fontFamily}
          fill="#333"
          fontStyle={config.significanceScale === "raw" ? "italic" : "normal"}
        >
          Omnibus {getPValueStar(omnibusP, config.significanceScale)}
        </text>
      ) : null}
    </BaseChartLayout>
  );
}


export function ViolinChart({ sheet, analysisResults, config, width, height }: ColumnChartsProps) {
  const { dataMap, allYValues, groups } = parseSheetData(sheet);

  const densityMap = new Map<string, ReturnType<typeof getViolinDensity>>();
  let maxDensity = 0;
  
  groups.forEach(g => {
    const vals = dataMap.get(g) || [];
    if (vals.length > 0) {
      const density = getViolinDensity(vals);
      densityMap.set(g, density);
      const localMax = Math.max(...density.map(d => d.y));
      if (localMax > maxDensity) maxDensity = localMax;
    }
  });

  const comparisons = analysisResults?.post_hocs?.comparisons || [];
  const activeComparisons = (config.showNsBrackets ?? true) 
    ? comparisons 
    : comparisons.filter((c: any) => c.p_value <= 0.05);

  const colors = PALETTES[config.palette || "okabe-ito"] || PALETTES["okabe-ito"];

  const yRange = getAutoAxisRange(allYValues, 0.05, true);
  const yDomainMin = config.yAxisMin ?? yRange.min;
  const yDomainMax = config.yAxisMax ?? yRange.max;
  
  const tempYScale = scaleLinear<number>({
    domain: [yDomainMin, yDomainMax],
    nice: config.yAxisMin === undefined && config.yAxisMax === undefined,
  });
  
  const tickFormat = (v: any) => {
    if (typeof v === 'number') {
      if (v === 0) return "0";
      if (Math.abs(v) > 1e4 || Math.abs(v) < 1e-3) return v.toExponential(1);
      return v.toString();
    }
    return v;
  };
  const yTickValues = tempYScale.ticks();
  const yTickLabels = yTickValues.map(tickFormat);
  const legendItems = groups.map((g, i) => ({ label: g, color: colors[i % colors.length] }));

  const tiered = activeComparisons.length > 0 ? assignBracketTiers(activeComparisons, groups) : [];
  const maxTier = tiered.length > 0 ? Math.max(...tiered.map(t => t.tier)) : -1;
  const omnibusP = analysisResults?.omnibus?.p_value;

  const layout = computeChartLayout({
    width,
    height,
    config,
    xTickLabels: groups,
    yTickLabels,
    legendItems: config.showLegend ? legendItems : [],
    maxBracketTier: maxTier,
    hasOmnibus: omnibusP !== undefined && (config as any).showOmnibus !== false
  });

  const { margin, innerWidth, innerHeight } = layout;

  const xScale = scaleBand<string>({
    domain: groups,
    range: [0, innerWidth],
    padding: 0.1, // Less padding for wider violins
  });

  const yScale = scaleLinear<number>({
    domain: [yDomainMin, yDomainMax],
    range: [innerHeight, 0],
    nice: config.yAxisMin === undefined && config.yAxisMax === undefined,
  });

  return (
    <BaseChartLayout
      width={width}
      height={height}
      margin={margin}
      yTickValues={yTickValues}
      xAxisTitleY={layout.xAxisTitleY}
      yAxisTitleX={layout.yAxisTitleX}
      legend={layout.legend}
      xScale={xScale}
      yScale={yScale}
      yLabel={config.showYAxisTitle !== false ? (config.yAxisTitle ?? "Value") : undefined}
      xLabel={config.showXAxisTitle !== false ? (config.xAxisTitle ?? "Group") : undefined}
      fontFamily={config.fontFamily}
      fontSize={config.fontSize}
      axisTitleFontSize={config.axisTitleFontSize}
      axisLabelFontSize={config.axisLabelFontSize}
      legendFontSize={config.legendFontSize}
    >
      {groups.map((g, i) => {
        const density = densityMap.get(g);
        const vals = dataMap.get(g) || [];
        if (!density) return null;

        const boxWidth = xScale.bandwidth();
        const xPos = xScale(g) ?? 0;
        const midX = xPos + boxWidth / 2;
        const color = colors[i % colors.length];

        // Map density X values to pixel width symmetrically around midX
        const maxW = boxWidth / 2;
        
        return (
          <g key={`violin-${g}`}>
            <path
              d={(() => {
                let path = "";
                density.forEach((d, idx) => {
                  const y = yScale(d.x);
                  const w = (d.y / maxDensity) * maxW;
                  if (idx === 0) path += `M ${midX - w},${y} `;
                  else path += `L ${midX - w},${y} `;
                });
                for (let idx = density.length - 1; idx >= 0; idx--) {
                  const d = density[idx];
                  const y = yScale(d.x);
                  const w = (d.y / maxDensity) * maxW;
                  path += `L ${midX + w},${y} `;
                }
                path += "Z";
                return path;
              })()}
              fill={color}
              stroke="black"
              strokeWidth={1}
            />
            {config.showPoints !== false && vals.map((val, idx) => {
                const jitter = getJitterOffset(config.jitterSeed || 42, idx, boxWidth * 0.15);
                return (
                    <Circle
                        key={`point-${g}-${idx}`}
                        cx={midX + jitter}
                        cy={yScale(val)}
                        r={config.pointSize ?? 3}
                        fill={color}
                        fillOpacity={0.6}
                        stroke="black"
                        strokeWidth={1}
                    />
                );
            })}
          </g>
        );
      })}

      <SignificanceLayer
        comparisons={activeComparisons}
        groupOrder={groups}
        xScale={(g) => (xScale(g) || 0) + xScale.bandwidth() / 2}
        yScale={yScale}
        dataMax={yDomainMax}
        scale={config.significanceScale}
        showNs={config.showNsBrackets}
        fontFamily={config.fontFamily}
        fontSize={config.fontSize}
        pValueFontSize={config.pValueFontSize}
      />

      {omnibusP !== undefined && (config as any).showOmnibus !== false ? (
        <text
          x={innerWidth}
          y={-10}
          textAnchor="end"
          fontSize={config.fontSize}
          fontFamily={config.fontFamily}
          fill="#666"
        >
          Omnibus {getPValueStar(omnibusP, config.significanceScale)}
        </text>
      ) : null}
    </BaseChartLayout>
  );
}

export function RaincloudChart({ sheet, analysisResults, config, width, height }: ColumnChartsProps) {
  const { dataMap, allYValues, groups } = parseSheetData(sheet);

  const densityMap = new Map<string, ReturnType<typeof getViolinDensity>>();
  const statsMap = new Map<string, ReturnType<typeof getBoxStats>>();
  let maxDensity = 0;
  
  groups.forEach(g => {
    const vals = dataMap.get(g) || [];
    if (vals.length > 0) {
      const density = getViolinDensity(vals);
      densityMap.set(g, density);
      const localMax = Math.max(...density.map(d => d.y));
      if (localMax > maxDensity) maxDensity = localMax;
      statsMap.set(g, getBoxStats(vals));
    }
  });

  const comparisons = analysisResults?.post_hocs?.comparisons || [];
  const activeComparisons = (config.showNsBrackets ?? true) ? comparisons : comparisons.filter((c: any) => c.p_value <= 0.05);
  const colors = PALETTES[config.palette || "okabe-ito"] || PALETTES["okabe-ito"];
  const yRange = getAutoAxisRange(allYValues, 0.05, true);
  const yDomainMin = config.yAxisMin ?? yRange.min;
  const yDomainMax = config.yAxisMax ?? yRange.max;
  
  const tempYScale = scaleLinear<number>({ domain: [yDomainMin, yDomainMax], nice: config.yAxisMin === undefined && config.yAxisMax === undefined });
  
  const tickFormat = (v: any) => {
    if (typeof v === 'number') {
      if (v === 0) return "0";
      if (Math.abs(v) > 1e4 || Math.abs(v) < 1e-3) return v.toExponential(1);
      return v.toString();
    }
    return v;
  };
  const yTickValues = tempYScale.ticks();
  const yTickLabels = yTickValues.map(tickFormat);
  const legendItems = groups.map((g, i) => ({ label: g, color: colors[i % colors.length] }));
  const tiered = activeComparisons.length > 0 ? assignBracketTiers(activeComparisons, groups) : [];
  const maxTier = tiered.length > 0 ? Math.max(...tiered.map(t => t.tier)) : -1;
  const omnibusP = analysisResults?.omnibus?.p_value;

  const layout = computeChartLayout({ width, height, config, xTickLabels: groups, yTickLabels, legendItems: config.showLegend ? legendItems : [], maxBracketTier: maxTier, hasOmnibus: omnibusP !== undefined && (config as any).showOmnibus !== false });
  const { margin, innerWidth, innerHeight } = layout;

  const xScale = scaleBand<string>({ domain: groups, range: [0, innerWidth], padding: 0.1 });
  const yScale = scaleLinear<number>({ domain: [yDomainMin, yDomainMax], range: [innerHeight, 0], nice: config.yAxisMin === undefined && config.yAxisMax === undefined });

  return (
    <BaseChartLayout
      width={width} height={height} margin={margin} yTickValues={yTickValues}
      xAxisTitleY={layout.xAxisTitleY} yAxisTitleX={layout.yAxisTitleX} legend={layout.legend}
      xScale={xScale} yScale={yScale}
      yLabel={config.showYAxisTitle !== false ? (config.yAxisTitle ?? "Value") : undefined} xLabel={config.showXAxisTitle !== false ? (config.xAxisTitle ?? "Group") : undefined}
      fontFamily={config.fontFamily} fontSize={config.fontSize} axisTitleFontSize={config.axisTitleFontSize} axisLabelFontSize={config.axisLabelFontSize} legendFontSize={config.legendFontSize}
    >
      {groups.map((g, i) => {
        const density = densityMap.get(g);
        const stats = statsMap.get(g);
        const vals = dataMap.get(g) || [];
        if (!density || !stats) return null;

        const boxWidth = xScale.bandwidth();
        const xPos = xScale(g) ?? 0;
        const color = colors[i % colors.length];

        const maxW = boxWidth * 0.4;
        const cx = xPos + boxWidth * 0.5;
        const boxW = Math.max(10, boxWidth * 0.15);
        const boxLeft = cx - boxW / 2;
        const boxRight = cx + boxW / 2;
        const gap = boxW / 2 + 2;
        const jitterBand = boxWidth * 0.25;
        
        return (
          <g key={`raincloud-${g}`}>
            {/* Density half-violin */}
            <path
              d={(() => {
                let path = "";
                density.forEach((d, idx) => {
                  const y = yScale(d.x);
                  const w = (d.y / maxDensity) * maxW;
                  if (idx === 0) path += `M ${cx},${y} `;
                  else path += `L ${cx - w},${y} `;
                });
                path += `L ${cx},${yScale(density[density.length - 1].x)} Z`;
                return path;
              })()}
              fill={color} fillOpacity={0.6} stroke={color} strokeWidth={1}
            />

            {/* Box Plot */}
            {config.notched ? (
              <path
                d={`
                  M ${boxLeft} ${yScale(stats.q3)}
                  L ${boxRight} ${yScale(stats.q3)}
                  L ${boxRight} ${Math.max(yScale(getNotchBounds(stats.median, stats.q1, stats.q3, vals.length).notchHigh), yScale(stats.q3))}
                  L ${cx + boxW * 0.25} ${yScale(stats.median)}
                  L ${boxRight} ${Math.min(yScale(getNotchBounds(stats.median, stats.q1, stats.q3, vals.length).notchLow), yScale(stats.q1))}
                  L ${boxRight} ${yScale(stats.q1)}
                  L ${boxLeft} ${yScale(stats.q1)}
                  L ${boxLeft} ${Math.min(yScale(getNotchBounds(stats.median, stats.q1, stats.q3, vals.length).notchLow), yScale(stats.q1))}
                  L ${cx - boxW * 0.25} ${yScale(stats.median)}
                  L ${boxLeft} ${Math.max(yScale(getNotchBounds(stats.median, stats.q1, stats.q3, vals.length).notchHigh), yScale(stats.q3))}
                  Z
                `}
                fill="white" stroke="black" strokeWidth={1.5}
              />
            ) : (
              <Bar x={boxLeft} y={yScale(stats.q3)} width={boxW} height={Math.max(0, yScale(stats.q1) - yScale(stats.q3))} fill="white" stroke="black" strokeWidth={1.5} />
            )}
            {/* Median Line */}
            <Line from={{ x: boxLeft, y: yScale(stats.median) }} to={{ x: boxRight, y: yScale(stats.median) }} stroke="black" strokeWidth={1.5} />
            <Line from={{ x: cx, y: yScale(stats.q3) }} to={{ x: cx, y: yScale(stats.upperWhisker) }} stroke="black" strokeWidth={1.5} />
            <Line from={{ x: cx, y: yScale(stats.q1) }} to={{ x: cx, y: yScale(stats.lowerWhisker) }} stroke="black" strokeWidth={1.5} />

            {/* Scatter points */}
            {config.showPoints !== false && vals.map((v, j) => {
              const jX = getJitterOffset(config.jitterSeed || 42, i * 1000 + j, jitterBand);
              const smallOffset = gap + (jX + jitterBand / 2);
              return <Circle key={`pt-${j}`} cx={cx + smallOffset} cy={yScale(v)} r={config.pointSize ?? 3}
                        fill={color} fillOpacity={0.6} stroke="black" strokeWidth={1} />;
            })}
          </g>
        );
      })}
      
      <SignificanceLayer comparisons={activeComparisons} groupOrder={groups} xScale={(g) => (xScale(g) || 0) + xScale.bandwidth() / 2} yScale={yScale} dataMax={yDomainMax} scale={config.significanceScale} showNs={config.showNsBrackets} fontFamily={config.fontFamily} fontSize={config.fontSize} pValueFontSize={config.pValueFontSize} />
      {omnibusP !== undefined && (config as any).showOmnibus !== false ? <text x={innerWidth} y={-10} textAnchor="end" fontSize={config.fontSize} fontFamily={config.fontFamily} fill="#666">Omnibus {getPValueStar(omnibusP, config.significanceScale)}</text> : null}
    </BaseChartLayout>
  );
}

export function ScatterChart({ sheet, analysisResults, config, width, height }: ColumnChartsProps) {
  const { dataMap, allYValues, groups } = parseSheetData(sheet);
  
  const statsMap = new Map<string, any>();
  if (analysisResults?.descriptives) {
    Object.keys(analysisResults.descriptives).forEach(k => statsMap.set(k, analysisResults.descriptives[k]));
  }

  const comparisons = analysisResults?.post_hocs?.comparisons || [];
  const activeComparisons = (config.showNsBrackets ?? true) ? comparisons : comparisons.filter((c: any) => c.p_value <= 0.05);
  const colors = PALETTES[config.palette || "okabe-ito"] || PALETTES["okabe-ito"];
  const yRange = getAutoAxisRange(allYValues, 0.05, true);
  const yDomainMin = config.yAxisMin ?? yRange.min;
  const yDomainMax = config.yAxisMax ?? yRange.max;
  
  const tempYScale = scaleLinear<number>({ domain: [yDomainMin, yDomainMax], nice: config.yAxisMin === undefined && config.yAxisMax === undefined });
  const tickFormat = (v: any) => {
    if (typeof v === 'number') {
      if (v === 0) return "0";
      if (Math.abs(v) > 1e4 || Math.abs(v) < 1e-3) return v.toExponential(1);
      return v.toString();
    }
    return v;
  };
  const yTickValues = tempYScale.ticks();
  const yTickLabels = yTickValues.map(tickFormat);
  const legendItems = groups.map((g, i) => ({ label: g, color: colors[i % colors.length] }));
  const tiered = activeComparisons.length > 0 ? assignBracketTiers(activeComparisons, groups) : [];
  const maxTier = tiered.length > 0 ? Math.max(...tiered.map(t => t.tier)) : -1;
  const omnibusP = analysisResults?.omnibus?.p_value;

  const layout = computeChartLayout({ width, height, config, xTickLabels: groups, yTickLabels, legendItems: config.showLegend ? legendItems : [], maxBracketTier: maxTier, hasOmnibus: omnibusP !== undefined && (config as any).showOmnibus !== false });
  const { margin, innerWidth, innerHeight } = layout;

  const xScale = scaleBand<string>({ domain: groups, range: [0, innerWidth], padding: 0.3 });
  const yScale = scaleLinear<number>({ domain: [yDomainMin, yDomainMax], range: [innerHeight, 0], nice: config.yAxisMin === undefined && config.yAxisMax === undefined });

  return (
    <BaseChartLayout
      width={width} height={height} margin={margin} yTickValues={yTickValues}
      xAxisTitleY={layout.xAxisTitleY} yAxisTitleX={layout.yAxisTitleX} legend={layout.legend}
      xScale={xScale} yScale={yScale}
      yLabel={config.showYAxisTitle !== false ? (config.yAxisTitle ?? "Value") : undefined} xLabel={config.showXAxisTitle !== false ? (config.xAxisTitle ?? "Group") : undefined}
      fontFamily={config.fontFamily} fontSize={config.fontSize} axisTitleFontSize={config.axisTitleFontSize} axisLabelFontSize={config.axisLabelFontSize} legendFontSize={config.legendFontSize}
    >
      {groups.map((group, i) => {
        const x = xScale(group);
        const bw = xScale.bandwidth();
        if (x === undefined) return null;
        const vals = dataMap.get(group) || [];
        const stat = statsMap.get(group);
        const bounds = stat ? getErrorBarBounds(stat, config.errorBarType || "mean_sem") : null;
        const color = colors[i % colors.length];

        return (
          <g key={`scatter-${group}`}>
            {bounds && (
              <>
                <Line x1={x + bw / 2} y1={yScale(bounds.y1)} x2={x + bw / 2} y2={yScale(bounds.y2)} stroke={color} strokeWidth={2} />
                <Line x1={x + bw / 2 - 10} y1={yScale(bounds.y1)} x2={x + bw / 2 + 10} y2={yScale(bounds.y1)} stroke={color} strokeWidth={2} />
                <Line x1={x + bw / 2 - 10} y1={yScale(bounds.y2)} x2={x + bw / 2 + 10} y2={yScale(bounds.y2)} stroke={color} strokeWidth={2} />
                <Line x1={x + bw / 2 - 15} y1={yScale(stat.mean)} x2={x + bw / 2 + 15} y2={yScale(stat.mean)} stroke={color} strokeWidth={3} />
              </>
            )}
            {config.showPoints !== false && vals.map((v, j) => (
              <Circle key={`pt-${j}`} cx={x + bw / 2 + getJitterOffset(config.jitterSeed || 42, i * 1000 + j, bw * 0.5)} cy={yScale(v)} r={config.pointSize ?? 3} fill={color} fillOpacity={0.6} stroke="black" strokeWidth={1} />
            ))}
          </g>
        );
      })}
      <SignificanceLayer comparisons={activeComparisons} groupOrder={groups} xScale={(g) => (xScale(g) || 0) + xScale.bandwidth() / 2} yScale={yScale} dataMax={yDomainMax} scale={config.significanceScale} showNs={config.showNsBrackets} fontFamily={config.fontFamily} fontSize={config.fontSize} pValueFontSize={config.pValueFontSize} />
      {omnibusP !== undefined && (config as any).showOmnibus !== false ? <text x={innerWidth} y={-10} textAnchor="end" fontSize={config.fontSize} fontFamily={config.fontFamily} fill="#666">Omnibus {getPValueStar(omnibusP, config.significanceScale)}</text> : null}
    </BaseChartLayout>
  );
}


// ----------------------------------------
// Point-based Charts (Jitter, Strip, Swarm)
// ----------------------------------------

function createPointChart(
  name: string,
  getPointCoords: (vals: number[], center: number, radius: number, yScale: any, i: number, boxWidth: number, config: any) => { cx: number; cy: number; value: number }[]
) {
  return function PointChart({ sheet, analysisResults, config, width, height }: ColumnChartsProps) {
    const { dataMap, allYValues, groups } = parseSheetData(sheet);

    const comparisons = analysisResults?.post_hocs?.comparisons || [];
    const activeComparisons = (config.showNsBrackets ?? true) ? comparisons : comparisons.filter((c: any) => c.p_value <= 0.05);
    let maxTier = 0;
    if (activeComparisons.length > 0) {
      const tiered = assignBracketTiers(activeComparisons, groups);
      maxTier = tiered.length > 0 ? Math.max(...tiered.map(t => t.tier)) : 0;
    }
    const omnibusP = analysisResults?.omnibus?.p_value ?? analysisResults?.omnibus?.p;
    const colors = PALETTES[config.palette || "okabe-ito"] || PALETTES["okabe-ito"];

    const yRange = getAutoAxisRange(allYValues, 0.05, true);
    const yDomainMin = config.yAxisMin ?? yRange.min;
    const yDomainMax = config.yAxisMax ?? yRange.max;

    const tempYScale = scaleLinear<number>({ domain: [yDomainMin, yDomainMax], nice: config.yAxisMin === undefined && config.yAxisMax === undefined });
    const yTickValues = tempYScale.ticks();
    const tickFormat = (v: any) => {
      if (typeof v === 'number') {
        if (v === 0) return "0";
        if (Math.abs(v) > 1e4 || Math.abs(v) < 1e-3) return v.toExponential(1);
        return v.toString();
      }
      return v;
    };
    const yTickLabels = yTickValues.map(tickFormat);
    const legendItems = groups.map((g, i) => ({ label: g, color: colors[i % colors.length] }));

    const layout = computeChartLayout({
      width, height, config, xTickLabels: groups, yTickLabels,
      legendItems: config.showLegend ? legendItems : [],
      maxBracketTier: activeComparisons.length > 0 ? maxTier : -1,
      hasOmnibus: omnibusP !== undefined && (config as any).showOmnibus !== false
    });

    const { margin, innerWidth, innerHeight } = layout;
    const xScale = scaleBand<string>({ domain: groups, range: [0, innerWidth], padding: 0.3 });
    const yScale = scaleLinear<number>({ domain: [yDomainMin, yDomainMax], range: [innerHeight, 0], nice: config.yAxisMin === undefined && config.yAxisMax === undefined });

    return (
      <BaseChartLayout
        yTickValues={yTickValues} xAxisTitleY={layout.xAxisTitleY} yAxisTitleX={layout.yAxisTitleX} legend={layout.legend}
        width={width} height={height} margin={margin} xScale={xScale} yScale={yScale}
        yLabel={config.showYAxisTitle !== false ? (config.yAxisTitle ?? "Value") : undefined} xLabel={config.showXAxisTitle !== false ? (config.xAxisTitle ?? "Group") : undefined}
        fontFamily={config.fontFamily} fontSize={config.fontSize} axisTitleFontSize={config.axisTitleFontSize} axisLabelFontSize={config.axisLabelFontSize} legendFontSize={config.legendFontSize}
      >
        {groups.map((g, i) => {
          const vals = dataMap.get(g) || [];
          const boxWidth = xScale.bandwidth();
          const xPos = xScale(g) ?? 0;
          const midX = xPos + boxWidth / 2;
          const color = colors[i % colors.length];
          const radius = config.pointSize ?? 3;
          
          const points = getPointCoords(vals, midX, radius, yScale, i, boxWidth, config);
          
          return (
            <g key={`points-${g}`}>
              {points.map((p, j) => (
                <Circle key={`pt-${j}`} cx={p.cx} cy={p.cy} r={radius} fill={color} fillOpacity={0.6} stroke="black" strokeWidth={1} />
              ))}
            </g>
          );
        })}

        {comparisons.length > 0 ? (
          <SignificanceLayer comparisons={comparisons} groupOrder={groups} xScale={(group) => (xScale(group) ?? 0) + xScale.bandwidth() / 2} yScale={yScale} dataMax={yRange.max} scale={config.significanceScale} showNs={config.showNsBrackets} fontFamily={config.fontFamily} fontSize={config.fontSize} pValueFontSize={config.pValueFontSize} />
        ) : omnibusP !== undefined ? (
          <text x={innerWidth / 2} y={yScale(yRange.max) - 20} textAnchor="middle" fontSize={config.fontSize} fontFamily={config.fontFamily} fill="#333" fontStyle={config.significanceScale === "raw" ? "italic" : "normal"}>Omnibus {getPValueStar(omnibusP, config.significanceScale)}</text>
        ) : null}
      </BaseChartLayout>
    );
  };
}

export const StripChart = createPointChart("StripChart", (vals, center, radius, yScale) => {
  return vals.map(v => ({ value: v, cx: center, cy: yScale(v) }));
});

export const JitterChart = createPointChart("JitterChart", (vals, center, radius, yScale, i, boxWidth, config) => {
  return vals.map((v, idx) => ({
    value: v,
    cx: center + getJitterOffset(config.jitterSeed || 42, idx, boxWidth * 0.5),
    cy: yScale(v)
  }));
});

export const SwarmChart = createPointChart("SwarmChart", (vals, center, radius, yScale) => {
  return computeBeeswarm(vals, center, radius, yScale);
});
