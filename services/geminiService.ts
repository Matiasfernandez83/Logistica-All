import { GoogleGenAI, Type, Schema } from "@google/genai";
import { TruckRecord } from "../types";

// Initialize AI client
const getAiClient = () => {
    const apiKey = process.env.API_KEY;
    if (!apiKey) {
        throw new Error("CRÍTICO: API_KEY no detectada. Configure la variable de entorno en su panel de hosting/nube.");
    }
    return new GoogleGenAI({ apiKey });
};

const responseSchema: Schema = {
  type: Type.ARRAY,
  items: {
    type: Type.OBJECT,
    properties: {
      patente: {
        type: Type.STRING,
        description: "La patente o matrícula del camión (ej: AB123CD).",
      },
      tag: {
        type: Type.STRING,
        description: "El número de TAG, dispositivo de peaje o telepase (ej: SI9000091297935HN). Generalmente es un código alfanumérico largo que empieza con letras como SI, O, etc.",
      },
      dueno: {
        type: Type.STRING,
        description: "Nombre del propietario o dueño del camión.",
      },
      valor: {
        type: Type.NUMBER,
        description: "El valor monetario, monto, flete o cantidad numérica asociada.",
      },
      concepto: {
        type: Type.STRING,
        description: "Breve descripción del servicio o ítem (ej: Flete, Reparación, Viaje, Peaje).",
      },
      fecha: {
        type: Type.STRING,
        description: "Fecha del servicio si está disponible (YYYY-MM-DD).",
      }
    },
    required: ["patente", "dueno", "valor", "concepto"],
  },
};

const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export const processDocuments = async (
  contents: { mimeType: string; data: string }[],
  retries = 3
): Promise<TruckRecord[]> => {
  let lastError: any;

  for (let attempt = 1; attempt <= retries; attempt++) {
      try {
        const ai = getAiClient();

        const parts = contents.map(c => {
            if (c.mimeType === 'text/plain') {
                return { text: c.data };
            }
            return {
                inlineData: {
                    mimeType: c.mimeType,
                    data: c.data
                }
            }
        });

        const prompt = `
          Actúa como un sistema experto de ERP y contabilidad logística.
          Analiza el documento proporcionado (PDF de facturación, reporte o excel).
          
          Tu objetivo principal es extraer el NÚMERO DE TAG (Dispositivo/Device ID) para poder cruzar la información.
          El número de TAG suele tener formatos largos alfanuméricos como "SI9000091297935HN" o similares.
          
          Extrae para cada movimiento o línea de detalle encontrada:
          1. Número de TAG (CRÍTICO: Busca códigos largos identificadores de dispositivo).
          2. Patente (License Plate) - Si aparece.
          3. Dueño (Owner Name) - Si aparece.
          4. Valor/Monto (Value/Amount) - Solo valores numéricos positivos.
          5. Concepto (Description)
          
          Si el documento contiene múltiples páginas o tablas, procésalas todas.
          
          Retorna SOLAMENTE un JSON array válido bajo el esquema provisto.
        `;

        // Add the prompt as the last part
        const requestParts = [...parts, { text: prompt }];

        const response = await ai.models.generateContent({
          model: "gemini-2.5-flash",
          contents: { parts: requestParts },
          config: {
            responseMimeType: "application/json",
            responseSchema: responseSchema,
            temperature: 0.1, // Low temperature for extraction accuracy
          },
        });

        const text = response.text;
        if (!text) return [];

        const data = JSON.parse(text) as Omit<TruckRecord, 'id'>[];
        
        // Add IDs locally
        return data.map((item, index) => ({
            ...item,
            id: `gen-${Date.now()}-${index}-${Math.random().toString(36).substr(2, 5)}`
        }));

      } catch (error: any) {
        lastError = error;
        console.warn(`Intento ${attempt} fallido:`, error.message);
        
        // Don't retry on auth errors
        if (error.message?.includes('401') || error.message?.includes('API_KEY')) {
            throw new Error("Error de autenticación: API Key inválida o faltante en la configuración del servidor.");
        }
        
        // Wait before retrying (exponential backoff)
        if (attempt < retries) {
            await wait(attempt * 2000);
        }
      }
  }

  // If we get here, all retries failed
  console.error("Error processing documents with Gemini after retries:", lastError);
  
  if (lastError.message?.includes('429')) throw new Error("Límite de cuota excedido (429). El sistema está saturado, intente más tarde.");
  if (lastError.message?.includes('500')) throw new Error("Error interno de Google IA (500). Intente nuevamente.");
  if (lastError.message?.includes('503')) throw new Error("Servicio de IA temporalmente no disponible (503).");
  
  throw new Error(`Error de conexión: ${lastError.message}`);
};