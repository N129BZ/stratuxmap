async function parseWeatherMessage(msg) {
	if (!msg || !msg.Type) return null;
	switch (msg.Type) {
		case 'METAR':
			return await parseMetarData(msg);
		case 'TAF':
			return await parseTafData(msg);
		case 'TAF.AMD':
			return await parseTafAmdData(msg);
		case 'PIREP':
			return parsePirepData(msg);
		case 'WINDS':
			return await parseWindData(msg);
		default:
			return null;
	}
}

export { parseWeatherMessage };
import { parseMetarData } from './metarParser.js';
import { parseTafData, parseTafAmdData } from './tafParser.js';
import { parseWindData } from './windParser.js';
import { parsePirepData } from './pirepParser.js';

