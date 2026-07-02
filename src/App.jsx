import React, { useState, useRef, useEffect } from 'react';
import { 
  Upload, Image as ImageIcon, Video, PenTool, 
  Copy, Check, Loader2, AlertCircle, FileText, 
  Sparkles, Trash2, Wand2, ArrowRight, Download,
  TrendingUp, Flame, PlayCircle
} from 'lucide-react';

// Mengambil 2 API Key dari Vercel
const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
const json2VideoKey = import.meta.env.VITE_JSON2VIDEO_API_KEY;

export default function App() {
  const [activeMenu, setActiveMenu] = useState('generate'); 
  
  // State Generate
  const [imagePrompt, setImagePrompt] = useState('');
  const [aspectRatio, setAspectRatio] = useState('16:9');
  const [generateType, setGenerateType] = useState('photo'); 
  
  const [generatedMediaUrl, setGeneratedMediaUrl] = useState(null);
  const [resultMediaType, setResultMediaType] = useState('photo'); // 'photo', 'vector', 'video'
  
  const [isGeneratingImage, setIsGeneratingImage] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadRes, setDownloadRes] = useState(2048); 
  const [videoStatus, setVideoStatus] = useState(''); // Untuk teks loading video

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

  // --- FUNGSI GENERATE MULTI-MEDIA (FOTO / VEKTOR / VIDEO) ---
  const handleGenerate = async () => {
    if (generateType === 'video' && !json2VideoKey) {
      setError("API Key JSON2Video belum dipasang di Vercel (VITE_JSON2VIDEO_API_KEY).");
      return;
    }
    if (!imagePrompt.trim()) {
      setError("Masukkan deskripsi media yang ingin dibuat.");
      return;
    }
    
    setIsGeneratingImage(true);
    setError('');
    setGeneratedMediaUrl(null);
    setResultMediaType(generateType);
    setVideoStatus('Menciptakan lukisan gambar tajam...');
    
    let w = 1920, h = 1080;
    if (aspectRatio === '1:1') { w = 1024; h = 1024; }
    if (aspectRatio === '9:16') { w = 1080; h = 1920; }
    
    // Instruksi Rahasia (Anti Burem)
    let hiddenInstructions = ", sharp focus, highly detailed, 8k resolution, photorealistic, cinematic effect, adobe stock photography";
    if (generateType === 'vector') {
      hiddenInstructions = ", flat vector illustration, adobe illustrator style, clean lines, solid vibrant colors, minimal detail, white background, premium stock illustration";
    }

    const encodedPrompt = encodeURIComponent(imagePrompt + hiddenInstructions);
    const randomSeed = Math.floor(Math.random() * 100000);
    const imageUrl = `https://image.pollinations.ai/prompt/${encodedPrompt}?seed=${randomSeed}&width=${w}&height=${h}&model=flux&nologo=true`;
    
    // Jika hanya foto/vektor
    if (generateType !== 'video') {
      const img = new Image();
      img.onload = () => {
        setGeneratedMediaUrl(imageUrl);
        setIsGeneratingImage(false);
      };
      img.onerror = () => {
        setError("Gagal membuat gambar.");
        setIsGeneratingImage(false);
      };
      img.src = imageUrl;
      return;
    }

    // --- PROSES VIDEO (MENGGUNAKAN JSON2VIDEO) ---
    try {
      setVideoStatus('Menghubungkan ke server JSON2Video...');
      const req = await fetch('https://api.json2video.com/v2/movies', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': json2VideoKey
        },
        body: JSON.stringify({
          resolution: "1080p",
          quality: "high",
          scenes: [
            {
              duration: 8, // Video 8 detik
              elements: [
                {
                  type: "image",
                  src: imageUrl, // Pakai gambar AI yang tajam tadi
                  zoom: 1.3    // Efek Cinematic Zoom In
                }
              ]
            }
          ]
        })
      });

      const res = await req.json();
      if (!res.project) throw new Error(res.message || "Koneksi ke JSON2Video gagal.");

      const projectId = res.project;
      
      const checkStatus = async () => {
        setVideoStatus('Sedang me-render video MP4 (biasanya butuh 10-30 detik)...');
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
            setError("Server JSON2Video gagal memproses video.");
            setIsGeneratingImage(false);
          } else {
            setTimeout(checkStatus, 4000); // Cek lagi tiap 4 detik
          }
        } catch (err) {
          setError("Gagal mengecek status video.");
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
        link.download = `AdobeStock_Video_${Math.floor(Date.now() / 1000)}.mp4`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        window.URL.revokeObjectURL(url);
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
          const mediaLabel = resultMediaType === 'vector' ? 'VectorStyle' : 'Photo';
          link.download = `AdobeStock_${mediaLabel}_${labelRes}_${Math.floor(Date.now() / 1000)}.jpg`;
          link.href = canvas.toDataURL('image/jpeg', 0.95); 
          link.click();
          setIsDownloading(false);
        };
        img.onerror = () => { setError("Gagal memperbesar gambar."); setIsDownloading(false); };
        img.src = generatedMediaUrl;
      }
    } catch (err) {
      setError("Gagal mendownload file.");
      setIsDownloading(false);
    }
  };

  const useGeneratedImageForMetadata = async () => {
    try {
      if (resultMediaType === 'video') {
        setError("Fitur transfer otomatis ke metadata hanya untuk gambar. Untuk video, simpan dulu lalu upload manual di menu Metadata.");
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
      setError("Gagal mentransfer ke metadata.");
      setIsGeneratingImage(false);
    }
  };

  const fetchTrendingIdeas = async () => { 
    if (!apiKey) { setError("API Key Gemini belum dipasang."); return; }
    setIsLoadingTrending(true); setError(''); setTrendingIdeas('');
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents: [{ parts: [{ text: "Berikan daftar konten paling trending di Adobe Stock (Foto, Video, Vektor) saat ini." }] }] })
      });
      const data = await response.json();
      setTrendingIdeas(data.candidates?.[0]?.content?.parts?.[0]?.text || "Gagal.");
    } catch (err) { setError("Gagal memuat tren."); } finally { setIsLoadingTrending(false); }
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
    if (!base64Data && !description.trim()) { setError("Unggah file atau masukkan deskripsi."); return; }
    setLoadingMetadata(true); setError(''); setMetadata(null);
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;
      const prompt = `You are an expert Adobe Stock contributor. Generate highly commercial metadata for this ${mediaType}. Context: ${description}. Requirements: 1. English. 2. Title: Max 70 chars. 3. Keywords: 50 words, comma-separated. 4. Category: Choose one Adobe Stock category.`;
      const parts = [{ text: prompt }];
      if (base64Data) parts.push({ inlineData: { mimeType: mimeType || "image/jpeg", data: base64Data } });
      const payload = { contents: [{ role: "user", parts: parts }], generationConfig: { responseMimeType: "application/json", responseSchema: { type: "OBJECT", properties: { title: { type: "STRING" }, keywords: { type: "ARRAY", items: { type: "STRING" } }, category: { type: "STRING" } }, required: ["title", "keywords", "category"] } } };
      const result = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      const data = await result.json();
      const parsedData = JSON.parse(data.candidates?.[0]?.content?.parts?.[0]?.text);
      setMetadata({ title: parsedData.title, keywords: parsedData.keywords.join(', '), category: parsedData.category });
    } catch (err) { setError("Gagal membuat metadata."); } finally { setLoadingMetadata(false); }
  };

  const copyToClipboard = (text, fieldName) => { navigator.clipboard.writeText(text); setCopiedField(fieldName); setTimeout(() => setCopiedField(null), 2000); };

  // --- FUNGSI DOWNLOAD METADATA TXT ---
  const downloadMetadataTXT = () => {
    if (!metadata) return;
    
    const textContent = `--- ADOBE STOCK METADATA ---\n\nTITLE:\n${metadata.title}\n\nKEYWORDS:\n${metadata.keywords}\n\nCATEGORY:\n${metadata.category}\n\n----------------------------\nGenerated by Adobe Stock Master Tool`;
    
    const blob = new Blob([textContent], { type: 'text/plain' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Metadata_AdobeStock_${Math.floor(Date.now() / 1000)}.txt`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 font-sans p-4 md:p-8">
      <div className="max-w-6xl mx-auto space-y-6">
        
        <div className="text-center space-y-2 mb-8">
          <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight text-slate-900 flex items-center justify-center gap-3">
            <Sparkles className="w-8 h-8 text-blue-600" />
            Adobe Stock Master Tool
          </h1>
          <p className="text-slate-500 max-w-2xl mx-auto">
            Platform all-in-one untuk Foto, Vektor Ilustrasi, Video MP4, dan Metadata.
          </p>
        </div>

        <div className="flex justify-center mb-6 overflow-x-auto pb-2">
          <div className="bg-slate-200 p-1 rounded-xl flex gap-1 w-max">
            <button onClick={() => setActiveMenu('generate')} className={`px-4 md:px-6 py-2.5 rounded-lg text-sm font-bold flex items-center gap-2 transition-all ${activeMenu === 'generate' ? 'bg-white shadow-sm text-blue-600' : 'text-slate-500 hover:text-slate-700'}`}><Wand2 className="w-4 h-4" /> AI Generator</button>
            <button onClick={() => setActiveMenu('metadata')} className={`px-4 md:px-6 py-2.5 rounded-lg text-sm font-bold flex items-center gap-2 transition-all ${activeMenu === 'metadata' ? 'bg-white shadow-sm text-blue-600' : 'text-slate-500 hover:text-slate-700'}`}><PenTool className="w-4 h-4" /> Metadata</button>
            <button onClick={() => setActiveMenu('trending')} className={`px-4 md:px-6 py-2.5 rounded-lg text-sm font-bold flex items-center gap-2 transition-all ${activeMenu === 'trending' ? 'bg-white shadow-sm text-orange-600' : 'text-slate-500 hover:text-slate-700'}`}><TrendingUp className="w-4 h-4" /> Trend Pasar</button>
          </div>
        </div>

        {error && (
          <div className="p-3 bg-red-50 text-red-700 rounded-lg flex items-start gap-2 text-sm border border-red-100 max-w-3xl mx-auto">
            <AlertCircle className="w-5 h-5 shrink-0" /> <p>{error}</p>
          </div>
        )}

        {/* MENU: TRENDING */}
        {activeMenu === 'trending' && (
          <div className="max-w-3xl mx-auto bg-white rounded-2xl p-6 shadow-sm border border-slate-200">
             <div className="flex flex-col md:flex-row items-center justify-between mb-6 gap-4">
                <h2 className="text-xl font-bold flex items-center gap-2 w-full"><Flame className="w-6 h-6 text-orange-500" /> Riset Pasar</h2>
                <button onClick={fetchTrendingIdeas} disabled={isLoadingTrending} className="w-full md:w-auto py-2 px-4 bg-orange-500 hover:bg-orange-600 text-white rounded-lg font-bold flex items-center justify-center gap-2 disabled:opacity-70 text-sm whitespace-nowrap">
                  {isLoadingTrending ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Cari Trend Saat Ini'}
                </button>
             </div>
             <div className="bg-slate-50 rounded-xl p-5 border border-slate-200 min-h-[200px]">
                {isLoadingTrending ? (
                  <div className="flex flex-col items-center justify-center text-orange-500 h-full py-10"><Loader2 className="w-10 h-10 animate-spin mb-3" /><span className="font-medium animate-pulse text-slate-600">Menganalisa pasar...</span></div>
                ) : trendingIdeas ? ( <div className="prose prose-sm max-w-none text-slate-700 whitespace-pre-wrap">{trendingIdeas}</div>
                ) : ( <div className="flex flex-col items-center justify-center text-slate-400 h-full py-10"><TrendingUp className="w-12 h-12 mb-3 opacity-20" /><p className="text-center">Klik tombol untuk melihat ide.</p></div> )}
             </div>
          </div>
        )}

        {/* MENU: AI GENERATOR */}
        {activeMenu === 'generate' && (
          <div className="max-w-3xl mx-auto bg-white rounded-2xl p-6 shadow-sm border border-slate-200">
            <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
              <Wand2 className="w-5 h-5 text-blue-600" /> Buat Media Baru
            </h2>
            
            <div className="flex flex-col md:flex-row gap-3 mb-4">
              <select value={generateType} onChange={(e) => setGenerateType(e.target.value)} className="p-3 rounded-xl border border-slate-200 bg-blue-50 text-blue-700 font-bold outline-none focus:ring-2 focus:ring-blue-500">
                <option value="photo">📸 Foto Realistis</option>
                <option value="vector">🎨 Vektor / Ilustrasi</option>
                <option value="video">🎬 Video MP4 (Cinematic Zoom)</option>
              </select>

              <select value={aspectRatio} onChange={(e) => setAspectRatio(e.target.value)} className="p-3 rounded-xl border border-slate-200 bg-slate-50 font-medium outline-none focus:ring-2 focus:ring-blue-500">
                <option value="16:9">16:9 (Landscape)</option>
                <option value="9:16">9:16 (Portrait)</option>
                <option value="1:1">1:1 (Square)</option>
              </select>
            </div>

            <div className="flex flex-col md:flex-row gap-3 mb-6">
              <input type="text" value={imagePrompt} onChange={(e) => setImagePrompt(e.target.value)} placeholder="Ketik ide gambar/video..." className="flex-1 p-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500 outline-none"/>
              <button onClick={handleGenerate} disabled={isGeneratingImage} className="py-3 px-6 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold flex items-center justify-center gap-2 disabled:opacity-50">
                {isGeneratingImage ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Generate'}
              </button>
            </div>

            {isGeneratingImage && !generatedMediaUrl && (
              <div className="w-full h-64 bg-slate-100 rounded-xl flex flex-col items-center justify-center text-blue-500 p-6 text-center">
                <Loader2 className="w-8 h-8 animate-spin mb-4" />
                <span className="text-sm font-medium animate-pulse">{generateType === 'video' ? videoStatus : 'Sedang memproses gambar...'}</span>
              </div>
            )}

            {generatedMediaUrl && !isGeneratingImage && (
              <div className="space-y-4">
                <div className="relative rounded-xl overflow-hidden border border-slate-200 bg-slate-50 p-2 flex justify-center">
                  {resultMediaType === 'video' ? (
                    <video src={generatedMediaUrl} controls autoPlay loop className="w-full h-auto max-h-[500px] rounded-lg bg-black"></video>
                  ) : (
                    <img src={generatedMediaUrl} alt="Generated AI" className="w-full h-auto max-h-[500px] object-contain rounded-lg" />
                  )}
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 bg-slate-100 p-3 rounded-xl border border-slate-200">
                  <div className="flex gap-2">
                    {resultMediaType !== 'video' && (
                      <select value={downloadRes} onChange={(e) => setDownloadRes(Number(e.target.value))} className="p-3 rounded-lg border border-slate-300 bg-white font-bold text-slate-700 outline-none cursor-pointer text-sm">
                        <option value={1080}>1080p</option> <option value={2048}>2K</option> <option value={4096}>4K</option> <option value={8192}>8K</option>
                      </select>
                    )}
                    <button onClick={handleDownloadImage} disabled={isDownloading} className="flex-1 py-3 bg-slate-800 hover:bg-slate-900 text-white rounded-lg font-bold flex items-center justify-center gap-2 disabled:opacity-70 shadow-sm w-full">
                      {isDownloading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Download className="w-5 h-5" />}
                      Download {resultMediaType === 'video' ? 'MP4' : ''}
                    </button>
                  </div>

                  {resultMediaType !== 'video' && (
                    <button onClick={useGeneratedImageForMetadata} className="w-full py-3 bg-green-600 hover:bg-green-700 text-white rounded-lg font-bold flex items-center justify-center gap-2 shadow-sm">
                      Buat Metadata <ArrowRight className="w-5 h-5" />
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* MENU: METADATA GENERATOR */}
        {activeMenu === 'metadata' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Form Upload */}
            <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200">
              <h2 className="text-xl font-bold mb-4">Input Media</h2>
              <div className="mb-6">
                <label className="block text-sm font-semibold mb-2">Unggah File Media</label>
                {!previewUrl ? (
                  <div onClick={() => fileInputRef.current?.click()} className="border-2 border-dashed border-slate-300 rounded-xl p-8 text-center cursor-pointer hover:bg-blue-50"><Upload className="w-8 h-8 text-slate-400 mx-auto mb-2" /><p className="text-sm font-medium">Klik untuk unggah</p></div>
                ) : (
                  <div className="relative border rounded-xl overflow-hidden bg-slate-50 group">
                    <img src={previewUrl} alt="Preview" className="w-full h-48 object-contain" />
                    <button onClick={clearFile} className="absolute top-2 right-2 p-2 bg-red-500 text-white rounded-lg opacity-0 group-hover:opacity-100 transition-opacity"><Trash2 className="w-4 h-4" /></button>
                  </div>
                )}
                <input type="file" ref={fileInputRef} onChange={handleFileChange} accept="image/*" className="hidden" />
              </div>
              <div className="mb-6">
                <label className="block text-sm font-semibold mb-2">Deskripsi Tambahan</label>
                <textarea value={description} onChange={(e) => setDescription(e.target.value)} className="w-full p-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500 outline-none resize-none h-20 text-sm" />
              </div>
              <button onClick={generateMetadata} disabled={loadingMetadata} className="w-full py-3 px-4 bg-blue-600 text-white rounded-xl font-bold flex items-center justify-center gap-2 disabled:opacity-70">
                {loadingMetadata ? <><Loader2 className="w-5 h-5 animate-spin" /> Memproses...</> : <><Sparkles className="w-5 h-5" /> Generate Metadata</>}
              </button>
            </div>

            {/* Hasil Metadata */}
            <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200">
              <h2 className="text-xl font-bold mb-6">Hasil Metadata</h2>
              {!metadata && !loadingMetadata && ( <div className="flex flex-col items-center justify-center text-slate-400 h-64"><p className="text-sm">Hasil akan muncul di sini.</p></div> )}
              {loadingMetadata && ( <div className="flex flex-col items-center justify-center text-blue-500 h-64"><Loader2 className="w-8 h-8 animate-spin mb-4" /><p className="text-sm">Menyusun kata kunci...</p></div> )}
              {metadata && !loadingMetadata && (
                <div className="space-y-6">
                  <div>
                    <label className="text-sm font-bold block mb-1">Judul (Title)</label>
                    <div className="relative group">
                      <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm pr-12">{metadata.title}</div>
                      <button onClick={() => copyToClipboard(metadata.title, 'title')} className="absolute right-2 top-1.5 p-1.5 text-slate-400 hover:text-blue-600 rounded-lg">{copiedField === 'title' ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}</button>
                    </div>
                  </div>
                  <div>
                    <label className="text-sm font-bold block mb-1">Kata Kunci (Keywords) - {metadata.keywords.split(',').length}</label>
                    <div className="relative group">
                      <textarea readOnly value={metadata.keywords} className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm pr-12 outline-none resize-none h-32" />
                      <button onClick={() => copyToClipboard(metadata.keywords, 'keywords')} className="absolute right-2 top-2 p-1.5 text-slate-400 hover:text-blue-600 bg-white rounded-lg shadow-sm">{copiedField === 'keywords' ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}</button>
                    </div>
                  </div>
                  <div>
                    <label className="text-sm font-bold block mb-1">Kategori</label>
                    <div className="flex items-center gap-2">
                      <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm flex-1">{metadata.category}</div>
                      <button onClick={() => copyToClipboard(metadata.category, 'category')} className="p-3 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl border border-slate-200">{copiedField === 'category' ? <Check className="w-5 h-5 text-green-500" /> : <Copy className="w-5 h-5" />}</button>
                    </div>
                  </div>
                  
                  <hr className="border-slate-200" />
                  
                  <button 
                    onClick={downloadMetadataTXT}
                    className="w-full py-3 px-4 bg-slate-800 hover:bg-slate-900 text-white rounded-xl font-bold flex items-center justify-center gap-2 transition-all shadow-sm"
                  >
                    <FileText className="w-5 h-5" />
                    Download Metadata (.txt)
                  </button>
                  
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
