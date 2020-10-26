const express = require('express');
const cron = require('node-cron');
const https = require('https');
const fs = require('fs');
const cheerio = require('cheerio')

const APP_DEFAULT_PORT = 3128;
const FETCH_INTERVAL_MINUTES = 1;

// Target URL.
const PROTOCOL = 'https:';
const TARGET_HOSTNAME = 'new.eveselibaspunkts.lv';
const TARGET_PATH = '/lv/Booking/GetPage?EmbeddedCode=&InstitutionCode=7&SpecialistCode=31077011800&SpecialityCode=P02&ServiceCode=&DateFrom=26.10.2020';

// Pattern to search for in a returned html.
const FREE_TIME_SEARCH_PATTERN = 'class=\"timeslot-type timeslot-type-GovernmentPaidTime\"';

// Create file with current time when available free time is found.
const CREATE_FILE_ON_AVAILABLE = true;

app = express();

let port = process.env.PORT;
if (port == null || port == "") {
  port = APP_DEFAULT_PORT;
}
app.listen(port);

logTrace("Application started. Fetch interval in minutes: " + FETCH_INTERVAL_MINUTES);

cron.schedule("*/" + FETCH_INTERVAL_MINUTES + " * * * *", async () => {
    logTrace("Fetching schedule");
    const data = await fetchSchedule();

    logTrace("Parsing received html");
    const hasFreeTime = parseScheduleHtml(data);
    logTrace("Has free time: " + hasFreeTime);

    if (hasFreeTime) {
        logTrace("Free time detected! Saving to txt file");

        // TODO: Send notification.

        if (CREATE_FILE_ON_AVAILABLE) {
            const message = '[' + new Date().toLocaleString() + ']: Free time available!';
            fs.writeFile('available-free-time.txt', message, (err) => {
                if (err) {
                    return logError("An error occured during file saving: " + err);
                }
                logTrace("Free time has been saved to txt file");
            });
        }  
    }
});

function fetchSchedule() {
    return new Promise((resolve, reject) => {
        const options = {
            protocol: PROTOCOL,
            hostname: TARGET_HOSTNAME,
            path: TARGET_PATH,
            headers: {
                // Required to receive successful response. Alternative version can be used.
                'user-agent': 'Chrome/86.0.4240.75'
            }
        }
        https.get(options, (response) => {
            let responseData = "";
            response.on('data', (chunk) => {
                responseData += chunk;
            });
            response.on('end', () => {
                resolve(responseData);
            });
        }).on('error', (error) => {
            logError("Error received: " + error.message);
        });
    });
}

function parseScheduleHtml(html) {
    if (!html) {
        logError("Empty response received");
        return false;
    }

    // Currently search is done only in first time table.
    const $ = cheerio.load(html);
    const firstTable = $('.time-table-body').html();

    if (!firstTable || firstTable === "") {
        logError("No time tables were found in html response");
        return false;
    }

    return firstTable.includes(FREE_TIME_SEARCH_PATTERN);
}

function logTrace(message) {
    const event_time = new Date().toLocaleString();
    console.log("[" + event_time + "]: " + message);
}

function logError(message) {
    const event_time = new Date().toLocaleString();
    console.error("[" + event_time + "]: " + message);
}