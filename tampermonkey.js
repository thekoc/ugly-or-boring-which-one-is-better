// ==UserScript==
// @name         Hide Images Based on JS Function with TensorFlow.js
// @namespace    http://tampermonkey.net/
// @version      0.1
// @description  Hide images on the page based on a custom JS function using TensorFlow.js
// @author       thekoc
// @match        *://*.v2ex.com/*
// @grant        GM_xmlhttpRequest
// @grant        GM_addStyle
// @grant GM.setValue
// @grant GM.getValue
// @grant GM_getValue
// @grant GM_setValue
// @require      https://cdn.jsdelivr.net/npm/@tensorflow/tfjs@latest
// @run-at   document-start
// ==/UserScript==
const customCSS = `
.preparing-avatar {
    visibility: hidden;
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
.avatar, my-recent-topics a > img {
    visibility: hidden;
}
`

let css = GM_addStyle(customCSS);
let beforeLoadingCSSElement = GM_addStyle(beforeLoadingCSS);

let model;



async function loadModel() {
    if (model === undefined) {
        console.log("loading model")
        model = await tf.loadLayersModel('https://raw.githubusercontent.com/thekoc/ugly-or-boring-which-one-is-better/main/model/model.json');
    }
    return model
}

function blobToBase64(blob) {
    return new Promise((resolve, _) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result);
      reader.readAsDataURL(blob);
    });
}

class CacheHelper {
    constructor() {
        this._prefix = "__ugly_face_claasification_prefix_"
        this._cache = {}
    }

    async get(key, defaultValue) {
        const cached = this._cache[key]
        if (cached === undefined) {
            return await GM.getValue(key, defaultValue)
        }
    }

    async set(key, value) {
        this._cache[key] = value
        await GM.setValue(key, value)
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
class ConfigHelper {
    constructor () {
    }

    get replaceWithUgly() {
        return GM_getValue("CONFIG_replaceWithUgly", true);
    }

    set replaceWithUgly(value) {
        GM_setValue("CONFIG_replaceWithUgly", value);
    }

    get invalidIndices() {
        return GM_getValue("CONFIG_invalidIndices", []);
    }

    set invalidIndices(value) {
        GM_setValue("CONFIG_invalidIndices", value);
    }

    get invalidUgly() {
       return  this.invalidIndices.includes(0);
    }

    set invalidUgly(hide) {
        const indexSet = new Set(this.invalidIndices);
        if (hide) { 
            indexSet.add(0);
        } else {
            indexSet.delete(0);
        }
        this.invalidIndices = Array.from(indexSet);
    }

    get invalidBoring() {
        return this.invalidIndices.includes(1);
    }

    set invalidBoring(hide) {
        const indexSet = new Set(this.invalidIndices);
        if (hide) { 
            indexSet.add(1);
        } else {
            indexSet.delete(1);
        }
        this.invalidIndices = Array.from(indexSet);
    }
}




function fetchBinaryData(url) {
    return new Promise((resolve, reject) => {
        GM_xmlhttpRequest({
            method: 'GET',
            url: url,
            responseType: 'blob',
            onload: function(response) {
                if (response.status === 200) {
                    const blob = response.response;
                    resolve(blob);
                } else {
                    reject(new Error('Failed to fetch data'));
                }
            },
            onerror: function() {
                reject(new Error('Failed to fetch data'));
            }
        });
    });
}

async function fetchImage(imageElement) {
    const blob = await fetchBinaryData(imageElement.src);
    console.log("fetching result");
    console.log(blob)
    imageElement.src = URL.createObjectURL(blob);
    await imageElement.decode(); // 确保图像加载完全
    return imageElement;
}


async function processImage(img) {
    img.classList.add("preparing-avatar");
    const indices = configHelper.invalidIndices;
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
    let cacheKey = "PREDICT_" + img.src
    let predictedIndex;
    let cachedPredict = await cacheHelper.get(cacheKey);
    if (cacheKey !== undefined && cachedPredict !== undefined) {
        predictedIndex = cachedPredict;
    } else {
        console.log("Unhit", img.src)

        model = await loadModel();
        let goodImg = await fetchImage(img);
        predictedIndex = await predict(model, goodImg)
        if (cacheKey !== undefined) {
            await cacheHelper.set(cacheKey, predictedIndex);
        }
    }


    if (indices.includes(predictedIndex)) {
        img.classList.add("invalid-avatar")
    } else {
        img.classList.remove("invalid-avatar")
        img.classList.add("valid-avatar")
        if (predictedIndex == 1 && configHelper.replaceWithUgly) {
            const name = img.alt;
            if (name !== undefined) {
                await img.decode();
                const height = img.clientHeight;
                const width = img.clientWidth;
                const url = `https://next-api-share.vercel.app/api/face?username=${name}&h=${height}&w=${width}&f=png`;
                const cacheKey = "UGLY_BLOB_" + url;
                const cachedBase64 = await cacheHelper.get(cacheKey);
                if (cachedBase64 !== undefined) {
                    console.log("Face hit");
                    console.log(cachedBase64);
                    img.src = cachedBase64;
                } else {
                    const blob = await fetchBinaryData(url);
                    const base64 = await blobToBase64(blob);
                    await cacheHelper.set(cacheKey, base64);
                    console.log("Saved base64");
                    console.log(base64);
                    img.src = base64;
                }
                
            }
        }
    }

    img.classList.remove("preparing-avatar");
}


async function init(beforeLoadingCSSElement) {
    'use strict';


    console.log("init")
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




    let images = [];
    images = images.concat(
        Array.from(document.querySelectorAll("img.avatar, .avatar, #my-recent-topics a > img"))
    );
    
    


    if (beforeLoadingCSSElement) {
        beforeLoadingCSSElement.remove()
    }

    const tasks = [];

    for (const img of images) {
         tasks.push(
            new Promise(async (resolve, reject) => {
                try {
                    resolve(await processImage(img));
                } catch (error) {
                    reject(error);
                }
            })
        )
    }
    await Promise.all(tasks);

}


function injectSettings() {

    function createSwitchTr(title, initValue = false, onChange = () => {}) {
        
        const id = `id-${crypto.randomUUID()}`;
        const template = document.createElement('template');
        const html = `<tr>
        <td width="120" align="right">${title}</td>
        <td width="auto" align="left"><div class="onoffswitch"><input type="checkbox" name="${id}" id="${id}"><label for="${id}"><div class="frame"></div><div class="switch"></div></label></div></td>
        </tr>`
        template.innerHTML = html;
        console.log(template);
        let checkbox = template.content.querySelector(`#${id}`);
        checkbox.checked = initValue;

        checkbox.addEventListener("change", () => { onChange(checkbox.checked) });

        let result = template.content.children;
        

        if (result.length === 1) {
            result = result[0];
        }

        return result;

        
    }

    const tbody = document.querySelector("form tbody");
    const replaceWithUglySwitch = createSwitchTr("全部替换为丑头像", configHelper.replaceWithUgly, (value) => {configHelper.replaceWithUgly = value});
    const invalidUglySwitch = createSwitchTr("屏蔽丑头像", configHelper.invalidBoring, (value) => {configHelper.invalidUgly = value});
    const invalidBodringSwitch = createSwitchTr("屏蔽普通头像", configHelper.invalidBoring, (value) => {configHelper.invalidBoring = value});
    tbody.prepend(replaceWithUglySwitch);
    tbody.prepend(invalidUglySwitch);
    tbody.prepend(invalidBodringSwitch);
}


const cacheHelper = new CacheHelper()
const configHelper = new ConfigHelper()
// runAfterLoaded(preprocessAvatars)
runAfterLoaded(() => {init(beforeLoadingCSSElement)})

if (window.location.href.endsWith("/settings")) {
    runAfterLoaded(injectSettings);
}