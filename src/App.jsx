import React, { useState, useRef, useEffect } from 'react';
import { 
  Upload, PenTool, Copy, Check, Loader2, 
  AlertCircle, FileText, Trash2, Wand2, ArrowRight, 
  Download, TrendingUp, Settings, Sparkles
} from 'lucide-react';

const envGemini = import.meta.env.VITE_GEMINI_API_KEY || '';

export default function App() {
  const [activeMenu, setActiveMenu] = useState('generate'); 
  const [showApiSettings, setShowApiSettings] = useState(false);
  
  const [geminiKey, setGeminiKey] = useState(envGemini);
  // API Key JSON2Video ditanam langsung agar tidak error lagi
  const [json2VideoKey, setJson2VideoKey] = useState('2T9ShxBs8hebcrBFbYgj44eGg4FdeR8mJ9hbcTOQ');

  const [imagePrompt, setImagePrompt] = useState('');
  const [aspectRatio, setAspectRatio] = useState('16:9');
  const [generateType, setGenerateType] = useState('photo'); 
  
  const [generatedMediaUrl, setGeneratedMediaUrl] = useState(null);
  const [resultMediaType, setResultMediaType] = useState('photo'); 
  
  const [isGeneratingImage, setIsGeneratingImage] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadRes, setDownloadRes] = useState(2048); 
  const [videoStatus, setVideoStatus] = useState(''); 

  const [mediaType, setMediaType] = useState('gambar');
  const [file, setFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [base64Data, setBase64Data] = useState(null);
  const [mimeType, setMimeType] = useState(null);
  const [description, setDescription] = useState('');
  const [loadingMetadata, setLoadingMetadata] = useState(false);
  const [error, setError] = useState('');
  const [metadata, setMetadata] = useState(null);
  const [copiedField, setCopiedField] = useState(null);
  const fileInputRef = useRef(null);
  const [trendingIdeas, setTrendingIdeas] = useState('');
  const [isLoadingTrending, setIsLoadingTrending] = useState(false);

  useEffect(() => {
    return () => {
      if (previewUrl && !previewUrl.startsWith('http')) {
        URL.revokeObjectURL(previewUrl);
      }
    };
  }, [previewUrl]);

  const handleGenerate = async () => {
    if (generateType === 'video' && !json2VideoKey) {
      setError("API Key JSON2Video hilang.");
      setShowApiSettings(true); return;
    }
    if (!imagePrompt.trim()) { setError("Prompt tidak boleh kosong."); return; }
    
    setIsGeneratingImage(true); setError(''); setGeneratedMediaUrl(null);
    setResultMediaType(generateType); setVideoStatus('Menyelaraskan piksel visual...');
    
    let w = 1920, h = 1080;
    let arInstruction = ", wide landscape perspective";
    if (aspectRatio === '1:1') { w = 1024; h = 1024; arInstruction = ", perfect square aspect ratio"; }
    if (aspectRatio === '9:16') { w = 1080; h = 1920; arInstruction = ", vertical portrait aspect ratio"; }
    
    let hiddenInstructions = `${arInstruction}, sharp focus, highly detailed, 8k resolution, photorealistic, cinematic composition, adobe stock photography`;
    if (generateType === 'vector') hiddenInstructions = `${arInstruction}, flat vector illustration style, clean digital art, sharp edges, solid colors, adobe illustrator style, professional stock illustration`;

    const encodedPrompt = encodeURIComponent(imagePrompt + hiddenInstructions);
    const randomSeed = Math.floor(Math.random() * 100000);
    const imageUrl = `https://image.pollinations.ai/prompt/${encodedPrompt}?seed=${randomSeed}&width=${w}&height=${h}&model=flux&nologo=true`;
    
    if (generateType !== 'video') {
      const img = new Image();
      img.onload = () => { setGeneratedMediaUrl(imageUrl); setIsGeneratingImage(false); };
      img.onerror = () => { setError("Gagal merender aset."); setIsGeneratingImage(false); };
      img.src = imageUrl; return;
    }

    try {
      setVideoStatus('Menghubungkan ke server Video...');
      
      // Payload JSON2Video yang diperbaiki dan disederhanakan
      const req = await fetch('https://api.json2video.com/v2/movies', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json', 
          'x-api-key': json2VideoKey 
        },
        body: JSON.stringify({
          scenes: [
            {
              duration: 8,
              elements: [
                {
                  type: "image",
                  src: imageUrl
                }
              ]
            }
          ]
        })
      });
      
      const res = await req.json();
      if (!res.project) throw new Error(res.message || "Koneksi server terputus atau API Key salah.");

      const projectId = res.project;
      const checkStatus = async () => {
        setVideoStatus('Rendering MP4 (Mohon tunggu 15-30 detik)...');
        try {
          const statusReq = await fetch(`https://api.json2video.com/v2/movies?project=${projectId}`, { 
            method: 'GET', 
            headers: { 'x-api-key': json2VideoKey } 
          });
          const statusRes = await statusReq.json();
          if (statusRes.movie && statusRes.movie.status === 'done') {
            setGeneratedMediaUrl(statusRes.movie.url); setIsGeneratingImage(false);
          } else if (statusRes.movie && statusRes.movie.status === 'error') {
            setError("Gagal merender video di server. Coba prompt yang lebih sederhana."); setIsGeneratingImage(false);
          } else { setTimeout(checkStatus, 4000); }
        } catch (err) { setError("Koneksi terputus."); setIsGeneratingImage(false); }
      };
      setTimeout(checkStatus, 5000);
    } catch (err) { setError(err.message); setIsGeneratingImage(false); }
  };

  const handleDownloadImage = async () => {
    if (!generatedMediaUrl) return;
    setIsDownloading(true);
    try {
      if (resultMediaType === 'video') {
        const response = await fetch(generatedMediaUrl);
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a'); link.href = url;
        link.download = `Stock_Video_${Math.floor(Date.now() / 1000)}.mp4`;
        document.body.appendChild(link); link.click(); document.body.removeChild(link);
        setIsDownloading(false);
      } else {
        const img = new Image(); img.crossOrigin = "Anonymous"; 
        img.onload = () => {
          const canvas = document.createElement('canvas');
          canvas.width = downloadRes; canvas.height = downloadRes;
          const ctx = canvas.getContext('2d');
          ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high';
          ctx.drawImage(img, 0, 0, downloadRes, downloadRes);
          let labelRes = downloadRes === 2048 ? "2K" : downloadRes === 4096 ? "4K" : downloadRes === 8192 ? "8K" : "1080p";
          const link = document.createElement('a');
          link.download = `Stock_${resultMediaType === 'vector' ? 'Vector' : 'Photo'}_${labelRes}_${Math.floor(Date.now()/1000)}.jpg`;
          link.href = canvas.toDataURL('image/jpeg', 0.95); link.click();
          setIsDownloading(false);
        };
        img.onerror = () => { setError("Gagal upscale gambar."); setIsDownloading(false); };
        img.src = generatedMediaUrl;
      }
    } catch (err) { setError("Gagal mengunduh."); setIsDownloading(false); }
  };

  const useGeneratedImageForMetadata = async () => {
    if (resultMediaType === 'video') { setError("Video harus diunggah manual ke Metadata Studio."); return; }
    setIsGeneratingImage(true);
    try {
      const response = await fetch(generatedMediaUrl);
      const blob = await response.blob();
      const reader = new FileReader();
      reader.onloadend = () => {
        setBase64Data(reader.result.split(',')[1]); setMimeType(blob.type);
        setPreviewUrl(generatedMediaUrl); setMediaType(resultMediaType === 'vector' ? 'ilustrasi' : 'gambar');
        setDescription(imagePrompt); setActiveMenu('metadata'); setIsGeneratingImage(false);
      };
      reader.readAsDataURL(blob);
    } catch (err) { setError("Gagal transfer ke metadata."); setIsGeneratingImage(false); }
  };

  const fetchTrendingIdeas = async () => { 
    if (!geminiKey) { setError("API Key Gemini belum diatur."); setShowApiSettings(true); return; }
    setIsLoadingTrending(true); setError(''); setTrendingIdeas('');
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${geminiKey}`;
      const response = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ contents: [{ parts: [{ text: "Berikan daftar singkat tapi mendetail tentang konten visual yang sangat laku di Adobe Stock hari ini. Format dengan gaya modern profesional." }] }] }) });
      const data = await response.json();
      if(data.error) throw new Error(data.error.message);
      setTrendingIdeas(data.candidates?.[0]?.content?.parts?.[0]?.text || "Gagal memuat tren.");
    } catch (err) { setError("Gagal menarik data pasar."); } finally { setIsLoadingTrending(false); }
  };

  const handleFileChange = (e) => { 
    const selectedFile = e.target.files[0];
    if (!selectedFile) return;
    setFile(selectedFile); setPreviewUrl(URL.createObjectURL(selectedFile)); setMimeType(selectedFile.type); setError('');
    const reader = new FileReader();
    reader.onloadend = () => setBase64Data(reader.result.split(',')[1]);
    reader.readAsDataURL(selectedFile);
  };
  const clearFile = () => { setFile(null); setPreviewUrl(null); setBase64Data(null); setMimeType(null); if (fileInputRef.current) fileInputRef.current.value = ''; };

  const generateMetadata = async () => { 
    if (!geminiKey) { setError("API Key Gemini belum diatur."); setShowApiSettings(true); return; }
    if (!base64Data && !description.trim()) { setError("Unggah media atau berikan deskripsi."); return; }
    
    setLoadingMetadata(true); setError(''); setMetadata(null);
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${geminiKey}`;
      const prompt = `Act as an elite Adobe Stock SEO expert. Generate high-conversion metadata for this ${mediaType}. Context: ${description}. Requirements: 1. English. 2. Title: Max 70 chars, catchy. 3. Keywords: 50 highly relevant words, comma-separated. 4. Category: Official Adobe Stock category.`;
      const parts = [{ text: prompt }];
      if (base64Data) parts.push({ inlineData: { mimeType: mimeType || "image/jpeg", data: base64Data } });
      const payload = { contents: [{ role: "user", parts: parts }], generationConfig: { responseMimeType: "application/json", responseSchema: { type: "OBJECT", properties: { title: { type: "STRING" }, keywords: { type: "ARRAY", items: { type: "STRING" } }, category: { type: "STRING" } }, required: ["title", "keywords", "category"] } } };
      
      const result = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      const data = await result.json();
      if(data.error) throw new Error(data.error.message);
      
      const parsedData = JSON.parse(data.candidates?.[0]?.content?.parts?.[0]?.text);
      setMetadata({ title: parsedData.title, keywords: parsedData.keywords.join(', '), category: parsedData.category });
    } catch (err) { setError("Gagal mengekstrak metadata. Cek API Key."); } finally { setLoadingMetadata(false); }
  };

  const copyToClipboard = (text, fieldName) => { navigator.clipboard.writeText(text); setCopiedField(fieldName); setTimeout(() => setCopiedField(null), 2000); };

  const downloadMetadataTXT = () => {
    if (!metadata) return;
    const textContent = `--- METADATA EXPORT ---\n\nTITLE:\n${metadata.title}\n\nKEYWORDS:\n${metadata.keywords}\n\nCATEGORY:\n${metadata.category}\n\n-----------------------`;
    const blob = new Blob([textContent], { type: 'text/plain' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a'); link.href = url;
    link.download = `Metadata_${Math.floor(Date.now() / 1000)}.txt`;
    document.body.appendChild(link); link.click(); document.body.removeChild(link);
  };

  return (
    <div style={{ fontFamily: "'Inter', system-ui, sans-serif" }} className="min-h-screen bg-gradient-to-br from-[#eff3f8] via-white to-[#e4e9f2] text-slate-800 p-4 md:p-8 selection:bg-indigo-200">
      <div className="max-w-6xl mx-auto space-y-8 animate-[fadeIn_0.5s_ease-out]">
        
        {/* HEADER MODERN */}
        <div className="flex flex-col md:flex-row justify-between items-center bg-white/70 backdrop-blur-xl p-6 rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-white/80 transition-all duration-300 hover:shadow-[0_8px_40px_rgb(0,0,0,0.08)]">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-indigo-600 to-purple-600 flex items-center justify-center shadow-lg shadow-indigo-200 transform hover:rotate-12 transition-transform duration-300">
              <Sparkles className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-black bg-clip-text text-transparent bg-gradient-to-r from-indigo-900 to-purple-800 tracking-tight">
                Meta Ardhi Tools
              </h1>
              <p className="text-sm font-medium text-slate-500">Pro Asset Generation Studio</p>
            </div>
          </div>
          
          <button 
            onClick={() => setShowApiSettings(!showApiSettings)}
            className="mt-4 md:mt-0 flex items-center gap-2 text-sm font-bold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 px-5 py-2.5 rounded-xl transition-all duration-300 hover:-translate-y-0.5"
          >
            <Settings className={`w-4 h-4 transition-transform duration-500 ${showApiSettings ? 'rotate-180' : ''}`} />
            Konfigurasi API
          </button>
        </div>

        {/* API SETTINGS PANEL */}
        {showApiSettings && (
          <div className="bg-white/80 backdrop-blur-xl p-6 rounded-3xl border border-white/80 shadow-[0_8px_30px_rgb(0,0,0,0.04)] animate-[slideDown_0.3s_ease-out]">
            <h3 className="text-sm font-black mb-5 text-slate-800 uppercase tracking-wider">Kunci Sistem API</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="group">
                <label className="block text-xs font-bold text-slate-500 mb-2 group-focus-within:text-indigo-600 transition-colors">Gemini (Metadata & Tren)</label>
                <input type="password" value={geminiKey} onChange={(e) => setGeminiKey(e.target.value)} placeholder="Masukkan kunci Gemini..." className="w-full p-3.5 text-sm bg-slate-50 rounded-xl border-2 border-slate-100 focus:border-indigo-500 focus:bg-white outline-none transition-all duration-300 shadow-inner" />
              </div>
              <div className="group">
                <label className="block text-xs font-bold text-slate-500 mb-2 group-focus-within:text-purple-600 transition-colors">JSON2Video (Render MP4)</label>
                <input type="password" value={json2VideoKey} onChange={(e) => setJson2VideoKey(e.target.value)} placeholder="Masukkan kunci JSON2Video..." className="w-full p-3.5 text-sm bg-slate-50 rounded-xl border-2 border-slate-100 focus:border-purple-500 focus:bg-white outline-none transition-all duration-300 shadow-inner" />
              </div>
            </div>
          </div>
        )}

        {/* NAVIGATION TABS */}
        <div className="flex justify-center">
          <div className="inline-flex bg-white/60 backdrop-blur-md p-1.5 rounded-2xl shadow-sm border border-slate-200/50">
            {[
              { id: 'generate', icon: Wand2, label: 'Visual Studio' },
              { id: 'metadata', icon: PenTool, label: 'SEO Metadata' },
              { id: 'trending', icon: TrendingUp, label: 'Market Pulse' }
            ].map((tab) => (
              <button 
                key={tab.id}
                onClick={() => setActiveMenu(tab.id)} 
                className={`flex items-center gap-2 px-6 py-3 text-sm font-bold rounded-xl transition-all duration-300 ${activeMenu === tab.id ? 'bg-white text-indigo-700 shadow-[0_4px_12px_rgb(0,0,0,0.05)] scale-105' : 'text-slate-500 hover:text-slate-800 hover:bg-white/50'}`}
              >
                <tab.icon className={`w-4 h-4 ${activeMenu === tab.id ? 'text-indigo-600' : ''}`} /> {tab.label}
              </button>
            ))}
          </div>
        </div>

        {error && (
          <div className="p-4 bg-rose-50 text-rose-700 border-2 border-rose-200 rounded-2xl flex items-center gap-3 text-sm font-medium animate-[shake_0.5s_ease-in-out]">
            <AlertCircle className="w-5 h-5 shrink-0" /> <p>{error}</p>
          </div>
        )}

        <div className="transition-all duration-500 ease-in-out">
          
          {/* MENU: TRENDING */}
          {activeMenu === 'trending' && (
            <div className="bg-white/80 backdrop-blur-xl rounded-3xl p-8 border border-white/80 shadow-[0_8px_30px_rgb(0,0,0,0.04)] animate-[fadeIn_0.4s_ease-out]">
               <div className="flex flex-col md:flex-row justify-between items-center mb-8 gap-4">
                  <h2 className="text-xl font-black text-slate-800 flex items-center gap-3"><TrendingUp className="w-6 h-6 text-emerald-500" /> Analisis Tren Global</h2>
                  <button onClick={fetchTrendingIdeas} disabled={isLoadingTrending} className="w-full md:w-auto px-6 py-3 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-sm font-bold disabled:opacity-70 flex items-center justify-center gap-2 transition-all duration-300 hover:shadow-lg hover:-translate-y-1">
                    {isLoadingTrending ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Mulai Pemindaian Pasar'}
                  </button>
               </div>
               <div className="bg-slate-50 rounded-2xl p-8 border-2 border-slate-100 min-h-[350px] shadow-inner transition-all">
                  {isLoadingTrending ? (
                    <div className="flex flex-col items-center justify-center text-indigo-600 h-full py-16"><Loader2 className="w-10 h-10 animate-spin mb-4" /><span className="text-sm font-bold tracking-wide uppercase">Sinkronisasi Data Adobe...</span></div>
                  ) : trendingIdeas ? ( 
                    <div className="text-sm text-slate-700 whitespace-pre-wrap leading-relaxed font-medium">{trendingIdeas}</div>
                  ) : ( 
                    <div className="flex flex-col items-center justify-center text-slate-400 h-full py-16">
                      <div className="w-20 h-20 bg-slate-100 rounded-full flex items-center justify-center mb-4"><TrendingUp className="w-8 h-8 opacity-40" /></div>
                      <p className="text-sm font-semibold">Ruang riset masih kosong. Jalankan pemindaian sekarang.</p>
                    </div> 
                  )}
               </div>
            </div>
          )}

          {/* MENU: AI GENERATOR */}
          {activeMenu === 'generate' && (
            <div className="bg-white/80 backdrop-blur-xl rounded-3xl p-8 border border-white/80 shadow-[0_8px_30px_rgb(0,0,0,0.04)] animate-[fadeIn_0.4s_ease-out]">
              <h2 className="text-xl font-black text-slate-800 mb-8 flex items-center gap-3"><Wand2 className="w-6 h-6 text-indigo-500" /> Kanvas Digital</h2>
              
              <div className="flex flex-col md:flex-row gap-5 mb-6">
                <div className="w-full md:w-1/3 group">
                  <label className="block text-xs font-bold text-slate-500 mb-2 uppercase tracking-wide">Format Media</label>
                  <select value={generateType} onChange={(e) => setGenerateType(e.target.value)} className="w-full p-4 text-sm font-bold rounded-xl border-2 border-slate-100 bg-slate-50 focus:border-indigo-500 outline-none transition-colors appearance-none cursor-pointer">
                    <option value="photo">Foto Fotorealistik</option>
                    <option value="vector">Vektor Flat UI</option>
                    <option value="video">Cinematic Video (MP4)</option>
                  </select>
                </div>
                <div className="w-full md:w-1/3 group">
                  <label className="block text-xs font-bold text-slate-500 mb-2 uppercase tracking-wide">Dimensi</label>
                  <select value={aspectRatio} onChange={(e) => setAspectRatio(e.target.value)} className="w-full p-4 text-sm font-bold rounded-xl border-2 border-slate-100 bg-slate-50 focus:border-indigo-500 outline-none transition-colors appearance-none cursor-pointer">
                    <option value="16:9">Layar Lebar (16:9)</option>
                    <option value="9:16">Vertikal Mobile (9:16)</option>
                    <option value="1:1">Persegi (1:1)</option>
                  </select>
                </div>
              </div>

              <div className="mb-10">
                <label className="block text-xs font-bold text-slate-500 mb-2 uppercase tracking-wide">Arahan Visual (Prompt)</label>
                <div className="flex flex-col md:flex-row gap-4">
                  <input type="text" value={imagePrompt} onChange={(e) => setImagePrompt(e.target.value)} placeholder="Deskripsikan mahakarya yang ingin Anda buat..." className="flex-1 p-4 text-sm font-medium rounded-xl border-2 border-slate-100 bg-slate-50 focus:bg-white focus:border-indigo-500 outline-none transition-all duration-300 shadow-inner"/>
                  <button onClick={handleGenerate} disabled={isGeneratingImage} className="py-4 px-10 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white rounded-xl text-sm font-black disabled:opacity-50 flex items-center justify-center gap-2 transition-all duration-300 hover:shadow-[0_8px_20px_rgb(99,102,241,0.4)] hover:-translate-y-1">
                    {isGeneratingImage ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Mulai Render'}
                  </button>
                </div>
              </div>

              {isGeneratingImage && !generatedMediaUrl && (
                <div className="w-full h-80 bg-slate-50 rounded-2xl border-2 border-dashed border-slate-200 flex flex-col items-center justify-center text-indigo-600">
                  <div className="relative">
                    <div className="w-16 h-16 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin"></div>
                    <div className="absolute inset-0 flex items-center justify-center"><Wand2 className="w-6 h-6 text-indigo-400 animate-pulse" /></div>
                  </div>
                  <span className="text-sm font-bold mt-6 tracking-widest uppercase animate-pulse">{videoStatus}</span>
                </div>
              )}

              {generatedMediaUrl && !isGeneratingImage && (
                <div className="border-2 border-slate-100 rounded-3xl bg-white p-4 shadow-[0_8px_30px_rgb(0,0,0,0.04)] animate-[slideUp_0.5s_ease-out]">
                  <div className="flex justify-center bg-slate-900 rounded-2xl overflow-hidden mb-4 min-h-[300px] shadow-inner relative group">
                    {resultMediaType === 'video' ? (
                      <video src={generatedMediaUrl} controls autoPlay loop className="w-full object-contain max-h-[500px]"></video>
                    ) : (
                      <img src={generatedMediaUrl} alt="Preview" className="w-full object-contain max-h-[500px] transition-transform duration-700 group-hover:scale-[1.02]" />
                    )}
                  </div>
                  
                  <div className="flex flex-col lg:flex-row justify-between items-center gap-4 bg-slate-50 p-4 rounded-2xl border border-slate-100">
                    <div className="flex items-center w-full lg:w-auto gap-3">
                      {resultMediaType !== 'video' && (
                        <div className="flex items-center bg-white p-1.5 rounded-xl border border-slate-200 shadow-sm">
                          <span className="text-xs font-black text-slate-500 px-3 uppercase">Export:</span>
                          <select value={downloadRes} onChange={(e) => setDownloadRes(Number(e.target.value))} className="p-2 text-sm bg-transparent font-bold text-slate-800 outline-none cursor-pointer">
                            <option value={1080}>FHD (1080p)</option> <option value={2048}>2K (Quad HD)</option> <option value={4096}>4K (Ultra HD)</option> <option value={8192}>8K (Master)</option>
                          </select>
                        </div>
                      )}
                      <button onClick={handleDownloadImage} disabled={isDownloading} className="flex-1 lg:flex-none px-6 py-3.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-sm font-bold flex items-center justify-center gap-2 transition-all duration-300 hover:shadow-lg hover:-translate-y-1">
                        {isDownloading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />} Unduh File
                      </button>
                    </div>

                    {resultMediaType !== 'video' && (
                      <button onClick={useGeneratedImageForMetadata} className="w-full lg:w-auto px-6 py-3.5 bg-white border-2 border-indigo-100 text-indigo-700 hover:bg-indigo-50 hover:border-indigo-200 rounded-xl text-sm font-black flex items-center justify-center gap-2 transition-all duration-300 hover:-translate-y-1">
                        Lanjut Ekstrak SEO <ArrowRight className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* MENU: METADATA GENERATOR */}
          {activeMenu === 'metadata' && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 animate-[fadeIn_0.4s_ease-out]">
              <div className="bg-white/80 backdrop-blur-xl p-8 border border-white/80 rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.04)]">
                <h2 className="text-xl font-black text-slate-800 mb-6 flex items-center gap-3"><Upload className="w-6 h-6 text-blue-500" /> Sumber Media</h2>
                <div className="mb-6">
                  {!previewUrl ? (
                    <div onClick={() => fileInputRef.current?.click()} className="border-2 border-dashed border-slate-300 bg-slate-50 hover:bg-indigo-50 hover:border-indigo-300 rounded-2xl p-12 text-center cursor-pointer transition-all duration-300 group">
                      <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center mx-auto mb-4 shadow-sm group-hover:scale-110 transition-transform"><Upload className="w-6 h-6 text-indigo-400" /></div>
                      <p className="text-sm font-bold text-slate-600">Jatuhkan file atau klik untuk menelusuri</p>
                    </div>
                  ) : (
                    <div className="relative border-2 border-slate-100 rounded-2xl bg-slate-900 p-2 group overflow-hidden shadow-inner">
                      <img src={previewUrl} alt="Preview" className="w-full h-56 object-contain rounded-xl transition-transform duration-500 group-hover:scale-105" />
                      <button onClick={clearFile} className="absolute top-4 right-4 bg-rose-500 hover:bg-rose-600 text-white p-2 rounded-xl shadow-lg transition-transform hover:scale-110"><Trash2 className="w-4 h-4" /></button>
                    </div>
                  )}
                  <input type="file" ref={fileInputRef} onChange={handleFileChange} accept="image/*" className="hidden" />
                </div>
                <div className="mb-8">
                  <label className="block text-xs font-bold text-slate-500 mb-2 uppercase tracking-wide">Konteks Spesifik (Opsional)</label>
                  <textarea value={description} onChange={(e) => setDescription(e.target.value)} className="w-full p-4 text-sm font-medium rounded-xl border-2 border-slate-100 bg-slate-50 focus:bg-white focus:border-indigo-500 outline-none resize-none h-28 shadow-inner transition-colors" placeholder="Fokuskan kata kunci pada elemen tertentu..." />
                </div>
                <button onClick={generateMetadata} disabled={loadingMetadata} className="w-full py-4 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white rounded-xl text-sm font-black disabled:opacity-70 flex items-center justify-center gap-2 transition-all duration-300 hover:shadow-[0_8px_20px_rgb(79,70,229,0.4)] hover:-translate-y-1">
                  {loadingMetadata ? <><Loader2 className="w-5 h-5 animate-spin" /> Ekstraksi Berjalan...</> : 'Jalankan Mesin SEO'}
                </button>
              </div>

              <div className="bg-white/80 backdrop-blur-xl p-8 border border-white/80 rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] flex flex-col">
                <h2 className="text-xl font-black text-slate-800 mb-6 flex items-center gap-3"><FileText className="w-6 h-6 text-purple-500" /> Hasil Ekstraksi</h2>
                
                {!metadata && !loadingMetadata && ( 
                  <div className="flex-1 flex flex-col items-center justify-center text-slate-400 bg-slate-50 rounded-2xl border-2 border-dashed border-slate-200 min-h-[350px]">
                    <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center mb-4 shadow-sm"><PenTool className="w-6 h-6 text-slate-300" /></div>
                    <p className="text-sm font-bold">Metadata akan dirender di area ini.</p>
                  </div> 
                )}
                {loadingMetadata && ( 
                  <div className="flex-1 flex flex-col items-center justify-center text-indigo-600 bg-indigo-50/50 rounded-2xl border-2 border-indigo-50 min-h-[350px]">
                    <Loader2 className="w-10 h-10 animate-spin mb-4" />
                    <p className="text-sm font-bold tracking-widest uppercase animate-pulse">Menganalisa Visual...</p>
                  </div> 
                )}
                {metadata && !loadingMetadata && (
                  <div className="space-y-6 flex-1 flex flex-col animate-[fadeIn_0.5s_ease-out]">
                    <div className="group">
                      <label className="text-xs font-black text-slate-400 uppercase tracking-wide block mb-2 group-hover:text-slate-600 transition-colors">Judul Komersial</label>
                      <div className="relative">
                        <div className="p-4 text-sm font-bold text-slate-700 bg-slate-50 border-2 border-slate-100 rounded-xl pr-14">{metadata.title}</div>
                        <button onClick={() => copyToClipboard(metadata.title, 'title')} className="absolute right-2 top-2 bottom-2 aspect-square flex items-center justify-center text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors">{copiedField === 'title' ? <Check className="w-5 h-5 text-emerald-500" /> : <Copy className="w-5 h-5" />}</button>
                      </div>
                    </div>
                    <div className="flex-1 group">
                      <label className="text-xs font-black text-slate-400 uppercase tracking-wide block mb-2 group-hover:text-slate-600 transition-colors">50 Kata Kunci Emas</label>
                      <div className="relative h-full min-h-[140px]">
                        <textarea readOnly value={metadata.keywords} className="w-full h-full p-4 text-sm font-medium text-slate-700 bg-slate-50 border-2 border-slate-100 rounded-xl pr-14 outline-none resize-none leading-relaxed" />
                        <button onClick={() => copyToClipboard(metadata.keywords, 'keywords')} className="absolute right-2 top-2 p-3 text-slate-400 hover:text-indigo-600 bg-white shadow-sm border border-slate-100 rounded-lg transition-all hover:scale-110">{copiedField === 'keywords' ? <Check className="w-5 h-5 text-emerald-500" /> : <Copy className="w-5 h-5" />}</button>
                      </div>
                    </div>
                    <div className="group">
                      <label className="text-xs font-black text-slate-400 uppercase tracking-wide block mb-2 group-hover:text-slate-600 transition-colors">Kategori Direktori</label>
                      <div className="flex items-center gap-3">
                        <div className="p-4 text-sm font-black text-indigo-700 bg-indigo-50 border-2 border-indigo-100 rounded-xl flex-1">{metadata.category}</div>
                        <button onClick={() => copyToClipboard(metadata.category, 'category')} className="p-4 bg-white border-2 border-slate-100 text-slate-500 rounded-xl hover:text-indigo-600 hover:border-indigo-100 transition-colors">{copiedField === 'category' ? <Check className="w-5 h-5 text-emerald-500" /> : <Copy className="w-5 h-5" />}</button>
                      </div>
                    </div>
                    
                    <div className="pt-6 mt-auto border-t-2 border-slate-100">
                      <button onClick={downloadMetadataTXT} className="w-full py-4 bg-white border-2 border-slate-800 text-slate-800 hover:bg-slate-800 hover:text-white rounded-xl text-sm font-black flex items-center justify-center gap-2 transition-all duration-300 hover:shadow-[0_8px_20px_rgb(30,41,59,0.2)] hover:-translate-y-1">
                        <FileText className="w-5 h-5" /> Unduh Format (.txt)
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
