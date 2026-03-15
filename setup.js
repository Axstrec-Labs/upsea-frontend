var platform = "";

function getDeviceType() {
    const userAgent = navigator.userAgent;
    if (/Mobile|Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(userAgent)) {
        return "mobile"
    } else {
        return "desktop"
    }
}

function setupPlatform(){
    platform = getDeviceType();
    if(platform === "mobile"){
        if(window.location.href !== "/frontend/mobile.html"){
            window.location.href = "/frontend/mobile.html"
        }
    }
}

setupPlatform()


