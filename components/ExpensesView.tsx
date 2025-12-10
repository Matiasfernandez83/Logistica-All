
import React, { useState, useRef } from 'react';
import { CreditCard, UploadCloud, Loader2, DollarSign, Activity, FileSpreadsheet, X, AlertCircle, Trash2 } from 'lucide-react';
import { ExpenseRecord, ProcessingStatus, ThemeSettings, FileType, UploadedFile } from '../types';
import { parseExcelToCSV, fileToBase64 } from '../utils/excelParser';
import { processCardExpenses } from '../services/geminiService';
import { saveExpenses, saveFiles, deleteExpenses } from '../utils/storage';
import { ConfirmModal } from './ConfirmModal';

interface ExpensesViewProps {
    expenses: ExpenseRecord[];
    onExpensesUpdated: (newExpenses: ExpenseRecord[]) => void;
    onViewDetail: (title: string, records: ExpenseRecord[]) => void;
    theme: ThemeSettings;
}

export const ExpensesView: React.FC<ExpensesViewProps> = ({ expenses, onExpensesUpdated, onViewDetail, theme }) => {
    const [files, setFiles] = useState<File[]>([]);
    const [selectedIds, setSelectedIds] = useState<string[]>([]);
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
    
    const [status, setStatus] = useState<ProcessingStatus>({
        isProcessing: false, error: null, success: false
    });
    
    const fileInputRef = useRef<HTMLInputElement>(null);

    // --- INDICATORS ---
    const totalAmount = expenses.reduce((acc, curr) => acc + curr.monto, 0);
    const totalTransactions = expenses.length;
    
    // Group by file
    const expensesByFile = expenses.reduce((acc, curr) => {
        if (!acc[curr.sourceFileName]) {
            acc[curr.sourceFileName] = 0;
        }
        acc[curr.sourceFileName] += curr.monto;
        return acc;
    }, {} as Record<string, number>);

    const maxFile = Object.entries(expensesByFile).sort((a, b) => b[1] - a[1])[0];

    const formatCurrency = (val: number) => 
        new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 }).format(val);

    // --- SELECTION LOGIC ---
    const toggleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.checked) {
            setSelectedIds(expenses.map(e => e.id));
        } else {
            setSelectedIds([]);
        }
    };

    const toggleSelectRow = (id: string) => {
        if (selectedIds.includes(id)) {
            setSelectedIds(prev => prev.filter(item => item !== id));
        } else {
            setSelectedIds(prev => [...prev, id]);
        }
    };

    const confirmDelete = async () => {
        await deleteExpenses(selectedIds);
        const remaining = expenses.filter(e => !selectedIds.includes(e.id));
        onExpensesUpdated(remaining);
        setSelectedIds([]);
        setShowDeleteConfirm(false);
    };

    // --- UPLOAD HANDLERS ---
    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files.length > 0) {
            setFiles(prev => [...prev, ...Array.from(e.target.files!)]);
            setStatus({ isProcessing: false, error: null, success: false });
        }
    };

    const handleProcess = async () => {
        if (files.length === 0) return;
        setStatus({ isProcessing: true, error: null, success: false, processedCount: 0, totalCount: files.length });

        const newExpenses: ExpenseRecord[] = [];
        const filesToSave: UploadedFile[] = [];
        let successCount = 0;
        const failedFiles: string[] = [];

        try {
            for (let i = 0; i < files.length; i++) {
                const file = files[i];
                const fileId = `exp-file-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
                
                try {
                    let contentData = '';
                    let mimeType = '';

                    if (file.type === FileType.PDF) {
                        contentData = await fileToBase64(file);
                        mimeType = 'application/pdf';
                    } else {
                        contentData = await parseExcelToCSV(file);
                        mimeType = 'text/plain';
                    }

                    const result = await processCardExpenses([{ mimeType, data: contentData }]);
                    const taggedResult = result.map(r => ({
                        ...r,
                        sourceFileId: fileId,
                        sourceFileName: file.name
                    }));

                    newExpenses.push(...taggedResult);
                    filesToSave.push({ id: fileId, name: file.name, type: file.type, size: file.size, content: contentData });

                    successCount++;
                    setStatus(prev => ({ ...prev, processedCount: successCount }));

                } catch (err: any) {
                    failedFiles.push(`${file.name}: ${err.message}`);
                }
            }

            if (newExpenses.length > 0) {
                await saveExpenses(newExpenses);
                await saveFiles(filesToSave);
                onExpensesUpdated([...expenses, ...newExpenses]);
            }

            setStatus({
                isProcessing: false,
                error: failedFiles.length > 0 ? `Errores: ${failedFiles.join(', ')}` : null,
                success: successCount > 0
            });
            if (failedFiles.length === 0) setFiles([]);

        } catch (e: any) {
            setStatus({ isProcessing: false, error: e.message, success: false });
        }
    };

    return (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500 pb-12">
            <div>
                <h2 className="text-2xl font-bold text-slate-800 mb-2">Gestión de Tarjetas y Peajes</h2>
                <p className="text-slate-500">Selecciona filas para eliminar. Haz doble click en las tarjetas para ver detalle.</p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                
                {/* 1. UPLOAD */}
                <div className="lg:col-span-1 bg-white p-6 rounded-xl shadow-sm border border-slate-100 h-fit">
                    <h3 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
                        <UploadCloud size={20} className={`text-${theme.primaryColor}-500`}/>
                        Subir Resumen
                    </h3>
                    
                    <div 
                        className={`border-2 border-dashed border-slate-300 rounded-lg p-6 flex flex-col items-center justify-center bg-slate-50 hover:bg-${theme.primaryColor}-50 cursor-pointer mb-4`}
                        onClick={() => fileInputRef.current?.click()}
                    >
                        <input type="file" multiple ref={fileInputRef} className="hidden" accept=".pdf,.xlsx,.xls,.csv" onChange={handleFileSelect} />
                        <CreditCard size={32} className={`text-${theme.primaryColor}-400 mb-2`} />
                        <p className="text-sm font-medium text-slate-700">Seleccionar Resumen</p>
                    </div>

                    {files.length > 0 && (
                        <div className="space-y-3">
                            <div className="max-h-32 overflow-y-auto space-y-2">
                                {files.map((f, i) => (
                                    <div key={i} className="flex justify-between items-center text-xs bg-slate-100 p-2 rounded">
                                        <span className="truncate max-w-[150px]">{f.name}</span>
                                        <button onClick={() => setFiles(files.filter((_, idx) => idx !== i))} className="text-red-500"><X size={14}/></button>
                                    </div>
                                ))}
                            </div>
                            <button 
                                onClick={handleProcess}
                                disabled={status.isProcessing}
                                className={`w-full py-2 bg-${theme.primaryColor}-600 text-white rounded-lg font-bold hover:bg-${theme.primaryColor}-700 disabled:opacity-50 flex justify-center items-center gap-2`}
                            >
                                {status.isProcessing ? <Loader2 className="animate-spin" size={16}/> : 'Procesar Gastos'}
                            </button>
                        </div>
                    )}
                    
                    {status.success && <div className="mt-2 text-xs text-green-600 font-bold flex items-center gap-1"><Activity size={12}/> Listo.</div>}
                    {status.error && <div className="mt-2 text-xs text-red-600 flex items-start gap-1"><AlertCircle size={12} className="mt-0.5"/> {status.error}</div>}
                </div>

                {/* 2. KPIs */}
                <div className="lg:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-4">
                    
                    {/* Total Peajes */}
                    <div 
                        className="bg-white p-6 rounded-xl shadow-sm border border-slate-100 flex items-center justify-between cursor-pointer hover:shadow-md transition-shadow relative group"
                        onDoubleClick={() => onViewDetail('Todos los Gastos', expenses)}
                        title="Doble Click para ver todo"
                    >
                        <div className="absolute top-2 right-2 text-[10px] text-slate-300 opacity-0 group-hover:opacity-100 transition-opacity">Doble Click</div>
                        <div>
                            <p className="text-sm text-slate-500 font-medium">Total Gastos Peajes</p>
                            <p className="text-2xl font-bold text-slate-900">{formatCurrency(totalAmount)}</p>
                            <p className="text-xs text-slate-400 mt-1">{totalTransactions} movimientos</p>
                        </div>
                        <div className="p-3 bg-orange-100 text-orange-600 rounded-full">
                            <DollarSign size={24} />
                        </div>
                    </div>

                    {/* Mayor Gasto */}
                    <div 
                        className="bg-white p-6 rounded-xl shadow-sm border border-slate-100 flex items-center justify-between cursor-pointer hover:shadow-md transition-shadow relative group"
                        onDoubleClick={() => maxFile && onViewDetail(`Gastos: ${maxFile[0]}`, expenses.filter(e => e.sourceFileName === maxFile[0]))}
                        title="Doble Click para ver este archivo"
                    >
                         <div className="absolute top-2 right-2 text-[10px] text-slate-300 opacity-0 group-hover:opacity-100 transition-opacity">Doble Click</div>
                        <div>
                            <p className="text-sm text-slate-500 font-medium">Mayor Consumo</p>
                            <p className="text-lg font-bold text-slate-900 truncate max-w-[150px]">{maxFile ? maxFile[0] : '---'}</p>
                            <p className="text-xs text-green-600 font-bold mt-1">{maxFile ? formatCurrency(maxFile[1]) : '$0'}</p>
                        </div>
                        <div className="p-3 bg-blue-100 text-blue-600 rounded-full">
                            <FileSpreadsheet size={24} />
                        </div>
                    </div>

                    {/* Comparativa */}
                    <div className="md:col-span-2 bg-white p-6 rounded-xl shadow-sm border border-slate-100 max-h-60 overflow-y-auto">
                        <h4 className="text-sm font-bold text-slate-700 mb-4 flex items-center gap-2">
                            <Activity size={16} className="text-purple-500"/>
                            Comparativa (Doble click en fila para ver detalle)
                        </h4>
                        <div className="space-y-2">
                            {Object.entries(expensesByFile).map(([fileName, amount], idx) => (
                                <div 
                                    key={idx} 
                                    className="flex items-center justify-between p-3 bg-slate-50 rounded-lg border border-slate-100 hover:bg-slate-100 cursor-pointer"
                                    onDoubleClick={() => onViewDetail(`Detalle: ${fileName}`, expenses.filter(e => e.sourceFileName === fileName))}
                                >
                                    <span className="text-sm text-slate-700 truncate max-w-[200px]">{fileName}</span>
                                    <span className="font-mono font-bold text-slate-900">{formatCurrency(amount)}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>

            {/* 3. TABLE WITH ACTIONS */}
            <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
                <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
                    <h3 className="text-lg font-bold text-slate-800">Listado de Movimientos</h3>
                    
                    {selectedIds.length > 0 && (
                        <button 
                            onClick={() => setShowDeleteConfirm(true)}
                            className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-bold hover:bg-red-700 transition-all shadow-sm"
                        >
                            <Trash2 size={16} /> Eliminar ({selectedIds.length})
                        </button>
                    )}
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead className="bg-slate-100 text-slate-600 text-xs uppercase font-bold">
                            <tr>
                                <th className="px-4 py-4 w-10">
                                    <input type="checkbox" onChange={toggleSelectAll} checked={expenses.length > 0 && selectedIds.length === expenses.length} />
                                </th>
                                <th className="px-6 py-4">Fecha</th>
                                <th className="px-6 py-4">Concepto</th>
                                <th className="px-6 py-4">Categoría</th>
                                <th className="px-6 py-4">Archivo</th>
                                <th className="px-6 py-4 text-right">Monto</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 text-sm">
                            {expenses.length > 0 ? (
                                expenses.map((item) => (
                                    <tr key={item.id} className={`hover:bg-slate-50 ${selectedIds.includes(item.id) ? 'bg-blue-50' : ''}`}>
                                        <td className="px-4 py-4">
                                            <input 
                                                type="checkbox" 
                                                checked={selectedIds.includes(item.id)}
                                                onChange={() => toggleSelectRow(item.id)}
                                            />
                                        </td>
                                        <td className="px-6 py-4 text-slate-600">{item.fecha || '-'}</td>
                                        <td className="px-6 py-4 font-medium text-slate-800">{item.concepto}</td>
                                        <td className="px-6 py-4">
                                            <span className="px-2 py-1 bg-white border border-slate-200 rounded text-xs font-bold text-slate-600">
                                                {item.categoria}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 text-slate-500 text-xs truncate max-w-[150px]">{item.sourceFileName}</td>
                                        <td className="px-6 py-4 text-right font-mono font-bold text-slate-900">
                                            {formatCurrency(item.monto)}
                                        </td>
                                    </tr>
                                ))
                            ) : (
                                <tr>
                                    <td colSpan={6} className="p-8 text-center text-slate-400">Sin datos.</td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            <ConfirmModal 
                isOpen={showDeleteConfirm}
                title="¿Eliminar registros?"
                message={`Estás a punto de borrar ${selectedIds.length} ítems de la base de datos de gastos. Esta acción no se puede deshacer.`}
                confirmText="Sí, Eliminar"
                onConfirm={confirmDelete}
                onClose={() => setShowDeleteConfirm(false)}
                isDestructive
            />
        </div>
    );
};
