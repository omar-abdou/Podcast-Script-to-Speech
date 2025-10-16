// Decodes a base64 string into a Uint8Array.
export function decode(base64: string): Uint8Array {
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

// Encodes PCM data into a WAV file format Blob.
export function pcmToWav(pcmData: Uint8Array, sampleRate: number, numChannels: number): Blob {
    const pcmDataInt16 = new Int16Array(pcmData.buffer);
    const format = 1; // PCM
    const bitDepth = 16;
    const bytesPerSample = bitDepth / 8;
    const blockAlign = numChannels * bytesPerSample;
    const byteRate = sampleRate * blockAlign;
    const dataSize = pcmDataInt16.length * bytesPerSample;
    const chunkSize = 36 + dataSize;
    const buffer = new ArrayBuffer(44 + dataSize);
    const view = new DataView(buffer);

    // RIFF header
    writeString(view, 0, 'RIFF');
    view.setUint32(4, chunkSize, true);
    writeString(view, 8, 'WAVE');

    // fmt sub-chunk
    writeString(view, 12, 'fmt ');
    view.setUint32(16, 16, true); // Sub-chunk size
    view.setUint16(20, format, true);
    view.setUint16(22, numChannels, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, byteRate, true);
    view.setUint16(32, blockAlign, true);
    view.setUint16(34, bitDepth, true);

    // data sub-chunk
    writeString(view, 36, 'data');
    view.setUint32(40, dataSize, true);

    // Write PCM data
    for (let i = 0; i < pcmDataInt16.length; i++) {
        view.setInt16(44 + i * 2, pcmDataInt16[i], true);
    }

    return new Blob([view], { type: 'audio/wav' });
}

function writeString(view: DataView, offset: number, string: string): void {
    for (let i = 0; i < string.length; i++) {
        view.setUint8(offset + i, string.charCodeAt(i));
    }
}

/**
 * Converts an AudioBuffer's float data to a 16-bit PCM Uint8Array.
 * @param {AudioBuffer} audioBuffer The buffer to convert.
 * @returns {Uint8Array} The raw PCM data.
 */
function audioBufferToPcm(audioBuffer: AudioBuffer): Uint8Array {
    const numChannels = audioBuffer.numberOfChannels;
    const length = audioBuffer.length;
    const interleaved = new Float32Array(length * numChannels);

    for (let channel = 0; channel < numChannels; channel++) {
        const channelData = audioBuffer.getChannelData(channel);
        for (let i = 0; i < length; i++) {
            interleaved[i * numChannels + channel] = channelData[i];
        }
    }

    const pcmData = new Int16Array(interleaved.length);
    for (let i = 0; i < interleaved.length; i++) {
        const sample = Math.max(-1, Math.min(1, interleaved[i]));
        pcmData[i] = sample < 0 ? sample * 0x8000 : sample * 0x7FFF;
    }

    return new Uint8Array(pcmData.buffer);
}


/**
 * Mixes speech PCM data with a background music track.
 * @param {Uint8Array} speechPcmData The raw PCM data for the speech.
 * @param {string} musicUrl The URL of the background music file.
 * @param {number} musicVolume The volume for the background music (0 to 1).
 * @returns {Promise<Blob>} A promise that resolves with the mixed audio as a WAV Blob.
 */
export async function mixAudio(
    speechPcmData: Uint8Array,
    musicUrl: string,
    musicVolume: number
): Promise<Blob> {
    const tempContext = new AudioContext();
    const finalSampleRate = 24000;

    // 1. Create an AudioBuffer for the speech PCM data
    const speechArrayBuffer = speechPcmData.buffer;
    const speechDataInt16 = new Int16Array(speechArrayBuffer);
    const speechFrameCount = speechDataInt16.length; // Assuming mono
    const speechAudioBuffer = tempContext.createBuffer(1, speechFrameCount, finalSampleRate);
    const speechChannelData = speechAudioBuffer.getChannelData(0);
    for (let i = 0; i < speechFrameCount; i++) {
        speechChannelData[i] = speechDataInt16[i] / 32768.0;
    }
    
    // 2. Fetch and decode the music file
    const response = await fetch(musicUrl);
    if (!response.ok) {
        throw new Error(`Failed to fetch music file: ${response.statusText}`);
    }
    const musicArrayBuffer = await response.arrayBuffer();
    const musicAudioBuffer = await tempContext.decodeAudioData(musicArrayBuffer);

    // 3. Prepare the OfflineAudioContext for mixing
    const mixContext = new OfflineAudioContext(
        2, // Output stereo to accommodate stereo music tracks
        speechAudioBuffer.length,
        finalSampleRate
    );

    // 4. Create and connect nodes
    const speechSource = mixContext.createBufferSource();
    speechSource.buffer = speechAudioBuffer;
    
    const musicSource = mixContext.createBufferSource();
    musicSource.buffer = musicAudioBuffer;
    musicSource.loop = true;

    const musicGainNode = mixContext.createGain();
    musicGainNode.gain.setValueAtTime(musicVolume, 0);

    // Connect the graph: speech -> destination, music -> gain -> destination
    speechSource.connect(mixContext.destination);
    musicSource.connect(musicGainNode);
    musicGainNode.connect(mixContext.destination);

    // 5. Start sources and render the audio
    speechSource.start(0);
    musicSource.start(0);
    const mixedAudioBuffer = await mixContext.startRendering();
    
    await tempContext.close();

    // 7. Convert the final mixed AudioBuffer back to a WAV Blob
    const mixedPcmData = audioBufferToPcm(mixedAudioBuffer);
    return pcmToWav(mixedPcmData, finalSampleRate, mixedAudioBuffer.numberOfChannels);
}