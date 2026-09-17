const express = require('express');
const axios = require('axios');
require('dotenv').config();

const app = express();
app.use(express.json());

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const IMGBB_API_KEY = process.env.IMGBB_API_KEY;

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'API is running' });
});

// Main endpoint: Generate image and return URL
app.post('/generate-instagram-image', async (req, res) => {
  try {
    const { caption } = req.body;

    if (!caption) {
      return res.status(400).json({ error: 'Caption is required' });
    }

    // Step 1: Generate image with Gemini
    console.log('Generating image with Gemini...');
    const geminiResponse = await axios.post(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`,
      {
        contents: [
          {
            parts: [
              {
                text: `Create a professional, visually appealing Instagram image for a Salesforce/Tech professional. The image should be 1080x1350 pixels, modern design, tech-focused aesthetic with relevant graphics and colors. Caption: "${caption}"`
              }
            ]
          }
        ]
      }
    );

    // Extract image data
    const imageData = geminiResponse.data?.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!imageData) {
      return res.status(500).json({ error: 'Failed to generate image from Gemini' });
    }

    // Step 2: Upload image to imgbb
    console.log('Uploading image to imgbb...');
    const formData = new FormData();
    formData.append('image', imageData);
    formData.append('key', IMGBB_API_KEY);

    const imgbbResponse = await axios.post(
      'https://api.imgbb.com/1/upload',
      formData
    );

    const imageUrl = imgbbResponse.data?.data?.url;

    if (!imageUrl) {
      return res.status(500).json({ error: 'Failed to upload image to imgbb' });
    }

    // Step 3: Return image URL and caption
    res.json({
      success: true,
      imageUrl: imageUrl,
      caption: caption,
      message: 'Image generated and hosted successfully'
    });

  } catch (error) {
    console.error('Error:', error.message);
    res.status(500).json({ 
      error: 'Failed to generate image',
      details: error.message 
    });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
