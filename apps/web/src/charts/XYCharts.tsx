import React from "react";
import { scaleLinear } from "@visx/scale";
import { LinePath, Line, Circle } from "@visx/shape";
import { curveMonotoneX } from "@visx/curve";
import { getAutoAxisRange } from "./geometry/axis";
import { BaseChartLayout } from "./BaseChartLayout";
import { linearRegression, exponentialRegression } from "./geometry/regression";
import { PALETTES } from "./ColumnCharts";
import type { DataSheet, GraphConfig } from "@/types/workbook";
import { computeChartLayout } from "./geometry/layout";

export interface XYChartsProps {
  sheet: DataSheet;
  analysisResults?: any;
  config: GraphConfig;
  width: number;
  height: number;
}

export function XYScatterChart({ sheet, config, width, height }: XYChartsProps) {
  const trendlineType = config.trendlineType || "none";
  const lineStyle = config.lineStyle || "none";
  const colors = PALETTES[config.palette || "okabe-ito"] || PALETTES["okabe-ito"];
  const dataMap = new Map<string, { x: number; y: number }[]>();
  let allX: number[] = [];
  let allY: number[] = [];

  sheet.columnGroups.forEach((g) => {
    const groupName = g.name || g.id;
    // For XY sheets, each column inside a group is a distinct variable
    const columns = (g as any).columns ? (g as any).columns : [g];

    columns.forEach((col: any) => {
      const colName = col.name || col.id;
      const seriesName = columns.length > 1 ? `${groupName} - ${colName}` : groupName;
      
      const pts = sheet.data
        .map((row) => {
          const xStr = row.rowTitle;
          const yStr = row[col.id];
          if (xStr === undefined || xStr === null || xStr === "") return null;
          if (yStr === undefined || yStr === null || yStr === "") return null;
          return { x: Number(xStr), y: Number(yStr) };
        })
        .filter((pt) => pt !== null && !isNaN(pt.x) && !isNaN(pt.y)) as { x: number; y: number }[];

      if (pts.length > 0) {
        // Sort points by x for line rendering
        pts.sort((a, b) => a.x - b.x);
        dataMap.set(seriesName, pts);
        allX.push(...pts.map(p => p.x));
        allY.push(...pts.map(p => p.y));
      }
    });
  });

  const seriesNames = Array.from(dataMap.keys());
  if (seriesNames.length === 0) return null;

  const equationLines: string[] = [];
  const seriesEquations = new Map<string, string>();
  
    if (trendlineType !== "none") {
      seriesNames.forEach((series) => {
        const pts = dataMap.get(series) || [];
        if (pts.length <= 1) return;
        const xArr = pts.map(p => p.x);
        const yArr = pts.map(p => p.y);
        let trendlineStr = "";
        if (trendlineType === "linear" || trendlineType === "linear_forecast") {
          const reg = linearRegression(xArr, yArr);
          const sign = reg.intercept < 0 ? "-" : "+";
          const prefix = seriesNames.length > 1 ? series + ": " : "";
          trendlineStr = `${prefix}y = ${reg.slope.toPrecision(3)}x ${sign} ${Math.abs(reg.intercept).toPrecision(3)} (R² = ${reg.rSquared.toFixed(3)})`;
        } else if (trendlineType === "exponential") {
          const reg = exponentialRegression(xArr, yArr);
          if (reg.A !== 0) {
            const prefix = seriesNames.length > 1 ? series + ": " : "";
            trendlineStr = `${prefix}y = ${reg.A.toPrecision(3)}e^(${reg.B.toPrecision(3)}x) (R² = ${reg.rSquared.toFixed(3)})`;
          }
        }
        if (trendlineStr) { seriesEquations.set(series, trendlineStr); equationLines.push(trendlineStr); }
      });
    }

  const xRange = getAutoAxisRange(allX, 0.05, false);
  const yRange = getAutoAxisRange(allY, 0.05, true);

  const xDomainMin = config.xAxisMin ?? xRange.min;
  const xDomainMax = config.xAxisMax ?? xRange.max;
  
  // Extend X domain for forecast
  const xForecastMax = config.trendlineType === "linear_forecast" 
    ? xDomainMax + (xDomainMax - xDomainMin) * 0.15 
    : xDomainMax;

  const yDomainMin = config.yAxisMin ?? yRange.min;
  const yDomainMax = config.yAxisMax ?? yRange.max;

  const tempYScale = scaleLinear<number>({
    domain: [yDomainMin, yDomainMax],
    nice: true,
  });
  const tempXScale = scaleLinear<number>({
    domain: [xDomainMin, xForecastMax],
    nice: true,
  });

  const tickFormat = (v: any) => {
    if (typeof v === 'number') {
      if (v === 0) return "0";
      if (Math.abs(v) > 1e4 || Math.abs(v) < 1e-3) return v.toExponential(1);
      return v.toString();
    }
    return v;
  };
  
  const yTickLabels = tempYScale.ticks().map(tickFormat);
  const xTickLabels = tempXScale.ticks().map(tickFormat);
  const legendItems = seriesNames.map((g, i) => ({ label: g, color: colors[i % colors.length] }));

  const layout = computeChartLayout({
    width,
    height,
    config,
    xTickLabels,
    yTickLabels,
    legendItems: config.showLegend ? legendItems : [],
    equationLines,
  });

  const { margin, innerWidth, innerHeight } = layout;

const xScale = scaleLinear<number>({
    range: [0, innerWidth],
    domain: [xDomainMin, xForecastMax],
    nice: true,
  });

  const yScale = scaleLinear<number>({
    range: [innerHeight, 0],
    domain: [yDomainMin, yDomainMax],
    nice: true,
  });

  return (
    <BaseChartLayout
      width={width}
      height={height}
      margin={margin}
      yTickValues={tempYScale.ticks()}
      xAxisTitleY={layout.xAxisTitleY}
      yAxisTitleX={layout.yAxisTitleX}
      legend={layout.legend}
      xScale={xScale}
      yScale={yScale}
      yLabel={config.showYAxisTitle !== false ? (config.yAxisTitle ?? "Value") : undefined}
      xLabel={config.showXAxisTitle !== false ? (config.xAxisTitle ?? "X") : undefined}
      fontFamily={config.fontFamily}
      fontSize={config.fontSize}
      axisTitleFontSize={config.axisTitleFontSize}
      axisLabelFontSize={config.axisLabelFontSize}
      legendFontSize={config.legendFontSize}
    >
      {seriesNames.map((series, i) => {
        const pts = dataMap.get(series) || [];
        const color = colors[i % colors.length];

        const trendlineStr = seriesEquations.get(series);
        let pathLine = null;

        if (trendlineType !== "none" && pts.length > 1) {
          const xArr = pts.map(p => p.x);
          const yArr = pts.map(p => p.y);
          
          if (trendlineType === "linear" || trendlineType === "linear_forecast") {
            const reg = linearRegression(xArr, yArr);
            const x1 = Math.min(...xArr);
            const x2 = trendlineType === "linear_forecast" ? xForecastMax : Math.max(...xArr);
            const y1 = reg.slope * x1 + reg.intercept;
            const y2 = reg.slope * x2 + reg.intercept;
            
            pathLine = (
              <Line 
                x1={xScale(x1)} y1={yScale(y1)} 
                x2={xScale(x2)} y2={yScale(y2)} 
                stroke={color} strokeWidth={2} strokeDasharray="4,4" 
              />
            );
            const sign = reg.intercept < 0 ? "-" : "+";
            // trendlineStr = `y = ${reg.slope.toPrecision(3)}x ${sign} ${Math.abs(reg.intercept).toPrecision(3)} (R²=${reg.rSquared.toFixed(3)})`;
          } else if (trendlineType === "exponential") {
            const reg = exponentialRegression(xArr, yArr);
            if (reg.A !== 0) {
              const x1 = Math.min(...xArr);
              const x2 = Math.max(...xArr);
              const step = (x2 - x1) / 50;
              const curvePts = [];
              for(let v = x1; v <= x2; v += step) {
                curvePts.push({ x: v, y: reg.A * Math.exp(reg.B * v) });
              }
              pathLine = (
                <LinePath
                  data={curvePts}
                  x={d => xScale(d.x)}
                  y={d => yScale(d.y)}
                  stroke={color}
                  strokeWidth={2}
                  strokeDasharray="4,4"
                />
              );
              // trendlineStr = `y = ${reg.A.toPrecision(3)}e^(${reg.B.toPrecision(3)}x) (R²=${reg.rSquared.toFixed(3)})`;
            }
          }
        }

        return (
          <g key={`series-${series}`}>
            {lineStyle !== "none" && (
              <LinePath
                data={pts}
                x={d => xScale(d.x)}
                y={d => yScale(d.y)}
                stroke={color}
                strokeWidth={1.5}
                opacity={0.8}
                curve={lineStyle === "smooth" ? curveMonotoneX : undefined}
              />
            )}
            
            {pathLine}

            {config.showPoints !== false && pts.map((pt, j) => (
              <Circle
                key={`pt-${j}`}
                cx={xScale(pt.x)}
                cy={yScale(pt.y)}
                r={config.pointSize ?? 3}
                fill={color}
                fillOpacity={0.8}
                stroke="#fff"
                strokeWidth={1}
              />
            ))}

            
          </g>
        );
      })}
    
      {layout.equation && (
        <g transform={`translate(${innerWidth / 2}, ${innerHeight + layout.equation.y})`}>
          {layout.equation.lines.map((line, i) => (
            <text 
              key={`eq-${i}`}
              y={i * (config.equationFontSize ?? config.axisLabelFontSize ?? config.fontSize ?? 12) * 1.2}
              textAnchor="middle"
              fill="#333"
              fontSize={config.equationFontSize ?? config.axisLabelFontSize ?? config.fontSize ?? 12}
              fontFamily={config.fontFamily}
            >
              {line}
            </text>
          ))}
        </g>
      )}
    </BaseChartLayout>
  );
}
