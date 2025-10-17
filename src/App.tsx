import "./App.css"

import { useState, useRef, useEffect } from 'react';
import { Mic, MicOff, Volume2, Download, Trash2 } from 'lucide-react';

// Fix Window interface
declare global {
  interface Window {
    webkitAudioContext: typeof AudioContext;
  }
}

export default function MicrophoneDemo() {
  const [isRecording, setIsRecording] = useState(false);
  const [hasPermission, setHasPermission] = useState<boolean | null>(null); // Fixed missing hasPermission declaration
  const [audioLevel, setAudioLevel] = useState(0);
  const [error, setError] = useState('');
  const [recordingTime, setRecordingTime] = useState(0);
  interface Recording {
    id: number;
    url: string;
    blob: Blob;
    duration: number;
    timestamp: string;
  }

  const [recordings, setRecordings] = useState<Recording[]>([]);

  // Add proper types for refs
  const streamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animationRef = useRef<number | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<number>(0);

  const requestMicrophoneAccess = async () => {
    try {
      setError('');

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        }
      });

      streamRef.current = stream;
      setHasPermission(true);
      setIsRecording(true);

      setupAudioVisualization(stream);
      startRecording(stream);

    } catch (err: any) {
      setHasPermission(false);
      if (err.name === 'NotAllowedError') {
        setError('Microphone access denied. Please allow microphone access in your browser settings.');
      } else if (err.name === 'NotFoundError') {
        setError('No microphone found on your device.');
      } else {
        setError(`Error accessing microphone: ${err.message}`);
      }
    }
  };

  const startRecording = (stream: MediaStream) => {
    chunksRef.current = [];
    setRecordingTime(0);

    // Start timer
    timerRef.current = setInterval(() => {
      setRecordingTime(prev => prev + 1);
    }, 1000);

    // Create MediaRecorder
    const mimeType = MediaRecorder.isTypeSupported('audio/webm')
      ? 'audio/webm'
      : 'audio/mp4';

    mediaRecorderRef.current = new MediaRecorder(stream, { mimeType });

    mediaRecorderRef.current.ondataavailable = (e) => {
      if (e.data.size > 0) {
        chunksRef.current.push(e.data);
      }
    };

    mediaRecorderRef.current.onstop = async () => {
      const blob = new Blob(chunksRef.current, { type: mimeType });
      const audioUrl = URL.createObjectURL(blob);

      setRecordings(prev => [...prev, {
        id: Date.now(),
        url: audioUrl,
        blob: blob,
        duration: recordingTime,
        timestamp: new Date().toLocaleTimeString()
      }]);
    };

    mediaRecorderRef.current.start(100);
  };

  // Add type for stream parameter
  const setupAudioVisualization = (stream: MediaStream) => {
    audioContextRef.current = new (window.AudioContext || window.webkitAudioContext)();
    analyserRef.current = audioContextRef.current.createAnalyser();

    const source = audioContextRef.current.createMediaStreamSource(stream);
    source.connect(analyserRef.current);

    if (!analyserRef.current) return;
    analyserRef.current.fftSize = 256;
    const bufferLength = analyserRef.current.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);

    const updateLevel = () => {
      if (!analyserRef.current) return;

      analyserRef.current.getByteFrequencyData(dataArray);
      const average = dataArray.reduce((a, b) => a + b) / bufferLength;
      setAudioLevel(average);

      animationRef.current = requestAnimationFrame(updateLevel);
    };

    updateLevel();
  };

  const stopMicrophone = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }

    if (timerRef.current) {
      clearInterval(timerRef.current);
    }

    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }

    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }

    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current);
    }

    setIsRecording(false);
    setAudioLevel(0);
  };

  // Add proper type for recording parameter
  const downloadRecording = (recording: Recording) => {
    const a = document.createElement('a');
    a.href = recording.url;
    a.download = `recording-${recording.id}.webm`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const deleteRecording = (id: number) => {
    setRecordings(prev => {
      const recording = prev.find(r => r.id === id);
      if (recording) {
        URL.revokeObjectURL(recording.url);
      }
      return prev.filter(r => r.id !== id);
    });
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  useEffect(() => {
    return () => {
      stopMicrophone();
      recordings.forEach(rec => URL.revokeObjectURL(rec.url));
    };
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 to-blue-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl p-8 max-w-2xl w-full">
        <h1 className="text-3xl font-bold text-gray-800 mb-2 text-center">
          Audio Recorder
        </h1>
        <p className="text-gray-600 text-center mb-8">
          Record and save your audio
        </p>

        <div className="flex flex-col items-center space-y-6">
          {hasPermission === false && (
            <p className="text-red-500 mb-4">Please grant microphone permissions to record audio.</p>
          )}
          <button
            onClick={isRecording ? stopMicrophone : requestMicrophoneAccess}
            className={`w-32 h-32 rounded-full flex items-center justify-center transition-all transform hover:scale-105 ${
              isRecording
                ? 'bg-red-500 hover:bg-red-600 shadow-lg shadow-red-200'
                : 'bg-blue-500 hover:bg-blue-600 shadow-lg shadow-blue-200'
            }`}
          >
            {isRecording ? (
              <MicOff className="w-16 h-16 text-white" />
            ) : (
              <Mic className="w-16 h-16 text-white" />
            )}
          </button>

          <div className="text-center">
            <p className="text-lg font-semibold text-gray-700">
              {isRecording ? 'Recording...' : 'Click to Record'}
            </p>
            {isRecording && (
              <p className="text-2xl font-mono text-red-600 mt-2">
                {formatTime(recordingTime)}
              </p>
            )}
          </div>

          {isRecording && (
            <div className="w-full space-y-3">
              <div className="flex items-center space-x-2">
                <Volume2 className="w-5 h-5 text-gray-600" />
                <div className="flex-1 bg-gray-200 rounded-full h-4 overflow-hidden">
                  <div
                    className="bg-gradient-to-r from-blue-500 to-purple-500 h-full transition-all duration-100"
                    style={{ width: `${Math.min((audioLevel / 128) * 100, 100)}%` }}
                  />
                </div>
              </div>
            </div>
          )}

          {error && (
            <div className="w-full p-4 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-sm text-red-700">{error}</p>
            </div>
          )}

          {recordings.length > 0 && (
            <div className="w-full space-y-3">
              <h2 className="text-xl font-semibold text-gray-800">Recordings</h2>
              {recordings.map((recording) => (
                <div
                  key={recording.id}
                  className="bg-gray-50 rounded-lg p-4 space-y-3"
                >
                  <div className="flex items-center justify-between">
                    <div className="text-sm text-gray-600">
                      <p className="font-medium">Recording {recording.timestamp}</p>
                      <p className="text-xs">Duration: {formatTime(recording.duration)}</p>
                    </div>
                    <div className="flex space-x-2">
                      <button
                        onClick={() => downloadRecording(recording)}
                        className="p-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg transition-colors"
                        title="Download"
                      >
                        <Download className="w-5 h-5" />
                      </button>
                      <button
                        onClick={() => deleteRecording(recording.id)}
                        className="p-2 bg-red-500 hover:bg-red-600 text-white rounded-lg transition-colors"
                        title="Delete"
                      >
                        <Trash2 className="w-5 h-5" />
                      </button>
                    </div>
                  </div>
                  <audio
                    src={recording.url}
                    controls
                    className="w-full"
                  />
                </div>
              ))}
            </div>
          )}

          <div className="w-full p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <h3 className="font-semibold text-blue-900 mb-2 text-sm">Note:</h3>
            <ul className="text-xs text-blue-800 space-y-1">
              <li>• Click the microphone to start recording</li>
              <li>• Click again to stop and save the recording</li>
              <li>• Recordings are saved as WebM/MP4 format</li>
              <li>• Download or play back your recordings below</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}