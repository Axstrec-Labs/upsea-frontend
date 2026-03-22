let capture;
let canvas;
let render;
let barcodeProcessor;

let canvasSize = {width: 512, height: 512}
let readArea = {
    startX: canvasSize.width/2 - canvasSize.width * 0.35, 
    startY: canvasSize.height/2 - canvasSize.height * 0.1,
    endX: canvasSize.width/2 + canvasSize.width * 0.35,
    endY: canvasSize.height/2 + canvasSize.height * 0.1
}
// relates to the actual size of the captured video
// cannot be initialized until read from the stream
let cReadArea = {
    startX: 0,
    startY: 0,
    endX: 0,
    endY: 0
}
let xMultiplier = 1
let yMultiplier = 1

let isScanning = false
let isScanSuccessful = false
let init = false
let resultIndex = 1

let resultWindow = document.getElementById("resultWindow")
let btnScan = document.getElementById("btnScan")
let btnSwitchCamera = document.getElementById("btnSwitchCamera")
let eltCanvas = document.getElementById("defaultCanvas")

// Animation
let dotSpeed = 80
let dotDirection = 1 * dotSpeed
let dotPos = readArea.startX

btnSwitchCamera.addEventListener("pointerdown", () => {
    capture.remove();
    let backCamera = {
        video: { 
            facingMode: { exact: "environment" } 
        },
        audio: false
    };
    capture = createCapture(backCamera);
    capture.hide();
})

function LogToResultWindow(str){
    resultWindow.innerHTML = `(${resultIndex}) ` + str + resultWindow.innerHTML
    resultIndex += 1
}

class BarcodeProcessor{
    pixels = [];
    bPixels = [];
    bImage = null;
    w = 0;
    h = 0;
    intImage = null;
    xBlockSize = null;
    yBlockSize = null;

    // Only processing reading area
    Capture(image){
        this.image = image
        image.loadPixels()

        this.pixels = image.pixels
        this.w = image.width
        this.h = image.height
        this.bPixels = Array(this.w * this.h).fill(0)
        this.bImage = image
    }

    GetIntegralImage(){
        this.intImage = Array(this.w * this.h).fill(0)
        console.log(this.intImage.length, this.w, this.h)

        let sum = 0
        for(let y = 0; y < this.h; y++){                    
            sum = 0
            for(let x = 0; x < this.w; x++){
                let pos = (x + y * this.w) * 4
                let pixel = Math.round((this.pixels[pos] + this.pixels[pos + 1] + this.pixels[pos + 2]) / 3)
                sum += pixel

                if(y == 0){
                    this.intImage[(x + y * this.w)] = sum
                }else{
                    this.intImage[(x + y * this.w)] = this.intImage[(x + (y-1) * this.w)] + sum
                }
            }
        }
        console.log(this.intImage)
    }

    // Performing adaptive binarization before decoding
    // using adaptive threshold - gaussian 
    Binarize(xBlockSize, yBlockSize, sensitivity){
        if(this.intImage.length == 0){
            console.error("Please generate an integral image first using GetIntegralImage()")
        }

        for(let y = 0; y < this.h; y++){
            for(let x = 0; x < this.w; x++){
                let x1 = Math.round(x - xBlockSize / 2)
                let x2 = Math.round(x + xBlockSize / 2)
                let y1 = Math.round(y - yBlockSize / 2)
                let y2 = Math.round(y + yBlockSize / 2)

                x1 = x1 < 0 ? 0 : x1 > this.w ? this.w-1 : x1
                x2 = x2 < 0 ? 0 : x2 > this.w ? this.w-1 : x2
                y1 = y1 < 0 ? 0 : y1 > this.h ? this.h-1 : y1
                y2 = y2 < 0 ? 0 : y2 > this.h ? this.h-1 : y2

                let count = (x2-x1) * (y2-y1)
                let sum = this.intImage[x2 + y2 * this.w] - this.intImage[x2 + (y1-1) * this.w] - this.intImage[(x1-1) + y2 * this.w] + this.intImage[(x1-1) + (y1-1) * this.w]

                let pos = (x + y * this.w) * 4
                let pixel = Math.round((this.pixels[pos] + this.pixels[pos + 1] + this.pixels[pos + 2]) / 3)
                if((pixel * count) <= (sum * (1-sensitivity))){
                    this.bPixels[x + y * this.w] = 0
                    this.bImage.set(x, y, 0)
                }else{
                    this.bPixels[x + y * this.w] = 255
                    this.bImage.set(x, y, 255)
                }

                // console.log(x1,y1,x2,y2)
            }
        }

        this.bImage.updatePixels();
        console.log(this.bPixels)
    }
}

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

btnScan.addEventListener("click", () => {
    isScanning = true
    isScanSuccessful = false
    // Creating threshold image
    xMultiplier = capture.width / canvasSize.width
    yMultiplier = capture.height / canvasSize.height
    // Mapping read area to capture size read area
    cReadArea.startX = Math.round(readArea.startX * xMultiplier)
    cReadArea.startY = Math.round(readArea.startY * yMultiplier)
    cReadArea.endX = Math.round(readArea.endX * xMultiplier)
    cReadArea.endY = Math.round(readArea.endY * yMultiplier)

    LogToResultWindow(JSON.stringify(cReadArea))

    btnScan.innerText = "Scanning..."

    let readRegion = capture.get(cReadArea.startX, cReadArea.startY, cReadArea.endX - cReadArea.startX, cReadArea.endY - cReadArea.startY)
    barcodeProcessor.Capture(readRegion)
    barcodeProcessor.GetIntegralImage()
    barcodeProcessor.Binarize(128, 8, 0.25)

    btnScan.innerText = "SCAN"
    isScanning = false
})

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

    barcodeProcessor = new BarcodeProcessor()
    
    // Capping the framerate for heating issues
    frameRate(6);
}

function draw() {
    // Late update
    if(!init){
        

        init = true
    }

    // Loop
    background(220);
    
    image(capture, 0,0, canvasSize.width, canvasSize.height)

    if(isScanning && frameCount % 24 == 0 && !isScanSuccessful){
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
                        resultWindow.innerHTML = `<p> (${resultIndex}) result: ${result} ${notes}` + resultWindow.innerHTML
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

    //Read Animation
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
    
    // DEBUG
    if(barcodeProcessor.bImage != undefined){
        // image(barcodeProcessor.bImage, 0, 0)
        image(barcodeProcessor.bImage, readArea.startX, readArea.startY, readArea.endX - readArea.startX, readArea.endY - readArea.startY)
    }
}