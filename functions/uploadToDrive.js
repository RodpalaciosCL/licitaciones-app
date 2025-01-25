// netlify/functions/uploadToDrive.js
// Sube un PDF en base64 a Google Drive, dentro de tu carpeta ID.
// Devuelve el fileId sin usar busboy.

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

    // Logs mínimos
    console.log('[uploadToDrive] Recibido:');
    console.log('  filename:', filename);
    console.log('  fileContent length:', fileContent ? fileContent.length : 0);

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

    // 4. Subir el archivo a tu carpeta (asegúrate de que la carpeta esté compartida con la Service Account)
    const folderId = '1PBLBzG0iVxvCIA0jjWGDTVfoJxJw3LcT'; // Ajusta a tu folder ID real
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

    // 5. fileId
    const fileId = uploadResponse.data.id;
    console.log('[uploadToDrive] Subido con éxito. fileId:', fileId);

    // 6. Respuesta (inyectamos logs)
    return {
      statusCode: 200,
      body: JSON.stringify({
        success: true,
        fileId,
        logs: {
          receivedFilename: filename,
          receivedContentLength: fileContent.length,
          usedFolderId: folderId
        }
      })
    };
  } catch (error) {
    console.error('Error en uploadToDrive:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message })
    };
  }
};
