import React, { useState, useEffect, useRef } from 'react';
import {
  Play,
  Pause,
  SkipBack,
  SkipForward,
  RotateCcw,
  Volume2,
  VolumeX,
  Download,
  Gauge,
  X,
  FileAudio,
} from 'lucide-react';
import { AudioSegment } from '../types';
import { formatDuration, triggerDownload, sanitizeFilename } from '../audio/wavHelper';
import { getSegmentAudio } from '../storage/db';

interface AudioPlayerProps {
  segment: AudioSegment | null;
  projectTitle: string;
  onNextSegment?: () => void;
  onPrevSegment?: () => void;
  hasNext?: boolean;
  hasPrev?: boolean;
  onClose?: () => void;
}

const PLAYBACK_RATES = [0.8, 1.0, 1.25, 1.5, 2.0];

export const AudioPlayer: React.FC<AudioPlayerProps> = ({
  segment,
  projectTitle,
  onNextSegment,
  onPrevSegment,
  hasNext,
  hasPrev,
  onClose,
}) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [playbackRate, setPlaybackRate] = useState(1.0);
  const [volume, setVolume] = useState(1.0);
  const [isMuted, setIsMuted] = useState(false);
  const [resolvedAudioUrl, setResolvedAudioUrl] = useState<string | null>(null);

  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Load and resolve audio URL from segment or IndexedDB
  useEffect(() => {
    let active = true;
    let createdUrl: string | null = null;

    if (!segment) {
      setResolvedAudioUrl(null);
      setIsPlaying(false);
      return;
    }

    const loadAudio = async () => {
      if (segment.audioUrl) {
        setResolvedAudioUrl(segment.audioUrl);
      } else if (segment.audioBlob) {
        createdUrl = URL.createObjectURL(segment.audioBlob);
        if (active) setResolvedAudioUrl(createdUrl);
      } else {
        const blob = await getSegmentAudio(segment.id);
        if (blob && active) {
          createdUrl = URL.createObjectURL(blob);
          setResolvedAudioUrl(createdUrl);
        }
      }
    };

    loadAudio();

    return () => {
      active = false;
      if (createdUrl) URL.revokeObjectURL(createdUrl);
    };
  }, [segment]);

  // Autoplay when resolved URL updates
  useEffect(() => {
    if (resolvedAudioUrl && audioRef.current) {
      audioRef.current.playbackRate = playbackRate;
      audioRef.current.play().then(() => {
        setIsPlaying(true);
      }).catch(console.warn);
    }
  }, [resolvedAudioUrl]);

  const togglePlay = () => {
    if (!audioRef.current) return;
    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      audioRef.current.play().then(() => {
        setIsPlaying(true);
      }).catch(console.warn);
    }
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const time = Number(e.target.value);
    setCurrentTime(time);
    if (audioRef.current) {
      audioRef.current.currentTime = time;
    }
  };

  const handleSkip = (seconds: number) => {
    if (!audioRef.current) return;
    const newTime = Math.max(0, Math.min(duration, audioRef.current.currentTime + seconds));
    audioRef.current.currentTime = newTime;
    setCurrentTime(newTime);
  };

  const cyclePlaybackRate = () => {
    const currentIndex = PLAYBACK_RATES.indexOf(playbackRate);
    const nextRate = PLAYBACK_RATES[(currentIndex + 1) % PLAYBACK_RATES.length];
    setPlaybackRate(nextRate);
    if (audioRef.current) {
      audioRef.current.playbackRate = nextRate;
    }
  };

  const toggleMute = () => {
    if (!audioRef.current) return;
    audioRef.current.muted = !isMuted;
    setIsMuted(!isMuted);
  };

  const handleDownload = async () => {
    if (!segment) return;
    let blob = segment.audioBlob;
    if (!blob) {
      blob = (await getSegmentAudio(segment.id)) || undefined;
    }
    if (blob) {
      const filename = `${sanitizeFilename(projectTitle)}_${sanitizeFilename(segment.title)}.wav`;
      triggerDownload(blob, filename);
    }
  };

  if (!segment || !resolvedAudioUrl) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 bg-slate-900/95 backdrop-blur-lg border-t border-slate-800 shadow-2xl px-4 py-3 sm:px-6">
      <audio
        ref={audioRef}
        src={resolvedAudioUrl}
        onTimeUpdate={() => {
          if (audioRef.current) setCurrentTime(audioRef.current.currentTime);
        }}
        onLoadedMetadata={() => {
          if (audioRef.current) {
            setDuration(audioRef.current.duration || segment.audioDurationSeconds || 0);
          }
        }}
        onEnded={() => {
          setIsPlaying(false);
          if (hasNext && onNextSegment) onNextSegment();
        }}
      />

      <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-3">
        {/* Left: Info */}
        <div className="flex items-center space-x-3 w-full md:w-1/4 min-w-0">
          <div className="w-10 h-10 rounded-xl bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400 shrink-0">
            <FileAudio className="w-5 h-5" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-white truncate">{segment.title}</p>
            <p className="text-xs text-slate-400 truncate">{projectTitle}</p>
          </div>
        </div>

        {/* Center: Controls & Scrubber */}
        <div className="flex flex-col items-center w-full md:w-2/4 space-y-1.5">
          <div className="flex items-center space-x-3 sm:space-x-4">
            <button
              onClick={() => handleSkip(-10)}
              className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
              title="Reculer de 10s"
            >
              <RotateCcw className="w-4 h-4" />
            </button>

            <button
              onClick={onPrevSegment}
              disabled={!hasPrev}
              className="p-1.5 text-slate-400 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed rounded-lg hover:bg-slate-800 transition-colors"
              title="Segment précédent"
            >
              <SkipBack className="w-4 h-4" />
            </button>

            <button
              onClick={togglePlay}
              className="w-10 h-10 rounded-full bg-indigo-600 hover:bg-indigo-500 text-white flex items-center justify-center shadow-lg shadow-indigo-600/30 transition-transform active:scale-95 cursor-pointer"
            >
              {isPlaying ? (
                <Pause className="w-5 h-5 fill-current" />
              ) : (
                <Play className="w-5 h-5 fill-current ml-0.5" />
              )}
            </button>

            <button
              onClick={onNextSegment}
              disabled={!hasNext}
              className="p-1.5 text-slate-400 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed rounded-lg hover:bg-slate-800 transition-colors"
              title="Segment suivant"
            >
              <SkipForward className="w-4 h-4" />
            </button>

            <button
              onClick={cyclePlaybackRate}
              className="px-2 py-1 text-xs font-mono font-medium rounded-lg bg-slate-800 hover:bg-slate-700 text-indigo-300 border border-slate-700 transition-colors"
              title="Vitesse de lecture"
            >
              {playbackRate}x
            </button>
          </div>

          {/* Scrubber timeline */}
          <div className="w-full flex items-center space-x-2 text-xs font-mono text-slate-400">
            <span className="w-10 text-right">{formatDuration(currentTime)}</span>
            <input
              type="range"
              min={0}
              max={duration || 1}
              step={0.1}
              value={currentTime}
              onChange={handleSeek}
              className="flex-1 accent-indigo-500 h-1.5 bg-slate-800 rounded-lg cursor-pointer"
            />
            <span className="w-10">{formatDuration(duration)}</span>
          </div>
        </div>

        {/* Right: Volume & Actions */}
        <div className="flex items-center justify-end space-x-3 w-full md:w-1/4">
          <div className="hidden sm:flex items-center space-x-2">
            <button
              onClick={toggleMute}
              className="text-slate-400 hover:text-white transition-colors"
            >
              {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
            </button>
            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={isMuted ? 0 : volume}
              onChange={(e) => {
                const val = Number(e.target.value);
                setVolume(val);
                setIsMuted(val === 0);
                if (audioRef.current) {
                  audioRef.current.volume = val;
                  audioRef.current.muted = false;
                }
              }}
              className="w-16 accent-indigo-500 h-1.5 bg-slate-800 rounded-lg cursor-pointer"
            />
          </div>

          <button
            onClick={handleDownload}
            className="p-2 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
            title="Télécharger ce segment audio"
          >
            <Download className="w-4 h-4" />
          </button>

          {onClose && (
            <button
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
              title="Fermer le lecteur"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
