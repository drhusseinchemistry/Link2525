
import React, { useState, useEffect, useRef } from 'react';
import Peer from 'peerjs';
import { analyzeScreen } from './services/geminiService';

const App: React.FC = () => {
  const [myId, setMyId] = useState<string>('');
  const [remoteId, setRemoteId] = useState<string>('');
  const [status, setStatus] = useState<string>('سەرەتا هەڵبژێرە');
  const [isHost, setIsHost] = useState<boolean>(false);
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [aiResponse, setAiResponse] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const peerRef = useRef<Peer | null>(null);

  // Initialize Peer on Load
  useEffect(() => {
    // Check URL for room ID (One Click feature)
    const params = new URLSearchParams(window.location.search);
    const roomFromUrl = params.get('room');
    if (roomFromUrl) {
      setRemoteId(roomFromUrl);
    }

    const newPeer = new Peer();
    
    newPeer.on('open', (id) => {
      setMyId(id);
      if (roomFromUrl) {
        setStatus('ئامادەیە بۆ پەیوەستبوون');
      } else {
        setStatus('ئامادەیە');
      }
    });

    newPeer.on('call', async (call) => {
      // Receiving a call (Viewer Side usually, but bi-directional possible)
      const answerStream = new MediaStream(); // Answer with empty or audio
      call.answer(answerStream); 
      call.on('stream', (remoteStream) => {
        setStream(remoteStream);
        if (videoRef.current) videoRef.current.srcObject = remoteStream;
        setIsConnected(true);
        setStatus('پەیوەست کرا!');
      });
    });

    peerRef.current = newPeer;

    return () => {
      newPeer.destroy();
    };
  }, []);

  // -- HOST FUNCTIONS --

  const startHosting = async () => {
    setIsHost(true);
    setLoading(true);
    setStatus('دەستپێکردنی کامێرا/شاشە...');

    let localStream: MediaStream | null = null;
    let type = 'camera';

    // 1. Try Screen Share
    try {
      if (navigator.mediaDevices && 'getDisplayMedia' in navigator.mediaDevices) {
        localStream = await (navigator.mediaDevices as any).getDisplayMedia({ 
            video: { cursor: "always" }, audio: true 
        });
        type = 'screen';
      }
    } catch (e) {
      console.log("Screen share failed, fallback to camera");
    }

    // 2. Fallback to Camera
    if (!localStream) {
       try {
        localStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' }, audio: true });
        type = 'camera';
       } catch(err) {
         alert("ناتوانرێت کامێرا یان شاشە بکرێتەوە.");
         setLoading(false);
         setIsHost(false);
         return;
       }
    }

    setStream(localStream);
    if (videoRef.current) videoRef.current.srcObject = localStream;
    
    // Setup listener for incoming connections asking for this stream
    if (peerRef.current) {
        peerRef.current.on('connection', (conn) => {
            // Data connection opened
        });
        
        // Wait for them to call us, or we wait (Logic simplified: Viewer calls Host)
        // Actually, peerJS 'call' event handles the stream transfer.
        setStatus(type === 'screen' ? 'شاشە کراوەیە. چاوەڕێی بینەر...' : 'کامێرا کراوەیە. چاوەڕێی بینەر...');
    }
    setLoading(false);
    setIsConnected(true); // Locally connected to stream
  };

  const copyLink = () => {
    const url = `${window.location.origin}${window.location.pathname}?room=${myId}`;
    navigator.clipboard.writeText(url);
    alert("لینک کۆپی کرا! بنێرە بۆ مۆبایلەکەی تر.");
  };

  // -- VIEWER FUNCTIONS --

  const connectToHost = () => {
    if (!peerRef.current || !remoteId) return;
    setLoading(true);
    setStatus('پەیوەست دەبێت...');

    // Call the host
    const call = peerRef.current.call(remoteId, new MediaStream()); // Send empty stream to initiate
    
    call.on('stream', (remoteStream) => {
      setStream(remoteStream);
      if (videoRef.current) videoRef.current.srcObject = remoteStream;
      setIsConnected(true);
      setIsHost(false);
      setStatus('تەماشاکردن...');
      setLoading(false);
    });

    call.on('error', (err) => {
      console.error(err);
      setStatus('هەڵە ڕوویدا لە پەیوەستبوون');
      setLoading(false);
    });
  };

  // -- AI FUNCTION --

  const handleAiCheck = async () => {
    if (!canvasRef.current || !videoRef.current) return;
    setStatus('AI خەریکی سەیرکردنە...');
    const ctx = canvasRef.current.getContext('2d');
    canvasRef.current.width = videoRef.current.videoWidth;
    canvasRef.current.height = videoRef.current.videoHeight;
    ctx?.drawImage(videoRef.current, 0, 0);
    const imgData = canvasRef.current.toDataURL('image/jpeg');
    
    const text = await analyzeScreen(imgData, "بە کوردی سۆرانی، پێم بڵێ چی لەم شاشەیە هەیە و چی بکەم؟");
    setAiResponse(text || "هیچ دیار نییە");
    setStatus(isConnected ? 'پەیوەستە' : 'ئامادەیە');
  };

  // -- RENDER --

  if (isConnected) {
    return (
      <div className="h-screen w-full bg-black relative flex flex-col">
        <video 
          ref={videoRef} 
          autoPlay 
          playsInline 
          muted={isHost} // Mute only if I am the host to prevent echo
          className="w-full h-full object-contain flex-grow"
        />
        
        {/* Controls Overlay */}
        <div className="absolute bottom-0 w-full p-6 bg-gradient-to-t from-black/90 to-transparent flex flex-col gap-4">
            {aiResponse && (
                <div className="bg-slate-800/90 p-3 rounded-xl text-sm text-white border border-white/20 animate-bounce-in">
                    <span className="text-blue-400 font-bold">AI: </span> {aiResponse}
                </div>
            )}
            
            <div className="flex justify-center gap-4">
                <button onClick={handleAiCheck} className="flex-1 bg-purple-600 py-3 rounded-full font-bold shadow-lg active:scale-95 transition-transform">
                    <i className="fas fa-magic ml-2"></i> شیکردنەوەی AI
                </button>
                <button onClick={() => window.location.reload()} className="w-14 bg-red-600 rounded-full flex items-center justify-center font-bold shadow-lg">
                    <i className="fas fa-times"></i>
                </button>
            </div>
            
            {isHost && (
                <div className="text-center">
                    <button onClick={copyLink} className="text-blue-400 text-sm underline">
                        <i className="fas fa-link ml-1"></i> کۆپیکردنی لینک بۆ کەسی تر
                    </button>
                </div>
            )}
        </div>
        <canvas ref={canvasRef} className="hidden" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center p-6 text-center">
      <div className="max-w-md w-full space-y-8">
        
        <div className="space-y-2">
          <div className="w-20 h-20 bg-blue-600 rounded-2xl mx-auto flex items-center justify-center shadow-blue-500/50 shadow-lg">
             <i className="fas fa-mobile-alt text-4xl"></i>
          </div>
          <h1 className="text-3xl font-bold mt-4">LinkUp Direct</h1>
          <p className="text-slate-400 text-sm">{status}</p>
        </div>

        {remoteId ? (
          // Mode: Join via Link
          <div className="bg-slate-800 p-6 rounded-3xl border border-white/10 animate-fade-in">
             <p className="text-slate-300 mb-4">تۆ بانگێشت کراویت بۆ بینینی شاشە</p>
             <button 
                onClick={connectToHost}
                disabled={loading}
                className="w-full bg-green-600 hover:bg-green-500 py-4 rounded-xl font-bold text-lg shadow-lg transition-all active:scale-95"
             >
                {loading ? '...جێبەجێکردن' : 'پەیوەستبوون (View)'}
             </button>
          </div>
        ) : (
          // Mode: Main Menu
          <div className="grid grid-cols-1 gap-4">
            <button 
                onClick={startHosting}
                disabled={loading}
                className="group relative overflow-hidden bg-blue-600 hover:bg-blue-500 p-6 rounded-3xl transition-all active:scale-95 text-right"
            >
                <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-r from-transparent to-white/10 opacity-0 group-hover:opacity-100 transition-opacity"></div>
                <i className="fas fa-broadcast-tower text-3xl mb-2 block opacity-80"></i>
                <span className="text-xl font-bold block">شاشەکەم بڵاوبکەوە</span>
                <span className="text-xs text-blue-200 opacity-70">من دەمەوێت شاشە یان کامێرا نیشان بدەم</span>
            </button>

            <div className="bg-slate-800 p-6 rounded-3xl border border-white/5 text-right">
                <label className="text-xs text-slate-400 block mb-2 mr-1">کۆدی بەرامبەر (ئەگەر لینک نییە):</label>
                <div className="flex gap-2">
                    <input 
                        type="text" 
                        placeholder="کۆد لێرە بنووسە" 
                        value={remoteId}
                        onChange={e => setRemoteId(e.target.value)}
                        className="flex-1 bg-slate-900 border border-slate-700 rounded-xl px-4 text-center focus:border-blue-500 outline-none"
                    />
                    <button 
                        onClick={connectToHost}
                        className="w-14 bg-slate-700 rounded-xl flex items-center justify-center hover:bg-slate-600"
                    >
                        <i className="fas fa-arrow-left"></i>
                    </button>
                </div>
            </div>
          </div>
        )}

        <div className="text-xs text-slate-600 mt-10">
            تێبینی: بۆ ئەوەی کار بکات، دەبێت ئینتەرنێت هەبێت.
        </div>

      </div>
      <canvas ref={canvasRef} className="hidden" />
    </div>
  );
};

export default App;
