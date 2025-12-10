
// Global definition for process.env to satisfy TypeScript in browser
declare global {
  interface Window {
    process: {
      env: {
        [key: string]: string | undefined;
      };
    };
  }
}

export interface TruckRecord {
  id: string;
  patente: string;
  dueno: string;
  valor: number;
  concepto: string;
  fecha?: string;
  tag?: string;
  // Link to source file (Invoice/Bill)
  sourceFileId?: string;
  sourceFileName?: string;
  // New fields for database matching
  isVerified?: boolean;
  registeredOwner?: string;
  equipo?: string; // Number of equipment/unit from DB
}

// NEW: Record specific for Credit Card Expenses (Tolls)
export interface ExpenseRecord {
  id: string;
  fecha: string;
  concepto: string;
  monto: number;
  categoria: 'PEAJE' | 'AUTOPISTA' | 'TELEPASE' | 'OTRO';
  sourceFileId: string;
  sourceFileName: string;
}

export interface FleetRecord {
  patente: string;
  dueno: string; // Maps to Responsable de Usuario
  tag?: string;
  equipo?: string; // Maps to Numero de Equipo
}

export interface ProcessingStatus {
  isProcessing: boolean;
  error: string | null;
  success: boolean;
  processedCount?: number;
  totalCount?: number;
}

export interface UploadedFile {
  id?: string; // For DB storage
  name: string;
  type: string;
  size: number;
  content: string | ArrayBuffer | null; // Base64 for PDF, BinaryString for Excel
  originalFile?: File; // Optional because when loading from DB we don't have the File object
  timestamp?: number;
}

export enum FileType {
  PDF = 'application/pdf',
  EXCEL = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  EXCEL_OLD = 'application/vnd.ms-excel',
}

// Updated View type
export type View = 'dashboard' | 'import' | 'reports' | 'settings' | 'expenses';

export interface ModalData {
    isOpen: boolean;
    title: string;
    type: 'list' | 'detail';
    records?: TruckRecord[] | ExpenseRecord[];
    singleRecord?: TruckRecord;
}

// --- NEW TYPES FOR AUTH & SETTINGS ---

export interface User {
    id: string;
    email: string;
    password: string; // Stored locally
    name: string;
    role: 'admin' | 'user';
    createdAt: number;
}

export interface ThemeSettings {
    primaryColor: 'blue' | 'green' | 'purple' | 'slate' | 'orange';
    fontFamily: 'inter' | 'roboto' | 'mono';
    processingMode?: 'free' | 'fast'; // 'free' adds delay to save costs/quota, 'fast' ignores limits
}

export interface AppConfig {
    theme: ThemeSettings;
    currentUser: User | null;
}

export interface PaginationState {
    currentPage: number;
    itemsPerPage: number;
}
