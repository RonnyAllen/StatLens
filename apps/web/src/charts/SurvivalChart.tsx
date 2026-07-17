import React, { useMemo } from "react"
import { scaleLinear } from "@visx/scale"
import { Group } from "@visx/group"
import { LinePath, Area, Circle } from "@visx/shape"
import { curveStepAfter, curveLinear } from "@visx/curve"
import { AxisLeft, AxisBottom } from "@visx/axis"
import type { DataSheet, GraphConfig } from "@/types/workbook"
import { PALETTES } from "./ColumnCharts"

interface SurvivalChartProps {
  sheet: DataSheet
  analysisResults?: any
  config: GraphConfig
  width: number
  height: number
}

interface KMPoint {
  time: number
  survival: number
  nRisk: number
  nEvents: number
  nCensored: number
  isCensored: boolean
  ciLower: number
  ciUpper: number
  se: number
}

function calculateKM(times: number[], events: number[]): KMPoint[] {
  const data = times.map((t, i) => ({ t, e: events[i] })).sort((a, b) => a.t - b.t)
  
  let currentS = 1
  let atRisk = data.length
  let sumVar = 0
  const result: KMPoint[] = [{ time: 0, survival: 1, nRisk: atRisk, nEvents: 0, nCensored: 0, isCensored: false, ciLower: 1, ciUpper: 1, se: 0 }]
  
  let i = 0
  while (i < data.length) {
    const t = data[i].t
    let d = 0
    let c = 0
    
    while (i < data.length && data[i].t === t) {
      if (data[i].e === 1 || data[i].e > 0) d++ // anything > 0 is event
      else c++
      i++
    }
    
    if (d > 0) {
      if (atRisk - d > 0) {
        sumVar += d / (atRisk * (atRisk - d))
      }
      currentS = currentS * (1 - d / atRisk)
      const se = currentS * Math.sqrt(sumVar)
      
      // Simple Greenwood CI (bounded 0-1)
      const ciLower = Math.max(0, currentS - 1.96 * se)
      const ciUpper = Math.min(1, currentS + 1.96 * se)
      
      result.push({ time: t, survival: currentS, nRisk: atRisk, nEvents: d, nCensored: c, isCensored: false, ciLower, ciUpper, se })
    }
    
    if (c > 0) {
      // Add a censored point to the curve, but S(t) does not drop due to censoring
      const se = currentS * Math.sqrt(sumVar)
      const ciLower = Math.max(0, currentS - 1.96 * se)
      const ciUpper = Math.min(1, currentS + 1.96 * se)
      result.push({ time: t, survival: currentS, nRisk: atRisk, nEvents: 0, nCensored: c, isCensored: true, ciLower, ciUpper, se })
    }
    
    atRisk -= (d + c)
  }
  return result
}



export function SurvivalChart({ sheet, config, width, height }: SurvivalChartProps) {
  const margin = { top: 40, right: 40, bottom: 60, left: 60 }
  const innerWidth = width - margin.left - margin.right
  const innerHeight = height - margin.top - margin.bottom

  const groupsData = useMemo(() => {
    const timeCol = "rowTitle"
    const groupCols = sheet.columnGroups.map(g => g.id)
    
    const results: Array<{ groupId: string, name: string, data: KMPoint[], maxTime: number }> = []
    
    let maxT = 0
    
    for (const gId of groupCols) {
      const times: number[] = []
      const events: number[] = []
      for (const row of sheet.data) {
        const t = Number(row[timeCol])
        const e = Number(row[gId])
        if (!isNaN(t) && !isNaN(e) && row[timeCol] !== null && row[gId] !== null && row[timeCol] !== "" && row[gId] !== "") {
          times.push(t)
          events.push(e)
          if (t > maxT) maxT = t
        }
      }
      if (times.length > 0) {
        const km = calculateKM(times, events)
        const groupObj = sheet.columnGroups.find(g => g.id === gId)
        results.push({
          groupId: gId,
          name: groupObj?.name || gId,
          data: km,
          maxTime: Math.max(...km.map(p => p.time))
        })
      }
    }
    
    // Add endpoint to max observed time to extend horizontal line if needed
    for (const grp of results) {
       if (grp.data.length > 0 && grp.data[grp.data.length - 1].time < maxT) {
           grp.data.push({
               ...grp.data[grp.data.length - 1],
               time: maxT,
               isCensored: false
           })
       }
    }
    
    return { results, maxT }
  }, [sheet.data, sheet.columnGroups])

  if (groupsData.results.length === 0) {
    return <text x={width/2} y={height/2} textAnchor="middle">No valid survival data found.</text>
  }

  const xScale = scaleLinear<number>({
    range: [0, innerWidth],
    domain: [0, groupsData.maxT * 1.05],
    nice: true
  })

  const yScale = scaleLinear<number>({
    range: [innerHeight, 0],
    domain: [0, 1.05],
    nice: true
  })

  return (
    <Group left={margin.left} top={margin.top}>
      <AxisBottom 
        scale={xScale} 
        top={innerHeight} 
        label={config.showXAxisTitle !== false ? (config.xAxisTitle ?? "Time") : ""} 
        stroke="#333" 
        tickStroke="#333"
        labelProps={{ dy: 40, fill: '#333', fontSize: config.axisTitleFontSize ?? config.fontSize ?? 14, fontFamily: config.fontFamily, textAnchor: 'middle' }}
        tickLabelProps={() => ({ fill: '#333', fontSize: config.axisLabelFontSize ?? config.fontSize ?? 12, fontFamily: config.fontFamily, textAnchor: 'middle' })}
      />
      <AxisLeft 
        scale={yScale} 
        label={config.showYAxisTitle !== false ? (config.yAxisTitle ?? "Probability of Survival") : ""} 
        stroke="#333" 
        tickStroke="#333"
        tickFormat={(d) => config.survivalShowAs === "percents" ? `${(d.valueOf() as number) * 100}%` : d.valueOf().toString()}
        labelProps={{ dx: -40, fill: '#333', fontSize: config.axisTitleFontSize ?? config.fontSize ?? 14, fontFamily: config.fontFamily, textAnchor: 'middle' }}
        tickLabelProps={() => ({ dx: -4, fill: '#333', fontSize: config.axisLabelFontSize ?? config.fontSize ?? 12, fontFamily: config.fontFamily, textAnchor: 'end', dy: 4 })}
      />

      {groupsData.results.map((grp, i) => {
        const colors = PALETTES[config.palette || "okabe-ito"] || PALETTES["okabe-ito"]
        const color = colors[i % colors.length]
        
        const style = config.survivalStyle || "staircase-ticks";
        const isStaircase = style === "staircase-ticks" || style === "staircase";
        const isConnectedDots = style === "connected-dots";
        const isDotsOnly = style === "dots-only";
        
        const symbolsAt = config.survivalSymbolsAt || "censored";
        const pointsToMark = symbolsAt === "all" ? grp.data : grp.data.filter(d => d.isCensored);
        
        const showArea = (config.errorBars === "ci95" || config.errorBars === "se");
        const isSE = config.errorBars === "se";

        return (
          <Group key={grp.groupId}>
            {showArea && !isDotsOnly && (
              <Area<KMPoint>
                data={grp.data}
                x={d => xScale(d.time) ?? 0}
                y0={d => isSE ? (yScale(Math.max(0, d.survival - d.se)) ?? 0) : (yScale(d.ciLower) ?? 0)}
                y1={d => isSE ? (yScale(Math.min(1, d.survival + d.se)) ?? 0) : (yScale(d.ciUpper) ?? 0)}
                fill={color}
                fillOpacity={0.2}
                curve={isStaircase ? curveStepAfter : curveLinear}
              />
            )}
            {!isDotsOnly && (
              <LinePath<KMPoint>
                data={grp.data}
                x={d => xScale(d.time) ?? 0}
                y={d => yScale(d.survival) ?? 0}
                stroke={color}
                strokeWidth={2}
                curve={isStaircase ? curveStepAfter : curveLinear}
              />
            )}
            
            {/* Draw error bars if dots-only */}
            {isDotsOnly && showArea && grp.data.map((pt, idx) => (
              <line
                key={`err-${grp.groupId}-${idx}`}
                x1={xScale(pt.time) ?? 0}
                x2={xScale(pt.time) ?? 0}
                y1={isSE ? (yScale(Math.max(0, pt.survival - pt.se)) ?? 0) : (yScale(pt.ciLower) ?? 0)}
                y2={isSE ? (yScale(Math.min(1, pt.survival + pt.se)) ?? 0) : (yScale(pt.ciUpper) ?? 0)}
                stroke={color}
                strokeWidth={1.5}
                strokeOpacity={0.5}
              />
            ))}

            {/* Draw tick marks or dots for events */}
            {style !== "staircase" && pointsToMark.map((pt, idx) => {
              const cx = xScale(pt.time) ?? 0;
              const cy = yScale(pt.survival) ?? 0;
              if (style === "staircase-ticks") {
                return (
                  <line
                    key={`mark-${grp.groupId}-${idx}`}
                    x1={cx} x2={cx}
                    y1={cy - 5} y2={cy + 5}
                    stroke={color}
                    strokeWidth={1.5}
                  />
                );
              } else {
                return (
                  <Circle
                    key={`mark-${grp.groupId}-${idx}`}
                    cx={cx} cy={cy} r={pt.isCensored ? 3 : 4}
                    fill={pt.isCensored ? "none" : color}
                    stroke={color}
                    strokeWidth={1.5}
                  />
                );
              }
            })}
            
            {/* Legend Item */}
            {(config.showLegend !== false) && (
              <Group left={innerWidth - 120} top={i * 20}>
                <line x1={0} x2={20} y1={0} y2={0} stroke={color} strokeWidth={2} />
                <text x={30} y={4} fontSize={config.legendFontSize ?? config.fontSize ?? 12} fontFamily={config.fontFamily} fill="#333" alignmentBaseline="middle">{grp.name}</text>
              </Group>
            )}
          </Group>
        )
      })}
    </Group>
  )
}
