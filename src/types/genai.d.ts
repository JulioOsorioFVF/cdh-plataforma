declare module '@google/genai' {
  export class GoogleGenAI {
    constructor(options?: { apiKey?: string });
    models: {
      generateContent(params: any): Promise<any>;
      embedContent(params: any): Promise<any>;
    };
  }
  export const Type: {
    OBJECT: string;
    STRING: string;
    ARRAY: string;
    INTEGER: string;
    NUMBER: string;
    BOOLEAN: string;
    [key: string]: any;
  };
  export type Schema = any;
}

declare module 'pdfjs-dist/legacy/build/pdf.mjs' {
  export function getDocument(params: any): {
    promise: Promise<{
      numPages: number;
      getPage(index: number): Promise<{
        getTextContent(): Promise<{
          items: Array<{ str: string }>;
        }>;
      }>;
      destroy(): Promise<void>;
    }>;
  };
}

declare module 'read-excel-file/node' {
  export default function readXlsxFile(input: any): Promise<any[][]>;
}
