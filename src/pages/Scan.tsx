import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import FileUpload from "../components/image-upload";
import { toast } from "sonner";
import { Scan as ScanIcon, Sparkles, TrendingUp, Award } from "lucide-react";
import { supabase } from "../lib/supabase";

interface ScanResult {
  data: Record<string, string> | null;
  error: string | null;
}

export default function Scan() {
  const [file, setFile] = useState<File | null>(null);

  // 👇 Reset mutations + state
  const handleReset = () => {
    setFile(null);
    scanMutation.reset();
  };
  /**
   * 1️⃣ SCAN MUTATION
   */
  const scanMutation = useMutation({
    mutationKey: ["scanImage"],
    mutationFn: async (file: File): Promise<ScanResult> => {
      toast.loading("Analyzing image...");

      const formData = new FormData();
      formData.append("image", file);

      const res = await fetch("http://localhost:3000/scan", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) throw new Error("Failed to scan");
      const data = (await res.json()) as ScanResult;
      if (data.error) throw new Error("Scan returned an error");
      return data;
    },
    onSuccess: (_data, file) => {
      toast.dismiss();
      toast.success("Scan complete!");
      uploadMutation.mutate(file); // chain next step
    },
    onError: (err: Error) => {
      toast.dismiss();
      toast.error("Scan failed", { description: err.message });
    },
  });

  /**
   * 2️⃣ UPLOAD TO STORAGE MUTATION
   */
  const uploadMutation = useMutation({
    mutationFn: async (file: File): Promise<string> => {
      toast.loading("Uploading image...");
      if (!file) throw new Error("No file to upload");

      const fileName = `images/${Date.now()}-${Math.random().toString(36).substring(2)}.${file.name}`;
      const { error } = await supabase.storage
        .from("cnb")
        .upload(fileName, file, { cacheControl: "3600", upsert: false });

      if (error) throw new Error(error.message);

      const { data: publicUrlData } = supabase.storage
        .from("cnb")
        .getPublicUrl(fileName);

      if (!publicUrlData.publicUrl) throw new Error("Could not get public URL of the uploaded image");
      return publicUrlData.publicUrl;
    },
    onSuccess: (publicUrl) => {
      toast.dismiss();
      toast.success("Image uploaded!");
      saveDataMutation.mutate(publicUrl); // chain next step
    },
    onError: (err: Error) => {
      toast.dismiss();
      toast.error("Upload failed", { description: err.message });
    },
  });

  /**
   * 3️⃣ SAVE SCAN DATA TO SUPABASE DB
   */
  const saveDataMutation = useMutation({
    mutationFn: async (imageUrl: string) => {
      toast.loading("Saving scan data...");

      if (!scanMutation.data?.data) throw new Error("No scan results to save");

      // 1️⃣ Insert scan into cattle_scans
      const { data: scanData, error: scanError } = await supabase
        .from("cattle_scans")
        .insert([
          {
            image_url: imageUrl,
            image_metadata: { raw: scanMutation.data.data }, // optional metadata
            // scanned_by_user_id: user?.id ?? null // if you have auth
          },
        ])
        .select("id") // get back the new scan id
        .single();

      if (scanError) throw new Error(scanError.message);

      // 2️⃣ Prepare predictions
      const predictions = Object.entries(scanMutation.data.data).map(
        ([breedId, percentage]) => ({
          scan_id: scanData.id,
          breed_id: breedId, // ⚠️ make sure your prediction keys match `breeds.id`
          percentage: Math.round(Number(percentage)),
        })
      );

      // 3️⃣ Insert predictions
      const { error: predictionsError } = await supabase
        .from("predicted_breeds")
        .insert(predictions);

      if (predictionsError) throw new Error(predictionsError.message);
    },
    onSuccess: () => {
      toast.dismiss();
      toast.success("Scan data saved successfully!");
    },
    onError: (err: Error) => {
      toast.dismiss();
      toast.error("Save failed", { description: err.message });
    },
  });


  /**
   * SCAN BUTTON HANDLER
   */
  const handleScan = () => {
    if (!file) {
      toast.warning("Image required", {
        description: "Please capture or upload an image first",
      });
      return;
    }
    scanMutation.mutate(file);
  };

  // Top prediction helper
  const getTopPrediction = () => {
    if (!scanMutation.data?.data) return null;
    const entries = Object.entries(scanMutation.data.data);
    const sortedEntries = entries.sort((a, b) => parseFloat(b[1]) - parseFloat(a[1]));
    return sortedEntries[0];
  };

  const topPrediction = getTopPrediction();
  const confidenceScore = topPrediction ? parseFloat(topPrediction[1]) : 0;

  return (
    <div className="min-h-screen">
      {/* Header */}
      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 text-center">
        <div className="flex justify-center mb-6">
          <div className="p-3 bg-white/10 rounded-2xl backdrop-blur-sm">
            <ScanIcon className="w-12 h-12" />
          </div>
        </div>
        <h1 className="text-4xl md:text-5xl font-bold mb-4">AI Cattle Scanner</h1>
        <p className="text-xl max-w-2xl mx-auto">
          Advanced breed identification and analysis powered by machine learning
        </p>
      </div>

      {/* Main */}
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="space-y-8">
          {/* Upload Section */}
          <div className="text-center mb-8">
            <h2 className="text-2xl font-semibold text-gray-800 mb-2">
              Upload Your Cattle Image
            </h2>
            <p className="text-gray-600">
              Take a clear photo or upload an existing image for instant breed analysis
            </p>
          </div>

          <FileUpload onFileSelect={setFile} onReset={handleReset} />

          {/* Scan Button */}
          {file && (
            <div className="text-center">
              <button
                onClick={handleScan}
                disabled={scanMutation.isPending || uploadMutation.isPending || saveDataMutation.isPending}
                className="inline-flex items-center gap-3 px-8 py-4 bg-gradient-to-r from-green-50 to-green-300 text-gray-800 hover:cursor-pointer font-semibold rounded-xl shadow-lg transition-all duration-200"
              >
                {(scanMutation.isPending || uploadMutation.isPending || saveDataMutation.isPending) ? (
                  <>
                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                    Processing...
                  </>
                ) : (
                  <>
                    <Sparkles className="w-5 h-5" />
                    Analyze Cattle
                  </>
                )}
              </button>
            </div>
          )}

          {/* Results */}
          {file && scanMutation.isSuccess && scanMutation.data?.data && (
            <div className="mt-12">
              <div className="bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden">
                <div className="grid grid-cols-1 lg:grid-cols-2">
                  {/* Left: Image Preview */}
                  <div className="relative bg-gray-50 flex items-center justify-center p-6">
                    <img
                      src={URL.createObjectURL(file)}
                      alt="Cattle Preview"
                      className="w-full max-h-[500px] object-contain rounded-xl border border-gray-200 shadow-md"
                    />
                  </div>

                  {/* Right: Results */}
                  <div className="flex flex-col">
                    {/* Results Header */}
                    <div className="bg-gradient-to-r from-green-500 to-green-600 px-6 py-4">
                      <div className="flex items-center gap-3">
                        <Award className="w-6 h-6 text-white" />
                        <h3 className="text-xl font-semibold text-white">
                          Analysis Results
                        </h3>
                      </div>
                    </div>

                    {/* Scrollable content if too long */}
                    <div className="p-6 overflow-y-auto max-h-[500px]">
                      {/* Top Prediction Highlight */}
                      {topPrediction && (
                        <div className="bg-gradient-to-r from-green-50 to-green-100 px-6 py-6 border border-green-200 rounded-xl mb-6 shadow-sm">
                          <div className="text-center">
                            <h4 className="text-2xl font-bold text-gray-800 mb-2">
                              {topPrediction[0]}
                            </h4>
                            <div className="flex items-center justify-center gap-2 mb-4">
                              <TrendingUp className="w-5 h-5 text-green-500" />
                              <span className="text-lg font-semibold text-green-600">
                                {confidenceScore}% Confidence
                              </span>
                            </div>

                            {/* Confidence Bar */}
                            <div className="w-full max-w-sm mx-auto bg-gray-200 rounded-full h-3">
                              <div
                                className="bg-gradient-to-r from-green-500 to-green-300 h-3 rounded-full transition-all duration-1000 ease-out"
                                style={{ width: `${confidenceScore}%` }}
                              ></div>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* All Predictions */}
                      <div>
                        <h4 className="text-lg font-semibold text-gray-800 mb-4">
                          Detailed Analysis
                        </h4>
                        <div className="space-y-3">
                          {Object.entries(scanMutation.data.data)
                            .sort((a, b) => parseFloat(b[1]) - parseFloat(a[1]))
                            .map(([breed, probability], index) => {
                              const percentage = probability;
                              const isTop = index === 0;

                              return (
                                <div
                                  key={breed}
                                  className={`flex items-center justify-between p-4 rounded-xl transition-all duration-200 ${isTop
                                    ? "bg-gradient-to-r from-green-50 to-green-100 border-2 border-green-200"
                                    : "bg-gray-50 hover:bg-gray-100"
                                    }`}
                                >
                                  <div className="flex items-center gap-3">
                                    {isTop && (
                                      <Award className="w-5 h-5 text-green-500" />
                                    )}
                                    <span
                                      className={`font-medium ${isTop ? "text-green-800" : "text-gray-700"
                                        }`}
                                    >
                                      {breed}
                                    </span>
                                  </div>

                                  <div className="flex items-center gap-3">
                                    <div className="w-24 bg-gray-200 rounded-full h-2">
                                      <div
                                        className={`h-2 rounded-full transition-all duration-1000 ease-out ${isTop
                                          ? "bg-gradient-to-r from-green-500 to-green-600"
                                          : "bg-gradient-to-r from-green-300 to-green-400"
                                          }`}
                                        style={{ width: `${percentage}%` }}
                                      ></div>
                                    </div>
                                    <span
                                      className={`text-sm font-semibold min-w-[3rem] text-right ${isTop ? "text-green-700" : "text-green-500"
                                        }`}
                                    >
                                      {percentage}%
                                    </span>
                                  </div>
                                </div>
                              );
                            })}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}