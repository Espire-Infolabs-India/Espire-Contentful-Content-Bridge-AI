import formidable from 'formidable';
import fs from 'fs';
import FormData from 'form-data';

// Disable default body parser
export const config = {
  api: {
    bodyParser: false,
  },
};

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method Not Allowed' });
  }

  const form = formidable({ keepExtensions: true });

  form.parse(req, async (err, fields, files) => {
    if (err) {
      console.error('Form parsing error:', err);
      return res.status(500).json({ message: 'File parsing failed' });
    }

    const uploadedFile = Array.isArray(files.file) ? files.file[0] : files.file;
    if (!uploadedFile || !uploadedFile.filepath || !uploadedFile.originalFilename) {
      return res.status(400).json({ message: 'Missing or invalid file upload' });
    }

    try {
      const formData = new FormData();
      formData.append(
        'asset[upload]',
        fs.createReadStream(uploadedFile.filepath),
        uploadedFile.originalFilename
      );
      formData.append('asset[title]', uploadedFile.originalFilename);
      formData.append('asset[parent_uid]', 'blta42646848b3f92fe'); // adjust this if needed

      const uploadRes = await fetch('https://api.contentstack.io/v3/assets', {
        method: 'POST',
        headers: {
          authorization: process.env.AUTHORIZATION,
          api_key: process.env.API_KEY,
          ...formData.getHeaders(),
        },
        body: formData,
      });

      if (!uploadRes.ok) {
        const errorText = await uploadRes.text();
        console.error('Contentstack upload failed:', errorText);
        return res.status(uploadRes.status).json({ message: errorText });
      }

      const data = await uploadRes.json();
      return res.status(200).json({ assetUid: data.asset.uid });
    } catch (error) {
      console.error('Upload error:', error);
      return res.status(500).json({ message: error.message || 'Upload failed' });
    }
  });
}
