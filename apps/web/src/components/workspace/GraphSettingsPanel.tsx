import React, { useState, useEffect } from "react";
import { Copy, ClipboardPaste } from "lucide-react";
import type { GraphConfig, Graph, Analysis } from "@/types/workbook";

interface GraphSettingsPanelProps {
  graph: Graph;
  analyses: Analysis[];
  onChangeConfig: (config: GraphConfig) => void;
  onChangeAnalysis?: (analysisId: string | undefined) => void;
  onChangeChartType?: (chartType: any) => void;
}

export function GraphSettingsPanel({ graph, analyses, onChangeConfig, onChangeAnalysis, onChangeChartType }: GraphSettingsPanelProps) {
  const config = graph.config;
  const chartType = graph.chartType;
  
  const [copiedFormat, setCopiedFormat] = useState<any>(null);

  useEffect(() => {
    const saved = sessionStorage.getItem("statlens_copied_format");
    if (saved) {
      try {
        setCopiedFormat(JSON.parse(saved));
      } catch (e) {}
    }
  }, []);

  const handleCopyFormat = () => {
    const formatToCopy = {
      fontSize: config.fontSize,
      axisTitleFontSize: config.axisTitleFontSize,
      axisLabelFontSize: config.axisLabelFontSize,
      pValueFontSize: config.pValueFontSize,
      legendFontSize: config.legendFontSize,
      equationFontSize: config.equationFontSize,
      pointSize: config.pointSize,
      fontFamily: config.fontFamily,
    };
    sessionStorage.setItem("statlens_copied_format", JSON.stringify(formatToCopy));
    setCopiedFormat(formatToCopy);
  };

  const handlePasteFormat = () => {
    if (copiedFormat) {
      onChangeConfig({ ...config, ...copiedFormat });
    }
  };
  
  const handleChange = (key: keyof GraphConfig, value: any) => {
    onChangeConfig({ ...config, [key]: value });
  };

  return (
    <div className="flex flex-col gap-4 p-4 border rounded-md bg-card">
      <div className="flex items-center justify-between border-b pb-2">
        <h3 className="font-semibold text-lg">Graph Settings</h3>
        <div className="flex gap-2">
          <button 
            onClick={handleCopyFormat}
            className="p-1.5 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
            title="Copy formatting (font sizes, font family, point size)"
          >
            <Copy size={16} />
          </button>
          <button 
            onClick={handlePasteFormat}
            disabled={!copiedFormat}
            className={`p-1.5 rounded-md transition-colors ${copiedFormat ? "hover:bg-muted text-foreground" : "opacity-50 cursor-not-allowed text-muted-foreground"}`}
            title="Paste formatting"
          >
            <ClipboardPaste size={16} />
          </button>
        </div>
      </div>
      
      {/* Chart Type */}
      {onChangeChartType && (
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium">Chart Type</label>
          <select 
            className="p-2 border rounded-md text-sm bg-background"
            value={chartType === "box" && config.notched ? "notched_box" : (chartType === "raincloud" && config.notched ? "notched_raincloud" : chartType)}
            onChange={(e) => {
              const val = e.target.value;
              if (val === "notched_box") {
                onChangeChartType("box");
                onChangeConfig({ ...config, notched: true });
              } else if (val === "notched_raincloud") {
                onChangeChartType("raincloud");
                onChangeConfig({ ...config, notched: true });
              } else {
                onChangeChartType(val);
                if (val === "box" || val === "raincloud") {
                  onChangeConfig({ ...config, notched: false });
                }
              }
            }}
          >
            <option value="bar-error">Bar & Error</option>
            <option value="box">Box & Whisker</option>
            <option value="notched_box">Notched Box</option>
            <option value="violin">Violin Plot</option>
            <option value="raincloud">Raincloud Plot</option>
            <option value="notched_raincloud">Notched Raincloud</option>
            <option value="scatter">Scatter Plot</option>
            <option value="jitter">Jitter</option>
            <option value="strip">Strip</option>
            <option value="swarm">Swarm</option>
            <option value="h-box">Horizontal Box</option>
            <option value="range-dumbbell">Range/Dumbbell</option>
            <option value="ci-forest">CI Forest</option>
            <option value="km-step">Kaplan-Meier Step Curve</option>
          </select>
        </div>
      )}

      {/* Axis Labels */}
      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-medium">Y-Axis Label</label>
        <input 
          type="text" 
          className="p-2 border rounded-md text-sm bg-background"
          placeholder="Value"
          value={config.yAxisTitle || ""}
          onChange={(e) => handleChange("yAxisTitle", e.target.value)}
        />
        <div className="flex items-center gap-2 mt-1">
          <input 
            type="checkbox" 
            id="showYAxisTitle"
            checked={config.showYAxisTitle ?? true}
            onChange={(e) => handleChange("showYAxisTitle", e.target.checked)}
          />
          <label htmlFor="showYAxisTitle" className="text-xs">Show Y-Axis Title</label>
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-medium">X-Axis Label</label>
        <input 
          type="text" 
          className="p-2 border rounded-md text-sm bg-background"
          placeholder="Group"
          value={config.xAxisTitle || ""}
          onChange={(e) => handleChange("xAxisTitle", e.target.value)}
        />
        <div className="flex items-center gap-2 mt-1">
          <input 
            type="checkbox" 
            id="showXAxisTitle"
            checked={config.showXAxisTitle ?? true}
            onChange={(e) => handleChange("showXAxisTitle", e.target.checked)}
          />
          <label htmlFor="showXAxisTitle" className="text-xs">Show X-Axis Title</label>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2">
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium">Y Min</label>
          <input 
            type="number" 
            className="p-2 border rounded-md text-sm bg-background"
            placeholder="Auto"
            value={config.yAxisMin ?? ""}
            onChange={(e) => handleChange("yAxisMin", e.target.value === "" ? undefined : Number(e.target.value))}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium">Y Max</label>
          <input 
            type="number" 
            className="p-2 border rounded-md text-sm bg-background"
            placeholder="Auto"
            value={config.yAxisMax ?? ""}
            onChange={(e) => handleChange("yAxisMax", e.target.value === "" ? undefined : Number(e.target.value))}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium">Y Step</label>
          <input 
            type="number" 
            className="p-2 border rounded-md text-sm bg-background"
            placeholder="Auto"
            value={config.yAxisStep ?? ""}
            onChange={(e) => handleChange("yAxisStep", e.target.value === "" ? undefined : Number(e.target.value))}
          />
        </div>
      </div>

      {/* Linked Analysis */}
      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-medium">Statistical Results</label>
        <select 
          className="p-2 border rounded-md text-sm bg-background"
          value={graph.analysisId || ""}
          onChange={(e) => onChangeAnalysis?.(e.target.value === "" ? undefined : e.target.value)}
        >
          <option value="">None (Draw Basic Bars)</option>
          {analyses.map(a => (
            <option key={a.id} value={a.id}>
              {a.name || a.testId} ({new Date(a.createdAt).toLocaleTimeString()})
            </option>
          ))}
        </select>
        <p className="text-xs text-muted-foreground">Links significance stars & exact engine stats to the chart.</p>
      </div>

      {/* Error Bars */}
      {(chartType === "bar-error" || chartType === "scatter") && (
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium">Error Bars</label>
          <select 
            className="p-2 border rounded-md text-sm bg-background"
            value={config.errorBarType}
            onChange={(e) => handleChange("errorBarType", e.target.value)}
          >
            <option value="mean_sem">Mean ± SEM</option>
            <option value="mean_sd">Mean ± SD</option>
            <option value="mean_95ci">Mean ± 95% CI</option>
          </select>
        </div>
      )}

        {chartType === "km-step" && (
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-2">
              <input 
                type="checkbox" 
                id="errorBars"
                checked={config.errorBars ?? true}
                onChange={(e) => handleChange("errorBars", e.target.checked)}
              />
              <label htmlFor="errorBars" className="text-sm font-medium">Show 95% CI Band</label>
            </div>
          </div>
        )}

      {/* Range Dumbbell Options */}
      {chartType === "range-dumbbell" && (
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium">Range</label>
          <select 
            className="p-2 border rounded-md text-sm bg-background"
            value={config.rangeMode ?? "min_max"}
            onChange={(e) => handleChange("rangeMode", e.target.value)}
          >
            <option value="min_max">Min–Max</option>
            <option value="iqr">IQR (Q1–Q3)</option>
            <option value="mean_sd">Mean ± SD</option>
          </select>
        </div>
      )}

      {/* CI Forest Options */}
      {chartType === "ci-forest" && (
        <>
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium">Source</label>
            <select 
              className="p-2 border rounded-md text-sm bg-background"
              value={config.ciSource ?? "group_means"}
              onChange={(e) => handleChange("ciSource", e.target.value)}
            >
              <option value="group_means">Group means</option>
              <option value="coefficients">Coefficients</option>
            </select>
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium">CI Level (%)</label>
            <input 
              type="number" 
              className="p-2 border rounded-md text-sm bg-background"
              value={config.ciLevel ?? 95}
              onChange={(e) => handleChange("ciLevel", Number(e.target.value))}
              min={1} max={99}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium">Reference Value</label>
            <input 
              type="number" 
              className="p-2 border rounded-md text-sm bg-background"
              value={config.referenceValue ?? 0}
              onChange={(e) => handleChange("referenceValue", Number(e.target.value))}
            />
          </div>
        </>
      )}

      {/* Show Points */}
      {(chartType === "bar-error" || chartType === "box" || chartType === "violin" || chartType === "raincloud" || chartType === "scatter" || chartType === "jitter" || chartType === "strip" || chartType === "swarm" || chartType === "range-dumbbell" || chartType === "ci-forest") && (
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2">
            <input 
              type="checkbox" 
              id="showPoints"
              checked={config.showPoints}
              onChange={(e) => handleChange("showPoints", e.target.checked)}
            />
            <label htmlFor="showPoints" className="text-sm font-medium">Show Individual Points</label>
          </div>
          {config.showPoints && (
            <div className="flex flex-col gap-1.5 ml-6">
              <label className="text-xs font-medium">Point Size</label>
              <input 
                type="number" 
                className="p-2 border rounded-md text-sm bg-background w-24"
                value={config.pointSize ?? 3}
                onChange={(e) => handleChange("pointSize", Number(e.target.value))}
                min={1}
                max={10}
              />
            </div>
          )}
        </div>
      )}

      {/* XY Options */}
      {chartType === "scatter" && (
        <>
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium">Line Style (XY)</label>
            <select 
              className="p-2 border rounded-md text-sm bg-background"
              value={config.lineStyle ?? "none"}
              onChange={(e) => handleChange("lineStyle", e.target.value)}
            >
              <option value="none">None</option>
              <option value="straight">Straight Connecting Line</option>
              <option value="smooth">Smooth Connecting Line</option>
            </select>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium">Trendline (XY)</label>
            <select 
              className="p-2 border rounded-md text-sm bg-background"
              value={config.trendlineType ?? "none"}
              onChange={(e) => handleChange("trendlineType", e.target.value)}
            >
              <option value="none">None</option>
              <option value="linear">Linear Regression</option>
              <option value="linear_forecast">Linear (Forecast)</option>
              <option value="exponential">Exponential Growth</option>
            </select>
          </div>
        </>
      )}

      {/* Palette */}
      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-medium">Color Palette</label>
        <select 
          className="p-2 border rounded-md text-sm bg-background"
          value={config.palette}
          onChange={(e) => handleChange("palette", e.target.value)}
        >
          <option value="okabe-ito">Okabe-Ito (Colorblind Safe)</option>
          <option value="viridis">Viridis</option>
          <option value="tableau">Tableau 10</option>
        </select>
      </div>

      {/* Significance Scale */}
      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-medium">Significance Scale</label>
        <select 
          className="p-2 border rounded-md text-sm bg-background"
          value={config.significanceScale}
          onChange={(e) => handleChange("significanceScale", e.target.value)}
        >
          <option value="standard">Standard (ns, *, **, ***, ****, *****)</option>
          <option value="raw">Raw (p=0.04)</option>
        </select>
        
        <div className="flex items-center gap-2 mt-2">
          <input 
            type="checkbox" 
            id="showNsBrackets"
            checked={config.showNsBrackets ?? true}
            onChange={(e) => handleChange("showNsBrackets", e.target.checked)}
          />
          <label htmlFor="showNsBrackets" className="text-sm font-medium">Show non-significant (ns) brackets</label>
        </div>
      </div>

      {/* Background */}
      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-medium">Export Background</label>
        <select 
          className="p-2 border rounded-md text-sm bg-background"
          value={config.background}
          onChange={(e) => handleChange("background", e.target.value)}
        >
          <option value="transparent">Transparent</option>
          <option value="white">White</option>
        </select>
      </div>
      {/* Styling */}
      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-medium">Font Family</label>
        <select 
          className="p-2 border rounded-md text-sm bg-background"
          value={config.fontFamily}
          onChange={(e) => handleChange("fontFamily", e.target.value)}
        >
          <optgroup label="System Fonts">
            <option value="Arial, sans-serif">Arial</option>
            <option value="Helvetica, sans-serif">Helvetica</option>
            <option value="Times New Roman, serif">Times New Roman</option>
          </optgroup>
          <optgroup label="Bundled: Sans-Serif">
            <option value="Inter">Inter</option>
            <option value="Roboto">Roboto</option>
            <option value="Lato">Lato</option>
            <option value="Open Sans">Open Sans</option>
            <option value="Source Sans 3">Source Sans 3</option>
            <option value="Nunito Sans">Nunito Sans</option>
            <option value="Montserrat">Montserrat</option>
            <option value="Arimo">Arial (Arimo)</option>
            <option value="IBM Plex Sans">IBM Plex Sans</option>
          </optgroup>
          <optgroup label="Bundled: Serif">
            <option value="Merriweather">Merriweather</option>
            <option value="Roboto Slab">Roboto Slab</option>
            <option value="IBM Plex Serif">IBM Plex Serif</option>
          </optgroup>
          <optgroup label="Bundled: Monospace">
            <option value="Roboto Mono">Roboto Mono</option>
            <option value="IBM Plex Mono">IBM Plex Mono</option>
            <option value="JetBrains Mono">JetBrains Mono</option>
          </optgroup>
        </select>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium">Base Font Size</label>
          <input 
            type="number" 
            className="p-2 border rounded-md text-sm bg-background"
            value={config.fontSize}
            onChange={(e) => handleChange("fontSize", Number(e.target.value))}
            min={8}
            max={32}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium">Axis Title Size</label>
          <input 
            type="number" 
            className="p-2 border rounded-md text-sm bg-background"
            placeholder={String(config.fontSize + 2)}
            value={config.axisTitleFontSize ?? ""}
            onChange={(e) => handleChange("axisTitleFontSize", e.target.value === "" ? undefined : Number(e.target.value))}
            min={8}
            max={40}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium">Axis Label Size</label>
          <input 
            type="number" 
            className="p-2 border rounded-md text-sm bg-background"
            placeholder={String(config.fontSize)}
            value={config.axisLabelFontSize ?? ""}
            onChange={(e) => handleChange("axisLabelFontSize", e.target.value === "" ? undefined : Number(e.target.value))}
            min={8}
            max={32}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium">P-Value Size</label>
          <input 
            type="number" 
            className="p-2 border rounded-md text-sm bg-background"
            placeholder={String(config.significanceScale === "raw" ? config.fontSize : config.fontSize + 2)}
            value={config.pValueFontSize ?? ""}
            onChange={(e) => handleChange("pValueFontSize", e.target.value === "" ? undefined : Number(e.target.value))}
            min={8}
            max={32}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium">Legend Size</label>
          <input 
            type="number" 
            className="p-2 border rounded-md text-sm bg-background"
            placeholder={String(config.fontSize)}
            value={config.legendFontSize ?? ""}
            onChange={(e) => handleChange("legendFontSize", e.target.value === "" ? undefined : Number(e.target.value))}
            min={8}
            max={32}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium">Equation Size</label>
          <input 
            type="number" 
            className="p-2 border rounded-md text-sm bg-background"
            placeholder={String(config.fontSize)}
            value={config.equationFontSize ?? ""}
            onChange={(e) => handleChange("equationFontSize", e.target.value === "" ? undefined : Number(e.target.value))}
            min={8}
            max={32}
          />
        </div>
      </div>

      <div className="flex items-center gap-2 mt-2">
        <input 
          type="checkbox" 
          id="showLegend"
          checked={config.showLegend}
          onChange={(e) => handleChange("showLegend", e.target.checked)}
        />
        <label htmlFor="showLegend" className="text-sm font-medium">Show Color Legend Below Graph</label>
      </div>
    </div>
  );
}

