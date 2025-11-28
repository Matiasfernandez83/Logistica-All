import React from 'react';
import { X, CheckCircle, AlertTriangle, Truck, User, Tag, Calendar, FileText, DollarSign } from 'lucide-react';
import { TruckRecord, ModalData } from '../types';

interface DetailModalProps {
  modalData: ModalData;
  onClose: () => void;
}

export const DetailModal: React.FC<DetailModalProps> = ({ modalData, onClose }) => {
  if (!modalData.isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
          <div>
            <h3 className="text-xl font-bold text-slate-800">{modalData.title}</h3>
            <p className="text-sm text-slate-500">
                {modalData.type === 'list' 
                    ? `Visualizando ${modalData.records?.length || 0} registros relacionados`
                    : 'Detalle completo del registro'
                }
            </p>
          </div>
          <button 
            onClick={onClose}
            className="p-2 bg-white border border-slate-200 rounded-full hover:bg-red-50 hover:text-red-500 transition-colors shadow-sm"
          >
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 bg-slate-50/30">
            {modalData.type === 'detail' && modalData.singleRecord ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-6">
                        <div className="bg-white p-5 rounded-xl border border-slate-100 shadow-sm">
                            <h4 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-4">Información Principal</h4>
                            <div className="space-y-4">
                                <div className="flex items-start gap-3">
                                    <div className="p-2 bg-blue-50 text-blue-600 rounded-lg"><Truck size={20}/></div>
                                    <div>
                                        <p className="text-xs text-slate-500">Patente</p>
                                        <p className="text-lg font-bold text-slate-800">{modalData.singleRecord.patente || 'No detectada'}</p>
                                    </div>
                                </div>
                                <div className="flex items-start gap-3">
                                    <div className="p-2 bg-purple-50 text-purple-600 rounded-lg"><User size={20}/></div>
                                    <div>
                                        <p className="text-xs text-slate-500">Responsable / Dueño</p>
                                        <p className="text-lg font-bold text-slate-800">{modalData.singleRecord.dueno}</p>
                                    </div>
                                </div>
                                <div className="flex items-start gap-3">
                                    <div className="p-2 bg-green-50 text-green-600 rounded-lg"><DollarSign size={20}/></div>
                                    <div>
                                        <p className="text-xs text-slate-500">Valor</p>
                                        <p className="text-2xl font-bold text-slate-800">
                                            {new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP' }).format(modalData.singleRecord.valor)}
                                        </p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="space-y-6">
                         <div className="bg-white p-5 rounded-xl border border-slate-100 shadow-sm h-full">
                            <h4 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-4">Detalles Técnicos y Estado</h4>
                            <div className="space-y-4">
                                <div className="flex items-start gap-3">
                                    <div className="p-2 bg-orange-50 text-orange-600 rounded-lg"><Tag size={20}/></div>
                                    <div>
                                        <p className="text-xs text-slate-500">Número de TAG</p>
                                        <p className="font-mono text-slate-700 bg-slate-100 px-2 py-1 rounded inline-block">
                                            {modalData.singleRecord.tag || 'Sin información'}
                                        </p>
                                    </div>
                                </div>
                                <div className="flex items-start gap-3">
                                    <div className="p-2 bg-indigo-50 text-indigo-600 rounded-lg"><Truck size={20}/></div>
                                    <div>
                                        <p className="text-xs text-slate-500">Número de Equipo (Interno)</p>
                                        <p className="text-slate-800 font-medium">
                                            {modalData.singleRecord.equipo || '---'}
                                        </p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-3 pt-2">
                                    {modalData.singleRecord.isVerified ? (
                                        <div className="flex items-center gap-2 bg-green-100 text-green-700 px-4 py-2 rounded-lg w-full">
                                            <CheckCircle size={20} />
                                            <span className="font-bold">Verificado en Base de Datos</span>
                                        </div>
                                    ) : (
                                        <div className="flex items-center gap-2 bg-amber-100 text-amber-700 px-4 py-2 rounded-lg w-full">
                                            <AlertTriangle size={20} />
                                            <span className="font-bold">No encontrado en Base de Datos</span>
                                        </div>
                                    )}
                                </div>
                                <div className="pt-4 border-t border-slate-100 mt-4">
                                    <p className="text-xs text-slate-500 mb-1">Concepto / Descripción</p>
                                    <p className="text-sm text-slate-700 italic">"{modalData.singleRecord.concepto}"</p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            ) : (
                <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                    <table className="w-full text-left">
                        <thead className="bg-slate-50 text-slate-600 text-xs uppercase font-bold">
                            <tr>
                                <th className="px-4 py-3">Patente</th>
                                <th className="px-4 py-3">Dueño</th>
                                <th className="px-4 py-3">Tag</th>
                                <th className="px-4 py-3 text-right">Valor</th>
                                <th className="px-4 py-3 text-center">Estado</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 text-sm">
                            {modalData.records?.map((record, idx) => (
                                <tr key={idx} className="hover:bg-slate-50">
                                    <td className="px-4 py-3 font-medium text-slate-900">{record.patente}</td>
                                    <td className="px-4 py-3 text-slate-600">{record.dueno}</td>
                                    <td className="px-4 py-3 font-mono text-xs text-slate-500">{record.tag || '-'}</td>
                                    <td className="px-4 py-3 text-right font-medium">
                                        {new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP' }).format(record.valor)}
                                    </td>
                                    <td className="px-4 py-3 text-center">
                                         {record.isVerified ? (
                                            <CheckCircle size={16} className="inline text-green-500" />
                                         ) : (
                                            <AlertTriangle size={16} className="inline text-amber-500" />
                                         )}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
        
        {/* Footer */}
        <div className="p-4 border-t border-slate-100 bg-white flex justify-end">
            <button onClick={onClose} className="px-6 py-2 bg-slate-900 text-white rounded-lg hover:bg-slate-800 font-medium">
                Cerrar
            </button>
        </div>
      </div>
    </div>
  );
};