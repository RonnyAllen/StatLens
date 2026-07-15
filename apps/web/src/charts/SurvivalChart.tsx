import React, { useMemo } from "react"
import { scaleLinear } from "@visx/scale"
import { Group } from "@visx/group"
import { LinePath, Area } from "@visx/shape"
import { curveStepAfter } from "@visx/curve"
import { AxisLeft, AxisBottom } from "@visx/axis"
import type { DataSheet, GraphConfig } from "@/types/workbook"

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
}

function calculateKM(times: number[], events: number[]): KMPoint[] {
  const data = times.map((t, i) => ({ t, e: events[i] })).sort((a, b) => a.t - b.t)
  
  let currentS = 1
  let atRisk = data.length
  let sumVar = 0
  const result: KMPoint[] = [{ time: 0, survival: 1, nRisk: atRisk, nEvents: 0, nCensored: 0, isCensored: false, ciLower: 1, ciUpper: 1 }]
  
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
      
      result.push({ time: t, survival: currentS, nRisk: atRisk, nEvents: d, nCensored: c, isCensored: false, ciLower, ciUpper })
    }
    
    if (c > 0) {
      // Add a censored point to the curve, but S(t) does not drop due to censoring
      const se = currentS * Math.sqrt(sumVar)
      const ciLower = Math.max(0, currentS - 1.96 * se)
      const ciUpper = Math.min(1, currentS + 1.96 * se)
      result.push({ time: t, survival: currentS, nRisk: atRisk, nEvents: 0, nCensored: c, isCensored: true, ciLower, ciUpper })
    }
    
    atRisk -= (d + c)
  }
  return result
}

const colorPalette = [
  "#2563eb", "#dc2626", "#16a34a", "#9333ea", "#ea580c", 
  "#0891b2", "#be123c", "#4f46e5", "#ca8a04", "#0f766e"
]

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
        label="Time" 
        stroke="#333" 
        tickStroke="#333"
        labelProps={{ dy: 40, fill: '#333', fontSize: 14, textAnchor: 'middle' }}
      />
      <AxisLeft 
        scale={yScale} 
        label="Probability of Survival" 
        stroke="#333" 
        tickStroke="#333"
        labelProps={{ dx: -40, fill: '#333', fontSize: 14, textAnchor: 'middle' }}
      />

      {groupsData.results.map((grp, i) => {
        const color = colorPalette[i % colorPalette.length]
        
        const censoredPoints = grp.data.filter(d => d.isCensored)
        
        return (
          <Group key={grp.groupId}>
            {config.errorBars && (
              <Area<KMPoint>
                data={grp.data}
                x={d => xScale(d.time) ?? 0}
                y0={d => yScale(d.ciLower) ?? 0}
                y1={d => yScale(d.ciUpper) ?? 0}
                fill={color}
                fillOpacity={0.2}
                curve={curveStepAfter}
              />
            )}
            <LinePath<KMPoint>
              data={grp.data}
              x={d => xScale(d.time) ?? 0}
              y={d => yScale(d.survival) ?? 0}
              stroke={color}
              strokeWidth={2}
              curve={curveStepAfter}
            />
            {/* Draw tick marks for censored events */}
            {censoredPoints.map((pt, idx) => (
              <line
                key={`censor-${grp.groupId}-${idx}`}
                x1={(xScale(pt.time) ?? 0)}
                x2={(xScale(pt.time) ?? 0)}
                y1={(yScale(pt.survival) ?? 0) - 5}
                y2={(yScale(pt.survival) ?? 0) + 5}
                stroke={color}
                strokeWidth={1.5}
              />
            ))}
            
            {/* Legend Item */}
            <Group left={innerWidth - 120} top={i * 20}>
              <line x1={0} x2={20} y1={0} y2={0} stroke={color} strokeWidth={2} />
              <text x={30} y={4} fontSize={12} fill="#333" alignmentBaseline="middle">{grp.name}</text>
            </Group>
          </Group>
        )
      })}
    </Group>
  )
}
