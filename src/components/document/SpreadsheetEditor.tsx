import React, { useState } from 'react';
import * as XLSX from 'xlsx';
import { Plus, Trash2, FileSpreadsheet, Download, Upload } from 'lucide-react';

export const SpreadsheetEditor: React.FC = () => {
  const [gridData, setGridData] = useState<any[][]>([
    ['Product', 'Category', 'Price', 'Stock'],
    ['Scanner App', 'Software', '9.99', '150'],
    ['PDF Converter Pro', 'Software', '19.99', '80'],
    ['OCR Premium Plug', 'Plugin', '4.99', '210'],
  ]);
  const [fileName, setFileName] = useState('Untitled Spreadsheet');

  // Handle file import
  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setFileName(file.name.replace(/\.[^/.]+$/, ''));

    const reader = new FileReader();
    reader.onload = (evt) => {
      const bstr = evt.target?.result;
      const wb = XLSX.read(bstr, { type: 'binary' });
      const wsname = wb.SheetNames[0];
      const ws = wb.Sheets[wsname];
      const data = XLSX.utils.sheet_to_json(ws, { header: 1 }) as any[][];
      
      // Ensure at least a 4x4 grid
      if (data.length > 0) {
        setGridData(data);
      }
    };
    reader.readAsBinaryString(file);
  };

  // Handle cell edit
  const handleCellChange = (rowIndex: number, colIndex: number, value: string) => {
    const newData = gridData.map((row, rIdx) => {
      if (rIdx === rowIndex) {
        return row.map((cell, cIdx) => (cIdx === colIndex ? value : cell));
      }
      return row;
    });
    setGridData(newData);
  };

  // Add row
  const addRow = () => {
    const numCols = gridData[0]?.length || 4;
    const newRow = Array(numCols).fill('');
    setGridData([...gridData, newRow]);
  };

  // Add column
  const addColumn = () => {
    const newData = gridData.map(row => [...row, '']);
    setGridData(newData);
  };

  // Delete row
  const deleteRow = (rowIndex: number) => {
    if (gridData.length <= 1) return; // Keep at least one row
    const newData = gridData.filter((_, idx) => idx !== rowIndex);
    setGridData(newData);
  };

  // Delete column
  const deleteColumn = (colIndex: number) => {
    if (gridData[0].length <= 1) return; // Keep at least one column
    const newData = gridData.map(row => row.filter((_, idx) => idx !== colIndex));
    setGridData(newData);
  };

  // Export to XLSX or CSV
  const handleExport = (format: 'xlsx' | 'csv') => {
    const ws = XLSX.utils.aoa_to_sheet(gridData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Sheet1');

    if (format === 'xlsx') {
      XLSX.writeFile(wb, `${fileName}.xlsx`);
    } else {
      const csvOutput = XLSX.utils.sheet_to_csv(ws);
      const blob = new Blob([csvOutput], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.setAttribute('href', url);
      link.setAttribute('download', `${fileName}.csv`);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };

  // Helper to get column letter (A, B, C...)
  const getColLabel = (index: number): string => {
    let label = '';
    let temp = index;
    while (temp >= 0) {
      label = String.fromCharCode((temp % 26) + 65) + label;
      temp = Math.floor(temp / 26) - 1;
    }
    return label;
  };

  return (
    <div className="bg-surface-variant/20 rounded-3xl p-6 border border-surface-variant/50 shadow-sm">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        <div>
          <input
            type="text"
            value={fileName}
            onChange={(e) => setFileName(e.target.value)}
            className="text-xl font-bold bg-transparent border-b border-transparent hover:border-outline focus:border-primary focus:outline-none px-1 py-0.5 text-on-surface"
          />
          <p className="text-sm text-outline mt-1">Spreadsheet Grid Editor</p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Import Button */}
          <label className="flex items-center gap-2 px-4 py-2 bg-secondary/10 hover:bg-secondary/25 text-primary rounded-full cursor-pointer transition text-sm font-medium">
            <Upload size={16} />
            <span>Import</span>
            <input
              type="file"
              accept=".csv,.xlsx,.xls"
              onChange={handleImport}
              className="hidden"
            />
          </label>

          {/* Export CSV */}
          <button
            onClick={() => handleExport('csv')}
            className="flex items-center gap-2 px-4 py-2 bg-secondary/10 hover:bg-secondary/25 text-primary rounded-full transition text-sm font-medium"
          >
            <Download size={16} />
            <span>CSV</span>
          </button>

          {/* Export Excel */}
          <button
            onClick={() => handleExport('xlsx')}
            className="flex items-center gap-2 px-4 py-2 bg-primary text-on-primary hover:bg-primary/90 rounded-full transition text-sm font-medium shadow-sm"
          >
            <FileSpreadsheet size={16} />
            <span>Excel</span>
          </button>
        </div>
      </div>

      {/* Toolbar for grid modification */}
      <div className="flex flex-wrap items-center gap-2 mb-4">
        <button
          onClick={addRow}
          className="flex items-center gap-1.5 px-3 py-1.5 border border-outline/30 hover:bg-surface-variant/40 rounded-lg text-xs font-medium text-on-surface transition"
        >
          <Plus size={14} />
          Add Row
        </button>
        <button
          onClick={addColumn}
          className="flex items-center gap-1.5 px-3 py-1.5 border border-outline/30 hover:bg-surface-variant/40 rounded-lg text-xs font-medium text-on-surface transition"
        >
          <Plus size={14} />
          Add Column
        </button>
      </div>

      {/* Spreadsheet Container */}
      <div className="overflow-auto border border-outline/20 rounded-2xl max-h-[500px]">
        <table className="w-full border-collapse text-left text-sm">
          <thead>
            <tr className="bg-surface-variant/60">
              <th className="w-12 border border-outline/20 p-2 text-center text-xs font-semibold text-outline"></th>
              {gridData[0]?.map((_, colIdx) => (
                <th key={colIdx} className="border border-outline/20 p-2 text-center font-semibold text-on-surface-variant min-w-[120px]">
                  <div className="flex items-center justify-between px-1">
                    <span>{getColLabel(colIdx)}</span>
                    <button
                      onClick={() => deleteColumn(colIdx)}
                      className="text-outline hover:text-error transition"
                      title="Delete Column"
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {gridData.map((row, rowIdx) => (
              <tr key={rowIdx} className="hover:bg-surface-variant/20 transition">
                <td className="border border-outline/20 p-2 text-center bg-surface-variant/30 text-xs font-semibold text-outline">
                  <div className="flex items-center justify-between">
                    <span>{rowIdx + 1}</span>
                    <button
                      onClick={() => deleteRow(rowIdx)}
                      className="text-outline hover:text-error transition"
                      title="Delete Row"
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                </td>
                {row.map((cell, colIdx) => (
                  <td key={colIdx} className="border border-outline/20 p-0">
                    <input
                      type="text"
                      value={cell ?? ''}
                      onChange={(e) => handleCellChange(rowIdx, colIdx, e.target.value)}
                      className="w-full h-full px-3 py-2 bg-transparent border-0 focus:bg-surface focus:ring-1 focus:ring-primary focus:outline-none text-on-surface text-sm"
                    />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
