// netlify/functions/processDoc.js
// Descarga el PDF de Drive, extrae texto con pdf-parse, llama a GPT
// Devuelve en la respuesta JSON: bufferLength, textLength, y más.

const { google } = require('googleapis');
const fetch = require('node-fetch');
const pdfParse = require('pdf-parse');

exports.handler = async (event) => {
  try {
    // Aceptar solo POST
    if (event.httpMethod !== 'POST') {
      return {
        statusCode: 405,
        body: JSON.stringify({
          success: false,
          error: 'Method Not Allowed. Use POST.'
        })
      };
    }

    // 1. Leer fileId
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

    // 2. Autenticación con Google
    const auth = new google.auth.GoogleAuth({
      credentials: JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_JSON),
      scopes: ['https://www.googleapis.com/auth/drive']
    });
    const drive = google.drive({ version: 'v3', auth });

    // 3. Descargar el PDF desde Drive
    const response = await drive.files.get(
      { fileId, alt: 'media' },
      { responseType: 'arraybuffer' }
    );

    // 4. Crear el buffer
    const pdfBuffer = Buffer.from(response.data);

    // 5. Loguear la longitud del PDF
    const bufferLength = pdfBuffer.length;

    // 6. Parsear con pdf-parse
    const pdfData = await pdfParse(pdfBuffer);
    const text = pdfData.text;
    const textLength = text.length;

    // 7. Llamar a OpenAI
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

    // 8. Devolver toda la info en el body JSON
    return {
      statusCode: 200,
      body: JSON.stringify({
        success: true,
        bufferLength,  // Tamaño del PDF en bytes
        textLength,    // Tamaño del texto extraído
        rawGPT: gptText
      })
    };

  } catch (error) {
    // Si algo falla, devolvemos el error y stack
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
