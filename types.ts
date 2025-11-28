export interface TruckRecord {
  id: string;
  patente: string;
  dueno: string;
  valor: number;
  concepto: string;
  fecha?: string;
  tag?: string;
  // New fields for database matching
  isVerified?: boolean;
  registeredOwner?: string;
  equipo?: string; // Number of equipment/unit from DB
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

export type View = 'dashboard' | 'import' | 'reports' | 'settings';

export interface ModalData {
    isOpen: boolean;
    title: string;
    type: 'list' | 'detail';
    records?: TruckRecord[];
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
}

export interface AppConfig {
    theme: ThemeSettings;
    currentUser: User | null;
}