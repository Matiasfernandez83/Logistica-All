
import { TruckRecord, ExpenseRecord } from "../types";

// --- HELPERS ---

const getApiKey = () => {
    let apiKey: string | undefined = undefined;
    try {
        if (typeof process !== 'undefined' && process.env) apiKey = process.env.API_KEY;
        if (!apiKey && typeof window !== 'undefined' && (window as any).process?.env) apiKey = (window as any).process.env.API_KEY;
    } catch (e) { console.warn(e); }
    
    if (!apiKey) throw new Error("CRÍTICO: API_KEY no detectada.");
    return apiKey;
};

const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

const getResponseSchema = () => ({
    type: "ARRAY",
    items: {
      type: "OBJECT",
      properties: {
        patente: { type: "STRING", description: "La patente o matrícula del camión (ej: AB123CD)." },
        tag: { type: "STRING", description: "El número de TAG, dispositivo de peaje o telepase." },
        dueno: { type: "STRING", description: "Nombre del propietario o dueño del camión." },
        valor: { type: "NUMBER", description: "El valor monetario, monto, flete o cantidad numérica." },
        concepto: { type: "STRING", description: "Breve descripción del servicio o ítem." },
        fecha: { type: "STRING", description: "Fecha del servicio si está disponible (YYYY-MM-DD)." }
      },
      required: ["patente", "dueno", "valor", "concepto"],
    },
});

/**
 * Helper to safely parse JSON from LLM output, 
 * stripping Markdown code blocks (```json ... ```) if present.
 */
const cleanAndParseJSON = (text: string): any[] => {
    try {
        if (!text) return [];
        
        let cleaned = text.trim();
        
        // Remove Markdown code blocks
        if (cleaned.startsWith('```')) {
             cleaned = cleaned.replace(/^```(json)?/i, '').replace(/```$/, '');
        }
        
        cleaned = cleaned.trim();
        
        // Find the first '[' and last ']' to ignore any conversational text outside the array
        const firstBracket = cleaned.indexOf('[');
        const lastBracket = cleaned.lastIndexOf(']');
        
        if (firstBracket !== -1 && lastBracket !== -1) {
            cleaned = cleaned.substring(firstBracket, lastBracket + 1);
        }

        return JSON.parse(cleaned);
    } catch (e) {
        console.error("JSON Parse Error on text:", text);
        throw new Error("La IA generó un formato inválido. Intente nuevamente.");
    }
};

// --- FALLBACK METHOD (DIRECT REST API) ---
// This acts as a backup engine if the @google/genai library fails to load via CDN
const generateContentFallback = async (apiKey: string, prompt: string, contents: any[], schema?: any) => {
    console.warn("Using Fallback REST API for generation...");
    
    const parts = contents.map((c: any) => {
        if (c.mimeType === 'text/plain') return { text: c.data };
        return { inlineData: { mimeType: c.mimeType, data: c.data } };
    });
    
    const generationConfig: any = {
        temperature: 0.1
    };

    // Only add schema if provided (Conversor mode might usually be free-form JSON)
    if (schema) {
        generationConfig.responseMimeType = "application/json";
        generationConfig.responseSchema = schema;
    } else {
         generationConfig.responseMimeType = "application/json";
    }
    
    const requestBody = {
        contents: [{ parts: [...parts, { text: prompt }] }],
        generationConfig
    };

    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
        throw new Error(`Fallback API Error: ${response.status} ${response.statusText}`);
    }

    const json = await response.json();
    return json.candidates?.[0]?.content?.parts?.[0]?.text || "[]";
};

// --- MAIN SERVICE: TRUCK LOGISTICS ---

export const processDocuments = async (
  contents: { mimeType: string; data: string }[],
  retries = 3
): Promise<TruckRecord[]> => {
  let lastError: any;
  const apiKey = getApiKey();
  const schema = getResponseSchema();
  const prompt = `
    Actúa como un sistema experto de ERP y contabilidad logística.
    Analiza el documento proporcionado.
    Extrae para cada movimiento: TAG, Patente, Dueño, Valor, Concepto.
    Si encuentras tablas, procesa cada fila.
    Retorna SOLAMENTE un JSON array válido.
  `;

  for (let attempt = 1; attempt <= retries; attempt++) {
      try {
        let textResult = "";

        // TRY 1: OFFICIAL SDK
        try {
            const { GoogleGenAI } = await import("@google/genai");
            const ai = new GoogleGenAI({ apiKey });
            
            const sdkParts = contents.map(c => {
                if (c.mimeType === 'text/plain') return { text: c.data };
                return { inlineData: { mimeType: c.mimeType, data: c.data } };
            });

            const response = await ai.models.generateContent({
                model: "gemini-2.5-flash",
                contents: { parts: [...sdkParts, { text: prompt }] },
                config: {
                    responseMimeType: "application/json",
                    responseSchema: schema,
                    temperature: 0.1,
                },
            });
            textResult = response.text || "[]";
            
        } catch (importOrSdkErr) {
            console.error("SDK load failed, switching to fallback", importOrSdkErr);
            // TRY 2: FALLBACK REST API
            textResult = await generateContentFallback(apiKey, prompt, contents, schema);
        }

        // Use safe cleaner
        const data = cleanAndParseJSON(textResult) as Omit<TruckRecord, 'id'>[];
        
        return data.map((item, index) => ({
            ...item,
            id: `gen-${Date.now()}-${index}-${Math.random().toString(36).substr(2, 5)}`
        }));

      } catch (error: any) {
        lastError = error;
        console.warn(`Intento ${attempt} fallido:`, error.message);
        
        if (error.message?.includes('401') || error.message?.includes('API_KEY')) {
            throw new Error("Error de autenticación: API Key inválida.");
        }
        if (attempt < retries) await wait(attempt * 2000);
      }
  }
  
  throw new Error(`Error final: ${lastError?.message || 'No se pudo procesar el archivo.'}`);
};

// --- NEW SERVICE: CREDIT CARD EXPENSES (TOLLS) ---

export const processCardExpenses = async (
    contents: { mimeType: string; data: string }[],
    retries = 3
): Promise<ExpenseRecord[]> => {
    let lastError: any;
    const apiKey = getApiKey();
    
    // Strict Keywords List based on user prompt
    const keywords = [
        "corredores viales", "autopista urban", "aubasa", "autopista del OE", 
        "autopista del sol", "autopista", "camino", "camino pque b ay", 
        "cvsa accesos", "telepeaje plus", "telepeajes", "telepeajes eze"
    ];

    const prompt = `
        Actúa como un analista de tarjetas de crédito experto en logística.
        Analiza este resumen de cuenta (PDF o Excel).
        Tu objetivo es extraer ÚNICAMENTE las líneas de gastos correspondientes a PEAJES y AUTOPISTAS.
        
        1. Busca descripciones o conceptos que contengan o sean similares a las siguientes palabras clave (fuzzy match):
           ${keywords.join(', ')}.
        2. IGNORA cualquier otro gasto (supermercados, combustible, comida, compras, etc.).
        3. Para cada gasto encontrado, extrae:
           - fecha (YYYY-MM-DD)
           - concepto (descripción textual)
           - monto (numérico)
           - categoria (Clasifica como 'PEAJE', 'TELEPASE' o 'AUTOPISTA' según corresponda).
        
        Retorna SOLAMENTE un JSON array con los objetos encontrados.
    `;
    
    const expenseSchema = {
        type: "ARRAY",
        items: {
            type: "OBJECT",
            properties: {
                fecha: { type: "STRING" },
                concepto: { type: "STRING" },
                monto: { type: "NUMBER" },
                categoria: { type: "STRING", enum: ["PEAJE", "AUTOPISTA", "TELEPASE", "OTRO"] }
            },
            required: ["fecha", "concepto", "monto", "categoria"]
        }
    };

    for (let attempt = 1; attempt <= retries; attempt++) {
        try {
            let textResult = "";

            try {
                const { GoogleGenAI } = await import("@google/genai");
                const ai = new GoogleGenAI({ apiKey });
                
                const sdkParts = contents.map(c => {
                    if (c.mimeType === 'text/plain') return { text: c.data };
                    return { inlineData: { mimeType: c.mimeType, data: c.data } };
                });

                const response = await ai.models.generateContent({
                    model: "gemini-2.5-flash",
                    contents: { parts: [...sdkParts, { text: prompt }] },
                    config: {
                        responseMimeType: "application/json",
                        responseSchema: expenseSchema,
                        temperature: 0.1,
                    },
                });
                textResult = response.text || "[]";
            } catch (err) {
                console.error("SDK Expenses load failed", err);
                textResult = await generateContentFallback(apiKey, prompt, contents, expenseSchema);
            }

            const data = cleanAndParseJSON(textResult) as Omit<ExpenseRecord, 'id' | 'sourceFileId' | 'sourceFileName'>[];
            
            // Post-processing verification (optional double check)
            // Ideally the model did the filtering, but we trust the schema validation.
            
            return data.map((item, index) => ({
                ...item,
                id: `exp-${Date.now()}-${index}-${Math.random().toString(36).substr(2, 5)}`,
                sourceFileId: '',
                sourceFileName: ''
            }));

        } catch (error: any) {
             lastError = error;
             if (attempt < retries) await wait(attempt * 2000);
        }
    }
    throw new Error(`Error en gastos: ${lastError?.message}`);
};


export const convertPdfToData = async (
    contents: { mimeType: string; data: string }[]
): Promise<any[]> => {
    const apiKey = getApiKey();
    // Stronger prompt to enforce format
    const prompt = `
        You are a data conversion engine. 
        Analyze this document image. Identify ALL tables. 
        Extract the data into a single flat JSON Array of Objects.
        Use the table headers as keys.
        Return ONLY the raw JSON string. Do NOT use Markdown formatting.
    `;

    try {
        let textResult = "";

        // TRY 1: SDK
        try {
            const { GoogleGenAI } = await import("@google/genai");
            const ai = new GoogleGenAI({ apiKey });
            
            const sdkParts = contents.map(c => ({ inlineData: { mimeType: c.mimeType, data: c.data } }));
            
            const response = await ai.models.generateContent({
                model: "gemini-2.5-flash",
                contents: { parts: [...sdkParts, { text: prompt }] },
                config: { 
                    responseMimeType: "application/json",
                    temperature: 0.1 
                },
            });
            textResult = response.text || "[]";
        } catch (e) {
             console.warn("SDK Conversion failed, trying fallback...", e);
             // TRY 2: Fallback
             textResult = await generateContentFallback(apiKey, prompt, contents);
        }
        
        // Clean markdown before parsing
        const result = cleanAndParseJSON(textResult);

        if (!Array.isArray(result)) {
             // If AI returned a wrapped object { data: [...] }, try to unwrap it
             if (typeof result === 'object' && result !== null) {
                 const values = Object.values(result);
                 const arrayVal = values.find(v => Array.isArray(v));
                 if (arrayVal) return arrayVal as any[];
             }
             throw new Error("El resultado no es una lista válida.");
        }

        return result;

    } catch (e: any) {
        console.error("Conversion error details:", e);
        throw new Error("Error al convertir PDF: " + e.message);
    }
};
