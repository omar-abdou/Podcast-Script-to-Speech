import React, { useState, useEffect } from 'react';
import { PODCAST_SCRIPT, AVAILABLE_VOICES, BACKGROUND_MUSIC_TRACKS } from './constants';
import { Speaker, VoiceSelection } from './types';
import { generateMultiSpeakerSpeech } from './services/geminiService';
import { pcmToWav, decode, mixAudio } from './utils/audio';
import { Spinner } from './components/Spinner';

const App: React.FC = () => {
  const [voices, setVoices] = useState<VoiceSelection>({
    s1: 'Kore',
    s2: 'Puck',
  });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [backgroundMusic, setBackgroundMusic] = useState<string>(BACKGROUND_MUSIC_TRACKS[0].value);
  const [musicVolume, setMusicVolume] = useState<number>(0.15);
  const [customMusicUrl, setCustomMusicUrl] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string>('');

  useEffect(() => {
    // This effect cleans up Object URLs on component unmount to prevent memory leaks
    return () => {
      if (audioUrl) URL.revokeObjectURL(audioUrl);
      if (customMusicUrl) URL.revokeObjectURL(customMusicUrl);
    };
  }, []);

  const handleVoiceChange = (speaker: Speaker, voice: string) => {
    setVoices((prev) => ({ ...prev, [speaker]: voice }));
  };

  const handleMusicUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      if (customMusicUrl) {
        URL.revokeObjectURL(customMusicUrl); // Clean up previous custom URL
      }
      setCustomMusicUrl(URL.createObjectURL(file));
    }
  };

  const handleGenerateAudio = async () => {
    setIsLoading(true);
    setError(null);
    if (audioUrl) {
        URL.revokeObjectURL(audioUrl);
    }
    setAudioUrl(null);
    try {
      setStatusMessage('جارٍ إنشاء الكلام...');
      const base64Audio = await generateMultiSpeakerSpeech(PODCAST_SCRIPT, voices);
      if (!base64Audio) {
        throw new Error('Received empty audio data from the API.');
      }
      
      const pcmData = decode(base64Audio);

      const selectedMusicUrl = backgroundMusic === 'custom' ? customMusicUrl : backgroundMusic;
      let finalAudioBlob: Blob;

      if (selectedMusicUrl && selectedMusicUrl !== 'none') {
          if (!selectedMusicUrl) {
            throw new Error('الرجاء رفع ملف موسيقى مخصص للمتابعة.');
          }
          setStatusMessage('جارٍ دمج موسيقى الخلفية...');
          finalAudioBlob = await mixAudio(pcmData, selectedMusicUrl, musicVolume);
      } else {
          finalAudioBlob = pcmToWav(pcmData, 24000, 1);
      }

      const url = URL.createObjectURL(finalAudioBlob);
      setAudioUrl(url);

    } catch (err) {
      console.error('Error generating audio:', err);
      setError(err instanceof Error ? err.message : 'An unknown error occurred.');
    } finally {
      setIsLoading(false);
      setStatusMessage('');
    }
  };

  return (
    <div className="min-h-screen bg-gray-900 text-white p-4 sm:p-6 lg:p-8" dir="rtl">
      <div className="max-w-7xl mx-auto">
        <header className="text-center mb-8">
          <h1 className="text-4xl sm:text-5xl font-bold text-cyan-400">مولّد البودكاست الصوتي</h1>
          <p className="text-lg text-gray-400 mt-2">حوّل النص إلى بودكاست مسموع مع موسيقى خلفية باستخدام Gemini</p>
        </header>

        <main className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <div className="bg-gray-800 rounded-xl shadow-lg p-6 space-y-6">
            <h2 className="text-2xl font-bold border-b-2 border-cyan-500 pb-2">عناصر التحكم</h2>
            <div className="space-y-6">
                <h3 className="text-xl font-bold text-gray-200">أصوات المتحدثين</h3>
                <VoiceSelector
                  speaker="s1"
                  speakerName="س1 (الراوي)"
                  selectedVoice={voices.s1}
                  onVoiceChange={handleVoiceChange}
                  disabled={isLoading}
                />
                <VoiceSelector
                  speaker="s2"
                  speakerName="س2 (المستفسر)"
                  selectedVoice={voices.s2}
                  onVoiceChange={handleVoiceChange}
                  disabled={isLoading}
                />
            </div>

            <div className="border-t border-gray-700 pt-6 space-y-6">
                <h3 className="text-xl font-bold text-gray-200">موسيقى الخلفية</h3>
                <div>
                    <label htmlFor="music-select" className="block text-lg font-medium text-gray-300 mb-2">
                        اختر مقطعًا
                    </label>
                    <select
                        id="music-select"
                        value={backgroundMusic}
                        disabled={isLoading}
                        onChange={(e) => {
                            setBackgroundMusic(e.target.value);
                            if (e.target.value !== 'custom' && customMusicUrl) {
                                URL.revokeObjectURL(customMusicUrl);
                                setCustomMusicUrl(null);
                            }
                        }}
                        className="w-full bg-gray-700 border border-gray-600 text-white text-md rounded-lg focus:ring-cyan-500 focus:border-cyan-500 block p-2.5 disabled:opacity-50"
                    >
                        {BACKGROUND_MUSIC_TRACKS.map(track => (
                            <option key={track.value} value={track.value}>{track.name}</option>
                        ))}
                        <option value="custom">تحميل ملف مخصص</option>
                    </select>
                </div>

                {backgroundMusic === 'custom' && (
                    <div>
                        <label htmlFor="music-upload" className="block text-lg font-medium text-gray-300 mb-2">
                            رفع ملف صوتي (MP3, WAV)
                        </label>
                        <input
                            type="file"
                            id="music-upload"
                            accept="audio/mpeg, audio/wav, audio/mp3"
                            disabled={isLoading}
                            onChange={handleMusicUpload}
                            className="w-full text-sm text-gray-400 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-cyan-50 file:text-cyan-700 hover:file:bg-cyan-100 disabled:opacity-50"
                        />
                    </div>
                )}

                {backgroundMusic !== 'none' && (
                    <div>
                        <label htmlFor="music-volume" className="block text-lg font-medium text-gray-300 mb-2">
                            مستوى صوت الخلفية ({Math.round(musicVolume * 100)}%)
                        </label>
                        <input
                            id="music-volume"
                            type="range"
                            min="0"
                            max="0.5"
                            step="0.01"
                            disabled={isLoading}
                            value={musicVolume}
                            onChange={(e) => setMusicVolume(parseFloat(e.target.value))}
                            className="w-full h-2 bg-gray-600 rounded-lg appearance-none cursor-pointer accent-cyan-500 disabled:opacity-50"
                        />
                    </div>
                )}
            </div>

            <button
              onClick={handleGenerateAudio}
              disabled={isLoading}
              className="w-full bg-cyan-600 hover:bg-cyan-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white font-bold py-3 px-4 rounded-lg transition-transform transform hover:scale-105 focus:outline-none focus:ring-4 focus:ring-cyan-500/50 flex items-center justify-center space-x-2"
            >
              {isLoading && <Spinner />}
              <span>{isLoading ? statusMessage || 'جاري الإنشاء...' : 'إنشاء المقطع الصوتي'}</span>
            </button>

            {error && <div className="text-red-400 bg-red-900/50 p-3 rounded-lg text-center">{error}</div>}
            
            {audioUrl && (
              <div className="mt-6">
                <h3 className="text-xl font-bold mb-2">الاستماع للبودكاست</h3>
                <audio controls src={audioUrl} className="w-full rounded-lg">
                  Your browser does not support the audio element.
                </audio>
              </div>
            )}
          </div>

          <div className="bg-gray-800 rounded-xl shadow-lg p-6">
            <h2 className="text-2xl font-bold border-b-2 border-cyan-500 pb-2 mb-4">نص البودكاست</h2>
            <div className="h-[60vh] overflow-y-auto pr-4 space-y-4 text-gray-300 leading-loose">
              {PODCAST_SCRIPT.split('\n').map((line, index) => {
                if (line.startsWith('س1')) {
                    return <p key={index}><strong className="text-cyan-400">{line.substring(0, line.indexOf(':') + 1)}</strong>{line.substring(line.indexOf(':') + 1)}</p>;
                }
                if (line.startsWith('س2')) {
                    return <p key={index}><strong className="text-teal-400">{line.substring(0, line.indexOf(':') + 1)}</strong>{line.substring(line.indexOf(':') + 1)}</p>;
                }
                if (line.startsWith('(إرشاد صوتي)')) {
                    return <p key={index} className="text-gray-500 italic">{line}</p>;
                }
                return <p key={index}>{line}</p>;
              })}
            </div>
          </div>
        </main>
      </div>
    </div>
  );
};

interface VoiceSelectorProps {
    speaker: Speaker;
    speakerName: string;
    selectedVoice: string;
    onVoiceChange: (speaker: Speaker, voice: string) => void;
    disabled: boolean;
}

const VoiceSelector: React.FC<VoiceSelectorProps> = ({ speaker, speakerName, selectedVoice, onVoiceChange, disabled }) => {
    return (
        <div>
            <label htmlFor={`voice-${speaker}`} className="block text-lg font-medium text-gray-300 mb-2">
                اختر صوتًا لـ {speakerName}
            </label>
            <select
                id={`voice-${speaker}`}
                value={selectedVoice}
                onChange={(e) => onVoiceChange(speaker, e.target.value)}
                disabled={disabled}
                className="w-full bg-gray-700 border border-gray-600 text-white text-md rounded-lg focus:ring-cyan-500 focus:border-cyan-500 block p-2.5 disabled:opacity-50"
            >
                {AVAILABLE_VOICES.map((voice) => (
                    <option key={voice} value={voice}>{voice}</option>
                ))}
            </select>
        </div>
    );
};

export default App;