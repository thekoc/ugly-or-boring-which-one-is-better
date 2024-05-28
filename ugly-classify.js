async function loadModel() {
    model = await tf.loadLayersModel('https://raw.githubusercontent.com/thekoc/ugly-or-boring-which-one-is-better/main/model/model.json');
    return model
}

async function predict(model) {
    const imageElement = document.getElementById('selectedImage');
    const tensor = tf.browser.fromPixels(imageElement)
        .resizeNearestNeighbor([48, 48])
        .toFloat()
        .div(tf.scalar(255.0))
        .expandDims();
    const predictions = await model.predict(tensor).data();
    const maxPredictionIndex = predictions.indexOf(Math.max(...predictions));
    return maxPredictionIndex
}
