import React from "react";
import { Group } from "@visx/group";
import { AxisLeft, AxisBottom } from "@visx/axis";
import { GridRows, GridColumns } from "@visx/grid";

interface Margin {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

interface BaseChartLayoutProps {
  width: number;
  height: number;
  margin: Margin;
  xScale: any;
  yScale: any;
  children: React.ReactNode;
  showGrid?: boolean;
  gridDirection?: "horizontal" | "vertical";
  yLabel?: string;
  xLabel?: string;
  yTickValues?: number[];
  fontFamily?: string;
  fontSize?: number;
  axisTitleFontSize?: number;
  axisLabelFontSize?: number;
  legendFontSize?: number;
  xAxisTitleY?: number;
  yAxisTitleX?: number;
  legend?: {
    rows: { y: number; items: { label: string; color: string; x: number; width: number }[] }[];
    height: number;
    y: number;
  } | null;
}

/**
 * Base chart layout providing margins, axes, and optional gridlines.
 * Designed to be composed with specific chart types (Bar, Scatter, etc.)
 */
export function BaseChartLayout({
  width,
  height,
  margin,
  xScale,
  yScale,
  children,
  showGrid = true,
  gridDirection = "horizontal",
  yLabel,
  xLabel,
  yTickValues,
  fontFamily = "Inter",
  fontSize = 12,
  axisTitleFontSize,
  axisLabelFontSize,
  legendFontSize,
  xAxisTitleY,
  yAxisTitleX,
  legend
}: BaseChartLayoutProps) {
  const tickFontSize = axisLabelFontSize || fontSize;
  const titleFontSize = axisTitleFontSize || fontSize + 2;
  const innerWidth = width - margin.left - margin.right;
  const innerHeight = height - margin.top - margin.bottom;

  const tickFormat = (v: any) => {
    if (typeof v === 'number') {
      if (v === 0) return "0";
      if (Math.abs(v) > 1e4 || Math.abs(v) < 1e-3) return v.toExponential(1);
      return v.toString();
    }
    return v;
  };

  return (
    <Group left={margin.left} top={margin.top}>
      {showGrid && gridDirection === "horizontal" && (
        <GridRows
          scale={yScale}
          width={innerWidth}
          height={innerHeight}
          stroke="#e0e0e0"
          strokeOpacity={0.5}
        />
      )}
      {showGrid && gridDirection === "vertical" && (
        <GridColumns
          scale={xScale}
          width={innerWidth}
          height={innerHeight}
          stroke="#e0e0e0"
          strokeOpacity={0.5}
        />
      )}

      {children}

      <AxisLeft
        scale={yScale}
        stroke="#333"
        tickStroke="#333"
        tickValues={yTickValues}
        tickFormat={tickFormat}
        tickLabelProps={() => ({
          fill: '#333',
          fontSize: tickFontSize,
          fontFamily: fontFamily,
          textAnchor: 'end',
          dy: '0.33em',
          dx: '-0.25em',
        })}
        label={yLabel}
        labelOffset={yAxisTitleX ?? 48}
        labelProps={{
          fill: '#333',
          fontSize: titleFontSize,
          fontFamily: fontFamily,
          textAnchor: 'middle',
        }}
      />
      
      <AxisBottom
        top={innerHeight}
        scale={xScale}
        stroke="#333"
        tickStroke="#333"
        tickLabelProps={() => ({
          fill: '#333',
          fontSize: tickFontSize,
          fontFamily: fontFamily,
          textAnchor: 'middle',
          dy: '0.25em',
        })}
        label={xLabel}
        labelOffset={xAxisTitleY ?? 40}
        labelProps={{
          fill: '#333',
          fontSize: titleFontSize,
          fontFamily: fontFamily,
          textAnchor: 'middle',
        }}
      />

      {legend && (
        <Group top={innerHeight + legend.y} left={0}>
          {legend.rows.map((row, rIdx) => (
            <Group key={`row-${rIdx}`} top={row.y} left={0}>
              {row.items.map((item) => (
                <Group key={item.label} left={item.x}>
                  <rect width={12} height={12} fill={item.color} y={-6} rx={2} />
                  <text x={18} y={4} fontSize={legendFontSize ?? fontSize} fontFamily={fontFamily} fill="#333">
                    {item.label}
                  </text>
                </Group>
              ))}
            </Group>
          ))}
        </Group>
      )}
    </Group>
  );
}
