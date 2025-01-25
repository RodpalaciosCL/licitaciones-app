const { google } = require('googleapis');
const fetch = require('node-fetch');
const pdf = require('pdf-parse');

exports.handler = async (event) => {
  try {
    if (event.httpMethod !== 'POST') {
      return {
        statusCode: 405,
        body: 'Método no permitido, usa POST.'
      };
    }

    const { fileId } = JSON.parse(event.body || '{}');
    if (!fileId) {
      return {
        statusCode: 400,
        body: JSON.stringify({
          success: false,
          error: 'Falta fileId'
        })
      };
    }

    const auth = new google.auth.GoogleAuth({
      credentials: JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_JSON),
      scopes: ['https://www.googleapis.com/auth/drive']
    });

    const drive = google.drive({ version: 'v3', auth });

    // Descargar el archivo desde Drive
    const response = await drive.files.get(
      { fileId, alt: 'media' },
      { responseType: 'arraybuffer' }
    );

    const arrayBuffer = response.data;

    // Procesar el PDF
    const pdfData = await pdf(Buffer.from(arrayBuffer));
    const text = pdfData.text;

    // Llamar a OpenAI
    const prompt = `Analiza este texto de licitación y devuélveme:
    - Resumen
    - Aspectos clave
    - Documentación necesaria
    - Fechas y montos importantes
    - Lista de tareas a realizar
    
    Texto:
    ${text}`;

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
      throw new Error('GPT no devolvió texto');
    }
    const gptText = gptData.choices[0].text.trim();

    return {
      statusCode: 200,
      body: JSON.stringify({
        success: true,
        rawGPT: gptText
      })
    };
  } catch (error) {
    console.error('Error en processDoc:', error.message, error.stack);
    // Devolvemos el error detallado en la respuesta para verlo en el navegador
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
