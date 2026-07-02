import React, { useState, useRef, useEffect } from 'react';
import { 
  Upload, Image as ImageIcon, Video, PenTool, 
  Copy, Check, Loader2, AlertCircle, FileImage, 
  Sparkles, Trash2, Wand2, ArrowRight, Download
} from 'lucide-react';

// PENTING: Masukkan API Key Gemini Anda di antara tanda kutip di bawah ini!
const apiKey = import.meta.env.VITE_GEMINI_API_KEY;

export default function App() {
  const [activeMenu, setActiveMenu] = useState('generate'); 
  
  // State untuk Generate Image
  const [imagePrompt, setImagePrompt] = useState('');
  const [generatedImageUrl, setGeneratedImageUrl] = useState(null);
  const [isGeneratingImage, setIsGeneratingImage] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);

  // State untuk Metadata
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

  useEffect(() => {
    return () => {
      if (previewUrl && !previewUrl.startsWith('http')) {
        URL.revokeObjectURL(previewUrl);
      }
    };
  }, [previewUrl]);

  // --- FUNGSI GENERATE IMAGE ---
  const handleGenerateImage = () => {
    if (!imagePrompt.trim()) {
      setError("Masukkan deskripsi gambar yang ingin dibuat.");
      return;
    }
    setIsGeneratingImage(true);
    setError('');
    setGeneratedImageUrl(null);
    
    // Prompt ditambah instruksi rahasia agar gambarnya detail
    const encodedPrompt = encodeURIComponent(imagePrompt + ", 8k resolution, highly detailed, photorealistic, masterpiece, adobe stock photography");
    const randomSeed = Math.floor(Math.random() * 100000);
    const url = `https://image.pollinations.ai/prompt/${encodedPrompt}?seed=${randomSeed}&width=1024&height=1024&nologo=true`;
    
    const img = new Image();
    img.onload = () => {
      setGeneratedImageUrl(url);
      setIsGeneratingImage(false);
    };
    img.onerror = () => {
      setError("Gagal membuat gambar. Coba kata kunci lain.");
      setIsGeneratingImage(false);
    };
    img.src = url;
  };

  // --- FUNGSI UPSCALE 2K & DOWNLOAD ---
  const handleDownload2K = () => {
    if (!generatedImageUrl) return;
    setIsDownloading(true);

    const img = new Image();
    img.crossOrigin = "Anonymous"; // Syarat agar bisa di-download dari URL luar
    img.onload = () => {
      // Bikin kanvas virtual ukuran 2K (4 Megapixel)
      const canvas = document.createElement('canvas');
      canvas.width = 2048; 
      canvas.height = 2048;
      
      const ctx = canvas.getContext('2d');
      // Setelan agar pembesaran gambar tetap halus (tidak pecah/kotak-kotak)
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      
      // Gambar ulang dari 1024 ke 2048
      ctx.drawImage(img, 0, 0, 2048, 2048);
      
      // Ubah jadi file JPG dan download
      const link = document.createElement('a');
      link.download = `AdobeStock_${Math.floor(Date.now() / 1000)}.jpg`;
      link.href = canvas.toDataURL('image/jpeg', 0.95); // Kualitas 95%
      link.click();
      
      setIsDownloading(false);
    };
    img.onerror = () => {
      setError("Gagal memperbesar gambar. Coba lagi.");
      setIsDownloading(false);
    };
    img.src = generatedImageUrl;
  };

  const useGeneratedImageForMetadata = async () => {
    try {
      setIsGeneratingImage(true);
      const response = await fetch(generatedImageUrl);
      const blob = await response.blob();
      
      const reader = new FileReader();
      reader.onloadend = () => {
        setBase64Data(reader.result.split(',')[1]);
        setMimeType(blob.type);
        setPreviewUrl(generatedImageUrl);
        setMediaType('gambar');
        setDescription(imagePrompt); 
        setActiveMenu('metadata'); 
        setIsGeneratingImage(false);
      };
      reader.readAsDataURL(blob);
    } catch (err) {
      setError("Gagal mentransfer gambar ke generator metadata.");
      setIsGeneratingImage(false);
    }
  };

  // --- FUNGSI METADATA (Gemini AI) ---
  const handleFileChange = (e) => {
    const selectedFile = e.target.files[0];
    if (!selectedFile) return;

    if (selectedFile.size > 5 * 1024 * 1024) {
      setError("Ukuran file maksimal 5MB.");
      return;
    }

    setFile(selectedFile);
    setPreviewUrl(URL.createObjectURL(selectedFile));
    setMimeType(selectedFile.type);
    setError('');

    const reader = new FileReader();
    reader.onloadend = () => {
      setBase64Data(reader.result.split(',')[1]);
    };
    reader.readAsDataURL(selectedFile);
  };

  const clearFile = () => {
    setFile(null);
    setPreviewUrl(null);
    setBase64Data(null);
    setMimeType(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const generateMetadata = async () => {
    if (!base64Data && !description.trim()) {
      setError("Harap unggah file atau masukkan deskripsi.");
      return;
    }

    setLoadingMetadata(true);
    setError('');
    setMetadata(null);

    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;
      
      const prompt = `
        You are an expert Adobe Stock contributor. Generate highly commercial metadata for this ${mediaType}.
        ${description ? `Context: ${description}` : ''}
        
        Requirements:
        1. English language only.
        2. Title: Max 70 characters, highly commercial.
        3. Keywords: Exactly 50 keywords, comma-separated, ordered by relevance.
        4. Category: Choose one from: Animals, Buildings and Architecture, Business, Drinks, Environment, States of Mind, Food, Graphic Resources, Hobbies and Leisure, Industry, Landscapes, Lifestyle, People, Plants and Flowers, Culture and Religion, Science, Social Issues, Sports, Technology, Transport, Travel.
      `;

      const parts = [{ text: prompt }];
      
      if (base64Data) {
        parts.push({
          inlineData: { mimeType: mimeType || "image/jpeg", data: base64Data }
        });
      }

      const payload = {
        contents: [{ role: "user", parts: parts }],
        generationConfig: {
          responseMimeType: "application/json",
          responseSchema: {
            type: "OBJECT",
            properties: {
              title: { type: "STRING" },
              keywords: { type: "ARRAY", items: { type: "STRING" } },
              category: { type: "STRING" }
            },
            required: ["title", "keywords", "category"]
          }
        }
      };

      const result = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const data = await result.json();
      const jsonText = data.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!jsonText) throw new Error("Respons API tidak valid. Pastikan API Key benar.");
      
      const parsedData = JSON.parse(jsonText);
      setMetadata({
        title: parsedData.title,
        keywords: parsedData.keywords.join(', '),
        category: parsedData.category
      });

    } catch (err) {
      setError(err.message || "Gagal membuat metadata. Pastikan API Key benar.");
    } finally {
      setLoadingMetadata(false);
    }
  };

  const copyToClipboard = (text, fieldName) => {
    navigator.clipboard.writeText(text);
    setCopiedField(fieldName);
    setTimeout(() => setCopiedField(null), 2000);
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
            Satu platform untuk men-generate gambar, upscale ke 2K (4MP), dan membuat metadata.
          </p>
        </div>

        <div className="flex justify-center mb-6">
          <div className="bg-slate-200 p-1 rounded-xl flex gap-1">
            <button 
              onClick={() => setActiveMenu('generate')}
              className={`px-6 py-2.5 rounded-lg text-sm font-bold flex items-center gap-2 transition-all ${activeMenu === 'generate' ? 'bg-white shadow-sm text-blue-600' : 'text-slate-500 hover:text-slate-700'}`}
            >
              <Wand2 className="w-4 h-4" /> AI Image Creator
            </button>
            <button 
              onClick={() => setActiveMenu('metadata')}
              className={`px-6 py-2.5 rounded-lg text-sm font-bold flex items-center gap-2 transition-all ${activeMenu === 'metadata' ? 'bg-white shadow-sm text-blue-600' : 'text-slate-500 hover:text-slate-700'}`}
            >
              <PenTool className="w-4 h-4" /> Metadata Generator
            </button>
          </div>
        </div>

        {error && (
          <div className="p-3 bg-red-50 text-red-700 rounded-lg flex items-start gap-2 text-sm border border-red-100 max-w-3xl mx-auto">
            <AlertCircle className="w-5 h-5 shrink-0" />
            <p>{error}</p>
          </div>
        )}

        {/* MENU: AI IMAGE CREATOR */}
        {activeMenu === 'generate' && (
          <div className="max-w-3xl mx-auto bg-white rounded-2xl p-6 shadow-sm border border-slate-200">
            <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
              <Wand2 className="w-5 h-5 text-blue-600" /> Buat Gambar Baru
            </h2>
            <div className="flex gap-3 mb-6">
              <input 
                type="text" 
                value={imagePrompt}
                onChange={(e) => setImagePrompt(e.target.value)}
                placeholder="Ketik ide gambar... (Misal: Modern church architecture)"
                className="flex-1 p-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500 outline-none"
              />
              <button 
                onClick={handleGenerateImage}
                disabled={isGeneratingImage}
                className="py-3 px-6 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold flex items-center gap-2 disabled:opacity-70"
              >
                {isGeneratingImage ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Generate'}
              </button>
            </div>

            {isGeneratingImage && !generatedImageUrl && (
              <div className="w-full h-64 bg-slate-100 rounded-xl flex flex-col items-center justify-center text-blue-500">
                <Loader2 className="w-8 h-8 animate-spin mb-2" />
                <span className="text-sm font-medium animate-pulse">Sedang melukis gambar...</span>
              </div>
            )}

            {generatedImageUrl && !isGeneratingImage && (
              <div className="space-y-4">
                <div className="relative rounded-xl overflow-hidden border border-slate-200 bg-slate-50">
                  <img src={generatedImageUrl} alt="Generated AI" className="w-full h-auto max-h-[500px] object-contain" />
                </div>
                
                {/* DUA TOMBOL BARU */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <button 
                    onClick={handleDownload2K}
                    disabled={isDownloading}
                    className="w-full py-3 bg-slate-800 hover:bg-slate-900 text-white rounded-xl font-bold flex items-center justify-center gap-2 disabled:opacity-70 shadow-sm"
                  >
                    {isDownloading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Download className="w-5 h-5" />}
                    Download 2K (Siap Jual)
                  </button>

                  <button 
                    onClick={useGeneratedImageForMetadata}
                    className="w-full py-3 bg-green-600 hover:bg-green-700 text-white rounded-xl font-bold flex items-center justify-center gap-2 shadow-sm"
                  >
                    Buat Metadata <ArrowRight className="w-5 h-5" />
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* MENU: METADATA GENERATOR */}
        {activeMenu === 'metadata' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200">
              <h2 className="text-xl font-bold mb-4">Input Media</h2>
              
              <div className="mb-6">
                <label className="block text-sm font-semibold mb-2">Unggah File Gambar</label>
                {!previewUrl ? (
                  <div onClick={() => fileInputRef.current?.click()} className="border-2 border-dashed border-slate-300 rounded-xl p-8 text-center cursor-pointer hover:bg-blue-50">
                    <Upload className="w-8 h-8 text-slate-400 mx-auto mb-2" />
                    <p className="text-sm font-medium">Klik untuk unggah</p>
                  </div>
                ) : (
                  <div className="relative border rounded-xl overflow-hidden bg-slate-50 group">
                    <img src={previewUrl} alt="Preview" className="w-full h-48 object-contain" />
                    <button onClick={clearFile} className="absolute top-2 right-2 p-2 bg-red-500 text-white rounded-lg opacity-0 group-hover:opacity-100 transition-opacity">
                      <Trash2 className="w-4 h-4" />
                    </button>
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

            <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200">
              <h2 className="text-xl font-bold mb-6">Hasil Metadata</h2>
              
              {!metadata && !loadingMetadata && (
                <div className="flex flex-col items-center justify-center text-slate-400 h-64">
                  <p className="text-sm">Hasil akan muncul di sini.</p>
                </div>
              )}

              {loadingMetadata && (
                <div className="flex flex-col items-center justify-center text-blue-500 h-64">
                  <Loader2 className="w-8 h-8 animate-spin mb-4" />
                  <p className="text-sm">Menyusun 50 kata kunci...</p>
                </div>
              )}

              {metadata && !loadingMetadata && (
                <div className="space-y-6">
                  <div>
                    <label className="text-sm font-bold block mb-1">Judul (Title)</label>
                    <div className="relative group">
                      <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm pr-12">{metadata.title}</div>
                      <button onClick={() => copyToClipboard(metadata.title, 'title')} className="absolute right-2 top-1.5 p-1.5 text-slate-400 hover:text-blue-600 rounded-lg">
                        {copiedField === 'title' ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="text-sm font-bold block mb-1">Kata Kunci (Keywords) - {metadata.keywords.split(',').length}</label>
                    <div className="relative group">
                      <textarea readOnly value={metadata.keywords} className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm pr-12 outline-none resize-none h-32" />
                      <button onClick={() => copyToClipboard(metadata.keywords, 'keywords')} className="absolute right-2 top-2 p-1.5 text-slate-400 hover:text-blue-600 bg-white rounded-lg shadow-sm">
                        {copiedField === 'keywords' ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="text-sm font-bold block mb-1">Kategori</label>
                    <div className="flex items-center gap-2">
                      <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm flex-1">{metadata.category}</div>
                      <button onClick={() => copyToClipboard(metadata.category, 'category')} className="p-3 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl border border-slate-200">
                        {copiedField === 'category' ? <Check className="w-5 h-5 text-green-500" /> : <Copy className="w-5 h-5" />}
                      </button>
                    </div>
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
