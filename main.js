var fs = require('fs');
var randy = require('randy');
var express = require('express');
var bodyParser = require('body-parser');
var assetWalker = require('./assetWalker');
var randy = require('randy');
var cors = require('cors');

const app = express();
app.use(bodyParser.json());
app.use(cors());

var db = {
};

try {
	db = JSON.parse(fs.readFileSync('db.json'));
} catch(error) {
	console.log('Cannot read db.json.  Starting empty.');
}

function saveDb() {
	try {
		fs.writeFileSync('db.json', JSON.stringify(db));
	} catch(error) {
		console.error('cannot write db.json', error);
	}
}

function addAsset(asset) {
	if (db[asset.id]) return;
	db[asset.id] = {
		id: asset.id,
		title: asset.title,
		dash: {
			testedOk: 0,
			testedErrors: 0
		},
		smooth: {
			testedOk: 0,
			testedErrors: 0
		},
		hls: {
			testedOk: 0,
			testedErrors: 0
		}
	};
	saveDb();
}

function getAssetToTest(tech) {
	var mostBadValue = -Infinity;
	var mostBad = [];
	Object.keys(db).forEach((key) => {
		var entry = db[key];
		if (entry[tech].nextTest && entry[tech].nextTest > Date.now())
			return;
		const badness = entry[tech].testedErrors - entry[tech].testedOk;
		if (badness > mostBadValue) {
			mostBadValue = badness;
			mostBad = [];
		}
		if (badness == mostBadValue) {
			mostBad.push(entry);
		}
	});
	if (!mostBad.length)
		return null;

	const chosen = randy.choice(mostBad);

	chosen[tech].nextTest = Date.now() + 60 * 60 * 1000;

	return chosen;
}

function testedOk(tech, assetId) {
	console.log('OK', db[assetId].id, db[assetId].title);
	db[assetId][tech].testedErrors = 0;
	db[assetId][tech].testedOk += 1;
	db[assetId][tech].nextTest = Date.now() + 60 * 60 * 1000;
	db[assetId][tech].lastTest = Date.now().toString();
	saveDb();
}

function testedBad(tech, assetId) {
	console.log('bad', assetId);
	console.log('...', db[assetId].id, db[assetId].title);
	db[assetId][tech].testedOk = 0;
	db[assetId][tech].testedErrors += 1;
	const nextTestDelayMax = db[assetId][tech].testedErrors * 60 * 60 * 1000;
	const nextTestDelay = randy.triangular(0, nextTestDelayMax, nextTestDelayMax);
	db[assetId][tech].nextTest = Date.now() + nextTestDelay;
	db[assetId][tech].lastTest = Date.now().toString();
	saveDb();
}

assetWalker.start(addAsset);

app.get('/asset/:tech', function (req, res) {
	res.header('content-type', 'application/json');
	res.send(getAssetToTest(req.params.tech));
});

app.get('/db', function (req, res) {
	res.header('content-type', 'application/json');
	res.send(db);
});

app.get('/report', function (req, res) {
	const data = {};
	Object.keys(db).forEach((assetId) => {
		const asset = db[assetId];
		['dash', 'smooth', 'hls'].forEach((tech) => {
			data[tech] = data[tech] || [];
			if (asset[tech].testedErrors) {
				data[tech].push({
					id: asset.id,
					title: asset.title,
					lastTest: asset.lastTest,
					errorStreak: asset[tech].testedErrors
				});
			}
		});
	});
	res.header('content-type', 'application/json');
	res.send(data);
});

app.post('/ok/:tech', function (req, res) {
	testedOk(req.params.tech, parseInt(req.body.id), 10);
	res.send('okay good');
});

app.post('/bad/:tech', function (req, res) {
	testedBad(req.params.tech, parseInt(req.body.id), 10);
	res.send('bad asset noted');
});

app.listen(3000, function () {
  console.log('Listening on port 3000. Endpoints:\nGET /asset/[dash|smooth|hls]\nPOST /ok/[dash|smooth|hls]  {"id": assetId}\nPOST /bad/[dash|smooth|hls] {"id": assetId}\nGET /report\nGET /db\n--------')
});
