import { useRef, useState } from "react"
import type { Graph, DataSheet } from "@/types/workbook"
import { useTooltipInPortal } from "@visx/tooltip";
import { ParentSize } from "@visx/responsive";
import { BarErrorChart, BoxChart, ViolinChart, RaincloudChart, ScatterChart, StripChart, JitterChart, SwarmChart } from "./ColumnCharts";
import { HBoxChart, RangeDumbbellChart, CIForestChart } from "./HorizontalCategoryChart";
import { XYScatterChart } from "./XYCharts";
import { SurvivalChart } from "./SurvivalChart";
import { exportPNG, exportSVG } from "@/lib/exportGraph";
import { Download } from "lucide-react";

interface GraphEngineProps {
  graph: Graph;
  sheet: DataSheet;
  analysisResults?: any;
}

export function GraphEngine({ graph, sheet, analysisResults }: GraphEngineProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const { containerRef } = useTooltipInPortal({ scroll: true, detectBounds: true });

  const safeFilename = `${(graph.name || graph.chartType).replace(/[^a-z0-9]/gi, '_').toLowerCase()}_graph`;

  const handleExportPNG = () => {
    if (!svgRef.current) return;
    exportPNG(svgRef.current, {
      background: graph.config.background as any,
      fontFamily: graph.config.fontFamily,
      filename: `${safeFilename}.png`
    });
  };

  const handleExportSVG = () => {
    if (!svgRef.current) return;
    exportSVG(svgRef.current, {
      background: graph.config.background as any,
      fontFamily: graph.config.fontFamily,
      filename: `${safeFilename}.svg`
    });
  };

  const getCaptionText = () => {
    if (!analysisResults || !analysisResults.test_id) return null;
    const testId = analysisResults.test_id;
    let caption = `${testId}`;
    if (analysisResults.overall_p !== undefined) {
      caption += `: p=${Number(analysisResults.overall_p).toPrecision(3)}`;
    }
    
    if (analysisResults.post_hocs && analysisResults.post_hocs.method && analysisResults.post_hocs.method !== "None") {
      let method = analysisResults.post_hocs.method;
      if (method.includes("Dunnett") && analysisResults.post_hocs.control_group) {
        method += ` vs ${analysisResults.post_hocs.control_group}`;
      }
      caption += `. Post-hoc (${method}): `;
      
      const sigComps = (analysisResults.post_hocs.comparisons || []).filter((c: any) => c.p_value < 0.05);
      if (sigComps.length === 0) {
        caption += "No significant pairwise differences.";
      } else {
        caption += sigComps.map((c: any) => `${c.group1} vs ${c.group2} p=${Number(c.p_value).toPrecision(3)}`).join(", ");
      }
    }
    return caption;
  };

  const captionText = getCaptionText();

  return (
    <div className="relative border rounded-md p-4 bg-background shadow-sm flex flex-col h-full w-full" ref={containerRef}>
      <div className="flex justify-between items-center mb-4 flex-shrink-0 gap-2">
        <h3 className="font-semibold text-lg flex-1">{graph.name || graph.chartType}</h3>
        <button onClick={handleExportSVG} className="px-3 py-1 bg-secondary text-secondary-foreground text-sm rounded-md hover:bg-secondary/80">
          Export SVG
        </button>
        <button onClick={handleExportPNG} className="px-3 py-1 bg-primary text-primary-foreground text-sm rounded-md hover:bg-primary/90">
          Export PNG
        </button>
      </div>
      
      <div className="flex-1 min-h-0 min-w-0 w-full relative">
        <ParentSize parentSizeStyles={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center" }}>
          {({ width: rawWidth, height: rawHeight }) => {
            // Chart rendering workspace reduced to 75% of the available area (25% smaller).
            const width = Math.max(rawWidth * 0.75, 1);
            const height = Math.max(rawHeight * 0.75, 1);
            return (
            <svg ref={svgRef} width={width} height={height} style={{ background: graph.config.background === "white" ? "white" : "transparent" }}>
              {graph.chartType === "bar-error" && (
                <BarErrorChart 
                  sheet={sheet} 
                  analysisResults={analysisResults} 
                  config={graph.config} 
                  width={width} 
                  height={height} 
                />
              )}
              {graph.chartType === "box" && (
                <BoxChart 
                  sheet={sheet} 
                  analysisResults={analysisResults} 
                  config={graph.config} 
                  width={width} 
                  height={height} 
                />
              )}
              {graph.chartType === "violin" && (
                <ViolinChart 
                  sheet={sheet} 
                  analysisResults={analysisResults} 
                  config={graph.config} 
                  width={width} 
                  height={height} 
                />
              )}
              {graph.chartType === "raincloud" && (
                <RaincloudChart 
                  sheet={sheet} 
                  analysisResults={analysisResults} 
                  config={graph.config} 
                  width={width} 
                  height={height} 
                />
              )}

              {graph.chartType === "scatter" && sheet.config.type === "XY" && (
                <XYScatterChart 
                  sheet={sheet} 
                  analysisResults={analysisResults} 
                  config={graph.config} 
                  width={width} 
                  height={height} 
                />
              )}

              {graph.chartType === "scatter" && sheet.config.type !== "XY" && (
                <ScatterChart 
                  sheet={sheet} 
                  analysisResults={analysisResults} 
                  config={graph.config} 
                  width={width} 
                  height={height} 
                />
              )}

              {graph.chartType === "strip" && (
                <StripChart sheet={sheet} analysisResults={analysisResults} config={graph.config} width={width} height={height} />
              )}
              {graph.chartType === "jitter" && (
                <JitterChart sheet={sheet} analysisResults={analysisResults} config={graph.config} width={width} height={height} />
              )}
              {graph.chartType === "swarm" && (
                <SwarmChart sheet={sheet} analysisResults={analysisResults} config={graph.config} width={width} height={height} />
              )}
              {graph.chartType === "h-box" && (
                <HBoxChart sheet={sheet} analysisResults={analysisResults} config={graph.config} width={width} height={height} />
              )}
              {graph.chartType === "range-dumbbell" && (
                <RangeDumbbellChart sheet={sheet} analysisResults={analysisResults} config={graph.config} width={width} height={height} />
              )}

              {graph.chartType === "ci-forest" && (
                <CIForestChart sheet={sheet} analysisResults={analysisResults} config={graph.config} width={width} height={height} />
              )}
              {graph.chartType === "km-step" && (
                <SurvivalChart sheet={sheet} config={graph.config} width={width} height={height} />
              )}

              {graph.chartType !== "bar-error" && graph.chartType !== "box" && graph.chartType !== "violin" && graph.chartType !== "raincloud" && graph.chartType !== "scatter" && graph.chartType !== "strip" && graph.chartType !== "jitter" && graph.chartType !== "swarm" && graph.chartType !== "h-box" && graph.chartType !== "range-dumbbell" && graph.chartType !== "ci-forest" && graph.chartType !== "km-step" && (
                <text x={width/2} y={height/2} textAnchor="middle" fill="#666">
                  {graph.chartType} not implemented yet
                </text>
              )}
              {captionText && (graph.config.showPostHocCaption ?? true) && (
                <text 
                  x={10} 
                  y={height - 10} 
                  fontSize={12} 
                  fontFamily={graph.config.fontFamily} 
                  fill={graph.config.theme === 'dark' || (graph.config.theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches) ? "#aaa" : "#555"}
                  textAnchor="start"
                >
                  {captionText}
                </text>
              )}
            </svg>
            );
          }}
        </ParentSize>
      </div>
    </div>
  );
}
