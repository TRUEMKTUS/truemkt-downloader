import { createClient } from '@supabase/supabase-js';
import JSZip from 'jszip';

const SUPABASE_URL = 'https://tsvnuathjyegjumudvbd.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRzdm51YXRoanllZ2p1bXVkdmJkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTIyODY5NTMsImV4cCI6MjA2Nzg2Mjk1M30.tDa-beY7SOKZ2d7EDWEi8H_5b4pjKrgtqJlrj9Sv98Y';
const BUCKET = 'VIDEO-BUCKET';

const supabaseClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const { folderPath } = req.body;

    if (!folderPath) {
        return res.status(400).json({ error: 'folderPath is required' });
    }

    try {
        const { data: items, error } = await supabaseClient.storage
            .from(BUCKET)
            .list(folderPath, { limit: 1000 });

        if (error) {
            throw new Error(`Error listing folder: ${error.message}`);
        }

        const mainFolders = items.filter(item => 
            item.name && !item.name.includes('.')
        );

        if (mainFolders.length === 0) {
            return res.status(404).json({ error: 'No folders found' });
        }

        const zip = new JSZip();

        for (const folder of mainFolders) {
            const { data: subItems } = await supabaseClient.storage
                .from(BUCKET)
                .list(`${folderPath}/${folder.name}`, { limit: 1000 });

            if (subItems && subItems.length > 0) {
                for (const subFile of subItems) {
                    if (!subFile.name || !subFile.name.includes('.')) continue;

                    const filePath = `${folderPath}/${folder.name}/${subFile.name}`;
                    const { data: urlData } = supabaseClient.storage
                        .from(BUCKET)
                        .getPublicUrl(filePath);

                    const response = await fetch(urlData.publicUrl);
                    const buffer = await response.arrayBuffer();

                    const folderZip = zip.folder(folder.name);
                    folderZip.file(subFile.name, buffer);
                }
            }
        }

        const zipBuffer = await zip.generateAsync({ type: 'arraybuffer' });

        res.setHeader('Content-Type', 'application/zip');
        res.setHeader('Content-Disposition', `attachment; filename="${folderPath}.zip"`);
        res.send(Buffer.from(zipBuffer));

    } catch (error) {
        console.error('Error:', error);
        res.status(500).json({ error: error.message });
    }
}
