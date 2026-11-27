# Rules in this edition

The table and `index.html` use the same rules. This note is the longer form.

## Board

Sixteen theatres. Ownership, faction, neighbours, supply, defence, and forces are all on the board. The drawing under them is a Natural Earth 1:10m world map: modern coastlines and country borders, public domain. Theatre colour is the rule, not a historical border. Sea lanes are dashed. They count as adjacency for movement and for supply.

Before the first order, the setup chooses a season and a year inside the selected era. The countries, ownership, and politics stay those of that era. In timeline mode, a start after spring does not pay that year's spring income a second time.

A territory is in supply when a path of territories you own, land or sea lane, reaches your capital. An out-of-supply territory produces nothing, cannot be reinforced or fortified, and cannot attack. Its defence total takes −1.

## Resources

- Industry comes from supplied territories. A country collects at the start of its turn, or once each spring in timeline mode. Industry caps at 12.
- Reinforce: 2 industry adds 1 force on a supplied territory you own.
- Fortify: 3 industry adds 1 defence, maximum 3.
- Port: 4 industry, on a coastal theatre you own and supply, one per theatre. Russia counts as coastal. A supplied port adds 1 industry and is the door to the exploration grounds that use that theatre.
- Base: 3 industry, on a theatre you own and supply, one per theatre. A base adds +1 to the defence total in battle. It is wrecked if the theatre is taken. It does not raise the fortification track.
- Influence rises by 1 with that collection, and caps at 6. A supplied strategic holding adds 1 more, still inside the cap.
- Allegiance proposal: 2 influence.
- Open hostilities: 1 influence.

## Exploration

Greenland and the other named grounds are not theatres. Taking one does not move a border and does not count toward the sixteen. Each ground pays oil, minerals, or strategic value, and only while you still hold a supplied port on its gateway theatre.

Explore from that port. It costs 3 industry and 1 force from the gateway. The force becomes the garrison. An empty ground is claimed outright and raises the installation written on it: a port on Greenland and the shelves, a base on Hawaii, the Azores, Svalbard, Kuril Station, and Chagos. A held ground is a battle. Attack strength is 1. Defence strength is the garrison, and a base adds +1. The same combat function rolls both dice once. A tie sends the force home. A loss destroys it. The industry is spent either way. The new holder plants their own installation. The previous one is wrecked.

Losing the gateway theatre wrecks its port and its base. Grounds that used that port return to unclaimed, and their garrisons are lost. A conqueror does not inherit them.

Numbers that do not change an order are not shown.

## Orders

Move forces into your own adjacent territory. Each origin can move or attack once a turn, not both.

Attacks require hostility. Countries in the same faction are allies and cannot attack each other. Relation 0 is not hostility. The 1939 German–Soviet pact starts at 0, so the attack button stays closed until someone opens hostilities.

Opening hostilities against a non-aligned country, when you belong to a war faction, brings that country into the opposing war faction. The confirm text says which one.

Taking a capital conquers that country. Its other territories transfer to the conqueror with a small garrison. The faction that is the last war alliance still standing wins, and so does a faction that controls 12 of 16 territories. You can continue after the banner.

## Combat

A battle continues in rounds until one side is eliminated or the attacker retreats. `resolveCombat` rolls one round. The same modifiers apply to a human battle, an AI battle, and auto-resolve.

Each unit rolls one D6 and hits on that roll or less. Add the modifier to the unit's attack or defence. The number needed is never above 6. A result below 1 cannot hit.

Modifiers:

- Era attack bonus, added to every attacking unit.
- Mass commitment, when the era names a strength and the attackers still in the battle reach it.
- Fortification, multiplied by the era's fort factor. 1914 and 1939 use the full fort. 2045 uses half, rounded down.
- Capital: +1 defence.
- Defender out of supply: −1.
- A base on the defender's theatre: +1 defence.

The owner of the units that were hit chooses which units to remove, one unit per hit. An AI country, an inactive human seat, and auto-resolve use one policy: remove the weakest unit first, lowest strength, then lowest cost. Counted units of the same type are interchangeable.

If the attackers are eliminated, the defender holds. If the defenders are eliminated, the surviving attackers occupy. The territory is not occupied while any defender remains.

If both sides remain, the attacker chooses Continue, Retreat, or Auto-resolve. A retreat destination must belong to the attacker, and every surviving unit must have a legal route from the battle to it. The units are not sent home unless that route is legal.

Auto-resolve and the AI continue while attacker strength is at least defender strength, for at most 8 rounds. Otherwise they retreat to the legal destination with the lowest movement cost, preferring the theatre they attacked from when the cost is equal. After 8 rounds, they retreat if they can. If they cannot, the surviving attackers are lost and the defender holds.

The battle record lists the round, each roll, each hit, the chosen losses, and the units still in the fight.

## Movement

Land units use land borders. Ships use sea lanes. Aircraft may use either. A unit may cross as many theatres as its movement stat, and every theatre in between must belong to the mover, except aircraft, which may fly over. The order list is built from those routes. It shows each legal destination, whether the move is combat or non-combat, the movement cost, the units, and the path. A destination that looks reachable but is not gets the reason: the wrong domain, a theatre the unit cannot enter, a route longer than its movement, or hostilities that are still closed.

One order leaves each origin each turn. Attacks require open hostilities. Same-faction countries are allies and cannot attack one another.

## Diplomacy

Persuasion = 2 + relation + one D6 + 1 if the proposer's profile is diplomatic.

Resistance = loyalty + one D6 + a strength advantage of at most 3.

Persuasion must be greater than resistance. A tie refuses. Influence is spent either way. On success, that country's relations are rebuilt from the new faction: allies at 2, opposing war factions at −2, everyone else at 0.

## Modes

Turn mode walks the country order. Your seat is rotated to the front. AI countries take legal orders, then the next country starts. A full circuit advances the year.

The local play clock, if the host enables it, is a deadline on each human turn. The choices run from 30 seconds to one week. A short clock warns at 10 seconds. A longer clock warns once, at a tenth of the time, and never later than one hour. At 0 the host's rule runs, unless two human seats have vetoed it:

- auto-pass, and staged orders are dropped
- execute staged orders, then pass
- hand the rest of the turn to that country's AI profile

A two-seat veto does not give more time. The timed-out country stays in the war and is marked inactive. Income already collected stands, and later turns still collect, but that seat gives no orders. If it is attacked, the defence die is still rolled. Restore puts the seat back on its next turn. The deadline is a time of day, so closing the table does not reset a week. Timeline mode does not use this clock.

Timeline mode does not use that clock. Each tick, one AI country takes one action. 1× waits 1.6 seconds. 2×, 4×, and 8× divide the wait. After every AI country has acted, the season changes. After winter, the year advances and the next tick's spring pays production. Pause is always on the board. Orders are refused while the timeline is running. Space pauses when focus is not in a field.

## AI

Profiles are defensive, expansionist, industrial, diplomatic, and opportunistic. The score looks at adjacent enemy strength, force ratio, supply, territory value, allies, and the profile. Risk, from 0 to 100, lowers the ratio the AI demands before an attack. The dispatch says why a major order was chosen. Randomness is the dice, plus the strategist's one consultation die.

A strategist does not move forces. On that country's turn the AI rolls one D6: 1–3 accept the recommended profile, 4 adapt between the two, 5–6 ignore it. The roll is logged.

Dormant countries do not earn, spend, or act. Turning AI off at setup makes the other countries dormant.

## Eras

| Era | Name | War factions | Marked years |
| --- | --- | --- | --- |
| 1914 | The Powder Keg | Entente, Central Powers | 1914–1918 |
| 1939 | The Fracture | Allies, Axis, Comintern | 1939–1945 |
| 2045 | The Lattice War | Atlantic Accord, Meridian Pact | 2045–2052 |

Reaching the horizon shows a notice. It does not swap the scenario.

**Start next era** resets ownership, forces, defence, factions, relations, industry, influence, the winner, and the year to the new scenario. It keeps the campaign id, chronicle, seat choice, presentation, mode, play-clock settings, and AI risk. Country ids are mapped: Austria-Hungary's seat passes to Germany, the Ottoman seat to Britain, Russia to the Soviet Union, and the 1939 powers into the 2045 compacts. If two seats would inherit the same country, the player seat keeps it. If your faction held strictly the most territories, the heir begins with 1 extra influence.

## Seats

On this machine:

- Player: orders for the chosen country, and for any country marked human.
- Strategist: a recommendation and the consultation die. No movement.
- Spectator: no orders. Same map as everyone else.

The host chooses whether strategists and spectators are allowed before the campaign starts. Leave seat and rejoin affect only this browser. They do not connect to another player.
