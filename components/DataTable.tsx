import React, { useState, useMemo } from 'react';
import { Search, Download, CheckCircle, AlertTriangle, Tag, Truck, ChevronLeft, ChevronRight, FileText, ExternalLink } from 'lucide-react';
import { TruckRecord } from '../types';
import * as XLSX from 'xlsx';

interface DataTableProps {
  data: TruckRecord[];
  onRowDoubleClick?: (record: TruckRecord) => void;
  onViewFile?: (fileId: string) => void;
}

export const DataTable: React.FC<DataTableProps> = ({ data, onRowDoubleClick, onViewFile }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

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

  const handlePageChange = (newPage: number) => {
      if (newPage >= 1 && newPage <= totalPages) {
          setCurrentPage(newPage);
      }
  };

  const handleExport = () => {
    // Export filtered data, not just current page
    const exportData = filteredData.map(d => ({
        PATENTE: d.patente,
        RESPONSABLE_DE_USUARIO: d.dueno,
        NUMERO_DE_TAG: d.tag || 'No detectado',
        EQUIPOS: d.equipo || '',
        ESTADO: d.isVerified ? 'VERIFICADO' : 'NO ENCONTRADO',
        VALOR: d.valor,
        CONCEPTO: d.concepto,
        FECHA: d.fecha || '',
        ARCHIVO_ORIGEN: d.sourceFileName || ''
    }));

    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Consolidado TAGs");
    XLSX.writeFile(wb, "reporte_unificado_tags.xlsx");
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden flex flex-col h-full">
      <div className="p-6 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
            <h3 className="text-lg font-bold text-slate-800">Unificación de Datos</h3>
            <p className="text-xs text-slate-400">Doble click en fila para ver detalle | Click en ícono PDF para abrir factura</p>
        </div>
        
        <div className="flex items-center gap-3">
            <div className="relative">
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
                className="flex items-center gap-2 px-4 py-2 bg-green-50 text-green-700 hover:bg-green-100 rounded-lg text-sm font-medium transition-colors"
            >
                <Download size={18} />
                <span className="hidden sm:inline">Exportar Excel</span>
            </button>
        </div>
      </div>

      <div className="overflow-x-auto flex-1">
        <table className="w-full text-left border-collapse">
          <thead className="bg-slate-50 text-slate-500 text-xs uppercase font-bold tracking-wider sticky top-0 z-10">
            <tr>
              <th className="px-6 py-4 border-b border-slate-200 text-blue-900">Patente</th>
              <th className="px-6 py-4 border-b border-slate-200 text-blue-900">Responsable / Dueño</th>
              <th className="px-6 py-4 border-b border-slate-200 text-blue-900">Tag & Equipo</th>
              <th className="px-6 py-4 border-b border-slate-200 text-center text-blue-900">Estado</th>
              <th className="px-6 py-4 border-b border-slate-200 text-right text-blue-900">Valor (PDF)</th>
              <th className="px-6 py-4 border-b border-slate-200 text-center text-blue-900">Factura / Respaldo</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {paginatedData.length > 0 ? (
              paginatedData.map((item) => (
                <tr 
                    key={item.id} 
                    className="hover:bg-blue-50/50 transition-colors group cursor-pointer"
                    onDoubleClick={() => onRowDoubleClick?.(item)}
                    title="Doble click para ver detalle"
                >
                  {/* PATENTE */}
                  <td className="px-6 py-4">
                     <span className="font-mono font-medium text-slate-800 bg-slate-100 px-2 py-1 rounded border border-slate-200 group-hover:border-blue-200 transition-colors">
                        {item.patente || '---'}
                     </span>
                  </td>

                  {/* RESPONSABLE DE USUARIO */}
                  <td className="px-6 py-4 text-slate-700 font-medium">
                    {item.dueno || '---'}
                  </td>

                  {/* NUMERO DE TAG & EQUIPO */}
                  <td className="px-6 py-4">
                    <div className="flex flex-col gap-1">
                        {item.tag ? (
                            <div className="flex items-center gap-2 text-slate-600 font-mono text-xs">
                                <Tag size={12} className="text-slate-400"/>
                                {item.tag}
                            </div>
                        ) : (
                            <span className="text-slate-300 italic text-xs">Sin TAG</span>
                        )}
                        {item.equipo && (
                            <div className="flex items-center gap-2 text-slate-500 text-xs">
                                <Truck size={12} className="text-slate-400" />
                                <span>Eq: {item.equipo}</span>
                            </div>
                        )}
                    </div>
                  </td>

                  {/* ESTADO */}
                  <td className="px-6 py-4 text-center">
                      {item.isVerified ? (
                          <div className="inline-flex items-center gap-1 bg-green-100 text-green-700 px-3 py-1 rounded-full border border-green-200">
                              <CheckCircle size={14} />
                              <span className="text-[10px] font-bold uppercase tracking-wide">MATCH</span>
                          </div>
                      ) : (
                          <div className="inline-flex items-center gap-1 bg-amber-50 text-amber-600 px-3 py-1 rounded-full border border-amber-200">
                              <AlertTriangle size={14} />
                              <span className="text-[10px] font-bold uppercase tracking-wide">NO REGISTRADO</span>
                          </div>
                      )}
                  </td>

                  {/* VALOR */}
                  <td className="px-6 py-4 text-right">
                    <div className="font-bold text-slate-900">
                        {new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP' }).format(item.valor)}
                    </div>
                    {item.concepto && (
                        <div className="text-[10px] text-slate-400 mt-1 uppercase max-w-[120px] ml-auto truncate">
                            {item.concepto}
                        </div>
                    )}
                  </td>

                   {/* ARCHIVO PDF / FACTURA */}
                   <td className="px-6 py-4 text-center">
                    {item.sourceFileId ? (
                        <button 
                            onClick={(e) => { 
                                e.stopPropagation(); 
                                if (onViewFile) onViewFile(item.sourceFileId!); 
                            }}
                            className="inline-flex items-center gap-2 px-3 py-1.5 bg-red-50 hover:bg-red-100 text-red-600 rounded-lg border border-red-200 transition-colors group/btn"
                            title={`Abrir archivo: ${item.sourceFileName}`}
                        >
                            <FileText size={16} />
                            <span className="text-xs font-medium max-w-[100px] truncate hidden sm:inline">
                                {item.sourceFileName || 'Ver Factura'}
                            </span>
                            <ExternalLink size={12} className="opacity-0 group-hover/btn:opacity-100 transition-opacity" />
                        </button>
                    ) : (
                        <span className="text-slate-300 text-xs">-</span>
                    )}
                  </td>
                </tr>
              ))
            ) : (
                <tr>
                    <td colSpan={7} className="px-6 py-12 text-center text-slate-400 bg-slate-50/50">
                        No se encontraron coincidencias.
                    </td>
                </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination Controls */}
      {totalPages > 1 && (
        <div className="p-4 border-t border-slate-100 bg-slate-50 flex justify-between items-center">
            <div className="text-xs text-slate-500">
                Mostrando {((currentPage - 1) * itemsPerPage) + 1} - {Math.min(currentPage * itemsPerPage, filteredData.length)} de {filteredData.length}
            </div>
            <div className="flex items-center gap-2">
                <button 
                    onClick={() => handlePageChange(currentPage - 1)}
                    disabled={currentPage === 1}
                    className="p-2 border border-slate-200 rounded-lg hover:bg-white disabled:opacity-50 disabled:hover:bg-transparent transition-colors"
                >
                    <ChevronLeft size={16} />
                </button>
                <div className="px-4 py-2 bg-white border border-slate-200 rounded-lg text-sm font-medium text-slate-700">
                    Página {currentPage} de {totalPages}
                </div>
                <button 
                    onClick={() => handlePageChange(currentPage + 1)}
                    disabled={currentPage === totalPages}
                    className="p-2 border border-slate-200 rounded-lg hover:bg-white disabled:opacity-50 disabled:hover:bg-transparent transition-colors"
                >
                    <ChevronRight size={16} />
                </button>
            </div>
        </div>
      )}
    </div>
  );
};