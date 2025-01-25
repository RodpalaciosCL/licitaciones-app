// netlify/functions/uploadToDrive.js

const { google } = require('googleapis');
const { v4: uuidv4 } = require('uuid');
const stream = require('stream');

exports.handler = async (event) => {
  try {
    // Aceptar solo POST
    if (event.httpMethod !== 'POST') {
      return {
        statusCode: 405,
        body: JSON.stringify({ error: 'Method Not Allowed' })
      };
    }

    // 1. Parsear el body JSON
    const body = JSON.parse(event.body || '{}');
    const { filename, fileContent } = body;

    console.log('[uploadToDrive] Recibido:', { filename });

    if (!fileContent) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'No fileContent (base64) provided' })
      };
    }

    // 2. Convertir base64 a Buffer
    const fileBuffer = Buffer.from(fileContent, 'base64');

    // 3. Crear un Stream a partir del Buffer
    //    Esto evita el error "part.body.pipe is not a function"
    const bufferStream = new stream.PassThrough();
    bufferStream.end(fileBuffer);

    // 4. Autenticarse con Google Drive
    const auth = new google.auth.GoogleAuth({
      credentials: JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_JSON),
      scopes: ['https://www.googleapis.com/auth/drive']
    });
    const drive = google.drive({ version: 'v3', auth });

    // 5. Subir el archivo a tu carpeta
    const folderId = '1PBLBzG0iVxvCIA0jjWGDTVfoJxJw3LcT'; // Ajusta si tu carpeta difiere
    const uploadResponse = await drive.files.create({
      requestBody: {
        name: filename || `Documento-${uuidv4()}.pdf`,
        mimeType: 'application/pdf',
        parents: [folderId]
      },
      media: {
        mimeType: 'application/pdf',
        body: bufferStream // <-- Pasamos el stream
      }
    });

    const fileId = uploadResponse.data.id;
    console.log('[uploadToDrive] Subido con éxito. fileId:', fileId);

    // 6. Respuesta
    return {
      statusCode: 200,
      body: JSON.stringify({
        success: true,
        fileId
      })
    };

  } catch (error) {
    console.error('Error en uploadToDrive:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({
        success: false,
        error: error.message,
        stack: error.stack // inyectamos el stacktrace
      })
    };
  }
};
