const async = require('async');
const fetch = require('fetch').fetchUrl;
const randy = require('randy');

function feedGetter(categoryId, feedId, start=0) {
	return (onAsset, cb) => {
		console.log('Getting feed', feedId, 'from category', categoryId, 'range', start, '-', (start + 25));
		const url = `https://sumo.tv2.no/rest/categories/${categoryId}/feeds/${feedId}?start=${start}&size=25`;
		fetch(url, (err, meta, body) => {
			if (err) return cb(err);
			try {
				const feed = JSON.parse(body.toString());
				const newTasks = [];
				if (feed.type == 'show') {
					feed.content.forEach((show) => {
						newTasks.push(seasonsGetter(show.id));
					});
				} else {
					feed.content.forEach(onAsset);
				}
				if (feed.content.length)
					newTasks.push(feedGetter(categoryId, feedId, start + 25));
				cb(null, newTasks);
			} catch(err) { return cb(err); }
		});
	}
}

function seasonsGetter(showId) {
	return (onAsset, cb) => {
		console.log('Getting seasons for', showId);
		const url = `https://sumo.tv2.no/rest/shows/${showId}/seasons`;
		fetch(url, (err, meta, body) => {
			if (err) return cb(err);
			try {
				const seasons = JSON.parse(body.toString());
				const newTasks = [];
				seasons.forEach((season) => {
					newTasks.push(episodesGetter(season.id));
				});
				cb(null, newTasks);
			} catch(err) { return cb(err); }
		});
	}
}

function episodesGetter(seasonId, start=0) {
	return (onAsset, cb) => {
		console.log('Getting episodes for', seasonId, 'range', start, '-', (start + 25));
		const url = `https://sumo.tv2.no/rest/shows/${seasonId}/episodes?start=${start}&size=25`;
		fetch(url, (err, meta, body) => {
			if (err) return cb(err);
			try {
				const data = JSON.parse(body.toString());
				data.assets.forEach(onAsset);
				const getNext = [];
				if (data.assets.length)
					getNext.push(episodesGetter(seasonId, start + 25));
				cb(null, getNext);
			} catch(err) { return cb(err); }
		});
	}
}

function seed() {
	return (onAsset, cb) => {
		console.log('Seeding.');
		cb(null,  [
			feedGetter(6676668, 'f_88045'),
			feedGetter(6676667, 'f_88075')
		]);
	}
}

var jobs = [];
function addJob(job) {
	jobs.unshift(job);
	if (jobs.length > 10000) {
		const drop = randy.randInt(jobs.length);
		jobs = jobs.slice(0, drop).concat(jobs.slice(drop + 1));
	}
}

function delayForNext() {
	return 60 * 1000;
}

var stopped = false;
function start(onAsset) {
	if (stopped)
		return;
	if (jobs.length == 0) {
		console.log('Job queue empty.  Adding seed.');
		addJob(seed());
	}
	randy.shuffleInplace(jobs);
	const job = jobs.shift();
	job(onAsset, (err, newJobs) => {
		if (err) {
			console.error(err);
			console.error(err.stack);
		} else {
			console.log('adding', newJobs.length, 'new jobs');
			newJobs.forEach(addJob);
		}
		setTimeout(() => { start(onAsset); }, delayForNext());
	});
}

function stop() {
	stopped = true;
}

function getAssets() {
	return assets;
}

module.exports = { start, stop };
