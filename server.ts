import express from 'express';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { createServer as createViteServer } from 'vite';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Middleware to parse large JSON payloads (for base64 image uploads)
  app.use(express.json({ limit: '10mb' }));

  // API Route for file upload
  app.post('/api/upload-logo', async (req, res) => {
    try {
      const { filename, base64Data } = req.body;
      if (!filename || !base64Data) {
        return res.status(400).json({ error: 'Filename and base64Data are required' });
      }

      // Check if file is image (e.g. png, jpg, jpeg, svg, gif)
      const ext = path.extname(filename).toLowerCase();
      const allowedExtensions = ['.png', '.jpg', '.jpeg', '.gif', '.svg', '.webp'];
      if (!allowedExtensions.includes(ext)) {
        return res.status(400).json({ error: 'Only image files (.png, .jpg, .jpeg, .gif, .svg, .webp) are allowed' });
      }

      // Sanitize filename to avoid directory traversal
      const safeFilename = path.basename(filename).replace(/[^a-zA-Z0-9.\-_]/g, '_');
      
      // Extract the raw base64 data
      const cleanBase64 = base64Data.replace(/^data:image\/\w+;base64,/, '');
      const buffer = Buffer.from(cleanBase64, 'base64');

      // Ensure public directory exists
      const publicDir = path.join(process.cwd(), 'public');
      if (!fs.existsSync(publicDir)) {
        fs.mkdirSync(publicDir, { recursive: true });
      }

      const filePath = path.join(publicDir, safeFilename);
      await fs.promises.writeFile(filePath, buffer);

      // Return the public URL for the file
      const publicUrl = `/${safeFilename}`;
      res.json({ success: true, url: publicUrl, filename: safeFilename });
    } catch (error: any) {
      console.error('Upload error:', error);
      res.status(500).json({ error: 'Failed to upload file: ' + error.message });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
