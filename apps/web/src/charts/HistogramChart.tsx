import React from "react";
import { scaleLinear } from "@visx/scale";
import { Bar } from "@visx/shape";
import { bin } from "d3-array";
import { BaseChartLayout } from "./BaseChartLayout";
import { getAutoAxisRange } from "./geometry/axis";
import { computeChartLayout } from "./geometry/layout";
import { PALETTES } from "./ColumnCharts";
import type { DataSheet, GraphConfig } from "@/types/workbook";

export interface HistogramChartProps {
  sheet: DataSheet;
  config: GraphConfig;
  width: number;
  height: number;
  graphFamily?: string;
}

export function HistogramChart({ sheet, config, width, height, graphFamily }: HistogramChartProps) {
  const colors = PALETTES[config.palette || "okabe-ito"] || PALETTES["okabe-ito"];
  const dataMap = new Map<string, number[]>();
  let allValues: number[] = [];

  // Parse data depending on graph family
  if (graphFamily === "XY") {
    sheet.columnGroups.forEach((g) => {
      const groupName = g.name || g.id;
      const columns = (g as any).columns ? (g as any).columns : [g];
      columns.forEach((col: any) => {
        const colName = col.name || col.id;
        const seriesName = columns.length > 1 ? `${groupName} - ${colName}` : groupName;
        
        const vals = sheet.data
          .map((row) => {
            const yStr = row[col.id];
            if (yStr === undefined || yStr === null || yStr === "") return null;
            return Number(yStr);
          })
          .filter((v) => v !== null && !isNaN(v)) as number[];

        if (vals.length > 0) {
          dataMap.set(seriesName, vals);
          allValues.push(...vals);
        }
      });
    });
  } else {
    // Column family
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
      
      if (vals.length > 0) {
        dataMap.set(groupName, vals);
        allValues.push(...vals);
      }
    });
  }

  const seriesNames = Array.from(dataMap.keys());
  if (allValues.length === 0) return null;

  // Binning
  const xMin = Math.min(...allValues);
  const xMax = Math.max(...allValues);
  
  const binGenerator = bin<number, number>()
    .domain([xMin, xMax]);
    
  const binSettings = config.histogramBinSettings || { type: "continuous", stepSize: undefined };
  
  if (binSettings.type === "continuous") {
    if (binSettings.stepSize && binSettings.stepSize > 0) {
      const step = binSettings.stepSize;
      const thresholds = [];
      const start = Math.floor(xMin / step) * step;
      for (let t = start; t <= xMax; t += step) {
        thresholds.push(t);
      }
      if (thresholds[thresholds.length - 1] < xMax) {
        thresholds.push(thresholds[thresholds.length - 1] + step);
      }
      binGenerator.thresholds(thresholds);
    } else if (config.histogramBins && config.histogramBins > 0) {
      binGenerator.thresholds(config.histogramBins);
    }
  }

  // Calculate bins for each series
  const seriesBins = new Map<string, any[]>();
  let maxFreq = 0;
  
  seriesNames.forEach((series) => {
    const vals = dataMap.get(series) || [];
    let bins: any[] = [];

    if (binSettings.type === "prebinned") {
      const counts = new Map<number, number>();
      vals.forEach(v => counts.set(v, (counts.get(v) || 0) + 1));
      const sortedKeys = Array.from(counts.keys()).sort((a,b) => a - b);
      
      let minDiff = Infinity;
      for (let i = 1; i < sortedKeys.length; i++) {
        const diff = sortedKeys[i] - sortedKeys[i-1];
        if (diff > 0 && diff < minDiff) minDiff = diff;
      }
      if (minDiff === Infinity) minDiff = 1;

      bins = sortedKeys.map(k => {
        const b: any = new Array(counts.get(k)).fill(k);
        b.x0 = k - minDiff / 2;
        b.x1 = k + minDiff / 2;
        return b;
      });
    } else {
      bins = binGenerator(vals);
    }

    const maxB = Math.max(0, ...bins.map(b => b.length));
    if (maxB > maxFreq) maxFreq = maxB;
    seriesBins.set(series, bins);
  });

  const xRange = getAutoAxisRange(allValues, 0.05, false);
  const xDomainMin = config.xAxisMin ?? xRange.min;
  const xDomainMax = config.xAxisMax ?? xRange.max;
  const yDomainMin = config.yAxisMin ?? 0;
  const yDomainMax = config.yAxisMax ?? Math.max(1, maxFreq + Math.ceil(maxFreq * 0.1));

  const layout = computeChartLayout({
    width,
    height,
    config,
    xTickLabels: [xDomainMin.toPrecision(3), xDomainMax.toPrecision(3)],
    yTickLabels: ["0", yDomainMax.toString()],
    legendItems: seriesNames.map((s, i) => ({ label: s, color: colors[i % colors.length] }))
  });

  const xScale = scaleLinear<number>({
    domain: [xDomainMin, xDomainMax],
    range: [0, layout.innerWidth],
  });

  const yScale = scaleLinear<number>({
    domain: [yDomainMin, yDomainMax],
    range: [layout.innerHeight, 0],
  });

  const numSeries = seriesNames.length;
  
  return (
    <BaseChartLayout
      width={width}
      height={height}
      margin={layout.margin}
      xScale={xScale}
      yScale={yScale}
      xLabel={config.xAxisTitle}
      yLabel={config.yAxisTitle}
      showGrid={config.showGrid !== false}
      gridDirection="horizontal"
      fontFamily={config.fontFamily}
      fontSize={config.fontSize}
      axisTitleFontSize={config.axisTitleFontSize}
      axisLabelFontSize={config.axisLabelFontSize}
      xAxisTitleY={layout.xAxisTitleY}
      yAxisTitleX={layout.yAxisTitleX}
      legend={layout.legend}
    >
      {seriesNames.map((series, i) => {
        const bins = seriesBins.get(series) || [];
        const color = colors[i % colors.length];
        
        return (
          <g key={`series-${series}`}>
            {bins.map((b, j) => {
              if (b.length === 0) return null;
              // Bar width should consider number of series (grouped histogram)
              const binX0 = xScale(b.x0 ?? 0);
              const binX1 = xScale(b.x1 ?? 0);
              const totalBarWidth = (binX1 - binX0) * 0.9; // 10% gap
              const barWidth = totalBarWidth / numSeries;
              const barX = binX0 + (binX1 - binX0) * 0.05 + i * barWidth;
              
              const barHeight = layout.innerHeight - yScale(b.length);
              const barY = yScale(b.length);
              
              return (
                <Bar
                  key={`bin-${j}`}
                  x={barX}
                  y={barY}
                  width={barWidth}
                  height={barHeight}
                  fill={color}
                  fillOpacity={0.8}
                  stroke="#fff"
                  strokeWidth={1}
                />
              );
            })}
          </g>
        );
      })}
    </BaseChartLayout>
  );
}
