'use strict'

function hide() {
    var x = document.getElementById("message");
    if (x.style.display === "none") {
        x.style.display = "block";
    } else {
        x.style.display = "none";
    }
}