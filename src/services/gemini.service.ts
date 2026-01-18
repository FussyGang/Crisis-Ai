import { Injectable } from '@angular/core';
import { GoogleGenAI } from "@google/genai";

export interface EmergencyResource {
  name: string;
  type: 'Hospital' | 'Police' | 'Fire' | 'Shelter' | 'Other';
  address: string;
  phone: string;
}

@Injectable({
  providedIn: 'root'
})
export class GeminiService {
  private ai: GoogleGenAI;
  private readonly MODEL_NAME = 'gemini-2.5-flash';

  constructor() {
    // Assuming process.env.API_KEY is available in the environment
    this.ai = new GoogleGenAI({ apiKey: process.env.API_KEY || '' });
  }

  async generateEmergencyProtocol(
    disasterType: string,
    location: { lat: number, lng: number } | string,
    severity: string
  ): Promise<string> {
    const locStr = typeof location === 'string' ? location : `${location.lat}, ${location.lng}`;
    
    const prompt = `
      CRITICAL EMERGENCY ALERT.
      Type: ${disasterType}
      Location: ${locStr}
      Severity/Context: ${severity}

      ACT AS A GLOBAL CRISIS RESPONSE CENTER.
      1. ANALYZE the situation immediately.
      2. PROVIDE a step-by-step survival protocol.
      3. IF valid coordinates are known, mention 1-2 key landmarks nearby as reference points.
      4. FORMAT the response with clear HEADINGS, BULLET POINTS, and BOLD text for readability. 
      5. KEEP IT CONCISE. Time is critical.
    `;

    try {
      const response = await this.ai.models.generateContent({
        model: this.MODEL_NAME,
        contents: prompt,
        config: {
          tools: [{ googleSearch: {} }],
          systemInstruction: "You are CrisisGuard AI. Priority: SAVING LIVES. Be authoritative, calm, precise. Use short sentences.",
          thinkingConfig: { thinkingBudget: 0 }
        }
      });
      
      let text = response.text || '';

      // Extract and append grounding sources (URLs)
      const chunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks;
      if (chunks) {
        const urls = chunks
          .map((chunk: any) => chunk.web?.uri)
          .filter((url: string) => url);
        
        if (urls.length > 0) {
          text += `\n\n**Verified Sources:**\n${urls.slice(0, 3).join('\n')}`;
        }
      }
      
      return text;
    } catch (error) {
      console.error('Gemini Protocol Error:', error);
      return "CRITICAL ERROR: Unable to contact AI Command. FOLLOW STANDARD PROTOCOLS: 1. Ensure Safety. 2. Call Local Emergency Services (911/112). 3. Seek Shelter.";
    }
  }

  async findNearbyResources(location: { lat: number, lng: number } | string): Promise<EmergencyResource[]> {
    const locStr = typeof location === 'string' ? location : `${location.lat}, ${location.lng}`;

    const prompt = `
      Find the nearest REAL emergency resources to this location: "${locStr}".
      
      Search specifically for:
      1. Hospitals / Medical Centers
      2. Police Stations
      3. Fire Stations
      4. Emergency Shelters

      Return the result as a raw JSON array of objects.
      Each object must strictly have these keys:
      - "name": Name of the facility
      - "type": One of ["Hospital", "Police", "Fire", "Shelter"]
      - "address": The physical address
      - "phone": The phone number (if not found, use "911")

      Provide the top 4-5 closest results.
      DO NOT include markdown formatting (like \`\`\`json). Just the raw JSON array.
    `;

    try {
      const response = await this.ai.models.generateContent({
        model: this.MODEL_NAME,
        contents: prompt,
        config: {
          tools: [{ googleSearch: {} }],
          thinkingConfig: { thinkingBudget: 0 } 
        }
      });

      const text = response.text || '';
      
      // Basic extraction of JSON array from text (in case model adds conversational fluff)
      const jsonMatch = text.match(/\[.*\]/s);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }
      return [];
    } catch (error) {
      console.error('Gemini Resources Error:', error);
      return [];
    }
  }

  async chatWithProfessional(history: {role: 'user' | 'model', parts: { text: string }[]}[], message: string): Promise<string> {
    try {
      const chat = this.ai.chats.create({
        model: this.MODEL_NAME,
        config: {
          systemInstruction: "You are a professional Crisis Response Specialist. You are talking to a victim or a helper in a potential crisis. Be empathetic but focused on solution and safety. Provide verified information where possible.",
        },
        history: history
      });

      const response = await chat.sendMessage({ message });
      return response.text;
    } catch (error) {
      console.error('Gemini Chat Error:', error);
      return "I am having trouble connecting. Please ensure you are safe and call emergency services if needed.";
    }
  }
}