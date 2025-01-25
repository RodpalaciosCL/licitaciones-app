const { google } = require('googleapis');
const { v4: uuidv4 } = require('uuid');
const stream = require('stream');

exports.handler = async (event) => {
  try {
    if (event.httpMethod !== 'POST') {
      return {
        statusCode: 405,
        body: JSON.stringify({ error: 'Method Not Allowed' })
      };
    }

    const body = JSON.parse(event.body || '{}');
    const { filename, fileContent } = body;
    if (!fileContent) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'No fileContent (base64) provided' })
      };
    }

    const fileBuffer = Buffer.from(fileContent, 'base64');
    const bufferStream = new stream.PassThrough();
    bufferStream.end(fileBuffer);

    const auth = new google.auth.GoogleAuth({
      credentials: JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_JSON),
      scopes: ['https://www.googleapis.com/auth/drive']
    });
    const drive = google.drive({ version: 'v3', auth });

    const folderId = '1PBLBzG0iVxvCIA0jjWGDTVfoJxJw3LcT';
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

    const fileId = uploadResponse.data.id;
    return {
      statusCode: 200,
      body: JSON.stringify({ success: true, fileId })
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
