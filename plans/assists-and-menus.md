# Plan: the remaining Shard Assists, and menu cleanup

**Status: built.** All 14 assists, the three must-fixes and every rework (Forge, Codex, Altar, results, title) are in. A few things differ from the plan:
- Shuten's move uses its own +20% damage-taken debuff (`e.st.sake`) instead of curse, so it doesn't stack with the moon boons.
- Hinome, Shuten and Hibiki dash toward enemies first, so their short-range moves don't hit air.
- The Altar dropdown is gone. Each card has its own assist button instead.
- Menus no longer jump to the top when they redraw.

The game is only shared with close friends, so Sora's borrowed main kit (see Originality below) is fine to leave as it is.

The dev menu (`?dev`) has an **Unlock everything** button. It unlocks all heroes and Forms, fragments, seals, boss wins, Codex entries and lanterns, and gives lots of shards and keys. Story flags are left alone, so the Arc II scenes still play.

## 1. Shard Assists for the other 14 heroes

Six heroes already have their own move: Akane, Rei, Yuki, Kaito, Sekka and Kuroto. Everyone else currently uses the generic Thread Strike.

So assists aren't all "big hit", each new move has a job: **damage**, **control** (stuns, pulls, slows) or **support** (healing, defence, gold). Every move is based on the hero's own weapon or special, so it reads as them at a glance. They all share the same 30-second recharge, since support moves are as valuable as damage ones.

| Hero | Move | Job | What it does |
|---|---|---|---|
| **Sayo** (miko) | Ofuda Seal | Control | Throws a ring of 8 paper charms that home in on enemies. Each enemy hit is pinned in place for about a second. The charms take her patron Kami's colour. |
| **Tetsu** (godless ronin) | One Stroke | Damage | A short pause, then one huge cut along a line through the target. It ignores shields and guards. It's the strongest single hit of any assist, and it hits only once. |
| **Sora** (reaper) | Midnight Delivery | Damage | Blinks between up to five enemies in a zigzag, hitting each one, with a heavier hit on the last. *It's deliberately not a sword wave, for the originality reason below.* |
| **Daigo** (warlord) | Siege Shot | Damage + control | Plants his hammer-cannon and fires one shell at the target. The shell explodes in a wide blast that knocks enemies back. |
| **Isamu** (two swords) | Heaven and Earth | Damage + control | Two crossing slashes in an X on the target. The second slash stuns. |
| **Hibiki** (taiko drummer) | Festival Beat | Control | Four drum beats, each sending a shockwave ring out from her. The last beat stuns everything it touches. |
| **Rinne** (mirror) | Mirror Wall | Support | Raises a mirror around you for 2 seconds. Enemy bullets that touch it are sent back at the enemies. This is the answer to bullet-hell bosses. |
| **Hinome** (sun Kami) | Sunrise Sweep | Damage | A wide naginata sweep that sets enemies on fire and leaves a strip of burning ground for a few seconds. |
| **Raika** (thunder Kami) | Chain Lightning | Damage | A lightning bolt that jumps between up to six enemies. It's best against crowds. |
| **Tsukiyo** (moon Kami) | Crescent Return | Damage | Throws her chakram out to the target and back, hitting on both passes and pulling small enemies a little on the way back. |
| **Mizuha** (water Kami) | Still Water | Support | Leaves a calm pool under you for 4 seconds. Standing in it heals you over time (about 15% in total), and enemies inside it are slowed. |
| **Kazane** (wind Kami) | Gale Gather | Control | A whirlwind that drags nearby enemies into one cluster, then cuts them. It sets up your own area attacks. |
| **Shuten** (oni king) | Oni's Toast | Control | Breathes a cone of burning sake. Enemies caught in it are dazed (slowed) and take 20% more damage for 4 seconds. |
| **Kogane** (gold fox) | Lucky Toss | Support | Showers coins on enemies for light damage. Enemies killed in the next 5 seconds drop extra gold. |

**Small extras:**
- **Lines:** each hero gets two short lines for when they're called in, like the first six have.
- **Altar preview:** the Altar shows each assist's job (damage, control or support) next to its name, so it's easier to choose.

**Originality:** Sora's kit (Getsuga, Bankai, Hollow Mask, Mugetsu) is lifted from *Bleach*, the same problem as Sekka and Kuroto. His assist avoids that, but his main kit needs renaming and reworking before any public release.

## 2. Menu cleanup

I looked at every menu. In order of priority:

### Must fix (these are wrong now, not just rough)
1. **Control hints ignore rebinding.** How to Play, the shrine's bottom-of-screen hint and the first-time control toast all have keys written in by hand ("Q ultimate", "F interact"). If you rebind a key, they still show the old one, and none of them mention the Shard Assist key. They should all read the current bindings, and the gamepad lines should include LB for the assist.
2. **How to Play is out of date.** It says "Climb four Acts of nine rooms each", which isn't true of the god gauntlet or Tokoyo. It needs a short section for each campaign, and lines about Shard Assist and Kuroto's weapon swap.
3. **Each campaign's text is scattered through the code.** The gate names, warnings, banners, the HUD location and the results line are separate checks of the campaign number in four files. I'd move all of it into each campaign's entry in the data, so Acts II to IV of Tokoyo only need a data change. Players won't see a difference, but it stops new campaigns getting the wrong text.

### Rework (these work, but are clunky)
4. **Ponta's Forge:** it's one very long scrolling list of 20 heroes with three Forms each, so you scroll past heroes you've finished with to reach the ones you haven't. I'd make it a portrait grid like the Altar: click a hero to see their Forms and unlock buttons beside the grid. Heroes you can afford to upgrade get a marker.
5. **Codex:**
   - **Bestiary:** it's a flat list of over 100 enemies and bosses with no pictures. I'd group it by campaign and act, and show a small drawing of each one you've seen.
   - **Tabs:** the "Black Sun Seals" tab also holds the god gauntlet, and nothing covers Tokoyo. I'd replace it with a **Campaigns** tab listing every campaign and its progress: seals, gods freed, Tokoyo acts, clears.
   - **Records:** it lists every boss and every hero in one grid of 40+ numbers. I'd split it into overall stats, bosses and heroes, and leave out bosses you haven't met.
6. **Altar of Heroes:** the assist picker is a plain dropdown. I'd show a small badge on the current assist's card, and add a "Set as Shard Assist" button to each card, with the move name and its job.
7. **Results screen:** it shows stats, but not what you earned. I'd add a "This run" line listing anything new: heroes unlocked, Forms awakened, Moon Fragments, seals, gods freed, story moments.
8. **Title screen:** after Arc I ends it still says "Requiem of the Eighth Moon", and the footer only counts Arc I things. Once the rift has opened I'd show an Arc II subtitle and add Tokoyo progress to the footer.

### Leave alone
- **Pause, Lantern Mirror, Moon Phase Pact, Settings, shop and events:** they're already clear and consistent.

## Suggested order
1. Fix the three must-fix items (small, low risk).
2. Build the 14 assists.
3. Rework the Forge, then the Codex, then the Altar, results and title screens.
