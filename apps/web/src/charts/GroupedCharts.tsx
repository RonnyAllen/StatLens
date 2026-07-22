import React, { useMemo } from "react";
import { scaleBand, scaleLinear } from "@visx/scale";
import { Bar, Line, Circle } from "@visx/shape";
import { Group } from "@visx/group";
import { HeatmapRect } from "@visx/heatmap";
import { AxisLeft, AxisBottom } from "@visx/axis";
import { PALETTES } from "./ColumnCharts";
import type { DataSheet, GraphConfig } from "@/types/workbook";
import { BaseChartLayout } from "./BaseChartLayout";
import { computeChartLayout } from "./geometry/layout";
import { getViolinDensity } from "./geometry/violinDensity";
import { computeBeeswarm } from "./geometry/beeswarm";
import { getJitterOffset } from "./geometry/jitter";
import { getBoxStats, getNotchBounds } from "./geometry/boxStats";
import { getAutoAxisRange } from "./geometry/axis";
import { SignificanceLayer } from "./SignificanceLayer";
import { assignBracketTiers } from "./geometry/significance";

export interface GroupedChartsProps {
  sheet: DataSheet;
  analysisResults?: any;
  config: GraphConfig;
  width: number;
  height: number;
}

function parseGroupedData(sheet: DataSheet) {
  const replicates = (sheet.config as any)?.config?.replicates || (sheet.config as any)?.config?.subcolumns || 1;

  const getGroupCols = (gId: string) => {
    const subCols = [];
    if (replicates > 1) {
      for (let r = 1; r <= replicates; r++) subCols.push(`${gId}_${r}`);
    } else {
      subCols.push(gId);
    }
    return subCols;
  };

  // Only keep groups that have at least one numeric data point in the entire sheet
  const activeGroups = sheet.columnGroups.filter(g => {
    const subCols = getGroupCols(g.id);
    return sheet.data.some(row => 
      subCols.some(colId => {
        const val = row[colId];
        return val !== null && val !== undefined && val !== "" && !isNaN(Number(val));
      })
    );
  });

  const colGroups = activeGroups.map(g => g.id);
  const colGroupNames = activeGroups.map(g => g.name || g.id);


  const filteredData = sheet.data.filter(row => {
    return sheet.columnGroups.some(g => {
      const subCols = getGroupCols(g.id);
      return subCols.some(colId => row[colId] !== null && row[colId] !== undefined && row[colId] !== "");
    });
  });

  const rowTitles = filteredData.map((r, i) => String(r.rowTitle || `Row ${i + 1}`));

  const parsedDataList: any[] = [];
  const rawDataList: any[] = [];
  
  filteredData.forEach((row, i) => {
    const parsedRow: any = { rowTitle: String(row.rowTitle || `Row ${i + 1}`) };
    const rawRow: any = { rowTitle: String(row.rowTitle || `Row ${i + 1}`) };
    for (const g of sheet.columnGroups) {
      const subCols = getGroupCols(g.id);
      const vals = subCols
        .map(colId => {
          if (row[colId] === null || row[colId] === undefined || row[colId] === "") return NaN;
          return Number(row[colId]);
        })
        .filter(v => !isNaN(v));
      rawRow[g.id] = vals;
      if (vals.length > 0) {
        parsedRow[g.id] = vals.reduce((a, b) => a + b, 0) / vals.length;
      } else {
        parsedRow[g.id] = 0;
      }
    }
    parsedDataList.push(parsedRow);
    rawDataList.push(rawRow);
  });

  return { filteredData, rowTitles, colGroups, colGroupNames, parsedData: parsedDataList, rawData: rawDataList };
}

// ----------------------------------------
// Grouped Bar Chart
// ----------------------------------------
export function GroupedBarChart(props: GroupedChartsProps) {
  const { sheet, config, width, height } = props;
  const colors = PALETTES[config.palette || "okabe-ito"] || PALETTES["okabe-ito"];
  const fontFamily = config.fontFamily || "Inter";
  const fontSize = config.fontSize || 12;

  const { rowTitles, colGroups, colGroupNames, parsedData, rawData } = useMemo(() => parseGroupedData(sheet), [sheet]);

  const comparisons = props.analysisResults?.post_hocs?.comparisons || [];
  const activeComparisons = (config.showNsBrackets ?? true) 
    ? comparisons 
    : comparisons.filter((c: any) => c.p_value <= 0.05);

  const f1Comparisons = activeComparisons.filter((c: any) => c.factor === 'F1' || !c.factor);
  const f1Tiered = f1Comparisons.length > 0 ? assignBracketTiers(f1Comparisons, rowTitles) : [];
  const maxTier = f1Tiered.length > 0 ? Math.max(...f1Tiered.map((t: any) => t.tier)) : -1;
  const omnibusP = props.analysisResults?.omnibus?.p_value;

  let maxVal = 0;
  parsedData.forEach(row => {
    colGroups.forEach(gId => {
      if (row[gId] > maxVal) maxVal = row[gId];
    });
  });

  const legendItems = colGroups.map((g, i) => ({ label: colGroupNames[i], color: colors[i % colors.length] }));
  const layout = computeChartLayout({ 
    width, height, config, 
    xTickLabels: rowTitles, 
    yTickLabels: [maxVal.toFixed(1)], 
    legendItems: config.showLegend !== false ? legendItems : [],
    maxBracketTier: maxTier,
    hasOmnibus: omnibusP !== undefined && (config as any).showOmnibus !== false
  });
  const innerWidth = layout.innerWidth;
  const innerHeight = layout.innerHeight;

  const xScale0 = scaleBand<string>({
    domain: rowTitles,
    range: [0, innerWidth],
    padding: 0.2,
  });

  const xScale1 = scaleBand<string>({
    domain: colGroups,
    range: [0, xScale0.bandwidth()],
    padding: 0.1,
  });

  const yScale = scaleLinear<number>({
    domain: [0, maxVal * 1.1 || 1],
    range: [innerHeight, 0],
  });

  return (
    <BaseChartLayout
      width={width}
      height={height}
      margin={layout.margin}
      xScale={xScale0}
      yScale={yScale}
      yLabel={config.showYAxisTitle !== false ? (config.yAxisTitle || "Value") : undefined}
      xLabel={config.showXAxisTitle !== false ? (config.xAxisTitle || "Group") : undefined}
      legend={layout.legend}
      showGrid={config.showGrid ?? true}
      fontFamily={config.fontFamily}
      fontSize={config.fontSize}
      axisTitleFontSize={config.axisTitleFontSize}
      axisLabelFontSize={config.axisLabelFontSize}
      legendFontSize={config.legendFontSize}
    >
      {parsedData.map((row, i) => (
        <Group key={`group-${i}`} left={xScale0(row.rowTitle) || 0}>
          {colGroups.map((gId, j) => {
            const barWidth = xScale1.bandwidth();
            const barHeight = innerHeight - (yScale(row[gId]) || 0);
            const barX = xScale1(gId) || 0;
            const barY = innerHeight - barHeight;
            const color = colors[j % colors.length];

            return (
              <React.Fragment key={`bar-group-${i}-${j}`}>
                <Bar
                  key={`bar-${i}-${j}`}
                  x={barX}
                  y={barY}
                  width={barWidth}
                  height={barHeight}
                  fill={color}
                  rx={2}
                />
                {config.showPoints && computeBeeswarm(rawData[i]?.[gId] || [], 0, config.pointSize || 3, yScale).map((pt, pi) => (
                  <Circle key={`pt-${i}-${j}-${pi}`} cx={pt.cx + barX + barWidth / 2} cy={pt.cy} r={config.pointSize || 3} fill={color} fillOpacity={0.6} stroke="black" strokeWidth={1} />
                ))}
              </React.Fragment>
            );
          })}
        </Group>
      ))}
      
      {f1Comparisons.length > 0 ? (
        <SignificanceLayer
          comparisons={f1Comparisons}
          groupOrder={rowTitles}
          xScale={(group) => (xScale0(group) ?? 0) + xScale0.bandwidth() / 2}
          yScale={yScale}
          dataMax={maxVal}
          scale={config.significanceScale}
          showNs={config.showNsBrackets}
          fontFamily={config.fontFamily}
          fontSize={config.fontSize}
          pValueFontSize={config.pValueFontSize}
        />
      ) : omnibusP !== undefined && (config as any).showOmnibus !== false ? (
        <text
          x={innerWidth / 2}
          y={yScale(maxVal * 1.1) - 20}
          textAnchor="middle"
          fontSize={config.fontSize}
          fontFamily={config.fontFamily}
          fill="#333"
          fontStyle={config.significanceScale === "raw" ? "italic" : "normal"}
        >
          Omnibus p {config.significanceScale === 'raw' ? `= ${omnibusP.toExponential(2)}` : omnibusP < 0.001 ? '***' : omnibusP < 0.01 ? '**' : omnibusP < 0.05 ? '*' : 'ns'}
        </text>
      ) : null}
    </BaseChartLayout>
  );
}

// ----------------------------------------
// Grouped Box Chart
// ----------------------------------------
export function GroupedBoxChart(props: GroupedChartsProps) {
  const { sheet, config, width, height } = props;
  const colors = PALETTES[config.palette || "okabe-ito"] || PALETTES["okabe-ito"];
  const fontFamily = config.fontFamily || "Inter";
  const fontSize = config.fontSize || 12;

  const { rowTitles, colGroups, colGroupNames, rawData } = useMemo(() => parseGroupedData(sheet), [sheet]);

  const comparisons = props.analysisResults?.post_hocs?.comparisons || [];
  const activeComparisons = (config.showNsBrackets ?? true) 
    ? comparisons 
    : comparisons.filter((c: any) => c.p_value <= 0.05);

  const f1Comparisons = activeComparisons.filter((c: any) => c.factor === 'F1' || !c.factor);
  const f1Tiered = f1Comparisons.length > 0 ? assignBracketTiers(f1Comparisons, rowTitles) : [];
  const maxTier = f1Tiered.length > 0 ? Math.max(...f1Tiered.map((t: any) => t.tier)) : -1;
  const omnibusP = props.analysisResults?.omnibus?.p_value;

  const boxStats = useMemo(() => {
    return rawData.map(row => {
      const statsObj: Record<string, any> = {};
      colGroups.forEach(gId => {
        statsObj[gId] = getBoxStats(row[gId] || []);
      });
      return statsObj;
    });
  }, [rawData, colGroups]);

  let maxVal = 0;
  boxStats.forEach(rowStats => {
    colGroups.forEach(gId => {
      const stats = rowStats[gId];
      if (stats && stats.upperWhisker > maxVal) maxVal = stats.upperWhisker;
    });
  });

  const legendItems = colGroups.map((g, i) => ({ label: colGroupNames[i], color: colors[i % colors.length] }));
  const layout = computeChartLayout({ 
    width, height, config, 
    xTickLabels: rowTitles, 
    yTickLabels: [maxVal.toFixed(1)], 
    legendItems: config.showLegend !== false ? legendItems : [],
    maxBracketTier: maxTier,
    hasOmnibus: omnibusP !== undefined && (config as any).showOmnibus !== false
  });
  const innerWidth = layout.innerWidth;
  const innerHeight = layout.innerHeight;

  const xScale0 = scaleBand<string>({
    domain: rowTitles,
    range: [0, innerWidth],
    padding: 0.2,
  });

  const xScale1 = scaleBand<string>({
    domain: colGroups,
    range: [0, xScale0.bandwidth()],
    padding: 0.1,
  });

  const yScale = scaleLinear<number>({
    domain: [0, maxVal * 1.1 || 1],
    range: [innerHeight, 0],
  });

  return (
    <BaseChartLayout
      width={width}
      height={height}
      margin={layout.margin}
      xScale={xScale0}
      yScale={yScale}
      yLabel={config.showYAxisTitle !== false ? (config.yAxisTitle || "Value") : undefined}
      xLabel={config.showXAxisTitle !== false ? (config.xAxisTitle || "Group") : undefined}
      legend={layout.legend}
      showGrid={config.showGrid ?? true}
      fontFamily={config.fontFamily}
      fontSize={config.fontSize}
      axisTitleFontSize={config.axisTitleFontSize}
      axisLabelFontSize={config.axisLabelFontSize}
      legendFontSize={config.legendFontSize}
    >
      {rawData.map((row, i) => (
        <Group key={`group-${i}`} left={xScale0(row.rowTitle) || 0}>
          {colGroups.map((gId, j) => {
            const stats = boxStats[i][gId];
            if (!stats || isNaN(stats.median)) return null;

            const boxWidth = xScale1.bandwidth();
            const xPos = xScale1(gId) || 0;
            const midX = xPos + boxWidth / 2;
            const color = colors[j % colors.length];

            const yMin = yScale(stats.lowerWhisker);
            const yMax = yScale(stats.upperWhisker);
            const yQ1 = yScale(stats.q1);
            const yQ3 = yScale(stats.q3);
            const yMed = yScale(stats.median);

            return (
              <React.Fragment key={`box-${i}-${j}`}>
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
                      L ${xPos + boxWidth} ${Math.max(yScale(getNotchBounds(stats.median, stats.q1, stats.q3, rawData[i]?.[gId]?.length || 1).notchHigh), yQ3)}
                      L ${xPos + boxWidth * 0.75} ${yMed}
                      L ${xPos + boxWidth} ${Math.min(yScale(getNotchBounds(stats.median, stats.q1, stats.q3, rawData[i]?.[gId]?.length || 1).notchLow), yQ1)}
                      L ${xPos + boxWidth} ${yQ1}
                      L ${xPos} ${yQ1}
                      L ${xPos} ${Math.min(yScale(getNotchBounds(stats.median, stats.q1, stats.q3, rawData[i]?.[gId]?.length || 1).notchLow), yQ1)}
                      L ${xPos + boxWidth * 0.25} ${yMed}
                      L ${xPos} ${Math.max(yScale(getNotchBounds(stats.median, stats.q1, stats.q3, rawData[i]?.[gId]?.length || 1).notchHigh), yQ3)}
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
                    height={Math.max(1, yQ1 - yQ3)}
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
        </Group>
      ))}

      {f1Comparisons.length > 0 ? (
        <SignificanceLayer
          comparisons={f1Comparisons}
          groupOrder={rowTitles}
          xScale={(group) => (xScale0(group) ?? 0) + xScale0.bandwidth() / 2}
          yScale={yScale}
          dataMax={maxVal}
          scale={config.significanceScale}
          showNs={config.showNsBrackets}
          fontFamily={config.fontFamily}
          fontSize={config.fontSize}
          pValueFontSize={config.pValueFontSize}
        />
      ) : omnibusP !== undefined && (config as any).showOmnibus !== false ? (
        <text
          x={innerWidth / 2}
          y={yScale(maxVal * 1.1) - 20}
          textAnchor="middle"
          fontSize={config.fontSize}
          fontFamily={config.fontFamily}
          fill="#333"
          fontStyle={config.significanceScale === "raw" ? "italic" : "normal"}
        >
          Omnibus p {config.significanceScale === 'raw' ? `= ${omnibusP.toExponential(2)}` : omnibusP < 0.001 ? '***' : omnibusP < 0.01 ? '**' : omnibusP < 0.05 ? '*' : 'ns'}
        </text>
      ) : null}
    </BaseChartLayout>
  );
}

// ----------------------------------------
// Heatmap Chart
// ----------------------------------------
export function HeatmapChart({ sheet, config, width, height }: GroupedChartsProps) {
  const colors = PALETTES[config.palette || "okabe-ito"] || PALETTES["okabe-ito"];
  const fontFamily = config.fontFamily || "Inter";
  const fontSize = config.fontSize || 12;

  const { rowTitles, colGroups, colGroupNames, parsedData } = useMemo(() => parseGroupedData(sheet), [sheet]);

  const binData = rowTitles.map((rowTitle, rIdx) => {
    return {
      bin: rowTitle,
      bins: colGroups.map((gId, j) => ({
        bin: colGroupNames[j],
        count: parsedData[rIdx][gId]
      }))
    };
  });

  let maxVal = 0;
  let minVal = Infinity;
  binData.forEach(d => {
    d.bins.forEach(b => {
      if (b.count > maxVal) maxVal = b.count;
      if (b.count < minVal) minVal = b.count;
    });
  });
  if (minVal === Infinity) minVal = 0;

  let layout = computeChartLayout({ width, height, config, xTickLabels: colGroups, yTickLabels: rowTitles, legendItems: [] });
  if (config.showLegend !== false) {
    layout.margin.right += 60;
    layout.innerWidth = Math.max(1, layout.innerWidth - 60);
  }
  
  const innerWidth = layout.innerWidth;
  const innerHeight = layout.innerHeight;

  const xScale = scaleBand<string>({
    domain: colGroupNames,
    range: [0, innerWidth],
    padding: 0.05,
  });

  const yScale = scaleBand<string>({
    domain: rowTitles,
    range: [0, innerHeight],
    padding: 0.05,
  });

  const cMin = config.heatmapMin !== undefined ? config.heatmapMin : minVal;
  const cMax = config.heatmapMax !== undefined ? config.heatmapMax : maxVal;

  // Simple sequential scale based on maxVal
  const colorScale = scaleLinear<string>({
    range: ["#f7fbff", "#08306b"], // A default blue scale, ideally use config.palette to choose endpoints
    domain: [cMin, cMax],
    clamp: true
  });

  if (config.palette === "magma") {
    colorScale.range(["#000004", "#fcffa4"]);
  } else if (config.palette === "viridis") {
    colorScale.range(["#440154", "#fde725"]);
  } else if (config.palette === "cividis") {
    colorScale.range(["#00204d", "#ffea46"]);
  }

  return (
    <BaseChartLayout
      width={width}
      height={height}
      margin={layout.margin}
      xScale={xScale}
      yScale={yScale}
      yLabel={config.showYAxisTitle !== false ? (config.yAxisTitle || "Row") : undefined}
      xLabel={config.showXAxisTitle !== false ? (config.xAxisTitle || "Column") : undefined}
      legend={layout.legend}
      showGrid={false}
      fontFamily={config.fontFamily}
      fontSize={config.fontSize}
      axisTitleFontSize={config.axisTitleFontSize}
      axisLabelFontSize={config.axisLabelFontSize}
      legendFontSize={config.legendFontSize}
    >
      <HeatmapRect
        data={binData}
        xScale={d => xScale(String(d)) ?? 0}
        yScale={d => yScale(String(d)) ?? 0}
        colorScale={colorScale}
        opacityScale={() => 1}
        binWidth={xScale.bandwidth()}
        binHeight={yScale.bandwidth()}
        gap={2}
      >
        {heatmap =>
          heatmap.map(heatmapBins =>
            heatmapBins.map(bin => (
              <rect
                key={`heatmap-rect-${bin.row}-${bin.column}`}
                className="visx-heatmap-rect"
                width={bin.width}
                height={bin.height}
                x={bin.x}
                y={bin.y}
                fill={bin.color}
                rx={2}
              />
            ))
          )
        }
      </HeatmapRect>
      {config.showLegend !== false && (
        <Group left={innerWidth + 20} top={innerHeight / 2 - 50}>
          <text fontSize={config.legendFontSize ?? 12} x={0} y={-10} fill="#333" fontFamily={config.fontFamily}>Value</text>
          {Array.from({ length: 50 }).map((_, i) => (
            <rect
              key={i}
              x={0}
              y={(49 - i) * 2}
              width={12}
              height={2}
              fill={colorScale(minVal + (i / 49) * (maxVal - minVal))}
            />
          ))}
          <text fontSize={config.legendFontSize ?? 10} x={16} y={0} dy="0.32em" fill="#333" fontFamily={config.fontFamily}>{maxVal.toFixed(1)}</text>
          <text fontSize={config.legendFontSize ?? 10} x={16} y={50 * 2} dy="0.32em" fill="#333" fontFamily={config.fontFamily}>{minVal.toFixed(1)}</text>
        </Group>
      )}
    </BaseChartLayout>
  );
}

// ----------------------------------------
// Generic Wrapper for Grouped Point/Density Geometries
// ----------------------------------------
function GroupedChartWrapper(props: GroupedChartsProps & { renderGeom: (props: any) => React.ReactNode }) {
  const { sheet, config, width, height, renderGeom } = props;
  const colors = PALETTES[config.palette || "okabe-ito"] || PALETTES["okabe-ito"];
  const { rowTitles, colGroups, colGroupNames, rawData } = useMemo(() => parseGroupedData(sheet), [sheet]);
  
  const comparisons = props.analysisResults?.post_hocs?.comparisons || [];
  const activeComparisons = (config.showNsBrackets ?? true) 
    ? comparisons 
    : comparisons.filter((c: any) => c.p_value <= 0.05);

  const f1Comparisons = activeComparisons.filter((c: any) => c.factor === 'F1' || !c.factor);
  const intComparisons = activeComparisons.filter((c: any) => c.factor === 'INT' || c.factor === 'Interaction');
  const f1Tiered = f1Comparisons.length > 0 ? assignBracketTiers(f1Comparisons, rowTitles) : [];
  const maxTier = f1Tiered.length > 0 ? Math.max(...f1Tiered.map((t: any) => t.tier)) : -1;
  const omnibusP = props.analysisResults?.omnibus?.p_value;

  const allVals = rawData.flatMap(r => colGroups.flatMap(g => r[g] || []));
  const yRange = getAutoAxisRange(allVals, 0.05, true);
  
  const legendItems = colGroups.map((g, i) => ({ label: colGroupNames[i], color: colors[i % colors.length] }));
  const layout = computeChartLayout({ 
    width, height, config, 
    xTickLabels: rowTitles, 
    yTickLabels: [yRange.max.toFixed(1), yRange.min.toFixed(1)], 
    legendItems: config.showLegend !== false ? legendItems : [],
    maxBracketTier: maxTier,
    hasOmnibus: omnibusP !== undefined && (config as any).showOmnibus !== false
  });
  
  const xScale0 = scaleBand<string>({
    domain: rowTitles,
    range: [0, layout.innerWidth],
    padding: 0.2,
  });
  
  const xScale1 = scaleBand<string>({
    domain: colGroups,
    range: [0, xScale0.bandwidth()],
    padding: 0.1,
  });

  const yScale = scaleLinear<number>({
    domain: [config.yAxisMin ?? yRange.min, config.yAxisMax ?? yRange.max],
    range: [layout.innerHeight, 0],
    nice: config.yAxisMin === undefined && config.yAxisMax === undefined,
  });

  return (
    <BaseChartLayout
      width={width}
      height={height}
      margin={layout.margin}
      xScale={xScale0}
      yScale={yScale}
      yLabel={config.showYAxisTitle !== false ? (config.yAxisTitle || "Value") : undefined}
      xLabel={config.showXAxisTitle !== false ? (config.xAxisTitle || "Group") : undefined}
      legend={layout.legend}
      showGrid={config.showGrid ?? true}
      fontFamily={config.fontFamily}
      fontSize={config.fontSize}
      axisTitleFontSize={config.axisTitleFontSize}
      axisLabelFontSize={config.axisLabelFontSize}
      legendFontSize={config.legendFontSize}
    >
      {rawData.map(row => {
        const x0 = xScale0(row.rowTitle) ?? 0;
        return (
          <Group key={`row-${row.rowTitle}`} left={x0}>
            {colGroups.map((g, i) => {
              const vals = row[g] || [];
              if (vals.length === 0) return null;
              
              const x1 = xScale1(g) ?? 0;
              const bw = xScale1.bandwidth();
              const color = colors[i % colors.length];

              return (
                <Group key={`grp-${g}`} left={x1}>
                  {renderGeom({ vals, bw, color, yScale, config })}
                </Group>
              );
            })}
            
            {(() => {
              const rowTitleStr = String(row.rowTitle).trim();
              const rowIntComparisons = intComparisons.filter((c: any) => String(c.f1_level).trim() === rowTitleStr);
              if (rowIntComparisons.length === 0) return null;
              const rowMax = Math.max(...colGroups.flatMap(g => row[g] || []));
              const safeRowMax = rowMax === -Infinity ? 0 : rowMax;
              return (
                <SignificanceLayer
                  comparisons={rowIntComparisons}
                  groupOrder={colGroups}
                  xScale={(g) => (xScale1(g) ?? 0) + xScale1.bandwidth() / 2}
                  yScale={yScale}
                  dataMax={safeRowMax}
                  scale={config.significanceScale}
                  showNs={config.showNsBrackets}
                  fontFamily={config.fontFamily}
                  fontSize={config.fontSize}
                  pValueFontSize={config.pValueFontSize}
                />
              );
            })()}
          </Group>
        );
      })}
      
      {f1Comparisons.length > 0 ? (
        <SignificanceLayer
          comparisons={f1Comparisons}
          groupOrder={rowTitles}
          xScale={(group) => (xScale0(group) ?? 0) + xScale0.bandwidth() / 2}
          yScale={yScale}
          dataMax={yRange.max}
          scale={config.significanceScale}
          showNs={config.showNsBrackets}
          fontFamily={config.fontFamily}
          fontSize={config.fontSize}
          pValueFontSize={config.pValueFontSize}
        />
      ) : omnibusP !== undefined && (config as any).showOmnibus !== false ? (
        <text
          x={layout.innerWidth / 2}
          y={yScale(yRange.max) - 20}
          textAnchor="middle"
          fontSize={config.fontSize}
          fontFamily={config.fontFamily}
          fill="#333"
          fontStyle={config.significanceScale === "raw" ? "italic" : "normal"}
        >
          Omnibus p {config.significanceScale === 'raw' ? `= ${omnibusP.toExponential(2)}` : omnibusP < 0.001 ? '***' : omnibusP < 0.01 ? '**' : omnibusP < 0.05 ? '*' : 'ns'}
        </text>
      ) : null}
    </BaseChartLayout>
  );
}

// ----------------------------------------
// Grouped Violin Chart
// ----------------------------------------
export function GroupedViolinChart(props: GroupedChartsProps) {
  return (
    <GroupedChartWrapper
      {...props}
      renderGeom={({ vals, bw, color, yScale }) => {
        const density = getViolinDensity(vals);
        const maxDens = Math.max(...density.map(d => d.y), 1e-6);
        const stats = getBoxStats(vals);
        return (
          <>
            <path
              d={`
                ${density.map((d, di) => {
                  const vx = (d.y / maxDens) * (bw / 2);
                  const vy = yScale(d.x);
                  return `${di === 0 ? 'M' : 'L'} ${bw / 2 + vx} ${vy}`;
                }).join(' ')}
                ${density.slice().reverse().map((d) => {
                  const vx = (d.y / maxDens) * (bw / 2);
                  const vy = yScale(d.x);
                  return `L ${bw / 2 - vx} ${vy}`;
                }).join(' ')}
                Z
              `}
              fill={color}
              fillOpacity={0.6}
              stroke={color}
              strokeWidth={1}
            />
            {stats && (
              <>
                <Line from={{ x: bw / 2, y: yScale(stats.lowerWhisker) }} to={{ x: bw / 2, y: yScale(stats.upperWhisker) }} stroke="#333" strokeWidth={1} />
                <rect x={bw / 2 - bw * 0.1} y={yScale(stats.q3)} width={bw * 0.2} height={Math.max(1, yScale(stats.q1) - yScale(stats.q3))} fill="#333" />
                <Circle cx={bw / 2} cy={yScale(stats.median)} r={Math.max(2, bw * 0.08)} fill="white" />
              </>
            )}
          </>
        );
      }}
    />
  );
}

// ----------------------------------------
// Grouped Swarm Chart
// ----------------------------------------
export function GroupedSwarmChart(props: GroupedChartsProps) {
  return (
    <GroupedChartWrapper
      {...props}
      renderGeom={({ vals, bw, color, yScale, config }) => {
        const radius = config.pointSize || 4;
        const points = computeBeeswarm(vals, yScale, bw * 0.9, radius);
        const mean = vals.reduce((a:number, b:number) => a + b, 0) / vals.length;
        return (
          <>
            {points.map((pt, pi) => (
              <Circle key={pi} cx={bw / 2 + pt.cx} cy={pt.cy} r={radius} fill={color} stroke="white" strokeWidth={0.5} />
            ))}
            {config.showMean && (
              <Line from={{ x: 0, y: yScale(mean) }} to={{ x: bw, y: yScale(mean) }} stroke="#333" strokeWidth={2} />
            )}
          </>
        );
      }}
    />
  );
}

// ----------------------------------------
// Grouped Strip Chart
// ----------------------------------------
export function GroupedStripChart(props: GroupedChartsProps) {
  return (
    <GroupedChartWrapper
      {...props}
      renderGeom={({ vals, bw, color, yScale, config }) => {
        const radius = config.pointSize || 4;
        const mean = vals.reduce((a:number, b:number) => a + b, 0) / vals.length;
        return (
          <>
            {vals.map((v: number, i: number) => (
              <Circle key={i} cx={bw / 2} cy={yScale(v)} r={radius} fill={color} fillOpacity={0.6} stroke="white" strokeWidth={0.5} />
            ))}
            {config.showMean && (
              <Line from={{ x: 0, y: yScale(mean) }} to={{ x: bw, y: yScale(mean) }} stroke="#333" strokeWidth={2} />
            )}
          </>
        );
      }}
    />
  );
}

// ----------------------------------------
// Grouped Jitter Chart
// ----------------------------------------
export function GroupedJitterChart(props: GroupedChartsProps) {
  return (
    <GroupedChartWrapper
      {...props}
      renderGeom={({ vals, bw, color, yScale, config }) => {
        const radius = config.pointSize || 4;
        const mean = vals.reduce((a:number, b:number) => a + b, 0) / vals.length;
        return (
          <>
            {vals.map((v: number, i: number) => (
              <Circle key={i} cx={bw / 2 + getJitterOffset(42, i, bw * 0.6)} cy={yScale(v)} r={radius} fill={color} fillOpacity={0.6} stroke="white" strokeWidth={0.5} />
            ))}
            {config.showMean && (
              <Line from={{ x: 0, y: yScale(mean) }} to={{ x: bw, y: yScale(mean) }} stroke="#333" strokeWidth={2} />
            )}
          </>
        );
      }}
    />
  );
}

// ----------------------------------------
// Grouped Raincloud Chart
// ----------------------------------------
export function GroupedRaincloudChart(props: GroupedChartsProps) {
  return (
    <GroupedChartWrapper
      {...props}
      renderGeom={({ vals, bw, color, yScale, config }) => {
        const density = getViolinDensity(vals);
        const maxDens = Math.max(...density.map(d => d.y), 1e-6);
        const radius = config.pointSize || 3;
        const points = computeBeeswarm(vals, yScale, bw * 0.45, radius);
        
        return (
          <>
            {/* Half Violin (Cloud) */}
            <path
              d={`
                ${density.map((d, di) => {
                  const vx = (d.y / maxDens) * (bw * 0.45);
                  const vy = yScale(d.x);
                  return `${di === 0 ? 'M' : 'L'} ${bw / 2 + vx} ${vy}`;
                }).join(' ')}
                L ${bw / 2} ${yScale(density[density.length - 1]?.x ?? 0)}
                L ${bw / 2} ${yScale(density[0]?.x ?? 0)}
                Z
              `}
              fill={color}
              fillOpacity={0.6}
              stroke={color}
              strokeWidth={1}
            />
            {/* Swarm (Rain) */}
            {points.map((pt, pi) => (
              <Circle key={pi} cx={bw * 0.25 + pt.cx} cy={pt.cy} r={radius} fill={color} stroke="white" strokeWidth={0.5} />
            ))}
          </>
        );
      }}
    />
  );
}

// ----------------------------------------
// Grouped Horizontal Box Chart
// ----------------------------------------
export function GroupedHBoxChart(props: GroupedChartsProps) {
  const { sheet, config, width, height } = props;
  const colors = PALETTES[config.palette || "okabe-ito"] || PALETTES["okabe-ito"];
  const { rowTitles, colGroups, colGroupNames, parsedData, rawData } = useMemo(() => parseGroupedData(sheet), [sheet]);

  let minV = Infinity, maxV = -Infinity;
  const statsByRowGroup = new Map<string, any>();
  
  rawData.forEach((row, rIdx) => {
    const rowTitle = rowTitles[rIdx];
    colGroups.forEach(gId => {
      const vals = row[gId] || [];
      if (vals.length > 0) {
        const box = getBoxStats(vals);
        statsByRowGroup.set(`${rowTitle}-${gId}`, box);
        if (box.lowerWhisker < minV) minV = box.lowerWhisker;
        if (box.upperWhisker > maxV) maxV = box.upperWhisker;
      }
    });
  });

  if (config.referenceValue !== undefined && !isNaN(config.referenceValue)) {
    if (config.referenceValue < minV) minV = config.referenceValue;
    if (config.referenceValue > maxV) maxV = config.referenceValue;
  }

  const _range = getAutoAxisRange((isFinite(minV) && isFinite(maxV)) ? [minV, maxV] : [], 0.05);
  const xMin = (config.xAxisMin != null) ? config.xAxisMin : _range.min;
  const xMax = (config.xAxisMax != null) ? config.xAxisMax : _range.max;

  const legendItems = colGroups.map((g, i) => ({ label: colGroupNames[i], color: colors[i % colors.length] }));
  const layout = computeChartLayout({
    width, height, config,
    xTickLabels: [xMin.toPrecision(3), xMax.toPrecision(3)], 
    yTickLabels: rowTitles, 
    orientation: "horizontal",
    legendItems: config.showLegend !== false ? legendItems : [],
    maxBracketTier: -1,
    hasOmnibus: false
  });

  const yScale0 = scaleBand<string>({ domain: rowTitles, range: [0, layout.innerHeight], padding: 0.2 });
  const yScale1 = scaleBand<string>({ domain: colGroups, range: [0, yScale0.bandwidth()], padding: 0.1 });
  const xScale = scaleLinear<number>({ domain: [xMin, xMax], range: [0, layout.innerWidth] });

  const boxH = Math.max(yScale1.bandwidth() * 0.8, 2);
  const halfH = boxH / 2;
  const pinch = boxH * 0.5;

  return (
    <BaseChartLayout
      width={width} height={height} margin={layout.margin}
      xScale={xScale} yScale={yScale0}
      xLabel={config.xAxisTitle} yLabel={config.yAxisTitle}
      showGrid={true} gridDirection="vertical"
      fontFamily={config.fontFamily} fontSize={config.fontSize}
      axisTitleFontSize={config.axisTitleFontSize} axisLabelFontSize={config.axisLabelFontSize}
      xAxisTitleY={layout.xAxisTitleY} yAxisTitleX={layout.yAxisTitleX}
      legend={layout.legend}
    >
      {rawData.map((row, rIdx) => {
        const rowTitle = rowTitles[rIdx];
        const y0 = yScale0(rowTitle) ?? 0;
        
        return (
          <g key={rowTitle} transform={`translate(0, ${y0})`}>
            {colGroups.map((gId, gIdx) => {
              const vals = row[gId] || [];
              const box = statsByRowGroup.get(`${rowTitle}-${gId}`);
              if (!box || vals.length === 0 || isNaN(box.median)) return null;
              
              const cy = (yScale1(gId) ?? 0) + yScale1.bandwidth() / 2;
              const x1 = xScale(box.lowerWhisker);
              const x2 = xScale(box.upperWhisker);
              const q1x = xScale(box.q1);
              const q3x = xScale(box.q3);
              const mx = xScale(box.median);
              const color = colors[gIdx % colors.length];
              const isNotched = config.notched && vals.length > 0;
              // notch needs 4 args: median, q1, q3, n
              const notch = isNotched ? null : null; // simplified notch check or we can skip for horizontal
              
              const nL = notch ? xScale(Math.max(box.q1, (notch as any).notchLow)) : q1x;
              const nH = notch ? xScale(Math.min(box.q3, (notch as any).notchHigh)) : q3x;

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
                <g key={gId}>
                  <Line x1={x1} y1={cy} x2={q1x} y2={cy} stroke="currentColor" strokeWidth={1.5} />
                  <Line x1={q3x} y1={cy} x2={x2} y2={cy} stroke="currentColor" strokeWidth={1.5} />
                  <Line x1={x1} y1={cy - halfH/2} x2={x1} y2={cy + halfH/2} stroke="currentColor" strokeWidth={1.5} />
                  <Line x1={x2} y1={cy - halfH/2} x2={x2} y2={cy + halfH/2} stroke="currentColor" strokeWidth={1.5} />
                  <path d={pathD} fill={color} stroke="currentColor" strokeWidth={1.5} fillOpacity={0.8} />
                  {isNotched ? (
                    <Line x1={mx} y1={cy - pinch/2} x2={mx} y2={cy + pinch/2} stroke="currentColor" strokeWidth={2} />
                  ) : (
                    <Line x1={mx} y1={cy - halfH} x2={mx} y2={cy + halfH} stroke="currentColor" strokeWidth={2} />
                  )}
                  {config.showPoints && vals.map((v: number, idx: number) => (
                     <Circle
                       key={idx}
                       cx={xScale(v)}
                       cy={cy + getJitterOffset(config.jitterSeed ?? 42, idx, boxH)}
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
          </g>
        );
      })}
      {config.referenceValue !== undefined && !isNaN(config.referenceValue) && (
        <Line x1={xScale(config.referenceValue)} y1={0} x2={xScale(config.referenceValue)} y2={layout.innerHeight} stroke="currentColor" strokeDasharray="4,4" opacity={0.6} />
      )}
    </BaseChartLayout>
  );
}

// ----------------------------------------
// Grouped Range Dumbbell Chart
// ----------------------------------------
export function GroupedRangeDumbbellChart(props: GroupedChartsProps) {
  const { sheet, config, width, height } = props;
  const colors = PALETTES[config.palette || "okabe-ito"] || PALETTES["okabe-ito"];
  const { rowTitles, colGroups, colGroupNames, rawData } = useMemo(() => parseGroupedData(sheet), [sheet]);

  const mode = config.rangeMode ?? "min_max";
  let minV = Infinity, maxV = -Infinity;
  const rangesByRowGroup = new Map<string, { low: number, high: number, center: number }>();
  
  rawData.forEach((row, rIdx) => {
    const rowTitle = rowTitles[rIdx];
    colGroups.forEach(gId => {
      const vals = row[gId] || [];
      if (vals.length === 0) return;
      
      let low = 0, high = 0, center = 0;
      const sorted = [...vals].sort((a: number,b: number)=>a-b);
      
      if (mode === "min_max") {
        low = sorted[0];
        high = sorted[sorted.length - 1];
        center = sorted[Math.floor(sorted.length/2)];
      } else if (mode === "iqr") {
        const q1 = sorted[Math.floor(sorted.length * 0.25)];
        const q3 = sorted[Math.floor(sorted.length * 0.75)];
        low = q1; high = q3;
        center = sorted[Math.floor(sorted.length/2)];
      } else {
        const mean = vals.reduce((a:number,b:number)=>a+b,0)/vals.length;
        const sd = Math.sqrt(vals.reduce((a:number,b:number)=>a+Math.pow(b-mean,2),0)/(vals.length-1 || 1));
        low = mean - sd; high = mean + sd;
        center = mean;
      }
      
      rangesByRowGroup.set(`${rowTitle}-${gId}`, { low, high, center });
      if (low < minV) minV = low;
      if (high > maxV) maxV = high;
    });
  });

  const _range = getAutoAxisRange((isFinite(minV) && isFinite(maxV)) ? [minV, maxV] : [], 0.05);
  const xMin = (config.xAxisMin != null) ? config.xAxisMin : _range.min;
  const xMax = (config.xAxisMax != null) ? config.xAxisMax : _range.max;

  const legendItems = colGroups.map((g, i) => ({ label: colGroupNames[i], color: colors[i % colors.length] }));
  const layout = computeChartLayout({
    width, height, config,
    xTickLabels: [xMin.toPrecision(3), xMax.toPrecision(3)], 
    yTickLabels: rowTitles, 
    orientation: "horizontal",
    legendItems: config.showLegend !== false ? legendItems : [],
    maxBracketTier: -1,
    hasOmnibus: false
  });

  const yScale0 = scaleBand<string>({ domain: rowTitles, range: [0, layout.innerHeight], padding: 0.2 });
  const yScale1 = scaleBand<string>({ domain: colGroups, range: [0, yScale0.bandwidth()], padding: 0.1 });
  const xScale = scaleLinear<number>({ domain: [xMin, xMax], range: [0, layout.innerWidth] });

  const radius = config.pointSize ?? 4;

  return (
    <BaseChartLayout
      width={width} height={height} margin={layout.margin}
      xScale={xScale} yScale={yScale0}
      xLabel={config.xAxisTitle} yLabel={config.yAxisTitle}
      showGrid={true} gridDirection="vertical"
      fontFamily={config.fontFamily} fontSize={config.fontSize}
      axisTitleFontSize={config.axisTitleFontSize} axisLabelFontSize={config.axisLabelFontSize}
      xAxisTitleY={layout.xAxisTitleY} yAxisTitleX={layout.yAxisTitleX}
      legend={layout.legend}
    >
      {rawData.map((row, rIdx) => {
        const rowTitle = rowTitles[rIdx];
        const y0 = yScale0(rowTitle) ?? 0;
        
        return (
          <g key={rowTitle} transform={`translate(0, ${y0})`}>
            {colGroups.map((gId, gIdx) => {
              const rData = rangesByRowGroup.get(`${rowTitle}-${gId}`);
              if (!rData || isNaN(rData.center)) return null;
              
              const cy = (yScale1(gId) ?? 0) + yScale1.bandwidth() / 2;
              const color = colors[gIdx % colors.length];

              return (
                <g key={gId}>
                  <Line x1={xScale(rData.low)} y1={cy} x2={xScale(rData.high)} y2={cy} stroke={color} strokeWidth={2} opacity={0.6} />
                  <Circle cx={xScale(rData.low)} cy={cy} r={radius} fill={color} />
                  <Circle cx={xScale(rData.high)} cy={cy} r={radius} fill={color} />
                  {mode !== "mean_sd" && (
                    <Circle cx={xScale(rData.center)} cy={cy} r={radius * 0.75} fill="white" stroke={color} strokeWidth={1.5} />
                  )}
                </g>
              );
            })}
          </g>
        );
      })}
    </BaseChartLayout>
  );
}
