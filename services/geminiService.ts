
import { GoogleGenAI, Modality } from "@google/genai";
import { VoiceSelection } from '../types';

function preprocessScriptForTTS(script: string): string {
    return script
        .split('\n')
        .map(line => {
            // Standardize speaker tags
            let processedLine = line.replace(/س1 \(الراوي\):/g, 'س1:');
            processedLine = processedLine.replace(/س2 \(المستفسر\):/g, 'س2:');
            // Remove audio cues and other non-dialogue lines for the model
            if (processedLine.trim().startsWith('(إرشاد صوتي)') || 
                processedLine.trim().startsWith('*') ||
                processedLine.trim().startsWith('عنوان الحلقة:') ||
                processedLine.trim().startsWith('المتحدثون:')
            ) {
                return '';
            }
            return processedLine;
        })
        .filter(line => line.trim() !== '')
        .join('\n');
}


export async function generateMultiSpeakerSpeech(script: string, voices: VoiceSelection): Promise<string | null> {
    if (!process.env.API_KEY) {
        throw new Error("API_KEY environment variable is not set.");
    }
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

    const processedScript = preprocessScriptForTTS(script);
    
    const prompt = `TTS the following conversation between س1 and س2:\n${processedScript}`;

    const response = await ai.models.generateContent({
        model: "gemini-2.5-flash-preview-tts",
        contents: [{ parts: [{ text: prompt }] }],
        config: {
            responseModalities: [Modality.AUDIO],
            speechConfig: {
                multiSpeakerVoiceConfig: {
                    speakerVoiceConfigs: [
                        {
                            speaker: 'س1',
                            voiceConfig: {
                                prebuiltVoiceConfig: { voiceName: voices.s1 }
                            }
                        },
                        {
                            speaker: 'س2',
                            voiceConfig: {
                                prebuiltVoiceConfig: { voiceName: voices.s2 }
                            }
                        }
                    ]
                }
            }
        }
    });

    const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
    
    return base64Audio || null;
}
