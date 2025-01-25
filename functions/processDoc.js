const { google } = require('googleapis');
const fetch = require('node-fetch');
const pdfParse = require('pdf-parse');

exports.handler = async (event) => {
  try {
    if (event.httpMethod !== 'POST') {
      return {
        statusCode: 405,
        body: JSON.stringify({
          success: false,
          error: 'Method Not Allowed. Use POST.'
        })
      };
    }

    const { fileId } = JSON.parse(event.body || '{}');
    if (!fileId) {
      return {
        statusCode: 400,
        body: JSON.stringify({
          success: false,
          error: 'Falta el fileId en el body'
        })
      };
    }

    const auth = new google.auth.GoogleAuth({
      credentials: JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_JSON),
      scopes: ['https://www.googleapis.com/auth/drive']
    });
    const drive = google.drive({ version: 'v3', auth });

    const response = await drive.files.get(
      { fileId, alt: 'media' },
      { responseType: 'arraybuffer' }
    );

    const pdfBuffer = Buffer.from(response.data);
    const bufferLength = pdfBuffer.length;

    const pdfData = await pdfParse(pdfBuffer);
    const text = pdfData.text;
    const textLength = text.length;

    const prompt = `
      Analiza este texto de licitación y devuélveme:
      - Resumen
      - Aspectos clave
      - Documentación necesaria
      - Fechas y montos importantes
      - Lista de tareas a realizar

      Texto:
      ${text}
    `;
    const gptResponse = await fetch('https://api.openai.com/v1/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`
      },
      body: JSON.stringify({
        model: 'text-davinci-003',
        prompt,
        max_tokens: 800,
        temperature: 0.7
      })
    });

    const gptData = await gptResponse.json();
    if (!gptData.choices || !gptData.choices.length) {
      throw new Error('OpenAI no devolvió texto');
    }
    const gptText = gptData.choices[0].text.trim();

    return {
      statusCode: 200,
      body: JSON.stringify({
        success: true,
        bufferLength,
        textLength,
        rawGPT: gptText
      })
    };
  } catch (error) {
    return {
      statusCode: 500,
      body: JSON.stringify({
        success: false,
        error: error.message,
        stack: error.stack
      })
    };
  }
};
