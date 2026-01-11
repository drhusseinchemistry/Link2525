
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
  
  // NEW: Store the stream in state to ensure it renders correctly
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
        setStatus("داواکاری بۆ کردنەوەی کامێرا");
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
        console.log("Stream received with tracks:", remoteStream.getTracks());
        // 1. Save stream to state first
        setActiveStream(remoteStream);
        // 2. Then show the UI
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

  // NEW: Watch for connection and stream, then attach to video element
  useEffect(() => {
    if (isConnected && activeStream && videoRef.current) {
      console.log("Attaching stream to video element");
      videoRef.current.srcObject = activeStream;
      videoRef.current.play().catch(e => console.error("Autoplay error:", e));
    }
  }, [isConnected, activeStream]);

  const acceptAndStream = async () => {
    if (!peerRef.current || !targetId) return;
    
    setLoading(true);
    setStatus("کردنەوەی کامێرا...");

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { facingMode: 'environment' }, 
        audio: true 
      });

      // Save local stream
      setActiveStream(stream);

      // Call the Viewer
      const call = peerRef.current.call(targetId, stream);
      
      call.on('close', () => {
        setIsConnected(false);
        setStatus("پەیوەندی پچڕا");
        setActiveStream(null);
      });

      setIsConnected(true);
      setStatus("کامێرا نێردرا!");
    } catch (err) {
      console.error(err);
      alert("تکایە ڕێگە بە کامێرا بدە.");
      setLoading(false);
    }
  };

  const copyLink = () => {
    const url = `${window.location.origin}${window.location.pathname}?host=${myId}`;
    if (navigator.share) {
        navigator.share({
            title: 'LinkUp Direct',
            text: 'تکایە ئەم لینکە بکەرەوە بۆ ئەوەی کامێراکەت ببینم',
            url: url
        }).catch(console.error);
    } else {
        navigator.clipboard.writeText(url);
        alert("لینک کۆپی کرا! بنێرە بۆ ئەو کەسەی دەتەوێت کامێرای ببینیت.");
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

  // --- RENDER: CONNECTED MODE ---
  if (isConnected) {
    return (
      <div className="h-[100dvh] w-full bg-black relative flex flex-col overflow-hidden">
        <video 
          ref={videoRef} 
          autoPlay 
          playsInline 
          muted={role === 'STREAMER'} // Mute only for the one holding the camera
          className={`w-full h-full object-contain ${role === 'STREAMER' ? 'opacity-50 scale-x-[-1]' : ''}`}
        />
        
        {role === 'STREAMER' && (
             <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <p className="bg-red-600/80 text-white px-6 py-2 rounded-full font-bold animate-pulse backdrop-blur-md">
                    <i className="fas fa-circle text-[10px] ml-2"></i> پەخشی ڕاستەوخۆ
                </p>
             </div>
        )}

        <div className="absolute bottom-0 inset-x-0 p-6 bg-gradient-to-t from-black/90 via-black/50 to-transparent flex flex-col gap-3">
            {aiResponse && (
                <div className="bg-slate-800/95 p-4 rounded-2xl text-sm text-white border border-white/10 shadow-xl max-h-40 overflow-y-auto" dir="rtl">
                    <span className="text-blue-400 font-bold ml-2">وەڵامی AI:</span> {aiResponse}
                </div>
            )}
            
            {role === 'VIEWER' && (
                <div className="flex gap-3">
                    <button onClick={handleAiCheck} className="flex-1 bg-indigo-600 active:bg-indigo-700 text-white py-4 rounded-2xl font-bold shadow-lg transition-transform active:scale-95 flex items-center justify-center gap-2">
                        <i className="fas fa-wand-magic-sparkles"></i>
                        <span>پرسیار لە AI</span>
                    </button>
                </div>
            )}

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
        
        <div className="flex flex-col items-center gap-2">
           <h1 className="text-3xl font-bold text-white tracking-tight">LinkUp Direct</h1>
           <p className="text-slate-500 text-xs font-mono">{myId ? 'Connected' : 'Connecting...'}</p>
        </div>

        {role === 'VIEWER' ? (
            <div className="bg-slate-900 border border-white/10 rounded-3xl p-6 space-y-6 shadow-2xl">
                <div className="w-20 h-20 bg-blue-600/20 text-blue-500 rounded-full flex items-center justify-center mx-auto ring-4 ring-blue-500/10">
                    <i className="fas fa-eye text-3xl"></i>
                </div>
                <div className="space-y-2">
                    <h2 className="text-xl font-bold text-white">داواکردنی کامێرا</h2>
                    <p className="text-slate-400 text-sm">ئەم لینکە بنێرە بۆ ئەو کەسەی دەتەوێت کامێراکەی ببینیت.</p>
                </div>
                
                <button 
                    onClick={copyLink}
                    className="w-full bg-blue-600 hover:bg-blue-500 text-white py-4 rounded-2xl font-bold text-lg shadow-lg shadow-blue-900/20 transition-all active:scale-95 flex items-center justify-center gap-2"
                >
                    <i className="fas fa-share-nodes"></i>
                    ناردنی لینک
                </button>

                <div className="pt-4 border-t border-white/5">
                    <p className="text-xs text-slate-500 animate-pulse">چاوەڕێی هاتنی پەخش...</p>
                </div>
            </div>
        ) : (
            <div className="bg-slate-900 border border-red-500/20 rounded-3xl p-6 space-y-6 shadow-2xl relative overflow-hidden">
                <div className="absolute top-0 left-0 w-full h-1 bg-red-500"></div>
                
                <div className="w-20 h-20 bg-red-500/10 text-red-500 rounded-full flex items-center justify-center mx-auto animate-bounce">
                    <i className="fas fa-video text-3xl"></i>
                </div>

                <div className="space-y-2">
                    <h2 className="text-xl font-bold text-white">داواکاری بینین</h2>
                    <p className="text-slate-300 text-sm leading-relaxed">
                        بەرامبەر دەیەوێت کامێراکەت ببینێت. ڕازی دەبیت؟
                    </p>
                </div>

                <button 
                    onClick={acceptAndStream}
                    disabled={loading}
                    className="w-full bg-green-600 hover:bg-green-500 text-white py-4 rounded-2xl font-bold text-lg shadow-lg shadow-green-900/20 transition-all active:scale-95 flex items-center justify-center gap-2"
                >
                    {loading ? (
                        <span className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></span>
                    ) : (
                        <>
                            <i className="fas fa-check"></i>
                            قبوڵکردن و کردنەوە
                        </>
                    )}
                </button>
            </div>
        )}

      </div>
      <canvas ref={canvasRef} className="hidden" />
    </div>
  );
};

export default App;
