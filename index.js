const express = require('express');
const axios = require('axios');
require('dotenv').config();

const app = express();
app.use(express.json());

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const REPLICATE_API_KEY = process.env.REPLICATE_API_KEY;

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'API is running' });
});

// Generate caption and image
app.post('/generate-instagram-image', async (req, res) => {
  try {
    const { topic } = req.body;

    if (!topic) {
      return res.status(400).json({ error: 'Topic is required' });
    }

    // Step 1: Generate caption with Gemini
    console.log('Generating caption with Gemini...');
    const captionResponse = await axios.post(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`,
      {
        contents: [
          {
            parts: [
              {
                text: `Generate a professional Instagram caption for a Salesforce/Tech professional about: "${topic}". Include 1-2 emojis and 5-8 hashtags. Keep under 150 characters.`
              }
            ]
          }
        ]
      }
    );

    const caption = captionResponse.data?.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!caption) {
      return res.status(500).json({ error: 'Failed to generate caption' });
    }

    // Step 2: Generate image with Replicate (Stable Diffusion)
    console.log('Generating image with Stable Diffusion...');
    
    const predictionResponse = await axios.post(
      'https://api.replicate.com/v1/predictions',
      {
        version: "db21e45d3f7023abc9e53f5b7752271ac8d10aad6882987e88db8e9b5f2b2296",
        input: {
          prompt: `Professional Instagram image for Salesforce professional: ${caption}. Modern tech-focused design, professional aesthetic, 1080x1350px, high quality.`
        }
      },
      {
        headers: {
          'Authorization': `Token ${REPLICATE_API_KEY}`,
          'Content-Type': 'application/json'
        }
      }
    );

    const predictionId = predictionResponse.data?.id;

    if (!predictionId) {
      return res.status(500).json({ error: 'Failed to start image generation' });
    }

    // Step 3: Poll for image completion
    console.log('Waiting for image generation to complete...');
    let prediction = predictionResponse.data;
    let attempts = 0;
    const maxAttempts = 60; // 60 seconds max wait

    while (prediction.status !== 'succeeded' && attempts < maxAttempts) {
      await new Promise(resolve => setTimeout(resolve, 1000)); // Wait 1 second
      
      const statusResponse = await axios.get(
        `https://api.replicate.com/v1/predictions/${predictionId}`,
        {
          headers: {
            'Authorization': `Token ${REPLICATE_API_KEY}`
          }
        }
      );

      prediction = statusResponse.data;
      attempts++;
    }

    if (prediction.status !== 'succeeded') {
      return res.status(500).json({ 
        error: 'Image generation timeout',
        details: prediction.error || 'Generation took too long'
      });
    }

    const imageUrl = prediction.output?.[0];

    if (!imageUrl) {
      return res.status(500).json({ error: 'Failed to get image URL' });
    }

    // Return success
    res.json({
      success: true,
      imageUrl: imageUrl,
      caption: caption,
      message: 'Image and caption generated successfully'
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
