# FAULTLINES

A browser grand-strategy board game. One campaign can be played as 1914, 1939, or a near-future war in 2045. The first edition is local: you, hotseat humans, and AI countries at one machine.

There are no runtime dependencies. The rules live in plain JavaScript and do not import a game framework. Forces are original low-poly models drawn with WebGL on the flat map. Three.js is not used.

## Run

From this folder:

```bash
python3 -m http.server 8765
```

Open [http://localhost:8765](http://localhost:8765). `index.html` is the page.

`npm test` runs the rules checks with Node. `npm start` is only a shortcut for the same Python server. npm itself is optional.

## Play

1. Choose an era, turn-based or timeline mode, and a seat.
2. A player commands a country. Other countries can be AI, a second human at this machine, or dormant.
3. Select a territory on the world map. Scroll to zoom, drag to pan, or use the zoom buttons. Legal moves and attacks are marked. Battles show both dice.
4. Diplomacy can propose a new allegiance or open hostilities. Both are explicit.
5. Save writes this browser's local storage and downloads a JSON file. Load accepts either.
6. The presentation switch moves between the strategy board and the 2D anime board without resetting the campaign.

Turn mode and timeline mode are separate. The play clock is a deadline on each human turn, from 30 seconds to one week. Two human seats can veto an expiry; that country then collects automatically, gives no orders, and still rolls a defence die if attacked. Timeline speed (1×, 2×, 4×, 8×) only changes the wait between AI ticks. Space pauses the timeline when you are not typing in a field.

## What carries into the next era

Starting the next era loads that scenario's countries, forces, and politics. It keeps the chronicle, seat, mode, presentation, and AI settings. If your faction finished with the most territories, the heir starts with 1 extra influence. The year does not roll forward by itself at the scenario's horizon. See `docs/RULES.md`.

## Online

Not implemented. Local seats are real, and the order pipeline is ready for a server, but this project will not pretend a room code is a match. See `docs/ONLINE.md`.

## Sources

The map is Natural Earth 1:10m country borders, public domain, projected and grouped into the sixteen theatres. It shows modern coastlines. Theatre colour follows the scenario.

Design ideas were read from TripleA, boardgame.io, Freeciv-web, OpenFrontIO, and Open Doctrines. No code, art, or names were copied from those projects. Licences and the Natural Earth credit are in `THIRD_PARTY_NOTICES.md`.
