var fragments = [];
var durationChart = document.getElementById('duration-chart');
var histogram = document.getElementById('histogram');
let lower = document.getElementById('lower');
let upper = document.getElementById('upper');
let audioElement = document.getElementById('audio');

const audioAlarm = {
    fire: function() {
        audioElement.pause();
        this.timeoutID = undefined;
    },
    setup: function(duration) {
        if (typeof this.timeoutID === 'number') {
            this.cancel();
        }
        this.timeoutID = setTimeout(function() {
          this.fire();
        }.bind(this), duration);
    },
    cancel: function() {
        clearTimeout(this.timeoutID);
    }
};

function roundTimeValue(time) {
    return Math.round(time * 1000) / 1000;
}

function roundTimeValues() {
    for (var i = 0; i < fragments.length; i++) {
        fragments[i].begin = roundTimeValue(fragments[i].begin);
        fragments[i].end = roundTimeValue(fragments[i].end);
    }
}

function updateFragmentData() {
    for (var i = 0; i < fragments.length; i++) {
        fragments[i].duration = roundTimeValue(fragments[i].end - fragments[i].begin);
        fragments[i].text = fragments[i].lines[0];
    }
}

function buttonLoadAudio(evt) {
    var audioFile = evt.target.files[0];
    if (audioFile) {

        readBinaryStringFromBlob(audioFile, catchXingHeader);
        console.log(audioFile);
        function catchXingHeader(binary) {
            console.log(binary.slice(0,1000));
            xingMatch = binary.match(/(Info|Xing)\x00\x00\x00/);
            if(xingMatch){
                if(xingMatch[1] == 'Xing'){
                    alert('Your audio file seems to have variable bitrate. You should convert it to constant bitrate (with iTunes etc), otherwise it\'s meaningless to use this tool.');
                }
                if(xingMatch[1]=='Info' && navigator.userAgent.indexOf("Chrome")===-1){
                    alert('We strongly recommend that you use Google Chrome (because you seem to have the imprecise \'Xing\' seek tables in your CBR encoded MP3 file which are used by browsers other than Chrome).');
                }
            }
        };

        var audioFilePath = URL.createObjectURL(audioFile);
        audioElement.setAttribute("src", audioFilePath);
        document.getElementById("audioLabel").innerHTML = audioFile.name;
    } else {
        alert("Failed to load the audio file.");
    }
}

function buttonLoadJSON(evt) {
    var jsonFile = evt.target.files[0];
    if (jsonFile) {
        loadJSON(jsonFile);
    } else {
        alert("Failed to load the JSON file.");
    }
}

function loadJSON(jsonFile) {
    var reader = new FileReader();
    reader.onload = function (e) {
        try {
            fragments = JSON.parse(e.target.result).fragments;
        } catch (e) {
            alert("Unable to parse the given JSON file.");
            return;
        }
        document.getElementById("jsonLabel").innerHTML = jsonFile.name;
        roundTimeValues(fragments);
        updateFragmentData(fragments);

        let step = 0.1;
        let durations = fragments.map(d => d.duration);
        let min_duration = d3.min(durations) - step;
        let max_duration = d3.max(durations) + step;

        lower.min = min_duration;
        lower.max = max_duration;
        lower.value = min_duration;
        
        upper.min = min_duration;
        upper.max = max_duration;
        upper.value = max_duration;

        let controls = document.getElementById('controls');
        controls.classList.remove('invisible');
        updateCharts();
    };
    reader.readAsText(jsonFile);    
}

function readBinaryStringFromBlob(blob, callback, ie, ie10) {
    var reader = new FileReader();
    if(!ie) {
        reader.addEventListener("loadend", function () {
            callback(reader.result);
        });
        try {
            reader.readAsBinaryString(blob);
        } catch (err) {
            readBinaryStringFromBlob(blob, callback, true);
        }
    }
    else if (!ie10){
        try {
            window.URL = window.URL || window.webkitURL;
            var blobURL = URL.createObjectURL(blob);
            var xhr = new XMLHttpRequest;
            xhr.open("get", blobURL);
            xhr.overrideMimeType("text/plain; charset=x-user-defined");
            xhr.onload = function () {
                callback(xhr.response);
            };
            xhr.send();
        } catch (err) {
            readBinaryStringFromBlob(blob, callback, true, true);
        }
    }
    else {
        reader.addEventListener("loadend", function () {
            var binary = "";
            var bytes = new Uint8Array(reader.result);
            var length = bytes.byteLength;
            for (var i = 0; i < length; i++) {
                binary += String.fromCharCode(bytes[i]);
            }
            callback(binary);
        });
        reader.readAsArrayBuffer(blob);
    }
}

function updateCharts() {
    while (histogram.firstChild) {
        histogram.removeChild(histogram.firstChild);
    }
    while (durationChart.firstChild) {
        durationChart.removeChild(durationChart.firstChild);
    }
    let l = parseFloat(lower.value);
    let u = parseFloat(upper.value);
    let step = 0.1;
    let durations = fragments.map(d => d.duration);
    let min_duration = d3.min(durations) - step;
    let max_duration = d3.max(durations) + step;

    let plot = Plot.plot({
        marks: [
            Plot.ruleX([l], {stroke: "red"}),
            Plot.ruleX([u], {stroke: "green"}),
            Plot.rectY(fragments, Plot.binX({y: "count"}, {x: "duration", fill: "steelblue"}))
        ]
    });
    histogram.appendChild(plot);
    plot = Plot.plot({
        marks: [
            Plot.ruleY([l], {stroke: "red"}),
            Plot.ruleY([u], {stroke: "green"}),
            Plot.dot(fragments, {x: "id", y:"duration", stroke:"steelblue"}),
            Plot.area(fragments, {x1: "id", y1: min_duration-step, y2: l, fillColor: "#888", fillOpacity: 0.3}),
            Plot.area(fragments, {x1: "id", y1: u, y2: max_duration+step, fillColor: "#888", fillOpacity: 0.3})
        ]
    });
    durationChart.appendChild(plot);

    let fragments_filtered = fragments.filter((d) => (d.duration > lower.value) && (d.duration < upper.value));

    let table = d3.select('#table');
    let titles = ["id", "text", "duration", "audio"];
    let headers = table.selectAll('thead').selectAll('tr')
                .selectAll('th')
                .data(titles).enter()
                .append('th')
                .text(d => d);
    let rows = table.selectAll('tbody').selectAll('tr')
                .data(fragments_filtered, d => d.id).join(
                    enter => enter.append('tr'),
                    update => update,
                    exit => exit.remove()
                );
    rows.selectAll('td').data(d => [
        d.id, d.text, d.duration,
        `<i class="bi bi-play-btn-fill text-primary fs-3" onclick="playAudio(event)" data-begin=${d.begin} data-end=${d.end}></i>`
        ]).enter().append('td').html(d => d);
}

function playAudio(event) {
    let element = event.target;
	let duration = element.dataset.end - element.dataset.begin;
	audioElement.currentTime = element.dataset.begin;
	audioElement.play();
	audioAlarm.setup(duration*1000);
}

function pauseAudio() {
	audioElement.pause();
}

{
    document.getElementById("audioinput").addEventListener("change", buttonLoadAudio, false);
    document.getElementById("fileinput").addEventListener("change", buttonLoadJSON, false);
}
