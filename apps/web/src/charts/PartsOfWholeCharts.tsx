import React, { useMemo } from "react";
import { Pie } from "@visx/shape";
import { Group } from "@visx/group";
import { BaseChartLayout } from "./BaseChartLayout";
import { PALETTES } from "./ColumnCharts";
import type { DataSheet, GraphConfig } from "@/types/workbook";

export interface PartsOfWholeChartsProps {
  sheet: DataSheet;
  config: GraphConfig;
  width: number;
  height: number;
}

interface PieNode {
  label: string;
  value: number;
  color: string;
}

// Helper to compute luminance and return black or white for contrast
function getContrastColor(hexColor: string) {
  if (!hexColor.startsWith("#") || hexColor.length !== 7) return "#ffffff";
  const r = parseInt(hexColor.slice(1, 3), 16);
  const g = parseInt(hexColor.slice(3, 5), 16);
  const b = parseInt(hexColor.slice(5, 7), 16);
  const yiq = (r * 299 + g * 587 + b * 114) / 1000;
  return yiq >= 128 ? "#000000" : "#ffffff";
}

export function PieChart({ sheet, config, width, height }: PartsOfWholeChartsProps) {
  const margin = { top: 40, right: 40, bottom: 60, left: 60 };
  const innerWidth = width - margin.left - margin.right;
  const innerHeight = height - margin.top - margin.bottom;

  const radius = Math.min(innerWidth, innerHeight) / 2;
  const centerY = innerHeight / 2;
  const centerX = innerWidth / 2;
  
  const donutThickness = radius * 0.4;
  const innerRadius = config.pieDonutStyle === "donut" ? radius - donutThickness : 0;

  const colors = PALETTES[config.palette || "okabe-ito"] || PALETTES["okabe-ito"];

  const data = useMemo(() => {
    const nodes: PieNode[] = [];
    const aggregate = !config.pieDonutDataColumn || config.pieDonutDataColumn === "aggregate_all";
    
    sheet.data.forEach((row, i) => {
      let val = 0;
      if (aggregate) {
        for (const g of sheet.columnGroups) {
          const v = Number(row[g.id]);
          if (!isNaN(v)) val += v;
        }
      } else {
        const v = Number(row[config.pieDonutDataColumn!]);
        if (!isNaN(v)) val = v;
      }
      
      if (val > 0) {
        nodes.push({
          label: String(row.rowTitle || `Slice ${i + 1}`),
          value: val,
          color: colors[i % colors.length]
        });
      }
    });
    
    return nodes;
  }, [sheet, config.pieDonutDataColumn, colors]);

  const totalValue = useMemo(() => data.reduce((acc, d) => acc + d.value, 0), [data]);

  return (
    <BaseChartLayout
      width={width}
      height={height}
      margin={margin}
      xScale={undefined as any}
      yScale={undefined as any}
      showGrid={false}
      fontFamily={config.fontFamily}
      fontSize={config.fontSize}
      legend={null}
    >
      <Group top={centerY} left={centerX}>
        <Pie
          data={data}
          pieValue={d => d.value}
          outerRadius={radius}
          innerRadius={innerRadius}
          padAngle={0}
        >
          {pie => {
            return (
              <>
                {pie.arcs.map((arc, i) => (
                  <path key={`pie-arc-${i}`} d={pie.path(arc) ?? ""} fill={arc.data.color} />
                ))}
                {pie.arcs.map((arc, i) => {
                  const [centroidX, centroidY] = pie.path.centroid(arc);
                  const hasSpaceForLabel = arc.endAngle - arc.startAngle > 0.15;
                  if (!hasSpaceForLabel) return null;

                  const textColor = getContrastColor(arc.data.color);
                  const percent = ((arc.data.value / totalValue) * 100).toFixed(1);

                  return (
                    <g key={`pie-label-${i}`}>
                      <text
                        x={centroidX}
                        y={centroidY}
                        dy=".33em"
                        fill={textColor}
                        fontSize={config.fontSize ?? 12}
                        fontFamily={config.fontFamily}
                        fontWeight="bold"
                        textAnchor="middle"
                        pointerEvents="none"
                        stroke="#000000"
                        strokeWidth={2}
                        strokeLinejoin="round"
                        paintOrder="stroke"
                      >
                        {arc.data.label}
                      </text>
                      <text
                        x={centroidX}
                        y={centroidY + (config.fontSize ?? 12) + 2}
                        dy=".33em"
                        fill={textColor}
                        fontSize={(config.fontSize ?? 12) * 0.8}
                        fontFamily={config.fontFamily}
                        fontWeight="bold"
                        textAnchor="middle"
                        pointerEvents="none"
                        stroke="#000000"
                        strokeWidth={2}
                        strokeLinejoin="round"
                        paintOrder="stroke"
                      >
                        {percent}%
                      </text>
                    </g>
                  );
                })}
              </>
            );
          }}
        </Pie>
        {config.pieDonutStyle === "donut" && (
          <text
            x={0}
            y={0}
            textAnchor="middle"
            dy=".33em"
            fontSize={(config.fontSize ?? 12) * 1.5}
            fontWeight="bold"
            fontFamily={config.fontFamily}
            fill="#000000"
            pointerEvents="none"
          >
            Total: {totalValue % 1 === 0 ? totalValue : totalValue.toFixed(1)}
          </text>
        )}
      </Group>
    </BaseChartLayout>
  );
}
