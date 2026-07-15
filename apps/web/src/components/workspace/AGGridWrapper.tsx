import { useMemo, useCallback, useState, useRef, useEffect } from "react"
import { AgGridReact } from "ag-grid-react"
import { ModuleRegistry, AllCommunityModule, themeQuartz, colorSchemeDark } from "ag-grid-community"
import type { ColDef, ColGroupDef, CellValueChangedEvent } from "ag-grid-community"
import "ag-grid-community/styles/ag-grid.css"
import type { DataSheet } from "@/types/workbook"
import { useTheme } from "@/components/theme-provider"

import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "@/components/ui/context-menu"

// Clipboard write that also works in NON-secure contexts (e.g. http://<LAN-IP>),
// where navigator.clipboard is undefined. Falls back to a hidden textarea + execCommand.
function writeToClipboard(text: string): void {
  // Synchronous execCommand FIRST: it works over plain HTTP (LAN IP) and, unlike an
  // awaited navigator.clipboard call, keeps the user-gesture context intact so the copy
  // actually fires. navigator.clipboard is only a best-effort async fallback.
  let ok = false;
  try {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.setAttribute("readonly", "");
    ta.style.position = "fixed";
    ta.style.left = "-9999px";
    ta.style.top = "0";
    document.body.appendChild(ta);
    const prev = document.activeElement as HTMLElement | null;
    ta.focus();
    ta.select();
    ok = document.execCommand("copy");
    document.body.removeChild(ta);
    prev?.focus?.();
  } catch { ok = false; }
  if (!ok && typeof navigator !== "undefined" && (navigator as any).clipboard) {
    try { (navigator as any).clipboard.writeText(text).catch(() => {}); } catch { /* ignore */ }
  }
  if (!ok) console.warn("[StatLens] clipboard copy via execCommand returned false");
}


ModuleRegistry.registerModules([AllCommunityModule])

// We will generate the theme dynamically inside the component

function getExcelColumnName(colIndex: number): string {
  let name = ""
  let temp = colIndex
  while (temp >= 0) {
    name = String.fromCharCode((temp % 26) + 65) + name
    temp = Math.floor(temp / 26) - 1
  }
  return name
}

function getColumnGroupsIncluding(fieldId: string, prevGroups: {id: string, name: string}[]) {
  if (prevGroups.some(g => g.id === fieldId)) return prevGroups;
  const newGroups = [...prevGroups]
  let i = 0
  while (true) {
    const name = getExcelColumnName(i)
    if (!newGroups.some(g => g.id === name)) {
      newGroups.push({ id: name, name: name })
    }
    if (name === fieldId) break
    i++
    if (i > 16384) break
  }
  return newGroups
}

const CustomHeader = (props: any) => {
  const [isEditing, setIsEditing] = useState(false)
  const [name, setName] = useState(props.displayName)
  const inputRef = useRef<HTMLInputElement>(null)
  const headerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus()
    }
  }, [isEditing])

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'F2' && !isEditing) {
        if (headerRef.current && headerRef.current.closest('.ag-header-cell:focus, .ag-header-cell:focus-within')) {
          e.preventDefault()
          e.stopPropagation()
          setIsEditing(true)
        }
      }
    }
    window.addEventListener('keydown', handleKeyDown, true) // capture phase
    return () => window.removeEventListener('keydown', handleKeyDown, true)
  }, [isEditing])

  const commit = () => {
    setIsEditing(false)
    if (name !== props.displayName) {
      props.setColumnName(props.column.getColId(), name)
    }
  }

  if (isEditing) {
    return (
      <input 
        ref={inputRef}
        value={name} 
        onChange={e => setName(e.target.value)} 
        onBlur={commit}
        onKeyDown={e => e.key === 'Enter' && commit()}
        className="w-full bg-background text-foreground border border-input rounded px-1 py-0.5 text-xs h-6 font-normal outline-none focus:ring-1 focus:ring-ring"
      />
    )
  }

  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>
        <div 
          ref={headerRef}
          className="w-full h-full flex items-center justify-between cursor-pointer group"
          onDoubleClick={(e) => {
            const rect = e.currentTarget.getBoundingClientRect()
            if (e.clientX > rect.right - 15) {
              e.preventDefault()
              e.stopPropagation()
              props.api.autoSizeColumn(props.column)
            } else {
              setIsEditing(true)
            }
          }}
          onMouseDown={() => {
            if (document.activeElement instanceof HTMLElement) {
              document.activeElement.blur()
            }
            if (props.api) {
              const cols = props.api.getAllGridColumns();
              const colIndex = cols.findIndex((c: any) => c.getColId() === props.column.getColId());
              props.setSelection({
                startRow: 0,
                endRow: props.api.getDisplayedRowCount() - 1,
                startColIndex: colIndex,
                endColIndex: colIndex
              });
            }
          }}
          title="Double click to rename. Right click for options. Click to select column."
        >
          <span className="truncate">{props.displayName}</span>
          <span className="opacity-0 group-hover:opacity-100 text-[10px] text-muted-foreground ml-1">✎</span>
        </div>
      </ContextMenuTrigger>
      <ContextMenuContent>
        <ContextMenuItem onClick={() => setTimeout(() => setIsEditing(true), 10)}>Rename</ContextMenuItem>
        <ContextMenuSeparator />
        <ContextMenuItem onClick={() => props.moveColumn(-1)}>Move Left</ContextMenuItem>
        <ContextMenuItem onClick={() => props.moveColumn(1)}>Move Right</ContextMenuItem>
        <ContextMenuSeparator />
        <ContextMenuItem onClick={() => props.duplicateColumn('left')}>Duplicate Left</ContextMenuItem>
        <ContextMenuItem onClick={() => props.duplicateColumn('right')}>Duplicate Right</ContextMenuItem>
        <ContextMenuSeparator />
        <ContextMenuItem className="text-destructive focus:bg-destructive/10 focus:text-destructive" onClick={() => props.deleteColumn()}>Delete</ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  )
}

const CustomHeaderGroup = (props: any) => {
  const [isEditing, setIsEditing] = useState(false)
  const [name, setName] = useState(props.displayName)
  const inputRef = useRef<HTMLInputElement>(null)
  const headerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus()
    }
  }, [isEditing])

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'F2' && !isEditing) {
        if (headerRef.current && headerRef.current.closest('.ag-header-group-cell:focus, .ag-header-group-cell:focus-within')) {
          e.preventDefault()
          e.stopPropagation()
          setIsEditing(true)
        }
      }
    }
    window.addEventListener('keydown', handleKeyDown, true)
    return () => window.removeEventListener('keydown', handleKeyDown, true)
  }, [isEditing])

  const commit = () => {
    setIsEditing(false)
    if (name !== props.displayName) {
      props.setColumnName(props.columnGroup.getGroupId(), name)
    }
  }

  if (isEditing) {
    return (
      <input 
        ref={inputRef}
        value={name} 
        onChange={e => setName(e.target.value)} 
        onBlur={commit}
        onKeyDown={e => e.key === 'Enter' && commit()}
        className="w-full bg-background text-foreground border border-input rounded px-1 py-0.5 text-xs h-6 font-normal outline-none focus:ring-1 focus:ring-ring"
      />
    )
  }

  return (
    <div 
      ref={headerRef}
      className="w-full h-full flex items-center justify-between cursor-pointer group"
      onDoubleClick={(e) => {
        const rect = e.currentTarget.getBoundingClientRect()
        if (e.clientX > rect.right - 15) {
          e.preventDefault()
          e.stopPropagation()
          const leafCols = props.columnGroup.getLeafColumns()
          props.api.autoSizeColumns(leafCols)
        } else {
          setIsEditing(true)
        }
      }}
      title="Double click to rename group. Double click right edge to auto-size."
    >
      <span className="truncate font-semibold">{props.displayName}</span>
      <span className="opacity-0 group-hover:opacity-100 text-[10px] text-muted-foreground ml-1">✎</span>
    </div>
  )
}

const RowHeaderCell = (props: any) => {
  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>
        <div 
          className="w-full h-full flex items-center justify-center cursor-pointer"
          onMouseDown={() => {
            if (props.api) {
              const cols = props.api.getAllGridColumns();
              props.setSelection({
                startRow: props.node.rowIndex,
                endRow: props.node.rowIndex,
                startColIndex: 1, // Skip row header col
                endColIndex: cols.length - 1
              });
            }
          }}
          title="Right click for options. Click to select row."
        >
          {props.value}
        </div>
      </ContextMenuTrigger>
      <ContextMenuContent>
        <ContextMenuItem onClick={() => props.moveRow(props.node.rowIndex, -1)}>Move Up</ContextMenuItem>
        <ContextMenuItem onClick={() => props.moveRow(props.node.rowIndex, 1)}>Move Down</ContextMenuItem>
        <ContextMenuSeparator />
        <ContextMenuItem onClick={() => props.duplicateRow(props.node.rowIndex, 'above')}>Duplicate Above</ContextMenuItem>
        <ContextMenuItem onClick={() => props.duplicateRow(props.node.rowIndex, 'below')}>Duplicate Below</ContextMenuItem>
        <ContextMenuSeparator />
        <ContextMenuItem className="text-destructive focus:bg-destructive/10 focus:text-destructive" onClick={() => props.deleteRow(props.node.rowIndex)}>Delete Row</ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  )
}

interface AGGridWrapperProps {
  sheet: DataSheet
  onUpdate: (updater: (prev: DataSheet) => DataSheet) => void
}// Global Undo/Redo tracking manually to fix AG Grid limitations and persist across unmounts
const globalUndoStacks = new Map<string, DataSheet[]>();
const globalRedoStacks = new Map<string, DataSheet[]>();
const globalSnapshotTimes = new Map<string, number>();

export function AGGridWrapper({ sheet, onUpdate }: AGGridWrapperProps) {
  const { theme } = useTheme()
  const gridRef = useRef<AgGridReact>(null)
  const [visibleRowCount, setVisibleRowCount] = useState(Math.max(100, sheet.data.length))
  const [visibleColCount, setVisibleColCount] = useState(Math.max(26, sheet.columnGroups.length))

  const gridTheme = useMemo(() => {
    const isDark = theme === "dark" || (theme === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches)
    const baseParams = {
      columnBorder: true,
      headerColumnBorder: true,
      headerColumnBorderHeight: "100%",
    }
    return isDark 
      ? themeQuartz.withPart(colorSchemeDark).withParams(baseParams)
      : themeQuartz.withParams(baseParams)
  }, [theme])

  // Custom Selection Engine
  const selectionRef = useRef<{startRow: number, endRow: number, startColIndex: number, endColIndex: number} | null>(null);
  const isDraggingRef = useRef(false);
  const latestSheetRef = useRef(sheet);

  useEffect(() => {
    latestSheetRef.current = sheet;
  }, [sheet]);

  const updateSelectionDOM = useCallback(() => {
    const sel = selectionRef.current;
    if (!sel) {
      document.querySelectorAll('.statlens-selected-cell').forEach(el => el.classList.remove('statlens-selected-cell'));
      return;
    }
    const api = gridRef.current?.api;
    if (!api) return;
    
    const cols = api.getAllGridColumns();
    const minRow = Math.min(sel.startRow, sel.endRow);
    const maxRow = Math.max(sel.startRow, sel.endRow);
    const minCol = Math.min(sel.startColIndex, sel.endColIndex);
    const maxCol = Math.max(sel.startColIndex, sel.endColIndex);

    const selectedColIds = new Set();
    for (let i = minCol; i <= maxCol; i++) {
        if (cols[i]) selectedColIds.add(cols[i].getColId());
    }

    document.querySelectorAll('.ag-cell').forEach(cell => {
        const rowIdx = parseInt(cell.parentElement?.getAttribute('row-index') || '-1');
        const colId = cell.getAttribute('col-id');
        if (rowIdx >= minRow && rowIdx <= maxRow && colId && selectedColIds.has(colId)) {
            cell.classList.add('statlens-selected-cell');
        } else {
            cell.classList.remove('statlens-selected-cell');
        }
    });
  }, []);

  const dispatchUpdate = useCallback((updater: (prev: DataSheet) => DataSheet) => {
    onUpdate(prev => {
      const next = updater(prev);
      const sheetId = prev.id;
      if (!globalUndoStacks.has(sheetId)) globalUndoStacks.set(sheetId, []);
      
      const stack = globalUndoStacks.get(sheetId)!;
      const lastSnapshotAt = globalSnapshotTimes.get(sheetId) || 0;
      const now = Date.now();
      
      // Always invalidate the redo stack on edit
      globalRedoStacks.set(sheetId, []);

      // Push to undo stack, rate limited
      if (now - lastSnapshotAt > 500) {
        stack.push(prev);
        if (stack.length > 50) stack.shift();
        globalSnapshotTimes.set(sheetId, now);
      }
      
      return next;
    });
  }, [onUpdate]);

  const executeCopy = useCallback(async () => {
    const api = gridRef.current?.api;
    if (!api || !selectionRef.current) return;
    const sel = selectionRef.current;
    const cols = api.getAllGridColumns();
    const minRow = Math.min(sel.startRow, sel.endRow);
    const maxRow = Math.max(sel.startRow, sel.endRow);
    const minCol = Math.min(sel.startColIndex, sel.endColIndex);
    const maxCol = Math.max(sel.startColIndex, sel.endColIndex);

    let tsv = "";
    for (let r = minRow; r <= maxRow; r++) {
      let rowText = [];
      for (let c = minCol; c <= maxCol; c++) {
        const colId = cols[c].getColId();
        const val = latestSheetRef.current.data[r]?.[colId] || "";
        rowText.push(val);
      }
      tsv += rowText.join("\t") + "\n";
    }
    writeToClipboard(tsv);
  }, []);

  const executeCut = useCallback(async () => {
    const api = gridRef.current?.api;
    if (!api || !selectionRef.current) return;
    const sel = selectionRef.current;
    const cols = api.getAllGridColumns();
    const minRow = Math.min(sel.startRow, sel.endRow);
    const maxRow = Math.max(sel.startRow, sel.endRow);
    const minCol = Math.min(sel.startColIndex, sel.endColIndex);
    const maxCol = Math.max(sel.startColIndex, sel.endColIndex);

    let tsv = "";
    dispatchUpdate(prev => {
      const newData = [...prev.data];
      for (let r = minRow; r <= maxRow; r++) {
        let rowText = [];
        if (!newData[r]) newData[r] = {};
        else newData[r] = { ...newData[r] };
        for (let c = minCol; c <= maxCol; c++) {
          const colId = cols[c].getColId();
          rowText.push(newData[r]?.[colId] || "");
          newData[r][colId] = "";
        }
        tsv += rowText.join("\t") + "\n";
      }
      return { ...prev, data: newData };
    });
    writeToClipboard(tsv);
  }, [dispatchUpdate]);

  const executeDelete = useCallback(() => {
    const api = gridRef.current?.api;
    if (!api || !selectionRef.current) return;
    const sel = selectionRef.current;
    const cols = api.getAllGridColumns();
    const minRow = Math.min(sel.startRow, sel.endRow);
    const maxRow = Math.max(sel.startRow, sel.endRow);
    const minCol = Math.min(sel.startColIndex, sel.endColIndex);
    const maxCol = Math.max(sel.startColIndex, sel.endColIndex);

    dispatchUpdate(prev => {
      const newData = [...prev.data];
      for (let r = minRow; r <= maxRow; r++) {
        if (!newData[r]) newData[r] = {};
        else newData[r] = { ...newData[r] };
        for (let c = minCol; c <= maxCol; c++) {
          const colId = cols[c].getColId();
          newData[r][colId] = "";
        }
      }
      return { ...prev, data: newData };
    });
  }, [dispatchUpdate]);

  const executePaste = useCallback(async () => {
    const api = gridRef.current?.api;
    if (!api) return;
    try {
      const text = await navigator.clipboard.readText();
      if (!text) return;
      const rows = text.split(/\r?\n/).map(row => row.split("\t"));
      
      let startRow = 0;
      let startCol = 0;
      
      if (selectionRef.current) {
         startRow = Math.min(selectionRef.current.startRow, selectionRef.current.endRow);
         startCol = Math.min(selectionRef.current.startColIndex, selectionRef.current.endColIndex);
      } else {
         const focusedCell = api.getFocusedCell();
         if (!focusedCell) return;
         startRow = focusedCell.rowIndex!;
         const cols = api.getAllGridColumns();
         startCol = cols.findIndex(c => c.getColId() === focusedCell.column.getColId());
      }

      dispatchUpdate(prev => {
        const newData = [...prev.data];
        const allCols = api.getAllGridColumns();
        let needsUpdate = false;
        
        rows.forEach((row, rIdx) => {
          if (row.length === 1 && row[0] === "") return;
          const targetRowIndex = startRow + rIdx;
          while (newData.length <= targetRowIndex) {
            newData.push({});
          }
          newData[targetRowIndex] = { ...newData[targetRowIndex] };
          row.forEach((cellValue, cIdx) => {
            const targetColIndex = startCol + cIdx;
            if (targetColIndex < allCols.length) {
              const colId = allCols[targetColIndex].getColId();
              if (colId !== "") {
                newData[targetRowIndex][colId] = cellValue;
                needsUpdate = true;
              }
            }
          });
        });
        
        return needsUpdate ? { ...prev, data: newData } : prev;
      });
    } catch (err) {
      console.error("Paste failed", err);
    }
  }, [dispatchUpdate]);

  // Global Clipboard & Key commands
  useEffect(() => {
    const handleKeyDown = async (e: KeyboardEvent) => {
      if (document.activeElement?.tagName === "INPUT" || document.activeElement?.tagName === "TEXTAREA") {
        return;
      }
      
      const ctrl = e.ctrlKey || e.metaKey;
      const api = gridRef.current?.api;
      if (!api) return;

      // Let the browser copy natively when the user has selected regular text OUTSIDE the grid
      // (results panel, interpretation, etc.). Only intercept Ctrl+C for in-grid cell copies.
      if (ctrl && e.key.toLowerCase() === 'c') {
        const winSel = window.getSelection();
        if (winSel && !winSel.isCollapsed && winSel.toString().trim().length > 0) {
          const an = winSel.anchorNode;
          const anEl = an ? (an.nodeType === 1 ? (an as HTMLElement) : an.parentElement) : null;
          if (!anEl?.closest?.(".ag-root-wrapper")) {
            return; // native copy of selected page text
          }
        }
      }

      // Undo
      if (ctrl && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        const sheetId = latestSheetRef.current.id;
        const undoStack = globalUndoStacks.get(sheetId) || [];
        const redoStack = globalRedoStacks.get(sheetId) || [];
        
        if (undoStack.length > 0) {
          const prevState = undoStack.pop()!;
          redoStack.push(JSON.parse(JSON.stringify(latestSheetRef.current)));
          globalUndoStacks.set(sheetId, undoStack);
          globalRedoStacks.set(sheetId, redoStack);
          onUpdate(() => prevState);
        }
        return;
      }
      // Redo
      if (ctrl && e.key.toLowerCase() === 'y') {
        e.preventDefault();
        const sheetId = latestSheetRef.current.id;
        const undoStack = globalUndoStacks.get(sheetId) || [];
        const redoStack = globalRedoStacks.get(sheetId) || [];
        
        if (redoStack.length > 0) {
          const nextState = redoStack.pop()!;
          undoStack.push(JSON.parse(JSON.stringify(latestSheetRef.current)));
          globalUndoStacks.set(sheetId, undoStack);
          globalRedoStacks.set(sheetId, redoStack);
          onUpdate(() => nextState);
        }
        return;
      }

      // Copy
      if (ctrl && e.key.toLowerCase() === 'c') {
        e.preventDefault();
        await executeCopy();
      }

      // Cut
      if (ctrl && e.key.toLowerCase() === 'x') {
        e.preventDefault();
        await executeCut();
      }

      // Delete
      if (e.key === 'Backspace' || e.key === 'Delete') {
        e.preventDefault();
        executeDelete();
      }

      // Arrow keys with Shift
      if (e.shiftKey && ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
        e.preventDefault();
        if (!selectionRef.current) {
           const focused = api.getFocusedCell();
           if (!focused) return;
           const cols = api.getAllGridColumns();
           const colIndex = cols.findIndex(c => c.getColId() === focused.column.getColId());
           selectionRef.current = {
             startRow: focused.rowIndex!, endRow: focused.rowIndex!,
             startColIndex: colIndex, endColIndex: colIndex
           };
        }
        
        const sel = selectionRef.current;
        const cols = api.getAllGridColumns();
        
        if (e.key === 'ArrowUp') {
           sel.endRow = Math.max(0, sel.endRow - 1);
        } else if (e.key === 'ArrowDown') {
           sel.endRow = Math.min(api.getDisplayedRowCount() - 1, sel.endRow + 1);
        } else if (e.key === 'ArrowLeft') {
           sel.endColIndex = Math.max(1, sel.endColIndex - 1); // skip row header
        } else if (e.key === 'ArrowRight') {
           sel.endColIndex = Math.min(cols.length - 1, sel.endColIndex + 1);
        }
        updateSelectionDOM();
        api.ensureIndexVisible(sel.endRow);
        api.ensureColumnVisible(cols[sel.endColIndex]);
        return;
      }

      // Arrow keys without Shift
      if (!e.shiftKey && ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
         selectionRef.current = null;
         updateSelectionDOM();
      }
    };
    
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onUpdate, executeCopy, executeCut, executeDelete]);

  // Paste Support
  useEffect(() => {
    const handlePaste = async (e: ClipboardEvent) => {
      if (document.activeElement?.tagName === "INPUT" || document.activeElement?.tagName === "TEXTAREA") {
        return;
      }
      const api = gridRef.current?.api;
      if (!api) return;

      const text = e.clipboardData?.getData("text");
      if (!text) return;
      e.preventDefault();

      const rows = text.split(/\r?\n/).map(row => row.split("\t"));
      
      let startRow = 0;
      let startCol = 0;
      
      if (selectionRef.current) {
         startRow = Math.min(selectionRef.current.startRow, selectionRef.current.endRow);
         startCol = Math.min(selectionRef.current.startColIndex, selectionRef.current.endColIndex);
      } else {
         const focusedCell = api.getFocusedCell();
         if (!focusedCell) return;
         startRow = focusedCell.rowIndex!;
         const cols = api.getAllGridColumns();
         startCol = cols.findIndex(c => c.getColId() === focusedCell.column.getColId());
      }

      dispatchUpdate(prev => {
        const newData = [...prev.data];
        const allCols = api.getAllGridColumns();
        let needsUpdate = false;
        
        rows.forEach((row, rIdx) => {
          if (row.length === 1 && row[0] === "") return; // skip empty trailing
          const targetRowIndex = startRow + rIdx;
          while (newData.length <= targetRowIndex) {
            newData.push({});
          }
          newData[targetRowIndex] = { ...newData[targetRowIndex] }; // ensure clone
          row.forEach((cellValue, cIdx) => {
            const targetColIndex = startCol + cIdx;
            if (targetColIndex < allCols.length) {
              const colId = allCols[targetColIndex].getColId();
              if (colId !== "") { // skip header
                newData[targetRowIndex][colId] = cellValue;
                needsUpdate = true;
              }
            }
          });
        });
        
        return needsUpdate ? { ...prev, data: newData } : prev;
      });
    };
    document.addEventListener("paste", handlePaste);
    return () => document.removeEventListener("paste", handlePaste);
  }, [dispatchUpdate]);

  // DOM Drag Listeners
  useEffect(() => {
    const up = () => { isDraggingRef.current = false; };
    window.addEventListener('mouseup', up);
    return () => window.removeEventListener('mouseup', up);
  }, []);

  const onCellMouseDown = useCallback((e: any) => {
    if (e.event?.button !== 0) return;
    if (e.column.getColId() === "") return;
    const cols = e.api.getAllGridColumns();
    const colIndex = cols.findIndex((c: any) => c.getColId() === e.column.getColId());
    selectionRef.current = { startRow: e.rowIndex, endRow: e.rowIndex, startColIndex: colIndex, endColIndex: colIndex };
    isDraggingRef.current = true;
    updateSelectionDOM();
  }, [updateSelectionDOM]);

  const onCellMouseOver = useCallback((e: any) => {
    if (!isDraggingRef.current || !selectionRef.current) return;
    if (e.column.getColId() === "") return;
    const cols = e.api.getAllGridColumns();
    const colIndex = cols.findIndex((c: any) => c.getColId() === e.column.getColId());
    selectionRef.current.endRow = e.rowIndex;
    selectionRef.current.endColIndex = colIndex;
    updateSelectionDOM();
  }, [updateSelectionDOM]);

  const columnDefs = useMemo(() => {
    const cols: (ColDef | ColGroupDef)[] = []
    
    cols.push({
      headerName: "",
      valueGetter: "node.rowIndex + 1",
      pinned: "left",
      width: 60,
      editable: false,
      sortable: false,
      suppressMovable: true,
      cellStyle: { backgroundColor: "var(--ag-header-background-color)", color: "var(--ag-header-foreground-color)", textAlign: "center", fontWeight: "bold" },
      cellRenderer: RowHeaderCell,
      cellRendererParams: {
        setSelection: (sel: any) => {
          selectionRef.current = sel;
          updateSelectionDOM();
        },
        moveRow: (rowIndex: number, dir: number) => {
          dispatchUpdate(prev => {
            if (rowIndex < 0 || rowIndex >= prev.data.length) return prev;
            const newIdx = rowIndex + dir;
            if (newIdx < 0 || newIdx >= prev.data.length) return prev;
            const newData = [...prev.data];
            const temp = newData[rowIndex];
            newData[rowIndex] = newData[newIdx];
            newData[newIdx] = temp;
            return { ...prev, data: newData };
          })
        },
        duplicateRow: (rowIndex: number, side: 'above' | 'below') => {
          dispatchUpdate(prev => {
            if (rowIndex < 0 || rowIndex >= prev.data.length) return prev;
            const newData = [...prev.data];
            newData.splice(side === 'above' ? rowIndex : rowIndex + 1, 0, { ...newData[rowIndex] });
            return { ...prev, data: newData };
          })
        },
        deleteRow: (rowIndex: number) => {
          dispatchUpdate(prev => {
            if (rowIndex < 0 || rowIndex >= prev.data.length) return prev;
            const newData = [...prev.data];
            newData.splice(rowIndex, 1);
            return { ...prev, data: newData };
          })
        }
      }
    })
    
    const hasRowTitles = ["XY", "Grouped", "Contingency", "Survival", "PartsOfWhole"].includes(sheet.type)
    
    if (hasRowTitles) {
      cols.push({
        headerName: sheet.type === "XY" ? "X Values" : (sheet.type === "Survival" ? "Time" : "Row Title"),
        field: "rowTitle",
        editable: true,
        pinned: "left",
        width: 150
      })
    }

    const createColDef = (id: string, name: string) => ({
      headerName: name,
      field: id,
      editable: true,
      width: 120,
      headerComponent: CustomHeader,
      headerComponentParams: {
        setSelection: (sel: any) => {
          selectionRef.current = sel;
          updateSelectionDOM();
        },
        setColumnName: (colId: string, newName: string) => {
          dispatchUpdate(prev => {
            const exists = prev.columnGroups.find(g => g.id === colId)
            if (exists) {
              return { ...prev, columnGroups: prev.columnGroups.map(g => g.id === colId ? { ...g, name: newName } : g) }
            } else {
              return { ...prev, columnGroups: [...prev.columnGroups, { id: colId, name: newName }] }
            }
          })
        },
        moveColumn: (dir: number) => {
          dispatchUpdate(prev => {
            const idx = prev.columnGroups.findIndex(g => g.id === id)
            if (idx < 0) return prev
            const newIdx = idx + dir
            if (newIdx < 0 || newIdx >= prev.columnGroups.length) return prev
            const newCols = [...prev.columnGroups]
            const temp = newCols[idx]
            newCols[idx] = newCols[newIdx]
            newCols[newIdx] = temp
            return { ...prev, columnGroups: newCols }
          })
        },
        duplicateColumn: (side: 'left' | 'right') => {
          dispatchUpdate(prev => {
            const idx = prev.columnGroups.findIndex(g => g.id === id)
            if (idx < 0) return prev
            const newId = crypto.randomUUID()
            const newCol = { id: newId, name: `${name} Copy` }
            const newCols = [...prev.columnGroups]
            newCols.splice(side === 'left' ? idx : idx + 1, 0, newCol)
            const newData = prev.data.map(row => ({ ...row, [newId]: row[id] }))
            return { ...prev, columnGroups: newCols, data: newData }
          })
        },
        deleteColumn: () => {
          dispatchUpdate(prev => {
            const newData = prev.data.map(row => {
              const newRow = { ...row }
              delete newRow[id]
              return newRow
            })
            return { 
              ...prev, 
              columnGroups: prev.columnGroups.filter(g => g.id !== id),
              data: newData
            }
          })
        }
      },
      type: "numericColumn",
      valueParser: (params: any) => {
        if (params.newValue === null || params.newValue === "") return null
        const num = Number(params.newValue)
        return isNaN(num) ? params.newValue : num
      }
    })

    const replicates = (sheet.config as any)?.config?.replicates || (sheet.config as any)?.config?.subcolumns || 1

    sheet.columnGroups.forEach(group => {
      if (replicates > 1) {
        const children = []
        for (let r = 1; r <= replicates; r++) {
          children.push(createColDef(`${group.id}_${r}`, `Y${r}`))
        }
        cols.push({
          headerName: group.name,
          groupId: group.id,
          children: children,
          headerGroupComponent: CustomHeaderGroup,
          headerGroupComponentParams: {
            setColumnName: (colId: string, newName: string) => {
              dispatchUpdate(prev => {
                const exists = prev.columnGroups.find(g => g.id === colId)
                if (exists) {
                  return { ...prev, columnGroups: prev.columnGroups.map(g => g.id === colId ? { ...g, name: newName } : g) }
                }
                return prev
              })
            }
          }
        })
      } else {
        cols.push(createColDef(group.id, group.name))
      }
    })

    let generatedCount = 0
    while (cols.length < visibleColCount + (hasRowTitles ? 1 : 0)) {
      let colId = getExcelColumnName(generatedCount)
      while (sheet.columnGroups.some(g => g.id === colId)) {
        generatedCount++
        colId = getExcelColumnName(generatedCount)
      }
      
      if (replicates > 1) {
        const children = []
        for (let r = 1; r <= replicates; r++) {
          children.push(createColDef(`${colId}_${r}`, `Y${r}`))
        }
        cols.push({
          headerName: colId,
          groupId: colId,
          children: children,
          headerGroupComponent: CustomHeaderGroup,
          headerGroupComponentParams: {
            setColumnName: (cid: string, newName: string) => {
              dispatchUpdate(prev => {
                const exists = prev.columnGroups.find(g => g.id === cid)
                if (exists) {
                  return { ...prev, columnGroups: prev.columnGroups.map(g => g.id === cid ? { ...g, name: newName } : g) }
                }
                return { ...prev, columnGroups: [...prev.columnGroups, { id: cid, name: newName }] }
              })
            }
          }
        })
      } else {
        cols.push(createColDef(colId, colId))
      }
      generatedCount++
    }
    
    return cols
  }, [sheet.type, sheet.columnGroups, visibleColCount, dispatchUpdate, updateSelectionDOM])

  const defaultColDef = useMemo(() => {
    return {
      resizable: true,
      sortable: false,
      suppressMovable: true,
      suppressKeyboardEvent: (params: any) => {
        const e = params.event;
        const key = e.key;
        const ctrl = e.ctrlKey || e.metaKey;
        // Suppress AG Grid's native interceptors for our custom bindings
        if (ctrl && ['c', 'v', 'x', 'z', 'y'].includes(key.toLowerCase())) return true;
        if (key === 'Backspace' || key === 'Delete') return true;
        if (e.shiftKey && ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(key)) return true;
        return false; // Let Arrow Keys through perfectly!
      }
    }
  }, [])

  const onCellValueChanged = useCallback((event: CellValueChangedEvent) => {
    const field = event.colDef.field
    const rowIndex = event.node.rowIndex
    if (rowIndex === null || !field) return

    dispatchUpdate(prev => {
      const baseField = field.includes('_') ? field.split('_')[0] : field
      const newColumnGroups = getColumnGroupsIncluding(baseField, prev.columnGroups)
      const newData = [...prev.data]
      while (newData.length <= rowIndex) {
        newData.push({})
      }
      newData[rowIndex] = { ...newData[rowIndex], [field]: event.newValue }
      return { ...prev, data: newData, columnGroups: newColumnGroups }
    })
  }, [dispatchUpdate])

  const onBodyScroll = useCallback((event: any) => {
    const lastRow = event.api.getLastDisplayedRow()
    if (lastRow >= visibleRowCount - 15) {
      setVisibleRowCount(prev => Math.min(prev + 50, 1048576))
    }
    
    const { right } = event.api.getHorizontalPixelRange()
    const estimatedWidth = visibleColCount * 120
    if (right >= estimatedWidth - 300) {
      setVisibleColCount(prev => Math.min(prev + 25, 16384))
    }
    updateSelectionDOM(); // re-apply styling since cells get recycled
  }, [visibleRowCount, visibleColCount, updateSelectionDOM])

  const onCellFocused = useCallback((event: any) => {
    if (event.rowIndex !== null && event.rowIndex >= visibleRowCount - 5) {
      setVisibleRowCount(prev => Math.min(prev + 25, 1048576))
    }
    if (event.column) {
      const allCols = event.api.getAllGridColumns()
      const colIndex = allCols.indexOf(event.column)
      if (colIndex >= visibleColCount - 3) {
        setVisibleColCount(prev => Math.min(prev + 10, 16384))
      }
    }
  }, [visibleRowCount, visibleColCount])

  const rowData = useMemo(() => {
    const data = [...sheet.data]
    while (data.length < visibleRowCount) {
      data.push({})
    }
    // ensure stable id for ag-grid performance
    return data.map((row, idx) => {
      if (row._rowId === undefined) {
        row._rowId = crypto.randomUUID()
      }
      return row
    })
  }, [sheet.data, visibleRowCount])

  const getRowId = useCallback((params: any) => params.data._rowId, []);

  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>
        <div style={{ height: "100%", width: "100%" }} className="select-none">
          <AgGridReact
            ref={gridRef}
            theme={gridTheme}
            rowData={rowData}
            getRowId={getRowId}
            columnDefs={columnDefs}
            defaultColDef={defaultColDef}
            onCellValueChanged={onCellValueChanged}
            onBodyScroll={onBodyScroll}
            onCellFocused={onCellFocused}
            onCellMouseDown={onCellMouseDown}
            onCellMouseOver={onCellMouseOver}
            stopEditingWhenCellsLoseFocus={true}
            copyHeadersToClipboard={false}
            enterNavigatesVertically={true}
            suppressRowHoverHighlight={true}
          />
        </div>
      </ContextMenuTrigger>
      <ContextMenuContent>
        <ContextMenuItem onClick={executeCut}>Cut</ContextMenuItem>
        <ContextMenuItem onClick={executeCopy}>Copy</ContextMenuItem>
        <ContextMenuItem onClick={executePaste}>Paste</ContextMenuItem>
        <ContextMenuItem className="text-destructive focus:bg-destructive/10 focus:text-destructive" onClick={executeDelete}>Delete</ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  )
}
