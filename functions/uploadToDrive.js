// netlify/functions/uploadToDrive.js
// Esta función recibe un PDF en base64 (desde el frontend) y lo sube a Google Drive.
// Luego, devuelve el fileId del archivo subido.

const { google } = require('googleapis');
const { v4: uuidv4 } = require('uuid');

exports.handler = async (event) => {
  try {
    // Solo aceptamos POST
    if (event.httpMethod !== 'POST') {
      return {
        statusCode: 405,
        body: JSON.stringify({ error: 'Method Not Allowed' })
      };
    }

    // 1. Parsear el body como JSON
    const body = JSON.parse(event.body || '{}');
    const { filename, fileContent } = body;

    // Logs para depurar (aparecerán en los logs de Netlify, cuando estén disponibles)
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

    // 4. Subir el archivo a Drive
    //    (Puedes agregar 'parents: ["TU_FOLDER_ID"]' si quieres subirlo a una carpeta específica)
    const uploadResponse = await drive.files.create({
      requestBody: {
        name: filename || `Documento-${uuidv4()}.pdf`,
        mimeType: 'application/pdf',
        // parents: ["TU_FOLDER_ID"]
      },
      media: {
        mimeType: 'application/pdf',
        body: fileBuffer
      }
    });

    const fileId = uploadResponse.data.id;
    console.log('Archivo subido con éxito. fileId:', fileId);

    // Opcional: crear un "viewLink" si quieres devolver un enlace de Drive (hay que setear permisos)
    // const permission = await drive.permissions.create({
    //   fileId,
    //   requestBody: {
    //     role: 'reader',
    //     type: 'anyone'
    //   }
    // });
    // const viewLink = `https://drive.google.com/file/d/${fileId}/view?usp=sharing`;

    // 5. Responder con el fileId (y opcionalmente viewLink)
    return {
      statusCode: 200,
      body: JSON.stringify({
        success: true,
        fileId
        // , viewLink
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
