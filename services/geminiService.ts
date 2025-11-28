import { GoogleGenAI, Type, Schema } from "@google/genai";
import { TruckRecord } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

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

export const processDocuments = async (
  contents: { mimeType: string; data: string }[]
): Promise<TruckRecord[]> => {
  try {
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
      Analiza los documentos proporcionados (PDFs de facturación de peajes, reportes de flota o excels).
      
      Tu objetivo principal es extraer el NÚMERO DE TAG (Dispositivo/Device ID) para poder cruzar la información.
      El número de TAG suele tener formatos largos alfanuméricos como "SI9000091297935HN" o similares.
      
      Extrae para cada movimiento:
      1. Número de TAG (CRÍTICO: Busca códigos largos identificadores de dispositivo).
      2. Patente (License Plate) - Si aparece.
      3. Dueño (Owner Name) - Si aparece.
      4. Valor/Monto (Value/Amount)
      5. Concepto (Description)
      
      Si hay múltiples filas o entradas en los archivos, extrae todas.
      
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
        id: `gen-${Date.now()}-${index}`
    }));

  } catch (error) {
    console.error("Error processing documents with Gemini:", error);
    throw error;
  }
};