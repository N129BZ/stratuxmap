export const metarPopupTemplate = `
<div class="metar-popup-container" id="featurepopup">
    <pre><code>
        <span class="{{cssClass}}">{{stationName}}
        {{ident}} - {{cat}}</span>
        <p></p>
        {{#if time}}Time:&nbsp;<b>{{time}}</b><br>{{/if}}
        {{#if temp}}Temp:&nbsp;<b>{{tempC}} °C</b> ({{temp}})<br>{{/if}}
        {{#if dewp}}Dewpoint:&nbsp;<b>{{dewpC}} °C</b> ({{dewp}})<br>{{/if}}
        {{#if windir}}Wind Direction:&nbsp;<b>{{windir}}°</b><br>{{/if}}
        {{#if winspd}}Wind Speed:&nbsp;<b>{{winspd}}&nbsp;kt</b><br>{{/if}}
        {{#if wingst}}Wind Gust:&nbsp;<b>{{wingst}}&nbsp;kt</b><br>{{/if}}
        {{#if altim}}Altimeter:&nbsp;<b>{{altim}}&nbsphg</b><br>{{/if}}
        {{#if vis}}Horizontal Visibility:&nbsp;<b>{{vis}}</b><br>{{/if}}
        {{#if wxcode}}Weather:&nbsp;<b>{{wxcode}}</b><br>{{/if}}
        {{#if skyconditions}}{{skyconditions}}{{/if}}
        {{#if icingconditions}}{{icingconditions}}{{/if}}
    </code></pre>
    <span class="windsvg">{{svg}}</span>
    <button class="custom-popup-closer" onclick="closePopup()" style="background:{{bgcolor}}; color:{{fgcolor}};">close</button>
    <textarea id="rawdata" class="rawdata">{{rawmetar}}</textarea><br>
</div>
`;

// Simple template rendering function (no logic for #if, just replaces {{key}})
export function renderMetarPopup(data) {
    let html = metarPopupTemplate;
    for (const key in data) {
        const re = new RegExp(`{{${key}}}`, 'g');
        html = html.replace(re, data[key] ?? "");
    }
    // Remove any unused {{#if ...}} blocks (simple approach)
    html = html.replace(/{{#if [^}]+}}/g, "").replace(/{{\/if}}/g, "");
    return html;
}