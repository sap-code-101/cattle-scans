import express from 'express';
import multer from 'multer';
import cors from 'cors';

type PredictionResult = { data: Record<string, number>, error: string | null };

async function processImageWithModel(imageBuffer: Buffer): Promise<PredictionResult> {
  await new Promise(resolve => setTimeout(resolve, 1000));
  return { data: { 'Gir': 92, 'Sahiwal': 5, 'Red Sindhi': 3 }, error: null };
}

const app = express();
const port = 3000;

app.use(cors()); // allow frontend requests

const upload = multer({ storage: multer.memoryStorage() });

app.post('/scan', upload.single('image'), async (req, res) => {
  if (!req.file) return res.status(400).json({ data: null, error: 'No image file provided.' });

  try {
    const predictions = await processImageWithModel(req.file.buffer);
    return res.status(200).json(predictions);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ data: null, error: 'Failed to process image.' });
  }
});

app.listen(port, () => console.log(`✅ Server running at http://localhost:${port}`));
