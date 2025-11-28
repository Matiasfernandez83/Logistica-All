import React from 'react';
import { LayoutDashboard, UploadCloud, Truck, FileText, Settings } from 'lucide-react';
import { View } from '../types';
import clsx from 'clsx';

interface SidebarProps {
    currentView: View;
    onNavigate: (view: View) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ currentView, onNavigate }) => {
  const navItemClass = (view: View) => clsx(
    "flex items-center gap-3 px-4 py-3 rounded-lg font-medium cursor-pointer transition-colors",
    currentView === view 
        ? "bg-blue-600 text-white" 
        : "text-slate-400 hover:text-white hover:bg-slate-800"
  );

  return (
    <div className="hidden md:flex flex-col w-64 bg-slate-900 text-white min-h-screen fixed left-0 top-0 z-10">
      <div className="p-6 border-b border-slate-800">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Truck className="text-blue-500" />
          <span>Logística<span className="text-blue-500">AI</span></span>
        </h1>
      </div>
      
      <nav className="flex-1 p-4 space-y-2">
        <div 
            onClick={() => onNavigate('dashboard')}
            className={navItemClass('dashboard')}
        >
          <LayoutDashboard size={20} />
          <span>Dashboard</span>
        </div>
        <div 
            onClick={() => onNavigate('import')}
            className={navItemClass('import')}
        >
          <UploadCloud size={20} />
          <span>Importar Datos</span>
        </div>
        <div 
            onClick={() => onNavigate('reports')}
            className={navItemClass('reports')}
        >
          <FileText size={20} />
          <span>Reportes</span>
        </div>
        <div 
            onClick={() => onNavigate('settings')}
            className={navItemClass('settings')}
        >
          <Settings size={20} />
          <span>Configuración</span>
        </div>
      </nav>

      <div className="p-4 border-t border-slate-800">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-blue-500 flex items-center justify-center font-bold">
            AD
          </div>
          <div>
            <p className="text-sm font-medium">Admin User</p>
            <p className="text-xs text-slate-400">Gerente Logística</p>
          </div>
        </div>
      </div>
    </div>
  );
};
