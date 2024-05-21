const axios = require('axios');
const sharp = require('sharp');
const fs = require('fs');

// Function to download SVG content
async function downloadSVG(url) {
    try {
        const response = await axios.get(url);
        return response.data;
    } catch (error) {
        console.error('Error downloading SVG:', error);
        return null;
    }
}

// Function to convert SVG content to PNG
async function convertSVGtoPNG(svgContent, outputPath) {
    try {
        await sharp(Buffer.from(svgContent))
            .png()
            .toFile(outputPath);
        console.log('SVG converted to PNG:', outputPath);
    } catch (error) {
        console.error('Error converting SVG to PNG:', error);
    }
}

async function main() {
    const svgUrl = 'https://next-api-share.vercel.app/api/face';
    const concurrency = 10; // Adjust the concurrency level as needed
    const tasks = [];

    for (let i = 0; i < 350; i++) {
        tasks.push(downloadSVG(svgUrl).then(svgContent => {
            if (svgContent) {
                // Convert SVG to PNG
                return convertSVGtoPNG(svgContent, `uglys/face-${i}.png`);
            }
        }));
        if (tasks.length >= concurrency) {
            // Wait for a batch of tasks to complete before proceeding
            await Promise.all(tasks);
            tasks.length = 0; // Clear the tasks array
        }
    }

    // Wait for any remaining tasks to complete
    await Promise.all(tasks);
}

// Run the main function
main();
