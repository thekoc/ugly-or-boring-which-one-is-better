// ==UserScript==
// @name         Hide Images Based on JS Function with TensorFlow.js
// @namespace    http://tampermonkey.net/
// @version      0.1
// @description  Hide images on the page based on a custom JS function using TensorFlow.js
// @author       thekoc
// @match        *://*.v2ex.com/*
// @grant        GM_xmlhttpRequest
// @grant        GM_addStyle
// @require      https://cdn.jsdelivr.net/npm/@tensorflow/tfjs@latest
// @run-at   document-start
// ==/UserScript==

class ConfigHelper {
    constructor () {
        this.replaceWithUgly = true
    }
}


class CacheHelper {
    constructor() {
        this.dataKey = "__ugly_face_claasification_cache__"
        this.cacheData = {}
    }

    loadCacheData() {
        this.cacheData = JSON.parse(localStorage.getItem(this.dataKey)) || {}
    }

    saveCacheData() {
        console.log(this.cacheData)
        localStorage.setItem(this.dataKey, JSON.stringify(this.cacheData))
    }
}

function runAfterLoaded(fn) {
    if (document.readyState !== "loading") {
      fn();
    } else {
      document.addEventListener("DOMContentLoaded", () => {
        fn();
      });
    }
}



const customCSS = `
.preparing-avatar {
    filter: brightness(0.12);
    background-color: black;
}

.invalid-avatar {
    filter: brightness(0.12);
    background-color: black;
}

.valid-avatar {
    filter: brightness(1) !important;
}
`;

const beforeLoadingCSS = `
.avatar {
    filter: brightness(0.12);
    background-color: black;
}
`
function fetchImage(imageElement) {
    return new Promise((resolve, reject) => {
        GM_xmlhttpRequest({
            method: 'GET',
            url: imageElement.src,
            responseType: 'blob',
            onload: async function(response) {
                if (response.status === 200) {
                    const blob = response.response
                    // const img = new Image()
                    imageElement.cacheID = imageElement.src
                    imageElement.src = URL.createObjectURL(blob);
                    // document.body.appendChild(img);
                    await imageElement.decode(); // 确保图像加载完全
        
                    resolve(imageElement);
                } else {
                    reject(new Error('Failed to fetch image'));
                }
            },
            onerror: function() {
                reject(new Error('Failed to fetch image'));
            }
        });
    });
}


async function init(beforeLoadingCSSElement) {
    'use strict';



    class AvatarItem {
        /**
         * @param {HTMLImageElement} img Image node
         * @param {String} username username
         */
        constructor(img, username) {
            this.img = img
            this.username = username
            this.type = ""
        }
    }


    async function loadModel() {
        let model = await tf.loadLayersModel('https://raw.githubusercontent.com/thekoc/ugly-or-boring-which-one-is-better/main/model/model.json');
        return model
    }
    
    async function predict(model, imageElement) {
        // console.log("Predicting")
        const tensor = tf.browser.fromPixels(imageElement)
            .resizeNearestNeighbor([48, 48])
            .toFloat()
            .div(tf.scalar(255.0))
            .expandDims();
        
        // tensor.array().then(array => console.log(array));

        const predictions = await model.predict(tensor).data();
        // console.log(predictions)
        const maxPredictionIndex = predictions.indexOf(Math.max(...predictions));
        return maxPredictionIndex
    }
    


    async function hideClassifiedIndices(indices) {
        const tasks = [];
        let model;

        for (const img of document.querySelectorAll('img.avatar')) {
             tasks.push(
                (async () => {
                    let cacheID = img.src
                    let predictedIndex;
                    if (cacheID !== undefined && cacheHelper.cacheData[cacheID] !== undefined) {
                        predictedIndex = cacheHelper.cacheData[cacheID]
                    } else {
                        console.log("Unhit", img.src)

                        if (model === undefined) {
                            model = await loadModel()
                        }
                        let goodImg = await fetchImage(img)
                        predictedIndex = await predict(model, goodImg)
                        if (cacheID !== undefined) {
                            cacheHelper.cacheData[cacheID] = predictedIndex
                        }
                    }
                    

                    if (indices.includes(predictedIndex)) {
                        // img.classList.add("invalid-avatar")
                        const name = img.alt;
                        if (name !== undefined) {
                            const height = img.clientHeight;
                            const width = img.clientWidth;
                            img.src = `https://next-api-share.vercel.app/api/face?username=${name}&h=${height}&w=${width}&f=png`
                            await img.decode();
                            img.classList.remove("preparing-avatar")
                            img.classList.add("valid-avatar")
                        }
                    } else {
                        img.classList.remove("preparing-avatar")
                        img.classList.remove("invalid-avatar")
                        img.classList.add("valid-avatar")
                    }
                })()
            )
            
        }
        await Promise.all(tasks)
    }




    const cacheHelper = new CacheHelper()
    const configHelper = new ConfigHelper()

    cacheHelper.loadCacheData()
    for (const e of document.querySelectorAll('.avatar')) {
        e.classList.add("preparing-avatar")

    }
    if (beforeLoadingCSSElement) {
        beforeLoadingCSSElement.remove()

    }

    await hideClassifiedIndices([1])

    cacheHelper.saveCacheData()

}

async function preprocessAvatars() {
    document.querySelectorAll("img.avatar").forEach((e) => {

        // fetchImage(e);
        e.src = "https://next-api-share.vercel.app/api/face?username=john?w=48&h=48"
        console.log(e)
    })
}

let css = GM_addStyle(customCSS);
let beforeLoadingCSSElement = GM_addStyle(beforeLoadingCSS);
console.log("Added", beforeLoadingCSSElement)
// runAfterLoaded(preprocessAvatars)
runAfterLoaded(() => {init(beforeLoadingCSSElement)})
