import React from "react";
import { Group } from "@visx/group";
import { assignBracketTiers, getPValueStar } from "./geometry/significance";
import type { SignificanceScale, Comparison } from "./geometry/significance";

interface SignificanceLayerProps {
  comparisons: Comparison[];
  groupOrder: string[];
  xScale: (group: string) => number;
  yScale: (val: number) => number;
  dataMax: number;
  scale?: SignificanceScale;
  bracketHeight?: number;
  tierHeight?: number;
  showNs?: boolean;
  fontFamily?: string;
  fontSize?: number;
  pValueFontSize?: number;
}

export function SignificanceLayer({
  comparisons,
  groupOrder,
  xScale,
  yScale,
  dataMax,
  scale = "standard",
  bracketHeight = 5,
  tierHeight = 25,
  showNs = true,
  fontFamily = "Georgia, serif",
  fontSize = 12,
  pValueFontSize
}: SignificanceLayerProps) {
  const finalFontSize = pValueFontSize || (scale === "raw" ? fontSize : fontSize + 2);
  const significant = showNs ? comparisons : comparisons.filter(c => c.p_value <= 0.05);
  if (significant.length === 0) return null;

  const tiered = assignBracketTiers(significant, groupOrder);
  const baseY = yScale(dataMax) - 20;
  const actualTierHeight = tierHeight;

  return (
    <Group className="significance-layer">
      {tiered.map((comp, i) => {
        const x1 = xScale(comp.group1);
        const x2 = xScale(comp.group2);
        
        if (x1 === undefined || x2 === undefined) return null;
        
        const startX = Math.min(x1, x2);
        const endX = Math.max(x1, x2);
        const midX = (startX + endX) / 2;
        
        const tierY = baseY - (comp.tier * actualTierHeight);
        const starStr = getPValueStar(comp.p_value, scale);

        return (
          <Group key={i}>
            <path
              d={`M ${startX} ${tierY + bracketHeight} 
                  L ${startX} ${tierY} 
                  L ${endX} ${tierY} 
                  L ${endX} ${tierY + bracketHeight}`}
              stroke="black"
              strokeWidth={1}
              fill="transparent"
            />
            <text
              x={midX}
              y={tierY - 2}
              textAnchor="middle"
              fontSize={finalFontSize}
              fontFamily={fontFamily}
              fill="black"
              fontWeight={scale === "raw" ? "normal" : "bold"}
              fontStyle={scale === "raw" ? "italic" : "normal"}
            >
              {starStr}
            </text>
          </Group>
        );
      })}
    </Group>
  );
}
