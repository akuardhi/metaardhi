import React, { useState, useRef, useEffect } from 'react';
import { 
  Upload, PenTool, Copy, Check, Loader2, 
  AlertCircle, FileText, Trash2, Wand2, ArrowRight, 
  Download, TrendingUp, Settings, Sparkles, Image as ImageIcon
} from 'lucide-react';

const envGemini = import.meta.env.VITE_GEMINI_API_KEY || '';

export default function App() {
  const [activeMenu, setActiveMenu] = useState('generate'); 
  const [showApiSettings, setShowApiSettings] = useState(false);
  const [geminiKey, setGeminiKey] = useState(envGemini);

  // State Generator Gambar
  const [imagePrompt, setImagePrompt] = useState('');
  const [aspectRatio, setAspectRatio] = useState('16:9');
  const [generateType, setGenerateType] = useState('photo'); 
  const [generatedMediaUrl, setGeneratedMediaUrl] = useState(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);

  // State Metadata & Trending
  const [file, setFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [base64Data, setBase64Data] = useState(null);
  const [mimeType, setMimeType] = useState(null);
  const [description, setDescription] = useState('');
  const [loadingMetadata, setLoadingMetadata] = useState(false);
  const [error, setError] = useState('');
  const [metadata, setMetadata] = useState(null);
  const [copiedField, setCopiedField] = useState(null);
  const [isLoadingTrending, setIsLoadingTrending] = useState(false);
  const [trendingData, setTrendingData] = useState('');
  const fileInputRef = useRef(null);

  useEffect(() => {
    return () => { if (previewUrl && !previewUrl.startsWith('http')) URL.revokeObjectURL(previewUrl); };
  }, [previewUrl]);

  // --- LOGIKA GENERATE GAMBAR (NATIVE HD & PROPORSIONAL) ---
  const handleGenerate = () => {
    if (!imagePrompt.trim()) { setError("Prompt tidak boleh kosong."); return; }
    
    setIsGenerating(true); setError(''); setGeneratedMediaUrl(null);
    
    // Set resolusi asli ke HD 4K untuk menghindari blur dan pecah
    let w = 3840, h = 2160;
    let arText = "16:9";
    if (aspectRatio === '1:1') { w = 2048; h = 2048; arText = "1:1"; }
    else if (aspectRatio === '9:16') { w = 2160; h = 3840; arText = "9:16"; }
    
    // Instruksi ketat untuk menjaga proporsi, detail aksesoris, dan sinematografi
    const instr = generateType === 'vector' 
      ? `, flat vector illustration style, clean digital art, solid colors, professional stock illustration, aspect ratio ${arText}` 
      : `, 8k resolution, ultra HD, highly detailed, photorealistic, cinematic camera distance, character gaze toward background landscape, consistent accessory details, perfect proportions, adobe stock photography, aspect ratio ${arText}`;

    const encodedPrompt = encodeURIComponent(imagePrompt + instr);
    const imageUrl = `https://image.pollinations.ai/prompt/${encodedPrompt}?seed=${Math.floor(Math.random()*100000)}&width=${w}&height=${h}&model=flux&nologo=true`;
    
    const img = new Image();
    img.onload = () => { setGeneratedMediaUrl(imageUrl); setIsGenerating(false); };
    img.onerror = () => { setError("Gagal merender gambar. Coba ganti deskripsi."); setIsGenerating(false); };
    img.src = imageUrl;
  };

  // --- LOGIKA DOWNLOAD (MAXIMUM QUALITY) ---
  const handleDownloadAsset = async () => {
    if (!generatedMediaUrl) return;
    setIsDownloading(true);
    try {
      const response = await fetch(generatedMediaUrl);
      const blob = await response.blob();
      
      // Konversi langsung dari blob untuk mempertahankan kualitas asli tanpa melar
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a'); 
      link.href = url;
      link.download = `MetaArdhi_Asset_${Math.floor(Date.now() / 1000)}.jpg`;
      document.body.appendChild(link); 
      link.click(); 
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (err) { 
      setError("Gagal mengunduh gambar."); 
    } finally {
      setIsDownloading(false);
    }
  };

  const useGeneratedImageForMetadata = async () => {
    setIsGenerating(true);
    try {
      const response = await fetch(generatedMediaUrl);
      const blob = await response.blob();
      const reader = new FileReader();
      reader.onloadend = () => {
        setBase64Data(reader.result.split(',')[1]); 
        setMimeType(blob.type);
        setPreviewUrl(generatedMediaUrl); 
        setDescription(imagePrompt); 
        setActiveMenu('metadata'); 
        setIsGenerating(false);
      };
      reader.readAsDataURL(blob);
    } catch (err) { 
      setError("Gagal mentransfer ke modul metadata."); 
      setIsGenerating(false); 
    }
  };

  // --- LOGIKA METADATA SEO (GEMINI) ---
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
    if (!geminiKey) { setError("Gemini API Key belum diatur di menu Pengaturan API."); setShowApiSettings(true); return; }
    if (!base64Data) { setError("Unggah gambar referensi terlebih dahulu."); return; }
    
    setLoadingMetadata(true); setError('');
    try {
      const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${geminiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          contents: [{ 
            parts: [
              { text: `Act as an elite Adobe Stock SEO expert. Generate commercial metadata for this image. Context: ${description}. Requirements: 1. English. 2. Title: Max 70 chars, catchy. 3. Keywords: 50 highly relevant words, comma-separated. 4. Category: Official Adobe Stock category.` }, 
              { inlineData: { mimeType: mimeType || 'image/jpeg', data: base64Data } }
            ] 
          }], 
          generationConfig: { 
            responseMimeType: "application/json",
            responseSchema: { type: "OBJECT", properties: { title: { type: "STRING" }, keywords: { type: "ARRAY", items: { type: "STRING" } }, category: { type: "STRING" } }, required: ["title", "keywords", "category"] }
          } 
        })
      });
      const data = await res.json();
      if(data.error) throw new Error(data.error.message);
      
      const parsedData = JSON.parse(data.candidates[0].content.parts[0].text);
      setMetadata({ title: parsedData.title, keywords: parsedData.keywords.join(', '), category: parsedData.category });
    } catch (e) { 
      setError("Gagal mengekstrak metadata. Periksa kembali API Key Anda."); 
    } finally { 
      setLoadingMetadata(false); 
    }
  };

  const copyToClipboard = (text, fieldName) => { navigator.clipboard.writeText(text); setCopiedField(fieldName); setTimeout(() => setCopiedField(null), 2000); };

  const downloadMetadataTXT = () => {
    if (!metadata) return;
    const textContent = `--- METADATA EXPORT ---\n\nTITLE:\n${metadata.title}\n\nKEYWORDS:\n${metadata.keywords}\n\nCATEGORY:\n${metadata.category}\n\n-----------------------`;
    const blob = new Blob([textContent], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a'); link.href = url;
    link.download = `Metadata_Stock_${Math.floor(Date.now() / 1000)}.txt`;
    document.body.appendChild(link); link.click(); document.body.removeChild(link);
  };

  // --- LOGIKA TRENDING PASAR (GEMINI) ---
  const fetchTrendingIdeas = async () => {
    if (!geminiKey) { setError("Gemini API Key belum diatur di menu Pengaturan API."); setShowApiSettings(true); return; }
    setIsLoadingTrending(true); setError(''); setTrendingData('');
    try {
      const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${geminiKey}`, { 
        method: 'POST', 
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents: [{ parts: [{ text: "Berikan daftar singkat namun mendetail tentang jenis foto dan ilustrasi vektor yang paling laku di Adobe Stock saat ini. Gunakan format profesional." }] }] }) 
      });
      const d = await res.json();
      if(d.error) throw new Error(d.error.message);
      setTrendingData(d.candidates[0].content.parts[0].text);
    } catch (e) { 
      setError("Gagal menarik data tren pasar."); 
    } finally { 
      setIsLoadingTrending(false); 
    }
  };
  // --- TAMPILAN UI ---
  return (
    <div style={{ fontFamily: "'Inter', system-ui, sans-serif" }} className="min-h-screen bg-gradient-to-br from-[#eff3f8] via-white to-[#e4e9f2] text-slate-800 p-4 md:p-8 selection:bg-indigo-200">
      <div className="max-w-6xl mx-auto space-y-8 animate-[fadeIn_0.5s_ease-out]">
        
        {/* HEADER */}
        <div className="flex flex-col md:flex-row justify-between items-center bg-white/70 backdrop-blur-xl p-6 rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-white/80 transition-all hover:shadow-[0_8px_40px_rgb(0,0,0,0.08)]">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-indigo-600 to-purple-600 flex items-center justify-center shadow-lg shadow-indigo-200">
              <Sparkles className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-black bg-clip-text text-transparent bg-gradient-to-r from-indigo-900 to-purple-800 tracking-tight">
                Meta Ardhi Tools
              </h1>
              <p className="text-sm font-medium text-slate-500">Microstock Asset Studio</p>
            </div>
          </div>
          
          <button onClick={() => setShowApiSettings(!showApiSettings)} className="mt-4 md:mt-0 flex items-center gap-2 text-sm font-bold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 px-5 py-2.5 rounded-xl transition-all">
            <Settings className={`w-4 h-4 transition-transform ${showApiSettings ? 'rotate-180' : ''}`} /> Konfigurasi API
          </button>
        </div>

        {/* API PANEL */}
        {showApiSettings && (
          <div className="bg-white/80 backdrop-blur-xl p-6 rounded-3xl border border-white/80 shadow-[0_8px_30px_rgb(0,0,0,0.04)] animate-[slideDown_0.3s_ease-out]">
            <label className="block text-xs font-bold text-slate-500 mb-2 uppercase tracking-wide">Gemini API Key (Untuk SEO & Tren)</label>
            <input type="password" value={geminiKey} onChange={(e) => setGeminiKey(e.target.value)} placeholder="Masukkan kunci Gemini Anda di sini..." className="w-full p-4 text-sm bg-slate-50 rounded-xl border-2 border-slate-100 focus:border-indigo-500 focus:bg-white outline-none transition-all shadow-inner" />
          </div>
        )}

        {/* NAVIGASI */}
        <div className="flex justify-center">
          <div className="inline-flex bg-white/60 backdrop-blur-md p-1.5 rounded-2xl shadow-sm border border-slate-200/50">
            {[
              { id: 'generate', icon: Wand2, label: 'Generator Visual' },
              { id: 'metadata', icon: PenTool, label: 'SEO Metadata' },
              { id: 'trending', icon: TrendingUp, label: 'Tren Pasar' }
            ].map((tab) => (
              <button key={tab.id} onClick={() => setActiveMenu(tab.id)} className={`flex items-center gap-2 px-6 py-3 text-sm font-bold rounded-xl transition-all ${activeMenu === tab.id ? 'bg-white text-indigo-700 shadow-md scale-105' : 'text-slate-500 hover:text-slate-800 hover:bg-white/50'}`}>
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

        {/* --- KONTEN MENU --- */}
        <div className="transition-all duration-500 ease-in-out">
          
          {/* GENERATOR */}
          {activeMenu === 'generate' && (
            <div className="bg-white/80 backdrop-blur-xl rounded-3xl p-8 border border-white/80 shadow-sm">
              <h2 className="text-xl font-black text-slate-800 mb-6 flex items-center gap-3"><Wand2 className="w-6 h-6 text-indigo-500" /> Produksi Aset Visual HD</h2>
              
              <div className="flex gap-4 mb-6">
                <select value={generateType} onChange={(e) => setGenerateType(e.target.value)} className="w-1/2 p-4 text-sm font-bold rounded-xl border-2 border-slate-100 bg-slate-50 focus:border-indigo-500 outline-none">
                  <option value="photo">Foto Fotorealistik</option>
                  <option value="vector">Ilustrasi Vektor</option>
                </select>
                <select value={aspectRatio} onChange={(e) => setAspectRatio(e.target.value)} className="w-1/2 p-4 text-sm font-bold rounded-xl border-2 border-slate-100 bg-slate-50 focus:border-indigo-500 outline-none">
                  <option value="16:9">Layar Lebar (16:9)</option>
                  <option value="9:16">Vertikal (9:16)</option>
                  <option value="1:1">Persegi (1:1)</option>
                </select>
              </div>

              <div className="flex flex-col md:flex-row gap-4 mb-8">
                <input type="text" value={imagePrompt} onChange={(e) => setImagePrompt(e.target.value)} placeholder="Deskripsikan gambar yang ingin dibuat..." className="flex-1 p-4 text-sm font-medium rounded-xl border-2 border-slate-100 bg-slate-50 focus:bg-white focus:border-indigo-500 outline-none"/>
                <button onClick={handleGenerate} disabled={isGenerating} className="py-4 px-8 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-black disabled:opacity-50 flex items-center justify-center gap-2 min-w-[140px]">
                  {isGenerating ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Render'}
                </button>
              </div>

              {generatedMediaUrl && !isGenerating && (
                <div className="border-2 border-slate-100 rounded-3xl bg-white p-4 shadow-sm">
                  <div className="flex justify-center bg-slate-900 rounded-2xl overflow-hidden mb-4 min-h-[300px]">
                    <img src={generatedMediaUrl} alt="Preview" className="w-full h-full object-contain max-h-[600px]" />
                  </div>
                  
                  <div className="flex flex-col md:flex-row gap-4 p-2">
                    <button onClick={handleDownloadAsset} disabled={isDownloading} className="flex-1 py-3.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-sm font-bold flex items-center justify-center gap-2">
                      {isDownloading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />} Unduh (Resolusi 4K)
                    </button>
                    <button onClick={useGeneratedImageForMetadata} className="px-6 py-3.5 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 rounded-xl text-sm font-black flex items-center justify-center gap-2">
                      Lanjut ke Metadata <ArrowRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* METADATA */}
          {activeMenu === 'metadata' && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              <div className="bg-white/80 backdrop-blur-xl p-8 border border-white/80 rounded-3xl shadow-sm">
                <h2 className="text-xl font-black text-slate-800 mb-6 flex items-center gap-3"><Upload className="w-6 h-6 text-blue-500" /> Referensi Gambar</h2>
                
                {!previewUrl ? (
                  <div onClick={() => fileInputRef.current?.click()} className="border-2 border-dashed border-slate-300 bg-slate-50 hover:bg-indigo-50 rounded-2xl p-12 text-center cursor-pointer mb-6">
                    <ImageIcon className="w-10 h-10 text-indigo-300 mx-auto mb-3" />
                    <p className="text-sm font-bold text-slate-600">Klik untuk mengunggah gambar</p>
                  </div>
                ) : (
                  <div className="relative border-2 border-slate-100 rounded-2xl bg-slate-900 p-2 mb-6">
                    <img src={previewUrl} alt="Preview" className="w-full h-56 object-contain rounded-xl" />
                    <button onClick={clearFile} className="absolute top-4 right-4 bg-rose-500 text-white p-2 rounded-xl"><Trash2 className="w-4 h-4" /></button>
                  </div>
                )}
                <input type="file" ref={fileInputRef} onChange={handleFileChange} accept="image/*" className="hidden" />
                
                <textarea value={description} onChange={(e) => setDescription(e.target.value)} className="w-full p-4 text-sm font-medium rounded-xl border-2 border-slate-100 bg-slate-50 focus:bg-white focus:border-indigo-500 outline-none resize-none h-24 mb-6" placeholder="Konteks tambahan (opsional)..." />
                
                <button onClick={generateMetadata} disabled={loadingMetadata} className="w-full py-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-black flex items-center justify-center gap-2 disabled:opacity-50">
                  {loadingMetadata ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Ekstrak Keyword SEO'}
                </button>
              </div>

              <div className="bg-white/80 backdrop-blur-xl p-8 border border-white/80 rounded-3xl shadow-sm flex flex-col">
                <h2 className="text-xl font-black text-slate-800 mb-6 flex items-center gap-3"><FileText className="w-6 h-6 text-purple-500" /> Hasil Ekstraksi</h2>
                
                {!metadata ? ( 
                  <div className="flex-1 flex items-center justify-center text-slate-400 bg-slate-50 rounded-2xl border-2 border-dashed border-slate-200"><p className="text-sm font-bold">Metadata akan muncul di sini.</p></div> 
                ) : (
                  <div className="space-y-4 flex-1 flex flex-col">
                    <div>
                      <label className="text-xs font-black text-slate-400 block mb-1">Judul Komersial</label>
                      <div className="relative bg-slate-50 p-4 rounded-xl border-2 border-slate-100 pr-12 text-sm font-bold">{metadata.title}
                        <button onClick={() => copyToClipboard(metadata.title, 'title')} className="absolute right-2 top-2 p-1.5 text-slate-400 hover:text-indigo-600">{copiedField === 'title' ? <Check className="w-5 h-5 text-emerald-500" /> : <Copy className="w-5 h-5" />}</button>
                      </div>
                    </div>
                    <div className="flex-1">
                      <label className="text-xs font-black text-slate-400 block mb-1">50 Kata Kunci</label>
                      <div className="relative h-full">
                        <textarea readOnly value={metadata.keywords} className="w-full h-full p-4 text-sm bg-slate-50 border-2 border-slate-100 rounded-xl pr-12 outline-none resize-none" />
                        <button onClick={() => copyToClipboard(metadata.keywords, 'keywords')} className="absolute right-2 top-2 p-2 bg-white shadow-sm border rounded-lg text-slate-400 hover:text-indigo-600">{copiedField === 'keywords' ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}</button>
                      </div>
                    </div>
                    <div>
                      <label className="text-xs font-black text-slate-400 block mb-1">Kategori</label>
                      <div className="flex gap-2">
                        <div className="p-3 bg-indigo-50 text-indigo-700 font-bold border-2 border-indigo-100 rounded-xl flex-1">{metadata.category}</div>
                        <button onClick={() => copyToClipboard(metadata.category, 'category')} className="p-3 border-2 rounded-xl text-slate-500 hover:bg-slate-50">{copiedField === 'category' ? <Check className="w-5 h-5 text-emerald-500" /> : <Copy className="w-5 h-5" />}</button>
                      </div>
                    </div>
                    <button onClick={downloadMetadataTXT} className="w-full py-4 mt-2 bg-slate-900 text-white rounded-xl text-sm font-black flex justify-center items-center gap-2">
                      <FileText className="w-4 h-4" /> Download .txt
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TREN PASAR */}
          {activeMenu === 'trending' && (
            <div className="bg-white/80 backdrop-blur-xl rounded-3xl p-8 border border-white/80 shadow-sm">
               <div className="flex justify-between items-center mb-6">
                  <h2 className="text-xl font-black text-slate-800 flex items-center gap-3"><TrendingUp className="w-6 h-6 text-emerald-500" /> Analisis Tren Adobe Stock</h2>
                  <button onClick={fetchTrendingIdeas} disabled={isLoadingTrending} className="px-6 py-3 bg-slate-900 text-white rounded-xl text-sm font-bold flex gap-2">
                    {isLoadingTrending ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Pindai Pasar'}
                  </button>
               </div>
               <div className="bg-slate-50 rounded-2xl p-6 border-2 border-slate-100 min-h-[300px]">
                  {isLoadingTrending ? (
                    <div className="flex flex-col items-center justify-center text-indigo-600 h-full py-10"><Loader2 className="w-10 h-10 animate-spin mb-4" /><p className="font-bold">Menganalisa...</p></div>
                  ) : trendingData ? ( 
                    <div className="text-sm text-slate-700 whitespace-pre-wrap">{trendingData}</div>
                  ) : ( 
                    <div className="flex items-center justify-center text-slate-400 h-full py-10"><p className="font-bold">Klik tombol Pindai Pasar.</p></div> 
                  )}
               </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
