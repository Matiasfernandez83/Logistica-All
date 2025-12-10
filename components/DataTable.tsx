
import React, { useState, useMemo, useEffect } from 'react';
import { Search, Download, CheckCircle, AlertTriangle, Tag, Truck, ChevronLeft, ChevronRight, ExternalLink, Paperclip, ListFilter, Trash2 } from 'lucide-react';
import { TruckRecord } from '../types';

interface DataTableProps {
  data: TruckRecord[];
  onRowDoubleClick?: (record: TruckRecord) => void;
  onViewFile?: (fileId: string) => void;
  onDelete?: (ids: string[]) => void; // New prop for deletion
}

export const DataTable: React.FC<DataTableProps> = ({ data, onRowDoubleClick, onViewFile, onDelete }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [isExporting, setIsExporting] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]); // Selection State

  // Reset selection when data changes significantly
  useEffect(() => {
    setSelectedIds([]);
  }, [data.length]);

  // Filter Data
  const filteredData = useMemo(() => {
    return data.filter(item => 
      item.dueno.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.patente.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (item.tag && item.tag.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (item.equipo && item.equipo.toLowerCase().includes(searchTerm.toLowerCase())) ||
      item.concepto.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (item.sourceFileName && item.sourceFileName.toLowerCase().includes(searchTerm.toLowerCase()))
    );
  }, [data, searchTerm]);

  // Pagination Logic
  const totalPages = Math.ceil(filteredData.length / itemsPerPage);
  const paginatedData = filteredData.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  // Selection Logic
  const toggleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.checked) {
          // Select all visible in current filter (or just current page?)
          // Usually better to select all filtered data
          setSelectedIds(filteredData.map(d => d.id));
      } else {
          setSelectedIds([]);
      }
  };

  const toggleSelectRow = (id: string) => {
      if (selectedIds.includes(id)) {
          setSelectedIds(prev => prev.filter(i => i !== id));
      } else {
          setSelectedIds(prev => [...prev, id]);
      }
  };

  const handleDeleteSelected = () => {
      if (onDelete && selectedIds.length > 0) {
          onDelete(selectedIds);
          // Selection clearing happens in parent effect or manual here
          // We'll clear it optimistically or wait for data refresh
      }
  };

  const handlePageChange = (newPage: number) => {
      if (newPage >= 1 && newPage <= totalPages) {
          setCurrentPage(newPage);
      }
  };

  const handleItemsPerPageChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
      setItemsPerPage(Number(e.target.value));
      setCurrentPage(1); 
  };

  const getPageNumbers = () => {
    const pageNumbers = [];
    const maxVisiblePages = 5;
    
    if (totalPages <= maxVisiblePages) {
        for (let i = 1; i <= totalPages; i++) {
            pageNumbers.push(i);
        }
    } else {
        let startPage = Math.max(1, currentPage - 2);
        let endPage = Math.min(totalPages, startPage + 4);
        if (endPage - startPage < 4) startPage = Math.max(1, endPage - 4);
        for (let i = startPage; i <= endPage; i++) pageNumbers.push(i);
    }
    return pageNumbers;
  };

  const handleExport = async () => {
    setIsExporting(true);
    try {
        const XLSX = await import('xlsx');
        const exportData = filteredData.map(d => ({
            PATENTE: d.patente,
            NUMERO_EQUIPO: d.equipo || '', 
            RESPONSABLE_DE_USUARIO: d.dueno,
            NUMERO_DE_TAG: d.tag || 'No detectado',
            ESTADO: d.isVerified ? 'VERIFICADO' : 'NO ENCONTRADO',
            TARIFA: d.valor, 
            CONCEPTO: d.concepto,
            FECHA: d.fecha || '',
            ARCHIVO_ORIGEN: d.sourceFileName || ''
        }));

        const ws = XLSX.utils.json_to_sheet(exportData);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Consolidado TAGs");
        XLSX.writeFile(wb, "reporte_unificado_tags.xlsx");
    } catch (e) {
        console.error("Export failed", e);
        alert("Error al exportar");
    } finally {
        setIsExporting(false);
    }
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-100 flex flex-col">
      <div className="p-6 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
            <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                Unificación de Datos
                {selectedIds.length > 0 && (
                    <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">
                        {selectedIds.length} seleccionados
                    </span>
                )}
            </h3>
            <p className="text-xs text-slate-400 hidden sm:block">
                Doble click en <b>Fila</b>: Ver Detalle | Doble click en <b>Columna Archivo</b>: Abrir Documento
            </p>
        </div>
        
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
            {/* Delete Button (Visible only when selected) */}
            {selectedIds.length > 0 && onDelete && (
                <button 
                    onClick={handleDeleteSelected}
                    className="flex items-center justify-center gap-2 px-4 py-2 bg-red-600 text-white hover:bg-red-700 rounded-lg text-sm font-bold transition-colors animate-in fade-in"
                >
                    <Trash2 size={16} />
                    <span className="hidden sm:inline">Eliminar</span>
                </button>
            )}

            <div className="relative w-full sm:w-auto">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400" size={18} />
                <input 
                    type="text" 
                    placeholder="Buscar por tag, dueño..." 
                    className="pl-10 pr-4 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 w-full sm:w-64"
                    value={searchTerm}
                    onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }}
                />
            </div>
            <button 
                onClick={handleExport}
                disabled={isExporting}
                className="flex items-center justify-center gap-2 px-4 py-2 bg-green-50 text-green-700 hover:bg-green-100 rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
            >
                <Download size={18} />
                <span className="hidden sm:inline">{isExporting ? '...' : 'Exportar Excel'}</span>
            </button>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead className="bg-slate-50 text-slate-500 text-xs uppercase font-bold tracking-wider">
            <tr>
              {/* Checkbox Header */}
              <th className="px-4 py-4 w-10 border-b border-slate-200">
                  <input 
                    type="checkbox" 
                    onChange={toggleSelectAll} 
                    checked={filteredData.length > 0 && selectedIds.length === filteredData.length}
                    className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                  />
              </th>
              <th className="px-4 md:px-6 py-4 border-b border-slate-200 text-blue-900">Patente</th>
              <th className="px-6 py-4 border-b border-slate-200 text-blue-900 hidden lg:table-cell">N° Equipo</th>
              <th className="px-6 py-4 border-b border-slate-200 text-blue-900 hidden md:table-cell">Responsable</th>
              <th className="px-6 py-4 border-b border-slate-200 text-blue-900 hidden lg:table-cell">Tag ID</th>
              <th className="px-4 md:px-6 py-4 border-b border-slate-200 text-center text-blue-900">Estado</th>
              <th className="px-6 py-4 border-b border-slate-200 text-blue-900 hidden xl:table-cell">Archivo</th>
              <th className="px-4 md:px-6 py-4 border-b border-slate-200 text-right text-blue-900">Tarifa</th>
              <th className="px-4 md:px-6 py-4 border-b border-slate-200 text-center text-blue-900">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {paginatedData.length > 0 ? (
              paginatedData.map((item) => (
                <tr 
                    key={item.id} 
                    className={`hover:bg-blue-50/50 transition-colors group cursor-pointer ${selectedIds.includes(item.id) ? 'bg-blue-50' : ''}`}
                    onDoubleClick={() => onRowDoubleClick?.(item)}
                    title="Doble click en fila para ver detalle completo"
                >
                  {/* Checkbox Row */}
                  <td className="px-4 py-4" onClick={(e) => e.stopPropagation()}>
                       <input 
                            type="checkbox" 
                            checked={selectedIds.includes(item.id)}
                            onChange={() => toggleSelectRow(item.id)}
                            className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                       />
                  </td>

                  {/* PATENTE */}
                  <td className="px-4 md:px-6 py-4">
                     <span className="font-mono font-medium text-slate-800 bg-slate-100 px-2 py-1 rounded border border-slate-200 group-hover:border-blue-200 transition-colors whitespace-nowrap">
                        {item.patente || '---'}
                     </span>
                     <div className="md:hidden text-xs text-slate-500 mt-1 truncate max-w-[100px]">{item.dueno}</div>
                  </td>

                  {/* N° EQUIPO */}
                  <td className="px-6 py-4 hidden lg:table-cell">
                     {item.equipo ? (
                        <div className="flex items-center gap-2 text-slate-700 font-bold">
                            <Truck size={14} className="text-slate-400" />
                            <span>{item.equipo}</span>
                        </div>
                     ) : <span className="text-slate-300 text-xs">-</span>}
                  </td>

                  {/* RESPONSABLE */}
                  <td className="px-6 py-4 text-slate-700 font-medium hidden md:table-cell">{item.dueno || '---'}</td>

                  {/* TAG */}
                  <td className="px-6 py-4 hidden lg:table-cell">
                        {item.tag ? (
                            <div className="flex items-center gap-2 text-slate-600 font-mono text-xs">
                                <Tag size={12} className="text-slate-400"/>
                                {item.tag}
                            </div>
                        ) : <span className="text-slate-300 italic text-xs">Sin TAG</span>}
                  </td>

                  {/* ESTADO */}
                  <td className="px-4 md:px-6 py-4 text-center">
                      {item.isVerified ? (
                          <div className="inline-flex items-center gap-1 bg-green-100 text-green-700 px-2 md:px-3 py-1 rounded-full border border-green-200">
                              <CheckCircle size={14} />
                              <span className="text-[10px] font-bold uppercase tracking-wide hidden md:inline">MATCH</span>
                          </div>
                      ) : (
                          <div className="inline-flex items-center gap-1 bg-amber-50 text-amber-600 px-2 md:px-3 py-1 rounded-full border border-amber-200">
                              <AlertTriangle size={14} />
                              <span className="text-[10px] font-bold uppercase tracking-wide hidden md:inline">NO REG.</span>
                          </div>
                      )}
                  </td>

                  {/* ARCHIVO */}
                  <td 
                    className="px-6 py-4 group-hover:bg-blue-100/50 transition-colors relative hidden xl:table-cell"
                    onDoubleClick={(e) => { e.stopPropagation(); if (item.sourceFileId && onViewFile) onViewFile(item.sourceFileId); }}
                  >
                     <div className="flex items-center gap-2">
                        <Paperclip size={14} className="text-slate-400" />
                        <span className="text-sm text-slate-600 font-medium truncate max-w-[140px] hover:text-blue-700 hover:underline">
                            {item.sourceFileName || 'Desconocido'}
                        </span>
                     </div>
                  </td>

                  {/* TARIFA */}
                  <td className="px-4 md:px-6 py-4 text-right">
                    <div className="font-bold text-slate-900 whitespace-nowrap">
                        {new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 }).format(item.valor)}
                    </div>
                  </td>

                   {/* ACCIONES */}
                   <td className="px-4 md:px-6 py-4 text-center">
                    {item.sourceFileId ? (
                        <button 
                            onClick={(e) => { e.stopPropagation(); if (onViewFile) onViewFile(item.sourceFileId!); }}
                            className="inline-flex items-center justify-center p-2 bg-slate-50 hover:bg-blue-50 text-slate-500 hover:text-blue-600 rounded-lg border border-slate-200 transition-colors"
                        >
                            <ExternalLink size={16} />
                        </button>
                    ) : <span className="text-slate-300 text-xs">-</span>}
                  </td>
                </tr>
              ))
            ) : (
                <tr>
                    <td colSpan={9} className="px-6 py-12 text-center text-slate-400 bg-slate-50/50">
                        No se encontraron coincidencias.
                    </td>
                </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="p-4 border-t border-slate-100 bg-slate-50 flex flex-col sm:flex-row justify-between items-center gap-4">
            <div className="flex flex-col sm:flex-row items-center gap-4 w-full sm:w-auto">
                 <div className="flex items-center gap-2 text-sm text-slate-600 bg-slate-100 px-3 py-1.5 rounded-lg border border-slate-200 w-full sm:w-auto justify-center">
                    <ListFilter size={16} />
                    <span>Ver:</span>
                    <select 
                        value={itemsPerPage} 
                        onChange={handleItemsPerPageChange}
                        className="bg-transparent font-bold text-blue-700 focus:outline-none cursor-pointer"
                    >
                        <option value={10}>10</option>
                        <option value={25}>25</option>
                        <option value={50}>50</option>
                        <option value={100}>100</option>
                        <option value={filteredData.length > 0 ? filteredData.length : 1000}>Todos</option>
                    </select>
                </div>
                <div className="text-xs text-slate-500">
                    {filteredData.length > 0 ? (
                        <>Mostrando {((currentPage - 1) * itemsPerPage) + 1} - {Math.min(currentPage * itemsPerPage, filteredData.length)} de {filteredData.length}</>
                    ) : (
                        <>0 registros</>
                    )}
                </div>
            </div>

            {totalPages > 1 && (
                <div className="flex items-center gap-1 overflow-x-auto max-w-full pb-1 sm:pb-0">
                    <button 
                        onClick={() => handlePageChange(currentPage - 1)}
                        disabled={currentPage === 1}
                        className="p-2 border border-slate-200 rounded-lg hover:bg-white disabled:opacity-50 disabled:hover:bg-transparent transition-colors mr-2 flex-shrink-0"
                    >
                        <ChevronLeft size={16} />
                    </button>
                    
                    {getPageNumbers().map(pageNum => (
                        <button
                            key={pageNum}
                            onClick={() => handlePageChange(pageNum)}
                            className={`w-8 h-8 flex flex-shrink-0 items-center justify-center rounded-lg text-sm font-medium transition-colors ${
                                currentPage === pageNum 
                                    ? 'bg-blue-600 text-white shadow-md' 
                                    : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
                            }`}
                        >
                            {pageNum}
                        </button>
                    ))}

                    <button 
                        onClick={() => handlePageChange(currentPage + 1)}
                        disabled={currentPage === totalPages}
                        className="p-2 border border-slate-200 rounded-lg hover:bg-white disabled:opacity-50 disabled:hover:bg-transparent transition-colors ml-2 flex-shrink-0"
                    >
                        <ChevronRight size={16} />
                    </button>
                </div>
            )}
        </div>
    </div>
  );
};
