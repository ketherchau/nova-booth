"use client";

import React, { useState, useRef, useCallback, useEffect } from 'react';
import { Camera, RefreshCw, Download, Trash2, CameraIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import confetti from 'canvas-confetti';

interface Photo {
  id: string;
  url: string;
  timestamp: number;
  rotation: number;
}

export default function PhotoBooth() {
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [isFlashing, setIsFlashing] = useState(false);
  const [isCountingDown, setIsCountingDown] = useState(false);
  const [countdown, setCountdown] = useState(3);
  const [error, setError] = useState<string | null>(null);
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const startCamera = useCallback(async () => {
    try {
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
      
      const newStream = await navigator.mediaDevices.getUserMedia({
        video: { 
          facingMode: 'user',
          width: { ideal: 1080 },
          height: { ideal: 1080 }
        },
        audio: false
      });
      
      setStream(newStream);
      if (videoRef.current) {
        videoRef.current.srcObject = newStream;
      }
      setError(null);
    } catch (err) {
      console.error("Camera error:", err);
      setError("Camera access denied. Please enable permissions.");
    }
  }, [stream]);

  useEffect(() => {
    startCamera();
    return () => {
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
    };
  }, []);

  const capturePhoto = () => {
    if (!videoRef.current || !canvasRef.current) return;

    setIsFlashing(true);
    setTimeout(() => setIsFlashing(false), 300);

    const canvas = canvasRef.current;
    const video = videoRef.current;
    const context = canvas.getContext('2d');

    if (context) {
      // Create a square capture
      const size = Math.min(video.videoWidth, video.videoHeight);
      const startX = (video.videoWidth - size) / 2;
      const startY = (video.videoHeight - size) / 2;

      canvas.width = 800;
      canvas.height = 800;
      
      // Mirror if using front camera
      context.translate(800, 0);
      context.scale(-1, 1);
      
      context.drawImage(video, startX, startY, size, size, 0, 0, 800, 800);
      
      const photoUrl = canvas.toDataURL('image/jpeg', 0.9);
      const newPhoto: Photo = {
        id: Math.random().toString(36).substr(2, 9),
        url: photoUrl,
        timestamp: Date.now(),
        rotation: Math.floor(Math.random() * 6) - 3 // Random slight rotation
      };

      setPhotos(prev => [newPhoto, ...prev]);
      confetti({
        particleCount: 100,
        spread: 70,
        origin: { y: 0.6 }
      });
    }
  };

  const startCountdown = () => {
    if (isCountingDown) return;
    setIsCountingDown(true);
    setCountdown(3);

    const timer = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) {
          clearInterval(timer);
          setIsCountingDown(false);
          capturePhoto();
          return 3;
        }
        return prev - 1;
      });
    }, 1000);
  };

  const deletePhoto = (id: string) => {
    setPhotos(prev => prev.filter(p => p.id !== id));
  };

  const downloadPhoto = (url: string) => {
    const link = document.createElement('a');
    link.href = url;
    link.download = `nova-booth-${Date.now()}.jpg`;
    link.click();
  };

  return (
    <div className="max-w-6xl mx-auto px-4 py-8 md:py-12">
      <header className="text-center mb-10">
        <h1 className="text-4xl md:text-6xl font-black tracking-tighter text-blue-600 mb-2">
          NOVA BOOTH
        </h1>
        <p className="text-gray-500 font-medium tracking-wide uppercase text-sm">
          Capture your hero moment
        </p>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Viewfinder Section */}
        <div className="lg:col-span-7 space-y-6">
          <div className="relative aspect-square bg-black rounded-3xl overflow-hidden shadow-2xl border-8 border-white group">
            {error ? (
              <div className="absolute inset-0 flex flex-col items-center justify-center text-white p-6 text-center">
                <RefreshCw className="h-12 w-12 mb-4 text-blue-500 animate-pulse" />
                <p className="font-bold">{error}</p>
                <Button onClick={startCamera} className="mt-4 bg-blue-600 hover:bg-blue-700">
                  Try Again
                </Button>
              </div>
            ) : (
              <video 
                ref={videoRef} 
                autoPlay 
                playsInline 
                muted
                className="absolute inset-0 w-full h-full object-cover scale-x-[-1]"
              />
            )}
            
            {/* Flash Effect */}
            {isFlashing && <div className="absolute inset-0 bg-white camera-flash z-30" />}
            
            {/* Countdown Overlay */}
            {isCountingDown && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/20 backdrop-blur-sm z-20">
                <span className="text-white text-9xl font-black animate-ping">
                  {countdown}
                </span>
              </div>
            )}

            {/* Viewfinder Decorations */}
            <div className="absolute top-6 left-6 border-t-2 border-l-2 border-white/50 w-8 h-8 rounded-tl-lg" />
            <div className="absolute top-6 right-6 border-t-2 border-r-2 border-white/50 w-8 h-8 rounded-tr-lg" />
            <div className="absolute bottom-6 left-6 border-b-2 border-l-2 border-white/50 w-8 h-8 rounded-bl-lg" />
            <div className="absolute bottom-6 right-6 border-b-2 border-r-2 border-white/50 w-8 h-8 rounded-br-lg" />
          </div>

          <div className="flex justify-center pt-4">
            <button
              onClick={startCountdown}
              disabled={isCountingDown || !!error}
              className={cn(
                "group relative flex items-center justify-center h-24 w-24 md:h-32 md:w-32 rounded-full",
                "bg-blue-600 text-white shadow-xl transition-all active:scale-95",
                "disabled:opacity-50 disabled:cursor-not-allowed"
              )}
            >
              <div className="absolute inset-0 rounded-full border-4 border-white/20 animate-ping group-hover:animate-none" />
              <CameraIcon className="h-10 w-10 md:h-12 md:w-12" />
            </button>
          </div>
        </div>

        {/* Gallery Section */}
        <div className="lg:col-span-5 space-y-6">
          <div className="bg-white/50 backdrop-blur-sm p-6 rounded-3xl min-h-[400px] border-2 border-dashed border-gray-200">
            <h2 className="text-xl font-bold mb-6 flex items-center gap-2">
              <Camera className="h-5 w-5 text-blue-600" />
              Your Film Strip
            </h2>

            {photos.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 text-gray-400">
                <p className="text-sm font-medium">No shots yet, Jack in!</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-6">
                {photos.map((photo) => (
                  <div 
                    key={photo.id} 
                    className="polaroid-frame group"
                    style={{ '--rotation': `${photo.rotation}deg` } as any}
                  >
                    <div className="aspect-square bg-gray-100 overflow-hidden mb-2">
                      <img src={photo.url} alt="Captured" className="w-full h-full object-cover" />
                    </div>
                    <div className="flex justify-between items-center px-1">
                      <span className="text-[10px] font-bold text-gray-300">
                        {new Date(photo.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                      <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button onClick={() => downloadPhoto(photo.url)} className="text-blue-500 hover:text-blue-700">
                          <Download className="h-4 w-4" />
                        </button>
                        <button onClick={() => deletePhoto(photo.id)} className="text-red-500 hover:text-red-700">
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      <canvas ref={canvasRef} className="hidden" />
    </div>
  );
}

function Button({ className, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      className={cn(
        "inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 h-10 px-4 py-2",
        className
      )}
      {...props}
    />
  );
}
