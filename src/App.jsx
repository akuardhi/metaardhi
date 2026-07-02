import React, { useState, useRef, useEffect } from 'react';
import { 
  Upload, Video, PenTool, Copy, Check, Loader2, 
  AlertCircle, FileText, Trash2, Wand2, ArrowRight, 
  Download, TrendingUp, Settings
} from 'lucide-react';

// Mengambil kunci dari Vercel (jika berhasil di-build)
const envGemini = import.meta.env.VITE_GEMINI_API_KEY || '';
const envJson2Video = import.meta.env.VITE_JSON2VIDEO_API_KEY || '';

export default function App() {
  const [activeMenu, setActiveMenu] = useState('generate'); 
  const [showApiSettings, setShowApiSettings] = useState(false);
  
  // State API Keys (Fallback manual jika Vercel gagal membaca)
  const [geminiKey, setGeminiKey] = useState(envGemini);
  const [json2VideoKey, setJson2VideoKey] = useState(envJson2Video);

  // State Generate
  const [imagePrompt, setImagePrompt] = useState('');
  const [aspectRatio, setAspectRatio] = useState('16:9');
  const [generateType, setGenerateType] = useState('photo'); 
  
  const [generatedMediaUrl, setGeneratedMediaUrl] = useState(null);
  const [resultMediaType, setResultMediaType] = useState('photo'); 
  
  const [isGeneratingImage, setIsGeneratingImage] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadRes, setDownloadRes] = useState(2048); 
  const [videoStatus, setVideoStatus] = useState(''); 

  // State Metadata & Tren
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

  // --- FUNGSI GENERATE MULTI-MEDIA ---
  const handleGenerate = async () => {
    if (generateType === 'video' && !json2VideoKey) {
      setError("API Key JSON2Video belum terdeteksi. Silakan masukkan di menu Pengaturan API.");
      setShowApiSettings(true);
      return;
    }
    if (!imagePrompt.trim()) {
      setError("Masukkan deskripsi media.");
      return;
    }
    
    setIsGeneratingImage(true);
    setError('');
    setGeneratedMediaUrl(null);
    setResultMediaType(generateType);
    setVideoStatus('Memproses rendering gambar...');
    
    let w = 1920, h = 1080;
    let arInstruction = ", wide landscape perspective";
    
    if (aspectRatio === '1:1') { 
      w = 1024; h = 1024; arInstruction = ", perfect square aspect ratio"; 
    }
    if (aspectRatio === '9:16') { 
      w = 1080; h = 1920; arInstruction = ", vertical portrait aspect ratio"; 
    }
    
    // Instruksi ketat agar tidak gepeng dan kualitas standar stock
    let hiddenInstructions = `${arInstruction}, sharp focus, highly detailed, 8k resolution, photorealistic, cinematic composition, adobe stock photography`;
    
    if (generateType === 'vector') {
      hiddenInstructions = `${arInstruction}, flat vector illustration style, clean digital art, sharp edges, solid colors, adobe illustrator style, professional stock illustration`;
    }

    const encodedPrompt = encodeURIComponent(imagePrompt + hiddenInstructions);
    const randomSeed = Math.floor(Math.random() * 100000);
    const imageUrl = `https://image.pollinations.ai/prompt/${encodedPrompt}?seed=${randomSeed}&width=${w}&height=${h}&model=flux&nologo=true`;
    
    if (generateType !== 'video') {
      const img = new Image();
      img.onload = () => {
        setGeneratedMediaUrl(imageUrl);
        setIsGeneratingImage(false);
      };
      img.onerror = () => {
        setError("Gagal merender gambar. Coba ganti deskripsi.");
        setIsGeneratingImage(false);
      };
      img.src = imageUrl;
      return;
    }

    // --- PROSES VIDEO ---
    try {
      setVideoStatus('Menghubungkan ke server Video...');
      const req = await fetch('https://api.json2video.com/v2/movies', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': json2VideoKey
        },
        body: JSON.stringify({
          resolution: "1080p",
          quality: "high",
          scenes: [{ duration: 8, elements: [{ type: "image", src: imageUrl, zoom: 1.3 }] }]
        })
      });

      const res = await req.json();
      if (!res.project) throw new Error(res.message || "Gagal menghubungkan ke server JSON2Video.");

      const projectId = res.project;
      const checkStatus = async () => {
        setVideoStatus('Merender video MP4 (Estimasi 15-30 detik)...');
        try {
          const statusReq = await fetch(`https://api.json2video.com/v2/movies?project=${projectId}`, {
            method: 'GET',
            headers: { 'x-api-key': json2VideoKey }
          });
          const statusRes = await statusReq.json();
          
          if (statusRes.movie && statusRes.movie.status === 'done') {
            setGeneratedMediaUrl(statusRes.movie.url);
            setIsGeneratingImage(false);
          } else if (statusRes.movie && statusRes.movie.status === 'error') {
            setError("Gagal memproses video di server.");
            setIsGeneratingImage(false);
          } else {
            setTimeout(checkStatus, 4000); 
          }
        } catch (err) {
          setError("Koneksi terputus saat mengecek status video.");
          setIsGeneratingImage(false);
        }
      };

      setTimeout(checkStatus, 5000);
    } catch (err) {
      setError(err.message);
      setIsGeneratingImage(false);
    }
  };

  // --- FUNGSI DOWNLOAD ---
  const handleDownloadImage = async () => {
    if (!generatedMediaUrl) return;
    setIsDownloading(true);

    try {
      if (resultMediaType === 'video') {
        const response = await fetch(generatedMediaUrl);
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `Stock_Video_${Math.floor(Date.now() / 1000)}.mp4`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        setIsDownloading(false);
      } else {
        const img = new Image();
        img.crossOrigin = "Anonymous"; 
        img.onload = () => {
          const canvas = document.createElement('canvas');
          canvas.width = downloadRes; 
          canvas.height = downloadRes;
          const ctx = canvas.getContext('2d');
          ctx.imageSmoothingEnabled = true;
          ctx.imageSmoothingQuality = 'high';
          ctx.drawImage(img, 0, 0, downloadRes, downloadRes);
          
          let labelRes = downloadRes === 2048 ? "2K" : downloadRes === 4096 ? "4K" : downloadRes === 8192 ? "8K" : "1080p";
          const link = document.createElement('a');
          const mediaLabel = resultMediaType === 'vector' ? 'Vector' : 'Photo';
          link.download = `Stock_${mediaLabel}_${labelRes}_${Math.floor(Date.now() / 1000)}.jpg`;
          link.href = canvas.toDataURL('image/jpeg', 0.95); 
          link.click();
          setIsDownloading(false);
        };
        img.onerror = () => { setError("Gagal memperbesar resolusi gambar."); setIsDownloading(false); };
        img.src = generatedMediaUrl;
      }
    } catch (err) {
      setError("Gagal mengunduh file.");
      setIsDownloading(false);
    }
  };

  const useGeneratedImageForMetadata = async () => {
    try {
      if (resultMediaType === 'video') {
        setError("Transfer otomatis hanya untuk format gambar. Unduh video dan unggah manual.");
        return;
      }
      setIsGeneratingImage(true);
      const response = await fetch(generatedMediaUrl);
      const blob = await response.blob();
      const reader = new FileReader();
      reader.onloadend = () => {
        setBase64Data(reader.result.split(',')[1]);
        setMimeType(blob.type);
        setPreviewUrl(generatedMediaUrl);
        setMediaType(resultMediaType === 'vector' ? 'ilustrasi' : 'gambar');
        setDescription(imagePrompt); 
        setActiveMenu('metadata'); 
        setIsGeneratingImage(false);
      };
      reader.readAsDataURL(blob);
    } catch (err) {
      setError("Gagal mentransfer ke modul metadata.");
      setIsGeneratingImage(false);
    }
  };

  const fetchTrendingIdeas = async () => { 
    if (!geminiKey) { 
      setError("API Key Gemini belum terdeteksi. Silakan masukkan di menu Pengaturan API."); 
      setShowApiSettings(true);
      return; 
    }
    setIsLoadingTrending(true); setError(''); setTrendingIdeas('');
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${geminiKey}`;
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents: [{ parts: [{ text: "Berikan daftar profesional konten paling trending di Adobe Stock (Foto, Video, Vektor) hari ini. Gunakan format profesional." }] }] })
      });
      const data = await response.json();
      if(data.error) throw new Error(data.error.message);
      setTrendingIdeas(data.candidates?.[0]?.content?.parts?.[0]?.text || "Data tren tidak tersedia.");
    } catch (err) { 
      setError("Gagal memuat data tren pasar. Pastikan API Key Gemini valid."); 
    } finally { 
      setIsLoadingTrending(false); 
    }
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
    if (!geminiKey) {
      setError("API Key Gemini belum terdeteksi. Silakan masukkan di menu Pengaturan API.");
      setShowApiSettings(true);
      return;
    }
    if (!base64Data && !description.trim()) { setError("Unggah file atau masukkan deskripsi konteks."); return; }
    
    setLoadingMetadata(true); setError(''); setMetadata(null);
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${geminiKey}`;
      const prompt = `Act as a professional Adobe Stock contributor. Generate commercial metadata for this ${mediaType}. Context: ${description}. Output strict JSON. Requirements: 1. English. 2. Title: Max 70 chars. 3. Keywords: 50 words, comma-separated. 4. Category: Choose one official Adobe Stock category.`;
      const parts = [{ text: prompt }];
      if (base64Data) parts.push({ inlineData: { mimeType: mimeType || "image/jpeg", data: base64Data } });
      const payload = { contents: [{ role: "user", parts: parts }], generationConfig: { responseMimeType: "application/json", responseSchema: { type: "OBJECT", properties: { title: { type: "STRING" }, keywords: { type: "ARRAY", items: { type: "STRING" } }, category: { type: "STRING" } }, required: ["title", "keywords", "category"] } } };
      
      const result = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      const data = await result.json();
      if(data.error) throw new Error(data.error.message);
      
      const parsedData = JSON.parse(data.candidates?.[0]?.content?.parts?.[0]?.text);
      setMetadata({ title: parsedData.title, keywords: parsedData.keywords.join(', '), category: parsedData.category });
    } catch (err) { 
      setError("Gagal memproses metadata. Periksa kembali API Key Anda."); 
    } finally { 
      setLoadingMetadata(false); 
    }
  };

  const copyToClipboard = (text, fieldName) => { navigator.clipboard.writeText(text); setCopiedField(fieldName); setTimeout(() => setCopiedField(null), 2000); };

  const downloadMetadataTXT = () => {
    if (!metadata) return;
    const textContent = `--- METADATA EXPORT ---\n\nTITLE:\n${metadata.title}\n\nKEYWORDS:\n${metadata.keywords}\n\nCATEGORY:\n${metadata.category}\n\n-----------------------`;
    const blob = new Blob([textContent], { type: 'text/plain' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Metadata_${Math.floor(Date.now() / 1000)}.txt`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div style={{ fontFamily: 'Helvetica, Arial, sans-serif' }} className="min-h-screen bg-[#f3f4f6] text-[#111827] p-4 md:p-8">
      <div className="max-w-6xl mx-auto space-y-6">
        
        {/* HEADER PROFESIONAL */}
        <div className="flex flex-col md:flex-row justify-between items-center mb-8 border-b border-gray-300 pb-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-gray-900">
              Contributor Tools Workspace
            </h1>
            <p className="text-sm text-gray-500 mt-1">Asset Generation & Metadata Extraction</p>
          </div>
          
          <button 
            onClick={() => setShowApiSettings(!showApiSettings)}
            className="mt-4 md:mt-0 flex items-center gap-2 text-sm font-medium text-gray-600 hover:text-gray-900 bg-white border border-gray-300 px-4 py-2 rounded-md transition-colors"
          >
            <Settings className="w-4 h-4" />
            Pengaturan API
          </button>
        </div>

        {/* SETTINGS API PANEL */}
        {showApiSettings && (
          <div className="bg-white p-5 rounded-md border border-gray-300 shadow-sm mb-6">
            <h3 className="text-sm font-bold mb-4 text-gray-800">Konfigurasi API Keys</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Google Gemini API Key</label>
                <input 
                  type="password" 
                  value={geminiKey} 
                  onChange={(e) => setGeminiKey(e.target.value)} 
                  placeholder="Paste Gemini API Key..."
                  className="w-full p-2 text-sm border border-gray-300 rounded focus:border-gray-500 outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">JSON2Video API Key</label>
                <input 
                  type="password" 
                  value={json2VideoKey} 
                  onChange={(e) => setJson2VideoKey(e.target.value)} 
                  placeholder="Paste JSON2Video API Key..."
                  className="w-full p-2 text-sm border border-gray-300 rounded focus:border-gray-500 outline-none"
                />
              </div>
            </div>
            <p className="text-xs text-gray-500 mt-3">*Kunci ini hanya tersimpan sementara di browser Anda dan aman digunakan.</p>
          </div>
        )}

        {/* NAVIGATION TABS */}
        <div className="flex border-b border-gray-300 mb-6">
          <button onClick={() => setActiveMenu('generate')} className={`px-6 py-3 text-sm font-semibold transition-colors ${activeMenu === 'generate' ? 'border-b-2 border-gray-900 text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}>
            Asset Generator
          </button>
          <button onClick={() => setActiveMenu('metadata')} className={`px-6 py-3 text-sm font-semibold transition-colors ${activeMenu === 'metadata' ? 'border-b-2 border-gray-900 text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}>
            Metadata Studio
          </button>
          <button onClick={() => setActiveMenu('trending')} className={`px-6 py-3 text-sm font-semibold transition-colors ${activeMenu === 'trending' ? 'border-b-2 border-gray-900 text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}>
            Market Research
          </button>
        </div>

        {error && (
          <div className="p-4 bg-[#fef2f2] text-[#991b1b] border border-[#f87171] rounded-md flex items-start gap-3 text-sm mb-6">
            <AlertCircle className="w-5 h-5 shrink-0" /> <p>{error}</p>
          </div>
        )}

        {/* MENU: TRENDING */}
        {activeMenu === 'trending' && (
          <div className="bg-white rounded-md p-6 border border-gray-300 shadow-sm">
             <div className="flex justify-between items-center mb-6">
                <h2 className="text-lg font-bold text-gray-800">Analisis Tren Pasar</h2>
                <button onClick={fetchTrendingIdeas} disabled={isLoadingTrending} className="px-4 py-2 bg-gray-900 hover:bg-gray-800 text-white rounded text-sm font-medium disabled:opacity-70 flex items-center gap-2">
                  {isLoadingTrending ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Jalankan Riset'}
                </button>
             </div>
             <div className="bg-gray-50 rounded p-6 border border-gray-200 min-h-[300px]">
                {isLoadingTrending ? (
                  <div className="flex flex-col items-center justify-center text-gray-600 h-full py-12"><Loader2 className="w-8 h-8 animate-spin mb-3" /><span className="text-sm font-medium">Mengambil data tren global...</span></div>
                ) : trendingIdeas ? ( 
                  <div className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">{trendingIdeas}</div>
                ) : ( 
                  <div className="flex flex-col items-center justify-center text-gray-400 h-full py-12">
                    <TrendingUp className="w-10 h-10 mb-2 opacity-50" />
                    <p className="text-sm">Mulai riset pasar untuk melihat aset yang diminati.</p>
                  </div> 
                )}
             </div>
          </div>
        )}

        {/* MENU: AI GENERATOR */}
        {activeMenu === 'generate' && (
          <div className="bg-white rounded-md p-6 border border-gray-300 shadow-sm">
            <h2 className="text-lg font-bold text-gray-800 mb-6">Produksi Aset Baru</h2>
            
            <div className="flex flex-col md:flex-row gap-4 mb-4">
              <div className="w-full md:w-1/3">
                <label className="block text-xs font-semibold text-gray-600 mb-1">Tipe Aset</label>
                <select value={generateType} onChange={(e) => setGenerateType(e.target.value)} className="w-full p-2.5 text-sm rounded border border-gray-300 bg-gray-50 focus:border-gray-500 outline-none">
                  <option value="photo">Foto Realistis</option>
                  <option value="vector">Vektor / Ilustrasi</option>
                  <option value="video">Video MP4 (Cinematic)</option>
                </select>
              </div>

              <div className="w-full md:w-1/3">
                <label className="block text-xs font-semibold text-gray-600 mb-1">Rasio Aspek</label>
                <select value={aspectRatio} onChange={(e) => setAspectRatio(e.target.value)} className="w-full p-2.5 text-sm rounded border border-gray-300 bg-gray-50 focus:border-gray-500 outline-none">
                  <option value="16:9">16:9 (Landscape)</option>
                  <option value="9:16">9:16 (Portrait)</option>
                  <option value="1:1">1:1 (Square)</option>
                </select>
              </div>
            </div>

            <div className="mb-8">
              <label className="block text-xs font-semibold text-gray-600 mb-1">Deskripsi Prompt</label>
              <div className="flex flex-col md:flex-row gap-3">
                <input type="text" value={imagePrompt} onChange={(e) => setImagePrompt(e.target.value)} placeholder="Contoh: Modern minimalist architecture building..." className="flex-1 p-3 text-sm rounded border border-gray-300 focus:border-gray-500 outline-none"/>
                <button onClick={handleGenerate} disabled={isGeneratingImage} className="py-3 px-8 bg-gray-900 hover:bg-gray-800 text-white rounded text-sm font-bold disabled:opacity-50 flex items-center justify-center min-w-[120px]">
                  {isGeneratingImage ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Proses'}
                </button>
              </div>
            </div>

            {isGeneratingImage && !generatedMediaUrl && (
              <div className="w-full h-72 bg-gray-50 rounded border border-gray-200 flex flex-col items-center justify-center text-gray-600">
                <Loader2 className="w-8 h-8 animate-spin mb-3" />
                <span className="text-sm font-medium">{videoStatus}</span>
              </div>
            )}

            {generatedMediaUrl && !isGeneratingImage && (
              <div className="border border-gray-200 rounded bg-gray-50 p-4">
                <div className="flex justify-center bg-gray-200 rounded overflow-hidden border border-gray-300 mb-4 min-h-[300px]">
                  {resultMediaType === 'video' ? (
                    <video src={generatedMediaUrl} controls autoPlay loop className="w-full object-contain max-h-[500px]"></video>
                  ) : (
                    <img src={generatedMediaUrl} alt="Preview" className="w-full object-contain max-h-[500px]" />
                  )}
                </div>
                
                <div className="bg-white border border-gray-300 p-4 rounded flex flex-col md:flex-row justify-between items-center gap-4">
                  
                  {/* PENGATURAN KUALITAS & DOWNLOAD */}
                  <div className="flex items-center w-full md:w-auto gap-3">
                    {resultMediaType !== 'video' && (
                      <div className="flex items-center gap-2">
                        <label className="text-xs font-bold text-gray-600 whitespace-nowrap">Resolusi Ekspor:</label>
                        <select 
                          value={downloadRes} 
                          onChange={(e) => setDownloadRes(Number(e.target.value))} 
                          className="p-2 text-sm border border-gray-300 rounded outline-none font-semibold"
                        >
                          <option value={1080}>1080p</option> 
                          <option value={2048}>2K</option> 
                          <option value={4096}>4K</option> 
                          <option value={8192}>8K (Ultra HD)</option>
                        </select>
                      </div>
                    )}
                    <button 
                      onClick={handleDownloadImage} 
                      disabled={isDownloading} 
                      className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded text-sm font-bold flex items-center gap-2 disabled:opacity-70"
                    >
                      {isDownloading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                      Unduh {resultMediaType === 'video' ? 'MP4' : 'Aset'}
                    </button>
                  </div>

                  {resultMediaType !== 'video' && (
                    <button onClick={useGeneratedImageForMetadata} className="w-full md:w-auto px-6 py-2 border border-gray-900 text-gray-900 hover:bg-gray-100 rounded text-sm font-bold flex items-center justify-center gap-2">
                      Lanjut Ekstrak Metadata <ArrowRight className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* MENU: METADATA GENERATOR */}
        {activeMenu === 'metadata' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-white p-6 border border-gray-300 rounded-md shadow-sm">
              <h2 className="text-lg font-bold text-gray-800 mb-4">Input Media</h2>
              <div className="mb-5">
                <label className="block text-xs font-semibold text-gray-600 mb-2">Unggah Referensi Aset</label>
                {!previewUrl ? (
                  <div onClick={() => fileInputRef.current?.click()} className="border-2 border-dashed border-gray-300 rounded-md p-10 text-center cursor-pointer hover:bg-gray-50 transition-colors">
                    <Upload className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                    <p className="text-sm text-gray-500 font-medium">Klik untuk mengunggah file</p>
                  </div>
                ) : (
                  <div className="relative border border-gray-200 rounded-md bg-gray-50 p-2">
                    <img src={previewUrl} alt="Preview" className="w-full h-48 object-contain rounded" />
                    <button onClick={clearFile} className="absolute top-4 right-4 bg-red-600 text-white p-1.5 rounded shadow"><Trash2 className="w-4 h-4" /></button>
                  </div>
                )}
                <input type="file" ref={fileInputRef} onChange={handleFileChange} accept="image/*" className="hidden" />
              </div>
              <div className="mb-6">
                <label className="block text-xs font-semibold text-gray-600 mb-2">Konteks Tambahan (Opsional)</label>
                <textarea value={description} onChange={(e) => setDescription(e.target.value)} className="w-full p-3 text-sm rounded border border-gray-300 focus:border-gray-500 outline-none resize-none h-24" placeholder="Berikan arahan spesifik untuk metadata..." />
              </div>
              <button onClick={generateMetadata} disabled={loadingMetadata} className="w-full py-3 bg-gray-900 hover:bg-gray-800 text-white rounded text-sm font-bold disabled:opacity-70 flex items-center justify-center gap-2">
                {loadingMetadata ? <><Loader2 className="w-4 h-4 animate-spin" /> Ekstraksi Berjalan...</> : 'Ekstrak Metadata'}
              </button>
            </div>

            <div className="bg-white p-6 border border-gray-300 rounded-md shadow-sm flex flex-col">
              <h2 className="text-lg font-bold text-gray-800 mb-4">Output Ekstraksi</h2>
              
              {!metadata && !loadingMetadata && ( 
                <div className="flex-1 flex flex-col items-center justify-center text-gray-400 border border-dashed border-gray-200 rounded-md min-h-[300px]">
                  <p className="text-sm">Metadata akan ditampilkan di sini.</p>
                </div> 
              )}
              {loadingMetadata && ( 
                <div className="flex-1 flex flex-col items-center justify-center text-gray-600 border border-gray-100 rounded-md min-h-[300px]">
                  <Loader2 className="w-8 h-8 animate-spin mb-3" />
                  <p className="text-sm font-medium">Menganalisa visual & menyusun kata kunci...</p>
                </div> 
              )}
              {metadata && !loadingMetadata && (
                <div className="space-y-5 flex-1 flex flex-col">
                  <div>
                    <label className="text-xs font-bold text-gray-600 block mb-1">Judul Komersial</label>
                    <div className="relative">
                      <div className="p-3 text-sm bg-gray-50 border border-gray-300 rounded pr-12">{metadata.title}</div>
                      <button onClick={() => copyToClipboard(metadata.title, 'title')} className="absolute right-2 top-2 p-1 text-gray-500 hover:text-gray-900 bg-white border border-gray-200 rounded">{copiedField === 'title' ? <Check className="w-4 h-4 text-green-600" /> : <Copy className="w-4 h-4" />}</button>
                    </div>
                  </div>
                  <div className="flex-1">
                    <label className="text-xs font-bold text-gray-600 block mb-1">50 Kata Kunci Tertarget</label>
                    <div className="relative h-full min-h-[120px]">
                      <textarea readOnly value={metadata.keywords} className="w-full h-full p-3 text-sm bg-gray-50 border border-gray-300 rounded pr-12 outline-none resize-none" />
                      <button onClick={() => copyToClipboard(metadata.keywords, 'keywords')} className="absolute right-2 top-2 p-1 text-gray-500 hover:text-gray-900 bg-white border border-gray-200 rounded shadow-sm">{copiedField === 'keywords' ? <Check className="w-4 h-4 text-green-600" /> : <Copy className="w-4 h-4" />}</button>
                    </div>
                  </div>
                  <div>
                    <label className="text-xs font-bold text-gray-600 block mb-1">Kategori Adobe Stock</label>
                    <div className="flex items-center gap-2">
                      <div className="p-3 text-sm bg-gray-50 border border-gray-300 rounded flex-1 font-semibold">{metadata.category}</div>
                      <button onClick={() => copyToClipboard(metadata.category, 'category')} className="p-3 bg-white border border-gray-300 text-gray-600 rounded hover:bg-gray-100">{copiedField === 'category' ? <Check className="w-5 h-5 text-green-600" /> : <Copy className="w-5 h-5" />}</button>
                    </div>
                  </div>
                  
                  <div className="pt-4 mt-auto">
                    <button onClick={downloadMetadataTXT} className="w-full py-3 bg-white border-2 border-gray-900 text-gray-900 hover:bg-gray-900 hover:text-white rounded text-sm font-bold flex items-center justify-center gap-2 transition-colors">
                      <FileText className="w-4 h-4" /> Export Metadata (.txt)
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
