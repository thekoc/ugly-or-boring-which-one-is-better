const tf = require('@tensorflow/tfjs-node');
const fs = require('fs');
const path = require('path');

// Helper function to load images
const loadImage = async (filePath) => {
    try {
        const imageBuffer = fs.readFileSync(filePath);
        const tfimage = tf.node.decodeImage(imageBuffer, 3);
        return tf.image.resizeBilinear(tfimage, [48, 48]).div(255.0).expandDims(0);
    } catch (error) {
        console.log(filePath)
    }

};

// Load data
const loadDataset = async (dataDir) => {
    const classNames = ['ugly', 'boring'];
    const imagePaths = [];
    const labels = [];

    classNames.forEach((className, index) => {
        const classDir = path.join(dataDir, className);
        fs.readdirSync(classDir).forEach(file => {
            if (!file.startsWith(".")) {
                imagePaths.push(path.join(classDir, file));
                labels.push(index);
            }
        });
    });

    const images = await Promise.all(imagePaths.map(loadImage));
    return {
        images: tf.concat(images),
        labels: tf.tensor1d(labels, 'float32')
    };
};
const trainModel = async () => {
    const dataDir = 'dataset'; // Change this to your dataset path
    const { images, labels } = await loadDataset(dataDir);

    const model = tf.sequential();
    model.add(tf.layers.conv2d({
        inputShape: [48, 48, 3],
        filters: 16,
        kernelSize: 3,
        activation: 'relu'
    }));
    model.add(tf.layers.maxPooling2d({ poolSize: [2, 2] }));
    model.add(tf.layers.conv2d({
        filters: 32,
        kernelSize: 3,
        activation: 'relu'
    }));
    model.add(tf.layers.maxPooling2d({ poolSize: [2, 2] }));
    model.add(tf.layers.flatten());
    model.add(tf.layers.dense({ units: 64, activation: 'relu' }));
    model.add(tf.layers.dropout({ rate: 0.5 })); // Dropout for regularization
    model.add(tf.layers.dense({ units: 2, activation: 'softmax' }));

    model.compile({
        optimizer: tf.train.adam(0.001), // Lower learning rate
        loss: 'sparseCategoricalCrossentropy',
        metrics: ['accuracy']
    });

    await model.fit(images, labels, {
        epochs: 20,
        validationSplit: 0.2,
        callbacks: tf.node.tensorBoard('/tmp/fit_logs_1')
    });

    await model.save('file://./model');
    console.log('Model training complete and saved.');
};


trainModel();
