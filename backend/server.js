const express = require('express');
const cors = require('cors');
const multer = require('multer');
const { google } = require('googleapis');
const fs = require('fs');
const path = require('path');
const OpenAI = require('openai');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json());

const upload = multer({ dest: 'uploads/' });

// Load OpenAI API key from environment variables
const OPENAI_API_KEY = process.env.YOUR_OPENAI_API_KEY;

const openai = new OpenAI({
  apiKey: OPENAI_API_KEY,
});

// Service account credentials
const KEYFILEPATH = path.join(__dirname, 'service-account.json');
const SCOPES = ['https://www.googleapis.com/auth/drive'];

const auth = new google.auth.GoogleAuth({
  keyFile: KEYFILEPATH,
  scopes: SCOPES,
});

const drive = google.drive({
  version: 'v3',
  auth,
});

// Endpoint to upload photo
app.post('/upload', upload.single('photo'), async (req, res) => {
  try {
    const fileMetadata = {
      name: req.file.originalname,
      parents: ['1a_Okh1JdhsCHg8WFtMi3-t5HWP9LNxPy'], // replace with your folder ID
    };
    const media = {
      mimeType: req.file.mimetype,
      body: fs.createReadStream(req.file.path),
    };
    const file = await drive.files.create({
      resource: fileMetadata,
      media: media,
      fields: 'id',
    });
    const fileId = file.data.id;

    // Set file permissions to public
    await drive.permissions.create({
      fileId: fileId,
      requestBody: {
        role: 'reader',
        type: 'anyone',
      },
    });

    const url = `https://drive.google.com/uc?export=view&id=${fileId}`;
    res.status(200).json({ url });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Endpoint to generate funny birthday comment
app.post('/generate-comment', async (req, res) => {
  try {
    const { name } = req.body;
    const gptResponse = await openai.chat.completions.create({
      messages: [{ role: 'user', content: `Write a funny birthday comment for ${name}:` }],
      model: 'gpt-3.5-turbo',
    });
    const comment = gptResponse.choices[0].message.content.trim();
    res.status(200).json({ comment });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Endpoint to list images
app.get('/list-images', async (req, res) => {
  try {
    const folderId = '1a_Okh1JdhsCHg8WFtMi3-t5HWP9LNxPy'; // replace with your folder ID
    const response = await drive.files.list({
      q: `'${folderId}' in parents and mimeType contains 'image/'`,
      fields: 'files(id, name)',
    });
    const files = response.data.files.map(file => ({
      id: file.id,
      name: file.name,
      url: `https://drive.google.com/uc?export=view&id=${file.id}`
    }));
    res.status(200).json({ files });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/',(req,res)=>{
  res.send("<h1>Hello</h1>")
})

app.listen(5000, () => {
  console.log('Server is running on port 5000');
});
