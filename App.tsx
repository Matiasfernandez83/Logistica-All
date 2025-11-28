import React, { useState, useRef, useEffect } from 'react';
import { Sidebar } from './components/Sidebar';
import { Stats } from './components/Stats';
import { Charts } from './components/Charts';
import { DataTable } from './components/DataTable';
import { ReportsView } from './components/ReportsView';
import { SettingsView } from './components/SettingsView';
import { DetailModal } from './components/DetailModal';
import { LoginScreen } from './components/LoginScreen';
import { UploadCloud, X, FileSpreadsheet, FileText, Loader2, AlertCircle, Database, CheckCircle2 } from 'lucide-react';
import { TruckRecord, ProcessingStatus, FileType, FleetRecord, View, UploadedFile, ModalData, User, ThemeSettings } from './types';
import { parseExcelToCSV, fileToBase64, parseExcelToJSON } from './utils/excelParser';
import { processDocuments } from './services/geminiService';
import { getRecords, saveRecords, getFleet, saveFleet, saveFiles, clearRecords, getTheme, saveTheme } from './utils/storage';
import clsx from 'clsx';

function App() {
  // --- AUTH & THEME STATE ---
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [theme, setTheme] = useState<ThemeSettings>({ primaryColor: 'blue', fontFamily: 'inter' });

  const [currentView, setCurrentView] = useState<View>('dashboard');
  const [records, setRecords] = useState<TruckRecord[]>([]);
  const [fleetDb, setFleetDb] = useState<FleetRecord[]>([]);
  const [files, setFiles] = useState<File[]>([]);
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

  // --- LOGIC: FILE PROCESSING ---
  const handleProcess = async () => {
    if (files.length === 0) return;

    setStatus({ isProcessing: true, error: null, success: false, processedCount: 0, totalCount: files.length });
    
    // Process files in batches or sequentially to avoid overwhelming browser memory if too many
    // For improved UI, we process them one by one or in small groups and catch errors individually
    
    let successCount = 0;
    const processedContents: { mimeType: string, data: string, name: string, type: string }[] = [];
    const failedFiles: string[] = [];

    try {
        for (let i = 0; i < files.length; i++) {
            const file = files[i];
            try {
                let contentData = '';
                let mimeType = '';

                if (file.type === FileType.PDF) {
                    contentData = await fileToBase64(file);
                    mimeType = 'application/pdf';
                } else if (file.type === FileType.EXCEL || file.type === FileType.EXCEL_OLD || file.name.endsWith('.xlsx') || file.name.endsWith('.xls')) {
                    contentData = await parseExcelToCSV(file);
                    mimeType = 'text/plain';
                } else {
                    // Image fallback
                    contentData = await fileToBase64(file);
                    mimeType = file.type || 'image/jpeg';
                }

                processedContents.push({ mimeType, data: contentData, name: file.name, type: file.type });
                successCount++;
                setStatus(prev => ({ ...prev, processedCount: successCount }));

            } catch (fileErr) {
                console.error(`Error reading file ${file.name}:`, fileErr);
                failedFiles.push(file.name);
            }
        }

        if (processedContents.length > 0) {
            // Generate AI Records
            const newRecords = await processDocuments(processedContents.map(c => ({ mimeType: c.mimeType, data: c.data })));
            
            // Verify
            const verifiedRecords = verifyRecords(newRecords, fleetDb);
            
            // Save Records to DB
            const allRecords = [...records, ...verifiedRecords];
            setRecords(allRecords);
            await saveRecords(allRecords);

            // Save Files to DB (History)
            const filesToSave: UploadedFile[] = processedContents.map(c => ({
                name: c.name,
                type: c.type,
                size: 0,
                content: c.data
            }));
            await saveFiles(filesToSave);
        }

        setStatus({ 
            isProcessing: false, 
            error: failedFiles.length > 0 ? `Se procesaron ${successCount} archivos. Fallaron: ${failedFiles.join(', ')}` : null, 
            success: true 
        });
        
        if (failedFiles.length === 0) {
             setFiles([]); 
        }

    } catch (err: any) {
      console.error(err);
      setStatus({ 
        isProcessing: false, 
        error: "Error crítico al comunicar con la IA. Verifique su conexión.", 
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
                  <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
                     <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100">
                        <h3 className={`text-lg font-bold text-slate-800 mb-4 flex items-center gap-2`}>
                            <UploadCloud size={20} className={`text-${theme.primaryColor}-500`}/>
                            Cargar Nuevos Archivos
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
                                            <button onClick={() => removeFile(idx)} className="text-slate-400 hover:text-red-500 p-1">
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
                                            <span>Procesando {status.processedCount}/{status.totalCount || files.length}...</span>
                                        </>
                                    ) : (
                                        <>
                                            <span>Iniciar Unificación Masiva</span>
                                        </>
                                    )}
                                </button>
                            </div>
                        )}
                         {status.error && (
                            <div className="mt-4 p-4 bg-red-50 text-red-700 rounded-lg flex items-center gap-2 border border-red-100">
                                <AlertCircle size={20} />
                                <p>{status.error}</p>
                            </div>
                        )}
                        {status.success && !status.error && (
                            <div className="mt-4 p-4 bg-green-50 text-green-700 rounded-lg flex items-center gap-2 border border-green-100">
                                <CheckCircle2 size={20} />
                                <p>Proceso completado exitosamente.</p>
                            </div>
                        )}
                     </div>
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