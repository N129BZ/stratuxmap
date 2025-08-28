// RVR class for runway visual range
class RVR {
    constructor(rvrString) {
        this.re = /(R\d{2})([LRC])?(\/)([PM])?(\d+)(?:([V])([PM])?(\d+))?([NUD])?(FT)?/g;
        let matches;
        while ((matches = this.re.exec(rvrString)) != null) {
            if (matches.index === this.re.lastIndex) {
                this.re.lastIndex++;
            }
            this.runway = matches[1];
            this.direction = matches[2];
            this.seperator = matches[3];
            this.minIndicator = matches[4];
            this.minValue = matches[5];
            this.variableIndicator = matches[6];
            this.maxIndicator = matches[7];
            this.maxValue = matches[8];
            this.trend = matches[9];
            this.unitsOfMeasure = matches[10];
        }
    }
}

export default RVR;
