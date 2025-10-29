/// <reference lib="webworker" />

import { createWorker } from 'tesseract.js';

interface WorkerMessage 
{
    type: 'process-image' | 'resume-text';
    imageData: string;
    pageNumber: number;
    totalPages: number;
    processId: string;
    previousText: string[];
}

let tesseractWorker: Awaited<ReturnType<typeof createWorker>> | null = null;
let allExtractedText: string[] = [];

self.onmessage = async (e: MessageEvent<WorkerMessage>) => 
{
    const { type, imageData, pageNumber, totalPages, processId, previousText } = e.data;

    if (type === 'resume-text') 
    {
        allExtractedText = previousText.slice(); 
        return;
    }

    if (type === 'process-image')
    {
        if (allExtractedText[pageNumber - 1] && allExtractedText[pageNumber - 1].trim() !== '')
        {
            self.postMessage({ type: 'progress', progress: Math.round((allExtractedText.filter(p => p !== '').length / totalPages) * 100),
                currentPage: pageNumber, processId, text: allExtractedText.slice(0, pageNumber)});
            return;
        }

        try 
        {
            if (!tesseractWorker)
            {
                self.postMessage({ type: 'init', totalPages, processId });
                
                tesseractWorker = await createWorker('por', 1, 
                {
                    logger: (m: any) =>
                    {
                        if (m.status === 'recognizing text') 
                        {
                            self.postMessage({ type: 'ocr-progress', progress: Math.round(m.progress * 100), processId });
                        }
                    }
                });
                
                if (!allExtractedText || allExtractedText.length === 0) allExtractedText = Array(totalPages).fill('');
            }

            const byteString = atob(imageData.split(',')[1]);
            const mimeString = imageData.split(',')[0].split(':')[1].split(';')[0];
            const ab = new ArrayBuffer(byteString.length);
            const ia = new Uint8Array(ab);
            for (let i = 0; i < byteString.length; i++) ia[i] = byteString.charCodeAt(i);
            const blob = new Blob([ab], { type: mimeString });

            const { data: { text } } = await tesseractWorker!.recognize(blob);
            allExtractedText[pageNumber - 1] = `\n\n========== PÁGINA ${pageNumber} ==========\n\n${text}`;

            const progress = totalPages > 0 ? Math.round((allExtractedText.filter(p => p !== '').length / totalPages) * 100) : 100;

            self.postMessage({ type: 'progress', progress, currentPage: pageNumber, processId, text: allExtractedText.slice(0, pageNumber) });

            if (pageNumber === totalPages) 
            {
                await tesseractWorker.terminate().catch(() => {});
                tesseractWorker = null;

                self.postMessage({ type: 'complete', text: allExtractedText.join('').trim(), processId });
                self.close();
            }
        } 
        catch (error: any) 
        {
            if (tesseractWorker) 
            {
                await tesseractWorker.terminate().catch(() => {});
                tesseractWorker = null;
            }

            self.postMessage({ type: 'error', error: error.message || 'Erro desconhecido no processamento OCR', processId });
            self.close();
        }
    }
};

export {};