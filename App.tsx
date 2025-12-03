
import * as React from 'react';
import { useState, useRef, useEffect } from 'react';
import { Sidebar } from './components/Sidebar';
import { Stats } from './components/Stats';
import { Charts } from './components/Charts';
import { DataTable } from './components/DataTable';
import { ReportsView } from './components/ReportsView';
import { SettingsView } from './components/SettingsView';
import { DetailModal } from './components/DetailModal';
import { LoginScreen } from './components/LoginScreen';
import { ImportView } from './components/ImportView';
import { ConverterView } from './components/ConverterView';
import { Database, CheckCircle2, ArrowRightLeft, FileSpreadsheet, AlertTriangle } from 'lucide-react';
import { TruckRecord, ProcessingStatus, FileType, FleetRecord, View, UploadedFile, ModalData, User, ThemeSettings } from './types';
import { parseExcelToCSV, fileToBase64, parseExcelToJSON } from './utils/excelParser';
import { processDocuments, convertPdfToData } from './services/geminiService';
import { getRecords, saveRecords, getFleet, saveFleet, saveFiles, clearRecords, getTheme, saveTheme, getFileById } from './utils/storage';
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
      processingMode: 'free'
  });

  const [currentView, setCurrentView] = useState<View>('dashboard');
  const [records, setRecords] = useState<TruckRecord[]>([]);
  const [fleetDb, setFleetDb] = useState<FleetRecord[]>([]);
  const [files, setFiles] = useState<File[]>([]);
  
  const [importTab, setImportTab] = useState<'process' | 'convert'>('process');
  
  const [convertFile, setConvertFile] = useState<File | null>(null);
  const [isConverting, setIsConverting] = useState(false);

  const [status, setStatus] = useState<ProcessingStatus>({
    isProcessing: false,
    error: null,
    success: false
  });
  
  const [modalData, setModalData] = useState<ModalData>({
      isOpen: false,
      title: '',
      type: 'list'
  });
  
  const dbInputRef = useRef<HTMLInputElement>(null);

  // --- INITIALIZATION ---
  useEffect(() => {
    const loadData = async () => {
        try {
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

  useEffect(() => {
      const fontMap = {
          'inter': 'Inter, sans-serif',
          'roboto': 'Roboto, sans-serif',
          'mono': 'monospace'
      };
      document.body.style.fontFamily = fontMap[theme.fontFamily];
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

  // --- LOGIC: OPEN FILE ---
  const handleViewFile = async (fileId: string) => {
      try {
          const fileData = await getFileById(fileId);
          if (!fileData || !fileData.content) {
              alert("Archivo no encontrado o contenido dañado.");
              return;
          }

          const base64 = fileData.content as string;
          const mimeType = fileData.type;
          
          // Create Blob and open
          const byteCharacters = atob(base64);
          const byteNumbers = new Array(byteCharacters.length);
          for (let i = 0; i < byteCharacters.length; i++) {
              byteNumbers[i] = byteCharacters.charCodeAt(i);
          }
          const byteArray = new Uint8Array(byteNumbers);
          const blob = new Blob([byteArray], { type: mimeType });
          const fileURL = URL.createObjectURL(blob);
          
          window.open(fileURL, '_blank');
          
      } catch (e) {
          console.error("Error opening file", e);
          alert("Error al abrir el archivo.");
      }
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
                  
                  // Safe check for autoTable
                  if ((doc as any).autoTable) {
                      (doc as any).autoTable({
                          head: [headers],
                          body: body,
                          startY: 35,
                          theme: 'grid',
                          styles: { fontSize: 8 },
                          headStyles: { fillColor: theme.primaryColor === 'blue' ? [37, 99, 235] : [100, 100, 100] }
                      });
                  } else {
                      console.warn("jsPDF autoTable plugin not loaded properly");
                      doc.text("Error: No se pudo generar la tabla. Plugin no cargado.", 14, 40);
                  }
              }

              doc.save(`${convertFile.name.split('.')[0]}_convertido.pdf`);
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
              } else {
                  throw new Error("No se pudieron extraer datos tabulares del PDF.");
              }
          } else {
              throw new Error("Formato no soportado.");
          }

      } catch (e: any) {
          console.error("Error converting file", e);
          alert(`Error: ${e.message}`);
      } finally {
          setIsConverting(false);
          setConvertFile(null);
      }
  };


  // --- LOGIC: FILE PROCESSING ---
  const handleProcess = async () => {
    if (files.length === 0) return;

    // Check for API Key in either process.env or window.process.env
    const apiKey = process?.env?.API_KEY || (window as any).process?.env?.API_KEY;

    if (!apiKey) {
        setStatus({
            isProcessing: false,
            error: "ERROR CRÍTICO: API_KEY no encontrada. Por favor asegúrate de que la clave API esté configurada en el entorno.",
            success: false
        });
        return;
    }

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

    const processingDelay = theme.processingMode === 'fast' ? 500 : 5000;

    try {
        for (let i = 0; i < files.length; i++) {
            const file = files[i];
            
            try {
                // Generate a unique ID for the file beforehand to link it
                const fileId = `file-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

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

                if (i > 0) {
                    await new Promise(resolve => setTimeout(resolve, processingDelay));
                }

                const resultRecords = await processDocuments([{ mimeType, data: contentData }]);
                
                // Link records to the source file
                const recordsWithSource = resultRecords.map(r => ({
                    ...r,
                    sourceFileId: fileId,
                    sourceFileName: file.name
                }));

                const verifiedSubset = verifyRecords(recordsWithSource, fleetDb);
                newRecordsAcc.push(...verifiedSubset);

                filesToSaveAcc.push({
                    id: fileId, // Use the generated ID
                    name: file.name,
                    type: file.type,
                    size: file.size,
                    content: contentData
                });

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

        if (newRecordsAcc.length > 0) {
            const allRecords = [...records, ...newRecordsAcc];
            setRecords(allRecords);
            await saveRecords(allRecords);
            await saveFiles(filesToSaveAcc);
        }

        if (failedFiles.length > 0) {
            const errorMsg = `Se procesaron ${successCount} archivos. Fallas: ${failedFiles.join(' | ')}`;
            setStatus({ 
                isProcessing: false, 
                error: errorMsg, 
                success: successCount > 0 
            });
        } else {
             setStatus({ 
                isProcessing: false, 
                error: null, 
                success: true 
            });
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

  const handleDbSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files && e.target.files[0]) {
          const file = e.target.files[0];
          try {
              const jsonData = await parseExcelToJSON(file);
              const fleetData: FleetRecord[] = jsonData.map((row: any) => {
                  // Simplified mapping logic for brevity
                  const keys = Object.keys(row);
                  const patente = String(row[keys.find(k => /patente|dominio/i.test(k)) || ''] || '').trim();
                  return {
                      patente: patente,
                      dueno: String(row[keys.find(k => /dueño|propietario/i.test(k)) || ''] || 'Desconocido').trim(),
                      tag: String(row[keys.find(k => /tag|device/i.test(k)) || ''] || '').trim(),
                      equipo: String(row[keys.find(k => /equipo|unidad/i.test(k) && !/tag/i.test(k)) || ''] || '').trim()
                  };
              }).filter(r => r.patente);

              setFleetDb(fleetData);
              await saveFleet(fleetData);
              if (records.length > 0) {
                  const updatedRecords = verifyRecords(records, fleetData);
                  setRecords(updatedRecords);
                  await saveRecords(updatedRecords);
              }
          } catch (err) {
              console.error("Error loading database", err);
              alert("Error al leer base de datos.");
          }
      }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setFiles(prev => [...prev, ...Array.from(e.target.files!)]);
      setStatus({ isProcessing: false, error: null, success: false });
    }
  };

  if (!currentUser) {
      return <LoginScreen onLogin={setCurrentUser} themeColor={theme.primaryColor} />;
  }

  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-900 flex transition-colors duration-300">
      <Sidebar currentView={currentView} onNavigate={setCurrentView} />
      <main className="md:ml-64 p-4 md:p-8 flex-1 overflow-hidden">
        <header className="flex flex-col md:flex-row justify-between md:items-center mb-8 gap-4">
          <div>
            <h2 className="text-2xl font-bold text-slate-800">
                {currentView === 'dashboard' ? 'Panel de Control' : 
                 currentView === 'import' ? 'Importador Inteligente' : 
                 currentView === 'reports' ? 'Reportes' : 'Configuración'}
            </h2>
            {/* Visual warning if API Key is missing in dev environment */}
            {(!process?.env?.API_KEY && !(window as any).process?.env?.API_KEY) && (
                <div className="flex items-center gap-2 mt-2 text-red-600 bg-red-50 px-3 py-1 rounded text-sm font-bold border border-red-200">
                    <AlertTriangle size={16} />
                    <span>ADVERTENCIA: API_KEY no detectada. La IA no funcionará.</span>
                </div>
            )}
          </div>
        </header>
        
        {currentView === 'settings' ? (
              <SettingsView 
                        currentUser={currentUser} 
                        currentTheme={theme} 
                        onUpdateTheme={handleUpdateTheme}
                        onLogout={() => setCurrentUser(null)}
                     />
        ) : currentView === 'reports' ? (
              <ReportsView data={records} />
        ) : currentView === 'import' ? (
                  <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
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
                        <ImportView 
                            files={files} 
                            status={status} 
                            onFileSelect={handleFileSelect} 
                            onRemoveFile={(idx) => setFiles(prev => prev.filter((_, i) => i !== idx))} 
                            onProcess={handleProcess}
                            theme={theme}
                        />
                     ) : (
                        <ConverterView 
                            convertFile={convertFile}
                            isConverting={isConverting}
                            onFileSelect={setConvertFile}
                            onConvert={handleConversion}
                            onClearFile={() => setConvertFile(null)}
                            theme={theme}
                        />
                     )}
                  </div>
        ) : (
                  <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
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
                                    onClick={async () => {
                                        if(confirm('¿Borrar todo?')) { await clearRecords(); setRecords([]); }
                                    }}
                                    className="px-4 py-2 bg-red-50 text-red-600 rounded-lg text-sm font-medium hover:bg-red-100 transition-colors"
                                >
                                    Limpiar Tabla
                                </button>
                             </div>
                        </section>
                      </div>

                      {records.length > 0 ? (
                        <>
                            <Stats data={records} onCardClick={() => {}} />
                            <Charts data={records} onBarClick={() => {}} />
                            <DataTable 
                                data={records} 
                                onRowDoubleClick={(r) => setModalData({ isOpen: true, title: 'Detalle', type: 'detail', singleRecord: r })} 
                                onViewFile={handleViewFile}
                            />
                        </>
                      ) : (
                          <div className="text-center py-20 text-slate-400 bg-white rounded-xl border border-slate-100 border-dashed">
                              <p>No hay datos. Ve a "Importar Datos".</p>
                          </div>
                      )}
                  </div>
        )}
      </main>
      <DetailModal modalData={modalData} onClose={() => setModalData(prev => ({ ...prev, isOpen: false }))} />
    </div>
  );
}

export default App;
