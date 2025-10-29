module.exports = 
{
    apps: [
        {
            name: 'etics-api',
            script: 'server/app.js',
            instances: 1,
            exec_mode: 'fork',
            env: {
                NODE_ENV: 'production',
                PORT: 3000,
            }
        },
        {
            name: 'etics-ocr-worker',
            script: 'server/workers/ocrWorker.js',
            instances: 2,
            exec_mode: 'fork',
            env: {
                NODE_ENV: 'production',
            }
        }
    ]
};