
import React, { useEffect, useState } from 'react';
import { User, ThemeSettings } from '../types';
import { getUsers, saveUser } from '../utils/storage';
import { UserPlus, Palette, LogOut, Power, Maximize, Type, Users, Save, Zap, Coffee } from 'lucide-react';
import clsx from 'clsx';

interface SettingsViewProps {
    currentUser: User;
    currentTheme: ThemeSettings;
    onUpdateTheme: (theme: ThemeSettings) => void;
    onLogout: () => void;
}

export const SettingsView: React.FC<SettingsViewProps> = ({ currentUser, currentTheme, onUpdateTheme, onLogout }) => {
    const [users, setUsers] = useState<User[]>([]);
    const [newUser, setNewUser] = useState({ name: '', email: '', password: '' });
    
    // Theme options
    const colors: ThemeSettings['primaryColor'][] = ['blue', 'green', 'purple', 'slate', 'orange'];
    const fonts: ThemeSettings['fontFamily'][] = ['inter', 'roboto', 'mono'];

    useEffect(() => {
        loadUsers();
    }, []);

    const loadUsers = async () => {
        const loadedUsers = await getUsers();
        setUsers(loadedUsers);
    };

    const handleCreateUser = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newUser.name || !newUser.email || !newUser.password) return;

        const userToAdd: User = {
            id: `user-${Date.now()}`,
            name: newUser.name,
            email: newUser.email,
            password: newUser.password,
            role: 'user',
            createdAt: Date.now()
        };

        await saveUser(userToAdd);
        setNewUser({ name: '', email: '', password: '' });
        await loadUsers();
        alert('Usuario creado correctamente');
    };

    const toggleFullScreen = () => {
        if (!document.fullscreenElement) {
            document.documentElement.requestFullscreen();
        } else {
            if (document.exitFullscreen) {
                document.exitFullscreen();
            }
        }
    };

    return (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500 pb-12">
            
            {/* Cabecera */}
            <div>
                <h2 className="text-2xl font-bold text-slate-800 mb-2">Configuración del Sistema</h2>
                <p className="text-slate-500">Personalización, gestión de usuarios y opciones generales.</p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                
                {/* 1. OPTIMIZACIÓN DE COSTOS (NUEVO) */}
                <div className="lg:col-span-2 bg-white p-6 rounded-xl shadow-sm border border-slate-100">
                    <h3 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
                        <Zap className={`text-${currentTheme.primaryColor}-500`} />
                        Optimización de Costos y API (Créditos)
                    </h3>
                    <p className="text-sm text-slate-500 mb-6">
                        Selecciona cómo quieres que la IA procese tus archivos. Esto afecta la velocidad y el consumo de tu cuota de Google.
                    </p>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {/* MODO GRATUITO */}
                        <div 
                            onClick={() => onUpdateTheme({ ...currentTheme, processingMode: 'free' })}
                            className={clsx(
                                "cursor-pointer p-4 rounded-xl border-2 transition-all flex items-start gap-4",
                                (!currentTheme.processingMode || currentTheme.processingMode === 'free')
                                    ? "border-green-500 bg-green-50" 
                                    : "border-slate-200 bg-white hover:border-green-200"
                            )}
                        >
                            <div className="p-2 bg-green-100 text-green-600 rounded-lg">
                                <Coffee size={24} />
                            </div>
                            <div>
                                <h4 className="font-bold text-slate-800">Modo Gratuito (Recomendado)</h4>
                                <p className="text-xs text-slate-500 mt-1">
                                    Procesa 1 archivo cada 5 segundos. Evita errores de cuota y no consume créditos de pago si usas el "Free Tier" de Gemini.
                                </p>
                            </div>
                        </div>

                        {/* MODO RÁPIDO */}
                        <div 
                            onClick={() => onUpdateTheme({ ...currentTheme, processingMode: 'fast' })}
                            className={clsx(
                                "cursor-pointer p-4 rounded-xl border-2 transition-all flex items-start gap-4",
                                currentTheme.processingMode === 'fast'
                                    ? "border-blue-500 bg-blue-50" 
                                    : "border-slate-200 bg-white hover:border-blue-200"
                            )}
                        >
                            <div className="p-2 bg-blue-100 text-blue-600 rounded-lg">
                                <Zap size={24} />
                            </div>
                            <div>
                                <h4 className="font-bold text-slate-800">Modo Rápido / Pro</h4>
                                <p className="text-xs text-slate-500 mt-1">
                                    Máxima velocidad. Requiere que tu API Key tenga facturación habilitada en Google Cloud (Pago por uso).
                                </p>
                            </div>
                        </div>
                    </div>
                </div>

                {/* 2. APARIENCIA */}
                <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100">
                    <h3 className="text-lg font-bold text-slate-800 mb-6 flex items-center gap-2">
                        <Palette className={`text-${currentTheme.primaryColor}-500`} />
                        Apariencia Visual
                    </h3>

                    <div className="space-y-6">
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-3">Color Principal</label>
                            <div className="flex gap-4">
                                {colors.map(color => (
                                    <button
                                        key={color}
                                        onClick={() => onUpdateTheme({ ...currentTheme, primaryColor: color })}
                                        className={clsx(
                                            "w-10 h-10 rounded-full transition-all border-2",
                                            `bg-${color}-500`,
                                            currentTheme.primaryColor === color ? "border-slate-900 scale-110 shadow-md" : "border-transparent opacity-70 hover:opacity-100"
                                        )}
                                        title={color}
                                    />
                                ))}
                            </div>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-3 flex items-center gap-2">
                                <Type size={16}/> Tipografía
                            </label>
                            <div className="flex gap-3">
                                {fonts.map(font => (
                                    <button
                                        key={font}
                                        onClick={() => onUpdateTheme({ ...currentTheme, fontFamily: font })}
                                        className={clsx(
                                            "px-4 py-2 rounded-lg border text-sm font-medium transition-colors capitalize",
                                            currentTheme.fontFamily === font 
                                                ? `bg-${currentTheme.primaryColor}-50 text-${currentTheme.primaryColor}-700 border-${currentTheme.primaryColor}-200` 
                                                : "bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100"
                                        )}
                                        style={{ fontFamily: font === 'mono' ? 'monospace' : font === 'roboto' ? 'Roboto, sans-serif' : 'Inter, sans-serif' }}
                                    >
                                        {font}
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>

                {/* 3. OPCIONES DEL SISTEMA */}
                <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100">
                    <h3 className="text-lg font-bold text-slate-800 mb-6 flex items-center gap-2">
                        <Power className={`text-${currentTheme.primaryColor}-500`} />
                        Opciones de Sesión
                    </h3>
                    
                    <div className="grid grid-cols-2 gap-4">
                        <button 
                            onClick={toggleFullScreen}
                            className="flex flex-col items-center justify-center p-4 bg-slate-50 border border-slate-200 rounded-xl hover:bg-slate-100 transition-colors"
                        >
                            <Maximize className="text-slate-600 mb-2" />
                            <span className="text-sm font-medium text-slate-700">Pantalla Completa</span>
                        </button>
                        
                        <button 
                            onClick={() => window.location.reload()}
                            className="flex flex-col items-center justify-center p-4 bg-slate-50 border border-slate-200 rounded-xl hover:bg-slate-100 transition-colors"
                        >
                            <LogOut className="text-slate-600 mb-2 rotate-180" />
                            <span className="text-sm font-medium text-slate-700">Reiniciar App</span>
                        </button>

                        <button 
                            onClick={onLogout}
                            className="col-span-2 flex items-center justify-center gap-2 p-4 bg-red-50 border border-red-200 rounded-xl hover:bg-red-100 transition-colors text-red-700 font-bold"
                        >
                            <LogOut size={20} />
                            Cerrar Sesión / Salir
                        </button>
                    </div>

                    <div className="mt-6 p-4 bg-slate-50 rounded-lg text-xs text-slate-500">
                        <p>Sesión iniciada como: <span className="font-bold text-slate-700">{currentUser.email}</span></p>
                        <p>Rol: <span className="uppercase">{currentUser.role}</span></p>
                    </div>
                </div>

                {/* 4. GESTIÓN DE USUARIOS (Solo Admin) */}
                {currentUser.role === 'admin' && (
                    <div className="lg:col-span-2 bg-white p-6 rounded-xl shadow-sm border border-slate-100">
                        <h3 className="text-lg font-bold text-slate-800 mb-6 flex items-center gap-2">
                            <Users className={`text-${currentTheme.primaryColor}-500`} />
                            Gestión de Usuarios y Accesos
                        </h3>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                            {/* Formulario Alta */}
                            <div className="bg-slate-50 p-6 rounded-xl border border-slate-200">
                                <h4 className="font-bold text-slate-700 mb-4 flex items-center gap-2">
                                    <UserPlus size={18}/> Dar de Alta Usuario
                                </h4>
                                <form onSubmit={handleCreateUser} className="space-y-4">
                                    <div>
                                        <label className="text-xs font-bold text-slate-500 uppercase">Nombre Completo</label>
                                        <input 
                                            type="text" 
                                            className="w-full mt-1 px-3 py-2 rounded border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                            value={newUser.name}
                                            onChange={e => setNewUser({...newUser, name: e.target.value})}
                                            required
                                        />
                                    </div>
                                    <div>
                                        <label className="text-xs font-bold text-slate-500 uppercase">Correo Electrónico (Login)</label>
                                        <input 
                                            type="email" 
                                            className="w-full mt-1 px-3 py-2 rounded border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                            value={newUser.email}
                                            onChange={e => setNewUser({...newUser, email: e.target.value})}
                                            required
                                        />
                                    </div>
                                    <div>
                                        <label className="text-xs font-bold text-slate-500 uppercase">Contraseña</label>
                                        <input 
                                            type="text" 
                                            className="w-full mt-1 px-3 py-2 rounded border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                            value={newUser.password}
                                            onChange={e => setNewUser({...newUser, password: e.target.value})}
                                            placeholder="Asignar contraseña"
                                            required
                                        />
                                    </div>
                                    <button className={`w-full py-2 bg-${currentTheme.primaryColor}-600 text-white rounded-lg font-bold hover:bg-${currentTheme.primaryColor}-700 flex items-center justify-center gap-2`}>
                                        <Save size={16} /> Registrar Usuario
                                    </button>
                                </form>
                            </div>

                            {/* Lista Usuarios */}
                            <div>
                                <h4 className="font-bold text-slate-700 mb-4">Lista de Correos Registrados</h4>
                                <div className="bg-white border border-slate-200 rounded-lg overflow-hidden max-h-80 overflow-y-auto">
                                    <table className="w-full text-left text-sm">
                                        <thead className="bg-slate-100 text-slate-500 font-bold">
                                            <tr>
                                                <th className="px-4 py-2">Nombre</th>
                                                <th className="px-4 py-2">Email</th>
                                                <th className="px-4 py-2">Rol</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100">
                                            {users.map(u => (
                                                <tr key={u.id}>
                                                    <td className="px-4 py-2 font-medium">{u.name}</td>
                                                    <td className="px-4 py-2 text-slate-500">{u.email}</td>
                                                    <td className="px-4 py-2">
                                                        <span className="bg-slate-100 text-slate-600 px-2 py-0.5 rounded text-xs uppercase font-bold">
                                                            {u.role}
                                                        </span>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};
