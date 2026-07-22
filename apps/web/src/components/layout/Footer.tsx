import React from "react"
import { Code, Mail } from "lucide-react"

export function Footer() {
  return (
    <footer className="w-full border-t border-border bg-muted/20 py-6 px-4 shrink-0 mt-auto font-bold">
      <div className="max-w-7xl mx-auto flex flex-col gap-4 text-sm text-muted-foreground text-center sm:text-left">
        <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
          <div>
            <p className="text-foreground">Created By Rohan Alag</p>
            <p>PhD Scholar, Prof. Mahendra Sonawane Lab, TIFR Mumbai.</p>
            <div className="flex items-center gap-4 mt-2 justify-center sm:justify-start">
              <a href="mailto:alag.rohan@gmail.com" className="flex items-center gap-1.5 hover:text-foreground transition-colors">
                <Mail className="w-4 h-4" />
                alag.rohan@gmail.com
              </a>
              <a href="https://github.com/ronnyallen/statlens" target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 hover:text-foreground transition-colors">
                <Code className="w-4 h-4" />
                GitHub Repository
              </a>
            </div>
          </div>
          <div className="text-center sm:text-right">
            <p>StatLens is open source under the MIT licence.</p>
            <p>Contributions, bug reports and feature requests are all welcome.</p>
          </div>
        </div>
        
        <div className="border-t border-border/50 pt-4 mt-2 text-xs">
          <p>
            Built on the shoulders of{" "}
            <a href="https://pyodide.org/" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline font-medium">Pyodide</a>,{" "}
            <a href="https://scipy.org/" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline font-medium">SciPy</a>,{" "}
            <a href="https://www.statsmodels.org/" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline font-medium">statsmodels</a>,{" "}
            <a href="https://pingouin-stats.org/" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline font-medium">pingouin</a>,{" "}
            <a href="https://scikit-posthocs.readthedocs.io/" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline font-medium">scikit-posthocs</a>,{" "}
            <a href="https://lifelines.readthedocs.io/" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline font-medium">lifelines</a>,{" "}
            <a href="https://airbnb.io/visx/" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline font-medium">visx</a>, and{" "}
            <a href="https://www.ag-grid.com/" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline font-medium">AG Grid</a>.
          </p>
        </div>
      </div>
    </footer>
  )
}
