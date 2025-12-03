
import React, { useState, useRef, useEffect } from 'react';
import { Sidebar } from './components/Sidebar';
import { Stats } from './components/Stats';
import { Charts } from './components/Charts';
import { DataTable } from './components/DataTable';
import { ReportsView } from './components/ReportsView';
import { SettingsView } from './components/SettingsView';
import { DetailModal } from './components/DetailModal';
import { LoginScreen } from './components/LoginScreen';
import { UploadCloud, X, FileSpreadsheet, FileText, Loader2, AlertCircle, Database, CheckCircle2, ArrowRightLeft, FileJson, Download } from 'lucide-react';
import { TruckRecord, ProcessingStatus, FileType, FleetRecord, View, UploadedFile, ModalData, User, ThemeSettings } from './types';
import { parseExcelToCSV, fileToBase64, parseExcelToJSON } from './utils/excelParser';
import { processDocuments, convertPdfToData } from './services/geminiService';
import { getRecords, saveRecords, getFleet, saveFleet, saveFiles, clearRecords, getTheme, saveTheme } from './utils/storage';
import clsx from 'clsx';
import * as XLSX from 'xlsx';
import { jsPDF } from 'jspdf';
import 'jspdf-autotable';

function App() {
  // --- AUTH & THEME STATE ---
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [theme, setTheme] = useState<ThemeSettings>({ 
      primaryColor: 'blue', 
      fontFamily: 'inter', 
      processingMode: 'free' // Default to free mode for safety
  });

  const [currentView, setCurrentView] = useState<View>('dashboard');
  const [records, setRecords] = useState<TruckRecord[]>([]);
  const [fleetDb, setFleetDb] = useState<FleetRecord[]>([]);
  const [files, setFiles] = useState<File[]>([]);
  
  // State for Import View Tabs
  const [importTab, setImportTab] = useState<'process' | 'convert'>('process');
  
  // State for Converter
  const [convertFile, setConvertFile] = useState<File | null>(null);
  const [isConverting, setIsConverting] = useState(false);

  const [status, setStatus] = useState<ProcessingStatus>({
    isProcessing: false,
    error: null,
    success: false
  });
  
  // Modal State
  const [modalData, setModalData] = useState<ModalData>({
      isOpen: false,
      title: '',
      type: 'list'
  });
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dbInputRef = useRef<HTMLInputElement>(null);
  const convertInputRef = useRef<HTMLInputElement>(null);

  // --- INITIALIZATION ---
  useEffect(() => {
    const loadData = async () => {
        try {
            // Load theme first
            const savedTheme = await getTheme();
            if (savedTheme) setTheme(savedTheme);

            const savedRecords = await getRecords();
            const savedFleet = await getFleet();
            if (savedRecords) setRecords(savedRecords);
            if (savedFleet) setFleetDb(savedFleet);
        } catch (e) {
            console.error("Error loading from DB", e);
        }
    };
    loadData();
  }, []);

  // Update theme on body/root
  useEffect(() => {
      const fontMap = {
          'inter': 'Inter, sans-serif',
          'roboto': 'Roboto, sans-serif',
          'mono': 'monospace'
      };
      document.body.style.fontFamily = fontMap[theme.fontFamily];
      // Note: Colors are handled via Tailwind classes passed to components
  }, [theme]);

  const handleUpdateTheme = async (newTheme: ThemeSettings) => {
      setTheme(newTheme);
      await saveTheme(newTheme);
  };

  const normalize = (str: string | undefined) => str ? str.replace(/[\s-]/g, '').toUpperCase() : '';

  // --- LOGIC: VERIFICATION ---
  const verifyRecords = (currentRecords: TruckRecord[], currentDb: FleetRecord[]): TruckRecord[] => {
      return currentRecords.map(record => {
          let match: FleetRecord | undefined;
          
          if (record.tag) {
             const normRecordTag = normalize(record.tag);
             match = currentDb.find(dbItem => {
                 const normDbTag = normalize(dbItem.tag);
                 return normDbTag && (normDbTag.includes(normRecordTag) || normRecordTag.includes(normDbTag));
             });
          }

          if (match) {
              return {
                  ...record,
                  patente: match.patente || record.patente,
                  dueno: match.dueno || record.dueno,
                  equipo: match.equipo || '',
                  registeredOwner: match.dueno,
                  isVerified: true
              };
          } else {
              if (record.patente) {
                  const normRecordPlate = normalize(record.patente);
                  match = currentDb.find(dbItem => normalize(dbItem.patente) === normRecordPlate);
              }

              if (match) {
                  return {
                    ...record,
                    dueno: match.dueno || record.dueno,
                    equipo: match.equipo || '',
                    tag: match.tag || record.tag,
                    registeredOwner: match.dueno,
                    isVerified: true
                  };
              }
          }
          
          return {
              ...record,
              isVerified: false,
              registeredOwner: undefined,
              equipo: ''
          };
      });
  };

  // --- LOGIC: CONVERTER (PDF <-> EXCEL) ---
  const handleConversion = async () => {
      if (!convertFile) return;
      setIsConverting(true);

      try {
          // EXCEL TO PDF
          if (convertFile.name.endsWith('.xlsx') || convertFile.name.endsWith('.xls') || convertFile.name.endsWith('.csv')) {
              const jsonData = await parseExcelToJSON(convertFile);
              
              const doc = new jsPDF();
              doc.setFontSize(16);
              doc.text(`Conversión: ${convertFile.name}`, 14, 20);
              doc.setFontSize(10);
              doc.text(`Generado por LogísticaAI - ${new Date().toLocaleDateString()}`, 14, 28);
              
              if (jsonData.length > 0) {
                  const headers = Object.keys(jsonData[0]);
                  const body = jsonData.map((row: any) => Object.values(row));
                  
                  (doc as any).autoTable({
                      head: [headers],
                      body: body,
                      startY: 35,
                      theme: 'grid',
                      styles: { fontSize: 8 },
                      headStyles: { fillColor: theme.primaryColor === 'blue' ? [37, 99, 235] : [100, 100, 100] }
                  });
              }

              doc.save(`${convertFile.name.split('.')[0]}_convertido.pdf`);
              alert("Archivo convertido a PDF exitosamente.");
          } 
          // PDF TO EXCEL (Via Gemini)
          else if (convertFile.name.endsWith('.pdf')) {
              const base64 = await fileToBase64(convertFile);
              const data = await convertPdfToData([{ mimeType: 'application/pdf', data: base64 }]);
              
              if (data && data.length > 0) {
                  const ws = XLSX.utils.json_to_sheet(data);
                  const wb = XLSX.utils.book_new();
                  XLSX.utils.book_append_sheet(wb, ws, "Datos Extraidos");
                  XLSX.writeFile(wb, `${convertFile.name.split('.')[0]}_convertido.xlsx`);
                  alert("Archivo convertido a Excel exitosamente.");
              } else {
                  alert("No se pudieron extraer datos tabulares del PDF.");
              }
          } else {
              alert("Formato no soportado para conversión.");
          }

      } catch (e: any) {
          console.error("Error converting file", e);
          alert(`Error en conversión: ${e.message}`);
      } finally {
          setIsConverting(false);
          setConvertFile(null);
      }
  };


  // --- LOGIC: FILE PROCESSING ---
  const handleProcess = async () => {
    if (files.length === 0) return;

    // Initial check for environment (best effort)
    if (!process.env.API_KEY) {
        setStatus({
            isProcessing: false,
            error: "ERROR DE CONFIGURACIÓN: No se encontró la API_KEY. Si está en la nube, asegúrese de agregar la variable de entorno API_KEY en su panel de despliegue.",
            success: false
        });
        return;
    }

    // Reset status but keep files to show progress
    setStatus({ 
        isProcessing: true, 
        error: null, 
        success: false, 
        processedCount: 0, 
        totalCount: files.length 
    });
    
    let successCount = 0;
    const failedFiles: string[] = [];
    const newRecordsAcc: TruckRecord[] = [];
    const filesToSaveAcc: UploadedFile[] = [];

    // Determine Delay based on Mode
    const processingDelay = theme.processingMode === 'fast' ? 500 : 5000;

    try {
        // Process files sequentially (One by One) with delay
        for (let i = 0; i < files.length; i++) {
            const file = files[i];
            
            try {
                // 1. Read File content
                let contentData = '';
                let mimeType = '';

                if (file.type === FileType.PDF) {
                    contentData = await fileToBase64(file);
                    mimeType = 'application/pdf';
                } else if (file.type === FileType.EXCEL || file.type === FileType.EXCEL_OLD || file.name.endsWith('.xlsx') || file.name.endsWith('.xls')) {
                    contentData = await parseExcelToCSV(file);
                    mimeType = 'text/plain';
                } else {
                    contentData = await fileToBase64(file);
                    mimeType = file.type || 'image/jpeg';
                }

                // 2. Call AI for THIS file only
                // Add explicit delay between files to avoid Rate Limits (or just safety)
                if (i > 0) {
                    await new Promise(resolve => setTimeout(resolve, processingDelay));
                }

                const resultRecords = await processDocuments([{ mimeType, data: contentData }]);
                
                // 3. Verify extracted records against Fleet DB
                const verifiedSubset = verifyRecords(resultRecords, fleetDb);
                newRecordsAcc.push(...verifiedSubset);

                // 4. Prepare file for history storage
                filesToSaveAcc.push({
                    name: file.name,
                    type: file.type,
                    size: file.size,
                    content: contentData
                });

                // 5. Update UI Progress
                successCount++;
                setStatus(prev => ({ 
                    ...prev, 
                    processedCount: successCount 
                }));

            } catch (fileErr: any) {
                console.error(`Error processing file ${file.name}:`, fileErr);
                const msg = fileErr.message || 'Error desconocido';
                failedFiles.push(`${file.name}: ${msg}`);
            }
        }

        // 6. Save accumulated data to State and DB
        if (newRecordsAcc.length > 0) {
            const allRecords = [...records, ...newRecordsAcc];
            setRecords(allRecords);
            await saveRecords(allRecords);
            
            await saveFiles(filesToSaveAcc);
        }

        // 7. Final Status
        if (failedFiles.length > 0) {
            const errorMsg = `Se procesaron ${successCount} archivos. Fallas: ${failedFiles.join(' | ')}`;
            setStatus({ 
                isProcessing: false, 
                error: errorMsg, 
                success: successCount > 0 // Partial success is still success
            });
            // Don't clear queue if there are errors so user can see which ones failed (or retry)
        } else {
             setStatus({ 
                isProcessing: false, 
                error: null, 
                success: true 
            });
            // Clear queue only on full success
            setFiles([]);
        }

    } catch (err: any) {
      console.error(err);
      setStatus({ 
        isProcessing: false, 
        error: "Error del sistema: " + (err.message || ''), 
        success: false 
      });
    }
  };

  // --- EVENT HANDLERS ---
  const handleStatClick = (type: 'total' | 'trucks' | 'owners' | 'ops') => {
      let title = '';
      let filteredRecords = records;

      switch(type) {
          case 'total':
              title = 'Registros de Mayor Valor (Top 50)';
              filteredRecords = [...records].sort((a,b) => b.valor - a.valor).slice(0, 50);
              break;
          case 'trucks':
              title = 'Detalle por Camión (Ordenado por Patente)';
              filteredRecords = [...records].sort((a,b) => a.patente.localeCompare(b.patente));
              break;
          case 'owners':
              title = 'Detalle por Dueño (Ordenado por Nombre)';
              filteredRecords = [...records].sort((a,b) => a.dueno.localeCompare(b.dueno));
              break;
          case 'ops':
              title = 'Todas las Operaciones Recientes';
              break;
      }
      setModalData({ isOpen: true, title, type: 'list', records: filteredRecords });
  };

  const handleChartBarClick = (ownerName: string) => {
      const filtered = records.filter(r => r.dueno === ownerName);
      setModalData({ isOpen: true, title: `Operaciones de: ${ownerName}`, type: 'list', records: filtered });
  };

  const handleRowDoubleClick = (record: TruckRecord) => {
      setModalData({ isOpen: true, title: `Detalle de Registro ${record.patente}`, type: 'detail', singleRecord: record });
  };

  const handleDbSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files && e.target.files[0]) {
          const file = e.target.files[0];
          try {
              const jsonData = await parseExcelToJSON(file);
              const fleetData: FleetRecord[] = jsonData.map((row: any) => {
                  const keys = Object.keys(row);
                  const patenteKey = keys.find(k => k.toLowerCase().match(/(patente|dominio|matricula|placa)/));
                  const duenoKey = keys.find(k => k.toLowerCase().match(/(dueño|propietario|titular|responsable|usuario)/));
                  const tagKey = keys.find(k => k.toLowerCase().match(/(tag|dispositivo|device|telepase)/));
                  const equipoKey = keys.find(k => k.toLowerCase().match(/(equipo|interno|unidad|movil|numero)/) && !k.toLowerCase().includes('tag'));
                  
                  return {
                      patente: patenteKey ? String(row[patenteKey]).trim() : '',
                      dueno: duenoKey ? String(row[duenoKey]).trim() : 'Desconocido',
                      tag: tagKey ? String(row[tagKey]).trim() : '',
                      equipo: equipoKey ? String(row[equipoKey]).trim() : ''
                  };
              }).filter(r => r.tag || r.patente);

              setFleetDb(fleetData);
              await saveFleet(fleetData);
              if (records.length > 0) {
                  const updatedRecords = verifyRecords(records, fleetData);
                  setRecords(updatedRecords);
                  await saveRecords(updatedRecords);
              }
          } catch (err) {
              console.error("Error loading database", err);
              alert("Error al leer el archivo de base de datos.");
          }
      }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setFiles(prev => [...prev, ...Array.from(e.target.files!)]);
      setStatus({ isProcessing: false, error: null, success: false });
    }
  };

  const removeFile = (index: number) => {
    setFiles(prev => prev.filter((_, i) => i !== index));
  };

  const handleClearData = async () => {
      if(confirm('¿Estás seguro de borrar todos los registros de la tabla?')) {
          await clearRecords();
          setRecords([]);
      }
  };

  // --- RENDER VIEWS ---
  
  if (!currentUser) {
      return <LoginScreen onLogin={setCurrentUser} themeColor={theme.primaryColor} />;
  }

  const renderView = () => {
      switch(currentView) {
          case 'settings':
              return <SettingsView 
                        currentUser={currentUser} 
                        currentTheme={theme} 
                        onUpdateTheme={handleUpdateTheme}
                        onLogout={() => setCurrentUser(null)}
                     />;
          case 'reports':
              return <ReportsView data={records} />;
          case 'import':
              return (
                  <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                     
                     {/* TAB NAVIGATION */}
                     <div className="flex p-1 bg-white rounded-xl shadow-sm border border-slate-100 w-fit">
                        <button 
                            onClick={() => setImportTab('process')}
                            className={clsx(
                                "px-4 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-2",
                                importTab === 'process' 
                                    ? `bg-${theme.primaryColor}-50 text-${theme.primaryColor}-700 shadow-sm` 
                                    : "text-slate-500 hover:text-slate-700"
                            )}
                        >
                            <Database size={16} /> Procesamiento ERP
                        </button>
                        <button 
                            onClick={() => setImportTab('convert')}
                            className={clsx(
                                "px-4 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-2",
                                importTab === 'convert' 
                                    ? `bg-${theme.primaryColor}-50 text-${theme.primaryColor}-700 shadow-sm` 
                                    : "text-slate-500 hover:text-slate-700"
                            )}
                        >
                            <ArrowRightLeft size={16} /> Conversor de Archivos
                        </button>
                     </div>

                     {importTab === 'process' ? (
                         // --- EXISTING IMPORT VIEW ---
                        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100">
                            <h3 className={`text-lg font-bold text-slate-800 mb-4 flex items-center gap-2`}>
                                <UploadCloud size={20} className={`text-${theme.primaryColor}-500`}/>
                                Cargar Nuevos Archivos (ERP)
                            </h3>
                            <div className={`border-2 border-dashed border-slate-300 rounded-lg p-12 flex flex-col items-center justify-center bg-slate-50 hover:bg-${theme.primaryColor}-50 transition-colors cursor-pointer`}
                                onClick={() => fileInputRef.current?.click()}>
                                <input 
                                    type="file" 
                                    multiple 
                                    ref={fileInputRef} 
                                    className="hidden" 
                                    accept=".pdf,.xlsx,.xls,.csv"
                                    onChange={handleFileSelect}
                                />
                                <div className={`p-4 bg-${theme.primaryColor}-100 text-${theme.primaryColor}-600 rounded-full mb-4`}>
                                    <UploadCloud size={32} />
                                </div>
                                <p className="text-lg text-slate-700 font-medium mb-2">Arrastra archivos o haz clic para subir</p>
                                <p className="text-slate-400">Soporta PDF y Excel (Carga Múltiple)</p>
                            </div>

                            {files.length > 0 && (
                                <div className="mt-6">
                                    <p className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-3">Cola de procesamiento ({files.length})</p>
                                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 mb-6 max-h-60 overflow-y-auto pr-2">
                                        {files.map((file, idx) => (
                                            <div key={idx} className="flex items-center justify-between p-3 bg-slate-50 border border-slate-200 rounded-lg">
                                                <div className="flex items-center gap-3 overflow-hidden">
                                                    {file.name.endsWith('.pdf') ? (
                                                        <FileText className="text-red-500 flex-shrink-0" size={20} />
                                                    ) : (
                                                        <FileSpreadsheet className="text-green-600 flex-shrink-0" size={20} />
                                                    )}
                                                    <span className="text-sm font-medium truncate text-slate-700">{file.name}</span>
                                                </div>
                                                <button 
                                                    onClick={() => removeFile(idx)} 
                                                    disabled={status.isProcessing}
                                                    className="text-slate-400 hover:text-red-500 p-1 disabled:opacity-50"
                                                >
                                                    <X size={16} />
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                    <button 
                                        onClick={handleProcess}
                                        disabled={status.isProcessing}
                                        className={clsx(
                                            "w-full flex items-center justify-center gap-2 px-6 py-3 rounded-xl font-bold text-white text-lg transition-all shadow-md",
                                            status.isProcessing ? "bg-slate-400 cursor-not-allowed" : `bg-${theme.primaryColor}-600 hover:bg-${theme.primaryColor}-700 hover:shadow-${theme.primaryColor}-200`
                                        )}
                                    >
                                        {status.isProcessing ? (
                                            <>
                                                <Loader2 className="animate-spin" size={20} />
                                                <span>Procesando archivo {status.processedCount! + 1} de {status.totalCount}...</span>
                                            </>
                                        ) : (
                                            <>
                                                <span>Iniciar Unificación Masiva</span>
                                                {theme.processingMode === 'free' && <span className="text-xs bg-white/20 px-2 py-0.5 rounded ml-2 font-normal">Modo Gratuito (Lento)</span>}
                                            </>
                                        )}
                                    </button>
                                    
                                    {status.isProcessing && (
                                        <div className="w-full bg-slate-200 rounded-full h-2.5 mt-4">
                                            <div 
                                                className={`bg-${theme.primaryColor}-600 h-2.5 rounded-full transition-all duration-300`} 
                                                style={{ width: `${(status.processedCount! / status.totalCount!) * 100}%` }}
                                            ></div>
                                        </div>
                                    )}
                                </div>
                            )}
                            {status.error && (
                                <div className="mt-4 p-4 bg-red-50 text-red-700 rounded-lg flex items-start gap-2 border border-red-100 animate-in slide-in-from-top-2">
                                    <AlertCircle size={20} className="flex-shrink-0 mt-0.5" />
                                    <div className="flex-1">
                                        <p className="font-bold text-sm">Ocurrieron errores:</p>
                                        <p className="text-sm break-all">{status.error}</p>
                                    </div>
                                </div>
                            )}
                            {status.success && !status.error && (
                                <div className="mt-4 p-4 bg-green-50 text-green-700 rounded-lg flex items-center gap-2 border border-green-100">
                                    <CheckCircle2 size={20} />
                                    <p>Proceso completado exitosamente.</p>
                                </div>
                            )}
                        </div>
                     ) : (
                        // --- NEW CONVERTER VIEW ---
                        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100">
                            <h3 className={`text-lg font-bold text-slate-800 mb-4 flex items-center gap-2`}>
                                <ArrowRightLeft size={20} className={`text-${theme.primaryColor}-500`}/>
                                Transformar Archivos
                            </h3>
                            <p className="text-sm text-slate-500 mb-6">
                                Convierte PDFs a Excel (extracción inteligente de tablas) o Excel a PDF (generación de documentos).
                                <br/><span className="text-xs text-orange-500">Nota: La conversión de PDF a Excel usa IA y puede tomar unos segundos.</span>
                            </p>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                {/* INPUT AREA */}
                                <div>
                                    <div className={`border-2 border-dashed border-slate-300 rounded-lg p-8 flex flex-col items-center justify-center bg-slate-50 hover:bg-${theme.primaryColor}-50 transition-colors cursor-pointer h-64`}
                                        onClick={() => convertInputRef.current?.click()}>
                                        <input 
                                            type="file" 
                                            ref={convertInputRef} 
                                            className="hidden" 
                                            accept=".pdf,.xlsx,.xls,.csv"
                                            onChange={(e) => {
                                                if (e.target.files && e.target.files[0]) setConvertFile(e.target.files[0]);
                                            }}
                                        />
                                        
                                        {!convertFile ? (
                                            <>
                                                <div className={`p-4 bg-slate-200 text-slate-500 rounded-full mb-4`}>
                                                    <FileJson size={32} />
                                                </div>
                                                <p className="text-base text-slate-700 font-medium mb-1">Seleccionar Archivo</p>
                                                <p className="text-xs text-slate-400">PDF o Excel</p>
                                            </>
                                        ) : (
                                            <>
                                                <div className={`p-4 bg-${theme.primaryColor}-100 text-${theme.primaryColor}-600 rounded-full mb-4`}>
                                                    {convertFile.name.endsWith('.pdf') ? <FileText size={32} /> : <FileSpreadsheet size={32} />}
                                                </div>
                                                <p className="text-base font-bold text-slate-800 text-center break-all px-4">{convertFile.name}</p>
                                                <button 
                                                    onClick={(e) => { e.stopPropagation(); setConvertFile(null); }}
                                                    className="mt-2 text-xs text-red-500 hover:underline"
                                                >
                                                    Quitar
                                                </button>
                                            </>
                                        )}
                                    </div>
                                </div>

                                {/* ACTION AREA */}
                                <div className="flex flex-col justify-center space-y-4">
                                    <div className="p-4 bg-slate-50 rounded-lg border border-slate-200">
                                        <h4 className="font-bold text-slate-700 mb-2">Acción Detectada:</h4>
                                        {convertFile ? (
                                            convertFile.name.endsWith('.pdf') ? (
                                                <div className="flex items-center gap-2 text-blue-600 font-bold">
                                                    <FileText size={18}/> PDF <ArrowRightLeft size={14}/> <FileSpreadsheet size={18}/> Excel
                                                </div>
                                            ) : (
                                                <div className="flex items-center gap-2 text-green-600 font-bold">
                                                     <FileSpreadsheet size={18}/> Excel <ArrowRightLeft size={14}/> <FileText size={18}/> PDF
                                                </div>
                                            )
                                        ) : (
                                            <p className="text-slate-400 text-sm italic">Sube un archivo para ver opciones...</p>
                                        )}
                                    </div>

                                    <button 
                                        onClick={handleConversion}
                                        disabled={!convertFile || isConverting}
                                        className={clsx(
                                            "w-full flex items-center justify-center gap-2 px-6 py-4 rounded-xl font-bold text-white text-lg transition-all shadow-md",
                                            (!convertFile || isConverting) ? "bg-slate-300 cursor-not-allowed" : `bg-${theme.primaryColor}-600 hover:bg-${theme.primaryColor}-700`
                                        )}
                                    >
                                        {isConverting ? (
                                            <>
                                                <Loader2 className="animate-spin" size={20} />
                                                <span>Convirtiendo...</span>
                                            </>
                                        ) : (
                                            <>
                                                <Download size={20} />
                                                <span>Convertir y Descargar</span>
                                            </>
                                        )}
                                    </button>
                                </div>
                            </div>
                        </div>
                     )}

                  </div>
              );
          case 'dashboard':
          default:
              return (
                  <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                        {/* Quick DB Status */}
                        <section className="bg-white p-6 rounded-xl shadow-sm border border-slate-100 lg:col-span-1">
                            <h3 className="text-lg font-bold text-slate-800 mb-2 flex items-center gap-2">
                                <Database size={20} className={`text-${theme.primaryColor}-500`}/>
                                Base de Datos Maestra
                            </h3>
                            {fleetDb.length > 0 ? (
                                <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                                    <div className="flex items-center gap-2 text-green-700 font-bold mb-1">
                                        <CheckCircle2 size={20} />
                                        <span>Base Activa</span>
                                    </div>
                                    <p className="text-sm text-green-600">{fleetDb.length} equipos registrados.</p>
                                    <button onClick={() => dbInputRef.current?.click()} className="text-xs text-green-700 underline mt-2">Actualizar</button>
                                </div>
                            ) : (
                                <div onClick={() => dbInputRef.current?.click()} className="border-2 border-dashed border-slate-300 rounded-lg p-4 flex flex-col items-center justify-center bg-slate-50 cursor-pointer hover:bg-slate-100">
                                    <FileSpreadsheet className="text-slate-400 mb-2" />
                                    <span className="text-sm text-slate-600 text-center">Cargar Flota (Excel)</span>
                                </div>
                            )}
                             <input type="file" ref={dbInputRef} className="hidden" accept=".xlsx,.xls,.csv" onChange={handleDbSelect} />
                        </section>

                        <section className="bg-white p-6 rounded-xl shadow-sm border border-slate-100 lg:col-span-2 flex items-center justify-between">
                             <div>
                                <h3 className="text-lg font-bold text-slate-800">Acciones Rápidas</h3>
                                <p className="text-slate-500 text-sm">Gestiona tus datos actuales</p>
                             </div>
                             <div className="flex gap-3">
                                <button 
                                    onClick={() => setCurrentView('import')}
                                    className={`px-4 py-2 bg-${theme.primaryColor}-600 text-white rounded-lg text-sm font-medium hover:bg-${theme.primaryColor}-700 transition-colors`}
                                >
                                    + Subir Archivos
                                </button>
                                <button 
                                    onClick={handleClearData}
                                    className="px-4 py-2 bg-red-50 text-red-600 rounded-lg text-sm font-medium hover:bg-red-100 transition-colors"
                                >
                                    Limpiar Tabla
                                </button>
                             </div>
                        </section>
                      </div>

                      {records.length > 0 ? (
                        <>
                            <Stats data={records} onCardClick={handleStatClick} />
                            <Charts data={records} onBarClick={handleChartBarClick} />
                            <DataTable data={records} onRowDoubleClick={handleRowDoubleClick} />
                        </>
                      ) : (
                          <div className="text-center py-20 text-slate-400 bg-white rounded-xl border border-slate-100 border-dashed">
                              <p>No hay datos procesados. Ve a "Importar Datos" para comenzar.</p>
                          </div>
                      )}
                  </div>
              );
      }
  };

  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-900 flex transition-colors duration-300">
      <Sidebar currentView={currentView} onNavigate={setCurrentView} />
      
      <main className="md:ml-64 p-4 md:p-8 flex-1 overflow-hidden">
        <header className="flex flex-col md:flex-row justify-between md:items-center mb-8 gap-4">
          <div>
            <h2 className="text-2xl font-bold text-slate-800">
                {currentView === 'dashboard' ? 'Panel de Control' : 
                 currentView === 'import' ? 'Importador Inteligente' : 
                 currentView === 'reports' ? 'Reportes y Archivos' : 'Configuración'}
            </h2>
            <p className="text-slate-500">
                {currentView === 'dashboard' ? `Bienvenido, ${currentUser.name}` : 
                 currentView === 'import' ? 'Procesa facturas y reportes en lote' : 
                 currentView === 'reports' ? 'Historial y descargas' : 'Sistema y Usuarios'}
            </p>
          </div>
        </header>

        {renderView()}

      </main>

      <DetailModal 
        modalData={modalData}
        onClose={() => setModalData(prev => ({ ...prev, isOpen: false }))}
      />
    </div>
  );
}

export default App;
