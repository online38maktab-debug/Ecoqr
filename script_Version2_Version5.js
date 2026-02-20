const video = document.getElementById('video');
const statusText = document.getElementById('status');
const progressBar = document.getElementById('scan-bar');
const progressBox = document.getElementById('progress-box');
const resultScreen = document.getElementById('result-screen');
const loaderScreen = document.getElementById('loader-screen');

let model;
let stabilityCounter = 0;
const REQUIRED_STABILITY = 30; 
let isScanning = true;

// CHIQINDI QUTISINING CHEGARA KOORDINATALARI (ekran o'lchamiga mos)
const TRASH_BIN_AREA = {
    x1: 0.25,      // Chap tomoni (25%)
    y1: 0.60,      // Yuqori tomoni (60%)
    x2: 0.75,      // O'ng tomoni (75%)
    y2: 1.0        // Pastgi tomoni (100% - ekran pastiga)
};

// FAQAT BAKLASHKA UCHUN CONFIG
const config = {
    "bottle": { 
        name: "🍾 Plastik Baklashka", 
        icon: "🍾", 
        info: "Plastik baklashka aniqlandi! Uni qayta ishlash qutisiga tashlang.",
        points: 10,
        qrType: "baklashka"
    }
};

async function setupCamera() {
    try {
        const stream = await navigator.mediaDevices.getUserMedia({
            video: { 
                facingMode: { exact: "user" }
            }, 
            audio: false
        });
        video.srcObject = stream;
        return new Promise((resolve, reject) => {
            video.onloadedmetadata = () => resolve();
            setTimeout(() => reject(new Error("Kamera tayyorlash vaqti tugadi")), 5000);
        });
    } catch (err) {
        console.error("Kamera xatosi:", err);
        document.getElementById('loader-text').innerText = 
            "❌ Kameraga ruxsat berilmadi yoki oldi kamera mavjud emas!";
        loaderScreen.style.opacity = "1";
        throw err;
    }
}

async function init() {
    try {
        await setupCamera();
        model = await cocoSsd.load();
        
        loaderScreen.style.opacity = "0";
        setTimeout(() => {
            loaderScreen.style.display = "none";
        }, 500);
        
        statusText.innerText = "🔍 Baklashkani ramkaga kiriting va qutiga tashlang";
        detectFrame();
        
    } catch (error) {
        console.error("Xato:", error);
        document.getElementById('loader-text').innerText = 
            "❌ AI model yuklanmadi! Internet ulanishini tekshiring.";
        loaderScreen.style.opacity = "1";
    }
}

// BAKLASHKA QUTINING ICHIDAMI TEKSHIRISH
function isBottleInTrashBin(detections) {
    const videoWidth = video.videoWidth;
    const videoHeight = video.videoHeight;

    for (let p of detections) {
        let label = p.class.toLowerCase();
        
        if (label === 'bottle' && p.score > 0.60) {
            // Detektsiyadagi координаtalari
            const bbox = p.bbox; // [x, y, width, height]
            const objX = bbox[0] + bbox[2] / 2;  // Objektning markaziX
            const objY = bbox[1] + bbox[3] / 2;  // Objektning markaziY
            
            // Normallashtirish (0-1 oraliqga)
            const normX = objX / videoWidth;
            const normY = objY / videoHeight;
            
            // QUTIGA TUSHGANINI TEKSHIRISH
            if (normX >= TRASH_BIN_AREA.x1 && 
                normX <= TRASH_BIN_AREA.x2 && 
                normY >= TRASH_BIN_AREA.y1 && 
                normY <= TRASH_BIN_AREA.y2) {
                return true;  // ✅ QUTIDA
            } else {
                return false; // ❌ QUTIDA EMAS
            }
        }
    }
    return null; // BAKLASHKA TOPILMADI
}

async function detectFrame() {
    if (!isScanning) return;
    
    if (!model) {
        requestAnimationFrame(detectFrame);
        return;
    }

    try {
        const predictions = await model.detect(video);
        let bottleFound = false;
        let bottleInBin = false;

        // BAKLASHKA QIDIRLASH
        for (let p of predictions) {
            let label = p.class.toLowerCase();
            
            if (label === 'bottle' && p.score > 0.60) {
                bottleFound = true;
                
                // QUTIGA TUSHGANINI TEKSHIRISH
                bottleInBin = isBottleInTrashBin(predictions);
                
                if (bottleInBin) {
                    // ✅ BAKLASHKA QUTIGA TUSHDI
                    stabilityCounter++;
                    let progress = (stabilityCounter / REQUIRED_STABILITY) * 100;
                    updateUI("🎯 Baklashka qutiga tushdi!", progress, true);

                    if (stabilityCounter >= REQUIRED_STABILITY) {
                        showResult('bottle');
                        return;
                    }
                } else {
                    // ❌ BAKLASHKA QUTIDA EMAS
                    stabilityCounter = Math.max(0, stabilityCounter - 1);
                    updateUI("⚠️ Baklashkani QUT ICHIGA tashlang!", (stabilityCounter / REQUIRED_STABILITY) * 100, false);
                }
                break;
            }
        }

        if (!bottleFound) {
            stabilityCounter = Math.max(0, stabilityCounter - 1);
            updateUI("🔍 Baklashkani qutiga tashlang...", (stabilityCounter / REQUIRED_STABILITY) * 100, false);
        }

    } catch (error) {
        console.error("Deteksiya xatosi:", error);
    }

    requestAnimationFrame(detectFrame);
}

function updateUI(text, progress, active) {
    statusText.innerText = text;
    
    if (progress > 0) {
        progressBox.style.display = "block";
        progressBar.style.width = progress + "%";
        progressBar.style.background = active ? "#00ff88" : "#ff4444";
    } else {
        progressBox.style.display = "none";
    }
}

function showResult(label) {
    isScanning = false;

    const item = config[label];
    
    document.getElementById('result-icon').innerText = item.icon;
    document.getElementById('result-title').innerText = item.name;
    document.getElementById('result-info').innerText = item.info;
    
    // TABRIK VA BALL
    document.getElementById('result-points').innerText = 
        `🎉 Tabriklaymiz! Baklashka uchun ${item.points} ball oldingiz!`;

    // QR KOD (har safar unikal)
    let qrData = `BAKLASHKA-${Date.now()}`;
    let qrHTML = `<img src="https://api.qrserver.com/v1/create-qr-code/?data=${encodeURIComponent(qrData)}&size=160x160" alt="QR kod" />`;
    
    document.getElementById('result-qr').innerHTML = qrHTML;
    resultScreen.style.display = "flex";

    // 2 DAQIQA (120 SEKUND) OXIRIDA QAYTA SKANERLASH
    setTimeout(function(){
        restartScanner();
    }, 120000); // 2 minut = 120000 ms
}

window.restartScanner = function() {
    stabilityCounter = 0;
    isScanning = true;
    resultScreen.style.display = "none";
    statusText.innerText = "🔍 Baklashkani qutiga tashlang";
    document.getElementById('result-qr').innerHTML = "";
    document.getElementById('result-points').innerText = "";
    document.getElementById('qr-timer').innerText = "";
    detectFrame();
}

init();