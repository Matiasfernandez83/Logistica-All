import React, { useState } from 'react';
import { Search, Download, CheckCircle, AlertTriangle, Tag, Truck } from 'lucide-react';
import { TruckRecord } from '../types';
import * as XLSX from 'xlsx';

interface DataTableProps {
  data: TruckRecord[];
  onRowDoubleClick?: (record: TruckRecord) => void;
}

export const DataTable: React.FC<DataTableProps> = ({ data, onRowDoubleClick }) => {
  const [searchTerm, setSearchTerm] = useState('');

  const filteredData = data.filter(item => 
    item.dueno.toLowerCase().includes(searchTerm.toLowerCase()) ||
    item.patente.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (item.tag && item.tag.toLowerCase().includes(searchTerm.toLowerCase())) ||
    (item.equipo && item.equipo.toLowerCase().includes(searchTerm.toLowerCase())) ||
    item.concepto.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleExport = () => {
    // Export format matching the display columns
    const exportData = data.map(d => ({
        PATENTE: d.patente,
        RESPONSABLE_DE_USUARIO: d.dueno,
        NUMERO_DE_TAG: d.tag || 'No detectado',
        EQUIPOS: d.equipo || '',
        ESTADO: d.isVerified ? 'VERIFICADO' : 'NO ENCONTRADO',
        VALOR: d.valor,
        CONCEPTO: d.concepto,
        FECHA: d.fecha || ''
    }));

    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Consolidado TAGs");
    XLSX.writeFile(wb, "reporte_unificado_tags.xlsx");
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
      <div className="p-6 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
            <h3 className="text-lg font-bold text-slate-800">Unificación de Datos</h3>
            <p className="text-xs text-slate-400">Doble click en una fila para ver detalle completo</p>
        </div>
        
        <div className="flex items-center gap-3">
            <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400" size={18} />
                <input 
                    type="text" 
                    placeholder="Buscar..." 
                    className="pl-10 pr-4 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 w-full sm:w-64"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
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

      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead className="bg-slate-50 text-slate-500 text-xs uppercase font-bold tracking-wider">
            <tr>
              <th className="px-6 py-4 border-b border-slate-200 text-blue-900">Patente</th>
              <th className="px-6 py-4 border-b border-slate-200 text-blue-900">Responsable de Usuario</th>
              <th className="px-6 py-4 border-b border-slate-200 text-blue-900">Numero de Tag</th>
              <th className="px-6 py-4 border-b border-slate-200 text-blue-900">Equipos</th>
              <th className="px-6 py-4 border-b border-slate-200 text-blue-900 text-center">Estado</th>
              <th className="px-6 py-4 border-b border-slate-200 text-right text-blue-900">Valor (PDF)</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filteredData.length > 0 ? (
              filteredData.map((item) => (
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

                  {/* NUMERO DE TAG */}
                  <td className="px-6 py-4">
                    {item.tag ? (
                        <div className="flex items-center gap-2 text-slate-600 font-mono text-xs">
                             <Tag size={12} className="text-slate-400"/>
                             {item.tag}
                        </div>
                    ) : (
                        <span className="text-slate-300 italic text-xs">Sin TAG</span>
                    )}
                  </td>

                  {/* EQUIPOS */}
                  <td className="px-6 py-4 text-slate-600">
                      {item.equipo ? (
                          <div className="flex items-center gap-2">
                              <Truck size={14} className="text-slate-400" />
                              <span>{item.equipo}</span>
                          </div>
                      ) : (
                          <span className="text-slate-300">-</span>
                      )}
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
                </tr>
              ))
            ) : (
                <tr>
                    <td colSpan={6} className="px-6 py-12 text-center text-slate-400 bg-slate-50/50">
                        No se encontraron coincidencias.
                    </td>
                </tr>
            )}
          </tbody>
        </table>
      </div>
      <div className="p-4 border-t border-slate-100 bg-slate-50 text-xs text-slate-500 flex justify-between items-center">
          <span>{filteredData.length} registros visualizados</span>
          <div className="flex gap-4">
              <span className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-green-500"></div> Datos de Base + PDF</span>
              <span className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-amber-500"></div> Solo PDF (Sin Match)</span>
          </div>
      </div>
    </div>
  );
};