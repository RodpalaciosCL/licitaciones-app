// netlify/functions/processDoc.js
// Descarga el PDF desde Drive y luego llama a pdf-parse.
// Inyecta logs adicionales para verificar la longitud del buffer.

const { google } = require('googleapis');
const fetch = require('node-fetch');
const pdfParse = require('pdf-parse');

exports.handler = async (event) => {
  try {
    // Solo POST
    if (event.httpMethod !== 'POST') {
      return {
        statusCode: 405,
        body: JSON.stringify({ error: 'Method not allowed' })
      };
    }

    // 1. Leer el fileId
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

    // 2. Autenticación con Google Drive
    const auth = new google.auth.GoogleAuth({
      credentials: JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_JSON),
      scopes: ['https://www.googleapis.com/auth/drive']
    });
    const drive = google.drive({ version: 'v3', auth });

    // 3. Descargar el PDF
    console.log('[processDoc] Descargando PDF de Drive...');
    const response = await drive.files.get(
      { fileId, alt: 'media' },
      { responseType: 'arraybuffer' }
    );

    // 4. Convertir a Buffer y loguear su tamaño
    const pdfBuffer = Buffer.from(response.data);
    console.log('[processDoc] pdfBuffer length:', pdfBuffer.length);

    if (pdfBuffer.length < 200) {
      // Este es un chequeo arbitrario, podrías usar < 1000, etc.
      console.log('[processDoc] WARNING: Buffer muy pequeño; posiblemente PDF vacío o sin permisos.');
    }

    // 5. Procesar con pdf-parse
    console.log('[processDoc] Parseando PDF...');
    const pdfData = await pdfParse(pdfBuffer);
    const text = pdfData.text;
    console.log('[processDoc] Extrajo texto (primeros 200 chars):', text.slice(0, 200));

    // 6. Llamar a OpenAI
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

    console.log('[processDoc] Respuesta GPT con éxito.');

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
        error: error.message,
        stack: error.stack
      })
    };
  }
};
