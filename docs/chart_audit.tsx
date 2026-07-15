/* StatLens headless chart audit — run from apps/web:  npx tsx chart_audit.tsx
   Flags per chartType: crash / invalid root (<div> or nested <svg> => blank in browser) /
   NaN in coords / blank (no data glyphs) / renders. Also lists enum entries with no component.
   Note: pass descriptives as an ARRAY [{group,...}] — that is the shape analysis_engine.py emits. */
;(globalThis as any).document = { createElement: () => ({ getContext: () => ({ set font(v){}, get font(){return ''}, measureText: (t:string) => ({ width:(t?.length||0)*6 }) }) }) }
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import * as Col from './src/charts/ColumnCharts'
import { HBoxChart, RangeDumbbellChart, CIForestChart } from './src/charts/HorizontalCategoryChart'

// Mirror GraphEngine's chartType routing. `undefined` = in the schema enum but no component.
const routes: Record<string, any> = {
  'bar-error': Col.BarErrorChart, 'box': Col.BoxChart, 'violin': Col.ViolinChart,
  'raincloud': Col.RaincloudChart, 'scatter': Col.ScatterChart, 'strip': Col.StripChart,
  'jitter': Col.JitterChart, 'swarm': Col.SwarmChart, 'h-box': HBoxChart,
  'range-dumbbell': RangeDumbbellChart, 'ci-forest': CIForestChart,
  'line-fit': undefined, 'km-step': undefined,
}
const col: any = { type: 'Column', columnGroups: [{id:'A',name:'A'},{id:'B',name:'B'},{id:'C',name:'C'}],
  data: [{A:4241,B:4068,C:3445},{A:4036,B:3995,C:3276},{A:4083,B:3997,C:3401},{A:4119,B:3882,C:3175}] }
const D = [
  {group:'A',n:4,mean:4120,median:4100,q1:4060,q3:4180,min:4036,max:4241,sem:40,sd:80,ci_lower:4040,ci_upper:4200},
  {group:'B',n:4,mean:3985,median:3996,q1:3960,q3:4030,min:3882,max:4068,sem:38,sd:76,ci_lower:3900,ci_upper:4070},
  {group:'C',n:4,mean:3324,median:3338,q1:3250,q3:3420,min:3175,max:3445,sem:55,sd:110,ci_lower:3200,ci_upper:3450},
]
const ar: any = { descriptives: D, coefficients: [
  {label:'const',estimate:-0.09,ci_low:-0.82,ci_high:0.64},{label:'A',estimate:1.01,ci_low:0.68,ci_high:1.35}] }
const cfg: any = { showLegend:true, showPoints:true, pointSize:4, jitterSeed:42, palette:'okabe-ito', significanceScale:'standard' }

console.log('chartType         status')
console.log('----------------- --------------------------------')
for (const [name, Comp] of Object.entries(routes)) {
  if (!Comp) { console.log(`${name.padEnd(17)} 🚫 no component (enum only)`); continue }
  try {
    const h = renderToStaticMarkup(React.createElement(Comp, { sheet: col, config: cfg, width: 800, height: 480, analysisResults: ar }))
    const invalidRoot = h.trim().startsWith('<div') || /^<svg/.test(h.trim())  // must be <g> inside GraphEngine's outer <svg>
    const glyphs = (h.match(/<(path|circle|rect)\b/g) || []).length
    const nan = /NaN|Infinity/.test(h)
    const status = invalidRoot ? '❌ invalid root (<div>/<svg> — blank in browser)'
      : nan ? '❌ NaN/Infinity in coords'
      : glyphs === 0 ? '⚠️ blank (axes only, no data glyphs)'
      : '✅ renders'
    console.log(`${name.padEnd(17)} ${status}  [glyphs=${glyphs}]`)
  } catch (e: any) { console.log(`${name.padEnd(17)} ❌ crash: ${e.message.slice(0,45)}`) }
}
