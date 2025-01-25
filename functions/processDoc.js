// netlify/functions/processDoc.js
// 1) Recibe fileId de un PDF en Google Drive
// 2) Descarga y parsea el texto
// 3) Llama a GPT (OpenAI) para generar un resumen

const { google } = require('googleapis');
const fetch = require('node-fetch');
const pdfParse = require('pdf-parse');

exports.handler = async (event) => {
  try {
    // Solo POST
    if (event.httpMethod !== 'POST') {
      return {
        statusCode: 405,
        body: 'Método no permitido. Usa POST.'
      };
    }

    // Leer "fileId" del body
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

    console.log('[processDoc] Recibido fileId:', fileId);

    // Autenticación con Google
    const auth = new google.auth.GoogleAuth({
      credentials: JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_JSON),
      scopes: ['https://www.googleapis.com/auth/drive']
    });
    const drive = google.drive({ version: 'v3', auth });

    // Descargar el PDF desde Drive
    console.log('[processDoc] Descargando PDF...');
    const response = await drive.files.get(
      { fileId, alt: 'media' },
      { responseType: 'arraybuffer' }
    );

    console.log('[processDoc] Parseando PDF...');
    const pdfBuffer = Buffer.from(response.data);
    const pdfData = await pdfParse(pdfBuffer);
    const text = pdfData.text;

    console.log('[processDoc] Texto extraído:\n', text.slice(0, 200), '...'); // Loggea solo primeros 200 chars

    // Prompt para GPT
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

    // Llamar a OpenAI
    console.log('[processDoc] Enviando a GPT...');
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
    console.log('[processDoc] Respuesta GPT recibida con éxito.');

    return {
      statusCode: 200,
      body: JSON.stringify({
        success: true,
        rawGPT: gptText
      })
    };
  } catch (error) {
    console.error('Error en processDoc:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({
        success: false,
        error: error.message
      })
    };
  }
};
