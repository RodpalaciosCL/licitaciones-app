// netlify/functions/uploadToDrive.js

const { google } = require('googleapis');
const { v4: uuidv4 } = require('uuid');

exports.handler = async (event) => {
  try {
    // Aceptar solo POST
    if (event.httpMethod !== 'POST') {
      return {
        statusCode: 405,
        body: JSON.stringify({ error: 'Method Not Allowed' })
      };
    }

    // 1. Parsear el body JSON (no multipart)
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

    // 3. Autenticarse con Google Drive
    const auth = new google.auth.GoogleAuth({
      credentials: JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_JSON),
      scopes: ['https://www.googleapis.com/auth/drive']
    });
    const drive = google.drive({ version: 'v3', auth });

    // 4. Subir el archivo a tu carpeta
    const folderId = '1PBLBzG0iVxvCIA0jjWGDTVfoJxJw3LcT'; 
    const uploadResponse = await drive.files.create({
      requestBody: {
        name: filename || `Documento-${uuidv4()}.pdf`,
        mimeType: 'application/pdf',
        parents: [folderId]
      },
      media: {
        mimeType: 'application/pdf',
        body: fileBuffer
      }
    });

    const fileId = uploadResponse.data.id;
    console.log('[uploadToDrive] Subido con éxito. fileId:', fileId);

    // Respuesta
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
        stack: error.stack // <-- Log detallado en la respuesta
      })
    };
  }
};
