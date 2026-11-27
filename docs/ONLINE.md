# Online handoff

This edition does not run an internet match. A room code stored in `localStorage` would be a local save with extra steps, so it is not offered. The button in the client says the rooms are not connected and opens this explanation.

Local player, strategist, and spectator seats do work on one machine. The host's "allow spectators" and "allow strategists" flags are stored on the campaign. Leave seat and rejoin restore the same browser without deleting the campaign. The play clock and its expiry rule also work locally. They are not a network timer.

## What a server has to own

The client already treats a campaign as data. These functions are the authority surface:

- `startCampaign(setup)` builds a fresh state from one era.
- `applyAction(state, action, rng, { fromAi })` checks `legalAction` and writes the next state.
- `resolveCombat` rolls, or accepts dice when `useProvidedRolls` is set. It never rolls a second time.
- `advanceTurn`, `advanceTimeline`, and `applyClockExpiry` are the only clocks.
- `loadFromString` rejects a missing version, a broken file, a bad force count, or an unknown territory.

A server should keep the state. Browsers send orders. They do not send a replacement state.

Suggested seat record:

```json
{
  "matchId": "…",
  "hostToken": "…",
  "allowSpectators": true,
  "allowStrategists": true,
  "seats": [
    { "id": "s1", "role": "player", "countryId": "britain", "token": "…", "connected": true },
    { "id": "s2", "role": "strategist", "countryId": "germany", "token": "…", "connected": false },
    { "id": "s3", "role": "spectator", "token": "…", "connected": true }
  ]
}
```

The host token creates the match and sets the era, mode, clock, expiry rule, and whether the extra seats exist. A player token may submit orders only for its country, and only on that country's turn. A strategist token may submit `{ "type": "recommend", "profile": "defensive" }` and nothing else. A spectator token receives the public state and cannot submit orders.

## Dice

For a network match the server calls `resolveCombat` (and the allegiance roll inside `applyAction`) with dice from its own generator. It stores the rolls on the event. Clients render `state.combat` and `state.diplomacy`. A browser die is not accepted. `useProvidedRolls` exists so the server can pass those stored dice into a replay. The page never sets that flag.

## Timer

The turn clock lives on the server for an online match. The same three expiry rules are already implemented: `pass`, `queue`, and `ai`. The server should:

1. Start the countdown when a human seat's turn begins.
2. Broadcast a warning when 10 seconds remain. The client already logs that sentence for the local clock.
3. On expiry, call `applyClockExpiry` with the host's rule and an AI callback that uses `chooseAction`.
4. Ignore a late order from the seat that just timed out.

Timeline speed stays a view concern only if every client agrees to pause. The safer online rule is: the server advances timeline ticks, and any seat may send `pause`. Do not reuse the turn-clock seconds as the tick delay. Local play already keeps them in different fields (`settings.clockSeconds` and `timeline.speed`).

## Reconnect and missed turns

- The seat token is the reconnect key. On connect, send the current state and whose turn it is.
- A missed turn is whatever `applyClockExpiry` already did. The returning player sees that result. The campaign is not rolled back.
- Leave seat can be a message that sets that country to AI, matching `leaveSeat`. Rejoin with the same token sets it back to human if the country is not conquered, matching `rejoinSeat`.
- Persist the state after every accepted order. A restart loads that snapshot. Invalid JSON is rejected the same way `loadFromString` rejects it.

## View

This edition is an open board. Spectators already see the same territories, forces, and dice as players. If fog is added later, the server must filter the snapshot per seat, and a spectator must not receive a private detail that an active player cannot see.

## What was not built

No WebSocket server, no match directory, no account system, and no shared clock across browsers. boardgame.io was considered and not installed. Its MIT licence would allow a later lobby, but copying that library in now would not by itself be a running authoritative match.
