let capture;
let canvas;
let render;

let canvasSize = {width: 512, height: 512}
let readArea = {
    startX: canvasSize.width/2 - canvasSize.width * 0.28, 
    startY: canvasSize.height/2 - canvasSize.height * 0.1,
    endX: canvasSize.width/2 + canvasSize.width * 0.28,
    endY: canvasSize.height/2 + canvasSize.height * 0.1
}
let xMultiplier = 1
let yMultiplier = 1

let isScanning = false
let isScanSuccessful = false
let init = false
let resultIndex = 1

let resultWindow = document.getElementById("resultWindow")
let btnScan = document.getElementById("btnScan")
let eltCanvas = document.getElementById("defaultCanvas")

// Animation
let dotSpeed = 80
let dotDirection = 1 * dotSpeed
let dotPos = readArea.startX

function startScan(){
    isScanning = !isScanning
    isScanSuccessful = false
}

btnScan.addEventListener("mousedown", () => {
    startScan()
})

btnScan.addEventListener("mouseup", () => {
    startScan()
})

// ======== UTILS ======= 

function getPixel(videoCapture, x, y){
    x = Math.round(x)
    y = Math.round(y)
    const i = (x + y * videoCapture.width) * 4;

    // Get the color values (R, G, B, A)
    const r = videoCapture.pixels[i];
    const g = videoCapture.pixels[i + 1];
    const b = videoCapture.pixels[i + 2];

    return [r,g,b]
}

function decodeCode39(pattern) {
	if (
		!Array.isArray(pattern) ||
		pattern.length !== 9 ||
		pattern.some(bit => bit !== 0 && bit !== 1)
	) {
		throw new Error("Pattern must be an array of exactly 9 digits containing only 0 or 1.");
	}

	// Convert [b0,b1,...,b8] into a 9-bit integer
	const value = pattern.reduce((acc, bit) => (acc << 1) | bit, 0);

	const CODE39_MAP = {
		0x034: '0',
		0x121: '1',
		0x061: '2',
		0x160: '3',
		0x031: '4',
		0x130: '5',
		0x070: '6',
		0x025: '7',
		0x124: '8',
		0x064: '9',

		0x109: 'A',
		0x049: 'B',
		0x148: 'C',
		0x019: 'D',
		0x118: 'E',
		0x058: 'F',
		0x00D: 'G',
		0x10C: 'H',
		0x04C: 'I',
		0x01C: 'J',

		0x103: 'K',
		0x043: 'L',
		0x142: 'M',
		0x013: 'N',
		0x112: 'O',
		0x052: 'P',
		0x007: 'Q',
		0x106: 'R',
		0x046: 'S',
		0x016: 'T',

		0x181: 'U',
		0x0C1: 'V',
		0x1C0: 'W',
		0x091: 'X',
		0x190: 'Y',
		0x0D0: 'Z',

		0x085: '-',
		0x184: '.',
		0x0C4: ' ',
		0x0A8: '$',
		0x0A2: '/',
		0x08A: '+',
		0x02A: '%',

		0x094: '*'
	};

	return CODE39_MAP[value] ?? null;
}

function setup() {
    canvas = createCanvas(canvasSize.width, canvasSize.height, P2D, eltCanvas);
    drawingContext.willReadFrequently = true

    // camera and start capturing video.
    capture = createCapture(VIDEO);
    capture.hide()
    
    // Capping the framerate for heating issues
    frameRate(6);
}

function draw() {
    // Late update
    if(!init){
        // Creating threshold image
        xMultiplier = capture.width / canvasSize.width
        yMultiplier = capture.height / canvasSize.height
        init = true
    }

    // Loop
    background(220);
    
    image(capture, 0,0, canvasSize.width, canvasSize.height)
    filter(THRESHOLD)

    if(isScanning && frameCount % 24 == 0 && !isScanSuccessful){
        capture.loadPixels()
        console.log(capture.pixels)

        let readLine = []
        let codeDetected = false
        let lastBit = 255
        let currentWidth = 0
        let lowest = 9999
        let highest = -9999
        let average;
        for(x = readArea.startX * xMultiplier; x < readArea.endX * xMultiplier; x++){
            let pixel = getPixel(capture, x, capture.height / 2)
            let bit = (pixel[0] + pixel[1] + pixel[2]) / 3  < 128 ? 0 : 255
            
            if(bit == 0 && !codeDetected){
                codeDetected = true
                lastBit = bit
            }

            if(!codeDetected){
                continue
            }

            if(bit == lastBit){
                currentWidth += 1
            }else{
                readLine.push(currentWidth)
                if(currentWidth < lowest){
                    lowest = currentWidth
                }

                if(currentWidth > highest){
                    highest = currentWidth
                }

                currentWidth = 1
            }

            lastBit = bit
        }
        
        console.log("Code recognization")
        console.log(readLine)
        console.log("Lowest",lowest,"Highest",highest,"Average",(lowest + highest) / 2)

        // Module normalization
        let nLowest = 9999
        let nHighest = -9999
        for(let i = 0; i < readLine.length; i++){
            readLine[i] = Math.round(readLine[i] / lowest)
            if(readLine[i] < nLowest){
                nLowest = readLine[i]
            }
            if(readLine[i] > nHighest){
                nHighest = readLine[i]
            }
        }
        average = (nLowest + nHighest) / 2
        readLine = readLine.map(x => x < average ? 0 : 1)
        
        console.log("nLowest",nLowest,"nHighest",nHighest,"Average",average)
        console.log("Module normalization")
        console.log(readLine)

        // Reading barcode
        let result = ""
        let notes = ""
        for(let i = 0; i < readLine.length; i+=10){
            try{
                let code = decodeCode39(readLine.slice(i, i+9))
                if(code != null){
                    if(code !== "8"){
                        result += code
                    }
                }else{
                    notes = "(Not fully detected)"
                }
                
                
            }catch(e){
                console.error(e)
                isScanSuccessful = false
            }
        }

        if(result !== ""){
            isScanSuccessful = true
            resultWindow.innerHTML = `<p> (${resultIndex}) result: ${result} ${notes}` + resultWindow.innerHTML
            resultIndex += 1
        }

        console.log("The barcode says: ", result)

    }

    // Read Animation
    stroke(255,0,0, 85)
    noFill()
    
    if(isScanning && !isScanSuccessful){
        if(dotPos + dotDirection >= readArea.endX|| dotPos + dotDirection < readArea.startX){
            dotDirection *= -1
        }
        dotPos += dotDirection
        line(dotPos + 40, (readArea.startY + readArea.endY) / 2, dotPos, (readArea.startY + readArea.endY) / 2)
        stroke(255,255,0, 90)
    }

    if(isScanSuccessful && isScanning){
        stroke(0,255,0)
    }
    strokeWeight(4)
    quad(readArea.startX, readArea.startY, readArea.endX, readArea.startY, readArea.endX, readArea.endY, readArea.startX, readArea.endY)
    
}