import React, { useState, useEffect } from "react";
import { Copy, ClipboardPaste } from "lucide-react";
import type { GraphConfig, Graph, Analysis, DataSheet } from "@/types/workbook";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

interface GraphSettingsPanelProps {
  graph: Graph;
  sheet?: DataSheet;
  analyses: Analysis[];
  onChangeConfig: (config: GraphConfig) => void;
  onChangeAnalysis?: (analysisId: string | undefined) => void;
  onChangeChartType?: (chartType: any) => void;
}

export function GraphSettingsPanel({ graph, sheet, analyses, onChangeConfig, onChangeAnalysis, onChangeChartType }: GraphSettingsPanelProps) {
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
      palette: config.palette,
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
            title="Copy formatting (font sizes, font family, point size, color palette)"
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
          <label className="text-base font-medium">Chart Type</label>
          <SearchableSelect
            options={[
              { label: "Bar & Error", value: "bar-error", group: "Distribution" },
              { label: "Frequency Histogram", value: "histogram", group: "Distribution" },
              { label: "Box & Whisker", value: "box", group: "Distribution" },
              { label: "Notched Box", value: "notched_box", group: "Distribution" },
              { label: "Violin Plot", value: "violin", group: "Distribution" },
              { label: "Raincloud Plot", value: "raincloud", group: "Distribution" },
              { label: "Notched Raincloud", value: "notched_raincloud", group: "Distribution" },
              { label: "Scatter Plot", value: "scatter", group: "Points" },
              { label: "Jitter", value: "jitter", group: "Points" },
              { label: "Strip", value: "strip", group: "Points" },
              { label: "Swarm", value: "swarm", group: "Points" },
              { label: "Horizontal Box", value: "h-box", group: "Horizontal" },
              { label: "Range/Dumbbell", value: "range-dumbbell", group: "Special" },
              { label: "CI Forest", value: "ci-forest", group: "Special" },
              { label: "Kaplan-Meier Step Curve", value: "km-step", group: "Special" },
            ]}
            value={chartType === "box" && config.notched ? "notched_box" : (chartType === "raincloud" && config.notched ? "notched_raincloud" : chartType)}
            onChange={(val) => {
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
          />
        </div>
      )}

      {/* Axis Labels */}
      <div className="flex flex-col gap-1.5">
        <label className="text-base font-medium">Y-Axis Label</label>
        <input 
          type="text" 
          className="p-2 border rounded-md text-base bg-background"
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
        <label className="text-base font-medium">X-Axis Label</label>
        <input 
          type="text" 
          className="p-2 border rounded-md text-base bg-background"
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
          <label className="text-xs font-medium">{['h-box', 'range-dumbbell', 'ci-forest'].includes(chartType) ? 'X Min' : 'Y Min'}</label>
          <input 
            type="number" 
            className="p-2 border rounded-md text-base bg-background"
            placeholder="Auto"
            value={['h-box', 'range-dumbbell', 'ci-forest'].includes(chartType) ? (config.xAxisMin ?? "") : (config.yAxisMin ?? "")}
            onChange={(e) => handleChange(['h-box', 'range-dumbbell', 'ci-forest'].includes(chartType) ? "xAxisMin" : "yAxisMin", e.target.value === "" ? undefined : Number(e.target.value))}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium">{['h-box', 'range-dumbbell', 'ci-forest'].includes(chartType) ? 'X Max' : 'Y Max'}</label>
          <input 
            type="number" 
            className="p-2 border rounded-md text-base bg-background"
            placeholder="Auto"
            value={['h-box', 'range-dumbbell', 'ci-forest'].includes(chartType) ? (config.xAxisMax ?? "") : (config.yAxisMax ?? "")}
            onChange={(e) => handleChange(['h-box', 'range-dumbbell', 'ci-forest'].includes(chartType) ? "xAxisMax" : "yAxisMax", e.target.value === "" ? undefined : Number(e.target.value))}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium">{['h-box', 'range-dumbbell', 'ci-forest'].includes(chartType) ? 'X Step' : 'Y Step'}</label>
          <input 
            type="number" 
            className="p-2 border rounded-md text-base bg-background"
            placeholder="Auto"
            value={['h-box', 'range-dumbbell', 'ci-forest'].includes(chartType) ? (config.xAxisStep ?? "") : (config.yAxisStep ?? "")}
            onChange={(e) => handleChange(['h-box', 'range-dumbbell', 'ci-forest'].includes(chartType) ? "xAxisStep" : "yAxisStep", e.target.value === "" ? undefined : Number(e.target.value))}
          />
        </div>
      </div>

      {/* Linked Analysis */}
      <div className="flex flex-col gap-1.5">
        <label className="text-base font-medium">Statistical Results</label>
        <select 
          className="p-2 border rounded-md text-base bg-background"
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
          <label className="text-base font-medium">Error Bars</label>
          <select 
            className="p-2 border rounded-md text-base bg-background"
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
          <>
            <div className="flex flex-col gap-1.5">
              <label className="text-base font-medium">Show Survival As</label>
              <select 
                className="p-2 border rounded-md text-base bg-background"
                value={config.survivalShowAs ?? "fractions"}
                onChange={(e) => handleChange("survivalShowAs", e.target.value)}
              >
                <option value="fractions">Fractions</option>
                <option value="percents">Percents</option>
              </select>
            </div>
            <div className="flex flex-col gap-1.5 mt-2">
              <label className="text-base font-medium">Style</label>
              <select 
                className="p-2 border rounded-md text-base bg-background"
                value={config.survivalStyle ?? "staircase-ticks"}
                onChange={(e) => handleChange("survivalStyle", e.target.value)}
              >
                <option value="staircase-ticks">Staircase with Ticks</option>
                <option value="staircase">Staircase</option>
                <option value="connected-dots">Connected Dots</option>
                <option value="dots-only">Dots Only</option>
              </select>
            </div>
            <div className="flex flex-col gap-1.5 mt-2">
              <label className="text-base font-medium">Symbols At</label>
              <select 
                className="p-2 border rounded-md text-base bg-background"
                value={config.survivalSymbolsAt ?? "censored"}
                onChange={(e) => handleChange("survivalSymbolsAt", e.target.value)}
              >
                <option value="censored">Censored Events Only</option>
                <option value="all">All Events</option>
              </select>
            </div>
            <div className="flex flex-col gap-1.5 mt-2">
              <label className="text-base font-medium">Error Bars / Bands</label>
              <select 
                className="p-2 border rounded-md text-base bg-background"
                value={config.errorBars ?? "none"}
                onChange={(e) => handleChange("errorBars", e.target.value)}
              >
                <option value="none">None</option>
                <option value="se">Standard Error (Bars)</option>
                <option value="ci95">95% Confidence Interval (Band)</option>
              </select>
            </div>
          </>
        )}

      {/* Range Dumbbell Options */}
      {chartType === "range-dumbbell" && (
        <div className="flex flex-col gap-1.5">
          <label className="text-base font-medium">Range</label>
          <select 
            className="p-2 border rounded-md text-base bg-background"
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
            <label className="text-base font-medium">Source</label>
            <select 
              className="p-2 border rounded-md text-base bg-background"
              value={config.ciSource ?? "group_means"}
              onChange={(e) => handleChange("ciSource", e.target.value)}
            >
              <option value="group_means">Group means</option>
              <option value="coefficients">Coefficients</option>
            </select>
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-base font-medium">CI Level (%)</label>
            <input 
              type="number" 
              className="p-2 border rounded-md text-base bg-background"
              value={config.ciLevel ?? 95}
              onChange={(e) => handleChange("ciLevel", Number(e.target.value))}
              min={1} max={99}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-base font-medium">Reference Value</label>
            <input 
              type="number" 
              className="p-2 border rounded-md text-base bg-background"
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
              checked={config.showPoints ?? true}
              onChange={(e) => handleChange("showPoints", e.target.checked)}
            />
            <label htmlFor="showPoints" className="text-base font-medium">Show Individual Points</label>
          </div>
          {(config.showPoints ?? true) && (
            <div className="flex flex-col gap-1.5 ml-6">
              <label className="text-xs font-medium">Point Size</label>
              <input 
                type="number" 
                className="p-2 border rounded-md text-base bg-background w-24"
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
            <label className="text-base font-medium">Line Style (XY)</label>
            <select 
              className="p-2 border rounded-md text-base bg-background"
              value={config.lineStyle ?? "none"}
              onChange={(e) => handleChange("lineStyle", e.target.value)}
            >
              <option value="none">None</option>
              <option value="straight">Straight Connecting Line</option>
              <option value="smooth">Smooth Connecting Line</option>
            </select>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-base font-medium">Trendline (XY)</label>
            <select 
              className="p-2 border rounded-md text-base bg-background"
              value={config.trendlineType ?? "none"}
              onChange={(e) => handleChange("trendlineType", e.target.value)}
            >
              <option value="none">None</option>
              <option value="linear">Linear Regression</option>
              <option value="linear_forecast">Linear (Forecast)</option>
              <option value="exponential">Exponential Regression</option>
              <option value="logarithmic">Logarithmic Regression</option>
            </select>
          </div>

          {(config.trendlineType === "linear" || config.trendlineType === "linear_forecast" || config.trendlineType === "exponential") && (
            <div className="flex flex-col gap-1.5 pl-2 border-l-2 border-border">
              <div className="flex items-center gap-2">
                <input 
                  type="checkbox" 
                  id="forceIntercept"
                  checked={config.forceIntercept ?? false}
                  onChange={(e) => handleChange("forceIntercept", e.target.checked)}
                />
                <label htmlFor="forceIntercept" className="text-base font-medium">Force Y-Intercept</label>
              </div>
              {config.forceIntercept && (
                <input 
                  type="number"
                  className="p-2 border rounded-md text-base bg-background"
                  value={config.forcedInterceptValue ?? 0}
                  step="0.1"
                  onChange={(e) => handleChange("forcedInterceptValue", parseFloat(e.target.value))}
                />
              )}
            </div>
          )}
        </>
      )}

      {chartType === "histogram" && (
        <div className="flex flex-col gap-1.5">
          <label className="text-base font-medium">Binning</label>
          <Dialog>
            <DialogTrigger asChild>
              <Button variant="outline" className="w-full justify-start text-left font-normal bg-background text-base p-2 h-auto">
                Change binning...
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Histogram Binning</DialogTitle>
              </DialogHeader>
              <div className="flex flex-col gap-4 py-4">
                {(() => {
                  let min = Infinity, max = -Infinity;
                  if (sheet) {
                    const isXY = graph.graphFamily === "XY";
                    sheet.columnGroups.forEach((g: any) => {
                      const columns: any[] | null = g.columns ? g.columns : (isXY ? [g] : null);
                      if (columns) {
                        columns.forEach((col: any) => {
                          sheet.data.forEach((row: any) => {
                            const v = row[col.id];
                            if (v !== "" && v !== null && v !== undefined && !isNaN(Number(v))) {
                              const num = Number(v);
                              if (num < min) min = num;
                              if (num > max) max = num;
                            }
                          });
                        });
                      } else {
                        sheet.data.forEach((row: any) => {
                          const v = row[g.id];
                          if (v !== "" && v !== null && v !== undefined && !isNaN(Number(v))) {
                            const num = Number(v);
                            if (num < min) min = num;
                            if (num > max) max = num;
                          }
                        });
                      }
                    });
                  }
                  
                  const hasData = min !== Infinity && max !== -Infinity;
                  
                  const currentSettings = config.histogramBinSettings || { type: "continuous", stepSize: undefined };

                  return (
                    <>
                      <div className="text-sm text-muted-foreground">
                        {hasData ? `Data range: ${min.toPrecision(4)} to ${max.toPrecision(4)}` : "No numeric data found."}
                      </div>
                      
                      <div className="flex flex-col gap-2 mt-2">
                        <label className="font-medium text-sm">Data Type</label>
                        <select 
                          className="p-2 border rounded-md text-sm bg-background"
                          value={currentSettings.type}
                          onChange={(e) => {
                            handleChange("histogramBinSettings", { ...currentSettings, type: e.target.value });
                          }}
                        >
                          <option value="continuous">Continuous</option>
                          <option value="prebinned">Prebinned (Exact Values)</option>
                        </select>
                        <p className="text-xs text-muted-foreground">
                          {currentSettings.type === "continuous" 
                            ? "Data is continuous. Specify a step size to group data into ranges (e.g. 10-19, 20-29)."
                            : "Data is already discrete/binned. Values will be grouped exactly by their given number."}
                        </p>
                      </div>

                      {currentSettings.type === "continuous" && (
                        <div className="flex flex-col gap-2 mt-2">
                          <label className="font-medium text-sm">Step Size (Optional)</label>
                          <input 
                            type="number"
                            className="p-2 border rounded-md text-sm bg-background"
                            placeholder="Auto"
                            value={currentSettings.stepSize || ""}
                            onChange={(e) => {
                              const val = e.target.value === "" ? undefined : parseFloat(e.target.value);
                              handleChange("histogramBinSettings", { ...currentSettings, stepSize: val });
                            }}
                          />
                        </div>
                      )}
                    </>
                  );
                })()}
              </div>
            </DialogContent>
          </Dialog>
        </div>
      )}

      {/* Palette */}
      <div className="flex flex-col gap-1.5">
        <label className="text-base font-medium">Color Palette</label>
        <SearchableSelect
          options={[
            { label: "Okabe-Ito", value: "okabe-ito", group: "Colourblind-safe" },
            { label: "Viridis", value: "viridis", group: "Colourblind-safe" },
            { label: "Cividis", value: "cividis", group: "Colourblind-safe" },
            { label: "Magma", value: "magma", group: "Colourblind-safe" },
            { label: "Nature", value: "nature", group: "Journal" },
            { label: "Lancet", value: "lancet", group: "Journal" },
            { label: "JAMA", value: "jama", group: "Journal" },
            { label: "Tableau Classic", value: "tableau", group: "Qualitative" },
            { label: "Brewer Bold", value: "brewer-bold", group: "Qualitative" },
            { label: "Forest Dusk", value: "forest-dusk", group: "Qualitative" },
            { label: "Duo Tone", value: "duo-tone", group: "Qualitative" },
            { label: "Ocean Breeze", value: "ocean", group: "Thematic" },
            { label: "Soft Pastel", value: "pastel", group: "Thematic" },
            { label: "Neon Glow", value: "neon", group: "Thematic" },
            { label: "Earthy Tones", value: "earth", group: "Thematic" },
            { label: "Retro Warm", value: "retro", group: "Thematic" },
            { label: "Grayscale", value: "grayscale", group: "Print" },
          ]}
          value={config.palette}
          onChange={(val) => handleChange("palette", val)}
        />
      </div>

      {/* Significance Scale */}
      <div className="flex flex-col gap-1.5">
        <label className="text-base font-medium">Significance Scale</label>
        <select 
          className="p-2 border rounded-md text-base bg-background"
          value={config.significanceScale}
          onChange={(e) => handleChange("significanceScale", e.target.value)}
        >
          <option value="standard">Standard (ns, *, **, ***, ****, *****)</option>
          <option value="raw">Raw (p=0.04)</option>
        </select>
        
        <div className="flex items-center space-x-2">
          <input 
            type="checkbox" 
            id="showNsBrackets"
            checked={config.showNsBrackets ?? true}
            onChange={(e) => handleChange("showNsBrackets", e.target.checked)}
          />
          <label htmlFor="showNsBrackets" className="text-base font-medium">Show non-significant (ns) brackets</label>
        </div>
        <div className="flex items-center space-x-2">
          <input 
            type="checkbox" 
            id="showPostHocCaption"
            checked={config.showPostHocCaption ?? true}
            onChange={(e) => handleChange("showPostHocCaption", e.target.checked)}
          />
          <label htmlFor="showPostHocCaption" className="text-base font-medium">Show post-hoc method caption</label>
        </div>
      </div>

      {/* Background */}
      <div className="flex flex-col gap-1.5">
        <label className="text-base font-medium">Export Background</label>
        <select 
          className="p-2 border rounded-md text-base bg-background"
          value={config.background}
          onChange={(e) => handleChange("background", e.target.value)}
        >
          <option value="transparent">Transparent</option>
          <option value="white">White</option>
        </select>
      </div>
      {/* Styling */}
      <div className="flex flex-col gap-1.5">
        <label className="text-base font-medium">Font Family</label>
        <SearchableSelect
          options={[
            { label: "Arial", value: "Arial, sans-serif", group: "System Fonts", style: { fontFamily: "Arial, sans-serif" } },
            { label: "Helvetica", value: "Helvetica, sans-serif", group: "System Fonts", style: { fontFamily: "Helvetica, sans-serif" } },
            { label: "Times New Roman", value: "Times New Roman, serif", group: "System Fonts", style: { fontFamily: "Times New Roman, serif" } },
            { label: "Inter", value: "Inter", group: "Bundled: Sans-Serif", style: { fontFamily: "Inter" } },
            { label: "Roboto", value: "Roboto", group: "Bundled: Sans-Serif", style: { fontFamily: "Roboto" } },
            { label: "Lato", value: "Lato", group: "Bundled: Sans-Serif", style: { fontFamily: "Lato" } },
            { label: "Open Sans", value: "Open Sans", group: "Bundled: Sans-Serif", style: { fontFamily: "Open Sans" } },
            { label: "Source Sans 3", value: "Source Sans 3", group: "Bundled: Sans-Serif", style: { fontFamily: "Source Sans 3" } },
            { label: "Nunito Sans", value: "Nunito Sans", group: "Bundled: Sans-Serif", style: { fontFamily: "Nunito Sans" } },
            { label: "Montserrat", value: "Montserrat", group: "Bundled: Sans-Serif", style: { fontFamily: "Montserrat" } },
            { label: "Arial (Arimo)", value: "Arimo", group: "Bundled: Sans-Serif", style: { fontFamily: "Arimo" } },
            { label: "IBM Plex Sans", value: "IBM Plex Sans", group: "Bundled: Sans-Serif", style: { fontFamily: "IBM Plex Sans" } },
            { label: "Merriweather", value: "Merriweather", group: "Bundled: Serif", style: { fontFamily: "Merriweather" } },
            { label: "Roboto Slab", value: "Roboto Slab", group: "Bundled: Serif", style: { fontFamily: "Roboto Slab" } },
            { label: "IBM Plex Serif", value: "IBM Plex Serif", group: "Bundled: Serif", style: { fontFamily: "IBM Plex Serif" } },
            { label: "Roboto Mono", value: "Roboto Mono", group: "Bundled: Monospace", style: { fontFamily: "Roboto Mono" } },
            { label: "IBM Plex Mono", value: "IBM Plex Mono", group: "Bundled: Monospace", style: { fontFamily: "IBM Plex Mono" } },
            { label: "JetBrains Mono", value: "JetBrains Mono", group: "Bundled: Monospace", style: { fontFamily: "JetBrains Mono" } },
          ]}
          value={config.fontFamily}
          onChange={(val) => handleChange("fontFamily", val)}
        />
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium">Base Font Size</label>
          <input 
            type="number" 
            className="p-2 border rounded-md text-base bg-background"
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
            className="p-2 border rounded-md text-base bg-background"
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
            className="p-2 border rounded-md text-base bg-background"
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
            className="p-2 border rounded-md text-base bg-background"
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
            className="p-2 border rounded-md text-base bg-background"
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
            className="p-2 border rounded-md text-base bg-background"
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
        <label htmlFor="showLegend" className="text-base font-medium">Show Color Legend Below Graph</label>
      </div>
    </div>
  );
}

