// netlify/functions/uploadToDrive.js
// Sube un PDF en base64 a Google Drive, dentro de la carpeta con ID "1PBLBzG0iVxvCIA0jjWGDTVfoJxJw3LcT".
// Devuelve el fileId y unos logs en la misma respuesta.

const { google } = require('googleapis');
const { v4: uuidv4 } = require('uuid');

exports.handler = async (event) => {
  try {
    // Acepta solo POST
    if (event.httpMethod !== 'POST') {
      return {
        statusCode: 405,
        body: JSON.stringify({ error: 'Method Not Allowed' })
      };
    }

    // 1. Parsear el body como JSON
    const body = JSON.parse(event.body || '{}');
    const { filename, fileContent } = body;

    // Logs mínimos de depuración
    console.log('uploadToDrive recibido:');
    console.log('filename:', filename);
    console.log('fileContent length:', fileContent ? fileContent.length : 0);

    if (!fileContent) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'No fileContent (base64) provided' })
      };
    }

    // 2. Convertir base64 a buffer
    const fileBuffer = Buffer.from(fileContent, 'base64');

    // 3. Autenticarnos con Google Drive
    const auth = new google.auth.GoogleAuth({
      credentials: JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_JSON),
      scopes: ['https://www.googleapis.com/auth/drive']
    });
    const drive = google.drive({ version: 'v3', auth });

    // 4. Subir el archivo a la carpeta con ID "1PBLBzG0iVxvCIA0jjWGDTVfoJxJw3LcT"
    //    Asegúrate de que la cuenta licita-personal@... tenga permisos de Editor en esa carpeta.
    const folderId = '1PBLBzG0iVxvCIA0jjWGDTVfoJxJw3LcT';
    const uploadResponse = await drive.files.create({
      requestBody: {
        name: filename || `Documento-${uuidv4()}.pdf`,
        mimeType: 'application/pdf',
        parents: [folderId]  // <--- Aquí se indica la carpeta
      },
      media: {
        mimeType: 'application/pdf',
        body: fileBuffer
      }
    });

    // 5. Obtener el fileId resultante
    const fileId = uploadResponse.data.id;
    console.log('Archivo subido con éxito. fileId:', fileId);

    // 6. "Inyectar" logs en la respuesta (para verlos directamente en tu frontend)
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
