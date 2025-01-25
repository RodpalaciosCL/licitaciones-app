// netlify/functions/uploadToDrive.js
// Sube un PDF en base64 a Google Drive usando un stream PassThrough.

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

    // 1. Parsear body: { filename, fileContent } en base64
    const body = JSON.parse(event.body || '{}');
    const { filename, fileContent } = body;

    if (!fileContent) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'No fileContent (base64) provided' })
      };
    }

    // 2. Convertir base64 a buffer
    const fileBuffer = Buffer.from(fileContent, 'base64');

    // 3. Crear stream PassThrough
    const bufferStream = new stream.PassThrough();
    bufferStream.end(fileBuffer);

    // 4. Autenticarse con Google
    const auth = new google.auth.GoogleAuth({
      credentials: JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_JSON),
      scopes: ['https://www.googleapis.com/auth/drive']
    });
    const drive = google.drive({ version: 'v3', auth });

    // 5. Subir a tu carpeta
    // Asegúrate de que la carpeta en Drive esté compartida o sea accesible
    const folderId = '1PBLBzG0iVxvCIA0jjWGDTVfoJxJw3LcT'; // Cambia si es otra
    const uploadResponse = await drive.files.create({
      requestBody: {
        name: filename || `Documento-${uuidv4()}.pdf`,
        mimeType: 'application/pdf',
        parents: [folderId]
      },
      media: {
        mimeType: 'application/pdf',
        body: bufferStream
      }
    });

    // 6. fileId que nos da Drive
    const fileId = uploadResponse.data.id;

    // 7. Responder con { success, fileId }
    return {
      statusCode: 200,
      body: JSON.stringify({
        success: true,
        fileId
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
