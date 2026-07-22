import React from "react";
import { scaleBand, scaleLinear } from "@visx/scale";
import { Circle, Line } from "@visx/shape";
import { BaseChartLayout } from "./BaseChartLayout";
import { getBoxStats, getNotchBounds } from "./geometry/boxStats";
import { getJitterOffset } from "./geometry/jitter";
import { getAutoAxisRange } from "./geometry/axis";
import type { DataSheet, GraphConfig } from "@/types/workbook";
import { computeChartLayout } from "./geometry/layout";
import { parseSheetData, PALETTES } from "./ColumnCharts";

export interface HorizontalCategoryChartProps {
  sheet: DataSheet;
  analysisResults?: any;
  config: GraphConfig;
  width: number;
  height: number;
}

// Simple approximation of standard normal inverse CDF
function standardNormalInv(p: number): number {
  if (p <= 0) return -10;
  if (p >= 1) return 10;
  const c0 = 2.515517, c1 = 0.802853, c2 = 0.010328;
  const d1 = 1.432788, d2 = 0.189269, d3 = 0.001308;
  const q = p < 0.5 ? p : 1 - p;
  const t = Math.sqrt(-2.0 * Math.log(q));
  let z = t - ((c2 * t + c1) * t + c0) / (((d3 * t + d2) * t + d1) * t + 1.0);
  return p < 0.5 ? -z : z;
}

// Cornish-Fisher expansion for t-distribution ppf
function tInv(p: number, df: number): number {
  if (df <= 0) return NaN;
  const z = standardNormalInv(p);
  if (df > 1000) return z;
  return z + (z * z * z + z) / (4 * df) + (5 * Math.pow(z, 5) + 16 * Math.pow(z, 3) + 3 * z) / (96 * df * df);
}

export function HBoxChart({ sheet, analysisResults, config, width, height }: HorizontalCategoryChartProps) {
  const { dataMap, groups } = parseSheetData(sheet);

  // Value domain: all whisker lows/highs + referenceValue
  let minV = Infinity, maxV = -Infinity;
  const statsByGroup = new Map<string, any>();
  
  groups.forEach(g => {
    const vals = dataMap.get(g) || [];
    const engineStats = (analysisResults?.descriptives || []).find((d: any) => d.group === g);
    const box = getBoxStats(vals, engineStats);
    statsByGroup.set(g, box);
    if (box.lowerWhisker < minV) minV = box.lowerWhisker;
    if (box.upperWhisker > maxV) maxV = box.upperWhisker;
  });

  if (config.referenceValue !== undefined && !isNaN(config.referenceValue)) {
    if (config.referenceValue < minV) minV = config.referenceValue;
    if (config.referenceValue > maxV) maxV = config.referenceValue;
  }

  const _range = getAutoAxisRange((isFinite(minV) && isFinite(maxV)) ? [minV, maxV] : [], 0.05);
  const xMin = (config.xAxisMin != null) ? config.xAxisMin : _range.min;
  const xMax = (config.xAxisMax != null) ? config.xAxisMax : _range.max;

  const layout = computeChartLayout({
    width, height, config,
    xTickLabels: [xMin.toPrecision(3), xMax.toPrecision(3)], // For bottom margin estimation
    yTickLabels: groups, // For left margin measurement
    orientation: "horizontal",
    legendItems: groups.map((g, i) => ({ label: g, color: PALETTES[config.palette || "okabe-ito"][i % PALETTES[config.palette || "okabe-ito"].length] }))
  });

  const yScale = scaleBand({ range: [0, layout.innerHeight], domain: groups, padding: 0.2 });
  const xScale = scaleLinear({ range: [0, layout.innerWidth], domain: [xMin, xMax] });
  const palette = PALETTES[config.palette] || PALETTES["okabe-ito"];
  const rowH = yScale.bandwidth();
  const boxH = Math.max(rowH * 0.5, 2);

  return (
    <BaseChartLayout
          width={width} height={height} margin={layout.margin}
          xScale={xScale} yScale={yScale}
          xLabel={config.xAxisTitle} yLabel={config.yAxisTitle}
          showGrid={true} gridDirection="vertical"
          fontFamily={config.fontFamily} fontSize={config.fontSize}
          axisTitleFontSize={config.axisTitleFontSize} axisLabelFontSize={config.axisLabelFontSize}
          xAxisTitleY={layout.xAxisTitleY} yAxisTitleX={layout.yAxisTitleX}
          legend={layout.legend}
        >
          {groups.map((g, i) => {
            const vals = dataMap.get(g) || [];
            const box = statsByGroup.get(g);
            if (!box) return null;
            
            const cy = (yScale(g) ?? 0) + rowH / 2;
            const x1 = xScale(box.lowerWhisker);
            const x2 = xScale(box.upperWhisker);
            const q1x = xScale(box.q1);
            const q3x = xScale(box.q3);
            const mx = xScale(box.median);
            const color = palette[i % palette.length];
            const isNotched = config.notched && vals.length > 0;
            const notch = isNotched ? getNotchBounds(box.median, box.q1, box.q3, vals.length) : null;
            
            const nL = notch ? xScale(Math.max(box.q1, notch.notchLow)) : q1x;
            const nH = notch ? xScale(Math.min(box.q3, notch.notchHigh)) : q3x;
            const pinch = boxH * 0.5; // Half height at median
            const halfH = boxH / 2;

            let pathD = "";
            if (isNotched && notch) {
               pathD = `
                 M ${q1x} ${cy - halfH}
                 L ${nL} ${cy - halfH}
                 L ${mx} ${cy - pinch / 2}
                 L ${nH} ${cy - halfH}
                 L ${q3x} ${cy - halfH}
                 L ${q3x} ${cy + halfH}
                 L ${nH} ${cy + halfH}
                 L ${mx} ${cy + pinch / 2}
                 L ${nL} ${cy + halfH}
                 L ${q1x} ${cy + halfH}
                 Z
               `;
            } else {
               pathD = `
                 M ${q1x} ${cy - halfH}
                 L ${q3x} ${cy - halfH}
                 L ${q3x} ${cy + halfH}
                 L ${q1x} ${cy + halfH}
                 Z
               `;
            }

            return (
              <g key={g}>
                {/* Whiskers */}
                <Line x1={x1} y1={cy} x2={q1x} y2={cy} stroke="currentColor" strokeWidth={1.5} />
                <Line x1={q3x} y1={cy} x2={x2} y2={cy} stroke="currentColor" strokeWidth={1.5} />
                <Line x1={x1} y1={cy - halfH/2} x2={x1} y2={cy + halfH/2} stroke="currentColor" strokeWidth={1.5} />
                <Line x1={x2} y1={cy - halfH/2} x2={x2} y2={cy + halfH/2} stroke="currentColor" strokeWidth={1.5} />
                
                {/* Box */}
                <path d={pathD} fill={color} stroke="currentColor" strokeWidth={1.5} fillOpacity={0.8} />
                
                {/* Median */}
                {isNotched ? (
                  <Line x1={mx} y1={cy - pinch/2} x2={mx} y2={cy + pinch/2} stroke="currentColor" strokeWidth={2} />
                ) : (
                  <Line x1={mx} y1={cy - halfH} x2={mx} y2={cy + halfH} stroke="currentColor" strokeWidth={2} />
                )}

                {/* Individual points (optional) */}
                {config.showPoints && vals.map((v, idx) => (
                   <Circle
                     key={idx}
                     cx={xScale(v)}
                     cy={cy + getJitterOffset(config.jitterSeed, idx, boxH)}
                     r={config.pointSize ?? 3}
                     fill={color}
                     fillOpacity={0.8}
                     stroke="#000000"
                     strokeWidth={1}
                   />
                ))}
              </g>
            );
          })}
          {config.referenceValue !== undefined && !isNaN(config.referenceValue) && (
            <Line x1={xScale(config.referenceValue)} y1={0} x2={xScale(config.referenceValue)} y2={layout.innerHeight} stroke="currentColor" strokeDasharray="4,4" opacity={0.6} />
          )}
    </BaseChartLayout>
  );
}

export function RangeDumbbellChart({ sheet, analysisResults, config, width, height }: HorizontalCategoryChartProps) {
  const { dataMap, groups } = parseSheetData(sheet);
  const mode = config.rangeMode ?? "min_max";

  let minV = Infinity, maxV = -Infinity;
  const ranges = new Map<string, { low: number, high: number, center: number }>();
  
  groups.forEach(g => {
    const vals = dataMap.get(g) || [];
    if (vals.length === 0) return;
    
    let low = 0, high = 0, center = 0;
    const sorted = [...vals].sort((a,b)=>a-b);
    
    if (mode === "min_max") {
      low = sorted[0];
      high = sorted[sorted.length - 1];
      center = sorted[Math.floor(sorted.length/2)]; // median
    } else if (mode === "iqr") {
      const q1 = sorted[Math.floor(sorted.length * 0.25)];
      const q3 = sorted[Math.floor(sorted.length * 0.75)];
      low = q1; high = q3;
      center = sorted[Math.floor(sorted.length/2)];
    } else {
      // mean_sd
      const mean = vals.reduce((a,b)=>a+b,0)/vals.length;
      const sd = Math.sqrt(vals.reduce((sq,v) => sq + Math.pow(v-mean, 2), 0) / (vals.length - 1 || 1));
      low = mean - sd; high = mean + sd;
      center = mean;
    }
    ranges.set(g, { low, high, center });
    if (low < minV) minV = low;
    if (high > maxV) maxV = high;
  });

  if (config.referenceValue !== undefined && !isNaN(config.referenceValue)) {
    if (config.referenceValue < minV) minV = config.referenceValue;
    if (config.referenceValue > maxV) maxV = config.referenceValue;
  }

  const _range = getAutoAxisRange((isFinite(minV) && isFinite(maxV)) ? [minV, maxV] : [], 0.05);
  const xMin = (config.xAxisMin != null) ? config.xAxisMin : _range.min;
  const xMax = (config.xAxisMax != null) ? config.xAxisMax : _range.max;

  const layout = computeChartLayout({
    width, height, config,
    xTickLabels: [xMin.toPrecision(3), xMax.toPrecision(3)],
    yTickLabels: groups,
    orientation: "horizontal",
    legendItems: groups.map((g, i) => ({ label: g, color: PALETTES[config.palette || "okabe-ito"][i % PALETTES[config.palette || "okabe-ito"].length] }))
  });

  const yScale = scaleBand({ range: [0, layout.innerHeight], domain: groups, padding: 0.2 });
  const xScale = scaleLinear({ range: [0, layout.innerWidth], domain: [xMin, xMax] });
  const palette = PALETTES[config.palette] || PALETTES["okabe-ito"];
  const r = config.pointSize ?? 4;

  return (
    <BaseChartLayout
          width={width} height={height} margin={layout.margin}
          xScale={xScale} yScale={yScale}
          xLabel={config.xAxisTitle} yLabel={config.yAxisTitle}
          showGrid={true} gridDirection="vertical"
          fontFamily={config.fontFamily} fontSize={config.fontSize}
          axisTitleFontSize={config.axisTitleFontSize} axisLabelFontSize={config.axisLabelFontSize}
          xAxisTitleY={layout.xAxisTitleY} yAxisTitleX={layout.yAxisTitleX}
          legend={layout.legend}
        >
          {groups.map((g, i) => {
            const rng = ranges.get(g);
            if (!rng) return null;
            const cy = (yScale(g) ?? 0) + yScale.bandwidth() / 2;
            const color = palette[i % palette.length];
            return (
              <g key={g}>
                <Line x1={xScale(rng.low)} y1={cy} x2={xScale(rng.high)} y2={cy} stroke={color} strokeWidth={2} />
                <Circle cx={xScale(rng.low)} cy={cy} r={r} fill={color} />
                <Circle cx={xScale(rng.high)} cy={cy} r={r} fill={color} />
                <Circle cx={xScale(rng.center)} cy={cy} r={r * 0.5} fill="white" stroke={color} strokeWidth={1} />
                {config.showPoints && (dataMap.get(g)||[]).map((v, idx) => (
                   <Circle
                     key={idx}
                     cx={xScale(v)}
                     cy={cy + getJitterOffset(config.jitterSeed, idx, 20)}
                     r={2}
                     fill={color}
                     fillOpacity={0.8}
                     stroke="#000000"
                     strokeWidth={1}
                   />
                ))}
              </g>
            );
          })}
          {config.referenceValue !== undefined && !isNaN(config.referenceValue) && (
            <Line x1={xScale(config.referenceValue)} y1={0} x2={xScale(config.referenceValue)} y2={layout.innerHeight} stroke="currentColor" strokeDasharray="4,4" opacity={0.6} />
          )}
    </BaseChartLayout>
  );
}

export function CIForestChart({ sheet, analysisResults, config, width, height }: HorizontalCategoryChartProps) {
  const mode = config.ciSource ?? "group_means";
  let minV = Infinity, maxV = -Infinity;
  const items: Array<{ id: string, label: string, estimate: number, ciLow: number, ciHigh: number }> = [];
  
  const ciLvl = config.ciLevel ?? 95;
  const p = 1 - (1 - ciLvl / 100) / 2;
  
  if (mode === "coefficients") {
    const coeffs = analysisResults?.coefficients;
    if (!coeffs || !Array.isArray(coeffs) || coeffs.length === 0) {
      return (
        <g>
          <text x={width / 2} y={height / 2} textAnchor="middle" fill="#666" fontSize={13}>
            No coefficient CIs available for this analysis.
          </text>
          <text x={width / 2} y={height / 2 + 20} textAnchor="middle" fill="#666" fontSize={13}>
            Run (or re-run) a multiple regression model to use coefficients mode.
          </text>
        </g>
      );
    }
    coeffs.forEach((c: any) => {
      // Coeff structure: { label, estimate, ci_low, ci_high }
      items.push({ id: c.label, label: c.label, estimate: c.estimate, ciLow: c.ci_low, ciHigh: c.ci_high });
      if (c.ci_low < minV) minV = c.ci_low;
      if (c.ci_high > maxV) maxV = c.ci_high;
    });
  } else {
    // group_means
    const { dataMap, groups } = parseSheetData(sheet);
    groups.forEach(g => {
      const vals = dataMap.get(g) || [];
      if (vals.length === 0) return;
      const n = vals.length;
      let mean = 0, sem = 0;
      
      const eng = (analysisResults?.descriptives || []).find((d: any) => d.group === g);
      if (eng && eng.mean !== undefined && eng.sem !== undefined && eng.n !== undefined) {
        mean = eng.mean;
        sem = eng.sem;
      } else {
        mean = vals.reduce((a,b)=>a+b,0)/n;
        const sd = Math.sqrt(vals.reduce((sq,v) => sq + Math.pow(v-mean, 2), 0) / (n - 1 || 1));
        sem = sd / Math.sqrt(n);
      }
      
      // Exact calculation using t distribution approx
      const tMult = tInv(p, Math.max(n - 1, 1));
      let ciLow = mean - tMult * sem;
      let ciHigh = mean + tMult * sem;
      
      // If ciLevel is 95 and we have engine ci_lower/upper, prefer them
      if (ciLvl === 95 && eng && eng.ci_lower !== undefined && eng.ci_upper !== undefined) {
        ciLow = eng.ci_lower;
        ciHigh = eng.ci_upper;
      }
      
      items.push({ id: g, label: g, estimate: mean, ciLow, ciHigh });
      if (ciLow < minV) minV = ciLow;
      if (ciHigh > maxV) maxV = ciHigh;
    });
  }

  if (items.length === 0) {
    return (<g><text x={width / 2} y={height / 2} textAnchor="middle" fill="#666" fontSize={13}>No data available</text></g>);
  }

  if (config.referenceValue !== undefined && !isNaN(config.referenceValue)) {
    if (config.referenceValue < minV) minV = config.referenceValue;
    if (config.referenceValue > maxV) maxV = config.referenceValue;
  }

  const _range = getAutoAxisRange((isFinite(minV) && isFinite(maxV)) ? [minV, maxV] : [], 0.05);
  const xMin = (config.xAxisMin != null) ? config.xAxisMin : _range.min;
  const xMax = (config.xAxisMax != null) ? config.xAxisMax : _range.max;

  const yDomain = items.map(d => d.id);
  const layout = computeChartLayout({
    width, height, config,
    xTickLabels: [xMin.toPrecision(3), xMax.toPrecision(3)],
    yTickLabels: items.map(d => d.label),
    orientation: "horizontal",
    legendItems: items.map((item, i) => ({ label: item.label, color: PALETTES[config.palette || "okabe-ito"][i % PALETTES[config.palette || "okabe-ito"].length] }))
  });

  const yScale = scaleBand({ range: [0, layout.innerHeight], domain: yDomain, padding: 0.3 });
  const xScale = scaleLinear({ range: [0, layout.innerWidth], domain: [xMin, xMax] });
  const palette = PALETTES[config.palette] || PALETTES["okabe-ito"];
  const r = config.pointSize ?? 4;
  const capH = 8; // vertical end-caps

  return (
    <BaseChartLayout
          width={width} height={height} margin={layout.margin}
          xScale={xScale} yScale={yScale}
          xLabel={config.xAxisTitle} yLabel={config.yAxisTitle}
          showGrid={true} gridDirection="vertical"
          fontFamily={config.fontFamily} fontSize={config.fontSize}
          axisTitleFontSize={config.axisTitleFontSize} axisLabelFontSize={config.axisLabelFontSize}
          xAxisTitleY={layout.xAxisTitleY} yAxisTitleX={layout.yAxisTitleX}
          legend={layout.legend}
        >
          {items.map((item, i) => {
            const cy = (yScale(item.id) ?? 0) + yScale.bandwidth() / 2;
            const color = palette[i % palette.length];
            return (
              <g key={item.id}>
                {/* CI Whisker */}
                <Line x1={xScale(item.ciLow)} y1={cy} x2={xScale(item.ciHigh)} y2={cy} stroke={color} strokeWidth={2} />
                {/* End caps */}
                <Line x1={xScale(item.ciLow)} y1={cy - capH/2} x2={xScale(item.ciLow)} y2={cy + capH/2} stroke={color} strokeWidth={2} />
                <Line x1={xScale(item.ciHigh)} y1={cy - capH/2} x2={xScale(item.ciHigh)} y2={cy + capH/2} stroke={color} strokeWidth={2} />
                {/* Estimate Point */}
                <Circle cx={xScale(item.estimate)} cy={cy} r={r} fill={color} />
              </g>
            );
          })}
          {config.referenceValue !== undefined && !isNaN(config.referenceValue) && (
            <Line x1={xScale(config.referenceValue)} y1={0} x2={xScale(config.referenceValue)} y2={layout.innerHeight} stroke="currentColor" strokeDasharray="4,4" opacity={0.6} />
          )}
    </BaseChartLayout>
  );
}
