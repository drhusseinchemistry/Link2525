
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { AppMode, RemoteEvent } from './types';
import { analyzeScreen } from './services/geminiService';

const App: React.FC = () => {
  const [mode, setMode] = useState<AppMode>(AppMode.IDLE);
  const [roomId, setRoomId] = useState<string>('');
  const [status, setStatus] = useState<string>('ئامادەیە بۆ پەیوەندی');
  const [isConnected, setIsConnected] = useState(false);
  const [chatMessages, setChatMessages] = useState<{sender: string, text: string}[]>([]);
  const [inputMessage, setInputMessage] = useState('');
  const [clicks, setClicks] = useState<{x: number, y: number, id: number}[]>([]);
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [isCapturing, setIsCapturing] = useState(false);

  // Generate a random Room ID
  const generateRoomId = () => {
    const id = Math.random().toString(36).substring(2, 8).toUpperCase();
    setRoomId(id);
    setMode(AppMode.HOST);
    setStatus(`چاوەڕێی پەیوەندی: ${id}`);
  };

  const joinRoom = (e: React.FormEvent) => {
    e.preventDefault();
    if (roomId.length < 4) return;
    setMode(AppMode.CONTROLLER);
    setStatus(`پەیوەست دەبێت بە ${roomId}...`);
    setTimeout(() => {
      setIsConnected(true);
      setStatus('کۆنترۆڵکەر پەیوەست بوو');
      setChatMessages(prev => [...prev, { sender: 'System', text: 'پەیوەست بوویت بە سەرکەوتوویی. ئێستا دەتوانیت شاشەکە ببێنیت و تەحەکم بکەیت.' }]);
    }, 1500);
  };

  const startScreenShare = async () => {
    // Check if getDisplayMedia is supported in the current environment
    if (!navigator.mediaDevices || !('getDisplayMedia' in navigator.mediaDevices)) {
      const message = "ببورە، وەرگرتنی شاشە لەم وێبگەڕەدا پشتگیری نەکراوە. تکایە لەسەر کۆمپیوتەر و بە بەکارهێنانی کرۆم یان فایەرفۆکس تاقی بکەرەوە. مۆبایلەکان ڕێگە نادەن بەم شێوەیە شاشەکەیان بڵاو بکەنەوە.";
      alert(message);
      setChatMessages(prev => [...prev, { sender: 'System', text: message }]);
      return;
    }

    try {
      // In some browsers, we need to cast or handle types carefully
      const mediaDevices = navigator.mediaDevices as any;
      const stream = await mediaDevices.getDisplayMedia({ 
        video: { cursor: "always" }, 
        audio: true 
      });
      
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
      setIsCapturing(true);
      setIsConnected(true);
      setStatus('شاشە بڵاو دەکرێتەوە...');
    } catch (err: any) {
      console.error("Error sharing screen:", err);
      if (err.name === 'NotAllowedError') {
        alert("ڕێگەی پێ نەدرا لەلایەن بەکارهێنەرەوە.");
      } else {
        alert("هەڵەیەک ڕوویدا لە کاتی وەرگرتنی شاشە: " + err.message);
      }
    }
  };

  const stopSession = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
    }
    setMode(AppMode.IDLE);
    setIsConnected(false);
    setIsCapturing(false);
    setRoomId('');
    setStatus('ئامادەیە بۆ پەیوەندی');
    setClicks([]);
  };

  const handleRemoteClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (mode !== AppMode.CONTROLLER || !isConnected) return;
    
    const rect = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    
    const newClick = { x, y, id: Date.now() };
    setClicks(prev => [...prev, newClick]);
    
    setChatMessages(prev => [...prev, { 
      sender: 'Control', 
      text: `کلیک کرا لە پۆزیشنی: X:${Math.round(x)}% Y:${Math.round(y)}%` 
    }]);

    setTimeout(() => {
      setClicks(prev => prev.filter(c => c.id !== newClick.id));
    }, 600);
  };

  const sendChatMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputMessage.trim()) return;
    setChatMessages(prev => [...prev, { sender: 'You', text: inputMessage }]);
    setInputMessage('');
  };

  const handleAiAnalysis = async () => {
    if (!canvasRef.current || !videoRef.current || !isCapturing) {
      alert("تکایە سەرەتا شاشەکە بڵاو بکەرەوە بۆ ئەوەی AI بتوانێت شیکردنەوەی بۆ بکات.");
      return;
    }
    
    const context = canvasRef.current.getContext('2d');
    if (context) {
      try {
        context.drawImage(videoRef.current, 0, 0, canvasRef.current.width, canvasRef.current.height);
        const dataUrl = canvasRef.current.toDataURL('image/jpeg');
        
        setStatus('AI خەریکی شیکردنەوەیە...');
        const aiResponse = await analyzeScreen(dataUrl, "ئەمە شاشەی موبایلێکی دیکەیە. پێم بڵێ چی لێیە و چۆن یارمەتی بەکارهێنەر بدەم بۆ بەکارهێنانی؟");
        setChatMessages(prev => [...prev, { sender: 'Gemini AI', text: aiResponse || 'ببورە نەمتوانی شیکردنەوە بکەم.' }]);
      } catch (e) {
        console.error("Analysis failed", e);
      } finally {
        setStatus(mode === AppMode.CONTROLLER ? 'کۆنترۆڵکەر پەیوەستە' : 'شاشە بڵاو دەکرێتەوە');
      }
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 bg-[#0a0f1e] overflow-hidden text-slate-200">
      {/* Header */}
      <header className="fixed top-0 w-full p-4 flex justify-between items-center bg-slate-900/80 backdrop-blur-xl z-50 border-b border-white/5">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-gradient-to-br from-blue-600 to-indigo-700 rounded-xl flex items-center justify-center shadow-lg shadow-blue-500/20">
            <i className="fas fa-mobile-screen-button text-white text-xl"></i>
          </div>
          <div>
            <h1 className="text-xl font-bold bg-gradient-to-r from-white to-slate-400 bg-clip-text text-transparent">
              LinkUp Mirror
            </h1>
            <p className="text-[10px] text-blue-400 font-bold uppercase tracking-widest leading-none">Remote Control Pro</p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <div className="hidden sm:flex items-center gap-2 px-3 py-1 bg-slate-800 rounded-full border border-white/5">
            <span className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`}></span>
            <span className="text-xs text-slate-400 font-medium">{status}</span>
          </div>
          {mode !== AppMode.IDLE && (
             <button onClick={stopSession} className="text-red-400 hover:text-red-300 transition-colors text-sm font-bold">
               داخستن
             </button>
          )}
        </div>
      </header>

      {/* Main Content Area */}
      <main className="w-full max-w-7xl mt-20 flex-grow flex flex-col lg:flex-row gap-6 h-[calc(100vh-120px)] pb-4">
        
        {/* Mirror Area */}
        <div className="flex-grow flex flex-col gap-4">
          <div className="flex-grow bg-slate-900/50 rounded-[2.5rem] border border-white/5 relative overflow-hidden shadow-2xl flex items-center justify-center group p-4">
            {mode === AppMode.IDLE ? (
              <div className="text-center p-8 max-w-lg">
                <div className="mb-8 relative inline-block">
                  <div className="absolute inset-0 bg-blue-500 blur-3xl opacity-20 animate-pulse"></div>
                  <i className="fas fa-layer-group text-7xl text-blue-500 relative"></i>
                </div>
                <h2 className="text-3xl font-bold mb-4">پەیوەندی موبایل بۆ موبایل</h2>
                <p className="text-slate-400 mb-8">شاشەی موبایلەکەت بڵاو بکەرەوە یان کۆنترۆڵی موبایلێکی تر بکە لە هەر شوێنێکی جیهان بیت.</p>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <button 
                    onClick={generateRoomId}
                    className="flex flex-col items-center p-6 bg-slate-800 hover:bg-slate-700 rounded-[2rem] border border-white/5 transition-all group"
                  >
                    <div className="w-14 h-14 bg-blue-600/10 text-blue-500 rounded-2xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                      <i className="fas fa-share-nodes text-2xl"></i>
                    </div>
                    <span className="font-bold text-lg">بڵاوکردنەوە (Host)</span>
                    <span className="text-xs text-slate-500 mt-1">کۆدێک بدە بە بەرامبەر</span>
                  </button>
                  
                  <div className="p-6 bg-slate-800 rounded-[2rem] border border-white/5 flex flex-col items-center">
                    <div className="w-14 h-14 bg-indigo-600/10 text-indigo-500 rounded-2xl flex items-center justify-center mb-4">
                      <i className="fas fa-gamepad text-2xl"></i>
                    </div>
                    <form onSubmit={joinRoom} className="w-full space-y-3">
                      <input 
                        type="text" 
                        placeholder="کۆدی ژوور"
                        value={roomId}
                        onChange={(e) => setRoomId(e.target.value.toUpperCase())}
                        className="w-full bg-slate-950 border border-white/10 rounded-xl p-3 text-center text-white placeholder-slate-600 focus:outline-none focus:border-indigo-500 transition-all font-mono"
                      />
                      <button className="w-full py-3 bg-indigo-600 text-white font-bold rounded-xl hover:bg-indigo-500 shadow-lg shadow-indigo-600/20 transition-all active:scale-95">
                        کۆنترۆڵکردن
                      </button>
                    </form>
                  </div>
                </div>
                <p className="mt-8 text-[10px] text-slate-500 italic">بۆ ئەوەی کار بکات پێویستە لەسەر کۆمپیوتەر بیت یان وێبگەڕەکەت پشتگیری Screen Capture بکات.</p>
              </div>
            ) : (
              <div className="w-full h-full flex flex-col items-center justify-center">
                {/* Simulated Mobile Frame */}
                <div className="relative aspect-[9/19] h-full max-h-[85vh] bg-black rounded-[3rem] border-[8px] border-slate-800 shadow-[0_0_50px_rgba(0,0,0,0.5)] overflow-hidden">
                  {/* Notch */}
                  <div className="absolute top-0 left-1/2 -translate-x-1/2 w-32 h-6 bg-slate-800 rounded-b-2xl z-30"></div>
                  
                  <div 
                    className="w-full h-full relative cursor-crosshair overflow-hidden"
                    onClick={handleRemoteClick}
                  >
                    {isCapturing ? (
                      <video 
                        ref={videoRef} 
                        autoPlay 
                        playsInline 
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex flex-col items-center justify-center bg-slate-900 p-8 text-center">
                        {mode === AppMode.HOST ? (
                          <div className="space-y-6">
                            <div className="w-20 h-20 bg-blue-600/20 rounded-full flex items-center justify-center mx-auto">
                              <i className="fas fa-desktop text-3xl text-blue-500 animate-pulse"></i>
                            </div>
                            <h3 className="text-xl font-bold">ئامادەیە بۆ بڵاوکردنەوە</h3>
                            <p className="text-sm text-slate-400">کلیک لەسەر دوگمەی خوارەوە بکە بۆ دەستپێکردنی میڕۆڕ.</p>
                            <button 
                              onClick={startScreenShare}
                              className="px-8 py-3 bg-blue-600 rounded-2xl font-bold hover:bg-blue-500 transition-all shadow-xl shadow-blue-600/20 active:scale-95"
                            >
                              دەستپێکردن
                            </button>
                          </div>
                        ) : (
                          <div className="space-y-4">
                            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-500 mx-auto"></div>
                            <p className="text-slate-400 font-medium italic">چاوەڕێی پەیوەندی و وێنەی شاشەین...</p>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Ripple Effects for Clicks */}
                    {clicks.map(click => (
                      <div 
                        key={click.id}
                        className="absolute w-12 h-12 bg-white/30 border border-white/50 rounded-full -translate-x-1/2 -translate-y-1/2 animate-ping pointer-events-none z-50"
                        style={{ left: `${click.x}%`, top: `${click.y}%` }}
                      ></div>
                    ))}
                  </div>

                  {/* Android Navigation Bar (Simulated) */}
                  <div className="absolute bottom-2 left-1/2 -translate-x-1/2 w-1/3 h-1 bg-white/20 rounded-full z-30"></div>
                </div>

                {/* Floating Tool Bar */}
                {isConnected && (
                  <div className="mt-6 flex gap-3 p-2 bg-slate-800/80 backdrop-blur-md rounded-2xl border border-white/5 shadow-2xl">
                    <button onClick={handleAiAnalysis} className="w-12 h-12 rounded-xl bg-gradient-to-tr from-purple-600 to-pink-600 flex items-center justify-center hover:scale-105 transition-transform" title="AI Assistant">
                      <i className="fas fa-wand-magic-sparkles"></i>
                    </button>
                    <div className="w-px h-8 bg-white/10 self-center mx-1"></div>
                    <button className="w-12 h-12 rounded-xl bg-slate-700 flex items-center justify-center hover:bg-slate-600 transition-colors" title="Back">
                      <i className="fas fa-chevron-right"></i>
                    </button>
                    <button className="w-12 h-12 rounded-xl bg-slate-700 flex items-center justify-center hover:bg-slate-600 transition-colors" title="Home">
                      <i className="fas fa-house"></i>
                    </button>
                    <button className="w-12 h-12 rounded-xl bg-slate-700 flex items-center justify-center hover:bg-slate-600 transition-colors" title="Recents">
                      <i className="fas fa-square"></i>
                    </button>
                    <div className="w-px h-8 bg-white/10 self-center mx-1"></div>
                    <button className="w-12 h-12 rounded-xl bg-slate-700 flex items-center justify-center hover:bg-slate-600 transition-colors">
                      <i className="fas fa-keyboard"></i>
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Control & Chat Panel */}
        <div className="w-full lg:w-96 flex flex-col gap-4 h-full">
          {/* Room Card */}
          <div className="bg-slate-900 rounded-[2rem] p-6 border border-white/5 shadow-xl relative overflow-hidden group">
            <div className="absolute -top-10 -right-10 w-32 h-32 bg-blue-600/10 rounded-full blur-3xl group-hover:bg-blue-600/20 transition-all"></div>
            <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-4 flex items-center gap-2">
              <i className="fas fa-key text-[10px]"></i> کۆدی ژووری چالاک
            </h3>
            <div className="flex items-center justify-between">
              <div className="text-3xl font-mono font-bold tracking-tighter text-white">
                {roomId || '------'}
              </div>
              <button 
                onClick={() => roomId && navigator.clipboard.writeText(roomId)}
                className="w-10 h-10 rounded-xl bg-slate-800 flex items-center justify-center text-slate-400 hover:text-blue-400 hover:bg-slate-700 transition-all"
              >
                <i className="fas fa-copy"></i>
              </button>
            </div>
          </div>

          {/* Activity Feed & Chat */}
          <div className="bg-slate-900 rounded-[2rem] flex-grow flex flex-col border border-white/5 shadow-xl overflow-hidden">
            <div className="p-4 border-b border-white/5 flex justify-between items-center bg-slate-900/50">
              <div className="flex items-center gap-2">
                <i className="fas fa-comment-dots text-blue-500"></i>
                <span className="font-bold text-sm">چالاکی و پەیامەکان</span>
              </div>
              <div className="flex gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-blue-500"></span>
                <span className="w-1.5 h-1.5 rounded-full bg-blue-500/50"></span>
                <span className="w-1.5 h-1.5 rounded-full bg-blue-500/20"></span>
              </div>
            </div>
            
            <div className="flex-grow p-4 overflow-y-auto space-y-3 custom-scrollbar">
              {chatMessages.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-slate-600 text-center p-8 space-y-4">
                  <div className="w-16 h-16 bg-slate-800/50 rounded-full flex items-center justify-center">
                    <i className="fas fa-terminal text-2xl opacity-20"></i>
                  </div>
                  <p className="text-xs leading-relaxed">لێرە ڕاپۆرتی کلیکەکان و پەیامەکان دەبینیت. ئەی ئای دەتوانێت یارمەتیت بدات لە شیکردنەوەی شاشەکە.</p>
                </div>
              ) : (
                chatMessages.map((msg, idx) => (
                  <div key={idx} className={`flex flex-col ${msg.sender === 'You' ? 'items-end' : 'items-start'} animate-in fade-in slide-in-from-bottom-2 duration-300`}>
                    <div className={`max-w-[90%] p-3 rounded-2xl text-sm ${
                      msg.sender === 'You' 
                        ? 'bg-blue-600 text-white rounded-tr-none' 
                        : msg.sender === 'Gemini AI'
                        ? 'bg-gradient-to-br from-purple-600/20 to-pink-600/20 text-purple-100 border border-purple-500/30 rounded-tl-none'
                        : msg.sender === 'Control'
                        ? 'bg-slate-800/50 text-blue-400 border border-blue-500/10 text-[11px] rounded-lg py-1'
                        : 'bg-slate-800 text-slate-300 rounded-tl-none'
                    }`}>
                      {msg.sender !== 'Control' && (
                        <span className="text-[9px] font-bold block mb-1 opacity-60 uppercase tracking-tighter">
                          {msg.sender}
                        </span>
                      )}
                      {msg.text}
                    </div>
                  </div>
                ))
              )}
            </div>

            <form onSubmit={sendChatMessage} className="p-4 bg-slate-950/50 border-t border-white/5 flex gap-2">
              <input 
                type="text" 
                value={inputMessage}
                onChange={(e) => setInputMessage(e.target.value)}
                placeholder="بۆ ئەوەی پەیام بنێریت لێرە بنووسە..."
                className="flex-grow bg-slate-900 border border-white/5 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-blue-500 transition-all placeholder-slate-600"
              />
              <button className="w-12 h-12 bg-blue-600 text-white rounded-xl flex items-center justify-center hover:bg-blue-500 shadow-lg shadow-blue-600/20 transition-all shrink-0 active:scale-90">
                <i className="fas fa-paper-plane"></i>
              </button>
            </form>
          </div>
        </div>
      </main>

      {/* Hidden Canvas for Frame Capture */}
      <canvas ref={canvasRef} width={1080} height={1920} className="hidden"></canvas>

      <style>{`
        .custom-scrollbar::-webkit-scrollbar { width: 4px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #1e293b; border-radius: 10px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #334155; }
      `}
      </style>
    </div>
  );
};

export default App;
