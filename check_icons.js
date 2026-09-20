const https = require('https');

const urls = [
  'https://www.nytimes.com/games-assets/v2/metadata/wordle-apple-touch-icon.png',
  'https://www.nytimes.com/games-assets/v2/metadata/connections-apple-touch-icon.png',
  'https://www.nytimes.com/games-assets/v2/metadata/strands-apple-touch-icon.png'
];

urls.forEach(url => {
  https.get(url, (res) => {
    console.log(`${url} : ${res.statusCode}`);
  }).on('error', (e) => {
    console.error(`${url} : ${e.message}`);
  });
});
